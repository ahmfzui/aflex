import { describe, expect, it } from 'vitest';
import { baseName, formatBytes, percentChange, sniffBytes, uniqueNames, validateFiles } from '../src/lib/files';

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(values.flatMap((v) => (typeof v === 'string' ? [...v].map((c) => c.charCodeAt(0)) : [v])));

describe('sniffBytes', () => {
  it('identifies common signatures', () => {
    expect(sniffBytes(bytes('%PDF-1.7\n'))).toBe('pdf');
    expect(sniffBytes(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a))).toBe('png');
    expect(sniffBytes(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
    expect(sniffBytes(bytes('GIF89a'))).toBe('gif');
    expect(sniffBytes(bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 '))).toBe('webp');
    expect(sniffBytes(bytes(0, 0, 0, 0x1c, 'ftypavif'))).toBe('avif');
    expect(sniffBytes(bytes(0, 0, 0, 0x1c, 'ftypheic'))).toBe('heic');
    expect(sniffBytes(bytes('BM', 0, 0))).toBe('bmp');
  });
  it('finds a PDF header after leading junk', () => {
    expect(sniffBytes(bytes('junkjunk%PDF-1.4'))).toBe('pdf');
  });
  it('returns null for unknown data', () => {
    expect(sniffBytes(bytes('hello world'))).toBeNull();
  });
});

describe('validateFiles', () => {
  const file = (name: string, content: Uint8Array) => new File([content as BlobPart], name);

  it('accepts real PDFs and rejects disguised files', async () => {
    const result = await validateFiles(
      [file('real.pdf', bytes('%PDF-1.4 ...')), file('fake.pdf', bytes(0x89, 'PNG', 0, 0)), file('empty.pdf', new Uint8Array())],
      { kind: 'pdf', maxFiles: 10 },
    );
    expect(result.accepted.map((f) => f.file.name)).toEqual(['real.pdf']);
    expect(result.rejected.map((r) => r.name)).toEqual(['fake.pdf', 'empty.pdf']);
  });

  it('enforces file count limits', async () => {
    const png = bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a);
    const result = await validateFiles([file('a.png', png), file('b.png', png)], { kind: 'image', maxFiles: 1 });
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected[0].reason).toMatch(/Limit/);
  });

  it('rejects unsupported image types with a helpful message', async () => {
    const result = await validateFiles([file('x.heic', bytes(0, 0, 0, 0x1c, 'ftypheic'))], { kind: 'image', maxFiles: 5 });
    expect(result.rejected[0].reason).toMatch(/HEIC/);
  });
});

describe('formatting helpers', () => {
  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.50 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB');
  });
  it('computes signed percentage change', () => {
    expect(percentChange(200, 50)).toBe(-75);
    expect(percentChange(100, 120)).toBe(20);
  });
  it('sanitises names and dedupes', () => {
    expect(baseName('my:report.final.pdf')).toBe('my_report.final');
    expect(uniqueNames(['a.png', 'a.png', 'b.png'])).toEqual(['a.png', 'a (2).png', 'b.png']);
  });
});
