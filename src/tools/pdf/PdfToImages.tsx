import { useId, useMemo, useState } from 'react';
import { Field, RangeField, Segmented } from '../../components/workspace/Controls';
import { DropZone } from '../../components/workspace/DropZone';
import { RejectedList } from '../../components/workspace/Feedback';
import { PageGrid } from '../../components/workspace/PageGrid';
import { PdfStatus, PdfSummary } from '../../components/workspace/PdfStatus';
import { ResultPanel } from '../../components/workspace/ResultPanel';
import { ToolShell } from '../../components/workspace/ToolShell';
import { useKeyedReset } from '../../hooks/useKeyedReset';
import { throwIfAborted, useRunner, type OutputSpec } from '../../hooks/useRunner';
import { useSinglePdf } from '../../hooks/useSinglePdf';
import { useEncoderSupport } from '../../hooks/useEncoderSupport';
import { LOSSY, OUTPUT_EXT, encodeCanvas, releaseCanvas, type OutputFormat } from '../../lib/image/canvas';
import { baseName, nextFrame } from '../../lib/files';
import { formatPageSet, parsePageSet } from '../../lib/pageRanges';
import { renderPage } from '../../lib/pdf/render';
import type { ToolProps } from '../types';

type Dpi = '72' | '150' | '300';
const MAX_PIXELS = 36_000_000;

