/**
 * The A4 renderer. The only part of the report that touches a browser.
 *
 * `reportModel.ts` decides what the report says; this decides where it sits on
 * the page. Keeping them apart is what lets the prohibition checks run in a
 * node test with no DOM: the copy is testable, the layout is not, and the
 * layout is the half that cannot be got wrong in a way that misleads a founder.
 *
 * Layout rules, each fixing something the first version got wrong on paper:
 *
 * - **Inter, embedded.** jsPDF's Helvetica has no ₹, ≈ or −, so every money
 *   field printed as mojibake. See `reportFonts.ts`.
 * - **Page one is the executive summary**, not a logo and a number: the
 *   headline with both controls, the answer in a sentence, six figures, and
 *   what needs attention. A reader who stops there has the decision.
 * - **Sections flow.** A page per section left most pages two-thirds empty;
 *   a section now starts a page only when the one it would start on is
 *   nearly full. The closing page is the exception, on purpose.
 * - **Blocks are measured before they are drawn**, and a chart, a checklist
 *   row or a callout moves to the next page whole rather than splitting from
 *   its own title.
 * - **Numbers are right-aligned** in tables, negatives are marked, and a
 *   total row reads as one.
 */

import { jsPDF } from 'jspdf';
import type { CapturedChart } from './chartCapture';
import type { ChecklistItem, KeyValueRow, ReportBlock, ReportModel, ReportSection } from './reportModel';
import { PROVENANCE_LABEL } from './reportModel';
import { INTER_BOLD, INTER_REGULAR, INTER_SEMIBOLD } from './reportFonts';

/* A4 portrait, in millimetres. */
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_X = 18;
const MARGIN_TOP = 24;
const MARGIN_BOTTOM = 22;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const CONTENT_BOTTOM = PAGE_HEIGHT - MARGIN_BOTTOM;

/** A section starts a fresh page when less than this is left on the current one. */
const SECTION_MIN_SPACE = 60;

/** Points to millimetres, for line heights set as a multiple of the font size. */
const PT = 0.3528;

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
 * `WARN`, `DANGER` and their tints are UNMAPPED: Incentiv ships no status
 * colours.
 */
const INK = rgb('#111214'); // --ink
const SUB = rgb('#55565a'); // --ink-2
const FAINT = rgb('#55565a'); // --ink-2
const ACCENT = rgb('#1f4fff'); // --accent
const ACCENT_TINT = rgb('#e9eeff'); // UNMAPPED, the accent at ~10% on white
const BORDER = rgb('#e4e4e0'); // --line
const MUTED = rgb('#f3f3f0'); // --surface-2
const WARN = rgb('#8a5300'); // UNMAPPED
const WARN_TINT = rgb('#fbf1e1'); // UNMAPPED
const DANGER = rgb('#9e2222'); // UNMAPPED
const DANGER_TINT = rgb('#f9e6e6'); // UNMAPPED
const WHITE: Rgb = [255, 255, 255]; // --surface

const STATUS_COLOUR: Record<ChecklistItem['status'], Rgb> = {
  pass: ACCENT,
  warn: WARN,
  blocked: DANGER,
};

const STATUS_TINT: Record<ChecklistItem['status'], Rgb> = {
  pass: ACCENT_TINT,
  warn: WARN_TINT,
  blocked: DANGER_TINT,
};

const STATUS_LABEL: Record<ChecklistItem['status'], string> = {
  pass: 'PASS',
  warn: 'CHECK',
  blocked: 'BLOCKED',
};

/* ------------------------------------------------------------------------- *
 * Type
 * ------------------------------------------------------------------------- */

type Weight = 'regular' | 'semibold' | 'bold';

const FAMILY: Record<Weight, string> = {
  regular: 'Inter',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
};

/**
 * Register the embedded faces. Returns false if jsPDF refuses them, and the
 * report then falls back to Helvetica with the copy transliterated — worse
 * typography, but every figure still legible, which beats no report.
 */
function registerFonts(doc: jsPDF): boolean {
  try {
    const faces: readonly [Weight, string][] = [
      ['regular', INTER_REGULAR],
      ['semibold', INTER_SEMIBOLD],
      ['bold', INTER_BOLD],
    ];

    for (const [weight, data] of faces) {
      const file = `${FAMILY[weight]}.ttf`;
      doc.addFileToVFS(file, data);
      doc.addFont(file, FAMILY[weight], 'normal');
    }

    doc.setFont(FAMILY.regular, 'normal');
    return true;
  } catch {
    return false;
  }
}

