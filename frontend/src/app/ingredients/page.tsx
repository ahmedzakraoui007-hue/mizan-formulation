"use client";

import { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Ingredient {
  id: number;
  name: string;
  cost: number;
  transport_cost: number;
  dm: number;
  inventory_limit_tons: number;
  nutrients: Record<string, number>;
  is_active: boolean;
}

// ─── Nutrient category color coding ────────────────────────────────────────
const CATEGORY_COLORS: { test: RegExp; badge: string; dot: string }[] = [
  { test: /volaille/i,  badge: "bg-amber-50  text-amber-700  border-amber-200",  dot: "bg-amber-400" },
  { test: /porc/i,      badge: "bg-pink-50   text-pink-700   border-pink-200",   dot: "bg-pink-400" },
  { test: /ruminant/i,  badge: "bg-green-50  text-green-700  border-green-200",  dot: "bg-green-400" },
  { test: /.*/,         badge: "bg-slate-50  text-slate-700  border-slate-200",  dot: "bg-slate-400" },
];

function getCategoryStyle(key: string) {
  return CATEGORY_COLORS.find(c => c.test.test(key)) ?? CATEGORY_COLORS[CATEGORY_COLORS.length - 1];
}

// Group nutrients by species context
function groupNutrients(nutrients: Record<string, number>) {
  const groups: Record<string, { key: string; value: number }[]> = {
    "Composition Générale": [],
    "🐔 Volaille": [],
    "🐷 Porc": [],
    "🐄 Ruminant": [],
  };
  for (const [k, v] of Object.entries(nutrients)) {
    if (/volaille/i.test(k)) groups["🐔 Volaille"].push({ key: k, value: v });
    else if (/porc/i.test(k)) groups["🐷 Porc"].push({ key: k, value: v });
    else if (/ruminant/i.test(k)) groups["🐄 Ruminant"].push({ key: k, value: v });
    else groups["Composition Générale"].push({ key: k, value: v });
  }
  return groups;
}

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("Tous");
  const [fetching, setFetching] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [panelSearch, setPanelSearch] = useState("");

  const fetchIngredients = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(`${API}/api/ingredients`);
      if (res.ok) setIngredients(await res.json());
    } catch { /* backend not ready */ }
    setFetching(false);
  }, []);

  useEffect(() => { fetchIngredients(); }, [fetchIngredients]);

  // ── Sync selectedIngredient when ingredients state updates ──────────────
  useEffect(() => {
    if (selectedIngredient) {
      const updated = ingredients.find(i => i.id === selectedIngredient.id);
      if (updated) setSelectedIngredient(updated);
    }
  }, [ingredients]);

  const saveToBackendList = async () => {
    setFetching(true);
    try {
      await Promise.all(ingredients.map(ing =>
        fetch(`${API}/api/ingredients/${ing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: ing.name, cost: ing.cost, transport_cost: ing.transport_cost,
            dm: ing.dm, inventory_limit_tons: ing.inventory_limit_tons,
            nutrients: ing.nutrients, is_active: ing.is_active,
          }),
        })
      ));
      setHasUnsavedChanges(false);
    } catch { alert("Erreur lors de la sauvegarde."); }
    finally { setFetching(false); }
  };

  const editIng = (id: number, field: keyof Ingredient, val: string) => {
    setHasUnsavedChanges(true);
    setIngredients(prev => prev.map(i => i.id !== id ? i :
      { ...i, [field]: field === "name" ? val : parseFloat(val) || 0 }
    ));
  };

  const toggleActive = async (id: number) => {
    const ing = ingredients.find(i => i.id === id);
    if (!ing) return;
    const newActive = !ing.is_active;
    setIngredients(prev => prev.map(i => i.id === id ? { ...i, is_active: newActive } : i));
    try {
      await fetch(`${API}/api/ingredients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...ing, is_active: newActive }),
      });
    } catch { /* revert silently handled by next fetch */ }
  };

  const addIng = async () => {
    const res = await fetch(`${API}/api/ingredients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Nouvelle Matière", cost: 0, transport_cost: 0, dm: 0, inventory_limit_tons: 0, nutrients: {}, is_active: true }),
    });
    if (res.ok) {
      const row: Ingredient = await res.json();
      setIngredients(prev => [...prev, row]);
    }
  };

  const rmIng = async (id: number) => {
    if (!confirm("Supprimer cet ingrédient ?")) return;
    await fetch(`${API}/api/ingredients/${id}`, { method: "DELETE" });
    setIngredients(prev => prev.filter(i => i.id !== id));
    if (selectedIngredient?.id === id) setSelectedIngredient(null);
  };

  const filteredIngredients = ingredients.filter(ing => {
    const matchesSearch = ing.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === "Tous" ? true :
      filterStatus === "Stock Actif" ? ing.is_active :
      filterStatus === "Base Inactive" ? !ing.is_active : true;
    return matchesSearch && matchesStatus;
  });

  const cell = "bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all";

  if (fetching && ingredients.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-r-blue-600 animate-spin" />
        <span className="ml-3 text-gray-500 text-sm font-medium">Chargement des données ERP…</span>
      </div>
    );
  }

  const panelNutrientGroups = selectedIngredient
    ? groupNutrients(
        Object.fromEntries(
          Object.entries(selectedIngredient.nutrients).filter(([k]) =>
            panelSearch === "" || k.toLowerCase().includes(panelSearch.toLowerCase())
          )
        )
      )
    : {};

  const totalNutrients = selectedIngredient ? Object.keys(selectedIngredient.nutrients).length : 0;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ══════════════ MAIN CONTENT ══════════════ */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${selectedIngredient ? "mr-[480px]" : ""}`}>

        {/* Header */}
        <div className="flex-shrink-0 px-8 pt-8 pb-4">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">Gestion des Stocks</h1>
              <p className="text-gray-500 mt-1 text-sm">
                {filteredIngredients.length} matière{filteredIngredients.length > 1 ? "s" : ""} première{filteredIngredients.length > 1 ? "s" : ""}
                {filterStatus !== "Tous" ? ` · ${filterStatus}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {hasUnsavedChanges && (
                <button onClick={saveToBackendList}
                  className="bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-md flex items-center gap-2 animate-pulse">
                  💾 Sauvegarder
                </button>
              )}
              <button onClick={addIng}
                className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-md shadow-blue-600/20">
                + Ajouter
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input type="text" placeholder="Rechercher une matière première..."
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2.5 w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer">
              <option value="Tous">Tous les ingrédients</option>
              <option value="Stock Actif">✅ Stock Actif</option>
              <option value="Base Inactive">⚪ Base Inactive</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-8 pb-8">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  {["Nom", "Statut", "Coût TND/kg", "MS %", "Protéine %", "Stock (t)", "Fiche Technique", ""].map((h, i) => (
                    <th key={i} className={`py-3.5 px-5 text-xs font-bold tracking-wider uppercase text-gray-400 ${
                      h === "Nom" ? "text-left min-w-[220px]" :
                      h === "Statut" || h === "Fiche Technique" || h === "" ? "text-center" : "text-right"
                    }`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredIngredients.length === 0 && (
                  <tr><td colSpan={8} className="py-16 text-center text-gray-400 italic">
                    Aucun ingrédient ne correspond à votre recherche.
                  </td></tr>
                )}
                {filteredIngredients.map(ing => (
                  <tr key={ing.id}
                    className={`hover:bg-blue-50/40 transition-all group ${!ing.is_active ? "opacity-40 grayscale" : ""} ${selectedIngredient?.id === ing.id ? "bg-blue-50/60 ring-1 ring-inset ring-blue-200" : ""}`}>

                    {/* Nom */}
                    <td className="py-3 px-5">
                      <input type="text" value={ing.name} onChange={e => editIng(ing.id, "name", e.target.value)}
                        className="w-full min-w-[180px] bg-transparent outline-none text-gray-900 font-semibold focus:ring-2 focus:ring-blue-500 rounded-lg px-2 py-1 transition-all" />
                    </td>

                    {/* Statut */}
                    <td className="py-3 px-5 text-center">
                      <button onClick={() => toggleActive(ing.id)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${ing.is_active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200"}`}>
                        {ing.is_active ? "🟢 Actif" : "⚪ Inactif"}
                      </button>
                    </td>

                    {/* Coût */}
                    <td className="py-3 px-5 text-right">
                      <input type="number" step="0.01" value={ing.cost} onChange={e => editIng(ing.id, "cost", e.target.value)}
                        className={`${cell} w-24 text-right font-semibold text-blue-700`} />
                    </td>

                    {/* MS % */}
                    <td className="py-3 px-5 text-right">
                      <span className="font-mono text-gray-600 font-semibold">{ing.dm ?? "—"}</span>
                    </td>

                    {/* Protéine % */}
                    <td className="py-3 px-5 text-right">
                      <span className="font-mono text-gray-600 font-semibold">
                        {ing.nutrients?.["Crude protein"] ??
                         ing.nutrients?.["Protéine %"] ??
                         "—"}
                      </span>
                    </td>

                    {/* Stock (t) */}
                    <td className="py-3 px-5 text-right">
                      <input type="number" step="1" value={ing.inventory_limit_tons} onChange={e => editIng(ing.id, "inventory_limit_tons", e.target.value)}
                        className={`${cell} w-24 text-right font-bold text-purple-700`} />
                    </td>

                    {/* Fiche Technique */}
                    <td className="py-3 px-5 text-center">
                      <button onClick={() => { setSelectedIngredient(ing); setPanelSearch(""); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          selectedIngredient?.id === ing.id
                            ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/25"
                            : "bg-white text-blue-600 border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-sm"
                        }`}>
                        🔬 Détails
                      </button>
                    </td>

                    {/* Delete */}
                    <td className="py-3 px-5 text-center">
                      <button onClick={() => rmIng(ing.id)}
                        className="text-red-400 hover:text-white hover:bg-red-500 border border-transparent hover:border-red-500 px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all text-xs font-bold">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ══════════════ SLIDE-OVER PANEL ══════════════ */}
      {selectedIngredient && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/10 z-30" onClick={() => setSelectedIngredient(null)} />

          {/* Panel */}
          <div className="fixed top-0 right-0 h-full w-[480px] bg-white shadow-2xl z-40 flex flex-col border-l border-gray-200 animate-in slide-in-from-right duration-300">

            {/* Panel Header */}
            <div className="flex-shrink-0 p-6 border-b border-gray-100 bg-gradient-to-r from-slate-900 to-blue-900">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-blue-300 uppercase tracking-widest">Fiche Technique</span>
                  </div>
                  <h2 className="text-lg font-black text-white leading-tight truncate">{selectedIngredient.name}</h2>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-slate-400 font-mono">MS: <span className="text-white font-bold">{selectedIngredient.dm}%</span></span>
                    <span className="text-xs text-slate-400 font-mono">Coût: <span className="text-white font-bold">{selectedIngredient.cost} TND/kg</span></span>
                    <span className="text-xs bg-blue-800/60 text-blue-200 px-2 py-0.5 rounded-full font-bold border border-blue-700">
                      {totalNutrients} paramètres
                    </span>
                  </div>
                </div>
                <button onClick={() => setSelectedIngredient(null)}
                  className="flex-shrink-0 text-slate-400 hover:text-white hover:bg-white/10 w-8 h-8 rounded-lg flex items-center justify-center transition-all text-lg font-bold">
                  ✕
                </button>
              </div>

              {/* Panel Search */}
              <div className="relative mt-4">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                <input type="text" placeholder="Filtrer les paramètres..."
                  value={panelSearch} onChange={e => setPanelSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all" />
              </div>
            </div>

            {/* Panel Body — grouped nutrients */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {Object.entries(panelNutrientGroups).map(([group, items]) => {
                if (items.length === 0) return null;
                const cat = getCategoryStyle(group);
                return (
                  <div key={group}>
                    {/* Group header */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`w-2 h-2 rounded-full ${cat.dot}`} />
                      <span className="text-xs font-black uppercase tracking-widest text-gray-500">{group}</span>
                      <span className="text-xs text-gray-400 font-mono ml-auto">{items.length} valeurs</span>
                    </div>

                    {/* Nutrient grid */}
                    <div className="grid grid-cols-1 gap-1.5">
                      {items.map(({ key, value }) => (
                        <div key={key}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl border ${cat.badge} transition-all hover:shadow-sm`}>
                          <span className="text-xs font-medium truncate pr-2 max-w-[280px]" title={key}>{key}</span>
                          <span className="font-mono text-sm font-bold flex-shrink-0 tabular-nums">
                            {value === 0 ? <span className="text-gray-300">—</span> : value.toLocaleString("fr-FR", { maximumFractionDigits: 4 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {Object.values(panelNutrientGroups).every(g => g.length === 0) && (
                <div className="py-12 text-center text-gray-400 italic text-sm">
                  Aucun paramètre ne correspond à « {panelSearch} »
                </div>
              )}
            </div>

            {/* Panel Footer */}
            <div className="flex-shrink-0 p-4 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <span className="text-xs text-gray-400 font-mono">
                {Object.values(panelNutrientGroups).reduce((acc, g) => acc + g.length, 0)} / {totalNutrients} paramètres affichés
              </span>
              <button onClick={() => setSelectedIngredient(null)}
                className="bg-gray-800 text-white hover:bg-gray-900 px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm">
                Fermer
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
