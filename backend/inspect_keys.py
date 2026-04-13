import json
import logging

def map_keys():
    with open('inrae_scraped_data_full.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    keys = set()
    for item in data:
        nut_keys = list(item.get("nutrients", {}).keys())
        keys.update(nut_keys)
        # Also direct keys if they existed
        for k in item.keys():
            if k not in ["name", "species", "category", "price", "transport_cost", "nutrients"]:
                keys.add(k)
                
    relevant = [k for k in keys if any(x in k.lower() for x in ['protein', 'energy', 'fibre', 'fiber', 'calcium', 'phosphorus', 'lysine', 'methionine', 'threonine', 'fat', 'dry matter'])]
    print("RELEVANT KEYS IN DB:")
    for k in sorted(relevant):
        print(f'"{k}"')

if __name__ == '__main__':
    map_keys()
