import { Component, Suspense, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';
import { getTool } from '../lib/tools';
import { TOOL_COMPONENTS } from '../tools/registry';
import NotFound from './NotFound';

class ToolErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="container section">
          <h1 className="display" style={{ fontSize: 'var(--step-3)' }}>
            This tool hit a problem.
          </h1>
          <p className="muted" style={{ margin: '12px 0 24px' }}>
            Something unexpected happened while loading or running it. Your files were not sent anywhere. Reloading the page usually fixes
            this — if you just deployed a new version, the old code may be cached.
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
              <span>Reload</span>
            </button>
            <Link to="/tools" className="btn">
              <span>All tools</span>
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Loading() {
  return (
    <div className="container section" role="status">
      <div className="progress progress--indeterminate" style={{ maxWidth: 360 }}>
        <div className="progress__track">
          <div className="progress__bar" />
        </div>
        <p className="progress__meta">
          <span>Loading tool…</span>
        </p>
      </div>
    </div>
  );
}

export default function ToolPage() {
  const { slug } = useParams();
  const tool = getTool(slug);
  usePageTitle(tool ? tool.name : 'Tool not found');
  const Tool = tool ? TOOL_COMPONENTS[tool.slug] : undefined;
  if (!tool || !Tool) return <NotFound />;
  return (
    <ToolErrorBoundary key={tool.slug}>
      <Suspense fallback={<Loading />}>
        <Tool tool={tool} />
      </Suspense>
    </ToolErrorBoundary>
  );
}
