/**
 * Runs pdf-lib operations in a dedicated Web Worker so large documents don't
 * freeze the page. Falls back to the main thread if workers are unavailable.
 */
import type * as Ops from './ops';

type OpsModule = typeof Ops;
export type WorkerOp = {
  [K in keyof OpsModule]: OpsModule[K] extends (...args: never[]) => Promise<unknown> ? K : never;
}[keyof OpsModule];

export interface WorkerRequest {
  id: number;
  op: WorkerOp;
  args: unknown[];
}

export type WorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: { name: string; message: string } };

let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>();

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./pdfWorker.ts', import.meta.url), { type: 'module', name: 'aflex-pdf' });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const data = event.data;
      const entry = pending.get(data.id);
      if (!entry) return;
      pending.delete(data.id);
      if (data.ok) entry.resolve(data.result);
      else {
        const error = new Error(data.error.message);
        error.name = data.error.name;
        entry.reject(error);
      }
    };
    worker.onerror = () => {
      // A crashed worker (e.g. out of memory) rejects everything in flight.
      for (const entry of pending.values()) entry.reject(new Error('The PDF worker stopped unexpectedly (possibly out of memory).'));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
    return worker;
  } catch {
    workerBroken = true;
    return null;
  }
}

function transfersOf(args: unknown[]): Transferable[] {
  const out: Transferable[] = [];
  const visit = (value: unknown) => {
    if (value instanceof Uint8Array) out.push(value.buffer as ArrayBuffer);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  args.forEach(visit);
  // A buffer may only be listed once.
  return [...new Set(out)];
}

/**
 * Run an operation from ops.ts. Byte arrays passed in are transferred to the
 * worker (they become unusable here), so always pass freshly-read copies.
 */
export async function runPdf<K extends WorkerOp>(
  op: K,
  ...args: Parameters<OpsModule[K]>
): Promise<Awaited<ReturnType<OpsModule[K]>>> {
  const target = getWorker();
  if (!target) {
    const ops = await import('./ops');
    const fn = ops[op] as (...a: unknown[]) => Promise<unknown>;
    return (await fn(...args)) as Awaited<ReturnType<OpsModule[K]>>;
  }
  const id = nextId++;
  const result = await new Promise<unknown>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const request: WorkerRequest = { id, op, args };
    target.postMessage(request, transfersOf(args));
  });
  return result as Awaited<ReturnType<OpsModule[K]>>;
}
