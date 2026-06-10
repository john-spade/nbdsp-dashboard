# Build Report — NBDSP Dashboard

**Project:** National Birth Defects Surveillance Project (NBDSP) Dashboard
**Status:** Foundation complete and compiling. Not deployed. Not pushed to GitHub
(holding for your signal).
**Date:** 2026-06-10

---

## 1. What this is

A production-grade, integration-heavy healthcare dashboard:
**FHIR ingestion → normalize → store → analytics**, with role-based access,
audit logging, and a hybrid analytics module (Looker Studio simulation + native
Recharts). Built strictly on the required stack.

## 2. Tech stack (as specified)

Next.js 15 (App Router) · TypeScript · Tailwind CSS · Firebase (Firestore +
Auth) · firebase-admin · React Query · Zustand · Recharts · Zod · FHIR R4.

## 3. Design order followed (per the brief)

1. System Architecture → `docs/01-architecture.md`
2. System Flow → `docs/02-system-flow.md`
3. Data Design → FHIR types/models/transform + Firestore collections
4. UI/UX Layout → sidebar/topbar shell + 6 pages, UP maroon/gold theme
5. Analytics Strategy → `docs/05-analytics-module.md`
6. Implementation → code below
7. Documentation → `docs/` + this report

## 4. What was built

### Backend / middleware layer
- `withAuth(permission, handler)` wrapper: session verify → RBAC → audit → safe errors.
- API routes:
  - `POST/DELETE /api/auth/session` (login/logout via httpOnly session cookie)
  - `GET /api/auth/me`
  - `GET /api/fhir/:resource` — **simulated FHIR R4 server** (Bundles)
  - `GET /api/patients`, `GET /api/patients/:id`
  - `GET /api/analytics/metrics`
  - `POST /api/admin/ingest`, `GET /api/admin/audit`
  - `POST /api/log/client` (telemetry beacon)

