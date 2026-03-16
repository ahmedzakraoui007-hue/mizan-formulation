"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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

  const fetchRecipes = useCallback(async () => {
    setFetching(true);
    try {
      const [recRes, ingRes] = await Promise.all([
        fetch(`${API}/api/recipes`),
        fetch(`${API}/api/ingredients`)
      ]);
      
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
        const keys = new Set<string>();
        const itemNames = new Set<string>();
        ings.forEach((ing: any) => {
          if (ing.is_active !== false) {
            itemNames.add(ing.name);
          }
          // Only actual nutrients or special keys, NOT ingredient names
          Object.keys(ing.nutrients || {}).forEach(k => keys.add(k));
        });
        setAvailableKeys(Array.from(keys).sort());
        setGlobalIngredientNames(Array.from(itemNames).sort());
      }

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
    // Remove from nutrientColumns so the row disappears from the table
    setNutrientCols(prev => prev.filter(c => c !== ingredientKey));
    // Also deep-remove from constraints state and schedule a save
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
          constraints: {},
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
      await fetch(`${API}/api/recipes/${targetId}`, { method: "DELETE" });
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
    } catch { /* ignore */ }
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

  // ── Species-aware nutrient key filter ──────────────────────────────────
  const SPECIES_OPTIONS = [
    { value: "Volaille",  label: "🐔 Volaille" },
    { value: "Porc",     label: "🐷 Porc" },
    { value: "Ruminant", label: "🐄 Ruminant" },
    { value: "General",  label: "♾️ Standard" },
  ];

  const SPECIES_REGEX: Record<string, RegExp | null> = {
    Volaille: /pig|porc|pork|swine|sow|piglet|ruminant|bovine|bull|cow|calf|sheep|lamb|goat|horse|rabbit|salmonid|ufl|ufv|pdi[aeim]|uem/i,
    Porc: /poultry|volaille|broiler|cockerel|laying hen|turkey|duck|chicken|ruminant|bovine|bull|cow|calf|sheep|lamb|goat|horse|rabbit|salmonid|ufl|ufv|pdi[aeim]|uem|ame/i,
    Ruminant: /pig|porc|pork|swine|sow|piglet|poultry|volaille|broiler|cockerel|laying hen|turkey|duck|chicken|horse|rabbit|salmonid|ame/i,
    General: null,
  };

  const getFilteredNutrients = (keys: string[], species: string): string[] => {
    if (!species) return keys;
    const s = species.toLowerCase();
    let mapped = "General";
    if (s.includes("volaille") || s.includes("poultry") || s.includes("chicken") || s.includes("broiler")) mapped = "Volaille";
    else if (s.includes("porc") || s.includes("pig") || s.includes("swine")) mapped = "Porc";
    else if (s.includes("ruminant") || s.includes("cow") || s.includes("bovine") || s.includes("sheep")) mapped = "Ruminant";
    
    const regex = SPECIES_REGEX[mapped] ?? null;
    if (!regex) return keys;
    return keys.filter(k => !regex.test(k));
  };

  // ── Categorise nutrient keys into optgroups ─────────────────────────────────
  type NutrientGroups = Record<string, string[]>;

  const groupNutrientKeys = (keys: string[]): NutrientGroups => {
    const groups: NutrientGroups = {
      "⚗️ Composition Générale": [],
      "🧂 Minéraux": [],
      "💊 Vitamines": [],
      "🔗 Acides Aminés": [],
      "⚡ Énergie": [],
      "🐔 Spécifique Volaille": [],
      "🐷 Spécifique Porc": [],
      "🐄 Spécifique Ruminant": [],
      "📊 Autre": [],
    };

    const is = (k: string, ...terms: string[]) =>
      terms.some(t => k.toLowerCase().includes(t.toLowerCase()));

    for (const k of keys) {
      if (is(k, "volaille", "broiler", "poultry", "chicken", "laying hen", "cockerel", "turkey", "duck")) {
        groups["🐔 Spécifique Volaille"].push(k);
      } else if (is(k, "porc", "pig", "swine", "sow", "piglet")) {
        groups["🐷 Spécifique Porc"].push(k);
      } else if (is(k, "ruminant", "ufl", "ufv", "pdia", "pdie", "pdim", "uem", "inra 2018", "bovine", "cow", "bull", "calf", "sheep", "lamb", "goat")) {
        groups["🐄 Spécifique Ruminant"].push(k);
      } else if (is(k, "energy", "énergie", "nergie", "amei", "ame", "ne ", "neo", "gel", "kcal", "mj/", "eb ", "em ", "en ")) {
        groups["⚡ Énergie"].push(k);
      } else if (is(k, "lysine", "methionine", "méthionine", "threonine", "tryptophan", "isoleucine", "leucine", "valine", "arginine", "histidine", "phenylalanine", "cystine", "glycine", "amino", "acide aminé", "lys ", "met ", "thr ", "trp ", "ile ", "leu ", "val ", "arg ", "his ", "phe ", "cys ")) {
        groups["🔗 Acides Aminés"].push(k);
      } else if (is(k, "vitamin", "vitamine", "choline", "niacin", "riboflavin", "thiamin", "biotin", "pantothenic", "folic", "cobalamin", "vit ")) {
        groups["💊 Vitamines"].push(k);
      } else if (is(k, "calcium", "phosphor", "sodium", "magnesium", "potassium", "zinc", "copper", "manganese", "iron", "selenium", "iodine", "chloride", "sulfur", "cobalt", "ca ", "p ", "na ", "mg ", "k ", "zn ", "cu ", "mn ", "fe ", "se ", " i ", "cl ", " s ", "co ")) {
        groups["🧂 Minéraux"].push(k);
      } else if (is(k, "dry matter", "crude protein", "crude fibre", "crude fat", "ash", "ndf", "adf", "starch", "sugar", "protéine", "fibre", "matière", "ms %", "extractif", "cb ", "mat ", "cel ", "cb %", "ma %", "mg %")) {
        groups["⚗️ Composition Générale"].push(k);
      } else {
        groups["📊 Autre"].push(k);
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
    <div className="p-10 max-w-7xl mx-auto animate-in fade-in duration-500 pb-24">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Formules / Carnet de Commandes</h1>
          <p className="text-gray-500 mt-1">Définir le tonnage, rendement, taille du sac, et cibles nutritionnelles</p>
        </div>
        <div className="flex gap-4">
          <button onClick={addRec} className="bg-emerald-600 text-white hover:bg-emerald-700 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-emerald-600/20">
            + Ajouter Formule
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {recipes.map(masterRec => {
          const activeId = activeVersions[masterRec.id] || masterRec.id;
          const isMasterActive = activeId === masterRec.id;
          const activeItem = isMasterActive ? masterRec : masterRec.versions.find(v => v.id === activeId)!;

          return (
            <div key={masterRec.id} className={`bg-white border rounded-2xl p-6 shadow-sm relative group transition-colors ${!isMasterActive ? 'border-indigo-400 bg-indigo-50/10 ring-2 ring-indigo-50/50' : 'border-gray-200 hover:border-blue-300'}`}>
              
              {/* Card Header & Controls */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1 w-full">
                  <div className="flex items-center justify-between mb-3">
                    <input type="text" value={masterRec.name} onChange={e => editRec(masterRec.id, masterRec.id, "name", e.target.value)}
                      className="text-gray-900 font-black text-2xl bg-transparent border-b-2 border-transparent hover:border-gray-200 outline-none w-2/3 focus:border-blue-500 rounded-none px-1 pb-1 transition-colors" />

                    <div className="flex items-center gap-2">
                      {/* Espèce Cible segmented control */}
                      <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
                        {SPECIES_OPTIONS.map(opt => {
                          const isActive = (activeItem.species ?? "General") === opt.value;
                          return (
                            <button
                              key={opt.value}
                              onClick={() => editRec(masterRec.id, activeItem.id, "species", opt.value)}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                                isActive
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
                         <option value={masterRec.id}>🗂️ {masterRec.version_tag} (Master)</option>
                         {masterRec.versions.map(v => (
                           <option key={v.id} value={v.id}>🔀 {v.version_tag}</option>
                         ))}
                       </select>
                    </div>
                  </div>
                  
                  {/* Actions Row */}
                  <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                    
                    <button onClick={() => askAIForBounds(masterRec.id, activeItem.id, activeItem.name)} disabled={aiLoadingFor === activeItem.id}
                      className="text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg cursor-pointer text-xs font-bold flex items-center shadow-sm disabled:opacity-50">
                      {aiLoadingFor === activeItem.id ? "⏳ Analyse IA..." : "✨ Suggérer Best Practices"}
                    </button>

                    <button onClick={() => createRevision(masterRec.id, activeItem.id)} title="Nouvelle Version"
                      className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg cursor-pointer text-xs font-bold flex items-center gap-1 shadow-sm">
                      💾 Sauvegarder une Révision
                    </button>
                    {!isMasterActive && (
                      <button onClick={() => { editRec(masterRec.id, activeItem.id, "version_tag", prompt("Nouveau nom de version ?", activeItem.version_tag) || activeItem.version_tag); }}
                        className="text-gray-500 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg cursor-pointer text-xs font-bold flex items-center shadow-sm">
                        ✏️ Renommer
                      </button>
                    )}
                    <button onClick={() => { if(confirm("Supprimer cette version ? Attention, supprimer le Master supprime tout l'historique !")) rmRec(masterRec.id, activeItem.id) }} title="Supprimer"
                      className="ml-auto text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-100 px-3 py-1.5 rounded-lg cursor-pointer text-xs font-bold shadow-sm">
                      ✕ Supprimer {isMasterActive ? "Master" : "Version"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Global params (BOUND TO activeItem) */}
              <div className="grid grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <label className={label}>Tonnage (t)</label>
                  <input type="number" step="1" value={activeItem.demand_tons} onChange={e => editRecNum(masterRec.id, activeItem.id, "demand_tons", e.target.value)}
                    className={`${cell} w-full text-right font-bold text-blue-700 bg-white border-blue-200`} />
                </div>
                <div>
                  <label className={label}>Rendement (%)</label>
                  <input type="number" step="0.5" value={activeItem.process_yield_percent} onChange={e => editRecNum(masterRec.id, activeItem.id, "process_yield_percent", e.target.value)}
                    className={`${cell} w-full text-right font-bold text-teal-700 bg-white border-teal-200`} />
                </div>
                <div>
                  <label className={label}>Sac (kg)</label>
                  <input type="number" step="1" value={activeItem.bag_size_kg} onChange={e => editRecNum(masterRec.id, activeItem.id, "bag_size_kg", e.target.value)}
                    className={`${cell} w-full text-right font-bold text-purple-700 bg-white border-purple-200`} />
                </div>
              </div>

              {/* UI Segregation logic */}
              {(() => {
                  const activeNutritionalCols = nutrientColumns.filter(c => !globalIngredientNames.includes(c));
                  const activeIngredientCols = nutrientColumns.filter(c => globalIngredientNames.includes(c));

                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* CARD 1: Cibles Nutritionnelles */}
                      <div className="border border-blue-100 bg-blue-50/10 rounded-xl overflow-hidden shadow-sm flex flex-col">
                        <div className="bg-blue-50/50 border-b border-blue-100 px-4 py-3 flex items-center justify-between">
                            <h3 className="text-blue-900 font-bold text-sm tracking-tight flex items-center gap-2">
                                <span>🧬</span> Cibles Nutritionnelles
                            </h3>
                        </div>
                        <div className="overflow-x-auto p-4 flex flex-col">
                          <table className="w-full text-left text-sm mb-3">
                            <thead>
                              <tr className="text-blue-800 text-[10px] uppercase tracking-wider font-extrabold border-b border-blue-100 pb-2 block w-full table-row">
                                <th className="pb-3 w-1/3">Nutriment</th>
                                <th className="pb-3 w-20 text-right pr-2">Min</th>
                                <th className="pb-3 w-20 text-right pr-2">Max</th>
                                <th className="pb-3 w-24 text-right text-orange-600">Exact</th>
                                <th className="pb-3 w-8"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-blue-50/50">
                              {activeNutritionalCols.length === 0 && (
                                  <tr><td colSpan={5} className="text-center py-4 text-xs text-blue-400 font-medium italic">Aucune cible définie...</td></tr>
                              )}
                              {/* Only show rows that are in THIS recipe's constraints */}
                              {Object.keys(activeItem.constraints).filter(nc => !globalIngredientNames.includes(nc)).map(nc => (
                                <tr key={nc} className="group/row hover:bg-white rounded-md transition-colors">
                                  <td className="py-2.5 text-blue-950 font-semibold">{nc}</td>
                                  <td className="py-2.5 pr-2">
                                    <input type="number" step="0.1" placeholder="—" value={activeItem.constraints?.[nc]?.min ?? ""} onChange={e => editRecConstraint(masterRec.id, activeItem.id, nc, "min", e.target.value)} className={`${cell} w-full text-right bg-transparent group-hover/row:bg-white border-blue-100 focus:border-blue-400`} />
                                  </td>
                                  <td className="py-2.5 pr-2">
                                    <input type="number" step="0.1" placeholder="—" value={activeItem.constraints?.[nc]?.max ?? ""} onChange={e => editRecConstraint(masterRec.id, activeItem.id, nc, "max", e.target.value)} className={`${cell} w-full text-right bg-transparent group-hover/row:bg-white border-blue-100 focus:border-blue-400`} />
                                  </td>
                                  <td className="py-2.5">
                                    <input type="number" step="0.1" placeholder="—" value={activeItem.constraints?.[nc]?.exact ?? ""} onChange={e => editRecConstraint(masterRec.id, activeItem.id, nc, "exact", e.target.value)} className={`${cell} w-full text-right bg-transparent group-hover/row:bg-white border-blue-100 ${activeItem.constraints?.[nc]?.exact !== undefined ? "font-bold text-orange-700 !bg-orange-50 border-orange-300" : ""}`} />
                                  </td>
                                  <td className="py-2.5 pl-1">
                                    <button
                                      onClick={() => removeIngredientFromRecipe(masterRec.id, activeItem.id, nc)}
                                      title="Retirer cette cible"
                                      className="opacity-0 group-hover/row:opacity-100 transition-all text-red-400 hover:text-white hover:bg-red-500 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold cursor-pointer border border-transparent hover:border-red-600"
                                    >
                                      ✕
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
                              className="w-full bg-white border-2 border-dashed border-blue-200 text-blue-700 hover:border-blue-400 hover:bg-blue-50 px-3 py-2 rounded-lg text-xs font-bold transition-all outline-none cursor-pointer"
                            >
                              <option value="" disabled>🧬 Ajouter une cible nutritionnelle...</option>
                              {Object.entries(
                                groupNutrientKeys(
                                  getFilteredNutrients(
                                    availableKeys.filter(k =>
                                      !globalIngredientNames.includes(k) &&
                                      !activeNutritionalCols.includes(k)
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

                                if (isVol && (group.includes("Porc") || group.includes("Ruminant"))) return null;
                                if (isPorc && (group.includes("Volaille") || group.includes("Ruminant"))) return null;
                                if (isRum && (group.includes("Volaille") || group.includes("Porc"))) return null;

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
                      <div className="border border-emerald-100 bg-emerald-50/10 rounded-xl overflow-hidden shadow-sm flex flex-col">
                        <div className="bg-emerald-50/50 border-b border-emerald-100 px-4 py-3 flex items-center justify-between">
                            <h3 className="text-emerald-900 font-bold text-sm tracking-tight flex items-center gap-2">
                                <span>🌾</span> Matières Premières (Limites)
                            </h3>
                        </div>
                        <div className="overflow-x-auto p-4 flex flex-col pt-2">
                          <table className="w-full text-left text-sm mb-3">
                            <thead>
                              <tr className="text-emerald-800 text-[10px] uppercase tracking-wider font-extrabold border-b border-emerald-100 pb-2 block w-full table-row">
                                <th className="pb-3 w-1/3">Ingrédient</th>
                                <th className="pb-3 w-20 text-right pr-2">Min %</th>
                                <th className="pb-3 w-20 text-right pr-2">Max %</th>
                                <th className="pb-3 w-24 text-right text-emerald-700">Exact %</th>
                                <th className="pb-3 w-8"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-emerald-50/50">
                              {Object.keys(activeItem.constraints).filter(nc => globalIngredientNames.includes(nc)).length === 0 && (
                                  <tr><td colSpan={5} className="text-center py-4 text-xs text-emerald-600/60 font-medium italic">Aucune limite d'incorporation...</td></tr>
                              )}
                              {Object.keys(activeItem.constraints).filter(nc => globalIngredientNames.includes(nc)).map(nc => (
                                <tr key={nc} className="group/row hover:bg-white rounded-md transition-colors">
                                  <td className="py-2.5 text-emerald-950 font-semibold">{nc}</td>
                                  <td className="py-2.5 pr-2">
                                    <input type="number" step="0.1" placeholder="—" value={activeItem.constraints?.[nc]?.min ?? ""} onChange={e => editRecConstraint(masterRec.id, activeItem.id, nc, "min", e.target.value)} className={`${cell} w-full text-right bg-transparent group-hover/row:bg-white border-emerald-100 focus:border-emerald-400`} />
                                  </td>
                                  <td className="py-2.5 pr-2">
                                    <input type="number" step="0.1" placeholder="—" value={activeItem.constraints?.[nc]?.max ?? ""} onChange={e => editRecConstraint(masterRec.id, activeItem.id, nc, "max", e.target.value)} className={`${cell} w-full text-right bg-transparent group-hover/row:bg-white border-emerald-100 focus:border-emerald-400`} />
                                  </td>
                                  <td className="py-2.5">
                                    <input type="number" step="0.1" placeholder="—" value={activeItem.constraints?.[nc]?.exact ?? ""} onChange={e => editRecConstraint(masterRec.id, activeItem.id, nc, "exact", e.target.value)} className={`${cell} w-full text-right bg-transparent group-hover/row:bg-white border-emerald-100 ${activeItem.constraints?.[nc]?.exact !== undefined ? "font-bold text-emerald-800 !bg-emerald-100 border-emerald-400" : ""}`} />
                                  </td>
                                  <td className="py-2.5 pl-1">
                                    <button
                                      onClick={() => removeIngredientFromRecipe(masterRec.id, activeItem.id, nc)}
                                      title="Retirer cet ingrédient"
                                      className="opacity-0 group-hover/row:opacity-100 transition-all text-red-400 hover:text-white hover:bg-red-500 w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold cursor-pointer border border-transparent hover:border-red-600"
                                    >
                                      ✕
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
                              className="w-full bg-white border-2 border-dashed border-emerald-200 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50 px-3 py-2 rounded-lg text-xs font-bold transition-all outline-none cursor-pointer"
                            >
                              <option value="" disabled>＋ Ajouter une matière première...</option>
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
        })}
      </div>
    </div>
  );
}
