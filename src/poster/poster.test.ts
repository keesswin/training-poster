import { describe, expect, it } from 'vitest';
import { cropSourceRect, panCrop } from './crop';
import { TEMPLATES } from './layouts';
import { emphasisSet, fitText, isEmphasised } from './text';
import { DESIGN_H, DESIGN_W, type Rect } from './types';

const inside = (r: Rect) => r.x >= 0 && r.y >= 0 && r.x + r.w <= DESIGN_W + 0.01 && r.y + r.h <= DESIGN_H + 0.01 && r.w > 0 && r.h > 0;
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;

describe('layouts', () => {
  for (const t of TEMPLATES) {
    for (let supports = 0; supports <= 5; supports++) {
      it(`${t.id} with ${supports} supports stays on canvas without overlaps`, () => {
        const g = t.geometry(supports);
        expect(g.slots).toHaveLength(supports + 1);
        const fixed = [g.leadersDeskLogo, g.institutionLogo, g.headline, g.footer.rect];
        for (const r of [...fixed, ...g.slots]) expect(inside(r)).toBe(true);
        // photos never collide with each other or with text / logo boxes
        const all = [...g.slots.map((r) => ({ r, k: 'photo' })), ...fixed.map((r) => ({ r, k: 'fixed' }))];
        for (let i = 0; i < all.length; i++)
          for (let j = i + 1; j < all.length; j++) {
            expect(overlap(all[i].r, all[j].r), `${t.id}/${supports}: ${i} vs ${j}`).toBe(false);
          }
      });
    }
    it(`${t.id}: photos are the majority of the artwork`, () => {
      const g = t.geometry(2);
      const area = g.slots.reduce((s, r) => s + r.w * r.h, 0);
      expect(area / (DESIGN_W * DESIGN_H)).toBeGreaterThan(0.5);
    });
  }
});

describe('crop', () => {
  it('never distorts: source aspect equals frame aspect, for any image/zoom', () => {
    for (const [iw, ih] of [[4000, 3000], [3000, 4000], [1000, 1000], [6000, 900]])
      for (const zoom of [1, 1.7, 4])
        for (const [fw, fh] of [[968, 568], [250, 120], [300, 700]]) {
          const s = cropSourceRect({ imageW: iw, imageH: ih, frameW: fw, frameH: fh, zoom, fx: 0.3, fy: 0.9 });
          expect(s.w / s.h).toBeCloseTo(fw / fh, 6);
          expect(s.x).toBeGreaterThanOrEqual(-1e-6);
          expect(s.y).toBeGreaterThanOrEqual(-1e-6);
          expect(s.x + s.w).toBeLessThanOrEqual(iw + 1e-6);
          expect(s.y + s.h).toBeLessThanOrEqual(ih + 1e-6);
        }
  });
  it('panning is clamped and moves the image with the pointer', () => {
    const base = { imageW: 4000, imageH: 3000, frameW: 968, frameH: 568, zoom: 2, fx: 0.5, fy: 0.5 };
    const r = panCrop(base, 100, 0);
    expect(r.fx).toBeLessThan(0.5); // dragging right reveals the left of the image
    expect(panCrop(base, -1e6, 1e6)).toEqual({ fx: 1, fy: 0 });
  });
});

describe('headline fitting', () => {
  const measureAt = (size: number) => ({ measure: (t: string) => t.length * size * 0.72, space: size * 0.3 });
  it('fits "CAREER AWARENESS PROGRAM" in two lines inside the box', () => {
    const r = fitText('CAREER AWARENESS PROGRAM', { maxWidth: 968, maxHeight: 200, maxLines: 3, maxSize: 104, minSize: 44, lineHeight: 1, measureAt });
    expect(r.truncated).toBe(false);
    expect(r.height).toBeLessThanOrEqual(200);
    for (const l of r.lines) expect(l.width).toBeLessThanOrEqual(968);
  });
  it('shrinks very long headlines instead of overflowing', () => {
    const r = fitText('A VERY LONG HEADLINE ABOUT AN EXTENDED CAREER GUIDANCE AND AWARENESS PROGRAMME FOR GRADE TEN', { maxWidth: 968, maxHeight: 200, maxLines: 3, maxSize: 104, minSize: 44, lineHeight: 1, measureAt });
    expect(r.height).toBeLessThanOrEqual(200);
  });
  it('matches emphasis words ignoring case and punctuation', () => {
    const s = emphasisSet('awareness, program!');
    expect(isEmphasised('AWARENESS', s)).toBe(true);
    expect(isEmphasised('Career', s)).toBe(false);
  });
});
