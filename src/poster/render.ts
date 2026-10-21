import { cropSourceRect } from './crop';
import { getTemplate, clampSupports, MARGIN, reflow, type Geometry, type HeadlineBox, type Tone } from './layouts';
import { getBrand } from './brands';
import { css, getFontSet, type FontSet } from './fonts';
import { detailLines, posterDescription } from './format';
import { ellipsize, fitText } from './text';
import { DESIGN_H, DESIGN_W, type LoadedImage, type PosterDoc, type Rect } from './types';


type Ctx = CanvasRenderingContext2D;

/** Photos in slot order: hero first, then the remaining photos in the user's order. */
export function orderedPhotos(doc: PosterDoc) {
  const hero = doc.photos.find((p) => p.id === doc.heroId) ?? doc.photos[0];
  if (!hero) return [];
  return [hero, ...doc.photos.filter((p) => p !== hero)];
}

let measureCtx: Ctx | null = null;
function getMeasureCtx(): Ctx | null {
  if (measureCtx) return measureCtx;
  if (typeof document === 'undefined') return null;
  measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

export function getGeometry(doc: PosterDoc): Geometry {
  const g = getTemplate(doc.template).geometry(clampSupports(doc.photos.length), posterDescription(doc.text) !== '');
  const m = getMeasureCtx();
  if (!m) return g;
  const h = fitHeadline(m, doc, g.headline);
  const d = fitDescription(m, doc, g.description);
  return reflow(g, h ? h.height : 0, d ? d.height : 0);
}

function roundRectPath(ctx: Ctx, r: Rect, radius: number) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, radius);
}

/** Draws a logo uncropped, centred vertically, aligned to `align` inside its box. Aspect ratio is preserved. */
function drawLogo(ctx: Ctx, img: LoadedImage, box: Rect, align: 'left' | 'right') {
  const ar = img.width / img.height;
  let w = box.w;
  let h = w / ar;
  if (h > box.h) {
    h = box.h;
    w = h * ar;
  }
  const x = align === 'left' ? box.x : box.x + box.w - w;
  const y = box.y + (box.h - h) / 2;
  ctx.drawImage(img.source, x, y, w, h);
}

/** Placeholder wordmark shown until the brand's real logo is uploaded. Shrinks to fit its box. */
function drawWordmark(ctx: Ctx, box: Rect, parts: [string, string], navy: string, orange: string, fs: FontSet) {
  let size = 40;
  ctx.font = css(fs.display, size);
  while (size > 18 && ctx.measureText(parts[0] + parts[1]).width > box.w) {
    size -= 2;
    ctx.font = css(fs.display, size);
  }
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const cy = box.y + box.h / 2;
  ctx.fillStyle = navy;
  ctx.fillText(parts[0], box.x, cy);
  ctx.fillStyle = orange;
  ctx.fillText(parts[1], box.x + ctx.measureText(parts[0]).width, cy);
}

const whiteCache = new Map<string, LoadedImage>();

