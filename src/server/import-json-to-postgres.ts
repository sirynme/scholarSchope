import fs from 'fs';
import path from 'path';
import { PostgresPrismaStorageAdapter, redactDatabaseError } from './postgres-adapter.js';
import { reconcileDataQualityAndStalePlaceholders, type DatabaseSchema } from './db.js';
import type { VerificationStatus } from '../lib/types.js';

export const DEV_FIXTURE_USER_IDS = new Set([
  'usr-researcher-primary',
  'usr-student-isolated',
]);

export const DEV_FIXTURE_USER_EMAILS = new Set([
  'researcher@scholarscope.ac.uk',
  'applicant.student@scholarscope.ac.uk',
]);

export interface EntityCountMap {
  users: number;
  profiles: number;
  qualifications: number;
  institutions: number;
  departments: number;
  programs: number;
  scholarships: number;
  evidenceClaims: number;
  eligibilityResults: number;
  sources: number;
  fetchAttempts: number;
  snapshots: number;
  jobQueue: number;
  researchRuns: number;
  changeEvents: number;
  savedOpportunities: number;
  tasks: number;
  checklistItems: number;
  notifications: number;
  emailDeliveries: number;
  auditLogs: number;
}

export interface ImportConflictItem {
  entity: keyof EntityCountMap;
  id: string;
  uniqueField: string;
  reason: string;
}

export interface PostgresImportSummary {
  startedAt: string;
  completedAt: string;
  excludeDevFixtures: boolean;
  reconciledHecPlaceholder: boolean;
  unverifiedUpgradedToVerifiedCount: number;
  sourceCounts: EntityCountMap;
  importedCounts: EntityCountMap;
  skippedCounts: EntityCountMap;
  conflicts: ImportConflictItem[];
  errors: string[];
}

const VERIFIED_STATUSES = new Set<VerificationStatus>([
  'Officially Confirmed',
  'Cross-Verified',
]);

function createZeroCounts(): EntityCountMap {
  return {
    users: 0,
    profiles: 0,
    qualifications: 0,
    institutions: 0,
    departments: 0,
    programs: 0,
    scholarships: 0,
    evidenceClaims: 0,
    eligibilityResults: 0,
    sources: 0,
    fetchAttempts: 0,
    snapshots: 0,
    jobQueue: 0,
    researchRuns: 0,
    changeEvents: 0,
    savedOpportunities: 0,
    tasks: 0,
    checklistItems: 0,
    notifications: 0,
    emailDeliveries: 0,
    auditLogs: 0,
  };
}

/**
 * Safely and repeatably imports a JSON DatabaseSchema snapshot into PostgreSQL.
 * - Does not modify the input JSON file on disk.
 * - Excludes development fixture accounts (Zainab Raza / Ayesha Siddiqui) by default for production safety.
 * - Detects duplicates and unique-key conflicts prior to import.
 * - Never upgrades unverified evidence claims to verified.
 * - Idempotent across repeated executions: already-present identical records are counted as skipped.
 */
