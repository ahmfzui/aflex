import { useId, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TOOLS, filterTools, toolIndex, type ToolDefinition, type ToolFilter } from '../lib/tools';
import { Icon } from './Icon';

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  return (
    <Link to={`/tools/${tool.slug}`} className="tool-card" data-cat={tool.category}>
      <div className="tool-card__top">
        <span className="tool-card__index">{String(toolIndex(tool.slug)).padStart(2, '0')}</span>
        <span className="tool-card__cat">{tool.category === 'pdf' ? 'PDF' : 'IMG'}</span>
      </div>
      <h3 className="tool-card__name">
        <span className="tool-card__icon" aria-hidden="true">
          <Icon name={tool.icon} size={22} />
        </span>
        {tool.name}
      </h3>
      <p className="tool-card__desc">{tool.description}</p>
      <div className="tool-card__foot">
        <span>{tool.formats}</span>
        <Icon name="arrowRight" size={18} className="tool-card__go" />
      </div>
    </Link>
  );
}

const FILTERS: { value: ToolFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: 'Image' },
];

interface ToolExplorerProps {
  query: string;
  filter: ToolFilter;
  onQuery: (value: string) => void;
  onFilter: (value: ToolFilter) => void;
}

/** Search + category filter + grid. State is owned by the parent (URL on /tools). */
export function ToolExplorer({ query, filter, onQuery, onFilter }: ToolExplorerProps) {
  const searchId = useId();
  const results = useMemo(() => filterTools(TOOLS, query, filter), [query, filter]);
  const counts = useMemo(
    () => ({ all: TOOLS.length, pdf: TOOLS.filter((t) => t.category === 'pdf').length, image: TOOLS.filter((t) => t.category === 'image').length }),
    [],
  );

  return (
    <div className="explorer">
      <div className="explorer__bar">
        <div className="search" role="search">
          <label htmlFor={searchId} className="sr-only">
            Search tools
          </label>
          <Icon name="search" size={24} />
          <input
            id={searchId}
            type="search"
            placeholder="Search: merge, exif, resize…"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="filters" role="group" aria-label="Filter by category">
          {FILTERS.map((option) => (
            <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => onFilter(option.value)}>
              <span>
                {option.label}
                <sup>{counts[option.value]}</sup>
              </span>
            </button>
          ))}
        </div>
      </div>
      <p className="explorer__count mono" role="status" aria-live="polite">
        {results.length} tool{results.length === 1 ? '' : 's'}
        {query ? ` matching “${query}”` : ''}
        {filter !== 'all' ? ` in ${filter === 'pdf' ? 'PDF' : 'Image'}` : ''}
      </p>
      {results.length ? (
        <ul className="tool-grid">
          {results.map((tool) => (
            <li key={tool.slug}>
              <ToolCard tool={tool} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="explorer__empty">
          <p className="display" style={{ fontSize: 'var(--step-2)' }}>
            No tool matches that.
          </p>
          <p className="muted">Try a different word, or browse everything.</p>
          <button
            type="button"
            className="tbtn"
            onClick={() => {
              onQuery('');
              onFilter('all');
            }}
          >
            Show all tools
          </button>
        </div>
      )}
    </div>
  );
}
