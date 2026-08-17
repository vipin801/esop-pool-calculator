/**
 * Marks a field as one of the ones D7 requires before a result can show.
 * The asterisk is `aria-hidden` and paired with visually-hidden text rather
 * than relying on the glyph alone, since a screen reader reads "*" as
 * nothing useful on its own.
 */
export function RequiredMarker() {
  return (
    <>
      <span aria-hidden="true" className="ml-0.5 text-danger" title="Required to calculate your result">
        *
      </span>
      <span className="sr-only"> (required)</span>
    </>
  );
}
