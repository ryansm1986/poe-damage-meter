<template>
  <div class="settings-container">
    <div class="settings-header">
      <h2>Settings</h2>
    </div>

    <div class="settings-section">
      <div class="section-header">
        <div class="section-icon">📏</div>
        <h3>Screen Region</h3>
      </div>
      <p class="section-description">Define the area containing the damage number.</p>
      
      <button @click="selectRegion" class="action-button primary" :disabled="selectingRegion">
        <span class="icon">{{ selectingRegion ? '⌛' : '🔍' }}</span>
        <span class="text">{{ selectingRegion ? 'Selecting...' : 'Select Region' }}</span>
      </button>
      
      <div v-if="settingsStore.settings.region" class="region-info">
        <div class="region-data">
          <div class="region-coord">
            <span class="coord-label">X:</span>
            <span class="coord-value">{{ settingsStore.settings.region.x }}</span>
          </div>
          <div class="region-coord">
            <span class="coord-label">Y:</span>
            <span class="coord-value">{{ settingsStore.settings.region.y }}</span>
          </div>
          <div class="region-coord">
            <span class="coord-label">W:</span>
            <span class="coord-value">{{ settingsStore.settings.region.width }}</span>
          </div>
          <div class="region-coord">
            <span class="coord-label">H:</span>
            <span class="coord-value">{{ settingsStore.settings.region.height }}</span>
          </div>
        </div>
        <button @click="clearRegion" class="clear-button">
          <span class="icon">✖</span>
          <span class="text">Clear</span>
        </button>
      </div>
      <p v-else class="no-region">No region selected</p>
    </div>

    <div class="settings-section">
      <div class="section-header">
        <div class="section-icon">⏱️</div>
        <h3>Update Interval</h3>
      </div>
      
      <div class="slider-container">
        <label for="interval">Capture Frequency:</label>
        <div class="slider-with-value">
          <input
            type="range"
            id="interval"
            min="50"
            max="2000"
            step="50"
            :value="settingsStore.settings.captureInterval" 
            @input="onIntervalChange($event.target.value)"
          />
          <span class="slider-value">{{ settingsStore.settings.captureInterval }} ms</span>
        </div>
        <div class="slider-labels">
          <span>Faster</span>
          <span>Slower</span>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="section-header">
        <div class="section-icon">🖥️</div>
        <h3>Overlays</h3>
      </div>
      
      <!-- Overlay 1 Settings -->
      <div class="overlay-card">
        <div class="overlay-header">
          <h4>Info Overlay</h4>
          <div class="toggle-switch">
            <input type="checkbox" id="overlay1Enabled" v-model="localOverlay1Enabled">
            <label for="overlay1Enabled"></label>
          </div>
        </div>
        
        <button 
          @click="toggleEditOverlay(1)" 
          :disabled="!localOverlay1Enabled"
          class="overlay-action-button"
          :class="{ 'editing': isEditingOverlay1 }"
        >
          {{ isEditingOverlay1 ? 'Finish Editing' : 'Edit Position/Size' }}
          <span v-if="isEditingOverlay1" class="edit-badge">Editing</span>
        </button>
      </div>

      <!-- Overlay 2 Settings -->
      <div class="overlay-card">
        <div class="overlay-header">
          <h4>Floating Damage Overlay</h4>
          <div class="toggle-switch">
            <input type="checkbox" id="overlay2Enabled" v-model="localOverlay2Enabled">
            <label for="overlay2Enabled"></label>
          </div>
        </div>
        
        <button 
          @click="toggleEditOverlay(2)" 
          :disabled="!localOverlay2Enabled"
          class="overlay-action-button"
          :class="{ 'editing': isEditingOverlay2 }"
        >
          {{ isEditingOverlay2 ? 'Finish Editing' : 'Edit Position/Size' }}
          <span v-if="isEditingOverlay2" class="edit-badge">Editing</span>
        </button>
        
        <div class="overlay-options" v-if="localOverlay2Enabled">
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
    </div>

    <!-- OCR Test Section -->
    <div class="settings-section">
      <div class="section-header">
        <div class="section-icon">🔍</div>
        <h3>OCR Test</h3>
      </div>
      
      <p class="section-description">Test OCR on the currently selected region.</p>
      
      <button 
        @click="runOcrTest"
        class="action-button" 
        :disabled="!settingsStore.settings.region || ocrTesting || captureRunning"
      >
        <span class="icon">{{ ocrTesting ? '⌛' : '📷' }}</span>
        <span class="text">{{ ocrTesting ? 'Testing...' : 'Run OCR Test' }}</span>
      </button>
      
      <!-- Result Display Area -->
      <div v-if="ocrTestResult" class="test-result-area">
        <div class="test-result-text" :class="{ success: ocrTestSuccess, error: !ocrTestSuccess }">
          <strong>Result:</strong> {{ ocrTestResultMessage }}
          <span v-if="ocrTestResult.rawText" class="raw-text">(Raw: "{{ ocrTestResult.rawText }}")</span>
        </div>
        <img 
          v-if="ocrTestResult.image" 
          :src="ocrTestResult.image" 
          alt="OCR Test Image Preview" 
          class="ocr-preview-image"
        />
      </div>
      
      <p v-if="!settingsStore.settings.region" class="test-info">
        <span class="icon">ℹ️</span> Select a region first to enable testing.
      </p>
      
      <p v-if="captureRunning && settingsStore.settings.region" class="test-info">
        <span class="icon">ℹ️</span> Pause capture before testing.
      </p>
    </div>
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

