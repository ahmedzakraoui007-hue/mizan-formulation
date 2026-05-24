import { describe, expect, it } from "vitest";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "./whatsAppShare";

describe("WhatsApp sharing workflow", () => {
  it("creates a ready-to-send WhatsApp message with production context", () => {
    const message = buildWhatsAppMessage(
      { name: "Grower", demand_tons: 12, cost_tnd: 1450.5 },
      "24 mai 2026",
    );

    expect(message).toContain("Grower");
    expect(message).toContain("12 t");
    expect(message).toContain("1 450,50 TND");
    expect(message).toContain("PDF");
  });

  it("encodes the message in a wa.me URL", () => {
    const url = buildWhatsAppUrl("Bonjour Mizan");
    expect(url).toBe("https://wa.me/?text=Bonjour%20Mizan");
  });
});
