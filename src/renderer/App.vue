<template>
  <div class="main-container">
    <header class="app-header">
      <h1>PoE2 Damage Meter</h1>
      <nav class="tabs">
        <button @click="activeTab = 'dashboard'" :class="{ active: activeTab === 'dashboard' }">Dashboard</button>
        <button @click="activeTab = 'settings'" :class="{ active: activeTab === 'settings' }">Settings</button>
      </nav>
    </header>

    <main class="content-area">
      <!-- <KeepAlive> -->
        <component :is="currentTabComponent" />
      <!-- </KeepAlive> -->
    </main>

    <footer class="app-footer">
      App Version: {{ appVersion }}
    </footer>

  </div>
</template>

<script setup>
import { ref, onMounted, shallowRef, computed } from 'vue';
import Dashboard from './components/Dashboard.vue';
import Settings from './components/Settings.vue';

const appVersion = ref('Loading...');
const activeTab = ref('dashboard'); // Default tab

const tabs = {
  dashboard: shallowRef(Dashboard),
  settings: shallowRef(Settings)
};

const currentTabComponent = computed(() => tabs[activeTab.value]?.value);

onMounted(async () => {
  if (window.electronAPI) {
    try {
      appVersion.value = await window.electronAPI.getVersion();
    } catch (error) {
      console.error('Failed to get app version:', error);
      appVersion.value = 'Error';
    }
  } else {
    console.warn('electronAPI not found. Running in browser?');
    appVersion.value = 'N/A (Browser)';
  }
});

</script>

<style scoped>
/* Basic styles - will be themed later */
.main-container {
  font-family: sans-serif;
  padding: 20px;
  /* Add PoE-like theme colors later */
  background-color: #1e1e1e; /* Example dark background */
  color: #dcdcdc; /* Example light text */
  height: 100vh;
  display: flex;
  flex-direction: column;
}

h1 {
  color: #c89b3c; /* Example gold accent */
  text-align: center;
  margin-bottom: 20px;
}

.app-header {
  padding: 10px 20px;
  background-color: #111; /* Darker header */
  border-bottom: 1px solid #333;
  display: flex;
  align-items: center; /* Center items vertically */
  justify-content: space-between; /* Space title and tabs */
}

.app-header h1 {
  margin: 0;
  color: #c89b3c; /* PoE Gold */
  font-size: 1.4em;
  font-weight: normal; /* Less heavy font */
}

.tabs button {
  background: none;
  border: none;
  color: #aaa;
  padding: 10px 15px;
  margin-left: 5px;
  cursor: pointer;
  font-size: 1em;
  border-bottom: 2px solid transparent; /* Placeholder for active state */
  transition: color 0.2s ease, border-color 0.2s ease;
}

.tabs button:hover {
  color: #eee;
}

.tabs button.active {
  color: #fff;
  border-bottom-color: #c89b3c; /* PoE Gold */
}

.content-area {
  flex-grow: 1; /* Takes remaining vertical space */
  overflow-y: auto; /* Add scroll if content overflows */
  padding: 20px;
}

.app-footer {
  padding: 5px 20px;
  font-size: 0.8em;
  text-align: right;
  color: #888;
  border-top: 1px solid #333;
  background-color: #111;
}
</style> 