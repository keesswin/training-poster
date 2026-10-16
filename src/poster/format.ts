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
  { label: 'Career awareness session', text: 'An interactive career awareness session at {institution}, helping {audience} explore career options, required skills and pathways after school.' },
  { label: 'Skill development workshop', text: 'A hands-on skill development workshop for {students} at {institution}, building communication, confidence and workplace-ready skills.' },
  { label: 'Leadership program', text: 'A leadership program at {institution} that helped {audience} build teamwork, decision-making and public-speaking skills.' },
  { label: 'Motivational talk', text: 'A motivational session at {institution} encouraging {audience} to set goals and take the first step towards their future.' },
  { label: 'Orientation / induction', text: 'An orientation program for {audience} at {institution}, introducing the journey ahead and how to make the most of it.' },
  { label: 'Parents & teachers meet', text: 'An awareness meet for parents and teachers at {institution}, on guiding students towards the right career choices.' },
];

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
  const desc = fillPlaceholders(t.description.trim(), t).trim();
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
