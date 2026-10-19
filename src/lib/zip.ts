import { zipSync, type Zippable } from 'fflate';
import { uniqueNames } from './files';

export interface ZipEntry {
  name: string;
  blob: Blob;
}

/**
 * Bundle outputs into a ZIP. Entries are stored without recompression:
 * PDFs and images are already compressed, so deflating again wastes time.
 */
export async function makeZip(entries: ZipEntry[]): Promise<Blob> {
  const names = uniqueNames(entries.map((entry) => entry.name));
  const files: Zippable = {};
  for (let i = 0; i < entries.length; i += 1) {
    files[names[i]] = [new Uint8Array(await entries[i].blob.arrayBuffer()), { level: 0 }];
  }
  const data = zipSync(files);
  return new Blob([data as BlobPart], { type: 'application/zip' });
}