/** What Helvetica can print in place of the glyphs it lacks. Fallback only. */
function toWinAnsi(text: string): string {
  return text
    .replace(/₹\s?/g, 'Rs ')
    .replace(/≈/g, '~')
    .replace(/[−–]/g, '-')
    .replace(/→/g, '->')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

/**
 * A cursor over a growing document.
 *
 * Every writer takes the cursor, draws, and moves `y` down. `space` adds a page
 * when the next block will not fit, so nothing has to know its own page number.
 */
class Layout {
  readonly doc: jsPDF;
  readonly embedded: boolean;
  y = MARGIN_TOP;

  constructor(doc: jsPDF, embedded: boolean) {
    this.doc = doc;
    this.embedded = embedded;
  }

  newPage(): void {
    this.doc.addPage();
    this.y = MARGIN_TOP;
  }

  get remaining(): number {
    return CONTENT_BOTTOM - this.y;
  }

  /** Ensure `height` mm is available, starting a page if it is not. */
  space(height: number): void {
    if (this.y + height > CONTENT_BOTTOM) this.newPage();
  }

  font(weight: Weight, size: number, colour: Rgb = INK): void {
    if (this.embedded) {
      this.doc.setFont(FAMILY[weight], 'normal');
    } else {
      this.doc.setFont('helvetica', weight === 'regular' ? 'normal' : 'bold');
    }
    this.doc.setFontSize(size);
    this.doc.setTextColor(...colour);
  }

  clean(text: string): string {
    return this.embedded ? text : toWinAnsi(text);
  }

  /** Wrap at the current font, which must already be set. */
  wrap(text: string, width: number): string[] {
    return this.doc.splitTextToSize(this.clean(text), width) as string[];
  }

  width(text: string): number {
    return this.doc.getTextWidth(this.clean(text));
  }

  put(text: string, x: number, y: number, options?: { readonly align?: 'left' | 'right' | 'center' }): void {
    this.doc.text(this.clean(text), x, y, options);
  }

  /** The height `text` will take, without drawing it. */
  measure(text: string, size: number, width: number, weight: Weight = 'regular', lineHeight = size * PT * 1.45): number {
    this.font(weight, size);
    return this.wrap(text, width).length * lineHeight;
  }

  text(
    content: string,
    options: {
      readonly size?: number;
      readonly colour?: Rgb;
      readonly weight?: Weight;
      readonly width?: number;
      readonly lineHeight?: number;
      readonly x?: number;
    } = {},
  ): void {
    const size = options.size ?? 9;
    const width = options.width ?? CONTENT_WIDTH;
    const lineHeight = options.lineHeight ?? size * PT * 1.45;
    const x = options.x ?? MARGIN_X;

    this.font(options.weight ?? 'regular', size, options.colour ?? SUB);

    for (const line of this.wrap(content, width)) {
      this.space(lineHeight);
      /* jsPDF places text on its baseline; the cursor is the top of the line. */
      this.put(line, x, this.y + size * PT * 0.95);
      this.y += lineHeight;
    }
  }

  rule(colour: Rgb = BORDER, weight = 0.2): void {
    this.doc.setDrawColor(...colour);
    this.doc.setLineWidth(weight);
    this.doc.line(MARGIN_X, this.y, PAGE_WIDTH - MARGIN_X, this.y);
  }

  /** A small filled label, such as a compliance status. Returns its width. */
  pill(label: string, x: number, top: number, colour: Rgb, tint: Rgb): number {
    this.font('bold', 6.5, colour);
    const w = this.width(label) + 3.6;
    this.doc.setFillColor(...tint);
    this.doc.roundedRect(x, top, w, 4.2, 0.9, 0.9, 'F');
    this.put(label, x + 1.8, top + 2.95);
    return w;
  }
}

/* ------------------------------------------------------------------------- *
 * Cover: the executive summary
 * ------------------------------------------------------------------------- */

function drawWordmark(layout: Layout, x: number, baseline: number, size: number, onAccent: boolean): void {
  const { doc } = layout;
  const box = size * 0.62;

  doc.setFillColor(...(onAccent ? WHITE : ACCENT));
  doc.roundedRect(x, baseline - box * 0.86, box, box, box * 0.18, box * 0.18, 'F');
  layout.font('bold', size * 0.95, onAccent ? ACCENT : WHITE);
  layout.put('i', x + box / 2, baseline - box * 0.2, { align: 'center' });

  layout.font('bold', size, onAccent ? WHITE : ACCENT);
  layout.put('incentiv', x + box + 1.8, baseline - box * 0.2);
}

function drawCover(layout: Layout, model: ReportModel): void {
  const { doc } = layout;
  const { cover } = model;

  /* Band */
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, PAGE_WIDTH, 34, 'F');
  drawWordmark(layout, MARGIN_X, 17, 14, true);
  layout.font('regular', 9, WHITE);
  layout.put('ESOP pool sizing report', MARGIN_X, 26);
  layout.put(`Prepared ${cover.preparedOn}`, PAGE_WIDTH - MARGIN_X, 17 - 14 * 0.62 * 0.2, { align: 'right' });
  layout.put(`for ${cover.preparedFor}`, PAGE_WIDTH - MARGIN_X, 26, { align: 'right' });

  /* Company */
  layout.y = 44;
  layout.text(cover.companyName, { size: 22, colour: INK, weight: 'bold', lineHeight: 9 });
  layout.y += 0.5;
  layout.text(cover.stageLabel, { size: 9.5, colour: SUB });

  /**
   * The headline panel. PROJECT.md forbids a pool percentage appearing without
   * the grant basis and the strike policy that produced it, so the two are
   * drawn inside the same panel as the number, beside it, rather than deeper
   * in the report.
   */
  layout.y += 5;
  const panelTop = layout.y;
  const panelHeight = 40;
  const splitX = MARGIN_X + CONTENT_WIDTH * 0.56;

  doc.setFillColor(...MUTED);
  doc.roundedRect(MARGIN_X, panelTop, CONTENT_WIDTH, panelHeight, 2, 2, 'F');
  doc.setFillColor(...ACCENT);
  doc.rect(MARGIN_X, panelTop, 1.4, panelHeight, 'F');

  const left = MARGIN_X + 8;
  layout.font('semibold', 7.5, ACCENT);
  layout.put('RECOMMENDED POOL', left, panelTop + 9);

  layout.font('bold', 34, INK);
  layout.put(cover.headlinePoolPct, left, panelTop + 24);
  const pctWidth = layout.width(cover.headlinePoolPct);

  layout.font('regular', 10, SUB);
  layout.put('of fully diluted', left + pctWidth + 3, panelTop + 24);

  layout.font('semibold', 11, INK);
  layout.put(cover.headlinePoolOptions, left, panelTop + 32.5);

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(splitX, panelTop + 7, splitX, panelTop + panelHeight - 7);

  const controls: readonly [string, string][] = [
    ['Grant basis', cover.grantBasis],
    ['Strike price policy', cover.strikePolicy],
    ['Value basis', cover.valueBasis],
  ];
  const controlX = splitX + 7;
  const controlWidth = MARGIN_X + CONTENT_WIDTH - controlX - 6;
  let controlY = panelTop + 8.5;

  for (const [label, value] of controls) {
    layout.font('regular', 7.5, SUB);
    layout.put(label, controlX, controlY);
    layout.font('semibold', 9.5, INK);
    const lines = layout.wrap(value, controlWidth);
    lines.slice(0, 2).forEach((line, i) => layout.put(line, controlX, controlY + 4.4 + i * 4));
    controlY += 4.4 + Math.min(2, lines.length) * 4 + 2.6;
  }

  /* The answer, in a sentence */
  layout.y = panelTop + panelHeight + 7;
  layout.text(cover.summary, { size: 10.5, colour: INK, lineHeight: 5.4 });

  /* Six figures */
  layout.y += 6;
  layout.font('semibold', 7.5, SUB);
  layout.put('AT A GLANCE', MARGIN_X, layout.y);
  layout.y += 3;

  const columns = 3;
  const gap = 4;
  const tileWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
  const tileHeight = 29;

  cover.highlights.forEach((tile, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = MARGIN_X + col * (tileWidth + gap);
    const top = layout.y + row * (tileHeight + gap);
    const inner = tileWidth - 9;

    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, top, tileWidth, tileHeight, 1.6, 1.6, 'S');

    layout.font('regular', 7.5, SUB);
    layout.put(layout.wrap(tile.label, inner)[0] ?? tile.label, x + 4.5, top + 6.5);

    /* Long values, such as a month label, step down rather than overflow. */
    let valueSize = 13;
    layout.font('bold', valueSize, INK);
    while (layout.width(tile.value) > inner && valueSize > 9) {
      valueSize -= 0.5;
      layout.font('bold', valueSize, INK);
    }
    layout.put(tile.value, x + 4.5, top + 13.5);

    layout.font('regular', 7.5, SUB);
    layout
      .wrap(tile.detail, inner)
      .slice(0, 3)
      .forEach((line, li) => layout.put(line, x + 4.5, top + 19 + li * 3.3));
  });

  layout.y += Math.ceil(cover.highlights.length / columns) * (tileHeight + gap) + 3;

  /* What needs a look before anything is filed */
  if (cover.attention.length > 0) {
    layout.font('semibold', 7.5, SUB);
    layout.put('NEEDS ATTENTION', MARGIN_X, layout.y);
    layout.y += 3;

    for (const item of cover.attention) {
      layout.pill(STATUS_LABEL[item.status], MARGIN_X, layout.y, STATUS_COLOUR[item.status], STATUS_TINT[item.status]);
      layout.font('semibold', 9, INK);
      layout.put(item.title, MARGIN_X + 18, layout.y + 3.1);
      layout.y += 6;
    }

    layout.text('Each is set out, with the rule behind it, in the compliance checklist. General information, not legal advice.', {
      size: 8,
      colour: FAINT,
    });
  }

  /* Disclaimer, pinned to the foot of the page */
  /* Drawn with `put`, not `text`: the cursor is past the content bottom here and `text` would start a page. */
  layout.y = PAGE_HEIGHT - MARGIN_BOTTOM + 2;
  layout.rule();
  layout.font('regular', 7.5, FAINT);
  layout.wrap(cover.disclaimer, CONTENT_WIDTH).forEach((line, i) => layout.put(line, MARGIN_X, layout.y + 4.5 + i * 3.5));
}

