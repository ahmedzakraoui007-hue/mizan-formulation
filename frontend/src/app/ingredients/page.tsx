"use client";

import { Save, Plus, Search, FlaskConical, X, Edit3, Trash2, Check, AlertCircle } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { getNutrientUnit } from "@/utils/nutrientUtils";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─────────────────────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface LiteIngredient {
  id: number;
  name: string;
  cost: number;
  transport_cost: number;
  dm: number;
  inventory_limit_tons: number;
  is_active: boolean;
  /** lite=true: only contains protein key, or empty for ingredients without protein */
  nutrients: Record<string, number>;
}

interface FullIngredient extends LiteIngredient {
  /** full nutrients object from the DB */
  nutrients: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const COMMON_NUTRIENTS = [
  "Crude protein (%)", "Crude fat (%)", "Crude fibre (%)", "Dry matter (%)",
  "Calcium (%)", "Phosphorus (%)", "Sodium (%)", "Potassium (%)", "Magnesium (%)",
  "Lysine (%)", "Methionine (%)", "Threonine (%)", "Tryptophan (%)",
  "Gross energy (kcal/kg)", "Net energy laying hens (kcal/kg)",
  "Net energy ruminants (kcal/kg)", "Starch (%)", "Sugars (%)",
  "NDF (%)", "ADF (%)", "Copper (mg/kg)", "Zinc (mg/kg)", "Iron (mg/kg)",
];

const CATEGORY_COLORS: { test: RegExp; badge: string; dot: string }[] = [
  { test: /volaille/i, badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-400" },
  { test: /porc/i, badge: "bg-pink-50 text-pink-700 border-pink-200", dot: "bg-pink-400" },
  { test: /ruminant/i, badge: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-400" },
  { test: /.*/, badge: "bg-slate-50 text-slate-700 border-slate-200", dot: "bg-slate-400" },
];

function getCategoryStyle(key: string) {
  return CATEGORY_COLORS.find(c => c.test.test(key)) ?? CATEGORY_COLORS[CATEGORY_COLORS.length - 1];
}

function groupNutrients(nutrients: Record<string, number>) {
  const groups: Record<string, { key: string; value: number }[]> = {
    "Composition Générale": [],
    "Volaille": [],
    "Porc": [],
    "Ruminant": [],
  };
  for (const [k, v] of Object.entries(nutrients)) {
    if (/volaille/i.test(k)) groups["Volaille"].push({ key: k, value: v });
    else if (/porc/i.test(k)) groups["Porc"].push({ key: k, value: v });
    else if (/ruminant/i.test(k)) groups["Ruminant"].push({ key: k, value: v });
    else groups["Composition Générale"].push({ key: k, value: v });
  }
  return groups;
}

// ─────────────────────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function IngredientsPage() {
  // The main list only holds lite data (no heavy nutrients)
  const [ingredients, setIngredients] = useState<LiteIngredient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("Tous");
  const [fetching, setFetching] = useState(true);

  // Track inline row edits (name, cost, dm, stock only — never nutrients from the table)
  const [pendingRowEdits, setPendingRowEdits] = useState<Record<number, Partial<LiteIngredient>>>({});
  const hasRowEdits = Object.keys(pendingRowEdits).length > 0;

  // Side panel state — holds a FULL ingredient object fetched on demand
  const [panel, setPanel] = useState<FullIngredient | null>(null);
  const [panelSearch, setPanelSearch] = useState("");
  const [panelSaving, setPanelSaving] = useState(false);

  // ── Fetch lite ingredient list ────────────────────────────────────────────
  const fetchIngredients = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(`${API}/api/ingredients?lite=true`);
      if (res.ok) setIngredients(await res.json());
    } catch { /* backend not ready */ }
    setFetching(false);
  }, []);

  useEffect(() => { fetchIngredients(); }, [fetchIngredients]);

  // ── Inline row edit helpers ────────────────────────────────────────────────
  // Only fields that are safe to edit from lite data — NEVER nutrients
  const editRow = (id: number, field: "name" | "cost" | "transport_cost" | "dm" | "inventory_limit_tons", val: string) => {
    const parsed = field === "name" ? val : parseFloat(val) || 0;
    setIngredients(prev => prev.map(i => i.id !== id ? i : { ...i, [field]: parsed }));
    setPendingRowEdits(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: parsed },
    }));
  };

  // ── Save inline row edits ─────────────────────────────────────────────────
  // We only send the fields that were actually changed, never nutrients
  const saveRowEdits = async () => {
    setFetching(true);
    try {
      await Promise.all(
        Object.entries(pendingRowEdits).map(async ([idStr, changes]) => {
          const id = Number(idStr);
          const res = await fetch(`${API}/api/ingredients/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            // We deliberately exclude nutrients — the backend uses exclude_unset=True
            body: JSON.stringify(changes),
          });
          if (res.ok) {
            // The server returns the full object; only update non-nutrient fields in our lite list
            const updated: FullIngredient = await res.json();
            setIngredients(prev => prev.map(i => i.id !== updated.id ? i : {
              ...i,
              name: updated.name,
              cost: updated.cost,
              transport_cost: updated.transport_cost,
              dm: updated.dm,
              inventory_limit_tons: updated.inventory_limit_tons,
              is_active: updated.is_active,
            }));
          }
        })
      );
      setPendingRowEdits({});
    } catch { alert("Erreur lors de la sauvegarde."); }
    finally { setFetching(false); }
  };

  // ── Toggle active ─────────────────────────────────────────────────────────
  const toggleActive = async (id: number) => {
    const ing = ingredients.find(i => i.id === id);
    if (!ing) return;
    const newActive = !ing.is_active;
    setIngredients(prev => prev.map(i => i.id === id ? { ...i, is_active: newActive } : i));
    try {
      await fetch(`${API}/api/ingredients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newActive }),
      });
    } catch { /* revert on next fetch */ }
  };

  // ── Add / Delete ingredient ───────────────────────────────────────────────
  const addIng = async () => {
    const res = await fetch(`${API}/api/ingredients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Nouvelle Matière", cost: 0, transport_cost: 0, dm: 88, inventory_limit_tons: 99999, nutrients: {}, is_active: true }),
    });
    if (res.ok) {
      const row: LiteIngredient = await res.json();
      setIngredients(prev => [...prev, { ...row, nutrients: {} }]);
    }
  };

  const rmIng = async (id: number) => {
    if (!confirm("Supprimer cet ingrédient ?")) return;
    await fetch(`${API}/api/ingredients/${id}`, { method: "DELETE" });
    setIngredients(prev => prev.filter(i => i.id !== id));
    if (panel?.id === id) setPanel(null);
  };

  // ── Open the detail panel ─────────────────────────────────────────────────
  // Always fetches the FULL ingredient from DB to avoid stale data
  const openPanel = async (id: number) => {
    setPanelSearch("");
    try {
      const res = await fetch(`${API}/api/ingredients/${id}`);
      if (res.ok) setPanel(await res.json());
    } catch (e) { console.error("Could not fetch full ingredient", e); }
  };

  // ── Panel nutrient edit helpers ────────────────────────────────────────────
  const updatePanelNutrient = (key: string, val: string) => {
    if (!panel) return;
    setPanel(prev => prev ? { ...prev, nutrients: { ...prev.nutrients, [key]: parseFloat(val) || 0 } } : null);
  };

  const addPanelNutrient = (key: string) => {
    if (!key || !panel || key in panel.nutrients) return;
    setPanel(prev => prev ? { ...prev, nutrients: { ...prev.nutrients, [key]: 0 } } : null);
  };

  const removePanelNutrient = (key: string) => {
    if (!panel) return;
    const n = { ...panel.nutrients };
    delete n[key];
    setPanel(prev => prev ? { ...prev, nutrients: n } : null);
  };

  // ── Save panel (nutrients + panel-editable fields) ─────────────────────────
  const savePanel = async () => {
    if (!panel) return;
    setPanelSaving(true);
    try {
      const res = await fetch(`${API}/api/ingredients/${panel.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: panel.name,
          cost: panel.cost,
          transport_cost: panel.transport_cost,
          dm: panel.dm,
          inventory_limit_tons: panel.inventory_limit_tons,
          is_active: panel.is_active,
          nutrients: panel.nutrients,
        }),
      });
      if (res.ok) {
        const updated: FullIngredient = await res.json();
        setPanel(updated);
        // Sync lite list: update the protein preview and other fields
        const proteinKey = ["Crude protein (%)", "Crude protein", "Protéine %"].find(k => k in updated.nutrients);
        setIngredients(prev => prev.map(i => i.id !== updated.id ? i : {
          ...i,
          name: updated.name,
          cost: updated.cost,
          transport_cost: updated.transport_cost,
          dm: updated.dm,
          inventory_limit_tons: updated.inventory_limit_tons,
          is_active: updated.is_active,
          nutrients: proteinKey ? { [proteinKey]: updated.nutrients[proteinKey] } : {},
        }));
        alert("✅ Fiche technique sauvegardée !");
      }
    } catch { alert("Erreur lors de la sauvegarde de la fiche."); }
    finally { setPanelSaving(false); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredIngredients = ingredients.filter(ing => {
    const matchesSearch = ing.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === "Tous" ? true :
        filterStatus === "Stock Actif" ? ing.is_active :
          filterStatus === "Base Inactive" ? !ing.is_active : true;
    return matchesSearch && matchesStatus;
  });

  const panelNutrientGroups = panel ? groupNutrients(
    Object.fromEntries(
      Object.entries(panel.nutrients).filter(([k]) =>
        panelSearch === "" || k.toLowerCase().includes(panelSearch.toLowerCase())
      )
    )
  ) : {};

  const totalNutrients = panel ? Object.keys(panel.nutrients).length : 0;

  // Strip trailing unit from a nutrient key for display (unit is shown separately)
  // e.g. "Dry matter (%)" → "Dry matter", "Lysine (g/kg)" → "Lysine", "Protéine %" → "Protéine"
  const formatNutrientLabel = (key: string): string =>
    key.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+%\s*$/, '').trim();

  const cell = "bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (fetching && ingredients.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-900">
        <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-r-blue-600 animate-spin" />
        <span className="ml-3 text-gray-500 text-sm font-medium">Chargement des données ERP…</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900">

      {/* ══════════════ MAIN CONTENT ══════════════ */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${panel ? "mr-[480px]" : ""}`}>

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
              {hasRowEdits && (
                <button onClick={saveRowEdits}
                  className="bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-md flex items-center gap-2 animate-pulse">
                  <Save className="w-4 h-4" /> Sauvegarder
                </button>
              )}
              <button onClick={addIng}
                className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-md shadow-blue-600/20 flex items-center gap-1">
                <Plus className="w-4 h-4" /> Ajouter
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input type="text" placeholder="Rechercher une matière première..."
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2.5 w-full bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer">
              <option value="Tous">Tous les ingrédients</option>
              <option value="Stock Actif">Stock Actif</option>
              <option value="Base Inactive">Base Inactive</option>
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
                    <th key={i} className={`py-3.5 px-5 text-xs font-bold tracking-wider uppercase text-gray-400 ${h === "Nom" ? "text-left min-w-[220px]" :
                      h === "Statut" || h === "Fiche Technique" || h === "" ? "text-center" : "text-right"
                      }`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-900">
                {filteredIngredients.length === 0 && (
                  <tr><td colSpan={8} className="py-16 text-center text-gray-400 italic">
                    Aucun ingrédient ne correspond à votre recherche.
                  </td></tr>
                )}
                {filteredIngredients.map(ing => (
                  <tr key={ing.id}
                    className={`hover:bg-blue-50/40 transition-all group ${!ing.is_active ? "opacity-40 grayscale" : ""} ${panel?.id === ing.id ? "bg-blue-50/60 ring-1 ring-inset ring-blue-200" : ""}`}>

                    {/* Nom */}
                    <td className="py-3 px-5">
                      <input type="text" value={ing.name} onChange={e => editRow(ing.id, "name", e.target.value)}
                        className="w-full min-w-[180px] bg-transparent outline-none text-gray-900 font-semibold focus:ring-2 focus:ring-blue-500 rounded-lg px-2 py-1 transition-all" />
                    </td>

                    {/* Statut */}
                    <td className="py-3 px-5 text-center">
                      <button onClick={() => toggleActive(ing.id)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 mx-auto ${ing.is_active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200"}`}>
                        <div className={`w-2 h-2 rounded-full ${ing.is_active ? "bg-emerald-500" : "bg-gray-400"}`} />
                        {ing.is_active ? "Actif" : "Inactif"}
                      </button>
                    </td>

                    {/* Coût */}
                    <td className="py-3 px-5 text-right">
                      <input type="number" step="0.01" value={ing.cost} onChange={e => editRow(ing.id, "cost", e.target.value)}
                        className={`${cell} w-24 text-right font-semibold text-blue-700`} />
                    </td>

                    {/* MS % */}
                    <td className="py-3 px-5 text-right">
                      <input type="number" step="0.1" value={ing.dm} onChange={e => editRow(ing.id, "dm", e.target.value)}
                        className={`${cell} w-20 text-right font-semibold text-gray-700`} />
                    </td>

                    {/* Protéine % — display only from lite data */}
                    <td className="py-3 px-5 text-right">
                      <span className="font-mono text-gray-600 font-semibold">
                        {ing.nutrients?.["Crude protein (%)"] ??
                          ing.nutrients?.["Crude protein"] ??
                          ing.nutrients?.["Protéine %"] ??
                          "—"}
                      </span>
                    </td>

                    {/* Stock (t) */}
                    <td className="py-3 px-5 text-right">
                      <input type="number" step="1" value={ing.inventory_limit_tons} onChange={e => editRow(ing.id, "inventory_limit_tons", e.target.value)}
                        className={`${cell} w-24 text-right font-bold text-purple-700`} />
                    </td>

                    {/* Fiche Technique */}
                    <td className="py-3 px-5 text-center">
                      <button onClick={() => openPanel(ing.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center justify-center gap-1.5 mx-auto ${panel?.id === ing.id
                          ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/25"
                          : "bg-white text-blue-600 border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-sm"
                          }`}>
                        <FlaskConical className="w-3.5 h-3.5" /> Détails
                      </button>
                    </td>

                    {/* Delete */}
                    <td className="py-3 px-5 text-center">
                      <button onClick={() => rmIng(ing.id)}
                        className="text-red-400 hover:text-white hover:bg-red-500 border border-transparent hover:border-red-500 px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all text-xs font-bold">
                        <X className="w-3.5 h-3.5" />
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
      {panel && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/10 z-30" onClick={() => setPanel(null)} />

          {/* Panel */}
          <div className="fixed top-0 right-0 h-full w-[480px] bg-white shadow-2xl z-40 flex flex-col border-l border-gray-200 animate-in slide-in-from-right duration-300 text-gray-900">

            {/* Panel Header */}
            <div className="flex-shrink-0 p-6 border-b border-gray-100 bg-gradient-to-r from-slate-900 to-blue-900">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-blue-300 uppercase tracking-widest">Fiche Technique</span>
                  </div>
                  <h2 className="text-lg font-black text-white leading-tight truncate">{panel.name}</h2>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-slate-400 font-mono">MS:
                      <input type="number" step="0.1" value={panel.dm}
                        onChange={e => setPanel(prev => prev ? { ...prev, dm: parseFloat(e.target.value) || 0 } : null)}
                        className="w-16 bg-white/10 border-none outline-none text-white font-bold ml-1 rounded px-1" />
                      %</span>
                    <span className="text-xs text-slate-400 font-mono">Coût:
                      <input type="number" step="0.01" value={panel.cost}
                        onChange={e => setPanel(prev => prev ? { ...prev, cost: parseFloat(e.target.value) || 0 } : null)}
                        className="w-20 bg-white/10 border-none outline-none text-white font-bold ml-1 rounded px-1" />
                      TND/kg</span>
                    <span className="text-xs bg-blue-800/60 text-blue-200 px-2 py-0.5 rounded-full font-bold border border-blue-700">
                      {totalNutrients} paramètres
                    </span>
                  </div>
                </div>
                <button onClick={() => setPanel(null)}
                  className="flex-shrink-0 text-slate-400 hover:text-white hover:bg-white/10 w-8 h-8 rounded-lg flex items-center justify-center transition-all text-lg font-bold">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Panel Search */}
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input type="text" placeholder="Filtrer les paramètres..."
                  value={panelSearch} onChange={e => setPanelSearch(e.target.value)}
                  className="pl-9 pr-4 py-2.5 w-full bg-white/10 border border-white/20 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all" />
              </div>
            </div>

            {/* Panel Body — grouped nutrients */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {Object.entries(panelNutrientGroups).map(([group, items]) => {
                if (items.length === 0) return null;
                const cat = getCategoryStyle(group);
                return (
                  <div key={group}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`w-2 h-2 rounded-full ${cat.dot}`} />
                      <span className="text-xs font-black uppercase tracking-widest text-gray-500">{group}</span>
                      <span className="text-xs text-gray-400 font-mono ml-auto">{items.length} valeurs</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {items.map(({ key, value }) => (
                        <div key={key}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl border ${cat.badge} transition-all hover:shadow-sm`}>
                          <div className="flex-1">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{formatNutrientLabel(key)}</p>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.01"
                                value={value}
                                onChange={e => updatePanelNutrient(key, e.target.value)}
                                className="w-24 bg-white/50 border border-gray-200 rounded px-2 py-0.5 text-xs font-mono font-bold text-right outline-none focus:ring-1 focus:ring-blue-500 text-gray-900"
                              />
                              <span className="text-[10px] text-slate-500 font-bold">{getNutrientUnit(key)}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => removePanelNutrient(key)}
                            className="text-red-400 hover:text-red-600 transition-colors ml-2">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {Object.values(panelNutrientGroups).every(g => g.length === 0) && (
                <div className="py-12 text-center text-gray-400 italic text-sm">
                  {panelSearch
                    ? `Aucun paramètre ne correspond à « ${panelSearch} »`
                    : "Aucun nutriment enregistré. Ajoutez-en via le menu ci-dessous."}
                </div>
              )}
            </div>

            {/* Panel Footer */}
            <div className="flex-shrink-0 p-4 border-t border-gray-100 bg-gray-50/50 space-y-3">
              {/* Add nutrient row */}
              <div className="flex items-center gap-2">
                <select
                  className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer text-gray-900"
                  onChange={e => { if (e.target.value && e.target.value !== "NEW_PROMPT") { addPanelNutrient(e.target.value); e.target.value = ""; } }}
                  defaultValue="">
                  <option value="" disabled>+ Ajouter un nutriment...</option>
                  {(() => {
                    const allKeys = new Set(COMMON_NUTRIENTS);
                    ingredients.forEach(i => { if (i.nutrients) Object.keys(i.nutrients).forEach(k => allKeys.add(k)); });
                    if (panel) Object.keys(panel.nutrients).forEach(k => allKeys.add(k));
                    return Array.from(allKeys)
                      .filter(n => !panel || !(n in panel.nutrients))
                      .sort().map(n => (
                        <option key={n} value={n}>{n}</option>
                      ));
                  })()}
                </select>
                <button
                  onClick={() => { const custom = prompt("Nom du nouveau nutriment :"); if (custom) addPanelNutrient(custom); }}
                  className="bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 px-3 py-2 rounded-lg text-xs font-black transition-all">
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>

              {/* Save / Close */}
              <div className="flex justify-between items-center">
                <div className="text-xs text-gray-400 font-mono">
                  {Object.values(panelNutrientGroups).reduce((acc, g) => acc + g.length, 0)} / {totalNutrients} paramètres affichés
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setPanel(null)}
                    className="bg-gray-100 text-gray-600 hover:bg-gray-200 px-4 py-2 rounded-xl text-sm font-bold transition-all">
                    Fermer
                  </button>
                  <button onClick={savePanel} disabled={panelSaving}
                    className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 px-5 py-2 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2">
                    {panelSaving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                    Sauvegarder la fiche
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
