import type { SegmentOption } from '../../components/workspace/Controls';
import type { ImageType } from '../../lib/files';
import { OUTPUT_LABEL, type OutputFormat } from '../../lib/image/canvas';

type Support = Record<OutputFormat, boolean> | null;

const HINT: Record<OutputFormat, string> = {
  png: 'lossless',
  jpeg: 'universal',
  webp: 'smaller',
  avif: 'smallest',
};

/** Output format choices, with formats this browser can't encode disabled and explained. */
export function formatOptions(support: Support, formats: OutputFormat[] = ['png', 'jpeg', 'webp', 'avif']): SegmentOption<OutputFormat>[] {
  return formats
    // AVIF encoding is rare; hide it entirely rather than showing a dead option when unsupported.
    .filter((format) => format !== 'avif' || support?.avif)
    .map((format) => ({
      value: format,
      label: OUTPUT_LABEL[format],
      hint: support && !support[format] ? 'not in this browser' : HINT[format],
      disabled: Boolean(support && !support[format]),
    }));
}

/** The closest encodable format to an input type ("keep format"). */
export function sameFormat(type: ImageType, support: Support): OutputFormat {
  if (type === 'jpeg') return 'jpeg';
  if (type === 'webp') return support?.webp ? 'webp' : 'png';
  if (type === 'avif') return support?.avif ? 'avif' : 'jpeg';
  return 'png'; // png, gif, bmp
}

export function supportedList(support: Support): string {
  if (!support) return 'PNG, JPEG';
  return (['png', 'jpeg', 'webp', 'avif'] as OutputFormat[])
    .filter((format) => support[format])
    .map((format) => OUTPUT_LABEL[format])
    .join(', ');
}
