/**
 * Byte-level metadata inventory and lossless stripping for JPEG, PNG and WebP.
 * Pixel data is never decoded or re-encoded here, so image quality is unchanged.
 * Pure functions — no DOM — so they are unit-tested directly.
 */

export type BlockKind = 'exif' | 'gps' | 'xmp' | 'iptc' | 'icc' | 'comment' | 'text' | 'timestamp' | 'thumbnail' | 'trailer' | 'other' | 'technical';

export interface MetadataBlock {
  kind: BlockKind;
  label: string;
  bytes: number;
  /** Removed by the clean export. */
  removable: boolean;
  detail?: string;
}

export interface StripOptions {
  /** Keep the embedded ICC colour profile so colours look the same. */
  keepIcc: boolean;
  /** Keep a minimal EXIF block holding only the Orientation tag so the image isn't displayed rotated. */
  keepOrientation: boolean;
}

export interface StripResult {
  bytes: Uint8Array;
  removed: MetadataBlock[];
  keptOrientation: number | null;
}

export type StrippableType = 'jpeg' | 'png' | 'webp';

const text = (bytes: Uint8Array, start: number, length: number) => {
  let out = '';
  const end = Math.min(bytes.length, start + length);
  for (let i = start; i < end; i += 1) out += String.fromCharCode(bytes[i]);
  return out;
};

const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u32be = (b: Uint8Array, o: number) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
const u32le = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export class MetadataFormatError extends Error {}

/* ------------------------------------------------------------------ TIFF/EXIF */

/** Read the Orientation tag (0x0112) from IFD0 of a TIFF structure. */
export function readTiffOrientation(tiff: Uint8Array): number | null {
  if (tiff.length < 8) return null;
  const order = text(tiff, 0, 2);
  const le = order === 'II';
  if (!le && order !== 'MM') return null;
  const u16 = (o: number) => (le ? tiff[o] | (tiff[o + 1] << 8) : (tiff[o] << 8) | tiff[o + 1]);
  const u32 = (o: number) => (le ? u32le(tiff, o) : u32be(tiff, o));
  const ifd = u32(4);
  if (ifd + 2 > tiff.length) return null;
  const count = u16(ifd);
  for (let i = 0; i < count; i += 1) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > tiff.length) return null;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : null;
    }
  }
  return null;
}

/** True if IFD0 points at a GPS IFD (tag 0x8825). */
export function tiffHasGps(tiff: Uint8Array): boolean {
  if (tiff.length < 8) return false;
  const le = text(tiff, 0, 2) === 'II';
  const u16 = (o: number) => (le ? tiff[o] | (tiff[o + 1] << 8) : (tiff[o] << 8) | tiff[o + 1]);
  const u32 = (o: number) => (le ? u32le(tiff, o) : u32be(tiff, o));
  const ifd = u32(4);
  if (ifd + 2 > tiff.length) return false;
  const count = u16(ifd);
  for (let i = 0; i < count; i += 1) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > tiff.length) return false;
    if (u16(entry) === 0x8825) return true;
  }
  return false;
}

/** A minimal big-endian TIFF structure containing only an Orientation tag. */
export function buildOrientationTiff(orientation: number): Uint8Array {
  const tiff = new Uint8Array(26);
  tiff.set([0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8]); // "MM", 42, IFD0 at offset 8
  tiff.set([0x00, 0x01], 8); // 1 entry
  tiff.set([0x01, 0x12, 0x00, 0x03, 0, 0, 0, 1, 0x00, orientation, 0, 0], 10); // Orientation, SHORT, count 1
  // next IFD offset = 0 (already zero)
  return tiff;
}

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0, 0]; // "Exif\0\0"

function exifBlock(tiff: Uint8Array, label: string): MetadataBlock[] {
  const blocks: MetadataBlock[] = [{ kind: 'exif', label, bytes: tiff.length, removable: true }];
  if (tiffHasGps(tiff)) blocks.push({ kind: 'gps', label: 'GPS location (inside EXIF)', bytes: 0, removable: true });
  const orientation = readTiffOrientation(tiff);
  if (orientation && orientation !== 1) blocks[0].detail = `Orientation ${orientation}`;
  return blocks;
}

