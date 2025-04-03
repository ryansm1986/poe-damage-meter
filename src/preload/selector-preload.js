const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('selectorAPI', {
    sendRegion: (region) => ipcRenderer.send('region-selected', region),
    cancelSelection: () => ipcRenderer.send('region-selection-cancelled')
});

console.log('Selector preload script loaded.'); 