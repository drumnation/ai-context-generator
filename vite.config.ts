import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.join(__dirname, 'src', 'webview'),
  build: {
    outDir: path.join(__dirname, 'out', 'webview'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(__dirname, 'src', 'webview', 'index.html'),
      output: {
        entryFileNames: 'main.js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  }
});