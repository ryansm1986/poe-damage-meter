const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const Store = require('electron-store');
const screenshot = require('screenshot-desktop');
const Jimp = require('jimp');
const Tesseract = require('tesseract.js');
const { debounce } = require('lodash'); // Use regular lodash for debounce in main process

// Initialize Tesseract worker
let ocrWorker = null;
let ocrInitialized = false;
async function initializeOcrWorker() {
    if (ocrInitialized || ocrWorker) return; // Prevent multiple initializations
    console.log('Initializing Tesseract worker...');
    try {
        ocrWorker = await Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
            // logger: m => console.log(`[Tesseract] ${m.status}: ${m.progress ? (m.progress * 100).toFixed(1) + '%' : ''}`),
            cacheMethod: 'none', // Avoid issues with cache path on packaged apps
        });
        await ocrWorker.setParameters({
            tessedit_char_whitelist: '0123456789', // Only recognize digits
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE, // Assume single line number
        });
        ocrInitialized = true;
        console.log('Tesseract worker initialized.');
    } catch (error) {
        console.error('Failed to initialize Tesseract worker:', error);
        ocrWorker = null; // Ensure worker is null on failure
        ocrInitialized = false;
         if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', 'OCR Init Error');
    }
}

// Initialize electron-store
const store = new Store({
  defaults: {
    captureRegion: null,
    settingsTabIndex: 0,
    overlay1Enabled: true,
    overlay1Position: { x: 50, y: 50 },
    overlay1Size: { width: 180, height: 75 },
    overlay2Enabled: false,
    overlay2Position: null, // Set default to null for calculation
    overlay2Size: null,     // Set default to null for calculation
    ocrWhitelist: '0123456789',
    captureInterval: 500,
    targetDisplayId: null,
  }
});

// Define default constants for Overlay 2 size
const DEFAULT_OVERLAY2_WIDTH = 300;
const DEFAULT_OVERLAY2_HEIGHT = 300;

