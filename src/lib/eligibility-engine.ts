import {
  EligibilityResultRecord,
  EligibilityStatus,
  EvidenceClaimRecord,
  GradingScale,
  InstitutionRecord,
  PakistaniEligibilityStatus,
  ProgramRecord,
  RankingFactorBreakdown,
  RuleDecisionItem,
  ScholarshipRecord,
  SUBJECT_TAXONOMY,
  UserProfileRecord,
} from './types';

// ============================================================================
// Eligibility Evaluation & Explainable 9-Factor Ranking Engine (Section 9)
// ============================================================================

const UK_HONORS_ORDER: Record<string, number> = {
  'first class': 4,
  '1st': 4,
  'first-class': 4,
  '2:1': 3,
  'upper second': 3,
  'upper second-class': 3,
  '2:2': 2,
  'lower second': 2,
  'third': 1,
};

/**
 * Evaluates a user's GPA/Academic grade against a program's published requirement
 * WITHOUT applying an invented cross-scale GPA conversion (Section 4 & Section 9).
 */
export function evaluateAcademicGradeRule(
  profile: UserProfileRecord,
  program: ProgramRecord,
  gpaClaim?: EvidenceClaimRecord
): RuleDecisionItem {
  const req = program.requirement;
  const sourceExcerpt =
    gpaClaim?.supportingExcerpt ||
    (req.minGpa !== null || req.minGradingClassification
      ? `Published academic requirement: ${req.minGradingClassification || `${req.minGpa} on ${req.gradingScale} scale`}`
      : 'No explicit numeric GPA threshold extracted from official source.');
  const sourceUrl = gpaClaim?.sourceUrl || program.officialProgramUrl;
  const verStatus = gpaClaim?.verificationStatus || req.verificationStatus;

  // If program has no extracted GPA or classification requirement
  if (req.minGpa === null && !req.minGradingClassification) {
    return {
      criterion: 'Academic Standing / Minimum GPA',
      profileValue:
        profile.gpaValue !== null && profile.gradingScale
          ? `${profile.gpaValue} (${profile.gradingScale})`
          : profile.gradingClassification || 'Not provided in profile',
      publishedRequirement: 'Holistic academic review / no numeric cutoff published on indexed page',
      sourceEvidenceExcerpt: sourceExcerpt,
      sourceUrl,
      verificationStatus: verStatus,
      result: 'Needs Verification',
      missingInformation: 'Official department specific grade equivalency table',
      nextRecommendedAction: 'Verify country-specific minimum degree equivalency on the university admissions portal.',
    };
  }

  // If user has not entered their GPA or grading scale
  if (profile.gpaValue === null && !profile.gradingClassification) {
    return {
      criterion: 'Academic Standing / Minimum GPA',
      profileValue: 'Missing from user profile',
      publishedRequirement: req.minGradingClassification
        ? `${req.minGradingClassification} (${req.gradingScale || 'UK_HONORS'})`
        : `${req.minGpa} / ${req.gradingScale}`,
      sourceEvidenceExcerpt: sourceExcerpt,
      sourceUrl,
      verificationStatus: verStatus,
      result: 'Insufficient Information',
      missingInformation: 'User GPA value and grading scale in profile settings',
      nextRecommendedAction: 'Complete your GPA and grading scale in Profile & Preferences to evaluate academic standing.',
    };
  }

  // Case 1: Both use UK Honors or ECTS letter classification
  if (req.minGradingClassification && profile.gradingClassification) {
    const reqNorm = req.minGradingClassification.toLowerCase().trim();
    const userNorm = profile.gradingClassification.toLowerCase().trim();
    const reqRank = UK_HONORS_ORDER[reqNorm] ?? 0;
    const userRank = UK_HONORS_ORDER[userNorm] ?? 0;
    if (reqRank > 0 && userRank > 0) {
      const passed = userRank >= reqRank;
      return {
        criterion: 'Academic Standing / Minimum GPA',
        profileValue: `${profile.gradingClassification} (UK Honors)`,
        publishedRequirement: `${req.minGradingClassification} (UK Honors)`,
        sourceEvidenceExcerpt: sourceExcerpt,
        sourceUrl,
        verificationStatus: verStatus,
        result: passed ? 'Likely Eligible' : 'Not Eligible',
        missingInformation: null,
        nextRecommendedAction: passed
          ? 'Prepare official academic transcripts confirming honors classification.'
          : 'Check whether strong research publications or a Master’s distinction can offset undergraduate classification.',
      };
    }

    // ECTS Grade A-E comparison when both use ECTS
    const ectsOrder: Record<string, number> = {
      'grade a': 5,
      a: 5,
      'top 10%': 5,
      'grade b': 4,
      b: 4,
      'grade c': 3,
      c: 3,
      'grade d': 2,
      d: 2,
      'grade e': 1,
      e: 1,
    };
    const reqEcts = ectsOrder[reqNorm] ?? (reqNorm.includes('grade a') || reqNorm.includes('top 10%') ? 5 : 0);
    const userEcts = ectsOrder[userNorm] ?? 0;
    if (reqEcts > 0 && userEcts > 0 && (profile.gradingScale === 'ECTS' || req.gradingScale === 'ECTS')) {
      const passed = userEcts >= reqEcts;
      return {
        criterion: 'Academic Standing / Minimum GPA',
        profileValue: `${profile.gradingClassification} (ECTS)`,
        publishedRequirement: `${req.minGradingClassification} (ECTS)`,
        sourceEvidenceExcerpt: sourceExcerpt,
        sourceUrl,
        verificationStatus: verStatus,
        result: passed ? 'Likely Eligible' : 'Not Eligible',
        missingInformation: null,
        nextRecommendedAction: passed
          ? 'Include official Diploma Supplement or transcript showing ECTS cohort rank.'
          : 'Review whether departmental holistic review considers research output alongside ECTS rank.',
      };
    }
  }

  // Case 2: Same numeric grading scale (4.0, 5.0, 10.0, 100%, GERMAN_1_5, ECTS numeric, SWISS_6_0)
  if (
    req.minGpa !== null &&
    profile.gpaValue !== null &&
    req.gradingScale &&
    profile.gradingScale &&
    req.gradingScale === profile.gradingScale
  ) {
    // Note: German 1.0–5.0 scale is inverted (1.0 is highest, lower is better)
    const isGermanScale = req.gradingScale === 'GERMAN_1_5';
    const satisfied = isGermanScale ? profile.gpaValue <= req.minGpa : profile.gpaValue >= req.minGpa;

    return {
      criterion: 'Academic Standing / Minimum GPA',
      profileValue: `${profile.gpaValue} on ${profile.gradingScale} scale`,
      publishedRequirement: `${isGermanScale ? 'Max' : 'Min'} ${req.minGpa} on ${req.gradingScale} scale`,
      sourceEvidenceExcerpt: sourceExcerpt,
      sourceUrl,
      verificationStatus: verStatus,
      result: satisfied ? 'Likely Eligible' : 'Not Eligible',
      missingInformation: null,
      nextRecommendedAction: satisfied
        ? 'Ensure official transcript shows cumulative GPA on the stated scale.'
        : 'Review department exceptions or contact admissions regarding grade threshold.',
    };
  }

  // Case 3: Different grading scales — DO NOT apply an invented GPA conversion!
  return {
    criterion: 'Academic Standing / Minimum GPA',
    profileValue: `${profile.gpaValue ?? profile.gradingClassification} (${profile.gradingScale || 'Unstated scale'})`,
    publishedRequirement: `${req.minGpa ?? req.minGradingClassification} (${req.gradingScale || 'UK_HONORS'})`,
    sourceEvidenceExcerpt: sourceExcerpt,
    sourceUrl,
    verificationStatus: verStatus,
    result: 'Needs Verification',
    missingInformation: `Official institutional equivalency between ${profile.gradingScale || 'user scale'} and ${req.gradingScale || 'requirement scale'}`,
    nextRecommendedAction:
      'Do not rely on unofficial linear GPA conversion; check the university international qualification equivalency table for your country.',
  };
}

