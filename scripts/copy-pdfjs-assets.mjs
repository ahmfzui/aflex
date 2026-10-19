// Copies the static assets PDF.js needs at runtime (CMaps, standard fonts,
// WASM image decoders, ICC profiles) into public/pdfjs so they are served from
// AFlex's own origin. Nothing is fetched from a third-party CDN.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'pdfjs-dist');
const dest = join(root, 'public', 'pdfjs');

if (!existsSync(src)) {
  console.error('pdfjs-dist is not installed. Run `npm install` first.');
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

for (const dir of ['cmaps', 'standard_fonts', 'iccs']) {
  cpSync(join(src, dir), join(dest, dir), { recursive: true });
}

// Only the image decoders are needed; the scripting sandbox (quickjs) is never enabled.
mkdirSync(join(dest, 'wasm'), { recursive: true });
for (const file of readdirSync(join(src, 'wasm'))) {
  if (file.startsWith('quickjs')) continue;
  cpSync(join(src, 'wasm', file), join(dest, 'wasm', file));
}

console.log('PDF.js assets copied to public/pdfjs');
