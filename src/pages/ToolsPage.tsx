import { useSearchParams } from 'react-router-dom';
import { ToolExplorer } from '../components/ToolExplorer';
import { usePageTitle } from '../hooks/usePageTitle';
import { TOOLS, type ToolFilter } from '../lib/tools';

const isFilter = (value: string | null): value is ToolFilter => value === 'all' || value === 'pdf' || value === 'image';

export default function ToolsPage() {
  usePageTitle('All tools');
  const [params, setParams] = useSearchParams();
  const raw = params.get('filter');
  const filter: ToolFilter = isFilter(raw) ? raw : 'all';
  const query = params.get('q') ?? '';

  const update = (next: { q?: string; filter?: ToolFilter }) => {
    const merged = { q: next.q ?? query, filter: next.filter ?? filter };
    const out = new URLSearchParams();
    if (merged.q) out.set('q', merged.q);
    if (merged.filter !== 'all') out.set('filter', merged.filter);
    setParams(out, { replace: true });
  };

  return (
    <>
      <header className="page-hero">
        <div className="container page-hero__inner">
          <p className="label red">Directory / {TOOLS.length} tools</p>
          <h1 className="page-hero__title display">
            Tool <em>directory</em>
          </h1>
          <p className="page-hero__sub">Every AFlex operation in one place. All of them run locally in your browser.</p>
        </div>
      </header>
      <section className="section container" aria-label="Tools" style={{ paddingTop: 32 }}>
        <ToolExplorer query={query} filter={filter} onQuery={(q) => update({ q })} onFilter={(f) => update({ filter: f })} />
      </section>
    </>
  );
}
