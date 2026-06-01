import { describe, expect, it } from "vitest";
import { buildRecipePdf } from "./recipePdf";

describe("recipe PDF export", () => {
  it("builds a non-empty paginated PDF document", () => {
    const pdf = buildRecipePdf({
      code: "BR-01",
      name: "Broiler Starter",
      demand_tons: 12,
      raw_tons: 12.24,
      process_yield_percent: 98,
      cost_tnd: 1450.5,
      bag_size_kg: 50,
      cost_per_bag_tnd: 6.044,
      ingredients: [
        { code: "MAI", name: "Mais", tons: 7.2, percentage: 60 },
        { code: "SBM", name: "Tourteau soja", tons: 3.6, percentage: 30 },
        { code: "PRE", name: "Premix", tons: 1.2, percentage: 10 },
      ],
      nutrients: {
        protein: 21,
        energy: 2950,
        calcium: 0.95,
      },
    }, {
      originalConstraints: {
        protein: { min: 20 },
        energy: { min: 2900 },
      },
      species: "Poultry",
      date: new Date("2026-05-24"),
    });

    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(pdf.output("arraybuffer").byteLength).toBeGreaterThan(1000);
  });
});