// --- Helper: Get Display Scaling Factor ---
function getDisplayScalingFactor(point) {
    try {
        // Ensure point is valid before passing to electron API
        const validPoint = { x: Math.round(point.x) || 0, y: Math.round(point.y) || 0 };
        const display = screen.getDisplayNearestPoint(validPoint);
        return display.scaleFactor || 1;
    } catch (error) {
        console.warn('Failed to get display scaling factor, defaulting to 1:', error);
        return 1; // Default to 1 if detection fails
    }
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow = null;
let selectorWindow = null;
let overlay1Window = null;
let overlay2Window = null; // Add reference for Overlay 2

// Store last known stats to send to overlays immediately on creation/request
let lastSentStats = { dps: 0, lastHit: 0, largestHit: 0 };

let isEditingOverlay1 = false; // Track edit state
let isEditingOverlay2 = false;

// --- Overlay 1 Window Management ---
function createOverlay1Window() {
    if (overlay1Window) { console.log('[Main Process] createOverlay1Window: Already exists.'); overlay1Window.focus(); return; }
    console.log('[Main Process] createOverlay1Window: Creating...');
    const savedPosition = store.get('overlay1Position');
    const savedSize = store.get('overlay1Size'); // Get size
    console.log('[Main Process] Using position for Overlay 1:', savedPosition);
    console.log('[Main Process] Using size for Overlay 1:', savedSize); // Log size
    
    overlay1Window = new BrowserWindow({
        x: savedPosition.x,
        y: savedPosition.y,
        width: savedSize.width, // Use stored width
        height: savedSize.height, // Use stored height
        minWidth: 100, // Adjust min size if necessary
        minHeight: 50,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: true, // Keep resizable
        movable: true, // Keep movable
        skipTaskbar: true,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, '../preload/overlay1-preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });
    
    // Set the window level using the CORRECT method
    // Pass true to enable alwaysOnTop, and specify the level
    overlay1Window.setAlwaysOnTop(true, 'screen-saver');
    
    console.log('[Main Process] Overlay 1 created. Initial Bounds:', overlay1Window.getBounds());

    // Load the correct URL/File based on environment
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
        overlay1Window.loadURL('http://localhost:5173/overlay1.html');
        overlay1Window.webContents.openDevTools({ mode: 'detach' });
    } else {
        overlay1Window.loadFile(path.join(__dirname, '../../dist/overlay1.html'));
    }
    // overlay1Window.webContents.openDevTools({ mode: 'detach' }); // For debugging overlay

    // Debounced function to save position
    const debouncedSavePosition = debounce(() => {
        if (overlay1Window && !overlay1Window.isDestroyed()) {
             try {
                const [x, y] = overlay1Window.getPosition();
                store.set('overlay1Position', { x, y });
                console.log('Overlay 1 position saved:', { x, y });
            } catch (error) {
                 console.error('Error getting overlay position:', error);
            }
        }
    }, 1000); // Save 1 second after move/resize stops

    overlay1Window.on('moved', debouncedSavePosition);
    overlay1Window.on('resized', debouncedSavePosition); // Save on resize too if needed

    overlay1Window.on('closed', () => {
        console.log('Overlay 1 window closed.');
        overlay1Window = null;
    });

    overlay1Window.once('ready-to-show', () => {
        console.log('[Main Process] Overlay 1 ready-to-show event FIRED.'); 
        if (!overlay1Window || overlay1Window.isDestroyed()) {
            console.log('[Main Process] Overlay 1 destroyed before showing.');
            return;
        }
        console.log('[Main Process] Overlay 1 showing and focusing window.');
        overlay1Window.show(); 
        overlay1Window.focus();
        setTimeout(sendStatsToOverlay1, 100); 
    });
}

function closeOverlay1Window() {
    if (overlay1Window && !overlay1Window.isDestroyed()) {
        overlay1Window.close();
    }
    overlay1Window = null;
}

// Function to send stats updates to Overlay 1 if it exists
function sendStatsToOverlay1() {
    if (overlay1Window && !overlay1Window.isDestroyed()) {
        console.log('[Main Process] Sending stats-update to Overlay 1:', lastSentStats);
        overlay1Window.webContents.send('stats-update', lastSentStats);
    }
}

// Listen for request for initial data from overlay
ipcMain.on('request-overlay1-data', () => {
    console.log('Overlay 1 requested initial data.');
    sendStatsToOverlay1();
});

// Optional: Listen for explicit position changes from preload if needed
// ipcMain.on('overlay1-position-changed', (event, position) => {
//     store.set('overlay1Position', position);
// });


// --- Overlay 2 Window Management ---
function createOverlay2Window() {
    if (overlay2Window) { console.log('[Main Process] createOverlay2Window: Already exists.'); return; }
    console.log('[Main Process] createOverlay2Window: Creating...');
    
    let position = store.get('overlay2Position');
    let size = store.get('overlay2Size');
    const primaryDisplay = screen.getPrimaryDisplay();
    const displayBounds = primaryDisplay.bounds;

    // If size is missing, use default
    if (!size || !size.width || !size.height) {
        console.log('[Main Process] Overlay 2 size not found in store, using default.');
        size = { width: DEFAULT_OVERLAY2_WIDTH, height: DEFAULT_OVERLAY2_HEIGHT };
        store.set('overlay2Size', size); // Save default size
    }

    // If position is missing, calculate center
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
        console.log('[Main Process] Overlay 2 position not found in store, calculating center.');
        const centerX = Math.round(displayBounds.x + (displayBounds.width / 2) - (size.width / 2));
        const centerY = Math.round(displayBounds.y + (displayBounds.height / 2) - (size.height / 2));
        position = { x: centerX, y: centerY };
        store.set('overlay2Position', position); // Save calculated position
    }

    console.log('[Main Process] Using position for Overlay 2:', position);
    console.log('[Main Process] Using size for Overlay 2:', size);

    overlay2Window = new BrowserWindow({
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: false, // Keep resizable false initially
        movable: true,   // <-- Set movable to TRUE initially, like Overlay 1
        skipTaskbar: true,
        focusable: false,
        hasShadow: false,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, '../preload/overlay2-preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });
    
    // Apply the same always-on-top level setting
    overlay2Window.setAlwaysOnTop(true, 'screen-saver');

    console.log('[Main Process] Overlay 2 created. Initial Bounds:', overlay2Window.getBounds());

    // Open DevTools for this overlay window for debugging
    // overlay2Window.webContents.openDevTools({ mode: 'detach' }); // Keep commented out unless needed

    // IMPORTANT: Make the window click-through (this prevents moving even if movable:true)
    overlay2Window.setIgnoreMouseEvents(true);

    // Load the correct URL/File based on environment
    if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
        // Use loadURL to load from Vite dev server
        overlay2Window.loadURL('http://localhost:5173/overlay2.html');
        overlay2Window.webContents.openDevTools({ mode: 'detach' }); // Open dev tools in dev
    } else {
        // In production, load the built file
        overlay2Window.loadFile(path.join(__dirname, '../../dist/overlay2.html'));
    }
    // overlay2Window.webContents.openDevTools({ mode: 'detach' }); // For debugging

    overlay2Window.on('closed', () => {
        console.log('Overlay 2 window closed.');
        overlay2Window = null;
    });

    overlay2Window.once('ready-to-show', () => {
         console.log('[Main Process] Overlay 2 ready-to-show event FIRED.');
         if (!overlay2Window || overlay2Window.isDestroyed()) {
            console.log('[Main Process] Overlay 2 destroyed before showing.');
            return;
         }
         console.log('[Main Process] Overlay 2 showing window.');
         overlay2Window.show(); 
     });
}

function closeOverlay2Window() {
    if (overlay2Window && !overlay2Window.isDestroyed()) {
        overlay2Window.close();
    }
    overlay2Window = null;
}

// Function to send only the last hit value to Overlay 2
function sendHitToOverlay2(lastHitValue) {
    if (overlay2Window && !overlay2Window.isDestroyed() && lastHitValue > 0) {
        console.log('[Main Process] Sending new-hit to Overlay 2:', lastHitValue);
        overlay2Window.webContents.send('new-hit', lastHitValue);
    }
}

// --- Core OCR / Capture Functions --- (Moved Up)
let captureIntervalId = null;
let isProcessing = false;

async function performSingleOcr(region) {
    if (!ocrWorker || !ocrInitialized) { return { success: false, error: 'OCR not initialized' }; }
    if (!region) { return { success: false, error: 'No region selected' }; }
    const { x, y, width, height } = region; let imageDataUri = null;
    try {
        const scaleFactor = getDisplayScalingFactor({ x, y });
        const physicalX = Math.round(x * scaleFactor);
        const physicalY = Math.round(y * scaleFactor);
        const physicalWidth = Math.round(width * scaleFactor);
        const physicalHeight = Math.round(height * scaleFactor);
        if (physicalWidth <= 1 || physicalHeight <= 1) { return { success: false, error: 'Invalid region dimensions' }; }
        const targetDisplay = screen.getDisplayNearestPoint({ x: physicalX, y: physicalY });
        if (!targetDisplay) { return { success: false, error: 'Cannot find display for region' }; }
        const displayPhysicalX = Math.round(targetDisplay.bounds.x * scaleFactor);
        const displayPhysicalY = Math.round(targetDisplay.bounds.y * scaleFactor);
        const cropX = physicalX - displayPhysicalX;
        const cropY = physicalY - displayPhysicalY;
        const cropWidth = physicalWidth;
        const cropHeight = physicalHeight;
        const captureOptions = { screen: targetDisplay.id, format: 'png' };
        const fullDisplayImgBuffer = await screenshot(captureOptions);
        const fullImage = await Jimp.read(fullDisplayImgBuffer);
        if (cropX < 0 || cropY < 0 || cropX + cropWidth > fullImage.bitmap.width || cropY + cropHeight > fullImage.bitmap.height) {
             return { success: false, error: 'Crop region out of bounds' };
        }
        fullImage.crop(cropX, cropY, cropWidth, cropHeight);
        fullImage.greyscale();
        fullImage.invert();
        fullImage.contrast(0.2);
        fullImage.scale(3);
        const processedBuffer = await fullImage.getBufferAsync(Jimp.MIME_PNG);
        imageDataUri = await fullImage.getBase64Async(Jimp.MIME_PNG);
        const { data: { text } } = await ocrWorker.recognize(processedBuffer);
        const recognizedText = text.trim().replace(/\D/g, '');
        if (recognizedText) {
            const value = parseInt(recognizedText, 10);
            if (!isNaN(value)) { return { success: true, value: value, rawText: text.trim(), image: imageDataUri }; }
            else { return { success: false, error: `Non-numeric result: ${text.trim()}`, image: imageDataUri }; }
        } else { return { success: false, error: 'Empty result from OCR', image: imageDataUri }; }
    } catch (error) {
        if (error.message && (error.message.includes('Failed to capture screen') || error.message.includes('GetDeviceCaps') || error.message.includes('screen parameter is required'))) {
            // Ensure image is null if capture failed before image processing
            return { success: false, error: 'Screen capture failed', image: null };
        } else if (error instanceof Jimp.Error) { // Catch Jimp errors specifically
            console.error('Jimp processing error:', error);
            return { success: false, error: 'Image processing failed', image: null }; // No image if Jimp fails
        } else {
             // Image might exist even if OCR failed, so keep it if available
             return { success: false, error: 'Internal OCR/Processing error', image: imageDataUri };
        }
    } 
}

async function processCapture() {
    if (isProcessing) return; 
    isProcessing = true;
    const settings = store.store;
    const timestamp = Date.now();
    const ocrResult = await performSingleOcr(settings.region); 
    if (ocrResult.success) {
        console.log(`[Main Process] OCR Success: ${ocrResult.value}. Sending new-reading...`);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('new-reading', { value: ocrResult.value, timestamp });
        }
    } else {
        if (ocrResult.error !== 'Empty result from OCR') {
            console.log(`[Main Process] OCR Failed: ${ocrResult.error}`); 
        }
        if (ocrResult.error === 'Screen capture failed') {
            console.error('Stopping capture due to screen capture failure.');
            stopCaptureLoop();
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', 'Capture Error');
        }
    }
    isProcessing = false; 
}

async function startCaptureLoop() {
    if (!ocrInitialized) { /* ... wait for OCR init ... */
        console.log('Waiting for OCR worker...');
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', 'Initializing OCR...');
        const waitTimeout = 15000; const waitInterval = 500; let waited = 0;
        while (!ocrInitialized && waited < waitTimeout) { await new Promise(resolve => setTimeout(resolve, waitInterval)); waited += waitInterval; }
        if (!ocrInitialized) { console.error('OCR Init Timeout.'); if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', 'OCR Init Error'); return; }
    }
    stopCaptureLoop(); // Stop existing before starting
    const settings = store.store;
    if (!settings.region) { /* ... handle no region ... */
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', 'No Region'); return;
    }
    let interval = settings.updateInterval; if (interval < 50) interval = 50;
    console.log(`Starting capture loop: ${interval}ms`);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update-status', 'Running');
    processCapture(); // Run once immediately
    captureIntervalId = setInterval(processCapture, interval);
}

function stopCaptureLoop() {
    if (captureIntervalId) {
        clearInterval(captureIntervalId);
        captureIntervalId = null;
        console.log('Capture loop stopped.');
        if (mainWindow && !mainWindow.isDestroyed()) {
            const currentStatus = store.get('region') ? 'Stopped' : 'No Region';
            mainWindow.webContents.send('update-status', currentStatus);
        }
    }
}

// --- Main window creation ---
const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the index.html of the app.
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    console.log('Loading dev URL: http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    closeOverlay1Window(); 
    closeOverlay2Window(); // Close overlay 2 when main window closes
  });

  // Create overlay window(s) based on initial settings after main window is ready
  mainWindow.webContents.once('did-finish-load', () => {
      console.log('[Main Process] Main window finished loading. Checking overlay settings...'); // <-- Log check start
      const overlay1Enabled = store.get('overlay1Enabled');
      const overlay2Enabled = store.get('overlay2Enabled');
      console.log(`[Main Process] Settings read: overlay1=${overlay1Enabled}, overlay2=${overlay2Enabled}`); // <-- Log settings values

      if (overlay1Enabled) {
          createOverlay1Window();
      }
      if (overlay2Enabled) {
          createOverlay2Window();
      }
  });
};


