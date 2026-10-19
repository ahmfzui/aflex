import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { RangeField, Segmented } from '../../components/workspace/Controls';
import { DropZone } from '../../components/workspace/DropZone';
import { Notice, RejectedList } from '../../components/workspace/Feedback';
import { ResultPanel } from '../../components/workspace/ResultPanel';
import { ToolShell } from '../../components/workspace/ToolShell';
import { useEncoderSupport } from '../../hooks/useEncoderSupport';
import { useImageList } from '../../hooks/useImages';
import { useRunner } from '../../hooks/useRunner';
import { TYPE_LABEL, baseName, formatBytes } from '../../lib/files';
import { LOSSY, OUTPUT_EXT, OUTPUT_LABEL, decodeImage, drawImage, encodeCanvas, releaseCanvas, type OutputFormat } from '../../lib/image/canvas';
import type { ToolProps } from '../types';
import { formatOptions, sameFormat } from './formats';
import { ImageStage } from './ImageStage';

type Target = 'same' | OutputFormat;
type Angle = 0 | 90 | 180 | 270;
const PREVIEW_MAX = 1000;

export default function RotateImage({ tool }: ToolProps) {
  const runner = useRunner();
  const support = useEncoderSupport();
  const { items, add, clear, rejected, clearRejected, checking } = useImageList(runner, 1);
  const item = items[0];
  const [angle, setAngle] = useState<Angle>(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [target, setTarget] = useState<Target>('same');
  const [quality, setQuality] = useState(92);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const small = useRef<{ id: string; canvas: HTMLCanvasElement } | null>(null);

  // Exact preview: transform a downscaled copy with the same code used for export.
  useEffect(() => {
    if (!item) return;
    let alive = true;
    let url: string | null = null;
    (async () => {
      try {
        if (small.current?.id !== item.id) {
          const decoded = await decodeImage(item.file);
          const scale = Math.min(1, PREVIEW_MAX / Math.max(decoded.width, decoded.height));
          const canvas = drawImage(decoded.bitmap, { width: decoded.width * scale, height: decoded.height * scale });
          decoded.bitmap.close();
          if (small.current) releaseCanvas(small.current.canvas);
          small.current = { id: item.id, canvas };
        }
        const transformed = drawImage(small.current.canvas, { rotate: angle, flipH, flipV });
        const blob = await encodeCanvas(transformed, 'png');
        releaseCanvas(transformed);
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setPreview(url);
        setPreviewError(null);
      } catch (error) {
        if (alive) setPreviewError(error instanceof Error ? error.message : 'Preview failed.');
      }
    })();
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item, angle, flipH, flipV]);

  useEffect(
    () => () => {
      if (small.current) releaseCanvas(small.current.canvas);
    },
    [],
  );

  const load = (files: File[]) => {
    setAngle(0);
    setFlipH(false);
    setFlipV(false);
    void add(files.slice(0, 1), true);
  };

  // Flips are applied after rotation, so with a single mirror active a clockwise
  // turn on screen is a counter-clockwise change to the stored angle.
  const turn = (delta: number) =>
    change(() => setAngle(((((angle + (flipH !== flipV ? -delta : delta)) % 360) + 360) % 360) as Angle));

  const change = (fn: () => void) => {
    runner.reset();
    fn();
  };

  const format: OutputFormat = item ? (target === 'same' ? sameFormat(item.type, support) : target) : 'png';
  const changed = angle !== 0 || flipH || flipV;

  const save = () =>
    runner.run('Applying transformation…', async () => {
      if (!item) return [];
      const decoded = await decodeImage(item.file);
      const canvas = drawImage(decoded.bitmap, { rotate: angle, flipH, flipV, background: format === 'jpeg' ? '#ffffff' : null });
      decoded.bitmap.close();
      const blob = await encodeCanvas(canvas, format, quality / 100);
      const out = { name: `${baseName(item.file.name)}-edited.${OUTPUT_EXT[format]}`, blob, sourceBytes: item.file.size, width: canvas.width, height: canvas.height };
      releaseCanvas(canvas);
      return [out];
    });

  const description = [angle ? `rotated ${angle}°` : '', flipH ? 'flipped horizontally' : '', flipV ? 'flipped vertically' : ''].filter(Boolean).join(', ') || 'unchanged';

  return (
    <ToolShell
      tool={tool}
      runner={runner}
      hasInput={Boolean(item)}
      intake={<DropZone kind="image" multiple={false} onFiles={load} busy={checking} />}
      notices={<RejectedList rejected={rejected} onDismiss={clearRejected} />}
      briefing={[
        'Load one image. The preview shows exactly what will be exported.',
        'Rotate in 90° steps and mirror horizontally or vertically, in any combination.',
        'Exporting re-encodes the image; JPEG/WebP use the quality you set. Embedded metadata isn’t copied.',
      ]}
      status={item ? `Preview: ${description}` : undefined}
      action={{ label: 'Export image', onClick: save, disabled: !item || !changed || Boolean(item.error), reason: item?.error ?? (item ? 'Rotate or flip the image first.' : 'Add an image first.') }}
      onClear={clear}
      clearLabel="Use a different image"
      settings={
        <>
          <div className="field">
            <span className="field__label">Rotate</span>
            <div className="presets">
              <button type="button" className="tbtn" onClick={() => turn(-90)}>
                <Icon name="rotateLeft" size={16} /> Left 90°
              </button>
              <button type="button" className="tbtn" onClick={() => turn(90)}>
                <Icon name="rotate" size={16} /> Right 90°
              </button>
              <button type="button" className="tbtn" onClick={() => turn(180)}>
                180°
              </button>
            </div>
          </div>
          <div className="field">
            <span className="field__label">Flip</span>
            <div className="presets">
              <button type="button" className="tbtn" aria-pressed={flipH} onClick={() => change(() => setFlipH(!flipH))}>
                <Icon name="flipH" size={16} /> Horizontal
              </button>
              <button type="button" className="tbtn" aria-pressed={flipV} onClick={() => change(() => setFlipV(!flipV))}>
                <Icon name="flipV" size={16} /> Vertical
              </button>
            </div>
          </div>
          <button
            type="button"
            className="tbtn"
            disabled={!changed}
            onClick={() =>
              change(() => {
                setAngle(0);
                setFlipH(false);
                setFlipV(false);
              })
            }
          >
            <Icon name="undo" size={14} /> Reset
          </button>
          <Segmented<Target>
            legend="Output format"
            value={target}
            onChange={(value) => change(() => setTarget(value))}
            options={[{ value: 'same', label: 'Keep', hint: item ? OUTPUT_LABEL[sameFormat(item.type, support)] : 'same' }, ...formatOptions(support)]}
          />
          {LOSSY[format] && <RangeField label="Quality" value={quality} min={40} max={100} onChange={setQuality} />}
        </>
      }
      result={<ResultPanel outputs={runner.outputs} compare previews zipName="edited.zip" onReset={runner.reset} resetLabel="Keep editing" />}
    >
      {item && (
        <>
          {preview ? (
            <ImageStage
              url={preview}
              alt={`Preview of ${item.file.name}, ${description}`}
              tag={changed ? 'Preview' : 'Original'}
              meta={`${TYPE_LABEL[item.type]} · ${item.width ? `${angle % 180 ? `${item.height}×${item.width}` : `${item.width}×${item.height}`}px` : '…'} · ${formatBytes(item.file.size)}`}
            />
          ) : (
            <div className="loading-block" role="status">
              <p className="mono">{previewError ?? item.error ?? 'Preparing preview…'}</p>
            </div>
          )}
          {(item.error || previewError) && (
            <Notice tone="error" role="alert" title="Can’t decode this image">
              {item.error ?? previewError}
            </Notice>
          )}
        </>
      )}
    </ToolShell>
  );
}
