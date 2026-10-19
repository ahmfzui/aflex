import { useEffect, useState } from 'react';
import { errorMessage, nextFrame } from '../lib/files';
import { closePdf, openPdf, renderPage, type PDFDocumentProxy } from '../lib/pdf/render';

export interface PdfDocumentState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  doc: PDFDocumentProxy | null;
  pageCount: number;
  /** Object URLs of page thumbnails, filled in progressively. */
  thumbs: (string | undefined)[];
  error: string | null;
}

const IDLE: PdfDocumentState = { status: 'idle', doc: null, pageCount: 0, thumbs: [], error: null };
const LOADING: PdfDocumentState = { ...IDLE, status: 'loading' };
const THUMB_WIDTH = 150;

/**
 * Open a PDF with PDF.js and render small thumbnails for every page in the
 * background. Everything (document, canvases, URLs) is released when the file
 * changes or the component unmounts.
 */
export function usePdfDocument(file: File | null): PdfDocumentState {
  // State is tagged with the file it belongs to, so a new file reads as "loading" immediately.
  const [tagged, setTagged] = useState<{ file: File | null; state: PdfDocumentState }>({ file: null, state: IDLE });

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let doc: PDFDocumentProxy | null = null;
    const urls: string[] = [];
    const setState = (next: PdfDocumentState | ((prev: PdfDocumentState) => PdfDocumentState)) =>
      setTagged((prev) => ({ file, state: typeof next === 'function' ? next(prev.file === file ? prev.state : LOADING) : next }));

    (async () => {
      try {
        doc = await openPdf(file);
      } catch (error) {
        if (!cancelled) setState({ ...IDLE, status: 'error', error: errorMessage(error, 'This PDF couldn’t be opened.') });
        return;
      }
      if (cancelled) {
        closePdf(doc);
        return;
      }
      const count = doc.numPages;
      const thumbs: (string | undefined)[] = new Array(count).fill(undefined);
      setState({ status: 'ready', doc, pageCount: count, thumbs: thumbs.slice(), error: null });

      const ratio = Math.min(2, window.devicePixelRatio || 1);
      let lastFlush = performance.now();
      for (let i = 0; i < count && !cancelled; i += 1) {
        try {
          const { canvas } = await renderPage(doc, i + 1, { fitWidth: THUMB_WIDTH * ratio, maxPixels: 400_000 });
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
          canvas.width = 0;
          canvas.height = 0;
          if (cancelled) break;
          if (blob) {
            const url = URL.createObjectURL(blob);
            urls.push(url);
            thumbs[i] = url;
          }
        } catch {
          // A page that fails to render keeps its placeholder; operations still work.
        }
        const now = performance.now();
        if (now - lastFlush > 120 || i === count - 1) {
          lastFlush = now;
          if (!cancelled) setState((prev) => (prev.doc === doc ? { ...prev, thumbs: thumbs.slice() } : prev));
          await nextFrame();
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const url of urls) URL.revokeObjectURL(url);
      if (doc) closePdf(doc);
    };
  }, [file]);

  if (!file) return IDLE;
  return tagged.file === file ? tagged.state : LOADING;
}
