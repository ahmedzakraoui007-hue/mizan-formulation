export const SPECIES_OPTIONS = [
  { value: "Volaille", label: "Volaille" },
  { value: "Porc", label: "Porc" },
  { value: "Ruminant", label: "Ruminant" },
  { value: "General", label: "Standard" },
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
  if (k.includes('(mj/kg)') || k.includes('energy (mj)')) return 'MJ/kg';
  if (k.includes("fibre") || k.includes("ms") || k.includes("n degradability ruminants (k=0.06)") || k.includes("om digestibility growing pig") || k.includes("rbv mn ruminants") || k.includes("ndf digestibility ruminants") || k.includes("dm") || k.includes("om digestibility ruminants inra 2018") || k.includes("crude fat") || k.includes("rbv cu poultry")) return "%";
  if (k.includes("fatty acids digestibility ruminants") || k.includes("lignin") || k.includes("n digestibility adult pig") || k.includes("rbv mn pig") || k.includes("n digestibility rabbit") || k.includes("rbv fe poultry") || k.includes("rbv mo ruminants") || k.includes("rbv ca poultry") || k.includes("om digestibility horse") || k.includes("rbv p pig")) return "%";
  if (k.includes("matière sèche") || k.includes("potentially degradable starch (b)") || k.includes("energy digestibility adult pig") || k.includes("starch") || k.includes("starch degradability ruminants inra 2018") || k.includes("rbv p poultry") || k.includes("dry matter") || k.includes("ash") || k.includes("potentially degradable n (b)") || k.includes("n digestibility, intestinal, ruminants")) return "%";
  if (k.includes("crude fibre") || k.includes("rbv cu ruminants") || k.includes("insoluble ash") || k.includes("dm degradability ruminants inra 2018") || k.includes("crude fat digestibility pig") || k.includes("energy digestibility ruminants inra 2018") || k.includes("rumen undegradable protein (diet 50% concentrate) nrc 2001") || k.includes("rbv mn poultry") || k.includes("matière grasse") || k.includes("energy digestibility growing pig")) return "%";
  if (k.includes("cellulose") || k.includes("crude protein") || k.includes("energy digestibility rabbit") || k.includes("amidon") || k.includes("dm degradability ruminants (k=0.06)") || k.includes("ndf") || k.includes("rbv se poultry") || k.includes("sugars") || k.includes("starch, enzymatic method") || k.includes("rbv ca pig")) return "%";
  if (k.includes("rbv p ruminants") || k.includes("starch degradability, ruminants (k=0.06)") || k.includes("rbv i poultry") || k.includes("adl") || k.includes("n digestibility salmonids") || k.includes("energy digestibility horse") || k.includes("rumen undegradable protein (diet 25% concentrate) nrc 2001") || k.includes("rbv cu pig") || k.includes("rbv i ruminants") || k.includes("rbv se ruminants")) return "%";
  if (k.includes("tdn 1x ruminants nrc 2001") || k.includes("rbv ca broilers") || k.includes("immediately degradable dm (a)") || k.includes("n digestibility ileal standardised pig") || k.includes("energy digestibility, salmonids") || k.includes("rbv ca ruminants") || k.includes("cell wall") || k.includes("rbv mg ruminants") || k.includes("total sugars") || k.includes("potentially degradable dm (b)")) return "%";
  if (k.includes("rbv co ruminants") || k.includes("rbv i pig") || k.includes("n degradability ruminants inra 2018") || k.includes("n digestibility ruminants") || k.includes("water insoluble cell walls") || k.includes("adf") || k.includes("om digestibility adult pig") || k.includes("rbv na poultry") || k.includes("n digestibility growing pig") || k.includes("energy digestibility ruminants inra 2007")) return "%";
  if (k.includes("rbv fe pig") || k.includes("sucres") || k.includes("immediately degradable starch (a)") || k.includes("om digestibility ruminants inra 2007") || k.includes("fatty acids") || k.includes("protéine") || k.includes("immediately degradable n (a)")) return "%";
  if (k.includes("me growing pig (kcal)") || k.includes("me rabbit (kcal)") || k.includes("ne meat production ruminants inra 2018 (kcal)") || k.includes("énergie") || k.includes("ne lactation ruminants inra 2018 (kcal)") || k.includes("energy") || k.includes("amen broiler (kcal)") || k.includes("de adult pig (kcal)") || k.includes("me ruminants inra 2007 (kcal)") || k.includes("ems")) return "kcal/kg";
  if (k.includes("me ruminants inra 2018 (kcal)") || k.includes("gross energy (kcal)") || k.includes("amen broiler, ground (kcal)") || k.includes("de salmonids (kcal)") || k.includes("ne adult pig (kcal)") || k.includes("me adult pig (kcal)") || k.includes("de growing pig (kcal)") || k.includes("amen cockerel (kcal)") || k.includes("amen broiler, pelleted (kcal)") || k.includes("amen cockerel, pelleted (kcal)")) return "kcal/kg";
  if (k.includes("de rabbit (kcal)") || k.includes("amen cockerel, ground (kcal)") || k.includes("ne growing pig (kcal)") || k.includes("ame") || k.includes("emc") || k.includes("ne ")) return "kcal/kg";
  if (k.includes("en lactation ruminants gfe") || k.includes("mj") || k.includes("me ruminants inra 2018 (mj)") || k.includes("me ruminants inra 2007 (mj)") || k.includes("cumulative energy demand (non-renewable: fossil+nuclear)") || k.includes("ne growing pig (mj)") || k.includes("de rabbit (mj)") || k.includes("amen cockerel (mj)") || k.includes("ne meat production ruminants inra 2018 (mj)") || k.includes("ne lactation ruminants inra 2018 (mj)")) return "MJ/kg";
  if (k.includes("gross energy (mj)") || k.includes("de adult pig (mj)") || k.includes("de salmonids (mj)") || k.includes("me growing pig (mj)") || k.includes("amen broiler (mj)") || k.includes("de growing pig (mj)") || k.includes("ne adult pig (mj)") || k.includes("me rabbit (mj)") || k.includes("me adult pig (mj)")) return "MJ/kg";
  if (k.includes("c18:1 oleic acid") || k.includes("absorbable ca ruminants") || k.includes("cysteine") || k.includes("rumen protein balance fl1 inra 2018") || k.includes("rumen protein balance fl4 inra 2018") || k.includes("serine, ileal standardised, pig") || k.includes("pdia inra 2007") || k.includes("glycine, ileal standardised, pig") || k.includes("cystine, ileal standardised, pig") || k.includes("cystine")) return "g/kg";
  if (k.includes("glycine, ileal standardized, poultry") || k.includes("isoleucine, ileal standardized, poultry") || k.includes("valine, ileal standardized, poultry") || k.includes("histidine, ileal standardized, poultry") || k.includes("phenylalanine + tyrosine") || k.includes("c18:3 linolenic acid") || k.includes("glutamic acid, ileal standardized, poultry") || k.includes("glutamic acid, ileal standardised, pig") || k.includes("potassium") || k.includes("tryptophan, ileal standardised, pig")) return "g/kg";
  if (k.includes("c20:1 eicosenoic acid") || k.includes("c20:0 arachidic acid") || k.includes("c22:0 behenic acid") || k.includes("pdi inra 2018") || k.includes("proline, ileal standardised, pig") || k.includes("threonine, ileal standardised, pig") || k.includes("digestible p salmonids") || k.includes("dvlys cvb 1991") || k.includes("c6 + c8 + c10 fatty acids") || k.includes("glutamic acid")) return "g/kg";
  if (k.includes("tryptophan, ileal standardized, poultry") || k.includes("chlorine") || k.includes("calcium") || k.includes("rumen protein balance inra 2018") || k.includes("methionine + cystine, ileal standardized, poultry") || k.includes("available p broiler") || k.includes("proline") || k.includes("c22:1 erucic acid") || k.includes("aspartic acid, ileal standardised, pig") || k.includes("c20:5 eicosapentaenoic acid")) return "g/kg";
  if (k.includes("c18:4 stearidonic acid") || k.includes("methionine, ileal standardized, poultry") || k.includes("nxp ruminants gfe") || k.includes("phenylananine + tyrosine, ileal standardised, pig") || k.includes("valine, ileal standardised, pig") || k.includes("serine, ileal standardized, poultry") || k.includes("leucine") || k.includes("phenylalanine + tyrosine, ileal standardized, poultry") || k.includes("c18:2 linoleic acid") || k.includes("c22:5 docosapentaenoic acid")) return "g/kg";
  if (k.includes("methionine + cystine, ileal standardised, pig") || k.includes("serine") || k.includes("c16:0 palmitic acid") || k.includes("lysine") || k.includes("rnb ruminants gfe") || k.includes("sodium") || k.includes("aspartic acid, ileal standardized, poultry") || k.includes("magnesium") || k.includes("threonine") || k.includes("phytate phosphorus")) return "g/kg";
  if (k.includes("c18:0 stearic acid") || k.includes("digestible p pig (with phytase)") || k.includes("pdia fl1 inra 2018") || k.includes("leucine, ileal standardized, poultry") || k.includes("pdi") || k.includes("digestible p pig (no phytase)") || k.includes("c24:0 lignoceric acid") || k.includes("tyrosine") || k.includes("c22:6 docosahexaenoic acid") || k.includes("c16:1 palmitoleic acid")) return "g/kg";
  if (k.includes("pdie inra 2007") || k.includes("phenylalanine") || k.includes("pdin inra 2007") || k.includes("sulfur") || k.includes("pdia fl4 inra 2018") || k.includes("isoleucine, ileal standardised, pig") || k.includes("oeb cvb 1991") || k.includes("absorbable p ruminants") || k.includes("histidine, ileal standardised, pig") || k.includes("alanine")) return "g/kg";
  if (k.includes("histidine") || k.includes("phenylalanine, ileal standardised, pig") || k.includes("methionine") || k.includes("cystine, ileal standardized, poultry") || k.includes("alanine, ileal standardised, pig") || k.includes("proline, ileal standardized, poultry") || k.includes("threonine, ileal standardized, poultry") || k.includes("leucine, ileal standardised, pig") || k.includes("tyrosine, ileal standardized, poultry") || k.includes("arginine, ileal standardized, poultry")) return "g/kg";
  if (k.includes("isoleucine") || k.includes("glycine") || k.includes("phenylalanine, ileal standardized, poultry") || k.includes("available p cockerel") || k.includes("c20:4 arachidonic acid") || k.includes("phosphorus") || k.includes("tryptophan") || k.includes("pdi fl4 inra 2018") || k.includes("valine") || k.includes("arginine, ileal standardised, pig")) return "g/kg";
  if (k.includes("lysine, ileal standardized, poultry") || k.includes("c12:0 lauric acid") || k.includes("dvmet cvb 1991") || k.includes("c14:0 myristic acid") || k.includes("arginine") || k.includes("aspartic acid") || k.includes("pdia inra 2018") || k.includes("alanine, ileal standardized, poultry") || k.includes("lysine, ileal standardised, pig") || k.includes("methionine + cystine")) return "g/kg";
  if (k.includes("digestible crude protein horse") || k.includes("pdi fl1 inra 2018") || k.includes("methionine, ileal standardised, pig") || k.includes("dve cvb 1991") || k.includes("tyrosine, ileal standardised, pig")) return "g/kg";
  if (k.includes("electrolyte balance") || k.includes("dietary cation-anion difference")) return "mEq/kg";
  if (k.includes("selenium") || k.includes("biotin") || k.includes("folic acid") || k.includes("copper") || k.includes("vitamin") || k.includes("cobalt") || k.includes("choline") || k.includes("vitamin b1 thiamin") || k.includes("vitamin b2 riboflavin") || k.includes("iron")) return "mg/kg";
  if (k.includes("zinc") || k.includes("iodine") || k.includes("vitamin c") || k.includes("vitamin e") || k.includes("niacin") || k.includes("xanthophylls") || k.includes("molybdenum") || k.includes("vitamin k") || k.includes("vitamin b6 pyridoxine") || k.includes("manganese")) return "mg/kg";
  if (k.includes("pantothenic acid")) return "mg/kg";
  if (k.includes("vitamin a") || k.includes("vitamin d")) return "1000 IU/kg";
  if (k.includes("vitamin b12")) return "µg/kg";
  if (k.includes("ufl inra 2018") || k.includes("ufv inra 2018") || k.includes("fill unit ruminants inra 2018") || k.includes("ufl fl1 inra 2018") || k.includes("ufv fl1 inra 2018") || k.includes("ufl fl4 inra 2018") || k.includes("ufv fl4 inra 2018") || k.includes("ufl inra 2007") || k.includes("ufv inra 2007") || k.includes("vem cvb 2018")) return "per kg";
  if (k.includes("vevi cvb 2018") || k.includes("horse forage unit")) return "per kg";
  if (k.includes("lysine ruminants inra 2018") || k.includes("threonine ruminants inra 2018") || k.includes("methionine ruminants inra 2018") || k.includes("isoleucine ruminants inra 2018") || k.includes("valine ruminants inra 2018") || k.includes("leucine ruminants inra 2018") || k.includes("phenylalanine ruminants inra 2018") || k.includes("histidine ruminants inra 2018") || k.includes("arginine ruminants inra 2018")) return "% PDI";
  if (k.includes("lysine ruminants inra 2007") || k.includes("threonine ruminants inra 2007") || k.includes("methionine ruminants inra 2007") || k.includes("isoleucine ruminants inra 2007") || k.includes("valine ruminants inra 2007") || k.includes("leucine ruminants inra 2007") || k.includes("phenylalanine ruminants inra 2007") || k.includes("histidine ruminants inra 2007") || k.includes("arginine ruminants inra 2007")) return "% PDIE";
  if (k.includes("de 1x ruminants nrc 2001") || k.includes("ne lactation 3x ruminants nrc 2001") || k.includes("ne lactation 4x ruminants nrc 2001") || k.includes("ne maintenance 3x ruminants nrc 2001") || k.includes("ne gain 3x ruminants nrc 2001")) return "Mcal/kg";
  if (k.includes("phosphorus consumption")) return "g P/kg";
  if (k.includes("climate change (ilcd)")) return "g CO2eq/kg";
  if (k.includes("acidification (ilcd)")) return "mol H+eq/kg";
  if (k.includes("eutrophication (cml baseline)")) return "g PO4---eq/kg";
  if (k.includes("land competition (cml non baseline)")) return "m²yr/kg";
  if (k.includes("degradation rate of particles n (c)") || k.includes("degradation rate of particles dm (c)") || k.includes("degradation rate of particles starch (c)")) return "h-1";
  if (k.includes("phytase activity")) return "IU/kg";
  if (k.includes("viscosity, real applied")) return "mL/g";
  return "";
};

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

  return regex.test(key);
};

