import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Em produção o frontend é servido pelo backend (mesma origem).
// O build gera em ../backend/dist e o server.js serve esses arquivos.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '../backend/dist'),
    emptyOutDir: true,
    sourcemap: false
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/auth': 'http://localhost:3001'
    }
  }
});
