'use client';

import { useEffect, useState } from 'react';

const DESKTOP_QUERY = '(min-width: 1024px)';

/**
 * design.md §6: `Your model` renders as exactly one thing at a time — a
 * sticky desktop column or a mobile sheet — never both mounted together.
 * CSS alone (`hidden lg:block`) only hides the desktop copy on a narrow
 * viewport; it does not stop it from mounting, so opening the mobile sheet
 * would otherwise put two `ModelPanel` instances in the DOM at once, each
 * with the same field ids. This is the JS-side switch that keeps them
 * mutually exclusive.
 *
 * Starts `false` on both the server and the first client render, the same
 * deliberate default-then-correct pattern `lib/theme.tsx` uses for the same
 * reason: `matchMedia` disagrees with the server's render, so reading it
 * during render would be a hydration mismatch rather than an effect.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDesktop(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}
