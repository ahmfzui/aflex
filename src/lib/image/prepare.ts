import { LIMITS, UserFacingError, readBytes, type ImageType } from '../files';
import type { ImagePageInput } from '../pdf/ops';
import { decodeImage, drawImage, encodeCanvas, hasTransparency, readDimensions, releaseCanvas } from './canvas';
import { extractExifTiff, jpegComponentCount, readTiffOrientation } from './metadata';

/**
 * Turn any supported image into JPEG or PNG bytes that pdf-lib can embed.
 * Plain RGB/greyscale JPEGs with no rotation flag are embedded untouched
 * (no quality loss); everything else is decoded and re-encoded by the browser,
 * which also applies EXIF orientation.
 */
export async function imageForPdf(file: File, type: ImageType): Promise<ImagePageInput> {
  const { width, height } = await readDimensions(file);
  if (width * height > LIMITS.imagePixels) {
    throw new UserFacingError(`${file.name} is too large (${width}×${height}) to process in the browser.`);
  }

  if (type === 'jpeg') {
    const bytes = await readBytes(file);
    let orientation: number | null = null;
    try {
      const tiff = extractExifTiff(bytes, 'jpeg');
      orientation = tiff ? readTiffOrientation(tiff) : null;
    } catch {
      orientation = null;
    }
    const components = jpegComponentCount(bytes);
    if ((orientation === null || orientation === 1) && (components === 1 || components === 3)) {
      return { bytes, format: 'jpeg', width, height };
    }
  }

  const decoded = await decodeImage(file);
  try {
    const alpha = type !== 'jpeg' && hasTransparency(decoded.bitmap);
    const canvas = drawImage(decoded.bitmap, { background: alpha ? null : '#ffffff' });
    const blob = await encodeCanvas(canvas, alpha ? 'png' : 'jpeg', 0.92);
    const result: ImagePageInput = {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      format: alpha ? 'png' : 'jpeg',
      width: canvas.width,
      height: canvas.height,
    };
    releaseCanvas(canvas);
    return result;
  } finally {
    decoded.bitmap.close();
  }
}