/**
 * Evaluates English language proficiency requirements.
 */
export function evaluateLanguageRule(
  profile: UserProfileRecord,
  program: ProgramRecord,
  langClaim?: EvidenceClaimRecord
): RuleDecisionItem {
  const req = program.requirement;
  const sourceExcerpt =
    langClaim?.supportingExcerpt ||
    (req.ieltsMinScore || req.toeflMinScore
      ? `Minimum IELTS ${req.ieltsMinScore ?? 'N/A'} / TOEFL iBT ${req.toeflMinScore ?? 'N/A'}`
      : 'English proficiency requirement published on university admissions page.');
  const sourceUrl = langClaim?.sourceUrl || program.officialProgramUrl;
  const verStatus = langClaim?.verificationStatus || req.verificationStatus;

  if (req.ieltsMinScore === null && req.toeflMinScore === null) {
    return {
      criterion: 'English Language Proficiency',
      profileValue: profile.englishTestType
        ? `${profile.englishTestType}${profile.englishTestScore ? `: ${profile.englishTestScore}` : ''}`
        : 'Not provided',
      publishedRequirement: 'Not explicitly extracted from indexed page',
      sourceEvidenceExcerpt: sourceExcerpt,
      sourceUrl,
      verificationStatus: verStatus,
      result: 'Needs Verification',
      missingInformation: 'Program-specific IELTS/TOEFL minimum score',
      nextRecommendedAction: 'Check official graduate admissions English language policy.',
    };
  }

  if (!profile.englishTestType || profile.englishTestType === 'NONE') {
    return {
      criterion: 'English Language Proficiency',
      profileValue: 'No English test recorded in profile',
      publishedRequirement: `IELTS >= ${req.ieltsMinScore ?? 'N/A'} or TOEFL iBT >= ${req.toeflMinScore ?? 'N/A'}`,
      sourceEvidenceExcerpt: sourceExcerpt,
      sourceUrl,
      verificationStatus: verStatus,
      result: 'Insufficient Information',
      missingInformation: 'IELTS, TOEFL iBT, or Native Exemption status in profile',
      nextRecommendedAction: 'Add your IELTS/TOEFL score or schedule a language exam before the application deadline.',
    };
  }

  if (profile.englishTestType === 'NATIVE_EXEMPT') {
    return {
      criterion: 'English Language Proficiency',
      profileValue: 'Native / Majority English-Speaking Degree Exemption',
      publishedRequirement: `IELTS >= ${req.ieltsMinScore ?? 'N/A'} or TOEFL iBT >= ${req.toeflMinScore ?? 'N/A'}`,
      sourceEvidenceExcerpt: sourceExcerpt,
      sourceUrl,
      verificationStatus: verStatus,
      result: 'Potentially Eligible',
      missingInformation: null,
      nextRecommendedAction: 'Verify that your undergraduate institution country is on the university official English waiver list.',
    };
  }

  if (profile.englishTestType === 'IELTS' && req.ieltsMinScore !== null) {
    if (profile.englishTestScore === null) {
      return {
        criterion: 'English Language Proficiency',
        profileValue: 'IELTS (score missing)',
        publishedRequirement: `IELTS >= ${req.ieltsMinScore}`,
        sourceEvidenceExcerpt: sourceExcerpt,
        sourceUrl,
        verificationStatus: verStatus,
        result: 'Insufficient Information',
        missingInformation: 'Numeric IELTS overall score',
        nextRecommendedAction: 'Enter your IELTS overall band score in Profile settings.',
      };
    }
    const ok = profile.englishTestScore >= req.ieltsMinScore;
    return {
      criterion: 'English Language Proficiency',
      profileValue: `IELTS ${profile.englishTestScore}`,
      publishedRequirement: `IELTS >= ${req.ieltsMinScore}`,
      sourceEvidenceExcerpt: sourceExcerpt,
      sourceUrl,
      verificationStatus: verStatus,
      result: ok ? 'Likely Eligible' : 'Not Eligible',
      missingInformation: null,
      nextRecommendedAction: ok
        ? 'Ensure test date is within the 2-year validity window at enrollment.'
        : `Retake IELTS to reach at least ${req.ieltsMinScore} overall.`,
    };
  }

  if (profile.englishTestType === 'TOEFL_IBT' && req.toeflMinScore !== null) {
    if (profile.englishTestScore === null) {
      return {
        criterion: 'English Language Proficiency',
        profileValue: 'TOEFL iBT (score missing)',
        publishedRequirement: `TOEFL iBT >= ${req.toeflMinScore}`,
        sourceEvidenceExcerpt: sourceExcerpt,
        sourceUrl,
        verificationStatus: verStatus,
        result: 'Insufficient Information',
        missingInformation: 'Numeric TOEFL iBT total score',
        nextRecommendedAction: 'Enter your TOEFL iBT score in Profile settings.',
      };
    }
    const ok = profile.englishTestScore >= req.toeflMinScore;
    return {
      criterion: 'English Language Proficiency',
      profileValue: `TOEFL iBT ${profile.englishTestScore}`,
      publishedRequirement: `TOEFL iBT >= ${req.toeflMinScore}`,
      sourceEvidenceExcerpt: sourceExcerpt,
      sourceUrl,
      verificationStatus: verStatus,
      result: ok ? 'Likely Eligible' : 'Not Eligible',
      missingInformation: null,
      nextRecommendedAction: ok
        ? 'Request official ETS score report transmission to the institution code.'
        : `Retake TOEFL iBT to reach at least ${req.toeflMinScore}.`,
    };
  }

  return {
    criterion: 'English Language Proficiency',
    profileValue: `${profile.englishTestType} ${profile.englishTestScore ?? ''}`,
    publishedRequirement: `IELTS >= ${req.ieltsMinScore ?? 'N/A'} or TOEFL iBT >= ${req.toeflMinScore ?? 'N/A'}`,
    sourceEvidenceExcerpt: sourceExcerpt,
    sourceUrl,
    verificationStatus: verStatus,
    result: 'Needs Verification',
    missingInformation: 'Corresponding score for published test type',
    nextRecommendedAction: 'Check accepted alternative English certificates on the admissions page.',
  };
}

