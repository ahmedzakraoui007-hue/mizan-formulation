import jsPDF from "jspdf";
import { getNutrientUnit, getTopNutrients } from "@/utils/nutrientUtils";

export interface RecipePdfIngredient {
  code?: string | null;
  name: string;
  tons: number;
  percentage: number;
}

export interface RecipePdfReport {
  code?: string | null;
  version_tag?: string | null;
  name: string;
  demand_tons: number;
  raw_tons: number;
  process_yield_percent: number;
  cost_tnd: number;
  bag_size_kg: number;
  cost_per_bag_tnd: number;
  ingredients: RecipePdfIngredient[];
  nutrients: Record<string, number>;
}

export interface RecipePdfOptions {
  originalConstraints?: Record<string, { min?: number; max?: number; exact?: number }>;
  species?: string;
  date?: Date;
}

type Align = "left" | "right" | "center";

interface TableColumn<T> {
  header: string;
  width: number;
  align?: Align;
  value: (row: T) => string;
}

const PAGE = {
  marginX: 14,
  top: 14,
  bottom: 18,
  width: 210,
  height: 297,
};

const contentWidth = PAGE.width - PAGE.marginX * 2;
const contentBottom = PAGE.height - PAGE.bottom;

const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 2,
});

function formatMoney(value: number) {
  return `${moneyFormatter.format(value)} TND`;
}

function formatNumber(value: number, digits = 2) {
  return value.toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fileSafeName(value: string) {
  return value.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
}

export function recipePdfFileName(report: RecipePdfReport, date = new Date()) {
  return `Fiche_Technique_${fileSafeName(report.name)}_${date.toISOString().slice(0, 10)}.pdf`;
}

function wrap(doc: jsPDF, text: string, width: number): string[] {
  const lines = doc.splitTextToSize(text || "", width);
  return Array.isArray(lines) ? lines : [lines];
}

function drawText(doc: jsPDF, text: string, x: number, y: number, options?: { align?: Align; maxWidth?: number }) {
  doc.text(text, x, y, options);
}

function drawPageHeader(doc: jsPDF, report: RecipePdfReport, pageNumber: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(pageNumber === 1 ? 16 : 10);
  doc.setTextColor(15, 23, 42);
  drawText(doc, pageNumber === 1 ? "MIZAN FORMULATION" : `Mizan - ${report.name}`, PAGE.marginX, PAGE.top);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  drawText(doc, "Fiche de fabrication", PAGE.width - PAGE.marginX, PAGE.top, { align: "right" });

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.4);
  doc.line(PAGE.marginX, PAGE.top + 5, PAGE.width - PAGE.marginX, PAGE.top + 5);

  return pageNumber === 1 ? PAGE.top + 16 : PAGE.top + 13;
}

function addPage(doc: jsPDF, report: RecipePdfReport) {
  doc.addPage();
  return drawPageHeader(doc, report, doc.getNumberOfPages());
}

function ensureSpace(doc: jsPDF, report: RecipePdfReport, y: number, needed: number) {
  if (y + needed <= contentBottom) return y;
  return addPage(doc, report);
}

