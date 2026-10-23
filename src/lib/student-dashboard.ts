import {
  ApplicationTaskRecord,
  DocumentChecklistItemRecord,
  EligibilityResultRecord,
  InstitutionRecord,
  MANDATORY_DESTINATION_COUNTRIES,
  ProgramRecord,
  ResearchRunRecord,
  SavedOpportunityRecord,
  ScholarshipRecord,
  SourceRegistryRecord,
  SystemHealthRecord,
  UserProfileRecord,
  UserQualificationRecord,
} from './types';
import { matchSubjectTaxonomy } from './eligibility-engine';

export type StudentPrimaryNavId = 'home' | 'explore' | 'journey' | 'profile' | 'admin';

export type JourneySectionId = 'saved' | 'tasks' | 'documents' | 'deadlines' | 'updates';

export type StudentEligibilityCategory =
  | 'ELIGIBLE'
  | 'POTENTIALLY_ELIGIBLE'
  | 'NOT_ELIGIBLE'
  | 'NOT_ASSESSED';

export type StudentDeadlineStatus =
  | 'CLOSING_SOON'
  | 'OPEN'
  | 'UNVERIFIED_OR_ROLLING'
  | 'CLOSED';

export interface ResolvedNavigationState {
  activeView: StudentPrimaryNavId;
  impliedSubject?: string;
  impliedCountry?: string;
  impliedJourneySection?: JourneySectionId;
  unauthorizedAdminAttempt: boolean;
}

/**
 * Resolves current or legacy `?view=` and `?country=` query parameters into the
 * simplified 4-item student navigation (`home`, `explore`, `journey`, `profile`)
 * or the protected administrator console (`admin`).
 */
export function resolveNavigationStateFromQuery(
  search: string,
  isAdmin: boolean
): ResolvedNavigationState {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const rawView = (params.get('view') || 'home').toLowerCase().trim();
  const countryParam = params.get('country')?.trim() || undefined;
  const fieldParam = params.get('field')?.trim() || undefined;

  if (rawView === 'admin' || rawView === 'governance' || rawView === 'sources' || rawView === 'jobs') {
    if (!isAdmin) {
      return {
        activeView: 'home',
        unauthorizedAdminAttempt: true,
      };
    }
    return {
      activeView: 'admin',
      unauthorizedAdminAttempt: false,
    };
  }

  if (rawView === 'profile') {
    return {
      activeView: 'profile',
      unauthorizedAdminAttempt: false,
    };
  }

  if (rawView === 'journey' || rawView === 'saved' || rawView === 'applications') {
    const section = (params.get('section') as JourneySectionId) || 'saved';
    return {
      activeView: 'journey',
      impliedJourneySection: section,
      unauthorizedAdminAttempt: false,
    };
  }

  if (rawView === 'calendar') {
    return {
      activeView: 'journey',
      impliedJourneySection: 'deadlines',
      unauthorizedAdminAttempt: false,
    };
  }

  if (rawView === 'notifications') {
    return {
      activeView: 'journey',
      impliedJourneySection: 'updates',
      unauthorizedAdminAttempt: false,
    };
  }

  if (rawView === 'cs') {
    return {
      activeView: 'explore',
      impliedSubject: 'Computer Science',
      impliedCountry: countryParam,
      unauthorizedAdminAttempt: false,
    };
  }

  if (rawView === 'microbiology') {
    return {
      activeView: 'explore',
      impliedSubject: 'Microbiology',
      impliedCountry: countryParam,
      unauthorizedAdminAttempt: false,
    };
  }

  if (rawView === 'countries') {
    return {
      activeView: 'explore',
      impliedCountry: countryParam || 'Germany',
      impliedSubject: fieldParam,
      unauthorizedAdminAttempt: false,
    };
  }

  if (rawView === 'explore' || rawView === 'discovery' || rawView === 'eligibility_funding') {
    return {
      activeView: 'explore',
      impliedCountry: countryParam,
      impliedSubject: fieldParam,
      unauthorizedAdminAttempt: false,
    };
  }

  return {
    activeView: 'home',
    unauthorizedAdminAttempt: false,
  };
}

export interface StudyDestinationInfo {
  destinationCountry: string;
  administeringCountry: string;
  institutionName: string;
  city: string | null;
  isCrossBorderAdministered: boolean;
}

/**
 * Resolves both the study destination country and the administering country for an opportunity.
 * Ensures binational programs (such as USEFP Fulbright administered in Pakistan for study in the United States)
 * are attributed to their study destination when students filter by destination country, while remaining
 * a single global program record.
 */
export function getProgramStudyDestination(
  program: ProgramRecord,
  institutions: InstitutionRecord[],
  scholarships: ScholarshipRecord[]
): StudyDestinationInfo {
  const inst = institutions.find((i) => i.id === program.institutionId);
  const linkedScholarships = scholarships.filter((s) => program.scholarshipIds.includes(s.id));
  const primaryScholarship = linkedScholarships[0];

  const administeringCountry = inst?.country || primaryScholarship?.country || 'International';
  let destinationCountry = administeringCountry;

  if (
    administeringCountry === 'Pakistan' &&
    primaryScholarship &&
    primaryScholarship.country &&
    primaryScholarship.country !== 'Pakistan'
  ) {
    destinationCountry = primaryScholarship.country;
  } else if (
    !inst?.country &&
    primaryScholarship?.country
  ) {
    destinationCountry = primaryScholarship.country;
  }

  return {
    destinationCountry,
    administeringCountry,
    institutionName: inst?.name || primaryScholarship?.awardingOrganization || 'Official Institution',
    city: inst?.city || null,
    isCrossBorderAdministered: destinationCountry !== administeringCountry,
  };
}

