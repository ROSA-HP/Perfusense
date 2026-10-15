import cors from 'cors';
import express from 'express';
import { config } from './config';
import { errorHandler, notFound } from './lib/errors';
import { alertsRouter } from './routes/alerts';
import { bedsRouter } from './routes/beds';
import { matsRouter } from './routes/mats';
import { streamRouter, telemetryRouter } from './routes/telemetry';
import { wardRouter } from './routes/ward';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();
  api.use('/beds', bedsRouter);
  api.use('/audit-logs', alertsRouter);
  api.use('/mats', matsRouter);
  api.use('/telemetry', telemetryRouter);
  api.use('/stream', streamRouter);
  api.use('/', wardRouter); // /health, /settings, /broadcasts
  app.use('/api', api);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
