import { useId, useMemo, useState } from 'react';
import { ConfirmDialog } from '../../components/workspace/ConfirmDialog';
import { Field } from '../../components/workspace/Controls';
import { DropZone } from '../../components/workspace/DropZone';
import { RejectedList } from '../../components/workspace/Feedback';
import { PageGrid } from '../../components/workspace/PageGrid';
import { PdfStatus, PdfSummary } from '../../components/workspace/PdfStatus';
import { ResultPanel } from '../../components/workspace/ResultPanel';
import { ToolShell } from '../../components/workspace/ToolShell';
import { useKeyedReset } from '../../hooks/useKeyedReset';
import { useRunner } from '../../hooks/useRunner';
import { useSinglePdf } from '../../hooks/useSinglePdf';
import { baseName, readBytes } from '../../lib/files';
import { formatPageSet, parsePageSet } from '../../lib/pageRanges';
import { runPdf } from '../../lib/pdf/pdfClient';
import type { ToolProps } from '../types';

export default function DeletePages({ tool }: ToolProps) {
  const runner = useRunner();
  const { file, pdf, load, clear, rejected, clearRejected, checking } = useSinglePdf(runner);
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [rangeText, setRangeText] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const rangeId = useId();
  const count = pdf.pageCount;

  useKeyedReset(`${file?.id}:${count}`, () => setMarked(new Set()));

  const update = (next: Set<number>) => {
    runner.reset();
    setMarked(next);
  };

  const toggle = (key: string) => {
    const page = Number(key.slice(1));
    const next = new Set(marked);
    if (next.has(page)) next.delete(page);
    else next.add(page);
    update(next);
  };

  const applyRange = () => {
    const parsed = parsePageSet(rangeText, count);
    if (!parsed.ok) {
      setRangeError(parsed.error);
      return;
    }
    setRangeError(null);
    update(new Set([...marked, ...parsed.pages]));
  };

  const items = useMemo(() => Array.from({ length: count }, (_, i) => ({ key: `p${i}`, source: i, thumb: pdf.thumbs[i] })), [count, pdf.thumbs]);
  const activeKeys = useMemo(() => new Set([...marked].map((page) => `p${page}`)), [marked]);
  const sorted = [...marked].sort((a, b) => a - b);
  const remaining = count - marked.size;

  const save = () => {
    setConfirming(false);
    void runner.run('Removing pages…', async () => {
      if (!file) return [];
      const bytes = await runPdf('deletePages', await readBytes(file.file), sorted);
      return [
        {
          name: `${baseName(file.file.name)}-edited.pdf`,
          blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }),
          note: `${remaining} page${remaining === 1 ? '' : 's'} kept`,
        },
      ];
    });
  };

  const reason = !count
    ? 'Load a PDF first.'
    : marked.size === 0
      ? 'Click pages to mark them for deletion.'
      : remaining === 0
        ? 'You can’t delete every page — keep at least one.'
        : undefined;

  return (
    <ToolShell
      tool={tool}
      runner={runner}
      hasInput={Boolean(file)}
      intake={<DropZone kind="pdf" multiple={false} onFiles={load} busy={checking} />}
      notices={<RejectedList rejected={rejected} onDismiss={clearRejected} />}
      briefing={[
        'Load a PDF and click (or tap) pages to mark them — marked pages get a red CUT stamp.',
        'Or type page numbers like 2, 5-7 to mark several at once.',
        'You’ll confirm before the new PDF is created. The original file is never modified.',
      ]}
      status={count ? `${marked.size} marked · ${remaining} will remain` : undefined}
      action={{ label: marked.size ? `Delete ${marked.size} page${marked.size === 1 ? '' : 's'}` : 'Delete pages', onClick: () => setConfirming(true), disabled: Boolean(reason), reason }}
      onClear={clear}
      clearLabel="Use a different PDF"
      settings={
        <>
          <Field id={rangeId} label="Mark by page number" hint="e.g. 2, 5-7" error={rangeError}>
            <div className="range-row">
              <input
                id={rangeId}
                className="input"
                value={rangeText}
                onChange={(event) => setRangeText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applyRange();
                }}
                aria-invalid={Boolean(rangeError)}
                spellCheck={false}
                autoComplete="off"
              />
              <button type="button" className="tbtn" onClick={applyRange}>
                Mark
              </button>
            </div>
          </Field>
          <div className="presets">
            <button type="button" className="tbtn" onClick={() => update(new Set())} disabled={!marked.size}>
              Clear marks
            </button>
            <button
              type="button"
              className="tbtn"
              onClick={() => update(new Set(Array.from({ length: count }, (_, i) => i).filter((i) => !marked.has(i))))}
            >
              Invert
            </button>
          </div>
          <div className="sub-panel">
            <p className="label">Marked for deletion</p>
            <p className="mono">{sorted.length ? formatPageSet(sorted) : 'None yet'}</p>
          </div>
        </>
      }
      result={<ResultPanel outputs={runner.outputs} zipName="edited.zip" onReset={runner.reset} resetLabel="Keep editing" />}
    >
      {file && (
        <>
          <PdfStatus file={file} pdf={pdf} onClear={clear} />
          {pdf.status === 'ready' && (
            <>
              <PdfSummary file={file} pageCount={count} extra={`MARKED ${marked.size}`} />
              <div className="ws-section-title">
                <h2>Mark pages to remove</h2>
                <p className="mono muted">Click again to unmark</p>
              </div>
              <PageGrid items={items} mode="mark" active={activeKeys} onToggle={toggle} label="Pages — press to mark or unmark for deletion" disabled={runner.phase === 'working'} />
            </>
          )}
        </>
      )}
      <ConfirmDialog open={confirming} title="Delete these pages?" confirmLabel="Create new PDF" onConfirm={save} onCancel={() => setConfirming(false)}>
        <p>
          Pages <strong className="red">{formatPageSet(sorted)}</strong> will be left out. The new PDF keeps {remaining} of {count} pages.
        </p>
        <p style={{ marginTop: 8 }}>Your original file stays untouched.</p>
      </ConfirmDialog>
    </ToolShell>
  );
}
