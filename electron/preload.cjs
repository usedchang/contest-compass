const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('contestNative', {
  fetchStatement: id => ipcRenderer.invoke('statement:fetch', id),
  fetchAtcoderCatalog: () => ipcRenderer.invoke('atcoder:catalog'),
  savePng: (filename, dataUrl) => ipcRenderer.invoke('statement:save-png', filename, dataUrl)
});
