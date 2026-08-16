/**
 * ESOP pool benchmarks — two tracks, shown together, neither one the truth.
 *
 * Source of truth: docs/esop/ENGINE_SPEC.md section 6, benchmark rows.
 *
 * PROJECT.md D5: both tracks are always shown together and neither is presented
 * as the truth. Nothing in this file ranks, weights, defaults to or otherwise
 * privileges one track over the other. Both use the same `BenchmarkTrack`
 * shape, and that shape has no field that could express authority.
 *
 * PROJECT.md prohibits presenting advisory ranges as data. The advisory track
 * is tagged `estimate` and says so in its own caveat.
 */

import type {
  BenchmarkBand,
  BenchmarkComparison,
  BenchmarkPosition,
  BenchmarkTrack,
  BenchmarkTrackComparison,
  Geography,
  Stage,
} from './types';

const AS_OF = '2026-08';

/**
 * Advisory consensus. What Indian advisers and investors typically recommend.
 *
 * Runs the opposite way to the observed track: advisory pools grow with stage.
 * That disagreement is the reason both tracks exist.
 */
export const ADVISORY_TRACK: BenchmarkTrack = {
  id: 'advisory',
  label: 'Advisory consensus',
  description: 'What Indian advisers and investors typically recommend at each stage. Opinion, not measurement.',
  provenance: 'estimate',
  asOf: AS_OF,
  caveat: 'Advisory consensus, never data. No one measured these; they are what the market says out loud.',
  bands: [
    { stage: 'preSeed', geography: 'IN', lowPct: 5, highPct: 8, kind: 'range', label: 'Pre-seed' },
    { stage: 'seed', geography: 'IN', lowPct: 8, highPct: 12, kind: 'range', label: 'Seed' },
    { stage: 'seriesA', geography: 'IN', lowPct: 12, highPct: 15, kind: 'range', label: 'Series A' },
    { stage: 'seriesB', geography: 'IN', lowPct: 15, highPct: 18, kind: 'range', label: 'Series B' },
    { stage: 'seriesCPlus', geography: 'IN', lowPct: 15, highPct: 20, kind: 'range', label: 'Series C+' },
  ],
  stageTrends: [
    {
      geography: 'IN',
      direction: 'increasing',
      note: 'Advisory pools widen with stage, on the assumption that later hiring costs more equity.',
    },
  ],
  knownOverlaps: [
    {
      geography: 'IN',
      stages: ['seriesB', 'seriesCPlus'],
      why: 'The spec states Series B as 15-18 and Series C+ as 15-20, which share a floor. The advisory ladder is a set of recommended ranges, not a partition, so this overlap is in the source and is carried unchanged.',
    },
  ],
};

/**
 * Observed India data, with the US comparison the study itself draws.
 *
 * Runs the opposite way to the advisory track: Indian pools shrink with stage,
 * because investors hold a target ownership and the pool gets squeezed to fit.
 * US pools grow with stage instead.
 */
export const OBSERVED_TRACK: BenchmarkTrack = {
  id: 'observed',
  label: 'Observed India data',
  description: 'Pool sizes actually seen in a dated study of leading Indian companies, with the US comparison the study draws.',
  provenance: 'provisional',
  asOf: AS_OF,
  caveat: 'Trifecta Capital study of 45 leading Indian companies. Dated and directional, not a representative sample, and not verified by us.',
  bands: [
    {
      stage: 'seriesA',
      geography: 'IN',
      lowPct: null,
      highPct: 10,
      kind: 'upperBoundOnly',
      label: 'Series A, India: most below 10%',
    },
    {
      stage: 'seriesB',
      geography: 'IN',
      lowPct: null,
      highPct: 10,
      kind: 'upperBoundOnly',
      label: 'Series B, India: most below 10%',
    },
    {
      stage: 'growth',
      geography: 'IN',
      lowPct: 7.5,
      highPct: 8,
      kind: 'average',
      label: 'Growth rounds, India: averaging 7.5-8%',
    },
    {
      stage: 'seriesCPlus',
      geography: 'US',
      lowPct: 16,
      highPct: 17,
      kind: 'range',
      label: 'Series C and D, US: 16-17%',
    },
  ],
  stageTrends: [
    {
      geography: 'IN',
      direction: 'decreasing',
      note: 'Indian pools shrink with stage, because investors hold a target ownership and the pool is squeezed to fit.',
    },
    {
      geography: 'US',
      direction: 'increasing',
      note: 'US pools grow with stage, reaching 16-17% by Series C and D.',
    },
  ],
  knownOverlaps: [
    {
      geography: 'IN',
      stages: ['seriesA', 'seriesB'],
      why: 'The study reports both as "most below 10%", so the two bands are identical rather than adjacent. An upper bound is not a partition.',
    },
    {
      geography: 'IN',
      stages: ['seriesA', 'growth'],
      why: 'The growth-round average of 7.5-8% sits inside the "below 10%" ceiling reported for Series A.',
    },
    {
      geography: 'IN',
      stages: ['seriesB', 'growth'],
      why: 'The growth-round average of 7.5-8% sits inside the "below 10%" ceiling reported for Series B.',
    },
  ],
};

