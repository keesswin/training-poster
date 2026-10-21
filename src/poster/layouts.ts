import { DESIGN_H, DESIGN_W, type Rect, type TemplateId } from './types';

export const MARGIN = 56;
const GAP = 16;
const CONTENT_W = DESIGN_W - MARGIN * 2;

export type Tone = 'light' | 'dark';

export type HeadlineBox = Rect & { maxLines: number; maxSize: number; minSize: number; tone: Tone };

export interface Geometry {
  leadersDeskLogo: Rect;
  institutionLogo: Rect;
  headline: HeadlineBox;
  /** slots[0] is always the hero; the rest are supporting photos in order. */
  slots: Rect[];
  radius: number;
  footer: { rect: Rect; variant: 'plain' | 'band' };
  /** Solid navy areas painted behind the photos. */
  navyBands: Rect[];
  /** Where the geometric pattern is drawn and which ink it uses. */
  pattern: { rect: Rect; tone: Tone };
  /** Optional small orange accent bar. */
  accent: Rect | null;
  /** Rounded white card behind the logos (no template uses one now; kept for custom templates). */
  headerCard: (Rect & { radius: number }) | null;
  /** 'split' = brand logo left, institution right. 'center' = both centred as one group. */
  logoAlign: 'split' | 'center';
  /** 'dark' backgrounds use the white version of the brand logo. */
  logoTone: Tone;
  /** 'below-photos' templates keep photos fixed and let the text follow the headline; 'above-photos' templates
   *  pull the photos up to sit right under the text, so short headlines never leave a gap. */
  textFlow: 'above-photos' | 'below-photos';
  /** Where the program description goes (always present; only drawn when there is text). */
  description: Rect & { tone: Tone };
}

export interface TemplateDef {
  id: TemplateId;
  name: string;
  tagline: string;
  /** `supports` is the number of supporting photos (total photos - 1), 0..5. */
  /** `hasDescription` reserves room for the description line, which the photos give up. */
  geometry: (supports: number, hasDescription: boolean) => Geometry;
}

const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

/** Splits `box` into `n` equal cells along a row. */
function row(box: Rect, n: number): Rect[] {
  const w = (box.w - GAP * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => rect(box.x + i * (w + GAP), box.y, w, box.h));
}

/** Splits `box` into `n` equal cells down a column. */
function column(box: Rect, n: number): Rect[] {
  const h = (box.h - GAP * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => rect(box.x, box.y + i * (h + GAP), box.w, h));
}

const HEADER_Y = 52;
const HEADER_H = 60;
const logoBoxes = (y = HEADER_Y, h = HEADER_H) => ({
  leadersDeskLogo: rect(MARGIN, y, 200, h),
  institutionLogo: rect(DESIGN_W - MARGIN - 160, y, 160, h),
});

/** A. Hero Editorial: headline on top, wide hero, one row of supporting photos, compact footer. */
function heroEditorial(supports: number, hasDesc: boolean): Geometry {
  const top = hasDesc ? 408 : 366;
  const bottom = 1192;
  const supportH = supports > 0 ? 246 : 0;
  const heroH = bottom - top - (supports > 0 ? supportH + GAP : 0);
  const hero = rect(MARGIN, top, CONTENT_W, heroH);
  const rest = supports > 0 ? row(rect(MARGIN, top + heroH + GAP, CONTENT_W, supportH), supports) : [];
  return {
    ...logoBoxes(),
    headline: { ...rect(MARGIN, 150, CONTENT_W, hasDesc ? 176 : 200), maxLines: 3, maxSize: 100, minSize: 44, tone: 'light' },
    description: { ...rect(MARGIN, 334, CONTENT_W, 62), tone: 'light' },
    slots: [hero, ...rest],
    radius: 14,
    footer: { rect: rect(MARGIN, 1216, CONTENT_W, 78), variant: 'plain' },
    navyBands: [],
    pattern: { rect: rect(0, 0, DESIGN_W, DESIGN_H), tone: 'light' },
    accent: null,
    headerCard: null,
    logoAlign: 'split',
    logoTone: 'light',
    textFlow: 'above-photos',
  };
}

