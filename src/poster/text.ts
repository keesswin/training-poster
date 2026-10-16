export type Measure = (text: string) => number;

export interface WrappedLine {
  words: string[];
  width: number;
}

const norm = (w: string) => w.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();

/** Parses the comma/space separated emphasis field into a set of normalised words. */
export function emphasisSet(emphasis: string): Set<string> {
  return new Set(
    emphasis
      .split(/[\s,]+/)
      .map(norm)
      .filter(Boolean),
  );
}

export function isEmphasised(word: string, set: Set<string>) {
  return set.has(norm(word));
}

/** Greedy word wrap. Words longer than `maxWidth` get their own line (caller decides what to do). */
export function wrapWords(text: string, maxWidth: number, measure: Measure, space: number): WrappedLine[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: WrappedLine[] = [];
  let cur: string[] = [];
  let curW = 0;
  for (const word of words) {
    const w = measure(word);
    if (cur.length && curW + space + w > maxWidth) {
      lines.push({ words: cur, width: curW });
      cur = [word];
      curW = w;
    } else {
      curW = cur.length ? curW + space + w : w;
      cur.push(word);
    }
  }
  if (cur.length) lines.push({ words: cur, width: curW });
  return lines;
}

export interface FitOptions {
  maxWidth: number;
  maxHeight: number;
  maxLines: number;
  maxSize: number;
  minSize: number;
  lineHeight: number;
  /** Builds a measure function + space width for a given font size. */
  measureAt: (size: number) => { measure: Measure; space: number };
}

export interface FitResult {
  size: number;
  lines: WrappedLine[];
  lineHeight: number;
  height: number;
  /** True when even the minimum size could not honour the limits (lines were truncated). */
  truncated: boolean;
}

/** Finds the largest font size at which the text wraps within the box. */
export function fitText(text: string, o: FitOptions): FitResult {
  let lastLines: WrappedLine[] = [];
  let lastSize = o.minSize;
  for (let size = o.maxSize; size >= o.minSize; size -= 2) {
    const { measure, space } = o.measureAt(size);
    const lines = wrapWords(text, o.maxWidth, measure, space);
    const lh = size * o.lineHeight;
    const height = lines.length * lh;
    lastLines = lines;
    lastSize = size;
    const widest = Math.max(0, ...lines.map((l) => l.width));
    if (lines.length <= o.maxLines && height <= o.maxHeight + 0.5 && widest <= o.maxWidth + 0.5) {
      return { size, lines, lineHeight: lh, height, truncated: false };
    }
  }
  const lh = lastSize * o.lineHeight;
  const kept = lastLines.slice(0, Math.min(o.maxLines, Math.max(1, Math.floor(o.maxHeight / lh))));
  return { size: lastSize, lines: kept, lineHeight: lh, height: kept.length * lh, truncated: true };
}

/** Trims `text` with an ellipsis until it fits `maxWidth`. */
export function ellipsize(text: string, maxWidth: number, measure: Measure): string {
  if (measure(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && measure(t + '…') > maxWidth) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}
