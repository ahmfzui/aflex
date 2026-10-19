import type { ReactNode } from 'react';
import type { RejectedFile } from '../../lib/files';
import { Icon } from '../Icon';

interface NoticeProps {
  tone?: 'info' | 'warn' | 'error' | 'ok';
  title?: ReactNode;
  children?: ReactNode;
  onDismiss?: () => void;
  role?: 'alert' | 'status';
}

export function Notice({ tone = 'info', title, children, onDismiss, role }: NoticeProps) {
  const icon = tone === 'error' || tone === 'warn' ? 'alert' : tone === 'ok' ? 'check' : 'lock';
  return (
    <div className={`notice notice--${tone}`} role={role}>
      <Icon name={icon} />
      <div>
        {title && <p className="notice__title">{title}</p>}
        {children && <div className="notice__body">{children}</div>}
      </div>
      {onDismiss ? (
        <button type="button" className="tbtn tbtn--icon" onClick={onDismiss} aria-label="Dismiss message">
          <Icon name="close" size={16} />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

export function RejectedList({ rejected, onDismiss }: { rejected: RejectedFile[]; onDismiss: () => void }) {
  if (rejected.length === 0) return null;
  return (
    <Notice tone="warn" role="alert" title={`${rejected.length} file${rejected.length === 1 ? ' was' : 's were'} not added`} onDismiss={onDismiss}>
      <ul>
        {rejected.map((item, index) => (
          <li key={`${item.name}-${index}`}>
            <strong>{item.name}</strong> — {item.reason}
          </li>
        ))}
      </ul>
    </Notice>
  );
}

export function ProgressBar({ value, label, onCancel }: { value: number | null; label: string; onCancel?: () => void }) {
  const percent = value === null ? null : Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className={percent === null ? 'progress progress--indeterminate' : 'progress'}>
      <div
        className="progress__track"
        role="progressbar"
        aria-label={label || 'Processing'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-valuetext={percent === null ? 'Working' : `${percent}%`}
      >
        <div className="progress__bar" style={percent === null ? undefined : { width: `${percent}%` }} />
      </div>
      <div className="progress__meta">
        <span>{label}</span>
        <span>{percent === null ? 'WORKING' : `${percent}%`}</span>
      </div>
      {onCancel && (
        <button type="button" className="tbtn" onClick={onCancel}>
          <Icon name="close" size={14} /> Cancel
        </button>
      )}
    </div>
  );
}
