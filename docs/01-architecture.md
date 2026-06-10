# System Architecture

National Birth Defects Surveillance Project (NBDSP) Dashboard

## 1. Goals & constraints

- **Integration-heavy + analytics-driven**, not simple CRUD.
- Ingest **FHIR R4** data, normalize it, store it, and surface it through
  dashboards with **role-based** views.
- Ship on **Firebase** now, structured to migrate to **GCP** later.
- Production-quality, but avoid overengineering.

## 2. Layered architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js App Router · React · Tailwind)                 │
│  Atomic components → primitives / layout / analytics / pages      │
│  State: React Query (server cache) + local component state        │
└───────────────▲───────────────────────────────┬──────────────────┘
                │ httpOnly session cookie         │ JSON over fetch
┌───────────────┴───────────────────────────────▼──────────────────┐
│  BACKEND (Next.js API routes = middleware layer)                  │
│  withAuth() → session verify → RBAC → audit → handler             │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐    │
│  │ Auth/session │  │ Data/repo     │  │ Ingestion pipeline   │    │
│  │ (cookies)    │  │ (Firestore)   │  │ fetch→validate→      │    │
│  └──────────────┘  └───────────────┘  │ transform→store      │    │
│  ┌─────────────────────────────────┐  └──────────────────────┘    │
│  │ FHIR transformation layer       │                              │
│  │ types · validate (zod) · map    │                              │
│  └─────────────────────────────────┘                              │
└───────────────▲───────────────────────────────┬──────────────────┘
                │ Admin SDK                       │ mock FHIR search
┌───────────────┴───────────┐   ┌────────────────▼──────────────────┐
│  DATABASE (Firestore)     │   │  INTEGRATION                       │
│  users · patients ·       │   │  /api/fhir/* simulated FHIR server │
│  observations · encounters│   │  Looker Studio iframe simulation   │
│  audit_logs               │   │  (swap for real endpoints later)   │
└───────────────────────────┘   └───────────────────────────────────┘

  SECURITY: Firebase Auth · session cookies · RBAC custom claims ·
            Firestore rules (deny-all client writes) · audit logging
```

## 3. Why these choices (tradeoffs)

| Decision | Why | Tradeoff |
|---|---|---|
| **Next.js API routes as middleware** | One deployable, shared types FE↔BE, easy RBAC chokepoint | Couples API to the web app; fine until scale demands a separate service |
| **Normalized records in Firestore (not raw FHIR)** | Cheap reads, UI decoupled from wire format, transform once at ingest | Re-ingest needed if mapping changes |
| **httpOnly session cookies** (vs storing tokens in JS) | XSS-safe; server can verify + revoke | Requires a Node runtime (App Hosting / Cloud Run), not static hosting |
| **Custom claims for roles** | Cryptographically bound to the token; checkable at the edge & server | Claim changes require token refresh |
| **Firebase now, GCP later** | Fastest path to a working secure app; managed Auth + Firestore | Firestore query model is limited vs BigQuery for heavy analytics → migrate analytics to BigQuery/Looker when needed |
| **Simulated Looker Studio** | Direct access unavailable; pattern is production-ready | Native Recharts module is the real analytics until a report URL is supplied |
| **Lazy Admin SDK (Proxy)** | `next build` runs without runtime secrets | Slight indirection on first call |

## 4. Migration path to GCP

- **App Hosting → Cloud Run**: the SSR server is already container-friendly.
- **Firestore → keep** for OLTP; **stream to BigQuery** for analytics.
- **Native charts → Looker Studio** over BigQuery (set `NEXT_PUBLIC_LOOKER_EMBED_URL`).
- **Audit logs → Cloud Logging / BigQuery sink**.
- **Secrets → already in Secret Manager** via `apphosting.yaml`.

## 5. Folder structure

```
src/
  app/
    (protected)/          # auth-gated route group (layout verifies session)
      dashboard/ patients/ patients/[id]/ reports/ admin/
    api/                  # backend middleware layer
      auth/ fhir/ patients/ analytics/ admin/ log/
    login/  layout.tsx  page.tsx  error.tsx  not-found.tsx
  components/
    analytics/ admin/ auth/ dashboard/ layout/ ui/
  lib/
    api/        # client fetchers + React Query hooks + withAuth wrapper
    auth/       # rbac + session (cookies)
    data/       # repository + ingestion pipeline
    fhir/       # types · models · transform · validate · mock-source
    analytics/  # metric aggregation
    firebase/   # client + admin SDK
    logging/    # logger + audit
  middleware.ts           # edge cookie gate
scripts/seed.ts           # bootstrap data + grant roles
docs/                     # this documentation set
```
