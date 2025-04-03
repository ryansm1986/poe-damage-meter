const selectionBox = document.getElementById('selection-box');
let startX, startY, isSelecting = false;

// Listen for messages from the main process (if needed, e.g., for screen info)
// Requires exposing ipcRenderer in a preload script for this window if used

document.addEventListener('mousedown', (e) => {
    // Start selection only on left-click
    if (e.button !== 0) return;
    
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.left = `${startX}px`;
    selectionBox.style.top = `${startY}px`;
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';
});

document.addEventListener('mousemove', (e) => {
    if (!isSelecting) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);

    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;
});

document.addEventListener('mouseup', (e) => {
    if (!isSelecting || e.button !== 0) return;
    isSelecting = false;

    const finalWidth = parseInt(selectionBox.style.width, 10);
    const finalHeight = parseInt(selectionBox.style.height, 10);

    // Only send if selection is reasonably sized
    if (finalWidth > 5 && finalHeight > 5) {
        const region = {
            x: parseInt(selectionBox.style.left, 10),
            y: parseInt(selectionBox.style.top, 10),
            width: finalWidth,
            height: finalHeight
        };
        console.log('Selected Region (Renderer):', region);
        // Send the selected region back to the main process
        // This requires ipcRenderer to be exposed via a preload script
        window.selectorAPI?.sendRegion(region);
    } else {
        // Selection too small, treat as cancellation
        console.log('Selection cancelled (too small).');
         window.selectorAPI?.cancelSelection();
    }
    selectionBox.style.display = 'none';
});

// Handle cancellation
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        console.log('Selection cancelled (ESC key).');
        window.selectorAPI?.cancelSelection();
    }
});

document.addEventListener('contextmenu', (e) => {
    e.preventDefault(); // Prevent default context menu
    console.log('Selection cancelled (Right-click).');
    window.selectorAPI?.cancelSelection();
});

console.log('Region selector script loaded.'); 