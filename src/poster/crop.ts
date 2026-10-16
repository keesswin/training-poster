import type { Rect } from './types';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface CropInput {
  imageW: number;
  imageH: number;
  frameW: number;
  frameH: number;
  zoom: number;
  fx: number;
  fy: number;
}

/**
 * Source rectangle for a "cover" crop. The source aspect ratio always equals the frame
 * aspect ratio, so the image is never stretched.
 */
export function cropSourceRect(c: CropInput): Rect {
  const zoom = clamp(c.zoom, MIN_ZOOM, MAX_ZOOM);
  const scale = Math.max(c.frameW / c.imageW, c.frameH / c.imageH) * zoom;
  const w = c.frameW / scale;
  const h = c.frameH / scale;
  return {
    x: (c.imageW - w) * clamp(c.fx, 0, 1),
    y: (c.imageH - h) * clamp(c.fy, 0, 1),
    w,
    h,
  };
}

/** Pixels (in frame space) by which the scaled image overflows the frame on each axis. */
export function cropOverflow(c: Omit<CropInput, 'fx' | 'fy'>) {
  const zoom = clamp(c.zoom, MIN_ZOOM, MAX_ZOOM);
  const scale = Math.max(c.frameW / c.imageW, c.frameH / c.imageH) * zoom;
  return { x: Math.max(0, c.imageW * scale - c.frameW), y: Math.max(0, c.imageH * scale - c.frameH) };
}

/** Moves the focal point by a drag delta given in frame pixels (dragging moves the image with the pointer). */
export function panCrop(
  c: Omit<CropInput, 'fx' | 'fy'> & { fx: number; fy: number },
  dx: number,
  dy: number,
): { fx: number; fy: number } {
  const o = cropOverflow(c);
  return {
    fx: o.x > 0 ? clamp(c.fx - dx / o.x, 0, 1) : c.fx,
    fy: o.y > 0 ? clamp(c.fy - dy / o.y, 0, 1) : c.fy,
  };
}

/** Largest rect of aspect `ar` that fits inside `box`, positioned according to `align` (-1 start, 0 centre, 1 end). */
export function fitInside(boxW: number, boxH: number, ar: number, alignX = 0, alignY = 0) {
  let w = boxW;
  let h = w / ar;
  if (h > boxH) {
    h = boxH;
    w = h * ar;
  }
  return {
    w,
    h,
    dx: ((boxW - w) / 2) * (alignX + 1),
    dy: ((boxH - h) / 2) * (alignY + 1),
  };
}
