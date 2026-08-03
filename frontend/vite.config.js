import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev-only proxy: the Vite dev server (default port 5173) forwards /api and
// /health to the Express backend so the browser only ever talks to one
// origin. In Docker / `vite build`, this file isn't involved at all —
// Express serves the built static files itself (see backend/server.js).
const backendTarget = process.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Bind all interfaces, not just localhost — required for the dev server
    // to be reachable through Docker's port mapping (docker-compose.yml).
    // Harmless for plain `npm run dev` outside Docker too.
    host: true,
    // Docker Desktop bind mounts (esp. from a Windows host) often don't
    // propagate native filesystem change events into the Linux container,
    // so HMR silently stops working. Polling fixes it at a small CPU cost;
    // only enabled inside Docker (see docker-compose.yml's CHOKIDAR_USEPOLLING).
    watch: process.env.CHOKIDAR_USEPOLLING === 'true' ? { usePolling: true, interval: 300 } : undefined,
    proxy: {
      '/api': { target: backendTarget, changeOrigin: true },
      '/health': { target: backendTarget, changeOrigin: true },
    },
  },
});
