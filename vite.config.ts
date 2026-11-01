import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// /api always goes to the Express server (API_URL, default http://localhost:4000), so
// `npm run dev:all` shows live data. When the server is not running, the proxy answers 503
// and the UI switches to SAMPLE DATA mode by itself (it checks /api/health every 15 s).
export default defineConfig(() => {
  const target = process.env.API_URL || 'http://localhost:4000';
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve('.') } },
    server: {
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('error', (_err, _req, res) => {
              if (res && 'writeHead' in res && !(res as any).headersSent) {
                try {
                  res.writeHead(503, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ ok: false, error: `API not reachable at ${target}. Start it with npm run server.` }));
                } catch {
                  // the browser already went away
                }
              }
            });
          },
        },
      },
    },
  };
});
