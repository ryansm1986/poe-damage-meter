<template>
  <div class="settings-container">
    <h2>Settings</h2>

    <div class="setting-group">
      <h3>Screen Region</h3>
      <p>Define the area containing the damage number.</p>
      <button @click="selectRegion" class="action-button" :disabled="selectingRegion">
        {{ selectingRegion ? 'Selecting...' : 'Select Region' }}
      </button>
      <div v-if="settingsStore.settings.region" class="region-info">
        Coords: X: {{ settingsStore.settings.region.x }}, Y: {{ settingsStore.settings.region.y }}, W: {{ settingsStore.settings.region.width }}, H: {{ settingsStore.settings.region.height }}
        <button @click="clearRegion" class="clear-button">Clear</button>
        <!-- TODO: Add region preview image -->
        <!-- <img :src="regionPreviewUrl" alt="Region Preview" /> -->
      </div>
       <p v-else class="no-region">No region selected.</p>
    </div>

    <div class="setting-group">
      <h3>Update Interval</h3>
      <label for="interval">Capture Frequency (ms):</label>
      <input
        type="range"
        id="interval"
        min="50"
        max="2000"
        step="50"
        :value="settingsStore.settings.captureInterval" 
        @input="onIntervalChange($event.target.value)"
      />
      <span>{{ settingsStore.settings.captureInterval }} ms</span>
    </div>

    <div class="settings-section overlay-settings">
      <h3>Overlays</h3>
      
      <!-- Overlay 1 Settings -->
      <div class="setting-item">
        <label for="overlay1Enabled">Info Overlay Enabled:</label>
        <input type="checkbox" id="overlay1Enabled" v-model="localOverlay1Enabled">
      </div>
      <div class="setting-item">
         <button @click="toggleEditOverlay(1)" :disabled="!localOverlay1Enabled">
            {{ isEditingOverlay1 ? 'Finish Editing Overlay 1' : 'Edit Overlay 1 Position/Size' }}
         </button>
         <span v-if="isEditingOverlay1" class="edit-mode-indicator"> (Editing...)</span>
      </div>

      <!-- Overlay 2 Settings -->
      <div class="setting-item">
        <label for="overlay2Enabled">Floating Damage Overlay Enabled:</label>
        <input type="checkbox" id="overlay2Enabled" v-model="localOverlay2Enabled">
      </div>
      <div class="setting-item">
        <button @click="toggleEditOverlay(2)" :disabled="!localOverlay2Enabled">
            {{ isEditingOverlay2 ? 'Finish Editing Overlay 2' : 'Edit Overlay 2 Position/Size' }}
        </button>
        <span v-if="isEditingOverlay2" class="edit-mode-indicator"> (Editing...)</span>
      </div>
      <div class="setting-item" v-if="localOverlay2Enabled">
        <label for="overlay2AnimationStyle">Animation Style:</label>
        <select id="overlay2AnimationStyle" v-model="localOverlay2AnimationStyle">
          <option value="floatUp">Float Up</option>
          <option value="floatUpSpread">Float Up & Spread</option>
          <option value="floatBounce">Float Up & Bounce</option>
          <option value="floatDown">Float Down</option>
          <option value="floatDownSpread">Float Down & Spread</option>
          <option value="floatDownBounce">Float Down & Bounce</option>
          <option value="pulse">Pulse & Fade</option>
          <option value="spin">Spin & Fade</option>
        </select>
      </div>
    </div>

    <!-- OCR Test Section -->
    <div class="setting-group">
      <h3>OCR Test</h3>
      <p>Test OCR on the currently selected region.</p>
      <button 
        @click="runOcrTest"
        class="action-button" 
        :disabled="!settingsStore.settings.region || ocrTesting || captureRunning"
      >
        {{ ocrTesting ? 'Testing...' : 'Run OCR Test' }}
      </button>
      
      <!-- Result Display Area -->
      <div v-if="ocrTestResult" class="test-result-area">
        <div class="test-result-text" :class="{ success: ocrTestSuccess, error: !ocrTestSuccess }">
            <strong>Result:</strong> {{ ocrTestResultMessage }}
            <span v-if="ocrTestResult.rawText"> (Raw: "{{ ocrTestResult.rawText }}")</span>
        </div>
        <img 
            v-if="ocrTestResult.image" 
            :src="ocrTestResult.image" 
            alt="OCR Test Image Preview" 
            class="ocr-preview-image"
         />
      </div>
       <p v-if="!settingsStore.settings.region" class="test-info">Select a region first to enable testing.</p>
       <p v-if="captureRunning && settingsStore.settings.region" class="test-info">Pause capture before testing.</p>
    </div>

     <!-- TODO: Optional: Shortcut Configuration -->
     <!-- TODO: Optional: About/Help Section -->

    <button @click="saveAllSettings" class="save-button">Save Settings</button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useSettingsStore } from '@/stores/settingsStore';
import { useStatsStore } from '@/stores/statsStore'; // Need status store