// --- App event listeners: ready, window-all-closed, activate ---
app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});


// --- Settings IPC Handlers & Store Watchers ---
ipcMain.handle('get-settings', () => {
  return store.store;
});

ipcMain.on('save-settings', (event, settings) => {
  store.set(settings); 
});

// Re-add the missing get-version handler
ipcMain.handle('get-version', () => {
  return app.getVersion();
});

// Listeners for overlay enables/disables
store.onDidChange('overlay1Enabled', (isEnabled) => { if (isEnabled) createOverlay1Window(); else closeOverlay1Window(); });
store.onDidChange('overlay2Enabled', (isEnabled) => { if (isEnabled) createOverlay2Window(); else closeOverlay2Window(); });

// Listeners for capture loop control based on settings
store.onDidChange('region', (newValue, oldValue) => { 
    if (captureIntervalId) { startCaptureLoop(); } 
    else if (!newValue && oldValue) { stopCaptureLoop(); }
});
store.onDidChange('updateInterval', () => { 
    if (captureIntervalId) { startCaptureLoop(); } 
});

// --- Damage Meter Core Logic IPC ---
ipcMain.on('reset-stats', () => {
    console.log('Main process received reset-stats request');
    // Resetting local cache of stats for overlays
    lastSentStats = { dps: 0, lastHit: 0, largestHit: 0 };
    sendStatsToOverlay1(); // Send reset stats to overlay
    // Acknowledge back to main window's renderer
     if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('stats-reset-acknowledged');
    }
});

