const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 姓名更新
    sendNameToFloat: (name) => ipcRenderer.send('update-name', name),
    //获取主题
    getCurrentTheme: () => ipcRenderer.sendSync('get-current-theme'),
    // 快速点名
    onQuickRoll: (callback) => ipcRenderer.on('execute-quick-roll', callback),

    // 悬浮窗控制
    showFloatWindow: () => ipcRenderer.send('show-float-window'),
    hideFloatWindow: () => ipcRenderer.send('hide-float-window'),
    isFloatWindowVisible: () => ipcRenderer.invoke('is-float-window-visible'),

    // 窗口控制
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    closeWindow: () => ipcRenderer.send('window-close'),  
    
    // 新增动画控制接口
    startFloatAnimation: (names, speed) => ipcRenderer.send('start-float-animation', { names, speed }),
    stopFloatAnimation: (name) => ipcRenderer.send('stop-float-animation', name),

    // 新增：用于发送主题信息到悬浮窗
    sendThemeToFloat: (themeName) => ipcRenderer.send('update-float-theme', themeName),

    // 外部链接打开
    openExternal: (url) => ipcRenderer.send('open-external', url),

    //启动同时启动悬浮窗
    getConfig: (key) => ipcRenderer.invoke('get-config', key),
    setConfig: (value) => {
        // 确保传递布尔值
        return ipcRenderer.invoke('set-config', Boolean(value)) 
    },
    //开机自启动
    getAutoLaunchConfig: () => ipcRenderer.invoke('get-auto-launch-config'),
    setAutoLaunchConfig: (config) => ipcRenderer.invoke('set-auto-launch-config', config),
    //开发者工具
    openDevTools: (callback) => ipcRenderer.on('devtools-response', callback),
    requestDevTools: () => ipcRenderer.send('request-devtools'),
      // 添加更新相关API
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  openExternal: (url) => ipcRenderer.send('open-external', url)
})