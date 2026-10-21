import type { BrandId } from './brands';

// Files in src/assets/logos named leaders-desk.* / leaders-foundation.* are bundled as brand defaults,
// and leaders-desk-white.* / leaders-foundation-white.* as the versions used on dark templates.
const found = import.meta.glob('../assets/logos/*.{png,jpg,jpeg,webp,svg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const FILE_FOR: Record<BrandId, string> = { desk: 'leaders-desk', foundation: 'leaders-foundation' };

export function defaultLogoUrl(brand: BrandId, white = false): string | null {
  const want = FILE_FOR[brand] + (white ? '-white' : '');
  const key = Object.keys(found).find((k) => k.split('/').pop()!.replace(/\.\w+$/, '') === want);
  return key ? found[key] : null;
}

/** Turns a bundled logo URL (a data: URL in the hosted build) into a File without using fetch on data: URLs. */
export async function defaultLogoFile(brand: BrandId, white = false): Promise<File | null> {
  const url = defaultLogoUrl(brand, white);
  if (!url) return null;
  try {
    const name = `${FILE_FOR[brand]}${/svg/.test(url.slice(0, 30)) ? '.svg' : url.match(/\.(\w+)(\?|$)/)?.[0] ?? '.png'}`;
    if (url.startsWith('data:')) {
      const [head, body] = url.split(',');
      const type = head.slice(5).split(';')[0] || 'image/png';
      const bin = head.includes(';base64') ? atob(body) : decodeURIComponent(body);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      const ext = type === 'image/svg+xml' ? '.svg' : type === 'image/jpeg' ? '.jpg' : type === 'image/webp' ? '.webp' : '.png';
      return new File([bytes], FILE_FOR[brand] + (white ? '-white' : '') + ext, { type });
    }
    const blob = await (await fetch(url)).blob();
    return new File([blob], name, { type: blob.type });
  } catch {
    return null;
  }
}
