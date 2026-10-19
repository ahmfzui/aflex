import { useState } from 'react';
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
import { formatOptions, supportedList } from './formats';

type Background = '#ffffff' | '#000000';

export default function ConvertImage({ tool }: ToolProps) {
  const runner = useRunner();
  const support = useEncoderSupport();
  const { items, add, remove, move, clear, rejected, clearRejected, checking } = useImageList(runner, LIMITS.imageFiles);
  const [format, setFormat] = useState<OutputFormat>('jpeg');
  const [quality, setQuality] = useState(90);
  const [background, setBackground] = useState<Background>('#ffffff');

  const animated = items.some((item) => item.type === 'gif' || item.type === 'webp');

  const convert = () =>
    runner.run('Converting…', async ({ report, signal }) => {
      const outputs: OutputSpec[] = [];
      for (let i = 0; i < items.length; i += 1) {
        throwIfAborted(signal);
        const item = items[i];
        report(i / items.length, `Converting ${item.file.name} (${i + 1} of ${items.length})…`);
        const decoded = await decodeImage(item.file);
        const canvas = drawImage(decoded.bitmap, { background: format === 'jpeg' ? background : null });
        decoded.bitmap.close();
        const blob = await encodeCanvas(canvas, format, quality / 100);
        outputs.push({ name: `${baseName(item.file.name)}.${OUTPUT_EXT[format]}`, blob, sourceBytes: item.file.size, width: canvas.width, height: canvas.height });
        releaseCanvas(canvas);
        await nextFrame();
      }
      return outputs;
    });

  const broken = items.some((item) => item.error);

  return (
    <ToolShell
      tool={tool}
      runner={runner}
      hasInput={items.length > 0}
      intake={<DropZone kind="image" multiple onFiles={add} busy={checking} />}
      notices={<RejectedList rejected={rejected} onDismiss={clearRejected} />}
      briefing={[
        'Reads PNG, JPEG, WebP, GIF, BMP and AVIF (decoding depends on your browser).',
        `Writes ${supportedList(support)} — the formats this browser can actually encode.`,
        'JPEG has no transparency, so transparent areas are filled with the colour you choose.',
        'Animated GIF/WebP become a single still frame. Embedded metadata (EXIF, GPS…) isn’t copied to the new file.',
      ]}
      status={`${items.length} image${items.length === 1 ? '' : 's'} → ${OUTPUT_LABEL[format]}`}
      action={{
        label: `Convert to ${OUTPUT_LABEL[format]}`,
        onClick: convert,
        disabled: items.length === 0 || broken,
        reason: broken ? 'Remove images your browser can’t decode first.' : 'Add at least one image.',
      }}
      onClear={clear}
      clearLabel="Remove all images"
      settings={
        <>
          <Segmented<OutputFormat>
            legend="Convert to"
            value={format}
            onChange={(value) => {
              runner.reset();
              setFormat(value);
            }}
            options={formatOptions(support)}
          />
          {LOSSY[format] && (
            <RangeField label="Quality" value={quality} min={40} max={100} step={1} onChange={setQuality} hint="Higher = better looking and larger." />
          )}
          {format === 'jpeg' && (
            <Segmented<Background>
              legend="Fill transparency with"
              value={background}
              onChange={setBackground}
              options={[
                { value: '#ffffff', label: 'White' },
                { value: '#000000', label: 'Black' },
              ]}
            />
          )}
          {animated && (
            <Notice tone="info" title="Animation">
              GIF and WebP animations are flattened to their first frame.
            </Notice>
          )}
        </>
      }
      result={<ResultPanel outputs={runner.outputs} compare previews zipName="converted-images.zip" onReset={runner.reset} resetLabel="Convert again" />}
    >
      <div className="ws-section-title">
        <h2>Images</h2>
        <p className="mono muted">{items.length} queued</p>
      </div>
      <FileList
        label="Images to convert"
        items={items.map((item) => ({
          id: item.id,
          name: item.file.name,
          thumb: item.url,
          meta: `${TYPE_LABEL[item.type]} · ${formatBytes(item.file.size)}${item.width ? ` · ${item.width}×${item.height}px` : ''}`,
          warning: item.error,
        }))}
        orderable={false}
        onMove={move}
        onRemove={remove}
        disabled={runner.phase === 'working'}
      />
      <DropZone kind="image" multiple compact onFiles={add} busy={checking} compactLabel="Add images" />
    </ToolShell>
  );
}
