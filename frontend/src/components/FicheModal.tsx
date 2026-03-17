"use client";

import { saveAs } from "file-saver";
import { isNutrientSpecificToSpecies } from "@/utils/nutrientUtils";

interface ResultIngredient {
  name: string;
  tons: number;
  percentage: number;
}

interface RecipeResult {
  name: string;
  demand_tons: number;
  raw_tons: number;
  process_yield_percent: number;
  cost_tnd: number;
  bag_size_kg: number;
  cost_per_bag_tnd: number;
  ingredients: ResultIngredient[];
  nutrients: Record<string, number>;
}

interface FicheModalProps {
  report: RecipeResult;
  originalConstraints?: Record<string, { min?: number; max?: number; exact?: number }>;
  species?: string;
  onClose: () => void;
}

export default function FicheModal({ report, originalConstraints, species = "General", onClose }: FicheModalProps) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  
  // Sort ingredients by weight descending
  const sortedIngredients = [...report.ingredients].sort((a, b) => b.tons - a.tons);

  const generateCSV = () => {
    let csv = `MIZAN FORMULATION - Fiche de Fabrication\n`;
    csv += `Date,${dateStr}\n\n`;
    csv += `Formule,${report.name}\n`;
    csv += `Tonnage final (t),${report.demand_tons}\n`;
    csv += `Matieres chargees (t),${report.raw_tons}\n`;
    csv += `Rendement (%),${report.process_yield_percent}\n`;
    csv += `Cout total (TND),${report.cost_tnd.toFixed(2)}\n`;
    csv += `Taille du sac (kg),${report.bag_size_kg}\n`;
    csv += `Cout par sac (TND),${report.cost_per_bag_tnd.toFixed(3)}\n\n`;
    
    csv += `Matiere Premiere,Quantite (kg),Quantite (t),Proportion (%)\n`;
    sortedIngredients.forEach(ing => {
      csv += `"${ing.name}",${(ing.tons * 1000).toFixed(0)},${ing.tons.toFixed(2)},${ing.percentage.toFixed(1)}\n`;
    });
    
    csv += `\nValeurs Nutritionnelles,Atteint\n`;
    Object.entries(report.nutrients)
      .filter(([key]) => {
        const hasConstraint = originalConstraints && key in originalConstraints;
        const isSpecific = isNutrientSpecificToSpecies(key, species);
        return hasConstraint || isSpecific;
      })
      .forEach(([key, val]) => {
        csv += `"${key}",${val}\n`;
      });
    
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csv], { type: "text/csv;charset=utf-8" });
    const fileName = `Fiche_${report.name.replace(/[^a-zA-Z0-9_-]/g, "_")}_${now.toISOString().slice(0, 10)}.csv`;
    saveAs(blob, fileName);
  };

  const handlePrint = () => {
    window.print();
  };

  const hrLine = "border-t border-gray-300 my-6";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 print:bg-white print:relative print:z-0 print:block overflow-y-auto pt-10 pb-10 print:p-0">
      <div className="bg-white rounded-2xl shadow-2xl w-11/12 max-w-4xl p-10 max-h-none print:shadow-none print:w-full print:p-0 relative my-auto">
        
        {/* Close Button (Hidden in Print) */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors print:hidden"
        >
          ✕
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <span className="text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg">MIZAN</span> FORMULATION
            </h1>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1 ml-1">Fiche de Fabrication</h2>
          </div>
          <div className="text-right text-gray-500 font-medium">
            Le {dateStr}
          </div>
        </div>

        {/* Global Stats Grid */}
        <div className="bg-gray-50/80 border border-gray-200 rounded-xl p-6 mb-8 print:bg-transparent print:border-gray-800 print:rounded-none">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Formule</p>
              <p className="text-xl font-black text-gray-900 mt-1">{report.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Tonnage Produit</p>
              <p className="text-xl font-black text-blue-700 mt-1">{report.demand_tons} t</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Matières Chargées</p>
              <p className="text-xl font-black text-teal-700 mt-1">{report.raw_tons} t <span className="text-sm text-teal-600/60 font-medium">({report.process_yield_percent}%)</span></p>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Coût Total Estimé</p>
              <p className="text-xl font-black text-gray-900 mt-1">{report.cost_tnd.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} TND</p>
              <p className="text-sm text-gray-500 font-medium">{report.cost_per_bag_tnd.toLocaleString("fr-FR", { minimumFractionDigits: 3 })} TND / sac</p>
            </div>
          </div>
        </div>

        {/* Ingredients Table */}
        <h3 className="text-lg font-black text-gray-900 mb-4 border-l-4 border-emerald-500 pl-3">Composition de la Formule</h3>
        <table className="w-full text-left text-sm mb-8 border border-gray-200">
          <thead className="bg-gray-100 border-b border-gray-200 print:bg-gray-200">
            <tr className="text-gray-700 text-xs font-bold uppercase tracking-wider">
              <th className="py-3 px-4">Matière Première</th>
              <th className="py-3 px-4 text-right">Quantité (kg)</th>
              <th className="py-3 px-4 text-right">Quantité (tonnes)</th>
              <th className="py-3 px-4 text-right">Proportion (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 mix-blend-multiply">
            {sortedIngredients.map((ing, idx) => (
              <tr key={idx} className={idx % 2 !== 0 ? "bg-gray-50/50 print:bg-transparent" : "print:bg-transparent"}>
                <td className="py-2.5 px-4 font-bold text-gray-900">{ing.name}</td>
                <td className="py-2.5 px-4 text-right font-medium">{(ing.tons * 1000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} kg</td>
                <td className="py-2.5 px-4 text-right text-gray-600 font-medium">{ing.tons.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t</td>
                <td className="py-2.5 px-4 text-right font-black text-blue-700">{ing.percentage.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %</td>
              </tr>
            ))}
            <tr className="bg-gray-100 font-black text-gray-900 border-t-2 border-gray-300 print:bg-gray-200">
              <td className="py-3 px-4 uppercase text-xs tracking-wider">Total Charges</td>
              <td className="py-3 px-4 text-right">{(report.raw_tons * 1000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} kg</td>
              <td className="py-3 px-4 text-right">{report.raw_tons.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t</td>
              <td className="py-3 px-4 text-right">100.0 %</td>
            </tr>
          </tbody>
        </table>

        {/* Nutrients Breakdown */}
        <div className="break-inside-avoid">
          <h3 className="text-lg font-black text-gray-900 mb-4 border-l-4 border-orange-500 pl-3">Valeurs Nutritionnelles Atteintes</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-8 text-sm bg-gray-50 p-6 rounded-xl border border-gray-200 print:bg-transparent print:border-gray-800 print:rounded-none">
            {Object.entries(report.nutrients)
              .filter(([key]) => {
                const hasConstraint = originalConstraints && key in originalConstraints;
                const isSpecific = isNutrientSpecificToSpecies(key, species);
                return hasConstraint || isSpecific;
              })
              .map(([key, val]) => {
                const c = originalConstraints?.[key];
                let targetStr = "";
                if (c) {
                  if (c.exact !== undefined && c.exact !== null) targetStr = ` (Cible: ${c.exact})`;
                  else if (c.min !== undefined && c.min !== null && c.max !== undefined && c.max !== null) targetStr = ` (Min: ${c.min} / Max: ${c.max})`;
                  else if (c.min !== undefined && c.min !== null) targetStr = ` (Min: ${c.min})`;
                  else if (c.max !== undefined && c.max !== null) targetStr = ` (Max: ${c.max})`;
                }
                return (
                  <div key={key} className="flex justify-between border-b border-gray-200/60 pb-1 print:border-gray-400">
                    <span className="text-gray-600 font-bold">{key}</span>
                    <span className="font-black text-gray-900 text-right">
                      {val.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} <span className="text-xs text-gray-500 font-medium">{targetStr}</span>
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Footer (Hidden in Print) */}
        <div className="mt-8 pt-6 border-t border-gray-200 flex flex-col sm:flex-row gap-4 justify-end print:hidden">
          <button onClick={generateCSV} className="px-6 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors shadow-sm flex items-center justify-center gap-2">
            📊 Exporter en CSV
          </button>
          <button onClick={handlePrint} className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
            🖨️ Imprimer la Fiche
          </button>
        </div>

      </div>
    </div>
  );
}