/* ------------------------------------------------------------------ JPEG */

interface JpegSegment {
  marker: number;
  start: number;
  /** End offset (exclusive), including entropy data for SOS. */
  end: number;
  payloadStart: number;
  payloadEnd: number;
}

/** Walk every marker segment in a JPEG, including those between progressive scans. */
function walkJpeg(bytes: Uint8Array): { segments: JpegSegment[]; eoiEnd: number } {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new MetadataFormatError('Not a JPEG');
  const segments: JpegSegment[] = [];
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) throw new MetadataFormatError('Corrupt JPEG marker stream');
    let marker = bytes[offset + 1];
    while (marker === 0xff) {
      offset += 1; // fill bytes
      marker = bytes[offset + 1];
    }
    if (marker === 0xd9) return { segments, eoiEnd: offset + 2 };
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      segments.push({ marker, start: offset, end: offset + 2, payloadStart: offset + 2, payloadEnd: offset + 2 });
      offset += 2;
      continue;
    }
    if (offset + 4 > bytes.length) throw new MetadataFormatError('Truncated JPEG');
    const length = u16be(bytes, offset + 2);
    if (length < 2) throw new MetadataFormatError('Corrupt JPEG segment length');
    const payloadStart = offset + 4;
    const payloadEnd = offset + 2 + length;
    if (payloadEnd > bytes.length) throw new MetadataFormatError('Truncated JPEG segment');
    let end = payloadEnd;
    if (marker === 0xda) {
      // Entropy-coded data runs until the next marker that isn't stuffing or a restart.
      let p = payloadEnd;
      while (p < bytes.length - 1) {
        if (bytes[p] === 0xff) {
          const next = bytes[p + 1];
          if (next === 0x00 || (next >= 0xd0 && next <= 0xd7) || next === 0xff) {
            p += next === 0xff ? 1 : 2;
            continue;
          }
          break;
        }
        p += 1;
      }
      end = p;
      if (p >= bytes.length - 1) {
        // Missing EOI; treat the rest as scan data.
        segments.push({ marker, start: offset, end: bytes.length, payloadStart, payloadEnd });
        return { segments, eoiEnd: bytes.length };
      }
    }
    segments.push({ marker, start: offset, end, payloadStart, payloadEnd });
    offset = end;
  }
  return { segments, eoiEnd: bytes.length };
}

function classifyJpegSegment(bytes: Uint8Array, seg: JpegSegment): MetadataBlock[] | null {
  const { marker, payloadStart, payloadEnd } = seg;
  const size = seg.end - seg.start;
  const id = text(bytes, payloadStart, 36);
  if (marker === 0xfe) return [{ kind: 'comment', label: 'JPEG comment (COM)', bytes: size, removable: true, detail: text(bytes, payloadStart, Math.min(80, payloadEnd - payloadStart)) }];
  if (marker === 0xe1 && id.startsWith('Exif\0')) return exifBlock(bytes.subarray(payloadStart + 6, payloadEnd), 'EXIF (APP1)');
  if (marker === 0xe1 && id.startsWith('http://ns.adobe.com/xap/1.0/')) return [{ kind: 'xmp', label: 'XMP (APP1)', bytes: size, removable: true }];
  if (marker === 0xe1 && id.startsWith('http://ns.adobe.com/xmp/extension/')) return [{ kind: 'xmp', label: 'Extended XMP (APP1)', bytes: size, removable: true }];
  if (marker === 0xed) return [{ kind: 'iptc', label: 'IPTC / Photoshop (APP13)', bytes: size, removable: true }];
  if (marker === 0xe2 && id.startsWith('ICC_PROFILE')) return [{ kind: 'icc', label: 'ICC colour profile (APP2)', bytes: size, removable: false }];
  if (marker === 0xe2 && id.startsWith('MPF')) return [{ kind: 'thumbnail', label: 'Multi-picture index (APP2 MPF)', bytes: size, removable: true }];
  if (marker === 0xe0) return [{ kind: 'technical', label: id.startsWith('JFIF') ? 'JFIF header (APP0)' : 'APP0', bytes: size, removable: false }];
  if (marker === 0xee) return [{ kind: 'technical', label: 'Adobe colour transform (APP14)', bytes: size, removable: false }];
  if (marker >= 0xe0 && marker <= 0xef) return [{ kind: 'other', label: `APP${marker - 0xe0} segment`, bytes: size, removable: true }];
  return null;
}