/* ------------------------------------------------------------------------- *
 * Blocks
 * ------------------------------------------------------------------------- */

const KV_LINE = 3.9;

function drawKeyValue(layout: Layout, heading: string | undefined, rows: readonly KeyValueRow[]): void {
  const { doc } = layout;
  const hasProvenance = rows.some((row) => row.provenance);
  const labelWidth = 58;
  const provenanceWidth = hasProvenance ? 30 : 0;
  const valueWidth = CONTENT_WIDTH - labelWidth - provenanceWidth - 4;

  const measureRow = (row: KeyValueRow) => {
    layout.font('regular', 8.5);
    const valueLines = layout.wrap(row.value, valueWidth);
    const labelLines = layout.wrap(row.label, labelWidth - 3);
    return { valueLines, labelLines, height: Math.max(valueLines.length, labelLines.length) * KV_LINE + 2.6 };
  };

  if (heading) {
    /* Keep the group label with at least its first row. */
    const first = rows[0] ? measureRow(rows[0]).height : 0;
    layout.space(8 + first);
    layout.font('semibold', 7.5, ACCENT);
    layout.put(heading.toUpperCase(), MARGIN_X, layout.y + 2.6);
    layout.y += 5;
  }

  for (const row of rows) {
    const { valueLines, labelLines, height } = measureRow(row);
    layout.space(height);
    const top = layout.y;
    const baseline = top + 3;

    layout.font('regular', 8.5, SUB);
    labelLines.forEach((line, i) => layout.put(line, MARGIN_X, baseline + i * KV_LINE));

    layout.font('regular', 8.5, INK);
    valueLines.forEach((line, i) => layout.put(line, MARGIN_X + labelWidth, baseline + i * KV_LINE));

    if (row.provenance) {
      layout.font(row.provenance === 'entered' ? 'semibold' : 'regular', 7, row.provenance === 'entered' ? ACCENT : FAINT);
      layout.put(PROVENANCE_LABEL[row.provenance], PAGE_WIDTH - MARGIN_X, baseline, { align: 'right' });
    }

    layout.y = top + height;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.1);
    doc.line(MARGIN_X, layout.y - 0.6, PAGE_WIDTH - MARGIN_X, layout.y - 0.6);
  }

  layout.y += 5;
}