// Function to toggle overlay edit mode
async function toggleEditOverlay(overlayNumber, forceState) {
    if (!api) return;
    
    try {
        if (overlayNumber === 1) {
            // If forceState is provided, use that, otherwise toggle
            const newState = forceState !== undefined ? forceState : !isEditingOverlay1.value;
            isEditingOverlay1.value = newState;
            await api.toggleEditOverlay1(newState);
        } else if (overlayNumber === 2) {
            const newState = forceState !== undefined ? forceState : !isEditingOverlay2.value;
            isEditingOverlay2.value = newState;
            await api.toggleEditOverlay2(newState);
        }
    } catch (error) {
        console.error(`Error toggling overlay ${overlayNumber} edit mode:`, error);
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
    console.log('[Settings] Region changed in store:', newRegion);
});
</script>

<style scoped>
.settings-container {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 25px;
  background-color: var(--poe-bg-dark);
  color: var(--poe-text-light);
}

.settings-header {
  margin-bottom: 5px;
  border-bottom: 1px solid var(--poe-gold-dark);
  position: relative;
  padding-bottom: 10px;
}

.settings-header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 30%;
  right: 30%;
  height: 1px;
  background: linear-gradient(to right, transparent, var(--poe-gold), transparent);
}

.settings-header h2 {
  color: var(--poe-gold);
  margin: 0;
  font-size: 1.8em;
  text-align: center;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  letter-spacing: 1px;
}

.settings-section {
  background: var(--poe-bg-medium);
  border-radius: 6px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--poe-border-light);
  transition: transform 0.2s;
  position: relative;
  overflow: hidden;
}

.settings-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(to right, transparent, var(--poe-gold), transparent);
}

.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  border-bottom: 1px solid var(--poe-border-dark);
  padding-bottom: 10px;
}

.section-icon {
  font-size: 1.5em;
  margin-right: 15px;
}

.section-header h3 {
  margin: 0;
  font-size: 1.2em;
  color: var(--poe-gold);
  font-weight: 600;
}

.section-description {
  color: var(--poe-text-medium);
  margin-top: 0;
  margin-bottom: 15px;
  font-style: italic;
}

/* Region Selection */
.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 20px;
  min-width: 160px;
  margin-bottom: 15px;
}

.action-button .icon {
  margin-right: 8px;
  font-size: 1.2em;
}

.region-info {
  background: var(--poe-bg-darkest);
  border-radius: 4px;
  padding: 15px;
  margin-top: 15px;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  border: 1px solid var(--poe-border-dark);
}

.region-data {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
}

.region-coord {
  display: flex;
  align-items: center;
}

