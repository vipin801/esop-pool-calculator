import type { BenchmarkBand, BenchmarkComparison, BenchmarkPosition, BenchmarkTrackComparison } from '@/lib/esop';
import { formatPct } from '../lib/format';

interface BenchmarkStripProps {
  readonly benchmarkComparison: BenchmarkComparison;
}

function bandExtent(band: BenchmarkBand): { readonly low: number; readonly high: number } {
  return { low: band.lowPct ?? 0, high: band.highPct };
}

/**
 * Defect fix: the strip used to print the verdict word "Below range" in
 * alarm orange, which read as the tool contradicting its own recommendation.
 * A pool sized bottom-up from a hiring plan sits below a top-down advisory
 * number for a structural reason, not because anything is wrong — so this is
 * a short designed explanation at that spot, not a verdict, and it carries no
 * alarm styling.
 */
function positionCopy(position: BenchmarkPosition, trackLabel: string, band: BenchmarkBand | null): string {
  switch (position) {
    case 'below':
      return `Below the ${trackLabel} range. Sizing up from a hiring plan lands below top-down benchmarks: rupee grants buy fewer options as the price compounds.`;
    case 'above':
      return `Above the ${trackLabel} range.`;
    case 'within':
      return `Within the ${trackLabel} range${band ? `, ${band.label}` : ''}.`;
    case 'noBandForStage':
      return `No ${trackLabel} band published for this stage.`;
  }
}

export function BenchmarkStrip({ benchmarkComparison }: BenchmarkStripProps) {
  const { poolPctOfFullyDiluted, tracks } = benchmarkComparison;
  const highs = tracks
    .map((t) => t.band)
    .filter((b): b is BenchmarkBand => b !== null)
    .map((b) => b.highPct);
  const scaleMax = Math.max(20, Math.ceil((Math.max(poolPctOfFullyDiluted, ...highs, 10) * 1.2) / 5) * 5);
  const pos = (v: number) => `${Math.min(100, Math.max(0, (v / scaleMax) * 100))}%`;

  return (
    <section className="rounded-lg border border-border bg-raised p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-ink">Benchmark comparison</h3>
        <span className="tnum text-2xs font-semibold text-accent">You {formatPct(poolPctOfFullyDiluted)}</span>
      </div>

      <div className="mt-4 space-y-4">
        {tracks.map((track: BenchmarkTrackComparison) => (
          <div key={track.trackId}>
            <p className="text-2xs font-medium text-sub">
              {track.trackLabel}
              {track.band ? ` · ${track.band.label}` : ''}
            </p>
            <div className="relative mt-2 h-2 rounded-full bg-muted">
              {track.band ? (
                <div
                  className="absolute inset-y-0 rounded-full bg-strong"
                  style={{ left: pos(bandExtent(track.band).low), right: `${100 - parseFloat(pos(bandExtent(track.band).high))}%` }}
                />
              ) : null}
              <div
                className="absolute -top-1 h-4 w-[3px] rounded-full bg-accent"
                style={{ left: pos(poolPctOfFullyDiluted) }}
                role="img"
                aria-label={`Your pool, ${formatPct(poolPctOfFullyDiluted)} of fully diluted`}
              />
            </div>
            <p className="mt-2 text-2xs leading-4 text-sub">{positionCopy(track.position, track.trackLabel, track.band)}</p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-2xs leading-4 text-faint">
        Both tracks are shown together on purpose. Advisory consensus is opinion; observed data is a dated, directional
        study. Neither is presented as the truth.
      </p>
    </section>
  );
}
