# Mizan Formulation

Plateforme d'optimisation least-cost formulation pour les usines d'aliments de betail.

## Demarrage rapide

### Backend

```bash
cd backend
python -m pip install -r requirements.txt
alembic upgrade head
python -m uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

## Multi-tenant et securite

Le frontend utilise Clerk pour l'authentification. Le backend isole les donnees par tenant avec `org_id` Clerk si disponible, sinon l'identifiant utilisateur.

Les roles applicatifs supportes sont :

- `admin` : administration tenant, audit, monitoring et toutes les actions metier.
- `formulator` : ingredients, formules, optimisation et diagnostic.
- `purchasing` : optimisation, achats, strategie et insights.
- `viewer` : lecture seule.

Le role peut venir des claims Clerk `org_role`, `role`, `public_metadata.role`, `public_metadata.mizan_role` ou `unsafe_metadata.role`.

Variables backend recommandees :

```bash
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
GEMINI_API_KEY=...
CLERK_JWKS_URL=https://votre-domaine-clerk/.well-known/jwks.json
CLERK_ISSUER=https://votre-domaine-clerk
FRONTEND_URL=https://votre-frontend.example
ALLOW_DEV_TENANT=false
RUN_MIGRATIONS_ON_STARTUP=false
```

En local, `ALLOW_DEV_TENANT=true` permet de tester avec `X-Tenant-ID: dev` si Clerk/JWKS n'est pas encore configure.

## Migrations

Les migrations de schema sont gerees par Alembic. Le backend ne lance plus `Base.metadata.create_all` au demarrage de l'application.

```bash
cd backend
alembic upgrade head
```

Sur Render, la commande de demarrage lance `alembic upgrade head` avant Uvicorn. Gardez `RUN_MIGRATIONS_ON_STARTUP=false` pour eviter de lancer les migrations deux fois.

## Tests et qualite

Backend :

```bash
python -m pytest backend/tests
```

Frontend :

```bash
cd frontend
npm run lint
npm run test
npm run build
```

## Observabilite

Le backend conserve :

- un audit trail par tenant via `/api/audit-logs` ;
- un historique d'optimisation via `/api/optimization-runs` ;
- un resume monitoring via `/api/monitoring/summary` avec temps solveur moyen, taux d'infaisabilite et erreurs API recentes.

## Onboarding

Apres inscription, l'utilisateur est redirige vers `/onboarding` pour choisir la langue, nommer son espace et initialiser les donnees de depart dans son tenant.