function jpegInventory(bytes: Uint8Array): MetadataBlock[] {
  const { segments, eoiEnd } = walkJpeg(bytes);
  const blocks: MetadataBlock[] = [];
  for (const seg of segments) {
    const found = classifyJpegSegment(bytes, seg);
    if (found) blocks.push(...found);
  }
  if (eoiEnd < bytes.length) {
    blocks.push({ kind: 'trailer', label: 'Data after end of image (e.g. embedded previews, depth maps or motion clips)', bytes: bytes.length - eoiEnd, removable: true });
  }
  return blocks;
}

function jpegStrip(bytes: Uint8Array, options: StripOptions): StripResult {
  const { segments, eoiEnd } = walkJpeg(bytes);
  const keep: Uint8Array[] = [bytes.subarray(0, 2)];
  const removed: MetadataBlock[] = [];
  let orientation: number | null = null;
  let insertAt = 1; // after SOI (and after APP0 if present)

  for (const seg of segments) {
    const classified = classifyJpegSegment(bytes, seg);
    const isIcc = classified?.[0].kind === 'icc';
    const drop = classified !== null && (classified[0].removable || (isIcc && !options.keepIcc));
    if (classified?.[0].kind === 'exif') {
      orientation = readTiffOrientation(bytes.subarray(seg.payloadStart + 6, seg.payloadEnd)) ?? orientation;
    }
    if (drop) {
      removed.push(...classified.map((block) => (block.kind === 'icc' ? { ...block, removable: true } : block)));
      continue;
    }
    keep.push(bytes.subarray(seg.start, seg.end));
    if (seg.marker === 0xe0 && keep.length === 2) insertAt = 2;
  }
  keep.push(new Uint8Array([0xff, 0xd9]));
  if (eoiEnd < bytes.length) {
    removed.push({ kind: 'trailer', label: 'Data after end of image', bytes: bytes.length - eoiEnd, removable: true });
  }

  let keptOrientation: number | null = null;
  if (options.keepOrientation && orientation && orientation !== 1) {
    const tiff = buildOrientationTiff(orientation);
    const length = 2 + EXIF_HEADER.length + tiff.length;
    const app1 = concat([new Uint8Array([0xff, 0xe1, length >> 8, length & 0xff, ...EXIF_HEADER]), tiff]);
    keep.splice(insertAt, 0, app1);
    keptOrientation = orientation;
  }
  return { bytes: concat(keep), removed, keptOrientation };
}

/* ------------------------------------------------------------------ PNG */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

interface PngChunk {
  type: string;
  start: number;
  end: number;
  dataStart: number;
  dataEnd: number;
}

function walkPng(bytes: Uint8Array): { chunks: PngChunk[]; iendEnd: number } {
  for (let i = 0; i < 8; i += 1) if (bytes[i] !== PNG_SIGNATURE[i]) throw new MetadataFormatError('Not a PNG');
  const chunks: PngChunk[] = [];
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = u32be(bytes, offset);
    const type = text(bytes, offset + 4, 4);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new MetadataFormatError('Truncated PNG chunk');
    chunks.push({ type, start: offset, end, dataStart: offset + 8, dataEnd: offset + 8 + length });
    offset = end;
    if (type === 'IEND') return { chunks, iendEnd: end };
  }
  throw new MetadataFormatError('PNG is missing its end chunk');
}

