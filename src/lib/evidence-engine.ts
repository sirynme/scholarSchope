import crypto from 'node:crypto';
import { ClaimType, EvidenceClaimRecord, VerificationStatus } from './types';
import { computeSha256 } from './url-security';

// ============================================================================
// First-Class Evidence, Verification & Trust Engine (Section 7)
// ============================================================================

export interface RawClaimInput {
  programId?: string | null;
  scholarshipId?: string | null;
  claimType: ClaimType;
  fieldName: string;
  normalizedValue: string;
  supportingExcerpt: string;
  sourceUrl: string;
  sourceOrganization: string;
  authorityType: 'UNIVERSITY' | 'SCHOLARSHIP_ADMIN' | 'APPLICATION_PORTAL' | 'GOVERNMENT' | 'SECONDARY_AGGREGATOR';
  pageSection?: string | null;
  retrievedAt: string;
  httpStatus?: number | null;
  applicationCycle?: string | null;
  freshnessPolicy?: 'DAILY' | 'EVERY_3_DAYS' | 'WEEKLY' | 'MONTHLY';
}

/**
 * Normalizes an excerpt string for boilerplate/copy-paste comparison.
 */
export function normalizeExcerptForDedup(excerpt: string): string {
  return excerpt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether two excerpts are copied verbatim or near-verbatim announcements
 * (Jaccard token overlap >= 0.85 or identical normalized hash).
 * Section 7: "Two pages repeating the same copied announcement must not automatically count as independent confirmation."
 */
export function isCopiedAnnouncement(excerptA: string, excerptB: string): boolean {
  const normA = normalizeExcerptForDedup(excerptA);
  const normB = normalizeExcerptForDedup(excerptB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;

  const tokensA = new Set(normA.split(' ').filter((w) => w.length > 2));
  const tokensB = new Set(normB.split(' ').filter((w) => w.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) return false;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 && intersection / union >= 0.85;
}

/**
 * Validates whether the source authority is appropriate for the specific claim type.
 * Section 7: "Use the appropriate authority for each claim: university admissions pages for admission criteria,
 * scholarship administrators for award conditions, and official application portals for submission deadlines."
 */
export function hasAppropriateAuthorityForClaim(
  claimType: ClaimType,
  authorityType: RawClaimInput['authorityType']
): boolean {
  if (authorityType === 'SECONDARY_AGGREGATOR') return false;

  switch (claimType) {
    case 'MIN_GPA':
    case 'LANGUAGE_REQUIREMENT':
    case 'GRE_REQUIREMENT':
    case 'REQUIRED_DOCUMENTS':
    case 'APPLICATION_FEE':
    case 'DURATION':
      return authorityType === 'UNIVERSITY' || authorityType === 'APPLICATION_PORTAL';
    case 'PROGRAM_TITLE':
      return (
        authorityType === 'UNIVERSITY' ||
        authorityType === 'APPLICATION_PORTAL' ||
        authorityType === 'GOVERNMENT' ||
        authorityType === 'SCHOLARSHIP_ADMIN'
      );
    case 'TUITION_COVERAGE':
    case 'STIPEND_AMOUNT':
    case 'CITIZENSHIP_RULE':
    case 'AGE_LIMIT':
    case 'NOMINATION_PROCESS':
      return (
        authorityType === 'SCHOLARSHIP_ADMIN' ||
        authorityType === 'UNIVERSITY' ||
        authorityType === 'GOVERNMENT' ||
        authorityType === 'APPLICATION_PORTAL'
      );
    case 'DEADLINE':
      return (
        authorityType === 'APPLICATION_PORTAL' ||
        authorityType === 'UNIVERSITY' ||
        authorityType === 'SCHOLARSHIP_ADMIN' ||
        authorityType === 'GOVERNMENT'
      );
    default:
      return false;
  }
}

/**
 * Evaluates whether a claim is stale under its freshness policy relative to `now`.
 */
export function isClaimStale(
  retrievedAtIso: string,
  freshnessPolicy: 'DAILY' | 'EVERY_3_DAYS' | 'WEEKLY' | 'MONTHLY',
  now: Date = new Date()
): boolean {
  const retrievedMs = new Date(retrievedAtIso).getTime();
  if (Number.isNaN(retrievedMs)) return true;

  const ageHours = (now.getTime() - retrievedMs) / (1000 * 60 * 60);
  switch (freshnessPolicy) {
    case 'DAILY':
      return ageHours > 36; // 24h target + 12h grace
    case 'EVERY_3_DAYS':
      return ageHours > 84;
    case 'WEEKLY':
      return ageHours > 192; // 8 days
    case 'MONTHLY':
      return ageHours > 768; // 32 days
    default:
      return ageHours > 192;
  }
}

/**
 * Determines the initial verification status and deterministic quality score for an extracted claim.
 * Note: An HTTP 200 response or parser match alone does NOT prove factual correctness unless
 * the source has appropriate authority, non-empty supporting excerpt, and unambiguous normalized value.
 */
export function evaluateClaimVerification(
  input: RawClaimInput,
  now: Date = new Date()
): {
  verificationStatus: VerificationStatus;
  evidenceQualityScore: number;
} {
  if (input.httpStatus && (input.httpStatus >= 400 || input.httpStatus === 0)) {
    return { verificationStatus: 'Unavailable', evidenceQualityScore: 0 };
  }

  const excerpt = (input.supportingExcerpt || '').trim();
  const value = (input.normalizedValue || '').trim();

  if (
    !excerpt ||
    excerpt.length < 12 ||
    !value ||
    value.toUpperCase() === 'UNKNOWN' ||
    /skip to (main )?content/i.test(excerpt)
  ) {
    return { verificationStatus: 'Unverified', evidenceQualityScore: 0.2 };
  }

  const policy = input.freshnessPolicy || 'WEEKLY';
  if (isClaimStale(input.retrievedAt, policy, now)) {
    return { verificationStatus: 'Stale', evidenceQualityScore: 0.45 };
  }

  const hasAuthority = hasAppropriateAuthorityForClaim(input.claimType, input.authorityType);
  if (!hasAuthority) {
    return { verificationStatus: 'Unverified', evidenceQualityScore: 0.35 };
  }

  if (/\b(ambiguous|contradictory wording|unclear whether)\b/i.test(excerpt) || /\bambiguous\b/i.test(value)) {
    return { verificationStatus: 'Ambiguous', evidenceQualityScore: 0.5 };
  }

  // If a STIPEND_AMOUNT claim asserts a specific numeric amount, require the supporting excerpt to contain
  // a 3+ digit numeric figure; if the excerpt is only a homepage navigation header or overview banner without a number,
  // mark it as "Official Source, Not Fully Verified" rather than "Officially Confirmed".
  const requiresNumericEvidenceInExcerpt =
    input.claimType === 'STIPEND_AMOUNT' && /\b\d{4,}\b/.test(value.replace(/[,']/g, ''));
  const excerptHasNumericFigure = /\b\d[\d,']{2,}\b/.test(excerpt);

  const isNotFullyVerified =
    /\b(tba|tbd|to be announced|subject to change|approximate|provisional|check back|varies by department|directory overview)\b/i.test(
      excerpt
    ) ||
    /\b(uncertain|partial|not fully verified)\b/i.test(value) ||
    (requiresNumericEvidenceInExcerpt && !excerptHasNumericFigure);

  if (isNotFullyVerified) {
    return { verificationStatus: 'Official Source, Not Fully Verified', evidenceQualityScore: 0.65 };
  }

  return { verificationStatus: 'Officially Confirmed', evidenceQualityScore: 0.88 };
}

/**
 * Creates a structured EvidenceClaimRecord from a RawClaimInput.
 */
export function createEvidenceClaimRecord(input: RawClaimInput, now: Date = new Date()): EvidenceClaimRecord {
  let domain = 'unknown';
  try {
    domain = new URL(input.sourceUrl).hostname.toLowerCase();
  } catch {
    domain = 'invalid-url';
  }

  const { verificationStatus, evidenceQualityScore } = evaluateClaimVerification(input, now);
  const excerptHash = computeSha256(normalizeExcerptForDedup(input.supportingExcerpt));
  const id = crypto.randomUUID();

  return {
    id,
    programId: input.programId ?? null,
    scholarshipId: input.scholarshipId ?? null,
    claimType: input.claimType,
    fieldName: input.fieldName,
    normalizedValue: input.normalizedValue.trim(),
    supportingExcerpt: input.supportingExcerpt.trim(),
    excerptHash,
    sourceUrl: input.sourceUrl,
    sourceDomain: domain,
    sourceOrganization: input.sourceOrganization,
    pageSection: input.pageSection ?? null,
    retrievedAt: input.retrievedAt,
    extractedAt: now.toISOString(),
    lastContentChangeAt: input.retrievedAt,
    verificationMethod: 'AUTHORITATIVE_DOM_EXTRACTION',
    verificationStatus,
    evidenceQualityScore,
    applicationCycle: input.applicationCycle ?? null,
    freshnessPolicy: input.freshnessPolicy || 'WEEKLY',
    conflictingClaimIds: [],
    versions: [
      {
        id: crypto.randomUUID(),
        claimId: id,
        normalizedValue: input.normalizedValue.trim(),
        supportingExcerpt: input.supportingExcerpt.trim(),
        sourceUrl: input.sourceUrl,
        verificationStatus,
        observedAt: input.retrievedAt,
      },
    ],
  };
}

/**
 * Reconciles a new claim observation against existing claims for the same entity (programId/scholarshipId) and fieldName.
 * Enforces Section 7:
 * - Independent corroboration upgrades status to 'Cross-Verified' ONLY if from a distinct authoritative source/URL
 *   AND not a copied verbatim announcement.
 * - Conflicting values from authoritative sources are BOTH preserved and marked 'Conflicting Evidence'
 *   without overwriting the previous supported fact.
 */
export function reconcileClaimObservation(
  existingClaims: EvidenceClaimRecord[],
  incomingInput: RawClaimInput,
  now: Date = new Date()
): {
  updatedClaims: EvidenceClaimRecord[];
  newOrUpdatedClaim: EvidenceClaimRecord;
  outcome: 'CREATED' | 'REFRESHED_SAME_SOURCE' | 'CROSS_VERIFIED' | 'CONFLICT_DETECTED' | 'IGNORED_COPIED_TEXT';
} {
  const incomingClaim = createEvidenceClaimRecord(incomingInput, now);

  // Find claims targeting the same entity and field
  const matchingScopeClaims = existingClaims.filter(
    (c) =>
      c.programId === incomingClaim.programId &&
      c.scholarshipId === incomingClaim.scholarshipId &&
      c.claimType === incomingClaim.claimType &&
      c.fieldName === incomingClaim.fieldName
  );

  if (matchingScopeClaims.length === 0) {
    return {
      updatedClaims: [...existingClaims, incomingClaim],
      newOrUpdatedClaim: incomingClaim,
      outcome: 'CREATED',
    };
  }

  // Case 1: Same exact source URL being refreshed
  const sameSourceClaim = matchingScopeClaims.find((c) => c.sourceUrl === incomingClaim.sourceUrl);
  if (sameSourceClaim) {
    if (sameSourceClaim.normalizedValue === incomingClaim.normalizedValue) {
      const refreshed: EvidenceClaimRecord = {
        ...sameSourceClaim,
        retrievedAt: incomingClaim.retrievedAt,
        verificationStatus:
          sameSourceClaim.verificationStatus === 'Cross-Verified'
            ? 'Cross-Verified'
            : incomingClaim.verificationStatus,
      };
      return {
        updatedClaims: existingClaims.map((c) => (c.id === refreshed.id ? refreshed : c)),
        newOrUpdatedClaim: refreshed,
        outcome: 'REFRESHED_SAME_SOURCE',
      };
    } else {
      // Same official URL changed its own published value over time -> append version history
      const updatedWithHistory: EvidenceClaimRecord = {
        ...sameSourceClaim,
        normalizedValue: incomingClaim.normalizedValue,
        supportingExcerpt: incomingClaim.supportingExcerpt,
        excerptHash: incomingClaim.excerptHash,
        retrievedAt: incomingClaim.retrievedAt,
        lastContentChangeAt: incomingClaim.retrievedAt,
        verificationStatus: incomingClaim.verificationStatus,
        versions: [
          ...sameSourceClaim.versions,
          {
            id: crypto.randomUUID(),
            claimId: sameSourceClaim.id,
            normalizedValue: incomingClaim.normalizedValue,
            supportingExcerpt: incomingClaim.supportingExcerpt,
            sourceUrl: incomingClaim.sourceUrl,
            verificationStatus: incomingClaim.verificationStatus,
            observedAt: incomingClaim.retrievedAt,
          },
        ],
      };
      return {
        updatedClaims: existingClaims.map((c) => (c.id === updatedWithHistory.id ? updatedWithHistory : c)),
        newOrUpdatedClaim: updatedWithHistory,
        outcome: 'REFRESHED_SAME_SOURCE',
      };
    }
  }

  // Case 2: Different source URL for the same entity + field
  const primaryExisting = matchingScopeClaims[0];

  // Check if values agree
  if (primaryExisting.normalizedValue.toLowerCase() === incomingClaim.normalizedValue.toLowerCase()) {
    // Check if the incoming excerpt is just a copied announcement
    const copied = isCopiedAnnouncement(primaryExisting.supportingExcerpt, incomingClaim.supportingExcerpt);
    const bothAuthoritative =
      (primaryExisting.verificationStatus === 'Officially Confirmed' ||
        primaryExisting.verificationStatus === 'Cross-Verified') &&
      incomingClaim.verificationStatus === 'Officially Confirmed';

    if (copied || !bothAuthoritative) {
      // Do not upgrade to Cross-Verified if it's copied announcement text
      return {
        updatedClaims: [...existingClaims, incomingClaim],
        newOrUpdatedClaim: incomingClaim,
        outcome: 'IGNORED_COPIED_TEXT',
      };
    }

    // Independent corroboration confirmed! Upgrade both to Cross-Verified
    const upgradedExisting: EvidenceClaimRecord = {
      ...primaryExisting,
      verificationMethod: 'INDEPENDENT_CORROBORATION',
      verificationStatus: 'Cross-Verified',
      evidenceQualityScore: 0.98,
    };
    const upgradedIncoming: EvidenceClaimRecord = {
      ...incomingClaim,
      verificationMethod: 'INDEPENDENT_CORROBORATION',
      verificationStatus: 'Cross-Verified',
      evidenceQualityScore: 0.98,
    };

    return {
      updatedClaims: [
        ...existingClaims.map((c) => (c.id === upgradedExisting.id ? upgradedExisting : c)),
        upgradedIncoming,
      ],
      newOrUpdatedClaim: upgradedIncoming,
      outcome: 'CROSS_VERIFIED',
    };
  }

  // Case 3: Values disagree between two authoritative sources -> Preserve BOTH and mark Conflicting Evidence
  const conflictingIncoming: EvidenceClaimRecord = {
    ...incomingClaim,
    verificationStatus: 'Conflicting Evidence',
    evidenceQualityScore: 0.4,
    conflictingClaimIds: matchingScopeClaims.map((c) => c.id),
  };

  const updatedExistingList = existingClaims.map((c) => {
    if (matchingScopeClaims.some((m) => m.id === c.id)) {
      return {
        ...c,
        verificationStatus: 'Conflicting Evidence' as VerificationStatus,
        conflictingClaimIds: Array.from(new Set([...c.conflictingClaimIds, conflictingIncoming.id])),
      };
    }
    return c;
  });

  return {
    updatedClaims: [...updatedExistingList, conflictingIncoming],
    newOrUpdatedClaim: conflictingIncoming,
    outcome: 'CONFLICT_DETECTED',
  };
}
