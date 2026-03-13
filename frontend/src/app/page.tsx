"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface DashboardStats {
  total_ingredients: number;
  total_recipes: number;
}

export default function HomePage() {
  const { user } = useUser();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/dashboard/stats`)
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => setStats({ total_ingredients: 0, total_recipes: 0 }))
      .finally(() => setLoadingStats(false));
  }, []);

  const firstName = user?.firstName ?? user?.fullName?.split(" ")[0] ?? "Directeur";

  const kpis = [
    {
      icon: "🌾",
      label: "Matières Premières Actives",
      value: loadingStats ? "—" : stats?.total_ingredients ?? 0,
      sub: "dans l'inventaire",
      accent: "blue",
      href: "/ingredients",
    },
    {
      icon: "📋",
      label: "Formules Master",
      value: loadingStats ? "—" : stats?.total_recipes ?? 0,
      sub: "en production",
      accent: "indigo",
      href: "/recipes",
    },
    {
      icon: "⚡",
      label: "Statut du Solveur",
      value: "GLOP Actif",
      sub: "En ligne",
      accent: "emerald",
      href: "/optimization",
      statusDot: true,
    },
  ];

  const actions = [
    {
      icon: "📋",
      title: "Créer une nouvelle formule",
      desc: "Définir tonnage, rendement et cibles nutritionnelles",
      href: "/recipes",
      accent: "blue",
    },
    {
      icon: "🌾",
      title: "Mettre à jour les prix",
      desc: "Éditer les coûts et valeurs nutritives des matières premières",
      href: "/ingredients",
      accent: "amber",
    },
    {
      icon: "⚡",
      title: "Lancer la production",
      desc: "Optimiser le mix multi-formule et générer les bons de commande",
      href: "/optimization",
      accent: "emerald",
    },
  ];

  const accentMap: Record<string, { card: string; icon: string; badge: string; action: string }> = {
    blue:    { card: "border-blue-100 bg-blue-50/30",    icon: "bg-blue-100 text-blue-700",    badge: "bg-blue-600 text-white",    action: "hover:border-blue-300 hover:bg-blue-50/50" },
    indigo:  { card: "border-indigo-100 bg-indigo-50/30", icon: "bg-indigo-100 text-indigo-700", badge: "bg-indigo-600 text-white",  action: "hover:border-indigo-300 hover:bg-indigo-50/50" },
    emerald: { card: "border-emerald-100 bg-emerald-50/30", icon: "bg-emerald-100 text-emerald-700", badge: "bg-emerald-600 text-white", action: "hover:border-emerald-300 hover:bg-emerald-50/50" },
    amber:   { card: "border-amber-100 bg-amber-50/30",   icon: "bg-amber-100 text-amber-700",   badge: "bg-amber-600 text-white",   action: "hover:border-amber-300 hover:bg-amber-50/50" },
  };

  return (
    <div className="p-10 max-w-6xl mx-auto animate-in fade-in duration-500 pb-24">

      {/* ── Header ── */}
      <div className="mb-10">
        <h1 className="text-4xl font-black text-gray-900 tracking-tight">
          Bonjour, {firstName} 👋
        </h1>
        <p className="text-gray-500 mt-2 text-lg">
          Voici l'état de votre usine aujourd'hui.
        </p>
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
          <span>
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <section className="mb-10">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
          Indicateurs Clés
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {kpis.map((kpi) => {
            const a = accentMap[kpi.accent];
            return (
              <Link
                key={kpi.label}
                href={kpi.href}
                className={`group relative bg-white border rounded-2xl p-6 shadow-sm transition-all duration-200 ${a.card} ${a.action}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${a.icon}`}>
                    {kpi.icon}
                  </div>
                  {kpi.statusDot && (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      En ligne
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">
                  {kpi.label}
                </p>
                <p className="text-4xl font-black text-gray-900 tracking-tight">
                  {kpi.value}
                </p>
                <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 text-lg">
                  →
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Quick Actions ── */}
      <section>
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
          Raccourcis Rapides
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {actions.map((act) => {
            const a = accentMap[act.accent];
            return (
              <Link
                key={act.title}
                href={act.href}
                className={`group bg-white border rounded-2xl p-6 shadow-sm flex flex-col gap-3 transition-all duration-200 ${a.action} border-gray-200`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${a.icon} transition-transform group-hover:scale-110 duration-200`}>
                  {act.icon}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-base leading-snug">
                    {act.title}
                  </p>
                  <p className="text-gray-500 text-sm mt-1 leading-relaxed">
                    {act.desc}
                  </p>
                </div>
                <span className={`mt-auto self-start px-3 py-1.5 rounded-lg text-xs font-bold ${a.badge} transition-transform group-hover:translate-x-1 duration-200`}>
                  Accéder →
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
