# Analytics Module

The app uses a Looker-ready architecture without requiring a Looker Studio
account today: one embed seam, two interchangeable renderers.

## A. Embed seam

`src/lib/analytics/embed-config.ts` exports:

```ts
getAnalyticsSource(role)
```

It resolves role-aware env vars in this order:

| Role | Primary env var | Fallback |
|---|---|---|
| admin | `NEXT_PUBLIC_LOOKER_EMBED_URL_ADMIN` | `NEXT_PUBLIC_LOOKER_EMBED_URL` |
| analyst | `NEXT_PUBLIC_LOOKER_EMBED_URL_ANALYST` | `NEXT_PUBLIC_LOOKER_EMBED_URL` |
| viewer | `NEXT_PUBLIC_LOOKER_EMBED_URL_VIEWER` | `NEXT_PUBLIC_LOOKER_EMBED_URL` |

If no URL is configured, it returns `{ mode: "native" }`. If a URL is
configured, it returns `{ mode: "looker", url }`. This mirrors the way a real
Looker Studio deployment can give each role a filtered report URL.

`src/components/analytics/analytics-embed.tsx` is the only component that
chooses between renderers:

- `mode: "looker"` renders `LookerFrame`.
- `mode: "native"` renders `NativeAnalytics`.
- The status badge honestly reports either "Looker Studio" or "Native Analytics
  Module".

Going live with Looker is a config change, not a refactor.

## B. Looker frame

`src/components/analytics/looker-frame.tsx` is the production iframe wrapper used
as soon as a Looker URL exists.

- Sandboxed iframe with fullscreen support.
- Responsive 16:9 layout with a 600px minimum height.
- Skeleton while loading.
- `iframe.load.ok` telemetry on load.
- `iframe.load.fail` telemetry on error or 10 second timeout.
- Error card with Retry.

## C. Native analytics renderer

`src/components/analytics/native-analytics.tsx` is the dashboard that runs today.
It uses Recharts and server-backed aggregates from `GET /api/analytics/metrics`.

The aggregation logic lives in `src/lib/analytics/metrics.ts` and runs on the
server, so the browser receives only aggregate analytics data.

## D. Supplemental query panel

`src/components/analytics/query-panel.tsx` is always present for admin and
analyst users, regardless of whether the main renderer is native or Looker.

It provides:

- Region multi-select.
- Defect type multi-select.
- Month range.
- Sex filter.
- URL-synced filters for shareable views.
- Server-side Firestore `where()` filtering through `GET /api/analytics/query`.
- Matching case count and a 25-row paginated table.

## E. Looker / BigQuery feed

`GET /api/analytics/export?format=csv` returns the de-identified dataset Looker
or BigQuery would consume:

```csv
caseId,region,defect,icd10,sex,birthMonth,severity,status
```

This endpoint is the Looker/BigQuery feed. Point a Looker Studio connector or a
scheduled BigQuery load at `/api/analytics/export` to go live. The feed is
restricted to admin and analyst users and contains no PHI.

Palette: UP maroon and gold, consistent with the app theme.
