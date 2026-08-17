/**
 * The A4 renderer. The only part of the report that touches a browser.
 *
 * `reportModel.ts` decides what the report says; this decides where it sits on
 * the page. Keeping them apart is what lets the prohibition checks run in a
 * node test with no DOM: the copy is testable, the layout is not, and the
 * layout is the half that cannot be got wrong in a way that misleads a founder.
 */

import { jsPDF } from 'jspdf';
import type { CapturedChart } from './chartCapture';
import type { ChecklistItem, KeyValueRow, ReportBlock, ReportModel, ReportSection } from './reportModel';
import { PROVENANCE_LABEL } from './reportModel';

/* A4 portrait, in millimetres. */
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_X = 18;
const MARGIN_TOP = 22;
const MARGIN_BOTTOM = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

type Rgb = readonly [number, number, number];

function rgb(hex: string): Rgb {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

/*
 * The printed page is always the light theme, so these are the light Incentiv
 * values. jsPDF takes RGB triples, not CSS custom properties, which is why
 * they are literals here rather than reads of the token layer; each names the
 * token it is.
 *
 * `FAINT` follows the screen's `--text-faint` onto `--ink-2` rather than onto
 * `--ink-3`, for the same reason and with the same cost: it carries the 7.5pt
 * and 8pt lines — references, disclaimers, captions — where `--ink-3` measures
 * 3.40:1 on paper. The PDF therefore has two ink tiers where it used to have
 * three.
 *
 * `WARN` and `DANGER` are UNMAPPED: Incentiv ships no status colours.
 */
const INK = rgb('#111214'); // --ink
const SUB = rgb('#55565a'); // --ink-2
const FAINT = rgb('#55565a'); // --ink-2
const ACCENT = rgb('#1f4fff'); // --accent
const BORDER = rgb('#e4e4e0'); // --line
const MUTED = rgb('#f3f3f0'); // --surface-2
const WARN = rgb('#8a5300'); // UNMAPPED
const DANGER = rgb('#9e2222'); // UNMAPPED
const WHITE: Rgb = [255, 255, 255]; // --surface

const STATUS_COLOUR: Record<ChecklistItem['status'], Rgb> = {
  pass: ACCENT,
  warn: WARN,
  blocked: DANGER,
};

const STATUS_LABEL: Record<ChecklistItem['status'], string> = {
  pass: 'PASS',
  warn: 'CHECK',
  blocked: 'BLOCKED',
};

/**
 * A cursor over a growing document.
 *
 * Every writer takes the cursor, draws, and moves `y` down. `space` adds a page
 * when the next block will not fit, so nothing has to know its own page number.
 */
class Layout {
  readonly doc: jsPDF;
  y = MARGIN_TOP;
  private pageIndex = 0;

  constructor(doc: jsPDF) {
    this.doc = doc;
  }

  get pages(): number {
    return this.pageIndex + 1;
  }

  newPage(): void {
    this.doc.addPage();
    this.pageIndex += 1;
    this.y = MARGIN_TOP;
  }

  /** Ensure `height` mm is available, starting a page if it is not. */
  space(height: number): void {
    if (this.y + height > PAGE_HEIGHT - MARGIN_BOTTOM) this.newPage();
  }

  text(
    content: string,
    options: {
      readonly size?: number;
      readonly colour?: Rgb;
      readonly bold?: boolean;
      readonly width?: number;
      readonly lineHeight?: number;
      readonly x?: number;
    } = {},
  ): void {
    const size = options.size ?? 9.5;
    const colour = options.colour ?? SUB;
    const width = options.width ?? CONTENT_WIDTH;
    const lineHeight = options.lineHeight ?? size * 0.46;
    const x = options.x ?? MARGIN_X;

    this.doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(...colour);

    for (const line of this.doc.splitTextToSize(content, width) as string[]) {
      this.space(lineHeight + 2);
      this.doc.text(line, x, this.y);
      this.y += lineHeight;
    }
  }

  rule(): void {
    this.space(4);
    this.doc.setDrawColor(...BORDER);
    this.doc.setLineWidth(0.2);
    this.doc.line(MARGIN_X, this.y, PAGE_WIDTH - MARGIN_X, this.y);
    this.y += 3;
  }
}

/* ------------------------------------------------------------------------- *
 * Cover
 * ------------------------------------------------------------------------- */

function drawCover(layout: Layout, model: ReportModel): void {
  const { doc } = layout;
  const { cover } = model;

  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, PAGE_WIDTH, 46, 'F');

  doc.setFillColor(...WHITE);
  doc.roundedRect(MARGIN_X, 16, 9, 9, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...ACCENT);
  doc.text('i', MARGIN_X + 3.4, 22.6);

  doc.setTextColor(...WHITE);
  doc.setFontSize(15);
  doc.text('incentiv', MARGIN_X + 12, 22.6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('ESOP pool sizing report', MARGIN_X, 34);

  layout.y = 64;
  layout.text(cover.companyName, { size: 24, colour: INK, bold: true, lineHeight: 10 });
  layout.text(`${cover.stageLabel} · prepared ${cover.preparedOn} for ${cover.preparedFor}`, {
    size: 9.5,
    colour: FAINT,
  });

  layout.y += 8;

  /**
   * The headline block. PROJECT.md forbids a pool percentage appearing without
   * the grant basis and the strike policy that produced it, so the two are
   * drawn inside the same panel as the number rather than deeper in the report.
   */
  const panelTop = layout.y;
  const panelHeight = 62;
  doc.setFillColor(...MUTED);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(MARGIN_X, panelTop, CONTENT_WIDTH, panelHeight, 2, 2, 'FD');

  layout.y = panelTop + 11;
  layout.text('RECOMMENDED POOL', { size: 8, colour: FAINT, bold: true, x: MARGIN_X + 8 });

  layout.y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(34);
  doc.setTextColor(...INK);
  doc.text(cover.headlinePoolPct, MARGIN_X + 8, layout.y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...SUB);
  doc.text('of fully diluted', MARGIN_X + 8 + doc.getTextWidth(cover.headlinePoolPct) * 0.42 + 22, layout.y + 8);

  layout.y += 15;
  layout.text(cover.headlinePoolOptions, { size: 10, colour: SUB, x: MARGIN_X + 8, width: CONTENT_WIDTH - 16 });

  layout.y += 2;
  layout.text(`Grant basis: ${cover.grantBasis}    ·    Strike price policy: ${cover.strikePolicy}`, {
    size: 9,
    colour: INK,
    bold: true,
    x: MARGIN_X + 8,
    width: CONTENT_WIDTH - 16,
  });
  layout.text(`Value basis: ${cover.valueBasis}`, {
    size: 8.5,
    colour: FAINT,
    x: MARGIN_X + 8,
    width: CONTENT_WIDTH - 16,
  });

  layout.y = panelTop + panelHeight + 12;

  layout.text(`${cover.topUpLabel}: ${cover.topUpValue}, ${cover.topUpPct} of fully diluted`, {
    size: 11,
    colour: INK,
    bold: true,
  });
  layout.y += 1;
  layout.text(`Your current pool: ${cover.currentPoolRunway}`, { size: 10, colour: SUB });

  layout.y = PAGE_HEIGHT - MARGIN_BOTTOM - 22;
  layout.rule();
  layout.text(cover.disclaimer, { size: 8, colour: FAINT });
}

/* ------------------------------------------------------------------------- *
 * Blocks
 * ------------------------------------------------------------------------- */

function drawKeyValue(layout: Layout, rows: readonly KeyValueRow[]): void {
  const labelWidth = 62;
  const provenanceWidth = 34;
  const valueWidth = CONTENT_WIDTH - labelWidth - provenanceWidth - 6;

  for (const row of rows) {
    const { doc } = layout;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    const valueLines = doc.splitTextToSize(row.value, valueWidth) as string[];
    const labelLines = doc.splitTextToSize(row.label, labelWidth) as string[];
    const height = Math.max(valueLines.length, labelLines.length) * 4 + 2.5;

    layout.space(height + 2);
    const top = layout.y;

    doc.setTextColor(...SUB);
    labelLines.forEach((line, i) => doc.text(line, MARGIN_X, top + i * 4));

    doc.setTextColor(...INK);
    valueLines.forEach((line, i) => doc.text(line, MARGIN_X + labelWidth, top + i * 4));

    if (row.provenance) {
      doc.setFontSize(7.5);
      doc.setTextColor(...FAINT);
      doc.text(PROVENANCE_LABEL[row.provenance], PAGE_WIDTH - MARGIN_X, top, { align: 'right' });
    }

    layout.y = top + height;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.1);
    doc.line(MARGIN_X, layout.y - 2, PAGE_WIDTH - MARGIN_X, layout.y - 2);
  }

  layout.y += 3;
}

