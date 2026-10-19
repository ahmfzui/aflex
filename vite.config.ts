/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

interface VercelHeaders {
  headers?: { source: string; headers: { key: string; value: string }[] }[];
}

/**
 * Serve the same security headers (CSP etc.) locally with `vite preview` as
 * Vercel does in production, so a CSP problem shows up before deploying.
 */
function productionHeaders(): Record<string, string> {
  const config = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as VercelHeaders;
  const global = config.headers?.find((entry) => entry.source === '/(.*)');
  return Object.fromEntries((global?.headers ?? []).map(({ key, value }) => [key, value]));
}

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
  preview: {
    headers: productionHeaders(),
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
