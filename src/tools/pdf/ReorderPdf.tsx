import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { DropZone } from '../../components/workspace/DropZone';
import { RejectedList } from '../../components/workspace/Feedback';
import { PageGrid } from '../../components/workspace/PageGrid';
import { PdfStatus, PdfSummary } from '../../components/workspace/PdfStatus';
import { ResultPanel } from '../../components/workspace/ResultPanel';
import { ToolShell } from '../../components/workspace/ToolShell';
import { moveItem } from '../../hooks/useDragReorder';
import { useKeyedReset } from '../../hooks/useKeyedReset';
import { useRunner } from '../../hooks/useRunner';
import { useSinglePdf } from '../../hooks/useSinglePdf';
import { baseName, readBytes } from '../../lib/files';
import { runPdf } from '../../lib/pdf/pdfClient';
import type { ToolProps } from '../types';

const identity = (count: number) => Array.from({ length: count }, (_, i) => i);

export default function ReorderPdf({ tool }: ToolProps) {
  const runner = useRunner();
  const { file, pdf, load, clear, rejected, clearRejected, checking } = useSinglePdf(runner);
  const [order, setOrder] = useState<number[]>([]);
  const [history, setHistory] = useState<number[][]>([]);
  const [announcement, setAnnouncement] = useState('');
  const count = pdf.pageCount;

  // New document → original order.
  useKeyedReset(`${file?.id}:${count}`, () => {
    setOrder(identity(count));
    setHistory([]);
  });

  const changed = order.some((page, index) => page !== index);

  const commit = (next: number[], message: string) => {
    runner.reset();
    setHistory((list) => [...list.slice(-49), order]);
    setOrder(next);
    setAnnouncement(message);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    commit(moveItem(order, from, to), `Page ${order[from] + 1} moved to position ${to + 1} of ${order.length}.`);
  };

  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    runner.reset();
    setHistory((list) => list.slice(0, -1));
    setOrder(previous);
    setAnnouncement('Last move undone.');
  };

  const items = useMemo(
    () => order.map((source, position) => ({ key: `p${source}`, source, thumb: pdf.thumbs[source], badge: source !== position ? `was ${source + 1}` : undefined })),
    [order, pdf.thumbs],
  );

  const save = () =>
    runner.run('Rebuilding PDF in the new order…', async () => {
      if (!file) return [];
      const bytes = await runPdf('extractPages', await readBytes(file.file), order);
      return [{ name: `${baseName(file.file.name)}-reordered.pdf`, blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }) }];
    });

  return (
    <ToolShell
      tool={tool}
      runner={runner}
      hasInput={Boolean(file)}
      intake={<DropZone kind="pdf" multiple={false} onFiles={load} busy={checking} />}
      notices={<RejectedList rejected={rejected} onDismiss={clearRejected} />}
      briefing={[
        'Load a PDF to see every page as a numbered thumbnail.',
        'Drag pages, or use the arrow buttons under each page — both work with mouse, touch and keyboard.',
        'Undo steps back one move; Reset restores the original order.',
        'Bookmarks and form fields may not survive reordering; page content and links on pages are kept.',
      ]}
      status={count ? (changed ? 'Order changed — ready to save.' : 'Original order.') : undefined}
      action={{ label: 'Save new order', onClick: save, disabled: !changed, reason: count ? 'Move at least one page first.' : 'Load a PDF first.' }}
      onClear={clear}
      clearLabel="Use a different PDF"
      settings={
        <>
          <div className="field">
            <span className="field__label">Order tools</span>
            <div className="presets">
              <button type="button" className="tbtn" onClick={undo} disabled={!history.length}>
                <Icon name="undo" size={14} /> Undo
              </button>
              <button type="button" className="tbtn" onClick={() => commit([...order].reverse(), 'Page order reversed.')} disabled={count < 2}>
                <Icon name="reverse" size={14} /> Reverse
              </button>
              <button type="button" className="tbtn" onClick={() => commit(identity(count), 'Original order restored.')} disabled={!changed}>
                Reset
              </button>
            </div>
          </div>
          <div className="sub-panel">
            <p className="label">Current order</p>
            <p className="mono" style={{ overflowWrap: 'anywhere' }}>
              {order.length > 60 ? `${order.slice(0, 60).map((p) => p + 1).join(' · ')} …` : order.map((p) => p + 1).join(' · ')}
            </p>
          </div>
        </>
      }
      result={<ResultPanel outputs={runner.outputs} zipName="reordered.zip" onReset={runner.reset} resetLabel="Keep editing" />}
    >
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {file && (
        <>
          <PdfStatus file={file} pdf={pdf} onClear={clear} />
          {pdf.status === 'ready' && (
            <>
              <PdfSummary file={file} pageCount={count} extra={changed ? 'ORDER CHANGED' : 'ORIGINAL ORDER'} />
              <div className="ws-section-title">
                <h2>Arrange pages</h2>
                <p className="mono muted">Big number = new position · drag or use arrows</p>
              </div>
              <PageGrid items={items} mode="reorder" label="Pages in their new order" onMove={move} disabled={runner.phase === 'working'} />
            </>
          )}
        </>
      )}
    </ToolShell>
  );
}
