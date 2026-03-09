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
}

interface RecipeGrouped extends Recipe {
  versions: Recipe[];
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<RecipeGrouped[]>([]);
  // activeVersionId maps a Master Recipe ID to the ID of the version currently selected in the dropdown
  // If activeVersionId[masterId] === masterId, the Master is selected.
  const [activeVersions, setActiveVersions] = useState<Record<number, number>>({});
  const [nutrientColumns, setNutrientCols] = useState<string[]>(["Protéine %", "Fibre %", "Énergie"]);
  const [availableKeys, setAvailableKeys] = useState<string[]>([]);
  const [fetching, setFetching] = useState(true);

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
        ings.forEach((ing: any) => {
          keys.add(ing.name);
          Object.keys(ing.nutrients || {}).forEach(k => keys.add(k));
        });
        setAvailableKeys(Array.from(keys).sort());
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
          <select 
            value="" 
            onChange={(e) => {
              const val = e.target.value;
              if (val && !nutrientColumns.includes(val)) setNutrientCols(prev => [...prev, val]);
            }}
            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm outline-none cursor-pointer"
          >
            <option value="" disabled>+ Ajouter Colonne...</option>
            {availableKeys.filter(k => !nutrientColumns.includes(k)).map(k => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <button onClick={addRec} className="bg-emerald-600 text-white hover:bg-emerald-700 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-emerald-600/20">
            + Ajouter Formule
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
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

              {/* Dynamic Constraints (BOUND TO activeItem) */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-gray-500 text-[10px] uppercase tracking-wider font-bold border-b border-gray-200">
                      <th className="pb-3 text-gray-700">Nutriment</th>
                      <th className="pb-3 w-24 text-right pr-2">Min</th>
                      <th className="pb-3 w-24 text-right pr-2">Max</th>
                      <th className="pb-3 w-28 text-right text-orange-600">Exact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {nutrientColumns.map(nc => (
                      <tr key={nc} className="group/row hover:bg-gray-50">
                        <td className="py-2.5 text-gray-700 font-semibold">{nc}</td>
                        <td className="py-2.5 pr-2">
                          <input type="number" step="0.1" placeholder="—" value={activeItem.constraints?.[nc]?.min ?? ""} onChange={e => editRecConstraint(masterRec.id, activeItem.id, nc, "min", e.target.value)} className={`${cell} w-full text-right bg-transparent group-hover/row:bg-white`} />
                        </td>
                        <td className="py-2.5 pr-2">
                          <input type="number" step="0.1" placeholder="—" value={activeItem.constraints?.[nc]?.max ?? ""} onChange={e => editRecConstraint(masterRec.id, activeItem.id, nc, "max", e.target.value)} className={`${cell} w-full text-right bg-transparent group-hover/row:bg-white`} />
                        </td>
                        <td className="py-2.5">
                          <input type="number" step="0.1" placeholder="—" value={activeItem.constraints?.[nc]?.exact ?? ""} onChange={e => editRecConstraint(masterRec.id, activeItem.id, nc, "exact", e.target.value)} className={`${cell} w-full text-right bg-transparent group-hover/row:bg-white ${activeItem.constraints?.[nc]?.exact !== undefined ? "font-bold text-orange-700 !bg-orange-50 border-orange-300" : ""}`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
