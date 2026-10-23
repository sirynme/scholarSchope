import crypto from 'node:crypto';
import { AutomationState, JobQueueItemRecord } from './types';

// ============================================================================
// Durable PostgreSQL-Compatible Job Queue & Automation State Engine (Section 11)
// ============================================================================

export interface EnqueueJobInput {
  idempotencyKey: string;
  jobType: JobQueueItemRecord['jobType'];
  targetDomain: string;
  sourceId?: string | null;
  url?: string | null;
  priority?: number;
  maxAttempts?: number;
  nextRunAt?: Date;
}

/**
 * Enqueues a job idempotently. If an active or completed job with the same idempotencyKey
 * already exists, returns the existing job without creating a duplicate.
 */
export function enqueueJobIdempotent(
  queue: JobQueueItemRecord[],
  input: EnqueueJobInput,
  now: Date = new Date()
): {
  queue: JobQueueItemRecord[];
  job: JobQueueItemRecord;
  created: boolean;
} {
  const existing = queue.find((j) => j.idempotencyKey === input.idempotencyKey);
  if (existing) {
    return { queue, job: existing, created: false };
  }

  const nowIso = now.toISOString();
  const job: JobQueueItemRecord = {
    id: crypto.randomUUID(),
    idempotencyKey: input.idempotencyKey,
    jobType: input.jobType,
    targetDomain: input.targetDomain.toLowerCase(),
    sourceId: input.sourceId ?? null,
    url: input.url ?? null,
    priority: input.priority ?? 50,
    status: 'QUEUED',
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 3,
    leaseOwner: null,
    leaseExpiresAt: null,
    nextRunAt: (input.nextRunAt || now).toISOString(),
    lastError: null,
    executionLog: [`[${nowIso}] Job enqueued with idempotencyKey=${input.idempotencyKey}`],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  return {
    queue: [...queue, job],
    job,
    created: true,
  };
}

/**
 * Recovers stale jobs whose processing lease has expired (`leaseExpiresAt < now`).
 * If attempts < maxAttempts, transitions back to 'QUEUED'; otherwise transitions to 'DEAD_LETTER'.
 */
export function recoverStaleJobs(
  queue: JobQueueItemRecord[],
  now: Date = new Date()
): {
  queue: JobQueueItemRecord[];
  recoveredCount: number;
  deadLetteredCount: number;
} {
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  let recoveredCount = 0;
  let deadLetteredCount = 0;

  const updated = queue.map((job) => {
    if (job.status !== 'PROCESSING' || !job.leaseExpiresAt) return job;
    const expMs = new Date(job.leaseExpiresAt).getTime();
    if (expMs > nowMs) return job;

    if (job.attempts < job.maxAttempts) {
      recoveredCount++;
      return {
        ...job,
        status: 'QUEUED' as const,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: 'Lease expired (stale worker recovery)',
        executionLog: [...job.executionLog, `[${nowIso}] Stale lease recovered -> re-queued`],
        updatedAt: nowIso,
      };
    } else {
      deadLetteredCount++;
      return {
        ...job,
        status: 'DEAD_LETTER' as const,
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: 'Exceeded max attempts after stale lease expiration',
        executionLog: [...job.executionLog, `[${nowIso}] Stale lease exceeded maxAttempts -> DEAD_LETTER`],
        updatedAt: nowIso,
      };
    }
  });

  return { queue: updated, recoveredCount, deadLetteredCount };
}

/**
 * Atomically claims up to `batchSize` ready jobs while respecting `perDomainConcurrencyLimit`.
 */
export function claimNextJobsBatch(
  queue: JobQueueItemRecord[],
  options: {
    workerId: string;
    batchSize: number;
    leaseDurationMs?: number;
    perDomainConcurrencyLimit?: number;
    now?: Date;
  }
): {
  queue: JobQueueItemRecord[];
  claimedJobs: JobQueueItemRecord[];
} {
  const now = options.now || new Date();
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const leaseExpiresAt = new Date(nowMs + (options.leaseDurationMs ?? 60_000)).toISOString();
  const domainLimit = options.perDomainConcurrencyLimit ?? 2;

  // Count currently processing jobs per domain
  const activeDomainCounts = new Map<string, number>();
  for (const j of queue) {
    if (j.status === 'PROCESSING') {
      activeDomainCounts.set(j.targetDomain, (activeDomainCounts.get(j.targetDomain) || 0) + 1);
    }
  }

  // Sort eligible candidates by priority DESC, then nextRunAt ASC
  const eligibleIds = queue
    .filter((j) => j.status === 'QUEUED' && new Date(j.nextRunAt).getTime() <= nowMs)
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime();
    })
    .map((j) => j.id);

  const claimedIds = new Set<string>();
  for (const candidateId of eligibleIds) {
    if (claimedIds.size >= options.batchSize) break;
    const job = queue.find((j) => j.id === candidateId)!;
    const currentDomainActive = activeDomainCounts.get(job.targetDomain) || 0;
    if (currentDomainActive >= domainLimit) {
      continue; // Respect per-domain concurrency limit
    }
    claimedIds.add(candidateId);
    activeDomainCounts.set(job.targetDomain, currentDomainActive + 1);
  }

  const claimedJobs: JobQueueItemRecord[] = [];
  const updatedQueue = queue.map((j) => {
    if (!claimedIds.has(j.id)) return j;
    const claimed: JobQueueItemRecord = {
      ...j,
      status: 'PROCESSING',
      attempts: j.attempts + 1,
      leaseOwner: options.workerId,
      leaseExpiresAt,
      executionLog: [...j.executionLog, `[${nowIso}] Claimed by ${options.workerId} (attempt ${j.attempts + 1}/${j.maxAttempts})`],
      updatedAt: nowIso,
    };
    claimedJobs.push(claimed);
    return claimed;
  });

  return { queue: updatedQueue, claimedJobs };
}

