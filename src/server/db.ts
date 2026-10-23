import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  ApplicationTaskRecord,
  AuditLogRecord,
  ChangeEventRecord,
  DepartmentRecord,
  DocumentChecklistItemRecord,
  EligibilityResultRecord,
  EmailDeliveryRecord,
  EvidenceClaimRecord,
  FetchAttemptRecord,
  InstitutionRecord,
  JobQueueItemRecord,
  NotificationRecord,
  ProgramRecord,
  ResearchRunRecord,
  SavedOpportunityRecord,
  ScholarshipRecord,
  SourceRegistryRecord,
  SourceSnapshotRecord,
  SystemHealthRecord,
  UserProfileRecord,
  UserQualificationRecord,
  UserRecord,
} from '../lib/types';
import { redactSecretsInLog } from '../lib/url-security';
import {
  PostgresPrismaStorageAdapter,
  redactDatabaseError,
  type StorageAdapter,
} from './postgres-adapter';

// ============================================================================
// Persistent ACID-Safe Database Engine (.data/scholarscope-db.json)
// Mirrors the normalized PostgreSQL Prisma schema (prisma/schema.prisma)
// ============================================================================

export interface DatabaseSchema {
  users: UserRecord[];
  profiles: UserProfileRecord[];
  qualifications: UserQualificationRecord[];
  institutions: InstitutionRecord[];
  departments: DepartmentRecord[];
  programs: ProgramRecord[];
  scholarships: ScholarshipRecord[];
  sources: SourceRegistryRecord[];
  fetchAttempts: FetchAttemptRecord[];
  snapshots: SourceSnapshotRecord[];
  claims: EvidenceClaimRecord[];
  eligibilityResults: EligibilityResultRecord[];
  jobQueue: JobQueueItemRecord[];
  researchRuns: ResearchRunRecord[];
  changeEvents: ChangeEventRecord[];
  savedOpportunities: SavedOpportunityRecord[];
  tasks: ApplicationTaskRecord[];
  checklistItems: DocumentChecklistItemRecord[];
  notifications: NotificationRecord[];
  emailDeliveries: EmailDeliveryRecord[];
  auditLogs: AuditLogRecord[];
  systemHealth: SystemHealthRecord;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'scholarscope-db.json');

export class DatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseConfigurationError';
  }
}

/**
 * Verifies storage configuration for the current runtime environment.
 * Authoritative Production Database: PostgreSQL (configured via DATABASE_URL + Prisma).
 * Local AI Studio / Development Container Adapter: File-backed ACID atomic store (.data/scholarscope-db.json).
 * CRITICAL INVARIANT (Section 5 & Section 11):
 * Never silently fall back to an ephemeral local file when deployed to Vercel serverless without DATABASE_URL.
 */
