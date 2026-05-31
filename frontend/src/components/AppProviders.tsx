"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { I18nProvider } from "@/lib/i18n";
import PlatformTranslator from "@/lib/platformTranslations";
import PageLoader from "@/components/PageLoader";
import { persistTenantRole } from "@/lib/tenantRole";
import { API_BASE_URL, apiUrl } from "@/lib/api";

function ApiAuthBridge({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [checkedTenant, setCheckedTenant] = useState(false);
  const [tenantError, setTenantError] = useState<string | null>(null);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (!rawUrl.startsWith(API_BASE_URL)) return originalFetch(input, init);

      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if (!headers.has("Authorization") && isLoaded && isSignedIn) {
        const token = await getToken();
        if (token) headers.set("Authorization", `Bearer ${token}`);
      }
      if (!headers.has("X-Tenant-ID") && (!isLoaded || !isSignedIn)) {
        headers.set("X-Tenant-ID", "dev");
      }

      return originalFetch(input, { ...init, headers });
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || pathname === "/onboarding") return;

    let cancelled = false;
    const checkTenant = async () => {
      try {
        setTenantError(null);
        const token = await getToken();
        const res = await fetch(apiUrl("/api/tenant/me"), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          if (!cancelled) {
            setTenantError(
              res.status === 401
                ? "La session Clerk est active côté frontend, mais le backend refuse le token. Vérifiez les variables CLERK_JWKS_URL et CLERK_ISSUER sur Render, puis redéployez."
                : detail.detail || "Impossible de charger votre espace Mizan."
            );
          }
          return;
        }
        const tenant = await res.json();
        if (cancelled) return;
        const savedLocale = tenant.locale;
        if (savedLocale) {
          window.localStorage.setItem("mizan-locale", savedLocale);
          window.dispatchEvent(new CustomEvent("mizan-locale-change"));
        }
        persistTenantRole(tenant.role);
        if (!tenant.onboarding_completed) router.replace("/onboarding");
      } finally {
        if (!cancelled) setCheckedTenant(true);
      }
    };

    checkTenant();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, pathname, router]);

  if (!isLoaded) {
    return <PageLoader fullscreen />;
  }

  if (!isSignedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-black text-slate-950">Connexion requise</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
            Connectez-vous pour charger votre espace, vos matières premières et vos formules.
          </p>
          <SignInButton mode="redirect">
            <button className="mt-6 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-700">
              Se connecter
            </button>
          </SignInButton>
        </div>
      </div>
    );
  }

  if (isSignedIn && !checkedTenant && pathname !== "/onboarding") {
    return <PageLoader fullscreen />;
  }

  if (tenantError && pathname !== "/onboarding") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="max-w-2xl rounded-2xl border border-red-100 bg-white p-8 shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-red-500">Authentification API</p>
          <h1 className="mt-3 text-2xl font-black text-slate-950">Mizan ne peut pas charger votre espace</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{tenantError}</p>
          <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm font-mono text-slate-700">
            CLERK_JWKS_URL=https://votre-domaine-clerk/.well-known/jwks.json<br />
            CLERK_ISSUER=https://votre-domaine-clerk
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <PlatformTranslator />
      <ApiAuthBridge>{children}</ApiAuthBridge>
    </I18nProvider>
  );
}
