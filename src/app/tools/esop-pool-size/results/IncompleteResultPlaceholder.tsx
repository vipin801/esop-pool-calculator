/**
 * State A only (see EsopPoolSizeClient.tsx's `showResults`) — a single quiet
 * line below the form, not a reserved result-shaped box. The layout brief
 * this replaces asked for "nothing taller than a single row": the previous
 * version was a 320px dashed card with a heading, a paragraph and a live
 * fields-entered count, which is exactly the reserved space State A exists to
 * remove.
 *
 * Keeps `id="result"` so `InputRail`'s "Jump to your result" link still has
 * somewhere to land before a result exists — jumping to "here's what's
 * missing" is the correct behaviour, not a broken link.
 */
export function IncompleteResultPlaceholder() {
  return (
    <p id="result" className="scroll-mt-[64px] text-eyebrow leading-5 text-faint">
      Fill in the fields above to see your recommended pool.
    </p>
  );
}
