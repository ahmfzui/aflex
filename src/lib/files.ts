/**
 * File validation and small file helpers shared by every tool.
 * File contents are treated as untrusted: we identify files by their leading
 * bytes ("magic numbers"), not by their name or the MIME type the OS reports.
 */

export type SniffedType = 'pdf' | 'png' | 'jpeg' | 'gif' | 'webp' | 'bmp' | 'avif' | 'heic' | 'tiff';

export type ImageType = Exclude<SniffedType, 'pdf'>;

export const MB = 1024 * 1024;

export const LIMITS = {
  pdfFileBytes: 300 * MB,
  pdfTotalBytes: 600 * MB,
  pdfFiles: 50,
  imageFileBytes: 60 * MB,
  imageFiles: 60,
  /** Largest decoded image we will put on a canvas. ~100 megapixels. */
  imagePixels: 100_000_000,
  /** Largest output image we will try to encode. */
  outputPixels: 100_000_000,
  outputSide: 16_384,
} as const;

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

/** Identify a file from its first bytes. Needs at least the first 1 KB. */
export function sniffBytes(bytes: Uint8Array): SniffedType | null {
  if (bytes.length < 4) return null;
  // PDF header may legally appear anywhere in the first 1024 bytes.
  const head = ascii(bytes, 0, Math.min(bytes.length, 1024));
  if (head.includes('%PDF-')) return 'pdf';
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (ascii(bytes, 0, 4) === 'GIF8') return 'gif';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp';
  if (ascii(bytes, 0, 2) === 'BM') return 'bmp';
  if ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0 && bytes[3] === 0x2a)) return 'tiff';
  if (ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4);
    if (brand === 'avif' || brand === 'avis') return 'avif';
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis'].includes(brand)) return 'heic';
  }
  return null;
}

export async function sniffFile(file: Blob): Promise<SniffedType | null> {
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  return sniffBytes(head);
}

export const IMAGE_MIME: Record<ImageType, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  avif: 'image/avif',
  heic: 'image/heic',
  tiff: 'image/tiff',
};

export const TYPE_LABEL: Record<SniffedType, string> = {
  pdf: 'PDF',
  png: 'PNG',
  jpeg: 'JPEG',
  gif: 'GIF',
  webp: 'WEBP',
  bmp: 'BMP',
  avif: 'AVIF',
  heic: 'HEIC',
  tiff: 'TIFF',
};

/** Image inputs AFlex accepts. Decoding still depends on the browser (see decodeImage). */
export const IMAGE_INPUTS: ImageType[] = ['png', 'jpeg', 'webp', 'gif', 'bmp', 'avif'];

export const PDF_ACCEPT = 'application/pdf,.pdf';
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif';

export interface RejectedFile {
  name: string;
  reason: string;
}

export interface ValidationResult<T> {
  accepted: T[];
  rejected: RejectedFile[];
}

export interface CheckedFile {
  id: string;
  file: File;
  type: SniffedType;
}

let counter = 0;
export function uid(prefix = 'f'): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}

/**
 * Validate a batch of picked files against what a tool accepts.
 * Size limits are checked first (cheap), then the real file signature.
 */
export async function validateFiles(
  files: File[],
  options: { kind: 'pdf' | 'image'; maxFiles: number; existingCount?: number; existingBytes?: number },
): Promise<ValidationResult<CheckedFile>> {
  const accepted: CheckedFile[] = [];
  const rejected: RejectedFile[] = [];
  let count = options.existingCount ?? 0;
  let total = options.existingBytes ?? 0;
  const maxBytes = options.kind === 'pdf' ? LIMITS.pdfFileBytes : LIMITS.imageFileBytes;

  for (const file of files) {
    if (count >= options.maxFiles) {
      rejected.push({ name: file.name, reason: `Limit of ${options.maxFiles} file${options.maxFiles === 1 ? '' : 's'} reached.` });
      continue;
    }
    if (file.size === 0) {
      rejected.push({ name: file.name, reason: 'The file is empty.' });
      continue;
    }
    if (file.size > maxBytes) {
      rejected.push({ name: file.name, reason: `Larger than the ${formatBytes(maxBytes)} per-file limit.` });
      continue;
    }
    if (options.kind === 'pdf' && total + file.size > LIMITS.pdfTotalBytes) {
      rejected.push({ name: file.name, reason: `Would exceed the ${formatBytes(LIMITS.pdfTotalBytes)} combined limit.` });
      continue;
    }
    let type: SniffedType | null;
    try {
      type = await sniffFile(file);
    } catch {
      rejected.push({ name: file.name, reason: 'The file could not be read.' });
      continue;
    }
    if (options.kind === 'pdf') {
      if (type !== 'pdf') {
        rejected.push({ name: file.name, reason: type ? `This is a ${TYPE_LABEL[type]} file, not a PDF.` : 'Not a PDF file (no PDF header found).' });
        continue;
      }
    } else if (!type || type === 'pdf') {
      rejected.push({ name: file.name, reason: type === 'pdf' ? 'This is a PDF — try PDF to Images instead.' : 'Not a recognised image file.' });
      continue;
    } else if (!IMAGE_INPUTS.includes(type)) {
      rejected.push({ name: file.name, reason: `${TYPE_LABEL[type]} images are not supported here. Convert it to JPEG or PNG on your device first.` });
      continue;
    }
    accepted.push({ id: uid(), file, type });
    count += 1;
    total += file.size;
  }
  return { accepted, rejected };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${units[unit]}`;
}

/** Signed percentage change from `before` to `after`, e.g. -42 for a 42% reduction. */
export function percentChange(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.round(((after - before) / before) * 1000) / 10;
}

export function baseName(name: string): string {
  const clean = name.replace(/[\\/:*?"<>|]+/g, '_').trim();
  const dot = clean.lastIndexOf('.');
  const stem = dot > 0 ? clean.slice(0, dot) : clean;
  return stem || 'file';
}

export function withSuffix(name: string, suffix: string, extension: string): string {
  return `${baseName(name)}${suffix}.${extension}`;
}

/** Ensure names inside a ZIP are unique. */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count === 0) return name;
    const dot = name.lastIndexOf('.');
    return dot > 0 ? `${name.slice(0, dot)} (${count + 1})${name.slice(dot)}` : `${name} (${count + 1})`;
  });
}

export function triggerDownload(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function readBytes(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/**
 * Yield to the event loop so the UI (and progress) can repaint during long loops.
 * Uses a MessageChannel task rather than requestAnimationFrame, which browsers
 * pause in background tabs — processing keeps going if the user switches away.
 */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof MessageChannel === 'function') {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        resolve();
      };
      channel.port2.postMessage(null);
    } else setTimeout(resolve, 0);
  });
}

export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}

export function errorMessage(error: unknown, fallback = 'Something went wrong while processing the file.'): string {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof DOMException && error.name === 'AbortError') return 'Cancelled.';
  const raw = error instanceof Error ? error.message : '';
  if (/encrypt/i.test(raw)) return 'This PDF is encrypted or password-protected. AFlex can’t modify protected PDFs — remove the protection in the app that created it, then try again.';
  if (/password/i.test(raw)) return 'This PDF needs a password to open. AFlex can’t process password-protected PDFs.';
  if (/Invalid PDF|Failed to parse|No PDF header|startxref|xref/i.test(raw)) return 'This PDF appears to be damaged or isn’t a valid PDF.';
  if (/memory|allocation|Array buffer/i.test(raw)) return 'Your browser ran out of memory. Try a smaller file or fewer pages at once.';
  return fallback;
}