const settingsStore = useSettingsStore();
const statsStore = useStatsStore(); // Get stats store for status
const selectingRegion = ref(false);
const ocrTesting = ref(false);
const ocrTestResult = ref(null); // Stores { success: bool, value?: number, error?: string, rawText?: string }
const api = window.electronAPI;

// Determine if capture is running to disable test button
const captureRunning = computed(() => statsStore.status === 'Running');

const ocrTestSuccess = computed(() => ocrTestResult.value?.success);
const ocrTestResultMessage = computed(() => {
    if (!ocrTestResult.value) return '';
    if (ocrTestResult.value.success) {
        return `Recognized: ${ocrTestResult.value.value}`;
    } else {
        return `Error: ${ocrTestResult.value.error || 'Unknown error'}`;
    }
});

// Use computed properties for overlay enabled state
const localOverlay1Enabled = computed({
  get: () => {
    console.log('[Settings] Getting overlay1Enabled from store:', settingsStore.overlay1Enabled);
    return settingsStore.overlay1Enabled;
  },
  set: (value) => {
    settingsStore.setOverlay1Enabled(value);
    if (!value && isEditingOverlay1.value) {
      toggleEditOverlay(1, false); // Auto-exit edit mode
    }
  }
});
const localOverlay2Enabled = computed({
  get: () => {
    console.log('[Settings] Getting overlay2Enabled from store:', settingsStore.overlay2Enabled);
    return settingsStore.overlay2Enabled;
  },
  set: (value) => {
    settingsStore.setOverlay2Enabled(value);
    if (!value && isEditingOverlay2.value) {
      toggleEditOverlay(2, false); // Auto-exit edit mode
    }
  }
});

// Add computed property for animation style
const localOverlay2AnimationStyle = computed({
  get: () => settingsStore.overlay2AnimationStyle,
  set: (value) => settingsStore.setOverlay2AnimationStyle(value)
});

const isEditingOverlay1 = ref(false);
const isEditingOverlay2 = ref(false);

async function selectRegion() {
  if (!api) {
    console.error('Cannot select region: electronAPI not found.');
    // Optionally show an error message to the user
    return;
  }

  console.log('Requesting region selection via IPC...');
  selectingRegion.value = true;
  try {
    const region = await api.selectRegion(); // Call the exposed function
    
    if (region && region.width > 0 && region.height > 0) { // Basic validation
        console.log('Region selected:', region);
        settingsStore.setRegion(region);
        // TODO: Request region preview image via IPC?
        // regionPreviewUrl.value = await api.getRegionPreview(region);
    } else {
        console.log('Region selection cancelled or failed.');
        // Do not change existing region if selection was cancelled
    }
  } catch (error) {
    console.error('Error during region selection:', error);
    // Handle error (e.g., show notification to user)
  } finally {
    selectingRegion.value = false;
  }
}

function clearRegion() {
    console.log('Clearing region');
    settingsStore.setRegion(null);
    // regionPreviewUrl.value = null;
    // Ensure capture stops if running
    if (api) api.stopCapture(); 
}

function onIntervalChange(value) {
    settingsStore.setUpdateInterval(Number(value));
}

async function runOcrTest() {
    if (!api || !settingsStore.settings.region || ocrTesting.value || captureRunning.value) return;
    ocrTesting.value = true;
    ocrTestResult.value = null; 
    try {
        // Result now includes { success, value?, error?, rawText?, image? }
        const result = await api.testOcr(); 
        ocrTestResult.value = result;
    } catch (error) {
        console.error('Error during OCR test IPC call:', error);
        ocrTestResult.value = { success: false, error: 'IPC Error' };
    } finally {
        ocrTesting.value = false;
    }
}

// Load initial settings when component mounts
// Ensure settings are loaded before interacting with them
onMounted(async () => {
    console.log('[Settings] Component mounted. Store state should be loaded by main.js:', settingsStore.$state);
    
    // Reset editing state when settings component mounts
    isEditingOverlay1.value = false;
    isEditingOverlay2.value = false;
    // Ensure the main process also knows we are not editing initially
    if(api) {
        // Use try-catch as API might not be ready immediately on hot-reload
        try {
             await api.toggleEditOverlay1(false);
             await api.toggleEditOverlay2(false);
        } catch (e) { 
             console.warn('[Settings] Failed to reset edit state via API on mount:', e)
        }
    }
});

// Watch for region changes to potentially trigger start/stop
watch(() => settingsStore.settings.region, (newRegion, oldRegion) => {
    if (!api) return;
    if (newRegion && !oldRegion) {
        console.log('Region set, requesting capture start...');
        api.startCapture();
    } else if (!newRegion && oldRegion) {
        console.log('Region cleared, requesting capture stop...');
        api.stopCapture();
    }
    // If region changed while running, the main process watcher already handles restart
}, { deep: true });

