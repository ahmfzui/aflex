/** Original geometric icon set — square caps and mitred joins to match the angular brand. */
const PATHS = {
  merge: 'M4 4h6v7H4zM14 13h6v7h-6zM10 7.5h4.5V13M14.5 13l-2-2.2M14.5 13l2-2.2',
  split: 'M4 4h7v16H4zM14 4h6v7h-6zM14 13h6v7h-6zM11 12h3',
  reorder: 'M4 4h7v7H4zM13 13h7v7h-7zM16 4h4v4M20 4l-5 5M8 20H4v-4M4 20l5-5',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  compress: 'M4 4l6 6M10 5v5H5M20 20l-6-6M14 19v-5h5M20 4l-6 6M14 5v5h5M4 20l6-6M10 19v-5H5',
  pdfToImage: 'M4 3h9l4 4v6M13 3v4h4M4 3v18h7M14 14h7v7h-7zM14 19l2.5-2.5 2 2 1-1 1.5 1.5',
  imageToPdf: 'M3 3h8v8H3zM3 9l2.5-2.5 2 2 1-1L11 10M13 10h4l4 4v7h-8zM17 10v4h4',
  rotate: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5',
  convert: 'M4 8h13M13 4l4 4-4 4M20 16H7M11 12l-4 4 4 4',
  resize: 'M3 3h7M3 3v7M21 21h-7M21 21v-7M3 3l7 7M21 21l-7-7M14 3h7v7M3 14v7h7',
  flip: 'M12 3v18M9 6L4 18h5zM15 6l5 12h-5z',
  metadata: 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h5',
  search: 'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM16 16l5 5',
  upload: 'M12 16V4M7 9l5-5 5 5M4 15v5h16v-5',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  arrowRight: 'M4 12h15M14 6l6 6-6 6',
  arrowLeft: 'M20 12H5M10 6l-6 6 6 6',
  arrowUp: 'M12 20V5M6 10l6-6 6 6',
  arrowDown: 'M12 4v15M6 14l6 6 6-6',
  close: 'M5 5l14 14M19 5L5 19',
  check: 'M4 12.5l5 5L20 6',
  alert: 'M12 3l10 18H2zM12 10v5M12 17.5v.5',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  zip: 'M6 3h12v18H6zM12 3v2M12 7v2M12 11v2M10 15h4v3h-4z',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  rotateLeft: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v5h5',
  flipH: 'M12 3v18M9 7L4 12l5 5zM15 7l5 5-5 5z',
  flipV: 'M3 12h18M7 9l5-5 5 5zM7 15l5 5 5-5z',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  image: 'M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6M15 9.5a1.5 1.5 0 1 0 0-.01',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  menu: 'M3 6h18M3 12h18M3 18h12',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  reverse: 'M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4',
  plus: 'M12 4v16M4 12h16',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  title?: string;
}

export function Icon({ name, size = 20, className, title }: IconProps) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <path d={PATHS[name]} />
    </svg>
  );
}
