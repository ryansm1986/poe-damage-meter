import { defineStore } from 'pinia';
import { ref, computed, onUnmounted } from 'vue';

// Check if electronAPI is available
const api = window.electronAPI;

export const useStatsStore = defineStore('stats', () => {
  // State
  const hits = ref([]); // Array of { value: number, timestamp: number }
  const firstHitTimestamp = ref(null);
  const previousTotalDamage = ref(0); // Used internally for calculating LastHit
  const status = ref('Initializing...'); // e.g., Initializing, Idle, Running, Error, No Region, Stopped
  const lastRawReading = ref(0); // <-- Add state for last raw reading

  // Getters (Computed)
  const totalDamage = computed(() => hits.value.reduce((sum, hit) => sum + hit.value, 0));
  const numberOfHits = computed(() => hits.value.length);
  const largestHit = computed(() => hits.value.reduce((max, hit) => Math.max(max, hit.value), 0));
  const lastHit = computed(() => hits.value.length > 0 ? hits.value[hits.value.length - 1].value : 0);

  const averageHit = computed(() => {
    return numberOfHits.value > 0 ? totalDamage.value / numberOfHits.value : 0;
  });

  const elapsedTime = computed(() => {
    if (!firstHitTimestamp.value || hits.value.length === 0) return 0;
    const lastTimestamp = hits.value[hits.value.length - 1].timestamp;
    // Ensure firstHitTimestamp is not in the future (can happen with quick resets)
    const start = firstHitTimestamp.value <= lastTimestamp ? firstHitTimestamp.value : lastTimestamp;
    return (lastTimestamp - start) / 1000; // in seconds
  });

  const dps = computed(() => {
    const time = elapsedTime.value;
    return time > 0 ? totalDamage.value / time : 0;
  });

  // Actions
  function _addHit(value, timestamp) {
    if (hits.value.length === 0) {
        firstHitTimestamp.value = timestamp;
    }
    // Keep only the last N hits if needed for performance? For now, keep all.
    hits.value.push({ value, timestamp });
  }

  // Action requested by UI
  function requestResetStats() {
    if (api) {
        console.log('Requesting stats reset from main process...');
        api.resetStats();
    } else {
        console.warn('electronAPI not found, cannot request stats reset.');
        // Fallback for browser testing?
        _resetStatsInternal(); 
    }
  }

  // Internal reset logic, triggered by main process acknowledgement
  function _resetStatsInternal() {
    hits.value = [];
    firstHitTimestamp.value = null;
    previousTotalDamage.value = 0; 
    lastRawReading.value = 0; // <-- Reset last raw reading
    console.log('Stats store reset internally.');
    // Status might be set by 'update-status' from main after reset
  }

  function setPreviousTotalDamage(value) {
      // This should only be needed if the main process isn't handling the prev/current logic
      previousTotalDamage.value = value;
  }

   function setStatus(newStatus) {
    status.value = newStatus;
  }

  // Called by the listener when main process sends a new reading
  function processNewReading(reading) { // reading = { value: number, timestamp: number }
    console.log('[Stats Store] Received new-reading:', reading); // <-- Log received data
    const currentTotalDamage = reading.value;
    const timestamp = reading.timestamp;
    
    lastRawReading.value = currentTotalDamage; // <-- Update last raw reading HERE

    // Handle first reading after reset or start
    if (previousTotalDamage.value === 0 && hits.value.length === 0 && currentTotalDamage > 0) {
        console.log(`[Stats Store] First reading: ${currentTotalDamage}, setting baseline.`);
        previousTotalDamage.value = currentTotalDamage;
        setStatus('Running'); 
        return; 
    }

    if (previousTotalDamage.value === 0) {
        console.log('[Stats Store] Skipping reading, no baseline set.');
        return;
    }

    const lastHitValue = currentTotalDamage - previousTotalDamage.value;
    console.log(`[Stats Store] Current: ${currentTotalDamage}, Prev: ${previousTotalDamage.value}, Calculated Hit: ${lastHitValue}`); // <-- Log calculation

    if (lastHitValue > 0) {
      _addHit(lastHitValue, timestamp);
      previousTotalDamage.value = currentTotalDamage;
      setStatus('Running'); 
      console.log(`[Stats Store] Added Hit: ${lastHitValue}, New Prev Total: ${previousTotalDamage.value}`); // <-- Log successful add
    } else if (currentTotalDamage < previousTotalDamage.value) {
        console.log(`[Stats Store] Damage number decreased (${previousTotalDamage.value} -> ${currentTotalDamage}). Resetting baseline.`);
        previousTotalDamage.value = currentTotalDamage;
    } else {
        console.log('[Stats Store] No change detected.');
    }
  }

  // --- IPC Listeners Setup ---
  let removeStatusListener = () => {};
  let removeReadingListener = () => {};
  let removeResetAckListener = () => {};

  function initializeListeners() {
      if (!api) {
          console.warn('electronAPI not found. Stats store will not receive updates.');
          setStatus('Error: No API');
          return;
      }
      console.log('[Stats Store] Initializing IPC listeners...');

      removeStatusListener = api.on('update-status', (newStatus) => {
          console.log('[Stats Store] Received status update:', newStatus);
          setStatus(newStatus);
      });

      removeReadingListener = api.on('new-reading', (reading) => {
          // console.log('[Stats Store] Raw new-reading event received'); // Verify listener fires
          processNewReading(reading);
      });

      removeResetAckListener = api.on('stats-reset-acknowledged', () => {
          console.log('[Stats Store] Received stats reset acknowledgement.');
          _resetStatsInternal();
      });
      
      // Set initial status (might be overwritten quickly by main process)
      setStatus('Idle'); 
  }

  function cleanupListeners() {
      console.log('Cleaning up statsStore listeners...');
      removeStatusListener();
      removeReadingListener();
      removeResetAckListener();
  }

  // Initialize listeners when the store is created
  initializeListeners();

  // Cleanup listeners when the store instance is destroyed (though stores are typically singletons)
  onUnmounted(() => {
      cleanupListeners();
  });

  return {
    // State
    status,
    lastRawReading, // <-- Expose last raw reading
    // Getters
    totalDamage,
    numberOfHits,
    largestHit,
    lastHit,
    averageHit,
    elapsedTime,
    dps,
    // Actions
    requestResetStats, // Use this from UI
    // Internal methods might not need to be exposed
    // setStatus, 
    // processNewReading
  };
}); 