function classifyPngChunk(bytes: Uint8Array, chunk: PngChunk): MetadataBlock[] | null {
  const size = chunk.end - chunk.start;
  const keyword = () => {
    let k = '';
    for (let i = chunk.dataStart; i < Math.min(chunk.dataEnd, chunk.dataStart + 80) && bytes[i] !== 0; i += 1) k += String.fromCharCode(bytes[i]);
    return k;
  };
  switch (chunk.type) {
    case 'eXIf':
      return exifBlock(bytes.subarray(chunk.dataStart, chunk.dataEnd), 'EXIF (eXIf chunk)');
    case 'iTXt': {
      const key = keyword();
      if (key === 'XML:com.adobe.xmp') return [{ kind: 'xmp', label: 'XMP (iTXt chunk)', bytes: size, removable: true }];
      return [{ kind: 'text', label: `Text: ${key || 'untitled'} (iTXt)`, bytes: size, removable: true }];
    }
    case 'tEXt':
    case 'zTXt': {
      const key = keyword();
      if (/^Raw profile type (exif|APP1)$/i.test(key)) return [{ kind: 'exif', label: `EXIF stored as text (${chunk.type})`, bytes: size, removable: true }];
      if (/^Raw profile type (iptc|8bim)$/i.test(key)) return [{ kind: 'iptc', label: `IPTC stored as text (${chunk.type})`, bytes: size, removable: true }];
      if (/^Raw profile type xmp$/i.test(key)) return [{ kind: 'xmp', label: `XMP stored as text (${chunk.type})`, bytes: size, removable: true }];
      return [{ kind: 'text', label: `Text: ${key || 'untitled'} (${chunk.type})`, bytes: size, removable: true }];
    }
    case 'tIME':
      return [{ kind: 'timestamp', label: 'Last-modified time (tIME)', bytes: size, removable: true }];
    case 'iCCP':
      return [{ kind: 'icc', label: 'ICC colour profile (iCCP)', bytes: size, removable: false }];
    case 'sRGB':
    case 'gAMA':
    case 'cHRM':
    case 'pHYs':
    case 'cICP':
      return [{ kind: 'technical', label: `Colour/display info (${chunk.type})`, bytes: size, removable: false }];
    default:
      return null;
  }
}

function pngInventory(bytes: Uint8Array): MetadataBlock[] {
  const { chunks, iendEnd } = walkPng(bytes);
  const blocks: MetadataBlock[] = [];
  for (const chunk of chunks) {
    const found = classifyPngChunk(bytes, chunk);
    if (found) blocks.push(...found);
  }
  if (iendEnd < bytes.length) blocks.push({ kind: 'trailer', label: 'Data after end of image', bytes: bytes.length - iendEnd, removable: true });
  return blocks;
}

function pngStrip(bytes: Uint8Array, options: StripOptions): StripResult {
  const { chunks } = walkPng(bytes);
  const keep: Uint8Array[] = [bytes.subarray(0, 8)];
  const removed: MetadataBlock[] = [];
  const exif = chunks.find((chunk) => chunk.type === 'eXIf');
  const orientation = exif ? readTiffOrientation(bytes.subarray(exif.dataStart, exif.dataEnd)) : null;
  const keptOrientation = options.keepOrientation && orientation && orientation !== 1 ? orientation : null;
  let insertedOrientation = false;
  for (const chunk of chunks) {
    const classified = classifyPngChunk(bytes, chunk);
    const isIcc = classified?.[0].kind === 'icc';
    if (classified && (classified[0].removable || (isIcc && !options.keepIcc))) {
      removed.push(...classified.map((block) => (block.kind === 'icc' ? { ...block, removable: true } : block)));
      continue;
    }
    // eXIf must precede the image data to be honoured by decoders.
    if (chunk.type === 'IDAT' && keptOrientation && !insertedOrientation) {
      keep.push(pngChunk('eXIf', buildOrientationTiff(keptOrientation)));
      insertedOrientation = true;
    }
    keep.push(bytes.subarray(chunk.start, chunk.end));
  }
  const trailing = bytes.length - chunks[chunks.length - 1].end;
  if (trailing > 0) removed.push({ kind: 'trailer', label: 'Data after end of image', bytes: trailing, removable: true });
  return { bytes: concat(keep), removed, keptOrientation };
}

