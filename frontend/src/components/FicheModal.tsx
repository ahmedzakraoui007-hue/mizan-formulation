"use client";

import React, { useState } from "react";
import { saveAs } from "file-saver";
import { X, FileSpreadsheet, Share2, Printer } from "lucide-react";
import { isNutrientSpecificToSpecies, getNutrientUnit, getTopNutrients } from "@/utils/nutrientUtils";

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
      csv += `"${ing.name}",${Math.round(ing.percentage * 10)},${ing.tons.toFixed(2)},${Math.round(ing.percentage)}\n`;
    });

    csv += `\nValeurs Nutritionnelles,Atteint,Unité\n`;
    getTopNutrients(report.nutrients, originalConstraints, species)
      .forEach(([key, val]) => {
        csv += `"${key}",${val.toFixed(2)},"${getNutrientUnit(key)}"\n`;
      });

    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csv], { type: "text/csv;charset=utf-8" });
    const fileName = `Fiche_${report.name.replace(/[^a-zA-Z0-9_-]/g, "_")}_${now.toISOString().slice(0, 10)}.csv`;
    saveAs(blob, fileName);
  };

  const handlePrint = () => {
    window.print();
  };

  const [sharing, setSharing] = useState(false);

  const shareToWhatsApp = async () => {
    setSharing(true);
    try {
      const el = document.getElementById(`modal-pdf-template`);
      if (!el) return;

      const { default: html2canvas } = await import("html2canvas");
      const { default: jsPDF } = await import("jspdf");

      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const pdfBlob = pdf.output("blob");
      const file = new File([pdfBlob], `Fiche_${report.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`, { type: "application/pdf" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Fiche de Fabrication - ${report.name}`,
          text: `Voici la fiche de fabrication pour ${report.name}`,
        });
      } else {
        pdf.save(`Fiche_${report.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
        alert("Votre appareil ne supporte pas le partage direct de fichiers PDF via WhatsApp. Le PDF a été téléchargé, vous pouvez l'envoyer manuellement en pièce jointe.");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la génération du PDF pour WhatsApp.");
    } finally {
      setSharing(false);
    }
  };

  const hrLine = "border-t border-gray-300 my-6";

  const printStyles = `
    @media print {
      @page {
        margin: 15mm;
        size: auto;
      }
      .break-inside-avoid {
        break-inside: avoid;
      }
      body {
        background: white !important;
      }
    }
  `;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 print:bg-white print:relative print:z-0 print:block overflow-y-auto pt-10 pb-10 print:p-0">
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />
      <div className="bg-white rounded-2xl shadow-2xl w-11/12 max-w-4xl p-10 max-h-none print:shadow-none print:w-full print:p-0 relative my-auto">

        {/* Close Button (Hidden in Print) */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors print:hidden"
        >
          <X className="w-5 h-5" />
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
                <td className="py-2.5 px-4 text-right font-medium">{Math.round(ing.percentage * 10).toLocaleString("fr-FR")} kg</td>
                <td className="py-2.5 px-4 text-right text-gray-600 font-medium">{ing.tons.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t</td>
                <td className="py-2.5 px-4 text-right font-black text-blue-700">{Math.round(ing.percentage)} %</td>
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
            {getTopNutrients(report.nutrients, originalConstraints, species)
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
                      {val.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
                      <span className="text-[10px] text-gray-400 ml-1">{getNutrientUnit(key)}</span>
                      <span className="text-xs text-gray-500 font-medium">{targetStr}</span>
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Footer (Hidden in Print) */}
        <div className="mt-8 pt-6 border-t border-gray-200 flex flex-col sm:flex-row gap-4 justify-end print:hidden">
          <button onClick={generateCSV} className="px-6 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-colors shadow-sm flex items-center justify-center gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Exporter en CSV
          </button>
          <button onClick={shareToWhatsApp} disabled={sharing} className={`px-6 py-2.5 rounded-xl text-white font-bold transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 ${sharing ? "bg-emerald-400 cursor-not-allowed" : "bg-emerald-500 hover:bg-emerald-600"}`}>
            {sharing ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white border-r-transparent animate-spin" />
                Préparation...
              </>
            ) : <span className="flex items-center gap-2"><Share2 className="w-4 h-4" /> WhatsApp</span>}
          </button>
          <button onClick={handlePrint} className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2">
            <Printer className="w-4 h-4" /> Imprimer la Fiche
          </button>
        </div>

        {/* Hidden PDF Template for WhatsApp PDF generation */}
        <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
          <div id="modal-pdf-template" style={{ width: '800px', backgroundColor: 'white', padding: '40px', color: 'black', fontFamily: 'sans-serif' }}>
            <div style={{ borderBottom: '2px solid #111', paddingBottom: '15px', marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <h1 style={{ fontSize: '28px', fontWeight: '900', margin: '0 0 10px 0', color: '#111827' }}>Mizan Formulation</h1>
                <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#4b5563' }}>Fiche Technique Officielle</h2>
              </div>
              <div style={{ textAlign: 'right', fontSize: '14px', color: '#374151' }}>
                <p style={{ margin: '0 0 4px 0' }}><strong>Espèce :</strong> {species || "Générale"}</p>
                <p style={{ margin: 0 }}><strong>Date :</strong> {new Date().toLocaleDateString('fr-FR')}</p>
              </div>
            </div>

            <div style={{ backgroundColor: '#f3f4f6', padding: '15px', borderRadius: '8px', marginBottom: '30px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>Recette : {report.name}</h3>
            </div>

            <div style={{ marginBottom: '35px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', color: '#111827' }}>1. Composition (Matières Premières)</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>Ingrédient</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>Inclusion (%)</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>Quantité (kg/T)</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedIngredients.map((ing, i) => (
                    <tr key={ing.name} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#1f2937' }}>{ing.name}</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid #e5e7eb', color: '#374151' }}>{Math.round(ing.percentage)} %</td>
                      <td style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold', color: '#059669' }}>{Math.round(ing.percentage * 10)} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', color: '#111827' }}>2. Valeurs Nutritionnelles Garanties</h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>Paramètre / Nutriment</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>Valeur Calculée</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', color: '#4b5563' }}>Cible Min/Max</th>
                  </tr>
                </thead>
                <tbody>
                  {getTopNutrients(report.nutrients, originalConstraints, species)
                    .map(([key, val], i) => {
                      const cons = originalConstraints?.[key];
                      let cibleStr = "—";
                      if (cons) {
                        if (cons.exact !== undefined) cibleStr = `Exact: ${cons.exact}`;
                        else if (cons.min !== undefined && cons.max !== undefined) cibleStr = `${cons.min} - ${cons.max}`;
                        else if (cons.min !== undefined) cibleStr = `Min: ${cons.min}`;
                        else if (cons.max !== undefined) cibleStr = `Max: ${cons.max}`;
                      }
                      return (
                        <tr key={key} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                          <td style={{ padding: '10px 12px', borderBottom: '1px solid #e5e7eb', fontWeight: '500', color: '#1f2937' }}>{key}</td>
                          <td style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid #e5e7eb', fontWeight: 'bold', color: '#2563eb' }}>
                            {val.toFixed(2)} <span style={{ fontSize: '9px', color: '#9ca3af' }}>{getNutrientUnit(key)}</span>
                          </td>
                          <td style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid #e5e7eb', color: '#6b7280' }}>
                            {cibleStr} {cons ? <span style={{ fontSize: '9px' }}>{getNutrientUnit(key)}</span> : ""}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div style={{ paddingTop: '20px', borderTop: '2px solid #111', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>Document généré automatiquement par Mizan Formulation Engine.</p>
              <p style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#111827' }}>Coût Total : <span style={{ color: '#2563eb' }}>{report.cost_tnd.toFixed(2)} TND</span> · <span style={{ color: '#059669' }}>{(report.cost_tnd / report.demand_tons).toFixed(2)} TND/T</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
