const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getVersion: () => ipcRenderer.invoke('get-version'),
    onProgress: (cb) => ipcRenderer.on('progress', (_, v) => cb(v)),
    onStatus: (cb) => ipcRenderer.on('status', (_, v) => cb(v)),
    onError: (cb) => ipcRenderer.on('error', (_, v) => cb(v))
});