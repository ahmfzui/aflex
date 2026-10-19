import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';

export default function NotFound() {
  usePageTitle('Not found');
  return (
    <section className="not-found container">
      <p className="not-found__code display" aria-hidden="true">
        404
      </p>
      <h1 className="display not-found__title">
        Page <em>not found</em>
      </h1>
      <p className="muted">That address doesn’t lead anywhere in AFlex.</p>
      <div className="not-found__actions">
        <Link to="/tools" className="btn btn--primary">
          <span>Browse tools</span>
        </Link>
        <Link to="/" className="btn">
          <span>Home</span>
        </Link>
      </div>
    </section>
  );
}