export interface StudentEligibilityPresentation {
  category: StudentEligibilityCategory;
  label: 'Eligible' | 'Potentially eligible' | 'Not eligible' | 'Not assessed';
  shortExplanation: string;
}

/**
 * Maps internal multi-output eligibility results into the 4 student-facing categories:
 * - "Eligible"
 * - "Potentially eligible"
 * - "Not eligible"
 * - "Not assessed"
 *
 * Never treats missing profile information or unverified source requirements as proof of ineligibility.
 */
export function mapStudentEligibilityCategory(
  program: ProgramRecord,
  eligibility: EligibilityResultRecord | undefined,
  profile: UserProfileRecord | null
): StudentEligibilityPresentation {
  if (program.verificationStatus === 'Unavailable') {
    return {
      category: 'NOT_ASSESSED',
      label: 'Not assessed',
      shortExplanation:
        'Official portal could not be reached automatically; check the university website directly.',
    };
  }

  const hasBasicProfile = Boolean(
    profile &&
      (profile.citizenship ||
        profile.gpaValue !== null ||
        profile.currentDegree ||
        profile.englishTestScore !== null)
  );

  if (!eligibility || !hasBasicProfile) {
    return {
      category: 'NOT_ASSESSED',
      label: 'Not assessed',
      shortExplanation:
        'Add your degree, GPA, and English score in My Profile to check your eligibility.',
    };
  }

  const isExplicitlyIneligible =
    eligibility.admissionStatus === 'Not Eligible' ||
    eligibility.scholarshipStatus === 'Not Eligible' ||
    eligibility.pakistaniEligibilityStatus === 'Ineligible based on an explicit requirement' ||
    eligibility.decisions.some((d) => d.result === 'Not Eligible');

  if (isExplicitlyIneligible) {
    const blockingDecision = eligibility.decisions.find((d) => d.result === 'Not Eligible');
    return {
      category: 'NOT_ELIGIBLE',
      label: 'Not eligible',
      shortExplanation: blockingDecision
        ? `Does not meet published ${blockingDecision.criterion.toLowerCase()} requirement (${blockingDecision.publishedRequirement}).`
        : 'Does not meet an explicit published admission or scholarship requirement.',
    };
  }

  const allConfirmedEligible =
    eligibility.admissionStatus === 'Likely Eligible' &&
    eligibility.scholarshipStatus === 'Likely Eligible' &&
    eligibility.pakistaniEligibilityStatus === 'Eligible based on available evidence';

  if (allConfirmedEligible) {
    return {
      category: 'ELIGIBLE',
      label: 'Eligible',
      shortExplanation:
        'Your profile meets the published citizenship, academic grade, and English language criteria.',
    };
  }

  const pendingDecision = eligibility.decisions.find(
    (d) =>
      d.result === 'Insufficient Information' ||
      d.result === 'Needs Verification' ||
      d.result === 'Potentially Eligible'
  );

  return {
    category: 'POTENTIALLY_ELIGIBLE',
    label: 'Potentially eligible',
    shortExplanation: pendingDecision?.missingInformation
      ? `Meets core criteria; confirm ${pendingDecision.missingInformation.toLowerCase()} on the official portal.`
      : pendingDecision?.nextRecommendedAction ||
        'Meets core criteria; review official equivalence or nomination details.',
  };
}

export interface StudentDeadlinePresentation {
  status: StudentDeadlineStatus;
  label: string;
  formattedDate: string;
  daysRemaining: number | null;
  isVerifiedDate: boolean;
}

export function mapDeadlineStatus(
  program: ProgramRecord,
  now: Date = new Date()
): StudentDeadlinePresentation {
  if (!program.deadlineDate || program.verificationStatus === 'Unavailable') {
    return {
      status: 'UNVERIFIED_OR_ROLLING',
      label:
        program.verificationStatus === 'Unavailable'
          ? 'Source unavailable — check official website'
          : 'Rolling or date not yet published',
      formattedDate: 'Check official portal',
      daysRemaining: null,
      isVerifiedDate: false,
    };
  }

  const parsedMs = new Date(program.deadlineDate).getTime();
  if (Number.isNaN(parsedMs)) {
    return {
      status: 'UNVERIFIED_OR_ROLLING',
      label: 'Rolling or date not yet published',
      formattedDate: 'Check official portal',
      daysRemaining: null,
      isVerifiedDate: false,
    };
  }

  const daysRemaining = Math.ceil((parsedMs - now.getTime()) / (1000 * 60 * 60 * 24));
  const datePart = program.deadlineDate.slice(0, 10);
  const isVerifiedDate =
    program.verificationStatus === 'Officially Confirmed' ||
    program.verificationStatus === 'Cross-Verified';

  if (daysRemaining < 0) {
    return {
      status: 'CLOSED',
      label: `Closed (${Math.abs(daysRemaining)} days ago)`,
      formattedDate: datePart,
      daysRemaining,
      isVerifiedDate,
    };
  }

  if (daysRemaining <= 60) {
    return {
      status: 'CLOSING_SOON',
      label: `${daysRemaining} days left`,
      formattedDate: datePart,
      daysRemaining,
      isVerifiedDate,
    };
  }

  return {
    status: 'OPEN',
    label: `${daysRemaining} days left`,
    formattedDate: datePart,
    daysRemaining,
    isVerifiedDate,
  };
}

export interface StudentVerificationPresentation {
  tier: 'CONFIRMED' | 'PARTIALLY_VERIFIED' | 'UNAVAILABLE';
  label: string;
  explanation: string;
}

