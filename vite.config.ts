import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function apiDevFallbackPlugin(): Plugin {
	return {
		name: 'api-dev-fallback',
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const url = req.url || '';
				if (!url.startsWith('/api')) {
					return next();
				}

				// If an explicit API_URL is configured, allow Vite's proxy to handle it
				if (process.env.API_URL) {
					return next();
				}

				// Standalone dev/preview handler: eliminates ECONNREFUSED proxy errors
				if (url === '/api/health' || url.startsWith('/api/health?')) {
					res.setHeader('Content-Type', 'application/json');
					res.statusCode = 200;
					res.end(
						JSON.stringify({
							ok: false,
							db: 'disconnected',
							streams: 0,
							mode: 'standalone',
							message: 'Local MongoDB / Express server offline. Run npm run dev:all or start MongoDB to connect.',
						}),
					);
					return;
				}

				if (url === '/api/stream' || url.startsWith('/api/stream?')) {
					res.setHeader('Content-Type', 'text/event-stream');
					res.setHeader('Cache-Control', 'no-cache');
					res.setHeader('Connection', 'keep-alive');
					res.statusCode = 200;
					res.write(': connected in standalone mode\n\n');
					const interval = setInterval(() => {
						if (res.writableEnded) {
							clearInterval(interval);
							return;
						}
						res.write(': ping\n\n');
					}, 15000);
					req.on('close', () => {
						clearInterval(interval);
					});
					return;
				}

				// All other /api endpoints return clean 503 JSON without proxy errors
				res.setHeader('Content-Type', 'application/json');
				res.statusCode = 503;
				res.end(
					JSON.stringify({
						ok: false,
						error: 'Backend offline in preview environment. Start backend server on port 4000 to enable full persistence.',
						code: 'STANDALONE_MODE',
					}),
				);
			});
		},
	};
}

export default defineConfig(() => {
	const proxyTarget = process.env.API_URL;

	return {
		plugins: [react(), tailwindcss(), apiDevFallbackPlugin()],
		resolve: {
			alias: {
				'@': path.resolve('.'),
			},
		},
		server: {
			// Only forward to external proxy if an API_URL is provided
			proxy: proxyTarget
				? {
						'/api': {
							target: proxyTarget,
							changeOrigin: true,
							configure: (proxy) => {
								proxy.on('error', (_err, _req, res) => {
									if (res && 'writeHead' in res && !(res as any).headersSent) {
										try {
											res.writeHead(503, { 'Content-Type': 'application/json' });
											res.end(JSON.stringify({ ok: false, error: 'Backend server unavailable' }));
										} catch {
											// ignore
										}
									}
								});
							},
						},
				  }
				: undefined,
			// HMR is disabled in AI Studio via DISABLE_HMR env var.
			// Do not modify—file watching is disabled to prevent flickering during agent edits.
			hmr: process.env.DISABLE_HMR !== 'true',
			// Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
			watch: process.env.DISABLE_HMR === 'true' ? null : {},
		},
	};
});

