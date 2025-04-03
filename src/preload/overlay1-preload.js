const { contextBridge, ipcRenderer } = require('electron');

const allowedReceiveChannels = ['stats-update'];

contextBridge.exposeInMainWorld('overlayAPI', {
    // Request initial data on mount
    requestInitialData: () => ipcRenderer.send('request-overlay1-data'),

    // Listen for stats updates from main
    onStatsUpdate: (callback) => {
        const listener = (event, stats) => callback(stats);
        ipcRenderer.on('stats-update', listener);
        // Return function to remove listener
        return () => ipcRenderer.removeListener('stats-update', listener);
    },

    // Notify main process about position changes (from dragging)
    notifyPositionChange: (position) => ipcRenderer.send('overlay1-position-changed', position)
});

console.log('Overlay 1 preload script loaded.');

contextBridge.exposeInMainWorld('overlay1API', {
    // Listener for stats updates from Main Process
    onStatsUpdate: (callback) => ipcRenderer.on('stats-update', (_event, stats) => callback(stats)),
    
    // Listener for edit mode changes
    onSetEditMode: (callback) => ipcRenderer.on('set-edit-mode', (_event, isEditing) => callback(isEditing)),

    // Request initial data (optional, if needed on load)
    requestData: () => ipcRenderer.send('request-overlay1-data'),

    // Cleanup listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
}); 