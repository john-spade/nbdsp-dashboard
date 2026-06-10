# Looker Readiness

This document describes how the NBDSP dashboard is engineered to drop in a real
Looker Studio embed with zero refactor — just config.

---

## 1. Architecture overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          ADMIN / ANALYST / VIEWER                        │
│                    (role determined at session creation)                  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     AnalyticsEmbed  (src/components/)                     │
│                                                                          │
│   getAnalyticsSource(role)  →  { mode: "looker", url } | { mode }      │
│                      ↕                                        ↕           │
│            LookerFrame                          NativeAnalytics           │
│         (looker-frame.tsx)                   (native-analytics.tsx)       │
│         sandboxed <iframe>                      Recharts charts          │
│         16:9 · 600px min                         server aggregates        │
└────────────┬─────────────────────┬────────────────────────────────────────┘
             │                     │
             ▼                     ▼
┌──────────────────────┐  ┌───────────────────────────────────────────────┐
│   Looker Studio      │  │            Supplemental Query Panel           │
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

**Data flow (production):**

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

---

## 2. The embed seam

### Resolver — `src/lib/analytics/embed-config.ts`

```ts
export type AnalyticsSource =
  | { mode: "looker"; url: string }
  | { mode: "native" };

export function getAnalyticsSource(role: Role): AnalyticsSource {
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

---

## 3. Supplemental query panel — always present

`src/components/analytics/query-panel.tsx` is rendered alongside the embed
regardless of mode (Looker or native) for admin and analyst users.

### Filters (URL-synced, shareable)

| Filter | Type | Firestore field |
|---|---|---|
| Region | multi-select | `region` (via `in` query) |
| Defect type | multi-select | `defectLabel` (via `in` query) |
| Date range | month from/to | `effectiveDate` (via `>=` / `<=`) |
| Sex | single-select | `sex` (via `==`) |

### API — `GET /api/analytics/query`

Server-side Firestore filtering via `where()` clauses — **no client array
filtering**. Cursor pagination (25/page). Example:

```
GET /api/analytics/query?region=NCR&region=Region+III&defect=Anencephaly&sex=female&from=2025-01&to=2025-06&cursor=<lastDocId>
```

Response:

```json
{
  "rows": [{ "id", "caseId", "region", "defectLabel", "icd10", "effectiveDate", ... }],
  "total": 142,
  "nextCursor": "abc123"
}
```

---

## 4. Export endpoint — the Looker / BigQuery feed

`GET /api/analytics/export?format=csv` (admin/analyst only) returns the
de-identified, one-row-per-case dataset that Looker Studio or a scheduled
BigQuery load would consume.

**Columns:** `caseId,region,defect,icd10,sex,birthMonth,severity,status`

No PHI. No patient names. No DOB. Only coded surveillance fields.

---

## 5. Go-live steps — drop in Looker Studio

### Step 1 — Create the Looker Studio report

1. Open Google Looker Studio and create a new report.
2. Connect to your data source (BigQuery, Google Sheets, or another connector).
3. Build the report with the fields from `/api/analytics/export`.
4. Save and publish.

### Step 2 — Connect the data source

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

### Step 3 — Set the environment variable

```bash
# .env.local (or in Cloud Runtime Config / Secret Manager)
NEXT_PUBLIC_LOOKER_EMBED_URL=https://lookerstudio.google.com/embed/reports/...
NEXT_PUBLIC_LOOKER_EMBED_URL_ADMIN=https://lookerstudio.google.com/embed/reports/...  # optional
NEXT_PUBLIC_LOOKER_EMBED_URL_ANALYST=https://lookerstudio.google.com/embed/reports/...
NEXT_PUBLIC_LOOKER_EMBED_URL_VIEWER=https://lookerstudio.google.com/embed/reports/...
```

### Step 4 — Redeploy

```bash
npm run build && npm run start
# or push to main → Cloud Run auto-deploys via App Hosting
```

The dashboard **auto-switches to Looker mode** on next load for any role with
a URL configured. No code changes. No component edits.

---

## 6. Monitoring

### Embed stability

`LookerFrame` emits two telemetry events:

- `iframe.load.ok` — successful iframe load (green badge in audit trail)
- `iframe.load.fail` — error or 10s timeout (red badge in audit trail)

Both appear in **Admin Panel → Security Audit Trail** alongside all other
security events. The `detail` object includes the URL and failure reason.

### Web Vitals

`WebVitals` component (`src/components/telemetry/web-vitals.tsx`) captures:

- **LCP** (Largest Contentful Paint)
- **CLS** (Cumulative Layout Shift)
- **INP** (Interaction to Next Paint)

These are beaconed to `POST /api/log/client` and stored in the `audit_logs`
Firestore collection with the action `perf.webvital` (gold badge in the audit
trail). The `detail` object includes `name`, `value`, `rating`, and `id`.

### Admin telemetry view

All client telemetry (iframe load events + Web Vitals) is visible in the
Security Audit Trail in the Admin Panel, providing a single pane of glass
for both security events and performance observability.

---

## 7. Why native-now is acceptable

The native analytics module is not a placeholder — it is a fully functional
BI dashboard that:

- Serves the same query panel with the same server-side Firestore filters
- Uses the same de-identified export endpoint
- Follows the same UP maroon/gold design language
- Implements the same 3-layer RBAC (admin/analyst/viewer)
- Surfaces the same data contract

The only thing that changes when Looker is configured is **the renderer**.
The data pipeline, query semantics, and access controls remain identical.

This is the correct engineering approach: build to the **same contract**, not
to the same tool. Swapping the renderer becomes a config change because the
contract is preserved.

---

## 8. RBAC matrix

| Permission | Admin | Analyst | Viewer |
|---|---|---|---|
| View native analytics | ✓ | ✓ | ✗ |
| View Looker embed | ✓ (if URL set) | ✓ (if URL set) | ✓ (if URL set) |
| Supplemental query panel | ✓ | ✓ | ✗ |
| Export CSV/JSON | ✓ | ✓ | ✗ |
| Audit trail view | ✓ | ✗ | ✗ |
| FHIR ingestion | ✓ | ✗ | ✗ |