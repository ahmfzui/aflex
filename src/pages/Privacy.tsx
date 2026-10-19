import { Link } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';

const SECTIONS = [
  {
    title: 'Where your files are processed',
    body: [
      'Every AFlex tool runs inside your web browser. When you choose or drop a file, the browser reads it into this tab’s memory; JavaScript and WebAssembly code (pdf-lib, PDF.js, fflate and exifr) process it there, and the result is handed back to you as a download.',
      'AFlex has no file-processing server and no upload endpoint. Your files and their contents are never transmitted.',
    ],
  },
  {
    title: 'What the network is used for',
    body: [
      'Your browser downloads AFlex itself — its HTML, scripts, styles and fonts — plus static helper files used by the PDF renderer (font metrics, character maps and image decoders). All of these come from AFlex’s own domain; nothing is loaded from third-party CDNs.',
      'As an extra safeguard, the site sends a Content-Security-Policy that blocks the page’s scripts from making network requests (fetch, XHR, WebSockets) to any other origin, and from loading scripts, fonts or images from third parties.',
      'Like any website host, the hosting provider (Vercel) may keep standard request logs for page loads, such as IP address and requested URL. Those requests never contain your files.',
    ],
  },
  {
    title: 'What is stored',
    body: [
      'Nothing. AFlex doesn’t use cookies, local storage, IndexedDB or accounts. Files and results live only in memory while the tab is open and are released when you start over, leave the tool, or close the tab.',
      'Downloads are saved by your browser to wherever you choose — that’s the only copy AFlex creates.',
    ],
  },
  {
    title: 'Analytics and tracking',
    body: ['AFlex includes no analytics, advertising or tracking scripts. We don’t collect file names, sizes, metadata or usage statistics.'],
  },
  {
    title: 'Limits worth knowing',
    body: [
      'Because processing happens on your device, speed and maximum file size depend on your device’s memory. Very large PDFs or images may be slow or may exceed what the browser allows; AFlex shows an error instead of failing silently.',
      'Compress PDF’s “Rasterize” method converts pages to images and removes selectable text, links and form fields. The tool explains this before you run it.',
      'Image Metadata removes the metadata blocks it can identify in JPEG, PNG and WebP files and then re-checks the output. It can’t guarantee removal of information hidden in the pixels themselves (for example, visible text or faces).',
    ],
  },
];

export default function Privacy() {
  usePageTitle('Privacy');
  return (
    <>
      <header className="page-hero">
        <div className="container page-hero__inner">
          <p className="label red">Privacy / plain language</p>
          <h1 className="page-hero__title display">
            Local by <em>design</em>
          </h1>
          <p className="page-hero__sub">Your files are processed on your device and never uploaded. Here’s exactly what that means.</p>
        </div>
      </header>
      <div className="container prose-wrap">
        <nav className="prose-toc" aria-label="On this page">
          <p className="label">On this page</p>
          <ol>
            {SECTIONS.map((section, i) => (
              <li key={section.title}>
                <a href={`#privacy-${i}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="prose">
          {SECTIONS.map((section, i) => (
            <section key={section.title} id={`privacy-${i}`} aria-labelledby={`privacy-${i}-title`}>
              <h2 id={`privacy-${i}-title`}>
                <span className="mono red">0{i + 1}</span> {section.title}
              </h2>
              {section.body.map((paragraph) => (
                <p key={paragraph.slice(0, 32)}>{paragraph}</p>
              ))}
            </section>
          ))}
          <p className="prose__cta">
            Ready? <Link className="link" to="/tools">Pick a tool</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
