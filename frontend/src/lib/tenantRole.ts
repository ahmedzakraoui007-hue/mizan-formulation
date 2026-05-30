"use client";

import { useEffect, useState } from "react";

export type TenantRole = "admin" | "formulator" | "purchasing" | "viewer";

const STORAGE_KEY = "mizan-role";

function normalizeRole(role: string | null): TenantRole {
  if (role === "formulator" || role === "purchasing" || role === "viewer") return role;
  return "admin";
}

export function persistTenantRole(role: string | null | undefined) {
  if (typeof window === "undefined" || !role) return;
  window.localStorage.setItem(STORAGE_KEY, normalizeRole(role));
  window.dispatchEvent(new CustomEvent("mizan-role-change"));
}

export function useTenantRole() {
  const [role, setRole] = useState<TenantRole>(() => {
    if (typeof window === "undefined") return "admin";
    return normalizeRole(window.localStorage.getItem(STORAGE_KEY));
  });

  useEffect(() => {
    const syncRole = () => setRole(normalizeRole(window.localStorage.getItem(STORAGE_KEY)));
    window.addEventListener("mizan-role-change", syncRole);
    window.addEventListener("storage", syncRole);
    return () => {
      window.removeEventListener("mizan-role-change", syncRole);
      window.removeEventListener("storage", syncRole);
    };
  }, []);

  return role;
}

export function canRunOptimization(role: TenantRole) {
  return role === "admin" || role === "formulator" || role === "purchasing";
}

export function canManageIngredients(role: TenantRole) {
  return role === "admin" || role === "formulator";
}

export function canManageRecipes(role: TenantRole) {
  return role === "admin" || role === "formulator";
}

export function canUsePurchasing(role: TenantRole) {
  return role === "admin" || role === "purchasing";
}

export function canViewAdmin(role: TenantRole) {
  return role === "admin";
}
