'use client';

import { forwardRef } from 'react';
import type { EsopResult } from '@/lib/esop';
import { GrantCostChart } from './charts/GrantCostChart';
import { HiresSupportedChart } from './charts/HiresSupportedChart';
import { PoolPctChart } from './charts/PoolPctChart';
import { PoolRunwayChart } from './charts/PoolRunwayChart';

interface ReportChartsProps {
  readonly result: EsopResult;
}

/**
 * The four charts, mounted off screen at a fixed width, for the PDF only.
 *
 * Tabs unmount the panel that is not open, so the report can no longer scrape
 * the visible results for all four `[data-chart]` SVGs — three of them would
 * not exist. This tree is mounted for the duration of a download and torn
 * down after it, and `captureChart` is pointed at it rather than at the
 * screen.
 *
 * `left: -20000px` rather than `display: none`, deliberately: a hidden
 * element has a zero bounding box, `ResponsiveContainer` sizes itself to
 * nothing, and the capture would rasterise a 1x1 image. Off screen keeps
 * layout real. `aria-hidden` and `inert` keep it out of the tab order and out
 * of the accessibility tree, where a second copy of every chart's data table
 * would otherwise appear.
 *
 * 880px is close to the widest the on-screen chart column reaches, so the
 * captured aspect ratio matches what a founder saw.
 */
export const ReportCharts = forwardRef<HTMLDivElement, ReportChartsProps>(function ReportCharts({ result }, ref) {
  return (
    <div
      ref={ref}
      aria-hidden="true"
      // @ts-expect-error -- `inert` is a valid HTML attribute; React 19 types lag on it.
      inert=""
      style={{ position: 'fixed', top: 0, left: '-20000px', width: '880px', pointerEvents: 'none' }}
    >
      <PoolRunwayChart recommended={result.recommended} current={result.current} />
      <PoolPctChart recommended={result.recommended} current={result.current} />
      <HiresSupportedChart recommended={result.recommended} current={result.current} />
      <GrantCostChart
        years={result.recommended.years}
        grantBasisKind={result.recommendedPool.selected.grantBasisKind}
      />
    </div>
  );
});
