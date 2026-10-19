import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { TOOLS } from '../lib/tools';
import { Icon } from './Icon';

export function BrandMark({ className = 'brand__mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <path d="M6 3h31l-4 34H2z" fill="var(--red)" />
      <path d="M11 31l8-22h4l7 22h-5l-1.6-5h-6l-1.8 5zM18.7 22h4l-2-6.6z" fill="var(--ink)" />
      <path d="M27 3h10l-1 9z" fill="var(--paper)" />
    </svg>
  );
}

function SiteHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const onTools = location.pathname === '/tools';
  const filter = new URLSearchParams(location.search).get('filter');

  // Close the mobile menu after navigating.
  const [navKey, setNavKey] = useState(location.key);
  if (navKey !== location.key) {
    setNavKey(location.key);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link to="/" className="brand" aria-label="AFlex home">
          <BrandMark />
          <span className="brand__word">
            A<em>FLEX</em>
          </span>
        </Link>
        <button
          type="button"
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name={open ? 'close' : 'menu'} />
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
        </button>
        <nav id="site-nav" className="site-nav" aria-label="Main" data-open={open}>
          <Link to="/tools" aria-current={onTools && !filter ? 'page' : undefined}>
            All tools
          </Link>
          <Link to="/tools?filter=pdf" aria-current={onTools && filter === 'pdf' ? 'page' : undefined}>
            PDF
          </Link>
          <Link to="/tools?filter=image" aria-current={onTools && filter === 'image' ? 'page' : undefined}>
            Image
          </Link>
          <Link to="/#how-it-works">How it works</Link>
          <NavLink to="/privacy">Privacy</NavLink>
        </nav>
        <span className="status-chip" title="All processing happens in this browser tab">
          <span className="status-chip__dot" aria-hidden="true" />
          Local mode / ready
        </span>
      </div>
    </header>
  );
}

function SiteFooter() {
  const pdf = TOOLS.filter((tool) => tool.category === 'pdf');
  const image = TOOLS.filter((tool) => tool.category === 'image');
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <Link to="/" className="brand" aria-label="AFlex home">
            <BrandMark />
            <span className="brand__word">
              A<em>FLEX</em>
            </span>
          </Link>
          <p>PDF &amp; image toolkit. Files are processed inside your browser — no uploads, no accounts, no tracking.</p>
        </div>
        <nav aria-labelledby="footer-pdf">
          <h2 id="footer-pdf" className="label red">
            PDF tools
          </h2>
          <ul>
            {pdf.map((tool) => (
              <li key={tool.slug}>
                <Link to={`/tools/${tool.slug}`}>{tool.name}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-labelledby="footer-image">
          <h2 id="footer-image" className="label red">
            Image tools
          </h2>
          <ul>
            {image.map((tool) => (
              <li key={tool.slug}>
                <Link to={`/tools/${tool.slug}`}>{tool.name}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-labelledby="footer-about">
          <h2 id="footer-about" className="label red">
            AFlex
          </h2>
          <ul>
            <li>
              <Link to="/tools">Tool directory</Link>
            </li>
            <li>
              <Link to="/#how-it-works">How it works</Link>
            </li>
            <li>
              <Link to="/privacy">Privacy</Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="container site-footer__base mono">
        <span>AFLEX / FILE OPERATIONS SYSTEM</span>
        <span>YOUR FILES. YOUR RULES.</span>
      </div>
      <div className="site-footer__giant" aria-hidden="true">
        AFLEX AFLEX
      </div>
    </footer>
  );
}

/** Scroll to top (or to a hash target) and move focus to main content on navigation. */
function useRouteFocus(mainRef: React.RefObject<HTMLElement | null>) {
  const location = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) {
        target.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname, location.hash, mainRef]);
}

export function Layout() {
  const mainRef = useRef<HTMLElement>(null);
  useRouteFocus(mainRef);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" ref={mainRef} className="page-main" tabIndex={-1}>
        <Outlet />
      </main>
      <SiteFooter />
    </>
  );
}