.coord-label {
  color: var(--poe-gold);
  font-weight: bold;
  margin-right: 5px;
}

.coord-value {
  color: var(--poe-text-light);
  font-weight: 600;
}

.clear-button {
  display: flex;
  align-items: center;
  background: var(--poe-bg-medium);
  color: var(--poe-red);
  border: 1px solid var(--poe-red);
  padding: 6px 12px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-button:hover {
  background: var(--poe-red);
  color: var(--poe-text-light);
}

.clear-button .icon {
  margin-right: 5px;
}

.no-region {
  color: var(--poe-text-dark);
  font-style: italic;
  text-align: center;
  padding: 10px;
  background: var(--poe-bg-darkest);
  border-radius: 4px;
  border: 1px dashed var(--poe-border-dark);
}

/* Slider styling */
.slider-container {
  margin-top: 15px;
}

.slider-container label {
  display: block;
  margin-bottom: 10px;
  color: var(--poe-text-medium);
}

.slider-with-value {
  display: flex;
  align-items: center;
  gap: 15px;
}

.slider-value {
  background: var(--poe-bg-darkest);
  padding: 5px 10px;
  border-radius: 3px;
  min-width: 70px;
  text-align: center;
  color: var(--poe-gold);
  font-weight: bold;
  border: 1px solid var(--poe-border-dark);
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 5px;
  color: var(--poe-text-dark);
  font-size: 0.8em;
}

/* Overlay Cards */
.overlay-card {
  background: var(--poe-bg-darkest);
  border-radius: 4px;
  margin-bottom: 15px;
  padding: 15px;
  border: 1px solid var(--poe-border-dark);
}

.overlay-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.overlay-header h4 {
  margin: 0;
  color: var(--poe-text-light);
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  width: 50px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-switch label {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--poe-bg-medium);
  transition: .4s;
  border-radius: 24px;
  border: 1px solid var(--poe-border-light);
}

.toggle-switch label:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background-color: var(--poe-text-dark);
  transition: .4s;
  border-radius: 50%;
}

.toggle-switch input:checked + label {
  background-color: var(--poe-gold-dark);
  border-color: var(--poe-gold);
}

.toggle-switch input:checked + label:before {
  transform: translateX(26px);
  background-color: var(--poe-gold-light);
}

.overlay-action-button {
  position: relative;
  width: 100%;
  padding: 8px 16px;
  background: var(--poe-bg-medium);
  color: var(--poe-text-light);
  border: 1px solid var(--poe-border-light);
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;
}

.overlay-action-button:hover:not(:disabled) {
  background: var(--poe-bg-dark);
  border-color: var(--poe-gold);
}

.overlay-action-button.editing {
  background: var(--poe-gold-dark);
  color: #000;
  border-color: var(--poe-gold);
  font-weight: bold;
}

.edit-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: var(--poe-red);
  color: #fff;
  font-size: 0.7em;
  padding: 2px 6px;
  border-radius: 10px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(180, 48, 48, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(180, 48, 48, 0); }
  100% { box-shadow: 0 0 0 0 rgba(180, 48, 48, 0); }
}

.overlay-options {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--poe-border-dark);
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 10px;
}

/* OCR Test Section */
.test-result-area {
  margin-top: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.test-result-text {
  padding: 10px;
  border-radius: 4px;
  background: var(--poe-bg-darkest);
  border: 1px solid var(--poe-border-dark);
}

.test-result-text.success {
  border-color: var(--poe-green);
  color: var(--poe-green);
}

.test-result-text.error {
  border-color: var(--poe-red);
  color: var(--poe-red);
}

.raw-text {
  display: block;
  margin-top: 5px;
  font-size: 0.9em;
  color: var(--poe-text-dark);
  font-style: italic;
}

.ocr-preview-image {
  max-width: 100%;
  border-radius: 4px;
  border: 1px solid var(--poe-border-dark);
}

.test-info {
  display: flex;
  align-items: center;
  color: var(--poe-text-medium);
  font-style: italic;
  margin: 10px 0;
}

.test-info .icon {
  margin-right: 5px;
}
</style> 