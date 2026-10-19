// Generates sample PDFs for manual/browser testing into tests/fixtures/generated.
// Run: npm run fixtures
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, PDFName, StandardFonts, rgb } from 'pdf-lib';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures', 'generated');
mkdirSync(out, { recursive: true });

const COLORS = [rgb(1, 0.09, 0.27), rgb(0.1, 0.1, 0.1), rgb(0.96, 0.95, 0.92), rgb(0.2, 0.4, 0.9), rgb(0.1, 0.7, 0.4), rgb(0.9, 0.6, 0.1)];

async function numbered(name, count, { landscapeEvery = 0, title = name } = {}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const body = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < count; i += 1) {
    const landscape = landscapeEvery && (i + 1) % landscapeEvery === 0;
    const page = doc.addPage(landscape ? [842, 595] : [595, 842]);
    const { width, height } = page.getSize();
    const color = COLORS[i % COLORS.length];
    page.drawRectangle({ x: 0, y: height - 120, width, height: 120, color });
    page.drawText(`${title.toUpperCase()}`, { x: 40, y: height - 80, size: 28, font, color: i % COLORS.length === 2 ? rgb(0, 0, 0) : rgb(1, 1, 1) });
    page.drawText(String(i + 1), { x: width / 2 - 60, y: height / 2 - 80, size: 220, font, color: rgb(0.05, 0.05, 0.05) });
    page.drawText(`Page ${i + 1} of ${count} — selectable text for testing.`, { x: 40, y: 60, size: 14, font: body });
  }
  doc.setTitle(title);
  writeFileSync(join(out, name), await doc.save());
}

await numbered('six-pages.pdf', 6, { landscapeEvery: 3, title: 'Six pages' });
await numbered('three-pages.pdf', 3, { title: 'Three pages' });
await numbered('long-40-pages.pdf', 40, { title: 'Long document' });

// A PDF flagged as encrypted (pdf-lib refuses to edit it).
{
  const doc = await PDFDocument.create();
  doc.addPage([300, 300]);
  doc.context.trailerInfo.Encrypt = doc.context.obj({ Filter: PDFName.of('Standard'), V: 2, R: 3, O: 'x', U: 'y', P: -4 });
  writeFileSync(join(out, 'encrypted.pdf'), await doc.save({ useObjectStreams: false }));
}

// Damaged: a valid header followed by junk.
writeFileSync(join(out, 'corrupt.pdf'), Buffer.from('%PDF-1.7\n%junk\n1 0 obj << /Type /Catalog >>\nthis is not a pdf\n'));

// Not a PDF at all, but named like one.
writeFileSync(join(out, 'fake.pdf'), Buffer.from('Hello, I am a text file.'));

console.log(`Fixtures written to ${out}`);
