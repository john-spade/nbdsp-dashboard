# System Flows

## Auth flow

```
User → Login page
  → signInWithEmailAndPassword (Firebase Auth, client)
  → user.getIdToken()
  → POST /api/auth/session { idToken }
      → adminAuth.verifyIdToken()
      → adminAuth.createSessionCookie()   (5-day, httpOnly)
      → Set-Cookie __nbdsp_session
      → audit("auth.login")
  → redirect to ?next or /dashboard
  → Edge middleware sees cookie → allows protected routes
  → (protected)/layout verifies cookie via Admin SDK → injects user+role
```

Logout: `DELETE /api/auth/session` clears the cookie + `signOut(auth)` + audit.

## Data flow (the canonical pipeline)

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

## Dashboard flow (role-aware rendering)

```
Login → (protected)/layout resolves role
  ├── admin   → Dashboard: full AnalyticsModule (embed + native charts) + Admin
  ├── analyst → Dashboard + Reports: full AnalyticsModule
  └── viewer  → Dashboard: ViewerSummary only (no analytics:view permission)
```

The analytics module renders the **Looker Studio simulation (iframe)** on top and
the **native Recharts module** beneath, fed by `/api/analytics/metrics`.

## Error-handling flow

| Failure | Handling |
|---|---|
| **Token expired / revoked** | `verifySessionCookie(_, true)` returns null → layout `redirect('/login')`; API returns `401` |
| **Insufficient role** | `withAuth` → `403` + `audit("auth.denied")`; pages `redirect('/dashboard')` |
| **API failure** | React Query `isError` → `ErrorState` with **Retry**; handler returns safe `500` (no stack leak) |
| **Iframe CORS / load failure** | `LookerEmbed` `onError` → fallback panel + native module still renders |
| **Invalid FHIR record** | Skipped + counted in ingestion summary (never aborts the batch) |
| **Uncaught client error** | `app/error.tsx` boundary → beacon `error.client` to audit log |
```