/** A white silhouette of a flat logo (all visible pixels painted white), for dark backgrounds. */
function whiteVersion(img: LoadedImage): LoadedImage {
  const hit = whiteCache.get(img.url);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const x = c.getContext('2d')!;
  x.drawImage(img.source, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#fff';
  x.fillRect(0, 0, c.width, c.height);
  const out = { ...img, source: c };
  whiteCache.set(img.url, out);
  return out;
}

function containSize(img: LoadedImage, maxW: number, maxH: number) {
  const ar = img.width / img.height;
  let w = maxW;
  let h = w / ar;
  if (h > maxH) {
    h = maxH;
    w = h * ar;
  }
  return { w, h };
}

/** Brand logo (white) centred, with the institution logo on a small white tile beside it when there is one. */
function drawCenteredLogos(ctx: Ctx, doc: PosterDoc, box: Rect) {
  const normal = doc.brandLogos[doc.brand];
  const brand = doc.brandLogosWhite[doc.brand] ?? (normal ? whiteVersion(normal) : null);
  const inst = doc.institutionLogo;
  const bSize = brand ? containSize(brand, 260, box.h) : { w: 0, h: 0 };
  const TILE_PAD = 8;
  const iSize = inst ? containSize(inst, 150, box.h - TILE_PAD * 2) : { w: 0, h: 0 };
  const tileW = inst ? iSize.w + TILE_PAD * 2 : 0;
  const GAP = 26;
  const fs = getFontSet(doc.fontSet);
  let wordW = 0;
  if (!brand) {
    ctx.font = css(fs.display, 34);
    wordW = ctx.measureText(getBrand(doc.brand).wordmark.join('')).width;
  }
  const brandW = brand ? bSize.w : wordW;
  const total = brandW + (inst ? GAP * 2 + 2 + tileW : 0);
  let x = DESIGN_W / 2 - total / 2;
  const cy = box.y + box.h / 2;
  if (brand) ctx.drawImage(brand.source, x, cy - bSize.h / 2, bSize.w, bSize.h);
  else drawWordmark(ctx, { x, y: box.y, w: wordW + 2, h: box.h }, getBrand(doc.brand).wordmark, doc.colors.white, doc.colors.orange, fs);
  x += brandW;
  if (!inst) return;
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = doc.colors.white;
  ctx.fillRect(x + GAP, box.y + 10, 2, box.h - 20);
  ctx.restore();
  x += GAP * 2 + 2;
  roundRectPath(ctx, { x, y: box.y, w: tileW, h: box.h }, 12);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.drawImage(inst.source, x + TILE_PAD, cy - iSize.h / 2, iSize.w, iSize.h);
}

const SHARPEN_AMOUNT = 0.45;
const enlargedCache = new Map<string, HTMLCanvasElement>();

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Gentle unsharp mask (3x3 gaussian), applied only after enlarging so soft upscales regain some edge definition. */
function sharpen(c: HTMLCanvasElement, amount: number) {
  const x = c.getContext('2d');
  if (!x) return;
  const { width: w, height: h } = c;
  const img = x.getImageData(0, 0, w, h);
  const d = img.data;
  const src = new Uint8ClampedArray(d);
  for (let y = 1; y < h - 1; y++) {
    for (let px = 1; px < w - 1; px++) {
      const i = (y * w + px) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const k = i + ch;
        const blur =
          (src[k - w * 4 - 4] + 2 * src[k - w * 4] + src[k - w * 4 + 4] + 2 * src[k - 4] + 4 * src[k] + 2 * src[k + 4] + src[k + w * 4 - 4] + 2 * src[k + w * 4] + src[k + w * 4 + 4]) / 16;
        d[k] = src[k] + amount * (src[k] - blur);
      }
    }
  }
  x.putImageData(img, 0, 0);
}

/**
 * Enlarges the cropped region to the exact target pixel size in gentle 1.5x steps, which stays much
 * smoother than one big jump, then sharpens lightly. Results are cached per crop and size.
 */
function enlargedCrop(image: LoadedImage, src: Rect, dw: number, dh: number): HTMLCanvasElement {
  const key = `${image.url}|${src.x.toFixed(1)}|${src.y.toFixed(1)}|${src.w.toFixed(1)}|${dw}x${dh}`;
  const hit = enlargedCache.get(key);
  if (hit) return hit;
  let cur = makeCanvas(src.w, src.h);
  const c0 = cur.getContext('2d')!;
  c0.imageSmoothingQuality = 'high';
  c0.drawImage(image.source, src.x, src.y, src.w, src.h, 0, 0, cur.width, cur.height);
  while (cur.width < dw) {
    const nw = Math.min(dw, Math.round(cur.width * 1.5));
    const last = nw >= dw;
    const next = makeCanvas(nw, last ? dh : cur.height * (nw / cur.width));
    const nx = next.getContext('2d')!;
    nx.imageSmoothingEnabled = true;
    nx.imageSmoothingQuality = 'high';
    nx.drawImage(cur, 0, 0, next.width, next.height);
    cur = next;
  }
  sharpen(cur, SHARPEN_AMOUNT);
  if (enlargedCache.size >= 16) enlargedCache.delete(enlargedCache.keys().next().value as string);
  enlargedCache.set(key, cur);
  return cur;
}

