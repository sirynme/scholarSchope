# ScholarScope — Setup, Database & Deployment Guide

## 1. Required & Optional Environment Variables

Copy `.env.example` to `.env` and configure the following variables:

| Variable | Required | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | Production (Neon) | PostgreSQL connection string (`postgresql://...`). Local runtime automatically uses `.data/scholarscope-db.json` when PostgreSQL is not attached. |
| `SESSION_SECRET` | Yes | 32-byte cryptographic secret for session token signing. |
| `CRON_SECRET` | Yes | Shared secret required via `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret` header on `POST /api/cron/daily-research`. |
| `RESEND_API_KEY` | Optional | API key for transactional email delivery via Resend. When omitted, email deliveries are logged as `SKIPPED_PROVIDER_UNCONFIGURED` and persistent in-app notifications serve as the fallback. |
| `RESEND_FROM_EMAIL` | Optional | Verified sender address for Resend emails. |
| `GEMINI_API_KEY` | Optional | Server-side key for optional Search Grounding (`gemini-3.8-flash`) and High-Thinking (`gemini-4-argon`). Disabled by default per Section 3 Provider Policy. |
| `APP_URL` | Optional | Base URL of the deployed application (`http://localhost:3000` in development). |

## 2. Database Creation & Prisma Migrations (Neon PostgreSQL)

To provision a Neon PostgreSQL database and apply the versioned schema:

```bash
# Validate Prisma schema
npx prisma validate

# Apply versioned migrations to production PostgreSQL database
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

## 3. Vercel / Cloud Run Deployment & Cron Configuration

For scheduled daily autonomous operation at 04:00 UTC, configure `vercel.json` or Cloud Scheduler to invoke:

- **Endpoint**: `POST /api/cron/daily-research`
- **Schedule**: `0 4 * * *`
- **Header**: `Authorization: Bearer <CRON_SECRET>`

## 4. Source Onboarding Procedure

Administrators can add new authoritative sources either via the **Admin & System Health** UI (`02. Onboard Authoritative Official Source Domain`) or via `POST /api/admin/sources`:

1. Verify that the target URL is an official university, department, government, or fellowship domain (`https://`).
2. Confirm that `robots.txt` permits automated access.
3. Choose the appropriate refresh policy (`DAILY` for open deadline-sensitive awards, `EVERY_3_DAYS` for active directories, `WEEKLY` for general requirements).
4. SSRF protection automatically validates the URL and blocks private IP ranges or internal hostnames.
