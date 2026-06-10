# NBDSP Dashboard

Production-grade healthcare dashboard for the **National Birth Defects
Surveillance Project** — an integration-heavy, analytics-driven system built on
Next.js + Firebase with a FHIR ingestion pipeline and role-based access.

## Stack

Next.js (App Router) · TypeScript · Tailwind · Firebase (Auth + Firestore) ·
firebase-admin · React Query · Zustand · Recharts · Zod · FHIR R4.

## Quick start

```bash
npm install
cp .env.local.example .env.local      # client config is pre-filled; add Admin SDK keys
npm run seed                          # load mock FHIR data → Firestore
npm run seed -- --role admin --email you@doh.gov.ph   # grant yourself admin
npm run dev                           # http://localhost:3000
```

You still need the **Admin SDK service-account** values in `.env.local`
(`FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`) — Firebase Console
→ Project settings → Service accounts → *Generate new private key*.

## Documentation

**Single file:** [docs.md](docs.md) — all documentation in one place.

Individual docs:

| Doc | Contents |
|---|---|
| [docs/01-architecture.md](docs/01-architecture.md) | Layered architecture, tradeoffs, folder map |
| [docs/02-system-flow.md](docs/02-system-flow.md) | Auth, data, dashboard, error flows |
| [docs/03-api.md](docs/03-api.md) | Endpoint reference |
| [docs/04-fhir-transformation.md](docs/04-fhir-transformation.md) | FHIR → normalized mapping |
| [docs/05-analytics-module.md](docs/05-analytics-module.md) | Native analytics + charts overview |
| [docs/06-deployment.md](docs/06-deployment.md) | App Hosting + CI/CD + GCP migration |
| [docs/07-user-manual.md](docs/07-user-manual.md) | Roles & page guide |
| [docs/10-looker-readiness.md](docs/10-looker-readiness.md) | Looker Studio embed seam + go-live steps |

## Looker-ready

The dashboard ships with a native analytics module today. To go live with Looker
Studio, set one or more env vars and rebuild — zero code change.

| Env var | Who it applies to | Fallback |
|---|---|---|
| `NEXT_PUBLIC_LOOKER_EMBED_URL` | all roles | — (native) |
| `NEXT_PUBLIC_LOOKER_EMBED_URL_ADMIN` | admin only | `LOOKER_EMBED_URL` |
| `NEXT_PUBLIC_LOOKER_EMBED_URL_ANALYST` | analyst only | `LOOKER_EMBED_URL` |
| `NEXT_PUBLIC_LOOKER_EMBED_URL_VIEWER` | viewer only | `LOOKER_EMBED_URL` |

See [docs/10-looker-readiness.md](docs/10-looker-readiness.md) for full go-live
steps: create Looker report → connect it to `/api/analytics/export` (or a
BigQuery table loaded from it) → set the env var → done.

## Scripts

`npm run dev` · `build` · `start` · `lint` · `typecheck` · `seed`

## Roles

**Admin** (full + ingestion + audit) · **Analyst** (analytics + data) ·
**Viewer** (read-only summary).
