import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import jwt
from fastapi import Depends, Header, HTTPException
from jwt import PyJWKClient


@dataclass(frozen=True)
class TenantContext:
    tenant_id: str
    user_id: str
    role: str
    claims: dict[str, Any]


CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL")
CLERK_ISSUER = os.getenv("CLERK_ISSUER")
ALLOW_DEV_TENANT = os.getenv("ALLOW_DEV_TENANT", "true").lower() == "true"

ROLE_ALIASES = {
    "org:admin": "admin",
    "admin": "admin",
    "administrator": "admin",
    "formulateur": "formulator",
    "formulator": "formulator",
    "nutritionist": "formulator",
    "achats": "purchasing",
    "purchasing": "purchasing",
    "buyer": "purchasing",
    "lecture_seule": "viewer",
    "lecture-seule": "viewer",
    "read_only": "viewer",
    "readonly": "viewer",
    "viewer": "viewer",
}


def _normalize_role(raw: Any) -> str:
    if raw is None or raw == "":
        return "admin"
    role = str(raw).strip().lower()
    return ROLE_ALIASES.get(role, role if role in {"admin", "formulator", "purchasing", "viewer"} else "viewer")


def _extract_role(claims: dict[str, Any]) -> str:
    metadata = claims.get("public_metadata") or claims.get("metadata") or {}
    unsafe_metadata = claims.get("unsafe_metadata") or {}
    return _normalize_role(
        claims.get("org_role")
        or claims.get("role")
        or metadata.get("role")
        or metadata.get("mizan_role")
        or unsafe_metadata.get("role")
    )


@lru_cache(maxsize=1)
def _jwk_client() -> PyJWKClient:
    if not CLERK_JWKS_URL:
        raise RuntimeError("CLERK_JWKS_URL is not configured")
    return PyJWKClient(CLERK_JWKS_URL)


def _decode_clerk_token(token: str) -> dict[str, Any]:
    signing_key = _jwk_client().get_signing_key_from_jwt(token)
    options = {"verify_aud": False}
    kwargs: dict[str, Any] = {"algorithms": ["RS256"], "options": options}
    if CLERK_ISSUER:
        kwargs["issuer"] = CLERK_ISSUER
    return jwt.decode(token, signing_key.key, **kwargs)


def get_tenant_context(
    authorization: str | None = Header(default=None),
    x_tenant_id: str | None = Header(default=None),
) -> TenantContext:
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        try:
            if CLERK_JWKS_URL:
                claims = _decode_clerk_token(token)
            elif ALLOW_DEV_TENANT:
                claims = jwt.decode(token, options={"verify_signature": False})
            else:
                raise HTTPException(status_code=500, detail="CLERK_JWKS_URL is not configured")
        except Exception as exc:
            raise HTTPException(status_code=401, detail="Invalid authentication token") from exc

        user_id = str(claims.get("sub") or "")
        tenant_id = str(claims.get("org_id") or user_id)
        if not user_id or not tenant_id:
            raise HTTPException(status_code=401, detail="Missing tenant claims")
        return TenantContext(tenant_id=tenant_id, user_id=user_id, role=_extract_role(claims), claims=claims)

    if ALLOW_DEV_TENANT:
        tenant_id = x_tenant_id or os.getenv("DEV_TENANT_ID", "dev")
        return TenantContext(tenant_id=tenant_id, user_id="dev-user", role="admin", claims={"dev": True})

    raise HTTPException(status_code=401, detail="Authentication required")


def require_role(*allowed_roles: str):
    allowed = set(allowed_roles)

    def dependency(tenant: TenantContext = Depends(get_tenant_context)) -> TenantContext:
        if tenant.role == "admin" or tenant.role in allowed:
            return tenant
        raise HTTPException(status_code=403, detail="Insufficient role permissions")

    return dependency
