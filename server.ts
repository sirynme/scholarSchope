import express, { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  LoginSchema,
  PasswordRecoverySchema,
  RegisterSchema,
  SavedOpportunityUpdateSchema,
  SourceConfigSchema,
  TaskInputSchema,
  UserProfileInputSchema,
  UserRecord,
} from './src/lib/types';
import {
  appendAuditLog,
  assertStorageConfiguration,
  ensureStorageHydrated,
  flushPendingStorageWrites,
  hashPassword,
  isSessionTokenRevokedInStorage,
  loadDb,
  revokeSessionTokenInStorage,
  saveDb,
  verifyPassword,
} from './src/server/db';
import {
  computeCountryCoverageMetrics,
  executeAutonomousDiscoveryRun,
  recalculateAllUserMatches,
} from './src/server/discovery-runner';
import { OFFICIAL_LIVING_COST_BENCHMARKS } from './src/lib/funding-engine';
import { validateUrlAgainstSsrf } from './src/lib/url-security';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const CRON_SECRET = process.env.CRON_SECRET || '';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

function getStorageConfigSafe() {
  try {
    return assertStorageConfiguration();
  } catch (err) {
    if (process.env.SCHOLARSCOPE_STRICT_PG === '1') {
      throw err;
    }
    return {
      mode: 'LOCAL_ACID_FILE_STORE' as const,
      databaseUrlConfigured: false,
      isVercelServerless: Boolean(process.env.VERCEL === '1' || process.env.VERCEL_ENV),
    };
  }
}

const storageConfig = getStorageConfigSafe();

// In-memory session map + HMAC-SHA256 stateless signed session token verification
const activeSessions = new Map<string, string>();
const revokedTokens = new Set<string>();

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSignedSessionToken(userId: string): string {
  const issuedAt = Date.now().toString(36);
  const nonce = crypto.randomBytes(8).toString('hex');
  const payload = `${userId}.${issuedAt}.${nonce}`;
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  const token = `${payload}.${sig}`;
  activeSessions.set(token, userId);
  return token;
}

export function verifySignedSessionToken(token: string): string | null {
  if (!token || revokedTokens.has(token)) return null;
  const cached = activeSessions.get(token);
  if (cached) return cached;

  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [userId, issuedAt, nonce, sig] = parts;
  const payload = `${userId}.${issuedAt}.${nonce}`;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expectedSig, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  activeSessions.set(token, userId);
  return userId;
}

// Per-IP Rate Limiter (Section 15)
const ipRequestCounters = new Map<string, { count: number; windowStartMs: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 180;

function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const k = pair.slice(0, idx).trim();
      const v = decodeURIComponent(pair.slice(idx + 1).trim());
      out[k] = v;
    }
  }
  return out;
}

function getAuthenticatedUser(req: Request): UserRecord | null {
  const db = loadDb();
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const uid = verifySignedSessionToken(token);
    if (!uid) return null;
    return db.users.find((x) => x.id === uid) || null;
  }

  const cookies = parseCookies(req.headers.cookie);
  if (cookies.scholarscope_logged_out === '1') {
    return null;
  }
  if (cookies.scholarscope_session) {
    const uid = verifySignedSessionToken(cookies.scholarscope_session);
    if (!uid) return null;
    return db.users.find((x) => x.id === uid) || null;
  }

  return null;
}

export const app = express();