// Function to toggle edit mode
async function toggleEditOverlay(overlayNumber, forceState = null) {
    let targetState;
    let apiFunction;
    let editingRef;

    console.log(`[Settings] toggleEditOverlay(${overlayNumber}, ${forceState}) called.`); // Log function entry
    
    if (overlayNumber === 1) {
        targetState = forceState ?? !isEditingOverlay1.value;
        apiFunction = api.toggleEditOverlay1;
        editingRef = isEditingOverlay1;
    } else if (overlayNumber === 2) {
        targetState = forceState ?? !isEditingOverlay2.value;
        apiFunction = api.toggleEditOverlay2;
        editingRef = isEditingOverlay2;
    } else {
        return; // Invalid overlay number
    }

    console.log(`[Settings] Attempting to set edit mode for Overlay ${overlayNumber} to ${targetState}. API Function:`, apiFunction ? 'Exists' : 'Missing'); // Log before API call
    if (!apiFunction) {
        console.error(`[Settings] API function toggleEditOverlay${overlayNumber} is missing on window.electronAPI! Check preload script.`);
        return; 
    }

    try {
        const success = await apiFunction(targetState);
        console.log(`[Settings] API call toggleEditOverlay${overlayNumber}(${targetState}) returned: ${success}`); // Log API result
        if (success) {
            editingRef.value = targetState;
            console.log(`[Settings] Edit mode for Overlay ${overlayNumber} toggled successfully to ${targetState}`);
        } else {
            console.warn(`[Settings] Failed to toggle edit mode for Overlay ${overlayNumber}. Main process returned false.`);
            if (targetState === true) { editingRef.value = false; }
        }
    } catch (error) {
        console.error(`[Settings] Error calling toggleEditOverlay${overlayNumber}:`, error);
        if (targetState === true) { editingRef.value = false; }
    }
}

// ... (rest of setup: saveAllSettings, performOcrTest, etc.) ...

</script>

<style scoped>
.settings-container {
  padding: 15px;
}

h2 {
  text-align: center;
  margin-bottom: 25px;
  color: #c89b3c; /* PoE Gold */
}

.setting-group {
  margin-bottom: 30px;
  background-color: #2a2a2a;
  padding: 20px;
  border-radius: 4px;
  border: 1px solid #444;
}

.setting-group h3 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #eee;
  border-bottom: 1px solid #555;
  padding-bottom: 5px;
}

label {
    margin-right: 10px;
    display: inline-block; /* Align checkboxes better */
    margin-bottom: 8px;
}

input[type="range"] {
  vertical-align: middle;
  margin: 0 10px;
  width: 200px; /* Adjust as needed */
  cursor: pointer;
}

input[type="checkbox"] {
    vertical-align: middle;
    margin-right: 8px;
    cursor: pointer;
}

.action-button {
  padding: 8px 15px;
  background-color: #4a6e8a;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
  transition: background-color 0.2s ease, opacity 0.2s ease;
}

.action-button:hover {
  background-color: #5a7e9a;
}

.action-button:disabled {
  background-color: #3a4e5a;
  opacity: 0.7;
  cursor: not-allowed;
}

.region-info {
    margin-top: 15px;
    font-size: 0.9em;
    color: #bbb;
    background-color: #333;
    padding: 10px;
    border-radius: 3px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.no-region {
    margin-top: 15px;
    font-style: italic;
    color: #888;
}

.clear-button {
    background: #a03030;
    color: white;
    border: none;
    border-radius: 3px;
    padding: 3px 8px;
    font-size: 0.8em;
    cursor: pointer;
    margin-left: 15px;
}
.clear-button:hover {
    background: #c04040;
}

.test-result-area {
    margin-top: 15px;
    display: flex;
    gap: 15px; /* Space between text and image */
    align-items: flex-start; /* Align items at the top */
}

.test-result-text {
    padding: 10px;
    border-radius: 4px;
    font-size: 0.9em;
    border: 1px solid;
    flex-grow: 1; /* Allow text to take available space */
}

.test-result-text.success {
    background-color: rgba(76, 175, 80, 0.2);
    border-color: #4CAF50;
    color: #c8e6c9;
}

.test-result-text.error {
    background-color: rgba(229, 57, 53, 0.2);
    border-color: #e53935;
    color: #ffcdd2;
}

.ocr-preview-image {
    max-width: 1200px; /* Increased max width (x3) */
    max-height: 450px;  /* Increased max height (x3) */
    border: 1px solid #555;
    object-fit: contain; 
    background-color: #111; 
}

.test-info {
     margin-top: 10px;
    font-size: 0.85em;
    font-style: italic;
    color: #888;
}

.overlay-settings {
    margin-top: 20px;
    border-top: 1px solid #444;
    padding-top: 15px;
}
.overlay-settings h3 {
    margin-bottom: 15px;
}
.setting-item {
    margin-bottom: 15px; 
    display: flex;
    align-items: center;
}
.setting-item label {
    margin-right: 10px;
    min-width: 200px; 
}
.setting-item button {
    margin-right: 10px;
}
.edit-mode-indicator {
    color: yellow;
    font-style: italic;
}
.save-button {
    padding: 8px 15px;
    background-color: #4a6e8a;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9em;
    transition: background-color 0.2s ease, opacity 0.2s ease;
    margin-top: 20px;
}
.save-button:hover {
    background-color: #5a7e9a;
}
</style> 