/* ------------------------------------------------------------------ WebP */

interface RiffChunk {
  type: string;
  start: number;
  end: number;
  dataStart: number;
  dataEnd: number;
}

function walkWebp(bytes: Uint8Array): RiffChunk[] {
  if (text(bytes, 0, 4) !== 'RIFF' || text(bytes, 8, 4) !== 'WEBP') throw new MetadataFormatError('Not a WebP');
  const riffEnd = Math.min(bytes.length, 8 + u32le(bytes, 4));
  const chunks: RiffChunk[] = [];
  let offset = 12;
  while (offset + 8 <= riffEnd) {
    const type = text(bytes, offset, 4);
    const size = u32le(bytes, offset + 4);
    const dataEnd = offset + 8 + size;
    if (dataEnd > bytes.length) throw new MetadataFormatError('Truncated WebP chunk');
    const end = dataEnd + (size & 1); // chunks are padded to even sizes
    chunks.push({ type, start: offset, end: Math.min(end, bytes.length), dataStart: offset + 8, dataEnd });
    offset = end;
  }
  return chunks;
}

function webpExifTiff(bytes: Uint8Array, chunk: RiffChunk): Uint8Array {
  const data = bytes.subarray(chunk.dataStart, chunk.dataEnd);
  // Some writers prefix the TIFF data with "Exif\0\0".
  return text(data, 0, 6) === 'Exif\0\0' ? data.subarray(6) : data;
}

function classifyWebpChunk(bytes: Uint8Array, chunk: RiffChunk): MetadataBlock[] | null {
  const size = chunk.end - chunk.start;
  if (chunk.type === 'EXIF') return exifBlock(webpExifTiff(bytes, chunk), 'EXIF chunk');
  if (chunk.type === 'XMP ') return [{ kind: 'xmp', label: 'XMP chunk', bytes: size, removable: true }];
  if (chunk.type === 'ICCP') return [{ kind: 'icc', label: 'ICC colour profile (ICCP)', bytes: size, removable: false }];
  return null;
}

function webpInventory(bytes: Uint8Array): MetadataBlock[] {
  const blocks: MetadataBlock[] = [];
  for (const chunk of walkWebp(bytes)) {
    const found = classifyWebpChunk(bytes, chunk);
    if (found) blocks.push(...found);
  }
  return blocks;
}

function webpStrip(bytes: Uint8Array, options: StripOptions): StripResult {
  const chunks = walkWebp(bytes);
  const keep: Uint8Array[] = [];
  const removed: MetadataBlock[] = [];
  let orientation: number | null = null;
  let hasIcc = false;
  for (const chunk of chunks) {
    const classified = classifyWebpChunk(bytes, chunk);
    if (chunk.type === 'EXIF') orientation = readTiffOrientation(webpExifTiff(bytes, chunk));
    if (classified && (classified[0].removable || (classified[0].kind === 'icc' && !options.keepIcc))) {
      removed.push(...classified.map((block) => (block.kind === 'icc' ? { ...block, removable: true } : block)));
      continue;
    }
    if (chunk.type === 'ICCP') hasIcc = true;
    keep.push(bytes.slice(chunk.start, chunk.end));
  }
  let keptOrientation: number | null = null;
  const vp8x = keep.find((chunk) => text(chunk, 0, 4) === 'VP8X');
  if (options.keepOrientation && orientation && orientation !== 1 && vp8x) {
    const tiff = buildOrientationTiff(orientation);
    const header = new Uint8Array(8);
    header.set([0x45, 0x58, 0x49, 0x46]); // "EXIF"
    new DataView(header.buffer).setUint32(4, tiff.length, true);
    keep.push(concat([header, tiff]));
    keptOrientation = orientation;
  }
  if (vp8x) {
    // Flags byte: ICC 0x20, EXIF 0x08, XMP 0x04.
    let flags = vp8x[8] & ~(0x20 | 0x08 | 0x04);
    if (hasIcc) flags |= 0x20;
    if (keptOrientation) flags |= 0x08;
    vp8x[8] = flags;
  }
  const body = concat(keep);
  const header = new Uint8Array(12);
  header.set([0x52, 0x49, 0x46, 0x46]);
  new DataView(header.buffer).setUint32(4, body.length + 4, true);
  header.set([0x57, 0x45, 0x42, 0x50], 8);
  return { bytes: concat([header, body]), removed, keptOrientation };
}

