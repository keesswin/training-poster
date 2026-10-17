import { describe, expect, it } from 'vitest';
import { cropSourceRect, panCrop } from './crop';
import { TEMPLATES } from './layouts';
import { photoQuality } from './render';
import { BRANDS } from './brands';
import { posterFilename, buildMessage, detailLines, DESCRIPTION_PRESETS, fillPlaceholders, formatDate, posterDescription, sentenceCase, studentsLabel, todayISO } from './format';
import { fitText } from './text';
import { DESIGN_H, DESIGN_W, type PosterDoc, type PosterText, type Rect } from './types';

const inside = (r: Rect) => r.x >= 0 && r.y >= 0 && r.x + r.w <= DESIGN_W + 0.01 && r.y + r.h <= DESIGN_H + 0.01 && r.w > 0 && r.h > 0;
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;

describe('layouts', () => {
  for (const t of TEMPLATES) {
    for (const desc of [false, true])
    for (let supports = 0; supports <= 5; supports++) {
      it(`${t.id} with ${supports} supports${desc ? ' + description' : ''} stays on canvas without overlaps`, () => {
        const g = t.geometry(supports, desc);
        expect(g.slots).toHaveLength(supports + 1);
        if (g.headerCard) {
          for (const r of [g.headline, g.footer.rect, ...g.slots, ...(desc ? [g.description] : [])]) expect(overlap(g.headerCard, r)).toBe(false);
          for (const r of [g.leadersDeskLogo, g.institutionLogo]) expect(inside(r) && r.x >= g.headerCard.x && r.x + r.w <= g.headerCard.x + g.headerCard.w).toBe(true);
        }
        const fixed = [g.leadersDeskLogo, g.institutionLogo, g.headline, g.footer.rect, ...(desc ? [g.description] : [])];
        for (const r of [...fixed, ...g.slots]) expect(inside(r)).toBe(true);
        // photos never collide with each other or with text / logo boxes
        const all = [...g.slots.map((r) => ({ r, k: 'photo' })), ...fixed.map((r) => ({ r, k: 'fixed' }))];
        for (let i = 0; i < all.length; i++)
          for (let j = i + 1; j < all.length; j++) {
            expect(overlap(all[i].r, all[j].r), `${t.id}/${supports}: ${i} vs ${j}`).toBe(false);
          }
      });
    }
    it(`${t.id}: photos are the majority of the artwork even with a description`, () => {
      const g = t.geometry(2, true);
      const area = g.slots.reduce((s, r) => s + r.w * r.h, 0);
      expect(area / (DESIGN_W * DESIGN_H)).toBeGreaterThan(0.5);
    });
  }
});

describe('poster filename', () => {
  it('combines institution and date', () => {
    expect(posterFilename({ ...text, institution: 'GHSS Kuruchi', date: '2026-10-16' })).toBe('GHSS-KURUCHI-2026-10-16.png');
  });
  it('strips punctuation and accents, caps the length, and falls back safely', () => {
    expect(posterFilename({ ...text, institution: 'St. Mary’s Hr. Sec. School (Café)', date: '2026-01-05' })).toBe('ST-MARY-S-HR-SEC-SCHOOL-CAFE-2026-01-05.png');
    expect(posterFilename({ ...text, institution: '', date: '2026-01-05' })).toBe('POSTER-2026-01-05.png');
    expect(posterFilename({ ...text, institution: 'x'.repeat(100), date: '2026-01-05' }).length).toBeLessThan(70);
  });
  it('marks larger exports', () => {
    expect(posterFilename({ ...text, institution: 'ABC', date: '2026-01-05' }, 2160)).toBe('ABC-2026-01-05-2160PX.png');
  });
});

