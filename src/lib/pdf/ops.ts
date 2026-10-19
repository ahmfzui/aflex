/**
 * Pure PDF structure operations built on pdf-lib. No DOM access, so these run
 * in a Web Worker (see pdfWorker.ts) and in unit tests under Node.
 *
 * Every function returns new bytes; inputs are never modified.
 */
import { PDFDocument, degrees, type PDFPage } from 'pdf-lib';

async function load(bytes: Uint8Array): Promise<PDFDocument> {
  // pdf-lib throws EncryptedPDFError for encrypted files unless told otherwise;
  // we let it throw so the user gets a clear message.
  return PDFDocument.load(bytes, { updateMetadata: false });
}

function stamp(doc: PDFDocument, source?: PDFDocument) {
  if (source) {
    const title = source.getTitle();
    const author = source.getAuthor();
    if (title) doc.setTitle(title);
    if (author) doc.setAuthor(author);
  }
  doc.setProducer('AFlex (pdf-lib)');
  doc.setModificationDate(new Date());
}

export async function pageCount(bytes: Uint8Array): Promise<number> {
  const doc = await load(bytes);
  return doc.getPageCount();
}

export async function merge(files: Uint8Array[]): Promise<Uint8Array> {
  if (files.length === 0) throw new Error('No files to merge');
  const out = await PDFDocument.create();
  let first: PDFDocument | undefined;
  for (const bytes of files) {
    const src = await load(bytes);
    first ??= src;
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const page of pages) out.addPage(page);
  }
  stamp(out, first);
  return out.save();
}

/** New document containing `indices` (0-based) from the source, in that order. */
export async function extractPages(bytes: Uint8Array, indices: number[]): Promise<Uint8Array> {
  const src = await load(bytes);
  return extractFromDoc(src, indices);
}

async function extractFromDoc(src: PDFDocument, indices: number[]): Promise<Uint8Array> {
  const total = src.getPageCount();
  if (indices.length === 0) throw new Error('No pages selected');
  for (const index of indices) {
    if (!Number.isInteger(index) || index < 0 || index >= total) throw new Error(`Page ${index + 1} does not exist`);
  }
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, indices);
  for (const page of pages) out.addPage(page);
  stamp(out, src);
  return out.save();
}

/** Several output documents from one source, loading the source only once. */
export async function splitGroups(bytes: Uint8Array, groups: number[][]): Promise<Uint8Array[]> {
  const src = await load(bytes);
  const results: Uint8Array[] = [];
  for (const indices of groups) results.push(await extractFromDoc(src, indices));
  return results;
}

/** Remove pages by 0-based index. At least one page must remain. */
export async function deletePages(bytes: Uint8Array, remove: number[]): Promise<Uint8Array> {
  const src = await load(bytes);
  const removeSet = new Set(remove);
  const keep = src.getPageIndices().filter((index) => !removeSet.has(index));
  if (keep.length === 0) throw new Error('Cannot delete every page');
  return extractFromDoc(src, keep);
}

const normalizeAngle = (angle: number) => (((Math.round(angle / 90) * 90) % 360) + 360) % 360;

/**
 * Apply additional clockwise rotation (multiples of 90°) per 0-based page.
 * Rotates in place so links, forms and bookmarks are preserved.
 */
export async function rotatePages(bytes: Uint8Array, rotations: Record<number, number>): Promise<Uint8Array> {
  const doc = await load(bytes);
  const pages = doc.getPages();
  for (const [key, delta] of Object.entries(rotations)) {
    const page: PDFPage | undefined = pages[Number(key)];
    if (!page) continue;
    page.setRotation(degrees(normalizeAngle(page.getRotation().angle + delta)));
  }
  doc.setModificationDate(new Date());
  return doc.save();
}

/**
 * Lossless rebuild: re-parse and re-serialize, packing objects into compressed
 * object streams. Superseded revisions from incremental saves are dropped.
 * Content is untouched; the result can be larger or smaller.
 */
export async function rebuild(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await load(bytes);
  return doc.save({ useObjectStreams: true });
}

export interface RasterPage {
  /** JPEG bytes of the rendered page. */
  jpeg: Uint8Array;
  /** Page size in PDF points. */
  width: number;
  height: number;
}

/** Build a PDF where each page is a single JPEG image of the original page. */
export async function fromRasterPages(pages: RasterPage[], titleFrom?: Uint8Array): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const page of pages) {
    const image = await out.embedJpg(page.jpeg);
    const pdfPage = out.addPage([page.width, page.height]);
    pdfPage.drawImage(image, { x: 0, y: 0, width: page.width, height: page.height });
  }
  if (titleFrom) {
    try {
      stamp(out, await load(titleFrom));
    } catch {
      stamp(out);
    }
  } else stamp(out);
  return out.save();
}

export type PageSize = 'fit' | 'a4' | 'letter';
export type Orientation = 'auto' | 'portrait' | 'landscape';
export type Margin = 'none' | 'small' | 'large';

export interface ImagePageInput {
  bytes: Uint8Array;
  format: 'jpeg' | 'png';
  /** Pixel dimensions, already orientation-corrected. */
  width: number;
  height: number;
}

export const PAGE_SIZES: Record<Exclude<PageSize, 'fit'>, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

export const MARGINS: Record<Margin, number> = { none: 0, small: 18, large: 42 };

/** Compute page box and image placement (all in PDF points). Exported for tests. */
export function layoutImagePage(
  imageWidth: number,
  imageHeight: number,
  size: PageSize,
  orientation: Orientation,
  margin: Margin,
): { pageWidth: number; pageHeight: number; x: number; y: number; width: number; height: number } {
  const pad = MARGINS[margin];
  // 1 px = 0.75 pt (96 dpi), a sensible physical size for screen images.
  const naturalW = imageWidth * 0.75;
  const naturalH = imageHeight * 0.75;
  if (size === 'fit') {
    return { pageWidth: naturalW + pad * 2, pageHeight: naturalH + pad * 2, x: pad, y: pad, width: naturalW, height: naturalH };
  }
  let [pageWidth, pageHeight] = PAGE_SIZES[size];
  const landscape = orientation === 'landscape' || (orientation === 'auto' && imageWidth > imageHeight);
  if (landscape) [pageWidth, pageHeight] = [pageHeight, pageWidth];
  const boxW = pageWidth - pad * 2;
  const boxH = pageHeight - pad * 2;
  const scale = Math.min(boxW / naturalW, boxH / naturalH);
  const width = naturalW * scale;
  const height = naturalH * scale;
  return { pageWidth, pageHeight, x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height };
}

export async function imagesToPdf(
  images: ImagePageInput[],
  options: { size: PageSize; orientation: Orientation; margin: Margin },
): Promise<Uint8Array> {
  if (images.length === 0) throw new Error('No images');
  const out = await PDFDocument.create();
  for (const input of images) {
    const image = input.format === 'jpeg' ? await out.embedJpg(input.bytes) : await out.embedPng(input.bytes);
    const box = layoutImagePage(input.width, input.height, options.size, options.orientation, options.margin);
    const page = out.addPage([box.pageWidth, box.pageHeight]);
    page.drawImage(image, { x: box.x, y: box.y, width: box.width, height: box.height });
  }
  stamp(out);
  return out.save();
}
