import { useId, useRef, useState, type DragEvent } from 'react';
import { IMAGE_ACCEPT, PDF_ACCEPT } from '../../lib/files';
import { Icon } from '../Icon';

interface DropZoneProps {
  kind: 'pdf' | 'image';
  multiple: boolean;
  onFiles: (files: File[]) => void;
  compact?: boolean;
  busy?: boolean;
  /** Overrides the compact-mode button label. */
  compactLabel?: string;
  hint?: string;
}

function DropArt({ kind }: { kind: 'pdf' | 'image' }) {
  return (
    <svg className="dropzone__art" viewBox="0 0 112 92" aria-hidden="true">
      <path d="M30 6h40l14 14v66H30z" fill="var(--surface-3)" stroke="var(--line-strong)" strokeWidth="2" transform="rotate(-8 57 46)" />
      <path d="M38 4h40l14 14v66H38z" fill="var(--paper)" />
      <path d="M78 4v14h14" fill="none" stroke="var(--ink)" strokeWidth="2" />
      {kind === 'pdf' ? (
        <>
          <path d="M46 30h34M46 38h34M46 46h22M46 54h30" stroke="var(--ink)" strokeWidth="3" />
          <rect x="44" y="64" width="30" height="13" fill="var(--red)" />
          <text x="59" y="74" textAnchor="middle" fontFamily="var(--font-mono)" fontWeight="700" fontSize="10" fill="var(--ink)">PDF</text>
        </>
      ) : (
        <>
          <rect x="45" y="26" width="38" height="30" fill="var(--ink)" />
          <path d="M45 56l12-13 9 9 6-6 11 10z" fill="var(--red)" />
          <circle cx="74" cy="34" r="4" fill="var(--paper)" />
          <path d="M46 66h30M46 74h20" stroke="var(--ink)" strokeWidth="3" />
        </>
      )}
      <path d="M2 82l22-22M10 90l22-22" stroke="var(--red)" strokeWidth="4" />
      <path d="M100 8v12M94 14h12" stroke="var(--red)" strokeWidth="3" />
    </svg>
  );
}

/**
 * File intake area. Clicking anywhere opens the native picker; the visible
 * button is the keyboard/screen-reader path; dropping files also works.
 */
export function DropZone({ kind, multiple, onFiles, compact = false, busy = false, compactLabel, hint }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const depth = useRef(0);
  const hintId = useId();
  const noun = kind === 'pdf' ? (multiple ? 'PDFs' : 'PDF') : multiple ? 'images' : 'image';

  const pick = () => inputRef.current?.click();

  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes('Files');

  const onDragEnter = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth.current += 1;
    setDrag(true);
  };
  const onDragLeave = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDrag(false);
  };
  const onDragOver = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };
  const onDrop = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    depth.current = 0;
    setDrag(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };

  const hintText =
    hint ??
    (kind === 'pdf'
      ? `Drop ${multiple ? 'one or more PDF files' : 'a PDF file'} here, or browse your device. Files stay on this device.`
      : `PNG, JPEG, WebP, GIF, BMP or AVIF${multiple ? ' — add as many as you need' : ''}. Files stay on this device.`);

  return (
    <div
      className={compact ? 'dropzone dropzone--compact' : 'dropzone'}
      data-drag={drag}
      onClick={(event) => {
        if (event.target === inputRef.current) return;
        if ((event.target as HTMLElement).closest('button')) return;
        pick();
      }}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        accept={kind === 'pdf' ? PDF_ACCEPT : IMAGE_ACCEPT}
        multiple={multiple}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
      {compact ? (
        <>
          <Icon name="plus" size={24} className="red" />
          <div>
            <p className="dropzone__title">{drag ? 'Release to add' : `Drop more ${noun}`}</p>
            <p className="dropzone__hint mono" id={hintId}>
              or use the button
            </p>
          </div>
          <button type="button" className="tbtn" onClick={pick} disabled={busy} aria-describedby={hintId}>
            <Icon name="upload" size={16} />
            {compactLabel ?? 'Add files'}
          </button>
        </>
      ) : (
        <>
          <DropArt kind={kind} />
          <p className="dropzone__title">
            {drag ? (
              <>
                Release to <em>load</em>
              </>
            ) : (
              <>
                Drop your <em>{noun}</em>
              </>
            )}
          </p>
          <p className="dropzone__hint" id={hintId}>
            {hintText}
          </p>
          <button type="button" className="btn btn--primary" onClick={pick} disabled={busy} aria-describedby={hintId}>
            <span>
              <Icon name="upload" size={18} />
            </span>
            <span>{busy ? 'Checking…' : `Choose ${noun}`}</span>
          </button>
        </>
      )}
    </div>
  );
}