/** A figure, a percentage, a signed count or an empty cell: anything that should align right. */
const NUMERIC = /^(?:[−+-]?\s*(?:≈\s*)?₹?\s*[\d,]+(?:\.\d+)?\s*(?:%|lakh|crore|cr)?|—|)$/;

const TABLE_FONT = 7.8;
const TABLE_LINE = 3.5;

function drawTable(
  layout: Layout,
  block: Extract<ReportBlock, { kind: 'table' }>,
): void {
  const { doc } = layout;
  const { headers, rows, caption, note } = block;

  const numeric = headers.map((_, i) => i > 0 && rows.length > 0 && rows.every((row) => NUMERIC.test((row[i] ?? '').trim())));

  /**
   * Column widths from content: each column's widest cell, capped so one long
   * text column wraps rather than starving the rest, then stretched to fill.
   */
  layout.font('regular', TABLE_FONT);
  const natural = headers.map((header, i) => {
    const cells = rows.map((row) => layout.width(row[i] ?? ''));
    const widest = Math.max(...cells, 0);
    layout.font('semibold', 7);
    const headerWidth = Math.min(layout.width(header), numeric[i] ? 22 : 40);
    layout.font('regular', TABLE_FONT);
    return Math.min(Math.max(widest, headerWidth, 10) + 4, 72);
  });
  const total = natural.reduce((sum, w) => sum + w, 0);
  const widths = natural.map((w) => (w / total) * CONTENT_WIDTH);
  const columnX = (index: number) => MARGIN_X + widths.slice(0, index).reduce((sum, w) => sum + w, 0);

  const cellX = (i: number) => (numeric[i] ? columnX(i) + widths[i]! - 2 : columnX(i) + 2);
  const align = (i: number) => (numeric[i] ? 'right' : 'left') as 'left' | 'right';

  layout.font('semibold', 7);
  const headerLines = headers.map((header, i) => layout.wrap(header, widths[i]! - 4).slice(0, 2));
  const headerHeight = Math.max(...headerLines.map((lines) => lines.length)) * 3.1 + 3.4;

  const rowLayout = rows.map((row) => {
    layout.font('regular', TABLE_FONT);
    const lines = row.map((cell, i) => layout.wrap(cell, widths[i]! - 4));
    return { lines, height: Math.max(1, ...lines.map((l) => l.length)) * TABLE_LINE + 2.6 };
  });

  const drawHeader = () => {
    const top = layout.y;
    doc.setFillColor(...MUTED);
    doc.rect(MARGIN_X, top, CONTENT_WIDTH, headerHeight, 'F');
    layout.font('semibold', 7, SUB);
    headerLines.forEach((lines, i) =>
      lines.forEach((line, li) => layout.put(line, cellX(i), top + 3.9 + li * 3.1, { align: align(i) })),
    );
    layout.y = top + headerHeight;
  };

  /* Caption, header and the first row travel together. */
  const captionHeight = caption ? layout.measure(caption, 8.5, CONTENT_WIDTH, 'semibold') + 1.5 : 0;
  layout.space(captionHeight + headerHeight + (rowLayout[0]?.height ?? 0));

  if (caption) {
    layout.text(caption, { size: 8.5, colour: INK, weight: 'semibold' });
    layout.y += 1.5;
  }

  drawHeader();

  /* A note never starts a page alone: the last row is placed as if it carried it. */
  const noteHeight = note ? layout.measure(note, 7.5, CONTENT_WIDTH) + 2 : 0;

  rows.forEach((row, r) => {
    const { lines, height } = rowLayout[r]!;
    const isTotal = row[0] === 'Total';
    const reserve = r === rows.length - 1 ? noteHeight : 0;

    if (layout.y + height + reserve > CONTENT_BOTTOM) {
      layout.newPage();
      drawHeader();
    }

    const top = layout.y;

    if (isTotal) {
      doc.setDrawColor(...SUB);
      doc.setLineWidth(0.3);
      doc.line(MARGIN_X, top, PAGE_WIDTH - MARGIN_X, top);
    }

    row.forEach((cell, i) => {
      const negative = numeric[i] && /^[−-]\s*[₹≈\d]/.test(cell.trim());
      layout.font(isTotal || i === 0 ? 'semibold' : 'regular', TABLE_FONT, negative ? DANGER : i === 0 ? INK : INK);
      lines[i]!.forEach((line, li) => layout.put(line, cellX(i), top + 4.1 + li * TABLE_LINE, { align: align(i) }));
    });

    layout.y = top + height;

    if (!isTotal) {
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.1);
      doc.line(MARGIN_X, layout.y, PAGE_WIDTH - MARGIN_X, layout.y);
    }
  });

  layout.y += 2;

  if (note) {
    layout.text(note, { size: 7.5, colour: FAINT });
  }

  layout.y += 4;
}

