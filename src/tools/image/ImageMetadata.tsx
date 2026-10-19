import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Checkbox } from '../../components/workspace/Controls';
import { DropZone } from '../../components/workspace/DropZone';
import { Notice, RejectedList } from '../../components/workspace/Feedback';
import { ResultPanel } from '../../components/workspace/ResultPanel';
import { ToolShell } from '../../components/workspace/ToolShell';
import { useImageList } from '../../hooks/useImages';
import { useRunner } from '../../hooks/useRunner';
import { TYPE_LABEL, baseName, formatBytes, readBytes } from '../../lib/files';
import { canStrip, stripMetadata, type MetadataBlock } from '../../lib/image/metadata';
import { readMetadata, type MetadataReport } from '../../lib/image/metadataRead';
import type { ToolProps } from '../types';
import { ImageStage } from './ImageStage';

const KIND_LABEL: Record<MetadataBlock['kind'], string> = {
  exif: 'EXIF',
  gps: 'GPS',
  xmp: 'XMP',
  iptc: 'IPTC',
  icc: 'ICC',
  comment: 'Note',
  text: 'Text',
  timestamp: 'Time',
  thumbnail: 'Extra',
  trailer: 'Extra',
  other: 'Other',
  technical: 'Tech',
};

function BlockList({ blocks, label }: { blocks: MetadataBlock[]; label: string }) {
  return (
    <ul className="meta-blocks" aria-label={label}>
      {blocks.map((block, index) => (
        <li key={`${block.label}-${index}`} className="meta-block" data-removable={block.removable}>
          <span className="meta-block__kind">{KIND_LABEL[block.kind]}</span>
          <span>
            {block.label}
            {block.detail && <span className="mono muted"> · {block.detail}</span>}
          </span>
          <span className="meta-block__size">{block.bytes ? formatBytes(block.bytes) : ''}</span>
        </li>
      ))}
    </ul>
  );
}

interface Verification {
  blocks: MetadataBlock[];
  gps: boolean;
  fields: number;
  keptOrientation: number | null;
}