/* ------------------------------------------------------------------ public */

export function canStrip(type: string): type is StrippableType {
  return type === 'jpeg' || type === 'png' || type === 'webp';
}

export function inventory(bytes: Uint8Array, type: StrippableType): MetadataBlock[] {
  if (type === 'jpeg') return jpegInventory(bytes);
  if (type === 'png') return pngInventory(bytes);
  return webpInventory(bytes);
}

export function stripMetadata(bytes: Uint8Array, type: StrippableType, options: StripOptions): StripResult {
  if (type === 'jpeg') return jpegStrip(bytes, options);
  if (type === 'png') return pngStrip(bytes, options);
  return webpStrip(bytes, options);
}

/** Raw EXIF TIFF payload, if any, so a parser can read field values. */
export function extractExifTiff(bytes: Uint8Array, type: StrippableType): Uint8Array | null {
  if (type === 'jpeg') {
    for (const seg of walkJpeg(bytes).segments) {
      if (seg.marker === 0xe1 && text(bytes, seg.payloadStart, 6) === 'Exif\0\0') return bytes.subarray(seg.payloadStart + 6, seg.payloadEnd);
    }
  } else if (type === 'png') {
    const chunk = walkPng(bytes).chunks.find((c) => c.type === 'eXIf');
    if (chunk) return bytes.subarray(chunk.dataStart, chunk.dataEnd);
  } else {
    const chunk = walkWebp(bytes).find((c) => c.type === 'EXIF');
    if (chunk) return webpExifTiff(bytes, chunk);
  }
  return null;
}

/** Raw XMP packet text, if any. */
export function extractXmp(bytes: Uint8Array, type: StrippableType): string | null {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  if (type === 'jpeg') {
    const prefix = 'http://ns.adobe.com/xap/1.0/\0';
    for (const seg of walkJpeg(bytes).segments) {
      if (seg.marker === 0xe1 && text(bytes, seg.payloadStart, prefix.length) === prefix) {
        return decoder.decode(bytes.subarray(seg.payloadStart + prefix.length, seg.payloadEnd));
      }
    }
  } else if (type === 'png') {
    for (const chunk of walkPng(bytes).chunks) {
      if (chunk.type !== 'iTXt') continue;
      const data = bytes.subarray(chunk.dataStart, chunk.dataEnd);
      const key = 'XML:com.adobe.xmp';
      if (text(data, 0, key.length) !== key) continue;
      // keyword\0 compressionFlag compressionMethod language\0 translated\0 text
      let p = key.length + 1;
      const compressed = data[p] === 1;
      p += 2;
      while (p < data.length && data[p] !== 0) p += 1;
      p += 1;
      while (p < data.length && data[p] !== 0) p += 1;
      p += 1;
      return compressed ? '[compressed XMP packet]' : decoder.decode(data.subarray(p));
    }
  } else {
    const chunk = walkWebp(bytes).find((c) => c.type === 'XMP ');
    if (chunk) return decoder.decode(bytes.subarray(chunk.dataStart, chunk.dataEnd));
  }
  return null;
}

/** Number of colour components in a JPEG's frame header (1 = grey, 3 = YCbCr/RGB, 4 = CMYK/YCCK). */
export function jpegComponentCount(bytes: Uint8Array): number | null {
  try {
    for (const seg of walkJpeg(bytes).segments) {
      const m = seg.marker;
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return bytes[seg.payloadStart + 5] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}
