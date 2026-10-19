/// <reference lib="webworker" />
import * as ops from './ops';
import type { WorkerRequest, WorkerResponse } from './pdfClient';

declare const self: DedicatedWorkerGlobalScope;

function collectTransfers(value: unknown, out: Transferable[] = []): Transferable[] {
  if (value instanceof Uint8Array) out.push(value.buffer as ArrayBuffer);
  else if (Array.isArray(value)) for (const item of value) collectTransfers(item, out);
  return out;
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, op, args } = event.data;
  try {
    const fn = ops[op] as (...a: unknown[]) => Promise<unknown>;
    const result = await fn(...args);
    const response: WorkerResponse = { id, ok: true, result };
    self.postMessage(response, collectTransfers(result));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const response: WorkerResponse = { id, ok: false, error: { name: err.name, message: err.message } };
    self.postMessage(response);
  }
};