export default function ImageMetadata({ tool }: ToolProps) {
  const runner = useRunner();
  const { items, add, clear, rejected, clearRejected, checking } = useImageList(runner, 1);
  const item = items[0];
  // Inspection results are tagged with the item they describe.
  const [inspection, setInspection] = useState<{ id: string; report: MetadataReport | null; error: string | null } | null>(null);
  const current = item && inspection?.id === item.id ? inspection : null;
  const report = current?.report ?? null;
  const readError = current?.error ?? null;
  const [keepIcc, setKeepIcc] = useState(true);
  const [keepOrientation, setKeepOrientation] = useState(true);
  const [verification, setVerification] = useState<Verification | null>(null);

  const supported = item ? canStrip(item.type) : false;

  useEffect(() => {
    if (!item || !canStrip(item.type)) return;
    let alive = true;
    const { id, type } = item;
    readBytes(item.file)
      .then((bytes) => readMetadata(bytes, type))
      .then((result) => {
        if (alive) setInspection({ id, report: result, error: null });
      })
      .catch(() => {
        if (alive) setInspection({ id, report: null, error: 'The file structure couldn’t be read — it may be damaged.' });
      });
    return () => {
      alive = false;
    };
  }, [item]);

  const removable = report?.blocks.filter((block) => block.removable || (block.kind === 'icc' && !keepIcc)) ?? [];

  const clean = () =>
    runner.run('Removing metadata…', async () => {
      if (!item || !canStrip(item.type)) return [];
      setVerification(null);
      const bytes = await readBytes(item.file);
      const result = stripMetadata(bytes, item.type, { keepIcc, keepOrientation });
      // Verify by re-reading the output with the same inspectors.
      const check = await readMetadata(result.bytes, item.type);
      setVerification({
        blocks: check.blocks,
        gps: Boolean(check.gps) || check.blocks.some((block) => block.kind === 'gps'),
        fields: check.groups.filter((group) => !group.technical).reduce((sum, group) => sum + group.fields.length, 0),
        keptOrientation: result.keptOrientation,
      });
      const ext = item.type === 'jpeg' ? 'jpg' : item.type;
      return [{ name: `${baseName(item.file.name)}-clean.${ext}`, blob: new Blob([result.bytes as BlobPart], { type: item.file.type || `image/${item.type}` }), sourceBytes: item.file.size }];
    });

  const reason = !item
    ? 'Add an image first.'
    : !supported
      ? 'This format isn’t supported for inspection.'
      : !report
        ? 'Reading metadata…'
        : removable.length === 0
          ? 'Nothing to remove with the current options.'
          : undefined;

  return (
    <ToolShell
      tool={tool}
      runner={runner}
      hasInput={Boolean(item)}
      intake={<DropZone kind="image" multiple={false} onFiles={(files) => void add(files.slice(0, 1), true)} busy={checking} hint="JPEG, PNG or WebP for full inspection and cleaning. Files stay on this device." />}
      notices={<RejectedList rejected={rejected} onDismiss={clearRejected} />}
      briefing={[
        'Inspects JPEG, PNG and WebP files: lists every metadata block found (EXIF, GPS, XMP, IPTC, comments, text chunks, colour profile) and decodes fields where possible.',
        'Clean export removes those blocks byte-for-byte — pixels are not re-encoded, so quality is identical.',
        'The cleaned file is re-inspected automatically so you can see what remains.',
        'Metadata inside formats not listed here (e.g. AVIF, GIF) isn’t inspected.',
      ]}
      status={report ? `${report.blocks.filter((b) => b.removable).length} removable block(s) found` : undefined}
      action={{ label: 'Export clean copy', onClick: clean, disabled: Boolean(reason), reason }}
      onClear={() => {
        setVerification(null);
        clear();
      }}
      clearLabel="Use a different image"
      settings={
        supported ? (
          <>
            <Checkbox
              checked={keepOrientation}
              onChange={(value) => {
                runner.reset();
                setKeepOrientation(value);
              }}
            >
              Keep orientation <span className="muted">— a tiny EXIF block with only the rotation flag, so photos don’t display sideways.</span>
            </Checkbox>
            <Checkbox
              checked={keepIcc}
              onChange={(value) => {
                runner.reset();
                setKeepIcc(value);
              }}
            >
              Keep colour profile <span className="muted">— ICC data keeps colours accurate; it rarely identifies anyone.</span>
            </Checkbox>
            <div className="sub-panel">
              <p className="label">Will be removed</p>
              {removable.length ? (
                <p className="mono">{[...new Set(removable.map((block) => KIND_LABEL[block.kind]))].join(' · ')}</p>
              ) : (
                <p className="mono muted">{report ? 'Nothing' : '…'}</p>
              )}
            </div>
          </>
        ) : undefined
      }
      result={
        <ResultPanel outputs={runner.outputs} compare zipName="clean.zip" onReset={runner.reset} resetLabel="Back to inspection">
          {verification && (
            <div className="sub-panel" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
              <p className="label">Verification — re-read from the exported file</p>
              <p>
                GPS location: <strong className={verification.gps ? 'red' : ''}>{verification.gps ? 'still present' : 'none found'}</strong>
                {' · '}descriptive fields remaining: <strong>{verification.fields}</strong>
                {verification.keptOrientation ? ` (orientation = ${verification.keptOrientation})` : ''}
              </p>
              {verification.blocks.length ? (
                <BlockList blocks={verification.blocks} label="Blocks remaining in the exported file" />
              ) : (
                <p className="mono">No metadata blocks remain.</p>
              )}
            </div>
          )}
        </ResultPanel>
      }
    >
      {item && (
        <>
          <ImageStage url={item.url} alt={`Preview of ${item.file.name}`} meta={`${TYPE_LABEL[item.type]} · ${item.width ? `${item.width}×${item.height}px` : '…'} · ${formatBytes(item.file.size)}`} />
          {!supported && (
            <Notice tone="warn" title={`${TYPE_LABEL[item.type]} isn’t supported here`}>
              AFlex inspects and cleans JPEG, PNG and WebP. For other formats, <Link className="link" to="/tools/convert-image">convert the image</Link> — the
              re-encoded file is written without EXIF/XMP metadata.
            </Notice>
          )}
          {readError && <Notice tone="error" role="alert" title="Couldn’t read metadata">{readError}</Notice>}
          {supported && !report && !readError && (
            <div className="loading-block" role="status">
              <p className="mono">Inspecting…</p>
            </div>
          )}
          {report && (
            <>
              {report.gps && (
                <div className="gps-alert" role="note">
                  <strong>
                    <Icon name="alert" size={18} /> This image contains a GPS location
                  </strong>
                  <span className="mono">
                    {report.gps.latitude.toFixed(5)}, {report.gps.longitude.toFixed(5)}
                  </span>
                  <span>Anyone you share the original with can see where it was taken.</span>
                </div>
              )}
              <div className="ws-section-title">
                <h2>Blocks found</h2>
                <p className="mono muted">Red = removed by clean export</p>
              </div>
              {report.blocks.length ? (
                <BlockList blocks={report.blocks} label="Metadata blocks in this file" />
              ) : (
                <Notice tone="ok" title="No metadata blocks found">
                  This file has no EXIF, XMP, IPTC, comments or text chunks that AFlex can detect.
                </Notice>
              )}
              {report.parseWarning && <Notice tone="warn">{report.parseWarning}</Notice>}
              {report.groups.length > 0 && (
                <>
                  <div className="ws-section-title">
                    <h2>Decoded fields</h2>
                    <p className="mono muted">Read with exifr</p>
                  </div>
                  <div className="meta-groups">
                    {report.groups.map((group, index) => (
                      <details key={group.name} className="meta-group" open={index === 0}>
                        <summary>
                          {group.name} <span className="mono muted">({group.fields.length})</span>
                        </summary>
                        <table className="meta-table">
                          <tbody>
                            {group.fields.map(([key, value]) => (
                              <tr key={key}>
                                <th scope="row">{key}</th>
                                <td>{value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </details>
                    ))}
                  </div>
                </>
              )}
              {report.xmp && (
                <details className="meta-group">
                  <summary>
                    Raw XMP packet <span className="mono muted">({report.xmp.length.toLocaleString()} chars)</span>
                  </summary>
                  <pre className="xmp-raw">{report.xmp.slice(0, 20_000)}</pre>
                </details>
              )}
            </>
          )}
        </>
      )}
    </ToolShell>
  );
}
