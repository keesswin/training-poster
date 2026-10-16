import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PhotoList from './components/PhotoList';
import PosterPreview from './components/PosterPreview';
import TemplatePicker from './components/TemplatePicker';
import { disposeImage, loadImageFile, UploadError } from './poster/images';
import { downloadBlob, EXPORT_PRESETS, exportPoster } from './poster/export';
import { MAX_PHOTOS } from './poster/layouts';
import { BRAND, type LoadedImage, type Photo, type PosterDoc } from './poster/types';

interface Notice {
  id: number;
  kind: 'error' | 'warn' | 'ok';
  msg: string;
}

let uid = 0;
const nextId = (p: string) => `${p}${++uid}`;

const initial: PosterDoc = {
  template: 'hero-editorial',
  text: {
    headline: 'Career Awareness Program',
    emphasis: 'Awareness',
    institution: 'Your School Name',
    location: 'City, State',
    detail: '',
  },
  colors: { navy: BRAND.navy, orange: BRAND.orange, white: BRAND.white },
  patternVisibility: 60,
  leadersDeskLogo: null,
  institutionLogo: null,
  photos: [],
  heroId: null,
};

export default function App() {
  const [doc, setDoc] = useState<PosterDoc>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [presetId, setPresetId] = useState(EXPORT_PRESETS[0].id);
  const [busy, setBusy] = useState(false);
  const [fontsTick, setFontsTick] = useState(0);
  const docRef = useRef(doc);
  docRef.current = doc;

  useEffect(() => {
    Promise.all(['500', '700', '800', '900'].map((w) => document.fonts.load(`${w} 40px Montserrat`)))
      .then(() => document.fonts.ready)
      .then(() => setFontsTick((t) => t + 1))
      .catch(() => setFontsTick((t) => t + 1));
  }, []);

  const notify = useCallback((kind: Notice['kind'], msg: string) => {
    const id = ++uid;
    setNotices((n) => [...n.slice(-3), { id, kind, msg }]);
    setTimeout(() => setNotices((n) => n.filter((x) => x.id !== id)), kind === 'ok' ? 4000 : 9000);
  }, []);

  const patch = (p: Partial<PosterDoc>) => setDoc((d) => ({ ...d, ...p }));

  const addPhotos = async (files: File[]) => {
    const room = MAX_PHOTOS - docRef.current.photos.length;
    if (files.length > room) notify('warn', `Only ${MAX_PHOTOS} photos fit on a poster. ${files.length - Math.max(room, 0)} file(s) were skipped.`);
    const added: Photo[] = [];
    for (const file of files.slice(0, Math.max(room, 0))) {
      try {
        const { image, warning } = await loadImageFile(file, 'photo');
        if (warning) notify('warn', warning);
        added.push({ id: nextId('p'), image, zoom: 1, fx: 0.5, fy: 0.4 });
      } catch (e) {
        notify('error', e instanceof UploadError ? e.message : `“${file.name}” couldn’t be loaded.`);
      }
    }
    if (!added.length) return;
    setDoc((d) => ({ ...d, photos: [...d.photos, ...added], heroId: d.heroId ?? added[0].id }));
    setSelectedId((s) => s ?? added[0].id);
  };

  const setLogo = async (key: 'leadersDeskLogo' | 'institutionLogo', file: File | undefined) => {
    if (!file) return;
    try {
      const { image, warning } = await loadImageFile(file, 'logo');
      if (warning) notify('warn', warning);
      setDoc((d) => {
        disposeImage(d[key]);
        return { ...d, [key]: image };
      });
    } catch (e) {
      notify('error', e instanceof UploadError ? e.message : 'That logo couldn’t be loaded.');
    }
  };

  const clearLogo = (key: 'leadersDeskLogo' | 'institutionLogo') =>
    setDoc((d) => {
      disposeImage(d[key] as LoadedImage | null);
      return { ...d, [key]: null };
    });

  const removePhoto = (id: string) => {
    setDoc((d) => {
      const gone = d.photos.find((p) => p.id === id);
      if (gone) disposeImage(gone.image);
      const photos = d.photos.filter((p) => p.id !== id);
      return { ...d, photos, heroId: d.heroId === id ? (photos[0]?.id ?? null) : d.heroId };
    });
    setSelectedId((s) => (s === id ? null : s));
  };

  const movePhoto = (id: string, dir: -1 | 1) =>
    setDoc((d) => {
      const i = d.photos.findIndex((p) => p.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.photos.length) return d;
      const photos = [...d.photos];
      [photos[i], photos[j]] = [photos[j], photos[i]];
      return { ...d, photos };
    });

  const reorder = (fromId: string, toId: string) =>
    setDoc((d) => {
      const from = d.photos.findIndex((p) => p.id === fromId);
      const to = d.photos.findIndex((p) => p.id === toId);
      if (from < 0 || to < 0 || from === to) return d;
      const photos = [...d.photos];
      const [m] = photos.splice(from, 1);
      photos.splice(to, 0, m);
      return { ...d, photos };
    });

  const updatePhoto = useCallback((id: string, p: Partial<Pick<Photo, 'zoom' | 'fx' | 'fy'>>) => {
    setDoc((d) => ({ ...d, photos: d.photos.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  }, []);

  const onCrop = useCallback((id: string, fx: number, fy: number) => updatePhoto(id, { fx, fy }), [updatePhoto]);

  const doExport = async () => {
    const preset = EXPORT_PRESETS.find((p) => p.id === presetId) ?? EXPORT_PRESETS[0];
    setBusy(true);
    try {
      await document.fonts.ready;
      const blob = await exportPoster(docRef.current, preset);
      downloadBlob(blob, `leaders-desk-poster-${preset.width}x${preset.height}.png`);
      notify('ok', `Exported ${preset.width} × ${preset.height} PNG (${(blob.size / 1048576).toFixed(1)} MB).`);
    } catch (e) {
      notify('error', `Export failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const text = (k: keyof PosterDoc['text']) => ({
    value: doc.text[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => patch({ text: { ...doc.text, [k]: e.target.value } }),
  });
  const color = (k: keyof PosterDoc['colors']) => ({
    value: doc.colors[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => patch({ colors: { ...doc.colors, [k]: e.target.value.toUpperCase() } }),
  });

  const preset = useMemo(() => EXPORT_PRESETS.find((p) => p.id === presetId) ?? EXPORT_PRESETS[0], [presetId]);

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          Leaders <b>Desk</b> <span>Poster Generator</span>
        </h1>
        <button type="button" className="btn primary" onClick={doExport} disabled={busy} data-testid="export-top">
          {busy ? 'Exporting…' : 'Export PNG'}
        </button>
      </header>

      <div className="notices" aria-live="polite">
        {notices.map((n) => (
          <div key={n.id} className={`notice ${n.kind}`} role={n.kind === 'error' ? 'alert' : 'status'} data-testid={`notice-${n.kind}`}>
            <span>{n.msg}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setNotices((l) => l.filter((x) => x.id !== n.id))}>
              ✕
            </button>
          </div>
        ))}
      </div>

      <main className="layout">
        <section className="stage">
          <PosterPreview doc={doc} selectedId={selectedId} fontsTick={fontsTick} onSelect={setSelectedId} onCrop={onCrop} />
        </section>

        <aside className="panel">
          <details open>
            <summary>Template</summary>
            <TemplatePicker value={doc.template} onChange={(template) => patch({ template })} />
          </details>

          <details open>
            <summary>Photos</summary>
            <PhotoList
              photos={doc.photos}
              heroId={doc.heroId}
              selectedId={selectedId}
              onAdd={addPhotos}
              onSelect={setSelectedId}
              onHero={(id) => patch({ heroId: id })}
              onMove={movePhoto}
              onReorder={reorder}
              onRemove={removePhoto}
              onUpdate={updatePhoto}
            />
          </details>

          <details open>
            <summary>Text</summary>
            <label>
              Headline
              <textarea rows={2} maxLength={80} {...text('headline')} data-testid="headline" />
            </label>
            <label>
              Orange emphasis words
              <input type="text" {...text('emphasis')} placeholder="e.g. Awareness" data-testid="emphasis" />
            </label>
            <label>
              Institution name
              <input type="text" maxLength={80} {...text('institution')} data-testid="institution" />
            </label>
            <label>
              Location
              <input type="text" maxLength={60} {...text('location')} data-testid="location" />
            </label>
            <label>
              Audience or date <small>(optional)</small>
              <input type="text" maxLength={40} {...text('detail')} placeholder="e.g. Grade 10 · 12 Oct 2026" data-testid="detail" />
            </label>
          </details>

          <details open>
            <summary>Logos</summary>
            <LogoField
              label="Leaders Desk logo"
              image={doc.leadersDeskLogo}
              fallback="Using placeholder wordmark"
              testid="ld-logo-input"
              onFile={(f) => setLogo('leadersDeskLogo', f)}
              onClear={() => clearLogo('leadersDeskLogo')}
            />
            <LogoField
              label="Institution logo"
              image={doc.institutionLogo}
              fallback="None uploaded"
              testid="inst-logo-input"
              onFile={(f) => setLogo('institutionLogo', f)}
              onClear={() => clearLogo('institutionLogo')}
            />
          </details>

          <details>
            <summary>Brand &amp; background</summary>
            <div className="colors">
              <label>
                Navy <input type="color" {...color('navy')} data-testid="color-navy" />
              </label>
              <label>
                Orange <input type="color" {...color('orange')} data-testid="color-orange" />
              </label>
              <label>
                White <input type="color" {...color('white')} data-testid="color-white" />
              </label>
              <button type="button" className="btn small" onClick={() => patch({ colors: initial.colors })}>
                Reset
              </button>
            </div>
            <label>
              Background pattern <output>{doc.patternVisibility}%</output>
              <input type="range" min={0} max={100} value={doc.patternVisibility} onChange={(e) => patch({ patternVisibility: +e.target.value })} data-testid="pattern" />
            </label>
          </details>

          <details open>
            <summary>Export</summary>
            <label>
              Size
              <select value={presetId} onChange={(e) => setPresetId(e.target.value)} data-testid="preset">
                {EXPORT_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn primary wide" onClick={doExport} disabled={busy} data-testid="export">
              {busy ? 'Exporting…' : `Download PNG (${preset.width}×${preset.height})`}
            </button>
          </details>
        </aside>
      </main>
    </div>
  );
}

function LogoField(props: {
  label: string;
  image: LoadedImage | null;
  fallback: string;
  testid: string;
  onFile: (f: File | undefined) => void;
  onClear: () => void;
}) {
  return (
    <div className="logo-field">
      <div className="logo-prev">{props.image ? <img src={props.image.url} alt={props.label} /> : <span>{props.fallback}</span>}</div>
      <div className="logo-actions">
        <strong>{props.label}</strong>
        <label className="btn small">
          {props.image ? 'Replace' : 'Upload'}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden data-testid={props.testid} onChange={(e) => { props.onFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {props.image && (
          <button type="button" className="btn small" onClick={props.onClear}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
