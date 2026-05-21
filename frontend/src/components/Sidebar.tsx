"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { Activity, Boxes, FileText, LayoutDashboard, TrendingUp } from "lucide-react";
import { useI18n, type Locale } from "@/lib/i18n";

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const { locale, setLocale, t } = useI18n();

  const links = [
    { href: "/", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/ingredients", label: t("ingredients"), icon: Boxes },
    { href: "/recipes", label: t("recipes"), icon: FileText },
    { href: "/optimization", label: t("optimization"), icon: Activity },
    { href: "/purchasing", label: t("purchasing"), icon: TrendingUp },
  ];

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 text-slate-300 flex flex-col h-screen fixed top-0 left-0 overflow-y-auto shadow-2xl z-50">
      <div className="p-6">
        <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
          <span className="text-emerald-400">MIZAN</span> FORMULATION
        </h1>
        <p className="text-xs text-gray-400 mt-1 uppercase font-bold tracking-widest">SaaS ERP</p>
      </div>

      <nav className="flex-1 px-4 mt-8 space-y-2">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname?.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold ${
                isActive
                  ? "bg-slate-800 text-white shadow-md shadow-slate-900/10 border border-slate-700/50"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"
              }`}
            >
              <link.icon className={`w-5 h-5 ${isActive ? "text-emerald-400" : "text-slate-500"}`} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto space-y-3">
        <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-black">
          {t("language")}
          <select
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
          >
            <option value="fr">Francais</option>
            <option value="en">English</option>
            <option value="ar">العربية</option>
          </select>
        </label>

        <div className="flex items-center gap-3 bg-gray-800 rounded-xl px-3 py-3">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-9 h-9 ring-2 ring-emerald-500/40",
              },
            }}
          />
          <div className="flex flex-col min-w-0">
            <span className="text-white text-xs font-bold truncate">
              {user?.fullName ?? user?.firstName ?? "Chargement..."}
            </span>
            <span className="text-gray-400 text-[10px] truncate">
              {user?.primaryEmailAddress?.emailAddress ?? ""}
            </span>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-4 text-xs text-gray-400 font-medium">
          Mizan ERP v2.1 <br />
          <span className="text-gray-500">Multi-Tenant Optimization Engine</span>
        </div>
      </div>
    </aside>
  );
}
