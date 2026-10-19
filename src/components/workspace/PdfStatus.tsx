import type { PdfDocumentState } from '../../hooks/usePdfDocument';
import { formatBytes, type CheckedFile } from '../../lib/files';
import { Notice } from './Feedback';

/** Loading / error states for a single loaded PDF, plus a compact file summary. */
export function PdfStatus({ file, pdf, onClear }: { file: CheckedFile; pdf: PdfDocumentState; onClear: () => void }) {
  if (pdf.status === 'loading') {
    return (
      <div className="loading-block" role="status">
        <div className="progress progress--indeterminate" style={{ width: 'min(320px, 80%)' }}>
          <div className="progress__track">
            <div className="progress__bar" />
          </div>
        </div>
        <p className="mono">Opening {file.file.name}…</p>
      </div>
    );
  }
  if (pdf.status === 'error') {
    return (
      <Notice tone="error" role="alert" title={`Couldn’t open ${file.file.name}`}>
        <p>{pdf.error}</p>
        <p>
          <button type="button" className="tbtn" onClick={onClear}>
            Choose a different file
          </button>
        </p>
      </Notice>
    );
  }
  return null;
}

export function PdfSummary({ file, pageCount, extra }: { file: CheckedFile; pageCount: number; extra?: string }) {
  return (
    <div className="summary-bar">
      <span>
        FILE <strong>{file.file.name}</strong>
      </span>
      <span>
        SIZE <strong>{formatBytes(file.file.size)}</strong>
      </span>
      <span>
        PAGES <strong>{pageCount}</strong>
      </span>
      {extra && <span>{extra}</span>}
    </div>
  );
}
