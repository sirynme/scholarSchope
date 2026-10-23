import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import type {
  DatabaseSchema,
} from './db.js';
import type {
  UserRecord,
  UserProfileRecord,
  UserQualificationRecord,
  InstitutionRecord,
  DepartmentRecord,
  ProgramRecord,
  AdmissionRequirementRecord,
  ScholarshipRecord,
  FundingPackageRecord,
  EvidenceClaimRecord,
  ClaimVersionRecord,
  EligibilityResultRecord,
  SourceRegistryRecord,
  FetchAttemptRecord,
  SourceSnapshotRecord,
  JobQueueItemRecord,
  ResearchRunRecord,
  ChangeEventRecord,
  SavedOpportunityRecord,
  ApplicationTaskRecord,
  DocumentChecklistItemRecord,
  NotificationRecord,
  EmailDeliveryRecord,
  AuditLogRecord,
  SystemHealthRecord,
  VerificationStatus,
  FundingClassification,
  EligibilityStatus,
  ApplicationStatus,
  GradingScale,
  ClaimType,
  BroadFieldCategory,
  OpportunityType,
  FundingPreferenceMode,
  PakistaniEligibilityStatus,
  GlobalRegion,
  AutomationState,
  RuleDecisionItem,
  RankingFactorBreakdown,
} from '../lib/types.js';

export interface StorageAdapter {
  readonly mode: 'POSTGRESQL_PRISMA' | 'LOCAL_JSON_FILE';
  loadDatabase(): Promise<DatabaseSchema>;
  saveDatabase(db: DatabaseSchema): Promise<void>;
  revokeSessionToken(tokenHash: string, userId?: string | null): Promise<void>;
  isSessionTokenRevoked(tokenHash: string): Promise<boolean>;
  listRevokedTokenHashes(): Promise<string[]>;
}

/**
 * Redacts connection strings, credentials, passwords, and tokens from any database error.
 */
