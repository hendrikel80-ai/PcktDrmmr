import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    // Lets the dev server accept requests arriving through the Tailscale
    // Funnel HTTPS tunnel (its own *.ts.net hostname, not localhost) — for
    // mobile testing only, see CLAUDE.md's "HTTPS für Mobile-Mikrofonzugriff"
    // note. Vite otherwise rejects unrecognized Host headers by default.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
    // Tauri's own build artifacts under src-tauri/target/ change constantly
    // while `cargo tauri dev` is running; without this Vite's watcher trips
    // over locked .dll files there (EBUSY) and crashes.
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
});
