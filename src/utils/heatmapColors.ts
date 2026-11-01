/**
 * Heatmap colour scale for Perfusense.
 *
 * Every value passed in here is a pressure in mmHg (never a 0..3 level).
 * The band edges come from the server's settings (telemetry.levelMmHg = [light, heavy, hot]),
 * so the UI and the server always agree. The default matches the server default.
 *
 * The palette runs through clearly different hues so neighbouring pressures are easy to tell
 * apart, while the four bands keep the design-system anchors:
 *   none  -> Mint Frost / pale aqua          (below "light")
 *   light -> Ice Mint, seafoam, teal         (light .. heavy)
 *   heavy -> Surgical Teal, spruce, olive, ochre (heavy .. hot)
 *   hot   -> Terracotta, coral, Carmine, deep ruby, plum (hot and above)
 * Status is never shown by colour alone: callers also print the band name or the number.
 */

export type PressureScale = [number, number, number];
export const DEFAULT_SCALE: PressureScale = [15, 32, 55];

let currentScale: PressureScale = DEFAULT_SCALE;

/** Called once the settings arrive from the API. */
export function setPressureScale(scale: PressureScale | undefined | null) {
  if (scale && scale.length === 3 && scale[0] < scale[1] && scale[1] < scale[2]) currentScale = [...scale] as PressureScale;
}
export function getPressureScale(): PressureScale {
  return currentScale;
}

export type Band = 'none' | 'light' | 'heavy' | 'hot';

export function bandOf(mmHg: number, scale: PressureScale = currentScale): Band {
  if (mmHg >= scale[2]) return 'hot';
  if (mmHg >= scale[1]) return 'heavy';
  if (mmHg >= scale[0]) return 'light';
  return 'none';
}

export const BAND_LABEL: Record<Band, string> = { none: 'NONE', light: 'LIGHT', heavy: 'HEAVY', hot: 'HOT SPOT' };

// Stops are placed on a normalised axis: 0..1 = none band, 1..2 = light, 2..3 = heavy, 3..4 = hot
// (4 = 1.5 x the hot threshold). This keeps the colours tied to the configured band edges.
interface Stop {
  at: number;
  rgb: [number, number, number];
}
const STOPS: Stop[] = [
  { at: 0.0, rgb: [241, 252, 249] }, // Mint Frost
  { at: 0.5, rgb: [220, 243, 238] }, // pale aqua
  { at: 1.0, rgb: [173, 239, 231] }, // Cyan Glow (light starts)
  { at: 1.35, rgb: [163, 207, 201] }, // Ice Mint
  { at: 1.7, rgb: [102, 178, 166] }, // seafoam
  { at: 2.0, rgb: [42, 128, 120] }, // teal (heavy starts)
  { at: 2.3, rgb: [29, 99, 93] }, // Surgical Teal
  { at: 2.6, rgb: [78, 104, 70] }, // spruce olive
  { at: 2.85, rgb: [168, 132, 52] }, // ochre
  { at: 3.0, rgb: [217, 119, 87] }, // Terracotta (hot starts)
  { at: 3.3, rgb: [254, 149, 114] }, // Soft Peach / coral
  { at: 3.55, rgb: [196, 64, 66] }, // vermilion
  { at: 3.8, rgb: [139, 38, 53] }, // Carmine
  { at: 4.0, rgb: [74, 16, 40] }, // deep ruby / plum
];

function axis(mmHg: number, [l, h, x]: PressureScale): number {
  if (mmHg <= 0) return 0;
  if (mmHg < l) return mmHg / l;
  if (mmHg < h) return 1 + (mmHg - l) / (h - l);
  if (mmHg < x) return 2 + (mmHg - h) / (x - h);
  return Math.min(4, 3 + (mmHg - x) / (x * 0.5));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function colourAt(pos: number): [number, number, number] {
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (pos >= a.at && pos <= b.at) {
      const t = b.at > a.at ? (pos - a.at) / (b.at - a.at) : 0;
      return [Math.round(lerp(a.rgb[0], b.rgb[0], t)), Math.round(lerp(a.rgb[1], b.rgb[1], t)), Math.round(lerp(a.rgb[2], b.rgb[2], t))];
    }
  }
  return STOPS[STOPS.length - 1].rgb;
}

export interface PressureStyle {
  bg: string;
  textColor: string;
  band: Band;
  isHot: boolean;
  isHeavy: boolean;
  mmHg: number;
  label: string;
}

/** Colour, readable text colour and band for a pressure in mmHg. */
export function pressureStyle(mmHg: number, scale: PressureScale = currentScale): PressureStyle {
  const v = Number.isFinite(mmHg) ? Math.max(0, mmHg) : 0;
  const [r, g, b] = colourAt(axis(v, scale));
  const yiq = (r * 299 + g * 587 + b * 114) / 1000; // perceived brightness
  const band = bandOf(v, scale);
  return {
    bg: `rgb(${r}, ${g}, ${b})`,
    textColor: yiq > 150 ? '#121c1b' : '#ffffff',
    band,
    isHot: band === 'hot',
    isHeavy: band === 'heavy' || band === 'hot',
    mmHg: Math.round(v * 10) / 10,
    label: BAND_LABEL[band],
  };
}

/** CSS gradient for the legend bar, with stops at their real positions on the scale. */
export function legendGradientCss(): string {
  const stops = STOPS.map((s) => `rgb(${s.rgb.join(',')}) ${Math.round((s.at / 4) * 100)}%`);
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

/** The four bands with their mmHg ranges, for legends. */
export function legendBands(scale: PressureScale = currentScale) {
  const [l, h, x] = scale;
  return [
    { band: 'none' as Band, range: `< ${l}`, swatch: pressureStyle(l * 0.5, scale).bg },
    { band: 'light' as Band, range: `${l}–${h - 1}`, swatch: pressureStyle((l + h) / 2, scale).bg },
    { band: 'heavy' as Band, range: `${h}–${x - 1}`, swatch: pressureStyle((h + x) / 2, scale).bg },
    { band: 'hot' as Band, range: `≥ ${x}`, swatch: pressureStyle(x * 1.25, scale).bg },
  ];
}

/** A heatmap level 0..3 (used by the roster thumbnails) as a typical pressure on the scale. */
export function levelToMmHg(level: number, scale: PressureScale = currentScale): number {
  const [l, h, x] = scale;
  return [0, (l + h) / 2, (h + x) / 2, x * 1.2][Math.max(0, Math.min(3, Math.round(level)))];
}
