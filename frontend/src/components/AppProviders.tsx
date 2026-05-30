"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { I18nProvider } from "@/lib/i18n";
import PlatformTranslator from "@/lib/platformTranslations";
import PageLoader from "@/components/PageLoader";
import { persistTenantRole } from "@/lib/tenantRole";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function ApiAuthBridge({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [checkedTenant, setCheckedTenant] = useState(false);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (!rawUrl.startsWith(API)) return originalFetch(input, init);

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
        const token = await getToken();
        const res = await fetch(`${API}/api/tenant/me`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
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

  if (isLoaded && isSignedIn && !checkedTenant && pathname !== "/onboarding") {
    return <PageLoader fullscreen />;
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