// --- Select region handler ---
ipcMain.handle('select-region', async () => {
    console.log('Main process received select-region request');
    if (selectorWindow) {
        console.log('Selector window already open.');
        selectorWindow.focus();
        return null;
    }
    if (mainWindow) mainWindow.hide();
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.bounds;

    return new Promise((resolve) => {
        selectorWindow = new BrowserWindow({
            x: primaryDisplay.bounds.x,
            y: primaryDisplay.bounds.y,
            width,
            height,
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            resizable: false,
            movable: false,
            skipTaskbar: true,
            webPreferences: {
                preload: path.join(__dirname, '../preload/selector-preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
            }
        });

        // Load the correct HTML file based on environment
        if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
            selectorWindow.loadFile(path.join(__dirname, '../renderer/region-selector.html'));
        } else {
             selectorWindow.loadFile(path.join(__dirname, '../renderer/region-selector.html'));
        }

        const cleanup = () => {
            if (selectorWindow && !selectorWindow.isDestroyed()) {
                selectorWindow.close();
            }
            selectorWindow = null;
            ipcMain.removeListener('region-selected', onRegionSelected);
            ipcMain.removeListener('region-selection-cancelled', onSelectionCancelled);
             if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
        };

        const onRegionSelected = (event, region) => {
            console.log('Region selected:', region);
            cleanup();
            resolve(region);
        };

        const onSelectionCancelled = () => {
            console.log('Region selection cancelled.');
            cleanup();
            resolve(null);
        };

        ipcMain.once('region-selected', onRegionSelected);
        ipcMain.once('region-selection-cancelled', onSelectionCancelled);

        selectorWindow.once('closed', () => {
            console.log('Selector window closed externally.');
            ipcMain.removeListener('region-selected', onRegionSelected);
            ipcMain.removeListener('region-selection-cancelled', onSelectionCancelled);
            selectorWindow = null;
             if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
            resolve(null);
        });

         selectorWindow.on('ready-to-show', () => {
             selectorWindow.show();
             selectorWindow.focus();
         });
    });
});

