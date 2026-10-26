import { hexToLinear } from './util';

// The whole video lives in a restrained palette: ink, bone, and one signal colour.
// One rare accent (acid, the shrooms moment) — see docs/TREATMENT.md.
export const HEX = {
  ink: '#0A0A0B', // background black (slightly warm)
  ink2: '#151517', // raised black (panels, paper-in-the-dark)
  graphite: '#5E5B57', // dim lines, secondary text
  ash: '#9C978F', // mid grey
  bone: '#EEE9DF', // paper white, primary text
  signal: '#FF9124', // amber-orange: reserved for the series protagonist, the one thing that glows
  ember: '#FFC070', // hotter, lighter amber for cores/highlights
  blood: '#B5560E', // deep amber for signal on paper
  acid: '#D8FF3C', // (unused in this pilot)
  ochre: '#CDA463', // pale ochre: a warm secondary in the signal's family that never blooms
} as const;

export type PaletteKey = keyof typeof HEX;

/** Linear RGB triplets for GL uniforms. */
export const LIN: Record<PaletteKey, [number, number, number]> = Object.fromEntries(
  Object.entries(HEX).map(([k, v]) => [k, hexToLinear(v)]),
) as Record<PaletteKey, [number, number, number]>;

/** CSS rgba() for Canvas2D. */
export function rgba(key: PaletteKey | string, a = 1): string {
  const hex = (HEX as Record<string, string>)[key] ?? key;
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
