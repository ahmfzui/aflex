import { useId, useState } from 'react';
import { Icon } from '../../components/Icon';
import { RangeField, Segmented } from '../../components/workspace/Controls';
import { DropZone } from '../../components/workspace/DropZone';
import { Notice, RejectedList } from '../../components/workspace/Feedback';
import { ResultPanel } from '../../components/workspace/ResultPanel';
import { ToolShell } from '../../components/workspace/ToolShell';
import { useEncoderSupport } from '../../hooks/useEncoderSupport';
import { useImageList } from '../../hooks/useImages';
import { useRunner } from '../../hooks/useRunner';
import { LIMITS, TYPE_LABEL, baseName, formatBytes } from '../../lib/files';
import { LOSSY, OUTPUT_EXT, OUTPUT_LABEL, decodeImage, drawImage, encodeCanvas, releaseCanvas, type OutputFormat } from '../../lib/image/canvas';
import type { ToolProps } from '../types';
import { formatOptions, sameFormat } from './formats';
import { ImageStage } from './ImageStage';

type Target = 'same' | OutputFormat;

const PERCENTS = [25, 50, 75, 150, 200];
const LONG_EDGES = [3840, 1920, 1280, 800, 512];

export default function ResizeImage({ tool }: ToolProps) {
  const runner = useRunner();
  const support = useEncoderSupport();
  const { items, add, clear, rejected, clearRejected, checking } = useImageList(runner, 1);
  const item = items[0];
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [lock, setLock] = useState(true);
  const [target, setTarget] = useState<Target>('same');
  const [quality, setQuality] = useState(90);
  const widthId = useId();
  const heightId = useId();

  const srcW = item?.width ?? 0;
  const srcH = item?.height ?? 0;
  const ratio = srcW && srcH ? srcW / srcH : 1;

  // Initialise the fields once the image's dimensions are known.
  const [initFor, setInitFor] = useState<string | null>(null);
  if (item && srcW && initFor !== item.id) {
    setInitFor(item.id);
    setWidth(String(srcW));
    setHeight(String(srcH));
  }

  const load = (files: File[]) => void add(files.slice(0, 1), true);

  const set = (w: number, h: number) => {
    runner.reset();
    setWidth(String(Math.max(1, Math.round(w))));
    setHeight(String(Math.max(1, Math.round(h))));
  };

  const onWidth = (value: string) => {
    runner.reset();
    setWidth(value);
    const n = Number(value);
    if (lock && n > 0) setHeight(String(Math.max(1, Math.round(n / ratio))));
  };
  const onHeight = (value: string) => {
    runner.reset();
    setHeight(value);
    const n = Number(value);
    if (lock && n > 0) setWidth(String(Math.max(1, Math.round(n * ratio))));
  };

  const w = Number(width);
  const h = Number(height);
  const format: OutputFormat = item ? (target === 'same' ? sameFormat(item.type, support) : target) : 'png';
  let error: string | null = null;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) error = 'Width and height must be whole numbers of at least 1 px.';
  else if (w > LIMITS.outputSide || h > LIMITS.outputSide) error = `Each side must be ${LIMITS.outputSide.toLocaleString()} px or less.`;
  else if (w * h > LIMITS.outputPixels) error = `That’s ${Math.round((w * h) / 1e6)} MP — the limit is ${LIMITS.outputPixels / 1e6} MP.`;
  const upscale = !error && (w > srcW || h > srcH);
  const unchanged = w === srcW && h === srcH && target === 'same';

  const resize = () =>
    runner.run('Resizing…', async () => {
      if (!item) return [];
      const decoded = await decodeImage(item.file);
      const canvas = drawImage(decoded.bitmap, { width: w, height: h, background: format === 'jpeg' ? '#ffffff' : null });
      decoded.bitmap.close();
      const blob = await encodeCanvas(canvas, format, quality / 100);
      releaseCanvas(canvas);
      return [{ name: `${baseName(item.file.name)}-${w}x${h}.${OUTPUT_EXT[format]}`, blob, sourceBytes: item.file.size, width: w, height: h }];
    });

  const reason = !item ? 'Add an image first.' : item.error ? item.error : !srcW ? 'Reading image size…' : error ? error : unchanged ? 'Change the size or format first.' : undefined;

  return (
    <ToolShell
      tool={tool}
      runner={runner}
      hasInput={Boolean(item)}
      intake={<DropZone kind="image" multiple={false} onFiles={load} busy={checking} />}
      notices={<RejectedList rejected={rejected} onDismiss={clearRejected} />}
      briefing={[
        'Load one image, then type exact pixel dimensions or use a preset.',
        'Keep the aspect-ratio lock on to avoid stretching.',
        'Downscaling uses multi-step high-quality resampling in your browser.',
        'Enlarging can’t add real detail — it only makes pixels bigger.',
      ]}
      status={item && srcW ? `${srcW}×${srcH} → ${error ? '?' : `${w}×${h}`} ${OUTPUT_LABEL[format]}` : undefined}
      action={{ label: 'Resize image', onClick: resize, disabled: Boolean(reason), reason }}
      onClear={clear}
      clearLabel="Use a different image"
      settings={
        <>
          <div className="dims">
            <div className="field">
              <label className="field__label" htmlFor={widthId}>
                Width (px)
              </label>
              <input id={widthId} className="input" type="number" inputMode="numeric" min={1} max={LIMITS.outputSide} value={width} onChange={(event) => onWidth(event.target.value)} aria-invalid={Boolean(error)} />
            </div>
            <button
              type="button"
              className="tbtn tbtn--icon dims__lock"
              aria-pressed={lock}
              onClick={() => {
                const next = !lock;
                setLock(next);
                if (next && w > 0) set(w, w / ratio);
              }}
              title={lock ? 'Aspect ratio locked' : 'Aspect ratio unlocked'}
            >
              <Icon name="lock" size={16} />
              <span className="sr-only">Lock aspect ratio</span>
            </button>
            <div className="field">
              <label className="field__label" htmlFor={heightId}>
                Height (px)
              </label>
              <input id={heightId} className="input" type="number" inputMode="numeric" min={1} max={LIMITS.outputSide} value={height} onChange={(event) => onHeight(event.target.value)} aria-invalid={Boolean(error)} />
            </div>
          </div>
          {error && (
            <p className="field__error" role="alert">
              {error}
            </p>
          )}
          <div className="field">
            <span className="field__label">Scale</span>
            <div className="presets">
              {PERCENTS.map((p) => (
                <button key={p} type="button" className="tbtn" onClick={() => set((srcW * p) / 100, (srcH * p) / 100)} disabled={!srcW}>
                  {p}%
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field__label">Longest side</span>
            <div className="presets">
              {LONG_EDGES.map((edge) => (
                <button
                  key={edge}
                  type="button"
                  className="tbtn"
                  disabled={!srcW}
                  onClick={() => (srcW >= srcH ? set(edge, edge / ratio) : set(edge * ratio, edge))}
                >
                  {edge}
                </button>
              ))}
            </div>
          </div>
          <Segmented<Target>
            legend="Output format"
            value={target}
            onChange={(value) => {
              runner.reset();
              setTarget(value);
            }}
            options={[{ value: 'same', label: 'Keep', hint: item ? OUTPUT_LABEL[sameFormat(item.type, support)] : 'same' }, ...formatOptions(support)]}
          />
          {LOSSY[format] && <RangeField label="Quality" value={quality} min={40} max={100} onChange={setQuality} />}
          {upscale && (
            <Notice tone="warn" title="Enlarging">
              The output is bigger than the original. Expect a softer image — no detail is added.
            </Notice>
          )}
        </>
      }
      result={<ResultPanel outputs={runner.outputs} compare zipName="resized.zip" onReset={runner.reset} resetLabel="Try another size" />}
    >
      {item && (
        <>
          <ImageStage url={item.url} alt={`Preview of ${item.file.name}`} tag="Original" meta={`${TYPE_LABEL[item.type]} · ${srcW ? `${srcW}×${srcH}px` : '…'} · ${formatBytes(item.file.size)}`} />
          {item.error && <Notice tone="error" role="alert" title="Can’t decode this image">{item.error}</Notice>}
          <div className="out-dims" aria-live="polite">
            <span>
              OUTPUT <strong>{error ? '—' : `${w} × ${h}px`}</strong>
            </span>
            <span>{OUTPUT_LABEL[format]}</span>
          </div>
        </>
      )}
    </ToolShell>
  );
}
