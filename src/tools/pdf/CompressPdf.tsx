import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { RangeField, Segmented } from '../../components/workspace/Controls';
import { DropZone } from '../../components/workspace/DropZone';
import { RejectedList } from '../../components/workspace/Feedback';
import { PdfStatus, PdfSummary } from '../../components/workspace/PdfStatus';
import { ResultPanel } from '../../components/workspace/ResultPanel';
import { ToolShell } from '../../components/workspace/ToolShell';
import { throwIfAborted, useRunner } from '../../hooks/useRunner';
import { useSinglePdf } from '../../hooks/useSinglePdf';
import { encodeCanvas, releaseCanvas } from '../../lib/image/canvas';
import { baseName, nextFrame, readBytes } from '../../lib/files';
import type { RasterPage } from '../../lib/pdf/ops';
import { runPdf } from '../../lib/pdf/pdfClient';
import { renderPage } from '../../lib/pdf/render';
import type { ToolProps } from '../types';

type Method = 'rebuild' | 'raster';
type Dpi = '72' | '110' | '150';

export default function CompressPdf({ tool }: ToolProps) {
  const runner = useRunner();
  const { file, pdf, load, clear, rejected, clearRejected, checking } = useSinglePdf(runner);
  const [method, setMethod] = useState<Method>('rebuild');
  const [dpi, setDpi] = useState<Dpi>('110');
  const [quality, setQuality] = useState(65);
  const count = pdf.pageCount;

  const compress = () =>
    runner.run(method === 'rebuild' ? 'Rebuilding file structure…' : 'Rendering pages…', async ({ report, signal }) => {
      if (!file || !pdf.doc) return [];
      const stem = baseName(file.file.name);
      if (method === 'rebuild') {
        const bytes = await runPdf('rebuild', await readBytes(file.file));
        return [{ name: `${stem}-optimized.pdf`, blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), sourceBytes: file.file.size, note: 'Lossless rebuild' }];
      }
      const pages: RasterPage[] = [];
      for (let i = 1; i <= count; i += 1) {
        throwIfAborted(signal);
        report((i - 1) / count, `Rendering page ${i} of ${count}…`);
        const rendered = await renderPage(pdf.doc, i, { scale: Number(dpi) / 72, maxPixels: 20_000_000, signal });
        const blob = await encodeCanvas(rendered.canvas, 'jpeg', quality / 100);
        releaseCanvas(rendered.canvas);
        pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width: rendered.widthPt, height: rendered.heightPt });
        await nextFrame();
      }
      throwIfAborted(signal);
      report(null, 'Assembling the new PDF…');
      const bytes = await runPdf('fromRasterPages', pages);
      return [
        {
          name: `${stem}-compressed.pdf`,
          blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }),
          sourceBytes: file.file.size,
          note: `Rasterized at ${dpi} dpi, JPEG quality ${quality}`,
        },
      ];
    });

  return (
    <ToolShell
      tool={tool}
      runner={runner}
      hasInput={Boolean(file)}
      intake={<DropZone kind="pdf" multiple={false} onFiles={load} busy={checking} />}
      notices={<RejectedList rejected={rejected} onDismiss={clearRejected} />}
      briefing={[
        'Two honest methods: a lossless rebuild, or rasterizing pages into compressed images.',
        'AFlex can’t predict the result — you see the real before/after size only after processing.',
        'If the output isn’t smaller, AFlex tells you so. Keep your original in that case.',
        'Everything runs in this browser; the PDF is never uploaded.',
      ]}
      status={count ? `${count} pages · method: ${method === 'rebuild' ? 'lossless rebuild' : `rasterize @ ${dpi} dpi`}` : undefined}
      action={{ label: 'Compress PDF', onClick: compress, disabled: pdf.status !== 'ready', reason: 'Load a PDF first.' }}
      onClear={clear}
      clearLabel="Use a different PDF"
      settings={
        <>
          <Segmented<Method>
            legend="Method"
            value={method}
            onChange={(value) => {
              runner.reset();
              setMethod(value);
            }}
            options={[
              { value: 'rebuild', label: 'Lossless', hint: 'keeps everything' },
              { value: 'raster', label: 'Rasterize', hint: 'stronger, lossy' },
            ]}
          />
          {method === 'rebuild' ? (
            <div className="sub-panel">
              <p className="label">What it does</p>
              <p className="field__hint">
                Re-writes the file and packs its internal objects into compressed streams, dropping data left over from earlier edits.
                Text, links, forms and quality are untouched. Savings are often small or zero — scanned or image-heavy PDFs usually need
                Rasterize.
              </p>
            </div>
          ) : (
            <>
              <Segmented<Dpi>
                legend="Resolution"
                value={dpi}
                onChange={setDpi}
                options={[
                  { value: '72', label: '72 dpi', hint: 'screen' },
                  { value: '110', label: '110 dpi', hint: 'balanced' },
                  { value: '150', label: '150 dpi', hint: 'print-ish' },
                ]}
              />
              <RangeField label="JPEG quality" value={quality} min={30} max={90} step={5} onChange={setQuality} format={(v) => `${v}`} />
              <div className="sub-panel">
                <p className="label red">Trade-offs — read before using</p>
                <ul className="warning-list">
                  {[
                    'Every page becomes a flat image: text can no longer be selected, searched or copied.',
                    'Links, bookmarks, form fields, annotations and attachments are removed.',
                    'Vector graphics and small text may look softer, especially at 72 dpi.',
                    'Text-only PDFs often get larger, not smaller.',
                  ].map((line) => (
                    <li key={line}>
                      <Icon name="alert" size={14} />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </>
      }
      result={
        <ResultPanel outputs={runner.outputs} compare zipName="compressed.zip" onReset={runner.reset} resetLabel="Try other settings" />
      }
    >
      {file && (
        <>
          <PdfStatus file={file} pdf={pdf} onClear={clear} />
          {pdf.status === 'ready' && (
            <>
              <PdfSummary file={file} pageCount={count} />
              <div className="ws-section-title">
                <h2>Preview</h2>
                <p className="mono muted">First pages of your document</p>
              </div>
              <ol className="page-grid" aria-label="First pages">
                {pdf.thumbs.slice(0, 8).map((thumb, i) => (
                  <li key={i} className="page-card">
                    <div className="page-card__btn" role="img" aria-label={`Page ${i + 1}`}>
                      {thumb ? <img src={thumb} alt="" /> : <span className="page-card__placeholder" />}
                      <span className="page-card__num" aria-hidden="true">
                        P{i + 1}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
              {count > 8 && <p className="mono muted">+ {count - 8} more pages</p>}
            </>
          )}
        </>
      )}
    </ToolShell>
  );
}
