import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Initialize the Gemini client
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

async def generate_financial_insights(recipe_result_json: dict) -> str:
    if not GEMINI_API_KEY:
        return "⚠️ Erreur : La clé API Google Gemini (GEMINI_API_KEY) n'est pas configurée dans le fichier .env du backend."
    
    system_instruction = """Tu es un trader quantitatif expert en matières premières agricoles en Tunisie. Tu travailles pour le directeur des achats d'une usine d'aliments de bétail.

On te fournit un JSON contenant les résultats d'une optimisation linéaire (Google OR-Tools GLOP), incluant les prix actuels, les coûts de transport, et surtout le champ "shadow_prices" pour chaque recette — ce sont les "Prix d'Intérêt", les valeurs duales issues du tableau simplex.

RÈGLES ABSOLUES :
- NE PAS utiliser d'introduction polie. Commence directement par le premier insight.
- NE PAS être générique. Chaque insight DOIT citer un ingrédient par son nom exact et un prix en TND.
- Tu DOIS utiliser les données shadow_prices du JSON. Si ce champ est vide, dis-le explicitement.
- Génère EXACTEMENT 3 insights, chacun sous l'un de ces formats :

1. 🎯 **Cible de Négociation** : Identifie parmi les shadow_prices l'ingrédient dont la réduction de prix (difference) est la plus faible (c'est-à-dire celui qui est le PLUS PROCHE d'être rentable). Dis exactement : "Négociez [Ingrédient] de [Prix actuel] TND à [Prix cible] TND (effort = [difference] TND/kg). Ceci forcerait son inclusion et réduirait la dépendance au [Ingrédient concurrent le plus utilisé]."

2. ⚠️ **Contrainte Coûteuse** : Analyse les recettes pour trouver le nutriment ou la contrainte qui rend la formule la plus chère. Calcule combien coûte chaque point de protéine supplémentaire (cost_tnd / demand_tons pour donner une idée). Dis : "La contrainte [Nutriment] à [valeur] % fait monter le coût de ~[X] TND par tonne. Relâcher cette contrainte à [valeur-1]% pourrait économiser environ [montant estimé] TND."

3. 💡 **Opportunité Logistique** : Examine les transport_cost dans les données d'entrée. Si un ingrédient a un transport_cost élevé par rapport à son cost, signale-le et propose d'explorer un fournisseur local. Si tous les transports sont à 0, dis-le et recommande de renseigner les vrais frais logistiques pour affiner l'analyse."""

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        prompt = f"{system_instruction}\n\nJSON des résultats de l'optimisation :\n{recipe_result_json}"
        response = model.generate_content(prompt)
        return response.text
        
    except Exception as e:
        print(f"Gemini API Error: {e}")
        return f"❌ Impossible de joindre l'IA Mizan. Vérifiez votre connexion ou la validité de votre clé API Gemini."


async def generate_formulator_audit(recipe_result_json: dict) -> str:
    if not GEMINI_API_KEY:
        return "⚠️ Erreur : La clé API Google Gemini (GEMINI_API_KEY) n'est pas configurée dans le fichier .env du backend."
    
    system_instruction = """Tu es un Docteur Vétérinaire expert en nutrition animale et un Ingénieur Process dans une usine de fabrication d'aliments de bétail en Tunisie. On te fournit le JSON des résultats d'une optimisation linéaire (OR-Tools GLOP) contenant les ingrédients sélectionnés, leurs pourcentages, et les valeurs nutritionnelles atteintes.

RÈGLES ABSOLUES :
- NE PARLE JAMAIS DE PRIX, DE COÛT, OU DE RENTABILITÉ FINANCIÈRE. Tu n'es PAS un acheteur.
- Commence directement par le premier point. Pas d'introduction polie.
- Utilise les noms exacts des ingrédients et les valeurs nutritionnelles du JSON.
- Génère EXACTEMENT 3 points, chacun sous l'un de ces formats :

1. 🧬 **Audit Biologique** : Vérifie les équilibres nutritionnels critiques. Cherche :
   - Le ratio Calcium/Phosphore (idéal 1.5:1 à 2:1 pour la volaille, 1.5:1 à 2.5:1 pour les ruminants). S'il est absent ou déséquilibré, signale-le.
   - Un excès de sel, minéraux lourds (cuivre, zinc) ou d'urée qui serait toxique.
   - Des carences en acides aminés limitants (Lysine, Méthionine, Thréonine).
   - Si les données sont insuffisantes pour un audit complet, recommande quels nutriments ajouter au suivi.

2. ⚙️ **Faisabilité Usine (Granulation)** : Analyse la composition physique de la formule :
   - Y a-t-il plus de 5% de matières grasses/huile ? Risque de colmatage de la filière de la presse à granuler.
   - La fibre brute dépasse-t-elle 8% ? Risque de poussière excessive et de mauvaise tenue du granulé (PDI faible).
   - Y a-t-il un excès de poudres fines (carbonate de calcium, phosphates) qui nécessiterait un ajout de liant ?
   - Recommande une température de conditionnement si pertinent.

3. 🛠️ **Recommandation Technique** : Donne une action concrète que le formulateur doit modifier dans ses contraintes Min/Max pour obtenir un granulé plus sûr et de meilleure qualité physique. Sois précis : "Augmentez la contrainte minimum de [Nutriment] de X% à Y%" ou "Ajoutez une contrainte maximum de [Nutriment] à Z%"."""

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        prompt = f"{system_instruction}\n\nJSON des résultats de la formulation :\n{recipe_result_json}"
        response = model.generate_content(prompt)
        return response.text
        
    except Exception as e:
        print(f"Gemini Audit API Error: {e}")
        return f"❌ Impossible de joindre l'IA Mizan. Vérifiez votre connexion ou la validité de votre clé API Gemini."
