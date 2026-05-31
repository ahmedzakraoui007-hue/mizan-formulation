"use client";

import { useUser } from "@clerk/nextjs";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Database, Languages, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useI18n, type Locale } from "@/lib/i18n";
import { apiUrl } from "@/lib/api";

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useUser();
  const { locale, setLocale, t } = useI18n();
  const [companyName, setCompanyName] = useState("");
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const defaultName = user?.fullName || "Mizan Workspace";
    setCompanyName(defaultName);
  }, [user]);

  const tutorialSteps = useMemo(() => [
    {
      icon: ShieldCheck,
      title: t("stepTenant"),
      body: t("stepTenantText"),
      accent: "text-emerald-600 bg-emerald-50 border-emerald-100",
    },
    {
      icon: Database,
      title: t("stepData"),
      body: t("stepDataText"),
      accent: "text-blue-600 bg-blue-50 border-blue-100",
    },
    {
      icon: Zap,
      title: t("stepSolver"),
      body: t("stepSolverText"),
      accent: "text-amber-600 bg-amber-50 border-amber-100",
    },
  ], [t]);

  const bootstrap = async (complete = false) => {
    setSaving(true);
    setError(null);
    try {
      const bootstrapRes = await fetch(apiUrl("/api/tenant/bootstrap"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: companyName || "Mizan Workspace", locale }),
      });
      if (!bootstrapRes.ok) {
        const payload = await bootstrapRes.json().catch(() => ({}));
        throw new Error(payload.detail || "Impossible d'initialiser votre espace.");
      }

      if (complete) {
        const doneRes = await fetch(apiUrl("/api/tenant/me"), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ onboarding_completed: true, locale, name: companyName || "Mizan Workspace" }),
        });
        if (!doneRes.ok) {
          const payload = await doneRes.json().catch(() => ({}));
          throw new Error(payload.detail || "Impossible de terminer l'onboarding.");
        }
        router.replace("/");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-emerald-600">Mizan Formulation</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">{t("welcomeTitle")}</h1>
            <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-slate-500">{t("welcomeSubtitle")}</p>
          </div>
          <div className="hidden h-16 w-16 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600 md:flex">
            <Sparkles className="h-8 w-8" />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <Building2 className="h-5 w-5 text-slate-700" />
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">{t("workspace")}</h2>
            </div>

            <label className="mb-5 block">
              <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500">{t("companyName")}</span>
              <input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">
                <Languages className="h-4 w-4" /> {t("language")}
              </span>
              <select
                value={locale}
                onChange={(event) => setLocale(event.target.value as Locale)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
            </label>

            <button
              onClick={() => bootstrap(false)}
              disabled={saving}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              <Database className="h-4 w-4" />
              {t("startTutorial")}
            </button>
            {error && (
              <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {error}
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">{t("onboarding")}</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">{tutorialSteps[step].title}</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                {step + 1} / {tutorialSteps.length}
              </span>
            </div>

            {tutorialSteps.map((item, index) => {
              const Icon = item.icon;
              const active = index === step;
              return (
                <button
                  key={item.title}
                  onClick={() => setStep(index)}
                  className={`mb-3 flex w-full items-start gap-4 rounded-xl border p-4 text-left transition ${
                    active ? item.accent : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-white"
                  }`}
                >
                  <Icon className="mt-1 h-5 w-5 shrink-0" />
                  <span>
                    <span className="block text-sm font-black">{item.title}</span>
                    <span className="mt-1 block text-sm leading-6 opacity-80">{item.body}</span>
                  </span>
                </button>
              );
            })}

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setStep((value) => Math.max(0, value - 1))}
                disabled={step === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("previous")}
              </button>

              {step < tutorialSteps.length - 1 ? (
                <button
                  onClick={() => setStep((value) => Math.min(tutorialSteps.length - 1, value + 1))}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700"
                >
                  {t("next")}
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => bootstrap(true)}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {t("completeOnboarding")}
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
