import { renderPoster } from './render';
import { DESIGN_H, DESIGN_W, type PosterDoc } from './types';

export interface ExportPreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

/**
 * Add new sizes here. Layouts are authored in a 1080×1350 design space and scaled uniformly,
 * so any preset must share the 4:5 aspect. A different aspect ratio needs its own template geometry.
 */
export const EXPORT_PRESETS: ExportPreset[] = [
  // Default. Group photos need the extra pixels: at 1080 wide a face in a 20-person photo is only ~35px.
  { id: 'hd', label: 'High quality · 2160 × 2700 (recommended)', width: 2160, height: 2700 },
  { id: 'instagram-portrait', label: 'Instagram size · 1080 × 1350', width: 1080, height: 1350 },
  { id: 'xl', label: 'Extra large · 3240 × 4050 (print, big screens)', width: 3240, height: 4050 },
];

export const DEFAULT_EXPORT_WIDTH = EXPORT_PRESETS[0].width;

export function presetScale(p: ExportPreset) {
  return p.width / DESIGN_W;
}

/** Renders the poster (no editor chrome) into a fresh canvas and encodes it as PNG. */
export async function exportPoster(doc: PosterDoc, preset: ExportPreset): Promise<Blob> {
  if (preset.width / preset.height !== DESIGN_W / DESIGN_H) throw new Error('Unsupported export aspect ratio');
  const canvas = document.createElement('canvas');
  canvas.width = preset.width;
  canvas.height = preset.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser');
  renderPoster(ctx, doc, presetScale(preset));
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'),
  );
}

/** Inside a hosted Artifact the frame blocks direct downloads, so use the viewer-confirmed save capability when present. */
export async function downloadBlob(blob: Blob, filename: string) {
  try {
    const claude = (window as unknown as { claude?: { use: (n: string) => Promise<{ save: (r: { filename: string; data: Blob }) => Promise<unknown> } | null> } }).claude;
    const downloads = claude ? await claude.use('downloads') : null;
    if (downloads) {
      await downloads.save({ filename, data: blob });
      return;
    }
  } catch (e) {
    if ((e as { code?: string })?.code === 'declined') return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
