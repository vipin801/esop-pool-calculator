import type { EsopInputs } from '@/lib/esop';
import { Button } from '../ui/Button';
import { formatPct, formatShares, lakhCrore } from '../lib/format';
import { STAGE_LABEL } from '../lib/labels';
import { META_LEADERSHIP_HIRES } from '../lib/touched';

interface WhyThisNumberProps {
  readonly inputs: EsopInputs;
  readonly onDownload?: () => void;
  readonly reportReady?: boolean;
  /**
   * Every other line here reads a `drivesPool` field, required (D7/D9) and so
   * always touched by the time a result exists. Leadership hires is the one
   * exception — it comes from `hiring.seniorityMix.leadership`, a `minor`
   * field with a non-zero seeded default — so it is the one line that needs
   * `touched` to tell a founder-answered count apart from that default
   * silently clearing the `> 0` check on its own. Defaults to empty, which
   * hides the line: correct for any caller that does not track touch state,
   * since an unproven founder input is exactly what this section must not
   * show.
   */
  readonly touched?: ReadonlySet<string>;
}

/** Placeholder bar widths for the locked "Model assumptions" column — no
 *  text at all, on purpose (see the component doc below): nothing here can
 *  leak a name even to a reader inspecting the DOM. */
const LOCKED_BAR_WIDTHS = ['82%', '64%', '91%', '58%', '73%'];

/**
 * design.md §5.2/§29, narrowed by the "Why this number" gating pass: this
 * card used to carry a second, free-standing list — "We assumed" — naming
 * the specific `minor` fields the founder hadn't touched (buffer, attrition,
 * vesting, exercise, strike…). That list is gone, not just hidden behind a
 * click: D3 already draws the line as "results are never gated, only the
 * report download is," and a founder could read every one of those values
 * straight off this card for free, which is a narrower reading of D3 than
 * the report gate itself gets. The column is now a locked teaser — no
 * assumption name or value anywhere in its markup, `aria-hidden` bars
 * standing in for it — and the one way past it is the same lead-gated
 * download every other "Download report" action already goes through
 * (`onDownload`/`reportReady`, threaded from `ResultsPanel`). "You told us"
 * was never gated, but it was not quite always the founder's own input
 * either: the leadership-hires line reads a `minor` field with a non-zero
 * seeded default, so it needs `touched` to keep a founder-answered count
 * apart from that default clearing its `> 0` check on its own — see the
 * prop doc above.
 */
export function WhyThisNumber({ inputs, onDownload, reportReady = true, touched = new Set() }: WhyThisNumberProps) {
  const isBasisB = inputs.grantPolicy.grantBasis.kind === 'rupeeValue';
  const totalHires = inputs.hiring.hiresPerYear.reduce((sum, n) => sum + Math.max(0, n), 0);
  const leadershipHires = Math.round((inputs.hiring.seniorityMix.leadership / 100) * totalHires);
  const leadershipAnswered = touched.has(META_LEADERSHIP_HIRES) || touched.has('hiring.seniorityMix.leadership');

  const founderInputs: string[] = [
    STAGE_LABEL[inputs.company.stage],
    `${formatShares(inputs.company.existingUnallocatedOptions)} shares in the pool today`,
    isBasisB ? 'Rupee-value grants' : 'Percent-of-equity grants',
    `${inputs.hiring.horizonYears}-year horizon`,
    `${formatShares(totalHires)} planned hires`,
  ];
  if (leadershipHires > 0 && leadershipAnswered) founderInputs.push(`${leadershipHires} leadership hires`);
  if (isBasisB) {
    founderInputs.push(lakhCrore(inputs.company.postMoneyValuation));
    founderInputs.push(`${formatPct(inputs.growth.valuationGrowthPctPerYear)} annual valuation growth`);
  }

  return (
    <section className="rounded-lg border border-border bg-raised p-4">
      <h3 className="text-eyebrow font-semibold text-ink">Why this number</h3>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wide text-faint">You told us</p>
          <ul className="mt-1.5 space-y-1 text-eyebrow leading-5 text-ink">
            {founderInputs.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wide text-faint">Model assumptions</p>
          <ul className="mt-1.5 space-y-2" aria-hidden="true">
            {LOCKED_BAR_WIDTHS.map((width, i) => (
              <li key={i} className="h-2.5 rounded-full bg-border blur-[1.5px]" style={{ width }} />
            ))}
          </ul>
          <span className="sr-only">Locked until you download the full report.</span>
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-4 text-center">
        <p className="text-eyebrow font-semibold text-ink">Full model explanation</p>
        <p className="mx-auto mt-1 max-w-[42ch] text-2xs leading-4 text-faint">
          See the assumptions, scenarios and calculations supporting your ESOP pool recommendation.
        </p>
        {onDownload ? (
          <Button size="sm" className="mt-3" onClick={onDownload} disabled={!reportReady}>
            {reportReady ? 'Download full report' : 'Preparing report…'}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
