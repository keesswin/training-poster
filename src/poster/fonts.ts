export interface Face {
  family: string;
  weight: number;
}

export type FontSetId = 'grotesk' | 'mono' | 'classic';

export interface FontSet {
  id: FontSetId;
  label: string;
  /** Headline and institution name. */
  display: Face;
  /** Description text. */
  text: Face;
  /** Location, date, students. */
  meta: Face;
}

const GROTESK = "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif";
const MONO = "'Space Mono', ui-monospace, Menlo, Consolas, monospace";
const CLASSIC = "Montserrat, 'Segoe UI', system-ui, sans-serif";

export const FONT_SETS: FontSet[] = [
  { id: 'grotesk', label: 'Grotesk + mono', display: { family: GROTESK, weight: 700 }, text: { family: GROTESK, weight: 500 }, meta: { family: MONO, weight: 700 } },
  { id: 'mono', label: 'All mono', display: { family: MONO, weight: 700 }, text: { family: MONO, weight: 400 }, meta: { family: MONO, weight: 700 } },
  { id: 'classic', label: 'Classic (Montserrat)', display: { family: CLASSIC, weight: 900 }, text: { family: CLASSIC, weight: 500 }, meta: { family: CLASSIC, weight: 700 } },
];

export const getFontSet = (id: FontSetId) => FONT_SETS.find((f) => f.id === id) ?? FONT_SETS[0];

export const css = (face: Face, size: number) => `${face.weight} ${size}px ${face.family}`;

/** Every face the renderer can ask for, so the app can wait for them before drawing. */
export const FONT_LOAD_LIST = ['500 40px "Space Grotesk"', '700 40px "Space Grotesk"', '400 40px "Space Mono"', '700 40px "Space Mono"', '500 40px Montserrat', '700 40px Montserrat', '900 40px Montserrat'];