function drawChecklist(layout: Layout, items: readonly ChecklistItem[]): void {
  const { doc } = layout;
  const flagged = items.filter((item) => item.status !== 'pass').length;
  const textX = MARGIN_X + 18;
  const textWidth = CONTENT_WIDTH - 18;

  layout.text(
    flagged === 0
      ? `All ${items.length} checks pass on the facts entered.`
      : `${items.length - flagged} of ${items.length} checks pass on the facts entered. ${flagged === 1 ? 'One needs' : `${flagged} need`} a look, and ${flagged === 1 ? 'is' : 'are'} listed first.`,
    { size: 9, colour: SUB },
  );
  layout.y += 4;

  /* What needs doing reads first; the routine passes follow. */
  const ordered = [...items].sort((a, b) => Number(a.status === 'pass') - Number(b.status === 'pass'));

  for (const item of ordered) {
    const reference = `${item.reference} · ${item.disclaimer}`;
    const height =
      layout.measure(item.title, 9.5, textWidth, 'semibold', 4.6) +
      layout.measure(item.finding, 9, textWidth, 'regular', 4.3) +
      layout.measure(item.action, 8.5, textWidth, 'regular', 4) +
      layout.measure(reference, 7, textWidth, 'regular', 3.3) +
      7;

    layout.space(height);
    const top = layout.y;

    if (item.status !== 'pass') {
      doc.setFillColor(...STATUS_TINT[item.status]);
      doc.roundedRect(MARGIN_X - 2, top - 2, CONTENT_WIDTH + 4, height - 1, 1.4, 1.4, 'F');
    }

    layout.pill(STATUS_LABEL[item.status], MARGIN_X, top, STATUS_COLOUR[item.status], item.status === 'pass' ? ACCENT_TINT : WHITE);

    layout.y = top - 0.4;
    layout.text(item.title, { size: 9.5, colour: INK, weight: 'semibold', x: textX, width: textWidth, lineHeight: 4.6 });
    layout.text(item.finding, { size: 9, colour: INK, x: textX, width: textWidth, lineHeight: 4.3 });
    layout.text(item.action, { size: 8.5, colour: SUB, x: textX, width: textWidth, lineHeight: 4 });
    layout.y += 0.6;
    layout.text(reference, { size: 7, colour: FAINT, x: textX, width: textWidth, lineHeight: 3.3 });

    layout.y = top + height;
  }
}

