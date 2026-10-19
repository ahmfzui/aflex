import { useId, useMemo, useState } from 'react';
import { Checkbox, Field, Segmented } from '../../components/workspace/Controls';
import { DropZone } from '../../components/workspace/DropZone';
import { RejectedList } from '../../components/workspace/Feedback';
import { PageGrid } from '../../components/workspace/PageGrid';
import { PdfStatus, PdfSummary } from '../../components/workspace/PdfStatus';
import { ResultPanel } from '../../components/workspace/ResultPanel';
import { ToolShell } from '../../components/workspace/ToolShell';
import { useRunner } from '../../hooks/useRunner';
import { useSinglePdf } from '../../hooks/useSinglePdf';
import { baseName, readBytes } from '../../lib/files';
import { chunkPages, parseRanges, type RangeGroup } from '../../lib/pageRanges';
import { runPdf } from '../../lib/pdf/pdfClient';
import type { ToolProps } from '../types';

type Mode = 'ranges' | 'each' | 'chunks';

export default function SplitPdf({ tool }: ToolProps) {
  const runner = useRunner();
  const { file, pdf, load, clear, rejected, clearRejected, checking } = useSinglePdf(runner);
  const [mode, setMode] = useState<Mode>('ranges');
  const [ranges, setRanges] = useState('1-2');
  const [combine, setCombine] = useState(false);
  const [chunk, setChunk] = useState(2);
  const rangesId = useId();
  const chunkId = useId();
  const count = pdf.pageCount;

  const plan = useMemo((): { groups: RangeGroup[]; error: string | null } => {
    if (!count) return { groups: [], error: null };
    if (mode === 'each') return { groups: chunkPages(count, 1), error: null };
    if (mode === 'chunks') {
      if (!Number.isInteger(chunk) || chunk < 1) return { groups: [], error: 'Enter a whole number of pages, 1 or more.' };
      return { groups: chunkPages(count, chunk), error: null };
    }
    const parsed = parseRanges(ranges, count);
    if (!parsed.ok) return { groups: [], error: parsed.error };
    if (combine) {
      const pages = parsed.groups.flatMap((group) => group.pages);
      return { groups: [{ label: parsed.groups.map((g) => g.label).join(','), pages }], error: null };
    }
    return { groups: parsed.groups, error: null };
  }, [count, mode, chunk, ranges, combine]);

  // Badge each page with the output file(s) it lands in.
  const pageItems = useMemo(() => {
    const membership: number[][] = Array.from({ length: count }, () => []);
    plan.groups.forEach((group, index) => {
      for (const page of group.pages) membership[page]?.push(index + 1);
    });
    return Array.from({ length: count }, (_, i) => ({
      key: `p${i}`,
      source: i,
      thumb: pdf.thumbs[i],
      badge: membership[i].length ? `→ ${membership[i].slice(0, 3).join(',')}${membership[i].length > 3 ? '…' : ''}` : undefined,
      muted: membership[i].length === 0,
    }));
  }, [count, plan.groups, pdf.thumbs]);

  const split = () =>
    runner.run('Splitting…', async ({ report }) => {
      if (!file) return [];
      report(null, `Building ${plan.groups.length} file${plan.groups.length === 1 ? '' : 's'}…`);
      const parts = await runPdf('splitGroups', await readBytes(file.file), plan.groups.map((group) => group.pages));
      const stem = baseName(file.file.name);
      return parts.map((bytes, index) => ({
        name: `${stem}-pages-${plan.groups[index].label.replace(/,/g, '_')}.pdf`,
        blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }),
        note: `${plan.groups[index].pages.length} page${plan.groups[index].pages.length === 1 ? '' : 's'}`,
      }));
    });

  const tooMany = plan.groups.length > 500;
  const reason = !count
    ? 'Load a PDF first.'
    : plan.error
      ? plan.error
      : tooMany
        ? 'That would create more than 500 files. Use larger chunks.'
        : undefined;

  return (
    <ToolShell
      tool={tool}
      runner={runner}
      hasInput={Boolean(file)}
      intake={<DropZone kind="pdf" multiple={false} onFiles={load} busy={checking} />}
      notices={<RejectedList rejected={rejected} onDismiss={clearRejected} />}
      briefing={[
        'Load one PDF. Every page is shown as a thumbnail.',
        'Extract page ranges, split every page into its own file, or cut into equal chunks.',
        'Several outputs can be downloaded one by one or together as a ZIP.',
        'Your original PDF is never changed.',
      ]}
      status={count ? `${plan.groups.length} output file${plan.groups.length === 1 ? '' : 's'} planned` : undefined}
      action={{ label: plan.groups.length > 1 ? `Split into ${plan.groups.length} files` : 'Extract pages', onClick: split, disabled: Boolean(reason), reason }}
      onClear={clear}
      clearLabel="Use a different PDF"
      settings={
        <>
          <Segmented<Mode>
            legend="Split method"
            value={mode}
            onChange={(value) => {
              runner.reset();
              setMode(value);
            }}
            options={[
              { value: 'ranges', label: 'Ranges', hint: 'pick pages' },
              { value: 'each', label: 'Every page', hint: '1 file / page' },
              { value: 'chunks', label: 'Chunks', hint: 'every N pages' },
            ]}
          />
          {mode === 'ranges' && (
            <>
              <Field id={rangesId} label="Page ranges" hint="Comma-separated, e.g. 1-3, 5, 8-. Each range becomes its own file." error={plan.error}>
                <input
                  id={rangesId}
                  className="input"
                  value={ranges}
                  onChange={(event) => setRanges(event.target.value)}
                  aria-invalid={Boolean(plan.error)}
                  aria-describedby={plan.error ? `${rangesId}-error` : `${rangesId}-hint`}
                  inputMode="text"
                  spellCheck={false}
                  autoComplete="off"
                />
              </Field>
              <Checkbox checked={combine} onChange={setCombine}>
                Combine all ranges into a single PDF
              </Checkbox>
            </>
          )}
          {mode === 'chunks' && (
            <Field id={chunkId} label="Pages per file" error={plan.error} hint={count ? `${Math.ceil(count / Math.max(1, chunk || 1))} files` : undefined}>
              <input
                id={chunkId}
                className="input"
                type="number"
                min={1}
                max={Math.max(1, count)}
                value={Number.isNaN(chunk) ? '' : chunk}
                onChange={(event) => setChunk(Math.floor(Number(event.target.value)))}
                aria-invalid={Boolean(plan.error)}
              />
            </Field>
          )}
        </>
      }
      result={<ResultPanel outputs={runner.outputs} zipName={`${file ? baseName(file.file.name) : 'split'}-split.zip`} onReset={runner.reset} resetLabel="Change settings" />}
    >
      {file && (
        <>
          <PdfStatus file={file} pdf={pdf} onClear={clear} />
          {pdf.status === 'ready' && (
            <>
              <PdfSummary file={file} pageCount={count} extra={`OUTPUTS ${plan.groups.length}`} />
              <div className="ws-section-title">
                <h2>Pages</h2>
                <p className="mono muted">Badge = output file number · dimmed = not included</p>
              </div>
              <PageGrid items={pageItems} mode="view" label="Pages and the output file each goes to" />
            </>
          )}
        </>
      )}
    </ToolShell>
  );
}
