import { describe, expect, it } from 'vitest';
import { FEATURED_SLUGS, TOOLS, filterTools, getTool } from '../src/lib/tools';

describe('tool registry', () => {
  it('has unique slugs and all featured tools exist', () => {
    expect(new Set(TOOLS.map((t) => t.slug)).size).toBe(TOOLS.length);
    for (const slug of FEATURED_SLUGS) expect(getTool(slug)).toBeDefined();
  });
  it('filters by category and search terms', () => {
    expect(filterTools(TOOLS, '', 'image').every((t) => t.category === 'image')).toBe(true);
    expect(filterTools(TOOLS, 'exif', 'all').map((t) => t.slug)).toEqual(['image-metadata']);
    expect(filterTools(TOOLS, 'combine pdf', 'all').map((t) => t.slug)).toEqual(['merge-pdf']);
    expect(filterTools(TOOLS, 'merge', 'image')).toEqual([]);
  });
});
