import requests

res = requests.get('https://mizan-api.onrender.com/api/ingredients')
data = res.json()
print("Total ingredients:", len(data))

valid_count = sum(1 for ing in data if len(ing.get("nutrients", {})) >= 5)
small_count = sum(1 for ing in data if len(ing.get("nutrients", {})) < 5)

print(f"Ingredients with >= 5 nutrients: {valid_count}")
print(f"Ingredients with < 5 nutrients (likely wiped): {small_count}")

small_names = [ing["name"] for ing in data if len(ing.get("nutrients", {})) < 5]
print("Some wiped ingredients:", small_names[:10])
