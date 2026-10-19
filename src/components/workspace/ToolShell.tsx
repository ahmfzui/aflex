import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Runner } from '../../hooks/useRunner';
import { toolIndex, type ToolDefinition } from '../../lib/tools';
import { Icon } from '../Icon';
import { Notice, ProgressBar } from './Feedback';

export interface ToolAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Why the action is disabled, shown to everyone (not just screen readers). */
  reason?: string;
}

interface ToolShellProps {
  tool: ToolDefinition;
  runner: Runner;
  hasInput: boolean;
  /** Drop zone shown when nothing is loaded. */
  intake: ReactNode;
  /** Working area once input is loaded (file list, page grid, preview…). */
  children?: ReactNode;
  settings?: ReactNode;
  /** What this tool does and doesn't do — shown in the side panel. */
  briefing: ReactNode[];
  action: ToolAction;
  /** Short description of the loaded input, e.g. "3 files · 12 pages". */
  status?: string;
  notices?: ReactNode;
  result?: ReactNode;
  onClear?: () => void;
  clearLabel?: string;
}

export function ToolShell({
  tool,
  runner,
  hasInput,
  intake,
  children,
  settings,
  briefing,
  action,
  status,
  notices,
  result,
  onClear,
  clearLabel = 'Clear',
}: ToolShellProps) {
  const index = String(toolIndex(tool.slug)).padStart(2, '0');
  const working = runner.phase === 'working';

  return (
    <div className="ws">
      <header className="ws-hero">
        <div className="ws-hero__index" aria-hidden="true">
          {index}
        </div>
        <div className="container ws-hero__inner">
          <nav aria-label="Breadcrumb" className="breadcrumb mono">
            <ol>
              <li>
                <Link to="/">Home</Link>
              </li>
              <li>
                <Link to="/tools">Tools</Link>
              </li>
              <li>
                <Link to={`/tools?filter=${tool.category}`}>{tool.category === 'pdf' ? 'PDF' : 'Image'}</Link>
              </li>
              <li aria-current="page">{tool.name}</li>
            </ol>
          </nav>
          <h1 className="ws-hero__title display">{tool.name}</h1>
          <p className="ws-hero__desc">{tool.description}</p>
          <div className="ws-hero__chips">
            <span className="chip chip--local">
              <Icon name="lock" size={14} /> Processed on this device · no upload
            </span>
            <span className="chip">{tool.formats}</span>
          </div>
        </div>
      </header>

      <div className="container ws-body">
        <div className="ws-main">
          {notices}
          {hasInput ? children : intake}
        </div>

        <aside className="ws-side" aria-labelledby="ws-side-title">
          <div className="panel">
            <h2 id="ws-side-title" className="panel__title">
              <span className="label red">{hasInput && settings ? 'Controls' : 'Briefing'}</span>
              {hasInput && settings ? 'Settings' : 'How this tool works'}
            </h2>
            {hasInput && settings ? (
              <div className="panel__body">{settings}</div>
            ) : (
              <ul className="briefing">
                {briefing.map((line, i) => (
                  <li key={i}>
                    <span className="briefing__n mono" aria-hidden="true">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <div className="ws-action" data-active={hasInput}>
          <p className="ws-action__status mono" role="status" aria-live="polite">
            {working
              ? runner.progress.label || 'Working…'
              : runner.phase === 'done'
                ? `Done — ${runner.outputs.length} file${runner.outputs.length === 1 ? '' : 's'} ready below.`
                : status || (hasInput && !action.disabled ? 'Ready.' : 'Waiting for input.')}
          </p>
          {working && <ProgressBar value={runner.progress.value} label={runner.progress.label} onCancel={runner.cancel} />}
          {runner.phase === 'error' && runner.error && (
            <Notice tone="error" role="alert" title="That didn’t work" onDismiss={runner.reset}>
              <p>{runner.error}</p>
              <p className="muted">Your original file is unchanged.</p>
            </Notice>
          )}
          <button
            type="button"
            className="btn btn--primary btn--lg btn--block"
            onClick={action.onClick}
            disabled={action.disabled || working}
            aria-describedby={action.disabled && action.reason ? 'ws-action-reason' : undefined}
          >
            <span>
              <Icon name="bolt" />
            </span>
            <span>{working ? 'Working…' : action.label}</span>
          </button>
          {action.disabled && action.reason && !working && (
            <p id="ws-action-reason" className="ws-action__reason">
              {action.reason}
            </p>
          )}
          {hasInput && onClear && (
            <button type="button" className="tbtn ws-action__clear" onClick={onClear} disabled={working}>
              <Icon name="close" size={14} /> {clearLabel}
            </button>
          )}
        </div>
      </div>

      {runner.phase === 'done' && result && <div className="container ws-result">{result}</div>}
    </div>
  );
}
