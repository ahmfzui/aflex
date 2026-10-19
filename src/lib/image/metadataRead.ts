/**
 * Human-readable metadata fields via exifr, plus the byte-level inventory from
 * metadata.ts. exifr reads what it recognises; the inventory shows every
 * metadata block we can locate, whether or not its fields could be decoded.
 */
import exifr from 'exifr';
import { extractExifTiff, extractXmp, inventory, type MetadataBlock, type StrippableType } from './metadata';

export interface FieldGroup {
  key: string;
  name: string;
  /** Technical groups (JFIF, ICC, PNG header) describe the encoding, not the photo or its owner. */
  technical: boolean;
  fields: [string, string][];
}

export interface MetadataReport {
  blocks: MetadataBlock[];
  groups: FieldGroup[];
  gps: { latitude: number; longitude: number } | null;
  xmp: string | null;
  parseWarning: string | null;
}

const ORDER = ['gps', 'ifd0', 'exif', 'iptc', 'xmp', 'ifd1', 'interop', 'icc', 'jfif', 'ihdr'];
const TECHNICAL = new Set(['icc', 'jfif', 'ihdr']);

const GROUP_LABEL: Record<string, string> = {
  ifd0: 'Camera & image (IFD0)',
  ifd1: 'Embedded thumbnail (IFD1)',
  exif: 'Capture settings (EXIF)',
  gps: 'GPS location',
  interop: 'Interoperability',
  iptc: 'IPTC',
  xmp: 'XMP',
  icc: 'ICC colour profile',
  jfif: 'JFIF',
  ihdr: 'PNG header',
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid date' : value.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) return `<binary, ${value.byteLength} bytes>`;
  if (Array.isArray(value)) return value.length > 12 ? `[${value.slice(0, 12).map(formatValue).join(', ')}, …]` : value.map(formatValue).join(', ');
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Math.round(value * 1e6) / 1e6);
  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value);
      return json.length > 200 ? `${json.slice(0, 200)}…` : json;
    } catch {
      return '[object]';
    }
  }
  const str = String(value);
  return str.length > 300 ? `${str.slice(0, 300)}…` : str;
}

export async function readMetadata(bytes: Uint8Array, type: StrippableType): Promise<MetadataReport> {
  const blocks = inventory(bytes, type);
  const groups: FieldGroup[] = [];
  let gps: MetadataReport['gps'] = null;
  let parseWarning: string | null = null;
  const xmp = extractXmp(bytes, type);

  // exifr understands JPEG and PNG containers directly; for WebP we hand it the raw EXIF TIFF.
  const source = type === 'webp' ? extractExifTiff(bytes, type) : bytes;
  if (source) {
    try {
      const output = await exifr.parse(source, {
        tiff: true, ifd0: {}, ifd1: true, exif: true, gps: true, interop: true,
        iptc: true, xmp: false, icc: true, jfif: true, ihdr: true,
        mergeOutput: false, translateValues: true, reviveValues: true, sanitize: true,
      });
      if (output && typeof output === 'object') {
        for (const [key, value] of Object.entries(output as Record<string, unknown>)) {
          if (!value || typeof value !== 'object' || value instanceof Date) continue;
          const fields = Object.entries(value as Record<string, unknown>)
            .filter(([name]) => !['latitude', 'longitude'].includes(name))
            .slice(0, 200)
            .map(([name, v]) => [name, formatValue(v)] as [string, string]);
          if (fields.length) groups.push({ key, name: GROUP_LABEL[key] ?? key.toUpperCase(), technical: TECHNICAL.has(key), fields });
        }
        const gpsGroup = (output as Record<string, Record<string, unknown> | undefined>).gps;
        const lat = gpsGroup?.latitude;
        const lon = gpsGroup?.longitude;
        if (typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)) {
          gps = { latitude: lat, longitude: lon };
        }
      }
    } catch {
      parseWarning = 'Some metadata blocks were found but their fields couldn’t be decoded. They are still listed below and are still removed by the clean export.';
    }
  }
  const rank = (key: string) => (ORDER.includes(key) ? ORDER.indexOf(key) : ORDER.length);
  groups.sort((a, b) => rank(a.key) - rank(b.key));
  return { blocks, groups, gps, xmp, parseWarning };
}
