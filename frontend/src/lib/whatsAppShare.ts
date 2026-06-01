type WhatsAppReport = {
  code?: string | null;
  name: string;
  demand_tons: number;
  cost_tnd: number;
};

interface WhatsAppMessageOptions {
  pdfFileName?: string;
  pdfAttached?: boolean;
}

export function buildWhatsAppMessage(report: WhatsAppReport, dateStr: string, options: WhatsAppMessageOptions = {}) {
  const pdfLine = options.pdfAttached
    ? `PDF joint: ${options.pdfFileName || "fiche technique Mizan"}`
    : `PDF téléchargé: ${options.pdfFileName || "fiche technique Mizan"}. Sur WhatsApp Web, joignez ce fichier au message.`;

  return [
    `Fiche de fabrication Mizan - ${report.name}`,
    report.code ? `Code formule: ${report.code}` : "",
    `Date: ${dateStr}`,
    `Tonnage produit: ${report.demand_tons} t`,
    `Coût total estimé: ${report.cost_tnd.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} TND`,
    "",
    pdfLine,
  ].filter(Boolean).join("\n");
}

export function buildWhatsAppUrl(message: string) {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}