describe('sentence case', () => {
  it('capitalises each sentence and keeps proper nouns', () => {
    expect(sentenceCase('a session at St. Mary School. students joined.')).toBe('A session at St. Mary School. Students joined.');
  });
  it('lower-cases text typed in capitals', () => {
    expect(sentenceCase('AN INTERACTIVE CAREER SESSION. FOR GRADE 10.')).toBe('An interactive career session. For grade 10.');
  });
  it('hides the poster description when toggled off', () => {
    expect(posterDescription({ ...text, showDescription: false })).toBe('');
    expect(posterDescription(text)).toContain('St. Mary’s School');
  });
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
});

const text: PosterText = {
  headline: 'Career Awareness Program',
  institution: 'St. Mary’s School',
  location: 'Chennai',
  audience: 'Grade 10',
  date: '2026-10-12',
  showDate: true,
  students: '120',
  description: 'A session at {institution} for {students} ({audience}) on {date} in {location}.',
  showDescription: true,
};
const doc = { text, brand: 'desk' } as unknown as PosterDoc;

describe('dates, students and message', () => {
  it('todayISO uses local time and zero-pads', () => {
    expect(todayISO(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
  it('formats dates and rejects junk', () => {
    expect(formatDate('2026-10-12')).toBe('12 Oct 2026');
    expect(formatDate('')).toBe('');
    expect(formatDate('2026-13-45x')).toBe('');
  });
  it('labels student counts', () => {
    expect(studentsLabel('120')).toBe('120 students');
    expect(studentsLabel('1')).toBe('1 student');
    expect(studentsLabel('0')).toBe('');
    expect(studentsLabel('')).toBe('');
  });
  it('footer detail lines drop empty fields', () => {
    expect(detailLines(text)).toEqual(['12 Oct 2026', 'Grade 10 · 120 students']);
    expect(detailLines({ ...text, showDate: false, audience: '', students: '' })).toEqual([]);
  });
  it('fills placeholders, with sensible fallbacks', () => {
    expect(fillPlaceholders('{institution} / {students} / {nope}', { ...text, students: '' })).toBe('St. Mary’s School / students / {nope}');
  });
  it('builds a WhatsApp message with the brand sign-off', () => {
    const m = buildMessage(doc);
    expect(m).toContain('*Career Awareness Program*');
    expect(m).toContain('12 Oct 2026 · 120 students · Grade 10');
    expect(m).toContain('A session at St. Mary’s School for 120 students (Grade 10) on 12 Oct 2026 in Chennai.');
    expect(m.endsWith('– Leaders Desk')).toBe(true);
    expect(buildMessage({ ...doc, brand: 'foundation' } as PosterDoc).endsWith('– Leaders Foundation')).toBe(true);
  });
  it('every description preset only uses known placeholders', () => {
    for (const p of DESCRIPTION_PRESETS) expect(fillPlaceholders(p.text, text)).not.toMatch(/\{\w+\}/);
  });
  it('brands have distinct palettes', () => {
    expect(new Set(BRANDS.map((b) => b.colors.navy)).size).toBe(BRANDS.length);
  });
});

describe('photo resolution check', () => {
  const photo = (id: string, w: number, h: number) => ({ id, image: { width: w, height: h } as never, zoom: 1, fx: 0.5, fy: 0.4 });
  const base = { template: 'photo-story', text: { ...text, showDescription: false }, photos: [photo('a', 4000, 3000), photo('b', 320, 240)], heroId: 'a' } as unknown as PosterDoc;
  it('flags small photos for the slot they fill, not photos in general', () => {
    const q = photoQuality(base);
    expect(q.a.level).toBe('good');
    expect(q.b.level).toBe('low');
    expect(q.b.needW).toBeGreaterThan(q.b.haveW);
  });
  it('zooming in lowers the effective resolution', () => {
    const zoomed = { ...base, photos: [photo('a', 1500, 1000), photo('b', 4000, 3000)] } as unknown as PosterDoc;
    const before = photoQuality(zoomed).a.haveW;
    zoomed.photos[0] = { ...zoomed.photos[0], zoom: 3 };
    expect(photoQuality(zoomed).a.haveW).toBeLessThan(before);
  });
});
