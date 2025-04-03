import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { debounce } from 'lodash-es'; // Using lodash for debouncing save

// Check if electronAPI is available
const api = window.electronAPI;

// Debounced save function
const debouncedSave = debounce((settingsToSave) => {
  if (api) {
    console.log('Sending settings to main process:', settingsToSave);
    api.saveSettings(settingsToSave);
  } else {
    console.warn('electronAPI not found, cannot save settings.');
  }
}, 500); // Debounce save by 500ms

export const useSettingsStore = defineStore('settings', () => {
  // Initialize settings ref with all keys and correct defaults
  const settings = ref({
    captureRegion: null,
    settingsTabIndex: 0,
    overlay1Enabled: true, // Default true
    overlay1Position: { x: 50, y: 50 },
    overlay1Size: { width: 180, height: 75 },
    overlay2Enabled: false, // Default false
    overlay2Position: null, // Default null for centering logic
    overlay2Size: null,     // Default null for default size logic
    ocrWhitelist: '0123456789',
    captureInterval: 500,
    targetDisplayId: null,
  });
  const isLoaded = ref(false);

  // Computed properties for direct access (optional but good practice)
  const overlay1Enabled = computed(() => settings.value.overlay1Enabled);
  const overlay2Enabled = computed(() => settings.value.overlay2Enabled);
  // ... add others as needed ...

  // Actions
  function _updateSetting(key, value) {
     if (settings.value[key] !== value) {
         settings.value[key] = value;
         saveSettings(); // Trigger debounced save
     }
  }

  function setOverlay1Enabled(enabled) { _updateSetting('overlay1Enabled', enabled); }
  function setOverlay2Enabled(enabled) { _updateSetting('overlay2Enabled', enabled); }
  // ... other setters using _updateSetting or custom logic ...
  function setRegion(newRegion) { 
      settings.value.captureRegion = newRegion;
      // Save region immediately (no debounce needed)
      if (isLoaded.value) {
          debouncedSave.flush(); // Cancel any pending saves
          api.saveSettings(JSON.parse(JSON.stringify(settings.value)));
      }
  }

  function setUpdateInterval(interval) {
    const validInterval = Math.max(50, Math.min(2000, interval));
    if (settings.value.captureInterval !== validInterval) {
        settings.value.captureInterval = validInterval;
        // Save is handled by the watcher below (debounced)
    }
  }

  function setOverlay1Position(position) {
      // Basic validation
      if (position && typeof position.x === 'number' && typeof position.y === 'number') {
          settings.value.overlay1Position = { x: Math.round(position.x), y: Math.round(position.y) };
          // Save is handled by the watcher below (debounced)
      }
  }

  // Internal function to trigger debounced save
  function saveSettings() {
      if (!isLoaded.value) return; // Don't save before initial load
      // Pass a deep copy to the debounced function
      debouncedSave(JSON.parse(JSON.stringify(settings.value)));
  }

  // Action to load settings from the main process
  async function loadSettings() {
    if (!api) {
      console.error('Cannot load settings: electronAPI not found.');
      isLoaded.value = true; // Mark as loaded even on error to prevent loops
      return;
    }
    try {
      console.log('Requesting settings from main process...');
      const loadedSettings = await api.getSettings();
      console.log('Received settings:', loadedSettings);
      // Merge loaded settings with defaults to handle missing keys
      settings.value = { ...settings.value, ...loadedSettings }; 
      isLoaded.value = true;
    } catch (error) {
      console.error('Failed to load settings from main process:', error);
      isLoaded.value = true; // Mark as loaded even on error
    }
  }

  return {
    // Expose individual settings via computed or direct ref access
    settings, // Expose the whole ref if needed elsewhere
    isLoaded,
    overlay1Enabled, // Expose computed getter
    overlay2Enabled, // Expose computed getter
    // Expose actions
    loadSettings,
    setRegion,
    setUpdateInterval,
    setOverlay1Enabled,
    setOverlay2Enabled,
    setOverlay1Position
  };
}); 