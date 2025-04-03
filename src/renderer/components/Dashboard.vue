<template>
  <div class="dashboard-container">
    <div class="header-controls">
        <button 
            @click="toggleCapture" 
            class="control-button" 
            :class="{ 
                'start': !isRunning, 
                'pause': isRunning,
                'disabled': isButtonDisabled 
            }"
            :disabled="isButtonDisabled"
        >
            {{ captureButtonText }}
        </button>
        <h2 class="title">Dashboard</h2>
        <button @click="resetStats" class="reset-button">Reset Statistics</button>
    </div>

    <p class="status">Status: {{ localStatus }}</p>
    
    <!-- Remove Debug: Direct display -->
    <!-- <p style="color: yellow; font-size: 1.5em;">DEBUG - Raw Last Hit: {{ localLastHit }}</p> -->

    <div class="stats-grid">
      <div class="stat-item">
        <span class="label">DPS:</span>
        <span class="value">{{ formatNumber(localDps) }}</span>
      </div>
      <div class="stat-item">
        <span class="label">Largest Hit:</span>
        <span class="value">{{ formatNumber(localLargestHit) }}</span>
      </div>
      <div class="stat-item">
        <span class="label">Average Hit:</span>
        <span class="value">{{ formatNumber(localAverageHit) }}</span>
      </div>
      <div class="stat-item">
        <span class="label">Last Hit:</span>
        <span class="value">{{ formatNumber(localLastHit) }}</span>
      </div>
      <div class="stat-item">
        <span class="label">Current Damage:</span>
        <span class="value">{{ formatNumber(localLastRawReading) }}</span>
      </div>
      <div class="stat-item">
        <span class="label">Total Damage:</span>
        <span class="value">{{ formatNumber(localTotalDamage) }}</span>
      </div>
      <div class="stat-item">
        <span class="label">Elapsed Time:</span>
        <span class="value">{{ localElapsedTime.toFixed(1) }}s</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue';
import { useStatsStore } from '@/stores/statsStore';
// Assuming settings store might be needed to check if region is set
import { useSettingsStore } from '@/stores/settingsStore'; 

const statsStore = useStatsStore();
const settingsStore = useSettingsStore(); 
const api = window.electronAPI;

// Local computed properties mirroring the store
const localStatus = computed(() => statsStore.status);
const localDps = computed(() => statsStore.dps);
const localLargestHit = computed(() => statsStore.largestHit);
const localAverageHit = computed(() => statsStore.averageHit);
const localLastHit = computed(() => statsStore.lastHit);
const localTotalDamage = computed(() => statsStore.totalDamage);
const localElapsedTime = computed(() => statsStore.elapsedTime);
const localLastRawReading = computed(() => statsStore.lastRawReading);

// Determine if the capture loop is currently running
const isRunning = computed(() => localStatus.value === 'Running' || localStatus.value === 'Starting...');

// Determine button text based on state
const captureButtonText = computed(() => {
    return isRunning.value ? 'Pause Capture' : 'Start Capture';
});

// Determine if the button should be disabled
const isButtonDisabled = computed(() => {
    // Disable if no region is selected or if there's an error state
    const noRegion = !settingsStore.settings.region;
    const errorState = localStatus.value.toLowerCase().includes('error') || localStatus.value === 'Initializing OCR...';
    return noRegion || errorState;
});

// --- Add Watchers for Debugging ---
watch(() => localLastHit.value, (newVal, oldVal) => {
    console.log(`[Dashboard Watcher] localLastHit changed: ${oldVal} -> ${newVal}`);
});
watch(() => localDps.value, (newVal, oldVal) => {
    console.log(`[Dashboard Watcher] localDps changed: ${oldVal} -> ${newVal}`);
});
watch(() => localStatus.value, (newVal, oldVal) => {
    console.log(`[Dashboard Watcher] localStatus changed: ${oldVal} -> ${newVal}`);
});
// --- End Watchers ---

// Function to toggle capture state
function toggleCapture() {
    if (!api || isButtonDisabled.value) return;

    if (isRunning.value) {
        console.log('Requesting capture stop...');
        api.stopCapture();
    } else {
        console.log('Requesting capture start...');
        api.startCapture();
    }
}

function resetStats() {
  statsStore.requestResetStats();
}

// Simplify the formatter
function formatNumber(num) {
  // Return '-' if it's not a valid number 
  // (handles NaN, initial state before first hit)
  if (typeof num !== 'number' || isNaN(num)) return '-';
  
  // Format the valid number
  return num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1 
  });
}

</script>

<style scoped>
.dashboard-container {
  padding: 15px;
  display: flex;
  flex-direction: column;
}

.header-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    padding-bottom: 15px;
    border-bottom: 1px solid #444;
}

.title {
  margin: 0; /* Remove default margins */
  color: #c89b3c; /* PoE Gold */
  text-align: center;
  font-size: 1.5em;
}

.status {
    text-align: center;
    margin-bottom: 20px;
    font-style: italic;
    color: #aaa;
}

.control-button, .reset-button {
  padding: 8px 15px;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
  transition: background-color 0.2s ease, opacity 0.2s ease;
  min-width: 120px; /* Ensure buttons have minimum width */
  text-align: center;
}

.control-button.start {
    background-color: #4CAF50; /* Green */
}
.control-button.start:hover:not(.disabled) {
    background-color: #66BB6A;
}

.control-button.pause {
    background-color: #FFA000; /* Amber */
}
.control-button.pause:hover:not(.disabled) {
    background-color: #FFB300;
}

.control-button.disabled {
    background-color: #555;
    opacity: 0.6;
    cursor: not-allowed;
}

.reset-button {
  background-color: #a03030; /* PoE Red */
}

.reset-button:hover {
  background-color: #c04040;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
}

.stat-item {
  background-color: #2a2a2a;
  padding: 15px;
  border-radius: 4px;
  text-align: center;
  border: 1px solid #444;
}

.label {
  display: block;
  font-size: 0.9em;
  color: #aaa;
  margin-bottom: 5px;
}

.value {
  display: block;
  font-size: 1.4em;
  font-weight: bold;
  color: #eee;
}
</style> 