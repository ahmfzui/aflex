import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Native modal <dialog>: focus trapping, Escape and inert background come from the browser. */
export function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      confirmRef.current?.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div className="dialog__inner">
        <h2 id={titleId} className="dialog__title">
          {title}
        </h2>
        <div className="muted">{children}</div>
        <div className="dialog__actions">
          <button type="button" className="btn" onClick={onCancel}>
            <span>Go back</span>
          </button>
          <button ref={confirmRef} type="button" className="btn btn--primary" onClick={onConfirm}>
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </dialog>
  );
}