// --- Add IPC Handler for OCR Test ---
ipcMain.handle('test-ocr', async () => {
    console.log('Main process received test-ocr request');
    const currentRegion = store.get('region');
    if (!ocrInitialized) { return { success: false, error: 'OCR not ready' }; }
    if (!currentRegion) { return { success: false, error: 'No region selected' }; }
    if (isProcessing) { return { success: false, error: 'Capture in progress' }; }
    
    isProcessing = true; // Block capture loop during test
    const result = await performSingleOcr(currentRegion); // This now includes the image data URI
    isProcessing = false; // Unblock loop
    
    console.log('OCR Test Result (value):', result.success ? result.value : result.error);
    // Don't log the full image data URI here as it's very long
    
    return result; // Return the full result object including the image
});

// Capture Loop Control IPC from Renderer
ipcMain.on('start-capture', startCaptureLoop);
ipcMain.on('stop-capture', stopCaptureLoop);

// --- App Initialization ---
app.whenReady().then(async () => {
    await initializeOcrWorker();

    // Determine initial status based on saved region, but DO NOT start capture loop
    const hasSavedRegion = store.get('region');
    const initialStatus = hasSavedRegion ? 'Stopped' : 'No Region';
    console.log(`App ready. Initial capture status: ${initialStatus}`);

    // Send initial status to the main window once it's ready
    const checkWindowInterval = setInterval(() => {
       if (mainWindow && !mainWindow.isDestroyed()) {
           mainWindow.webContents.send('update-status', initialStatus);
           clearInterval(checkWindowInterval);
           console.log(`Sent initial status '${initialStatus}' to main window.`);
       }
    }, 100); // Check every 100ms
});

