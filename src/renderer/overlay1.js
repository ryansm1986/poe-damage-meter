import { createApp, ref, onMounted, onUnmounted } from 'vue';
import OverlayInfo from './components/OverlayInfo.vue';

// Note: We don't need Pinia here, state comes directly via IPC

const api = window.overlay1API;

const app = createApp({
    setup() {
        const dps = ref(0);
        const lastHit = ref(0);
        const largestHit = ref(0);
        const isEditing = ref(false);

        const handleStatsUpdate = (stats) => {
            console.log('[Overlay 1] Received stats-update:', stats);
            dps.value = stats.dps || 0;
            lastHit.value = stats.lastHit || 0;
            largestHit.value = stats.largestHit || 0;
        };

        const handleSetEditMode = (editingStatus) => {
            console.log('[Overlay 1] Edit mode set to:', editingStatus);
            isEditing.value = editingStatus;
            document.body.classList.toggle('edit-mode', editingStatus);
        };

        onMounted(() => {
            if (!api) {
                console.error('Overlay 1: preload API not found!');
                return;
            }
            console.log('Overlay 1 mounted, setting up listeners.');
            api.onStatsUpdate(handleStatsUpdate);
            api.onSetEditMode(handleSetEditMode);
            // api.requestData(); // Request initial data if needed
        });

        onUnmounted(() => {
            if (!api) return;
            console.log('Overlay 1 unmounting, removing listeners.');
            api.removeAllListeners('stats-update');
            api.removeAllListeners('set-edit-mode');
        });

        const formatNumber = (num) => {
            if (typeof num !== 'number' || isNaN(num)) return '-';
            return num.toLocaleString(undefined, { maximumFractionDigits: 1 });
        };

        return {
            dps,
            lastHit,
            largestHit,
            isEditing,
            formatNumber
        };
    },
    template: `
        <div id="overlay1-content" :class="{ 'editing': isEditing }">
            <div class="stat">DPS: {{ formatNumber(dps) }}</div>
            <div class="stat">Last: {{ formatNumber(lastHit) }}</div>
            <div class="stat">Max: {{ formatNumber(largestHit) }}</div>
        </div>
    `
});

app.mount('#app');

console.log('Overlay 1 Vue app mounted.'); 