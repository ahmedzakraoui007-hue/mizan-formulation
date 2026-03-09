"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Ingredient {
  id: number;
  name: string;
  cost: number;
  transport_cost: number;
  dm: number;
  inventory_limit_tons: number;
  nutrients: Record<string, number>;
}

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [nutrientColumns, setNutrientCols] = useState<string[]>(["Protéine %", "Fibre %", "Énergie"]);
  const [fetching, setFetching] = useState(true);

  const fetchIngredients = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(`${API}/api/ingredients`);
      if (res.ok) {
        const ings = await res.json();
        setIngredients(ings);
        if (ings.length > 0) {
          const allKeys = new Set([...nutrientColumns]);
          ings.forEach((ing: Ingredient) => {
            if (ing.nutrients) Object.keys(ing.nutrients).forEach(k => allKeys.add(k));
          });
          setNutrientCols(Array.from(allKeys));
        }
      }
    } catch { /* backend not ready */ }
    setFetching(false);
  }, []);

  useEffect(() => { fetchIngredients(); }, [fetchIngredients]);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  const saveToBackendList = async () => {
    try {
      setFetching(true);
      await Promise.all(ingredients.map(ing => 
        fetch(`${API}/api/ingredients/${ing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: ing.name,
            cost: ing.cost,
            transport_cost: ing.transport_cost,
            dm: ing.dm,
            inventory_limit_tons: ing.inventory_limit_tons,
            nutrients: ing.nutrients
          }),
        })
      ));
      setHasUnsavedChanges(false);
    } catch (e) {
      console.error("Failed to save", e);
      alert("Erreur lors de la sauvegarde.");
    } finally {
      setFetching(false);
    }
  };

  const editIng = (id: number, key: keyof Ingredient | "nutrient", v: string, nutrKey?: string) => {
    setHasUnsavedChanges(true);
    
    setIngredients((prev: Ingredient[]) => prev.map((i: Ingredient) => {
      if (i.id !== id) return i;
      
      let modified: Ingredient;
      if (key === "nutrient" && nutrKey) {
        modified = { ...i, nutrients: { ...i.nutrients, [nutrKey]: parseFloat(v) || 0 } };
      } else {
        modified = { ...i, [key]: key === "name" ? v : (parseFloat(v) || 0) };
      }
      
      return modified;
    }));
  };

  const addNutrientColumn = () => {
    const colName = prompt("Nom du nouveau nutriment (ex: Calcium %):");
    if (colName && !nutrientColumns.includes(colName)) {
      setNutrientCols([...nutrientColumns, colName]);
    }
  };

  const addIng = async () => {
    try {
      const initNutrients: Record<string, number> = {};
      nutrientColumns.forEach((c: string) => initNutrients[c] = 0);

      const res = await fetch(`${API}/api/ingredients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Nouvelle Matière", cost: 0, transport_cost: 0, dm: 0, inventory_limit_tons: 0, nutrients: initNutrients }),
      });
      if (res.ok) {
        const row: Ingredient = await res.json();
        setIngredients(prev => [...prev, row]);
      }
    } catch { /* ignore */ }
  };

  const rmIng = async (id: number) => {
    try {
      await fetch(`${API}/api/ingredients/${id}`, { method: "DELETE" });
      setIngredients((prev: Ingredient[]) => prev.filter((i: Ingredient) => i.id !== id));
    } catch { /* ignore */ }
  };

  const cell = "bg-white border border-gray-300 rounded-md px-3 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-sm transition-shadow";

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
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Gestion des Stocks</h1>
          <p className="text-gray-500 mt-1">Silos de matières premières — coût, valeurs nutritives et stock disponible</p>
        </div>
        <div className="flex gap-3">
          {hasUnsavedChanges && (
            <button onClick={saveToBackendList} className="bg-emerald-600 text-white hover:bg-emerald-700 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 animate-pulse">
              💾 Sauvegarder
            </button>
          )}
          <button onClick={addNutrientColumn} className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm">
            + Ajouter Colonne Nutriment
          </button>
          <button onClick={addIng} className="bg-blue-600 text-white hover:bg-blue-700 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md shadow-blue-600/20">
            + Ajouter Matière
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50">
              <tr className="text-gray-500 border-b border-gray-200 text-xs font-bold tracking-wider uppercase">
                {["Nom", "TND/kg", "Frais Logistiques (TND)", "MS %", ...nutrientColumns, "Stock (t)", ""].map((h, i) => (
                  <th key={i} className={`py-4 px-5 ${h !== "Nom" && h !== "" ? "text-right" : ""} ${h === "Nom" ? "min-w-[250px]" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ingredients.map(ing => (
                <tr key={ing.id} className="hover:bg-blue-50/50 transition-colors group">
                  <td className="py-3 px-5">
                    <input type="text" value={ing.name} onChange={e => editIng(ing.id,"name",e.target.value)}
                      className="w-full bg-transparent outline-none text-gray-900 font-bold focus:ring-2 focus:ring-blue-500 rounded px-2 py-1.5" />
                  </td>
                  <td className="py-3 px-5 text-right">
                    <input type="number" step="0.01" value={ing.cost} onChange={e => editIng(ing.id, "cost", e.target.value)} className={`${cell} w-20 text-right`} />
                  </td>
                  <td className="py-3 px-5 text-right">
                    <input type="number" step="0.01" value={ing.transport_cost} onChange={e => editIng(ing.id, "transport_cost", e.target.value)} className={`${cell} w-24 text-right bg-orange-50/50 border-orange-200`} />
                  </td>
                  <td className="py-3 px-5 text-right">
                    <input type="number" step="0.01" value={ing.dm} onChange={e => editIng(ing.id, "dm", e.target.value)} className={`${cell} w-20 text-right`} />
                  </td>
                  {nutrientColumns.map(nc => (
                    <td key={nc} className="py-3 px-5 text-right">
                      <input type="number" step="0.1" value={ing.nutrients?.[nc] ?? 0} onChange={e => editIng(ing.id, "nutrient", e.target.value, nc)} className={`${cell} w-24 text-right`} />
                    </td>
                  ))}
                  <td className="py-3 px-5 text-right">
                    <input type="number" step="1" value={ing.inventory_limit_tons} onChange={e => editIng(ing.id, "inventory_limit_tons", e.target.value)}
                      className={`${cell} w-24 font-bold text-blue-700 bg-blue-50 border-blue-200 text-right`} />
                  </td>
                  <td className="py-3 px-5 text-center">
                    <button onClick={() => rmIng(ing.id)} className="text-red-500 hover:text-white hover:bg-red-500 border border-transparent hover:border-red-600 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer text-xs font-bold shadow-sm">
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
