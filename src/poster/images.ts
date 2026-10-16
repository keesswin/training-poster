import type { LoadedImage } from './types';

export type ImageKind = 'photo' | 'logo';

export class UploadError extends Error {}

const RASTER = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/bmp'];
const LIMITS: Record<ImageKind, { maxBytes: number; minSide: number }> = {
  photo: { maxBytes: 40 * 1024 * 1024, minSide: 200 },
  logo: { maxBytes: 12 * 1024 * 1024, minSide: 16 },
};

function isSvg(file: File) {
  return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode failed'));
    img.src = url;
  });
}

/**
 * Validates and decodes an uploaded file. The original file is never re-encoded: rasters are
 * decoded with EXIF orientation applied, and drawn straight from the decoded bitmap on export.
 * Throws UploadError with a user-readable message.
 */
export async function loadImageFile(file: File, kind: ImageKind): Promise<{ image: LoadedImage; warning?: string }> {
  const limits = LIMITS[kind];
  const svg = isSvg(file);
  if (!svg && !RASTER.includes(file.type)) {
    throw new UploadError(`“${file.name}” isn’t a supported image. Use JPG, PNG or WebP${kind === 'logo' ? ' (SVG also works for logos)' : ''}.`);
  }
  if (svg && kind === 'photo') throw new UploadError(`“${file.name}”: SVG files can only be used as logos.`);
  if (file.size === 0) throw new UploadError(`“${file.name}” is empty.`);
  if (file.size > limits.maxBytes) {
    throw new UploadError(`“${file.name}” is too large (limit ${Math.round(limits.maxBytes / 1048576)} MB).`);
  }

  const url = URL.createObjectURL(file);
  try {
    let source: CanvasImageSource;
    let width: number;
    let height: number;
    if (svg) {
      const img = await loadHtmlImage(url);
      width = img.naturalWidth || 512;
      height = img.naturalHeight || 512;
      source = img;
    } else {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      width = bmp.width;
      height = bmp.height;
      source = bmp;
    }
    if (width < 1 || height < 1) throw new Error('empty');
    const warning =
      Math.min(width, height) < limits.minSide
        ? `“${file.name}” is very small (${width}×${height}px) and may look blurry.`
        : kind === 'photo' && Math.max(width, height) < 900
          ? `“${file.name}” is low resolution (${width}×${height}px); it may look soft at full size.`
          : undefined;
    return { image: { source, width, height, url, name: file.name }, warning };
  } catch (e) {
    URL.revokeObjectURL(url);
    if (e instanceof UploadError) throw e;
    throw new UploadError(`“${file.name}” couldn’t be read. It may be corrupted or not a real image.`);
  }
}

export function disposeImage(img: LoadedImage | null) {
  if (!img) return;
  URL.revokeObjectURL(img.url);
  if ('close' in img.source) (img.source as ImageBitmap).close();
}
