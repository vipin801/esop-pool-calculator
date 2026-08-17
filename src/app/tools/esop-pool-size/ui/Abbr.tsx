interface AbbrProps {
  readonly short: string;
  readonly long: string;
}

/**
 * A short form that carries its own gloss.
 *
 * "FD" saves a table header from wrapping and costs a founder nothing only if
 * the long form is one hover or one screen-reader announcement away. The
 * expansion is also read out inline for assistive technology, because `title`
 * alone is not reliably announced.
 */
export function Abbr({ short, long }: AbbrProps) {
  return (
    <>
      <abbr title={long} className="cursor-help no-underline decoration-dotted [text-decoration-line:underline]">
        {short}
      </abbr>
      <span className="sr-only"> ({long})</span>
    </>
  );
}