function drawPhoto(ctx: Ctx, photo: ReturnType<typeof orderedPhotos>[number], r: Rect, radius: number) {
  const src = cropSourceRect({
    imageW: photo.image.width,
    imageH: photo.image.height,
    frameW: r.w,
    frameH: r.h,
    zoom: photo.zoom,
    fx: photo.fx,
    fy: photo.fy,
  });
  ctx.save();
  roundRectPath(ctx, r, radius);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const scale = ctx.getTransform().a || 1;
  const dw = Math.round(r.w * scale);
  const dh = Math.round(r.h * scale);
  if (dw / src.w > 1.15) {
    ctx.drawImage(enlargedCrop(photo.image, src, dw, dh), r.x, r.y, r.w, r.h);
  } else {
    ctx.drawImage(photo.image.source, src.x, src.y, src.w, src.h, r.x, r.y, r.w, r.h);
  }
  ctx.restore();
}

export type QualityLevel = 'good' | 'soft' | 'low';

export interface PhotoQuality {
  level: QualityLevel;
  /** Pixels of the original that end up across the frame. */
  haveW: number;
  /** Pixels across the frame needed for a sharp export at the chosen size. */
  needW: number;
}

/** How well each photo's resolution covers the spot it fills, at an export `exportScale`× the 1080 design size. */
export function photoQuality(doc: PosterDoc, exportScale = 1): Record<string, PhotoQuality> {
  const g = getGeometry(doc);
  const out: Record<string, PhotoQuality> = {};
  orderedPhotos(doc).forEach((p, i) => {
    const slot = g.slots[i];
    if (!slot) return;
    const src = cropSourceRect({ imageW: p.image.width, imageH: p.image.height, frameW: slot.w, frameH: slot.h, zoom: p.zoom, fx: p.fx, fy: p.fy });
    const need = slot.w * exportScale;
    const ratio = src.w / need;
    out[p.id] = { level: ratio >= 0.9 ? 'good' : ratio >= 0.55 ? 'soft' : 'low', haveW: Math.round(src.w), needW: Math.round(need) };
  });
  return out;
}

function emptySlot(ctx: Ctx, r: Rect, radius: number, label: string, dark: boolean) {
  ctx.save();
  roundRectPath(ctx, r, radius);
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(8,74,145,0.07)';
  ctx.fill();
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = dark ? 'rgba(255,255,255,0.45)' : 'rgba(8,74,145,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.8)' : 'rgba(8,74,145,0.6)';
  ctx.font = '700 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
  ctx.restore();
}

/** Restrained diamond lattice, fading out from one corner so it never fills the canvas. */
function drawPattern(ctx: Ctx, region: Rect, tone: Tone, visibility: number) {
  if (visibility <= 0) return;
  const layer = document.createElement('canvas');
  layer.width = Math.max(1, Math.round(region.w * (ctx.getTransform().a || 1)));
  layer.height = Math.max(1, Math.round(region.h * (ctx.getTransform().d || 1)));
  const lc = layer.getContext('2d');
  if (!lc) return;
  const k = layer.width / region.w;
  lc.scale(k, k);
  const step = 72;
  lc.strokeStyle = '#000';
  lc.lineWidth = 1.6;
  lc.beginPath();
  for (let d = -region.h; d <= region.w + region.h; d += step) {
    lc.moveTo(d, 0);
    lc.lineTo(d + region.h, region.h);
    lc.moveTo(d, region.h);
    lc.lineTo(d + region.h, 0);
  }
  lc.stroke();
  // Fade: strongest at the top-right corner of the region.
  lc.globalCompositeOperation = 'destination-in';
  const g = lc.createRadialGradient(region.w, 0, 0, region.w, 0, Math.min(region.w, 760));
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  lc.fillStyle = g;
  lc.fillRect(0, 0, region.w, region.h);
  ctx.save();
  ctx.globalAlpha = (visibility / 100) * (tone === 'dark' ? 0.2 : 0.16);
  ctx.drawImage(layer, region.x, region.y, region.w, region.h);
  ctx.restore();
}

function fitHeadline(ctx: Ctx, doc: PosterDoc, h: HeadlineBox) {
  const text = doc.text.headline.trim().toUpperCase();
  if (!text) return null;
  const fs = getFontSet(doc.fontSet);
  return fitText(text, {
    maxWidth: h.w,
    maxHeight: h.h,
    maxLines: h.maxLines,
    maxSize: h.maxSize,
    minSize: h.minSize,
    lineHeight: 1.02,
    measureAt: (size) => {
      ctx.font = css(fs.display, size);
      return { measure: (t) => ctx.measureText(t).width, space: ctx.measureText(' ').width };
    },
  });
}

