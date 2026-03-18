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
  if (k.includes("énergie") || k.includes("energy") || k.includes("kcal") || k.includes("emc") || k.includes("ems")) return "kcal/kg";
  if (k.includes("dm") || k.includes("ms") || k.includes("matière sèche")) return "%";
  if (k.includes("%") || k.includes("protéine") || k.includes("fibre") || k.includes("cellulose") || k.includes("matière grasse") || k.includes("amidon") || k.includes("sucres")) return "%";
  if (k.includes("ca") || k.includes("p ") || k.includes("na ") || k.includes("cl ") || k.includes("lys") || k.includes("met") || k.includes("cys") || k.includes("thr") || k.includes("trp")) return "%";
  return "units"; 
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
  // For now, any match is fine if it's not excluded by SPECIES_REGEX elsewhere.
  return regex.test(key);
};
