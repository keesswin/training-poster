import type { BrandId } from './brands';

// localStorage can throw or be unavailable (private mode, blocked data), so every call is guarded.
const get = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* quota or blocked: the app still works, it just won't remember */
  }
};

const HEADLINES = 'ldposter.headlines';
const MAX_HEADLINES = 25;

export function loadHeadlines(): string[] {
  try {
    const v = JSON.parse(get(HEADLINES) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, MAX_HEADLINES) : [];
  } catch {
    return [];
  }
}

/** Newest first, case-insensitive de-duplication. Returns the new list. */
export function rememberHeadline(list: string[], headline: string): string[] {
  const h = headline.trim().replace(/\s+/g, ' ');
  if (h.length < 3) return list;
  const next = [h, ...list.filter((x) => x.toLowerCase() !== h.toLowerCase())].slice(0, MAX_HEADLINES);
  set(HEADLINES, JSON.stringify(next));
  return next;
}

export function forgetHeadline(list: string[], headline: string): string[] {
  const next = list.filter((x) => x !== headline);
  set(HEADLINES, JSON.stringify(next));
  return next;
}

const logoKey = (b: BrandId) => `ldposter.logo.${b}`;

/** Stores the logo file as a data URL so each brand's logo is there next time. Skipped silently if too big. */
export async function saveBrandLogo(brand: BrandId, file: File | null) {
  if (!file) return set(logoKey(brand), null);
  if (file.size > 1.5 * 1024 * 1024) return set(logoKey(brand), null);
  const data = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
  set(logoKey(brand), JSON.stringify({ name: file.name, type: file.type, data }));
}

export async function loadSavedBrandLogo(brand: BrandId): Promise<File | null> {
  try {
    const raw = get(logoKey(brand));
    if (!raw) return null;
    const { name, type, data } = JSON.parse(raw);
    const blob = await (await fetch(data)).blob();
    return new File([blob], name, { type: type || blob.type });
  } catch {
    return null;
  }
}
