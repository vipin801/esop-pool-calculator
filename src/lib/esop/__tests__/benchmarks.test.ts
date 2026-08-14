import { describe, expect, it } from 'vitest';

import { ADVISORY_TRACK, BENCHMARK_TRACKS, OBSERVED_TRACK } from '../benchmarks';
import {
  BENCHMARK_STAGE_ORDER,
  type BenchmarkBand,
  type BenchmarkTrack,
  type Geography,
  type Provenance,
} from '../types';

const ALLOWED_PROVENANCE: readonly Provenance[] = ['estimate', 'provisional'];

/** Words that would let one track outrank the other. PROJECT.md D5 forbids all of them. */
const AUTHORITY_WORDS = [
  'primary',
  'preferred',
  'default',
  'authoritative',
  'canonical',
  'weight',
  'rank',
  'priority',
  'trusted',
] as const;

function stageIndex(band: BenchmarkBand): number {
  return BENCHMARK_STAGE_ORDER.indexOf(band.stage);
}

/** "Below 10%" has no stated floor. Pool sizes cannot go under zero, so zero it is. */
function effectiveLow(band: BenchmarkBand): number {
  return band.lowPct ?? 0;
}

/** Strict interval intersection: bands that merely touch at an endpoint do not overlap. */
function overlaps(a: BenchmarkBand, b: BenchmarkBand): boolean {
  return effectiveLow(a) < b.highPct && effectiveLow(b) < a.highPct;
}

function overlapKey(geography: Geography, stages: readonly [string, string]): string {
  return `${geography}:${[...stages].sort().join('|')}`;
}

function geographiesIn(track: BenchmarkTrack): readonly Geography[] {
  return [...new Set(track.bands.map((band) => band.geography))];
}

function bandsFor(track: BenchmarkTrack, geography: Geography): readonly BenchmarkBand[] {
  return track.bands
    .filter((band) => band.geography === geography)
    .slice()
    .sort((a, b) => stageIndex(a) - stageIndex(b));
}

describe('the two tracks', () => {
  it('ships both, and only both', () => {
    expect(BENCHMARK_TRACKS).toHaveLength(2);
    expect(BENCHMARK_TRACKS.map((track) => track.id)).toEqual(['advisory', 'observed']);
  });

  it('gives each track its own label, provenance and one-line description', () => {
    for (const track of BENCHMARK_TRACKS) {
      expect(track.label.length, `${track.id} has no label`).toBeGreaterThan(0);
      expect(track.description.length, `${track.id} has no description`).toBeGreaterThan(20);
      expect(track.description, `${track.id} description is not one line`).not.toContain('\n');
      expect(track.caveat.length, `${track.id} has no caveat`).toBeGreaterThan(20);
      expect(ALLOWED_PROVENANCE, `${track.id} provenance`).toContain(track.provenance);
      expect(track.asOf).toMatch(/^\d{4}-\d{2}$/);
      expect(track.bands.length, `${track.id} has no bands`).toBeGreaterThan(0);
    }
  });

  it('tags advisory as an estimate and observed as provisional', () => {
    expect(ADVISORY_TRACK.provenance).toBe('estimate');
    expect(OBSERVED_TRACK.provenance).toBe('provisional');
  });

  it('says in the advisory caveat that the ranges are not data', () => {
    expect(ADVISORY_TRACK.caveat.toLowerCase()).toContain('never data');
  });
});

describe('neither track outranks the other', () => {
  it('gives both tracks the identical shape', () => {
    const advisoryKeys = Object.keys(ADVISORY_TRACK).sort();
    const observedKeys = Object.keys(OBSERVED_TRACK).sort();
    expect(advisoryKeys).toEqual(observedKeys);
  });

  it('carries no field that could express authority', () => {
    for (const track of BENCHMARK_TRACKS) {
      for (const key of Object.keys(track)) {
        for (const word of AUTHORITY_WORDS) {
          expect(
            key.toLowerCase().includes(word),
            `${track.id} carries an authority-suggesting field: ${key}`,
          ).toBe(false);
        }
      }
    }
  });
});

