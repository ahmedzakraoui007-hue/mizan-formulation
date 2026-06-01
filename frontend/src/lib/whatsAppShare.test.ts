import { describe, expect, it } from "vitest";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "./whatsAppShare";

describe("WhatsApp sharing workflow", () => {
  it("creates a ready-to-send WhatsApp message with production context", () => {
    const message = buildWhatsAppMessage(
      { name: "Grower", demand_tons: 12, cost_tnd: 1450.5 },
      "24 mai 2026",
      { pdfFileName: "fiche-grower.pdf" },
    );

    expect(message).toContain("Grower");
    expect(message).toContain("12 t");
    expect(message).toContain("450,50 TND");
    expect(message).toContain("PDF téléchargé: fiche-grower.pdf");
    expect(message).toContain("joignez ce fichier");
  });

  it("mentions an attached PDF when native sharing supports files", () => {
    const message = buildWhatsAppMessage(
      { name: "Layer", demand_tons: 8, cost_tnd: 900 },
      "24 mai 2026",
      { pdfFileName: "fiche-layer.pdf", pdfAttached: true },
    );

    expect(message).toContain("PDF joint: fiche-layer.pdf");
    expect(message).not.toContain("joignez ce fichier");
  });

  it("encodes the message in a WhatsApp URL", () => {
    const url = buildWhatsAppUrl("Bonjour Mizan");
    expect(url).toBe("https://api.whatsapp.com/send?text=Bonjour%20Mizan");
  });
});
