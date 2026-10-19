import { useId, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Field, Segmented } from '../../components/workspace/Controls';
import { DropZone } from '../../components/workspace/DropZone';
import { RejectedList } from '../../components/workspace/Feedback';
import { FileList } from '../../components/workspace/FileList';
import { ResultPanel } from '../../components/workspace/ResultPanel';
import { ToolShell } from '../../components/workspace/ToolShell';
import { useImageList } from '../../hooks/useImages';
import { throwIfAborted, useRunner } from '../../hooks/useRunner';
import { LIMITS, TYPE_LABEL, baseName, formatBytes, nextFrame } from '../../lib/files';
import { imageForPdf } from '../../lib/image/prepare';
import type { ImagePageInput, Margin, Orientation, PageSize } from '../../lib/pdf/ops';
import { runPdf } from '../../lib/pdf/pdfClient';
import type { ToolProps } from '../types';

export default function ImagesToPdf({ tool }: ToolProps) {
  const runner = useRunner();
  const { items, setItems, add: addImages, remove, move, clear: clearImages, rejected, clearRejected, checking } = useImageList(runner, LIMITS.imageFiles);
  const [size, setSize] = useState<PageSize>('a4');
  const [orientation, setOrientation] = useState<Orientation>('auto');
  const [margin, setMargin] = useState<Margin>('small');
  const [name, setName] = useState('');
  const nameId = useId();

  const add = async (files: File[]) => {
    const added = await addImages(files);
    if (added.length && !name) setName(baseName(added[0].file.name));
  };

  const clear = () => {
    clearImages();
    setName('');
  };

  const fileName = `${(name.trim() || 'images').replace(/[\\/:*?"<>|]+/g, '_').replace(/\.pdf$/i, '')}.pdf`;

  const build = () =>
    runner.run('Preparing images…', async ({ report, signal }) => {
      const inputs: ImagePageInput[] = [];
      for (let i = 0; i < items.length; i += 1) {
        throwIfAborted(signal);
        report(i / items.length, `Preparing image ${i + 1} of ${items.length}…`);
        inputs.push(await imageForPdf(items[i].file, items[i].type));
        await nextFrame();
      }
      report(null, 'Building PDF…');
      const bytes = await runPdf('imagesToPdf', inputs, { size, orientation, margin });
      return [{ name: fileName, blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), note: `${items.length} page${items.length === 1 ? '' : 's'}` }];
    });

  const set = <T,>(setter: (value: T) => void) => (value: T) => {
    runner.reset();
    setter(value);
  };

  return (
    <ToolShell
      tool={tool}
      runner={runner}
      hasInput={items.length > 0}
      intake={<DropZone kind="image" multiple onFiles={add} busy={checking} />}
      notices={<RejectedList rejected={rejected} onDismiss={clearRejected} />}
      briefing={[
        'Add images — each one becomes a page, in the order shown.',
        'Choose a page size (or fit each page to its image), orientation and margins.',
        'Plain JPEGs are embedded without re-compression. Other formats are converted in your browser first.',
        'Animated GIF/WebP: only the first frame is used.',
      ]}
      status={`${items.length} image${items.length === 1 ? '' : 's'} → ${items.length} page${items.length === 1 ? '' : 's'}`}
      action={{
        label: 'Create PDF',
        onClick: build,
        disabled: items.length === 0 || items.some((item) => item.error),
        reason: items.length ? 'Remove images your browser can’t decode first.' : 'Add at least one image.',
      }}
      onClear={clear}
      clearLabel="Remove all images"
      settings={
        <>
          <Segmented<PageSize>
            legend="Page size"
            value={size}
            onChange={set(setSize)}
            options={[
              { value: 'a4', label: 'A4' },
              { value: 'letter', label: 'Letter' },
              { value: 'fit', label: 'Fit image', hint: 'page = image' },
            ]}
          />
          <Segmented<Orientation>
            legend="Orientation"
            value={size === 'fit' ? 'auto' : orientation}
            onChange={set(setOrientation)}
            options={[
              { value: 'auto', label: 'Auto', hint: 'per image' },
              { value: 'portrait', label: 'Portrait', disabled: size === 'fit' },
              { value: 'landscape', label: 'Landscape', disabled: size === 'fit' },
            ]}
          />
          <Segmented<Margin>
            legend="Margin"
            value={margin}
            onChange={set(setMargin)}
            options={[
              { value: 'none', label: 'None' },
              { value: 'small', label: 'Small' },
              { value: 'large', label: 'Large' },
            ]}
          />
          <Field id={nameId} label="Output file name" hint={`Saved as ${fileName}`}>
            <input id={nameId} className="input" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} spellCheck={false} />
          </Field>
          <button
            type="button"
            className="tbtn"
            onClick={() => {
              runner.reset();
              setItems((list) => [...list].sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true })));
            }}
            disabled={items.length < 2}
          >
            <Icon name="reorder" size={14} /> Sort by name
          </button>
        </>
      }
      result={<ResultPanel outputs={runner.outputs} zipName="images.zip" onReset={runner.reset} resetLabel="Adjust & rebuild" />}
    >
      <div className="ws-section-title">
        <h2>Page order</h2>
        <p className="mono muted">Top = page 1</p>
      </div>
      <FileList
        label="Images, in page order"
        orderable
        items={items.map((item) => ({ id: item.id, name: item.file.name, thumb: item.url, meta: `${TYPE_LABEL[item.type]} · ${formatBytes(item.file.size)}${item.width ? ` · ${item.width}×${item.height}px` : ''}`, warning: item.error }))}
        onMove={move}
        onRemove={remove}
        disabled={runner.phase === 'working'}
      />
      <DropZone kind="image" multiple compact onFiles={add} busy={checking} compactLabel="Add images" />
    </ToolShell>
  );
}