export function redactDatabaseError(err: unknown): Error {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const redactedMessage = rawMessage
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, 'postgresql://[REDACTED_CREDENTIALS]')
    .replace(/(password|secret|token|api_key|apikey)=([^\s&"']+)/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
  const cleanError = new Error(redactedMessage);
  cleanError.name = err instanceof Error ? err.name : 'DatabaseError';
  return cleanError;
}

declare global {
  // eslint-disable-next-line no-var
  var __scholarScopePgPool: pg.Pool | undefined;
  // eslint-disable-next-line no-var
  var __scholarScopePrismaClient: PrismaClient | undefined;
}

export function createPrismaClientWithPgPool(
  connectionString?: string,
  injectedPool?: pg.Pool
): { prisma: PrismaClient; pool: pg.Pool } {
  if (injectedPool) {
    const adapter = new PrismaPg(injectedPool);
    const prisma = new PrismaClient({ adapter });
    return { prisma, pool: injectedPool };
  }

  const dbUrl = (
    connectionString ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.NEON_DATABASE_URL ??
    process.env.SUPABASE_DB_URL ??
    ''
  ).trim();
  if (!dbUrl || (!dbUrl.startsWith('postgres://') && !dbUrl.startsWith('postgresql://'))) {
    throw new Error(
      'PostgreSQL connection string (DATABASE_URL) is missing or invalid. Expected postgres:// or postgresql:// URI.'
    );
  }

  if (globalThis.__scholarScopePrismaClient && globalThis.__scholarScopePgPool) {
    return {
      prisma: globalThis.__scholarScopePrismaClient,
      pool: globalThis.__scholarScopePgPool,
    };
  }

  const isLocalHost = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
  const pool = new pg.Pool({
    connectionString: dbUrl,
    max: Number(process.env.PG_POOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: isLocalHost ? undefined : { rejectUnauthorized: false },
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== 'test') {
    globalThis.__scholarScopePgPool = pool;
    globalThis.__scholarScopePrismaClient = prisma;
  }

  return { prisma, pool };
}

function toIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString();
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? String(d) : parsed.toISOString();
}

function toRequiredIso(d: Date | string | null | undefined, fallbackIso?: string): string {
  return toIso(d) ?? fallbackIso ?? new Date().toISOString();
}

function toDateOrNull(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toRequiredDate(iso: string | null | undefined): Date {
  if (!iso) return new Date();
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export class PostgresPrismaStorageAdapter implements StorageAdapter {
  public readonly mode = 'POSTGRESQL_PRISMA' as const;
  public readonly prisma: PrismaClient;
  public readonly pool?: pg.Pool;
  private enqueueMutex: Promise<unknown> = Promise.resolve();

  constructor(options?: { prisma?: PrismaClient; pool?: pg.Pool; connectionString?: string }) {
    if (options?.prisma) {
      this.prisma = options.prisma;
      this.pool = options.pool;
    } else {
      const created = createPrismaClientWithPgPool(options?.connectionString, options?.pool);
      this.prisma = created.prisma;
      this.pool = created.pool;
    }
  }

  /**
   * Executes an arbitrary callback inside a Prisma interactive transaction.
   * Any error rolls back all writes within the transaction and redacts credentials.
   */
  async withTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          return await fn(tx);
        },
        { timeout: 60_000, maxWait: 15_000 }
      );
    } catch (err) {
      throw redactDatabaseError(err);
    }
  }

  async revokeSessionToken(tokenHash: string, userId?: string | null): Promise<void> {
    try {
      await this.prisma.revokedSessionToken.upsert({
        where: { tokenHash },
        update: { userId: userId ?? null },
        create: {
          tokenHash,
          userId: userId ?? null,
          revokedAt: new Date(),
        },
      });
    } catch (err) {
      throw redactDatabaseError(err);
    }
  }

  async isSessionTokenRevoked(tokenHash: string): Promise<boolean> {
    try {
      const row = await this.prisma.revokedSessionToken.findUnique({
        where: { tokenHash },
      });
      return Boolean(row);
    } catch (err) {
      throw redactDatabaseError(err);
    }
  }

  async listRevokedTokenHashes(): Promise<string[]> {
    try {
      const rows = await this.prisma.revokedSessionToken.findMany({
        select: { tokenHash: true },
      });
      return rows.map((r) => r.tokenHash);
    } catch (err) {
      throw redactDatabaseError(err);
    }
  }

  /**
   * Atomically enqueues a job in PostgreSQL with idempotency protection.
   * Prevents duplicate QUEUED / PROCESSING jobs for the same idempotencyKey even under concurrent calls.
   */
  async enqueueJobAtomic(
    job: JobQueueItemRecord
  ): Promise<{ job: JobQueueItemRecord; deduplicated: boolean }> {
    const run = async (): Promise<{ job: JobQueueItemRecord; deduplicated: boolean }> => {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const existing = await tx.jobQueueItem.findUnique({
            where: { idempotencyKey: job.idempotencyKey },
          });

          if (existing && (existing.status === 'QUEUED' || existing.status === 'PROCESSING')) {
            return {
              job: this.mapJobRowToRecord(existing),
              deduplicated: true,
            };
          }

          const upserted = await tx.jobQueueItem.upsert({
            where: { idempotencyKey: job.idempotencyKey },
            update: {
              jobType: job.jobType,
              targetDomain: job.targetDomain,
              sourceId: job.sourceId,
              url: job.url,
              priority: job.priority,
              status: job.status,
              attempts: job.attempts,
              maxAttempts: job.maxAttempts,
              leaseOwner: job.leaseOwner,
              leaseExpiresAt: toDateOrNull(job.leaseExpiresAt),
              nextRunAt: toRequiredDate(job.nextRunAt),
              lastError: job.lastError,
              executionLog: job.executionLog,
              updatedAt: toRequiredDate(job.updatedAt),
            },
            create: {
              id: job.id,
              idempotencyKey: job.idempotencyKey,
              jobType: job.jobType,
              targetDomain: job.targetDomain,
              sourceId: job.sourceId,
              url: job.url,
              priority: job.priority,
              status: job.status,
              attempts: job.attempts,
              maxAttempts: job.maxAttempts,
              leaseOwner: job.leaseOwner,
              leaseExpiresAt: toDateOrNull(job.leaseExpiresAt),
              nextRunAt: toRequiredDate(job.nextRunAt),
              lastError: job.lastError,
              executionLog: job.executionLog,
              createdAt: toRequiredDate(job.createdAt),
              updatedAt: toRequiredDate(job.updatedAt),
            },
          });

          return {
            job: this.mapJobRowToRecord(upserted),
            deduplicated: false,
          };
        });
      } catch (err) {
        throw redactDatabaseError(err);
      }
    };

    const next = this.enqueueMutex.then(run, run);
    this.enqueueMutex = next.catch(() => undefined);
    return next;
  }

  /**
   * Atomically recovers stale PROCESSING leases and claims the next eligible QUEUED job.
   */
  async claimNextJobAtomic(
    workerId: string,
    leaseDurationMs = 60_000,
    nowIso?: string
  ): Promise<JobQueueItemRecord | null> {
    const run = async (): Promise<JobQueueItemRecord | null> => {
      try {
        const now = nowIso ? new Date(nowIso) : new Date();
        return await this.prisma.$transaction(async (tx) => {
          // 1. Recover expired PROCESSING jobs
          const expiredProcessing = await tx.jobQueueItem.findMany({
            where: {
              status: 'PROCESSING',
              leaseExpiresAt: { lt: now },
            },
          });

          for (const stale of expiredProcessing) {
            const logMsg = `[${now.toISOString()}] Lease expired on worker ${stale.leaseOwner ?? 'unknown'}`;
            if (stale.attempts >= stale.maxAttempts) {
              await tx.jobQueueItem.update({
                where: { id: stale.id },
                data: {
                  status: 'DEAD_LETTER',
                  leaseOwner: null,
                  leaseExpiresAt: null,
                  lastError: 'Lease expired and max attempts reached',
                  executionLog: [...stale.executionLog, `${logMsg} -> DEAD_LETTER`],
                  updatedAt: now,
                },
              });
            } else {
              await tx.jobQueueItem.update({
                where: { id: stale.id },
                data: {
                  status: 'QUEUED',
                  leaseOwner: null,
                  leaseExpiresAt: null,
                  nextRunAt: now,
                  executionLog: [...stale.executionLog, `${logMsg} -> Recovered to QUEUED`],
                  updatedAt: now,
                },
              });
            }
          }

          // 2. Find highest-priority eligible QUEUED job
          const candidates = await tx.jobQueueItem.findMany({
            where: {
              status: 'QUEUED',
              nextRunAt: { lte: now },
            },
            orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
            take: 1,
          });

          const target = candidates[0];
          if (!target) {
            return null;
          }

          const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);
          const nextAttempts = target.attempts + 1;
          const claimed = await tx.jobQueueItem.update({
            where: { id: target.id },
            data: {
              status: 'PROCESSING',
              attempts: nextAttempts,
              leaseOwner: workerId,
              leaseExpiresAt,
              executionLog: [
                ...target.executionLog,
                `[${now.toISOString()}] Claimed by ${workerId} (attempt ${nextAttempts}/${target.maxAttempts})`,
              ],
              updatedAt: now,
            },
          });

          return this.mapJobRowToRecord(claimed);
        });
      } catch (err) {
        throw redactDatabaseError(err);
      }
    };

    const next = this.enqueueMutex.then(run, run);
    this.enqueueMutex = next.catch(() => undefined);
    return next;
  }

  /**
   * Atomically updates a job's completion or retry state in PostgreSQL.
   */
  async completeJobAtomic(
    jobId: string,
    outcome: {
      status: 'COMPLETED' | 'QUEUED' | 'FAILED' | 'DEAD_LETTER';
      lastError?: string | null;
      logLine?: string;
      nextRunAt?: string;
    }
  ): Promise<JobQueueItemRecord | null> {
    try {
      const now = new Date();
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.jobQueueItem.findUnique({ where: { id: jobId } });
        if (!existing) return null;

        let finalStatus = outcome.status;
        if (
          (finalStatus === 'FAILED' || finalStatus === 'QUEUED') &&
          existing.attempts >= existing.maxAttempts
        ) {
          finalStatus = 'DEAD_LETTER';
        }

        const updated = await tx.jobQueueItem.update({
          where: { id: jobId },
          data: {
            status: finalStatus,
            leaseOwner: null,
            leaseExpiresAt: null,
            lastError: outcome.lastError !== undefined ? outcome.lastError : existing.lastError,
            nextRunAt: outcome.nextRunAt ? new Date(outcome.nextRunAt) : existing.nextRunAt,
            executionLog: outcome.logLine
              ? [...existing.executionLog, outcome.logLine]
              : existing.executionLog,
            updatedAt: now,
          },
        });
        return this.mapJobRowToRecord(updated);
      });
    } catch (err) {
      throw redactDatabaseError(err);
    }
  }

  private mapJobRowToRecord(row: {
    id: string;
    idempotencyKey: string;
    jobType: string;
    targetDomain: string;
    sourceId: string | null;
    url: string | null;
    priority: number;
    status: string;
    attempts: number;
    maxAttempts: number;
    leaseOwner: string | null;
    leaseExpiresAt: Date | null;
    nextRunAt: Date;
    lastError: string | null;
    executionLog: string[];
    createdAt: Date;
    updatedAt: Date;
  }): JobQueueItemRecord {
    return {
      id: row.id,
      idempotencyKey: row.idempotencyKey,
      jobType: row.jobType as JobQueueItemRecord['jobType'],
      targetDomain: row.targetDomain,
      sourceId: row.sourceId,
      url: row.url,
      priority: row.priority,
      status: row.status as JobQueueItemRecord['status'],
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      leaseOwner: row.leaseOwner,
      leaseExpiresAt: toIso(row.leaseExpiresAt),
      nextRunAt: toRequiredIso(row.nextRunAt),
      lastError: row.lastError,
      executionLog: row.executionLog ?? [],
      createdAt: toRequiredIso(row.createdAt),
      updatedAt: toRequiredIso(row.updatedAt),
    };
  }

  /**
   * Loads the entire relational state from PostgreSQL and maps it to DatabaseSchema.
   */
  async loadDatabase(): Promise<DatabaseSchema> {
    try {
      const [
        users,
        profiles,
        qualifications,
        institutions,
        departments,
        programs,
        admissionRequirements,
        scholarships,
        fundingPackages,
        programScholarships,
        evidenceClaims,
        claimVersions,
        eligibilityResults,
        sources,
        fetchAttempts,
        snapshots,
        jobQueue,
        researchRuns,
        changeEvents,
        savedOpportunities,
        tasks,
        checklistItems,
        notifications,
        emailDeliveries,
        auditLogs,
        systemHealthRow,
      ] = await Promise.all([
        this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } }),
        this.prisma.userProfile.findMany(),
        this.prisma.userQualification.findMany({ orderBy: { createdAt: 'asc' } }),
        this.prisma.institution.findMany({ orderBy: { id: 'asc' } }),
        this.prisma.department.findMany({ orderBy: { id: 'asc' } }),
        this.prisma.program.findMany({ orderBy: { id: 'asc' } }),
        this.prisma.admissionRequirement.findMany(),
        this.prisma.scholarship.findMany({ orderBy: { id: 'asc' } }),
        this.prisma.fundingPackage.findMany(),
        this.prisma.programScholarship.findMany(),
        this.prisma.evidenceClaim.findMany({ orderBy: { id: 'asc' } }),
        this.prisma.claimVersion.findMany({ orderBy: { observedAt: 'asc' } }),
        this.prisma.eligibilityResult.findMany(),
        this.prisma.sourceRegistry.findMany({ orderBy: { id: 'asc' } }),
        this.prisma.fetchAttempt.findMany({ orderBy: { attemptedAt: 'asc' } }),
        this.prisma.sourceSnapshot.findMany({ orderBy: { retrievedAt: 'asc' } }),
        this.prisma.jobQueueItem.findMany({ orderBy: { createdAt: 'asc' } }),
        this.prisma.researchRun.findMany({ orderBy: { startedAt: 'desc' } }),
        this.prisma.changeEvent.findMany({ orderBy: { detectedAt: 'desc' } }),
        this.prisma.savedOpportunity.findMany({ orderBy: { savedAt: 'desc' } }),
        this.prisma.applicationTask.findMany({ orderBy: { createdAt: 'asc' } }),
        this.prisma.documentChecklistItem.findMany(),
        this.prisma.notification.findMany({ orderBy: { createdAt: 'desc' } }),
        this.prisma.emailDelivery.findMany({ orderBy: { createdAt: 'desc' } }),
        this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' } }),
        this.prisma.systemHealth.findUnique({ where: { id: 'singleton' } }),
      ]);

      const reqByProgramId = new Map<string, typeof admissionRequirements[number]>();
      for (const req of admissionRequirements) {
        reqByProgramId.set(req.programId, req);
      }

      const pkgByScholarshipId = new Map<string, typeof fundingPackages[number]>();
      for (const pkg of fundingPackages) {
        pkgByScholarshipId.set(pkg.scholarshipId, pkg);
      }

      const scholarshipIdsByProgramId = new Map<string, string[]>();
      for (const ps of programScholarships) {
        const list = scholarshipIdsByProgramId.get(ps.programId) ?? [];
        list.push(ps.scholarshipId);
        scholarshipIdsByProgramId.set(ps.programId, list);
      }

      const versionsByClaimId = new Map<string, ClaimVersionRecord[]>();
      for (const v of claimVersions) {
        const list = versionsByClaimId.get(v.claimId) ?? [];
        list.push({
          id: v.id,
          claimId: v.claimId,
          normalizedValue: v.normalizedValue,
          supportingExcerpt: v.supportingExcerpt,
          sourceUrl: v.sourceUrl,
          verificationStatus: v.verificationStatus as VerificationStatus,
          observedAt: toRequiredIso(v.observedAt),
        });
        versionsByClaimId.set(v.claimId, list);
      }

      const claimIdsByProgramId = new Map<string, string[]>();
      const claimIdsByScholarshipId = new Map<string, string[]>();
      for (const c of evidenceClaims) {
        if (c.programId) {
          const list = claimIdsByProgramId.get(c.programId) ?? [];
          list.push(c.id);
          claimIdsByProgramId.set(c.programId, list);
        }
        if (c.scholarshipId) {
          const list = claimIdsByScholarshipId.get(c.scholarshipId) ?? [];
          list.push(c.id);
          claimIdsByScholarshipId.set(c.scholarshipId, list);
        }
      }

      const mappedUsers: UserRecord[] = users.map((u) => ({
        id: u.id,
        email: u.email,
        passwordHash: u.passwordHash,
        fullName: u.fullName,
        role: (u.role === 'admin' ? 'admin' : 'student') as 'student' | 'admin',
        onboardingCompleted: u.onboardingCompleted,
        createdAt: toRequiredIso(u.createdAt),
        updatedAt: toRequiredIso(u.updatedAt),
      }));

      const mappedProfiles: UserProfileRecord[] = profiles.map((p) => ({
        id: p.id,
        userId: p.userId,
        citizenship: p.citizenship,
        residencyCountry: p.residencyCountry,
        ageYears: p.ageYears,
        hecEquivalenceConfirmed: p.hecEquivalenceConfirmed,
        currentDegree: p.currentDegree,
        currentUniversity: p.currentUniversity,
        gpaValue: p.gpaValue,
        gradingScale: (p.gradingScale as GradingScale | null) ?? null,
        gradingClassification: p.gradingClassification,
        graduationDate: p.graduationDate,
        completedPrerequisites: p.completedPrerequisites ?? [],
        englishTestType: (p.englishTestType as UserProfileRecord['englishTestType']) ?? null,
        englishTestScore: p.englishTestScore,
        greVerbal: p.greVerbal,
        greQuant: p.greQuant,
        greWriting: p.greWriting,
        researchMonths: p.researchMonths,
        publicationsCount: p.publicationsCount,
        workExperienceMonths: p.workExperienceMonths,
        technicalSkills: p.technicalSkills ?? [],
        applicationBudgetUsd: p.applicationBudgetUsd,
        targetDegrees: p.targetDegrees ?? [],
        targetFields: p.targetFields ?? [],
        fundingPreferenceMode: (p.fundingPreferenceMode as FundingPreferenceMode | null) ?? undefined,
        preferredCountries: p.preferredCountries ?? [],
        preferredUniversities: p.preferredUniversities ?? [],
        requireFullFunding: p.requireFullFunding,
        minAnnualLivingSupportUsd: p.minAnnualLivingSupportUsd,
        preferredIntakes: p.preferredIntakes ?? [],
        applicationCycles: p.applicationCycles ?? [],
        emailNotificationsEnabled: p.emailNotificationsEnabled,
        inAppNotificationsEnabled: p.inAppNotificationsEnabled,
        reminderDaysBeforeDeadline: p.reminderDaysBeforeDeadline ?? [30, 14, 7, 1],
        updatedAt: toRequiredIso(p.updatedAt),
      }));

      const mappedQualifications: UserQualificationRecord[] = qualifications.map((q) => ({
        id: q.id,
        userId: q.userId,
        title: q.title,
        institution: q.institution,
        category: q.category as UserQualificationRecord['category'],
        details: q.details,
        completedDate: q.completedDate,
        createdAt: toRequiredIso(q.createdAt),
      }));

      const mappedInstitutions: InstitutionRecord[] = institutions.map((i) => ({
        id: i.id,
        name: i.name,
        country: i.country,
        city: i.city,
        campus: i.campus,
        officialDomain: i.officialDomain,
        officialWebsiteUrl: i.officialWebsiteUrl,
        authorityTier: i.authorityTier as InstitutionRecord['authorityTier'],
        lastVerifiedAt: toIso(i.lastVerifiedAt),
        createdAt: toRequiredIso(i.createdAt),
        updatedAt: toRequiredIso(i.updatedAt),
      }));

      const mappedDepartments: DepartmentRecord[] = departments.map((d) => ({
        id: d.id,
        institutionId: d.institutionId,
        name: d.name,
        researchAreas: d.researchAreas ?? [],
        websiteUrl: d.websiteUrl,
      }));

      const mappedPrograms: ProgramRecord[] = programs.map((prog) => {
        const req = reqByProgramId.get(prog.id);
        const mappedReq: AdmissionRequirementRecord = req
          ? {
              id: req.id,
              programId: prog.id,
              minGpa: req.minGpa,
              gradingScale: (req.gradingScale as GradingScale | null) ?? null,
              minGradingClassification: req.minGradingClassification,
              acceptedBackgrounds: req.acceptedBackgrounds ?? [],
              prerequisiteCourses: req.prerequisiteCourses ?? [],
              ieltsMinScore: req.ieltsMinScore,
              toeflMinScore: req.toeflMinScore,
              greRequirement: (req.greRequirement as AdmissionRequirementRecord['greRequirement']) ?? 'UNKNOWN',
              citizenshipRule: req.citizenshipRule,
              excludedCitizenships: req.excludedCitizenships ?? [],
              maxAgeLimit: req.maxAgeLimit,
              residencyRule: req.residencyRule,
              workExperienceReq: req.workExperienceReq,
              feeWaiverAvailable: req.feeWaiverAvailable,
              researchExpRequired: req.researchExpRequired,
              requiredDocuments: req.requiredDocuments ?? [],
              verificationStatus: req.verificationStatus as VerificationStatus,
              supportingClaimIds:
                req.supportingClaimIds && req.supportingClaimIds.length > 0
                  ? req.supportingClaimIds
                  : claimIdsByProgramId.get(prog.id) ?? [],
            }
          : {
              id: `req-${prog.id}`,
              programId: prog.id,
              minGpa: null,
              gradingScale: null,
              minGradingClassification: null,
              acceptedBackgrounds: [],
              prerequisiteCourses: [],
              ieltsMinScore: null,
              toeflMinScore: null,
              greRequirement: 'UNKNOWN',
              citizenshipRule: null,
              excludedCitizenships: [],
              researchExpRequired: false,
              requiredDocuments: [],
              verificationStatus: prog.verificationStatus as VerificationStatus,
              supportingClaimIds: claimIdsByProgramId.get(prog.id) ?? [],
            };

        const joinedScholarships = scholarshipIdsByProgramId.get(prog.id) ?? [];
        const finalScholarshipIds =
          prog.scholarshipIds && prog.scholarshipIds.length > 0
            ? prog.scholarshipIds
            : joinedScholarships;
        const finalClaimIds =
          prog.claimIds && prog.claimIds.length > 0
            ? prog.claimIds
            : claimIdsByProgramId.get(prog.id) ?? [];

        return {
          id: prog.id,
          institutionId: prog.institutionId,
          departmentId: prog.departmentId,
          title: prog.title,
          degreeLevel: prog.degreeLevel,
          discipline: prog.discipline,
          broadField: (prog.broadField as BroadFieldCategory | null) ?? undefined,
          specializations: prog.specializations ?? [],
          opportunityType: (prog.opportunityType as OpportunityType | null) ?? undefined,
          globalRegion: (prog.globalRegion as GlobalRegion | null) ?? undefined,
          durationMonths: prog.durationMonths,
          intakeTerm: prog.intakeTerm,
          applicationCycle: prog.applicationCycle,
          officialProgramUrl: prog.officialProgramUrl,
          officialApplicationUrl: prog.officialApplicationUrl,
          contactEmail: prog.contactEmail,
          applicationStages: prog.applicationStages ?? [],
          applicationFeeAmount: prog.applicationFeeAmount,
          applicationFeeCurrency: prog.applicationFeeCurrency,
          supervisorContactReq:
            (prog.supervisorContactReq as ProgramRecord['supervisorContactReq']) ?? 'UNKNOWN',
          deadlineDate: toIso(prog.deadlineDate),
          deadlineTimezone: prog.deadlineTimezone,
          openingDate: toIso(prog.openingDate),
          isActive: prog.isActive,
          isExpired: prog.isExpired,
          verificationStatus: prog.verificationStatus as VerificationStatus,
          fundingClassification: prog.fundingClassification as FundingClassification,
          scholarshipIds: finalScholarshipIds,
          requirement: mappedReq,
          claimIds: finalClaimIds,
          lastCheckedAt: toIso(prog.lastCheckedAt),
          createdAt: toRequiredIso(prog.createdAt),
          updatedAt: toRequiredIso(prog.updatedAt),
        };
      });

      const mappedScholarships: ScholarshipRecord[] = scholarships.map((sch) => {
        const pkg = pkgByScholarshipId.get(sch.id);
        const mappedPkg: FundingPackageRecord = pkg
          ? {
              id: pkg.id,
              scholarshipId: sch.id,
              tuitionCoveragePercent: pkg.tuitionCoveragePercent,
              mandatoryFeesCovered: pkg.mandatoryFeesCovered,
              stipendAmountAnnual: pkg.stipendAmountAnnual,
              stipendCurrency: pkg.stipendCurrency,
              stipendAmountUsdApprox: pkg.stipendAmountUsdApprox,
              stipendFrequency:
                (pkg.stipendFrequency as FundingPackageRecord['stipendFrequency']) ?? 'UNKNOWN',
              durationMonths: pkg.durationMonths,
              accommodationCovered: pkg.accommodationCovered,
              healthInsuranceCovered: pkg.healthInsuranceCovered,
              travelAllowanceCovered: pkg.travelAllowanceCovered,
              relocationSupportCovered: pkg.relocationSupportCovered,
              renewalConditions: pkg.renewalConditions,
              awardBasis: (pkg.awardBasis as FundingPackageRecord['awardBasis']) ?? 'COMPETITIVE',
              livingCostBenchmarkAnnual: pkg.livingCostBenchmarkAnnual,
              livingCostBenchmarkCurr: pkg.livingCostBenchmarkCurr,
              livingCostBenchmarkSource: pkg.livingCostBenchmarkSource,
              livingCostBenchmarkDate: pkg.livingCostBenchmarkDate,
              livingCostSurplusOrDeficit: pkg.livingCostSurplusOrDeficit,
              livingCostAdequacyStatus:
                (pkg.livingCostAdequacyStatus as FundingPackageRecord['livingCostAdequacyStatus']) ??
                'UNCERTAIN',
              classification: pkg.classification as FundingClassification,
              classificationExplanation: pkg.classificationExplanation,
              updatedAt: toRequiredIso(pkg.updatedAt),
            }
          : {
              id: `pkg-${sch.id}`,
              scholarshipId: sch.id,
              tuitionCoveragePercent: null,
              mandatoryFeesCovered: null,
              stipendAmountAnnual: null,
              stipendCurrency: null,
              stipendAmountUsdApprox: null,
              stipendFrequency: 'UNKNOWN',
              durationMonths: null,
              accommodationCovered: null,
              healthInsuranceCovered: null,
              travelAllowanceCovered: null,
              relocationSupportCovered: null,
              renewalConditions: null,
              awardBasis: 'COMPETITIVE',
              livingCostBenchmarkAnnual: null,
              livingCostBenchmarkCurr: null,
              livingCostBenchmarkSource: null,
              livingCostBenchmarkDate: null,
              livingCostSurplusOrDeficit: null,
              livingCostAdequacyStatus: 'UNCERTAIN',
              classification: sch.fundingClassification as FundingClassification,
              classificationExplanation: 'Loaded from scholarship classification',
              updatedAt: toRequiredIso(sch.updatedAt),
            };

        const finalClaimIds =
          sch.claimIds && sch.claimIds.length > 0
            ? sch.claimIds
            : claimIdsByScholarshipId.get(sch.id) ?? [];

        return {
          id: sch.id,
          name: sch.name,
          awardingOrganization: sch.awardingOrganization,
          authorityType: sch.authorityType as ScholarshipRecord['authorityType'],
          opportunityType: (sch.opportunityType as OpportunityType | null) ?? undefined,
          country: sch.country,
          officialUrl: sch.officialUrl,
          eligibleDegrees: sch.eligibleDegrees ?? [],
          eligibleCountries: sch.eligibleCountries ?? [],
          excludedCitizenships: sch.excludedCitizenships ?? [],
          eligibleFields: sch.eligibleFields ?? [],
          deadlineDate: toIso(sch.deadlineDate),
          deadlineTimezone: sch.deadlineTimezone,
          applicationCycle: sch.applicationCycle,
          separateApplicationReq: sch.separateApplicationReq,
          nominationProcessNote: sch.nominationProcessNote,
          fundingClassification: sch.fundingClassification as FundingClassification,
          verificationStatus: sch.verificationStatus as VerificationStatus,
          lastCheckedAt: toIso(sch.lastCheckedAt),
          fundingPackage: mappedPkg,
          claimIds: finalClaimIds,
          createdAt: toRequiredIso(sch.createdAt),
          updatedAt: toRequiredIso(sch.updatedAt),
        };
      });

      const mappedClaims: EvidenceClaimRecord[] = evidenceClaims.map((c) => ({
        id: c.id,
        programId: c.programId,
        scholarshipId: c.scholarshipId,
        claimType: c.claimType as ClaimType,
        fieldName: c.fieldName,
        normalizedValue: c.normalizedValue,
        supportingExcerpt: c.supportingExcerpt,
        excerptHash: c.excerptHash,
        sourceUrl: c.sourceUrl,
        sourceDomain: c.sourceDomain,
        sourceOrganization: c.sourceOrganization,
        pageSection: c.pageSection,
        retrievedAt: toRequiredIso(c.retrievedAt),
        extractedAt: toRequiredIso(c.extractedAt),
        lastContentChangeAt: toIso(c.lastContentChangeAt),
        verificationMethod: c.verificationMethod as EvidenceClaimRecord['verificationMethod'],
        verificationStatus: c.verificationStatus as VerificationStatus,
        evidenceQualityScore: c.evidenceQualityScore,
        applicationCycle: c.applicationCycle,
        freshnessPolicy: c.freshnessPolicy as EvidenceClaimRecord['freshnessPolicy'],
        conflictingClaimIds: c.conflictingClaimIds ?? [],
        versions: versionsByClaimId.get(c.id) ?? [],
      }));

      const mappedEligibilityResults: EligibilityResultRecord[] = eligibilityResults.map((er) => {
        let decisions: RuleDecisionItem[] = [];
        let rankingFactors: RankingFactorBreakdown = {
          fundingCompletenessScore: 0,
          eligibilityScore: 0,
          academicRelevanceScore: 0,
          citizenshipScore: 0,
          countryPreferenceScore: 0,
          deadlineProximityScore: 0,
          sourceAuthorityScore: 0,
          evidenceQualityScore: 0,
          effortScore: 0,
          totalScore: er.overallRankScore,
          reasons: [],
        };
        try {
          decisions = JSON.parse(er.decisionsJson) as RuleDecisionItem[];
        } catch {
          decisions = [];
        }
        try {
          rankingFactors = JSON.parse(er.rankingFactorsJson) as RankingFactorBreakdown;
        } catch {
          // keep fallback
        }
        return {
          id: er.id,
          userId: er.userId,
          programId: er.programId,
          admissionStatus: er.admissionStatus as EligibilityStatus,
          scholarshipStatus: er.scholarshipStatus as EligibilityStatus,
          fundingCompletenessStatus: er.fundingCompletenessStatus as EligibilityStatus,
          pakistaniEligibilityStatus:
            (er.pakistaniEligibilityStatus as PakistaniEligibilityStatus | null) ?? undefined,
          overallRankScore: er.overallRankScore,
          decisions,
          rankingFactors,
          evaluatedAt: toRequiredIso(er.evaluatedAt),
        };
      });

      const mappedSources: SourceRegistryRecord[] = sources.map((s) => ({
        id: s.id,
        name: s.name,
        domain: s.domain,
        seedUrl: s.seedUrl,
        category: s.category as SourceRegistryRecord['category'],
        country: s.country,
        authorityLevel: s.authorityLevel as SourceRegistryRecord['authorityLevel'],
        refreshPolicy: s.refreshPolicy as SourceRegistryRecord['refreshPolicy'],
        priority: (s.priority as SourceRegistryRecord['priority']) ?? 'NORMAL',
        rateLimitPerMinute: s.rateLimitPerMinute,
        maxConcurrency: s.maxConcurrency,
        enabled: s.enabled,
        robotsTxtAllowed: s.robotsTxtAllowed,
        lastFetchedAt: toIso(s.lastFetchedAt),
        lastHttpStatus: s.lastHttpStatus,
        lastResponseTimeMs: s.lastResponseTimeMs,
        consecutiveFailures: s.consecutiveFailures,
        isolatedUntil: toIso(s.isolatedUntil),
        createdAt: toRequiredIso(s.createdAt),
        updatedAt: toRequiredIso(s.updatedAt),
      }));

      const mappedFetchAttempts: FetchAttemptRecord[] = fetchAttempts.map((fa) => ({
        id: fa.id,
        sourceId: fa.sourceId,
        url: fa.url,
        normalizedUrl: fa.normalizedUrl,
        httpStatus: fa.httpStatus,
        responseTimeMs: fa.responseTimeMs,
        contentType: fa.contentType,
        bytesReceived: fa.bytesReceived,
        etag: fa.etag,
        lastModifiedHdr: fa.lastModifiedHdr,
        errorMessage: fa.errorMessage,
        attemptedAt: toRequiredIso(fa.attemptedAt),
      }));

      const mappedSnapshots: SourceSnapshotRecord[] = snapshots.map((sn) => ({
        id: sn.id,
        sourceId: sn.sourceId,
        normalizedUrl: sn.normalizedUrl,
        contentHash: sn.contentHash,
        title: sn.title,
        extractedTextSnippet: sn.extractedTextSnippet,
        discoveredChildLinks: sn.discoveredChildLinks ?? [],
        retrievedAt: toRequiredIso(sn.retrievedAt),
      }));

      const mappedJobs: JobQueueItemRecord[] = jobQueue.map((j) => this.mapJobRowToRecord(j));

      const mappedRuns: ResearchRunRecord[] = researchRuns.map((r) => ({
        id: r.id,
        triggerType: r.triggerType as ResearchRunRecord['triggerType'],
        status: r.status as ResearchRunRecord['status'],
        sourcesChecked: r.sourcesChecked,
        urlsDiscovered: r.urlsDiscovered,
        httpSuccessCount: r.httpSuccessCount,
        httpFailureCount: r.httpFailureCount,
        claimsExtracted: r.claimsExtracted,
        changesDetected: r.changesDetected,
        notificationsCreated: r.notificationsCreated,
        summaryLog: r.summaryLog ?? [],
        startedAt: toRequiredIso(r.startedAt),
        completedAt: toIso(r.completedAt),
      }));

      const mappedChanges: ChangeEventRecord[] = changeEvents.map((ce) => ({
        id: ce.id,
        entityType: ce.entityType as ChangeEventRecord['entityType'],
        entityId: ce.entityId,
        entityTitle: ce.entityTitle,
        fieldChanged: ce.fieldChanged,
        previousValue: ce.previousValue,
        newValue: ce.newValue ?? '',
        sourceUrl: ce.sourceUrl,
        isGenuineChange: ce.isGenuineChange,
        detectedAt: toRequiredIso(ce.detectedAt),
      }));

      const mappedSavedOpportunities: SavedOpportunityRecord[] = savedOpportunities.map((so) => ({
        id: so.id,
        userId: so.userId,
        programId: so.programId,
        applicationStatus: so.applicationStatus as ApplicationStatus,
        privateNotes: so.privateNotes,
        priorityLevel: so.priorityLevel as SavedOpportunityRecord['priorityLevel'],
        savedAt: toRequiredIso(so.savedAt),
        updatedAt: toRequiredIso(so.updatedAt),
      }));

      const mappedTasks: ApplicationTaskRecord[] = tasks.map((t) => ({
        id: t.id,
        userId: t.userId,
        programId: t.programId,
        title: t.title,
        category: t.category as ApplicationTaskRecord['category'],
        dueDate: toIso(t.dueDate),
        completed: t.completed,
        syncedFromEvidence: t.syncedFromEvidence,
        userNotes: t.userNotes,
        createdAt: toRequiredIso(t.createdAt),
        updatedAt: toRequiredIso(t.updatedAt),
      }));

      const mappedChecklistItems: DocumentChecklistItemRecord[] = checklistItems.map((ci) => ({
        id: ci.id,
        userId: ci.userId,
        programId: ci.programId,
        documentName: ci.documentName,
        status: ci.status as DocumentChecklistItemRecord['status'],
        sourceRequirement: ci.sourceRequirement,
        userNotes: ci.userNotes,
        updatedAt: toRequiredIso(ci.updatedAt),
      }));

      const mappedNotifications: NotificationRecord[] = notifications.map((n) => ({
        id: n.id,
        userId: n.userId,
        dedupeKey: n.dedupeKey,
        category: n.category as NotificationRecord['category'],
        title: n.title,
        message: n.message,
        sourceUrl: n.sourceUrl,
        isUncertainDate: n.isUncertainDate,
        read: n.read,
        createdAt: toRequiredIso(n.createdAt),
      }));

      const mappedEmails: EmailDeliveryRecord[] = emailDeliveries.map((ed) => ({
        id: ed.id,
        userId: ed.userId,
        notificationId: ed.notificationId,
        recipientEmail: ed.recipientEmail,
        subject: ed.subject,
        provider: ed.provider as 'RESEND',
        status: ed.status as EmailDeliveryRecord['status'],
        providerMsgId: ed.providerMsgId,
        errorMessage: ed.errorMessage,
        attempts: ed.attempts,
        createdAt: toRequiredIso(ed.createdAt),
      }));

      const mappedAuditLogs: AuditLogRecord[] = auditLogs.map((al) => ({
        id: al.id,
        userId: al.userId,
        action: al.action,
        targetType: al.targetType,
        targetId: al.targetId,
        details: al.details,
        createdAt: toRequiredIso(al.createdAt),
      }));

      const mappedHealth: SystemHealthRecord = systemHealthRow
        ? {
            automationState: systemHealthRow.automationState as AutomationState,
            stateReason: systemHealthRow.stateReason,
            cronSchedule: systemHealthRow.cronSchedule,
            lastScheduledRunAt: toIso(systemHealthRow.lastScheduledRunAt),
            lastSuccessfulRunAt: toIso(systemHealthRow.lastSuccessfulRunAt),
            missedRunsCount: systemHealthRow.missedRunsCount,
            totalRequestsMade: systemHealthRow.totalRequestsMade,
            totalBytesFetched: Number(systemHealthRow.totalBytesFetched),
            searchProviderEnabled: systemHealthRow.searchProviderEnabled,
            aiProviderEnabled: systemHealthRow.aiProviderEnabled,
            emailProviderEnabled: systemHealthRow.emailProviderEnabled,
            updatedAt: toRequiredIso(systemHealthRow.updatedAt),
          }
        : {
            automationState: 'Active',
            stateReason: 'PostgreSQL storage initialized.',
            cronSchedule: '0 2 * * *',
            lastScheduledRunAt: null,
            lastSuccessfulRunAt: null,
            missedRunsCount: 0,
            totalRequestsMade: 0,
            totalBytesFetched: 0,
            searchProviderEnabled: Boolean(process.env.SERPER_API_KEY || process.env.TAVILY_API_KEY),
            aiProviderEnabled: Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY),
            emailProviderEnabled: Boolean(process.env.RESEND_API_KEY),
            updatedAt: new Date().toISOString(),
          };

      return {
        users: mappedUsers,
        profiles: mappedProfiles,
        qualifications: mappedQualifications,
        institutions: mappedInstitutions,
        departments: mappedDepartments,
        programs: mappedPrograms,
        scholarships: mappedScholarships,
        claims: mappedClaims,
        eligibilityResults: mappedEligibilityResults,
        sources: mappedSources,
        fetchAttempts: mappedFetchAttempts,
        snapshots: mappedSnapshots,
        jobQueue: mappedJobs,
        researchRuns: mappedRuns,
        changeEvents: mappedChanges,
        savedOpportunities: mappedSavedOpportunities,
        tasks: mappedTasks,
        checklistItems: mappedChecklistItems,
        notifications: mappedNotifications,
        emailDeliveries: mappedEmails,
        auditLogs: mappedAuditLogs,
        systemHealth: mappedHealth,
      };
    } catch (err) {
      throw redactDatabaseError(err);
    }
  }

  /**
   * Atomically persists the complete DatabaseSchema into PostgreSQL inside a single interactive transaction.
   */
  async saveDatabase(db: DatabaseSchema): Promise<void> {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          await this.syncDatabaseInTransaction(tx, db);
        },
        { timeout: 60_000, maxWait: 15_000 }
      );
    } catch (err) {
      throw redactDatabaseError(err);
    }
  }

  public async syncDatabaseInTransaction(
    tx: Prisma.TransactionClient,
    db: DatabaseSchema
  ): Promise<void> {
    const userIds = new Set(db.users.map((u) => u.id));
    const institutionIds = new Set(db.institutions.map((i) => i.id));
    const departmentIds = new Set(db.departments.map((d) => d.id));
    const programIds = new Set(db.programs.map((p) => p.id));
    const scholarshipIds = new Set(db.scholarships.map((s) => s.id));
    const sourceIds = new Set(db.sources.map((s) => s.id));
    const claimIds = new Set(db.claims.map((c) => c.id));

    // 1. Delete removed top-level and dependent rows without using broad NOT IN queries
    const deleteRemovedByIds = async (
      existingRows: { id: string }[],
      keepIds: Set<string>,
      deleteByIds: (ids: string[]) => Promise<unknown>
    ) => {
      const toDelete = existingRows.map((r) => r.id).filter((id) => !keepIds.has(id));
      if (toDelete.length > 0) {
        await deleteByIds(toDelete);
      }
    };

    await deleteRemovedByIds(
      await tx.emailDelivery.findMany({ select: { id: true } }),
      new Set(db.emailDeliveries.map((e) => e.id)),
      (ids) => tx.emailDelivery.deleteMany({ where: { id: { in: ids } } })
    );
    await deleteRemovedByIds(
      await tx.notification.findMany({ select: { id: true } }),
      new Set(db.notifications.map((n) => n.id)),
      (ids) => tx.notification.deleteMany({ where: { id: { in: ids } } })
    );
    await deleteRemovedByIds(
      await tx.documentChecklistItem.findMany({ select: { id: true } }),
      new Set(db.checklistItems.map((c) => c.id)),
      (ids) => tx.documentChecklistItem.deleteMany({ where: { id: { in: ids } } })
    );
    await deleteRemovedByIds(
      await tx.applicationTask.findMany({ select: { id: true } }),
      new Set(db.tasks.map((t) => t.id)),
      (ids) => tx.applicationTask.deleteMany({ where: { id: { in: ids } } })
    );
    await deleteRemovedByIds(
      await tx.savedOpportunity.findMany({ select: { id: true } }),
      new Set(db.savedOpportunities.map((s) => s.id)),
      (ids) => tx.savedOpportunity.deleteMany({ where: { id: { in: ids } } })
    );
    await deleteRemovedByIds(
      await tx.eligibilityResult.findMany({ select: { id: true } }),
      new Set(db.eligibilityResults.map((er) => er.id)),
      (ids) => tx.eligibilityResult.deleteMany({ where: { id: { in: ids } } })
    );
    await deleteRemovedByIds(
      await tx.userQualification.findMany({ select: { id: true } }),
      new Set(db.qualifications.map((q) => q.id)),
      (ids) => tx.userQualification.deleteMany({ where: { id: { in: ids } } })
    );
    await deleteRemovedByIds(
      await tx.userProfile.findMany({ select: { id: true } }),
      new Set(db.profiles.map((p) => p.id)),
      (ids) => tx.userProfile.deleteMany({ where: { id: { in: ids } } })
    );
    await deleteRemovedByIds(
      await tx.auditLog.findMany({ select: { id: true } }),
      new Set(db.auditLogs.map((a) => a.id)),
      (ids) => tx.auditLog.deleteMany({ where: { id: { in: ids } } })
    );
    await deleteRemovedByIds(
      await tx.user.findMany({ select: { id: true } }),
      userIds,
      (ids) => tx.user.deleteMany({ where: { id: { in: ids } } })
    );

    const keepVersionIds = new Set(
      db.claims.flatMap((c) => (c.versions ?? []).map((v) => v.id))
    );
    await deleteRemovedByIds(
      await tx.claimVersion.findMany({ select: { id: true } }),
      keepVersionIds,
      (ids) => tx.claimVersion.deleteMany({ where: { id: { in: ids } } })
    );
    await deleteRemovedByIds(
      await tx.evidenceClaim.findMany({ select: { id: true } }),
      claimIds,
      (ids) => tx.evidenceClaim.deleteMany({ where: { id: { in: ids } } })
    );

    const existingLinks = await tx.programScholarship.findMany({
      select: { programId: true, scholarshipId: true },
    });
    const desiredLinks = new Set(
      db.programs.flatMap((p) =>
        (p.scholarshipIds ?? []).map((schId) => `${p.id}::${schId}`)
      )
    );
    for (const link of existingLinks) {
      if (!desiredLinks.has(`${link.programId}::${link.scholarshipId}`)) {
        await tx.programScholarship.delete({
          where: {
            programId_scholarshipId: {
              programId: link.programId,
              scholarshipId: link.scholarshipId,
            },
          },
        });
      }
    }

    await deleteRemovedByIds(
      await tx.admissionRequirement.findMany({ select: { id: true } }),
      new Set(db.programs.map((p) => p.requirement?.id).filter((id): id is string => Boolean(id))),
      (ids) => tx.admissionRequirement.deleteMany({ where: { id: { in: ids } } })
    );
    await deleteRemovedByIds(
      await tx.fundingPackage.findMany({ select: { id: true } }),
      new Set(db.scholarships.map((s) => s.fundingPackage?.id).filter((id): id is string => Boolean(id))),
      (ids) => tx.fundingPackage.deleteMany({ where: { id: { in: ids } } })
    );
    await deleteRemovedByIds(
      await tx.program.findMany({ select: { id: true } }),
      programIds,
      (ids) => tx.program.deleteMany({ where: { id: { in: ids } } })
    );
    await deleteRemovedByIds(
      await tx.scholarship.findMany({ select: { id: true } }),
      scholarshipIds,
      (ids) => tx.scholarship.deleteMany({ where: { id: { in: ids } } })
    );
    await deleteRemovedByIds(
      await tx.department.findMany({ select: { id: true } }),
      departmentIds,
      (ids) => tx.department.deleteMany({ where: { id: { in: ids } } })
    );
    await deleteRemovedByIds(
      await tx.institution.findMany({ select: { id: true } }),
      institutionIds,
      (ids) => tx.institution.deleteMany({ where: { id: { in: ids } } })
    );

    await deleteRemovedByIds(
      await tx.fetchAttempt.findMany({ select: { id: true } }),
      new Set(db.fetchAttempts.map((f) => f.id)),
      (ids) => tx.fetchAttempt.deleteMany({ where: { id: { in: ids } } })
    );
    await deleteRemovedByIds(
      await tx.sourceSnapshot.findMany({ select: { id: true } }),
      new Set(db.snapshots.map((s) => s.id)),
      (ids) => tx.sourceSnapshot.deleteMany({ where: { id: { in: ids } } })
    );
    await deleteRemovedByIds(
      await tx.jobQueueItem.findMany({ select: { id: true } }),
      new Set(db.jobQueue.map((j) => j.id)),
      (ids) => tx.jobQueueItem.deleteMany({ where: { id: { in: ids } } })
    );
    await deleteRemovedByIds(
      await tx.sourceRegistry.findMany({ select: { id: true } }),
      sourceIds,
      (ids) => tx.sourceRegistry.deleteMany({ where: { id: { in: ids } } })
    );
    await deleteRemovedByIds(
      await tx.researchRun.findMany({ select: { id: true } }),
      new Set(db.researchRuns.map((r) => r.id)),
      (ids) => tx.researchRun.deleteMany({ where: { id: { in: ids } } })
    );
    await deleteRemovedByIds(
      await tx.changeEvent.findMany({ select: { id: true } }),
      new Set(db.changeEvents.map((c) => c.id)),
      (ids) => tx.changeEvent.deleteMany({ where: { id: { in: ids } } })
    );

    // 2. Upsert Users
    for (const u of db.users) {
      await tx.user.upsert({
        where: { id: u.id },
        update: {
          email: u.email,
          passwordHash: u.passwordHash,
          fullName: u.fullName,
          role: u.role,
          onboardingCompleted: u.onboardingCompleted,
          updatedAt: toRequiredDate(u.updatedAt),
        },
        create: {
          id: u.id,
          email: u.email,
          passwordHash: u.passwordHash,
          fullName: u.fullName,
          role: u.role,
          onboardingCompleted: u.onboardingCompleted,
          createdAt: toRequiredDate(u.createdAt),
          updatedAt: toRequiredDate(u.updatedAt),
        },
      });
    }

    // 3. Upsert Profiles & Qualifications
    for (const p of db.profiles) {
      if (!userIds.has(p.userId)) continue;
      await tx.userProfile.upsert({
        where: { userId: p.userId },
        update: {
          citizenship: p.citizenship,
          residencyCountry: p.residencyCountry,
          ageYears: p.ageYears ?? null,
          hecEquivalenceConfirmed: p.hecEquivalenceConfirmed ?? false,
          currentDegree: p.currentDegree,
          currentUniversity: p.currentUniversity,
          gpaValue: p.gpaValue,
          gradingScale: p.gradingScale,
          gradingClassification: p.gradingClassification,
          graduationDate: p.graduationDate,
          completedPrerequisites: p.completedPrerequisites ?? [],
          englishTestType: p.englishTestType,
          englishTestScore: p.englishTestScore,
          greVerbal: p.greVerbal,
          greQuant: p.greQuant,
          greWriting: p.greWriting,
          researchMonths: p.researchMonths,
          publicationsCount: p.publicationsCount,
          workExperienceMonths: p.workExperienceMonths,
          technicalSkills: p.technicalSkills ?? [],
          applicationBudgetUsd: p.applicationBudgetUsd,
          targetDegrees: p.targetDegrees ?? [],
          targetFields: p.targetFields ?? [],
          fundingPreferenceMode: p.fundingPreferenceMode ?? null,
          preferredCountries: p.preferredCountries ?? [],
          preferredUniversities: p.preferredUniversities ?? [],
          requireFullFunding: p.requireFullFunding,
          minAnnualLivingSupportUsd: p.minAnnualLivingSupportUsd,
          preferredIntakes: p.preferredIntakes ?? [],
          applicationCycles: p.applicationCycles ?? [],
          emailNotificationsEnabled: p.emailNotificationsEnabled,
          inAppNotificationsEnabled: p.inAppNotificationsEnabled,
          reminderDaysBeforeDeadline: p.reminderDaysBeforeDeadline ?? [30, 14, 7, 1],
          updatedAt: toRequiredDate(p.updatedAt),
        },
        create: {
          id: p.id,
          userId: p.userId,
          citizenship: p.citizenship,
          residencyCountry: p.residencyCountry,
          ageYears: p.ageYears ?? null,
          hecEquivalenceConfirmed: p.hecEquivalenceConfirmed ?? false,
          currentDegree: p.currentDegree,
          currentUniversity: p.currentUniversity,
          gpaValue: p.gpaValue,
          gradingScale: p.gradingScale,
          gradingClassification: p.gradingClassification,
          graduationDate: p.graduationDate,
          completedPrerequisites: p.completedPrerequisites ?? [],
          englishTestType: p.englishTestType,
          englishTestScore: p.englishTestScore,
          greVerbal: p.greVerbal,
          greQuant: p.greQuant,
          greWriting: p.greWriting,
          researchMonths: p.researchMonths,
          publicationsCount: p.publicationsCount,
          workExperienceMonths: p.workExperienceMonths,
          technicalSkills: p.technicalSkills ?? [],
          applicationBudgetUsd: p.applicationBudgetUsd,
          targetDegrees: p.targetDegrees ?? [],
          targetFields: p.targetFields ?? [],
          fundingPreferenceMode: p.fundingPreferenceMode ?? null,
          preferredCountries: p.preferredCountries ?? [],
          preferredUniversities: p.preferredUniversities ?? [],
          requireFullFunding: p.requireFullFunding,
          minAnnualLivingSupportUsd: p.minAnnualLivingSupportUsd,
          preferredIntakes: p.preferredIntakes ?? [],
          applicationCycles: p.applicationCycles ?? [],
          emailNotificationsEnabled: p.emailNotificationsEnabled,
          inAppNotificationsEnabled: p.inAppNotificationsEnabled,
          reminderDaysBeforeDeadline: p.reminderDaysBeforeDeadline ?? [30, 14, 7, 1],
          updatedAt: toRequiredDate(p.updatedAt),
        },
      });
    }

    for (const q of db.qualifications) {
      if (!userIds.has(q.userId)) continue;
      await tx.userQualification.upsert({
        where: { id: q.id },
        update: {
          userId: q.userId,
          title: q.title,
          institution: q.institution,
          category: q.category,
          details: q.details,
          completedDate: q.completedDate,
        },
        create: {
          id: q.id,
          userId: q.userId,
          title: q.title,
          institution: q.institution,
          category: q.category,
          details: q.details,
          completedDate: q.completedDate,
          createdAt: toRequiredDate(q.createdAt),
        },
      });
    }

    // 4. Upsert Institutions & Departments
    for (const inst of db.institutions) {
      await tx.institution.upsert({
        where: { id: inst.id },
        update: {
          name: inst.name,
          country: inst.country,
          city: inst.city,
          campus: inst.campus,
          officialDomain: inst.officialDomain,
          officialWebsiteUrl: inst.officialWebsiteUrl,
          authorityTier: inst.authorityTier,
          lastVerifiedAt: toDateOrNull(inst.lastVerifiedAt),
          updatedAt: toRequiredDate(inst.updatedAt),
        },
        create: {
          id: inst.id,
          name: inst.name,
          country: inst.country,
          city: inst.city,
          campus: inst.campus,
          officialDomain: inst.officialDomain,
          officialWebsiteUrl: inst.officialWebsiteUrl,
          authorityTier: inst.authorityTier,
          lastVerifiedAt: toDateOrNull(inst.lastVerifiedAt),
          createdAt: toRequiredDate(inst.createdAt),
          updatedAt: toRequiredDate(inst.updatedAt),
        },
      });
    }

    for (const dept of db.departments) {
      if (!institutionIds.has(dept.institutionId)) continue;
      await tx.department.upsert({
        where: { id: dept.id },
        update: {
          institutionId: dept.institutionId,
          name: dept.name,
          researchAreas: dept.researchAreas ?? [],
          websiteUrl: dept.websiteUrl,
        },
        create: {
          id: dept.id,
          institutionId: dept.institutionId,
          name: dept.name,
          researchAreas: dept.researchAreas ?? [],
          websiteUrl: dept.websiteUrl,
        },
      });
    }

    // 5. Upsert Scholarships & FundingPackages
    for (const sch of db.scholarships) {
      await tx.scholarship.upsert({
        where: { id: sch.id },
        update: {
          name: sch.name,
          awardingOrganization: sch.awardingOrganization,
          authorityType: sch.authorityType,
          opportunityType: sch.opportunityType ?? null,
          country: sch.country,
          officialUrl: sch.officialUrl,
          eligibleDegrees: sch.eligibleDegrees ?? [],
          eligibleCountries: sch.eligibleCountries ?? [],
          excludedCitizenships: sch.excludedCitizenships ?? [],
          eligibleFields: sch.eligibleFields ?? [],
          deadlineDate: toDateOrNull(sch.deadlineDate),
          deadlineTimezone: sch.deadlineTimezone,
          applicationCycle: sch.applicationCycle,
          separateApplicationReq: sch.separateApplicationReq,
          nominationProcessNote: sch.nominationProcessNote ?? null,
          fundingClassification: sch.fundingClassification,
          verificationStatus: sch.verificationStatus,
          claimIds: sch.claimIds ?? [],
          lastCheckedAt: toDateOrNull(sch.lastCheckedAt),
          updatedAt: toRequiredDate(sch.updatedAt),
        },
        create: {
          id: sch.id,
          name: sch.name,
          awardingOrganization: sch.awardingOrganization,
          authorityType: sch.authorityType,
          opportunityType: sch.opportunityType ?? null,
          country: sch.country,
          officialUrl: sch.officialUrl,
          eligibleDegrees: sch.eligibleDegrees ?? [],
          eligibleCountries: sch.eligibleCountries ?? [],
          excludedCitizenships: sch.excludedCitizenships ?? [],
          eligibleFields: sch.eligibleFields ?? [],
          deadlineDate: toDateOrNull(sch.deadlineDate),
          deadlineTimezone: sch.deadlineTimezone,
          applicationCycle: sch.applicationCycle,
          separateApplicationReq: sch.separateApplicationReq,
          nominationProcessNote: sch.nominationProcessNote ?? null,
          fundingClassification: sch.fundingClassification,
          verificationStatus: sch.verificationStatus,
          claimIds: sch.claimIds ?? [],
          lastCheckedAt: toDateOrNull(sch.lastCheckedAt),
          createdAt: toRequiredDate(sch.createdAt),
          updatedAt: toRequiredDate(sch.updatedAt),
        },
      });

      const pkg = sch.fundingPackage;
      if (pkg) {
        await tx.fundingPackage.upsert({
          where: { scholarshipId: sch.id },
          update: {
            tuitionCoveragePercent: pkg.tuitionCoveragePercent,
            mandatoryFeesCovered: pkg.mandatoryFeesCovered,
            stipendAmountAnnual: pkg.stipendAmountAnnual,
            stipendCurrency: pkg.stipendCurrency,
            stipendAmountUsdApprox: pkg.stipendAmountUsdApprox,
            stipendFrequency: pkg.stipendFrequency,
            durationMonths: pkg.durationMonths,
            accommodationCovered: pkg.accommodationCovered,
            healthInsuranceCovered: pkg.healthInsuranceCovered,
            travelAllowanceCovered: pkg.travelAllowanceCovered,
            relocationSupportCovered: pkg.relocationSupportCovered,
            renewalConditions: pkg.renewalConditions,
            awardBasis: pkg.awardBasis,
            livingCostBenchmarkAnnual: pkg.livingCostBenchmarkAnnual,
            livingCostBenchmarkCurr: pkg.livingCostBenchmarkCurr,
            livingCostBenchmarkSource: pkg.livingCostBenchmarkSource,
            livingCostBenchmarkDate: pkg.livingCostBenchmarkDate,
            livingCostSurplusOrDeficit: pkg.livingCostSurplusOrDeficit,
            livingCostAdequacyStatus: pkg.livingCostAdequacyStatus,
            classification: pkg.classification,
            classificationExplanation: pkg.classificationExplanation,
            updatedAt: toRequiredDate(pkg.updatedAt),
          },
          create: {
            id: pkg.id,
            scholarshipId: sch.id,
            tuitionCoveragePercent: pkg.tuitionCoveragePercent,
            mandatoryFeesCovered: pkg.mandatoryFeesCovered,
            stipendAmountAnnual: pkg.stipendAmountAnnual,
            stipendCurrency: pkg.stipendCurrency,
            stipendAmountUsdApprox: pkg.stipendAmountUsdApprox,
            stipendFrequency: pkg.stipendFrequency,
            durationMonths: pkg.durationMonths,
            accommodationCovered: pkg.accommodationCovered,
            healthInsuranceCovered: pkg.healthInsuranceCovered,
            travelAllowanceCovered: pkg.travelAllowanceCovered,
            relocationSupportCovered: pkg.relocationSupportCovered,
            renewalConditions: pkg.renewalConditions,
            awardBasis: pkg.awardBasis,
            livingCostBenchmarkAnnual: pkg.livingCostBenchmarkAnnual,
            livingCostBenchmarkCurr: pkg.livingCostBenchmarkCurr,
            livingCostBenchmarkSource: pkg.livingCostBenchmarkSource,
            livingCostBenchmarkDate: pkg.livingCostBenchmarkDate,
            livingCostSurplusOrDeficit: pkg.livingCostSurplusOrDeficit,
            livingCostAdequacyStatus: pkg.livingCostAdequacyStatus,
            classification: pkg.classification,
            classificationExplanation: pkg.classificationExplanation,
            updatedAt: toRequiredDate(pkg.updatedAt),
          },
        });
      }
    }

    // 6. Upsert Programs, AdmissionRequirements & ProgramScholarship links
    for (const prog of db.programs) {
      if (!institutionIds.has(prog.institutionId)) continue;
      const validDeptId =
        prog.departmentId && departmentIds.has(prog.departmentId) ? prog.departmentId : null;

      await tx.program.upsert({
        where: { id: prog.id },
        update: {
          institutionId: prog.institutionId,
          departmentId: validDeptId,
          title: prog.title,
          degreeLevel: prog.degreeLevel,
          discipline: prog.discipline,
          broadField: prog.broadField ?? null,
          specializations: prog.specializations ?? [],
          opportunityType: prog.opportunityType ?? null,
          globalRegion: prog.globalRegion ?? null,
          durationMonths: prog.durationMonths,
          intakeTerm: prog.intakeTerm,
          applicationCycle: prog.applicationCycle,
          officialProgramUrl: prog.officialProgramUrl,
          officialApplicationUrl: prog.officialApplicationUrl,
          contactEmail: prog.contactEmail,
          applicationStages: prog.applicationStages ?? [],
          applicationFeeAmount: prog.applicationFeeAmount,
          applicationFeeCurrency: prog.applicationFeeCurrency,
          supervisorContactReq: prog.supervisorContactReq,
          deadlineDate: toDateOrNull(prog.deadlineDate),
          deadlineTimezone: prog.deadlineTimezone,
          openingDate: toDateOrNull(prog.openingDate),
          isActive: prog.isActive,
          isExpired: prog.isExpired,
          verificationStatus: prog.verificationStatus,
          fundingClassification: prog.fundingClassification,
          scholarshipIds: prog.scholarshipIds ?? [],
          claimIds: prog.claimIds ?? [],
          lastCheckedAt: toDateOrNull(prog.lastCheckedAt),
          updatedAt: toRequiredDate(prog.updatedAt),
        },
        create: {
          id: prog.id,
          institutionId: prog.institutionId,
          departmentId: validDeptId,
          title: prog.title,
          degreeLevel: prog.degreeLevel,
          discipline: prog.discipline,
          broadField: prog.broadField ?? null,
          specializations: prog.specializations ?? [],
          opportunityType: prog.opportunityType ?? null,
          globalRegion: prog.globalRegion ?? null,
          durationMonths: prog.durationMonths,
          intakeTerm: prog.intakeTerm,
          applicationCycle: prog.applicationCycle,
          officialProgramUrl: prog.officialProgramUrl,
          officialApplicationUrl: prog.officialApplicationUrl,
          contactEmail: prog.contactEmail,
          applicationStages: prog.applicationStages ?? [],
          applicationFeeAmount: prog.applicationFeeAmount,
          applicationFeeCurrency: prog.applicationFeeCurrency,
          supervisorContactReq: prog.supervisorContactReq,
          deadlineDate: toDateOrNull(prog.deadlineDate),
          deadlineTimezone: prog.deadlineTimezone,
          openingDate: toDateOrNull(prog.openingDate),
          isActive: prog.isActive,
          isExpired: prog.isExpired,
          verificationStatus: prog.verificationStatus,
          fundingClassification: prog.fundingClassification,
          scholarshipIds: prog.scholarshipIds ?? [],
          claimIds: prog.claimIds ?? [],
          lastCheckedAt: toDateOrNull(prog.lastCheckedAt),
          createdAt: toRequiredDate(prog.createdAt),
          updatedAt: toRequiredDate(prog.updatedAt),
        },
      });

      const req = prog.requirement;
      if (req) {
        await tx.admissionRequirement.upsert({
          where: { programId: prog.id },
          update: {
            minGpa: req.minGpa,
            gradingScale: req.gradingScale,
            minGradingClassification: req.minGradingClassification,
            acceptedBackgrounds: req.acceptedBackgrounds ?? [],
            prerequisiteCourses: req.prerequisiteCourses ?? [],
            ieltsMinScore: req.ieltsMinScore,
            toeflMinScore: req.toeflMinScore,
            greRequirement: req.greRequirement,
            citizenshipRule: req.citizenshipRule,
            excludedCitizenships: req.excludedCitizenships ?? [],
            maxAgeLimit: req.maxAgeLimit ?? null,
            residencyRule: req.residencyRule ?? null,
            workExperienceReq: req.workExperienceReq ?? null,
            feeWaiverAvailable: req.feeWaiverAvailable ?? null,
            researchExpRequired: req.researchExpRequired,
            requiredDocuments: req.requiredDocuments ?? [],
            verificationStatus: req.verificationStatus,
            supportingClaimIds: req.supportingClaimIds ?? [],
          },
          create: {
            id: req.id,
            programId: prog.id,
            minGpa: req.minGpa,
            gradingScale: req.gradingScale,
            minGradingClassification: req.minGradingClassification,
            acceptedBackgrounds: req.acceptedBackgrounds ?? [],
            prerequisiteCourses: req.prerequisiteCourses ?? [],
            ieltsMinScore: req.ieltsMinScore,
            toeflMinScore: req.toeflMinScore,
            greRequirement: req.greRequirement,
            citizenshipRule: req.citizenshipRule,
            excludedCitizenships: req.excludedCitizenships ?? [],
            maxAgeLimit: req.maxAgeLimit ?? null,
            residencyRule: req.residencyRule ?? null,
            workExperienceReq: req.workExperienceReq ?? null,
            feeWaiverAvailable: req.feeWaiverAvailable ?? null,
            researchExpRequired: req.researchExpRequired,
            requiredDocuments: req.requiredDocuments ?? [],
            verificationStatus: req.verificationStatus,
            supportingClaimIds: req.supportingClaimIds ?? [],
          },
        });
      }

      for (const schId of prog.scholarshipIds ?? []) {
        if (!scholarshipIds.has(schId)) continue;
        await tx.programScholarship.upsert({
          where: {
            programId_scholarshipId: {
              programId: prog.id,
              scholarshipId: schId,
            },
          },
          update: {},
          create: {
            programId: prog.id,
            scholarshipId: schId,
          },
        });
      }
    }

    // 7. Upsert EvidenceClaims & ClaimVersions
    for (const c of db.claims) {
      const validProgId = c.programId && programIds.has(c.programId) ? c.programId : null;
      const validSchId =
        c.scholarshipId && scholarshipIds.has(c.scholarshipId) ? c.scholarshipId : null;

      await tx.evidenceClaim.upsert({
        where: { id: c.id },
        update: {
          programId: validProgId,
          scholarshipId: validSchId,
          claimType: c.claimType,
          fieldName: c.fieldName,
          normalizedValue: c.normalizedValue,
          supportingExcerpt: c.supportingExcerpt,
          excerptHash: c.excerptHash,
          sourceUrl: c.sourceUrl,
          sourceDomain: c.sourceDomain,
          sourceOrganization: c.sourceOrganization,
          pageSection: c.pageSection,
          retrievedAt: toRequiredDate(c.retrievedAt),
          extractedAt: toRequiredDate(c.extractedAt),
          lastContentChangeAt: toDateOrNull(c.lastContentChangeAt),
          verificationMethod: c.verificationMethod,
          verificationStatus: c.verificationStatus,
          evidenceQualityScore: c.evidenceQualityScore,
          applicationCycle: c.applicationCycle,
          freshnessPolicy: c.freshnessPolicy,
          conflictingClaimIds: c.conflictingClaimIds ?? [],
        },
        create: {
          id: c.id,
          programId: validProgId,
          scholarshipId: validSchId,
          claimType: c.claimType,
          fieldName: c.fieldName,
          normalizedValue: c.normalizedValue,
          supportingExcerpt: c.supportingExcerpt,
          excerptHash: c.excerptHash,
          sourceUrl: c.sourceUrl,
          sourceDomain: c.sourceDomain,
          sourceOrganization: c.sourceOrganization,
          pageSection: c.pageSection,
          retrievedAt: toRequiredDate(c.retrievedAt),
          extractedAt: toRequiredDate(c.extractedAt),
          lastContentChangeAt: toDateOrNull(c.lastContentChangeAt),
          verificationMethod: c.verificationMethod,
          verificationStatus: c.verificationStatus,
          evidenceQualityScore: c.evidenceQualityScore,
          applicationCycle: c.applicationCycle,
          freshnessPolicy: c.freshnessPolicy,
          conflictingClaimIds: c.conflictingClaimIds ?? [],
        },
      });

      for (const v of c.versions ?? []) {
        await tx.claimVersion.upsert({
          where: { id: v.id },
          update: {
            claimId: c.id,
            normalizedValue: v.normalizedValue,
            supportingExcerpt: v.supportingExcerpt,
            sourceUrl: v.sourceUrl,
            verificationStatus: v.verificationStatus,
            observedAt: toRequiredDate(v.observedAt),
          },
          create: {
            id: v.id,
            claimId: c.id,
            normalizedValue: v.normalizedValue,
            supportingExcerpt: v.supportingExcerpt,
            sourceUrl: v.sourceUrl,
            verificationStatus: v.verificationStatus,
            observedAt: toRequiredDate(v.observedAt),
          },
        });
      }
    }

    // 8. Upsert EligibilityResults
    for (const er of db.eligibilityResults) {
      if (!userIds.has(er.userId) || !programIds.has(er.programId)) continue;
      await tx.eligibilityResult.upsert({
        where: {
          userId_programId: {
            userId: er.userId,
            programId: er.programId,
          },
        },
        update: {
          admissionStatus: er.admissionStatus,
          scholarshipStatus: er.scholarshipStatus,
          fundingCompletenessStatus: er.fundingCompletenessStatus,
          pakistaniEligibilityStatus: er.pakistaniEligibilityStatus ?? null,
          overallRankScore: er.overallRankScore,
          decisionsJson: JSON.stringify(er.decisions ?? []),
          rankingFactorsJson: JSON.stringify(er.rankingFactors ?? {}),
          evaluatedAt: toRequiredDate(er.evaluatedAt),
        },
        create: {
          id: er.id,
          userId: er.userId,
          programId: er.programId,
          admissionStatus: er.admissionStatus,
          scholarshipStatus: er.scholarshipStatus,
          fundingCompletenessStatus: er.fundingCompletenessStatus,
          pakistaniEligibilityStatus: er.pakistaniEligibilityStatus ?? null,
          overallRankScore: er.overallRankScore,
          decisionsJson: JSON.stringify(er.decisions ?? []),
          rankingFactorsJson: JSON.stringify(er.rankingFactors ?? {}),
          evaluatedAt: toRequiredDate(er.evaluatedAt),
        },
      });
    }

    // 9. Upsert Sources, FetchAttempts, SourceSnapshots, JobQueueItems
    for (const src of db.sources) {
      await tx.sourceRegistry.upsert({
        where: { id: src.id },
        update: {
          name: src.name,
          domain: src.domain,
          seedUrl: src.seedUrl,
          category: src.category,
          country: src.country,
          authorityLevel: src.authorityLevel,
          refreshPolicy: src.refreshPolicy,
          priority: src.priority ?? 'NORMAL',
          rateLimitPerMinute: src.rateLimitPerMinute,
          maxConcurrency: src.maxConcurrency,
          enabled: src.enabled,
          robotsTxtAllowed: src.robotsTxtAllowed,
          lastFetchedAt: toDateOrNull(src.lastFetchedAt),
          lastHttpStatus: src.lastHttpStatus,
          lastResponseTimeMs: src.lastResponseTimeMs,
          consecutiveFailures: src.consecutiveFailures,
          isolatedUntil: toDateOrNull(src.isolatedUntil),
          updatedAt: toRequiredDate(src.updatedAt),
        },
        create: {
          id: src.id,
          name: src.name,
          domain: src.domain,
          seedUrl: src.seedUrl,
          category: src.category,
          country: src.country,
          authorityLevel: src.authorityLevel,
          refreshPolicy: src.refreshPolicy,
          priority: src.priority ?? 'NORMAL',
          rateLimitPerMinute: src.rateLimitPerMinute,
          maxConcurrency: src.maxConcurrency,
          enabled: src.enabled,
          robotsTxtAllowed: src.robotsTxtAllowed,
          lastFetchedAt: toDateOrNull(src.lastFetchedAt),
          lastHttpStatus: src.lastHttpStatus,
          lastResponseTimeMs: src.lastResponseTimeMs,
          consecutiveFailures: src.consecutiveFailures,
          isolatedUntil: toDateOrNull(src.isolatedUntil),
          createdAt: toRequiredDate(src.createdAt),
          updatedAt: toRequiredDate(src.updatedAt),
        },
      });
    }

    for (const fa of db.fetchAttempts) {
      if (!sourceIds.has(fa.sourceId)) continue;
      await tx.fetchAttempt.upsert({
        where: { id: fa.id },
        update: {
          sourceId: fa.sourceId,
          url: fa.url,
          normalizedUrl: fa.normalizedUrl,
          httpStatus: fa.httpStatus,
          responseTimeMs: fa.responseTimeMs,
          contentType: fa.contentType,
          bytesReceived: fa.bytesReceived,
          etag: fa.etag,
          lastModifiedHdr: fa.lastModifiedHdr,
          errorMessage: fa.errorMessage,
          attemptedAt: toRequiredDate(fa.attemptedAt),
        },
        create: {
          id: fa.id,
          sourceId: fa.sourceId,
          url: fa.url,
          normalizedUrl: fa.normalizedUrl,
          httpStatus: fa.httpStatus,
          responseTimeMs: fa.responseTimeMs,
          contentType: fa.contentType,
          bytesReceived: fa.bytesReceived,
          etag: fa.etag,
          lastModifiedHdr: fa.lastModifiedHdr,
          errorMessage: fa.errorMessage,
          attemptedAt: toRequiredDate(fa.attemptedAt),
        },
      });
    }

    for (const sn of db.snapshots) {
      if (!sourceIds.has(sn.sourceId)) continue;
      await tx.sourceSnapshot.upsert({
        where: { id: sn.id },
        update: {
          sourceId: sn.sourceId,
          normalizedUrl: sn.normalizedUrl,
          contentHash: sn.contentHash,
          title: sn.title,
          extractedTextSnippet: sn.extractedTextSnippet,
          discoveredChildLinks: sn.discoveredChildLinks ?? [],
          retrievedAt: toRequiredDate(sn.retrievedAt),
        },
        create: {
          id: sn.id,
          sourceId: sn.sourceId,
          normalizedUrl: sn.normalizedUrl,
          contentHash: sn.contentHash,
          title: sn.title,
          extractedTextSnippet: sn.extractedTextSnippet,
          discoveredChildLinks: sn.discoveredChildLinks ?? [],
          retrievedAt: toRequiredDate(sn.retrievedAt),
        },
      });
    }

    for (const job of db.jobQueue) {
      const validSourceId = job.sourceId && sourceIds.has(job.sourceId) ? job.sourceId : null;
      await tx.jobQueueItem.upsert({
        where: { idempotencyKey: job.idempotencyKey },
        update: {
          jobType: job.jobType,
          targetDomain: job.targetDomain,
          sourceId: validSourceId,
          url: job.url,
          priority: job.priority,
          status: job.status,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          leaseOwner: job.leaseOwner,
          leaseExpiresAt: toDateOrNull(job.leaseExpiresAt),
          nextRunAt: toRequiredDate(job.nextRunAt),
          lastError: job.lastError,
          executionLog: job.executionLog ?? [],
          updatedAt: toRequiredDate(job.updatedAt),
        },
        create: {
          id: job.id,
          idempotencyKey: job.idempotencyKey,
          jobType: job.jobType,
          targetDomain: job.targetDomain,
          sourceId: validSourceId,
          url: job.url,
          priority: job.priority,
          status: job.status,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          leaseOwner: job.leaseOwner,
          leaseExpiresAt: toDateOrNull(job.leaseExpiresAt),
          nextRunAt: toRequiredDate(job.nextRunAt),
          lastError: job.lastError,
          executionLog: job.executionLog ?? [],
          createdAt: toRequiredDate(job.createdAt),
          updatedAt: toRequiredDate(job.updatedAt),
        },
      });
    }

    // 10. Upsert ResearchRuns & ChangeEvents
    for (const run of db.researchRuns) {
      await tx.researchRun.upsert({
        where: { id: run.id },
        update: {
          triggerType: run.triggerType,
          status: run.status,
          sourcesChecked: run.sourcesChecked,
          urlsDiscovered: run.urlsDiscovered,
          httpSuccessCount: run.httpSuccessCount,
          httpFailureCount: run.httpFailureCount,
          claimsExtracted: run.claimsExtracted,
          changesDetected: run.changesDetected,
          notificationsCreated: run.notificationsCreated,
          summaryLog: run.summaryLog ?? [],
          startedAt: toRequiredDate(run.startedAt),
          completedAt: toDateOrNull(run.completedAt),
        },
        create: {
          id: run.id,
          triggerType: run.triggerType,
          status: run.status,
          sourcesChecked: run.sourcesChecked,
          urlsDiscovered: run.urlsDiscovered,
          httpSuccessCount: run.httpSuccessCount,
          httpFailureCount: run.httpFailureCount,
          claimsExtracted: run.claimsExtracted,
          changesDetected: run.changesDetected,
          notificationsCreated: run.notificationsCreated,
          summaryLog: run.summaryLog ?? [],
          startedAt: toRequiredDate(run.startedAt),
          completedAt: toDateOrNull(run.completedAt),
        },
      });
    }

    for (const ce of db.changeEvents) {
      await tx.changeEvent.upsert({
        where: { id: ce.id },
        update: {
          entityType: ce.entityType,
          entityId: ce.entityId,
          entityTitle: ce.entityTitle,
          fieldChanged: ce.fieldChanged,
          previousValue: ce.previousValue,
          newValue: ce.newValue,
          sourceUrl: ce.sourceUrl,
          isGenuineChange: ce.isGenuineChange,
          detectedAt: toRequiredDate(ce.detectedAt),
        },
        create: {
          id: ce.id,
          entityType: ce.entityType,
          entityId: ce.entityId,
          entityTitle: ce.entityTitle,
          fieldChanged: ce.fieldChanged,
          previousValue: ce.previousValue,
          newValue: ce.newValue,
          sourceUrl: ce.sourceUrl,
          isGenuineChange: ce.isGenuineChange,
          detectedAt: toRequiredDate(ce.detectedAt),
        },
      });
    }

    // 11. Upsert User-Owned SavedOpportunities, Tasks, Checklists, Notifications, EmailDeliveries, AuditLogs
    for (const so of db.savedOpportunities) {
      if (!userIds.has(so.userId) || !programIds.has(so.programId)) continue;
      await tx.savedOpportunity.upsert({
        where: {
          userId_programId: {
            userId: so.userId,
            programId: so.programId,
          },
        },
        update: {
          applicationStatus: so.applicationStatus,
          privateNotes: so.privateNotes,
          priorityLevel: so.priorityLevel,
          updatedAt: toRequiredDate(so.updatedAt),
        },
        create: {
          id: so.id,
          userId: so.userId,
          programId: so.programId,
          applicationStatus: so.applicationStatus,
          privateNotes: so.privateNotes,
          priorityLevel: so.priorityLevel,
          savedAt: toRequiredDate(so.savedAt),
          updatedAt: toRequiredDate(so.updatedAt),
        },
      });
    }

    for (const t of db.tasks) {
      if (!userIds.has(t.userId)) continue;
      const validProgId = t.programId && programIds.has(t.programId) ? t.programId : null;
      await tx.applicationTask.upsert({
        where: { id: t.id },
        update: {
          userId: t.userId,
          programId: validProgId,
          title: t.title,
          category: t.category,
          dueDate: toDateOrNull(t.dueDate),
          completed: t.completed,
          syncedFromEvidence: t.syncedFromEvidence,
          userNotes: t.userNotes,
          updatedAt: toRequiredDate(t.updatedAt),
        },
        create: {
          id: t.id,
          userId: t.userId,
          programId: validProgId,
          title: t.title,
          category: t.category,
          dueDate: toDateOrNull(t.dueDate),
          completed: t.completed,
          syncedFromEvidence: t.syncedFromEvidence,
          userNotes: t.userNotes,
          createdAt: toRequiredDate(t.createdAt),
          updatedAt: toRequiredDate(t.updatedAt),
        },
      });
    }

    for (const ci of db.checklistItems) {
      if (!userIds.has(ci.userId)) continue;
      const validProgId = ci.programId && programIds.has(ci.programId) ? ci.programId : null;
      await tx.documentChecklistItem.upsert({
        where: { id: ci.id },
        update: {
          userId: ci.userId,
          programId: validProgId,
          documentName: ci.documentName,
          status: ci.status,
          sourceRequirement: ci.sourceRequirement,
          userNotes: ci.userNotes,
          updatedAt: toRequiredDate(ci.updatedAt),
        },
        create: {
          id: ci.id,
          userId: ci.userId,
          programId: validProgId,
          documentName: ci.documentName,
          status: ci.status,
          sourceRequirement: ci.sourceRequirement,
          userNotes: ci.userNotes,
          updatedAt: toRequiredDate(ci.updatedAt),
        },
      });
    }

    for (const n of db.notifications) {
      if (!userIds.has(n.userId)) continue;
      await tx.notification.upsert({
        where: {
          userId_dedupeKey: {
            userId: n.userId,
            dedupeKey: n.dedupeKey,
          },
        },
        update: {
          category: n.category,
          title: n.title,
          message: n.message,
          sourceUrl: n.sourceUrl,
          isUncertainDate: n.isUncertainDate,
          read: n.read,
        },
        create: {
          id: n.id,
          userId: n.userId,
          dedupeKey: n.dedupeKey,
          category: n.category,
          title: n.title,
          message: n.message,
          sourceUrl: n.sourceUrl,
          isUncertainDate: n.isUncertainDate,
          read: n.read,
          createdAt: toRequiredDate(n.createdAt),
        },
      });
    }

    const notificationIds = new Set(db.notifications.map((n) => n.id));
    for (const ed of db.emailDeliveries) {
      if (!userIds.has(ed.userId)) continue;
      const validNotifId =
        ed.notificationId && notificationIds.has(ed.notificationId) ? ed.notificationId : null;
      await tx.emailDelivery.upsert({
        where: { id: ed.id },
        update: {
          userId: ed.userId,
          notificationId: validNotifId,
          recipientEmail: ed.recipientEmail,
          subject: ed.subject,
          provider: ed.provider,
          status: ed.status,
          providerMsgId: ed.providerMsgId,
          errorMessage: ed.errorMessage,
          attempts: ed.attempts,
        },
        create: {
          id: ed.id,
          userId: ed.userId,
          notificationId: validNotifId,
          recipientEmail: ed.recipientEmail,
          subject: ed.subject,
          provider: ed.provider,
          status: ed.status,
          providerMsgId: ed.providerMsgId,
          errorMessage: ed.errorMessage,
          attempts: ed.attempts,
          createdAt: toRequiredDate(ed.createdAt),
        },
      });
    }

    for (const al of db.auditLogs) {
      const validUserId = al.userId && userIds.has(al.userId) ? al.userId : null;
      await tx.auditLog.upsert({
        where: { id: al.id },
        update: {
          userId: validUserId,
          action: al.action,
          targetType: al.targetType,
          targetId: al.targetId,
          details: al.details,
        },
        create: {
          id: al.id,
          userId: validUserId,
          action: al.action,
          targetType: al.targetType,
          targetId: al.targetId,
          details: al.details,
          createdAt: toRequiredDate(al.createdAt),
        },
      });
    }

    // 12. Upsert SystemHealth singleton
    if (db.systemHealth) {
      const sh = db.systemHealth;
      await tx.systemHealth.upsert({
        where: { id: 'singleton' },
        update: {
          automationState: sh.automationState,
          stateReason: sh.stateReason,
          cronSchedule: sh.cronSchedule,
          lastScheduledRunAt: toDateOrNull(sh.lastScheduledRunAt),
          lastSuccessfulRunAt: toDateOrNull(sh.lastSuccessfulRunAt),
          missedRunsCount: sh.missedRunsCount,
          totalRequestsMade: sh.totalRequestsMade,
          totalBytesFetched: BigInt(Math.max(0, Math.floor(sh.totalBytesFetched || 0))),
          searchProviderEnabled: sh.searchProviderEnabled,
          aiProviderEnabled: sh.aiProviderEnabled,
          emailProviderEnabled: sh.emailProviderEnabled,
          updatedAt: toRequiredDate(sh.updatedAt),
        },
        create: {
          id: 'singleton',
          automationState: sh.automationState,
          stateReason: sh.stateReason,
          cronSchedule: sh.cronSchedule,
          lastScheduledRunAt: toDateOrNull(sh.lastScheduledRunAt),
          lastSuccessfulRunAt: toDateOrNull(sh.lastSuccessfulRunAt),
          missedRunsCount: sh.missedRunsCount,
          totalRequestsMade: sh.totalRequestsMade,
          totalBytesFetched: BigInt(Math.max(0, Math.floor(sh.totalBytesFetched || 0))),
          searchProviderEnabled: sh.searchProviderEnabled,
          aiProviderEnabled: sh.aiProviderEnabled,
          emailProviderEnabled: sh.emailProviderEnabled,
          updatedAt: toRequiredDate(sh.updatedAt),
        },
      });
    }
  }
}