### FHIR data handling (high priority)
- `lib/fhir/types.ts` — FHIR R4 interfaces (Patient, Observation, Encounter, Bundle).
- `lib/fhir/models.ts` — normalized, UI-ready models.
- `lib/fhir/transform.ts` — pure FHIR→normalized mappers, null-safe for missing fields.
- `lib/fhir/validate.ts` — Zod schemas that **collect** errors (don't abort batch).
- `lib/data/ingest.ts` — the pipeline: **fetch → validate → transform → store**.
- `lib/fhir/mock-source.ts` — deterministic PH birth-defect data (ICD-10 Q-codes, regions).

### Database (Firestore)
- Collections: `users`, `patients`, `observations`, `encounters`, `audit_logs`.
- `firestore.rules` — deny-all client writes; authed reads; admin-only audit reads.
- `firestore.indexes.json` — patientId + audit createdAt indexes.

### Security
- Firebase Auth + **httpOnly session cookies** (5-day, revocation-checked).
- RBAC (`admin` / `analyst` / `viewer`) via **custom claims**; `can(role, permission)`.
- Route protection: edge middleware (cookie gate) + authoritative server layout.
- Page-level + component-level + API-level enforcement.
- Audit log of logins, denials, API calls, page visits, client errors.

### Frontend (atomic design)
- Shell: `Sidebar` (role-filtered nav), `Topbar` (user + logout), protected layout.
- Pages: **Login, Dashboard, Patients, Patient Details, Reports, Admin Panel**.
- UI primitives: Card, Skeleton (loading), EmptyState, ErrorState, Badge.
- Theme: white background, **UP maroon + gold** palette, Inter type.
- Error handling: `app/error.tsx` boundary + `not-found.tsx`.

### Analytics module ("Embedded Analytics Module (Looker Studio Simulation)")
- **A. iframe simulation** — role-aware embed URL, sandboxed, CORS-safe fallback.
- **B. native Recharts** — stat cards + **bar** (cases/region) + **line** (monthly
  trend) + **pie** (defect distribution), fed by aggregated metrics.

### Logging & monitoring
- Structured JSON logger (Cloud Logging-friendly) + Firestore `audit_logs`.
- Client beacon tracks page visits and client errors.

### CI/CD
- `.github/workflows/ci.yml` — lint → typecheck → build.
- `.github/workflows/deploy.yml` — Firestore rules/indexes deploy.
- `apphosting.yaml` — Firebase App Hosting (SSR) with Secret Manager refs.

### Documentation
- `README.md` + `docs/01..07` (architecture, flow, API, FHIR, analytics, deploy,
  user manual) + this `report.md`.

## 5. Verification

- `npm install` — ✅ exit 0
- `npm run typecheck` — ✅ exit 0
- `npm test` — ✅ **18 tests passing** (4 suites: transform, validate, rbac, metrics)
- `npm run build` — ✅ exit 0, all routes compiled (21 after the feature iteration)
- See **Section 9** for the post-MVP feature iteration (Features 1–8).

## 6. What I still need from you

1. **Firebase Admin service-account key** (the secret half):
   - `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `FIREBASE_ADMIN_PRIVATE_KEY`
   - Console → Project settings → **Service accounts → Generate new private key**.
   - Without it: login session minting, ingestion, and all data APIs can't run
     (the public client config you sent is already wired in).
2. **At least one Auth user** (Console → Authentication → Add user), so I can grant
   it a role via `npm run seed -- --role admin --email <that user>`.
3. *(Optional)* a **Looker Studio "Embed report" URL** for `NEXT_PUBLIC_LOOKER_EMBED_URL`
   — otherwise the native module + simulation placeholder are shown.
4. *(For CI/CD later)* GitHub repo + secrets (`NEXT_PUBLIC_FIREBASE_*`,
   `FIREBASE_SERVICE_ACCOUNT`). **Not pushing until you say so.**

## 7. Not done yet / next steps (awaiting your go)

- Push to GitHub (holding per your instruction).
- Deploy to Firebase App Hosting.
- Run `npm run seed` against the live project (needs Admin key).
- Optional: automated tests for the transform layer; real FHIR endpoint client.

## 8. How to run locally right now

```bash
# after adding the Admin key to .env.local:
npm run seed                                   # load data
npm run seed -- --role admin --email you@x.com # grant role
npm run dev                                     # http://localhost:3000
```

---

## 9. Feature iteration (post-MVP, live build)

Status: implemented + verified (`typecheck ✅ · build ✅ · 18 tests ✅`),
Firestore re-seeded. Admin key is configured; `admin_1@up-demo.com` is admin.

### Feature 1 — User / Account Management (admin only)
- Sidebar item **User Management** → `/admin/users` (admin-gated: middleware +
  server redirect + nav filtering).
- Server Component joins Firebase Admin `listUsers()` ⨝ Firestore `/users`
  profiles → table (Email, Role badge, Created, Status).
- **+ Add User** modal → `POST /api/admin/users` (re-verifies admin) →
  `createUser` + `setCustomUserClaims` + profile doc + `user.create` audit;
  inline email-exists error, success toast, list revalidated.
- Enable/disable toggle → `PATCH /api/admin/users/[uid]` (`updateUser`,
  audited; cannot disable self). No public registration.

### Feature 2 — Add Patient (admin only)
- **+ Add Patient** on `/patients` (only when `patient:write`) → `/patients/new`.
- Form assembles Patient + Observation(s) (add/remove, ICD-10 auto-fill,
  severity) + Encounter; Zod-validated.
- `POST /api/patients` (admin only) assembles FHIR, runs it through the same
  transform layer as ingestion, writes the bundle, `patient.create` audit,
  `revalidatePath('/patients')`, redirects to `/patients/[caseId]`, toast,
  disabled-while-pending, Cancel returns.

### Feature 3 — Native analytics module (no fake iframe)
- Dashboard + Reports render the **Native Analytics Module** when
  `NEXT_PUBLIC_LOOKER_EMBED_URL` is unset (real iframe only when set).
- BI header + "Native Analytics Module" badge + data-source line; **4 KPI tiles
  with trend arrows**; Recharts grid (see Feature 8 for final layout); honest
  Looker footnote.

### Feature 4 — De-identified naming / empty fields
- Display name is the **Case ID** `NBD-2026-#####` (list + detail); MRN kept as
  secondary; missing city falls back to region (no bare em-dash).
- Mock source emits Case ID identifier + region-derived city/facility + severity.

### Feature 5 — Reports = Regional Report
- `/reports` is now distinct from the dashboard: a **Cases-by-Region diagram**
  (horizontal bar) + a **Regional Surveillance Summary table** (Region, Patients,
  Cases, Most Common Defect, Share% with bar) and a totals row.
- `computeMetrics` now emits `regionalBreakdown` (cases/patients/top-defect/share
  per region, joining observations → patient region).

### Feature 6 — Full 18-region list + all-region records
- `PH_REGIONS` expanded to all **18 official PH administrative regions** (NCR, CAR,
  I–XIII incl. NIR & MIMAROPA, BARMM) with a representative city per region.
- Mock source guarantees **every region has ≥1 record** (first 18 patients map
  1:1 to regions; remainder distributed pseudo-randomly).

### Feature 7 — UX polish
- **UP seal logo** (`up.edu.ph/.../UP-Seal.png`) on the login page and sidebar.
- **Patients table rows are clickable** → navigate to the patient detail page
  (Case ID is also a direct link).

### Feature 8 — Dashboard layout + Case Severity card
- Native analytics restructured to **1-col → 2-col → 2-col**:
  - **Row 1 (full width):** Cases per Region — taller (auto-sized to the 18
    regions), abbreviated axis labels (NCR, CALABARZON…), full name in tooltip.
  - **Row 2:** Monthly Trend · Defect Distribution.
  - **Row 3:** Cases by Sex · **new Case Severity card**.
- New **Case Severity** card: severe/moderate/mild counts + % bars
  (maroon/gold/slate), driven by a new `severityBreakdown` aggregate in
  `computeMetrics`. `shortRegion()` helper added for compact axis labels.

### Operational note
- A 500 on `/api/patients` and an unstyled (no-Tailwind) render were both traced
  to a **stale Next dev server**, not code: a fresh server returns 200 with a
  valid admin cookie and serves `layout.css` (32 KB). Fix = `Ctrl+C` →
  `rm -rf .next` → `npm run dev` → hard refresh.

### New env vars
None. `NEXT_PUBLIC_LOOKER_EMBED_URL` (optional, pre-existing) toggles the real
Looker iframe vs the native module.

### Key files added this iteration
`src/lib/fhir/reference-data.ts`, `src/lib/data/users.ts`,
`src/app/api/admin/users/route.ts` (+ `[uid]/route.ts`),
`src/app/(protected)/admin/users/page.tsx`, `src/components/admin/user-manager.tsx`,
`src/app/(protected)/patients/new/page.tsx`,
`src/components/auth/session-context.tsx`, `src/components/ui/toast.tsx`,
`src/components/ui/logo.tsx`, `src/components/analytics/native-analytics.tsx`,
`src/components/analytics/regional-report.tsx`.