function drawChart(
  layout: Layout,
  block: Extract<ReportBlock, { kind: 'chart' }>,
  captured: ReadonlyMap<string, CapturedChart>,
): void {
  const { doc } = layout;
  const chart = captured.get(block.chartId);
  const imageHeight = chart ? Math.min(78, (chart.height / chart.width) * CONTENT_WIDTH) : 8;
  const imageWidth = chart ? Math.min(CONTENT_WIDTH, (chart.width / chart.height) * imageHeight) : CONTENT_WIDTH;

  /* Measure the legend as it will wrap, so the whole figure moves as one. */
  layout.font('regular', 7.5);
  let legendRows = 1;
  let probeX = 0;
  for (const key of block.keys) {
    const w = layout.width(key.label) + 9;
    if (probeX + w > CONTENT_WIDTH && probeX > 0) {
      legendRows += 1;
      probeX = 0;
    }
    probeX += w;
  }

  const titleHeight = layout.measure(block.title, 10, CONTENT_WIDTH, 'semibold', 4.8);
  const captionHeight = layout.measure(block.caption, 8, CONTENT_WIDTH, 'regular', 3.7);
  const height = titleHeight + 2 + legendRows * 4.4 + 1.5 + imageHeight + 2 + captionHeight + 7;

  layout.space(height);

  layout.text(block.title, { size: 10, colour: INK, weight: 'semibold', lineHeight: 4.8 });
  layout.y += 2;

  /* The on-screen legend is HTML beside the SVG, so it is redrawn here, above the plot as on screen. */
  let legendX = MARGIN_X;
  layout.font('regular', 7.5, SUB);

  for (const key of block.keys) {
    const w = layout.width(key.label) + 9;
    if (legendX + w > PAGE_WIDTH - MARGIN_X && legendX > MARGIN_X) {
      legendX = MARGIN_X;
      layout.y += 4.4;
    }

    doc.setFillColor(...rgb(key.color));
    doc.roundedRect(legendX, layout.y + 0.5, 2.8, 2.8, 0.5, 0.5, 'F');
    layout.font('regular', 7.5, SUB);
    layout.put(key.label, legendX + 4.2, layout.y + 3);
    legendX += w;
  }
  layout.y += 4.4 + 1.5;

  if (chart) {
    doc.addImage(chart.dataUrl, 'PNG', MARGIN_X, layout.y, imageWidth, imageHeight, undefined, 'FAST');
    layout.y += imageHeight + 2;
  } else {
    layout.text('This chart could not be included in the PDF. It is on screen in the tool.', { size: 8.5, colour: FAINT });
    layout.y += 2;
  }

  layout.text(block.caption, { size: 8, colour: FAINT, lineHeight: 3.7 });
  layout.y += 7;
}

