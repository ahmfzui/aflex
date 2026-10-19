import { useCallback, useState } from 'react';
import { validateFiles, type CheckedFile, type RejectedFile } from '../lib/files';

/**
 * Validates picked/dropped files and keeps a list of rejections to show the user.
 */
export function useIntake(kind: 'pdf' | 'image', maxFiles: number) {
  const [rejected, setRejected] = useState<RejectedFile[]>([]);
  const [checking, setChecking] = useState(false);

  const intake = useCallback(
    async (files: File[], existing: { count: number; bytes: number } = { count: 0, bytes: 0 }): Promise<CheckedFile[]> => {
      setChecking(true);
      try {
        const result = await validateFiles(files, { kind, maxFiles, existingCount: existing.count, existingBytes: existing.bytes });
        setRejected(result.rejected);
        return result.accepted;
      } finally {
        setChecking(false);
      }
    },
    [kind, maxFiles],
  );

  const clearRejected = useCallback(() => setRejected([]), []);

  return { intake, rejected, clearRejected, checking };
}