// Bidirectional alias map: French/legacy recipe keys ↔ INRAE English keys
const NUTRIENT_ALIAS_MAP: Record<string, string[]> = {
  "Crude protein (%)": ["Protéine %", "Proteine %", "Protein %"],
  "AMEn broiler (kcal) (kcal/kg)": ["Énergie (kcal/kg)", "Energie (kcal/kg)", "Énergie Volaille KCal/Kg", "Énergie KCal/Kg"],
  "ME growing pig (kcal) (kcal/kg)": ["Énergie Porc KCal/Kg"],
  "Crude fibre (%)": ["Fibre %", "Fiber %"],
  "Crude fat (%)": ["Matière Grasse %"],
  "Dry matter (%)": ["Matière Sèche %"],
  "Calcium (g/kg)": ["Calcium %"],
  "Phosphorus (g/kg)": ["Phosphore %", "Phosphorus %"],
  "Magnesium (g/kg)": ["Magnesium %", "Magnésium %"],
  "Sodium (g/kg)": ["Sodium %", "Na %", "Na g/kg"],
  "Chlorine (g/kg)": ["Chlorine %", "Chloride %"],
  "Potassium (g/kg)": ["Potassium %"],
  "Lysine (g/kg)": ["Lysine %"],
  "Lysine, ileal standardized, poultry (g/kg)": ["Lysine Dig. Volaille %"],
  "Methionine (g/kg)": ["Méthionine %", "Methionine %"],
  "Methionine, ileal standardized, poultry (g/kg)": ["Méthionine Dig. Volaille %"],
  "Methionine + cystine (g/kg)": ["M+C %", "cys"],
  "Methionine + cystine, ileal standardized, poultry (g/kg)": ["M+C Dig. Volaille %"],
  "Threonine (g/kg)": ["Thréonine %", "Threonine %"],
  "Threonine, ileal standardized, poultry (g/kg)": ["Thréonine Dig. Volaille %"],
  "Valine (g/kg)": ["Valine %"],
  "Valine, ileal standardized, poultry (g/kg)": ["Valine Dig. Volaille %"],
  "Isoleucine (g/kg)": ["Isoleucine %"],
  "Isoleucine, ileal standardized, poultry (g/kg)": ["Isoleucine Dig. Volaille %"],
  "Arginine (g/kg)": ["Arginine %"],
  "Arginine, ileal standardized, poultry (g/kg)": ["Arginine Dig. Volaille %"],
  "Tryptophan (g/kg)": ["Tryptophan %", "Tryptophane %"],
  "Tryptophan, ileal standardized, poultry (g/kg)": ["Tryptophan Dig. Volaille %"],
  "Leucine (g/kg)": ["Leucine %"],
  "Leucine, ileal standardized, poultry (g/kg)": ["Leucine Dig. Volaille %"],
  "Cystine (g/kg)": ["Cystine %"],
};
const _alias2canonical: Record<string, string> = {};
for (const [canonical, aliases] of Object.entries(NUTRIENT_ALIAS_MAP)) {
  _alias2canonical[canonical] = canonical;
  for (const alias of aliases) _alias2canonical[alias] = canonical;
}
const _findNutrientValue = (
  constraintKey: string, nutrients: Record<string, number>
): [string, number] | null => {
  if (constraintKey in nutrients) return [constraintKey, nutrients[constraintKey]];
  const canonical = _alias2canonical[constraintKey];
  if (canonical && canonical in nutrients) return [constraintKey, nutrients[canonical]];
  for (const alias of (NUTRIENT_ALIAS_MAP[constraintKey] ?? [])) {
    if (alias in nutrients) return [constraintKey, nutrients[alias]];
  }
  return null;
};

