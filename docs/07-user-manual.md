# User Manual

## Roles at a glance

| Role | Dashboard | Patients | Patient detail | Reports | Admin Panel |
|---|---|---|---|---|---|
| **Admin** | Full analytics | ✅ | ✅ | ✅ | ✅ (ingest + audit) |
| **Analyst** | Full analytics | ✅ | ✅ | ✅ | ❌ |
| **Viewer** | Summary only | ✅ | ✅ | ❌ | ❌ |

Navigation items and pages are filtered automatically by role — users never see
controls they cannot use.

## Signing in

1. Go to the app URL → you land on **Login**.
2. Enter your DOH email + password (created by an administrator).
3. On success you are routed to your **Dashboard**.
4. Use **Logout** (top-right) to end your session.

## Pages

- **Dashboard** — surveillance overview. Admins/Analysts see the full analytics
  module (Looker simulation + charts); Viewers see headline counts.
- **Patients** — searchable, region-filterable registry. Click **View →** for
  details.
- **Patient detail** — demographics, **Observations** (birth-defect findings with
  ICD-10 codes), and **Encounters**.
- **Reports** — the full analytics module (Admin/Analyst only).
- **Admin Panel** — **Run ingestion** (pull → validate → transform → store) and
  browse the **Security Audit Trail**.

## States you may see

- **Loading** — shimmer skeletons while data loads.
- **Empty** — a labeled placeholder when there is no data (e.g. before the first
  ingestion).
- **Error** — a red panel with a **Retry** button; the error is logged
  automatically.

## Administrator tasks

- **Add a user**: Firebase Console → Authentication → Add user.
- **Assign a role**: `npm run seed -- --role <admin|analyst|viewer> --email <user>`.
- **Load/refresh data**: Admin Panel → **Run ingestion**.
- **Review activity**: Admin Panel → audit trail (logins, denials, API calls,
  page visits, client errors).
