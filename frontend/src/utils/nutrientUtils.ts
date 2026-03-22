export const SPECIES_OPTIONS = [
  { value: "Volaille", label: "🐔 Volaille" },
  { value: "Porc", label: "🐷 Porc" },
  { value: "Ruminant", label: "🐄 Ruminant" },
  { value: "General", label: "♾️ Standard" },
];

export const SPECIES_REGEX: Record<string, RegExp | null> = {
  Volaille: /pig|porc|pork|swine|sow|piglet|ruminant|bovine|bull|cow|calf|sheep|lamb|goat|horse|rabbit|salmonid|ufl|ufv|pdi[aeim]|uem|inra 2018/i,
  Porc: /poultry|volaille|broiler|cockerel|laying hen|turkey|duck|chicken|ruminant|bovine|bull|cow|calf|sheep|lamb|goat|horse|rabbit|salmonid|ufl|ufv|pdi[aeim]|uem|ame|inra 2018/i,
  Ruminant: /pig|porc|pork|swine|sow|piglet|poultry|volaille|broiler|cockerel|laying hen|turkey|duck|chicken|horse|rabbit|salmonid|ame/i,
  General: null,
};

export const mapSpecies = (species: string): string => {
  if (!species) return "General";
  const s = species.toLowerCase();
  if (s.includes("volaille") || s.includes("poultry") || s.includes("chicken") || s.includes("broiler")) return "Volaille";
  if (s.includes("porc") || s.includes("pig") || s.includes("swine")) return "Porc";
  if (s.includes("ruminant") || s.includes("cow") || s.includes("bovine") || s.includes("sheep")) return "Ruminant";
  return "General";
};

export const getFilteredNutrients = (keys: string[], species: string): string[] => {
  const mapped = mapSpecies(species);
  const regex = SPECIES_REGEX[mapped] ?? null;
  if (!regex) return keys;
  return keys.filter(k => !regex.test(k));
};


/**
 * Returns the unit for a given nutrient key.
 */
export const getNutrientUnit = (key: string): string => {
  const k = key.toLowerCase();
  
  // Explicitly check for MJ first so it doesn't get caught by 'energy' returning kcal/kg
  if (k.includes("(mj/kg)") || k.includes("energy (mj)")) return "MJ/kg";
  
  if (k.includes("énergie") || k.includes("energy") || k.includes("kcal") || k.includes("emc") || k.includes("ems") || k.includes("ame") || k.includes("ne ")) return "kcal/kg";
  if (k.includes("dm") || k.includes("ms") || k.includes("matière sèche") || k.includes("dry matter")) return "%";
  if (k.includes("ufl") || k.includes("ufv")) return "/kg MS";
  if (k.includes("pdi") || k.includes("g/kg")) return "g/kg";
  if (k.includes("%") || k.includes("protéine") || k.includes("fibre") || k.includes("cellulose") || k.includes("matière grasse") || k.includes("amidon") || k.includes("sucres") || k.includes("crude protein") || k.includes("crude fat") || k.includes("crude fibre") || k.includes("ash") || k.includes("starch") || k.includes("sugars") || k.includes("ndf") || k.includes("adf") || k.includes("adl")) return "%";
  if (k.includes("ca ") || k.includes("p ") || k.includes("na ") || k.includes("cl ") || k.includes("lys") || k.includes("met") || k.includes("cys") || k.includes("thr") || k.includes("trp")) return "%";
  if (k.includes("zinc") || k.includes("copper") || k.includes("iron") || k.includes("selenium") || k.includes("molybdenum") || k.includes("iodine") || k.includes("manganese") || k.includes("cobalt")) return "mg/kg";
  return ""; 
};

/**
 * Returns true if a nutrient key contains keywords specific to a species.
 * Useful for "ou bien specifique au espece" filtering.
 */
