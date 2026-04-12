"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Boxes, FileText, Activity, Hand, Factory, Zap, ChevronRight, BarChart3 } from "lucide-react";

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
      icon: <Boxes className="w-5 h-5" />,
      label: "Matières Premières Actives",
      value: loadingStats ? "—" : stats?.total_ingredients ?? 0,
      sub: "dans l'inventaire",
      accent: "blue",
      href: "/ingredients",
    },
    {
      icon: <FileText className="w-5 h-5" />,
      label: "Formules Master",
      value: loadingStats ? "—" : stats?.total_recipes ?? 0,
      sub: "en production",
      accent: "indigo",
      href: "/recipes",
    },
    {
      icon: <Activity className="w-5 h-5" />,
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
      icon: <FileText className="w-6 h-6" />,
      title: "Créer une nouvelle formule",
      desc: "Définir tonnage, rendement et cibles nutritionnelles",
      href: "/recipes",
      accent: "blue",
    },
    {
      icon: <Boxes className="w-6 h-6" />,
      title: "Mettre à jour les stocks",
      desc: "Éditer les coûts et valeurs nutritives des matières premières",
      href: "/ingredients",
      accent: "amber",
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Lancer la production",
      desc: "Optimiser le mix multi-formule et générer les bons de commande",
      href: "/optimization",
      accent: "emerald",
    },
  ];

  const accentMap: Record<string, { card: string; iconBox: string; iconColor: string; badge: string; action: string }> = {
    blue: { card: "border-blue-100/50 bg-gradient-to-br from-blue-50/40 to-white", iconBox: "bg-blue-100/80 ring-1 ring-blue-100 shadow-inner", iconColor: "text-blue-600", badge: "bg-blue-600 text-white shadow-blue-500/20", action: "hover:border-blue-300 hover:shadow-blue-500/10" },
    indigo: { card: "border-indigo-100/50 bg-gradient-to-br from-indigo-50/40 to-white", iconBox: "bg-indigo-100/80 ring-1 ring-indigo-100 shadow-inner", iconColor: "text-indigo-600", badge: "bg-indigo-600 text-white shadow-indigo-500/20", action: "hover:border-indigo-300 hover:shadow-indigo-500/10" },
    emerald: { card: "border-emerald-100/50 bg-gradient-to-br from-emerald-50/40 to-white", iconBox: "bg-emerald-100/80 ring-1 ring-emerald-100 shadow-inner", iconColor: "text-emerald-600", badge: "bg-emerald-600 text-white shadow-emerald-500/20", action: "hover:border-emerald-300 hover:shadow-emerald-500/10" },
    amber: { card: "border-amber-100/50 bg-gradient-to-br from-amber-50/40 to-white", iconBox: "bg-amber-100/80 ring-1 ring-amber-100 shadow-inner", iconColor: "text-amber-600", badge: "bg-amber-600 text-white shadow-amber-500/20", action: "hover:border-amber-300 hover:shadow-amber-500/10" },
  };

  return (
    <div className="relative min-h-screen">
      {/* Absolute Gradient Background Effect for Genius SaaS Look */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100/40 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-emerald-50/40 via-transparent to-transparent pointer-events-none" />

      <div className="relative p-10 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24 z-10">

        {/* ── Header ── */}
        <div className="mb-14">
          <h1 className="text-[2.5rem] font-black text-slate-900 tracking-tight flex items-center gap-3">
            Bonjour, {firstName} <Hand className="w-8 h-8 text-amber-400 rotate-12" />
          </h1>
          <p className="text-slate-500 mt-3 text-lg font-medium tracking-wide">
            Voici l'état opérationnel de votre usine aujourd'hui.
          </p>
          <div className="mt-5 flex items-center gap-2.5 text-xs font-bold uppercase tracking-widest text-slate-400 bg-white/50 backdrop-blur-md px-4 py-2 rounded-full w-fit border border-slate-200/60 shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse inline-block" />
            <span>
              {new Date().toLocaleDateString("fr-FR", {
                weekday: "long", day: "numeric", month: "long", year: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <section className="mb-14">
          <div className="flex items-center gap-2 mb-6 text-slate-800">
            <BarChart3 className="w-5 h-5" />
            <h2 className="text-sm font-black uppercase tracking-widest">
              Indicateurs Clés
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {kpis.map((kpi) => {
              const a = accentMap[kpi.accent];
              return (
                <Link
                  key={kpi.label}
                  href={kpi.href}
                  className={`group relative bg-white/60 backdrop-blur-3xl border rounded-3xl p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 ${a.card} ${a.action}`}
                >
                  <div className="flex items-start justify-between mb-5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${a.iconBox} ${a.iconColor}`}>
                      {kpi.icon}
                    </div>
                    {kpi.statusDot && (
                      <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)] animate-pulse" />
                        En ligne
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px] font-black uppercase tracking-widest mb-1.5 opacity-80">
                    {kpi.label}
                  </p>
                  <p className="text-4xl font-black text-slate-900 tracking-tighter">
                    {kpi.value}
                  </p>
                  <p className="text-[13px] text-slate-500 mt-2 font-medium">{kpi.sub}</p>
                  <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300">
                    <ChevronRight className="w-6 h-6" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ── Quick Actions ── */}
        <section>
          <div className="flex items-center gap-2 mb-6 text-slate-800">
            <Factory className="w-5 h-5" />
            <h2 className="text-sm font-black uppercase tracking-widest">
              Raccourcis Rapides
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {actions.map((act) => {
              const a = accentMap[act.accent];
              return (
                <Link
                  key={act.title}
                  href={act.href}
                  className={`group relative bg-white/60 backdrop-blur-3xl border rounded-3xl p-7 shadow-[0_8px_20px_rgb(0,0,0,0.03)] flex flex-col gap-4 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 overflow-hidden ${a.card} ${a.action}`}
                >
                  <div className="absolute -top-10 -right-10 opacity-5 pointer-events-none rotate-12 group-hover:rotate-0 group-hover:scale-125 transition-transform duration-700">
                    <span className={`[&>svg]:w-32 [&>svg]:h-32 ${a.iconColor}`}>
                      {act.icon}
                    </span>
                  </div>

                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${a.iconBox} ${a.iconColor} shadow-md transition-transform group-hover:scale-110 duration-300`}>
                    {act.icon}
                  </div>
                  <div className="z-10 mt-2">
                    <p className="font-extrabold text-slate-900 text-[1.1rem] leading-snug tracking-tight">
                      {act.title}
                    </p>
                    <p className="text-slate-500 text-[13px] mt-2 leading-relaxed font-medium">
                      {act.desc}
                    </p>
                  </div>
                  <div className="mt-5 flex items-center gap-2 p-0">
                    <span className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-md transition-all group-hover:translate-x-1.5 duration-300 flex items-center gap-1.5 ${a.badge}`}>
                      Accéder <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
