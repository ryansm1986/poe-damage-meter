const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay2API', {
    // Listen for new hits from main process
    onNewHit: (callback) => {
        const listener = (event, hitValue) => callback(hitValue);
        ipcRenderer.on('new-hit', listener);
        // Return function to remove listener
        return () => ipcRenderer.removeListener('new-hit', listener);
    },

    // Listener for edit mode changes
    onSetEditMode: (callback) => ipcRenderer.on('set-edit-mode', (_event, isEditing) => callback(isEditing)),
    
    // Listener for animation style changes
    onAnimationStyleChange: (callback) => {
        const listener = (event, style) => callback(style);
        ipcRenderer.on('animation-style-change', listener);
        // Return function to remove listener
        return () => ipcRenderer.removeListener('animation-style-change', listener);
    },
    
    // Get current animation style
    getAnimationStyle: () => ipcRenderer.invoke('get-animation-style'),

    // Cleanup listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    
    // Move window by delta (for manual dragging)
    moveWindow: (deltaX, deltaY) => ipcRenderer.invoke('move-overlay2', { deltaX, deltaY }),
});

console.log('Overlay 2 preload script loaded.'); 