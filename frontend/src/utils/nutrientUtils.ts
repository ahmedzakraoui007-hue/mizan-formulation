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
 * Returns true if a nutrient key contains keywords specific to a species.
 * Useful for "ou bien specifique au espece" filtering.
 */
export const isNutrientSpecificToSpecies = (key: string, species: string): boolean => {
  const mapped = mapSpecies(species);
  // Keywords that define positive affinity for a species
  const positiveAffinity: Record<string, RegExp> = {
    Volaille: /poultry|volaille|broiler|cockerel|laying hen|turkey|duck|chicken|ame/i,
    Porc: /pig|porc|pork|swine|sow|piglet/i,
    Ruminant: /ruminant|bovine|bull|cow|calf|sheep|lamb|goat|ufl|ufv|pdi[aeim]|uem|inra 2018/i,
  };
  
  const regex = positiveAffinity[mapped];
  if (!regex) return false;
  return regex.test(key);
};
