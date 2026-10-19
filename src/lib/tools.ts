import type { IconName } from '../components/Icon';

export type ToolCategory = 'pdf' | 'image';

export interface ToolDefinition {
  slug: string;
  name: string;
  category: ToolCategory;
  /** One sentence, shown on tiles and at the top of the workspace. */
  description: string;
  /** Short input → output hint, e.g. "PDF → PDF". */
  formats: string;
  icon: IconName;
  /** Extra words that should match in search. */
  keywords: string[];
}

export const TOOLS: ToolDefinition[] = [
  {
    slug: 'merge-pdf',
    name: 'Merge PDF',
    category: 'pdf',
    description: 'Combine several PDFs into one document, in exactly the order you choose.',
    formats: 'PDF ×N → PDF',
    icon: 'merge',
    keywords: ['combine', 'join', 'append', 'concatenate'],
  },
  {
    slug: 'split-pdf',
    name: 'Split PDF',
    category: 'pdf',
    description: 'Pull out page ranges or break a document into separate files.',
    formats: 'PDF → PDF / ZIP',
    icon: 'split',
    keywords: ['extract', 'separate', 'range', 'pages'],
  },
  {
    slug: 'reorder-pdf',
    name: 'Reorder Pages',
    category: 'pdf',
    description: 'See every page as a thumbnail and put them back in the right order.',
    formats: 'PDF → PDF',
    icon: 'reorder',
    keywords: ['organize', 'arrange', 'sort', 'move', 'rearrange'],
  },
  {
    slug: 'delete-pdf-pages',
    name: 'Delete Pages',
    category: 'pdf',
    description: 'Mark the pages you don’t want and export a PDF without them.',
    formats: 'PDF → PDF',
    icon: 'trash',
    keywords: ['remove', 'cut', 'drop'],
  },
  {
    slug: 'compress-pdf',
    name: 'Compress PDF',
    category: 'pdf',
    description: 'Rebuild or rasterize a PDF to try to shrink it — with honest trade-offs and real results.',
    formats: 'PDF → PDF',
    icon: 'compress',
    keywords: ['optimize', 'shrink', 'reduce', 'smaller', 'size'],
  },
  {
    slug: 'pdf-to-images',
    name: 'PDF to Images',
    category: 'pdf',
    description: 'Render selected pages as PNG, JPEG or WebP images.',
    formats: 'PDF → PNG / JPG / WEBP',
    icon: 'pdfToImage',
    keywords: ['export', 'png', 'jpg', 'jpeg', 'render', 'convert'],
  },
  {
    slug: 'images-to-pdf',
    name: 'Images to PDF',
    category: 'pdf',
    description: 'Turn a stack of images into one PDF, with page size and orientation options.',
    formats: 'JPG / PNG / WEBP… → PDF',
    icon: 'imageToPdf',
    keywords: ['jpg to pdf', 'png to pdf', 'photos', 'scan', 'convert'],
  },
  {
    slug: 'rotate-pdf',
    name: 'Rotate PDF',
    category: 'pdf',
    description: 'Rotate selected pages or the whole document and save the result.',
    formats: 'PDF → PDF',
    icon: 'rotate',
    keywords: ['turn', 'orientation', 'landscape', 'portrait'],
  },
  {
    slug: 'convert-image',
    name: 'Convert Image',
    category: 'image',
    description: 'Switch images between PNG, JPEG and the other formats your browser can encode.',
    formats: 'IMG → PNG / JPG / WEBP',
    icon: 'convert',
    keywords: ['format', 'png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'bmp'],
  },
  {
    slug: 'compress-image',
    name: 'Compress Image',
    category: 'image',
    description: 'Re-encode images at a quality you pick and compare the real before/after sizes.',
    formats: 'IMG → JPG / WEBP / PNG',
    icon: 'compress',
    keywords: ['optimize', 'shrink', 'reduce', 'smaller', 'quality'],
  },
  {
    slug: 'resize-image',
    name: 'Resize Image',
    category: 'image',
    description: 'Set exact dimensions or scale by percent, with aspect-ratio lock and presets.',
    formats: 'IMG → IMG',
    icon: 'resize',
    keywords: ['scale', 'dimensions', 'width', 'height', 'shrink', 'enlarge'],
  },
  {
    slug: 'rotate-image',
    name: 'Rotate & Flip',
    category: 'image',
    description: 'Rotate in 90° steps or mirror an image, preview it, then export.',
    formats: 'IMG → IMG',
    icon: 'flip',
    keywords: ['mirror', 'turn', 'orientation', 'flip'],
  },
  {
    slug: 'image-metadata',
    name: 'Image Metadata',
    category: 'image',
    description: 'Inspect EXIF, GPS and other embedded metadata, then export a cleaned copy.',
    formats: 'JPG / PNG / WEBP → same',
    icon: 'metadata',
    keywords: ['exif', 'gps', 'location', 'privacy', 'strip', 'remove', 'xmp', 'iptc'],
  },
];

export const FEATURED_SLUGS = ['merge-pdf', 'compress-image', 'reorder-pdf', 'pdf-to-images'] as const;

export function getTool(slug: string | undefined): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}

export function toolIndex(slug: string): number {
  return TOOLS.findIndex((tool) => tool.slug === slug) + 1;
}

export type ToolFilter = 'all' | ToolCategory;

/** Case-insensitive search over name, description, formats and keywords. */
export function filterTools(tools: ToolDefinition[], query: string, filter: ToolFilter): ToolDefinition[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return tools.filter((tool) => {
    if (filter !== 'all' && tool.category !== filter) return false;
    if (terms.length === 0) return true;
    const haystack = [tool.name, tool.description, tool.formats, tool.category, ...tool.keywords]
      .join(' ')
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