// --- Add IPC listener for stats updates from main window renderer ---
ipcMain.on('stats-updated-for-overlay', (event, stats) => {
    console.log('[Main Process] Received stats-updated-for-overlay:', stats);
    lastSentStats = stats; // Update local cache
    
    // Send to relevant overlays
    sendStatsToOverlay1();
    sendHitToOverlay2(stats.lastHit); // Send only the last hit to overlay 2
});

// --- Overlay Edit Mode IPC ---

// Debounce handlers for saving position/size
const saveOverlay1LayoutDebounced = debounce(() => {
    if (overlay1Window && !overlay1Window.isDestroyed()) {
        const bounds = overlay1Window.getBounds();
        store.set('overlay1Position', { x: bounds.x, y: bounds.y });
        store.set('overlay1Size', { width: bounds.width, height: bounds.height });
        console.log('[Main Process] Saved Overlay 1 layout:', bounds);
    }
}, 500); 

const saveOverlay2LayoutDebounced = debounce(() => {
    if (overlay2Window && !overlay2Window.isDestroyed()) {
        const bounds = overlay2Window.getBounds();
        store.set('overlay2Position', { x: bounds.x, y: bounds.y });
        store.set('overlay2Size', { width: bounds.width, height: bounds.height });
        console.log('[Main Process] Saved Overlay 2 layout:', bounds);
    }
}, 500);

// Toggle Edit Mode for Overlay 1
ipcMain.handle('toggle-edit-overlay1', (event, shouldEdit) => {
    console.log(`[Main Process] Received toggle-edit-overlay1: ${shouldEdit}`);
    isEditingOverlay1 = shouldEdit;
    if (!overlay1Window || overlay1Window.isDestroyed()) {
        console.warn('[Main Process] Cannot edit Overlay 1, window not found.');
        if (shouldEdit && store.get('overlay1Enabled')) createOverlay1Window(); // Try creating if missing
        return false; // Indicate failure or inability
    }

    try {
        if (shouldEdit) {
            overlay1Window.setResizable(true);
            overlay1Window.setMovable(true);
            overlay1Window.setFocusable(true);
            overlay1Window.setIgnoreMouseEvents(false); // Make interactable
            overlay1Window.focus(); // Bring to front
            overlay1Window.webContents.send('set-edit-mode', true);
            // Add listeners to save layout changes
            overlay1Window.on('resize', saveOverlay1LayoutDebounced);
            overlay1Window.on('move', saveOverlay1LayoutDebounced);
        } else {
            overlay1Window.setResizable(true); // Keep resizable
            overlay1Window.setMovable(true); // Keep movable
            overlay1Window.setFocusable(true); // Keep focusable for moving?
            overlay1Window.setIgnoreMouseEvents(false); // Keep interactable for consistency?
            overlay1Window.webContents.send('set-edit-mode', false);
            // Remove listeners
            overlay1Window.removeListener('resize', saveOverlay1LayoutDebounced);
            overlay1Window.removeListener('move', saveOverlay1LayoutDebounced);
        }
        return true; // Indicate success
    } catch (error) {
        console.error('[Main Process] Error toggling Overlay 1 edit mode:', error);
        return false;
    }
});