async function startServer() {
  app.use(express.json({ limit: '512kb' }));

  // ==========================================================================
  // Security Headers & Rate Limiting Middleware (Section 15)
  // ==========================================================================
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; img-src 'self' https: data: blob:; connect-src 'self' https: ws: wss:;"
    );

    if (req.path.startsWith('/api/')) {
      const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const nowMs = Date.now();
      const entry = ipRequestCounters.get(ip);
      if (!entry || nowMs - entry.windowStartMs > RATE_LIMIT_WINDOW_MS) {
        ipRequestCounters.set(ip, { count: 1, windowStartMs: nowMs });
      } else {
        entry.count += 1;
        if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
          res.status(429).json({
            error: 'Rate limit exceeded. Please wait before issuing additional requests.',
          });
          return;
        }
      }

      // Guarantee that any saveDb() call made during this request is flushed and committed to PostgreSQL
      // BEFORE the HTTP response is transmitted (critical on Vercel Serverless where the runtime freezes after res.end)
      const origJson = res.json.bind(res);
      res.json = ((body: any) => {
        flushPendingStorageWrites()
          .then(() => {
            origJson(body);
          })
          .catch((err: any) => {
            res.status(500);
            origJson({
              error: err?.message || 'Database write persistence failure',
            });
          });
        return res;
      }) as typeof res.json;

      try {
        await ensureStorageHydrated();
        const authHeader = req.headers.authorization;
        const bearerToken =
          authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
        const cookies = parseCookies(req.headers.cookie);
        const candidateToken = bearerToken || cookies.scholarscope_session || null;
        if (candidateToken) {
          const isRevoked = await isSessionTokenRevokedInStorage(hashSessionToken(candidateToken));
          if (isRevoked) {
            revokedTokens.add(candidateToken);
            activeSessions.delete(candidateToken);
          }
        }
      } catch (err: any) {
        res.status(500);
        origJson({
          error: err?.message || 'Storage initialization error',
        });
        return;
      }
    }
    next();
  });

  // ==========================================================================
  // 0. Operational Health & Storage Verification Endpoint (/api/health)
  // ==========================================================================
  app.get('/api/health', (_req: Request, res: Response) => {
    const currentDb = loadDb();
    res.json({
      ok: true,
      storage: getStorageConfigSafe(),
      systemHealth: currentDb.systemHealth,
      counts: {
        institutions: currentDb.institutions.length,
        programs: currentDb.programs.length,
        scholarships: currentDb.scholarships.length,
        claims: currentDb.claims.length,
        sources: currentDb.sources.length,
        researchRuns: currentDb.researchRuns.length,
      },
      latestRun: currentDb.researchRuns[0] || null,
      countryCoverage: computeCountryCoverageMetrics(currentDb),
    });
  });

  // ==========================================================================
  // Initial Autonomous Live Discovery Run on Startup (Local Dev only, if 0 runs)
  // ==========================================================================
  if (
    !process.env.VERCEL &&
    !process.env.VERCEL_ENV &&
    process.env.NODE_ENV !== 'test' &&
    process.env.SCHOLARSCOPE_SKIP_STARTUP_CRAWL !== '1'
  ) {
    ensureStorageHydrated()
      .then((db) => {
        if (db.researchRuns.length === 0) {
          console.log(
            '[ScholarScope] Executing initial autonomous live discovery against official sources...'
          );
          return executeAutonomousDiscoveryRun(db, 'INITIAL_DISCOVERY', 25).then((run) => {
            console.log(
              `[ScholarScope] Initial live discovery complete: status=${run.status}, sources=${run.sourcesChecked}, HTTP_200=${run.httpSuccessCount}, claims=${run.claimsExtracted}`
            );
          });
        }
      })
      .catch((err) => {
        console.error('[ScholarScope] Initial live discovery error:', err);
      });
  }

  // ==========================================================================
  // 1. Authentication, Registration, Recovery & Account Deletion (Sections 4, 15)
  // ==========================================================================

  app.get('/api/auth/session', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.json({ authenticated: false, user: null });
      return;
    }
    const currentDb = loadDb();
    const profile = currentDb.profiles.find((p) => p.userId === user.id) || null;
    res.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        onboardingCompleted: user.onboardingCompleted,
        createdAt: user.createdAt,
      },
      profile,
    });
  });

  app.post('/api/auth/register', (req: Request, res: Response) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration data' });
      return;
    }
    const currentDb = loadDb();
    const existing = currentDb.users.find(
      (u) => u.email.toLowerCase() === parsed.data.email.toLowerCase()
    );
    if (existing) {
      res.status(409).json({ error: 'An account with this email address already exists.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const userId = `usr-${crypto.randomUUID()}`;
    const normalizedEmail = parsed.data.email.toLowerCase().trim();
    const configuredAdminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const assignedRole = configuredAdminEmails.includes(normalizedEmail) ? 'admin' : 'student';
    const newUser: UserRecord = {
      id: userId,
      email: normalizedEmail,
      passwordHash: hashPassword(parsed.data.password),
      fullName: parsed.data.fullName.trim(),
      role: assignedRole,
      onboardingCompleted: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    currentDb.users.push(newUser);
    currentDb.profiles.push({
      id: `prof-${crypto.randomUUID()}`,
      userId,
      citizenship: 'Pakistan',
      residencyCountry: 'Pakistan',
      currentDegree: null,
      currentUniversity: null,
      gpaValue: null,
      gradingScale: '4.0',
      gradingClassification: null,
      graduationDate: null,
      completedPrerequisites: [],
      englishTestType: null,
      englishTestScore: null,
      greVerbal: null,
      greQuant: null,
      greWriting: null,
      researchMonths: 0,
      publicationsCount: 0,
      workExperienceMonths: 0,
      technicalSkills: [],
      applicationBudgetUsd: null,
      targetDegrees: ['MSc', 'MS', 'PhD'],
      targetFields: ['Computer Science', 'Microbiology'],
      fundingPreferenceMode: 'INCLUDE_SELF_FUNDED',
      preferredCountries: ['Germany', 'United Kingdom', 'United States', 'Japan', 'China'],
      preferredUniversities: [],
      requireFullFunding: false,
      minAnnualLivingSupportUsd: null,
      preferredIntakes: ['Autumn 2027'],
      applicationCycles: ['2026-2027', '2027-2028'],
      emailNotificationsEnabled: true,
      inAppNotificationsEnabled: true,
      reminderDaysBeforeDeadline: [30, 14, 7, 1],
      updatedAt: nowIso,
    });

    recalculateAllUserMatches(currentDb, new Date());
    appendAuditLog(currentDb, userId, 'USER_REGISTERED', 'USER', userId, `Registered account ${newUser.email}`);
    saveDb(currentDb);

    const sessionToken = createSignedSessionToken(userId);
    res.setHeader(
      'Set-Cookie',
      [
        `scholarscope_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax`,
        `scholarscope_logged_out=0; Path=/; HttpOnly; SameSite=Lax`,
      ]
    );

    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        onboardingCompleted: newUser.onboardingCompleted,
      },
      sessionToken,
    });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Valid email and password are required.' });
      return;
    }
    const currentDb = loadDb();
    const user = currentDb.users.find(
      (u) => u.email.toLowerCase() === parsed.data.email.toLowerCase().trim()
    );
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const sessionToken = createSignedSessionToken(user.id);
    res.setHeader(
      'Set-Cookie',
      [
        `scholarscope_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax`,
        `scholarscope_logged_out=0; Path=/; HttpOnly; SameSite=Lax`,
      ]
    );
    appendAuditLog(currentDb, user.id, 'USER_LOGIN', 'USER', user.id, `Session created for ${user.email}`);
    saveDb(currentDb);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        onboardingCompleted: user.onboardingCompleted,
      },
      sessionToken,
    });
  });

  app.post('/api/auth/recover', (req: Request, res: Response) => {
    const parsed = PasswordRecoverySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
      return;
    }
    const currentDb = loadDb();
    const user = currentDb.users.find(
      (u) => u.email.toLowerCase() === parsed.data.email.toLowerCase().trim()
    );
    if (!user) {
      res.status(404).json({ error: 'No account found matching that email address.' });
      return;
    }

    user.passwordHash = hashPassword(parsed.data.newPassword);
    user.updatedAt = new Date().toISOString();
    appendAuditLog(currentDb, user.id, 'PASSWORD_RECOVERY_COMPLETED', 'USER', user.id, `Password updated for ${user.email}`);
    saveDb(currentDb);

    res.json({ ok: true, message: 'Password updated. You can now sign in with your new credentials.' });
  });

  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    const cookies = parseCookies(req.headers.cookie);
    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (cookies.scholarscope_session) {
      revokedTokens.add(cookies.scholarscope_session);
      activeSessions.delete(cookies.scholarscope_session);
      await revokeSessionTokenInStorage(
        hashSessionToken(cookies.scholarscope_session),
        user?.id ?? null
      );
    }
    if (bearerToken) {
      revokedTokens.add(bearerToken);
      activeSessions.delete(bearerToken);
      await revokeSessionTokenInStorage(hashSessionToken(bearerToken), user?.id ?? null);
    }
    res.setHeader(
      'Set-Cookie',
      [
        `scholarscope_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`,
        `scholarscope_logged_out=1; Path=/; HttpOnly; SameSite=Lax`,
      ]
    );
    res.json({ ok: true });
  });

  app.delete('/api/auth/account', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const currentDb = loadDb();

    // Cascade delete all private user-owned records (Section 15)
    currentDb.users = currentDb.users.filter((u) => u.id !== user.id);
    currentDb.profiles = currentDb.profiles.filter((p) => p.userId !== user.id);
    currentDb.qualifications = currentDb.qualifications.filter((q) => q.userId !== user.id);
    currentDb.eligibilityResults = currentDb.eligibilityResults.filter((e) => e.userId !== user.id);
    currentDb.savedOpportunities = currentDb.savedOpportunities.filter((s) => s.userId !== user.id);
    currentDb.tasks = currentDb.tasks.filter((t) => t.userId !== user.id);
    currentDb.checklistItems = currentDb.checklistItems.filter((c) => c.userId !== user.id);
    currentDb.notifications = currentDb.notifications.filter((n) => n.userId !== user.id);
    currentDb.emailDeliveries = currentDb.emailDeliveries.filter((e) => e.userId !== user.id);

    appendAuditLog(currentDb, null, 'ACCOUNT_DELETED', 'USER', user.id, `Cascaded deletion of private records for user ${user.email}`);
    saveDb(currentDb);

    res.setHeader('Set-Cookie', `scholarscope_session=; Path=/; HttpOnly; Max-Age=0`);
    res.json({ ok: true });
  });

  // ==========================================================================
  // 2. Bootstrap Data Endpoint with Strict Row-Level User Isolation (Section 10 & 15)
  // ==========================================================================

  app.get('/api/bootstrap', (req: Request, res: Response) => {
    const currentDb = loadDb();
    const user = getAuthenticatedUser(req);

    if (!user) {
      res.json({
        authenticated: false,
        user: null,
        profile: null,
        qualifications: [],
        eligibilityResults: [],
        savedOpportunities: [],
        tasks: [],
        checklistItems: [],
        notifications: [],
        emailDeliveries: [],
        // Shared Public Research Database
        institutions: currentDb.institutions,
        departments: currentDb.departments,
        programs: currentDb.programs,
        scholarships: currentDb.scholarships,
        sources: currentDb.sources,
        claims: currentDb.claims,
        changeEvents: currentDb.changeEvents,
        systemHealth: currentDb.systemHealth,
        countryCoverage: computeCountryCoverageMetrics(currentDb),
        livingCostBenchmarks: Object.values(OFFICIAL_LIVING_COST_BENCHMARKS),
        fetchAttempts: [],
        snapshots: [],
        researchRuns: [],
        jobQueue: [],
        auditLogs: [],
      });
      return;
    }

    // Strictly isolate user-owned records by user.id
    const profile = currentDb.profiles.find((p) => p.userId === user.id) || null;
    const qualifications = currentDb.qualifications.filter((q) => q.userId === user.id);
    const eligibilityResults = currentDb.eligibilityResults.filter((e) => e.userId === user.id);
    const savedOpportunities = currentDb.savedOpportunities.filter((s) => s.userId === user.id);
    const tasks = currentDb.tasks.filter((t) => t.userId === user.id);
    const checklistItems = currentDb.checklistItems.filter((c) => c.userId === user.id);
    const notifications = currentDb.notifications.filter((n) => n.userId === user.id);
    const emailDeliveries = currentDb.emailDeliveries.filter((e) => e.userId === user.id);

    res.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        onboardingCompleted: user.onboardingCompleted,
        createdAt: user.createdAt,
      },
      // Private User-Owned Data
      profile,
      qualifications,
      eligibilityResults,
      savedOpportunities,
      tasks,
      checklistItems,
      notifications,
      emailDeliveries,
      // Shared Public Research Database
      institutions: currentDb.institutions,
      departments: currentDb.departments,
      programs: currentDb.programs,
      scholarships: currentDb.scholarships,
      sources: currentDb.sources,
      claims: currentDb.claims,
      changeEvents: currentDb.changeEvents,
      systemHealth: currentDb.systemHealth,
      countryCoverage: computeCountryCoverageMetrics(currentDb),
      livingCostBenchmarks: Object.values(OFFICIAL_LIVING_COST_BENCHMARKS),
      // Operational & Admin-only telemetry (strictly restricted to role === 'admin')
      fetchAttempts: user.role === 'admin' ? currentDb.fetchAttempts : [],
      snapshots: user.role === 'admin' ? currentDb.snapshots : [],
      researchRuns:
        user.role === 'admin'
          ? currentDb.researchRuns
          : currentDb.researchRuns.slice(0, 1).map((r) => ({
              ...r,
              summaryLog: [],
            })),
      jobQueue: user.role === 'admin' ? currentDb.jobQueue : [],
      auditLogs: user.role === 'admin' ? currentDb.auditLogs : [],
    });
  });

  // ==========================================================================
  // 3. Profile, Preferences & Qualifications Endpoints (Section 4)
  // ==========================================================================

  app.put('/api/profile', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const parsed = UserProfileInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid profile input',
        issues: parsed.error.issues,
      });
      return;
    }

    const currentDb = loadDb();
    const nowIso = new Date().toISOString();
    const existingIdx = currentDb.profiles.findIndex((p) => p.userId === user.id);

    const updatedProfile = {
      id: existingIdx >= 0 ? currentDb.profiles[existingIdx].id : `prof-${crypto.randomUUID()}`,
      userId: user.id,
      citizenship: parsed.data.citizenship ?? null,
      residencyCountry: parsed.data.residencyCountry ?? null,
      ageYears: parsed.data.ageYears ?? null,
      hecEquivalenceConfirmed: parsed.data.hecEquivalenceConfirmed ?? false,
      currentDegree: parsed.data.currentDegree ?? null,
      currentUniversity: parsed.data.currentUniversity ?? null,
      gpaValue: parsed.data.gpaValue ?? null,
      gradingScale: parsed.data.gradingScale ?? null,
      gradingClassification: parsed.data.gradingClassification ?? null,
      graduationDate: parsed.data.graduationDate ?? null,
      completedPrerequisites: parsed.data.completedPrerequisites,
      englishTestType: parsed.data.englishTestType ?? null,
      englishTestScore: parsed.data.englishTestScore ?? null,
      greVerbal: parsed.data.greVerbal ?? null,
      greQuant: parsed.data.greQuant ?? null,
      greWriting: parsed.data.greWriting ?? null,
      researchMonths: parsed.data.researchMonths,
      publicationsCount: parsed.data.publicationsCount,
      workExperienceMonths: parsed.data.workExperienceMonths,
      technicalSkills: parsed.data.technicalSkills,
      applicationBudgetUsd: parsed.data.applicationBudgetUsd ?? null,
      targetDegrees: parsed.data.targetDegrees,
      targetFields: parsed.data.targetFields,
      fundingPreferenceMode: parsed.data.fundingPreferenceMode ?? (parsed.data.requireFullFunding ? 'FULLY_FUNDED_ONLY' : 'ANY_FUNDING'),
      preferredCountries: parsed.data.preferredCountries,
      preferredUniversities: parsed.data.preferredUniversities,
      requireFullFunding: parsed.data.requireFullFunding,
      minAnnualLivingSupportUsd: parsed.data.minAnnualLivingSupportUsd ?? null,
      preferredIntakes: parsed.data.preferredIntakes,
      applicationCycles: parsed.data.applicationCycles,
      emailNotificationsEnabled: parsed.data.emailNotificationsEnabled,
      inAppNotificationsEnabled: parsed.data.inAppNotificationsEnabled,
      reminderDaysBeforeDeadline: parsed.data.reminderDaysBeforeDeadline,
      updatedAt: nowIso,
    };

    if (existingIdx >= 0) {
      currentDb.profiles[existingIdx] = updatedProfile;
    } else {
      currentDb.profiles.push(updatedProfile);
    }

    const usrRecord = currentDb.users.find((u) => u.id === user.id);
    if (usrRecord) {
      usrRecord.onboardingCompleted = true;
      usrRecord.updatedAt = nowIso;
    }

    // Immediately recalculate eligibility & rankings for all programs
    recalculateAllUserMatches(currentDb, new Date());
    appendAuditLog(
      currentDb,
      user.id,
      'PROFILE_UPDATED_AND_MATCHES_RECALCULATED',
      'PROFILE',
      updatedProfile.id,
      `Citizenship=${updatedProfile.citizenship}, GPA=${updatedProfile.gpaValue} (${updatedProfile.gradingScale})`
    );
    saveDb(currentDb);

    res.json({
      profile: updatedProfile,
      eligibilityResults: currentDb.eligibilityResults.filter((e) => e.userId === user.id),
    });
  });

  app.post('/api/profile/qualifications', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const { title, institution, category, details, completedDate } = req.body || {};
    if (!title || typeof title !== 'string' || !institution) {
      res.status(400).json({ error: 'Qualification title and institution are required.' });
      return;
    }
    const currentDb = loadDb();
    const rec = {
      id: `qual-${crypto.randomUUID()}`,
      userId: user.id,
      title: title.trim(),
      institution: String(institution).trim(),
      category: category || 'transcript',
      details: String(details || '').trim(),
      completedDate: completedDate || null,
      createdAt: new Date().toISOString(),
    };
    currentDb.qualifications.unshift(rec);
    saveDb(currentDb);
    res.status(201).json({ qualification: rec });
  });

  app.delete('/api/profile/qualifications/:id', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const currentDb = loadDb();
    const target = currentDb.qualifications.find((q) => q.id === req.params.id);
    if (!target || target.userId !== user.id) {
      res.status(404).json({ error: 'Qualification not found or access denied.' });
      return;
    }
    currentDb.qualifications = currentDb.qualifications.filter((q) => q.id !== req.params.id);
    saveDb(currentDb);
    res.json({ ok: true });
  });

  // ==========================================================================
  // 4. Saved Opportunities, Application Tracker, Tasks & Checklists (Section 13)
  // ==========================================================================

  app.post('/api/saved-opportunities', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const parsed = SavedOpportunityUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid input' });
      return;
    }

    const currentDb = loadDb();
    const program = currentDb.programs.find((p) => p.id === parsed.data.programId);
    if (!program) {
      res.status(404).json({ error: 'Program not found' });
      return;
    }

    const nowIso = new Date().toISOString();
    const existingIdx = currentDb.savedOpportunities.findIndex(
      (s) => s.userId === user.id && s.programId === parsed.data.programId
    );

    if (existingIdx >= 0) {
      const existing = currentDb.savedOpportunities[existingIdx];
      currentDb.savedOpportunities[existingIdx] = {
        ...existing,
        applicationStatus: parsed.data.applicationStatus ?? existing.applicationStatus,
        privateNotes:
          parsed.data.privateNotes !== undefined ? parsed.data.privateNotes : existing.privateNotes,
        priorityLevel: parsed.data.priorityLevel ?? existing.priorityLevel,
        updatedAt: nowIso,
      };
    } else {
      currentDb.savedOpportunities.unshift({
        id: `saved-${crypto.randomUUID()}`,
        userId: user.id,
        programId: program.id,
        applicationStatus: parsed.data.applicationStatus || 'Researching',
        privateNotes: parsed.data.privateNotes || '',
        priorityLevel: parsed.data.priorityLevel || 'HIGH',
        savedAt: nowIso,
        updatedAt: nowIso,
      });

      // Synchronize required documents into user's checklist without overwriting existing items
      for (const docName of program.requirement.requiredDocuments) {
        const existsDoc = currentDb.checklistItems.some(
          (c) =>
            c.userId === user.id &&
            c.programId === program.id &&
            c.documentName.toLowerCase() === docName.toLowerCase()
        );
        if (!existsDoc) {
          currentDb.checklistItems.push({
            id: `chk-${crypto.randomUUID()}`,
            userId: user.id,
            programId: program.id,
            documentName: docName,
            status: 'MISSING',
            sourceRequirement: `Synced from ${program.officialProgramUrl}`,
            userNotes: '',
            updatedAt: nowIso,
          });
        }
      }
    }

    saveDb(currentDb);
    res.json({
      savedOpportunities: currentDb.savedOpportunities.filter((s) => s.userId === user.id),
      checklistItems: currentDb.checklistItems.filter((c) => c.userId === user.id),
    });
  });

  app.delete('/api/saved-opportunities/:programId', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const currentDb = loadDb();
    currentDb.savedOpportunities = currentDb.savedOpportunities.filter(
      (s) => !(s.userId === user.id && s.programId === req.params.programId)
    );
    saveDb(currentDb);
    res.json({
      savedOpportunities: currentDb.savedOpportunities.filter((s) => s.userId === user.id),
    });
  });

  app.post('/api/tasks', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const parsed = TaskInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid task input' });
      return;
    }
    const currentDb = loadDb();
    const nowIso = new Date().toISOString();
    const newTask = {
      id: `tsk-${crypto.randomUUID()}`,
      userId: user.id,
      programId: parsed.data.programId || null,
      title: parsed.data.title.trim(),
      category: parsed.data.category,
      dueDate: parsed.data.dueDate || null,
      completed: false,
      syncedFromEvidence: false,
      userNotes: parsed.data.userNotes || '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    currentDb.tasks.unshift(newTask);
    saveDb(currentDb);
    res.status(201).json({ task: newTask, tasks: currentDb.tasks.filter((t) => t.userId === user.id) });
  });

  app.patch('/api/tasks/:id', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const currentDb = loadDb();
    const task = currentDb.tasks.find((t) => t.id === req.params.id);
    if (!task || task.userId !== user.id) {
      res.status(404).json({ error: 'Task not found or access denied' });
      return;
    }
    if (typeof req.body.completed === 'boolean') task.completed = req.body.completed;
    if (typeof req.body.userNotes === 'string') task.userNotes = req.body.userNotes;
    if (typeof req.body.title === 'string' && req.body.title.trim()) task.title = req.body.title.trim();
    task.updatedAt = new Date().toISOString();
    saveDb(currentDb);
    res.json({ task, tasks: currentDb.tasks.filter((t) => t.userId === user.id) });
  });

  app.delete('/api/tasks/:id', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const currentDb = loadDb();
    const task = currentDb.tasks.find((t) => t.id === req.params.id);
    if (!task || task.userId !== user.id) {
      res.status(404).json({ error: 'Task not found or access denied' });
      return;
    }
    currentDb.tasks = currentDb.tasks.filter((t) => t.id !== req.params.id);
    saveDb(currentDb);
    res.json({ tasks: currentDb.tasks.filter((t) => t.userId === user.id) });
  });

  app.post('/api/checklists', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const { programId, documentName, status, userNotes } = req.body || {};
    if (!documentName || typeof documentName !== 'string') {
      res.status(400).json({ error: 'Document name is required' });
      return;
    }
    const currentDb = loadDb();
    const item = {
      id: `chk-${crypto.randomUUID()}`,
      userId: user.id,
      programId: programId || null,
      documentName: documentName.trim(),
      status: status || 'MISSING',
      sourceRequirement: 'User-added checklist item',
      userNotes: userNotes || '',
      updatedAt: new Date().toISOString(),
    };
    currentDb.checklistItems.push(item);
    saveDb(currentDb);
    res.status(201).json({ checklistItems: currentDb.checklistItems.filter((c) => c.userId === user.id) });
  });

  app.patch('/api/checklists/:id', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const currentDb = loadDb();
    const item = currentDb.checklistItems.find((c) => c.id === req.params.id);
    if (!item || item.userId !== user.id) {
      res.status(404).json({ error: 'Checklist item not found or access denied' });
      return;
    }
    if (req.body.status) item.status = req.body.status;
    if (typeof req.body.userNotes === 'string') item.userNotes = req.body.userNotes;
    item.updatedAt = new Date().toISOString();
    saveDb(currentDb);
    res.json({ checklistItems: currentDb.checklistItems.filter((c) => c.userId === user.id) });
  });

  app.delete('/api/checklists/:id', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const currentDb = loadDb();
    const item = currentDb.checklistItems.find((c) => c.id === req.params.id);
    if (!item || item.userId !== user.id) {
      res.status(404).json({ error: 'Checklist item not found or access denied' });
      return;
    }
    currentDb.checklistItems = currentDb.checklistItems.filter((c) => c.id !== req.params.id);
    saveDb(currentDb);
    res.json({ checklistItems: currentDb.checklistItems.filter((c) => c.userId === user.id) });
  });

  // ==========================================================================
  // 5. Notifications & Resend Email Delivery Tracking (Section 12)
  // ==========================================================================

  app.post('/api/notifications/:id/read', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const currentDb = loadDb();
    const notif = currentDb.notifications.find((n) => n.id === req.params.id && n.userId === user.id);
    if (notif) {
      notif.read = true;
      saveDb(currentDb);
    }
    res.json({ notifications: currentDb.notifications.filter((n) => n.userId === user.id) });
  });

  app.post('/api/notifications/read-all', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const currentDb = loadDb();
    for (const n of currentDb.notifications) {
      if (n.userId === user.id) n.read = true;
    }
    saveDb(currentDb);
    res.json({ notifications: currentDb.notifications.filter((n) => n.userId === user.id) });
  });

  app.post('/api/notifications/dispatch-email', async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const currentDb = loadDb();
    const resendKey = process.env.RESEND_API_KEY?.trim();
    const subject = req.body?.subject || 'ScholarScope — Verified Graduate Opportunity Digest';
    const nowIso = new Date().toISOString();

    if (!resendKey) {
      // Honest delivery status: never claim an email was sent when RESEND_API_KEY is unconfigured
      const rec = {
        id: `eml-${crypto.randomUUID()}`,
        userId: user.id,
        notificationId: req.body?.notificationId || null,
        recipientEmail: user.email,
        subject,
        provider: 'RESEND' as const,
        status: 'SKIPPED_PROVIDER_UNCONFIGURED' as const,
        providerMsgId: null,
        errorMessage: 'RESEND_API_KEY is not configured in environment; persistent in-app notification used as fallback.',
        attempts: 1,
        createdAt: nowIso,
      };
      currentDb.emailDeliveries.unshift(rec);
      saveDb(currentDb);
      res.json({
        delivered: false,
        record: rec,
        emailDeliveries: currentDb.emailDeliveries.filter((e) => e.userId === user.id),
      });
      return;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'notifications@scholarscope.org',
          to: [user.email],
          subject,
          text: req.body?.bodyText || 'New verified scholarship updates are available in your ScholarScope workspace.',
        }),
      });
      const data: any = await response.json();
      const sentOk = response.ok && Boolean(data?.id);
      const rec = {
        id: `eml-${crypto.randomUUID()}`,
        userId: user.id,
        notificationId: req.body?.notificationId || null,
        recipientEmail: user.email,
        subject,
        provider: 'RESEND' as const,
        status: (sentOk ? 'SENT' : 'FAILED') as 'SENT' | 'FAILED',
        providerMsgId: data?.id || null,
        errorMessage: sentOk ? null : data?.message || `Resend returned HTTP ${response.status}`,
        attempts: 1,
        createdAt: nowIso,
      };
      currentDb.emailDeliveries.unshift(rec);
      saveDb(currentDb);
      res.json({
        delivered: sentOk,
        record: rec,
        emailDeliveries: currentDb.emailDeliveries.filter((e) => e.userId === user.id),
      });
    } catch (err: any) {
      const rec = {
        id: `eml-${crypto.randomUUID()}`,
        userId: user.id,
        notificationId: req.body?.notificationId || null,
        recipientEmail: user.email,
        subject,
        provider: 'RESEND' as const,
        status: 'FAILED' as const,
        providerMsgId: null,
        errorMessage: err?.message || 'Network error contacting Resend API',
        attempts: 1,
        createdAt: nowIso,
      };
      currentDb.emailDeliveries.unshift(rec);
      saveDb(currentDb);
      res.json({
        delivered: false,
        record: rec,
        emailDeliveries: currentDb.emailDeliveries.filter((e) => e.userId === user.id),
      });
    }
  });

  // ==========================================================================
  // 6. Secure Scheduled Cron Endpoint & Live Diagnostic Runner (Section 11, 14)
  // ==========================================================================

  const handleScheduledCronRequest = async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const cronHeader = req.headers['x-cron-secret'];
    const providedSecret =
      (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null) ||
      (typeof cronHeader === 'string' ? cronHeader.trim() : null);

    const isServerlessProd = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);
    if (isServerlessProd && !process.env.CRON_SECRET) {
      res.status(503).json({
        error: 'CRON_SECRET environment variable must be explicitly configured in serverless production.',
      });
      return;
    }

    if (!providedSecret || providedSecret !== CRON_SECRET) {
      const currentDb = loadDb();
      appendAuditLog(
        currentDb,
        null,
        'UNAUTHORIZED_CRON_ATTEMPT_REJECTED',
        'SCHEDULER',
        '/api/cron/daily-research',
        'Missing or invalid CRON_SECRET on scheduled endpoint'
      );
      saveDb(currentDb);
      res.status(401).json({
        error: 'Unauthorized scheduler request. Valid CRON_SECRET is required.',
      });
      return;
    }

    const currentDb = loadDb();
    const requestedMaxSources = Number(req.query.maxSources || req.body?.maxSources) || (isServerlessProd ? 10 : 25);
    const run = await executeAutonomousDiscoveryRun(
      currentDb,
      'SCHEDULED_CRON',
      Math.max(1, Math.min(requestedMaxSources, 25))
    );
    await flushPendingStorageWrites();
    res.json({ ok: true, run });
  };

  // Support both GET (Vercel Cron standard) and POST (manual/CLI scheduler invocation)
  app.get('/api/cron/daily-research', handleScheduledCronRequest);
  app.post('/api/cron/daily-research', handleScheduledCronRequest);

  app.post('/api/research/run', async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (user.role !== 'admin') {
      res.status(403).json({
        error: 'Administrator authorization required to execute live discovery runs.',
      });
      return;
    }
    const currentDb = loadDb();
    const maxSources = Math.min(Number(req.body?.maxSources) || 25, 30);
    const run = await executeAutonomousDiscoveryRun(currentDb, 'DIAGNOSTIC_RUN', maxSources);
    res.json({
      ok: true,
      run,
      systemHealth: currentDb.systemHealth,
      countryCoverage: computeCountryCoverageMetrics(currentDb),
    });
  });

  // ==========================================================================
  // 7. Administrative Controls & Source Registry Management (Section 14)
  // ==========================================================================

  app.get('/api/admin/console', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Administrator authorization required.' });
      return;
    }
    const currentDb = loadDb();
    res.json({
      sources: currentDb.sources,
      countryCoverage: computeCountryCoverageMetrics(currentDb),
      fetchAttempts: currentDb.fetchAttempts,
      snapshots: currentDb.snapshots,
      jobQueue: currentDb.jobQueue,
      researchRuns: currentDb.researchRuns,
      systemHealth: currentDb.systemHealth,
      auditLogs: currentDb.auditLogs,
    });
  });

  app.post('/api/admin/sources', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Administrator authorization required.' });
      return;
    }

    const parsed = SourceConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid source configuration' });
      return;
    }

    const ssrf = validateUrlAgainstSsrf(parsed.data.seedUrl);
    if (!ssrf.allowed) {
      res.status(400).json({ error: `SSRF Protection rejected source URL: ${ssrf.reason}` });
      return;
    }

    const currentDb = loadDb();
    const domain = new URL(parsed.data.seedUrl).hostname.toLowerCase();
    const nowIso = new Date().toISOString();

    const newSource = {
      id: `src-${crypto.randomUUID()}`,
      name: parsed.data.name.trim(),
      domain,
      seedUrl: parsed.data.seedUrl.trim(),
      category: parsed.data.category,
      country: parsed.data.country.trim(),
      authorityLevel: parsed.data.authorityLevel,
      refreshPolicy: parsed.data.refreshPolicy,
      rateLimitPerMinute: parsed.data.rateLimitPerMinute,
      maxConcurrency: parsed.data.maxConcurrency,
      enabled: true,
      robotsTxtAllowed: true,
      lastFetchedAt: null,
      lastHttpStatus: null,
      lastResponseTimeMs: null,
      consecutiveFailures: 0,
      isolatedUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    currentDb.sources.unshift(newSource);
    appendAuditLog(
      currentDb,
      user.id,
      'SOURCE_ADDED',
      'SOURCE_REGISTRY',
      newSource.id,
      `Added official source ${newSource.name} (${newSource.seedUrl})`
    );
    saveDb(currentDb);

    res.status(201).json({ source: newSource, sources: currentDb.sources });
  });

  app.patch('/api/admin/sources/:id', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Administrator authorization required.' });
      return;
    }
    const currentDb = loadDb();
    const src = currentDb.sources.find((s) => s.id === req.params.id);
    if (!src) {
      res.status(404).json({ error: 'Source not found' });
      return;
    }

    if (typeof req.body.enabled === 'boolean') src.enabled = req.body.enabled;
    if (req.body.refreshPolicy) src.refreshPolicy = req.body.refreshPolicy;
    if (req.body.priority && ['HIGH', 'NORMAL', 'LOW'].includes(req.body.priority)) {
      src.priority = req.body.priority;
    }
    if (typeof req.body.rateLimitPerMinute === 'number') src.rateLimitPerMinute = req.body.rateLimitPerMinute;
    if (req.body.clearIsolation === true) {
      src.isolatedUntil = null;
      src.consecutiveFailures = 0;
    }
    src.updatedAt = new Date().toISOString();

    appendAuditLog(
      currentDb,
      user.id,
      'SOURCE_CONFIG_UPDATED',
      'SOURCE_REGISTRY',
      src.id,
      `Updated source ${src.domain}: enabled=${src.enabled}, policy=${src.refreshPolicy}, priority=${src.priority || 'NORMAL'}`
    );
    saveDb(currentDb);
    res.json({ source: src, sources: currentDb.sources });
  });

  app.post('/api/admin/automation-state', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Administrator authorization required.' });
      return;
    }
    const { action } = req.body || {}; // "PAUSE" | "RESUME"
    const currentDb = loadDb();
    const nowIso = new Date().toISOString();

    if (action === 'PAUSE') {
      currentDb.systemHealth.automationState = 'Paused';
      currentDb.systemHealth.stateReason = `Manually paused by administrator (${user.email}) at ${nowIso}.`;
    } else if (action === 'RESUME') {
      currentDb.systemHealth.automationState = 'Active';
      currentDb.systemHealth.stateReason = `Resumed by administrator (${user.email}) at ${nowIso}.`;
    }
    currentDb.systemHealth.updatedAt = nowIso;

    appendAuditLog(
      currentDb,
      user.id,
      `AUTOMATION_${action}`,
      'SYSTEM_HEALTH',
      'singleton',
      currentDb.systemHealth.stateReason
    );
    saveDb(currentDb);
    res.json({ systemHealth: currentDb.systemHealth });
  });

  app.post('/api/admin/jobs/:id/retry', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Administrator authorization required.' });
      return;
    }
    const currentDb = loadDb();
    const job = currentDb.jobQueue.find((j) => j.id === req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const nowIso = new Date().toISOString();
    job.status = 'QUEUED';
    job.attempts = 0;
    job.leaseOwner = null;
    job.leaseExpiresAt = null;
    job.nextRunAt = nowIso;
    job.lastError = null;
    job.executionLog.push(`[${nowIso}] Manually reset & queued by admin ${user.email}`);
    job.updatedAt = nowIso;

    appendAuditLog(currentDb, user.id, 'JOB_MANUAL_RETRY', 'JOB_QUEUE', job.id, `Reset job ${job.idempotencyKey}`);
    saveDb(currentDb);
    res.json({ job, jobQueue: currentDb.jobQueue });
  });

  // ==========================================================================
  // 8. Optional Provider Interfaces: Google Search Grounding & High-Thinking
  //    (Disabled by default per Section 3 Provider Policy; configurable by Admin)
  // ==========================================================================

  app.post('/api/admin/providers', (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Administrator authorization required.' });
      return;
    }
    const currentDb = loadDb();
    if (typeof req.body.searchProviderEnabled === 'boolean') {
      currentDb.systemHealth.searchProviderEnabled = req.body.searchProviderEnabled;
    }
    if (typeof req.body.aiProviderEnabled === 'boolean') {
      currentDb.systemHealth.aiProviderEnabled = req.body.aiProviderEnabled;
    }
    currentDb.systemHealth.updatedAt = new Date().toISOString();
    appendAuditLog(
      currentDb,
      user.id,
      'PROVIDER_POLICY_UPDATED',
      'SYSTEM_HEALTH',
      'singleton',
      `searchProviderEnabled=${currentDb.systemHealth.searchProviderEnabled}, aiProviderEnabled=${currentDb.systemHealth.aiProviderEnabled}`
    );
    saveDb(currentDb);
    res.json({ systemHealth: currentDb.systemHealth });
  });

  // Search Grounding endpoint using gemini-3.8-flash with googleSearch tool
  app.post('/api/ai/search-grounding', async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const currentDb = loadDb();
    if (!currentDb.systemHealth.searchProviderEnabled) {
      res.status(403).json({
        error:
          'Optional Search Grounding Provider is disabled by default per Section 3 Provider Policy. Enable it in Admin & System Health to execute live Google Search grounded queries.',
      });
      return;
    }
    const query = String(req.body?.query || '').trim();
    if (!query) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured in server environment.',
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `You are ScholarScope's official-source research verifier. Search official university and scholarship portals for: "${query}". Summarize only verifiable facts (deadlines, stipends, tuition coverage, citizenship rules) and state clearly where information is unverified.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const groundingChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const citations = groundingChunks
        .map((c: any) => ({
          title: c.web?.title || 'Grounded Web Source',
          uri: c.web?.uri || '',
        }))
        .filter((c: any) => c.uri);

      res.json({
        model: 'gemini-3.8-flash',
        answer: response.text || 'No grounded response returned.',
        citations,
      });
    } catch (err: any) {
      res.status(500).json({
        error: `Search Grounding error: ${err?.message || 'Failed to query Gemini API'}`,
      });
    }
  });

  // High-Thinking complex evaluation endpoint using gemini-4-argon with ThinkingLevel.HIGH
  app.post('/api/ai/deep-evaluate', async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const currentDb = loadDb();
    if (!currentDb.systemHealth.aiProviderEnabled) {
      res.status(403).json({
        error:
          'Optional AI Reasoning Provider is disabled by default per Section 3 Provider Policy. Enable it in Admin & System Health to run High-Thinking evaluations.',
      });
      return;
    }
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) {
      res.status(400).json({ error: 'Evaluation query is required' });
      return;
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured in server environment.',
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      // Attempt gemini-4-argon with ThinkingLevel.HIGH (no maxOutputTokens) as specified
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-4-argon',
          contents: prompt,
          config: {
            systemInstruction:
              'You are ScholarScope Deep Academic Advisor. Never invent GPA conversions or guarantee admission. Distinguish verified requirements from uncertain criteria.',
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.HIGH,
            },
          },
        });
        res.json({
          model: 'gemini-4-argon',
          thinkingLevel: 'HIGH',
          analysis: response.text || '',
        });
      } catch {
        // Fallback to gemini-3.8-flash with ThinkingLevel.HIGH if paid key was declined
        const fallbackResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            systemInstruction:
              'You are ScholarScope Deep Academic Advisor. Never invent GPA conversions or guarantee admission. Distinguish verified requirements from uncertain criteria.',
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.HIGH,
            },
          },
        });
        res.json({
          model: 'gemini-3.8-flash (Fallback — Paid API key declined)',
          thinkingLevel: 'HIGH',
          analysis: fallbackResponse.text || '',
        });
      }
    } catch (err: any) {
      res.status(500).json({
        error: `High-Thinking Evaluation error: ${err?.message || 'Failed to query Gemini API'}`,
      });
    }
  });

  // ==========================================================================
  // Vite Middleware (Development) or Static Asset Serving (Production)
  // ==========================================================================
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL && !process.env.VERCEL_ENV) {
    const vitePkgName = 'vite';
    const { createServer: createViteServer } = await import(vitePkgName);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL && !process.env.VERCEL_ENV && process.env.NODE_ENV !== 'test') {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[ScholarScope] Full-stack server listening on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
