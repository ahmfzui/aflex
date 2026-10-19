import { useCallback, useState } from 'react';
import type { CheckedFile } from '../lib/files';
import { useIntake } from './useIntake';
import { usePdfDocument } from './usePdfDocument';
import type { Runner } from './useRunner';

/** Shared intake + PDF.js document state for tools that work on one PDF. */
export function useSinglePdf(runner: Runner, onLoaded?: () => void) {
  const [file, setFile] = useState<CheckedFile | null>(null);
  const { intake, rejected, clearRejected, checking } = useIntake('pdf', 1);
  const pdf = usePdfDocument(file?.file ?? null);

  const load = useCallback(
    async (files: File[]) => {
      const [first] = await intake(files.slice(0, 1));
      if (!first) return;
      runner.reset();
      setFile(first);
      onLoaded?.();
    },
    [intake, runner, onLoaded],
  );

  const clear = useCallback(() => {
    runner.reset();
    setFile(null);
    clearRejected();
  }, [runner, clearRejected]);

  return { file, pdf, load, clear, rejected, clearRejected, checking };
}
