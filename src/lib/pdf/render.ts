/**
 * PDF.js wrapper: opening documents and rendering pages to canvases.
 * Loaded lazily (only tool pages import it) because PDF.js is large.
 */
import { getDocument, GlobalWorkerOptions, InvalidPDFException, PasswordException, type PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { UserFacingError } from '../files';

GlobalWorkerOptions.workerSrc = workerUrl;

// Fonts, CMaps and decoders are served from our own origin (copied at build time).
const ASSET_BASE = `${import.meta.env.BASE_URL}pdfjs/`;

export type { PDFDocumentProxy };

/** Release a document and its worker-side resources. */
export function closePdf(doc: PDFDocumentProxy): void {
  void doc.loadingTask.destroy().catch(() => undefined);
}

export async function openPdf(file: Blob): Promise<PDFDocumentProxy> {
  // PDF.js takes ownership of the bytes it is given, so hand it a private copy.
  const data = new Uint8Array(await file.arrayBuffer());
  const task = getDocument({
    data,
    cMapUrl: `${ASSET_BASE}cmaps/`,
    standardFontDataUrl: `${ASSET_BASE}standard_fonts/`,
    wasmUrl: `${ASSET_BASE}wasm/`,
    iccUrl: `${ASSET_BASE}iccs/`,
    enableXfa: false,
    // Refuse to decode absurdly large embedded images (decompression bombs).
    maxImageSize: 150_000_000,
    verbosity: 0,
  });
  try {
    return await task.promise;
  } catch (error) {
    await task.destroy().catch(() => undefined);
    if (error instanceof PasswordException) {
      throw new UserFacingError('This PDF is password-protected. AFlex can’t open protected PDFs — remove the password in the app that created it, then try again.');
    }
    if (error instanceof InvalidPDFException) {
      throw new UserFacingError('This PDF appears to be damaged or isn’t a valid PDF.');
    }
    throw new UserFacingError('This PDF couldn’t be opened. It may be damaged or use features the renderer doesn’t support.');
  }
}

export interface RenderOptions {
  /** Pixels per PDF point. 1 = 72 dpi. */
  scale?: number;
  /** Fit the rendered page into this CSS-pixel width instead of using `scale`. */
  fitWidth?: number;
  /** Hard cap on rendered pixels; the scale is reduced to respect it. */
  maxPixels?: number;
  /** Extra clockwise rotation on top of the page's own rotation. */
  extraRotation?: number;
  signal?: AbortSignal;
}

export interface RenderedPage {
  canvas: HTMLCanvasElement;
  /** Page size in PDF points, after rotation. */
  widthPt: number;
  heightPt: number;
  /** Scale actually used (may be lower than requested because of maxPixels). */
  scale: number;
}

export async function renderPage(doc: PDFDocumentProxy, pageNumber: number, options: RenderOptions = {}): Promise<RenderedPage> {
  const page = await doc.getPage(pageNumber);
  try {
    const rotation = (((page.rotate + (options.extraRotation ?? 0)) % 360) + 360) % 360;
    const base = page.getViewport({ scale: 1, rotation });
    let scale = options.fitWidth ? options.fitWidth / base.width : (options.scale ?? 1);
    const maxPixels = options.maxPixels ?? 40_000_000;
    const pixels = base.width * base.height * scale * scale;
    if (pixels > maxPixels) scale *= Math.sqrt(maxPixels / pixels);
    const viewport = page.getViewport({ scale, rotation });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const task = page.render({ canvas, viewport, background: '#ffffff' });
    const onAbort = () => task.cancel();
    options.signal?.addEventListener('abort', onAbort, { once: true });
    try {
      await task.promise;
    } finally {
      options.signal?.removeEventListener('abort', onAbort);
    }
    return { canvas, widthPt: base.width, heightPt: base.height, scale };
  } finally {
    page.cleanup();
  }
}
