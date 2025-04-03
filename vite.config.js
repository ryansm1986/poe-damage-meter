import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: process.env.NODE_ENV === 'production' ? './' : '/', // Correct base path for Electron build
  root: path.resolve(__dirname, 'src/renderer'), // Point Vite to the renderer source directory
  build: {
    outDir: path.resolve(__dirname, 'dist'), // Output to a 'dist' directory at the project root
    emptyOutDir: true, // Clear the output directory before building
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/renderer/index.html'),
        overlay1: path.resolve(__dirname, 'src/renderer/overlay1.html'),
        overlay2: path.resolve(__dirname, 'src/renderer/overlay2.html'),
      }
    }
  },
  server: {
    port: 5173, // Standard Vite port, ensure it matches Electron main process
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'), // Alias for renderer source
      'vue': 'vue/dist/vue.esm-bundler.js',
    }
  }
}); 