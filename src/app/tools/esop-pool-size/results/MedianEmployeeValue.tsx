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
        <h3 className="text-[13px] font-semibold text-ink">What a median employee holds at horizon</h3>
        <p className="mt-2 text-2xs leading-4 text-faint">
          No hires in the seniority mix, so there is no median employee to value.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-raised p-4">
      <h3 className="text-[13px] font-semibold text-ink">What a median employee holds at horizon</h3>
      <p className="mt-1 text-2xs leading-4 text-faint">
        The {BAND_LABEL[value.band]} band, granted {formatShares(value.optionsGranted)} options in year 0.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <dt className="text-2xs text-faint">Vested at horizon</dt>
          <dd className="tnum mt-1 text-[15px] font-semibold text-ink">{formatShares(value.vestedAtHorizon)}</dd>
        </div>
        <div>
          <dt className="text-2xs text-faint">Notional value</dt>
          <dd className="tnum mt-1 text-[15px] font-semibold text-ink">{lakhCrore(value.notionalValueRupees)}</dd>
        </div>
        <div>
          <dt className="text-2xs text-faint">Realisable, after tax</dt>
          <dd className="tnum mt-1 text-[15px] font-semibold text-ink">{lakhCrore(value.realisableValueRupees)}</dd>
        </div>
        <div>
          <dt className="text-2xs text-faint">Tax at exercise</dt>
          <dd className="tnum mt-1 text-[15px] font-semibold text-ink">{lakhCrore(value.perquisiteTaxRupees)}</dd>
        </div>
      </div>
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
