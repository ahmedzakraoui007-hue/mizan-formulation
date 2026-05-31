type WhatsAppReport = {
  code?: string | null;
  name: string;
  demand_tons: number;
  cost_tnd: number;
};

export function buildWhatsAppMessage(report: WhatsAppReport, dateStr: string) {
  return [
    `Fiche de fabrication Mizan - ${report.name}`,
    report.code ? `Code formule: ${report.code}` : "",
    `Date: ${dateStr}`,
    `Tonnage produit: ${report.demand_tons} t`,
    `Coût total estimé: ${report.cost_tnd.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} TND`,
    "",
    "Le PDF a été téléchargé depuis Mizan. Merci de le joindre à ce message WhatsApp.",
  ].filter(Boolean).join("\n");
}

export function buildWhatsAppUrl(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
