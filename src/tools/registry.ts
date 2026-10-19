import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { ToolProps } from './types';

/**
 * Each tool is its own code-split chunk, so PDF.js and friends only load
 * when a tool that needs them is opened.
 */
export const TOOL_COMPONENTS: Record<string, LazyExoticComponent<ComponentType<ToolProps>>> = {
  'merge-pdf': lazy(() => import('./pdf/MergePdf')),
  'split-pdf': lazy(() => import('./pdf/SplitPdf')),
  'reorder-pdf': lazy(() => import('./pdf/ReorderPdf')),
  'delete-pdf-pages': lazy(() => import('./pdf/DeletePages')),
  'compress-pdf': lazy(() => import('./pdf/CompressPdf')),
  'pdf-to-images': lazy(() => import('./pdf/PdfToImages')),
  'images-to-pdf': lazy(() => import('./pdf/ImagesToPdf')),
  'rotate-pdf': lazy(() => import('./pdf/RotatePdf')),
  'convert-image': lazy(() => import('./image/ConvertImage')),
  'compress-image': lazy(() => import('./image/CompressImage')),
  'resize-image': lazy(() => import('./image/ResizeImage')),
  'rotate-image': lazy(() => import('./image/RotateImage')),
  'image-metadata': lazy(() => import('./image/ImageMetadata')),
};