/**
 * Matches user targetFields against program discipline, title, specializations, and SUBJECT_TAXONOMY keywords.
 * Never matches unrelated disciplines merely to inflate results.
 */
export function matchSubjectTaxonomy(
  targetFields: string[],
  program: Pick<ProgramRecord, 'title' | 'discipline' | 'broadField' | 'specializations'>
): { matched: boolean; matchedSpecializations: string[]; broadFieldMatch: boolean } {
  const userTargetsLower = targetFields.map((t) => t.toLowerCase().trim()).filter(Boolean);
  if (userTargetsLower.length === 0) {
    return { matched: false, matchedSpecializations: [], broadFieldMatch: false };
  }

  const progText = [
    program.title,
    program.discipline,
    program.broadField || '',
    ...(program.specializations || []),
  ]
    .join(' ')
    .toLowerCase();

  // Direct keyword match
  const directMatch = userTargetsLower.some((t) => progText.includes(t));

  // Taxonomy-based expansion for Computer Science, Microbiology, and Bioinformatics
  const matchedSpecs: string[] = [];
  let broadFieldMatch = false;

  const userWantsCS = userTargetsLower.some(
    (t) =>
      t.includes('computer science') ||
      t === 'cs' ||
      SUBJECT_TAXONOMY.some(
        (item) =>
          item.broadField === 'Computer Science' &&
          (item.label.toLowerCase().includes(t) || item.keywords.some((k) => k === t || t.includes(k)))
      )
  );

  const userWantsMicro = userTargetsLower.some(
    (t) =>
      t.includes('microbiology') ||
      SUBJECT_TAXONOMY.some(
        (item) =>
          item.broadField === 'Microbiology' &&
          (item.label.toLowerCase().includes(t) || item.keywords.some((k) => k === t || t.includes(k)))
      )
  );

  const userWantsInter = userTargetsLower.some(
    (t) =>
      t.includes('bioinformatics') ||
      t.includes('computational biology') ||
      t.includes('interdisciplinary')
  );

  for (const item of SUBJECT_TAXONOMY) {
    const progHasSpec =
      progText.includes(item.label.toLowerCase()) ||
      item.keywords.some((kw) => {
        if (kw.length <= 3) {
          const regex = new RegExp(`\\b${kw}\\b`, 'i');
          return regex.test(progText);
        }
        return progText.includes(kw.toLowerCase());
      });

    if (progHasSpec) {
      const relevantToUser =
        (item.broadField === 'Computer Science' && userWantsCS) ||
        (item.broadField === 'Microbiology' && userWantsMicro) ||
        (item.broadField === 'Interdisciplinary (CS & Bio)' && (userWantsCS || userWantsMicro || userWantsInter));

      if (relevantToUser) {
        matchedSpecs.push(item.label);
        broadFieldMatch = true;
      }
    }
  }

  return {
    matched: directMatch || matchedSpecs.length > 0,
    matchedSpecializations: matchedSpecs,
    broadFieldMatch: directMatch || broadFieldMatch,
  };
}