/**
 * Returns nutrients to display in reports.
 * Shows ALL nutrients explicitly added to the recipe's nutritional targets list.
 * If no constraints, falls back to species-specific primary nutrients.
 */
export const getTopNutrients = (
  nutrients: Record<string, number>,
  constraints: Record<string, any> = {},
  species: string = "General"
): [string, number][] => {
  if (constraints && Object.keys(constraints).length > 0) {
    // Show ALL nutrients explicitly added to the recipe's nutritional targets list,
    // even if Min/Max/Exact are left blank (the user still wants to track them).
    const recipeConstraintKeys = Object.keys(constraints);
    if (recipeConstraintKeys.length > 0) {
      return recipeConstraintKeys
        .map(k => _findNutrientValue(k, nutrients))
        .filter((v): v is [string, number] => v !== null);
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
  for (const p of speciesPrimary) {
    if (selected.length >= 10) break;
    const match = allKeys.find(k => k.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(k.toLowerCase()));
    if (match && !selected.includes(match)) selected.push(match);
  }
  if (selected.length < 10) {
    for (const k of allKeys) {
      if (selected.length >= 10) break;
      if (!selected.includes(k) && isNutrientSpecificToSpecies(k, species)) selected.push(k);
    }
  }
  return selected.slice(0, 10).map(k => [k, nutrients[k] ?? 0]);
};
