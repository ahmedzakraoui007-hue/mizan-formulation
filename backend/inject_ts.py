import json
import os
import re

base_dir = os.path.dirname(os.path.abspath(__file__))
inrae_file = os.path.join(base_dir, "inrae_scraped_data_full.json")

with open(inrae_file, "r", encoding="utf-8") as f:
    data = json.load(f)

units_map = {}
for item in data:
    if "nutrients" in item:
        for k in item["nutrients"].keys():
            match = re.search(r'\(([^)]+)\)$', k)
            unit = match.group(1).strip() if match else ""
            clean_k = re.sub(r'\s*\([^)]+\)$', '', k).strip().lower()
            if clean_k not in units_map or not units_map[clean_k]:
                units_map[clean_k] = unit

by_unit = {}
for k, u in units_map.items():
    if not u: continue
    if u not in by_unit:
        by_unit[u] = []
    by_unit[u].append(k)

# Manual overrides
by_unit["%"] = list(set(by_unit.get("%", []) + ["protéine", "fibre", "cellulose", "matière grasse", "amidon", "sucres", "crude protein", "crude fat", "crude fibre", "ash", "starch", "sugars", "ndf", "adf", "adl", "lignin", "cell wall", "dm", "ms", "matière sèche", "dry matter"]))
by_unit["g/kg"] = list(set(by_unit.get("g/kg", []) + ["calcium", "phosphorus", "potassium", "sodium", "chlorine", "sulfur", "magnesium", "lysine", "methionine", "cysteine", "threonine", "tryptophan", "arginine", "valine", "isoleucine", "leucine", "phenylalanine", "histidine", "pdi"]))
by_unit["mg/kg"] = list(set(by_unit.get("mg/kg", []) + ["zinc", "manganese", "copper", "iron", "selenium", "cobalt", "molybdenum", "iodine", "vitamin"]))
by_unit["mEq/kg"] = list(set(by_unit.get("mEq/kg", []) + ["dietary cation-anion difference", "electrolyte balance"]))
by_unit["kcal/kg"] = list(set(by_unit.get("kcal/kg", []) + ["énergie", "energy", "emc", "ems", "ame", "ne "]))
by_unit["MJ/kg"] = list(set(by_unit.get("MJ/kg", []) + ["mj"]))

lines = [
    "export const getNutrientUnit = (key: string): string => {",
    "  const k = key.toLowerCase();",
    "  if (k.includes('(mj/kg)') || k.includes('energy (mj)')) return 'MJ/kg';"
]

for unit, words in by_unit.items():
    if not words: continue
    # Break into chunks of 10
    chunks = [words[i:i+10] for i in range(0, len(words), 10)]
    for chunk in chunks:
        if not chunk: continue
        cond_str = " || ".join([f'k.includes("{w}")' for w in chunk])
        lines.append(f'  if ({cond_str}) return "{unit}";')

lines.append("  return \"\";")
lines.append("};")
new_func_str = "\n".join(lines)

# Inject into nutrientUtils.ts
ts_file = r"c:\Users\user\.gemini\antigravity\playground\holographic-trifid\frontend\src\utils\nutrientUtils.ts"
with open(ts_file, "r", encoding="utf-8") as f:
    content = f.read()

import re
old_func_pattern = re.compile(r'export const getNutrientUnit.*?(?=\nexport const isNutrientSpecificToSpecies)', re.DOTALL)
new_content = old_func_pattern.sub(new_func_str + "\n\n", content)

with open(ts_file, "w", encoding="utf-8") as f:
    f.write(new_content)
    
print("Successfully injected massive dictionary!")

# ALSO inject into user desktop to keep sync
ts_file_2 = r"c:\Users\user\Desktop\miza\frontend\src\utils\nutrientUtils.ts"
if os.path.exists(ts_file_2):
    with open(ts_file_2, "w", encoding="utf-8") as f:
        f.write(new_content)