/**
 * Evaluates citizenship and residency eligibility for scholarships and programs.
 * Strict Phase 1 Rule: Never assume an opportunity is open to Pakistani students merely because it is labelled "international".
 */
export function evaluateCitizenshipRule(
  profile: UserProfileRecord,
  program: ProgramRecord,
  scholarships: ScholarshipRecord[],
  citClaim?: EvidenceClaimRecord
): RuleDecisionItem {
  const primaryScholarship = scholarships[0];
  const sourceUrl = citClaim?.sourceUrl || primaryScholarship?.officialUrl || program.officialProgramUrl;
  const sourceExcerpt =
    citClaim?.supportingExcerpt ||
    (primaryScholarship
      ? `Citizenship eligibility for ${primaryScholarship.name}: eligible=${primaryScholarship.eligibleCountries.join(', ')}; excluded=${
          primaryScholarship.excludedCitizenships.join(', ') || 'None'
        }`
      : program.requirement.citizenshipRule
      ? `Published citizenship rule: ${program.requirement.citizenshipRule}`
      : 'No explicit nationality restriction extracted; applicant must verify country-specific eligibility.');
  const verStatus = citClaim?.verificationStatus || primaryScholarship?.verificationStatus || program.verificationStatus;

  if (!profile.citizenship || !profile.citizenship.trim()) {
    return {
      criterion: 'Citizenship & Nationality Eligibility',
      profileValue: 'Missing from user profile',
      publishedRequirement: primaryScholarship
        ? `Eligible: ${primaryScholarship.eligibleCountries.join(', ')}${
            primaryScholarship.excludedCitizenships.length
              ? ` (Excludes: ${primaryScholarship.excludedCitizenships.join(', ')})`
              : ''
          }`
        : program.requirement.citizenshipRule || 'Unverified nationality rule',
      sourceEvidenceExcerpt: sourceExcerpt,
      sourceUrl,
      verificationStatus: verStatus,
      result: 'Insufficient Information',
      missingInformation: 'Applicant country of citizenship',
      nextRecommendedAction: 'Select your country of citizenship (e.g., Pakistan) in Profile & Preferences.',
    };
  }

  const userCit = profile.citizenship.trim().toLowerCase();
  const excluded = [
    ...(program.requirement.excludedCitizenships || []),
    ...(primaryScholarship?.excludedCitizenships || []),
  ].map((c) => c.toLowerCase());

  if (excluded.includes(userCit)) {
    return {
      criterion: 'Citizenship & Nationality Eligibility',
      profileValue: profile.citizenship,
      publishedRequirement: `Excludes citizens of: ${excluded.join(', ').toUpperCase()}`,
      sourceEvidenceExcerpt: sourceExcerpt,
      sourceUrl,
      verificationStatus: verStatus,
      result: 'Not Eligible',
      missingInformation: null,
      nextRecommendedAction:
        'You are excluded from this specific award by citizenship; explore unrestricted institutional fellowships or Pakistani government/bilateral awards.',
    };
  }

  // Check residency restriction if specified (e.g. Fulbright Pakistan requires residing in Pakistan)
  if (
    program.requirement.residencyRule &&
    program.requirement.residencyRule.toLowerCase().includes('residing in pakistan') &&
    profile.residencyCountry &&
    profile.residencyCountry.trim().toLowerCase() !== 'pakistan'
  ) {
    return {
      criterion: 'Citizenship & Residency Eligibility',
      profileValue: `Citizen of ${profile.citizenship} (Residing in ${profile.residencyCountry})`,
      publishedRequirement: program.requirement.residencyRule,
      sourceEvidenceExcerpt: sourceExcerpt,
      sourceUrl,
      verificationStatus: verStatus,
      result: 'Not Eligible',
      missingInformation: null,
      nextRecommendedAction: 'This award requires permanent residency and physical presence in Pakistan throughout the selection cycle.',
    };
  }

  if (primaryScholarship && primaryScholarship.eligibleCountries.length > 0) {
    const eligLower = primaryScholarship.eligibleCountries.map((c) => c.toLowerCase());
    const explicitlyListsUserCountry = eligLower.includes(userCit);
    const explicitlyListsCommonwealthForPakistan =
      userCit === 'pakistan' &&
      eligLower.some((c) => c.includes('commonwealth') || c.includes('pakistan'));
    const allowsAllNationalitiesExplicitly =
      eligLower.includes('all_international') ||
      eligLower.includes('all nationalities') ||
      eligLower.includes('any country outside the united kingdom');
    const vagueInternationalOnly =
      eligLower.includes('international students') ||
      eligLower.includes('international');

    if (
      !explicitlyListsUserCountry &&
      !explicitlyListsCommonwealthForPakistan &&
      !allowsAllNationalitiesExplicitly &&
      !vagueInternationalOnly
    ) {
      return {
        criterion: 'Citizenship & Nationality Eligibility',
        profileValue: profile.citizenship,
        publishedRequirement: `Restricted to citizens of: ${primaryScholarship.eligibleCountries.join(', ')}`,
        sourceEvidenceExcerpt: sourceExcerpt,
        sourceUrl,
        verificationStatus: verStatus,
        result: 'Not Eligible',
        missingInformation: null,
        nextRecommendedAction: 'Filter opportunities by your citizenship to view awards open to your nationality.',
      };
    }

    // Never assume generic "International Students" automatically confirms Pakistani scholarship eligibility without country list confirmation
    if (vagueInternationalOnly && !explicitlyListsUserCountry && !allowsAllNationalitiesExplicitly) {
      return {
        criterion: 'Citizenship & Nationality Eligibility',
        profileValue: profile.citizenship,
        publishedRequirement: `Published as generic "${primaryScholarship.eligibleCountries.join(', ')}" — country-specific eligibility list requires confirmation`,
        sourceEvidenceExcerpt: sourceExcerpt,
        sourceUrl,
        verificationStatus: verStatus,
        result: 'Potentially Eligible',
        missingInformation: `Explicit confirmation that citizens of ${profile.citizenship} are eligible under the international quota`,
        nextRecommendedAction: 'Check the official eligible-country annex on the provider portal before applying.',
      };
    }

    // If nomination agency is required (e.g. HEC Pakistan nomination for Commonwealth)
    if (primaryScholarship.nominationProcessNote) {
      return {
        criterion: 'Citizenship & National Nomination Eligibility',
        profileValue: `${profile.citizenship}${profile.residencyCountry ? ` (Residing in ${profile.residencyCountry})` : ''}`,
        publishedRequirement: `Open to ${primaryScholarship.eligibleCountries.join(', ')} — ${primaryScholarship.nominationProcessNote}`,
        sourceEvidenceExcerpt: sourceExcerpt,
        sourceUrl,
        verificationStatus: verStatus,
        result: 'Likely Eligible',
        missingInformation: null,
        nextRecommendedAction: primaryScholarship.nominationProcessNote,
      };
    }
  } else if (!primaryScholarship) {
    // Admission program without an attached scholarship
    const citRule = (program.requirement.citizenshipRule || '').toLowerCase();
    if (!citRule || citRule === 'unknown') {
      return {
        criterion: 'Citizenship & Nationality Eligibility',
        profileValue: profile.citizenship,
        publishedRequirement: 'Nationality rule not explicitly stated on indexed page',
        sourceEvidenceExcerpt: sourceExcerpt,
        sourceUrl,
        verificationStatus: verStatus,
        result: 'Potentially Eligible',
        missingInformation: 'Explicit international/Pakistani applicant policy',
        nextRecommendedAction: 'Verify international admission and visa sponsorship rules on the department website.',
      };
    }
  }

  return {
    criterion: 'Citizenship & Nationality Eligibility',
    profileValue: profile.citizenship,
    publishedRequirement: primaryScholarship
      ? `Open to ${primaryScholarship.eligibleCountries.join(', ')}${
          primaryScholarship.excludedCitizenships.length
            ? ` (excluding ${primaryScholarship.excludedCitizenships.join(', ')})`
            : ''
        }`
      : program.requirement.citizenshipRule || 'Open to all nationalities',
    sourceEvidenceExcerpt: sourceExcerpt,
    sourceUrl,
    verificationStatus: verStatus,
    result: 'Likely Eligible',
    missingInformation: null,
    nextRecommendedAction: 'Ensure passport validity extends at least 6 months beyond program start date.',
  };
}