export function mapStudentVerificationConfidence(
  program: ProgramRecord
): StudentVerificationPresentation {
  if (program.verificationStatus === 'Officially Confirmed') {
    return {
      tier: 'CONFIRMED',
      label: 'Verified from official source',
      explanation:
        'Key facts (funding, eligibility, and requirements) were extracted directly from the official university or scholarship portal.',
    };
  }
  if (program.verificationStatus === 'Cross-Verified') {
    return {
      tier: 'CONFIRMED',
      label: 'Cross-verified across official sources',
      explanation:
        'Confirmed independently across both university and scholarship authority pages.',
    };
  }
  if (program.verificationStatus === 'Unavailable') {
    return {
      tier: 'UNAVAILABLE',
      label: 'Official page temporarily unreachable',
      explanation:
        'The official website restricted automated access during the latest check. Do not rely on unverified claims; use the official link directly.',
    };
  }
  return {
    tier: 'PARTIALLY_VERIFIED',
    label: 'Official source — some details need confirmation',
    explanation:
      'Retrieved from an official portal, but some figures (such as next-cycle dates or exact stipend amounts) require checking the department handbook.',
  };
}

export interface StudentFundingPresentation {
  headline: string;
  plainSummary: string;
  isConfirmedFullFunding: boolean;
  tuitionText: string;
  stipendText: string;
  mandatoryFeesText: string;
  extrasText: string;
  benchmarkComparisonText: string | null;
}

export function mapStudentFundingSummary(
  program: ProgramRecord,
  scholarships: ScholarshipRecord[]
): StudentFundingPresentation {
  const linked = scholarships.filter((s) => program.scholarshipIds.includes(s.id));
  const primary = linked[0];
  const pkg = primary?.fundingPackage;

  const isConfirmedFullFunding =
    program.fundingClassification === 'Fully Funded — Confirmed' &&
    (program.verificationStatus === 'Officially Confirmed' ||
      program.verificationStatus === 'Cross-Verified');

  const tuitionText =
    pkg?.tuitionCoveragePercent === 100
      ? '100% tuition covered'
      : pkg?.tuitionCoveragePercent !== null && pkg?.tuitionCoveragePercent !== undefined
      ? `${pkg.tuitionCoveragePercent}% tuition covered`
      : program.fundingClassification.includes('Self-Funded')
      ? 'No scholarship tuition waiver linked'
      : 'Tuition coverage not explicitly stated on summary page';

  const stipendText =
    pkg?.stipendAmountAnnual !== null && pkg?.stipendAmountAnnual !== undefined && pkg.stipendAmountAnnual > 0
      ? `${pkg.stipendCurrency || ''} ${pkg.stipendAmountAnnual.toLocaleString()}/year living stipend${
          pkg.stipendAmountUsdApprox ? ` (~USD ${pkg.stipendAmountUsdApprox.toLocaleString()}/yr)` : ''
        }`
      : pkg?.stipendAmountAnnual === 0
      ? 'No living stipend ($0)'
      : 'Living stipend amount not stated on summary page';

  const mandatoryFeesText =
    pkg?.mandatoryFeesCovered === true
      ? 'Mandatory university fees covered'
      : pkg?.mandatoryFeesCovered === false
      ? 'Student pays mandatory semester/enrollment fees'
      : 'Mandatory fee coverage not explicitly stated';

  const extras: string[] = [];
  if (pkg?.healthInsuranceCovered) extras.push('Health insurance');
  if (pkg?.travelAllowanceCovered) extras.push('Airfare/travel allowance');
  if (pkg?.accommodationCovered) extras.push('University accommodation');
  if (pkg?.relocationSupportCovered) extras.push('Relocation support');
  const extrasText =
    extras.length > 0 ? `Includes: ${extras.join(', ')}` : 'Additional travel/housing benefits not listed';

  let benchmarkComparisonText: string | null = null;
  if (
    pkg?.livingCostBenchmarkAnnual !== null &&
    pkg?.livingCostBenchmarkAnnual !== undefined &&
    pkg?.livingCostBenchmarkCurr
  ) {
    const diff = pkg.livingCostSurplusOrDeficit;
    if (diff !== null && diff !== undefined) {
      const sign = diff >= 0 ? '+' : '';
      benchmarkComparisonText = `Official reference benchmark: ${pkg.livingCostBenchmarkCurr} ${pkg.livingCostBenchmarkAnnual.toLocaleString()}/yr (${pkg.livingCostBenchmarkSource || 'National standard'}) · Net difference: ${sign}${pkg.livingCostBenchmarkCurr} ${diff.toLocaleString()}/yr (${pkg.livingCostAdequacyStatus})`;
    } else {
      benchmarkComparisonText = `Official reference benchmark: ${pkg.livingCostBenchmarkCurr} ${pkg.livingCostBenchmarkAnnual.toLocaleString()}/yr (${pkg.livingCostBenchmarkSource || 'National standard'})`;
    }
  }

  let headline: string = program.fundingClassification;
  if (isConfirmedFullFunding) {
    headline = 'Confirmed Full Funding (Tuition + Living Stipend)';
  } else if (program.fundingClassification === 'Tuition Funded, Living Costs Uncertain') {
    headline = 'Tuition Covered — Living Stipend Unconfirmed';
  } else if (program.fundingClassification === 'Self-Funded / No Scholarship Found') {
    headline = 'Self-Funded Admission (No Linked Scholarship)';
  } else if (program.fundingClassification === 'Funding Unverified') {
    headline = 'Funding Details Unverified';
  }

  return {
    headline,
    plainSummary: `${tuitionText} · ${stipendText}`,
    isConfirmedFullFunding,
    tuitionText,
    stipendText,
    mandatoryFeesText,
    extrasText,
    benchmarkComparisonText,
  };
}

