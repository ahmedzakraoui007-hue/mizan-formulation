"use client";

import React, { useState } from "react";
import { saveAs } from "file-saver";
import { X, FileSpreadsheet, Share2, Printer } from "lucide-react";
import { buildWhatsAppMessage, buildWhatsAppUrl } from "@/lib/whatsAppShare";
import { buildRecipePdfBlob, recipePdfFileName } from "@/lib/recipePdf";
import type { ConstraintConfig, RecipeResult } from "@/lib/formulationTypes";
import { getNutrientUnit, getTopNutrients } from "@/utils/nutrientUtils";

interface FicheModalProps {
  report: RecipeResult;
  originalConstraints?: Record<string, ConstraintConfig>;
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
    csv += `Code Formule,${report.code || ""}\n`;
    csv += `Formule,${report.name}\n`;
    csv += `Tonnage final (t),${report.demand_tons}\n`;
    csv += `Matieres chargees (t),${report.raw_tons}\n`;
    csv += `Rendement (%),${report.process_yield_percent}\n`;
    csv += `Cout total (TND),${report.cost_tnd.toFixed(2)}\n`;
    csv += `Taille du sac (kg),${report.bag_size_kg}\n`;
    csv += `Cout par sac (TND),${report.cost_per_bag_tnd.toFixed(3)}\n\n`;

    csv += `Code,Matiere Premiere,Quantite (kg),Quantite (t),Proportion (%)\n`;
    sortedIngredients.forEach(ing => {
      csv += `"${ing.code || ""}","${ing.name}",${Math.round(ing.percentage * 10)},${ing.tons.toFixed(2)},${Math.round(ing.percentage)}\n`;
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

  const pdfFileName = recipePdfFileName(report, now);

  const generatePdfBlob = async () => {
    try {
      await document.fonts?.ready;
      return buildRecipePdfBlob(report, { originalConstraints, species, date: now });
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const shareToWhatsApp = async () => {
    setSharing(true);
    const whatsappTab = window.open("about:blank", "_blank");
    if (whatsappTab) {
      whatsappTab.document.write("<p style=\"font-family:sans-serif;padding:24px\">Preparation du PDF Mizan...</p>");
    }
    try {
      const pdfBlob = await generatePdfBlob();
      const file = typeof File !== "undefined"
        ? new File([pdfBlob], pdfFileName, { type: "application/pdf" })
        : null;

      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          const message = buildWhatsAppMessage(report, dateStr, { pdfFileName, pdfAttached: true });
          await navigator.share({
            files: [file],
            title: `Fiche de Fabrication - ${report.name}`,
            text: message,
          });
          whatsappTab?.close();
          return;
        } catch (shareErr) {
          if (shareErr instanceof DOMException && shareErr.name === "AbortError") {
            whatsappTab?.close();
            return;
          }
          console.warn("Native share failed, falling back to WhatsApp link.", shareErr);
        }
      }

      saveAs(pdfBlob, pdfFileName);
      const message = buildWhatsAppMessage(report, dateStr, { pdfFileName });
      const whatsappUrl = buildWhatsAppUrl(message);
      if (whatsappTab) {
        whatsappTab.location.replace(whatsappUrl);
      } else {
        window.location.assign(whatsappUrl);
      }
    } catch (err) {
      console.error(err);
      whatsappTab?.close();
      alert("Erreur lors de la génération du PDF pour WhatsApp.");
    } finally {
      setSharing(false);
    }
  };

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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Code Formule</p>
              <p className="text-xl font-black text-indigo-700 mt-1 font-mono">{report.code || "—"}</p>
              {report.version_tag && <p className="mt-1 text-xs font-black text-emerald-600">{report.version_tag}</p>}
            </div>
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
              <th className="py-3 px-4">Code</th>
              <th className="py-3 px-4">Matière Première</th>
              <th className="py-3 px-4 text-right">Quantité (kg)</th>
              <th className="py-3 px-4 text-right">Quantité (tonnes)</th>
              <th className="py-3 px-4 text-right">Proportion (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 mix-blend-multiply">
            {sortedIngredients.map((ing, idx) => (
              <tr key={idx} className={idx % 2 !== 0 ? "bg-gray-50/50 print:bg-transparent" : "print:bg-transparent"}>
                <td className="py-2.5 px-4 font-mono text-xs font-black text-indigo-700">{ing.code || "—"}</td>
                <td className="py-2.5 px-4 font-bold text-gray-900">{ing.name}</td>
                <td className="py-2.5 px-4 text-right font-medium">{Math.round(ing.percentage * 10).toLocaleString("fr-FR")} kg</td>
                <td className="py-2.5 px-4 text-right text-gray-600 font-medium">{ing.tons.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} t</td>
                <td className="py-2.5 px-4 text-right font-black text-blue-700">{Math.round(ing.percentage)} %</td>
              </tr>
            ))}
            <tr className="bg-gray-100 font-black text-gray-900 border-t-2 border-gray-300 print:bg-gray-200">
              <td className="py-3 px-4 uppercase text-xs tracking-wider" colSpan={2}>Total Charges</td>
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


      </div>
    </div>
  );
}
