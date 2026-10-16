import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PhotoList from './components/PhotoList';
import PosterPreview from './components/PosterPreview';
import TemplatePicker from './components/TemplatePicker';
import { disposeImage, loadImageFile, UploadError } from './poster/images';
import { downloadBlob, EXPORT_PRESETS, exportPoster } from './poster/export';
import { MAX_PHOTOS } from './poster/layouts';
import { BRANDS, getBrand, type BrandId } from './poster/brands';
import { FONT_LOAD_LIST, FONT_SETS, type FontSetId } from './poster/fonts';
import { buildMessage, DESCRIPTION_PRESETS, posterFilename, todayISO } from './poster/format';
import { defaultLogoFile } from './poster/defaultLogos';
import { copyText, isMobileDevice, shareFiles, whatsappLink } from './poster/share';
import SavedPicker from './components/SavedPicker';
import { forgetSaved, loadSaved, loadSavedBrandLogo, rememberSaved, saveBrandLogo, type SavedKind } from './poster/storage';
import type { LoadedImage, Photo, PosterDoc } from './poster/types';

interface Notice {
  id: number;
  kind: 'error' | 'warn' | 'ok';
  msg: string;
}

let uid = 0;
const nextId = (p: string) => `${p}${++uid}`;

const initial: PosterDoc = {
  template: 'photo-story',
  text: {
    headline: '',
    institution: '',
    location: '',
    audience: '',
    date: todayISO(),
    showDate: true,
    students: '',
    description: DESCRIPTION_PRESETS[0].text,
    showDescription: true,
  },
  brand: 'desk',
  fontSet: 'grotesk',
  colors: { ...BRANDS[0].colors },
  patternVisibility: 60,
  brandLogos: { desk: null, foundation: null },
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
  const [saved, setSaved] = useState<Record<SavedKind, string[]>>(() => ({
    headline: loadSaved('headline'),
    institution: loadSaved('institution'),
    location: loadSaved('location'),
    audience: loadSaved('audience'),
  }));
  const [messageOverride, setMessageOverride] = useState<string | null>(null);
  const [attachOriginals, setAttachOriginals] = useState(false);

  // Restore each brand's last uploaded logo, falling back to the bundled default in src/assets/logos.
  useEffect(() => {
    (async () => {
      for (const b of BRANDS) {
        const file = (await loadSavedBrandLogo(b.id)) ?? (await defaultLogoFile(b.id));
        if (!file) continue;
        try {
          const { image } = await loadImageFile(file, 'logo');
          setDoc((d) => (d.brandLogos[b.id] ? d : { ...d, brandLogos: { ...d.brandLogos, [b.id]: image } }));
        } catch {
          /* a stale saved logo is ignored */
        }
      }
    })();
  }, []);

  useEffect(() => {
    Promise.all(FONT_LOAD_LIST.map((f) => document.fonts.load(f)))
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

  const setBrandLogo = async (brand: BrandId, file: File | undefined) => {
    if (!file) return;
    try {
      const { image, warning } = await loadImageFile(file, 'logo');
      if (warning) notify('warn', warning);
      setDoc((d) => {
        disposeImage(d.brandLogos[brand]);
        return { ...d, brandLogos: { ...d.brandLogos, [brand]: image } };
      });
      void saveBrandLogo(brand, file);
    } catch (e) {
      notify('error', e instanceof UploadError ? e.message : 'That logo couldn’t be loaded.');
    }
  };

  const setInstitutionLogo = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { image, warning } = await loadImageFile(file, 'logo');
      if (warning) notify('warn', warning);
      setDoc((d) => {
        disposeImage(d.institutionLogo);
        return { ...d, institutionLogo: image };
      });
    } catch (e) {
      notify('error', e instanceof UploadError ? e.message : 'That logo couldn’t be loaded.');
    }
  };

  const clearBrandLogo = (brand: BrandId) => {
    setDoc((d) => {
      disposeImage(d.brandLogos[brand]);
      return { ...d, brandLogos: { ...d.brandLogos, [brand]: null } };
    });
    void saveBrandLogo(brand, null);
  };

  const clearInstitutionLogo = () =>
    setDoc((d) => {
      disposeImage(d.institutionLogo);
      return { ...d, institutionLogo: null };
    });

  const selectBrand = (brand: BrandId) => patch({ brand, colors: { ...getBrand(brand).colors } });

  /** Saves the current value of one field (or all of them) so it can be picked again later. */
  const remember = (kind?: SavedKind) => {
    const kinds: SavedKind[] = kind ? [kind] : ['headline', 'institution', 'location', 'audience'];
    setSaved((s) => {
      const next = { ...s };
      for (const k of kinds) next[k] = rememberSaved(k, s[k], docRef.current.text[k === 'headline' ? 'headline' : k]);
      return next;
    });
  };
  const forget = (kind: SavedKind, value: string) => setSaved((s) => ({ ...s, [kind]: forgetSaved(kind, s[kind], value) }));
  const picker = (kind: SavedKind) => (
    <SavedPicker kind={kind === 'headline' ? 'headlines' : kind === 'institution' ? 'institutions' : kind === 'location' ? 'cities' : 'audiences'} items={saved[kind]} current={doc.text[kind]} onPick={(v) => patch({ text: { ...doc.text, [kind]: v } })} onForget={(v) => forget(kind, v)} />
  );

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
    remember();
    try {
      await document.fonts.ready;
      const blob = await exportPoster(docRef.current, preset);
      downloadBlob(blob, posterFilename(docRef.current.text, preset.width));
      const missing = (['headline', 'institution', 'location'] as const).filter((k) => !docRef.current.text[k].trim());
      if (missing.length) notify('warn', `Exported without: ${missing.join(', ')}. Fill ${missing.length > 1 ? 'them' : 'it'} in and export again if that wasn’t intended.`);
      notify('ok', `Exported ${preset.width} × ${preset.height} PNG (${(blob.size / 1048576).toFixed(1)} MB).`);
    } catch (e) {
      notify('error', `Export failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const message = messageOverride ?? buildMessage(doc);
  const messageRef = useRef(message);
  messageRef.current = message;

  const doCopy = async () => {
    remember();
    const ok = await copyText(message);
    notify(ok ? 'ok' : 'error', ok ? 'Message copied. Paste it into WhatsApp.' : 'Couldn’t copy automatically. Select the message and copy it by hand.');
  };

  const mobile = useMemo(() => isMobileDevice(), []);

  const doShare = async () => {
    remember();
    setBusy(true);
    // Copy the caption first, while the click still counts as a user gesture. Whatever happens next
    // (a share dialog that drops the text, a refused share), the message is already on the clipboard.
    const copied = await copyText(messageRef.current);
    try {
      await document.fonts.ready;
      const d = docRef.current;
      const preset = EXPORT_PRESETS[0];
      const blob = await exportPoster(d, preset);
      const filename = posterFilename(d.text, preset.width);
      if (mobile) {
        const files = [new File([blob], filename, { type: 'image/png' }), ...(attachOriginals ? d.photos.map((p) => p.image.file) : [])];
        const result = await shareFiles(files, messageRef.current);
        if (result === 'cancelled') return;
        if (result === 'shared') {
          notify('ok', copied ? 'Shared. The message is also copied: paste it as the caption if WhatsApp left it out.' : 'Shared.');
          return;
        }
      }
      await downloadBlob(blob, filename);
      notify(
        copied ? 'ok' : 'warn',
        copied
          ? `Message copied and poster saved as ${filename}. In WhatsApp, attach the poster, then paste the message as the caption.`
          : `Poster saved as ${filename}. Copy the message from the box below and paste it as the caption.`,
      );
    } catch (e) {
      notify('error', `Share failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const text = (k: 'headline' | 'institution' | 'location' | 'audience') => ({
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
            <summary>Brand</summary>
            <div className="brands" role="radiogroup" aria-label="Brand">
              {BRANDS.map((b) => (
                <button key={b.id} type="button" role="radio" aria-checked={doc.brand === b.id} className={`brand ${doc.brand === b.id ? 'on' : ''}`} onClick={() => selectBrand(b.id)} data-testid={`brand-${b.id}`}>
                  <span className="swatch" style={{ background: `linear-gradient(135deg, ${b.colors.navy} 55%, ${b.colors.orange} 55%)` }} />
                  {b.name}
                </button>
              ))}
            </div>
            <LogoField
              label={`${getBrand(doc.brand).name} logo`}
              image={doc.brandLogos[doc.brand]}
              fallback="Using placeholder wordmark"
              testid="brand-logo-input"
              onFile={(f) => setBrandLogo(doc.brand, f)}
              onClear={() => clearBrandLogo(doc.brand)}
            />
            <LogoField
              label="Institution logo"
              image={doc.institutionLogo}
              fallback="None uploaded"
              testid="inst-logo-input"
              onFile={setInstitutionLogo}
              onClear={clearInstitutionLogo}
            />
          </details>

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
            <summary>Poster text</summary>
            <label>
              <span>Headline <small>(lines alternate between the two brand colours)</small></span>
              <textarea rows={2} maxLength={80} placeholder="e.g. Career Awareness Program" {...text('headline')} onBlur={() => remember('headline')} data-testid="headline" />
            </label>
            {picker('headline')}
            <label>
              <span>Institution name <small>(shown in capitals)</small></span>
              <input type="text" maxLength={80} placeholder="e.g. GHSS Kuruchi" {...text('institution')} onBlur={() => remember('institution')} data-testid="institution" />
            </label>
            {picker('institution')}
            <label>
              <span>Location <small>(shown in capitals)</small></span>
              <input type="text" maxLength={60} placeholder="e.g. Coimbatore" {...text('location')} onBlur={() => remember('location')} data-testid="location" />
            </label>
            {picker('location')}
            <label>
              <span>Audience <small>(optional)</small></span>
              <input type="text" maxLength={40} {...text('audience')} placeholder="e.g. Grade 10" onBlur={() => remember('audience')} data-testid="audience" />
            </label>
            {picker('audience')}
            <div className="two">
              <label>
                <span>Date</span>
                <input type="date" value={doc.text.date} onChange={(e) => patch({ text: { ...doc.text, date: e.target.value } })} data-testid="date" />
              </label>
              <label>
                <span>Students <small>(optional)</small></span>
                <input type="number" inputMode="numeric" min={0} max={100000} value={doc.text.students} onChange={(e) => patch({ text: { ...doc.text, students: e.target.value.replace(/[^\d]/g, '').slice(0, 6) } })} placeholder="e.g. 120" data-testid="students" />
              </label>
            </div>
            <div className="inline">
              <label className="check">
                <input type="checkbox" checked={doc.text.showDate} onChange={(e) => patch({ text: { ...doc.text, showDate: e.target.checked } })} data-testid="show-date" /> Show date on poster
              </label>
              <button type="button" className="btn small" onClick={() => patch({ text: { ...doc.text, date: todayISO() } })} data-testid="date-today">
                Today
              </button>
            </div>
          </details>

          <details open>
            <summary>Program description</summary>
            <label>
              <span>Start from a template</span>
              <select
                value=""
                onChange={(e) => {
                  const p = DESCRIPTION_PRESETS[+e.target.value];
                  if (p) patch({ text: { ...doc.text, description: p.text } });
                }}
                data-testid="description-preset"
              >
                <option value="">Choose a description…</option>
                {DESCRIPTION_PRESETS.map((p, i) => (
                  <option key={p.label} value={i}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Description <small>(on the poster and in the share message)</small></span>
              <textarea rows={4} maxLength={240} value={doc.text.description} onChange={(e) => patch({ text: { ...doc.text, description: e.target.value } })} data-testid="description" />
            </label>
            <label className="check">
              <input type="checkbox" checked={doc.text.showDescription} onChange={(e) => patch({ text: { ...doc.text, showDescription: e.target.checked } })} data-testid="show-description" /> Show description on the poster
            </label>
            <p className="note">
              Shown in sentence case, two lines at most, so keep it under about 130 characters. Placeholders <code>{'{institution}'}</code> <code>{'{location}'}</code> <code>{'{date}'}</code> <code>{'{students}'}</code> <code>{'{audience}'}</code> are filled in from the fields above.
            </p>
          </details>

          <details>
            <summary>Style &amp; colours</summary>
            <div className="colors">
              <label>
                <span>Primary</span> <input type="color" {...color('navy')} data-testid="color-navy" />
              </label>
              <label>
                <span>Accent</span> <input type="color" {...color('orange')} data-testid="color-orange" />
              </label>
              <label>
                <span>Background</span> <input type="color" {...color('white')} data-testid="color-white" />
              </label>
              <button type="button" className="btn small" onClick={() => patch({ colors: { ...getBrand(doc.brand).colors } })}>
                Reset
              </button>
            </div>
            <label>
              <span>Font style</span>
              <select value={doc.fontSet} onChange={(e) => patch({ fontSet: e.target.value as FontSetId })} data-testid="fontset">
                {FONT_SETS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Background pattern <output>{doc.patternVisibility}%</output></span>
              <input type="range" min={0} max={100} value={doc.patternVisibility} onChange={(e) => patch({ patternVisibility: +e.target.value })} data-testid="pattern" />
            </label>
          </details>

          <details open>
            <summary>Export</summary>
            <label>
              <span>Size</span>
              <select value={presetId} onChange={(e) => setPresetId(e.target.value)} data-testid="preset">
                {EXPORT_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn primary wide" onClick={doExport} disabled={busy} data-testid="export">
              {busy ? 'Working…' : `Download PNG (${preset.width}×${preset.height})`}
            </button>
          </details>

          <details open>
            <summary>Share on WhatsApp</summary>
            <label>
              <span>Message <small>(updates from your fields; edit freely)</small></span>
              <textarea rows={7} value={message} onChange={(e) => setMessageOverride(e.target.value)} data-testid="message" />
            </label>
            <div className="inline">
              <button type="button" className="btn small" onClick={doCopy} data-testid="copy-message">
                Copy message
              </button>
              {messageOverride !== null && (
                <button type="button" className="btn small" onClick={() => setMessageOverride(null)} data-testid="reset-message">
                  Reset to auto
                </button>
              )}
            </div>
            {mobile && (
              <label className="check">
                <input type="checkbox" checked={attachOriginals} onChange={(e) => setAttachOriginals(e.target.checked)} data-testid="attach-originals" /> Also attach the original photos
              </label>
            )}
            <button type="button" className="btn wa wide" onClick={doShare} disabled={busy} data-testid="share">
              {mobile ? 'Share poster + message' : 'Copy message + save poster'}
            </button>
            <a className="wa-link" href={whatsappLink(message)} target="_blank" rel="noopener noreferrer" data-testid="wa-link">
              Open WhatsApp with the message only
            </a>
            <p className="note">
              {mobile
                ? 'Opens the share sheet with the poster and message together. The message is also copied, in case WhatsApp leaves the caption out.'
                : 'Copies the message and saves the poster. In WhatsApp Web or the desktop app, attach the saved poster and paste the message as its caption.'}
            </p>
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
