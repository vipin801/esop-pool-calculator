/**
 * Marks a field as one of the ones D7 requires before a result can show.
 *
 * 2026-08-18 restraint pass: the red asterisk is gone from every field —
 * the onboarding wizard's own screens require everything on them anyway
 * (D9), so `OnboardingWizard.tsx` now says "All fields required" once,
 * under the stepper, rather than repeating it per field. The screen-reader
 * announcement stays exactly as it was; only the visual glyph is removed,
 * so a field reused inside `Your model` (where required and optional
 * fields do mix) still tells assistive tech which is which.
 */
export function RequiredMarker() {
  return <span className="sr-only"> (required)</span>;
}
