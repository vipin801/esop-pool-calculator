import type { MedianEmployeeValue as MedianEmployeeValueData } from '@/lib/esop';
import { BAND_LABEL } from '../lib/labels';
import { formatPct, formatShares, lakhCrore } from '../lib/format';

interface MedianEmployeeValueProps {
  readonly value: MedianEmployeeValueData | null;
}

export function MedianEmployeeValue({ value }: MedianEmployeeValueProps) {
  if (!value) {
    return (
      <section className="rounded-lg border border-border bg-raised p-4">
        <h3 className="text-eyebrow font-semibold text-ink">What a median employee holds at horizon</h3>
        <p className="mt-2 text-2xs leading-4 text-faint">
          No hires in the seniority mix, so there is no median employee to value.
        </p>
      </section>
    );
  }

  /**
   * design.md §7/master brief §37: a negative realisable value is a real
   * outcome of the strike sitting at or above fair market value, not a
   * formatting problem — a founder reading a large negative rupee figure as
   * an ordinary KPI is the failure mode the brief calls out by name. The
   * engine keeps reporting the signed figure (M35: `taxDeferralAvailable`
   * never nets against it); only the headline treatment changes here.
   */
  const irrational = value.realisableValueRupees <= 0;

  return (
    <section className="rounded-lg border border-border bg-raised p-4">
      <h3 className="text-eyebrow font-semibold text-ink">What a median employee holds at horizon</h3>
      <p className="mt-1 text-2xs leading-4 text-faint">
        The {BAND_LABEL[value.band]} band, granted {formatShares(value.optionsGranted)} options in year 0.
      </p>

      {irrational ? (
        <div className="mt-3 rounded border border-warn bg-warn-soft px-3 py-2">
          <p className="text-eyebrow font-medium text-warn">
            Exercising would not be economically rational under current assumptions.
          </p>
          <p className="mt-1 text-2xs leading-4 text-warn">
            The exercise cost and tax at exercise outweigh what the shares are worth at this strike.
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-2xs text-faint">Show the raw figures</summary>
            <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <dt className="text-2xs text-faint">Notional value</dt>
                <dd className="tnum mt-1 text-small font-semibold text-ink">{lakhCrore(value.notionalValueRupees)}</dd>
              </div>
              <div>
                <dt className="text-2xs text-faint">Exercise cost</dt>
                <dd className="tnum mt-1 text-small font-semibold text-ink">{lakhCrore(value.exerciseCostRupees)}</dd>
              </div>
              <div>
                <dt className="text-2xs text-faint">Tax at exercise</dt>
                <dd className="tnum mt-1 text-small font-semibold text-ink">{lakhCrore(value.perquisiteTaxRupees)}</dd>
              </div>
              <div>
                <dt className="text-2xs text-faint">Realisable (signed)</dt>
                <dd className="tnum mt-1 text-small font-semibold text-danger">{lakhCrore(value.realisableValueRupees)}</dd>
              </div>
            </dl>
          </details>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <dt className="text-2xs text-faint">Vested at horizon</dt>
            <dd className="tnum mt-1 text-small font-semibold text-ink">{formatShares(value.vestedAtHorizon)}</dd>
          </div>
          <div>
            <dt className="text-2xs text-faint">Notional value</dt>
            <dd className="tnum mt-1 text-small font-semibold text-ink">{lakhCrore(value.notionalValueRupees)}</dd>
          </div>
          <div>
            <dt className="text-2xs text-faint">Realisable, after tax</dt>
            <dd className="tnum mt-1 text-small font-semibold text-ink">{lakhCrore(value.realisableValueRupees)}</dd>
          </div>
          <div>
            <dt className="text-2xs text-faint">Tax at exercise</dt>
            <dd className="tnum mt-1 text-small font-semibold text-ink">{lakhCrore(value.perquisiteTaxRupees)}</dd>
          </div>
        </div>
      )}

      <p className="mt-3 text-2xs leading-4 text-faint">
        Exercise cost {lakhCrore(value.exerciseCostRupees)}, at a {formatPct(value.marginalTaxRatePct)} marginal rate.
      </p>
      <p className="mt-1 text-2xs leading-4 text-faint">
        {value.taxDeferralAvailable
          ? 'This company qualifies to defer when that tax falls. The rupee figures above do not move either way.'
          : 'That tax falls at exercise. It is deferred only with both compliance toggles on.'}
      </p>
    </section>
  );
}
