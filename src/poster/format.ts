import { getBrand } from './brands';
import type { PosterDoc, PosterText } from './types';

/** Today's date in the user's local time zone as yyyy-mm-dd (what <input type="date"> uses). */
export function todayISO(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** "2026-10-12" -> "12 Oct 2026". Returns '' for empty or invalid input. */
export function formatDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function studentsLabel(n: string) {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v > 0 ? `${v.toLocaleString('en-IN')} student${v === 1 ? '' : 's'}` : '';
}

/** Lines for the right side of the footer. Empty fields leave no trace. */
export function detailLines(t: PosterText): string[] {
  const second = [t.audience.trim(), studentsLabel(t.students)].filter(Boolean).join(' · ');
  return [t.showDate ? formatDate(t.date) : '', second].filter(Boolean);
}

export interface DescriptionPreset {
  label: string;
  text: string;
}

/** Placeholders {institution} {location} {date} {students} {audience} are filled in when the message is built. */
export const DESCRIPTION_PRESETS: DescriptionPreset[] = [
  { label: 'Career awareness session', text: 'An interactive session on career options, skills and pathways after school for {audience}.' },
  { label: 'Skill development workshop', text: 'A hands-on workshop building communication, confidence and workplace-ready skills.' },
  { label: 'Leadership program', text: 'A leadership program on teamwork, decision-making and public speaking for {audience}.' },
  { label: 'Motivational talk', text: 'A motivational session encouraging {audience} to set goals and take the first step.' },
  { label: 'Orientation / induction', text: 'An orientation introducing {audience} to the journey ahead and how to make the most of it.' },
  { label: 'Parents & teachers meet', text: 'An awareness meet for parents and teachers on guiding students to the right career choices.' },
];

/**
 * Sentence case: first letter of each sentence capitalised. Text typed mostly in capitals is
 * lower-cased first; otherwise the rest is left as typed so names and acronyms survive.
 */
export function sentenceCase(input: string): string {
  const t = input.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const letters = t.replace(/[^\p{L}]/gu, '');
  const upper = letters.replace(/[^\p{Lu}]/gu, '');
  const base = letters.length > 3 && upper.length / letters.length > 0.6 ? t.toLowerCase() : t;
  return base.replace(/(^|[.!?]\s+)(\p{L})/gu, (_m, pre: string, ch: string) => pre + ch.toUpperCase());
}

/** The description exactly as drawn on the poster. */
export function posterDescription(t: PosterText): string {
  if (!t.showDescription) return '';
  return sentenceCase(fillPlaceholders(t.description.trim(), t));
}

export function fillPlaceholders(text: string, t: PosterText) {
  const fallback: Record<string, string> = {
    institution: t.institution.trim() || 'the school',
    location: t.location.trim(),
    date: formatDate(t.date),
    students: studentsLabel(t.students) || 'students',
    audience: t.audience.trim() || 'students',
  };
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in fallback ? fallback[k] : m));
}

/** WhatsApp-ready caption (uses WhatsApp's *bold* syntax). */
export function buildMessage(doc: PosterDoc): string {
  const t = doc.text;
  const brand = getBrand(doc.brand);
  const place = [t.institution.trim(), t.location.trim()].filter(Boolean).join(', ');
  const facts = [t.showDate ? formatDate(t.date) : '', studentsLabel(t.students), t.audience.trim()].filter(Boolean).join(' · ');
  const desc = sentenceCase(fillPlaceholders(t.description.trim(), t));
  return [
    t.headline.trim() && `*${t.headline.trim()}*`,
    place,
    facts,
    desc && `\n${desc}`,
    `\n– ${brand.name}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** "GHSS Kuruchi" + 2026-10-16 -> "GHSS-KURUCHI-2026-10-16.png". Falls back to "POSTER" without an institution. */
export function posterFilename(t: PosterText, width = 1080): string {
  const slug = t.institution
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  const date = /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : todayISO();
  return `${slug || 'POSTER'}-${date}${width === 1080 ? '' : `-${width}PX`}.png`;
}

/** Sample copy the live preview shows for empty fields. Never used for export. */
export const SAMPLE_TEXT = { headline: 'Career Awareness Program', institution: 'Your School Name', location: 'City, State' } as const;

export function withSampleText(doc: PosterDoc): PosterDoc {
  const t = doc.text;
  return {
    ...doc,
    text: {
      ...t,
      headline: t.headline.trim() ? t.headline : SAMPLE_TEXT.headline,
      institution: t.institution.trim() ? t.institution : SAMPLE_TEXT.institution,
      location: t.location.trim() ? t.location : SAMPLE_TEXT.location,
    },
  };
}
