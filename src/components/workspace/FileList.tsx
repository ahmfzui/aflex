import type { ReactNode } from 'react';
import { useDragReorder } from '../../hooks/useDragReorder';
import { Icon } from '../Icon';

export interface FileListItem {
  id: string;
  name: string;
  meta: string;
  thumb?: string;
  warning?: string;
}

interface FileListProps {
  items: FileListItem[];
  label: string;
  /** Show order numbers and move controls. */
  orderable?: boolean;
  onMove?: (from: number, to: number) => void;
  onRemove?: (id: string) => void;
  disabled?: boolean;
  extra?: (item: FileListItem) => ReactNode;
}

export function FileList({ items, label, orderable = false, onMove, onRemove, disabled, extra }: FileListProps) {
  const { itemProps } = useDragReorder((from, to) => onMove?.(from, to), orderable && !disabled && items.length > 1);
  return (
    <ol className="file-list" aria-label={label}>
      {items.map((item, index) => (
        <li key={item.id} className="file-item" {...itemProps(index)}>
          <span className="file-item__index" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
          {item.thumb ? (
            <img className="file-item__thumb" src={item.thumb} alt="" />
          ) : (
            <span className="file-item__thumb" aria-hidden="true">
              <Icon name="file" />
            </span>
          )}
          <div>
            <p className="file-item__name">
              {orderable && <span className="sr-only">{`Position ${index + 1}: `}</span>}
              {item.name}
            </p>
            <p className="file-item__meta">{item.meta}</p>
            {item.warning && <p className="file-item__meta red">{item.warning}</p>}
            {extra?.(item)}
          </div>
          <div className="file-item__actions">
            {orderable && onMove && (
              <>
                <button
                  type="button"
                  className="tbtn tbtn--icon"
                  onClick={() => onMove(index, index - 1)}
                  disabled={disabled || index === 0}
                  aria-label={`Move ${item.name} up`}
                >
                  <Icon name="arrowUp" size={16} />
                </button>
                <button
                  type="button"
                  className="tbtn tbtn--icon"
                  onClick={() => onMove(index, index + 1)}
                  disabled={disabled || index === items.length - 1}
                  aria-label={`Move ${item.name} down`}
                >
                  <Icon name="arrowDown" size={16} />
                </button>
              </>
            )}
            {onRemove && (
              <button
                type="button"
                className="tbtn tbtn--icon tbtn--danger"
                onClick={() => onRemove(item.id)}
                disabled={disabled}
                aria-label={`Remove ${item.name}`}
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
