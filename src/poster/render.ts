import { cropSourceRect } from './crop';
import { getTemplate, clampSupports, MARGIN, type Geometry, type Tone } from './layouts';
import { getBrand } from './brands';
import { detailLines } from './format';
import { ellipsize, fitText } from './text';
import { DESIGN_H, DESIGN_W, type LoadedImage, type PosterDoc, type Rect } from './types';

export const FONT_FAMILY = "Montserrat, 'Segoe UI', system-ui, sans-serif";
const font = (weight: number, size: number) => `${weight} ${size}px ${FONT_FAMILY}`;

type Ctx = CanvasRenderingContext2D;

/** Photos in slot order: hero first, then the remaining photos in the user's order. */
export function orderedPhotos(doc: PosterDoc) {
  const hero = doc.photos.find((p) => p.id === doc.heroId) ?? doc.photos[0];
  if (!hero) return [];
  return [hero, ...doc.photos.filter((p) => p !== hero)];
}

export function getGeometry(doc: PosterDoc): Geometry {
  return getTemplate(doc.template).geometry(clampSupports(doc.photos.length));
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
function drawWordmark(ctx: Ctx, box: Rect, parts: [string, string], navy: string, orange: string) {
  let size = 40;
  ctx.font = font(900, size);
  while (size > 18 && ctx.measureText(parts[0] + parts[1]).width > box.w) {
    size -= 2;
    ctx.font = font(900, size);
  }
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const cy = box.y + box.h / 2;
  ctx.fillStyle = navy;
  ctx.fillText(parts[0], box.x, cy);
  ctx.fillStyle = orange;
  ctx.fillText(parts[1], box.x + ctx.measureText(parts[0]).width, cy);
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
  ctx.drawImage(photo.image.source, src.x, src.y, src.w, src.h, r.x, r.y, r.w, r.h);
  ctx.restore();
}

function emptySlot(ctx: Ctx, r: Rect, radius: number, label: string) {
  ctx.save();
  roundRectPath(ctx, r, radius);
  ctx.fillStyle = 'rgba(8,74,145,0.07)';
  ctx.fill();
  ctx.setLineDash([10, 10]);
  ctx.strokeStyle = 'rgba(8,74,145,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(8,74,145,0.6)';
  ctx.font = font(700, 28);
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

function drawHeadline(ctx: Ctx, doc: PosterDoc, g: Geometry) {
  const text = doc.text.headline.trim().toUpperCase();
  if (!text) return;
  const h = g.headline;
  const main = h.tone === 'dark' ? doc.colors.white : doc.colors.navy;
  const fit = fitText(text, {
    maxWidth: h.w,
    maxHeight: h.h,
    maxLines: h.maxLines,
    maxSize: h.maxSize,
    minSize: h.minSize,
    lineHeight: 1.0,
    measureAt: (size) => {
      ctx.font = font(900, size);
      return { measure: (t) => ctx.measureText(t).width, space: ctx.measureText(' ').width };
    },
  });
  ctx.font = font(900, fit.size);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const space = ctx.measureText(' ').width;
  fit.lines.forEach((line, i) => {
    // Baseline sits at ~0.8 of the line box for caps-heavy Montserrat.
    const y = h.y + i * fit.lineHeight + fit.size * 0.86;
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

function drawFooter(ctx: Ctx, doc: PosterDoc, g: Geometry) {
  const { institution, location } = doc.text;
  const detail = detailLines(doc.text);
  const inst = institution.trim();
  const loc = location.trim();
  if (!inst && !loc && !detail.length) return;
  const band = g.footer.variant === 'band';
  const r = g.footer.rect;
  const left = MARGIN;
  const right = DESIGN_W - MARGIN;
  const nameColor = band ? doc.colors.white : doc.colors.navy;
  const nameSize = band ? 44 : 38;
  const locSize = band ? 30 : 28;
  const lineGap = 6;

  ctx.textBaseline = 'alphabetic';
  const DETAIL_MAX = 400;
  let detailW = 0;
  ctx.font = font(700, 26);
  for (const l of detail) detailW = Math.max(detailW, Math.min(ctx.measureText(l).width, DETAIL_MAX));
  const maxLeft = right - left - (detailW ? detailW + 32 : 0);

  const blockH = (inst ? nameSize : 0) + (inst && loc ? lineGap : 0) + (loc ? locSize : 0);
  let y = band ? r.y + (r.h - blockH) / 2 : r.y + (r.h - blockH) / 2;
  ctx.textAlign = 'left';
  if (inst) {
    let size = nameSize;
    ctx.font = font(800, size);
    while (size > 26 && ctx.measureText(inst).width > maxLeft) {
      size -= 2;
      ctx.font = font(800, size);
    }
    ctx.fillStyle = nameColor;
    ctx.fillText(ellipsize(inst, maxLeft, (t) => ctx.measureText(t).width), left, y + size * 0.85);
    y += nameSize + lineGap;
  }
  if (loc) {
    ctx.font = font(700, locSize);
    ctx.fillStyle = doc.colors.orange;
    ctx.fillText(ellipsize(loc, maxLeft, (t) => ctx.measureText(t).width), left, y + locSize * 0.85);
  }
  if (detail.length) {
    ctx.font = font(700, 26);
    ctx.textAlign = 'right';
    const lh = 34;
    const top = r.y + (r.h - lh * detail.length) / 2;
    detail.forEach((line, i) => {
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

  // Header logos
  const brandLogo = doc.brandLogos[doc.brand];
  if (brandLogo) drawLogo(ctx, brandLogo, g.leadersDeskLogo, 'left');
  else drawWordmark(ctx, g.leadersDeskLogo, getBrand(doc.brand).wordmark, doc.colors.navy, doc.colors.orange);
  if (doc.institutionLogo) drawLogo(ctx, doc.institutionLogo, g.institutionLogo, 'right');

  // Photos
  const photos = orderedPhotos(doc);
  g.slots.forEach((slot, i) => {
    const p = photos[i];
    if (p) drawPhoto(ctx, p, slot, g.radius);
    else if (opts.placeholders && i === 0) emptySlot(ctx, slot, g.radius, 'Add event photos');
  });

  if (g.accent) {
    ctx.fillStyle = doc.colors.orange;
    ctx.fillRect(g.accent.x, g.accent.y, g.accent.w, g.accent.h);
  }

  drawHeadline(ctx, doc, g);
  drawFooter(ctx, doc, g);
  ctx.restore();
}
