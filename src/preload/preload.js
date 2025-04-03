const { contextBridge, ipcRenderer } = require('electron');

// Define allowed channels for receiving data from main process
const allowedReceiveChannels = [
    'update-status', 
    'new-reading', 
    'stats-reset-acknowledged'
    // Add other channels like 'overlay-update' if needed
];

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Invoke/Handle (Request/Response)
  getVersion: () => ipcRenderer.invoke('get-version'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  selectRegion: () => ipcRenderer.invoke('select-region'),
  testOcr: () => ipcRenderer.invoke('test-ocr'),
  // TODO: Add invoke for getRegionPreview if implemented

  // Send (One-way to Main)
  saveSettings: (settings) => ipcRenderer.send('save-settings', settings),
  resetStats: () => ipcRenderer.send('reset-stats'),
  startCapture: (interval) => ipcRenderer.send('start-capture', interval),
  stopCapture: () => ipcRenderer.send('stop-capture'),
  sendStatsUpdateForOverlay: (stats) => ipcRenderer.send('stats-updated-for-overlay', stats),
  // TODO: Add send for overlay position changes

  // On (Receive from Main)
  on: (channel, func) => {
    if (allowedReceiveChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender` 
      // and potentially other internal details
      const listener = (event, ...args) => func(...args);
      ipcRenderer.on(channel, listener);
      // Return a function to remove the listener
      return () => ipcRenderer.removeListener(channel, listener);
    } else {
        console.warn(`Preload: Ignoring listener request for disallowed channel: ${channel}`);
        return () => {}; // Return dummy remove function
    }
  },
  // Remove listener function (alternative to returning from 'on')
  removeListener: (channel, listener) => {
     if (allowedReceiveChannels.includes(channel)) {
         ipcRenderer.removeListener(channel, listener);
     } else {
          console.warn(`Preload: Ignoring removeListener request for disallowed channel: ${channel}`);
     }
  },
  // Listener Registration (Renderer -> Main)
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, status) => callback(status)),
  onNewReading: (callback) => ipcRenderer.on('new-reading', (_event, reading) => callback(reading)),
  onStatsReset: (callback) => ipcRenderer.on('stats-reset-acknowledged', () => callback()),
  
  // Add function to send overlay updates (Renderer -> Main)
  sendStatsUpdateForOverlay: (stats) => ipcRenderer.send('stats-updated-for-overlay', stats),

  // Add functions to toggle overlay edit modes
  toggleEditOverlay1: (shouldEdit) => ipcRenderer.invoke('toggle-edit-overlay1', shouldEdit),
  toggleEditOverlay2: (shouldEdit) => ipcRenderer.invoke('toggle-edit-overlay2', shouldEdit),

  // Cleanup listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});

console.log('Preload script loaded and electronAPI exposed.'); 