import crypto from 'node:crypto';
import { PostgresPrismaStorageAdapter, redactDatabaseError } from './postgres-adapter.js';

export interface PostgresVerificationResult {
  ok: boolean;
  checkedAt: string;
  tableCounts: {
    users: number;
    programs: number;
    scholarships: number;
    sources: number;
    evidenceClaims: number;
    jobQueueItems: number;
  };
  crudVerified: {
    userCreateReadUpdateDelete: boolean;
    sessionTokenRevokeAndCheck: boolean;
    atomicJobQueueEnqueueClaimComplete: boolean;
    transactionRollbackOnError: boolean;
  };
  error?: string;
}

/**
 * Non-destructively verifies PostgreSQL connectivity, schema presence, and essential CRUD operations
 * using isolated ephemeral probe keys that are cleaned up before returning.
 */
export async function verifyPostgresConnectivityAndCrud(
  adapter: PostgresPrismaStorageAdapter
): Promise<PostgresVerificationResult> {
  const checkedAt = new Date().toISOString();
  const probeId = `probe-${crypto.randomUUID()}`;
  const probeEmail = `${probeId}@verify.scholarscope.internal`;
  const probeTokenHash = `probe-token-hash-${ probeId }`;
  const probeJobId = `job-${probeId}`;
  const probeIdemKey = `VERIFY_PROBE::${probeId}`;

  try {
    // 1. Verify User CRUD within isolated probe record
    const createdUser = await adapter.prisma.user.create({
      data: {
        id: probeId,
        email: probeEmail,
        passwordHash: 'probe-hash',
        fullName: 'Connectivity Probe',
        role: 'student',
        onboardingCompleted: false,
      },
    });
    const readUser = await adapter.prisma.user.findUnique({ where: { id: probeId } });
    const updatedUser = await adapter.prisma.user.update({
      where: { id: probeId },
      data: { onboardingCompleted: true },
    });
    await adapter.prisma.user.delete({ where: { id: probeId } });
    const deletedCheck = await adapter.prisma.user.findUnique({ where: { id: probeId } });
    const userCrudOk =
      createdUser.id === probeId &&
      readUser?.email === probeEmail &&
      updatedUser.onboardingCompleted === true &&
      deletedCheck === null;

    // 2. Verify Session Token Revocation & Cleanup
    await adapter.revokeSessionToken(probeTokenHash, null);
    const isRevoked = await adapter.isSessionTokenRevoked(probeTokenHash);
    await adapter.prisma.revokedSessionToken.delete({ where: { tokenHash: probeTokenHash } });
    const afterCleanupRevoked = await adapter.isSessionTokenRevoked(probeTokenHash);
    const tokenOk = isRevoked === true && afterCleanupRevoked === false;

    // 3. Verify Atomic Job Queue Enqueue, Claim, Complete & Cleanup
    const nowIso = new Date().toISOString();
    const enq = await adapter.enqueueJobAtomic({
      id: probeJobId,
      idempotencyKey: probeIdemKey,
      jobType: 'VERIFY_CLAIMS',
      targetDomain: 'verify.scholarscope.internal',
      sourceId: null,
      url: 'https://verify.scholarscope.internal/',
      priority: 9999,
      status: 'QUEUED',
      attempts: 0,
      maxAttempts: 2,
      leaseOwner: null,
      leaseExpiresAt: null,
      nextRunAt: nowIso,
      lastError: null,
      executionLog: ['Probe enqueue'],
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    const claimed = await adapter.claimNextJobAtomic('probe-worker', 30_000, nowIso);
    const completed = await adapter.completeJobAtomic(enq.job.id, {
      status: 'COMPLETED',
      logLine: 'Probe completed',
    });
    await adapter.prisma.jobQueueItem.delete({ where: { id: enq.job.id } });
    const jobOk =
      !enq.deduplicated &&
      claimed?.id === enq.job.id &&
      completed?.status === 'COMPLETED';

    // 4. Verify Interactive Transaction Rollback
    const rollbackProbeId = `rollback-${probeId}`;
    let rolledBack = false;
    try {
      await adapter.withTransaction(async (tx) => {
        await tx.user.create({
          data: {
            id: rollbackProbeId,
            email: `${rollbackProbeId}@verify.scholarscope.internal`,
            passwordHash: 'probe',
            fullName: 'Rollback Probe',
            role: 'student',
            onboardingCompleted: false,
          },
        });
        throw new Error('Intentional probe rollback');
      });
    } catch {
      const checkRollback = await adapter.prisma.user.findUnique({
        where: { id: rollbackProbeId },
      });
      rolledBack = checkRollback === null;
    }

    // 5. Read current table counts
    const [users, programs, scholarships, sources, evidenceClaims, jobQueueItems] =
      await Promise.all([
        adapter.prisma.user.count(),
        adapter.prisma.program.count(),
        adapter.prisma.scholarship.count(),
        adapter.prisma.sourceRegistry.count(),
        adapter.prisma.evidenceClaim.count(),
        adapter.prisma.jobQueueItem.count(),
      ]);

    const allOk = userCrudOk && tokenOk && jobOk && rolledBack;
    return {
      ok: allOk,
      checkedAt,
      tableCounts: {
        users,
        programs,
        scholarships,
        sources,
        evidenceClaims,
        jobQueueItems,
      },
      crudVerified: {
        userCreateReadUpdateDelete: userCrudOk,
        sessionTokenRevokeAndCheck: tokenOk,
        atomicJobQueueEnqueueClaimComplete: jobOk,
        transactionRollbackOnError: rolledBack,
      },
    };
  } catch (err) {
    const redacted = redactDatabaseError(err);
    return {
      ok: false,
      checkedAt,
      tableCounts: {
        users: 0,
        programs: 0,
        scholarships: 0,
        sources: 0,
        evidenceClaims: 0,
        jobQueueItems: 0,
      },
      crudVerified: {
        userCreateReadUpdateDelete: false,
        sessionTokenRevokeAndCheck: false,
        atomicJobQueueEnqueueClaimComplete: false,
        transactionRollbackOnError: false,
      },
      error: redacted.message,
    };
  }
}

const isDirectExecution =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  process.argv[1].endsWith('verify-postgres.ts');

if (isDirectExecution) {
  (async () => {
    const adapter = new PostgresPrismaStorageAdapter();
    const report = await verifyPostgresConnectivityAndCrud(adapter);
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) {
      process.exit(1);
    }
  })().catch((err) => {
    console.error('[ScholarScope DB Verify] Fatal error:', redactDatabaseError(err).message);
    process.exit(1);
  });
}
