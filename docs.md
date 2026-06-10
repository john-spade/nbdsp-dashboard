# NBDSP Dashboard — Documentation

Production-grade healthcare dashboard for the **National Birth Defects
Surveillance Project (NBDSP)** — an integration-heavy, analytics-driven system
built on Next.js + Firebase with a FHIR R4 ingestion pipeline and role-based
access control.

## Table of Contents

0. [How This Demo Meets the Job Requirements](#0-how-this-demo-meets-the-job-requirements)
1. [System Architecture](#1-system-architecture)
2. [System Flows](#2-system-flows)
3. [API Reference](#3-api-reference)
4. [FHIR Transformation](#4-fhir-transformation)
5. [Analytics Module](#5-analytics-module)
6. [Deployment Guide](#6-deployment-guide)
7. [User Manual](#7-user-manual)
8. [Looker Readiness](#8-looker-readiness)
9. [Scalability & Performance](#9-scalability--performance)

---

## 0. How This Demo Meets the Job Requirements

This section maps every deliverable and task in the job description directly to
where it is implemented in this system, so the evaluator does not have to hunt
through the docs to confirm coverage.

---

### Deliverables

| Job Deliverable | Implementation |
|---|---|
| Fully functional responsive frontend | Next.js 15 App Router · Tailwind CSS · fixed sidebar/topbar shell · off-canvas drawer on mobile |
| Secure Looker Studio embedding | `LookerFrame` (sandboxed iframe · onLoad/onError monitoring · 10 s timeout · Retry) + embed adapter `getAnalyticsSource`; Looker-ready by config — set `NEXT_PUBLIC_LOOKER_EMBED_URL` to activate, zero code change |
| Seamless integration with backend APIs and FHIR-to-Analytics pipelines | Route Handlers as the middleware layer · full FHIR R4 ingestion pipeline (fetch→validate→transform→store) · `/api/analytics/export` as the Looker/BigQuery data feed |
| Complete documentation — architecture, component library, API contracts | Sections 1–9: architecture · system flows · full API reference · FHIR transformation · analytics module · deployment · user manual · Looker readiness · scalability |
| Automated deployment pipelines | GitHub Actions CI (lint→typecheck→build) + deploy (Firestore rules/indexes) · Firebase App Hosting on Cloud Run auto-deploys on `git push` |
| Training and hand-off documentation | Section 7 User Manual (all 4 roles, all pages, all states) · Section 6 Deployment Guide (local setup · secrets · GCP migration path) |

---

### Specific Tasks

| Job Task | Implementation |
|---|---|
| Responsive frontend using React/Vue/Angular | Next.js 15 (React) · Tailwind CSS · responsive on desktop and mobile |
| Secure Looker embedding + session tokens + RBAC | httpOnly session cookie (XSS-safe) · Firebase custom claims for 4 roles (admin/encoder/analyst/viewer) · 3-layer enforcement: edge middleware → server layout (`permissionForPath`) → Firestore rules · `LookerFrame` sandboxed iframe |
| Supplementary backend endpoints / middleware layer | `withAuth()` wrapper on all protected routes · 13 Route Handlers: auth · FHIR · patients · analytics · admin · telemetry |
| Optimized for fast load times alongside embedded dashboards | Server Components stream HTML before data · `Skeleton` primitives + a `Suspense` boundary prevent layout shift · React Query client caching (`staleTime: 30s`) · server-side Firestore `where()` filtering + cursor pagination in the analytics query panel. Pre-aggregation and patient-list pagination are documented as the national-scale path in **§9** |
| Consume RESTful APIs and FHIR data pipelines | Simulated FHIR R4 server at `/api/fhir/:resource` · ingestion pipeline in `lib/data/ingest.ts` · all 3 FHIR resources: Patient, Observation, Encounter |
| Display transformed healthcare data (Patient, Observation, Encounter) | Patients registry (`/patients`) · patient detail with Observations (ICD-10 Q-codes, severity) and Encounters (facility, date, status) |
| Supplemental data querying alongside the dashboard | `query-panel.tsx` present in both Looker and native mode (admin/analyst) · Region/Defect/Date/Sex filters · server-side Firestore `where()` · URL-synced (shareable) · cursor-paginated 25/page |
| Logging and monitoring — client errors, UI performance, iframe stability | Structured Firestore `audit_logs` · client error beacon via `app/error.tsx` · Web Vitals (LCP/CLS/INP) · `iframe.load.ok`/`iframe.load.fail` telemetry · all visible in the Admin Panel audit trail |
| Diagnose CORS and client-side auth failures | Sandboxed iframe with CORS-safe fallback · httpOnly cookie (no client token exposure) · `401`/`403` error envelopes · dev-server reset procedure in Section 6 |
| GCP hosting + CI/CD pipelines | Firebase App Hosting (Cloud Run + Cloud Build) · GitHub Actions workflows · Firestore rules/indexes via CI · Secret Manager for server secrets · GCP migration path documented |
| Documentation — architecture, component library, API contracts | Section 1 architecture + tradeoff table · Section 3 full API reference with request/response shapes · Section 4 FHIR transformation layer · inline TypeScript types throughout |

---

### Note on team structure

This demo is a solo implementation built for application purposes. The job
description assumes a separate Backend Developer owns the core FHIR pipeline and
database. In that production scenario, this system's Route Handlers serve as the
**integration layer** between the Backend Developer's APIs and the frontend —
exactly as the spec describes. The mock FHIR source (`lib/fhir/mock-source.ts`)
is replaced by the real FHIR endpoint; the validate → transform → store pipeline
is unchanged (see Section 4, *Swapping in a real FHIR server*).

---

## 1. System Architecture

### Goals & constraints

- **Integration-heavy + analytics-driven**, not simple CRUD.
- Ingest **FHIR R4** data, normalize it, store it, and surface it through
  dashboards with **role-based** views.
- Ship on **Firebase** now, structured to migrate to **GCP** later.
- Production-quality, but avoid overengineering.

### Layered architecture

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

  SECURITY: Firebase Auth · session cookies · 4-role RBAC custom claims
            (admin/encoder/analyst/viewer) · 3-layer enforcement
            (route guard + withAuth + Firestore rules) · audit logging
```

### Why these choices (tradeoffs)

| Decision | Why | Tradeoff |
|---|---|---|
| **Next.js API routes as middleware** | One deployable, shared types FE↔BE, easy RBAC chokepoint | Couples API to the web app; fine until scale demands a separate service |
| **Normalized records in Firestore (not raw FHIR)** | Cheap reads, UI decoupled from wire format, transform once at ingest | Re-ingest needed if mapping changes |
| **httpOnly session cookies** (vs storing tokens in JS) | XSS-safe; server can verify + revoke | Requires a Node runtime (App Hosting / Cloud Run), not static hosting |
| **Custom claims for roles** | Cryptographically bound to the token; checkable at the edge & server | Claim changes require token refresh |
| **Firebase now, GCP later** | Fastest path to a working secure app; managed Auth + Firestore | Firestore query model is limited vs BigQuery for heavy analytics → migrate analytics to BigQuery/Looker when needed |
| **Native analytics module** | Direct Looker Studio access unavailable; pattern is production-ready | Native Recharts module is the real analytics until a report URL is supplied |
| **Lazy Admin SDK (Proxy)** | `next build` runs without runtime secrets | Slight indirection on first call |

### Migration path to GCP

- **App Hosting → Cloud Run**: the SSR server is already container-friendly.
- **Firestore → keep** for OLTP; **stream to BigQuery** for analytics.
- **Native charts → Looker Studio** over BigQuery (set `NEXT_PUBLIC_LOOKER_EMBED_URL`).
- **Audit logs → Cloud Logging / BigQuery sink**.
- **Secrets → already in Secret Manager** via `apphosting.yaml`.

### Folder structure

```
src/
  app/
    (protected)/          # auth-gated route group (layout verifies session + RBAC,
                          #   hosts the fixed sidebar/topbar shell)
      dashboard/ patients/ patients/[id]/ patients/[id]/edit/ patients/new/
      reports/ admin/ admin/users/
    api/                  # backend middleware layer
      auth/ fhir/ patients/ analytics/ admin/ log/
    login/  layout.tsx  page.tsx  error.tsx  not-found.tsx
  components/
    analytics/ admin/ auth/ dashboard/ layout/ patients/ telemetry/ ui/
    #          layout/ → sidebar (fixed nav + account/logout) · topbar (hamburger) · sidebar-overlay
    #          patients/ → patient-form (shared Add/Edit)
  lib/
    api/        # client fetchers + React Query hooks + withAuth wrapper
    auth/       # rbac (roles, permission map, permissionForPath) + session
    data/       # repository + ingestion pipeline + patient-write (FHIR assembly)
    fhir/       # types · models · transform · validate · mock-source
    analytics/  # metric aggregation + embed config
    firebase/   # client + admin SDK
    logging/    # logger + audit
    stores/     # zustand (mobile sidebar drawer state)
  middleware.ts           # edge cookie gate + x-pathname forwarding
scripts/seed.ts           # bootstrap data + grant roles + demo accounts
docs/                     # this documentation set
```

---

## 2. System Flows

### Auth flow

```
User → Login page
  → signInWithEmailAndPassword (Firebase Auth, client)
  → user.getIdToken()
  → POST /api/auth/session { idToken }
      → adminAuth.verifyIdToken()
      → adminAuth.createSessionCookie()   (5-day, httpOnly)
      → Set-Cookie __nbdsp_session
      → audit("auth.login")  (records actor email + role)
      → returns { ok, role }
  → redirect to ?next, else the role's home (defaultRouteFor):
        admin → /admin · encoder → /patients · analyst|viewer → /dashboard
  → Edge middleware sees cookie → forwards x-pathname → allows protected routes
  → (protected)/layout verifies cookie via Admin SDK → injects user+role,
    then enforces the per-route permission map (permissionForPath)
```

Logout: `DELETE /api/auth/session` clears the cookie + `signOut(auth)` + audit.

### Data flow (the canonical pipeline)

```
FETCH        VALIDATE         TRANSFORM            STORE          QUERY     DISPLAY
─────        ────────         ─────────            ─────          ─────     ───────
FHIR    →   zod schemas  →   FHIR → normalized →  Firestore  →   repo   →  React
Bundle      (collect           models             upsert        queries    Query
(mock or    errors,          (transform.ts)       (batched)     (admin)    → charts
 real)       don't throw)                                                   / tables
```

Triggered by **Admin Panel → "Run ingestion"** (`POST /api/admin/ingest`) or the
`npm run seed` script. Both call the same pure transform functions.

### Patient name fields

Each patient record stores separate name parts (lastName, firstName, middleName)
plus parent's names (fatherName, motherName) rather than a single fullName string.
This follows Philippine civil registration conventions and maps naturally from
FHIR `HumanName` structures + extensions for parent names.

The defect input includes an **"Others (specify)"** option with a free-text field
for manually entered custom defects not in the standard ICD-10 Q-code list.

### Dashboard flow (role-aware rendering)

```
Login → (protected)/layout resolves role
  ├── admin   → Dashboard: full AnalyticsModule (embed + native charts + query panel) + Admin
  ├── analyst → Dashboard + Reports: full AnalyticsModule (embed + query panel)
  ├── encoder → Dashboard: EncoderSummary (patient counts + Add/View shortcuts)
  └── viewer  → Dashboard: aggregate charts only (analytics:read; no query/export)
```

Three dashboard tiers, keyed off RBAC:
- **admin / analyst** (`analytics:export`) → full BI workspace + case query panel.
- **viewer** (`analytics:read` only) → aggregate charts, no case-level query/export.
- **encoder** (no analytics) → data-entry summary built from the patient registry.

The full analytics module renders the **Looker Studio simulation (iframe)** on top
and the **native Recharts module** beneath, fed by `/api/analytics/metrics`.

### User creation flow (admin only)

```
Admin → /admin/users → "+ Add User"
  → form: email, temporary password, role (admin|encoder|analyst|viewer)
  → POST /api/admin/users
      → withAuth("user:manage") re-verifies caller is admin (403 otherwise)
      → Admin SDK createUser({ email, password })
      → Admin SDK setCustomUserClaims(uid, { role })
      → write Firestore /users/{uid}: { email, role, createdAt, createdBy }
      → audit("user.create", { targetEmail, role })
      → revalidatePath('/admin/users')
  → success toast → user list refreshes
  → new user can now log in → routed to their role's home
```

There is no public self-registration — every account is provisioned by an admin,
the correct design for a controlled health-surveillance system.

### Patient edit flow (admin + encoder only)

```
Admin/Encoder → /patients/[id] → "Edit"
  → /patients/[id]/edit  (form pre-filled from patient + observations + encounter)
  → user edits one or more fields
  → PATCH /api/patients/:id
      → withAuth("patient:edit") re-verifies admin or encoder (403 for analyst/viewer)
      → Zod validates the payload
      → assemble FHIR Patient + Observation(s) + Encounter (deterministic child
        ids keyed off the Case ID → overwrite in place, no orphaned documents)
      → diff changed demographic fields
      → audit("patient.edit", { caseId, fieldsChanged[], observations })
      → revalidatePath('/patients') + revalidatePath('/patients/[id]')
  → redirect → /patients/[id] → success toast
```

### Error-handling flow

| Failure | Handling |
|---|---|
| **Token expired / revoked** | `verifySessionCookie(_, true)` returns null → layout `redirect('/login')`; API returns `401` |
| **Insufficient role** | API: `withAuth` → `403` + `audit("auth.denied")`. Routes: `(protected)/layout` checks `permissionForPath` → `redirect(defaultRouteFor(role))` |
| **API failure** | React Query `isError` → `ErrorState` with **Retry**; handler returns safe `500` (no stack leak) |
| **Iframe CORS / load failure** | `LookerEmbed` `onError` → fallback panel + native module still renders |
| **Invalid FHIR record** | Skipped + counted in ingestion summary (never aborts the batch) |
| **Uncaught client error** | `app/error.tsx` boundary → beacon `error.client` to audit log |

---

## 3. API Reference

All routes are Next.js API routes under `/api`. Protected routes are wrapped with
`withAuth(permission, handler)` which: verifies the session cookie → enforces
RBAC → writes an `api.call` audit entry → returns a safe error envelope.

Auth is via the `__nbdsp_session` httpOnly cookie (sent automatically by the
browser). Errors use `{ "error": string }` with the appropriate status.

### Endpoint table

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/api/auth/session` | public | Exchange `{ idToken }` for a session cookie (login) |
| DELETE | `/api/auth/session` | session | Clear session cookie (logout) |
| GET | `/api/auth/me` | session | Current `{ user }` or 401 |
| GET | `/api/fhir/:resource` | `observation:read` | Simulated FHIR R4 Bundle (`Patient`\|`Observation`\|`Encounter`) |
| GET | `/api/patients` | `patient:read` | `{ patients[], total }` (admin / encoder / analyst) |
| GET | `/api/patients/:id` | `patient:read` | `{ patient, observations[], encounters[] }` |
| POST | `/api/patients` | `patient:write` | Create patient + observations + encounter (admin / encoder) |
| PATCH | `/api/patients/:id` | `patient:edit` | Edit an existing case; re-verifies admin / encoder, audits `patient.edit` |
| GET | `/api/analytics/metrics` | `analytics:read` | `{ metrics }` (SurveillanceMetrics) — admin / analyst / viewer (aggregate) |
| GET | `/api/analytics/query` | `analytics:export` | Server-side filtered case list (case-level detail) — admin / analyst |
| GET | `/api/analytics/export` | `analytics:export` | De-identified CSV/JSON export for Looker/BigQuery — admin / analyst |
| POST | `/api/admin/ingest` | `ingestion:run` | Run pipeline → `{ ok, summary }` |
| GET | `/api/admin/audit` | `audit:read` | `{ entries[] }` recent audit logs |
| POST | `/api/log/client` | session | Telemetry beacon (page visits, errors, Web Vitals, iframe events) |

### Patient creation (`POST /api/patients`)

Required fields: `lastName`, `firstName`, `sex`, `birthDate`, `region`,
`observations[]`, `encounter`.

Optional fields: `middleName`, `fatherName`, `motherName`, `city`.

Observation defectLabel for custom entries: use `"Others (specify)"` and fill
the free-text custom field.

```json
{
  "lastName": "Dela Cruz",
  "firstName": "Juan",
  "middleName": "Santos",
  "fatherName": "Pedro",
  "motherName": "Maria",
  "sex": "male",
  "birthDate": "2025-01-15",
  "region": "National Capital Region (NCR)",
  "city": "Manila",
  "observations": [
    {
      "defectLabel": "Ventricular septal defect",
      "code": "Q21.0",
      "severity": "moderate",
      "recordedDate": "2025-01-15"
    }
  ],
  "encounter": {
    "type": "Newborn screening",
    "facility": "NCR Medical Center",
    "date": "2025-01-15",
    "status": "finished"
  }
}
```

### Patient edit (`PATCH /api/patients/:id`)

Admin + encoder only (re-verified server-side via `patient:edit`; viewers and
analysts get `403`). Accepts the **same payload shape** as `POST /api/patients`,
pre-filled by the edit form. The handler replaces the patient demographics +
findings + encounter (deterministic child ids keyed off the Case ID, so an edit
overwrites in place rather than orphaning documents), diffs the demographic
fields that changed, then writes an `audit_logs` entry:

```json
{ "action": "patient.edit", "resource": "NBD-2026-00001",
  "detail": { "caseId": "NBD-2026-00001", "fieldsChanged": ["city", "region"], "observations": 2 } }
```

It also `revalidatePath('/patients')` + `revalidatePath('/patients/:id')`.

### Analytics query (`GET /api/analytics/query`)

Multi-value filters are repeated query params. Dates are month-level (`YYYY-MM`).

```
GET /api/analytics/query?region=NCR&region=Region+III&defect=Anencephaly&sex=female&from=2025-01&to=2025-06&cursor=<lastDocId>
```

Response:
```json
{
  "rows": [{ "id", "caseId", "lastName", "firstName", "middleName", "region", "defectLabel", "icd10", "effectiveDate", ... }],
  "total": 142,
  "nextCursor": "abc123"
}
```

### Analytics export (`GET /api/analytics/export`)

Admin/analyst only. Returns de-identified one-row-per-case dataset.

```
GET /api/analytics/export?format=csv
```
```csv
caseId,region,defect,icd10,sex,birthMonth,severity,status
NBD-2026-00001,NCR,Ventricular septal defect,Q21.0,female,2025-01,moderate,final
```

### Status codes

`200` ok · `400` bad input · `401` no/invalid session · `403` role denied ·
`404` not found · `500` server error (details logged, not returned).

---

## 4. FHIR Transformation

### Why a transformation layer

Raw FHIR resources are deeply nested, heavily optional, and verbose. The UI and
Firestore should never see that shape. The transformation layer is the **single
boundary** that knows FHIR; everything else speaks flat, normalized models. This
isolation lets us swap the upstream FHIR source without touching the UI.

```
FHIR R4 resource  ──validate(zod)──►  valid resource  ──map──►  normalized model
(types.ts)          (validate.ts)                      (transform.ts)  (models.ts)
```

### The three resources

| FHIR | Normalized | Key mappings |
|---|---|---|
| `Patient` | `PatientRecord` | name.family → `lastName`; name.given[0] → `firstName`; name.given[1..] → `middleName`; extension[father-name] → `fatherName`; extension[mother-name] → `motherName`; address.state → `region`; birthDate → `ageDays` |
| `Observation` | `ObservationRecord` | code.coding → `defectCode`/`defectLabel`; subject.reference → `patientId`; category → birth-defect group |
| `Encounter` | `EncounterRecord` | type → `type`; serviceProvider.display → `facility`; period → `start`/`end` |

### Design rules

1. **Never throw on missing/optional fields.** Surveillance feeds are partial;
   degrade to empty string / `null` + sensible defaults (e.g. `gender → "unknown"`).
2. **Validate shape at the boundary, then map.** `validate.ts` uses Zod
   `.passthrough()` schemas that enforce only the required anchors
   (`resourceType`, `id`, key references) and **collect** per-item errors
   instead of aborting the batch.
3. **Pure, testable functions.** Every mapper is a pure function — no I/O, no
   globals — so it can be unit-tested in isolation.

### Mapping examples

```ts
// Name parts: family → lastName, given[0] → firstName, given[1..] → middleName
toPatientRecord({ name: [{ use: "official", family: "Cruz", given: ["Juan", "Santos"] }] })
// → { lastName: "Cruz", firstName: "Juan", middleName: "Santos" }

// Reference id extraction: "Patient/P1003" → "P1003"
refId("Patient/P1003")  // "P1003"

// Age in days from birthDate (null-safe)
ageInDays("2025-12-01")  // e.g. 191
ageInDays(undefined)     // null
```

### Handling validation failures

`runIngestion()` returns a summary per resource:

```json
{ "patients": { "fetched": 120, "stored": 120, "invalid": 0 }, ... }
```

Invalid items are skipped (not stored) and surfaced in the **Admin Panel** so
data-quality issues are visible rather than silent.

### Swapping in a real FHIR server

Replace `src/lib/fhir/mock-source.ts` `fhirSearch()` with an HTTP client that
GETs `${FHIR_BASE}/Patient?_count=...` and returns the Bundle. The validate →
transform → store stages are unchanged.

---

## 5. Analytics Module

The app uses a Looker-ready architecture without requiring a Looker Studio
account today: one embed seam, two interchangeable renderers.

### A. Embed seam

`src/lib/analytics/embed-config.ts` exports:

```ts
getAnalyticsSource(role) → { mode: "looker", url } | { mode: "native" }
```

It resolves role-aware env vars:

| Role | Primary env var | Fallback |
|---|---|---|
| admin | `NEXT_PUBLIC_LOOKER_EMBED_URL_ADMIN` | `NEXT_PUBLIC_LOOKER_EMBED_URL` |
| analyst | `NEXT_PUBLIC_LOOKER_EMBED_URL_ANALYST` | `NEXT_PUBLIC_LOOKER_EMBED_URL` |
| viewer | `NEXT_PUBLIC_LOOKER_EMBED_URL_VIEWER` | `NEXT_PUBLIC_LOOKER_EMBED_URL` |

(Encoders have no analytics access, so they never reach the embed.)

`src/components/analytics/analytics-embed.tsx` chooses between:

- `mode: "looker"` → `<LookerFrame>` (sandboxed iframe)
- `mode: "native"` → `<NativeAnalytics>` (Recharts dashboard)

The status badge honestly reports "Looker Studio" or "Native Analytics Module".

Going live with Looker is a config change, not a refactor.

### B. Looker frame

`src/components/analytics/looker-frame.tsx` — production iframe wrapper:

- Sandboxed `iframe` with fullscreen support
- Responsive 16:9, `min-height: 600px`
- Skeleton until `onLoad`
- `iframe.load.ok` telemetry on success
- `iframe.load.fail` telemetry on error or 10-second timeout
- Error card with Retry button

### C. Native analytics renderer

`src/components/analytics/native-analytics.tsx` uses Recharts with server-backed
aggregates from `GET /api/analytics/metrics`. The aggregation logic in
`src/lib/analytics/metrics.ts` runs server-side — the browser only receives
pre-computed totals, not raw patient data.

Charts: Cases per Region (horizontal bar) · Monthly trend (area) · Defect
distribution (donut) · Cases by sex (grouped bar) · Severity breakdown (bar).

### D. Supplemental query panel

`src/components/analytics/query-panel.tsx` is always present for admin and
analyst users, regardless of renderer mode.

Filters: Region (multi-select) · Defect type (multi-select) · Month range
(from/to) · Sex (single-select) · **"Others (specify)" custom defect**.

Features: URL-synced filters (shareable) · server-side Firestore `where()`
filtering (not client array filtering) · cursor pagination 25/page.

### E. Defect reference list

The `DEFECTS` array in `src/lib/fhir/reference-data.ts` defines the selectable
defects. The 9th entry is **"Others (specify)"** which renders a free-text field
for manual entry of custom defects not in the standard ICD-10 Q-code list.

Palette: UP maroon (`#7b1113`) and gold (`#e0b13a`), consistent with the
institution theme.

---

## 6. Deployment Guide

### Local development

```bash
npm install
cp .env.local.example .env.local   # fill in values (client config already provided)
npm run seed                        # load mock surveillance data into Firestore
npm run dev                         # http://localhost:3000
```

Create a first user in Firebase Console → Authentication, then grant a role:

```bash
npm run seed -- --role admin --email you@doh.gov.ph
```

### Secrets you must provide

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | Console → Project settings → Your apps (web) — **already filled in** |
| `FIREBASE_ADMIN_PROJECT_ID` | `up-demo-9c45f` (already set) |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Console → Project settings → **Service accounts → Generate new private key** → `client_email` |
| `FIREBASE_ADMIN_PRIVATE_KEY` | same JSON → `private_key` (keep the `\n` escapes, wrap in quotes) |
| `NEXT_PUBLIC_LOOKER_EMBED_URL*` | optional — a Looker Studio "Embed report" URL |

> The app needs a **server runtime** (session cookies + Admin SDK), so it
> deploys to **Firebase App Hosting** (or Cloud Run), not classic static Hosting.

### Deploy — Firebase App Hosting (recommended)

```bash
npm install -g firebase-tools
firebase login

# 1. One-time: create the backend connected to your Git repo
firebase apphosting:backends:create --project up-demo-9c45f

# 2. Store server secrets in Cloud Secret Manager
firebase apphosting:secrets:set FIREBASE_ADMIN_PROJECT_ID
firebase apphosting:secrets:set FIREBASE_ADMIN_CLIENT_EMAIL
firebase apphosting:secrets:set FIREBASE_ADMIN_PRIVATE_KEY

# 3. Deploy Firestore rules + indexes
firebase deploy --only firestore

# 4. Push to the connected branch → App Hosting builds & rolls out
git push origin main
```

`apphosting.yaml` already declares the public env vars and references the three
secrets by name.

### CI/CD (GitHub Actions)

- **`.github/workflows/ci.yml`** — on every push/PR: `lint → typecheck → build`.
  Add the `NEXT_PUBLIC_FIREBASE_*` values as repo secrets for the build step.
- **`.github/workflows/deploy.yml`** — on changes to Firestore rules/indexes:
  deploys them using `FIREBASE_SERVICE_ACCOUNT` repo secret. App Hosting handles
  the app rollout automatically from the connected branch.

### Migration to GCP (future)

App Hosting already runs on Cloud Run + Cloud Build under the hood. To "graduate":
point the analytics at BigQuery + Looker Studio, add a Firestore→BigQuery export,
and route audit logs to a Cloud Logging sink. No app rewrite required.

---

## 7. User Manual

### Roles at a glance

There are **four roles**: admin / encoder / analyst / viewer. (An *encoder* is the
data-entry staff member who registers and edits surveillance cases.)

| Role | Dashboard | Patients | Add / Edit Patient | Reports | Admin Panel |
|---|---|---|---|---|---|
| **Admin** | Full analytics | ✅ | ✅ | ✅ | ✅ (ingest + audit) |
| **Encoder** | Data-entry summary | ✅ | ✅ | ❌ | ❌ |
| **Analyst** | Full analytics | ✅ (read-only) | ❌ | ✅ | ❌ |
| **Viewer** | Aggregate charts only | ❌ | ❌ | ❌ | ❌ |

Badge colors: admin → maroon · encoder → blue · analyst → gold/amber · viewer → slate.

Navigation items and pages are filtered automatically by role — users never see
controls they cannot use. The same permission map is re-enforced server-side in
the `(protected)` layout (`permissionForPath`) and in every API handler
(`withAuth`), plus the Firestore rules (3-layer RBAC).

> **Reports & encoders:** the Reports page renders the analytics module, which
> requires `analytics:read`. Encoders intentionally have no analytics access, so
> Reports is admin + analyst only.

### Signing in

1. Go to the app URL → you land on **Login**.
2. Enter your DOH email + password (created by an administrator).
3. On success you are routed to your **role's home** — admin → Admin Panel,
   encoder → Patients, analyst/viewer → Dashboard.
4. Use **Logout** at the **bottom of the sidebar** to end your session.

> **Layout:** the sidebar and topbar are **fixed** and never scroll — only the
> main content area scrolls (essential for long patient lists and the audit
> trail). The sidebar carries the brand + role-filtered navigation, with your
> account (name, role, avatar) and the **Logout** button pinned at its bottom;
> the topbar holds the page title and (on mobile) the hamburger. On phones the
> sidebar collapses to an off-canvas drawer toggled by that hamburger.

### Pages

- **Dashboard** — surveillance overview. Admins/Analysts see the full analytics
  module (Looker simulation + charts + query panel); Viewers see aggregate charts
  only; Encoders see a data-entry summary (patient counts + Add/View shortcuts).
- **Patients** — searchable, region-filterable registry. Click **View →** for
  details. Table columns: Case ID, Last Name, First Name, Middle Name, Sex, Age,
  Region, Locality, Status. Admin/encoder see a **+ Add Patient** button.
- **Patient detail** — name parts, parent's names (father/mother), demographics,
  **Observations** (birth-defect findings with ICD-10 codes), and **Encounters**.
  Admin/encoder see an **Edit** button; analysts/viewers see it read-only.
- **Add Patient** — form for new surveillance cases (admin/encoder). Fields
  include name parts (Last Name, First Name, Middle Name), parent's names, sex,
  birth date, region, city, and one or more defect observations. Defect dropdown
  includes "Others (specify)" for custom entries.
- **Edit Patient** — same form as Add Patient, pre-filled from the record
  (admin/encoder only). Saving PATCHes the case and writes a `patient.edit` audit
  entry listing the fields that changed.
- **Reports** — the full analytics module (Admin/Analyst only).
- **Admin Panel** — **Run ingestion** (pull → validate → transform → store) and
  browse the **Security Audit Trail** (includes iframe load events + Web Vitals).

### States you may see

- **Loading** — shimmer skeletons while data loads.
- **Empty** — a labeled placeholder when there is no data (e.g. before the first
  ingestion).
- **Error** — a red panel with a **Retry** button; the error is logged
  automatically.

### Administrator tasks

- **Add a user**: Admin Panel → **User Management → + Add User** (email, temporary
  password, role) — or Firebase Console → Authentication → Add user.
- **Assign a role**: in **User Management** the role dropdown offers
  admin / encoder / analyst / viewer — or via CLI:
  `npm run seed -- --role <admin|encoder|analyst|viewer> --email <user>`.
- **Demo encoder account**: `npm run seed` provisions `encoder@nbdsp.demo` /
  `Encoder@2026` (idempotent) for trying the encoder experience.
- **Load/refresh data**: Admin Panel → **Run ingestion**.
- **Review activity**: Admin Panel → audit trail (logins, denials, API calls,
  page visits, client errors, iframe load events, Web Vitals).

---

## 8. Looker Readiness

This section describes how the NBDSP dashboard is engineered to drop in a real
Looker Studio embed with zero refactor — just config.

### Architecture overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     ADMIN / ENCODER / ANALYST / VIEWER                   │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     AnalyticsEmbed  (src/components/)                     │
│   getAnalyticsSource(role)  →  { mode: "looker", url } | { mode: "native" }│
│                      ↕                                        ↕           │
│            LookerFrame                          NativeAnalytics           │
│         (looker-frame.tsx)                   (native-analytics.tsx)       │
│         sandboxed <iframe>                      Recharts charts          │
│         16:9 · 600px min                         server aggregates        │
└────────────┬─────────────────────┬────────────────────────────────────────┘
             │                     │
             ▼                     ▼
┌──────────────────────┐  ┌───────────────────────────────────────────────┐
│   Looker Studio      │  │       Supplemental Query Panel                 │
│   (real embed)       │  │  query-panel.tsx — always present, both modes │
│   when URL is set    │  │  Region · Defect · Date range · Sex filters  │
└──────────────────────┘  │  Server-side Firestore where()              │
                            │  URL-synced · cursor paginated 25/page       │
                            └───────────────────────────────────────────────┘
                                      │
                                      ▼
                     ┌────────────────────────────────────────────┐
                     │          /api/analytics/query               │
                     │    (admin/analyst · Firestore-filtered)    │
                     └────────────────────────────────────────────┘
```

**Production data flow:**

```
Firestore (operational)
    │
    ├──► /api/analytics/export  ──►  BigQuery / Looker Studio connector
    │       (de-identified CSV/JSON)       (scheduled load or live connector)
    │
    └──► /api/analytics/metrics ──► NativeAnalytics (Recharts)
```

The two renderers expose **identical data contracts** — same query panel,
same filters, same export endpoint. Only the renderer differs.

### The embed seam

`src/lib/analytics/embed-config.ts` exports:

```ts
export type AnalyticsSource =
  | { mode: "looker"; url: string }
  | { mode: "native" };

export function getAnalyticsSource(role: Role): AnalyticsSource {
  // Encoders have no analytics access — never resolve a Looker URL for them.
  if (role === "encoder") return { mode: "native" };

  const roleUrl =
    role === "admin"
      ? process.env.NEXT_PUBLIC_LOOKER_EMBED_URL_ADMIN
      : role === "analyst"
        ? process.env.NEXT_PUBLIC_LOOKER_EMBED_URL_ANALYST
        : process.env.NEXT_PUBLIC_LOOKER_EMBED_URL_VIEWER;

  const url = (roleUrl || process.env.NEXT_PUBLIC_LOOKER_EMBED_URL || "").trim();
  return url ? { mode: "looker", url } : { mode: "native" };
}
```

Resolution order per role:

| Role | Primary env var | Fallback |
|---|---|---|
| admin | `NEXT_PUBLIC_LOOKER_EMBED_URL_ADMIN` | `NEXT_PUBLIC_LOOKER_EMBED_URL` |
| analyst | `NEXT_PUBLIC_LOOKER_EMBED_URL_ANALYST` | `NEXT_PUBLIC_LOOKER_EMBED_URL` |
| viewer | `NEXT_PUBLIC_LOOKER_EMBED_URL_VIEWER` | `NEXT_PUBLIC_LOOKER_EMBED_URL` |

If no URL is found in any variable, the resolver returns `{ mode: "native" }`.
Setting any env var flips that role's view to Looker.

### `<AnalyticsEmbed role={role} />`

The single component that decides at runtime:

```tsx
export function AnalyticsEmbed({ role }: { role: Role }) {
  const source = getAnalyticsSource(role);
  const isLooker = source.mode === "looker";
  return (
    <section>
      <Badge tone={isLooker ? "green" : "maroon"}>
        Active source: {isLooker ? "Looker Studio" : "Native Analytics Module"}
      </Badge>
      {isLooker ? <LookerFrame url={source.url} /> : <NativeAnalytics />}
    </section>
  );
}
```

The status badge is **honest at all times** — it never claims to be Looker
when it is not.

### `<LookerFrame url={...} />`

Production iframe wrapper, active the moment a URL exists:

- Sandboxed `iframe` (`allow-scripts allow-same-origin allow-popups
  allow-popups-to-escape-sandbox`, no `allow-forms`)
- `allowFullScreen`
- Responsive 16:9, `min-height: 600px`
- Skeleton until `onLoad`
- 10-second load timeout → `iframe.load.fail` telemetry + error card + Retry
- `onLoad` → `iframe.load.ok` telemetry

Telemetry events are visible in the **Admin Panel → Security Audit Trail** with
green/red/gold badges, so embed stability is observable before a real URL is
even set.

### Supplemental query panel — always present

`src/components/analytics/query-panel.tsx` is rendered alongside the embed
regardless of mode (Looker or native) for admin and analyst users.

**Filters (URL-synced, shareable):**

| Filter | Type | Firestore field |
|---|---|---|
| Region | multi-select | `region` (via `in` query) |
| Defect type | multi-select | `defectLabel` (via `in` query) |
| Date range | month from/to | `effectiveDate` (via `>=` / `<=`) |
| Sex | single-select | `sex` (via `==`) |

Server-side Firestore filtering via `where()` clauses — **no client array
filtering**. Cursor pagination (25/page).

### Export endpoint — the Looker / BigQuery feed

`GET /api/analytics/export?format=csv` (admin/analyst only) returns the
de-identified, one-row-per-case dataset that Looker Studio or a scheduled
BigQuery load would consume.

**Columns:** `caseId,region,defect,icd10,sex,birthMonth,severity,status`

No PHI. No patient names. No DOB. Only coded surveillance fields.

### Go-live steps — drop in Looker Studio

**Step 1 — Create the Looker Studio report**

1. Open Google Looker Studio and create a new report.
2. Connect to your data source (BigQuery, Google Sheets, or another connector).
3. Build the report with the fields from `/api/analytics/export`.
4. Save and publish.

**Step 2 — Connect the data source**

**Option A — Looker Studio direct connector (live):**
Use the Looker Studio connector to connect directly to BigQuery or another
supported source that is fed by `/api/analytics/export`.

**Option B — Scheduled BigQuery load (recommended for scale):**
1. Point a BigQuery scheduled query or Dataflow job at `/api/analytics/export?format=csv`
   (or its JSON variant).
2. Load the de-identified dataset into a BigQuery table.
3. Connect Looker Studio to that BigQuery table.

**The export endpoint is the seam.** Any Looker Studio connector or scheduled
BigQuery load that consumes it will receive the same de-identified data
contract that the native module uses.

**Step 3 — Set the environment variable**

```bash
# .env.local (or in Cloud Runtime Config / Secret Manager)
NEXT_PUBLIC_LOOKER_EMBED_URL=https://lookerstudio.google.com/embed/reports/...
NEXT_PUBLIC_LOOKER_EMBED_URL_ADMIN=https://lookerstudio.google.com/embed/reports/...  # optional
NEXT_PUBLIC_LOOKER_EMBED_URL_ANALYST=https://lookerstudio.google.com/embed/reports/...
NEXT_PUBLIC_LOOKER_EMBED_URL_VIEWER=https://lookerstudio.google.com/embed/reports/...
```

**Step 4 — Redeploy**

```bash
npm run build && npm run start
# or push to main → Cloud Run auto-deploys via App Hosting
```

The dashboard **auto-switches to Looker mode** on next load for any role with
a URL configured. No code changes. No component edits.

### Monitoring

**Embed stability** — `LookerFrame` emits:
- `iframe.load.ok` — successful iframe load (green badge in audit trail)
- `iframe.load.fail` — error or 10s timeout (red badge in audit trail)

Both appear in **Admin Panel → Security Audit Trail** alongside all other
security events. The `detail` object includes the URL and failure reason.

**Web Vitals** — `WebVitals` component (`src/components/telemetry/web-vitals.tsx`)
captures LCP, CLS, and INP, beaconing them to `POST /api/log/client` stored in
`audit_logs` with action `perf.webvital` (gold badge).

**Admin telemetry view** — All client telemetry visible in the Security Audit
Trail, providing a single pane of glass for both security events and
performance observability.

### Why native-now is acceptable

The native analytics module is not a placeholder — it is a fully functional
BI dashboard that:

- Serves the same query panel with the same server-side Firestore filters
- Uses the same de-identified export endpoint
- Follows the same UP maroon/gold design language
- Implements the same 3-layer RBAC (admin/encoder/analyst/viewer)
- Surfaces the same data contract

The only thing that changes when Looker is configured is **the renderer**.
The data pipeline, query semantics, and access controls remain identical.

This is the correct engineering approach: build to the **same contract**, not
to the same tool. Swapping the renderer becomes a config change because the
contract is preserved.

### RBAC matrix

| Permission (key) | Admin | Encoder | Analyst | Viewer |
|---|---|---|---|---|
| Dashboard (`dashboard:read`) | ✓ | ✓ | ✓ | ✓ |
| Read patients (`patient:read`) | ✓ | ✓ | ✓ | ✗ |
| Create patients (`patient:write`) | ✓ | ✓ | ✗ | ✗ |
| Edit patients (`patient:edit`) | ✓ | ✓ | ✗ | ✗ |
| Aggregate analytics / charts (`analytics:read`) | ✓ | ✗ | ✓ | ✓ |
| Query panel + Export CSV/JSON (`analytics:export`) | ✓ | ✗ | ✓ | ✗ |
| View Looker embed | ✓ (if URL set) | — | ✓ (if URL set) | ✓ (if URL set) |
| Audit trail view (`audit:read`) | ✓ | ✗ | ✗ | ✗ |
| FHIR ingestion (`ingestion:run`) | ✓ | ✗ | ✗ | ✗ |
| User management (`user:manage`) | ✓ | ✗ | ✗ | ✗ |

Encoders write patient/observation/encounter data through the audited API; the
Firestore rules also permit admin + encoder client writes on those three data
collections only (never `users` or `audit_logs`).

---

## 9. Scalability & Performance

The Philippines records roughly 1.5 million births per year. A national birth
defects surveillance system — even capturing a fraction of those — accumulates
tens of thousands of records annually and hundreds of thousands over its
lifetime. This section describes how the system stays fast at that scale.

> **Implementation status.** At the current demo scale (≈120 cases) the dashboard
> computes metrics by reading the `patients` + `observations` collections
> server-side, and the patient registry loads one bounded query (`limit(500)`)
> filtered client-side — both fast and correct here. The two patterns marked
> **scale path** below are the documented next steps for national volume; the
> **cursor pagination** pattern is already implemented in the analytics query
> panel today.

---

### The two bottlenecks at scale

A naive implementation breaks under load in exactly two ways:

**1. Loading all records to render a list.** Fetching every patient document to
show page 1 means 200,000+ Firestore reads per page load at national scale.

**2. Scanning all records to compute dashboard aggregates.** Computing "cases per
region" by reading every document means 200,000+ reads on every dashboard load,
per concurrent user, every refresh.

Both are addressed by the patterns below.

---

### Cursor pagination — *implemented (query panel)*

The analytics **query panel** (`lib/data/analytics-cases.ts` → `queryCases`)
never loads the full collection. It uses Firestore cursor pagination:

```
limit(25) + startAfter(lastDocument)   // + server-side where() filters
```

Cost is always 25 reads per page regardless of dataset size. Firestore does not
support SQL-style `OFFSET`; cursors are the correct pattern and do not degrade
at scale.

*Scale path:* the patient registry (`/api/patients`) currently returns a bounded
page (`limit(500)`) and filters client-side — fine for the demo. At national
volume it adopts this same cursor + server-side-filter pattern.

---

### Pre-aggregated metrics — *scale path*

Today, dashboard KPIs and charts are computed **server-side** from the
collections (`computeMetrics(listPatients(), listObservations())`); the browser
only ever receives pre-computed totals, never raw patient rows. That on-read
aggregation is appropriate at demo scale.

At national volume the dashboard should not scan the collections on every load.
The standard fix is a small set of counter documents kept current on every write:

```
metrics/summary     → { totalPatients, totalCases, ... }
metrics/by_region   → { "NCR": 24, "Region VII": 18, ... }
metrics/by_defect   → { "Cleft palate": 22, ... }
```

Each `POST`/`PATCH /api/patients` would atomically bump the relevant counters
with `FieldValue.increment()` (concurrency-safe), turning a dashboard load into a
handful of document reads regardless of dataset size. An Admin "rebuild metrics"
action would backfill counters after bulk ingestion using Firestore aggregation
queries (`count()`/`sum()`) rather than reading every document.

---

### Next.js caching strategy (implemented)

| Layer | Strategy | Effect |
|---|---|---|
| Server Components | RSC stream the shell before data resolves | First paint is immediate |
| React Query | `staleTime: 30s` on client lists/metrics | Navigation between pages does not refetch immediately |
| Suspense + Skeleton | `<Suspense>` around the query panel + `Skeleton` primitives on every async surface | No layout shift while data loads |

*Scale path:* aggregate pages can additionally opt into timed revalidation
(`export const revalidate = N`) once metrics are pre-aggregated.

---

### Firestore vs BigQuery — the analytics split

Firestore is optimized for transactional reads/writes on individual records, not
heavy analytical scans. The correct GCP architecture for national-scale analytics:

```
Firestore (operational)
  ├── real-time CRUD: patients, observations, encounters
  ├── fast single-record reads: patient detail
  └── (scale path) pre-aggregated counters: dashboard KPIs
            │
            ▼
   /api/analytics/export      ← the data seam (implemented)
            │
            ▼
   BigQuery (analytics)        ← scheduled load or Dataflow
            │
            ▼
   Looker Studio               ← reads from BigQuery
```

`/api/analytics/export` is the seam connecting the operational layer to
BigQuery/Looker; activating that path requires no application code change.

---

### Regional deployment

`apphosting.yaml` currently uses the platform default region. For production
serving Philippine users, pin **`asia-southeast1`** (Singapore) to cut round-trip
latency from ~250 ms to ~30 ms for users across Luzon, Visayas, and Mindanao:

```yaml
runConfig:
  region: asia-southeast1
```

---

### Scale projection (with the §9 patterns applied)

| Metric | Demo (120) | Year 1 (~10k) | Year 5 (~50k+) |
|---|---|---|---|
| Dashboard reads — naive scan | 120 | 10,000 | 50,000+ |
| Dashboard reads — pre-aggregated *(scale path)* | **5** | **5** | **5** |
| Patient-list reads — naive | 120 | 10,000 | 50,000+ |
| Patient-list reads — cursor paginated | **25** | **25** | **25** |

Cursor pagination (today, in the query panel) and pre-aggregation (the scale
path) keep performance flat as the dataset grows — the design required for a
system intended to run at national scale for years.

---

*Last updated: June 2026*