/**
 * Evaluates age limit requirements when published (e.g., MEXT Japan under 35 years).
 */
export function evaluateAgeRule(
  profile: UserProfileRecord,
  program: ProgramRecord,
  ageClaim?: EvidenceClaimRecord
): RuleDecisionItem | null {
  const maxAge = program.requirement.maxAgeLimit;
  if (maxAge === undefined || maxAge === null) return null;

  const sourceUrl = ageClaim?.sourceUrl || program.officialProgramUrl;
  const sourceExcerpt =
    ageClaim?.supportingExcerpt || `Published maximum age limit: under ${maxAge} years of age at time of application/enrollment.`;
  const verStatus = ageClaim?.verificationStatus || program.verificationStatus;

  if (profile.ageYears === undefined || profile.ageYears === null) {
    return {
      criterion: 'Age Limit Requirement',
      profileValue: 'Age not specified in profile',
      publishedRequirement: `Under ${maxAge} years of age`,
      sourceEvidenceExcerpt: sourceExcerpt,
      sourceUrl,
      verificationStatus: verStatus,
      result: 'Potentially Eligible',
      missingInformation: 'Applicant age / date of birth in Profile settings',
      nextRecommendedAction: `Confirm you are under ${maxAge} years of age by the official cohort cutoff date.`,
    };
  }

  const eligible = profile.ageYears < maxAge;
  return {
    criterion: 'Age Limit Requirement',
    profileValue: `${profile.ageYears} years old`,
    publishedRequirement: `Under ${maxAge} years of age`,
    sourceEvidenceExcerpt: sourceExcerpt,
    sourceUrl,
    verificationStatus: verStatus,
    result: eligible ? 'Likely Eligible' : 'Not Eligible',
    missingInformation: null,
    nextRecommendedAction: eligible
      ? 'Age requirement is satisfied based on your profile.'
      : `Applicant exceeds the strict maximum age limit (${maxAge} years) for this scholarship.`,
  };
}

/**
 * Computes the explicit 4-state Pakistani Applicant Eligibility outcome required by Phase 1 Scope (Section 4).
 */
export function derivePakistaniEligibilityStatus(
  citizenshipDecision: RuleDecisionItem,
  admissionStatus: EligibilityStatus,
  ageDecision: RuleDecisionItem | null
): PakistaniEligibilityStatus {
  if (
    citizenshipDecision.result === 'Not Eligible' ||
    admissionStatus === 'Not Eligible' ||
    ageDecision?.result === 'Not Eligible'
  ) {
    return 'Ineligible based on an explicit requirement';
  }
  if (
    citizenshipDecision.result === 'Insufficient Information' ||
    citizenshipDecision.verificationStatus === 'Unverified' ||
    citizenshipDecision.verificationStatus === 'Unavailable'
  ) {
    return 'Insufficient Information / Unknown';
  }
  if (
    citizenshipDecision.result === 'Potentially Eligible' ||
    citizenshipDecision.result === 'Needs Verification' ||
    admissionStatus === 'Needs Verification' ||
    admissionStatus === 'Insufficient Information' ||
    ageDecision?.result === 'Potentially Eligible'
  ) {
    return 'Potentially eligible — requirements need confirmation';
  }
  return 'Eligible based on available evidence';
}

