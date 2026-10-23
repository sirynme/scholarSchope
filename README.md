# ScholarScope — Autonomous Graduate Admissions & Scholarship Intelligence Platform

ScholarScope is a multi-user graduate admissions, scholarship discovery, evidence verification, deterministic funding classification, and eligibility evaluation platform built for international and domestic applicants worldwide.

## Core Principles & Non-Negotiable Guarantees

1. **Real Live Data Only**: Production opportunity records originate from live HTTP fetches against configured authoritative official university, department, and scholarship portals.
2. **First-Class Evidence Provenance**: Every extracted claim preserves its verbatim supporting excerpt, SHA-256 excerpt hash, source URL, retrieval timestamp, verification method, and explicit verification status (`Officially Confirmed`, `Cross-Verified`, `Official Source, Not Fully Verified`, `Conflicting Evidence`, `Stale`, `Unverified`, `Unavailable`).
3. **Honest Uncertainty & Non-Destructive Conflict Handling**: When an official source returns HTTP 403 (`ox.ac.uk`) or omits a numeric threshold, ScholarScope records the exact HTTP telemetry and marks the record `Unavailable` or `Official Source, Not Fully Verified` without inventing deadlines or funding figures.
4. **Deterministic Funding & Living-Cost Benchmarks**: Compares documented stipends against official statutory living-cost benchmarks (`UKVI £13,692/yr`, `ETH/Swiss CHF 24,000/yr`, `MIT $38,400/yr`, `IRCC CAD $20,635/yr`, `Germany BAMF €11,904/yr`). Tuition-only awards are never classified as fully funded.
5. **Multi-System Academic Scales Without Invented GPA Conversions**: Supports `4.0`, `10.0`, `100%`, `UK_HONORS`, `GERMAN_1_5`, and `SWISS_6_0`. Cross-scale comparisons without an official institutional equivalency table are marked `Needs Verification`.
6. **Strict Row-Level User Isolation**: Shared public research records are separated from private user profiles, qualifications, saved opportunities, application tasks, checklists, and notifications.

## Documentation Index

- [System Architecture](docs/ARCHITECTURE.md)
- [Setup, Database Migrations & Deployment Guide](docs/SETUP.md)
- [Daily Operations, Scheduler & Troubleshooting](docs/OPERATIONS.md)
- [Engineering Memory & Verification Log](MEMORY.md)

## Quick Start Commands

```bash
# Install dependencies
npm install

# Run TypeScript check
npm run lint

# Run unit & integration tests (13 test suites)
./node_modules/.bin/tsx --test src/lib/engines.test.ts

# Start full-stack server on port 3000
npm run dev

# Build production bundle
npm run build
```
