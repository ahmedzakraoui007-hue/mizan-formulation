"use client";

import { Sparkles, Save, Scan, Edit3, Trash2, AlertTriangle, BookMarked, Layers, GitMerge, X, FlaskConical, Wheat, Plus, ChevronRight } from "lucide-react";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { getFilteredNutrients, SPECIES_OPTIONS, SPECIES_REGEX, getNutrientUnit } from "@/utils/nutrientUtils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ConstraintConfig {
  min?: number;
  max?: number;
  exact?: number;
}

interface Recipe {
  id: number;
  name: string;
  demand_tons: number;
  process_yield_percent: number;
  bag_size_kg: number;
  constraints: Record<string, ConstraintConfig>;
  parent_id?: number | null;
  version_tag: string;
  species: string;
}

interface RecipeGrouped extends Recipe {
  versions: Recipe[];
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<RecipeGrouped[]>([]);
  // activeVersionId maps a Master Recipe ID to the ID of the version currently selected in the dropdown
  // If activeVersionId[masterId] === masterId, the Master is selected.
  const [activeVersions, setActiveVersions] = useState<Record<number, number>>({});
  const [nutrientColumns, setNutrientCols] = useState<string[]>(["Protéine %", "Fibre %", "Énergie", "Calcium %", "Phosphore %"]);
  const [availableKeys, setAvailableKeys] = useState<string[]>([]);
  const [globalIngredientNames, setGlobalIngredientNames] = useState<string[]>([]);
  const [fetching, setFetching] = useState(true);
  const [aiLoadingFor, setAiLoadingFor] = useState<number | null>(null);
  const [ocrLoadingFor, setOcrLoadingFor] = useState<number | null>(null);
  const [standards, setStandards] = useState<any[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [expandedRecipeId, setExpandedRecipeId] = useState<number | null>(null);

  const fetchRecipes = useCallback(async () => {
    setFetching(true);
    try {
      const [recRes, ingRes, stdRes] = await Promise.all([
        fetch(`${API}/api/recipes`),
        // Use lite=true: only need name & is_active, NOT the full 2MB nutrients payload.
        // The nutrient keys come from the DB nutrients but we only need them for the dropdown.
        // We fetch lite now and separately trigger a full nutrient-keys call.
        fetch(`${API}/api/ingredients?lite=true`),
        fetch(`${API}/api/standards`)
      ]);

      if (stdRes.ok) {
        const stds = await stdRes.json();
        setStandards(stds);
      }

      if (recRes.ok) {
        const recs: RecipeGrouped[] = await recRes.json();
        setRecipes(recs);

        // Initialize active versions to the Master ID
        const initialActive: Record<number, number> = {};
        recs.forEach(r => { initialActive[r.id] = r.id; });
        setActiveVersions(initialActive);

        const colSet = new Set<string>(["Protéine %", "Fibre %", "Énergie", "Calcium %", "Lysine %"]);
        recs.forEach(r => {
          Object.keys(r.constraints).forEach(k => colSet.add(k));
          r.versions.forEach(v => Object.keys(v.constraints).forEach(k => colSet.add(k)));
        });
        setNutrientCols(Array.from(colSet));
      }

      if (ingRes.ok) {
        const ings = await ingRes.json();
        const itemNames = new Set<string>();
        ings.forEach((ing: any) => {
          if (ing.is_active !== false) itemNames.add(ing.name);
        });
        setGlobalIngredientNames(Array.from(itemNames).sort());
      }

      // Fetch available nutrient keys from a dedicated lightweight backend endpoint.
      // The backend already returns full nutrients per ingredient — we query one ingredient
      // to get all possible key names for the recipe dropdown.
      // We do this in a background fetch so the page is usable immediately.
      try {
        // We only need key names. Fetch the first ingredient with full nutrients to build the key list,
        // or better: fetch all ingredients and collect unique keys (cache-friendly with browser).
        const fullRes = await fetch(`${API}/api/ingredients`);
        if (fullRes.ok) {
          const fullIngs = await fullRes.json();
          const keys = new Set<string>();
          fullIngs.forEach((ing: any) => Object.keys(ing.nutrients || {}).forEach((k: string) => keys.add(k)));
          setAvailableKeys(Array.from(keys).sort());
        }
      } catch { /* non-critical */ }

    } catch { /* ignored */ }
    setFetching(false);
  }, []);

  useEffect(() => { fetchRecipes(); }, [fetchRecipes]);

  const saveTimeouts = useRef<Record<number, NodeJS.Timeout>>({});

  const saveToBackend = async (rec: Recipe) => {
    try {
      await fetch(`${API}/api/recipes/${rec.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: rec.name,
          demand_tons: rec.demand_tons,
          process_yield_percent: rec.process_yield_percent,
          bag_size_kg: rec.bag_size_kg,
          constraints: rec.constraints,
          species: rec.species ?? "General",
        }),
      });
    } catch (e) { console.error("Could not save recipe", e); }
  };

  const scheduleSave = (rec: Recipe) => {
    if (saveTimeouts.current[rec.id]) clearTimeout(saveTimeouts.current[rec.id]);
    saveTimeouts.current[rec.id] = setTimeout(() => saveToBackend(rec), 700);
  };

  const editRec = (masterId: number, targetId: number, key: keyof Recipe, v: string | number | null) => {
    setRecipes(prev => {
      const newRecs = prev.map(master => {
        if (master.id !== masterId) return master;

        if (targetId === master.id) {
          // Editing the master
          const updated = { ...master, [key]: v } as unknown as RecipeGrouped;
          scheduleSave(updated);
          return updated;
        } else {
          // Editing a version
          const updatedVersions = master.versions.map(ver =>
            ver.id === targetId ? { ...ver, [key]: v } as unknown as Recipe : ver
          );
          const updatedVersion = updatedVersions.find(v => v.id === targetId)!;
          scheduleSave(updatedVersion);
          return { ...master, versions: updatedVersions };
        }
      });
      return newRecs;
    });
  };

  const editRecNum = (masterId: number, targetId: number, key: keyof Recipe, v: string) =>
    editRec(masterId, targetId, key, parseFloat(v) || 0);

  const editRecConstraint = (masterId: number, targetId: number, nutrKey: string, field: "min" | "max" | "exact", v: string) => {
    setRecipes(prev => {
      const newRecs = prev.map(master => {
        if (master.id !== masterId) return master;

        const updateConstraints = (rec: Recipe) => {
          const val = v === "" ? undefined : (parseFloat(v) || 0);
          const updated = { ...rec.constraints };
          if (!updated[nutrKey]) updated[nutrKey] = {};

          const config = { ...updated[nutrKey] };
          if (val === undefined) delete config[field];
          else config[field] = val;

          if (Object.keys(config).length === 0) delete updated[nutrKey];
          else updated[nutrKey] = config;

          return updated;
        };

        if (targetId === master.id) {
          // Editing master
          const updated = { ...master, constraints: updateConstraints(master) };
          scheduleSave(updated);
          return updated;
        } else {
          // Editing version
          const updatedVersions = master.versions.map(ver =>
            ver.id === targetId ? { ...ver, constraints: updateConstraints(ver) } : ver
          );
          const updatedVersion = updatedVersions.find(v => v.id === targetId)!;
          scheduleSave(updatedVersion);
          return { ...master, versions: updatedVersions };
        }
      });
      return newRecs;
    });
  };

  const removeIngredientFromRecipe = (masterId: number, targetId: number, ingredientKey: string) => {
    // IMPORTANT: do NOT remove from global nutrientColumns — that would hide rows in OTHER recipes.
    // The ingredient/nutrient row is conditionally rendered based on Object.keys(activeItem.constraints),
    // so removing it from constraints is sufficient to hide the row in this recipe.
    setRecipes(prev => {
      const newRecs = prev.map(master => {
        if (master.id !== masterId) return master;
        const removeFromConstraints = (rec: Recipe) => {
          const updated = { ...rec.constraints };
          delete updated[ingredientKey];
          return updated;
        };
        if (targetId === master.id) {
          const updated = { ...master, constraints: removeFromConstraints(master) };
          scheduleSave(updated);
          return updated;
        } else {
          const updatedVersions = master.versions.map(ver =>
            ver.id === targetId ? { ...ver, constraints: removeFromConstraints(ver) } : ver
          );
          const updatedVersion = updatedVersions.find(v => v.id === targetId)!;
          scheduleSave(updatedVersion);
          return { ...master, versions: updatedVersions };
        }
      });
      return newRecs;
    });
  };

  const addRec = async () => {
    try {
      const res = await fetch(`${API}/api/recipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Nouvelle Formule", demand_tons: 10,
          process_yield_percent: 100.0, bag_size_kg: 50.0,
          constraints: {}, species: "General",
        }),
      });
      if (res.ok) {
        const row: RecipeGrouped = await res.json();
        row.versions = []; // Grouped representation
        setRecipes(prev => [...prev, row]);
        setActiveVersions(prev => ({ ...prev, [row.id]: row.id }));
      }
    } catch { /* ignore */ }
  };

  const rmRec = async (masterId: number, targetId: number) => {
    try {
      const res = await fetch(`${API}/api/recipes/${targetId}`, { method: "DELETE" });
      if (!res.ok) {
        const errorText = await res.text();
        alert(`Erreur du serveur lors de la suppression : ${errorText}`);
        return;
      }

      setRecipes(prev => {
        if (masterId === targetId) {
          // Deleted the master recipe, remove the whole group
          return prev.filter(r => r.id !== masterId);
        } else {
          // Deleted a version, keep the master
          return prev.map(m => m.id === masterId ? { ...m, versions: m.versions.filter(v => v.id !== targetId) } : m);
        }
      });

      if (masterId !== targetId) {
        setActiveVersions(prev => ({ ...prev, [masterId]: masterId })); // Reset to master
      }
      setConfirmDeleteId(null);
    } catch (e: any) {
      alert(`Erreur de connexion lors de la suppression : ${e.message}`);
    }
  };

  const askAIForBounds = async (masterId: number, targetId: number, recipeName: string) => {
    setAiLoadingFor(targetId);
    try {
      // 1. Gather all elements currently active in the form (nutrients + manually added ingredient constraints)
      const elementsToAsk = [...nutrientColumns];
      const activeRecipe = recipes.find(r => r.id === masterId)?.versions.find(v => v.id === targetId)
        || recipes.find(r => r.id === masterId);

      if (activeRecipe?.constraints) {
        Object.keys(activeRecipe.constraints).forEach(k => {
          if (!elementsToAsk.includes(k)) elementsToAsk.push(k);
        });
      }

      const res = await fetch(`${API}/api/recipes/suggest-bounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe_name: recipeName, elements: elementsToAsk, species: activeRecipe?.species ?? "Standard" })

      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || "Erreur de l'IA.");
        return;
      }

      const data = await res.json();
      const suggestions = data.suggestions; // The raw JSON from Gemini

      // 2. Patch the constraints deeply
      setRecipes(prev => prev.map(master => {
        if (master.id !== masterId) return master;

        const applySuggestions = (rec: Recipe) => {
          const updatedConstraints = { ...rec.constraints };

          Object.entries(suggestions).forEach(([elementKey, bounds]: [string, any]) => {
            if (bounds.min !== null || bounds.max !== null) {
              if (!updatedConstraints[elementKey]) updatedConstraints[elementKey] = {};
              if (bounds.min !== null) updatedConstraints[elementKey].min = bounds.min;
              if (bounds.max !== null) updatedConstraints[elementKey].max = bounds.max;
            }
          });

          return updatedConstraints;
        };

        if (targetId === master.id) {
          const updated = { ...master, constraints: applySuggestions(master) };
          scheduleSave(updated);
          return updated;
        } else {
          const updatedVersions = master.versions.map(ver =>
            ver.id === targetId ? { ...ver, constraints: applySuggestions(ver) } : ver
          );
          const updatedVersion = updatedVersions.find(v => v.id === targetId)!;
          scheduleSave(updatedVersion);
          return { ...master, versions: updatedVersions };
        }
      }));

      // Force any suggested elements that are not in nutrientColumns to be visible
      setNutrientCols(prev => {
        const newCols = [...prev];
        Object.keys(suggestions).forEach(k => {
          // If the suggested key isn't currently tracked, track it.
          if (!newCols.includes(k) && !globalIngredientNames.includes(k)) {
            newCols.push(k);
          }
        });
        return newCols;
      });

      alert(`✅ L'IA a suggéré des limites pour: ${Object.keys(suggestions).join(', ')}`);

    } catch (e) {
      alert("Impossible de joindre le service IA.");
    } finally {
      setAiLoadingFor(null);
    }
  };

  const applyStandard = (masterId: number, targetId: number, standardId: string) => {
    try {
      const std = standards.find(s => s.id === standardId);
      if (!std) { alert("Standard introuvable !"); return; }

      const newConstraints = JSON.parse(JSON.stringify(std.constraints));

      setRecipes(prev => prev.map(master => {
        if (master.id !== masterId) return master;

        if (targetId === master.id) {
          const updated = { ...master, constraints: newConstraints, species: std.species } as unknown as RecipeGrouped;
          scheduleSave(updated);
          return updated;
        } else {
          const updatedVersions = master.versions.map(ver =>
            ver.id === targetId ? { ...ver, constraints: newConstraints, species: std.species } as unknown as Recipe : ver
          );
          const updatedVersion = updatedVersions.find(v => v.id === targetId)!;
          scheduleSave(updatedVersion);
          return { ...master, versions: updatedVersions };
        }
      }));
      // Make sure new columns are visible
      setNutrientCols(prev => {
        const newCols = [...prev];
        Object.keys(newConstraints).forEach(k => {
          if (!newCols.includes(k) && !globalIngredientNames.includes(k)) newCols.push(k);
        });
        return newCols;
      });
    } catch (e) {
      console.error("Erreur lors de l'application du standard:", e);
    }
  };

  const scanFiche = async (masterId: number, targetId: number, species: string, file: File) => {
    setOcrLoadingFor(targetId);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API}/api/recipes/extract-bounds?species=${encodeURIComponent(species)}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || "Erreur lors du scan.");
        return;
      }

      const data = await res.json();
      const suggestions = data.suggestions;

      setRecipes(prev => prev.map(master => {
        if (master.id !== masterId) return master;

        const applySuggestions = (rec: Recipe) => {
          const updatedConstraints = { ...rec.constraints };
          Object.entries(suggestions).forEach(([elementKey, bounds]: [string, any]) => {
            if (bounds.min !== null || bounds.max !== null) {
              if (!updatedConstraints[elementKey]) updatedConstraints[elementKey] = {};
              if (bounds.min !== null) updatedConstraints[elementKey].min = bounds.min;
              if (bounds.max !== null) updatedConstraints[elementKey].max = bounds.max;
            }
          });
          return updatedConstraints;
        };

        if (targetId === master.id) {
          const updated = { ...master, constraints: applySuggestions(master) };
          scheduleSave(updated);
          return updated;
        } else {
          const updatedVersions = master.versions.map(ver =>
            ver.id === targetId ? { ...ver, constraints: applySuggestions(ver) } : ver
          );
          const updatedVersion = updatedVersions.find(v => v.id === targetId)!;
          scheduleSave(updatedVersion);
          return { ...master, versions: updatedVersions };
        }
      }));

      setNutrientCols(prev => {
        const newCols = [...prev];
        Object.keys(suggestions).forEach(k => {
          if (!newCols.includes(k) && !globalIngredientNames.includes(k)) {
            newCols.push(k);
          }
        });
        return newCols;
      });

      alert(`✅ Scan réussi ! ${Object.keys(suggestions).length} paramètres extraits.`);

    } catch (e) {
      alert("Erreur réseau lors du scan.");
    } finally {
      setOcrLoadingFor(null);
    }
  };

  const createRevision = async (masterId: number, sourceId: number) => {
    const tagName = prompt("Nom de la version (ex: Hiver 2026, Sans Plume, V2...) ?");
    if (!tagName) return;

    try {
      const res = await fetch(`${API}/api/recipes/${sourceId}/revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_tag: tagName }),
      });
      if (res.ok) {
        const row: Recipe = await res.json();
        setRecipes(prev => prev.map(m => m.id === masterId ? { ...m, versions: [...m.versions, row] } : m));
        setActiveVersions(prev => ({ ...prev, [masterId]: row.id }));
      }
    } catch { /* ignore */ }
  };

  const cell = "bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-shadow";
  const label = "text-gray-600 text-[10px] font-bold uppercase tracking-wider mb-1 block";



  // ── Categorise nutrient keys into optgroups ─────────────────────────────────
  type NutrientGroups = Record<string, string[]>;

  const groupNutrientKeys = (keys: string[]): NutrientGroups => {
    const groups: Record<string, string[]> = {
      "Composition Générale": [],
      "Énergie": [],
      "Acides Aminés": [],
      "Vitamines": [],
      "Minéraux": [],
      "Spécifique Volaille": [],
      "Spécifique Porc": [],
      "Spécifique Ruminant": [],
      "Autre": [],
    };

    const is = (k: string, ...terms: string[]) =>
      terms.some(t => k.toLowerCase().includes(t.toLowerCase()));

    for (const k of keys) {
      if (is(k, "volaille", "broiler", "poultry", "chicken", "laying hen", "cockerel", "turkey", "duck")) {
        groups["Spécifique Volaille"].push(k);
      } else if (is(k, "porc", "pig", "swine", "sow", "piglet")) {
        groups["Spécifique Porc"].push(k);
      } else if (is(k, "ruminant", "ufl", "ufv", "pdia", "pdie", "pdim", "uem", "inra 2018", "bovine", "cow", "bull", "calf", "sheep", "lamb", "goat")) {
        groups["Spécifique Ruminant"].push(k);
      } else if (is(k, "energy", "énergie", "nergie", "amei", "ame", "ne ", "neo", "gel", "kcal", "mj/", "eb ", "em ", "en ")) {
        groups["Énergie"].push(k);
      } else if (is(k, "lysine", "methionine", "méthionine", "threonine", "tryptophan", "isoleucine", "leucine", "valine", "arginine", "histidine", "phenylalanine", "cystine", "glycine", "amino", "acide aminé", "lys ", "met ", "thr ", "trp ", "ile ", "leu ", "val ", "arg ", "his ", "phe ", "cys ")) {
        groups["Acides Aminés"].push(k);
      } else if (is(k, "vitamin", "vitamine", "choline", "niacin", "riboflavin", "thiamin", "biotin", "pantothenic", "folic", "cobalamin", "vit ")) {
        groups["Vitamines"].push(k);
      } else if (is(k, "calcium", "phosphor", "sodium", "magnesium", "potassium", "zinc", "copper", "manganese", "iron", "selenium", "iodine", "chloride", "sulfur", "cobalt", "ca ", "p ", "na ", "mg ", "k ", "zn ", "cu ", "mn ", "fe ", "se ", " i ", "cl ", " s ", "co ")) {
        groups["Minéraux"].push(k);
      } else if (is(k, "dry matter", "crude protein", "crude fibre", "crude fat", "ash", "ndf", "adf", "starch", "sugar", "protéine", "fibre", "matière", "ms %", "extractif", "cb ", "mat ", "cel ", "cb %", "ma %", "mg %")) {
        groups["Composition Générale"].push(k);
      } else {
        groups["Autre"].push(k);
      }
    }

    return groups;
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-20 min-h-screen">
        <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-r-blue-600 animate-spin" />
        <span className="ml-3 text-gray-500 text-sm font-medium">Chargement des données ERP…</span>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-50/60 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-50/40 via-transparent to-transparent pointer-events-none" />

      <div className="relative p-10 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24 z-10">
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-[2.5rem] font-black text-slate-900 tracking-tight flex items-center gap-3">
              <BookMarked className="w-9 h-9 text-indigo-500" /> Carnet de Commandes
            </h1>
            <p className="text-slate-500 mt-2 text-lg font-medium tracking-wide">
              Définir les formules maîtresses, leurs révisions, et encadrer la nutrition.
            </p>
          </div>
          <div className="flex gap-4">
            <button onClick={addRec} className="bg-indigo-600 text-white hover:bg-indigo-700 px-6 py-3 rounded-2xl text-sm font-black tracking-wide transition-all shadow-[0_8px_20px_rgba(79,70,229,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(79,70,229,0.4)] flex items-center gap-2">
              <Layers className="w-4 h-4" /> Nouvelle Formule
            </button>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-8 items-start">
          <div className="w-full xl:w-[22rem] flex-shrink-0 flex flex-col gap-3 xl:sticky xl:top-6 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:pr-1" style={{ scrollbarWidth: 'thin' }}>
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.15em] px-2 mb-1">Formules ({recipes.length})</p>
            {recipes.map((listRec, index) => {
              const isActive = (expandedRecipeId === listRec.id) || (expandedRecipeId === null && index === 0);
              const aId = activeVersions[listRec.id] || listRec.id;
              const vTag = aId === listRec.id ? listRec.version_tag : listRec.versions.find(v => v.id === aId)?.version_tag;
              const constraintCount = Object.keys(listRec.constraints).length;
              return (
                <div key={listRec.id}
                  onClick={() => setExpandedRecipeId(listRec.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 ${isActive ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/25 scale-[1.02]' : 'bg-white/70 backdrop-blur-xl hover:bg-white border-slate-100 hover:border-slate-200 text-slate-800 shadow-sm hover:shadow-md'}`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`font-black text-[15px] leading-tight ${isActive ? 'text-white' : 'text-slate-900'} line-clamp-1 flex-1`}>{listRec.name}</h3>
                    <ChevronRight className={`w-4 h-4 flex-shrink-0 ml-2 transition-transform ${isActive ? 'text-indigo-200 translate-x-0.5' : 'text-slate-300'}`} />
                  </div>
                  <div className="flex items-center gap-2 mt-2.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isActive ? 'bg-indigo-500/40 text-indigo-100' : 'bg-slate-100 border border-slate-200/60 text-slate-500'}`}>{vTag || "Master"}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${isActive ? 'bg-indigo-500/40 text-indigo-100' : 'bg-slate-100 border border-slate-200/60 text-slate-500'}`}>{listRec.species || "General"}</span>
                    <span className={`ml-auto text-xs font-black tabular-nums ${isActive ? 'text-indigo-200' : 'text-slate-500'}`}>{listRec.demand_tons}t</span>
                    {constraintCount > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>{constraintCount}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex-1 w-full min-w-0">
            {(() => {
              const selectedMasterId = expandedRecipeId === null && recipes.length > 0 ? recipes[0].id : expandedRecipeId;
              const masterRec = recipes.find(r => r.id === selectedMasterId);
              if (!masterRec) return <div className="text-center p-10 text-slate-500 font-medium bg-white/50 backdrop-blur-3xl rounded-[2rem] border border-white">Aucune formule disponible.</div>;

              const activeId = activeVersions[masterRec.id] || masterRec.id;
              const isMasterActive = activeId === masterRec.id;
              const activeItem = isMasterActive ? masterRec : masterRec.versions.find(v => v.id === activeId)!;
              const isExpanded = true;

              return (
                <div key={masterRec.id} className={`bg-white/70 backdrop-blur-3xl border rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative group transition-all duration-300 ${!isMasterActive ? 'border-indigo-400/50 bg-indigo-50/20 shadow-[0_8px_40px_rgba(79,70,229,0.08)]' : 'border-white'}`}>

                  {/* Card Header & Controls */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex-1 w-full">
                      <div className="flex items-center justify-between mb-3">
                        <input type="text" value={masterRec.name} onChange={e => editRec(masterRec.id, masterRec.id, "name", e.target.value)}
                          className="text-slate-900 font-black text-2xl bg-transparent border-b-2 border-transparent hover:border-slate-200 outline-none w-2/3 focus:border-indigo-500 rounded-none px-1 pb-1 transition-colors tracking-tight" />

                        <div className="flex items-center gap-2">
                          {/* Espèce Cible segmented control */}
                          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
                            {SPECIES_OPTIONS.map(opt => {
                              const isActive = (activeItem.species ?? "General") === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  onClick={() => editRec(masterRec.id, activeItem.id, "species", opt.value)}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${isActive
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-400 hover:text-gray-700"
                                    }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                          <select value={activeId} onChange={e => setActiveVersions(prev => ({ ...prev, [masterRec.id]: parseInt(e.target.value) }))}
                            className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-lg outline-none cursor-pointer">
                            <option value={masterRec.id}>● {masterRec.version_tag} (Master)</option>
                            {masterRec.versions.map(v => (
                              <option key={v.id} value={v.id}>  {v.version_tag}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Actions Row */}
                      <div className="flex items-center gap-2 flex-wrap">

                        <select
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                              applyStandard(masterRec.id, activeItem.id, val);
                              setTimeout(() => { e.target.value = ""; }, 10);
                            }
                          }}
                          className="text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg cursor-pointer text-xs font-bold shadow-sm outline-none"
                        >
                          <option value="">Appliquer une Norme</option>
                          {standards.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>

                        <button onClick={() => askAIForBounds(masterRec.id, activeItem.id, activeItem.name)} disabled={aiLoadingFor === activeItem.id}
                          className="text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg cursor-pointer text-xs font-bold flex items-center shadow-sm disabled:opacity-50">
                          {aiLoadingFor === activeItem.id ? "Analyse IA..." : <><Sparkles className="w-3.5 h-3.5 mr-1" /> Best Practices</>}
                        </button>

                        <div className="relative">
                          <button
                            onClick={() => document.getElementById(`file-upload-${activeItem.id}`)?.click()}
                            disabled={ocrLoadingFor === activeItem.id}
                            className="text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg cursor-pointer text-xs font-bold flex items-center shadow-sm disabled:opacity-50"
                          >
                            {ocrLoadingFor === activeItem.id ? "Scan en cours..." : <><Scan className="w-3.5 h-3.5 mr-1" /> Scanner Fiche</>}
                          </button>
                          <input
                            id={`file-upload-${activeItem.id}`}
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) scanFiche(masterRec.id, activeItem.id, activeItem.species || "General", file);
                              e.target.value = ''; // Reset file input to allow re-uploading the same file
                            }}
                          />
                        </div>

                        <button onClick={() => createRevision(masterRec.id, activeItem.id)} title="Nouvelle Version"
                          className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg cursor-pointer text-xs font-bold flex items-center gap-1 shadow-sm">
                          <Save className="w-3.5 h-3.5" /> Révision
                        </button>
                        {!isMasterActive && (
                          <button onClick={() => { editRec(masterRec.id, activeItem.id, "version_tag", prompt("Nouveau nom de version ?", activeItem.version_tag) || activeItem.version_tag); }}
                            className="text-gray-500 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg cursor-pointer text-xs font-bold flex items-center shadow-sm">
                            <Edit3 className="w-3.5 h-3.5 mr-1" /> Renommer
                          </button>
                        )}

                        {confirmDeleteId === activeItem.id ? (
                          <button onClick={() => rmRec(masterRec.id, activeItem.id)}
                            className="ml-auto text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg cursor-pointer text-xs font-bold flex items-center shadow-md animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Confirmer suppression
                          </button>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(activeItem.id)}
                            className="ml-auto text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-100 px-3 py-1.5 rounded-lg cursor-pointer text-xs font-bold flex items-center shadow-sm">
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Supprimer
                          </button>
                        )}

                      </div>
                    </div>
                  </div>

                  {/* Global params (BOUND TO activeItem) */}
                  <div className="grid grid-cols-3 gap-4 mb-8 bg-slate-50/80 p-5 rounded-2xl border border-slate-100">
                    <div>
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.15em] mb-1.5 block">Tonnage (t)</label>
                      <input type="number" step="1" value={activeItem.demand_tons} onChange={e => editRecNum(masterRec.id, activeItem.id, "demand_tons", e.target.value)}
                        className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-800 text-right focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.15em] mb-1.5 block">Rendement (%)</label>
                      <input type="number" step="0.5" value={activeItem.process_yield_percent} onChange={e => editRecNum(masterRec.id, activeItem.id, "process_yield_percent", e.target.value)}
                        className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-800 text-right focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" />
                    </div>
                    <div>
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.15em] mb-1.5 block">Sac (kg)</label>
                      <input type="number" step="1" value={activeItem.bag_size_kg} onChange={e => editRecNum(masterRec.id, activeItem.id, "bag_size_kg", e.target.value)}
                        className="w-full py-2.5 px-3 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-800 text-right focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" />
                    </div>
                  </div>

                  {/* Expand Toggle Button Removed for Master-Detail View */}

                  {/* UI Segregation logic */}
                  {isExpanded && (() => {
                    const activeNutritionalCols = nutrientColumns.filter(c => !globalIngredientNames.includes(c));
                    const activeIngredientCols = nutrientColumns.filter(c => globalIngredientNames.includes(c));

                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* CARD 1: Cibles Nutritionnelles */}
                        <div className="border border-slate-200/80 bg-white/60 backdrop-blur-xl rounded-2xl overflow-hidden shadow-sm flex flex-col">
                          <div className="bg-slate-50/80 border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
                            <h3 className="text-slate-800 font-black text-sm tracking-tight flex items-center gap-2">
                              <FlaskConical className="w-4 h-4 text-blue-500" /> Cibles Nutritionnelles
                            </h3>
                          </div>
                          <div className="overflow-x-auto p-4 flex flex-col">
                            <table className="w-full text-left text-sm mb-3">
                              <thead>
                                <tr className="text-slate-500 text-[10px] uppercase tracking-[0.12em] font-extrabold border-b border-slate-100">
                                  <th className="pb-3 w-1/3">Nutriment</th>
                                  <th className="pb-3 w-20 text-right pr-2">Min</th>
                                  <th className="pb-3 w-20 text-right pr-2">Max</th>
                                  <th className="pb-3 w-24 text-right text-amber-600">Exact</th>
                                  <th className="pb-3 w-8"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-blue-50/50">
                                {activeNutritionalCols.length === 0 && (
                                  <tr><td colSpan={5} className="text-center py-4 text-xs text-blue-400 font-medium italic">Aucune cible définie...</td></tr>
                                )}
                                {/* Only show rows that are in THIS recipe's constraints */}
                                {Object.keys(activeItem.constraints).filter(nc => !globalIngredientNames.includes(nc)).map(nc => (
                                  <tr key={nc} className="group/row hover:bg-slate-50/80 transition-colors">
                                    <td className="py-2.5 text-slate-800 font-semibold text-[13px]">
                                      {nc}
                                      {getNutrientUnit(nc) && <span className="ml-1.5 text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{getNutrientUnit(nc)}</span>}
                                    </td>
                                    <td className="py-2.5 pr-2">
                                      <input type="number" step="0.1" placeholder="—" value={activeItem.constraints?.[nc]?.min ?? ""} onChange={e => editRecConstraint(masterRec.id, activeItem.id, nc, "min", e.target.value)} className={`${cell} w-full text-right bg-transparent group-hover/row:bg-white border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100`} />
                                    </td>
                                    <td className="py-2.5 pr-2">
                                      <input type="number" step="0.1" placeholder="—" value={activeItem.constraints?.[nc]?.max ?? ""} onChange={e => editRecConstraint(masterRec.id, activeItem.id, nc, "max", e.target.value)} className={`${cell} w-full text-right bg-transparent group-hover/row:bg-white border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100`} />
                                    </td>
                                    <td className="py-2.5">
                                      <input type="number" step="0.1" placeholder="—" value={activeItem.constraints?.[nc]?.exact ?? ""} onChange={e => editRecConstraint(masterRec.id, activeItem.id, nc, "exact", e.target.value)} className={`${cell} w-full text-right bg-transparent group-hover/row:bg-white border-slate-200 ${activeItem.constraints?.[nc]?.exact !== undefined ? "font-bold text-amber-700 !bg-amber-50 border-amber-300" : ""} focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100`} />
                                    </td>
                                    <td className="py-2.5 pl-1">
                                      <button
                                        onClick={() => removeIngredientFromRecipe(masterRec.id, activeItem.id, nc)}
                                        title="Retirer cette cible"
                                        className="opacity-0 group-hover/row:opacity-100 transition-all text-slate-300 hover:text-white hover:bg-red-500 w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            {/* Smart Add Nutritional Target Dropdown */}
                            <div className="mt-2">
                              <select
                                key={`nutrient-dropdown-${masterRec.id}-${activeItem.species}`}
                                value=""
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (!val) return;
                                  // Add to global nutrientColumns so the row renders
                                  if (!nutrientColumns.includes(val)) setNutrientCols(prev => [...prev, val]);
                                  // Inject empty constraint into the active recipe
                                  setRecipes(prev => prev.map(master => {
                                    if (master.id !== masterRec.id) return master;
                                    const inject = (rec: Recipe): Recipe => ({
                                      ...rec,
                                      constraints: rec.constraints[val]
                                        ? rec.constraints
                                        : { ...rec.constraints, [val]: {} }
                                    });
                                    if (activeItem.id === master.id) {
                                      const updated = inject(master) as RecipeGrouped;
                                      scheduleSave(updated);
                                      return updated;
                                    } else {
                                      const updatedVersions = master.versions.map(ver =>
                                        ver.id === activeItem.id ? inject(ver) : ver
                                      );
                                      const updatedVersion = updatedVersions.find(v => v.id === activeItem.id)!;
                                      scheduleSave(updatedVersion);
                                      return { ...master, versions: updatedVersions };
                                    }
                                  }));
                                }}
                                className="w-full bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/30 px-3 py-2.5 rounded-xl text-xs font-bold transition-all outline-none cursor-pointer"
                              >
                                <option value="" disabled>+ Ajouter une cible nutritionnelle...</option>
                                {Object.entries(
                                  groupNutrientKeys(
                                    getFilteredNutrients(
                                      availableKeys.filter(k =>
                                        !globalIngredientNames.includes(k) &&
                                        !Object.keys(activeItem.constraints).includes(k)
                                      ),
                                      activeItem.species ?? "General"
                                    )
                                  )
                                ).map(([group, keys]) => {
                                  if (keys.length === 0) return null;

                                  // Final check: Hide WRONG species groups entirely
                                  const s = (activeItem.species ?? "General").toLowerCase();
                                  const isVol = s.includes("volaille") || s.includes("poultry") || s.includes("chicken") || s.includes("broiler");
                                  const isPorc = s.includes("porc") || s.includes("pig") || s.includes("swine");
                                  const isRum = s.includes("ruminant") || s.includes("cow") || s.includes("bovine");

                                  if (isVol && (group.toLowerCase().includes("porc") || group.toLowerCase().includes("ruminant"))) return null;
                                  if (isPorc && (group.toLowerCase().includes("volaille") || group.toLowerCase().includes("ruminant"))) return null;
                                  if (isRum && (group.toLowerCase().includes("volaille") || group.toLowerCase().includes("porc"))) return null;

                                  return (
                                    <optgroup key={group} label={group}>
                                      {keys.map(k => (
                                        <option key={k} value={k}>{k}</option>
                                      ))}
                                    </optgroup>
                                  );
                                })}
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* CARD 2: Matières Premières */}
                        <div className="border border-slate-200/80 bg-white/60 backdrop-blur-xl rounded-2xl overflow-hidden shadow-sm flex flex-col">
                          <div className="bg-slate-50/80 border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
                            <h3 className="text-slate-800 font-black text-sm tracking-tight flex items-center gap-2">
                              <Wheat className="w-4 h-4 text-emerald-500" /> Matières Premières (Limites)
                            </h3>
                          </div>
                          <div className="overflow-x-auto p-4 flex flex-col pt-2">
                            <table className="w-full text-left text-sm mb-3">
                              <thead>
                                <tr className="text-slate-500 text-[10px] uppercase tracking-[0.12em] font-extrabold border-b border-slate-100">
                                  <th className="pb-3 w-1/3">Ingrédient</th>
                                  <th className="pb-3 w-20 text-right pr-2">Min %</th>
                                  <th className="pb-3 w-20 text-right pr-2">Max %</th>
                                  <th className="pb-3 w-24 text-right text-emerald-600">Exact %</th>
                                  <th className="pb-3 w-8"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-emerald-50/50">
                                {Object.keys(activeItem.constraints).filter(nc => globalIngredientNames.includes(nc)).length === 0 && (
                                  <tr><td colSpan={5} className="text-center py-4 text-xs text-emerald-600/60 font-medium italic">Aucune limite d'incorporation...</td></tr>
                                )}
                                {Object.keys(activeItem.constraints).filter(nc => globalIngredientNames.includes(nc)).map(nc => (
                                  <tr key={nc} className="group/row hover:bg-slate-50/80 transition-colors">
                                    <td className="py-2.5 text-slate-800 font-semibold text-[13px]">
                                      {nc}
                                      <span className="ml-1.5 text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">%</span>
                                    </td>
                                    <td className="py-2.5 pr-2">
                                      <input type="number" step="0.1" placeholder="—" value={activeItem.constraints?.[nc]?.min ?? ""} onChange={e => editRecConstraint(masterRec.id, activeItem.id, nc, "min", e.target.value)} className={`${cell} w-full text-right bg-transparent group-hover/row:bg-white border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100`} />
                                    </td>
                                    <td className="py-2.5 pr-2">
                                      <input type="number" step="0.1" placeholder="—" value={activeItem.constraints?.[nc]?.max ?? ""} onChange={e => editRecConstraint(masterRec.id, activeItem.id, nc, "max", e.target.value)} className={`${cell} w-full text-right bg-transparent group-hover/row:bg-white border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100`} />
                                    </td>
                                    <td className="py-2.5">
                                      <input type="number" step="0.1" placeholder="—" value={activeItem.constraints?.[nc]?.exact ?? ""} onChange={e => editRecConstraint(masterRec.id, activeItem.id, nc, "exact", e.target.value)} className={`${cell} w-full text-right bg-transparent group-hover/row:bg-white border-slate-200 ${activeItem.constraints?.[nc]?.exact !== undefined ? "font-bold text-emerald-800 !bg-emerald-50 border-emerald-400" : ""} focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100`} />
                                    </td>
                                    <td className="py-2.5 pl-1">
                                      <button
                                        onClick={() => removeIngredientFromRecipe(masterRec.id, activeItem.id, nc)}
                                        title="Retirer cet ingrédient"
                                        className="opacity-0 group-hover/row:opacity-100 transition-all text-slate-300 hover:text-white hover:bg-red-500 w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            {/* Smart Add Ingredient Dropdown — filtered per recipe */}
                            <div className="mt-2">
                              <select
                                value=""
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (!val) return;
                                  // Add to nutrientColumns so the row renders
                                  if (!nutrientColumns.includes(val)) setNutrientCols(prev => [...prev, val]);
                                  // Immediately inject empty constraint so the row appears even without column
                                  setRecipes(prev => prev.map(master => {
                                    if (master.id !== masterRec.id) return master;
                                    const inject = (rec: Recipe): Recipe => ({
                                      ...rec,
                                      constraints: rec.constraints[val]
                                        ? rec.constraints
                                        : { ...rec.constraints, [val]: {} }
                                    });
                                    if (activeItem.id === master.id) {
                                      const updated = inject(master) as RecipeGrouped;
                                      scheduleSave(updated);
                                      return updated;
                                    } else {
                                      const updatedVersions = master.versions.map(ver =>
                                        ver.id === activeItem.id ? inject(ver) : ver
                                      );
                                      const updatedVersion = updatedVersions.find(v => v.id === activeItem.id)!;
                                      scheduleSave(updatedVersion);
                                      return { ...master, versions: updatedVersions };
                                    }
                                  }));
                                }}
                                className="w-full bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/30 px-3 py-2.5 rounded-xl text-xs font-bold transition-all outline-none cursor-pointer"
                              >
                                <option value="" disabled>+ Ajouter une matière première...</option>
                                {globalIngredientNames
                                  .filter(k => !Object.keys(activeItem.constraints).includes(k))
                                  .map(k => (
                                    <option key={k} value={k}>{k}</option>
                                  ))}
                              </select>
                            </div>
                          </div>
                        </div>

                      </div>
                    );
                  })()}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
