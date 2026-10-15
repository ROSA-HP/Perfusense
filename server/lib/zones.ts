// Maps the mat's 64 cells to the body zones the UI shows.
// This follows the UI's current layout (cell zone names). If the mat layout or the
// zone list changes, change it here and nowhere else.

export const ZONE_TIMER_NAMES = [
  'SACRUM & COCCYX',
  'HEELS (CALCANEUS)',
  'LEFT TROCHANTER (HIP)',
  'SHOULDERS (SCAPULAE)',
  'RIGHT TROCHANTER (HIP)',
  'ELBOWS & OCCIPUT',
] as const;
export type ZoneTimerName = (typeof ZONE_TIMER_NAMES)[number];
export type Category = 'Sacrum' | 'Trochanter' | 'Heels' | 'Occiput';

/** Which zone timer a cell feeds, or null if it feeds none (elbows have no cells on this mat). */
export function timerForCell(zone: string, num: number): ZoneTimerName | null {
  const col = (num - 1) % 8;
  if (/^(SACRAL|COCCYX|GLUTEAL)/.test(zone)) return 'SACRUM & COCCYX';
  if (/^(HEEL|ACHILLES|PLANTAR)/.test(zone)) return 'HEELS (CALCANEUS)';
  if (zone === 'ILIAC-L') return 'LEFT TROCHANTER (HIP)';
  if (zone === 'ILIAC-R') return 'RIGHT TROCHANTER (HIP)';
  if (zone === 'TROCHANTER') return col < 4 ? 'LEFT TROCHANTER (HIP)' : 'RIGHT TROCHANTER (HIP)';
  if (/^SCAPULA/.test(zone)) return 'SHOULDERS (SCAPULAE)';
  if (/^OCCIPITAL/.test(zone)) return 'ELBOWS & OCCIPUT';
  return null;
}

/** Audit-log category for a zone timer (null = not part of the audit categories). */
export function categoryForTimer(name: string): Category | null {
  if (name === 'SACRUM & COCCYX') return 'Sacrum';
  if (name === 'HEELS (CALCANEUS)') return 'Heels';
  if (name === 'LEFT TROCHANTER (HIP)' || name === 'RIGHT TROCHANTER (HIP)') return 'Trochanter';
  if (name === 'ELBOWS & OCCIPUT') return 'Occiput';
  return null;
}

/** Audit-log category for a single cell's zone name. */
export function categoryForCellZone(zone: string): Category | null {
  if (/^(SACRAL|COCCYX|GLUTEAL)/.test(zone)) return 'Sacrum';
  if (/^(TROCHANTER|ILIAC)/.test(zone)) return 'Trochanter';
  if (/^(HEEL|ACHILLES|PLANTAR)/.test(zone)) return 'Heels';
  if (/^OCCIPITAL/.test(zone)) return 'Occiput';
  return null;
}

/** Heatmap level 0..3 (none, light, heavy, hot spot) from a pressure in mmHg. */
export function mmHgToLevel(mmHg: number, levelMmHg: [number, number, number]): number {
  if (mmHg >= levelMmHg[2]) return 3;
  if (mmHg >= levelMmHg[1]) return 2;
  if (mmHg >= levelMmHg[0]) return 1;
  return 0;
}

export function chunk8<T>(flat: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < flat.length; i += 8) rows.push(flat.slice(i, i + 8));
  return rows;
}

/** BACK / LEFT / RIGHT group of a posture string such as "L-LATERAL 30°" or "SUPINE 0°". */
export function postureGroup(posture: string): 'BACK' | 'LEFT' | 'RIGHT' | 'OTHER' {
  const s = (posture || '').toUpperCase();
  if (s.includes('SUPINE') || s.includes('BACK')) return 'BACK';
  if (/L-LATERAL|LEFT/.test(s)) return 'LEFT';
  if (/R-LATERAL|RIGHT/.test(s)) return 'RIGHT';
  return 'OTHER';
}