export default function PdfToImages({ tool }: ToolProps) {
  const runner = useRunner();
  const { file, pdf, load, clear, rejected, clearRejected, checking } = useSinglePdf(runner);
  const support = useEncoderSupport();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [format, setFormat] = useState<OutputFormat>('png');
  const [dpi, setDpi] = useState<Dpi>('150');
  const [quality, setQuality] = useState(85);
  const [rangeText, setRangeText] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const rangeId = useId();
  const count = pdf.pageCount;

  useKeyedReset(`${file?.id}:${count}`, () => setSelected(new Set(Array.from({ length: count }, (_, i) => i))));

  const items = useMemo(() => Array.from({ length: count }, (_, i) => ({ key: `p${i}`, source: i, thumb: pdf.thumbs[i] })), [count, pdf.thumbs]);
  const activeKeys = useMemo(() => new Set([...selected].map((page) => `p${page}`)), [selected]);
  const pages = [...selected].sort((a, b) => a - b);

  const toggle = (key: string) => {
    runner.reset();
    const page = Number(key.slice(1));
    setSelected((set) => {
      const next = new Set(set);
      if (next.has(page)) next.delete(page);
      else next.add(page);
      return next;
    });
  };

  const applyRange = () => {
    const parsed = parsePageSet(rangeText, count);
    if (!parsed.ok) {
      setRangeError(parsed.error);
      return;
    }
    setRangeError(null);
    runner.reset();
    setSelected(new Set(parsed.pages));
  };

  const convert = () =>
    runner.run('Rendering pages…', async ({ report, signal }) => {
      if (!file || !pdf.doc) return [];
      const stem = baseName(file.file.name);
      const outputs: OutputSpec[] = [];
      for (let n = 0; n < pages.length; n += 1) {
        throwIfAborted(signal);
        const page = pages[n];
        report(n / pages.length, `Rendering page ${page + 1} (${n + 1} of ${pages.length})…`);
        const scale = Number(dpi) / 72;
        const rendered = await renderPage(pdf.doc, page + 1, { scale, maxPixels: MAX_PIXELS, signal });
        const blob = await encodeCanvas(rendered.canvas, format, quality / 100);
        outputs.push({
          name: `${stem}-page-${String(page + 1).padStart(String(count).length, '0')}.${OUTPUT_EXT[format]}`,
          blob,
          width: rendered.canvas.width,
          height: rendered.canvas.height,
          note: rendered.scale < scale - 1e-6 ? `Reduced to ${Math.round(rendered.scale * 72)} dpi (size limit)` : undefined,
        });
        releaseCanvas(rendered.canvas);
        await nextFrame();
      }
      return outputs;
    });

  const reason = !count ? 'Load a PDF first.' : pages.length === 0 ? 'Select at least one page.' : undefined;

  return (
    <ToolShell
      tool={tool}
      runner={runner}
      hasInput={Boolean(file)}
      intake={<DropZone kind="pdf" multiple={false} onFiles={load} busy={checking} />}
      notices={<RejectedList rejected={rejected} onDismiss={clearRejected} />}
      briefing={[
        'Load a PDF; all pages start selected. Click pages to include or exclude them.',
        'Pick PNG (sharp, lossless), JPEG (smaller photos) or WebP where your browser supports it.',
        'Higher dpi = more detail and bigger files. Very large pages are capped at about 36 megapixels.',
        'Download pages one by one or as a single ZIP.',
      ]}
      status={count ? `${pages.length} of ${count} pages selected` : undefined}
      action={{ label: `Export ${pages.length || ''} image${pages.length === 1 ? '' : 's'}`, onClick: convert, disabled: Boolean(reason), reason }}
      onClear={clear}
      clearLabel="Use a different PDF"
      settings={
        <>
          <Segmented<OutputFormat>
            legend="Format"
            value={format}
            onChange={(value) => {
              runner.reset();
              setFormat(value);
            }}
            options={[
              { value: 'png', label: 'PNG', hint: 'lossless' },
              { value: 'jpeg', label: 'JPEG', hint: 'small' },
              { value: 'webp', label: 'WEBP', hint: support?.webp === false ? 'not in this browser' : 'modern', disabled: support?.webp === false },
            ]}
          />
          <Segmented<Dpi>
            legend="Resolution"
            value={dpi}
            onChange={(value) => {
              runner.reset();
              setDpi(value);
            }}
            options={[
              { value: '72', label: '72 dpi', hint: 'screen' },
              { value: '150', label: '150 dpi', hint: 'standard' },
              { value: '300', label: '300 dpi', hint: 'print' },
            ]}
          />
          {LOSSY[format] && <RangeField label="Quality" value={quality} min={40} max={100} step={5} onChange={setQuality} />}
          <Field id={rangeId} label="Select pages by number" hint={`Currently: ${pages.length ? formatPageSet(pages) : 'none'}`} error={rangeError}>
            <div className="range-row">
              <input
                id={rangeId}
                className="input"
                value={rangeText}
                placeholder="e.g. 1-3, 7"
                onChange={(event) => setRangeText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applyRange();
                }}
                aria-invalid={Boolean(rangeError)}
                spellCheck={false}
                autoComplete="off"
              />
              <button type="button" className="tbtn" onClick={applyRange}>
                Apply
              </button>
            </div>
          </Field>
          <div className="presets">
            <button type="button" className="tbtn" onClick={() => setSelected(new Set(items.map((item) => item.source)))}>
              Select all
            </button>
            <button type="button" className="tbtn" onClick={() => setSelected(new Set())}>
              Select none
            </button>
          </div>
        </>
      }
      result={
        <ResultPanel outputs={runner.outputs} previews zipName={`${file ? baseName(file.file.name) : 'pages'}-images.zip`} onReset={runner.reset} resetLabel="Change settings" />
      }
    >
      {file && (
        <>
          <PdfStatus file={file} pdf={pdf} onClear={clear} />
          {pdf.status === 'ready' && (
            <>
              <PdfSummary file={file} pageCount={count} extra={`SELECTED ${pages.length}`} />
              <div className="ws-section-title">
                <h2>Choose pages</h2>
                <p className="mono muted">Red = will be exported</p>
              </div>
              <PageGrid items={items} mode="select" active={activeKeys} onToggle={toggle} label="Pages — press to include or exclude" disabled={runner.phase === 'working'} />
            </>
          )}
        </>
      )}
    </ToolShell>
  );
}