function drawCallout(layout: Layout, text: string): void {
  const { doc } = layout;
  const padX = 6;
  const padY = 4.5;
  const width = CONTENT_WIDTH - padX * 2;
  const textHeight = layout.measure(text, 9, width, 'regular', 4.4);
  const height = textHeight + padY * 2;

  layout.space(height + 3);
  const top = layout.y;

  doc.setFillColor(...ACCENT_TINT);
  doc.roundedRect(MARGIN_X, top, CONTENT_WIDTH, height, 1.5, 1.5, 'F');
  doc.setFillColor(...ACCENT);
  doc.rect(MARGIN_X, top, 1.2, height, 'F');

  layout.y = top + padY;
  layout.text(text, { size: 9, colour: INK, x: MARGIN_X + padX, width, lineHeight: 4.4 });
  layout.y = top + height + 5;
}

function drawBlock(layout: Layout, block: ReportBlock, captured: ReadonlyMap<string, CapturedChart>): void {
  switch (block.kind) {
    case 'paragraph':
      layout.text(block.text, { size: 9.5, colour: SUB, lineHeight: 4.9 });
      layout.y += 3.5;
      return;

    case 'callout':
      drawCallout(layout, block.text);
      return;

    case 'bullets':
      for (const item of block.items) {
        layout.space(5);
        layout.doc.setFillColor(...ACCENT);
        layout.doc.circle(MARGIN_X + 1, layout.y + 2.3, 0.6, 'F');
        layout.text(item, { size: 9, colour: SUB, x: MARGIN_X + 4.5, width: CONTENT_WIDTH - 4.5, lineHeight: 4.4 });
        layout.y += 1.5;
      }
      layout.y += 2;
      return;

    case 'keyValue':
      drawKeyValue(layout, block.heading, block.rows);
      return;

    case 'table':
      drawTable(layout, block);
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
  number: number,
  captured: ReadonlyMap<string, CapturedChart>,
): void {
  if (layout.y > MARGIN_TOP && layout.remaining < SECTION_MIN_SPACE) layout.newPage();
  if (layout.y > MARGIN_TOP) layout.y += 6;

  const top = layout.y;
  layout.font('bold', 8, ACCENT);
  layout.put(String(number).padStart(2, '0'), MARGIN_X, top + 4.8);

  layout.y = top;
  layout.text(section.title, { size: 14, colour: INK, weight: 'bold', x: MARGIN_X + 9, width: CONTENT_WIDTH - 9, lineHeight: 6.4 });
  layout.y += 2;
  layout.rule(INK, 0.4);
  layout.y += 5;

  for (const block of section.blocks) drawBlock(layout, block, captured);
}

/* ------------------------------------------------------------------------- *
 * The closing page
 * ------------------------------------------------------------------------- */

const CTA_LINKS: readonly { readonly label: string; readonly host: string; readonly url: string }[] = [
  { label: 'Book a demo', host: 'incentiv.finance', url: 'https://incentiv.finance' },
  { label: 'Explore Tabulate', host: 'incentiv.finance/tabulate', url: 'https://incentiv.finance/tabulate' },
];

/**
 * The CTA gets the last page to itself, because a call to action wedged under
 * half a glossary is not a closing page. It is laid out as a back cover rather
 * than a lone grey box: the heading, the line, and the two links as buttons
 * that open in a browser. The bullet text is kept in the model for the text
 * export and the tests; the buttons print the same two lines.
 */
function drawClosingPage(layout: Layout, section: ReportSection, model: ReportModel): void {
  const { doc } = layout;
  layout.newPage();

  const top = 70;
  doc.setFillColor(...ACCENT);
  doc.roundedRect(MARGIN_X, top, CONTENT_WIDTH, 92, 3, 3, 'F');

  drawWordmark(layout, MARGIN_X + 12, top + 18, 12, true);

  layout.y = top + 28;
  layout.text(section.title, { size: 17, colour: WHITE, weight: 'bold', x: MARGIN_X + 12, width: CONTENT_WIDTH - 24, lineHeight: 7.4 });
  layout.y += 3;

  const paragraph = section.blocks.find((b) => b.kind === 'paragraph');
  if (paragraph && paragraph.kind === 'paragraph') {
    layout.text(paragraph.text, { size: 10, colour: WHITE, x: MARGIN_X + 12, width: CONTENT_WIDTH - 24, lineHeight: 5 });
  }

  let x = MARGIN_X + 12;
  const buttonTop = Math.max(layout.y + 7, top + 64);

  CTA_LINKS.forEach((link, i) => {
    const primary = i === 0;
    layout.font('semibold', 9.5);
    const labelWidth = layout.width(link.label);
    layout.font('regular', 8);
    const hostWidth = layout.width(link.host);
    const width = Math.max(labelWidth, hostWidth) + 12;

    doc.setFillColor(...(primary ? WHITE : ACCENT));
    doc.setDrawColor(...WHITE);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, buttonTop, width, 14, 2, 2, primary ? 'F' : 'S');

    layout.font('semibold', 9.5, primary ? ACCENT : WHITE);
    layout.put(link.label, x + 6, buttonTop + 6);
    layout.font('regular', 8, primary ? ACCENT : WHITE);
    layout.put(link.host, x + 6, buttonTop + 10.6);
    doc.link(x, buttonTop, width, 14, { url: link.url });

    x += width + 5;
  });

  layout.y = top + 92 + 14;
  layout.text('About this report', { size: 9, colour: INK, weight: 'semibold' });
  layout.y += 1;
  layout.text(model.cover.disclaimer, { size: 8.5, colour: SUB, lineHeight: 4.2 });
}

