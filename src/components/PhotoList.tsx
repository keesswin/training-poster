import { useRef, useState } from 'react';
import { MAX_PHOTOS } from '../poster/layouts';
import { MAX_ZOOM, MIN_ZOOM } from '../poster/crop';
import type { Photo } from '../poster/types';

interface Props {
  photos: Photo[];
  heroId: string | null;
  selectedId: string | null;
  onAdd: (files: File[]) => void;
  onSelect: (id: string) => void;
  onHero: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onReorder: (fromId: string, toId: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Pick<Photo, 'zoom' | 'fx' | 'fy'>>) => void;
}

export default function PhotoList(p: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const sel = p.photos.find((x) => x.id === p.selectedId) ?? null;
  const full = p.photos.length >= MAX_PHOTOS;

  return (
    <>
      <div
        className={`drop ${over ? 'over' : ''} ${full ? 'disabled' : ''}`}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setOver(true);
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setOver(false);
          p.onAdd([...e.dataTransfer.files]);
        }}
      >
        <button type="button" className="btn primary" disabled={full} onClick={() => input.current?.click()} data-testid="add-photos">
          {full ? 'Photo limit reached' : 'Add photos'}
        </button>
        <span>
          {p.photos.length}/{MAX_PHOTOS} · JPG, PNG or WebP · drop files here
        </span>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          data-testid="photo-input"
          onChange={(e) => {
            p.onAdd([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
      </div>

      {p.photos.length > 0 && (
        <ul className="photos" data-testid="photo-list">
          {p.photos.map((ph, i) => {
            const hero = ph.id === p.heroId;
            return (
              <li
                key={ph.id}
                draggable
                className={`${ph.id === p.selectedId ? 'sel' : ''} ${dragId === ph.id ? 'dragging' : ''}`}
                data-testid="photo-item"
                data-hero={hero}
                onDragStart={() => setDragId(ph.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => dragId && e.preventDefault()}
                onDrop={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  p.onReorder(dragId, ph.id);
                  setDragId(null);
                }}
              >
                <button type="button" className="thumbbtn" onClick={() => p.onSelect(ph.id)} aria-label={`Select ${ph.image.name}`}>
                  <img src={ph.image.url} alt="" draggable={false} />
                  {hero && <em>HERO</em>}
                </button>
                <span className="name" title={ph.image.name}>
                  {ph.image.name}
                </span>
                <div className="row-actions">
                  <button type="button" className={`icon ${hero ? 'on' : ''}`} title="Use as hero photo" aria-label={`Make ${ph.image.name} the hero`} aria-pressed={hero} onClick={() => p.onHero(ph.id)} data-testid="make-hero">
                    ★
                  </button>
                  <button type="button" className="icon" title="Move up" aria-label="Move up" disabled={i === 0} onClick={() => p.onMove(ph.id, -1)} data-testid="move-up">
                    ↑
                  </button>
                  <button type="button" className="icon" title="Move down" aria-label="Move down" disabled={i === p.photos.length - 1} onClick={() => p.onMove(ph.id, 1)} data-testid="move-down">
                    ↓
                  </button>
                  <button type="button" className="icon danger" title="Remove" aria-label={`Remove ${ph.image.name}`} onClick={() => p.onRemove(ph.id)} data-testid="remove-photo">
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {sel && (
        <fieldset className="crop" data-testid="crop-panel">
          <legend>Crop · {sel.image.name}</legend>
          <label>
            Zoom <output>{sel.zoom.toFixed(2)}×</output>
            <input type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={0.01} value={sel.zoom} onChange={(e) => p.onUpdate(sel.id, { zoom: +e.target.value })} data-testid="zoom" />
          </label>
          <label>
            Horizontal
            <input type="range" min={0} max={1} step={0.005} value={sel.fx} onChange={(e) => p.onUpdate(sel.id, { fx: +e.target.value })} data-testid="pan-x" />
          </label>
          <label>
            Vertical
            <input type="range" min={0} max={1} step={0.005} value={sel.fy} onChange={(e) => p.onUpdate(sel.id, { fy: +e.target.value })} data-testid="pan-y" />
          </label>
          <button type="button" className="btn small" onClick={() => p.onUpdate(sel.id, { zoom: 1, fx: 0.5, fy: 0.4 })}>
            Reset crop
          </button>
        </fieldset>
      )}
    </>
  );
}
