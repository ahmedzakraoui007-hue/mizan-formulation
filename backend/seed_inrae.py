"""
seed_inrae.py — Inject multi-species INRAE nutritional matrices into the database.

Run from the backend/ directory:
    python seed_inrae.py

Idempotent: deletes any existing ingredient with the same name before re-inserting.
"""

import sys
import os

# ── Make sure local modules resolve whether we run from backend/ or root ──────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine, Base  # noqa: E402
from db_models import IngredientDB              # noqa: E402

# ── Ensure tables exist (safe no-op if already created by FastAPI) ─────────────
Base.metadata.create_all(bind=engine)

# ═══════════════════════════════════════════════════════════════════════════════
#  INRAE nutritional matrices
#  Sources: INRAE-CIRAD-AFZ Feed Tables (2004/2022), Tables de composition INRAE
# ═══════════════════════════════════════════════════════════════════════════════
INRAE_INGREDIENTS = [
    {
        "name": "Maïs INRAE",
        "cost": 0.95,
        "transport_cost": 0.05,
        "dm": 88.0,
        "inventory_limit_tons": 100.0,
        "nutrients": {
            # ── Base (always visible) ──────────────────────────────────────
            "Protéine %":                    8.5,
            "Calcium %":                     0.03,
            "Phosphore %":                   0.28,
            "MS %":                          88.0,
            # ── 🐔 Volaille-specific ──────────────────────────────────────
            "Énergie Volaille KCal/Kg":      3380.0,
            "Lysine Dig. Volaille %":        0.20,
            "Méthionine Dig. Volaille %":    0.17,
            # ── 🐷 Porc-specific ──────────────────────────────────────────
            "Énergie Porc KCal/Kg":          3430.0,
            "Lysine Dig. Porc %":            0.22,
            # ── 🐄 Ruminant-specific ──────────────────────────────────────
            "Énergie Ruminant UFL":          1.05,
            "PDIA Ruminant g/kg":            28.0,
        },
    },
    {
        "name": "Tourteau de Soja 48 INRAE",
        "cost": 1.90,
        "transport_cost": 0.10,
        "dm": 89.0,
        "inventory_limit_tons": 50.0,
        "nutrients": {
            # ── Base ──────────────────────────────────────────────────────
            "Protéine %":                    48.0,
            "Calcium %":                     0.30,
            "Phosphore %":                   0.65,
            "MS %":                          89.0,
            # ── 🐔 Volaille-specific ──────────────────────────────────────
            "Énergie Volaille KCal/Kg":      2440.0,
            "Lysine Dig. Volaille %":        2.81,
            "Méthionine Dig. Volaille %":    0.62,
            # ── 🐷 Porc-specific ──────────────────────────────────────────
            "Énergie Porc KCal/Kg":          2390.0,
            "Lysine Dig. Porc %":            2.72,
            # ── 🐄 Ruminant-specific ──────────────────────────────────────
            "Énergie Ruminant UFL":          0.93,
            "PDIA Ruminant g/kg":            204.0,
        },
    },
    {
        "name": "Blé Tendre INRAE",
        "cost": 1.05,
        "transport_cost": 0.05,
        "dm": 87.0,
        "inventory_limit_tons": 80.0,
        "nutrients": {
            # ── Base ──────────────────────────────────────────────────────
            "Protéine %":                    11.5,
            "Calcium %":                     0.05,
            "Phosphore %":                   0.35,
            "MS %":                          87.0,
            # ── 🐔 Volaille-specific ──────────────────────────────────────
            "Énergie Volaille KCal/Kg":      3120.0,
            "Lysine Dig. Volaille %":        0.27,
            "Méthionine Dig. Volaille %":    0.18,
            # ── 🐷 Porc-specific ──────────────────────────────────────────
            "Énergie Porc KCal/Kg":          3270.0,
            "Lysine Dig. Porc %":            0.29,
            # ── 🐄 Ruminant-specific ──────────────────────────────────────
            "Énergie Ruminant UFL":          0.98,
            "PDIA Ruminant g/kg":            47.0,
        },
    },
]


def seed():
    db = SessionLocal()
    try:
        names = [ing["name"] for ing in INRAE_INGREDIENTS]

        # ── Idempotency: delete existing rows with the same names ─────────────
        existing = db.query(IngredientDB).filter(IngredientDB.name.in_(names)).all()
        if existing:
            print(f"⚠️  Suppression de {len(existing)} ingrédient(s) existant(s) pour ré-insertion propre...")
            for row in existing:
                db.delete(row)
            db.commit()

        # ── Insert fresh rows ─────────────────────────────────────────────────
        for ing_data in INRAE_INGREDIENTS:
            row = IngredientDB(**ing_data)
            db.add(row)
            print(f"   ✅ Ajout : {ing_data['name']}")

        db.commit()
        print("\n🎉 Seed INRAE terminé avec succès !")
        print(f"   {len(INRAE_INGREDIENTS)} ingrédients insérés avec matrices multi-espèces.")
        print("\n   Clés disponibles par espèce :")
        print("   🐔 Volaille : Énergie Volaille KCal/Kg | Lysine Dig. Volaille % | Méthionine Dig. Volaille %")
        print("   🐷 Porc     : Énergie Porc KCal/Kg     | Lysine Dig. Porc %")
        print("   🐄 Ruminant : Énergie Ruminant UFL      | PDIA Ruminant g/kg")
        print("   ♾️  Base     : Protéine %  | Calcium %  | Phosphore %")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Erreur : {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("🌱 Démarrage du seed INRAE Mizan Formulation...")
    seed()