function drawTable(
  layout: Layout,
  headers: readonly string[],
  rows: readonly (readonly string[])[],
  caption?: string,
): void {
  const { doc } = layout;

  if (caption) {
    layout.space(9);
    layout.text(caption, { size: 9, colour: INK, bold: true });
    layout.y += 1;
  }

  const columns = headers.length;
  /** The first column is a label and gets the slack; the rest share evenly. */
  const firstWidth = columns > 3 ? 20 : 58;
  const otherWidth = (CONTENT_WIDTH - firstWidth) / Math.max(1, columns - 1);
  const columnX = (index: number) => MARGIN_X + (index === 0 ? 0 : firstWidth + (index - 1) * otherWidth);
  const columnWidth = (index: number) => (index === 0 ? firstWidth : otherWidth);

  const drawHeader = () => {
    layout.space(9);
    doc.setFillColor(...MUTED);
    doc.rect(MARGIN_X, layout.y - 3.5, CONTENT_WIDTH, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...SUB);

    headers.forEach((header, i) => {
      const lines = doc.splitTextToSize(header, columnWidth(i) - 2) as string[];
      doc.text(lines[0] ?? header, columnX(i) + 1, layout.y);
    });

    layout.y += 5;
  };

  drawHeader();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  for (const row of rows) {
    const heights = row.map((cell, i) => (doc.splitTextToSize(cell, columnWidth(i) - 2) as string[]).length);
    const height = Math.max(1, ...heights) * 3.6 + 1.6;

    if (layout.y + height > PAGE_HEIGHT - MARGIN_BOTTOM) {
      layout.newPage();
      drawHeader();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
    }

    const top = layout.y;
    row.forEach((cell, i) => {
      doc.setTextColor(...(i === 0 ? INK : SUB));
      const lines = doc.splitTextToSize(cell, columnWidth(i) - 2) as string[];
      lines.forEach((line, li) => doc.text(line, columnX(i) + 1, top + li * 3.6));
    });

    layout.y = top + height;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.1);
    doc.line(MARGIN_X, layout.y - 1.6, PAGE_WIDTH - MARGIN_X, layout.y - 1.6);
  }

  layout.y += 3;
}

