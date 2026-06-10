# Deployment Guide

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in values (client config already provided)
# Add the Admin SDK service-account values (see "Secrets" below)
npm run seed                        # load mock surveillance data into Firestore
npm run dev                         # http://localhost:3000
```

Create a first user in Firebase Console → Authentication, then grant a role:

```bash
npm run seed -- --role admin --email you@doh.gov.ph
```

## Secrets you must provide

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_FIREBASE_*` | Console → Project settings → Your apps (web) — **already filled in** |
| `FIREBASE_ADMIN_PROJECT_ID` | `up-demo-9c45f` (already set) |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Console → Project settings → **Service accounts → Generate new private key** → `client_email` |
| `FIREBASE_ADMIN_PRIVATE_KEY` | same JSON → `private_key` (keep the `\n` escapes, wrap in quotes) |
| `NEXT_PUBLIC_LOOKER_EMBED_URL` | optional — a Looker Studio "Embed report" URL |

> The app needs a **server runtime** (session cookies + Admin SDK), so it
> deploys to **Firebase App Hosting** (or Cloud Run), not classic static Hosting.

## Deploy — Firebase App Hosting (recommended)

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

## CI/CD (GitHub Actions)

- **`.github/workflows/ci.yml`** — on every push/PR: `lint → typecheck → build`.
  Add the `NEXT_PUBLIC_FIREBASE_*` values as repo secrets for the build step.
- **`.github/workflows/deploy.yml`** — on changes to Firestore rules/indexes:
  deploys them using `FIREBASE_SERVICE_ACCOUNT` repo secret. App Hosting handles
  the app rollout automatically from the connected branch.

## Migration to GCP (future)

App Hosting already runs on Cloud Run + Cloud Build under the hood. To "graduate":
point the analytics at BigQuery + Looker Studio, add a Firestore→BigQuery export,
and route audit logs to a Cloud Logging sink. No app rewrite required.
