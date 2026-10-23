# ScholarScope — Engineering Memory & Pre-Export Audit Log

**Last Updated:** 2026-10-21T07:02:00-07:00
**Current Phase:** Completed — Pre-Export Audit, Security Hardening, Verification & Vercel Readiness Passed

## 1. Completed Work & Audit Corrections
- **Zero-Demo-Data & Zero-Synthetic-Activity Enforcement**:
  - Removed automatic seeding of synthetic `savedOpportunities`, `tasks`, and `checklistItems` from `executeAutonomousDiscoveryRun` (`src/server/discovery-runner.ts`) and removed pre-seeded fictional `qualifications` from `createInitialDatabase` (`src/server/db.ts`).
  - Cleaned persisted store (`.data/scholarscope-db.json`) so user tracker, tasks, checklists, and qualifications start at `0` until created by real user actions.
- **Live Official-Source Discovery & Security Hardening**:
  - Updated `fetchOfficialUrlLive` (`src/server/discovery-runner.ts`) to check `robots.txt` per origin (`isAllowedByRobotsTxt`) and follow HTTP redirects hop-by-hop (`redirect: 'manual'`, max 5 hops) validating every hop with `validateRedirectTarget` against SSRF and private IP ranges.
  - Added generic deterministic extraction fallback for any newly onboarded official university or scholarship source URL without inventing unverified fields.
- **Authentication, Session Security & Storage Verification**:
  - Upgraded password hashing (`src/server/db.ts`) to use per-password random 16-byte salts (`scrypt$<salt>$<derivedKey>`) with `crypto.timingSafeEqual`.
  - Replaced unsigned in-memory session lookup and unauthenticated header fallback in `server.ts` with HMAC-SHA256 signed session tokens (`createSignedSessionToken` / `verifySignedSessionToken`) and token revocation on logout.
  - Added `assertStorageConfiguration()` (`src/server/db.ts`) to fail fast with `DatabaseConfigurationError` if deployed to Vercel serverless (`VERCEL=1`) without an authoritative PostgreSQL `DATABASE_URL`.
  - Added `/api/health` endpoint reporting storage mode, system health, and discovery telemetry.
  - Added `vercel.json` (with daily `0 4 * * *` cron schedule for `/api/cron/daily-research`) and `api/index.ts` serverless entry point.
- **Verification**:
  - `15/15` unit and integration tests passing (`tsx --test src/lib/engines.test.ts`).
  - `tsc --noEmit` (`lint_applet`) and `vite build` (`compile_applet`) passing with zero errors.
  - Verified desktop (`1440x900`) and mobile (`390x844`) viewports in headless Chromium via `playwright-cli` with 0 console errors and 0 warnings.

## 2. Pending Tasks
- None. Ready for controlled export to Vercel.