export const isNutrientSpecificToSpecies = (key: string, species: string): boolean => {
  const mapped = mapSpecies(species);
  
  // Important primary nutrients per species (whitelist)
  const primaryNutrients: Record<string, string[]> = {
    Volaille: ["Protéine %", "EMc Volaille (kcal/kg)", "Lysine %", "Méthionine %", "Calcium %", "Phosphore %", "Amidon %"],
    Porc: ["Protéine %", "EMs Porc (kcal/kg)", "Lysine %", "Thréonine %", "Tryptophane %", "Phosphore %"],
    Ruminant: ["Protéine %", "UFL (par kg MS)", "UFV (par kg MS)", "PDIN (g/kg MS)", "PDIE (g/kg MS)", "Calcium %", "Phosphore %"],
  };

  const whitelist = primaryNutrients[mapped];
  if (whitelist && whitelist.some(w => key.includes(w) || w.includes(key))) return true;

  // Fallback to regex for more general matching
  const positiveAffinity: Record<string, RegExp> = {
    Volaille: /poultry|volaille|broiler|cockerel|laying hen|turkey|duck|chicken|ame/i,
    Porc: /pig|porc|pork|swine|sow|piglet/i,
    Ruminant: /ruminant|bovine|bull|cow|calf|sheep|lamb|goat|ufl|ufv|pdi[aeim]|uem|inra 2018/i,
  };
  
  const regex = positiveAffinity[mapped];
  if (!regex) return false;
  
  // Even if it matches regex, if it's very obscure, we might want to skip.
  return regex.test(key);
};

/**
 * Returns the top 10 most important nutrients for a report.
 * Priority: 1. Recipe Constraints, 2. Species-specific Primary Nutrients.
 */
export const getTopNutrients = (
  nutrients: Record<string, number>,
  constraints: Record<string, any> = {},
  species: string = "General"
): [string, number][] => {
  // Only return targets explicitly requested in constraints that have actual values.
  if (constraints && Object.keys(constraints).length > 0) {
    const validConstraintKeys = Object.keys(constraints).filter(k => {
      const c = constraints[k];
      if (!c) return false;
      return (c.min !== undefined && c.min !== null && c.min !== "") || 
             (c.max !== undefined && c.max !== null && c.max !== "") || 
             (c.exact !== undefined && c.exact !== null && c.exact !== "");
    });

    if (validConstraintKeys.length > 0) {
      return validConstraintKeys
        .filter(k => k in nutrients)
        .map(k => [k, nutrients[k]]);
    }
  }

  const allKeys = Object.keys(nutrients);
  const mapped = mapSpecies(species);
  const primaryNutrients: Record<string, string[]> = {
    Volaille: ["Protéine %", "EMc Volaille (kcal/kg)", "Lysine %", "Méthionine %", "Calcium %", "Phosphore %", "Amidon %", "Cellulose brute %"],
    Porc: ["Protéine %", "EMs Porc (kcal/kg)", "Lysine %", "Thréonine %", "Tryptophane %", "Phosphore %", "Cellulose brute %"],
    Ruminant: ["Protéine %", "UFL (par kg MS)", "UFV (par kg MS)", "PDIN (g/kg MS)", "PDIE (g/kg MS)", "Calcium %", "Phosphore %", "Cellulose brute %"],
  };

  const speciesPrimary = primaryNutrients[mapped] || [];
  
  let selected: string[] = [];
  
  // Fill with species primary until we hit 10
  for (const p of speciesPrimary) {
    if (selected.length >= 10) break;
    const match = allKeys.find(k => k.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(k.toLowerCase()));
    if (match && !selected.includes(match)) {
      selected.push(match);
    }
  }

  // If still under 10, fill with other nutrients that match species regex
  if (selected.length < 10) {
    for (const k of allKeys) {
      if (selected.length >= 10) break;
      if (!selected.includes(k) && isNutrientSpecificToSpecies(k, species)) {
        selected.push(k);
      }
    }
  }

  return selected.slice(0, 10).map(k => [k, nutrients[k] ?? 0]);
};
