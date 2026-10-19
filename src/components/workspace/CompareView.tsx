import { useId, useState } from 'react';

/** Before/after slider over two real images (no simulated differences). */
export function CompareView({ before, after, label }: { before: string; after: string; label: string }) {
  const [split, setSplit] = useState(50);
  const id = useId();
  return (
    <div className="field">
      <div className="compare" style={{ ['--split' as string]: `${split}%` }}>
        <img src={before} alt={`Original: ${label}`} />
        <img className="compare__after" src={after} alt={`Result: ${label}`} />
        <span className="compare__line" aria-hidden="true" />
        <div className="compare__labels" aria-hidden="true">
          <span>Before</span>
          <span>After</span>
        </div>
      </div>
      <label className="field__label" htmlFor={id}>
        Comparison divider
      </label>
      <input id={id} className="range" type="range" min={0} max={100} value={split} onChange={(event) => setSplit(Number(event.target.value))} />
    </div>
  );
}
