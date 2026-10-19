/** Checkerboard preview area for a single image. */
export function ImageStage({ url, alt, tag, meta, transform }: { url: string; alt: string; tag?: string; meta?: string; transform?: string }) {
  return (
    <figure className="stage" style={{ margin: 0 }}>
      <img src={url} alt={alt} style={transform ? { transform } : undefined} />
      {tag && (
        <span className="stage__tag" aria-hidden="true">
          {tag}
        </span>
      )}
      {meta && <figcaption className="stage__meta">{meta}</figcaption>}
    </figure>
  );
}