/**
 * Both tracks. Always both.
 *
 * Declaration order here is not precedence. Anything that consumes this must
 * render both, and must not pick one when it wants a single number.
 */
export const BENCHMARK_TRACKS: readonly [BenchmarkTrack, BenchmarkTrack] = [
  ADVISORY_TRACK,
  OBSERVED_TRACK,
];

/* ------------------------------------------------------------------------- *
 * Comparison — spec output item 10
 * ------------------------------------------------------------------------- */

/**
 * The band a track states for one stage in one geography, or null if it states
 * none.
 *
 * The observed track has no pre-seed or seed band at all, and that absence is a
 * finding rather than a gap to be filled by borrowing the nearest neighbour.
 * Interpolating between "most Series A companies are below 10%" and nothing
 * would manufacture a number the study never reported.
 */
export function bandForStage(args: {
  readonly track: BenchmarkTrack;
  readonly stage: Stage;
  readonly geography: Geography;
}): BenchmarkBand | null {
  const { track, stage, geography } = args;

  return (
    track.bands.find((band) => band.stage === stage && band.geography === geography) ?? null
  );
}

/**
 * Where a pool percentage sits against one band.
 *
 * `upperBoundOnly` has no floor — "most below 10%" says nothing about how low
 * is too low — so a pool under the ceiling is `within` and never `below`.
 * Reading a missing floor as zero would let the tool tell a founder their pool
 * is beneath a bound the study never drew.
 */
export function positionAgainstBand(
  poolPctOfFullyDiluted: number,
  band: BenchmarkBand | null,
): BenchmarkPosition {
  if (band === null) return 'noBandForStage';
  if (poolPctOfFullyDiluted > band.highPct) return 'above';
  if (band.lowPct !== null && poolPctOfFullyDiluted < band.lowPct) return 'below';

  return 'within';
}

/**
 * Item 10. Both tracks, in one array, neither ranked.
 *
 * D5: neither track is presented as the truth, so this returns both every time
 * and has no argument that could ask for one. A caller that wants a single
 * number is asking the wrong question, and the shape does not answer it.
 *
 * The geography is fixed at India: the observed track's US band is a comparison
 * the study itself draws, not a benchmark for an Indian founder's own pool, and
 * scoring an Indian company against it would be the mistake D5 exists to stop.
 */
export function compareToBenchmarks(args: {
  readonly poolPctOfFullyDiluted: number;
  readonly stage: Stage;
  readonly geography?: Geography;
}): BenchmarkComparison {
  const { poolPctOfFullyDiluted, stage, geography = 'IN' } = args;

  const tracks: readonly BenchmarkTrackComparison[] = BENCHMARK_TRACKS.map((track) => {
    const band = bandForStage({ track, stage, geography });

    return {
      trackId: track.id,
      trackLabel: track.label,
      provenance: track.provenance,
      band,
      position: positionAgainstBand(poolPctOfFullyDiluted, band),
    };
  });

  return { poolPctOfFullyDiluted, tracks };
}
