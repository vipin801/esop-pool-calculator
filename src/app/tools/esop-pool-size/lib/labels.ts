import type { Band, Sector, Stage } from '@/lib/esop';

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

export const SECTOR_LABEL: Record<Sector, string> = {
  general: 'General',
  itServices: 'IT services',
  ecommerce: 'E-commerce',
};