function drawChecklist(layout: Layout, items: readonly ChecklistItem[]): void {
  const { doc } = layout;

  for (const item of items) {
    layout.space(26);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...STATUS_COLOUR[item.status]);
    doc.text(STATUS_LABEL[item.status], MARGIN_X, layout.y);

    /* The rule the row is about, so the eight rows are not eight unlabelled
       paragraphs. The engine supplies it; dropping it wasted the field. */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...SUB);
    doc.text(item.title, MARGIN_X + 16, layout.y);
    layout.y += 4;

    layout.text(item.finding, { size: 9, colour: INK });
    layout.text(item.action, { size: 8.5, colour: SUB });
    layout.text(`${item.reference} · ${item.disclaimer}`, { size: 7.5, colour: FAINT });
    layout.y += 4;
  }
}

function drawChart(
  layout: Layout,
  block: Extract<ReportBlock, { kind: 'chart' }>,
  captured: ReadonlyMap<string, CapturedChart>,
): void {
  const { doc } = layout;
  const chart = captured.get(block.chartId);

  layout.space(14);
  layout.text(block.title, { size: 10, colour: INK, bold: true });

  if (chart) {
    const width = CONTENT_WIDTH;
    const height = Math.min(95, (chart.height / chart.width) * width);

    layout.space(height + 4);
    doc.addImage(chart.dataUrl, 'PNG', MARGIN_X, layout.y, width, height);
    layout.y += height + 4;
  } else {
    layout.text('This chart could not be included in the PDF. It is on screen in the tool.', {
      size: 8.5,
      colour: FAINT,
    });
  }

  /* The on-screen legend is HTML beside the SVG, so it is redrawn here. */
  let legendX = MARGIN_X;
  layout.space(6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  for (const key of block.keys) {
    const labelWidth = doc.getTextWidth(key.label) + 8;

    if (legendX + labelWidth > PAGE_WIDTH - MARGIN_X) {
      legendX = MARGIN_X;
      layout.y += 4;
    }

    doc.setFillColor(...rgb(key.color));
    doc.rect(legendX, layout.y - 1.6, 3.5, 1.6, 'F');
    doc.setTextColor(...SUB);
    doc.text(key.label, legendX + 5, layout.y);
    legendX += labelWidth;
  }

  layout.y += 5;
  layout.text(block.caption, { size: 8, colour: FAINT });
  layout.y += 4;
}

function drawBlock(layout: Layout, block: ReportBlock, captured: ReadonlyMap<string, CapturedChart>): void {
  switch (block.kind) {
    case 'paragraph':
      layout.text(block.text, { size: 9.5, colour: SUB });
      layout.y += 3;
      return;

    case 'callout': {
      const { doc } = layout;
      const lines = doc.splitTextToSize(block.text, CONTENT_WIDTH - 10) as string[];
      const height = lines.length * 4.4 + 8;

      layout.space(height + 2);
      doc.setFillColor(...MUTED);
      doc.setDrawColor(...BORDER);
      doc.roundedRect(MARGIN_X, layout.y - 4, CONTENT_WIDTH, height, 1.5, 1.5, 'FD');
      doc.setFillColor(...ACCENT);
      doc.rect(MARGIN_X, layout.y - 4, 1.2, height, 'F');

      layout.y += 2;
      layout.text(block.text, { size: 9, colour: INK, x: MARGIN_X + 5, width: CONTENT_WIDTH - 10, lineHeight: 4.4 });
      layout.y += 7;
      return;
    }

    case 'bullets':
      for (const item of block.items) {
        const { doc } = layout;
        layout.space(6);
        doc.setFillColor(...ACCENT);
        doc.circle(MARGIN_X + 1, layout.y - 1.2, 0.6, 'F');
        layout.text(item, { size: 9, colour: SUB, x: MARGIN_X + 4, width: CONTENT_WIDTH - 4 });
        layout.y += 1.5;
      }
      layout.y += 2;
      return;

    case 'keyValue':
      drawKeyValue(layout, block.rows);
      return;

    case 'table':
      drawTable(layout, block.headers, block.rows, block.caption);
      return;

    case 'chart':
      drawChart(layout, block, captured);
      return;

    case 'checklist':
      drawChecklist(layout, block.items);
      return;
  }
}

function drawSection(
  layout: Layout,
  section: ReportSection,
  captured: ReadonlyMap<string, CapturedChart>,
): void {
  layout.space(18);
  layout.text(section.title, { size: 13, colour: INK, bold: true, lineHeight: 6 });
  layout.rule();
  layout.y += 2;

  for (const block of section.blocks) drawBlock(layout, block, captured);

  layout.y += 4;
}

/* ------------------------------------------------------------------------- *
 * Footers
 * ------------------------------------------------------------------------- */

/**
 * Two lines of furniture on every page but the cover.
 *
 * The upper line is the grant basis and the strike policy. It is here, rather
 * than only in the copy, because PROJECT.md forbids a pool percentage from
 * appearing without them on the same screen and this document is paginated:
 * the recommendation, the roll-forward, the round and the scenarios all print
 * percentages, on pages the cover panel does not reach. Page furniture is the
 * only place that covers all of them at once.
 */
function drawFooters(doc: jsPDF, footer: string, controls: string): void {
  const total = doc.getNumberOfPages();
  const ruleY = PAGE_HEIGHT - MARGIN_BOTTOM + 5;

  /* Page 1 is the cover: it carries both controls in its headline panel. */
  for (let page = 2; page <= total; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_X, ruleY, PAGE_WIDTH - MARGIN_X, ruleY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...SUB);
    doc.text(controls, MARGIN_X, ruleY + 4.5);

    doc.setFontSize(7);
    doc.setTextColor(...FAINT);
    doc.text(footer, MARGIN_X, ruleY + 8.5);
    doc.text(`${page} of ${total}`, PAGE_WIDTH - MARGIN_X, ruleY + 8.5, { align: 'right' });
  }
}

/* ------------------------------------------------------------------------- *
 * The renderer
 * ------------------------------------------------------------------------- */

/**
 * Render the model to a PDF. The CTA section is forced onto its own final page,
 * because a call to action wedged under half a glossary is not a closing page.
 */
export function renderReportPdf(
  model: ReportModel,
  captured: ReadonlyMap<string, CapturedChart> = new Map(),
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const layout = new Layout(doc);

  drawCover(layout, model);

  for (const section of model.sections) {
    layout.newPage();

    if (section.id === 'cta') {
      layout.y = 90;
      const { doc: d } = layout;
      d.setFillColor(...MUTED);
      d.setDrawColor(...BORDER);
      d.roundedRect(MARGIN_X, layout.y - 12, CONTENT_WIDTH, 62, 2, 2, 'FD');
      layout.text(section.title, { size: 15, colour: INK, bold: true, x: MARGIN_X + 8, width: CONTENT_WIDTH - 16, lineHeight: 7 });
      layout.y += 3;

      for (const block of section.blocks) drawBlock(layout, block, captured);
      continue;
    }

    drawSection(layout, section, captured);
  }

  drawFooters(doc, model.footer, model.controlsFooter);

  return doc;
}