/** B. Photo Story: photo-first, narrow vertical strip beside the hero, headline underneath. */
function photoStory(supports: number, hasDesc: boolean): Geometry {
  const top = 148;
  const bottom = 924;
  const box = rect(MARGIN, top, CONTENT_W, bottom - top);
  const stripW = 250;
  const heroW = supports > 0 ? CONTENT_W - stripW - GAP : CONTENT_W;
  const hero = rect(MARGIN, top, heroW, box.h);
  const rest = supports > 0 ? column(rect(MARGIN + heroW + GAP, top, stripW, box.h), supports) : [];
  return {
    ...logoBoxes(),
    headline: { ...rect(MARGIN, 972, CONTENT_W, hasDesc ? 150 : 196), maxLines: 3, maxSize: 96, minSize: 44, tone: 'light' },
    description: { ...rect(MARGIN, 1130, CONTENT_W, 72), tone: 'light' },
    slots: [hero, ...rest],
    radius: 14,
    footer: { rect: rect(MARGIN, 1216, CONTENT_W, 78), variant: 'plain' },
    navyBands: [],
    pattern: { rect: rect(0, 0, DESIGN_W, DESIGN_H), tone: 'light' },
    accent: rect(MARGIN, 944, 88, 8),
    headerCard: null,
    logoAlign: 'split',
    logoTone: 'light',
    textFlow: 'below-photos',
  };
}

/** Gallery cell plan for C: one row up to 3 photos, then 2+2 and 3+2. */
function galleryRows(n: number): number[] {
  if (n <= 0) return [];
  if (n <= 3) return [n];
  return n === 4 ? [2, 2] : [3, 2];
}

/**
 * C. Event Highlights: a full brand-colour canvas. The white brand logo (and the institution logo, if any)
 * sits centred at the top, the headline is set large on the colour, then a rounded hero and an even gallery,
 * with the school identity at the bottom.
 */
function eventHighlights(supports: number, hasDesc: boolean): Geometry {
  const M = 48;
  const W = DESIGN_W - M * 2;
  const logoBox = rect(M, 40, W, 66);
  const top = hasDesc ? 430 : 392;
  const bottom = 1224;
  const rows = galleryRows(supports);
  const galleryH = rows.length === 0 ? 0 : rows.length === 1 ? 300 : 320;
  const heroBottom = rows.length ? bottom - galleryH - GAP : bottom;
  const hero = rect(M, top, W, heroBottom - top);
  const rest: Rect[] = [];
  if (rows.length) {
    const cells = column(rect(M, heroBottom + GAP, W, galleryH), rows.length);
    rows.forEach((n, i) => rest.push(...row(cells[i], n)));
  }
  return {
    leadersDeskLogo: logoBox,
    institutionLogo: logoBox,
    headerCard: null,
    logoAlign: 'center',
    logoTone: 'dark',
    textFlow: 'above-photos',
    headline: { ...rect(M, 160, W, hasDesc ? 176 : 214), maxLines: 3, maxSize: 100, minSize: 44, tone: 'dark' },
    description: { ...rect(M, 346, W, 66), tone: 'dark' },
    slots: [hero, ...rest],
    radius: 22,
    footer: { rect: rect(M, 1246, W, 72), variant: 'band' },
    navyBands: [rect(0, 0, DESIGN_W, DESIGN_H)],
    pattern: { rect: rect(0, 0, DESIGN_W, DESIGN_H), tone: 'dark' },
    accent: rect(M, 140, 64, 6),
  };
}

/**
 * Moves the description up under the headline's real height and, for templates with text above the photos,
 * pulls the hero photo up to sit under the text. `headlineH`/`descH` are measured heights (0 = none).
 */
export function reflow(g: Geometry, headlineH: number, descH: number): Geometry {
  const TEXT_GAP = 14;
  const PHOTO_GAP = 30;
  const descY = g.headline.y + headlineH + TEXT_GAP;
  const description = { ...g.description, y: Math.min(g.description.y, descY) };
  if (g.textFlow !== 'above-photos') return { ...g, description };
  const textBottom = descH > 0 ? description.y + descH : g.headline.y + headlineH;
  const hero = g.slots[0];
  const lift = hero.y - (textBottom + PHOTO_GAP);
  if (lift <= 0) return { ...g, description };
  return { ...g, description, slots: [{ ...hero, y: hero.y - lift, h: hero.h + lift }, ...g.slots.slice(1)] };
}

export const TEMPLATES: TemplateDef[] = [
  { id: 'hero-editorial', name: 'Hero Editorial', tagline: 'Headline, big hero, two supports', geometry: heroEditorial },
  { id: 'photo-story', name: 'Photo Story', tagline: 'Photo first, strip, headline below', geometry: photoStory },
  { id: 'event-highlights', name: 'Event Highlights', tagline: 'Navy band, hero and gallery', geometry: eventHighlights },
];

export function getTemplate(id: TemplateId): TemplateDef {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

export const MAX_PHOTOS = 6;
export const clampSupports = (photoCount: number) => Math.max(0, Math.min(MAX_PHOTOS - 1, photoCount - 1));