/**
 * Computes exponential backoff with deterministic or random jitter in milliseconds.
 */
export function computeBackoffWithJitterMs(attempt: number, baseDelayMs = 2000, jitterRatio = 0.2): number {
  const exp = Math.min(attempt, 6);
  const raw = baseDelayMs * Math.pow(2, exp - 1);
  const jitter = Math.round(raw * jitterRatio * ((attempt * 37) % 10) / 10);
  return raw + jitter;
}

/**
 * Completes or fails a claimed job, applying exponential backoff retry or transitioning to DEAD_LETTER.
 */
export function finalizeJobExecution(
  queue: JobQueueItemRecord[],
  jobId: string,
  outcome: {
    success: boolean;
    logMessage: string;
    errorMessage?: string;
    now?: Date;
  }
): JobQueueItemRecord[] {
  const now = outcome.now || new Date();
  const nowIso = now.toISOString();

  return queue.map((j) => {
    if (j.id !== jobId) return j;

    if (outcome.success) {
      return {
        ...j,
        status: 'COMPLETED',
        leaseOwner: null,
        leaseExpiresAt: null,
        lastError: null,
        executionLog: [...j.executionLog, `[${nowIso}] COMPLETED: ${outcome.logMessage}`],
        updatedAt: nowIso,
      };
    }

    const canRetry = j.attempts < j.maxAttempts;
    const backoffMs = computeBackoffWithJitterMs(j.attempts);
    const nextRunIso = new Date(now.getTime() + backoffMs).toISOString();

    return {
      ...j,
      status: canRetry ? 'QUEUED' : 'DEAD_LETTER',
      leaseOwner: null,
      leaseExpiresAt: null,
      nextRunAt: canRetry ? nextRunIso : j.nextRunAt,
      lastError: outcome.errorMessage || 'Job execution failed',
      executionLog: [
        ...j.executionLog,
        `[${nowIso}] FAILED: ${outcome.errorMessage || outcome.logMessage} (${
          canRetry ? `retrying at ${nextRunIso}` : 'moved to DEAD_LETTER'
        })`,
      ],
      updatedAt: nowIso,
    };
  });
}

/**
 * Derives actual automation state ('Active' | 'Degraded' | 'Paused' | 'Failed')
 * from job history, recent runs, queue health, and manual pause state (Section 11).
 */
export function deriveAutomationState(params: {
  isManuallyPaused: boolean;
  recentRunStatuses: Array<'RUNNING' | 'COMPLETED' | 'DEGRADED' | 'FAILED'>;
  deadLetterJobCount: number;
  isolatedSourcesCount: number;
  totalEnabledSourcesCount: number;
}): {
  state: AutomationState;
  reason: string;
} {
  if (params.isManuallyPaused) {
    return {
      state: 'Paused',
      reason: 'Automation is manually paused by an administrator.',
    };
  }

  const latestStatus = params.recentRunStatuses[0];
  if (
    latestStatus === 'FAILED' ||
    (params.totalEnabledSourcesCount > 0 && params.isolatedSourcesCount >= params.totalEnabledSourcesCount)
  ) {
    return {
      state: 'Failed',
      reason: 'Most recent research run failed or all enabled sources are currently isolated due to repeated errors.',
    };
  }

  if (
    latestStatus === 'DEGRADED' ||
    params.deadLetterJobCount > 0 ||
    params.isolatedSourcesCount > 0
  ) {
    return {
      state: 'Degraded',
      reason: `Partial source coverage: ${params.isolatedSourcesCount} isolated source(s), ${params.deadLetterJobCount} dead-letter job(s).`,
    };
  }

  return {
    state: 'Active',
    reason: 'All scheduled discovery, verification, and monitoring pipelines are operating normally.',
  };
}