function drawSectionTitle(doc: jsPDF, report: RecipePdfReport, y: number, title: string, color: [number, number, number]) {
  y = ensureSpace(doc, report, y, 14);
  doc.setFillColor(...color);
  doc.rect(PAGE.marginX, y - 4, 1.5, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  drawText(doc, title, PAGE.marginX + 4, y + 1);
  return y + 8;
}

function drawInfoBox(doc: jsPDF, x: number, y: number, width: number, label: string, value: string, color: [number, number, number]) {
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(x, y, width, 22, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  drawText(doc, label.toUpperCase(), x + 3, y + 7, { maxWidth: width - 6 });

  doc.setFontSize(10);
  doc.setTextColor(...color);
  const valueLines = wrap(doc, value, width - 6).slice(0, 2);
  valueLines.forEach((line, index) => drawText(doc, line, x + 3, y + 14 + index * 4));
}

function drawSummary(doc: jsPDF, report: RecipePdfReport, options: RecipePdfOptions, y: number) {
  const date = options.date ?? new Date();
  const dateStr = date.toLocaleDateString("fr-FR");
  const species = options.species || "Generale";

  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(PAGE.marginX, y, contentWidth, 20, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(22, 101, 52);
  drawText(doc, `${report.code ? `${report.code} - ` : ""}${report.name}`, PAGE.marginX + 4, y + 8, { maxWidth: contentWidth - 8 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const versionLabel = report.version_tag ? `    Version: ${report.version_tag}` : "";
  drawText(doc, `Espece: ${species}    Date: ${dateStr}${versionLabel}`, PAGE.marginX + 4, y + 15);
  y += 28;

  const gap = 4;
  const boxWidth = (contentWidth - gap * 3) / 4;
  drawInfoBox(doc, PAGE.marginX, y, boxWidth, "Tonnage final", `${formatNumber(report.demand_tons)} t`, [37, 99, 235]);
  drawInfoBox(doc, PAGE.marginX + (boxWidth + gap), y, boxWidth, "Matieres chargees", `${formatNumber(report.raw_tons)} t`, [13, 148, 136]);
  drawInfoBox(doc, PAGE.marginX + (boxWidth + gap) * 2, y, boxWidth, "Rendement", `${formatNumber(report.process_yield_percent)} %`, [217, 119, 6]);
  drawInfoBox(doc, PAGE.marginX + (boxWidth + gap) * 3, y, boxWidth, "Cout total", formatMoney(report.cost_tnd), [15, 23, 42]);

  return y + 31;
}

function drawTableHeader<T>(doc: jsPDF, columns: TableColumn<T>[], y: number) {
  let x = PAGE.marginX;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.rect(PAGE.marginX, y, contentWidth, 8, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  for (const column of columns) {
    const textX = column.align === "right" ? x + column.width - 2 : x + 2;
    drawText(doc, column.header, textX, y + 5.4, { align: column.align ?? "left", maxWidth: column.width - 4 });
    x += column.width;
  }
  return y + 8;
}

function drawTable<T>(
  doc: jsPDF,
  report: RecipePdfReport,
  rows: T[],
  columns: TableColumn<T>[],
  y: number,
  options?: { totalRowIndex?: number },
) {
  y = drawTableHeader(doc, columns, y);

  rows.forEach((row, rowIndex) => {
    const cells = columns.map((column) => wrap(doc, column.value(row), column.width - 4));
    const maxLines = Math.max(...cells.map((cell) => cell.length));
    const rowHeight = Math.max(7, maxLines * 3.8 + 4);

    if (y + rowHeight > contentBottom) {
      y = addPage(doc, report);
      y = drawTableHeader(doc, columns, y);
    }

    const isTotal = options?.totalRowIndex === rowIndex;
    doc.setFillColor(isTotal ? 226 : rowIndex % 2 === 0 ? 255 : 248, isTotal ? 232 : rowIndex % 2 === 0 ? 255 : 250, isTotal ? 240 : rowIndex % 2 === 0 ? 255 : 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(PAGE.marginX, y, contentWidth, rowHeight, "FD");

    doc.setFont("helvetica", isTotal ? "bold" : "normal");
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);

    let x = PAGE.marginX;
    cells.forEach((lines, columnIndex) => {
      const column = columns[columnIndex];
      const textX = column.align === "right" ? x + column.width - 2 : x + 2;
      lines.forEach((line, lineIndex) => {
        drawText(doc, line, textX, y + 5 + lineIndex * 3.8, { align: column.align ?? "left", maxWidth: column.width - 4 });
      });
      x += column.width;
    });

    y += rowHeight;
  });

  return y + 4;
}

function constraintLabel(constraint?: { min?: number; max?: number; exact?: number }) {
  if (!constraint) return "-";
  if (constraint.exact !== undefined && constraint.exact !== null) return `Exact: ${constraint.exact}`;
  if (constraint.min !== undefined && constraint.min !== null && constraint.max !== undefined && constraint.max !== null) {
    return `${constraint.min} - ${constraint.max}`;
  }
  if (constraint.min !== undefined && constraint.min !== null) return `Min: ${constraint.min}`;
  if (constraint.max !== undefined && constraint.max !== null) return `Max: ${constraint.max}`;
  return "-";
}

function drawCostFooter(doc: jsPDF, report: RecipePdfReport, y: number) {
  y = ensureSpace(doc, report, y, 24);
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(PAGE.marginX, y, contentWidth, 18, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 64, 175);
  drawText(doc, `Cout total: ${formatMoney(report.cost_tnd)}`, PAGE.marginX + 4, y + 7);
  drawText(doc, `Cout par tonne: ${formatMoney(report.cost_tnd / Math.max(report.demand_tons, 0.001))}`, PAGE.marginX + 68, y + 7);
  drawText(doc, `Cout par sac: ${report.cost_per_bag_tnd.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND`, PAGE.marginX + 128, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  drawText(doc, `Sac: ${formatNumber(report.bag_size_kg, 0)} kg`, PAGE.marginX + 4, y + 14);
  return y + 23;
}

function applyFooters(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(PAGE.marginX, PAGE.height - 12, PAGE.width - PAGE.marginX, PAGE.height - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    drawText(doc, "Document genere automatiquement par Mizan Formulation.", PAGE.marginX, PAGE.height - 7);
    drawText(doc, `Page ${page}/${pages}`, PAGE.width - PAGE.marginX, PAGE.height - 7, { align: "right" });
  }
}

export function buildRecipePdf(report: RecipePdfReport, options: RecipePdfOptions = {}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = drawPageHeader(doc, report, 1);
  y = drawSummary(doc, report, options, y);

  const sortedIngredients = [...report.ingredients].sort((a, b) => b.tons - a.tons);
  const ingredientRows = [
    ...sortedIngredients.map((ingredient) => ({
      code: ingredient.code || "-",
      name: ingredient.name,
      inclusion: `${Math.round(ingredient.percentage)} %`,
      kgT: `${Math.round(ingredient.percentage * 10).toLocaleString("fr-FR")} kg`,
      tons: `${formatNumber(ingredient.tons)} t`,
    })),
    {
      code: "",
      name: "TOTAL CHARGES",
      inclusion: "100 %",
      kgT: `${Math.round(report.raw_tons * 1000).toLocaleString("fr-FR")} kg total`,
      tons: `${formatNumber(report.raw_tons)} t`,
    },
  ];

  y = drawSectionTitle(doc, report, y, "1. Composition de la formule", [16, 185, 129]);
  y = drawTable(doc, report, ingredientRows, [
    { header: "Code", width: 24, value: (row) => row.code },
    { header: "Matiere premiere", width: 70, value: (row) => row.name },
    { header: "Inclusion", width: 28, align: "right", value: (row) => row.inclusion },
    { header: "Kg/T", width: 30, align: "right", value: (row) => row.kgT },
    { header: "Quantite", width: 30, align: "right", value: (row) => row.tons },
  ], y, { totalRowIndex: ingredientRows.length - 1 });

  const nutrientRows = getTopNutrients(report.nutrients, options.originalConstraints, options.species || "General")
    .map(([key, value]) => ({
      name: key,
      value: numberFormatter.format(value),
      unit: getNutrientUnit(key) || "-",
      target: constraintLabel(options.originalConstraints?.[key]),
    }));

  y = drawSectionTitle(doc, report, y, "2. Valeurs nutritionnelles atteintes", [249, 115, 22]);
  y = drawTable(doc, report, nutrientRows, [
    { header: "Parametre", width: 76, value: (row) => row.name },
    { header: "Valeur", width: 34, align: "right", value: (row) => row.value },
    { header: "Unite", width: 22, align: "right", value: (row) => row.unit },
    { header: "Cible", width: 50, align: "right", value: (row) => row.target },
  ], y);

  drawCostFooter(doc, report, y);
  applyFooters(doc);
  return doc;
}

export function buildRecipePdfBlob(report: RecipePdfReport, options: RecipePdfOptions = {}) {
  return buildRecipePdf(report, options).output("blob");
}

export function saveRecipePdf(report: RecipePdfReport, options: RecipePdfOptions = {}) {
  buildRecipePdf(report, options).save(recipePdfFileName(report, options.date));
}
