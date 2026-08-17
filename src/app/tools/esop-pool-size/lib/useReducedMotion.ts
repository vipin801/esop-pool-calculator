'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia?.(QUERY);
  if (!media) return () => undefined;

  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia?.(QUERY).matches ?? false;
}

/** The server has no media queries, and animation has not started there. */
function getServerSnapshot(): boolean {
  return false;
}

/**
 * globals.css already flattens CSS transitions and animations under
 * `prefers-reduced-motion`. Recharts does not use either — it animates by
 * driving values from JavaScript — so the media query has to be read in React
 * and handed to every series as `isAnimationActive`.
 *
 * `useSyncExternalStore` rather than state plus an effect: the query is an
 * external store, and this way the correct value is read during the first
 * client render instead of one paint later, which is exactly the paint the
 * animation would have played in.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
