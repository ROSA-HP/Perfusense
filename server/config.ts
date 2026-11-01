import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const num = (v: string | undefined, fallback: number) =>
  v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : fallback;

export const config = {
  port: num(process.env.PORT, 4000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/perfusense',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Shared secret the ESP32 (or any device) sends in the x-device-key header.
  // The default matches the firmware's config.h and .env.example, for development only.
  deviceKey: process.env.DEVICE_KEY || 'change-me-device-key',
  // Time zone used when the API formats clock times for the UI.
  wardTz: process.env.WARD_TZ || 'Africa/Cairo',
  // Feed fake telemetry for every bed so the UI is alive without hardware.
  simulate: process.env.SIMULATE === 'true',
  // True while DEVICE_KEY is missing or still one of the public example values.
  defaultDeviceKey: !process.env.DEVICE_KEY || ['change-me-device-key', 'dev-device-key'].includes(process.env.DEVICE_KEY),
  isProd: process.env.NODE_ENV === 'production',
};

if (config.defaultDeviceKey) {
  console.warn('[config] DEVICE_KEY is the public example value. Fine for development; set your own in .env before real use.');
}