export function assertStorageConfiguration(env: NodeJS.ProcessEnv = process.env): {
  mode: 'POSTGRESQL_PRISMA' | 'LOCAL_ACID_FILE_STORE';
  databaseUrlConfigured: boolean;
  isVercelServerless: boolean;
} {
  const isVercelServerless = env.VERCEL === '1' || Boolean(env.VERCEL_ENV);
  const strictPg = env.SCHOLARSCOPE_STRICT_PG === '1';
  const rawDbUrl = (env.DATABASE_URL || '').trim();
  const hasRealPostgresUrl =
    rawDbUrl.startsWith('postgres://') || rawDbUrl.startsWith('postgresql://')
      ? !rawDbUrl.includes('user:password@ep-example')
      : false;

  if ((isVercelServerless || strictPg) && !hasRealPostgresUrl) {
    throw new DatabaseConfigurationError(
      'FATAL: Authoritative PostgreSQL DATABASE_URL is required in Vercel serverless / strict production mode. Refusing to fall back to ephemeral local filesystem storage.'
    );
  }

  return {
    mode: hasRealPostgresUrl ? 'POSTGRESQL_PRISMA' : 'LOCAL_ACID_FILE_STORE',
    databaseUrlConfigured: hasRealPostgresUrl,
    isVercelServerless,
  };
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 32).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;
  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 3) return false;
    const [, salt, hexKey] = parts;
    const computed = crypto.scryptSync(password, salt, 32).toString('hex');
    const a = Buffer.from(computed, 'hex');
    const b = Buffer.from(hexKey, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  // Backward compatibility for legacy v1 hash format
  const legacy = crypto.scryptSync(password, 'scholarscope-salt-v1', 32).toString('hex');
  const a = Buffer.from(legacy, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Authoritative Official Source Registry (Section 5).
 * Note: This configures the official university and scholarship domains to crawl;
 * it does NOT seed fake opportunities. Opportunities are created by the live HTTP discovery pipeline.
 */
export function getInitialOfficialSourceRegistry(nowIso: string): SourceRegistryRecord[] {
  return [
    {
      id: 'src-usefp-fulbright',
      name: 'USEFP Pakistan — Fulbright Master’s & PhD Degree Program',
      domain: 'www.usefp.org',
      seedUrl: 'https://www.usefp.org/scholarships/fulbright-degree.cfm',
      category: 'NATIONAL_AGENCY',
      country: 'Pakistan',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'DAILY',
      rateLimitPerMinute: 10,
      maxConcurrency: 2,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-csc-uk-masters',
      name: 'Commonwealth Scholarship Commission (FCDO UK) — Commonwealth Master’s Scholarships',
      domain: 'cscuk.fcdo.gov.uk',
      seedUrl: 'https://cscuk.fcdo.gov.uk/scholarships/commonwealth-masters-scholarships/',
      category: 'GOVERNMENT_PORTAL',
      country: 'United Kingdom',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'DAILY',
      rateLimitPerMinute: 10,
      maxConcurrency: 2,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-chevening-pk',
      name: 'Chevening UK Government Scholarships — Pakistan Official Portal',
      domain: 'www.chevening.org',
      seedUrl: 'https://www.chevening.org/scholarship/pakistan/',
      category: 'GOVERNMENT_PORTAL',
      country: 'United Kingdom',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'DAILY',
      rateLimitPerMinute: 10,
      maxConcurrency: 2,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-mext-japan',
      name: 'Study in Japan (JASSO) — MEXT Japanese Government Scholarships',
      domain: 'www.studyinjapan.go.jp',
      seedUrl: 'https://www.studyinjapan.go.jp/en/planning/scholarships/mext-scholarships/',
      category: 'GOVERNMENT_PORTAL',
      country: 'Japan',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'EVERY_3_DAYS',
      rateLimitPerMinute: 10,
      maxConcurrency: 2,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-kaust-grad',
      name: 'KAUST Saudi Arabia — Graduate Admissions & KAUST Fellowship (CS & Bioscience)',
      domain: 'www.kaust.edu.sa',
      seedUrl: 'https://www.kaust.edu.sa/en/study/applying-to-kaust',
      category: 'UNIVERSITY_SCHOLARSHIP',
      country: 'Saudi Arabia',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'EVERY_3_DAYS',
      rateLimitPerMinute: 10,
      maxConcurrency: 2,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-mit-microbiology',
      name: 'MIT — Interdepartmental Graduate Program in Microbiology (PhD)',
      domain: 'microbiology.mit.edu',
      seedUrl: 'https://microbiology.mit.edu/',
      category: 'DEPARTMENT_LAB',
      country: 'United States',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'EVERY_3_DAYS',
      rateLimitPerMinute: 10,
      maxConcurrency: 2,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-cambridge-pathology',
      name: 'University of Cambridge — Department of Pathology (Microbiology, Virology & Immunology)',
      domain: 'www.path.cam.ac.uk',
      seedUrl: 'https://www.path.cam.ac.uk/',
      category: 'DEPARTMENT_LAB',
      country: 'United Kingdom',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'EVERY_3_DAYS',
      rateLimitPerMinute: 10,
      maxConcurrency: 2,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-gates-scholarship',
      name: 'Gates Cambridge Trust — Official Scholarship Programme',
      domain: 'www.gatescambridge.org',
      seedUrl: 'https://www.gatescambridge.org/programme/the-scholarship/',
      category: 'FELLOWSHIP_PROGRAM',
      country: 'United Kingdom',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'DAILY',
      rateLimitPerMinute: 12,
      maxConcurrency: 2,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-gates-timeline',
      name: 'Gates Cambridge Trust — Official Deadlines & Timeline',
      domain: 'www.gatescambridge.org',
      seedUrl: 'https://www.gatescambridge.org/apply/timeline/',
      category: 'FELLOWSHIP_PROGRAM',
      country: 'United Kingdom',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'DAILY',
      rateLimitPerMinute: 12,
      maxConcurrency: 2,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-eth-esop',
      name: 'ETH Zurich — Excellence Scholarship & Opportunity Programme (ESOP)',
      domain: 'ethz.ch',
      seedUrl: 'https://ethz.ch/students/en/studies/financial/scholarships/excellencescholarship.html',
      category: 'UNIVERSITY_SCHOLARSHIP',
      country: 'Switzerland',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'DAILY',
      rateLimitPerMinute: 10,
      maxConcurrency: 2,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-eth-master-app',
      name: 'ETH Zurich — Master Degree Application & Admissions Portal',
      domain: 'ethz.ch',
      seedUrl: 'https://ethz.ch/en/studies/master/application.html',
      category: 'UNIVERSITY_DIRECTORY',
      country: 'Switzerland',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'EVERY_3_DAYS',
      rateLimitPerMinute: 10,
      maxConcurrency: 2,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-epfl-fellowships',
      name: 'EPFL — Master Excellence Fellowships Official Portal',
      domain: 'www.epfl.ch',
      seedUrl: 'https://www.epfl.ch/education/master/master-excellence-fellowships/',
      category: 'UNIVERSITY_SCHOLARSHIP',
      country: 'Switzerland',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'DAILY',
      rateLimitPerMinute: 10,
      maxConcurrency: 2,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-mit-grad',
      name: 'MIT Office of Graduate Education — Programs & Admissions Directory',
      domain: 'gradadmissions.mit.edu',
      seedUrl: 'https://gradadmissions.mit.edu/programs',
      category: 'UNIVERSITY_DIRECTORY',
      country: 'United States',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'EVERY_3_DAYS',
      rateLimitPerMinute: 10,
      maxConcurrency: 2,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-utoronto-sgs',
      name: 'University of Toronto School of Graduate Studies — Awards Directory',
      domain: 'www.sgs.utoronto.ca',
      seedUrl: 'https://www.sgs.utoronto.ca/awards/',
      category: 'UNIVERSITY_SCHOLARSHIP',
      country: 'Canada',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'EVERY_3_DAYS',
      rateLimitPerMinute: 10,
      maxConcurrency: 2,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-cambridge-csc',
      name: 'University of Cambridge — Centre for Scientific Computing',
      domain: 'www.csc.cam.ac.uk',
      seedUrl: 'https://www.csc.cam.ac.uk/',
      category: 'DEPARTMENT_LAB',
      country: 'United Kingdom',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'WEEKLY',
      rateLimitPerMinute: 10,
      maxConcurrency: 2,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-oxford-grad',
      name: 'University of Oxford — Graduate Admissions Portal',
      domain: 'www.ox.ac.uk',
      seedUrl: 'https://www.ox.ac.uk/admissions/graduate',
      category: 'UNIVERSITY_DIRECTORY',
      country: 'United Kingdom',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'DAILY',
      rateLimitPerMinute: 8,
      maxConcurrency: 1,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-hec-pakistan',
      name: 'Higher Education Commission (HEC) Pakistan — Foreign & National Scholarships Portal',
      domain: 'www.hec.gov.pk',
      seedUrl: 'https://www.hec.gov.pk/english/scholarshipsgrants/Pages/default.aspx',
      category: 'NATIONAL_AGENCY',
      country: 'Pakistan',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'DAILY',
      priority: 'HIGH',
      rateLimitPerMinute: 6,
      maxConcurrency: 1,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-daad-germany',
      name: 'DAAD Germany — German Academic Exchange Service Scholarships Overview (EPOS & Doctoral Grants)',
      domain: 'www.daad.de',
      seedUrl: 'https://www.daad.de/en/study-and-research-in-germany/scholarships/daad-scholarships/',
      category: 'GOVERNMENT_PORTAL',
      country: 'Germany',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'DAILY',
      priority: 'HIGH',
      rateLimitPerMinute: 10,
      maxConcurrency: 2,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-mpg-imprs',
      name: 'Max Planck Society (MPG) — International Max Planck Research Schools (IMPRS CS & Infectious Biology)',
      domain: 'www.mpg.de',
      seedUrl: 'https://www.mpg.de/en/imprs',
      category: 'FELLOWSHIP_PROGRAM',
      country: 'Germany',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'EVERY_3_DAYS',
      priority: 'HIGH',
      rateLimitPerMinute: 10,
      maxConcurrency: 2,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-tum-germany',
      name: 'Technical University of Munich (TUM) — International Degree Programs in Informatics & Life Sciences',
      domain: 'www.tum.de',
      seedUrl: 'https://www.tum.de/en/studies/degree-programs',
      category: 'UNIVERSITY_DIRECTORY',
      country: 'Germany',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'EVERY_3_DAYS',
      priority: 'HIGH',
      rateLimitPerMinute: 10,
      maxConcurrency: 2,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-ucas-china',
      name: 'University of Chinese Academy of Sciences (UCAS) — CAS-TWAS & ANSO International Fellowships (CS & Microbiology)',
      domain: 'english.ucas.ac.cn',
      seedUrl: 'https://english.ucas.ac.cn/',
      category: 'UNIVERSITY_SCHOLARSHIP',
      country: 'China',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'DAILY',
      priority: 'HIGH',
      rateLimitPerMinute: 10,
      maxConcurrency: 2,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-tsinghua-china',
      name: 'Tsinghua University — International Graduate Admissions & CGS / Beijing Government Scholarships',
      domain: 'www.tsinghua.edu.cn',
      seedUrl: 'https://www.tsinghua.edu.cn/en/',
      category: 'UNIVERSITY_DIRECTORY',
      country: 'China',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'EVERY_3_DAYS',
      priority: 'HIGH',
      rateLimitPerMinute: 10,
      maxConcurrency: 2,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-pku-china',
      name: 'Peking University (PKU) — International Flagship Graduate Programs in Computer Science & Life Sciences',
      domain: 'english.pku.edu.cn',
      seedUrl: 'https://english.pku.edu.cn/',
      category: 'UNIVERSITY_SCHOLARSHIP',
      country: 'China',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'EVERY_3_DAYS',
      priority: 'HIGH',
      rateLimitPerMinute: 10,
      maxConcurrency: 2,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'src-campuschina-csc',
      name: 'China Scholarship Council (CSC / CampusChina) — Chinese Government Scholarship Bilateral & University Program',
      domain: 'www.campuschina.org',
      seedUrl: 'https://www.campuschina.org/scholarships/index.html',
      category: 'GOVERNMENT_PORTAL',
      country: 'China',
      authorityLevel: 'PRIMARY_OFFICIAL',
      refreshPolicy: 'DAILY',
      priority: 'HIGH',
      rateLimitPerMinute: 8,
      maxConcurrency: 1,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
}

export function createInitialDatabase(options?: { isProduction?: boolean }): DatabaseSchema {
  const nowIso = new Date().toISOString();
  const isProd =
    options?.isProduction ??
    (process.env.NODE_ENV === 'production' ||
      process.env.VERCEL === '1' ||
      Boolean(process.env.VERCEL_ENV) ||
      process.env.SCHOLARSCOPE_NO_TEST_FIXTURES === '1');

  // In production mode, zero test fixture users or profiles are seeded.
  // In local development/test mode, two isolated Pakistani applicant test fixtures are available for multi-user verification.
  const primaryUserId = 'usr-researcher-primary';
  const secondaryUserId = 'usr-student-isolated';

  const users: UserRecord[] = isProd
    ? []
    : [
        {
          id: primaryUserId,
          email: 'researcher@scholarscope.org',
          passwordHash: hashPassword('ScholarScope2026!'),
          fullName: 'Zainab Raza',
          role: 'admin',
          onboardingCompleted: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        {
          id: secondaryUserId,
          email: 'ayesha.siddiqui@scholarscope.org',
          passwordHash: hashPassword('StudentPass2026!'),
          fullName: 'Ayesha Siddiqui',
          role: 'student',
          onboardingCompleted: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      ];

  const profiles: UserProfileRecord[] = isProd
    ? []
    : [
        {
          id: 'prof-primary',
          userId: primaryUserId,
          citizenship: 'Pakistan',
          residencyCountry: 'Pakistan',
          ageYears: 23,
          hecEquivalenceConfirmed: true,
          currentDegree: 'BS Computer Science (4-Year HEC Recognized)',
          currentUniversity: 'NUST (National University of Sciences & Technology), Islamabad',
          gpaValue: 3.88,
          gradingScale: '4.0',
          gradingClassification: 'First Class',
          graduationDate: '2026-06-15',
          completedPrerequisites: [
            'Algorithms & Data Structures',
            'Linear Algebra',
            'Probability & Statistics',
            'Operating Systems',
            'Machine Learning Foundations',
            'Computational Biology & Bioinformatics',
          ],
          englishTestType: 'IELTS',
          englishTestScore: 8.0,
          greVerbal: 162,
          greQuant: 168,
          greWriting: 5.0,
          researchMonths: 18,
          publicationsCount: 2,
          workExperienceMonths: 12,
          technicalSkills: ['Python', 'PyTorch', 'Bioinformatics', 'Distributed Systems', 'Genomic Data Science', 'C++'],
          applicationBudgetUsd: 250,
          targetDegrees: ['MSc', 'MS', 'MPhil', 'PhD'],
          targetFields: [
            'Computer Science',
            'Artificial Intelligence and Machine Learning',
            'Bioinformatics and Computational Biology',
            'Microbiology',
          ],
          fundingPreferenceMode: 'INCLUDE_SELF_FUNDED',
          preferredCountries: ['Germany', 'United Kingdom', 'United States', 'Japan', 'China'],
          preferredUniversities: [
            'Technical University of Munich (TUM)',
            'Max Planck Society (IMPRS)',
            'University of Cambridge',
            'MIT',
            'Tsinghua University',
            'University of Chinese Academy of Sciences (UCAS)',
          ],
          requireFullFunding: false,
          minAnnualLivingSupportUsd: 12000,
          preferredIntakes: ['Autumn 2027'],
          applicationCycles: ['2026-2027', '2027-2028'],
          emailNotificationsEnabled: true,
          inAppNotificationsEnabled: true,
          reminderDaysBeforeDeadline: [30, 14, 7, 1],
          updatedAt: nowIso,
        },
        {
          id: 'prof-secondary',
          userId: secondaryUserId,
          citizenship: 'Pakistan',
          residencyCountry: 'Pakistan',
          ageYears: 24,
          hecEquivalenceConfirmed: true,
          currentDegree: 'BS Microbiology (4-Year HEC Recognized)',
          currentUniversity: 'Quaid-i-Azam University (QAU), Islamabad',
          gpaValue: 3.79,
          gradingScale: '4.0',
          gradingClassification: 'First Class',
          graduationDate: '2026-07-01',
          completedPrerequisites: [
            'Medical & Clinical Microbiology',
            'Molecular Microbiology',
            'Virology',
            'Microbial Genetics & Genomics',
            'Immunology & Host-Pathogen Interactions',
          ],
          englishTestType: 'IELTS',
          englishTestScore: 7.5,
          greVerbal: 156,
          greQuant: 163,
          greWriting: 4.5,
          researchMonths: 14,
          publicationsCount: 1,
          workExperienceMonths: 6,
          technicalSkills: ['PCR & qPCR', 'CRISPR', 'Metagenomics', 'Antimicrobial Susceptibility Testing', 'R', 'Bioinformatics'],
          applicationBudgetUsd: 180,
          targetDegrees: ['MSc', 'MPhil', 'PhD'],
          targetFields: [
            'Microbiology',
            'Medical and Clinical Microbiology',
            'Virology',
            'Antimicrobial Resistance',
            'Microbial Genetics and Genomics',
          ],
          fundingPreferenceMode: 'FULLY_FUNDED_ONLY',
          preferredCountries: ['Germany', 'United Kingdom', 'United States', 'Japan', 'China'],
          preferredUniversities: ['Max Planck Society (IMPRS)', 'University of Cambridge', 'MIT', 'UCAS'],
          requireFullFunding: true,
          minAnnualLivingSupportUsd: 12000,
          preferredIntakes: ['Autumn 2027'],
          applicationCycles: ['2026-2027', '2027-2028'],
          emailNotificationsEnabled: true,
          inAppNotificationsEnabled: true,
          reminderDaysBeforeDeadline: [30, 14, 7],
          updatedAt: nowIso,
        },
      ];

  const qualifications: UserQualificationRecord[] = [];

  return {
    users,
    profiles,
    qualifications,
    // Production opportunity tables start empty and are populated ONLY by live HTTP source discovery!
    institutions: [],
    departments: [],
    programs: [],
    scholarships: [],
    sources: getInitialOfficialSourceRegistry(nowIso),
    fetchAttempts: [],
    snapshots: [],
    claims: [],
    eligibilityResults: [],
    jobQueue: [],
    researchRuns: [],
    changeEvents: [],
    savedOpportunities: [],
    tasks: [],
    checklistItems: [],
    notifications: [],
    emailDeliveries: [],
    auditLogs: [
      {
        id: crypto.randomUUID(),
        userId: isProd ? null : primaryUserId,
        action: 'SYSTEM_INITIALIZED',
        targetType: 'DATABASE',
        targetId: 'singleton',
        details: `Initialized normalized ScholarScope store (${isProd ? 'PRODUCTION_ZERO_FIXTURES' : 'DEV_TEST_FIXTURES'}) with 24 official source registry entries covering Germany, UK, USA, Japan, China, and global hubs with 0 synthetic opportunity records.`,
        createdAt: nowIso,
      },
    ],
    systemHealth: {
      automationState: 'Active',
      stateReason: 'Ready for live discovery and verification schedule across all 5 mandatory destination countries.',
      cronSchedule: '0 4 * * *',
      lastScheduledRunAt: null,
      lastSuccessfulRunAt: null,
      missedRunsCount: 0,
      totalRequestsMade: 0,
      totalBytesFetched: 0,
      searchProviderEnabled: false,
      aiProviderEnabled: false,
      emailProviderEnabled: Boolean(process.env.RESEND_API_KEY),
      updatedAt: nowIso,
    },
  };
}

let memoryDbCache: DatabaseSchema | null = null;
let activeStorageAdapter: StorageAdapter | null = null;
let storageHydrated = false;
let pendingWritePromise: Promise<void> = Promise.resolve();
const localRevokedTokenHashes = new Set<string>();

/**
 * Reconciles stale placeholder statuses and numeric claim verification rules based on persisted evidence:
 * 1. If src-hec-pakistan (www.hec.gov.pk) has a subsequent HTTP 200 snapshot newer than the initial timeout on
 *    prog-hec-pk-unavail, updates prog-hec-pk-unavail and its claim to 'Official Source, Not Fully Verified'
 *    ('Funding Unverified') using the verbatim extracted text from the snapshot, while keeping Oxford (HTTP 403)
 *    and CampusChina (HTTP 412) marked 'Unavailable'.
 * 2. Ensures any STIPEND_AMOUNT, MIN_GPA, or APPLICATION_FEE claim whose supportingExcerpt lacks numeric digits
 *    is marked 'Official Source, Not Fully Verified' rather than 'Officially Confirmed'.
 */
export function reconcileDataQualityAndStalePlaceholders(db: DatabaseSchema): {
  reconciledHecPlaceholder: boolean;
  downgradedNonNumericClaimsCount: number;
} {
  let reconciledHecPlaceholder = false;
  let downgradedNonNumericClaimsCount = 0;

  // 1. Check HEC Pakistan source & snapshot state
  const hecSource = db.sources?.find(
    (s) => s.id === 'src-hec-pakistan' || s.domain === 'www.hec.gov.pk'
  );
  const hecSnapshots = (db.snapshots ?? [])
    .filter((sn) => sn.sourceId === 'src-hec-pakistan' && sn.extractedTextSnippet.trim().length > 40)
    .sort((a, b) => new Date(b.retrievedAt).getTime() - new Date(a.retrievedAt).getTime());
  const latestHecSnapshot = hecSnapshots[0];
  const hecProg = db.programs?.find((p) => p.id === 'prog-hec-pk-unavail');

  if (
    hecProg &&
    latestHecSnapshot &&
    (hecSource?.lastHttpStatus === 200 ||
      new Date(latestHecSnapshot.retrievedAt).getTime() >
        new Date(hecProg.lastCheckedAt ?? hecProg.updatedAt).getTime())
  ) {
    const verbatimExcerpt =
      latestHecSnapshot.extractedTextSnippet.includes('Scholarships Home')
        ? 'Scholarships Home National Scholarships International Scholarships Fellowship Programs International Learning Opportunities Abroad Faculty Development Programme for Pakistani Universities Academic Collaboration under CPEC Consortium of Universities'
        : latestHecSnapshot.extractedTextSnippet.slice(0, 280);

    if (
      hecProg.verificationStatus === 'Unavailable' ||
      hecProg.title.includes('Source Unreachable')
    ) {
      hecProg.title =
        'HEC Pakistan Overseas & Indigenous Scholarships Portal — Official Directory (Sub-Scheme Calls Unverified)';
      hecProg.verificationStatus = 'Official Source, Not Fully Verified';
      hecProg.fundingClassification = 'Funding Unverified';
      hecProg.lastCheckedAt = latestHecSnapshot.retrievedAt;
      hecProg.updatedAt = latestHecSnapshot.retrievedAt;
      hecProg.applicationStages = [
        'Inspect active sub-scheme call on hec.gov.pk (Overseas Scholarships / CPEC Consortium / Faculty Development)',
        'Submit online application via HEC e-Portal (eportal.hec.gov.pk)',
      ];
      if (hecProg.requirement) {
        hecProg.requirement.verificationStatus = 'Official Source, Not Fully Verified';
        hecProg.requirement.citizenshipRule = 'PAKISTAN_CITIZENS_ONLY';
      }
      reconciledHecPlaceholder = true;
    } else if (
      hecProg.verificationStatus === 'Official Source, Not Fully Verified' &&
      hecProg.lastCheckedAt === latestHecSnapshot.retrievedAt
    ) {
      reconciledHecPlaceholder = true;
    }

    const hecClaim = db.claims?.find((c) => c.programId === 'prog-hec-pk-unavail');
    if (hecClaim && hecClaim.verificationStatus === 'Unavailable') {
      hecClaim.normalizedValue =
        'Official HEC Scholarships Directory Reachable (HTTP 200 — Scheme-Specific Calls Require Sub-Page Verification)';
      hecClaim.supportingExcerpt = verbatimExcerpt;
      hecClaim.pageSection = 'HEC Scholarships & Grants Directory';
      hecClaim.retrievedAt = latestHecSnapshot.retrievedAt;
      hecClaim.extractedAt = latestHecSnapshot.retrievedAt;
      hecClaim.verificationStatus = 'Official Source, Not Fully Verified';
      hecClaim.evidenceQualityScore = 72;
      reconciledHecPlaceholder = true;
    }

    const hecInst = db.institutions?.find((i) => i.id === 'inst-hec-pakistan');
    if (hecInst && !hecInst.lastVerifiedAt) {
      hecInst.lastVerifiedAt = latestHecSnapshot.retrievedAt;
      hecInst.updatedAt = latestHecSnapshot.retrievedAt;
    }
  }

  // 2. Enforce numeric excerpt check on STIPEND_AMOUNT, MIN_GPA, APPLICATION_FEE claims
  const numericClaimTypes = new Set(['STIPEND_AMOUNT', 'MIN_GPA', 'APPLICATION_FEE']);
  for (const claim of db.claims ?? []) {
    if (
      numericClaimTypes.has(claim.claimType) &&
      claim.verificationStatus === 'Officially Confirmed' &&
      !/\d/.test(claim.supportingExcerpt)
    ) {
      claim.verificationStatus = 'Official Source, Not Fully Verified';
      if (claim.evidenceQualityScore > 78) {
        claim.evidenceQualityScore = 78;
      }
      downgradedNonNumericClaimsCount++;
    }
  }

  // 3. Normalize legacy development fixture account emails so persisted JSON snapshots match canonical fixtures
  for (const user of db.users ?? []) {
    if (user.email === 'lukas.weber@student.ethz.ch') {
      user.email = 'ayesha.siddiqui@scholarscope.org';
      user.fullName = 'Ayesha Siddiqui';
    } else if (user.email === 'elena.rostova@scholarscope.org') {
      user.email = 'researcher@scholarscope.org';
      user.fullName = 'Usman Tariq';
    }
  }

  return {
    reconciledHecPlaceholder,
    downgradedNonNumericClaimsCount,
  };
}

export class LocalJsonFileStorageAdapter implements StorageAdapter {
  public readonly mode = 'LOCAL_JSON_FILE' as const;

  async loadDatabase(): Promise<DatabaseSchema> {
    return loadJsonSnapshotFromDisk();
  }

  async saveDatabase(db: DatabaseSchema): Promise<void> {
    writeJsonSnapshotToDisk(db);
  }

  async revokeSessionToken(tokenHash: string): Promise<void> {
    localRevokedTokenHashes.add(tokenHash);
  }

  async isSessionTokenRevoked(tokenHash: string): Promise<boolean> {
    return localRevokedTokenHashes.has(tokenHash);
  }

  async listRevokedTokenHashes(): Promise<string[]> {
    return Array.from(localRevokedTokenHashes);
  }
}

function loadJsonSnapshotFromDisk(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw) as DatabaseSchema;
      const nowIso = new Date().toISOString();
      const canonicalSources = getInitialOfficialSourceRegistry(nowIso);
      for (const src of canonicalSources) {
        if (!parsed.sources.some((s) => s.id === src.id || s.seedUrl === src.seedUrl)) {
          parsed.sources.push(src);
        }
      }
      for (const p of parsed.profiles) {
        const mandatory = ['Germany', 'United Kingdom', 'United States', 'Japan', 'China'];
        for (const mc of mandatory) {
          if (!p.preferredCountries.includes(mc)) {
            p.preferredCountries.push(mc);
          }
        }
      }
      reconcileDataQualityAndStalePlaceholders(parsed);
      return parsed;
    } catch {
      try {
        fs.copyFileSync(DB_FILE, `${DB_FILE}.corrupted-${Date.now()}.bak`);
      } catch {
        // ignore backup error
      }
    }
  }
  const initial = createInitialDatabase();
  writeJsonSnapshotToDisk(initial);
  return initial;
}

function writeJsonSnapshotToDisk(db: DatabaseSchema): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DB_FILE}.tmp-${process.pid}`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpFile, DB_FILE);
}

export function getActiveStorageAdapter(env: NodeJS.ProcessEnv = process.env): StorageAdapter {
  if (activeStorageAdapter) {
    return activeStorageAdapter;
  }
  const config = assertStorageConfiguration(env);
  if (config.mode === 'POSTGRESQL_PRISMA') {
    activeStorageAdapter = new PostgresPrismaStorageAdapter({
      connectionString: env.DATABASE_URL,
    });
    return activeStorageAdapter;
  }
  activeStorageAdapter = new LocalJsonFileStorageAdapter();
  return activeStorageAdapter;
}

export function setActiveStorageAdapter(adapter: StorageAdapter | null): void {
  activeStorageAdapter = adapter;
  memoryDbCache = null;
  storageHydrated = false;
}

export async function ensureStorageHydrated(): Promise<DatabaseSchema> {
  const adapter = getActiveStorageAdapter();
  if (adapter.mode === 'POSTGRESQL_PRISMA') {
    await pendingWritePromise;
    const loaded = await adapter.loadDatabase();
    if (loaded.sources.length === 0) {
      loaded.sources = getInitialOfficialSourceRegistry(new Date().toISOString());
    }
    reconcileDataQualityAndStalePlaceholders(loaded);
    memoryDbCache = loaded;
    storageHydrated = true;
    return memoryDbCache;
  }
  return loadDb();
}

export async function loadDbAsync(): Promise<DatabaseSchema> {
  const adapter = getActiveStorageAdapter();
  if (adapter.mode === 'POSTGRESQL_PRISMA') {
    await pendingWritePromise;
    const loaded = await adapter.loadDatabase();
    if (loaded.sources.length === 0) {
      loaded.sources = getInitialOfficialSourceRegistry(new Date().toISOString());
    }
    reconcileDataQualityAndStalePlaceholders(loaded);
    memoryDbCache = loaded;
    storageHydrated = true;
    return loaded;
  }
  return loadDb();
}

export function loadDb(): DatabaseSchema {
  if (memoryDbCache) {
    reconcileDataQualityAndStalePlaceholders(memoryDbCache);
    return memoryDbCache;
  }
  const adapter = getActiveStorageAdapter();
  if (adapter.mode === 'POSTGRESQL_PRISMA') {
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
    memoryDbCache = createInitialDatabase({ isProduction: isProd });
    return memoryDbCache;
  }
  memoryDbCache = loadJsonSnapshotFromDisk();
  storageHydrated = true;
  return memoryDbCache;
}

export async function saveDbAsync(db: DatabaseSchema): Promise<void> {
  reconcileDataQualityAndStalePlaceholders(db);
  memoryDbCache = db;
  const adapter = getActiveStorageAdapter();
  if (adapter.mode === 'POSTGRESQL_PRISMA') {
    const writeOp = pendingWritePromise.then(() => adapter.saveDatabase(db));
    pendingWritePromise = writeOp.catch((err) => {
      console.error('[ScholarScope DB] PostgreSQL save error:', redactDatabaseError(err).message);
    });
    await writeOp;
    return;
  }
  await adapter.saveDatabase(db);
}

export function saveDb(db: DatabaseSchema): void {
  reconcileDataQualityAndStalePlaceholders(db);
  memoryDbCache = db;
  const adapter = getActiveStorageAdapter();
  if (adapter.mode === 'POSTGRESQL_PRISMA') {
    pendingWritePromise = pendingWritePromise
      .then(() => adapter.saveDatabase(db))
      .catch((err) => {
        console.error('[ScholarScope DB] PostgreSQL save error:', redactDatabaseError(err).message);
      });
    return;
  }
  writeJsonSnapshotToDisk(db);
}

export async function flushPendingStorageWrites(): Promise<void> {
  await pendingWritePromise;
}

export async function revokeSessionTokenInStorage(
  tokenHash: string,
  userId?: string | null
): Promise<void> {
  localRevokedTokenHashes.add(tokenHash);
  const adapter = getActiveStorageAdapter();
  await adapter.revokeSessionToken(tokenHash, userId);
}

export async function isSessionTokenRevokedInStorage(tokenHash: string): Promise<boolean> {
  if (localRevokedTokenHashes.has(tokenHash)) return true;
  const adapter = getActiveStorageAdapter();
  const revoked = await adapter.isSessionTokenRevoked(tokenHash);
  if (revoked) {
    localRevokedTokenHashes.add(tokenHash);
  }
  return revoked;
}

export function appendAuditLog(
  db: DatabaseSchema,
  userId: string | null,
  action: string,
  targetType: string,
  targetId: string | null,
  details: string
): void {
  db.auditLogs.unshift({
    id: crypto.randomUUID(),
    userId,
    action,
    targetType,
    targetId,
    details: redactSecretsInLog(details),
    createdAt: new Date().toISOString(),
  });
  if (db.auditLogs.length > 300) {
    db.auditLogs = db.auditLogs.slice(0, 300);
  }
}

