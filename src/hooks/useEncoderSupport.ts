import { useEffect, useState } from 'react';
import { encoderSupport, type OutputFormat } from '../lib/image/canvas';

/** Which output formats this browser can encode; null until detected. */
export function useEncoderSupport(): Record<OutputFormat, boolean> | null {
  const [support, setSupport] = useState<Record<OutputFormat, boolean> | null>(null);
  useEffect(() => {
    let alive = true;
    void encoderSupport().then((result) => {
      if (alive) setSupport(result);
    });
    return () => {
      alive = false;
    };
  }, []);
  return support;
}