// Toggle Edit Mode for Overlay 2
ipcMain.handle('toggle-edit-overlay2', (event, shouldEdit) => {
    console.log(`[Main Process] Received toggle-edit-overlay2: ${shouldEdit}`);
    isEditingOverlay2 = shouldEdit;
    if (!overlay2Window || overlay2Window.isDestroyed()) {
        console.warn('[Main Process] Cannot edit Overlay 2, window not found.');
        if (shouldEdit && store.get('overlay2Enabled')) createOverlay2Window(); // Try creating if missing
        return false;
    }

    try {
        if (shouldEdit) {
            overlay2Window.setResizable(true);
            overlay2Window.setMovable(true);
            console.log(`[Main Process] Overlay 2 - Set movable: true. Check result: ${overlay2Window.isMovable()}`);
            overlay2Window.setFocusable(true); 
            overlay2Window.setIgnoreMouseEvents(false); // <-- Enable interaction
            // console.log(`[Main Process] Overlay 2 - Set ignoreMouseEvents: false. Check result: ${overlay2Window.isIgnoringMouseEvents()}`); 

            // console.log(`[Main Process] Overlay 2 - Focusing directly.`);
            overlay2Window.focus(); // <-- Bring to front

            overlay2Window.webContents.send('set-edit-mode', true);
            overlay2Window.on('resize', saveOverlay2LayoutDebounced);
            overlay2Window.on('move', saveOverlay2LayoutDebounced);
        } else {
            // Save layout one last time before disabling interaction
            saveOverlay2LayoutDebounced.flush();
            
            overlay2Window.setResizable(false);
            overlay2Window.setMovable(false);
            console.log(`[Main Process] Overlay 2 - Set movable: false. Check result: ${overlay2Window.isMovable()}`);
            overlay2Window.setFocusable(false);
            overlay2Window.setIgnoreMouseEvents(true);
            overlay2Window.webContents.send('set-edit-mode', false);
            overlay2Window.removeListener('resize', saveOverlay2LayoutDebounced);
            overlay2Window.removeListener('move', saveOverlay2LayoutDebounced);
        }
        return true;
    } catch (error) {
        console.error('[Main Process] Error toggling Overlay 2 edit mode:', error);
        return false;
    }
});

// Move Overlay 2 window by delta (for manual dragging)
ipcMain.handle('move-overlay2', (event, { deltaX, deltaY }) => {
    if (!overlay2Window || overlay2Window.isDestroyed()) {
        console.warn('[Main Process] Cannot move Overlay 2, window not found.');
        return false;
    }
    
    try {
        const bounds = overlay2Window.getBounds();
        overlay2Window.setBounds({
            x: bounds.x + deltaX,
            y: bounds.y + deltaY,
            width: bounds.width,
            height: bounds.height
        });
        return true;
    } catch (error) {
        console.error('[Main Process] Error moving Overlay 2:', error);
        return false;
    }
});

// --- App Shutdown (will-quit) ...
app.on('will-quit', async () => {
    stopCaptureLoop();
     if (selectorWindow && !selectorWindow.isDestroyed()) {
        selectorWindow.close();
    }
    closeOverlay1Window(); // Close overlay 1
    closeOverlay2Window(); // Close overlay 2
    if (ocrWorker) {
        console.log('Terminating Tesseract worker...');
        try {
            await ocrWorker.terminate();
            console.log('Tesseract worker terminated.');
        } catch (error) {
            console.error('Error terminating Tesseract worker:', error);
        }
        ocrWorker = null;
        ocrInitialized = false;
    }
}); 