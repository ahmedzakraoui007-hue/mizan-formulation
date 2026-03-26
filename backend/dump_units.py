import json
import os

base_dir = os.path.dirname(os.path.abspath(__file__))
inrae_file = os.path.join(base_dir, "inrae_scraped_data_full.json")

with open(inrae_file, "r", encoding="utf-8") as f:
    data = json.load(f)

# Collect all unique nutrient keys and their units (extracted from parentheses if possible)
units_map = {}
for item in data:
    if "nutrients" in item:
        for k in item["nutrients"].keys():
            # Try to find unit in parentheses
            import re
            match = re.search(r'\(([^)]+)\)$', k)
            unit = match.group(1).strip() if match else ""
            
            # Clean key name
            clean_k = re.sub(r'\s*\([^)]+\)$', '', k).strip().lower()
            
            if clean_k not in units_map or not units_map[clean_k]:
                units_map[clean_k] = unit

# Group by unit
by_unit = {}
for k, u in units_map.items():
    real_u = u if u else "NO_UNIT"
    if real_u not in by_unit:
        by_unit[real_u] = []
    by_unit[real_u].append(k)

# Print a nice summary
for u, keys in by_unit.items():
    print(f"\nUNIT: {u}")
    print(f"{len(keys)} parameters, examples: {', '.join(keys[:10])}")
