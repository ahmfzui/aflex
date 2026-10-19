# AFlex — PDF & Image Toolkit

**YOUR FILES. YOUR RULES.**

AFlex is a set of 13 PDF and image tools that run entirely in the browser. Files are read into the open tab, processed with JavaScript/WebAssembly, and handed back as downloads. There is no backend, no upload endpoint, no database, no accounts and no analytics.

## Tools

| PDF | Image |
| --- | --- |
| Merge PDF · Split PDF · Reorder Pages · Delete Pages · Compress PDF · PDF to Images · Images to PDF · Rotate PDF | Convert Image · Compress Image · Resize Image · Rotate & Flip · Image Metadata |

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev          # http://localhost:5173
```

`npm run dev` and `npm run build` first copy PDF.js runtime assets (fonts, CMaps, WASM decoders) into `public/pdfjs/` so they are served from AFlex's own origin.

## Quality checks

```bash
npm run lint         # ESLint (typescript-eslint, react-hooks)
npm run typecheck    # tsc --noEmit
npm test             # Vitest unit tests (PDF ops, metadata stripping, validation, ranges)
npm run build        # type-check + production build into dist/
npm run check        # all of the above
```

Sample PDFs for manual testing (including a damaged, a fake and an encryption-flagged file) can be generated with `npm run fixtures` (written to `tests/fixtures/generated/`, git-ignored).

To test the production build with the same security headers Vercel sends (CSP etc.):

```bash
npm run build
npm run preview      # http://localhost:4173
```

## Deploy to Vercel

1. Push the repository to GitHub/GitLab/Bitbucket.
2. In Vercel, **Add New → Project** and import the repository.
3. Vercel detects Vite. `vercel.json` already sets the build command (`npm run build`), output directory (`dist`), SPA rewrites and security headers — no other settings or environment variables are needed.
4. Deploy. Every route (`/tools/merge-pdf`, `/privacy`, …) is served by `index.html`; static assets are cached immutably.

Or from the CLI: `npx vercel` (preview) and `npx vercel --prod`.

## Architecture

- **Vite + React 19 + TypeScript**, React Router for client-side routes. A static SPA — the simplest thing that deploys to Vercel with no server.
- **Processing libraries** (all run client-side):
  - [`pdf-lib`](https://pdf-lib.js.org/) — merge, split, reorder, delete, rotate, images→PDF, lossless rebuild. Runs in a **Web Worker** (`src/lib/pdf/pdfWorker.ts`) so large files don't freeze the page.
  - [`pdfjs-dist`](https://mozilla.github.io/pdf.js/) (≥ 6.2.108, which fixes advisory GHSA-hq66-cqwq-w95j affecting 5.6–6.2) — page thumbnails, PDF→images, rasterizing for compression.
  - Browser canvas codecs — image decode/encode, resizing, rotation. Output formats are **feature-detected**: AFlex only offers formats the current browser can actually encode.
  - [`exifr`](https://github.com/MikeKovarik/exifr) — decoding metadata fields; a custom byte-level parser (`src/lib/image/metadata.ts`) inventories and **losslessly strips** JPEG/PNG/WebP metadata without re-encoding pixels.
  - [`fflate`](https://github.com/101arrowz/fflate) — ZIP downloads.
- **Code layout**
  - `src/lib/tools.ts` — single tool registry (names, descriptions, formats, search keywords).
  - `src/lib/files.ts` — signature-based validation (magic bytes, not file names), limits, helpers.
  - `src/components/workspace/` — the shared workspace (`ToolShell`), drop zone, file list, page grid, progress, results, dialogs.
  - `src/hooks/useRunner.ts` — run lifecycle: truthful progress, cancellation, errors, object-URL cleanup.
  - `src/tools/` — one lazily-loaded component per tool.
  - `src/styles/` — design tokens and the "Phantom File Lab" visual system (plain CSS, no framework).
- **Privacy hardening**: `vercel.json` sends a Content-Security-Policy with `connect-src 'self'`, so the page's scripts can't make network requests to other origins (an extra safeguard — AFlex never sends files anywhere). Fonts are self-hosted (Fontsource); nothing is loaded from third-party CDNs. No cookies or storage are used.

## Known limitations

- **Compress PDF** offers two honest methods. *Lossless rebuild* often saves little or nothing. *Rasterize* turns each page into a JPEG — text becomes unselectable and links/forms/bookmarks are dropped; text-only PDFs usually get *bigger*. The UI states this and reports real results.
- **Encrypted / password-protected PDFs** are rejected with an explanation (pdf-lib cannot edit them; no password entry is offered).
- Merge/split/reorder/delete copy pages into a new document: page content, annotations and links on pages are kept, but **document-level bookmarks and interactive form fields may not carry over**. Rotate edits in place and keeps them.
- **Image inputs**: PNG, JPEG, WebP, GIF (first frame), BMP, AVIF — decoding depends on the browser. HEIC/TIFF are rejected with a message.
- **Image outputs**: PNG and JPEG everywhere; WebP and AVIF only where the browser can encode them (AVIF encoding is rare, so it's hidden when unsupported).
- Re-encoding image tools (convert, compress, resize, rotate) don't copy EXIF/ICC metadata into the output; colours of wide-gamut images may shift slightly.
- **Image Metadata** inspects and cleans JPEG, PNG and WebP. It removes the metadata blocks it can identify (EXIF incl. GPS, XMP, IPTC, comments, text chunks, trailing data such as motion-photo clips) and re-checks the output; it cannot remove information visible in the pixels.
- Everything runs in device memory. Limits: 300 MB per PDF (600 MB combined), 60 MB per image, ~100 MP per image; very large jobs may still exceed a phone's memory, in which case an error is shown.