function drawHeadline(ctx: Ctx, doc: PosterDoc, g: Geometry) {
  const h = g.headline;
  const fit = fitHeadline(ctx, doc, h);
  if (!fit) return;
  const main = h.tone === 'dark' ? doc.colors.white : doc.colors.navy;
  const fs = getFontSet(doc.fontSet);
  ctx.font = css(fs.display, fit.size);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const space = ctx.measureText(' ').width;
  fit.lines.forEach((line, i) => {
    // Baseline sits at ~0.8 of the line box for caps-heavy Montserrat.
    const y = h.y + i * fit.lineHeight + fit.size * 0.84;
    let x = h.x;
    line.words.forEach((word, wi) => {
      let out = word;
      const last = fit.truncated && i === fit.lines.length - 1 && wi === line.words.length - 1;
      if (last) out = ellipsize(word, Math.max(40, h.w - (x - h.x)), (t) => ctx.measureText(t).width);
      // Alternate colours: line 1 main, line 2 accent, ... A one-line headline alternates by word instead.
      const accent = fit.lines.length > 1 ? i % 2 === 1 : wi % 2 === 1;
      ctx.fillStyle = accent ? doc.colors.orange : main;
      ctx.fillText(out, x, y);
      x += ctx.measureText(out).width + space;
    });
  });
}

/** Short program description in sentence case, up to two lines, shrinking to fit its box. */
function fitDescription(ctx: Ctx, doc: PosterDoc, d: Rect) {
  const text = posterDescription(doc.text);
  if (!text) return null;
  const fs = getFontSet(doc.fontSet);
  return fitText(text, {
    maxWidth: d.w,
    maxHeight: d.h,
    maxLines: 2,
    maxSize: 30,
    minSize: 22,
    lineHeight: 1.3,
    measureAt: (size) => {
      ctx.font = css(fs.text, size);
      return { measure: (t) => ctx.measureText(t).width, space: ctx.measureText(' ').width };
    },
  });
}

function drawDescription(ctx: Ctx, doc: PosterDoc, g: Geometry) {
  const d = g.description;
  const fit = fitDescription(ctx, doc, d);
  if (!fit) return;
  const fs = getFontSet(doc.fontSet);
  ctx.font = css(fs.text, fit.size);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = d.tone === 'dark' ? doc.colors.white : doc.colors.navy;
  ctx.globalAlpha = 0.88;
  fit.lines.forEach((line, i) => {
    let t = line.words.join(' ');
    if (fit.truncated && i === fit.lines.length - 1) t = ellipsize(t, d.w, (x) => ctx.measureText(x).width);
    ctx.fillText(t, d.x, d.y + i * fit.lineHeight + fit.size * 1.0);
  });
  ctx.globalAlpha = 1;
}

