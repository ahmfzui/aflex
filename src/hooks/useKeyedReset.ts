import { useState } from 'react';

/**
 * Run `reset` (which should only set this component's state) whenever `key`
 * changes — React's recommended "adjust state during render" pattern, which
 * avoids an extra effect-driven render pass.
 */
export function useKeyedReset(key: string, reset: () => void): void {
  const [previous, setPrevious] = useState(key);
  if (previous !== key) {
    setPrevious(key);
    reset();
  }
}
