import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { panCrop } from '../poster/crop';
import { withSampleText } from '../poster/format';
import { getGeometry, orderedPhotos, renderPoster } from '../poster/render';
import { DESIGN_H, DESIGN_W, type PosterDoc } from '../poster/types';

interface Props {
  doc: PosterDoc;
  selectedId: string | null;
  fontsTick: number;
  onSelect: (id: string) => void;
  onCrop: (id: string, fx: number, fy: number) => void;
}

/** Live preview: the same renderer as export, drawn at screen size, with editor-only overlays in the DOM. */
export default function PosterPreview({ doc, selectedId, fontsTick, onSelect, onCrop }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cssW, setCssW] = useState(0);
  const drag = useRef<{ id: string; x: number; y: number; slotW: number; slotH: number; k: number } | null>(null);
  const docRef = useRef(doc);
  docRef.current = doc;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCssW(el.clientWidth));
    ro.observe(el);
    setCssW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Pinch-zoom level of the page (where the browser reports it), so a zoomed-in preview is redrawn sharper.
  const [pageZoom, setPageZoom] = useState(() => window.visualViewport?.scale ?? 1);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let t = 0;
    const onResize = () => {
      clearTimeout(t);
      t = window.setTimeout(() => setPageZoom(Math.round(vv.scale * 4) / 4), 150);
    };
    vv.addEventListener('resize', onResize);
    return () => {
      clearTimeout(t);
      vv.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cssW) return;
    // Draw well above screen resolution (2x, more when pinch-zoomed), up to the 2160px export size,
    // so zooming into the preview on a phone shows real photo detail, not enlarged screen pixels.
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const targetW = Math.min(2160, Math.max(1080, cssW * dpr * Math.max(2, pageZoom)));
    const scale = targetW / DESIGN_W;
    canvas.width = Math.round(DESIGN_W * scale);
    canvas.height = Math.round(DESIGN_H * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const id = requestAnimationFrame(() => renderPoster(ctx, withSampleText(doc), scale, { placeholders: true }));
    return () => cancelAnimationFrame(id);
  }, [doc, cssW, fontsTick, pageZoom]);

  const geo = getGeometry(doc);
  const photos = orderedPhotos(doc);
  const selIdx = photos.findIndex((p) => p.id === selectedId);
  const sel = selIdx >= 0 ? geo.slots[selIdx] : null;

  const toDesign = (e: React.PointerEvent) => {
    const r = wrapRef.current!.getBoundingClientRect();
    const k = DESIGN_W / r.width;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, k };
  };

  const onDown = (e: React.PointerEvent) => {
    const p = toDesign(e);
    const idx = geo.slots.findIndex((s) => p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h);
    const photo = photos[idx];
    if (!photo) return;
    onSelect(photo.id);
    drag.current = { id: photo.id, x: e.clientX, y: e.clientY, slotW: geo.slots[idx].w, slotH: geo.slots[idx].h, k: p.k };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const photo = docRef.current.photos.find((p) => p.id === d.id);
    if (!photo) return;
    const dx = (e.clientX - d.x) * d.k;
    const dy = (e.clientY - d.y) * d.k;
    d.x = e.clientX;
    d.y = e.clientY;
    const next = panCrop(
      { imageW: photo.image.width, imageH: photo.image.height, frameW: d.slotW, frameH: d.slotH, zoom: photo.zoom, fx: photo.fx, fy: photo.fy },
      dx,
      dy,
    );
    onCrop(photo.id, next.fx, next.fy);
  };

  const pct = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <div className="preview-frame">
      <div className="poster-wrap" ref={wrapRef} data-testid="poster-wrap">
        <canvas ref={canvasRef} className="poster-canvas" data-testid="poster-canvas" aria-label="Poster preview" />
        <div className="poster-overlay" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
          {sel && (
            <div
              className="sel-box"
              style={{ left: pct(sel.x, DESIGN_W), top: pct(sel.y, DESIGN_H), width: pct(sel.w, DESIGN_W), height: pct(sel.h, DESIGN_H) }}
            />
          )}
        </div>
      </div>
      <p className="hint">Drag a photo on the poster to reposition its crop. Selection outline isn’t exported.</p>
    </div>
  );
}
