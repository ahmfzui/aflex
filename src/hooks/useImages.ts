import { useCallback, useEffect, useRef, useState } from 'react';
import { readDimensions } from '../lib/image/canvas';
import { errorMessage, type CheckedFile, type ImageType } from '../lib/files';
import { moveItem } from './useDragReorder';
import { useIntake } from './useIntake';
import type { Runner } from './useRunner';

export interface ImageItem extends Omit<CheckedFile, 'type'> {
  type: ImageType;
  /** Object URL of the original file, for previews. */
  url: string;
  width?: number;
  height?: number;
  error?: string;
}

/**
 * A list of validated images with preview URLs and dimensions.
 * Any change resets the runner so results never go stale.
 */
export function useImageList(runner: Runner, maxFiles: number) {
  const { intake, rejected, clearRejected, checking } = useIntake('image', maxFiles);
  const [items, setItems] = useState<ImageItem[]>([]);
  const urls = useRef(new Set<string>());

  useEffect(() => {
    const set = urls.current;
    return () => set.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const add = useCallback(
    async (files: File[], replace = false) => {
      const accepted = await intake(files, { count: replace ? 0 : items.length, bytes: 0 });
      if (!accepted.length) return [];
      runner.reset();
      const next: ImageItem[] = accepted.map((item) => {
        const url = URL.createObjectURL(item.file);
        urls.current.add(url);
        return { ...item, type: item.type as ImageType, url };
      });
      setItems((list) => {
        if (replace) {
          for (const old of list) {
            URL.revokeObjectURL(old.url);
            urls.current.delete(old.url);
          }
          return next;
        }
        return [...list, ...next];
      });
      for (const item of next) {
        readDimensions(item.file)
          .then(({ width, height }) => setItems((list) => list.map((entry) => (entry.id === item.id ? { ...entry, width, height } : entry))))
          .catch((error: unknown) =>
            setItems((list) => list.map((entry) => (entry.id === item.id ? { ...entry, error: errorMessage(error, 'This image can’t be decoded by your browser.') } : entry))),
          );
      }
      return next;
    },
    [intake, items.length, runner],
  );

  const remove = useCallback(
    (id: string) => {
      runner.reset();
      setItems((list) => {
        const gone = list.find((item) => item.id === id);
        if (gone) {
          URL.revokeObjectURL(gone.url);
          urls.current.delete(gone.url);
        }
        return list.filter((item) => item.id !== id);
      });
    },
    [runner],
  );

  const move = useCallback(
    (from: number, to: number) => {
      runner.reset();
      setItems((list) => moveItem(list, from, to));
    },
    [runner],
  );

  const clear = useCallback(() => {
    runner.reset();
    clearRejected();
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current.clear();
    setItems([]);
  }, [runner, clearRejected]);

  return { items, setItems, add, remove, move, clear, rejected, clearRejected, checking };
}