describe('bands are well formed', () => {
  it('uses a known stage and a sane interval', () => {
    for (const track of BENCHMARK_TRACKS) {
      for (const band of track.bands) {
        expect(stageIndex(band), `${track.id} ${band.stage} is not a known stage`).toBeGreaterThan(
          -1,
        );
        expect(band.highPct, `${track.id} ${band.stage} has a non-positive ceiling`).toBeGreaterThan(
          0,
        );
        if (band.lowPct !== null) {
          expect(
            band.lowPct,
            `${track.id} ${band.stage} is inverted`,
          ).toBeLessThanOrEqual(band.highPct);
        }
        expect(band.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('states a stage at most once per track and geography', () => {
    for (const track of BENCHMARK_TRACKS) {
      for (const geography of geographiesIn(track)) {
        const stages = bandsFor(track, geography).map((band) => band.stage);
        expect(new Set(stages).size, `${track.id} ${geography} repeats a stage`).toBe(
          stages.length,
        );
      }
    }
  });
});

describe('bands are ordered within a track', () => {
  it('declares a stage trend for every geography it reports on', () => {
    for (const track of BENCHMARK_TRACKS) {
      for (const geography of geographiesIn(track)) {
        const trend = track.stageTrends.find((entry) => entry.geography === geography);
        expect(trend, `${track.id} has no declared trend for ${geography}`).toBeDefined();
        expect(trend?.note.length ?? 0).toBeGreaterThan(20);
      }
    }
  });

  it('moves monotonically in the declared direction', () => {
    for (const track of BENCHMARK_TRACKS) {
      for (const geography of geographiesIn(track)) {
        const trend = track.stageTrends.find((entry) => entry.geography === geography);
        if (trend === undefined) throw new Error(`${track.id} ${geography} has no trend`);
        const bands = bandsFor(track, geography);

        for (let i = 1; i < bands.length; i += 1) {
          const previous = bands[i - 1];
          const current = bands[i];
          if (previous === undefined || current === undefined) {
            throw new Error('unreachable: index inside array length');
          }

          const where = `${track.id} ${geography} ${previous.stage} to ${current.stage}`;

          if (trend.direction === 'increasing') {
            expect(current.highPct, `${where} ceiling falls`).toBeGreaterThanOrEqual(
              previous.highPct,
            );
            if (previous.lowPct !== null && current.lowPct !== null) {
              expect(current.lowPct, `${where} floor falls`).toBeGreaterThanOrEqual(
                previous.lowPct,
              );
            }
          } else {
            expect(current.highPct, `${where} ceiling rises`).toBeLessThanOrEqual(previous.highPct);
            if (previous.lowPct !== null && current.lowPct !== null) {
              expect(current.lowPct, `${where} floor rises`).toBeLessThanOrEqual(previous.lowPct);
            }
          }
        }
      }
    }
  });

  it('has India shrinking with stage and the US growing, which is the whole point', () => {
    const indiaObserved = OBSERVED_TRACK.stageTrends.find((entry) => entry.geography === 'IN');
    const usObserved = OBSERVED_TRACK.stageTrends.find((entry) => entry.geography === 'US');
    const indiaAdvisory = ADVISORY_TRACK.stageTrends.find((entry) => entry.geography === 'IN');

    expect(indiaObserved?.direction).toBe('decreasing');
    expect(usObserved?.direction).toBe('increasing');
    expect(indiaAdvisory?.direction).toBe('increasing');
  });
});

describe('bands do not overlap within a track, except where the spec says they do', () => {
  it('matches the declared overlaps exactly', () => {
    for (const track of BENCHMARK_TRACKS) {
      const found = new Set<string>();

      for (const geography of geographiesIn(track)) {
        const bands = bandsFor(track, geography);
        for (let i = 0; i < bands.length; i += 1) {
          for (let j = i + 1; j < bands.length; j += 1) {
            const a = bands[i];
            const b = bands[j];
            if (a === undefined || b === undefined) {
              throw new Error('unreachable: index inside array length');
            }
            if (overlaps(a, b)) found.add(overlapKey(geography, [a.stage, b.stage]));
          }
        }
      }

      const declared = new Set(
        track.knownOverlaps.map((entry) => overlapKey(entry.geography, entry.stages)),
      );

      expect(
        [...found].sort(),
        `${track.id} has an overlap that is not declared, or declares one it does not have`,
      ).toEqual([...declared].sort());
    }
  });

  it('explains every declared overlap', () => {
    for (const track of BENCHMARK_TRACKS) {
      for (const entry of track.knownOverlaps) {
        expect(entry.why.length, `${track.id} ${entry.stages.join('/')} has no reason`).toBeGreaterThan(
          30,
        );
      }
    }
  });

  it('declares the Series B against Series C+ overlap the advisory ladder carries', () => {
    expect(ADVISORY_TRACK.knownOverlaps.map((entry) => entry.stages)).toEqual([
      ['seriesB', 'seriesCPlus'],
    ]);
  });
});

describe('the spec numbers survived the trip', () => {
  it('carries the advisory ladder unchanged', () => {
    expect(
      ADVISORY_TRACK.bands.map((band) => [band.stage, band.lowPct, band.highPct]),
    ).toEqual([
      ['preSeed', 5, 8],
      ['seed', 8, 12],
      ['seriesA', 12, 15],
      ['seriesB', 15, 18],
      ['seriesCPlus', 15, 20],
    ]);
  });

  it('carries the observed findings unchanged', () => {
    expect(
      OBSERVED_TRACK.bands.map((band) => [
        band.geography,
        band.stage,
        band.lowPct,
        band.highPct,
        band.kind,
      ]),
    ).toEqual([
      ['IN', 'seriesA', null, 10, 'upperBoundOnly'],
      ['IN', 'seriesB', null, 10, 'upperBoundOnly'],
      ['IN', 'growth', 7.5, 8, 'average'],
      ['US', 'seriesCPlus', 16, 17, 'range'],
    ]);
  });
});
