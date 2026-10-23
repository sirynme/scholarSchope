# ScholarScope — Operations, Monitoring & Troubleshooting Runbook

## 1. Daily Automation Lifecycle & Refresh Policies

During each scheduled or diagnostic research run (`executeAutonomousDiscoveryRun`):

1. **Stale Lease Recovery**: Any `PROCESSING` job whose `leaseExpiresAt` timestamp has passed is recovered (`QUEUED` if `attempts < maxAttempts`, or `DEAD_LETTER` if exhausted).
2. **Idempotent Job Enqueueing**: Enabled, non-isolated sources are enqueued using an hourly/trigger idempotency key (`fetch-<sourceId>-<bucket>`) to prevent duplicate crawls.
3. **Bounded Batch Claiming**: Jobs are claimed up to `batchSize` while enforcing `perDomainConcurrencyLimit` (default: 2 concurrent requests per domain).
4. **Live Retrieval & Deterministic Extraction**: Each source is fetched with a 7.5s timeout and 600KB response cap. `FetchAttempt` and `SourceSnapshot` records are persisted.
5. **Claim Reconciliation & Conflict Detection**: Extracted claims are reconciled against existing claims. Independent corroboration upgrades status to `Cross-Verified` only when text is not a copied announcement. Conflicting values preserve both versions and mark `Conflicting Evidence`.
6. **Match Recalculation & Deduplicated Notifications**: Eligibility and 9-factor rankings are recalculated for all user profiles, and deduplicated notifications are emitted.

## 2. Automation States

- **Active**: All enabled sources succeeded on the latest run and 0 dead-letter jobs exist.
- **Degraded**: One or more sources returned HTTP 403/5xx (e.g., `ox.ac.uk` automated crawler restriction) or dead-letter jobs exist, while remaining sources succeeded.
- **Paused**: Manually paused by an administrator via `POST /api/admin/automation-state`.
- **Failed**: All enabled sources failed or the scheduler encountered an unrecoverable error.

## 3. Free-Tier Quotas & Provider Limitations

- **Default Zero-Cost Operation**: By default, paid search APIs and runtime LLM calls are disabled (`searchProviderEnabled: false`, `aiProviderEnabled: false`). Discovery operates over configured official seed registries and discovered child links.
- **Failing Source Isolation**: If a source fails 3 consecutive times, it is automatically isolated for 6 hours (`isolatedUntil`) so one unresponsive server cannot exhaust execution quotas.
- **Backup & Recovery**: Local persistent state is written atomically via temp-file rename to `.data/scholarscope-db.json`. Corrupted files are automatically backed up with a `.corrupted-<timestamp>.bak` suffix before recovery.
