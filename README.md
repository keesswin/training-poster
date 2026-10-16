# Leaders Desk Poster Generator

A browser-based generator for **1080 × 1350 (4:5) Instagram event posters**. Upload the Leaders Desk logo, the institution logo and 1–6 event photographs, pick one of three templates, and export a PNG. React + TypeScript + Vite, no backend; images never leave the browser.

```bash
npm install
npm run dev          # editor at http://localhost:5173
npm run build        # typecheck + production build
npm test             # unit tests (layout, crop and text-fit invariants)
npm run test:e2e     # builds, then drives real Chromium through upload → edit → export
```

`test:e2e` uses `playwright-core` with the Chromium at `/opt/pw-browsers/chromium` (override with `CHROMIUM=/path/to/chrome`). It generates synthetic fixtures with `python3 e2e/make_fixtures.py` (Pillow) and writes screenshots and exported PNGs to `e2e/out/`.

## Templates

| Template | Composition |
| --- | --- |
| **A. Hero Editorial** | Headline on top, wide hero, one row of supporting photos, compact footer |
| **B. Photo Story** (default) | Photo first: hero plus a narrow vertical strip, headline underneath |
| **C. Event Highlights** | Full navy canvas: white header card with both logos, large headline, rounded hero and gallery, school identity set on the navy |

Each works with 1–6 photos (0–5 supporting). The hero is chosen with ★; the rest follow list order (↑/↓ or drag to reorder). Drag a photo on the poster, or use the zoom/horizontal/vertical sliders, to adjust the crop.

## How it works

- `src/poster/render.ts` is the single Canvas 2D renderer. The live preview and the PNG export call the same `renderPoster()`, so the export is real artwork, not a screenshot. Editor chrome (selection outline, drag cursor) lives in the DOM and is never drawn into the export.
- `src/poster/layouts.ts` holds each template as pure geometry in a 1080×1350 design space (slots, headline box, footer, bands). Unit tests assert that for every template and photo count all boxes stay on canvas and never overlap.
- `src/poster/crop.ts` does cover-fit crops: the source rectangle always has the frame's aspect ratio, so photos are never stretched. Photos and logos are decoded, never re-encoded; EXIF orientation is applied.
- `src/poster/text.ts` fits the headline by shrinking the font until it wraps inside its box (max 3 lines).
- `src/poster/export.ts` lists export presets (1080×1350 and 2160×2700). To add a size with the same 4:5 ratio, add one entry to `EXPORT_PRESETS`. A different aspect ratio needs its own template geometry.

## Uploads

JPG, PNG, WebP (and GIF/AVIF/BMP) for photos up to 40 MB; logos also accept SVG, up to 12 MB. Wrong types, empty or corrupt files, SVG used as a photo, and a 7th photo each produce a dismissible message instead of an error. Very small images get a quality warning.

## Notes

- Until the real Leaders Desk logo is uploaded, the header shows a text wordmark placeholder. Upload the logo and it is drawn untouched at its own aspect ratio.
- Default text is placeholder copy ("Your School Name", "City, State"). The audience/date line only appears if filled in.
- Brand defaults: navy `#084A91`, orange `#F07B00`, white `#FFFFFF`; all editable, plus pattern visibility.