export async function importJsonSnapshotToPostgres(
  adapter: PostgresPrismaStorageAdapter,
  rawJsonDb: DatabaseSchema,
  options?: { excludeDevFixtures?: boolean }
): Promise<PostgresImportSummary> {
  const startedAt = new Date().toISOString();
  const excludeDevFixtures = options?.excludeDevFixtures ?? true;

  // Deep clone input so we never mutate caller's in-memory reference or file content
  const workingDb: DatabaseSchema = JSON.parse(JSON.stringify(rawJsonDb));

  // Track original claim statuses before reconciliation to prove we never upgrade unverified -> verified
  const originalClaimStatusById = new Map<string, VerificationStatus>();
  for (const claim of workingDb.claims ?? []) {
    originalClaimStatusById.set(claim.id, claim.verificationStatus);
  }

  // Reconcile stale HEC placeholder & numeric excerpt verification rules
  const reconciliation = reconcileDataQualityAndStalePlaceholders(workingDb);

  // Enforce invariant: never silently upgrade an unverified claim to Officially Confirmed / Cross-Verified
  let unverifiedUpgradedToVerifiedCount = 0;
  for (const claim of workingDb.claims ?? []) {
    const prevStatus = originalClaimStatusById.get(claim.id);
    if (prevStatus && !VERIFIED_STATUSES.has(prevStatus) && VERIFIED_STATUSES.has(claim.verificationStatus)) {
      claim.verificationStatus = prevStatus;
      unverifiedUpgradedToVerifiedCount++;
    }
  }

  const sourceCounts: EntityCountMap = {
    users: workingDb.users?.length ?? 0,
    profiles: workingDb.profiles?.length ?? 0,
    qualifications: workingDb.qualifications?.length ?? 0,
    institutions: workingDb.institutions?.length ?? 0,
    departments: workingDb.departments?.length ?? 0,
    programs: workingDb.programs?.length ?? 0,
    scholarships: workingDb.scholarships?.length ?? 0,
    evidenceClaims: workingDb.claims?.length ?? 0,
    eligibilityResults: workingDb.eligibilityResults?.length ?? 0,
    sources: workingDb.sources?.length ?? 0,
    fetchAttempts: workingDb.fetchAttempts?.length ?? 0,
    snapshots: workingDb.snapshots?.length ?? 0,
    jobQueue: workingDb.jobQueue?.length ?? 0,
    researchRuns: workingDb.researchRuns?.length ?? 0,
    changeEvents: workingDb.changeEvents?.length ?? 0,
    savedOpportunities: workingDb.savedOpportunities?.length ?? 0,
    tasks: workingDb.tasks?.length ?? 0,
    checklistItems: workingDb.checklistItems?.length ?? 0,
    notifications: workingDb.notifications?.length ?? 0,
    emailDeliveries: workingDb.emailDeliveries?.length ?? 0,
    auditLogs: workingDb.auditLogs?.length ?? 0,
  };

  const importedCounts = createZeroCounts();
  const skippedCounts = createZeroCounts();
  const conflicts: ImportConflictItem[] = [];
  const errors: string[] = [];

  try {
    const existingDb = await adapter.loadDatabase();

    // Build lookup sets of existing records for idempotency tracking and conflict detection
    const existingUserIds = new Set(existingDb.users.map((u) => u.id));
    const existingUserByEmail = new Map(existingDb.users.map((u) => [u.email.toLowerCase(), u.id]));
    const existingProfileIds = new Set(existingDb.profiles.map((p) => p.id));
    const existingQualIds = new Set(existingDb.qualifications.map((q) => q.id));
    const existingInstIds = new Set(existingDb.institutions.map((i) => i.id));
    const existingDeptIds = new Set(existingDb.departments.map((d) => d.id));
    const existingProgIds = new Set(existingDb.programs.map((p) => p.id));
    const existingSchIds = new Set(existingDb.scholarships.map((s) => s.id));
    const existingClaimIds = new Set(existingDb.claims.map((c) => c.id));
    const existingEligIds = new Set(existingDb.eligibilityResults.map((e) => e.id));
    const existingSourceIds = new Set(existingDb.sources.map((s) => s.id));
    const existingSourceBySeedUrl = new Map(existingDb.sources.map((s) => [s.seedUrl, s.id]));
    const existingAttemptIds = new Set(existingDb.fetchAttempts.map((f) => f.id));
    const existingSnapshotIds = new Set(existingDb.snapshots.map((s) => s.id));
    const existingJobIds = new Set(existingDb.jobQueue.map((j) => j.id));
    const existingJobByIdemKey = new Map(existingDb.jobQueue.map((j) => [j.idempotencyKey, j.id]));
    const existingRunIds = new Set(existingDb.researchRuns.map((r) => r.id));
    const existingChangeIds = new Set(existingDb.changeEvents.map((c) => c.id));
    const existingSavedIds = new Set(existingDb.savedOpportunities.map((s) => s.id));
    const existingTaskIds = new Set(existingDb.tasks.map((t) => t.id));
    const existingChecklistIds = new Set(existingDb.checklistItems.map((c) => c.id));
    const existingNotifIds = new Set(existingDb.notifications.map((n) => n.id));
    const existingNotifByUserDedupe = new Map(
      existingDb.notifications.map((n) => [`${n.userId}::${n.dedupeKey}`, n.id])
    );
    const existingEmailIds = new Set(existingDb.emailDeliveries.map((e) => e.id));
    const existingAuditIds = new Set(existingDb.auditLogs.map((a) => a.id));

    // Filter out dev fixture users when excludeDevFixtures === true
    const allowedUsers = [];
    const allowedUserIds = new Set<string>(existingUserIds);
    const seenEmailsInBatch = new Map<string, string>();

    for (const user of workingDb.users) {
      const emailKey = user.email.trim().toLowerCase();
      if (
        excludeDevFixtures &&
        (DEV_FIXTURE_USER_IDS.has(user.id) || DEV_FIXTURE_USER_EMAILS.has(emailKey))
      ) {
        skippedCounts.users++;
        continue;
      }

      const conflictBatchId = seenEmailsInBatch.get(emailKey);
      const conflictExistingId = existingUserByEmail.get(emailKey);
      if ((conflictBatchId && conflictBatchId !== user.id) || (conflictExistingId && conflictExistingId !== user.id)) {
        conflicts.push({
          entity: 'users',
          id: user.id,
          uniqueField: 'email',
          reason: `Conflicting user ID for email ${emailKey}`,
        });
        skippedCounts.users++;
        continue;
      }

      seenEmailsInBatch.set(emailKey, user.id);
      allowedUsers.push(user);
      allowedUserIds.add(user.id);
      if (existingUserIds.has(user.id)) {
        skippedCounts.users++;
      } else {
        importedCounts.users++;
      }
    }

    // Filter user-owned collections by allowedUserIds
    const allowedProfiles = [];
    for (const p of workingDb.profiles) {
      if (!allowedUserIds.has(p.userId)) {
        skippedCounts.profiles++;
        continue;
      }
      allowedProfiles.push(p);
      if (existingProfileIds.has(p.id)) skippedCounts.profiles++;
      else importedCounts.profiles++;
    }

    const allowedQualifications = [];
    for (const q of workingDb.qualifications) {
      if (!allowedUserIds.has(q.userId)) {
        skippedCounts.qualifications++;
        continue;
      }
      allowedQualifications.push(q);
      if (existingQualIds.has(q.id)) skippedCounts.qualifications++;
      else importedCounts.qualifications++;
    }

    const allowedEligibilityResults = [];
    for (const er of workingDb.eligibilityResults) {
      if (!allowedUserIds.has(er.userId)) {
        skippedCounts.eligibilityResults++;
        continue;
      }
      allowedEligibilityResults.push(er);
      if (existingEligIds.has(er.id)) skippedCounts.eligibilityResults++;
      else importedCounts.eligibilityResults++;
    }

    const allowedSavedOpportunities = [];
    for (const so of workingDb.savedOpportunities) {
      if (!allowedUserIds.has(so.userId)) {
        skippedCounts.savedOpportunities++;
        continue;
      }
      allowedSavedOpportunities.push(so);
      if (existingSavedIds.has(so.id)) skippedCounts.savedOpportunities++;
      else importedCounts.savedOpportunities++;
    }

    const allowedTasks = [];
    for (const t of workingDb.tasks) {
      if (!allowedUserIds.has(t.userId)) {
        skippedCounts.tasks++;
        continue;
      }
      allowedTasks.push(t);
      if (existingTaskIds.has(t.id)) skippedCounts.tasks++;
      else importedCounts.tasks++;
    }

    const allowedChecklistItems = [];
    for (const ci of workingDb.checklistItems) {
      if (!allowedUserIds.has(ci.userId)) {
        skippedCounts.checklistItems++;
        continue;
      }
      allowedChecklistItems.push(ci);
      if (existingChecklistIds.has(ci.id)) skippedCounts.checklistItems++;
      else importedCounts.checklistItems++;
    }

    const allowedNotifications = [];
    const seenNotifUserDedupe = new Map<string, string>();
    for (const n of workingDb.notifications) {
      if (!allowedUserIds.has(n.userId)) {
        skippedCounts.notifications++;
        continue;
      }
      const compositeKey = `${n.userId}::${n.dedupeKey}`;
      const batchId = seenNotifUserDedupe.get(compositeKey);
      const dbId = existingNotifByUserDedupe.get(compositeKey);
      if ((batchId && batchId !== n.id) || (dbId && dbId !== n.id)) {
        conflicts.push({
          entity: 'notifications',
          id: n.id,
          uniqueField: 'userId_dedupeKey',
          reason: `Duplicate notification dedupeKey '${n.dedupeKey}' for user ${n.userId}`,
        });
        skippedCounts.notifications++;
        continue;
      }
      seenNotifUserDedupe.set(compositeKey, n.id);
      allowedNotifications.push(n);
      if (existingNotifIds.has(n.id)) skippedCounts.notifications++;
      else importedCounts.notifications++;
    }

    const allowedEmails = [];
    for (const ed of workingDb.emailDeliveries) {
      if (!allowedUserIds.has(ed.userId)) {
        skippedCounts.emailDeliveries++;
        continue;
      }
      allowedEmails.push(ed);
      if (existingEmailIds.has(ed.id)) skippedCounts.emailDeliveries++;
      else importedCounts.emailDeliveries++;
    }

    const allowedAuditLogs = [];
    for (const al of workingDb.auditLogs) {
      if (al.userId && !allowedUserIds.has(al.userId)) {
        skippedCounts.auditLogs++;
        continue;
      }
      allowedAuditLogs.push(al);
      if (existingAuditIds.has(al.id)) skippedCounts.auditLogs++;
      else importedCounts.auditLogs++;
    }

    // Shared discovery & academic catalog records
    const allowedInstitutions = [];
    const seenInstIds = new Set<string>();
    for (const inst of workingDb.institutions) {
      if (seenInstIds.has(inst.id)) {
        conflicts.push({
          entity: 'institutions',
          id: inst.id,
          uniqueField: 'id',
          reason: `Duplicate institution ID ${inst.id} in source payload`,
        });
        skippedCounts.institutions++;
        continue;
      }
      seenInstIds.add(inst.id);
      allowedInstitutions.push(inst);
      if (existingInstIds.has(inst.id)) skippedCounts.institutions++;
      else importedCounts.institutions++;
    }

    const allowedDepartments = [];
    for (const dept of workingDb.departments) {
      allowedDepartments.push(dept);
      if (existingDeptIds.has(dept.id)) skippedCounts.departments++;
      else importedCounts.departments++;
    }

    const allowedPrograms = [];
    const seenProgramIds = new Set<string>();
    for (const prog of workingDb.programs) {
      if (seenProgramIds.has(prog.id)) {
        conflicts.push({
          entity: 'programs',
          id: prog.id,
          uniqueField: 'id',
          reason: `Duplicate program ID ${prog.id} in source payload`,
        });
        skippedCounts.programs++;
        continue;
      }
      seenProgramIds.add(prog.id);
      allowedPrograms.push(prog);
      if (existingProgIds.has(prog.id)) skippedCounts.programs++;
      else importedCounts.programs++;
    }

    const allowedScholarships = [];
    const seenScholarshipIds = new Set<string>();
    for (const sch of workingDb.scholarships) {
      if (seenScholarshipIds.has(sch.id)) {
        conflicts.push({
          entity: 'scholarships',
          id: sch.id,
          uniqueField: 'id',
          reason: `Duplicate scholarship ID ${sch.id} in source payload`,
        });
        skippedCounts.scholarships++;
        continue;
      }
      seenScholarshipIds.add(sch.id);
      allowedScholarships.push(sch);
      if (existingSchIds.has(sch.id)) skippedCounts.scholarships++;
      else importedCounts.scholarships++;
    }

    const allowedClaims = [];
    const seenClaimIds = new Set<string>();
    for (const claim of workingDb.claims) {
      if (seenClaimIds.has(claim.id)) {
        conflicts.push({
          entity: 'evidenceClaims',
          id: claim.id,
          uniqueField: 'id',
          reason: `Duplicate evidence claim ID ${claim.id} in source payload`,
        });
        skippedCounts.evidenceClaims++;
        continue;
      }
      seenClaimIds.add(claim.id);
      allowedClaims.push(claim);
      if (existingClaimIds.has(claim.id)) skippedCounts.evidenceClaims++;
      else importedCounts.evidenceClaims++;
    }

    const allowedSources = [];
    const seenSeedUrls = new Map<string, string>();
    for (const src of workingDb.sources) {
      const batchId = seenSeedUrls.get(src.seedUrl);
      const dbId = existingSourceBySeedUrl.get(src.seedUrl);
      if ((batchId && batchId !== src.id) || (dbId && dbId !== src.id)) {
        conflicts.push({
          entity: 'sources',
          id: src.id,
          uniqueField: 'seedUrl',
          reason: `Conflicting source ID for seedUrl ${src.seedUrl}`,
        });
        skippedCounts.sources++;
        continue;
      }
      seenSeedUrls.set(src.seedUrl, src.id);
      allowedSources.push(src);
      if (existingSourceIds.has(src.id)) skippedCounts.sources++;
      else importedCounts.sources++;
    }

    const allowedAttempts = [];
    for (const fa of workingDb.fetchAttempts) {
      allowedAttempts.push(fa);
      if (existingAttemptIds.has(fa.id)) skippedCounts.fetchAttempts++;
      else importedCounts.fetchAttempts++;
    }

    const allowedSnapshots = [];
    for (const sn of workingDb.snapshots) {
      allowedSnapshots.push(sn);
      if (existingSnapshotIds.has(sn.id)) skippedCounts.snapshots++;
      else importedCounts.snapshots++;
    }

    const allowedJobs = [];
    const seenIdemKeys = new Map<string, string>();
    for (const job of workingDb.jobQueue) {
      const batchId = seenIdemKeys.get(job.idempotencyKey);
      const dbId = existingJobByIdemKey.get(job.idempotencyKey);
      if ((batchId && batchId !== job.id) || (dbId && dbId !== job.id)) {
        conflicts.push({
          entity: 'jobQueue',
          id: job.id,
          uniqueField: 'idempotencyKey',
          reason: `Conflicting job ID for idempotencyKey ${job.idempotencyKey}`,
        });
        skippedCounts.jobQueue++;
        continue;
      }
      seenIdemKeys.set(job.idempotencyKey, job.id);
      allowedJobs.push(job);
      if (existingJobIds.has(job.id)) skippedCounts.jobQueue++;
      else importedCounts.jobQueue++;
    }

    const allowedRuns = [];
    for (const r of workingDb.researchRuns) {
      allowedRuns.push(r);
      if (existingRunIds.has(r.id)) skippedCounts.researchRuns++;
      else importedCounts.researchRuns++;
    }

    const allowedChanges = [];
    for (const ce of workingDb.changeEvents) {
      allowedChanges.push(ce);
      if (existingChangeIds.has(ce.id)) skippedCounts.changeEvents++;
      else importedCounts.changeEvents++;
    }

    // Merge with any existing non-conflicting records in PostgreSQL so we never delete existing production users
    const mergeById = <T extends { id: string }>(existingList: T[], incomingList: T[]): T[] => {
      const map = new Map<string, T>();
      for (const item of existingList) {
        if (
          excludeDevFixtures &&
          (DEV_FIXTURE_USER_IDS.has(item.id) ||
            ('userId' in item && typeof item.userId === 'string' && DEV_FIXTURE_USER_IDS.has(item.userId)))
        ) {
          continue;
        }
        map.set(item.id, item);
      }
      for (const item of incomingList) {
        map.set(item.id, item);
      }
      return Array.from(map.values());
    };

    const mergedDb: DatabaseSchema = {
      users: mergeById(existingDb.users, allowedUsers),
      profiles: mergeById(existingDb.profiles, allowedProfiles),
      qualifications: mergeById(existingDb.qualifications, allowedQualifications),
      institutions: mergeById(existingDb.institutions, allowedInstitutions),
      departments: mergeById(existingDb.departments, allowedDepartments),
      programs: mergeById(existingDb.programs, allowedPrograms),
      scholarships: mergeById(existingDb.scholarships, allowedScholarships),
      claims: mergeById(existingDb.claims, allowedClaims),
      eligibilityResults: mergeById(existingDb.eligibilityResults, allowedEligibilityResults),
      sources: mergeById(existingDb.sources, allowedSources),
      fetchAttempts: mergeById(existingDb.fetchAttempts, allowedAttempts),
      snapshots: mergeById(existingDb.snapshots, allowedSnapshots),
      jobQueue: mergeById(existingDb.jobQueue, allowedJobs),
      researchRuns: mergeById(existingDb.researchRuns, allowedRuns),
      changeEvents: mergeById(existingDb.changeEvents, allowedChanges),
      savedOpportunities: mergeById(existingDb.savedOpportunities, allowedSavedOpportunities),
      tasks: mergeById(existingDb.tasks, allowedTasks),
      checklistItems: mergeById(existingDb.checklistItems, allowedChecklistItems),
      notifications: mergeById(existingDb.notifications, allowedNotifications),
      emailDeliveries: mergeById(existingDb.emailDeliveries, allowedEmails),
      auditLogs: mergeById(existingDb.auditLogs, allowedAuditLogs),
      systemHealth: workingDb.systemHealth ?? existingDb.systemHealth,
    };

    await adapter.saveDatabase(mergedDb);

    return {
      startedAt,
      completedAt: new Date().toISOString(),
      excludeDevFixtures,
      reconciledHecPlaceholder: reconciliation.reconciledHecPlaceholder,
      unverifiedUpgradedToVerifiedCount,
      sourceCounts,
      importedCounts,
      skippedCounts,
      conflicts,
      errors,
    };
  } catch (err) {
    const cleanErr = redactDatabaseError(err);
    errors.push(cleanErr.message);
    return {
      startedAt,
      completedAt: new Date().toISOString(),
      excludeDevFixtures,
      reconciledHecPlaceholder: reconciliation.reconciledHecPlaceholder,
      unverifiedUpgradedToVerifiedCount,
      sourceCounts,
      importedCounts,
      skippedCounts,
      conflicts,
      errors,
    };
  }
}

// CLI execution support: `npm run db:import`
const isDirectExecution =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  process.argv[1].endsWith('import-json-to-postgres.ts');

if (isDirectExecution) {
  (async () => {
    const jsonPath = path.resolve(process.cwd(), '.data', 'scholarscope-db.json');
    if (!fs.existsSync(jsonPath)) {
      console.error(`[ScholarScope Import] Source JSON file not found at ${jsonPath}`);
      process.exit(1);
    }
    const rawJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as DatabaseSchema;
    const excludeFixtures = process.env.INCLUDE_DEV_FIXTURES !== 'true';
    const adapter = new PostgresPrismaStorageAdapter();
    const summary = await importJsonSnapshotToPostgres(adapter, rawJson, {
      excludeDevFixtures: excludeFixtures,
    });
    console.log(JSON.stringify(summary, null, 2));
    if (summary.errors.length > 0) {
      process.exit(1);
    }
  })().catch((err) => {
    console.error('[ScholarScope Import] Fatal error:', redactDatabaseError(err).message);
    process.exit(1);
  });
}
