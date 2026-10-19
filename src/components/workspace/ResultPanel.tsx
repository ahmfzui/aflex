import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { OutputFile } from '../../hooks/useRunner';
import { formatBytes, percentChange, triggerDownload } from '../../lib/files';
import { makeZip } from '../../lib/zip';
import { Icon } from '../Icon';

interface ResultPanelProps {
  outputs: OutputFile[];
  /** Show before/after sizes (only meaningful when outputs carry sourceBytes). */
  compare?: boolean;
  /** Show image previews for each output. */
  previews?: boolean;
  zipName: string;
  onReset: () => void;
  resetLabel?: string;
  children?: ReactNode;
}

function SizeDelta({ before, after }: { before: number; after: number }) {
  const change = percentChange(before, after);
  const smaller = after < before;
  return (
    <span className={smaller ? 'delta delta--down' : 'delta delta--up'}>
      {formatBytes(before)} → {formatBytes(after)}{' '}
      <strong>
        ({change > 0 ? '+' : ''}
        {change}%)
      </strong>
    </span>
  );
}

export function ResultPanel({ outputs, compare = false, previews = false, zipName, onReset, resetLabel = 'Start over', children }: ResultPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [zipping, setZipping] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    sectionRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, []);

  const total = outputs.reduce((sum, file) => sum + file.blob.size, 0);
  const withSource = outputs.filter((file) => file.sourceBytes !== undefined);
  const totalBefore = withSource.reduce((sum, file) => sum + (file.sourceBytes ?? 0), 0);
  const totalAfter = withSource.reduce((sum, file) => sum + file.blob.size, 0);
  const showCompare = compare && withSource.length > 0;
  const grew = showCompare && totalAfter >= totalBefore;

  const downloadZip = async () => {
    setZipping(true);
    setZipError(null);
    try {
      const zip = await makeZip(outputs.map((file) => ({ name: file.name, blob: file.blob })));
      const url = URL.createObjectURL(zip);
      triggerDownload(url, zipName);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setZipError('Couldn’t build the ZIP (the files may be too large together). Download them individually instead.');
    } finally {
      setZipping(false);
    }
  };

  return (
    <section ref={sectionRef} className="result" aria-labelledby="result-heading">
      <div className="result__head">
        <div>
          <p className="label red">Output / ready</p>
          <h2 id="result-heading" ref={headingRef} tabIndex={-1} className="result__title">
            {outputs.length === 1 ? 'Your file is ready' : `${outputs.length} files ready`}
          </h2>
          <p className="mono muted">
            {outputs.length} file{outputs.length === 1 ? '' : 's'} · {formatBytes(total)} total · generated in this browser
          </p>
        </div>
        <span className="stamp result__stamp" aria-hidden="true">
          Done
        </span>
      </div>

      {showCompare && (
        <div className={grew ? 'result__compare result__compare--grew' : 'result__compare'}>
          <div>
            <p className="label">Before</p>
            <p className="result__num">{formatBytes(totalBefore)}</p>
          </div>
          <Icon name="arrowRight" size={28} />
          <div>
            <p className="label">After</p>
            <p className="result__num">{formatBytes(totalAfter)}</p>
          </div>
          <div className="result__pct">
            <p className="label">Change</p>
            <p className="result__num">
              {percentChange(totalBefore, totalAfter) > 0 ? '+' : ''}
              {percentChange(totalBefore, totalAfter)}%
            </p>
          </div>
          {grew && (
            <p className="result__grew">
              <Icon name="alert" size={16} /> The result is not smaller than the original. Your file was probably already well
              optimized — keep the original, or try different settings.
            </p>
          )}
        </div>
      )}

      {children}

      <div className="result__actions">
        {outputs.length === 1 ? (
          <a className="btn btn--primary btn--lg" href={outputs[0].url} download={outputs[0].name}>
            <span>
              <Icon name="download" />
            </span>
            <span>Download</span>
          </a>
        ) : (
          <button type="button" className="btn btn--primary btn--lg" onClick={downloadZip} disabled={zipping}>
            <span>
              <Icon name="zip" />
            </span>
            <span>{zipping ? 'Packing ZIP…' : 'Download all (ZIP)'}</span>
          </button>
        )}
        <button type="button" className="btn" onClick={onReset}>
          <span>
            <Icon name="undo" size={18} />
          </span>
          <span>{resetLabel}</span>
        </button>
      </div>
      {zipError && <p className="field__error">{zipError}</p>}

      <ul className={previews ? 'result__files result__files--previews' : 'result__files'}>
        {outputs.map((file) => (
          <li key={file.id} className="result-file">
            {previews && (
              <a className="result-file__preview" href={file.url} download={file.name} tabIndex={-1} aria-hidden="true">
                <img src={file.url} alt="" loading="lazy" />
              </a>
            )}
            <div className="result-file__info">
              <p className="result-file__name">{file.name}</p>
              <p className="mono muted">
                {compare && file.sourceBytes !== undefined ? <SizeDelta before={file.sourceBytes} after={file.blob.size} /> : formatBytes(file.blob.size)}
                {file.width && file.height ? ` · ${file.width}×${file.height}px` : ''}
              </p>
              {file.note && <p className="mono result-file__note">{file.note}</p>}
            </div>
            <a className="tbtn" href={file.url} download={file.name} aria-label={`Download ${file.name}`}>
              <Icon name="download" size={16} />
              <span aria-hidden="true">Save</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
