import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HeroGraphic } from '../components/HeroGraphic';
import { Icon } from '../components/Icon';
import { Reveal } from '../components/Reveal';
import { ToolExplorer } from '../components/ToolExplorer';
import { usePageTitle } from '../hooks/usePageTitle';
import { FEATURED_SLUGS, TOOLS, getTool, toolIndex, type ToolFilter } from '../lib/tools';

const TICKER = ['Merge', 'Split', 'Reorder', 'Compress', 'Convert', 'Resize', 'Rotate', 'Strip EXIF', 'PDF → IMG', 'IMG → PDF'];

const FEATURE_STYLE = ['feature--red', 'feature--paper', 'feature--dark', 'feature--outline'] as const;

export default function Home() {
  usePageTitle(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ToolFilter>('all');

  return (
    <>
      {/* ---------------- HERO ---------------- */}
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__slab" aria-hidden="true" />
        <div className="container hero__grid">
          <div className="hero__copy">
            <p className="hero__eyebrow label">
              <span className="hero__eyebrow-mark" aria-hidden="true" />
              AFLEX / FILE OPERATIONS SYSTEM
            </p>
            <h1 id="hero-title" className="hero__title display">
              <span className="hero__line hero__line--1">Your files.</span>
              <span className="hero__line hero__line--2">Your rules.</span>
            </h1>
            <p className="hero__sub">Convert. Compress. Rearrange. Take control of every file.</p>
            <div className="hero__actions">
              <a href="#tools" className="btn btn--primary btn--lg">
                <span>Explore tools</span>
                <span>
                  <Icon name="arrowDown" size={20} />
                </span>
              </a>
              <a href="#how-it-works" className="btn btn--lg">
                <span>How it works</span>
              </a>
            </div>
            <dl className="hero__specs mono">
              <div>
                <dt>Tools</dt>
                <dd>{TOOLS.length}</dd>
              </div>
              <div>
                <dt>Uploads</dt>
                <dd>None</dd>
              </div>
              <div>
                <dt>Account</dt>
                <dd>Not needed</dd>
              </div>
            </dl>
          </div>
          <div className="hero__art">
            <HeroGraphic />
            <span className="hero__status mono">
              <span className="status-chip__dot" aria-hidden="true" /> LOCAL MODE / READY
            </span>
          </div>
        </div>
      </section>

      {/* ---------------- TICKER ---------------- */}
      <div className="ticker-wrap" aria-hidden="true">
        <div className="ticker">
        <div className="ticker__track">
          {[0, 1].map((copy) => (
            <span key={copy} className="ticker__group">
              <span className="ticker__item ticker__item--hot">Break the file limit.</span>
              {TICKER.map((word) => (
                <span key={word} className="ticker__item">
                  {word}
                </span>
              ))}
            </span>
          ))}
        </div>
        </div>
      </div>

      {/* ---------------- FEATURED ---------------- */}
      <section className="section container" aria-labelledby="featured-title">
        <Reveal className="section-head">
          <span className="section-head__index">
            <span>01</span>
          </span>
          <h2 id="featured-title" className="section-head__title display">
            Signature <em>moves</em>
          </h2>
          <p className="section-head__note">The operations people reach for most. Every one runs entirely in your browser.</p>
        </Reveal>
        <ul className="features">
          {FEATURED_SLUGS.map((slug, i) => {
            const tool = getTool(slug)!;
            return (
              <Reveal as="li" key={slug} className={`feature ${FEATURE_STYLE[i]}`} delay={i * 70}>
                <Link to={`/tools/${slug}`} className="feature__link">
                  <span className="feature__num" aria-hidden="true">
                    {String(toolIndex(slug)).padStart(2, '0')}
                  </span>
                  <span className="feature__icon" aria-hidden="true">
                    <Icon name={tool.icon} size={i === 0 ? 40 : 30} />
                  </span>
                  <span className="feature__cat label">{tool.category === 'pdf' ? 'PDF tool' : 'Image tool'}</span>
                  <span className="feature__name display">{tool.name}</span>
                  <span className="feature__desc">{tool.description}</span>
                  <span className="feature__cta label">
                    Open tool <Icon name="arrowRight" size={16} />
                  </span>
                </Link>
              </Reveal>
            );
          })}
        </ul>
      </section>

      {/* ---------------- EXPLORER ---------------- */}
      <section id="tools" className="section section--band" aria-labelledby="tools-title">
        <div className="container">
          <Reveal className="section-head">
            <span className="section-head__index">
              <span>02</span>
            </span>
            <h2 id="tools-title" className="section-head__title display">
              The <em>arsenal</em>
            </h2>
            <p className="section-head__note">Search or filter all {TOOLS.length} tools. Each one opens a dedicated workspace.</p>
          </Reveal>
          <ToolExplorer query={query} filter={filter} onQuery={setQuery} onFilter={setFilter} />
        </div>
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section id="how-it-works" className="section container" aria-labelledby="how-title">
        <Reveal className="section-head">
          <span className="section-head__index">
            <span>03</span>
          </span>
          <h2 id="how-title" className="section-head__title display">
            How it <em>works</em>
          </h2>
          <p className="section-head__note">Three steps. No sign-up, no waiting for uploads.</p>
        </Reveal>
        <ol className="steps">
          {[
            { title: 'Choose a tool', body: 'Pick an operation from the arsenal. Every tool has its own focused workspace.', icon: 'grid' as const },
            { title: 'Process your file', body: 'Drop files in or browse. Arrange, tune settings, then hit the red button. Your browser does the work.', icon: 'bolt' as const },
            { title: 'Download the result', body: 'Save the output — single files directly, multiple files as a ZIP. Your original stays untouched.', icon: 'download' as const },
          ].map((step, i) => (
            <Reveal as="li" key={step.title} className="step" delay={i * 90}>
              <span className="step__num" aria-hidden="true">
                0{i + 1}
              </span>
              <span className="step__icon" aria-hidden="true">
                <Icon name={step.icon} size={26} />
              </span>
              <h3 className="step__title display">{step.title}</h3>
              <p className="step__body">{step.body}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ---------------- PRIVACY ---------------- */}
      <section className="privacy-band on-red" aria-labelledby="privacy-title">
        <div className="container privacy-band__grid">
          <Reveal>
            <p className="label">04 / Privacy</p>
            <h2 id="privacy-title" className="privacy-band__title display">
              Your files never leave your device.
            </h2>
          </Reveal>
          <Reveal className="privacy-band__facts" delay={100}>
            <ul>
              <li>
                <Icon name="lock" /> Every tool processes files inside this browser tab using JavaScript and WebAssembly.
              </li>
              <li>
                <Icon name="check" /> AFlex has no file-processing server, no accounts and no analytics.
              </li>
              <li>
                <Icon name="check" /> Nothing is saved between visits. Close the tab and the files are gone from memory.
              </li>
            </ul>
            <Link to="/privacy" className="btn btn--ink">
              <span>Read the details</span>
              <span>
                <Icon name="arrowRight" size={18} />
              </span>
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
