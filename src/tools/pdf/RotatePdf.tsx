import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
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
import { runPdf } from '../../lib/pdf/pdfClient';
import type { ToolProps } from '../types';

const norm = (angle: number) => ((angle % 360) + 360) % 360;

export default function RotatePdf({ tool }: ToolProps) {
  const runner = useRunner();
  const { file, pdf, load, clear, rejected, clearRejected, checking } = useSinglePdf(runner);
  const [rotations, setRotations] = useState<number[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const count = pdf.pageCount;

  useKeyedReset(`${file?.id}:${count}`, () => {
    setRotations(new Array(count).fill(0));
    setSelected(new Set());
  });

  const rotate = (pages: number[], delta: number) => {
    runner.reset();
    setRotations((list) => list.map((angle, index) => (pages.includes(index) ? norm(angle + delta) : angle)));
  };

  const toggle = (key: string) => {
    const page = Number(key.slice(1));
    setSelected((set) => {
      const next = new Set(set);
      if (next.has(page)) next.delete(page);
      else next.add(page);
      return next;
    });
  };

  const all = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);
  const targets = selected.size ? [...selected] : all;
  const changedCount = rotations.filter(Boolean).length;
  const items = useMemo(
    () =>
      all.map((i) => ({
        key: `p${i}`,
        source: i,
        thumb: pdf.thumbs[i],
        rotation: rotations[i] || 0,
        badge: rotations[i] ? `+${rotations[i]}°` : undefined,
      })),
    [all, pdf.thumbs, rotations],
  );
  const activeKeys = useMemo(() => new Set([...selected].map((page) => `p${page}`)), [selected]);

  const save = () =>
    runner.run('Rotating pages…', async () => {
      if (!file) return [];
      const map: Record<number, number> = {};
      rotations.forEach((angle, index) => {
        if (angle) map[index] = angle;
      });
      const bytes = await runPdf('rotatePages', await readBytes(file.file), map);
      return [{ name: `${baseName(file.file.name)}-rotated.pdf`, blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }) }];
    });

  const scope = selected.size ? `${selected.size} selected` : 'all pages';

  return (
    <ToolShell
      tool={tool}
      runner={runner}
      hasInput={Boolean(file)}
      intake={<DropZone kind="pdf" multiple={false} onFiles={load} busy={checking} />}
      notices={<RejectedList rejected={rejected} onDismiss={clearRejected} />}
      briefing={[
        'Load a PDF. Select pages by clicking them, or select none to rotate every page.',
        'Rotate left, right or 180° as many times as you like — the preview updates instantly.',
        'Rotation is stored in the PDF, so text, links and forms are preserved.',
      ]}
      status={count ? `${changedCount} page${changedCount === 1 ? '' : 's'} rotated · applying to ${scope}` : undefined}
      action={{ label: 'Save rotated PDF', onClick: save, disabled: !changedCount, reason: count ? 'Rotate at least one page first.' : 'Load a PDF first.' }}
      onClear={clear}
      clearLabel="Use a different PDF"
      settings={
        <>
          <div className="field">
            <span className="field__label">Rotate {scope}</span>
            <div className="presets">
              <button type="button" className="tbtn" onClick={() => rotate(targets, -90)}>
                <Icon name="rotateLeft" size={16} /> Left
              </button>
              <button type="button" className="tbtn" onClick={() => rotate(targets, 90)}>
                <Icon name="rotate" size={16} /> Right
              </button>
              <button type="button" className="tbtn" onClick={() => rotate(targets, 180)}>
                180°
              </button>
            </div>
          </div>
          <div className="field">
            <span className="field__label">Selection</span>
            <div className="presets">
              <button type="button" className="tbtn" onClick={() => setSelected(new Set(all))} disabled={selected.size === count}>
                Select all
              </button>
              <button type="button" className="tbtn" onClick={() => setSelected(new Set())} disabled={!selected.size}>
                Select none
              </button>
              <button
                type="button"
                className="tbtn"
                onClick={() => setSelected(new Set(all.filter((i) => (i + 1) % 2 === 0)))}
                disabled={count < 2}
              >
                Even pages
              </button>
              <button type="button" className="tbtn" onClick={() => setSelected(new Set(all.filter((i) => (i + 1) % 2 === 1)))}>
                Odd pages
              </button>
            </div>
          </div>
          <button
            type="button"
            className="tbtn"
            onClick={() => {
              runner.reset();
              setRotations(new Array(count).fill(0));
            }}
            disabled={!changedCount}
          >
            <Icon name="undo" size={14} /> Reset all rotation
          </button>
        </>
      }
      result={<ResultPanel outputs={runner.outputs} zipName="rotated.zip" onReset={runner.reset} resetLabel="Keep editing" />}
    >
      {file && (
        <>
          <PdfStatus file={file} pdf={pdf} onClear={clear} />
          {pdf.status === 'ready' && (
            <>
              <PdfSummary file={file} pageCount={count} extra={`SELECTED ${selected.size || 'ALL'}`} />
              <div className="ws-section-title">
                <h2>Pages</h2>
                <p className="mono muted">Click to select · buttons rotate one page</p>
              </div>
              <PageGrid
                items={items}
                mode="select"
                active={activeKeys}
                onToggle={toggle}
                label="Pages — press to select for rotation"
                disabled={runner.phase === 'working'}
                renderActions={(item) => (
                  <div className="page-card__actions">
                    <button type="button" className="tbtn" onClick={() => rotate([item.source], -90)} aria-label={`Rotate page ${item.source + 1} left`}>
                      <Icon name="rotateLeft" size={16} />
                    </button>
                    <button type="button" className="tbtn" onClick={() => rotate([item.source], 90)} aria-label={`Rotate page ${item.source + 1} right`}>
                      <Icon name="rotate" size={16} />
                    </button>
                  </div>
                )}
              />
            </>
          )}
        </>
      )}
    </ToolShell>
  );
}
