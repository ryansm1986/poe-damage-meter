<template>
  <div class="stat-line">
    <span class="label">DPS:</span>
    <span class="value">{{ formatNumber(stats.dps) }}</span>
  </div>
  <div class="stat-line">
    <span class="label">Last Hit:</span>
    <span class="value">{{ formatNumber(stats.lastHit) }}</span>
  </div>
  <div class="stat-line">
    <span class="label">Largest Hit:</span>
    <span class="value">{{ formatNumber(stats.largestHit) }}</span>
  </div>
</template>

<script setup>
import { reactive, onMounted, onUnmounted } from 'vue';

// Initial state
const stats = reactive({
    dps: 0,
    lastHit: 0,
    largestHit: 0
});

// Helper to format numbers
function formatNumber(num) {
  if (typeof num !== 'number' || isNaN(num)) return '-';
  return num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1 
  });
}

// Listener for updates from main process
let removeUpdateListener = () => {};

onMounted(() => {
    if (window.overlayAPI) {
        console.log('OverlayInfo: Setting up listener for stats-update');
        removeUpdateListener = window.overlayAPI.onStatsUpdate((newStats) => {
            // console.log('OverlayInfo: Received stats update', newStats);
            stats.dps = newStats.dps || 0;
            stats.lastHit = newStats.lastHit || 0;
            stats.largestHit = newStats.largestHit || 0;
        });
        // Request initial data
        window.overlayAPI.requestInitialData();
    } else {
        console.warn('OverlayInfo: window.overlayAPI not found!');
    }
});

onUnmounted(() => {
    console.log('OverlayInfo: Cleaning up listener');
    removeUpdateListener();
});

</script>

<style scoped>
/* Styles specific to this component if needed, */
/* otherwise rely on overlay1.css */
</style> 