import { useState } from 'react';
import { CompareView } from '../../components/workspace/CompareView';
import { RangeField, Segmented } from '../../components/workspace/Controls';
import { DropZone } from '../../components/workspace/DropZone';
import { Notice, RejectedList } from '../../components/workspace/Feedback';
import { FileList } from '../../components/workspace/FileList';
import { ResultPanel } from '../../components/workspace/ResultPanel';
import { ToolShell } from '../../components/workspace/ToolShell';
import { useEncoderSupport } from '../../hooks/useEncoderSupport';
import { useImageList } from '../../hooks/useImages';
import { throwIfAborted, useRunner, type OutputSpec } from '../../hooks/useRunner';
import { LIMITS, TYPE_LABEL, baseName, formatBytes, nextFrame } from '../../lib/files';
import { LOSSY, OUTPUT_EXT, OUTPUT_LABEL, decodeImage, drawImage, encodeCanvas, releaseCanvas, type OutputFormat } from '../../lib/image/canvas';
import type { ToolProps } from '../types';
import { formatOptions, sameFormat } from './formats';

type Target = 'same' | OutputFormat;
type MaxSide = 'none' | '3840' | '2560' | '1920' | '1280';

export default function CompressImage({ tool }: ToolProps) {
  const runner = useRunner();
  const support = useEncoderSupport();
  const { items, add, remove, move, clear, rejected, clearRejected, checking } = useImageList(runner, LIMITS.imageFiles);
  const [target, setTarget] = useState<Target>('same');
  const [quality, setQuality] = useState(75);
  const [maxSide, setMaxSide] = useState<MaxSide>('none');
  const [compareIndex, setCompareIndex] = useState(0);

  const resolve = (type: (typeof items)[number]['type']): OutputFormat => (target === 'same' ? sameFormat(type, support) : target);
  const anyLossy = items.some((item) => LOSSY[resolve(item.type)]);
  const pngOut = items.some((item) => resolve(item.type) === 'png');

  const compress = () =>
    runner.run('Compressing…', async ({ report, signal }) => {
      setCompareIndex(0);
      const outputs: OutputSpec[] = [];
      for (let i = 0; i < items.length; i += 1) {
        throwIfAborted(signal);
        const item = items[i];
        report(i / items.length, `Compressing ${item.file.name} (${i + 1} of ${items.length})…`);
        const format = resolve(item.type);
        const decoded = await decodeImage(item.file);
        let width = decoded.width;
        let height = decoded.height;
        if (maxSide !== 'none') {
          const limit = Number(maxSide);
          const scale = Math.min(1, limit / Math.max(width, height));
          width = Math.max(1, Math.round(width * scale));
          height = Math.max(1, Math.round(height * scale));
        }
        const canvas = drawImage(decoded.bitmap, { width, height, background: format === 'jpeg' ? '#ffffff' : null });
        decoded.bitmap.close();
        const blob = await encodeCanvas(canvas, format, quality / 100);
        outputs.push({
          name: `${baseName(item.file.name)}-compressed.${OUTPUT_EXT[format]}`,
          blob,
          sourceBytes: item.file.size,
          width: canvas.width,
          height: canvas.height,
          note: blob.size >= item.file.size ? 'Not smaller — keep the original' : undefined,
        });
        releaseCanvas(canvas);
        await nextFrame();
      }
      return outputs;
    });

  const broken = items.some((item) => item.error);
  const compareOutput = runner.outputs[compareIndex];
  const compareSource = items[compareIndex];

  return (
    <ToolShell
      tool={tool}
      runner={runner}
      hasInput={items.length > 0}
      intake={<DropZone kind="image" multiple onFiles={add} busy={checking} />}
      notices={<RejectedList rejected={rejected} onDismiss={clearRejected} />}
      briefing={[
        'Images are re-encoded by your browser at the quality you choose — nothing is uploaded.',
        'Real before/after sizes are shown only after processing. Some files won’t get smaller; AFlex will say so.',
        'Optionally cap the longest side — fewer pixels is often the biggest saving.',
        'Re-encoding drops embedded metadata such as EXIF and GPS.',
      ]}
      status={`${items.length} image${items.length === 1 ? '' : 's'} · quality ${quality}${maxSide !== 'none' ? ` · max ${maxSide}px` : ''}`}
      action={{
        label: 'Compress images',
        onClick: compress,
        disabled: items.length === 0 || broken,
        reason: broken ? 'Remove images your browser can’t decode first.' : 'Add at least one image.',
      }}
      onClear={clear}
      clearLabel="Remove all images"
      settings={
        <>
          <Segmented<Target>
            legend="Output format"
            value={target}
            onChange={(value) => {
              runner.reset();
              setTarget(value);
            }}
            options={[{ value: 'same', label: 'Keep', hint: 'same type' }, ...formatOptions(support, ['jpeg', 'webp', 'avif'])]}
          />
          {anyLossy && <RangeField label="Quality" value={quality} min={10} max={95} step={1} onChange={setQuality} hint="Lower = smaller files with more visible artifacts. 70–80 is a good start." />}
          {pngOut && (
            <Notice tone="warn" title="PNG stays lossless">
              PNG output ignores the quality setting; re-saving a PNG rarely makes it smaller. Pick JPEG or WebP for real savings (JPEG
              drops transparency), or cap the dimensions below.
            </Notice>
          )}
          <Segmented<MaxSide>
            legend="Longest side"
            value={maxSide}
            onChange={(value) => {
              runner.reset();
              setMaxSide(value);
            }}
            options={[
              { value: 'none', label: 'Original' },
              { value: '3840', label: '3840' },
              { value: '2560', label: '2560' },
              { value: '1920', label: '1920' },
              { value: '1280', label: '1280' },
            ]}
          />
        </>
      }
      result={
        <ResultPanel outputs={runner.outputs} compare zipName="compressed-images.zip" onReset={runner.reset} resetLabel="Try other settings">
          {compareOutput && compareSource && (
            <div className="field">
              {runner.outputs.length > 1 && (
                <label className="field__label">
                  Compare
                  <select className="input" value={compareIndex} onChange={(event) => setCompareIndex(Number(event.target.value))} style={{ marginTop: 6 }}>
                    {runner.outputs.map((output, index) => (
                      <option key={output.id} value={index}>
                        {output.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <CompareView before={compareSource.url} after={compareOutput.url} label={compareSource.file.name} />
              <p className="mono muted">
                {OUTPUT_LABEL[resolve(compareSource.type)]} · {formatBytes(compareSource.file.size)} → {formatBytes(compareOutput.blob.size)}
              </p>
            </div>
          )}
        </ResultPanel>
      }
    >
      <div className="ws-section-title">
        <h2>Images</h2>
        <p className="mono muted">{items.length} queued</p>
      </div>
      <FileList
        label="Images to compress"
        items={items.map((item) => ({
          id: item.id,
          name: item.file.name,
          thumb: item.url,
          meta: `${TYPE_LABEL[item.type]} → ${OUTPUT_LABEL[resolve(item.type)]} · ${formatBytes(item.file.size)}${item.width ? ` · ${item.width}×${item.height}px` : ''}`,
          warning: item.error,
        }))}
        onMove={move}
        onRemove={remove}
        disabled={runner.phase === 'working'}
      />
      <DropZone kind="image" multiple compact onFiles={add} busy={checking} compactLabel="Add images" />
    </ToolShell>
  );
}
