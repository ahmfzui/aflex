/**
 * Image decoding, drawing and encoding through the browser's own codecs.
 */
import { LIMITS, UserFacingError, formatBytes } from '../files';

export type OutputFormat = 'png' | 'jpeg' | 'webp' | 'avif';

export const OUTPUT_MIME: Record<OutputFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
};

export const OUTPUT_EXT: Record<OutputFormat, string> = { png: 'png', jpeg: 'jpg', webp: 'webp', avif: 'avif' };
export const OUTPUT_LABEL: Record<OutputFormat, string> = { png: 'PNG', jpeg: 'JPEG', webp: 'WEBP', avif: 'AVIF' };
export const LOSSY: Record<OutputFormat, boolean> = { png: false, jpeg: true, webp: true, avif: true };

let supportPromise: Promise<Record<OutputFormat, boolean>> | null = null;

/**
 * Which formats this browser can actually encode. A browser that can't encode
 * a type silently returns PNG from toBlob, so we check the blob's real type.
 */
export function encoderSupport(): Promise<Record<OutputFormat, boolean>> {
  supportPromise ??= (async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    canvas.getContext('2d')?.fillRect(0, 0, 2, 2);
    const check = (mime: string) =>
      new Promise<boolean>((resolve) => {
        try {
          canvas.toBlob((blob) => resolve(blob?.type === mime), mime, 0.8);
        } catch {
          resolve(false);
        }
      });
    const [webp, avif] = await Promise.all([check('image/webp'), check('image/avif')]);
    return { png: true, jpeg: true, webp, avif };
  })();
  return supportPromise;
}

export interface DecodedImage {
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

/** Read an image's display dimensions (EXIF orientation applied) without a full decode. */
export function readDimensions(file: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new UserFacingError('Your browser couldn’t decode this image. It may be damaged or in a format this browser doesn’t support.'));
    };
    img.src = url;
  });
}

/** Fully decode an image, applying EXIF orientation, with a pixel-count guard. */
export async function decodeImage(file: Blob): Promise<DecodedImage> {
  const { width, height } = await readDimensions(file);
  if (!width || !height) throw new UserFacingError('This image has no readable dimensions.');
  if (width * height > LIMITS.imagePixels) {
    throw new UserFacingError(
      `This image is ${width}×${height} (${Math.round((width * height) / 1e6)} MP), above the ${LIMITS.imagePixels / 1e6} MP limit for in-browser processing.`,
    );
  }
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    throw new UserFacingError('Your browser couldn’t decode this image. It may be damaged or in a format this browser doesn’t support.');
  }
}

export function makeCanvas(width: number, height: number): HTMLCanvasElement {
  if (width > LIMITS.outputSide || height > LIMITS.outputSide || width * height > LIMITS.outputPixels) {
    throw new UserFacingError(`${width}×${height} is too large. Keep each side under ${LIMITS.outputSide.toLocaleString()} px and the total under ${LIMITS.outputPixels / 1e6} MP.`);
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function context(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new UserFacingError('Your browser couldn’t create a drawing surface. Try a smaller image.');
  return ctx;
}

/** Free a canvas's backing memory immediately (helps Safari/iOS). */
export function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

export interface DrawOptions {
  width?: number;
  height?: number;
  /** Clockwise, multiples of 90. Applied before flips. */
  rotate?: 0 | 90 | 180 | 270;
  flipH?: boolean;
  flipV?: boolean;
  /** Fill behind the image (needed for JPEG, which has no transparency). */
  background?: string | null;
}

/**
 * Draw a source onto a new canvas, optionally resized, rotated and flipped.
 * Large downscales are done in halving steps for better quality.
 */
export function drawImage(source: CanvasImageSource & { width: number; height: number }, options: DrawOptions = {}): HTMLCanvasElement {
  const rotate = options.rotate ?? 0;
  const targetW = Math.max(1, Math.round(options.width ?? source.width));
  const targetH = Math.max(1, Math.round(options.height ?? source.height));

  // Step-down resampling for big reductions.
  let current: CanvasImageSource & { width: number; height: number } = source;
  const temps: HTMLCanvasElement[] = [];
  while (current.width / 2 >= targetW && current.height / 2 >= targetH) {
    const step = makeCanvas(Math.round(current.width / 2), Math.round(current.height / 2));
    const stepCtx = context(step);
    stepCtx.imageSmoothingQuality = 'high';
    stepCtx.drawImage(current, 0, 0, step.width, step.height);
    temps.push(step);
    current = step;
  }

  const sideways = rotate === 90 || rotate === 270;
  const canvas = makeCanvas(sideways ? targetH : targetW, sideways ? targetW : targetH);
  const ctx = context(canvas);
  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // Rotation is applied to the image first, then flips mirror the rotated result
  // (canvas transforms apply to the drawing in reverse order of these calls).
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(options.flipH ? -1 : 1, options.flipV ? -1 : 1);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.drawImage(current, -targetW / 2, -targetH / 2, targetW, targetH);
  for (const temp of temps) releaseCanvas(temp);
  return canvas;
}

export function encodeCanvas(canvas: HTMLCanvasElement, format: OutputFormat, quality = 0.85): Promise<Blob> {
  const mime = OUTPUT_MIME[format];
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new UserFacingError(`Your browser couldn’t encode a ${canvas.width}×${canvas.height} image. Try a smaller size.`));
          } else if (blob.type !== mime) {
            reject(new UserFacingError(`This browser can’t encode ${OUTPUT_LABEL[format]} images. Choose another format.`));
          } else resolve(blob);
        },
        mime,
        LOSSY[format] ? quality : undefined,
      );
    } catch {
      reject(new UserFacingError('Encoding failed — the image may be too large for this browser.'));
    }
  });
}

/** Does the decoded image contain any non-opaque pixel? Sampled for speed. */
export function hasTransparency(bitmap: ImageBitmap): boolean {
  const size = 256;
  const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  releaseCanvas(canvas);
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
}

export function describeSize(width: number, height: number, bytes?: number): string {
  return `${width} × ${height}px${bytes !== undefined ? ` · ${formatBytes(bytes)}` : ''}`;
}
