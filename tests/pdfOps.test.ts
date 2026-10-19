import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { deletePages, extractPages, imagesToPdf, layoutImagePage, merge, rebuild, rotatePages, splitGroups } from '../src/lib/pdf/ops';

/** A PDF whose pages each print their label, with distinct widths so order is checkable. */
async function makePdf(labels: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  labels.forEach((label, i) => {
    const page = doc.addPage([300 + i, 400]);
    page.drawText(label, { x: 20, y: 200, size: 24, font });
  });
  doc.setTitle('Fixture');
  return doc.save();
}

const widths = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPages().map((p) => Math.round(p.getWidth()));

describe('pdf ops', () => {
  it('merges documents in order', async () => {
    const a = await makePdf(['A1', 'A2']);
    const b = await makePdf(['B1']);
    const out = await merge([a, b]);
    expect(await widths(out)).toEqual([300, 301, 300]);
    expect((await PDFDocument.load(out)).getTitle()).toBe('Fixture');
  });

  it('extracts and reorders pages', async () => {
    const src = await makePdf(['1', '2', '3', '4']);
    expect(await widths(await extractPages(src, [3, 0, 2]))).toEqual([303, 300, 302]);
    await expect(extractPages(src, [9])).rejects.toThrow(/does not exist/);
    await expect(extractPages(src, [])).rejects.toThrow(/No pages/);
  });

  it('splits into groups', async () => {
    const src = await makePdf(['1', '2', '3']);
    const parts = await splitGroups(src, [[0], [1, 2]]);
    expect(parts).toHaveLength(2);
    expect(await widths(parts[1])).toEqual([301, 302]);
  });

  it('deletes pages but never all of them', async () => {
    const src = await makePdf(['1', '2', '3']);
    expect(await widths(await deletePages(src, [1]))).toEqual([300, 302]);
    await expect(deletePages(src, [0, 1, 2])).rejects.toThrow(/every page/);
  });

  it('rotates relative to existing rotation', async () => {
    const doc = await PDFDocument.load(await makePdf(['1', '2']));
    doc.getPage(1).setRotation(degrees(90));
    const src = await doc.save();
    const out = await PDFDocument.load(await rotatePages(src, { 0: 90, 1: -180 }));
    expect(out.getPages().map((p) => p.getRotation().angle)).toEqual([90, 270]);
  });

  it('rebuilds losslessly with the same pages', async () => {
    const src = await makePdf(['1', '2']);
    expect(await widths(await rebuild(src))).toEqual([300, 301]);
  });

  it('rejects data that is not a PDF', async () => {
    await expect(merge([new TextEncoder().encode('not a pdf')])).rejects.toThrow();
  });
});

describe('images to pdf', () => {
  // 1x1 red PNG.
  const png = Uint8Array.from(
    atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='),
    (c) => c.charCodeAt(0),
  );

  it('lays out images fitted and centered', () => {
    const box = layoutImagePage(2000, 1000, 'a4', 'auto', 'none');
    expect(box.pageWidth).toBeGreaterThan(box.pageHeight); // auto → landscape
    expect(box.width).toBeCloseTo(841.89);
    expect(box.y).toBeCloseTo((595.28 - box.height) / 2);
    const fit = layoutImagePage(100, 50, 'fit', 'auto', 'small');
    expect(fit.pageWidth).toBe(75 + 36);
  });

  it('creates one page per image', async () => {
    const out = await imagesToPdf(
      [
        { bytes: png, format: 'png', width: 1, height: 1 },
        { bytes: png, format: 'png', width: 1, height: 1 },
      ],
      { size: 'letter', orientation: 'portrait', margin: 'small' },
    );
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
  });
});
