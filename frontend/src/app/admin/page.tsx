"use client";

import { Activity, AlertTriangle, Clock3, ListChecks, ServerCrash, ShieldCheck } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import PageLoader from "@/components/PageLoader";
import { canViewAdmin, useTenantRole } from "@/lib/tenantRole";
import { apiUrl } from "@/lib/api";

interface MonitoringSummary {
  total_optimization_runs: number;
  infeasible_runs: number;
  infeasibility_rate: number;
  average_solver_time_ms: number;
  api_errors_24h: number;
}

interface OptimizationRun {
  id: number;
  status: string;
  total_factory_cost_tnd: number | null;
  recipe_count: number;
  ingredient_count: number;
  duration_ms: number;
  error: string | null;
  created_at: string | null;
}

interface AuditLog {
  id: number;
  role: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string | null;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(value: number | null) {
  if (value == null) return "-";
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} TND`;
}

export default function AdminPage() {
  const tenantRole = useTenantRole();
  const canAdmin = canViewAdmin(tenantRole);
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);
  const [runs, setRuns] = useState<OptimizationRun[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAdminData = useCallback(async () => {
    if (!canAdmin) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [summaryRes, runsRes, auditRes] = await Promise.all([
        fetch(apiUrl("/api/monitoring/summary")),
        fetch(apiUrl("/api/optimization-runs?limit=8")),
        fetch(apiUrl("/api/audit-logs?limit=12")),
      ]);

      if (!summaryRes.ok || !runsRes.ok || !auditRes.ok) {
        throw new Error("Impossible de charger le monitoring admin.");
      }

      setSummary(await summaryRes.json());
      setRuns(await runsRes.json());
      setAuditLogs(await auditRes.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [canAdmin]);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  if (loading) return <PageLoader label="Chargement du monitoring..." />;

  if (!canAdmin) {
    return (
      <div className="min-h-screen p-10">
        <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <ShieldCheck className="h-9 w-9 text-slate-400" />
          <h1 className="mt-4 text-2xl font-black text-slate-900">Acces admin requis</h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Cette zone affiche les logs metier, les erreurs API et le suivi des optimisations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-10 pb-24">
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900">
            <ShieldCheck className="h-8 w-8 text-emerald-600" /> Centre admin
          </h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Monitoring production, historique solveur et audit trail tenant.
          </p>
        </div>
        <button
          onClick={fetchAdminData}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          Actualiser
        </button>
      </div>

      {error && (
        <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Activity className="h-5 w-5 text-emerald-600" />
          <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-400">Optimisations</p>
          <p className="mt-1 text-3xl font-black text-slate-900">{summary?.total_optimization_runs ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-400">Infaisabilite</p>
          <p className="mt-1 text-3xl font-black text-slate-900">{summary?.infeasibility_rate ?? 0}%</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Clock3 className="h-5 w-5 text-blue-600" />
          <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-400">Temps solveur</p>
          <p className="mt-1 text-3xl font-black text-slate-900">{Math.round(summary?.average_solver_time_ms ?? 0)} ms</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <ServerCrash className="h-5 w-5 text-red-600" />
          <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-400">Erreurs API 24h</p>
          <p className="mt-1 text-3xl font-black text-slate-900">{summary?.api_errors_24h ?? 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
              <Activity className="h-5 w-5 text-emerald-600" /> Historique optimisations
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-400">
                <tr>
                  <th className="px-5 py-3 text-left">Date</th>
                  <th className="px-5 py-3 text-left">Statut</th>
                  <th className="px-5 py-3 text-right">Cout</th>
                  <th className="px-5 py-3 text-right">Temps</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className="px-5 py-4 font-semibold text-slate-600">{formatDate(run.created_at)}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${run.status === "optimal" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-black text-slate-900">{formatMoney(run.total_factory_cost_tnd)}</td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-500">{Math.round(run.duration_ms)} ms</td>
                  </tr>
                ))}
                {runs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm font-semibold text-slate-400">
                      Aucun run solveur enregistre.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
              <ListChecks className="h-5 w-5 text-indigo-600" /> Audit trail
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900">{log.action}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">
                    {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ""} par {log.role}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-bold text-slate-400">{formatDate(log.created_at)}</span>
              </div>
            ))}
            {auditLogs.length === 0 && (
              <div className="p-10 text-center text-sm font-semibold text-slate-400">
                Aucun evenement metier enregistre.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
