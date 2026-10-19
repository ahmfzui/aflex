import { useEffect } from 'react';

const BASE = 'AFlex — PDF & Image Toolkit';

/** Sets document.title; null = the homepage title. */
export function usePageTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · AFlex` : `${BASE} · Your files. Your rules.`;
  }, [title]);
}