/**
 * Combines rule decisions into an aggregate EligibilityStatus without treating missing/unresolved fields as satisfied.
 */
export function aggregateEligibilityStatus(decisions: RuleDecisionItem[]): EligibilityStatus {
  if (decisions.length === 0) return 'Needs Verification';
  if (decisions.some((d) => d.result === 'Not Eligible')) return 'Not Eligible';
  if (decisions.some((d) => d.result === 'Insufficient Information')) return 'Insufficient Information';
  if (decisions.some((d) => d.result === 'Needs Verification')) return 'Needs Verification';
  if (decisions.some((d) => d.result === 'Potentially Eligible')) return 'Potentially Eligible';
  return 'Likely Eligible';
}

/**
 * Full Eligibility & Explainable 9-Factor Ranking Evaluation for a (User, Program) pair.
 */
export function evaluateProgramForUser(
  profile: UserProfileRecord,
  program: ProgramRecord,
  institution: InstitutionRecord | undefined,
  scholarships: ScholarshipRecord[],
  claims: EvidenceClaimRecord[],
  now: Date = new Date()
): EligibilityResultRecord {
  const gpaClaim = claims.find((c) => c.claimType === 'MIN_GPA');
  const langClaim = claims.find((c) => c.claimType === 'LANGUAGE_REQUIREMENT');
  const citClaim = claims.find((c) => c.claimType === 'CITIZENSHIP_RULE');
  const ageClaim = claims.find((c) => c.claimType === 'AGE_LIMIT');
  const fundClaim = claims.find((c) => c.claimType === 'STIPEND_AMOUNT' || c.claimType === 'TUITION_COVERAGE');

  const academicDecision = evaluateAcademicGradeRule(profile, program, gpaClaim);
  const languageDecision = evaluateLanguageRule(profile, program, langClaim);
  const citizenshipDecision = evaluateCitizenshipRule(profile, program, scholarships, citClaim);
  const ageDecision = evaluateAgeRule(profile, program, ageClaim);

  // Application Fee Budget rule
  let budgetDecision: RuleDecisionItem | null = null;
  if (program.applicationFeeAmount !== null && program.applicationFeeAmount > 0) {
    if (profile.applicationBudgetUsd === null) {
      budgetDecision = {
        criterion: 'Application Fee & Budget Fit',
        profileValue: 'Application budget not specified',
        publishedRequirement: `${program.applicationFeeCurrency || 'USD'} ${program.applicationFeeAmount}`,
        sourceEvidenceExcerpt: `Official application fee: ${program.applicationFeeCurrency || 'USD'} ${program.applicationFeeAmount}`,
        sourceUrl: program.officialProgramUrl,
        verificationStatus: program.verificationStatus,
        result: 'Potentially Eligible',
        missingInformation: 'Available application budget in Profile settings',
        nextRecommendedAction: 'Set your application budget or check if fee waivers are offered for Pakistani / developing country students.',
      };
    } else {
      const withinBudget = profile.applicationBudgetUsd >= program.applicationFeeAmount;
      budgetDecision = {
        criterion: 'Application Fee & Budget Fit',
        profileValue: `USD ${profile.applicationBudgetUsd} available`,
        publishedRequirement: `${program.applicationFeeCurrency || 'USD'} ${program.applicationFeeAmount}`,
        sourceEvidenceExcerpt: `Official application fee: ${program.applicationFeeCurrency || 'USD'} ${program.applicationFeeAmount}`,
        sourceUrl: program.officialProgramUrl,
        verificationStatus: program.verificationStatus,
        result: withinBudget ? 'Likely Eligible' : 'Potentially Eligible',
        missingInformation: null,
        nextRecommendedAction: withinBudget
          ? 'Application fee is within your configured budget.'
          : 'Request a departmental application fee waiver before submitting.',
      };
    }
  }

  // Determine effective funding preference mode
  const prefMode =
    profile.fundingPreferenceMode ||
    (profile.requireFullFunding ? 'FULLY_FUNDED_ONLY' : 'ANY_FUNDING');

  // Funding completeness decision
  const primaryScholarship = scholarships[0];
  const fundingClass = primaryScholarship?.fundingClassification || program.fundingClassification;
  let fundingStatus: EligibilityStatus = 'Needs Verification';

  if (fundingClass === 'Fully Funded — Confirmed') {
    if (
      profile.minAnnualLivingSupportUsd &&
      primaryScholarship?.fundingPackage?.stipendAmountUsdApprox &&
      primaryScholarship.fundingPackage.stipendAmountUsdApprox < profile.minAnnualLivingSupportUsd
    ) {
      fundingStatus = 'Potentially Eligible';
    } else {
      fundingStatus = 'Likely Eligible';
    }
  } else if (
    fundingClass === 'Fully Funded — Likely' ||
    fundingClass === 'Tuition Funded, Living Costs Covered' ||
    fundingClass === 'Substantial Funding'
  ) {
    fundingStatus = 'Potentially Eligible';
  } else if (
    fundingClass === 'Tuition Only' ||
    fundingClass === 'Partially Funded' ||
    fundingClass === 'Partial Funding' ||
    fundingClass === 'Stipend Only'
  ) {
    fundingStatus =
      prefMode === 'FULLY_FUNDED_ONLY' || profile.requireFullFunding
        ? 'Not Eligible'
        : 'Potentially Eligible';
  } else if (
    fundingClass === 'Self-Funded' ||
    fundingClass === 'Self-Funded / No Scholarship Found'
  ) {
    fundingStatus =
      prefMode === 'INCLUDE_SELF_FUNDED' && !profile.requireFullFunding
        ? 'Potentially Eligible'
        : 'Not Eligible';
  } else if (fundingClass === 'Funding Unverified') {
    fundingStatus = 'Needs Verification';
  } else {
    fundingStatus = 'Potentially Eligible';
  }

  const fundingModeLabel =
    prefMode === 'FULLY_FUNDED_ONLY' || profile.requireFullFunding
      ? `Requires Full Funding${profile.minAnnualLivingSupportUsd ? ` (Min $${profile.minAnnualLivingSupportUsd.toLocaleString()}/yr)` : ''}`
      : prefMode === 'SUBSTANTIAL_FUNDING'
      ? 'Prefers Full or Substantial Funding'
      : prefMode === 'INCLUDE_SELF_FUNDED'
      ? 'Includes Self-Funded & All Admission Options'
      : 'Flexible / Partial or Tuition Waivers Acceptable';

  const fundingDecision: RuleDecisionItem = {
    criterion: 'Funding Completeness & Living Support',
    profileValue: fundingModeLabel,
    publishedRequirement: `${fundingClass}${
      primaryScholarship?.fundingPackage?.stipendAmountAnnual
        ? ` — ${primaryScholarship.fundingPackage.stipendCurrency} ${primaryScholarship.fundingPackage.stipendAmountAnnual.toLocaleString()}/yr`
        : ''
    }`,
    sourceEvidenceExcerpt:
      fundClaim?.supportingExcerpt ||
      primaryScholarship?.fundingPackage?.classificationExplanation ||
      'Funding package classification derived from official scholarship documentation.',
    sourceUrl: fundClaim?.sourceUrl || primaryScholarship?.officialUrl || program.officialProgramUrl,
    verificationStatus: primaryScholarship?.verificationStatus || program.verificationStatus,
    result: fundingStatus,
    missingInformation: fundingClass === 'Funding Unverified' ? 'Verified stipend and tuition schedule' : null,
    nextRecommendedAction:
      fundingClass === 'Tuition Only'
        ? 'Note: Tuition Only awards do NOT cover living expenses. Identify external maintenance funding.'
        : fundingClass === 'Self-Funded / No Scholarship Found' || fundingClass === 'Self-Funded'
        ? 'Self-funded admission option only: no scholarship is bundled unless applied for separately (e.g., Fulbright / Commonwealth).'
        : fundingClass === 'Fully Funded — Confirmed'
        ? 'Prepare scholarship-specific essays and reference letters early.'
        : 'Verify whether teaching/research assistantships can supplement living costs.',
  };

  const admissionCoreDecisions = [
    academicDecision,
    languageDecision,
    ...(ageDecision ? [ageDecision] : []),
  ];
  const admissionStatus = aggregateEligibilityStatus(admissionCoreDecisions);

  const scholarshipStatus =
    citizenshipDecision.result === 'Not Eligible' || ageDecision?.result === 'Not Eligible'
      ? 'Not Eligible'
      : aggregateEligibilityStatus([citizenshipDecision, academicDecision, ...(ageDecision ? [ageDecision] : [])]);

  const pakistaniEligibilityStatus = derivePakistaniEligibilityStatus(
    citizenshipDecision,
    admissionStatus,
    ageDecision
  );

  const allDecisions: RuleDecisionItem[] = [
    academicDecision,
    languageDecision,
    citizenshipDecision,
    ...(ageDecision ? [ageDecision] : []),
    fundingDecision,
    ...(budgetDecision ? [budgetDecision] : []),
  ];

  // ============================================================================
  // Explainable 9-Factor Ranking Calculation (Section 9)
  // ============================================================================
  const reasons: string[] = [];

  // 1. Confirmed funding completeness (0 - 25)
  let fundingCompletenessScore = 5;
  if (fundingClass === 'Fully Funded — Confirmed') {
    fundingCompletenessScore = 25;
    reasons.push('Confirmed full funding covering tuition, mandatory fees, and benchmarked living stipend (+25)');
  } else if (fundingClass === 'Fully Funded — Likely' || fundingClass === 'Tuition Funded, Living Costs Covered') {
    fundingCompletenessScore = 21;
    reasons.push('Tuition and living costs covered (+21)');
  } else if (fundingClass === 'Substantial Funding') {
    fundingCompletenessScore = 17;
    reasons.push('100% tuition plus substantial living stipend (>=75% of statutory benchmark) (+17)');
  } else if (fundingClass === 'Tuition Funded, Living Costs Uncertain') {
    fundingCompletenessScore = 14;
    reasons.push('Tuition funded; living cost adequacy requires verification (+14)');
  } else if (
    fundingClass === 'Partially Funded' ||
    fundingClass === 'Partial Funding' ||
    fundingClass === 'Stipend Only' ||
    fundingClass === 'Tuition Only'
  ) {
    fundingCompletenessScore = prefMode === 'FULLY_FUNDED_ONLY' || profile.requireFullFunding ? 3 : 12;
    reasons.push(`${fundingClass} package (${fundingCompletenessScore} pts)`);
  } else if (fundingClass === 'Self-Funded' || fundingClass === 'Self-Funded / No Scholarship Found') {
    fundingCompletenessScore = prefMode === 'INCLUDE_SELF_FUNDED' ? 8 : 1;
    reasons.push(`Self-funded admission option (${fundingCompletenessScore} pts)`);
  }

  // 2. Admission and scholarship eligibility (0 - 20)
  let eligibilityScore = 8;
  if (admissionStatus === 'Likely Eligible' && scholarshipStatus === 'Likely Eligible') {
    eligibilityScore = 20;
    reasons.push('Satisfies published academic, language, and scholarship eligibility checks (+20)');
  } else if (admissionStatus === 'Not Eligible' || scholarshipStatus === 'Not Eligible') {
    eligibilityScore = 0;
    reasons.push('Ineligible on at least one mandatory published requirement (+0)');
  } else if (admissionStatus === 'Insufficient Information' || scholarshipStatus === 'Insufficient Information') {
    eligibilityScore = 10;
    reasons.push('Potentially matches, pending completion of missing profile fields (+10)');
  } else {
    eligibilityScore = 13;
    reasons.push('Requires manual verification of cross-scale grade or exemption rule (+13)');
  }

  // 3. Academic and research relevance (0 - 15) using CS & Microbiology Subject Taxonomy
  let academicRelevanceScore = 4;
  const taxonomyMatch = matchSubjectTaxonomy(profile.targetFields, program);
  const fieldMatch = taxonomyMatch.matched;
  const degreeMatch = profile.targetDegrees.some(
    (d) =>
      d.toLowerCase() === program.degreeLevel.toLowerCase() ||
      (program.degreeLevel.toLowerCase().includes(d.toLowerCase()) && d.length >= 2)
  );
  if (fieldMatch && degreeMatch) {
    academicRelevanceScore = 15;
    const specNote =
      taxonomyMatch.matchedSpecializations.length > 0
        ? ` [${taxonomyMatch.matchedSpecializations.slice(0, 2).join(', ')}]`
        : '';
    reasons.push(
      `Direct match with target degree (${program.degreeLevel}) and discipline (${program.discipline}${specNote}) (+15)`
    );
  } else if (fieldMatch || degreeMatch) {
    academicRelevanceScore = 10;
    reasons.push(`Partial match with target degree/discipline preferences (+10)`);
  }

  // 4. Citizenship eligibility (0 - 10)
  let citizenshipScore = 5;
  if (citizenshipDecision.result === 'Likely Eligible') {
    citizenshipScore = 10;
    if (profile.citizenship?.toLowerCase() === 'pakistan') {
      reasons.push('Verified open to Pakistani citizens (+10)');
    }
  } else if (citizenshipDecision.result === 'Not Eligible') {
    citizenshipScore = 0;
  }

  // 5. Country preferences (0 - 10)
  let countryPreferenceScore = 5;
  const instCountry = institution?.country || primaryScholarship?.country || '';
  if (profile.preferredCountries.length === 0) {
    countryPreferenceScore = 7;
  } else if (profile.preferredCountries.some((c) => c.toLowerCase() === instCountry.toLowerCase())) {
    countryPreferenceScore = 10;
    reasons.push(`Located in preferred destination country: ${instCountry} (+10)`);
  } else {
    countryPreferenceScore = 3;
  }

  // 6. Deadline proximity (0 - 5)
  let deadlineProximityScore = 3;
  if (program.isExpired || !program.isActive) {
    deadlineProximityScore = 0;
    reasons.push('Application deadline for current cycle has passed or cycle is currently closed (+0)');
  } else if (program.deadlineDate) {
    const daysLeft = (new Date(program.deadlineDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysLeft > 14 && daysLeft <= 150) {
      deadlineProximityScore = 5;
    } else if (daysLeft > 0 && daysLeft <= 14) {
      deadlineProximityScore = 4;
      reasons.push(`Urgent approaching deadline (${Math.ceil(daysLeft)} days remaining) (+4)`);
    } else if (daysLeft < 0) {
      deadlineProximityScore = 0;
    }
  }

  // 7. Source authority (0 - 5)
  const sourceAuthorityScore =
    institution?.authorityTier === 'UNIVERSITY' || primaryScholarship?.authorityType === 'GOVERNMENT' ? 5 : 3;

  // 8. Evidence quality and freshness (0 - 5)
  let evidenceQualityScore = 2;
  if (program.verificationStatus === 'Cross-Verified') {
    evidenceQualityScore = 5;
    reasons.push('Independently cross-verified across multiple official sources (+5)');
  } else if (program.verificationStatus === 'Officially Confirmed') {
    evidenceQualityScore = 4;
  } else if (program.verificationStatus === 'Conflicting Evidence' || program.verificationStatus === 'Unavailable') {
    evidenceQualityScore = 1;
  }

  // 9. Remaining application effort (0 - 5)
  let effortScore = 3;
  const separateApp = primaryScholarship?.separateApplicationReq ?? false;
  const supervisorReq = program.supervisorContactReq === 'REQUIRED';
  if (!separateApp && !supervisorReq) {
    effortScore = 5;
  } else if (separateApp && supervisorReq) {
    effortScore = 2;
  }

  const totalScore =
    fundingCompletenessScore +
    eligibilityScore +
    academicRelevanceScore +
    citizenshipScore +
    countryPreferenceScore +
    deadlineProximityScore +
    sourceAuthorityScore +
    evidenceQualityScore +
    effortScore;

  const rankingFactors: RankingFactorBreakdown = {
    fundingCompletenessScore,
    eligibilityScore,
    academicRelevanceScore,
    citizenshipScore,
    countryPreferenceScore,
    deadlineProximityScore,
    sourceAuthorityScore,
    evidenceQualityScore,
    effortScore,
    totalScore,
    reasons,
  };

  return {
    id: `elig-${profile.userId}-${program.id}`,
    userId: profile.userId,
    programId: program.id,
    admissionStatus,
    scholarshipStatus,
    fundingCompletenessStatus: fundingStatus,
    pakistaniEligibilityStatus,
    overallRankScore: totalScore,
    decisions: allDecisions,
    rankingFactors,
    evaluatedAt: now.toISOString(),
  };
}