export interface HomeSummaryCardMetric {
  id: 'matchingPreferences' | 'verifiedFullFunding' | 'savedOpportunities' | 'upcomingDeadlines';
  title: string;
  value: number;
  definition: string;
}

export interface StudentHomeMetricsResult {
  matchingPreferences: HomeSummaryCardMetric;
  verifiedFullFunding: HomeSummaryCardMetric;
  savedOpportunities: HomeSummaryCardMetric;
  upcomingDeadlines: HomeSummaryCardMetric;
  matchingProgramIds: string[];
}

export function doesProgramMatchUserPreferences(
  program: ProgramRecord,
  profile: UserProfileRecord | null,
  institutions: InstitutionRecord[],
  scholarships: ScholarshipRecord[],
  eligibility: EligibilityResultRecord | undefined
): boolean {
  if (!program.isActive || program.isExpired || program.verificationStatus === 'Unavailable') {
    return false;
  }

  const eligCat = mapStudentEligibilityCategory(program, eligibility, profile);
  if (eligCat.category === 'NOT_ELIGIBLE') {
    return false;
  }

  if (!profile) {
    return true;
  }

  if (profile.targetFields && profile.targetFields.length > 0) {
    const subjMatch = matchSubjectTaxonomy(profile.targetFields, {
      title: program.title,
      discipline: program.discipline,
      broadField: program.broadField,
      specializations: program.specializations,
    });
    if (!subjMatch.matched) {
      return false;
    }
  }

  if (profile.targetDegrees && profile.targetDegrees.length > 0) {
    const normTargets = profile.targetDegrees.map((d) => d.toLowerCase());
    const progDeg = program.degreeLevel.toLowerCase();
    const degMatches = normTargets.some(
      (t) => progDeg.includes(t) || t.includes(progDeg)
    );
    if (!degMatches) {
      return false;
    }
  }

  if (profile.preferredCountries && profile.preferredCountries.length > 0) {
    const dest = getProgramStudyDestination(program, institutions, scholarships);
    const inPreferred = profile.preferredCountries.some(
      (c) =>
        c.toLowerCase() === dest.destinationCountry.toLowerCase() ||
        c.toLowerCase() === dest.administeringCountry.toLowerCase()
    );
    if (!inPreferred) {
      return false;
    }
  }

  const mode =
    profile.fundingPreferenceMode ||
    (profile.requireFullFunding ? 'FULLY_FUNDED_ONLY' : 'INCLUDE_SELF_FUNDED');

  if (mode === 'FULLY_FUNDED_ONLY') {
    if (program.fundingClassification !== 'Fully Funded — Confirmed') {
      return false;
    }
  } else if (mode === 'SUBSTANTIAL_FUNDING') {
    if (
      program.fundingClassification === 'Self-Funded' ||
      program.fundingClassification === 'Self-Funded / No Scholarship Found' ||
      program.fundingClassification === 'Funding Unverified'
    ) {
      return false;
    }
  } else if (mode === 'ANY_FUNDING') {
    if (
      program.fundingClassification === 'Self-Funded' ||
      program.fundingClassification === 'Self-Funded / No Scholarship Found'
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Computes the 4 student home summary cards from real database records with explicit definitions.
 */
export function computeStudentHomeMetrics(params: {
  programs: ProgramRecord[];
  institutions: InstitutionRecord[];
  scholarships: ScholarshipRecord[];
  eligibilityResults: EligibilityResultRecord[];
  savedOpportunities: SavedOpportunityRecord[];
  profile: UserProfileRecord | null;
  now?: Date;
}): StudentHomeMetricsResult {
  const {
    programs,
    institutions,
    scholarships,
    eligibilityResults,
    savedOpportunities,
    profile,
    now = new Date(),
  } = params;

  const matchingPrograms = programs.filter((p) => {
    const elig = eligibilityResults.find((e) => e.programId === p.id);
    return doesProgramMatchUserPreferences(p, profile, institutions, scholarships, elig);
  });

  const verifiedFullFundingPrograms = programs.filter(
    (p) =>
      p.fundingClassification === 'Fully Funded — Confirmed' &&
      (p.verificationStatus === 'Officially Confirmed' ||
        p.verificationStatus === 'Cross-Verified')
  );

  const upcomingDeadlinePrograms = programs.filter((p) => {
    const d = mapDeadlineStatus(p, now);
    return d.status === 'CLOSING_SOON' || d.status === 'OPEN';
  });

  const hasCustomPrefs = Boolean(
    profile &&
      ((profile.targetFields && profile.targetFields.length > 0) ||
        (profile.preferredCountries && profile.preferredCountries.length > 0))
  );

  return {
    matchingPreferences: {
      id: 'matchingPreferences',
      title: 'Opportunities matching my preferences',
      value: matchingPrograms.length,
      definition: hasCustomPrefs
        ? `Active, verified programs matching your selected fields (${
            profile?.targetFields.slice(0, 2).join(', ') || 'CS & Microbiology'
          }), degree levels, destination countries, and eligibility rules.`
        : 'Active programs open to international applicants that are not blocked by explicit eligibility rules.',
    },
    verifiedFullFunding: {
      id: 'verifiedFullFunding',
      title: 'Opportunities with verified full-funding information',
      value: verifiedFullFundingPrograms.length,
      definition:
        'Programs with officially confirmed 100% tuition coverage and an annual living stipend verified against national living-cost benchmarks.',
    },
    savedOpportunities: {
      id: 'savedOpportunities',
      title: 'Saved opportunities',
      value: savedOpportunities.length,
      definition:
        'Opportunities bookmarked in your personal application tracker (isolated to your account).',
    },
    upcomingDeadlines: {
      id: 'upcomingDeadlines',
      title: 'Upcoming deadlines',
      value: upcomingDeadlinePrograms.length,
      definition:
        'Verified opportunities with an explicit future closing date published on the official portal.',
    },
    matchingProgramIds: matchingPrograms.map((p) => p.id),
  };
}

export interface RecommendedOpportunityItem {
  program: ProgramRecord;
  destination: StudyDestinationInfo;
  eligibility: StudentEligibilityPresentation;
  funding: StudentFundingPresentation;
  deadline: StudentDeadlinePresentation;
  verification: StudentVerificationPresentation;
  rankScore: number;
  evidenceReasons: string[];
}

/**
 * Builds profile-matched recommendations with concise, evidence-based explanations of relevance.
 */
export function buildRecommendedOpportunities(params: {
  programs: ProgramRecord[];
  institutions: InstitutionRecord[];
  scholarships: ScholarshipRecord[];
  eligibilityResults: EligibilityResultRecord[];
  profile: UserProfileRecord | null;
  limit?: number;
  now?: Date;
}): RecommendedOpportunityItem[] {
  const {
    programs,
    institutions,
    scholarships,
    eligibilityResults,
    profile,
    limit = 6,
    now = new Date(),
  } = params;

  const candidates = programs
    .filter((p) => {
      if (!p.isActive || p.isExpired || p.verificationStatus === 'Unavailable') {
        return false;
      }
      const elig = eligibilityResults.find((e) => e.programId === p.id);
      const eligPres = mapStudentEligibilityCategory(p, elig, profile);
      if (eligPres.category === 'NOT_ELIGIBLE') {
        return false;
      }
      if (profile?.targetFields && profile.targetFields.length > 0) {
        const m = matchSubjectTaxonomy(profile.targetFields, {
          title: p.title,
          discipline: p.discipline,
          broadField: p.broadField,
          specializations: p.specializations,
        });
        if (!m.matched) return false;
      }
      return true;
    })
    .map((program) => {
      const elig = eligibilityResults.find((e) => e.programId === program.id);
      const destination = getProgramStudyDestination(program, institutions, scholarships);
      const eligibility = mapStudentEligibilityCategory(program, elig, profile);
      const funding = mapStudentFundingSummary(program, scholarships);
      const deadline = mapDeadlineStatus(program, now);
      const verification = mapStudentVerificationConfidence(program);
      const rankScore = elig?.overallRankScore ?? 0;

      const reasons: string[] = [];

      // 1. Field & specialization relevance
      if (profile?.targetFields && profile.targetFields.length > 0) {
        const m = matchSubjectTaxonomy(profile.targetFields, {
          title: program.title,
          discipline: program.discipline,
          broadField: program.broadField,
          specializations: program.specializations,
        });
        if (m.matchedSpecializations.length > 0) {
          reasons.push(
            `Matches your specialization interest in ${m.matchedSpecializations.slice(0, 2).join(' & ')}`
          );
        } else if (program.broadField) {
          reasons.push(`Matches your target field (${program.broadField})`);
        }
      } else if (program.broadField) {
        reasons.push(`Relevant to ${program.broadField} (${program.degreeLevel})`);
      }

      // 2. Funding evidence
      if (funding.isConfirmedFullFunding) {
        reasons.push(`Verified full funding: ${funding.tuitionText} plus ${funding.stipendText}`);
      } else {
        reasons.push(`Funding status: ${funding.headline} (${funding.tuitionText})`);
      }

      // 3. Pakistani citizenship & academic eligibility evidence
      if (elig) {
        const gradeRule = elig.decisions.find((d) =>
          d.criterion.toLowerCase().includes('grade') || d.criterion.toLowerCase().includes('gpa')
        );
        if (gradeRule && gradeRule.result === 'Likely Eligible') {
          reasons.push(
            `Your academic record (${gradeRule.profileValue}) meets the published requirement (${gradeRule.publishedRequirement})`
          );
        }
        if (elig.pakistaniEligibilityStatus === 'Eligible based on available evidence') {
          reasons.push('Explicitly open to Pakistani citizens based on official rules');
        } else if (
          elig.pakistaniEligibilityStatus ===
          'Potentially eligible — requirements need confirmation'
        ) {
          reasons.push('Open to international applicants; confirm country-specific nomination rules');
        }
      }

      // 4. Destination preference
      if (
        profile?.preferredCountries &&
        profile.preferredCountries.some(
          (c) => c.toLowerCase() === destination.destinationCountry.toLowerCase()
        )
      ) {
        reasons.push(`Located in your preferred study destination (${destination.destinationCountry})`);
      }

      return {
        program,
        destination,
        eligibility,
        funding,
        deadline,
        verification,
        rankScore,
        evidenceReasons: reasons.slice(0, 3),
      };
    })
    .sort((a, b) => {
      if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
      const aConfirmed = a.funding.isConfirmedFullFunding ? 1 : 0;
      const bConfirmed = b.funding.isConfirmedFullFunding ? 1 : 0;
      return bConfirmed - aConfirmed;
    });

  return candidates.slice(0, limit);
}

export interface StudentNextStepItem {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  targetView: StudentPrimaryNavId;
  targetJourneySection?: JourneySectionId;
  completed: boolean;
}

export function buildStudentNextSteps(params: {
  profile: UserProfileRecord | null;
  qualifications: UserQualificationRecord[];
  eligibilityResults: EligibilityResultRecord[];
  savedOpportunities: SavedOpportunityRecord[];
  tasks: ApplicationTaskRecord[];
  checklistItems: DocumentChecklistItemRecord[];
  programs: ProgramRecord[];
}): StudentNextStepItem[] {
  const {
    profile,
    qualifications,
    savedOpportunities,
    tasks,
    checklistItems,
  } = params;

  const isProfileComplete = Boolean(
    profile &&
      profile.citizenship &&
      profile.currentDegree &&
      profile.gpaValue !== null &&
      profile.gradingScale &&
      profile.englishTestType &&
      profile.targetFields.length > 0 &&
      profile.preferredCountries.length > 0
  );

  const incompleteTasks = tasks.filter((t) => !t.completed);
  const missingDocs = checklistItems.filter((c) => c.status === 'MISSING' || c.status === 'DRAFTING');

  const steps: StudentNextStepItem[] = [
    {
      id: 'step-profile',
      title: isProfileComplete
        ? 'Review your academic profile and grading scale'
        : 'Complete your academic profile for accurate eligibility checks',
      description: isProfileComplete
        ? `Your ${profile?.citizenship} citizenship, ${profile?.gpaValue}/${profile?.gradingScale} GPA, and ${profile?.englishTestType} details are active (${qualifications.length} qualifications logged).`
        : 'Add your degree, GPA scale, English test score, and target countries so ScholarScope can assess your eligibility without guesswork.',
      actionLabel: isProfileComplete ? 'Update My Profile' : 'Complete My Profile',
      targetView: 'profile',
      completed: isProfileComplete,
    },
    {
      id: 'step-explore',
      title: 'Compare verified full-funding opportunities',
      description:
        'Filter programs across Germany, the UK, the US, Japan, and China by Computer Science, Microbiology, and verified stipend coverage.',
      actionLabel: 'Explore Opportunities',
      targetView: 'explore',
      completed: savedOpportunities.length > 0,
    },
    {
      id: 'step-save',
      title:
        savedOpportunities.length > 0
          ? `Manage your ${savedOpportunities.length} saved ${
              savedOpportunities.length === 1 ? 'opportunity' : 'opportunities'
            }`
          : 'Save an opportunity to build your document checklist',
      description:
        savedOpportunities.length > 0
          ? `You have ${incompleteTasks.length} open tasks and ${missingDocs.length} documents in progress in My Journey.`
          : 'When you save a program, its required application documents are automatically added to your personal checklist.',
      actionLabel: savedOpportunities.length > 0 ? 'Open My Journey' : 'Browse & Save Programs',
      targetView: savedOpportunities.length > 0 ? 'journey' : 'explore',
      targetJourneySection: 'saved',
      completed: savedOpportunities.length > 0 && missingDocs.length === 0,
    },
  ];

  return steps;
}

export interface StudentAutomationNotice {
  shouldShowNotice: boolean;
  lastRunStateLabel: string;
  lastRunCompletedAt: string | null;
  sourceHealthStateLabel: string;
  headline: string;
  practicalImpact: string;
  unreachableSourceNames: string[];
}

/**
 * Separates the completion status of the latest discovery run from overall source/automation health.
 * Produces a concise, plain-language student notice without raw HTTP status codes.
 */
export function deriveStudentAutomationNotice(params: {
  systemHealth: SystemHealthRecord;
  latestRun: ResearchRunRecord | null;
  sources: SourceRegistryRecord[];
  programs: ProgramRecord[];
}): StudentAutomationNotice {
  const { systemHealth, latestRun, sources, programs } = params;

  const unavailablePrograms = programs.filter((p) => p.verificationStatus === 'Unavailable');
  const unreachableSources = sources.filter(
    (s) => s.enabled && s.lastHttpStatus !== null && s.lastHttpStatus !== 200
  );
  const unreachableNames =
    unreachableSources.length > 0
      ? unreachableSources.map((s) => s.name)
      : unavailablePrograms.map((p) => p.title);

  const lastRunCompletedAt =
    latestRun?.completedAt || systemHealth.lastSuccessfulRunAt || null;

  const lastRunStateLabel =
    latestRun?.status === 'COMPLETED' || latestRun?.status === 'DEGRADED'
      ? 'Latest scheduled check finished'
      : latestRun?.status === 'RUNNING'
      ? 'Source check in progress'
      : 'Scheduled check pending';

  if (systemHealth.automationState === 'Paused') {
    return {
      shouldShowNotice: true,
      lastRunStateLabel,
      lastRunCompletedAt,
      sourceHealthStateLabel: 'Automatic updates paused',
      headline: 'Automatic portal updates are currently paused',
      practicalImpact:
        'You can still browse all verified programs and official links below, but new changes on university websites will not be fetched until an administrator resumes daily checks.',
      unreachableSourceNames: unreachableNames,
    };
  }

  if (
    systemHealth.automationState === 'Degraded' ||
    systemHealth.automationState === 'Failed' ||
    unreachableNames.length > 0
  ) {
    const count = unreachableNames.length;
    const sampleNames = unreachableNames.slice(0, 2).join(' and ');
    const verifiedCount = programs.filter(
      (p) =>
        p.verificationStatus === 'Officially Confirmed' ||
        p.verificationStatus === 'Cross-Verified'
    ).length;

    return {
      shouldShowNotice: true,
      lastRunStateLabel,
      lastRunCompletedAt,
      sourceHealthStateLabel: `${count} official ${
        count === 1 ? 'portal' : 'portals'
      } temporarily unreachable`,
      headline: 'Most opportunities are up to date, with a few portals requiring direct check',
      practicalImpact: `Our latest scheduled check finished and verified ${verifiedCount} opportunities, but ${count} official ${
        count === 1 ? 'website' : 'websites'
      }${sampleNames ? ` (${sampleNames})` : ''} blocked automated access. Those listings are clearly marked as "Official page temporarily unreachable" so you can open their official links directly.`,
      unreachableSourceNames: unreachableNames,
    };
  }

  return {
    shouldShowNotice: false,
    lastRunStateLabel,
    lastRunCompletedAt,
    sourceHealthStateLabel: 'All monitored sources reachable',
    headline: 'All monitored scholarship portals are up to date',
    practicalImpact:
      'All configured university and scholarship sources responded normally during the most recent check.',
    unreachableSourceNames: [],
  };
}

export interface CatalogueFilterState {
  searchQuery: string;
  subject: string; // 'ALL' | 'Computer Science' | 'Microbiology' | 'Interdisciplinary (CS & Bio)'
  specialization: string; // 'ALL' or label from SUBJECT_TAXONOMY
  country: string; // 'ALL' or country name
  degreeLevel: string; // 'ALL' | 'PhD' | 'MSc' | 'MS' | 'MPhil'
  opportunityType: string; // 'ALL' or OpportunityType
  fundingCoverage: string; // 'ALL' | 'CONFIRMED_FULL_FUNDING' | 'TUITION_COVERED' | 'PARTIAL_OR_STIPEND' | 'SELF_FUNDED' | 'UNVERIFIED' | exact classification
  eligibilityStatus: string; // 'ALL' | 'ELIGIBLE' | 'POTENTIALLY_ELIGIBLE' | 'NOT_ELIGIBLE' | 'NOT_ASSESSED'
  deadlineStatus: string; // 'ALL' | 'CLOSING_SOON' | 'OPEN' | 'UNVERIFIED_OR_ROLLING' | 'CLOSED'
  verificationStatus: string; // 'ALL' | 'VERIFIED_ONLY' | 'Officially Confirmed' | 'Cross-Verified' | 'Official Source, Not Fully Verified' | 'Unavailable'
  sortBy: 'rank' | 'deadline' | 'stipend' | 'title';
}

export const DEFAULT_CATALOGUE_FILTERS: CatalogueFilterState = {
  searchQuery: '',
  subject: 'ALL',
  specialization: 'ALL',
  country: 'ALL',
  degreeLevel: 'ALL',
  opportunityType: 'ALL',
  fundingCoverage: 'ALL',
  eligibilityStatus: 'ALL',
  deadlineStatus: 'ALL',
  verificationStatus: 'ALL',
  sortBy: 'rank',
};

export function filterAndSortCataloguePrograms(
  programs: ProgramRecord[],
  filters: CatalogueFilterState,
  context: {
    institutions: InstitutionRecord[];
    scholarships: ScholarshipRecord[];
    eligibilityResults: EligibilityResultRecord[];
    profile: UserProfileRecord | null;
    now?: Date;
  }
): ProgramRecord[] {
  const { institutions, scholarships, eligibilityResults, profile, now = new Date() } = context;

  return programs
    .filter((prog) => {
      const dest = getProgramStudyDestination(prog, institutions, scholarships);
      const elig = eligibilityResults.find((e) => e.programId === prog.id);
      const linkedScholarships = scholarships.filter((s) => prog.scholarshipIds.includes(s.id));
      const primarySch = linkedScholarships[0];

      // 1. Subject filter (inclusive of Interdisciplinary when filtering by CS or Microbiology, or exact when Interdisciplinary selected)
      if (filters.subject !== 'ALL') {
        if (filters.subject === 'Computer Science') {
          if (
            prog.broadField !== 'Computer Science' &&
            prog.broadField !== 'Interdisciplinary (CS & Bio)'
          ) {
            return false;
          }
        } else if (filters.subject === 'Microbiology') {
          if (
            prog.broadField !== 'Microbiology' &&
            prog.broadField !== 'Interdisciplinary (CS & Bio)'
          ) {
            return false;
          }
        } else if (prog.broadField !== filters.subject) {
          return false;
        }
      }

      // 2. Specialization filter
      if (filters.specialization !== 'ALL') {
        const specs = prog.specializations || [];
        if (!specs.includes(filters.specialization)) {
          return false;
        }
      }

      // 3. Country filter (matches either study destination country or administering country)
      if (filters.country !== 'ALL') {
        const cLower = filters.country.toLowerCase();
        if (
          dest.destinationCountry.toLowerCase() !== cLower &&
          dest.administeringCountry.toLowerCase() !== cLower
        ) {
          return false;
        }
      }

      // 4. Degree level filter
      if (filters.degreeLevel !== 'ALL') {
        if (prog.degreeLevel.toLowerCase() !== filters.degreeLevel.toLowerCase()) {
          return false;
        }
      }

      // 5. Opportunity type filter
      if (filters.opportunityType !== 'ALL') {
        const pType = prog.opportunityType || primarySch?.opportunityType;
        if (pType !== filters.opportunityType) {
          return false;
        }
      }

      // 6. Funding coverage filter
      if (filters.fundingCoverage !== 'ALL') {
        if (filters.fundingCoverage === 'CONFIRMED_FULL_FUNDING') {
          if (prog.fundingClassification !== 'Fully Funded — Confirmed') return false;
        } else if (filters.fundingCoverage === 'TUITION_COVERED') {
          if (
            prog.fundingClassification !== 'Fully Funded — Confirmed' &&
            prog.fundingClassification !== 'Tuition Funded, Living Costs Uncertain' &&
            prog.fundingClassification !== 'Tuition Only'
          ) {
            return false;
          }
        } else if (filters.fundingCoverage === 'PARTIAL_OR_STIPEND') {
          if (
            prog.fundingClassification !== 'Tuition Funded, Living Costs Uncertain' &&
            prog.fundingClassification !== 'Partially Funded' &&
            prog.fundingClassification !== 'Partial Funding' &&
            prog.fundingClassification !== 'Stipend Only' &&
            prog.fundingClassification !== 'Tuition Only'
          ) {
            return false;
          }
        } else if (filters.fundingCoverage === 'SELF_FUNDED') {
          if (
            prog.fundingClassification !== 'Self-Funded' &&
            prog.fundingClassification !== 'Self-Funded / No Scholarship Found'
          ) {
            return false;
          }
        } else if (filters.fundingCoverage === 'UNVERIFIED') {
          if (prog.fundingClassification !== 'Funding Unverified') return false;
        } else if (prog.fundingClassification !== filters.fundingCoverage) {
          return false;
        }
      }

      // 7. Eligibility status filter
      if (filters.eligibilityStatus !== 'ALL') {
        const eligPres = mapStudentEligibilityCategory(prog, elig, profile);
        if (eligPres.category !== filters.eligibilityStatus) {
          return false;
        }
      }

      // 8. Deadline status filter
      if (filters.deadlineStatus !== 'ALL') {
        const dPres = mapDeadlineStatus(prog, now);
        if (dPres.status !== filters.deadlineStatus) {
          return false;
        }
      }

      // 9. Verification status filter
      if (filters.verificationStatus !== 'ALL') {
        if (filters.verificationStatus === 'VERIFIED_ONLY') {
          if (
            prog.verificationStatus !== 'Officially Confirmed' &&
            prog.verificationStatus !== 'Cross-Verified'
          ) {
            return false;
          }
        } else if (prog.verificationStatus !== filters.verificationStatus) {
          return false;
        }
      }

      // 10. Search query
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.trim().toLowerCase();
        const inTitle = prog.title.toLowerCase().includes(q);
        const inDisc = prog.discipline.toLowerCase().includes(q);
        const inBroad = (prog.broadField || '').toLowerCase().includes(q);
        const inInst = dest.institutionName.toLowerCase().includes(q);
        const inCountry =
          dest.destinationCountry.toLowerCase().includes(q) ||
          dest.administeringCountry.toLowerCase().includes(q);
        const inSpecs = (prog.specializations || []).some((s) => s.toLowerCase().includes(q));
        const inSch = linkedScholarships.some(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.awardingOrganization.toLowerCase().includes(q)
        );
        if (!inTitle && !inDisc && !inBroad && !inInst && !inCountry && !inSpecs && !inSch) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      if (filters.sortBy === 'rank') {
        const scoreA = eligibilityResults.find((e) => e.programId === a.id)?.overallRankScore ?? 0;
        const scoreB = eligibilityResults.find((e) => e.programId === b.id)?.overallRankScore ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
      }
      if (filters.sortBy === 'deadline') {
        const dA = a.deadlineDate ? new Date(a.deadlineDate).getTime() : Number.MAX_SAFE_INTEGER;
        const dB = b.deadlineDate ? new Date(b.deadlineDate).getTime() : Number.MAX_SAFE_INTEGER;
        return dA - dB;
      }
      if (filters.sortBy === 'stipend') {
        const sA =
          scholarships.find((s) => a.scholarshipIds.includes(s.id))?.fundingPackage
            ?.stipendAmountUsdApprox ?? 0;
        const sB =
          scholarships.find((s) => b.scholarshipIds.includes(s.id))?.fundingPackage
            ?.stipendAmountUsdApprox ?? 0;
        return sB - sA;
      }
      return a.title.localeCompare(b.title);
    });
}

export const OPPORTUNITY_TYPE_LABELS: Record<string, string> = {
  GOVERNMENT_SCHOLARSHIP: 'Government Scholarship',
  UNIVERSITY_SCHOLARSHIP: 'University Scholarship',
  FOUNDATION_FELLOWSHIP: 'Foundation / Trust Fellowship',
  RESEARCH_STUDENTSHIP: 'Doctoral Research Studentship',
  RA_TA_ASSISTANTSHIP: 'Graduate RA / TA Assistantship',
  PAID_RESEARCH_POSITION: 'Salaried Research Position',
  FELLOWSHIP_EXCHANGE: 'Research Exchange Fellowship',
  DEGREE_ADMISSION: 'Graduate Degree Admission',
  SELF_FUNDED_ADMISSION: 'Self-Funded Degree Admission',
};

export function formatOpportunityTypeLabel(type?: string | null): string {
  if (!type) return 'Graduate Program';
  return OPPORTUNITY_TYPE_LABELS[type] || type.replace(/_/g, ' ');
}

export function getAllAvailableDestinations(
  programs: ProgramRecord[],
  institutions: InstitutionRecord[],
  scholarships: ScholarshipRecord[]
): string[] {
  const set = new Set<string>(MANDATORY_DESTINATION_COUNTRIES);
  for (const p of programs) {
    const dest = getProgramStudyDestination(p, institutions, scholarships);
    if (dest.destinationCountry) set.add(dest.destinationCountry);
    if (dest.administeringCountry) set.add(dest.administeringCountry);
  }
  return Array.from(set);
}
