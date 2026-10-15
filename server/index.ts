import mongoose from 'mongoose';
import { createApp } from './app';
import { config } from './config';
import { Bed } from './models';
import { seedDatabase } from './seed';
import { hub } from './services/hub';
import { startSimulator } from './simulator';

async function main() {
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  } catch (e) {
    console.error(`\nCould not connect to MongoDB at ${config.mongoUri}`);
    console.error('Start MongoDB (local install, or: docker run -d -p 27017:27017 mongo:7) or set MONGODB_URI in .env\n');
    process.exit(1);
  }
  console.log('MongoDB connected');

  // First run: an empty database gets the demo data so the UI has something to show.
  if ((await Bed.estimatedDocumentCount()) === 0) {
    const r = await seedDatabase({ reset: false });
    console.log(`Empty database: seeded ${r.beds} beds and ${r.auditLogs} audit log entries`);
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`API ready on http://localhost:${config.port}/api  (health: /api/health)`);
  });

  const stopSim = config.simulate ? startSimulator() : undefined;

  const shutdown = async () => {
    console.log('\nShutting down...');
    stopSim?.();
    hub.closeAll();
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
