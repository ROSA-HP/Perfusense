import { Bed } from './models';
import { getSettings } from './lib/settings';
import { ingestFrame } from './services/ingest';

// Feeds believable frames for every bed so the UI is alive without hardware.
// It uses the same ingest code path as a real device, so timers and alerts behave the same.
// Pressure pattern per bed = the bed's stored 10x10 level map (levels 0..3).
// Each level becomes a pressure in the middle of its band of the configured scale (levelMmHg),
// so the simulated heatmap shows the same levels as the stored map.
function levelPressures([light, heavy, hot]: [number, number, number]): number[] {
  return [0, (light + heavy) / 2, (heavy + hot) / 2, hot * 1.05]; // hot spots stay under the alert level
}

export function startSimulator(periodMs = 500) {
  let beds: any[] = [];
  let mmHgPerByte = 0.4;
  let LEVEL_MMHG = [0, 0, 0, 0];
  const refresh = async () => {
    beds = await Bed.find({ offBedSince: null }).lean();
    const t = (await getSettings()).telemetry;
    mmHgPerByte = t.mmHgPerByte;
    LEVEL_MMHG = levelPressures(t.levelMmHg);
  };
  void refresh();
  const refreshTimer = setInterval(() => void refresh(), 10_000);

  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      await tick();
    } finally {
      busy = false;
    }
  }, periodMs);

  const tick = async () => {
    for (const bed of beds) {
      const levels: number[] = bed.sensorMini ?? [];
      if (levels.length !== 100 && levels.length !== 64) continue;
      const frame = levels.map((lvl) => {
        const base = (LEVEL_MMHG[lvl] ?? 0) / mmHgPerByte;
        const noise = base === 0 ? Math.random() * 4 : (Math.random() - 0.5) * 16;
        return Math.max(0, Math.min(255, Math.round(base + noise)));
      });
      try {
        await ingestFrame(bed.id, frame);
      } catch (e) {
        console.error('simulator:', (e as Error).message);
      }
    }
  };

  console.log(`Simulator running: fake frames every ${periodMs} ms for every bed in the database`);
  return () => {
    clearInterval(timer);
    clearInterval(refreshTimer);
  };
}
