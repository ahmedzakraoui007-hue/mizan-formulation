"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const links = [
    { href: "/ingredients", label: "🌾 Matières Premières" },
    { href: "/recipes", label: "📋 Formules" },
    { href: "/optimization", label: "⚡ Optimisation" },
    { href: "/purchasing", label: "💰 Achats & Stratégie" },
  ];

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col h-screen fixed top-0 left-0 overflow-y-auto shadow-xl z-50">
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
              className={`flex items-center px-4 py-3 rounded-xl transition-all font-semibold ${
                isActive
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto">
        <div className="bg-gray-800 rounded-xl p-4 text-xs text-gray-400 font-medium">
          Mizan ERP v2.0 <br />
          <span className="text-gray-500">Multi-Blend Optimization Engine</span>
        </div>
      </div>
    </aside>
  );
}
