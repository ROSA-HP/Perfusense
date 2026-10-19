/**
 * Heatmap Smooth Color Spectrum & Interpolation Engine for Perfusense
 *
 * Smoothly transitions between the 4 main clinical anchors:
 *   1. RESTING / NONE  (#F1FCF9 - 0 to 15 mmHg)
 *   2. LIGHT CONTACT   (#A3CFC9 - 16 to 32 mmHg)
 *   3. HEAVY CONTACT   (#1D635D - 33 to 55 mmHg)
 *   4. HOTSPOT PEAK    (#8B2635 - >55 mmHg)
 *
 * Provides dense intermediate color stops (Seafoam, Turquoise, Spruce, Ochre, Amber, Crimson)
 * and continuous linear RGB interpolation so every fraction of pressure renders a distinct,
 * silky-smooth clinical shade.
 */

export interface ColorStop {
  mmHg: number;
  rgb: [number, number, number];
  hex: string;
  label: string;
  isMainAnchor?: boolean;
}

export const CLINICAL_COLOR_STOPS: ColorStop[] = [
  // ANCHOR 1: NONE / RESTING (0 - 15 mmHg)
  { mmHg: 0,  rgb: [241, 252, 249], hex: '#f1fcf9', label: 'Zero Load', isMainAnchor: true },
  { mmHg: 5,  rgb: [225, 246, 241], hex: '#e1f6f1', label: 'Sub-contact' },
  { mmHg: 10, rgb: [197, 236, 227], hex: '#c5ece3', label: 'Minimal Contact' },

  // ANCHOR 2: LIGHT CONTACT (16 - 32 mmHg)
  { mmHg: 16, rgb: [163, 207, 201], hex: '#a3cfc9', label: 'Light Contact', isMainAnchor: true },
  { mmHg: 22, rgb: [124, 189, 180], hex: '#7cbdb4', label: 'Mild Support' },
  { mmHg: 28, rgb: [84, 165, 154],  hex: '#54a59a', label: 'Moderate Load' },

  // ANCHOR 3: HEAVY CONTACT (33 - 55 mmHg)
  { mmHg: 34, rgb: [49, 134, 125],  hex: '#31867d', label: 'High Pre-load' },
  { mmHg: 40, rgb: [29, 99, 93],    hex: '#1d635d', label: 'Heavy Contact', isMainAnchor: true },
  { mmHg: 46, rgb: [70, 103, 82],   hex: '#466752', label: 'Ischemic Watch (Spruce)' },
  { mmHg: 52, rgb: [151, 110, 70],  hex: '#976e46', label: 'Warning Amber / Ochre' },

  // ANCHOR 4: HOTSPOT CRITICAL (>55 mmHg)
  { mmHg: 56, rgb: [217, 119, 87],  hex: '#d97757', label: 'Hot Warning (Coral)' },
  { mmHg: 62, rgb: [184, 67, 71],   hex: '#b84347', label: 'Hotspot Escalating' },
  { mmHg: 68, rgb: [139, 38, 53],   hex: '#8b2635', label: 'Hotspot Peak (Critical)', isMainAnchor: true },
  { mmHg: 78, rgb: [90, 18, 30],    hex: '#5a121e', label: 'Severe Peak (Deep Ruby)' },
];

/**
 * Linearly interpolates between two numbers.
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Converts level (0..3) or continuous mmHg (0..80+) into mmHg.
 */
export function normalizeToMmHg(val: number): number {
  if (val <= 0) return 0;
  // If value is in 0..3 discrete or fractional level scale:
  if (val <= 3.0) {
    // 0 -> 4 mmHg, 1 -> 22 mmHg, 2 -> 42 mmHg, 3 -> 68 mmHg
    if (val <= 1.0) return lerp(4, 22, val);
    if (val <= 2.0) return lerp(22, 42, val - 1);
    return lerp(42, 68, val - 2);
  }
  // Otherwise assume it is direct mmHg
  return Math.min(100, Math.max(0, val));
}

export interface PressureStyle {
  bg: string;
  rgb: [number, number, number];
  textColor: string;
  borderColor: string;
  isHot: boolean;
  isHeavy: boolean;
  mmHg: number;
  label: string;
}

/**
 * Computes smooth interpolated RGB color, contrast text color, and status for any pressure.
 */
export function getSmoothPressureColor(value: number): PressureStyle {
  const mmHg = normalizeToMmHg(value);

  // Clamping at ends
  if (mmHg <= CLINICAL_COLOR_STOPS[0].mmHg) {
    const s = CLINICAL_COLOR_STOPS[0];
    return {
      bg: s.hex,
      rgb: s.rgb,
      textColor: '#121c1b',
      borderColor: 'rgba(18, 28, 27, 0.25)',
      isHot: false,
      isHeavy: false,
      mmHg: Math.round(mmHg * 10) / 10,
      label: s.label,
    };
  }

  const last = CLINICAL_COLOR_STOPS[CLINICAL_COLOR_STOPS.length - 1];
  if (mmHg >= last.mmHg) {
    return {
      bg: last.hex,
      rgb: last.rgb,
      textColor: '#ffffff',
      borderColor: '#121c1b',
      isHot: true,
      isHeavy: true,
      mmHg: Math.round(mmHg * 10) / 10,
      label: last.label,
    };
  }

  // Find bounding stops
  let lower = CLINICAL_COLOR_STOPS[0];
  let upper = CLINICAL_COLOR_STOPS[1];

  for (let i = 0; i < CLINICAL_COLOR_STOPS.length - 1; i++) {
    if (mmHg >= CLINICAL_COLOR_STOPS[i].mmHg && mmHg <= CLINICAL_COLOR_STOPS[i + 1].mmHg) {
      lower = CLINICAL_COLOR_STOPS[i];
      upper = CLINICAL_COLOR_STOPS[i + 1];
      break;
    }
  }

  const range = upper.mmHg - lower.mmHg;
  const t = range > 0 ? (mmHg - lower.mmHg) / range : 0;

  const r = Math.round(lerp(lower.rgb[0], upper.rgb[0], t));
  const g = Math.round(lerp(lower.rgb[1], upper.rgb[1], t));
  const b = Math.round(lerp(lower.rgb[2], upper.rgb[2], t));

  const bg = `rgb(${r}, ${g}, ${b})`;

  // High contrast text color calculation (YIQ perceptual brightness)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  const textColor = yiq > 140 ? '#121c1b' : '#ffffff';

  const isHot = mmHg >= 55;
  const isHeavy = mmHg >= 33;

  let label = lower.label;
  if (t > 0.5) label = upper.label;

  return {
    bg,
    rgb: [r, g, b],
    textColor,
    borderColor: isHot ? '#8b2635' : isHeavy ? '#121c1b' : 'rgba(18, 28, 27, 0.4)',
    isHot,
    isHeavy,
    mmHg: Math.round(mmHg * 10) / 10,
    label,
  };
}

/**
 * Returns a CSS linear-gradient string spanning all color stops for the legend bar.
 */
export function getLegendGradientCss(): string {
  const stops = CLINICAL_COLOR_STOPS.map((s, idx) => {
    const pct = Math.round((idx / (CLINICAL_COLOR_STOPS.length - 1)) * 100);
    return `${s.hex} ${pct}%`;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
}
