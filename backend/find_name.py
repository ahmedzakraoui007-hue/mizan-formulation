import json
import os
import sys

base_dir = os.path.dirname(os.path.abspath(__file__))
inrae_file = os.path.join(base_dir, "inrae_scraped_data_full.json")

with open(inrae_file, "r", encoding="utf-8") as f:
    data = json.load(f)

# The user is looking for "Soybean meal, oil < 5%, 48% protein + oil"
# Let's see if there's any ingredient with "soy", "soya", "bean" or 48%
names = [i["name"] for i in data]
matches = [n for n in names if "soj" in n.lower() or "soy" in n.lower() or "48%" in n.lower() or "meal" in n.lower()]
print("Matches:")
for m in matches:
    print(m)
