# API Documentation

All routes are Next.js API routes under `/api`. Protected routes are wrapped with
`withAuth(permission, handler)` which: verifies the session cookie → enforces
RBAC → writes an `api.call` audit entry → returns a safe error envelope.

Auth is via the `__nbdsp_session` httpOnly cookie (sent automatically by the
browser). Errors use `{ "error": string }` with the appropriate status.

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/api/auth/session` | public | Exchange `{ idToken }` for a session cookie (login) |
| DELETE | `/api/auth/session` | session | Clear session cookie (logout) |
| GET | `/api/auth/me` | session | Current `{ user }` or 401 |
| GET | `/api/fhir/:resource` | `observation:read` | Simulated FHIR R4 Bundle (`Patient`\|`Observation`\|`Encounter`) |
| GET | `/api/patients` | `patient:read` | `{ patients[], total }` |
| GET | `/api/patients/:id` | `patient:read` | `{ patient, observations[], encounters[] }` |
| GET | `/api/analytics/metrics` | `analytics:view` | `{ metrics }` (SurveillanceMetrics) |
| POST | `/api/admin/ingest` | `user:manage` | Run pipeline → `{ ok, summary }` |
| GET | `/api/admin/audit?limit=` | `audit:view` | `{ entries[] }` recent audit logs |
| POST | `/api/log/client` | session | Telemetry beacon (`page.visit` \| `error.client`) |

## Examples

### Login

```http
POST /api/auth/session
Content-Type: application/json

{ "idToken": "<firebase id token>" }
→ 200 { "ok": true }   (Set-Cookie: __nbdsp_session=...; HttpOnly)
```

### Metrics

```http
GET /api/analytics/metrics
→ 200 {
  "metrics": {
    "totalPatients": 120,
    "totalObservations": 138,
    "casesByRegion": [{ "region": "NCR", "count": 22 }, ...],
    "defectDistribution": [{ "label": "Ventricular septal defect", "count": 19 }, ...],
    "monthlyTrend": [{ "month": "2025-01", "count": 8 }, ...]
  }
}
```

### Status codes

`200` ok · `400` bad input · `401` no/invalid session · `403` role denied ·
`404` not found · `500` server error (details logged, not returned).