/* ------------------------------------------------------------------------- *
 * Page furniture
 * ------------------------------------------------------------------------- */

/**
 * A running head and two lines of footer on every page but the cover.
 *
 * The upper footer line is the grant basis and the strike policy. It is here,
 * rather than only in the copy, because PROJECT.md forbids a pool percentage
 * from appearing without them on the same screen and this document is
 * paginated: the recommendation, the roll-forward, the round and the
 * scenarios all print percentages, on pages the cover panel does not reach.
 * Page furniture is the only place that covers all of them at once.
 */
function drawFurniture(layout: Layout, model: ReportModel): void {
  const { doc } = layout;
  const total = doc.getNumberOfPages();
  const ruleY = PAGE_HEIGHT - MARGIN_BOTTOM + 6;

  /* Page 1 is the cover: it carries both controls in its headline panel. */
  for (let page = 2; page <= total; page += 1) {
    doc.setPage(page);

    drawWordmark(layout, MARGIN_X, 13, 8.5, false);
    layout.font('regular', 7.5, SUB);
    layout.put(`ESOP pool sizing report · ${model.cover.companyName}`, PAGE_WIDTH - MARGIN_X, 13 - 8.5 * 0.62 * 0.2, {
      align: 'right',
    });
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_X, 16.5, PAGE_WIDTH - MARGIN_X, 16.5);

    doc.line(MARGIN_X, ruleY, PAGE_WIDTH - MARGIN_X, ruleY);
    layout.font('semibold', 7, SUB);
    layout.put(model.controlsFooter, MARGIN_X, ruleY + 4.5);
    layout.font('regular', 7, FAINT);
    layout.put(model.footer, MARGIN_X, ruleY + 8.3);
    layout.put(`${page} of ${total}`, PAGE_WIDTH - MARGIN_X, ruleY + 8.3, { align: 'right' });
  }
}

/* ------------------------------------------------------------------------- *
 * The renderer
 * ------------------------------------------------------------------------- */

/** Render the model to a PDF. */
export function renderReportPdf(
  model: ReportModel,
  captured: ReadonlyMap<string, CapturedChart> = new Map(),
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const layout = new Layout(doc, registerFonts(doc));

  doc.setProperties({
    title: `ESOP pool sizing report — ${model.cover.companyName}`,
    subject: 'ESOP pool sizing',
    author: 'Incentiv',
    creator: 'Incentiv ESOP pool size calculator',
  });

  drawCover(layout, model);
  layout.newPage();

  let number = 0;
  for (const section of model.sections) {
    if (section.id === 'cta') {
      drawClosingPage(layout, section, model);
      continue;
    }

    number += 1;
    drawSection(layout, section, number, captured);
  }

  drawFurniture(layout, model);

  return doc;
}
