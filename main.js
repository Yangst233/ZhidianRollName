const { app, BrowserWindow, Tray, Menu, ipcMain, Notification } = require('electron')
const path = require('path')
const Store = require('electron-store')
const AutoLaunch = require('auto-launch')

// 初始化配置存储
const store = new Store({
  defaults: {
    launchFloat: false,
    floatWindowPosition: null,
    autoLaunch: false,
    autoLaunchFloat: false
  }
})

// ===== 自动启动配置 =====
const appLauncher = new AutoLaunch({
  name: '智点·随机点名',
  path: process.platform === 'win32' ? process.execPath : app.getPath('exe'),
  isHidden: true
})

// ===== 单实例锁 =====
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
    if (floatWindow) {
      floatWindow.show()
    }
  })
}

let mainWindow = null
let floatWindow = null
let tray = null
let isQuitting = false

function createWindows() {
  // ===== 主窗口配置 =====
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: !store.get('autoLaunchFloat'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      devTools: true
    },
    icon: path.join(__dirname, 'icon.png'),
    frame: false,
    backgroundColor: '#fff'
  })

  mainWindow.loadFile('index.html')

  // ===== IPC通信处理 =====
  ipcMain.on('quick-roll', (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('execute-quick-roll')
    }
  })

  ipcMain.handle('get-config', () => store.get('launchFloat', false))
  ipcMain.handle('set-config', (_, value) => {
    store.set('launchFloat', Boolean(value))
  })

  ipcMain.handle('get-auto-launch-config', async () => ({
    autoLaunch: await appLauncher.isEnabled(),
    autoLaunchFloat: store.get('autoLaunchFloat', false)
  }))

  ipcMain.handle('set-auto-launch-config', async (_, config) => {
    try {
      if (config.autoLaunch) {
        await appLauncher.enable()
      } else {
        await appLauncher.disable()
        store.set('autoLaunchFloat', false)
      }
      store.set('autoLaunchFloat', config.autoLaunch && config.autoLaunchFloat)
      if (config.autoLaunchFloat) {
        mainWindow.hide()
        floatWindow?.show()
      }
    } catch (err) {
      console.error('自动启动配置失败:', err)
    }
  })

  ipcMain.on('window-minimize', () => mainWindow.minimize())
  ipcMain.on('window-close', () => mainWindow.close())

  if (process.platform === 'darwin') {
    app.dock.hide()
  }

  mainWindow.on('ready-to-show', () => {
    if (!store.get('autoLaunchFloat')) {
      mainWindow.show()
    }
  })

  // ===== 悬浮窗口增强配置 ===== 
  const savedPosition = store.get('floatWindowPosition')
  floatWindow = new BrowserWindow({
    width: 160,
    height: 80,
    x: savedPosition?.x,
    y: savedPosition?.y,
    show: store.get('launchFloat') || store.get('autoLaunchFloat'),
    // 关键修改点1: 窗口类型和焦点设置
    type: process.platform === 'darwin' ? 'panel' : 'toolbar',
    alwaysOnTop: true,
    focusable: false,  // 禁止聚焦
    frame: false,
    transparent: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
     // Windows特殊设置
     ...(process.platform === 'win32' && {
      hasShadow: false, // 禁用系统阴影
      paintWhenInitiallyHidden: true
  }),
    skipTaskbar: true,
    icon: path.join(__dirname, 'icon.png')
  })
  floatWindow.loadFile('float.html')

  // 关键修改点2: 增加位置保存后的置顶
  floatWindow.on('moved', () => {
    const [x, y] = floatWindow.getPosition()
    store.set('floatWindowPosition', { x, y })
    if (process.platform === 'win32') {
      floatWindow.setAlwaysOnTop(true, 'screen-saver')
    } else {
      floatWindow.setAlwaysOnTop(true)
    }
  })

  // 关键修改点3: 显示事件绑定
  floatWindow.on('show', () => {
    floatWindow.setAlwaysOnTop(true)
  })

  // 关键修改点4: 失去焦点时重新置顶
  floatWindow.on('blur', () => {
    if (!floatWindow.isDestroyed() && floatWindow.isVisible()) {
      floatWindow.setAlwaysOnTop(true)
    }
  })

  // ===== 系统托盘 =====
  createTray()

  // ===== 窗口通信 =====
  ipcMain.on('show-float-window', () => floatWindow.show())
  ipcMain.on('hide-float-window', () => floatWindow.hide())
  ipcMain.handle('is-float-window-visible', () => floatWindow?.isVisible() || false)

  ipcMain.on('start-float-animation', (_, data) => {
    floatWindow?.webContents.send('start-float-animation', data)
  })

  ipcMain.on('stop-float-animation', (_, name) => {
    floatWindow?.webContents.send('stop-float-animation', name)
  })

  // ===== 窗口事件处理 =====
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
      showNotification('主界面已最小化到托盘。如需退出请右键托盘图标。')
    }
  })

  floatWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      floatWindow.hide()
    }
  })

  ipcMain.on('open-external', (_, url) => {
    require('electron').shell.openExternal(url)
  })
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'icon.png'))
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主界面',
      click: () => mainWindow.show()
    },
    {
      label: '显示/隐藏悬浮窗',
      click: () => floatWindow.isVisible() ? floatWindow.hide() : floatWindow.show()
    },
    { type: 'separator' },
    {
      label: '退出程序',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setToolTip('智点·随机点名')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => mainWindow.show())
}

function showNotification(message = '') {
  new Notification({
    title: '智点·随机点名',
    body: message || '程序正在后台运行',
    icon: path.join(__dirname, 'icon.png')
  }).show()
}

// ===== 应用生命周期 =====
app.whenReady().then(() => {
  if (store.get('autoLaunch')) {
    if (store.get('autoLaunchFloat')) {
      createWindows()
      mainWindow.hide()
      floatWindow.show()
    } else {
      createWindows()
    }
  } else {
    createWindows()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (mainWindow === null && !isQuitting) createWindows()
})

app.on('before-quit', () => {
  isQuitting = true
  floatWindow?.destroy()
})
