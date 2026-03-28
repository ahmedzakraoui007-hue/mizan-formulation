"""
seed_inrae.py — Inject multi-species INRAE nutritional matrices into the database dynamically.

Run from the backend/ directory:
    python seed_inrae.py

Reads from inrae_scraped_data_full.json directly to support dynamic parameters with units.
Idempotent: deletes any existing ingredient with the same name before re-inserting.
"""

import sys
import os
import json

# ── Make sure local modules resolve whether we run from backend/ or root ──────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine, Base  # noqa: E402
from db_models import IngredientDB              # noqa: E402

# ── Ensure tables exist (safe no-op if already created by FastAPI) ─────────────
Base.metadata.create_all(bind=engine)

def seed():
    json_path = os.path.join(os.path.dirname(__file__), "inrae_scraped_data_full.json")
    if not os.path.exists(json_path):
        print(f"❌ Fichier manquant : {json_path}")
        print("Veuillez exécuter scraper_inrae.py en premier.")
        return

    print("📖 Lecture des données JSON...")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    db = SessionLocal()
    try:
        names = [ing["name"] for ing in data]

        # ── Idempotency: delete existing rows with the same names ─────────────
        existing = db.query(IngredientDB).filter(IngredientDB.name.in_(names)).all()
        if existing:
            print(f"⚠️  Suppression de {len(existing)} ingrédient(s) existant(s) pour ré-insertion propre...")
            for row in existing:
                db.delete(row)
            db.commit()

        # ── Insert fresh rows ─────────────────────────────────────────────────
        for ing_data in data:
            nutrients = ing_data.get('nutrients', {})
            dm_val = None
            for key in ["Dry matter (%)", "MS %", "Matière sèche"]:
                if key in nutrients:
                    dm_val = nutrients[key]
                    break
            if dm_val is not None:
                try:
                    ing_data['dm'] = float(dm_val)
                except ValueError:
                    pass
            
            # INRAE is a nutritional database — transport cost is user-configured, not scraped.
            # Reset to 0 so we don't silently add cost to every ingredient.
            ing_data['transport_cost'] = 0.0
            row = IngredientDB(**ing_data)
            db.add(row)
            print(f"   ✅ Ajout : {ing_data['name']} ({len(ing_data.get('nutrients', {}))} paramètres)")

        db.commit()
        print("\n🎉 Seed INRAE dynamique terminé avec succès !")
        print(f"   {len(data)} ingrédients insérés avec leurs unités et données complètes (incluant Ruminants).")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Erreur : {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("🌱 Démarrage du seed INRAE dynamique...")
    seed()
