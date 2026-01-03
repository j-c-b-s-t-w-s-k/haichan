import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  plugins: [react(), wasm()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      buffer: 'buffer',
    },
  },
  define: {
    global: 'globalThis',
  },
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        entryFileNames: '[name].js'
      }
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
    include: ['buffer'],
  },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    allowedHosts: true,
    headers: {
      'X-Content-Type-Options': 'nosniff',
    },
  }
});