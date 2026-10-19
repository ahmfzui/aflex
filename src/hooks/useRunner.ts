import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage, uid } from '../lib/files';

export interface OutputSpec {
  name: string;
  blob: Blob;
  /** Size of the input this output came from, for honest before/after numbers. */
  sourceBytes?: number;
  width?: number;
  height?: number;
  note?: string;
}

export interface OutputFile extends OutputSpec {
  id: string;
  url: string;
}

export type Phase = 'idle' | 'working' | 'done' | 'error';

export interface Progress {
  /** 0..1, or null when real progress isn't known (shown as indeterminate). */
  value: number | null;
  label: string;
}

export interface TaskContext {
  signal: AbortSignal;
  report: (value: number | null, label?: string) => void;
}

/**
 * Owns the lifecycle of a processing run: status, truthful progress, errors,
 * cancellation, and the object URLs of produced files (revoked on reset/unmount).
 */
export function useRunner() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<Progress>({ value: null, label: '' });
  const [error, setError] = useState<string | null>(null);
  const [outputs, setOutputs] = useState<OutputFile[]>([]);
  const token = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const urls = useRef<string[]>([]);

  const releaseUrls = useCallback(() => {
    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current = [];
  }, []);

  useEffect(
    () => () => {
      token.current += 1;
      controller.current?.abort();
      releaseUrls();
    },
    [releaseUrls],
  );

  const run = useCallback(
    async (label: string, task: (ctx: TaskContext) => Promise<OutputSpec[]>) => {
      controller.current?.abort();
      releaseUrls();
      setOutputs([]);
      const mine = ++token.current;
      const abort = new AbortController();
      controller.current = abort;
      setError(null);
      setProgress({ value: null, label });
      setPhase('working');
      try {
        const specs = await task({
          signal: abort.signal,
          report: (value, nextLabel) => {
            if (token.current === mine) setProgress((prev) => ({ value, label: nextLabel ?? prev.label }));
          },
        });
        if (token.current !== mine) return;
        const files = specs.map((spec) => ({ ...spec, id: uid('o'), url: URL.createObjectURL(spec.blob) }));
        urls.current = files.map((file) => file.url);
        setOutputs(files);
        setPhase('done');
      } catch (err) {
        if (token.current !== mine) return;
        if (abort.signal.aborted) {
          setPhase('idle');
          return;
        }
        if (import.meta.env.DEV) console.error(err);
        setError(errorMessage(err));
        setPhase('error');
      }
    },
    [releaseUrls],
  );

  const cancel = useCallback(() => {
    token.current += 1;
    controller.current?.abort();
    setPhase('idle');
  }, []);

  const reset = useCallback(() => {
    token.current += 1;
    controller.current?.abort();
    releaseUrls();
    setOutputs([]);
    setError(null);
    setPhase('idle');
  }, [releaseUrls]);

  return { phase, progress, error, outputs, run, cancel, reset };
}

export type Runner = ReturnType<typeof useRunner>;

export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
}
