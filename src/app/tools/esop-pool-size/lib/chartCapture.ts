/**
 * Rasterises the on-screen charts for the PDF.
 *
 * **No html2canvas, and no network.** The charts are already SVG, so this
 * clones the `<svg>`, inlines the handful of styles that come from the
 * stylesheet rather than from attributes, serialises it to a `data:` URL, and
 * draws it to a canvas. Two reasons that is better than the obvious library:
 *
 * - html2canvas cannot parse `oklch()`, which Tailwind v4 emits for parts of
 *   its default palette, and fails on the whole subtree when it meets one.
 * - A `data:` URL keeps report generation provably free of network calls,
 *   which is a property the tests assert.
 *
 * The captured image is always in the **light** palette, whatever the viewer
 * is using, because the output is a printed A4 page. Series colours come from
 * inline attributes the charts set from `paletteFor(theme)`, so a dark-mode
 * capture is remapped hex by hex — the two palettes are the only two sets of
 * values these charts can hold.
 */

import { DARK_PALETTE, LIGHT_PALETTE, type ChartPalette } from './chartTheme';

/** Rendered at 2x so the PDF has something better than screen resolution. */
const CAPTURE_SCALE = 2;

export interface CapturedChart {
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
}

/** Dark hex -> light hex, built from the two palettes so it cannot drift. */
function darkToLight(): ReadonlyMap<string, string> {
  const map = new Map<string, string>();

  for (const key of Object.keys(DARK_PALETTE) as (keyof ChartPalette)[]) {
    map.set(DARK_PALETTE[key].toLowerCase(), LIGHT_PALETTE[key]);
  }

  return map;
}

function remapColour(value: string | null, lookup: ReadonlyMap<string, string>): string | null {
  if (value === null) return null;

  return lookup.get(value.trim().toLowerCase()) ?? value;
}

/**
 * Put back the styling the stylesheet was providing, and force it light.
 *
 * `.recharts-cartesian-axis-tick text` and `.recharts-cartesian-grid line` are
 * styled in globals.css, so a serialised clone loses both and renders black
 * ticks on invisible gridlines.
 */
function inlinePresentation(svg: SVGElement): void {
  const lookup = darkToLight();

  for (const node of Array.from(svg.querySelectorAll('*'))) {
    const fill = remapColour(node.getAttribute('fill'), lookup);
    if (fill !== null) node.setAttribute('fill', fill);

    const stroke = remapColour(node.getAttribute('stroke'), lookup);
    if (stroke !== null) node.setAttribute('stroke', stroke);
  }

  for (const text of Array.from(svg.querySelectorAll('.recharts-cartesian-axis-tick text'))) {
    text.setAttribute('fill', LIGHT_PALETTE.axis);
    text.setAttribute('font-size', '11');
    text.setAttribute('font-family', 'Helvetica, Arial, sans-serif');
  }

  for (const line of Array.from(svg.querySelectorAll('.recharts-cartesian-grid line'))) {
    line.setAttribute('stroke', LIGHT_PALETTE.grid);
  }

  for (const text of Array.from(svg.querySelectorAll('text'))) {
    if (!text.getAttribute('font-family')) {
      text.setAttribute('font-family', 'Helvetica, Arial, sans-serif');
    }
  }
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The chart image could not be rasterised.'));
    image.src = dataUrl;
  });
}

/**
 * One chart, by the `data-chart` id `ChartFrame` puts on its wrapper.
 *
 * Returns null rather than throwing when a chart is missing or will not
 * rasterise: a report with three charts in it beats no report at all.
 */
export async function captureChart(root: ParentNode, chartId: string): Promise<CapturedChart | null> {
  try {
    const frame = root.querySelector(`[data-chart="${chartId}"]`);
    const source = frame?.querySelector('svg');
    if (!source) return null;

    const rect = source.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    const clone = source.cloneNode(true) as SVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    inlinePresentation(clone);

    const serialised = new XMLSerializer().serializeToString(clone);
    const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialised)}`;
    const image = await loadImage(svgUrl);

    const canvas = document.createElement('canvas');
    canvas.width = width * CAPTURE_SCALE;
    canvas.height = height * CAPTURE_SCALE;

    const context = canvas.getContext('2d');
    if (!context) return null;

    /** The PDF page is white; an un-painted canvas would composite as black. */
    context.fillStyle = LIGHT_PALETTE.surface;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return { dataUrl: canvas.toDataURL('image/png'), width, height };
  } catch {
    return null;
  }
}

export async function captureCharts(
  root: ParentNode,
  chartIds: readonly string[],
): Promise<ReadonlyMap<string, CapturedChart>> {
  const captured = new Map<string, CapturedChart>();

  for (const chartId of chartIds) {
    const chart = await captureChart(root, chartId);
    if (chart) captured.set(chartId, chart);
  }

  return captured;
}
