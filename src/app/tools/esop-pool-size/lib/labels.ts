import type { Band, Stage } from '@/lib/esop';

export const STAGE_LABEL: Record<Stage, string> = {
  preSeed: 'Pre-seed',
  seed: 'Seed',
  seriesA: 'Series A',
  seriesB: 'Series B',
  seriesCPlus: 'Series C+',
};

export const BAND_LABEL: Record<Band, string> = {
  leadership: 'Leadership',
  senior: 'Senior',
  mid: 'Mid',
  junior: 'Junior',
};
