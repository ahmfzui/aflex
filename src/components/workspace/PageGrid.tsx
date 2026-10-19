import type { ReactNode } from 'react';
import { useDragReorder } from '../../hooks/useDragReorder';
import { Icon } from '../Icon';

export interface PageItem {
  /** Stable identity (survives reordering). */
  key: string;
  /** 0-based index in the original document. */
  source: number;
  thumb?: string;
  /** Extra clockwise rotation to preview, in degrees. */
  rotation?: number;
  badge?: string;
  /** Dim the page (e.g. not included in any output). */
  muted?: boolean;
}

type Mode = 'select' | 'mark' | 'reorder' | 'view';

interface PageGridProps {
  items: PageItem[];
  mode: Mode;
  label: string;
  /** Keys that are selected (select mode) or marked for removal (mark mode). */
  active?: Set<string>;
  onToggle?: (key: string) => void;
  onMove?: (from: number, to: number) => void;
  disabled?: boolean;
  renderActions?: (item: PageItem, position: number) => ReactNode;
}

export function PageGrid({ items, mode, label, active, onToggle, onMove, disabled, renderActions }: PageGridProps) {
  const { itemProps } = useDragReorder((from, to) => onMove?.(from, to), mode === 'reorder' && !disabled);

  return (
    <ol className="page-grid" aria-label={label}>
      {items.map((item, position) => {
        const isActive = active?.has(item.key) ?? false;
        const pageLabel = `Page ${item.source + 1}`;
        const thumb = item.thumb ? (
          <img
            src={item.thumb}
            alt=""
            style={item.rotation ? { transform: `rotate(${item.rotation}deg) scale(${item.rotation % 180 ? 0.75 : 1})` } : undefined}
          />
        ) : (
          <span className="page-card__placeholder" aria-hidden="true" />
        );
        const inner = (
          <>
            {thumb}
            <span className="page-card__num" aria-hidden="true">
              {mode === 'reorder' ? `${position + 1}` : `P${item.source + 1}`}
            </span>
            {mode === 'select' && (
              <span className="page-card__check" aria-hidden="true">
                {isActive && <Icon name="check" size={14} />}
              </span>
            )}
            {mode === 'mark' && isActive && (
              <span className="page-card__cut" aria-hidden="true">
                <span className="stamp">Cut</span>
              </span>
            )}
            {item.badge && (
              <span className="page-card__badge" aria-hidden="true">
                {item.badge}
              </span>
            )}
          </>
        );
        const description = [
          mode === 'reorder' ? `${pageLabel}, now at position ${position + 1}` : pageLabel,
          item.rotation ? `rotated ${item.rotation}°` : '',
          item.badge ? item.badge : '',
        ]
          .filter(Boolean)
          .join(', ');

        return (
          <li
            key={item.key}
            className="page-card"
            data-selected={mode === 'select' && isActive ? 'true' : undefined}
            data-marked={mode === 'mark' && isActive ? 'true' : undefined}
            data-muted={item.muted ? 'true' : undefined}
            {...itemProps(position)}
          >
            {mode === 'select' || mode === 'mark' ? (
              <button
                type="button"
                className="page-card__btn"
                aria-pressed={isActive}
                aria-label={`${description}${mode === 'mark' ? (isActive ? ' — marked for deletion' : '') : ''}`}
                onClick={() => onToggle?.(item.key)}
                disabled={disabled}
              >
                {inner}
              </button>
            ) : (
              <div className="page-card__btn" role="img" aria-label={description}>
                {inner}
              </div>
            )}
            {mode === 'reorder' && onMove && (
              <div className="page-card__actions">
                <button
                  type="button"
                  className="tbtn"
                  onClick={() => onMove(position, 0)}
                  disabled={disabled || position === 0}
                  aria-label={`Move ${pageLabel} to the start`}
                  title="Move to start"
                >
                  <Icon name="arrowLeft" size={14} />
                  <Icon name="arrowLeft" size={14} />
                </button>
                <button
                  type="button"
                  className="tbtn"
                  onClick={() => onMove(position, position - 1)}
                  disabled={disabled || position === 0}
                  aria-label={`Move ${pageLabel} earlier`}
                  title="Move earlier"
                >
                  <Icon name="arrowLeft" size={16} />
                </button>
                <button
                  type="button"
                  className="tbtn"
                  onClick={() => onMove(position, position + 1)}
                  disabled={disabled || position === items.length - 1}
                  aria-label={`Move ${pageLabel} later`}
                  title="Move later"
                >
                  <Icon name="arrowRight" size={16} />
                </button>
              </div>
            )}
            {renderActions?.(item, position)}
          </li>
        );
      })}
    </ol>
  );
}