function drawFooter(ctx: Ctx, doc: PosterDoc, g: Geometry) {
  const { institution, location } = doc.text;
  const detail = detailLines(doc.text);
  const fs = getFontSet(doc.fontSet);
  // Institution and location are always set in capitals so every poster reads the same.
  const inst = institution.trim().toUpperCase();
  const loc = location.trim().toUpperCase();
  if (!inst && !loc && !detail.length) return;
  const band = g.footer.variant === 'band';
  const r = g.footer.rect;
  const left = r.x > 0 ? r.x : MARGIN;
  const right = r.x > 0 ? r.x + r.w : DESIGN_W - MARGIN;
  const nameColor = band ? doc.colors.white : doc.colors.navy;
  const nameSize = band ? 44 : 40;
  const locSize = band ? 26 : 24;
  const lineGap = 6;

  ctx.textBaseline = 'alphabetic';
  // The right-hand block may use whatever the name/location don't need (at least 320px), so lines like
  // "PUBLIC AND STUDENTS · 181 STUDENTS" are not cut short when the school name is short.
  ctx.font = css(fs.display, nameSize);
  let leftNeed = inst ? ctx.measureText(inst).width : 0;
  ctx.font = css(fs.meta, locSize);
  if (loc) leftNeed = Math.max(leftNeed, ctx.measureText(loc).width);
  const DETAIL_MAX = Math.max(320, Math.min(620, right - left - leftNeed - 40));
  // Shrink the detail text a little (down to 19px) before resorting to an ellipsis.
  let detailSize = 24;
  const widest = () => Math.max(0, ...detail.map((l) => ctx.measureText(l.toUpperCase()).width));
  ctx.font = css(fs.meta, detailSize);
  while (detailSize > 19 && widest() > DETAIL_MAX) {
    detailSize -= 1;
    ctx.font = css(fs.meta, detailSize);
  }
  const detailW = Math.min(widest(), DETAIL_MAX);
  const maxLeft = right - left - (detailW ? detailW + 32 : 0);

  const blockH = (inst ? nameSize : 0) + (inst && loc ? lineGap : 0) + (loc ? locSize : 0);
  let y = band ? r.y + (r.h - blockH) / 2 : r.y + (r.h - blockH) / 2;
  ctx.textAlign = 'left';
  if (inst) {
    let size = nameSize;
    ctx.font = css(fs.display, size);
    while (size > 26 && ctx.measureText(inst).width > maxLeft) {
      size -= 2;
      ctx.font = css(fs.display, size);
    }
    ctx.fillStyle = nameColor;
    ctx.fillText(ellipsize(inst, maxLeft, (t) => ctx.measureText(t).width), left, y + size * 0.85);
    y += nameSize + lineGap;
  }
  if (loc) {
    ctx.font = css(fs.meta, locSize);
    ctx.fillStyle = doc.colors.orange;
    ctx.fillText(ellipsize(loc, maxLeft, (t) => ctx.measureText(t).width), left, y + locSize * 0.85);
  }
  if (detail.length) {
    ctx.font = css(fs.meta, detailSize);
    ctx.textAlign = 'right';
    const lh = 34;
    const top = r.y + (r.h - lh * detail.length) / 2 - 2;
    detail.forEach((raw, i) => {
      const line = raw.toUpperCase();
      ctx.fillStyle = i === 0 ? nameColor : doc.colors.orange;
      ctx.fillText(ellipsize(line, DETAIL_MAX, (t) => ctx.measureText(t).width), right, top + i * lh + 26);
    });
  }
}

export interface RenderOptions {
  /** Draws dashed placeholders for empty photo slots. Never used for export. */
  placeholders?: boolean;
}

/**
 * Renders the poster into `ctx`, which must be sized `DESIGN_W*scale` x `DESIGN_H*scale`.
 * The same function drives the live preview and the PNG export.
 */
export function renderPoster(ctx: Ctx, doc: PosterDoc, scale: number, opts: RenderOptions = {}) {
  const g = getGeometry(doc);
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  ctx.fillStyle = doc.colors.white;
  ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
  for (const b of g.navyBands) {
    ctx.fillStyle = doc.colors.navy;
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }

  drawPattern(ctx, g.pattern.rect, g.pattern.tone, doc.patternVisibility);

  if (g.headerCard) {
    roundRectPath(ctx, g.headerCard, g.headerCard.radius);
    ctx.fillStyle = doc.colors.white;
    ctx.fill();
  }

  // Header logos
  if (g.logoAlign === 'center') {
    drawCenteredLogos(ctx, doc, g.leadersDeskLogo);
  } else {
    const brandLogo = doc.brandLogos[doc.brand];
    if (brandLogo) drawLogo(ctx, brandLogo, g.leadersDeskLogo, 'left');
    else drawWordmark(ctx, g.leadersDeskLogo, getBrand(doc.brand).wordmark, doc.colors.navy, doc.colors.orange, getFontSet(doc.fontSet));
    if (doc.institutionLogo) drawLogo(ctx, doc.institutionLogo, g.institutionLogo, 'right');
  }

  // Photos
  const photos = orderedPhotos(doc);
  g.slots.forEach((slot, i) => {
    const p = photos[i];
    if (p) drawPhoto(ctx, p, slot, g.radius);
    else if (opts.placeholders && i === 0) emptySlot(ctx, slot, g.radius, 'Add event photos', g.pattern.tone === 'dark');
  });

  if (g.accent) {
    ctx.fillStyle = doc.colors.orange;
    ctx.fillRect(g.accent.x, g.accent.y, g.accent.w, g.accent.h);
  }

  drawHeadline(ctx, doc, g);
  drawDescription(ctx, doc, g);
  drawFooter(ctx, doc, g);
  ctx.restore();
}
