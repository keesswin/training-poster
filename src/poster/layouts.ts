import { DESIGN_H, DESIGN_W, type Rect, type TemplateId } from './types';

export const MARGIN = 56;
const GAP = 16;
const CONTENT_W = DESIGN_W - MARGIN * 2;

export type Tone = 'light' | 'dark';

export interface Geometry {
  leadersDeskLogo: Rect;
  institutionLogo: Rect;
  headline: Rect & { maxLines: number; maxSize: number; minSize: number; tone: Tone };
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

const HEADER_Y = 48;
const HEADER_H = 76;
const logoBoxes = (y = HEADER_Y, h = HEADER_H) => ({
  leadersDeskLogo: rect(MARGIN, y, 330, h),
  institutionLogo: rect(DESIGN_W - MARGIN - 250, y, 250, h),
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
  };
}

/** Gallery cell plan for C: one row up to 3 photos, then 2+2 and 3+2. */
function galleryRows(n: number): number[] {
  if (n <= 0) return [];
  if (n <= 3) return [n];
  return n === 4 ? [2, 2] : [3, 2];
}

/** C. Event Highlights: navy headline band, hero overlapping it, balanced gallery, navy identity band. */
function eventHighlights(supports: number, hasDesc: boolean): Geometry {
  const heroTop = hasDesc ? 440 : 396;
  const galleryBottom = hasDesc ? 1230 : 1210;
  const bandTop = hasDesc ? 1252 : 1234;
  const rows = galleryRows(supports);
  const galleryH = rows.length === 0 ? 0 : rows.length === 1 ? 320 : 330;
  const heroBottom = rows.length ? galleryBottom - galleryH - GAP : galleryBottom;
  const hero = rect(MARGIN, heroTop, CONTENT_W, heroBottom - heroTop);
  const rest: Rect[] = [];
  if (rows.length) {
    const cells = column(rect(MARGIN, heroBottom + GAP, CONTENT_W, galleryH), rows.length);
    rows.forEach((n, i) => rest.push(...row(cells[i], n)));
  }
  const navyBottom = hasDesc ? 584 : 540;
  return {
    ...logoBoxes(28, HEADER_H),
    headline: { ...rect(MARGIN, 168, CONTENT_W, hasDesc ? 170 : 208), maxLines: 3, maxSize: 100, minSize: 44, tone: 'dark' },
    description: { ...rect(MARGIN, 348, CONTENT_W, 72), tone: 'dark' },
    slots: [hero, ...rest],
    radius: 10,
    footer: { rect: rect(0, bandTop, DESIGN_W, DESIGN_H - bandTop), variant: 'band' },
    navyBands: [rect(0, 132, DESIGN_W, navyBottom - 132), rect(0, bandTop, DESIGN_W, DESIGN_H - bandTop)],
    pattern: { rect: rect(0, 132, DESIGN_W, navyBottom - 132), tone: 'dark' },
    accent: null,
  };
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
