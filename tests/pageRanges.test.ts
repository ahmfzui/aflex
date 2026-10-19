import { describe, expect, it } from 'vitest';
import { chunkPages, formatPageSet, parsePageSet, parseRanges } from '../src/lib/pageRanges';

describe('parseRanges', () => {
  it('parses single pages and ranges into 0-based groups', () => {
    const result = parseRanges('1-3, 5, 8-', 10);
    expect(result).toEqual({
      ok: true,
      groups: [
        { label: '1-3', pages: [0, 1, 2] },
        { label: '5', pages: [4] },
        { label: '8-10', pages: [7, 8, 9] },
      ],
    });
  });

  it('supports reversed ranges and open starts', () => {
    const result = parseRanges('4-2; -2', 5);
    expect(result.ok && result.groups.map((g) => g.pages)).toEqual([[3, 2, 1], [0, 1]]);
  });

  it('rejects pages beyond the document and garbage input', () => {
    expect(parseRanges('1-12', 10).ok).toBe(false);
    expect(parseRanges('0', 10).ok).toBe(false);
    expect(parseRanges('abc', 10).ok).toBe(false);
    expect(parseRanges('  ', 10).ok).toBe(false);
  });
});

describe('page sets', () => {
  it('dedupes and sorts', () => {
    expect(parsePageSet('3,1-2,2', 5)).toEqual({ ok: true, pages: [0, 1, 2] });
  });
  it('formats compact ranges', () => {
    expect(formatPageSet([0, 1, 2, 4, 6, 7])).toBe('1-3, 5, 7-8');
    expect(formatPageSet([])).toBe('');
  });
  it('chunks pages', () => {
    expect(chunkPages(5, 2).map((g) => g.label)).toEqual(['1-2', '3-4', '5']);
  });
});
