import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { useSettingsStore } from './stores/settingsStore'; // Import the store
import './style.css'; // Basic styling

// --- Add this section for overlay updates ---
import { watch } from 'vue';
import { useStatsStore } from './stores/statsStore'; 
// --- End additions ---

const pinia = createPinia();
const app = createApp(App);

app.use(pinia);

// Get the settings store instance AFTER Pinia is initialized
const settingsStore = useSettingsStore();

// --- Add this section after pinia is used ---
const statsStore = useStatsStore(); // Get stats store instance
const api = window.electronAPI;

// Function to send stats updates back to the main process
function sendStatsUpdate() {
    if (!api) {
        console.warn('[Main Renderer] electronAPI not found, cannot send overlay updates.');
        return;
    }
    const statsPayload = {
        dps: statsStore.dps,
        lastHit: statsStore.lastHit,
        largestHit: statsStore.largestHit,
    };
    console.log('[Main Renderer] Sending stats-updated-for-overlay:', statsPayload);
    api.sendStatsUpdateForOverlay(statsPayload);
}

// Watch the relevant stats in the store
if (api) {
    watch(
        () => [statsStore.dps, statsStore.lastHit, statsStore.largestHit],
        () => {
            sendStatsUpdate();
        },
        { deep: true } // Use deep watch just in case structure changes
    );
    // Also send an update immediately after stats are reset
    watch(
        () => statsStore.status, 
        (newStatus) => {
            if (newStatus !== 'Running' && newStatus !== 'Initializing...' && newStatus !== 'Starting...') {
                console.log('[Main Renderer] Stats likely reset, sending update.');
                sendStatsUpdate();
            }
        }
    );
    console.log('[Main Renderer] IPC Bridge for overlay updates initialized.');
} else {
     console.warn('[Main Renderer] IPC Bridge for overlay updates NOT initialized (no API).');
}
// --- End added section ---

// Load settings before mounting the app
console.log('[Main Renderer] Attempting to load settings...');
settingsStore.loadSettings().then(() => {
    console.log('[Main Renderer] Settings loaded successfully. Store state:', settingsStore.$state);
    console.log('[Main Renderer] Mounting Vue app...');
    app.mount('#app');
    console.log('[Main Renderer] Vue app mounted.');
}).catch(error => {
    console.error('[Main Renderer] Failed to load settings:', error);
    // Optionally mount even if settings fail, or show an error
    console.log('[Main Renderer] Mounting Vue app despite settings load failure...');
    app.mount('#app');
     console.log('[Main Renderer] Vue app mounted after settings load failure.');
}); 