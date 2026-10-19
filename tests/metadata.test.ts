import { describe, expect, it } from 'vitest';
import {
  buildOrientationTiff,
  crc32,
  inventory,
  pngChunk,
  readTiffOrientation,
  stripMetadata,
} from '../src/lib/image/metadata';

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const u8 = (...parts: (number[] | Uint8Array)[]) => Uint8Array.from(parts.flatMap((p) => [...p]));

function segment(marker: number, payload: number[] | Uint8Array): Uint8Array {
  const length = payload.length + 2;
  return u8([0xff, marker, length >> 8, length & 0xff], payload);
}

/** Little-endian TIFF with Orientation=6 and a GPS IFD pointer. */
function exifTiff(): Uint8Array {
  const t = new Uint8Array(8 + 2 + 24 + 4);
  t.set(ascii('II'));
  t.set([0x2a, 0, 8, 0, 0, 0], 2);
  t.set([2, 0], 8);
  t.set([0x12, 0x01, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0], 10); // Orientation = 6
  t.set([0x25, 0x88, 4, 0, 1, 0, 0, 0, 0, 0, 0, 0], 22); // GPS IFD pointer
  return t;
}

function makeJpeg(): Uint8Array {
  return u8(
    [0xff, 0xd8],
    segment(0xe0, ascii('JFIF\0\x01\x01\0\0\x01\0\x01\0\0')),
    segment(0xe1, u8(ascii('Exif\0\0'), exifTiff())),
    segment(0xe1, ascii('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>')),
    segment(0xed, ascii('Photoshop 3.0\0')),
    segment(0xe2, ascii('ICC_PROFILE\0\x01\x01fake')),
    segment(0xfe, ascii('secret comment')),
    segment(0xdb, new Array(65).fill(1)),
    segment(0xda, [1, 1, 0, 0, 0x3f, 0]),
    [0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56], // entropy data with stuffing and restart marker
    [0xff, 0xd9],
    ascii('TRAILING-MOTION-PHOTO'),
  );
}

describe('TIFF helpers', () => {
  it('reads orientation from both byte orders', () => {
    expect(readTiffOrientation(exifTiff())).toBe(6);
    expect(readTiffOrientation(buildOrientationTiff(8))).toBe(8);
  });
});

describe('JPEG', () => {
  it('inventories metadata segments including trailing data', () => {
    const kinds = inventory(makeJpeg(), 'jpeg').map((b) => b.kind);
    expect(kinds).toEqual(['technical', 'exif', 'gps', 'xmp', 'iptc', 'icc', 'comment', 'trailer']);
  });

  it('strips metadata losslessly, keeping orientation and ICC', () => {
    const input = makeJpeg();
    const { bytes, removed, keptOrientation } = stripMetadata(input, 'jpeg', { keepIcc: true, keepOrientation: true });
    expect(keptOrientation).toBe(6);
    expect(removed.map((b) => b.kind)).toEqual(['exif', 'gps', 'xmp', 'iptc', 'comment', 'trailer']);
    const after = inventory(bytes, 'jpeg');
    expect(after.map((b) => b.kind)).toEqual(['technical', 'exif', 'icc']);
    expect(after.some((b) => b.kind === 'gps')).toBe(false);
    // Ends exactly at EOI, scan data intact.
    expect([...bytes.slice(-2)]).toEqual([0xff, 0xd9]);
    const text = String.fromCharCode(...bytes);
    expect(text).not.toContain('secret comment');
    expect(text).not.toContain('TRAILING');
    expect(text).toContain(String.fromCharCode(0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56));
  });

  it('can drop everything including ICC and orientation', () => {
    const { bytes } = stripMetadata(makeJpeg(), 'jpeg', { keepIcc: false, keepOrientation: false });
    expect(inventory(bytes, 'jpeg').map((b) => b.kind)).toEqual(['technical']);
  });

  it('does not modify the input', () => {
    const input = makeJpeg();
    const copy = input.slice();
    stripMetadata(input, 'jpeg', { keepIcc: true, keepOrientation: true });
    expect(input).toEqual(copy);
  });
});

describe('PNG', () => {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const makePng = () =>
    u8(
      signature,
      pngChunk('IHDR', new Uint8Array(13)),
      pngChunk('tEXt', Uint8Array.from(ascii('Author\0Someone'))),
      pngChunk('eXIf', exifTiff()),
      pngChunk('iCCP', Uint8Array.from(ascii('sRGB\0\0data'))),
      pngChunk('tIME', new Uint8Array(7)),
      pngChunk('IDAT', new Uint8Array([1, 2, 3])),
      pngChunk('IEND', new Uint8Array()),
    );

  it('computes standard CRC32', () => {
    expect(crc32(Uint8Array.from(ascii('IEND')))).toBe(0xae426082);
  });

  it('strips text, EXIF and time chunks and re-adds orientation before IDAT', () => {
    const { bytes, keptOrientation } = stripMetadata(makePng(), 'png', { keepIcc: true, keepOrientation: true });
    expect(keptOrientation).toBe(6);
    expect(inventory(bytes, 'png').map((b) => b.kind)).toEqual(['icc', 'exif']);
    const text = String.fromCharCode(...bytes);
    expect(text.indexOf('eXIf')).toBeLessThan(text.indexOf('IDAT'));
    expect(text).not.toContain('Someone');
  });
});

describe('WebP', () => {
  function riffChunk(type: string, data: number[] | Uint8Array): Uint8Array {
    const header = new Uint8Array(8);
    header.set(ascii(type));
    new DataView(header.buffer).setUint32(4, data.length, true);
    return u8(header, data, data.length % 2 ? [0] : []);
  }
  const makeWebp = () => {
    const vp8x = new Uint8Array(10);
    vp8x[0] = 0x20 | 0x08 | 0x04;
    const body = u8(
      riffChunk('VP8X', vp8x),
      riffChunk('ICCP', ascii('icc')),
      riffChunk('VP8L', [1, 2, 3, 4]),
      riffChunk('EXIF', exifTiff()),
      riffChunk('XMP ', ascii('<x/>')),
    );
    const header = new Uint8Array(12);
    header.set(ascii('RIFF'));
    new DataView(header.buffer).setUint32(4, body.length + 4, true);
    header.set(ascii('WEBP'), 8);
    return u8(header, body);
  };

  it('strips EXIF/XMP, fixes flags and RIFF size', () => {
    const { bytes } = stripMetadata(makeWebp(), 'webp', { keepIcc: true, keepOrientation: false });
    expect(inventory(bytes, 'webp').map((b) => b.kind)).toEqual(['icc']);
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    expect(view.getUint32(4, true)).toBe(bytes.length - 8);
    expect(bytes[20]).toBe(0x20); // VP8X flags: ICC only
  });
});
