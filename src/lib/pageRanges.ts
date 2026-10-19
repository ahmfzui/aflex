/**
 * Parse human page-range input like "1-3, 5, 8-" against a document length.
 * Pages are 1-based in the input and 0-based in the output.
 */

export interface RangeGroup {
  label: string;
  pages: number[];
}

export type ParseResult = { ok: true; groups: RangeGroup[] } | { ok: false; error: string };

export function parseRanges(input: string, pageCount: number): ParseResult {
  const text = input.trim();
  if (!text) return { ok: false, error: 'Enter at least one page or range, e.g. 1-3, 5.' };
  const parts = text.split(/[,;]+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return { ok: false, error: 'Enter at least one page or range, e.g. 1-3, 5.' };

  const groups: RangeGroup[] = [];
  for (const part of parts) {
    const match = /^(\d*)\s*(?:(-|–|—|to)\s*(\d*))?$/i.exec(part);
    if (!match || (!match[1] && !match[3])) {
      return { ok: false, error: `“${part}” isn’t a page number or range.` };
    }
    const isRange = Boolean(match[2]);
    const start = match[1] ? Number(match[1]) : 1;
    const end = isRange ? (match[3] ? Number(match[3]) : pageCount) : start;
    if (start < 1 || end < 1) return { ok: false, error: 'Page numbers start at 1.' };
    if (start > pageCount || end > pageCount) {
      return { ok: false, error: `“${part}” goes past the last page (${pageCount}).` };
    }
    const pages: number[] = [];
    if (start <= end) for (let page = start; page <= end; page += 1) pages.push(page - 1);
    else for (let page = start; page >= end; page -= 1) pages.push(page - 1);
    groups.push({ label: start === end ? `${start}` : `${start}-${end}`, pages });
  }
  return { ok: true, groups };
}

/** Unique, sorted 0-based pages covered by a range string. */
export function parsePageSet(input: string, pageCount: number): { ok: true; pages: number[] } | { ok: false; error: string } {
  const result = parseRanges(input, pageCount);
  if (!result.ok) return result;
  const set = new Set<number>();
  for (const group of result.groups) for (const page of group.pages) set.add(page);
  return { ok: true, pages: [...set].sort((a, b) => a - b) };
}

/** Compact a sorted list of 0-based pages back into a 1-based range string. */
export function formatPageSet(pages: number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const out: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j += 1;
    out.push(i === j ? `${sorted[i] + 1}` : `${sorted[i] + 1}-${sorted[j] + 1}`);
    i = j + 1;
  }
  return out.join(', ');
}

/** Split page indices 0..pageCount-1 into consecutive chunks of `size`. */
export function chunkPages(pageCount: number, size: number): RangeGroup[] {
  const groups: RangeGroup[] = [];
  const step = Math.max(1, Math.floor(size));
  for (let start = 0; start < pageCount; start += step) {
    const end = Math.min(pageCount, start + step) - 1;
    const pages = Array.from({ length: end - start + 1 }, (_, k) => start + k);
    groups.push({ label: start === end ? `${start + 1}` : `${start + 1}-${end + 1}`, pages });
  }
  return groups;
}
