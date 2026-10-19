import { useEffect, useId, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Field } from '../../components/workspace/Controls';
import { DropZone } from '../../components/workspace/DropZone';
import { RejectedList } from '../../components/workspace/Feedback';
import { FileList } from '../../components/workspace/FileList';
import { ResultPanel } from '../../components/workspace/ResultPanel';
import { ToolShell } from '../../components/workspace/ToolShell';
import { moveItem } from '../../hooks/useDragReorder';
import { useIntake } from '../../hooks/useIntake';
import { useRunner } from '../../hooks/useRunner';
import { LIMITS, baseName, errorMessage, formatBytes, readBytes, type CheckedFile } from '../../lib/files';
import { runPdf } from '../../lib/pdf/pdfClient';
import { closePdf, openPdf, renderPage } from '../../lib/pdf/render';
import type { ToolProps } from '../types';

interface MergeItem extends CheckedFile {
  pages?: number;
  thumb?: string;
  error?: string;
}

export default function MergePdf({ tool }: ToolProps) {
  const runner = useRunner();
  const { intake, rejected, clearRejected, checking } = useIntake('pdf', LIMITS.pdfFiles);
  const [items, setItems] = useState<MergeItem[]>([]);
  const [name, setName] = useState('');
  const nameId = useId();

  // Release thumbnails on unmount.
  const [thumbUrls] = useState(() => new Set<string>());
  useEffect(() => () => thumbUrls.forEach((url) => URL.revokeObjectURL(url)), [thumbUrls]);

  const inspect = async (item: CheckedFile) => {
    let patch: Partial<MergeItem>;
    try {
      const pages = await runPdf('pageCount', await readBytes(item.file));
      patch = { pages };
    } catch (error) {
      patch = { error: errorMessage(error, 'This PDF couldn’t be read.') };
    }
    setItems((list) => list.map((entry) => (entry.id === item.id ? { ...entry, ...patch } : entry)));
    if (patch.error) return;
    try {
      const doc = await openPdf(item.file);
      const { canvas } = await renderPage(doc, 1, { fitWidth: 96, maxPixels: 100_000 });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      closePdf(doc);
      if (blob) {
        const url = URL.createObjectURL(blob);
        thumbUrls.add(url);
        setItems((list) => list.map((entry) => (entry.id === item.id ? { ...entry, thumb: url } : entry)));
      }
    } catch {
      // Thumbnail is optional.
    }
  };

  const add = async (files: File[]) => {
    const accepted = await intake(files, { count: items.length, bytes: items.reduce((sum, item) => sum + item.file.size, 0) });
    if (!accepted.length) return;
    runner.reset();
    setItems((list) => [...list, ...accepted]);
    if (!name) setName(`${baseName(accepted[0].file.name)}-merged`);
    for (const item of accepted) void inspect(item);
  };

  const remove = (id: string) => {
    runner.reset();
    setItems((list) => list.filter((item) => item.id !== id));
  };

  const move = (from: number, to: number) => {
    runner.reset();
    setItems((list) => moveItem(list, from, to));
  };

  const reorderAll = (fn: (list: MergeItem[]) => MergeItem[]) => {
    runner.reset();
    setItems(fn);
  };

  const clear = () => {
    runner.reset();
    clearRejected();
    setItems([]);
    setName('');
  };

  const broken = items.filter((item) => item.error);
  const pending = items.some((item) => item.pages === undefined && !item.error);
  const totalPages = items.reduce((sum, item) => sum + (item.pages ?? 0), 0);
  const fileName = `${(name.trim() || 'merged').replace(/[\\/:*?"<>|]+/g, '_').replace(/\.pdf$/i, '')}.pdf`;

  const merge = () =>
    runner.run('Merging documents…', async ({ report }) => {
      const buffers: Uint8Array[] = [];
      for (let i = 0; i < items.length; i += 1) {
        report(null, `Reading file ${i + 1} of ${items.length}…`);
        buffers.push(await readBytes(items[i].file));
      }
      report(null, `Combining ${items.length} files (${totalPages} pages)…`);
      const bytes = await runPdf('merge', buffers);
      return [{ name: fileName, blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), note: `${totalPages} pages` }];
    });

  const reason =
    items.length < 2
      ? 'Add at least two PDFs to merge.'
      : broken.length
        ? 'Remove the files that couldn’t be read first.'
        : pending
          ? 'Checking files…'
          : undefined;

  return (
    <ToolShell
      tool={tool}
      runner={runner}
      hasInput={items.length > 0}
      intake={<DropZone kind="pdf" multiple onFiles={add} busy={checking} />}
      notices={<RejectedList rejected={rejected} onDismiss={clearRejected} />}
      briefing={[
        'Add two or more PDFs — they are read on this device, never uploaded.',
        'Set the order with the arrow buttons or by dragging rows.',
        'Pages are copied as-is. Bookmarks and interactive form fields from the sources may not carry over.',
        `Up to ${LIMITS.pdfFiles} files and ${formatBytes(LIMITS.pdfTotalBytes)} in total.`,
      ]}
      status={`${items.length} file${items.length === 1 ? '' : 's'} · ${totalPages} pages`}
      action={{ label: 'Merge PDFs', onClick: merge, disabled: Boolean(reason), reason }}
      onClear={clear}
      clearLabel="Remove all files"
      settings={
        <>
          <Field id={nameId} label="Output file name" hint={`Saved as ${fileName}`}>
            <input id={nameId} className="input" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} spellCheck={false} />
          </Field>
          <div className="field">
            <span className="field__label">Quick order</span>
            <div className="presets">
              <button
                type="button"
                className="tbtn"
                onClick={() => reorderAll((list) => [...list].sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true })))}
              >
                Name A→Z
              </button>
              <button type="button" className="tbtn" onClick={() => reorderAll((list) => [...list].reverse())}>
                <Icon name="reverse" size={14} /> Reverse
              </button>
            </div>
          </div>
        </>
      }
      result={<ResultPanel outputs={runner.outputs} zipName="aflex-merged.zip" onReset={runner.reset} resetLabel="Adjust & merge again" />}
    >
      <div className="ws-section-title">
        <h2>Merge order</h2>
        <p className="mono muted">Top to bottom = first to last</p>
      </div>
      <FileList
        label="PDFs to merge, in order"
        orderable
        items={items.map((item) => ({
          id: item.id,
          name: item.file.name,
          thumb: item.thumb,
          meta: `${formatBytes(item.file.size)} · ${item.error ? 'unreadable' : item.pages === undefined ? 'checking…' : `${item.pages} page${item.pages === 1 ? '' : 's'}`}`,
          warning: item.error,
        }))}
        onMove={move}
        onRemove={remove}
        disabled={runner.phase === 'working'}
      />
      <DropZone kind="pdf" multiple compact onFiles={add} busy={checking} compactLabel="Add PDFs" />
    </ToolShell>
  );
}
