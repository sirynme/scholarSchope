# ScholarScope — System Architecture

## 1. High-Level Architecture

ScholarScope is architected into four decoupled layers:

1. **Deterministic Intelligence & Security Engines (`src/lib/`)**:
   - `url-security.ts`: Canonical URL normalization, tracking parameter removal, SHA-256 fingerprinting, SSRF/private-IP blocking (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, cloud metadata), `robots.txt` compliance, and untrusted web content prompt-injection sanitization.
   - `evidence-engine.ts`: 7-state verification state machine (`Officially Confirmed`, `Cross-Verified`, `Official Source, Not Fully Verified`, `Conflicting Evidence`, `Stale`, `Unverified`, `Unavailable`), authority-to-claim validation, copied-announcement Jaccard deduplication, and non-destructive version preservation.
   - `funding-engine.ts`: 9-state deterministic funding classifier and statutory living-cost benchmark comparator.
   - `eligibility-engine.ts`: 3-part eligibility evaluator (`Admission Eligibility`, `Scholarship Eligibility`, `Funding Completeness`), multi-scale academic evaluator, and explainable 9-factor ranking engine.
   - `extraction-engine.ts`: Live HTML boilerplate stripper, non-inventive deadline parser, genuine change detector, and deduplicated notification generator.
   - `job-queue.ts`: Durable job queue with atomic batch claiming, unique idempotency keys, processing leases, exponential backoff with jitter, stale-job recovery, and per-domain concurrency limits.

2. **Autonomous Discovery & Persistence Layer (`src/server/` & `prisma/`)**:
   - `prisma/schema.prisma` & `prisma/migrations/20261021000000_init/migration.sql`: Normalized 20-model PostgreSQL schema for Neon/Vercel deployment.
   - `src/server/db.ts`: ACID-safe transactional store (`.data/scholarscope-db.json`) mirroring the Prisma schema for zero-dependency container execution.
   - `src/server/discovery-runner.ts`: Live HTTP crawler and extractor that fetches official university and scholarship seeds, logs `FetchAttempt` telemetry, stores `SourceSnapshot` hashes, reconciles `EvidenceClaim` records, and recalculates user matches.

3. **Full-Stack API Server (`server.ts`)**:
   - Express + Vite server enforcing CSP headers, per-IP rate limiting, session cookies, row-level user isolation, `CRON_SECRET` scheduler verification, optional Resend email dispatch, and optional server-side `@google/genai` Search Grounding (`gemini-3.8-flash`) and High-Thinking (`gemini-4-argon` with `ThinkingLevel.HIGH`) endpoints.

4. **18-View Accessible Web Interface (`src/App.tsx`, `src/components/`)**:
   - Built with React 19, TypeScript strict mode, Tailwind CSS, `Plus Jakarta Sans`, `Public Sans`, and `IBM Plex Mono` tabular numerals.
