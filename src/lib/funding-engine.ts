import { FundingClassification, FundingPackageRecord, VerificationStatus } from './types';

// ============================================================================
// Deterministic Funding & Living-Cost Benchmark Analysis Engine (Section 8)
// ============================================================================

export type BenchmarkCategory =
  | 'STATUTORY_IMMIGRATION_REQUIREMENT'
  | 'INSTITUTIONAL_LIVING_EXPENSE_ESTIMATE'
  | 'SCHOLARSHIP_STIPEND_STANDARD'
  | 'ESTIMATED_ACTUAL_LIVING_COST';

export interface LivingCostBenchmark {
  country: string;
  cityOrRegion: string;
  annualAmount: number;
  currency: string;
  usdEquivalentApprox: number;
  benchmarkCategory: BenchmarkCategory;
  benchmarkCategoryLabel: string;
  verificationStatus:
    | 'Unverified Reference Policy Constant (Not Live-Extracted from DOM)'
    | 'Officially Confirmed';
  sourceExcerpt: string;
  sourceName: string;
  sourceUrl: string;
  effectiveDate: string;
  calculationNotes: string;
  limitationsNote: string;
}

/**
 * Official national immigration, institutional living-expense, and scholarship stipend benchmarks.
 * Explicitly distinguishes:
 * 1. Statutory immigration financial requirements (Germany, UK, Canada, Australia)
 * 2. Official institutional living-expense estimates (Switzerland, United States)
 * 3. Scholarship stipend standards used as proxy benchmarks (Japan, China, Saudi Arabia, Pakistan)
 * 4. Estimated actual living costs (noted in limitationsNote; none of the baseline constants represent unsubsidized market lifestyle costs).
 * Note: Because these benchmark figures are curated policy reference constants rather than verbatim DOM-extracted claims in db.claims,
 * their verificationStatus is explicitly marked as "Unverified Reference Policy Constant (Not Live-Extracted from DOM)".
 */
export const OFFICIAL_LIVING_COST_BENCHMARKS: Record<string, LivingCostBenchmark> = {
  'United Kingdom': {
    country: 'United Kingdom',
    cityOrRegion: 'Outside London (UKVI Student Route Annualized Rate)',
    annualAmount: 13692,
    currency: 'GBP',
    usdEquivalentApprox: 17525,
    benchmarkCategory: 'STATUTORY_IMMIGRATION_REQUIREMENT',
    benchmarkCategoryLabel: 'Statutory Immigration Requirement (12-Mo Annualized)',
    verificationStatus: 'Unverified Reference Policy Constant (Not Live-Extracted from DOM)',
    sourceExcerpt:
      'No live DOM excerpt in db.claims (gov.uk/student-visa/money is not crawled in db.sources; Gates Cambridge maintenance of £23,152/yr is separately verified in db.claims).',
    sourceName: 'UK Visas and Immigration (UKVI) Student Route Maintenance Rate Outside London (£1,141/mo)',
    sourceUrl: 'https://www.gov.uk/student-visa/money',
    effectiveDate: '2026-01-02',
    calculationNotes:
      '£1,141/month × 12 months = £13,692/year annualized statutory rate. Note: UKVI visa financial evidence is assessed for up to 9 months (£1,141 × 9 = £10,269). Separate scholarship stipend standards: UKRI Doctoral Minimum is £20,780/yr; Gates Cambridge is £23,152/yr (live-verified).',
    limitationsNote:
      'Statutory immigration rate outside London annualized to 12 months; does not represent London visa rates (£1,483/mo) or actual unsubsidized market housing/dependant expenses.',
  },
  Switzerland: {
    country: 'Switzerland',
    cityOrRegion: 'Zurich / Lausanne (ETH Zurich & EPFL Official Guideline)',
    annualAmount: 24000,
    currency: 'CHF',
    usdEquivalentApprox: 27360,
    benchmarkCategory: 'INSTITUTIONAL_LIVING_EXPENSE_ESTIMATE',
    benchmarkCategoryLabel: 'Official Institutional Living-Expense Estimate',
    verificationStatus: 'Unverified Reference Policy Constant (Not Live-Extracted from DOM)',
    sourceExcerpt:
      'No live DOM excerpt for cost-of-living page in db.claims (separate from ETH ESOP scholarship stipend of CHF 13,500/semester = CHF 27,000/yr, which is live-verified in db.claims).',
    sourceName: 'ETH Zurich Financial & Study-Related Costs Guideline (Single Student Study & Living Estimate)',
    sourceUrl: 'https://ethz.ch/en/the-eth-zurich/working-teaching-and-research/welcome-center/services-and-downloads/cost-of-living.html',
    effectiveDate: '2026-09-01',
    calculationNotes: 'CHF 2,000/month × 12 months = CHF 24,000/year institutional study & living-expense estimate for a single student.',
    limitationsNote:
      'Institutional living-expense estimate for a single student; actual private-market rent in Zurich/Lausanne and cantonal migration proofs may differ.',
  },
  'United States': {
    country: 'United States',
    cityOrRegion: 'Cambridge, MA / Major US Research Metro',
    annualAmount: 38400,
    currency: 'USD',
    usdEquivalentApprox: 38400,
    benchmarkCategory: 'INSTITUTIONAL_LIVING_EXPENSE_ESTIMATE',
    benchmarkCategoryLabel: 'Official Institutional Living-Expense Estimate',
    verificationStatus: 'Unverified Reference Policy Constant (Not Live-Extracted from DOM)',
    sourceExcerpt: 'No live DOM excerpt in db.claims (sfs.mit.edu is not in db.sources; reference institutional cost-of-attendance constant).',
    sourceName: 'MIT Graduate Student Living Expense Estimate (12-Month Single Student Cost of Attendance)',
    sourceUrl: 'https://sfs.mit.edu/graduate-students/cost-of-attendance/',
    effectiveDate: '2026-09-01',
    calculationNotes: '$3,200/month × 12 months = $38,400/year institutional estimate covering housing, food, local transport, and personal expenses.',
    limitationsNote:
      'Institutional 12-month single-student living-expense estimate (not a statutory federal visa fixed sum); actual off-campus lease and family costs vary by US city.',
  },
  Canada: {
    country: 'Canada',
    cityOrRegion: 'Outside Quebec (IRCC Study Permit Financial Requirement)',
    annualAmount: 20635,
    currency: 'CAD',
    usdEquivalentApprox: 15060,
    benchmarkCategory: 'STATUTORY_IMMIGRATION_REQUIREMENT',
    benchmarkCategoryLabel: 'Statutory Immigration Requirement',
    verificationStatus: 'Unverified Reference Policy Constant (Not Live-Extracted from DOM)',
    sourceExcerpt: 'No live DOM excerpt in db.claims (canada.ca is not crawled in db.sources; reference statutory policy constant).',
    sourceName: 'Immigration, Refugees and Citizenship Canada (IRCC) Study Permit Financial Support Requirement',
    sourceUrl: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/study-permits/study-permit-who-can-apply/financial-support.html',
    effectiveDate: '2026-01-01',
    calculationNotes: 'CAD $20,635/year statutory minimum living-funds proof required for a single study-permit applicant (excluding tuition and travel).',
    limitationsNote:
      'Statutory federal IRCC immigration threshold; actual market rent and living costs in downtown Toronto or Vancouver may exceed this statutory baseline.',
  },
  Germany: {
    country: 'Germany',
    cityOrRegion: 'National Federal Standard (Auswärtiges Amt / BAMF Blocked Account)',
    annualAmount: 11904,
    currency: 'EUR',
    usdEquivalentApprox: 12975,
    benchmarkCategory: 'STATUTORY_IMMIGRATION_REQUIREMENT',
    benchmarkCategoryLabel: 'Statutory Immigration Requirement',
    verificationStatus: 'Unverified Reference Policy Constant (Not Live-Extracted from DOM)',
    sourceExcerpt: 'No live DOM excerpt in db.claims (auswaertiges-amt.de is not crawled in db.sources; reference statutory policy constant).',
    sourceName: 'German Federal Foreign Office (Auswärtiges Amt) Statutory Blocked Account (Sperrkonto) Requirement (€992/month)',
    sourceUrl: 'https://www.auswaertiges-amt.de/en/sperrkonto/388600',
    effectiveDate: '2026-09-01',
    calculationNotes:
      '€992/month × 12 months = €11,904/year statutory visa blocked-account requirement (matches standard DAAD Master’s monthly stipend baseline; DAAD Doctoral stipend is €1,300/month = €15,600/year).',
    limitationsNote:
      'Statutory immigration blocked-account minimum; actual private-market housing in high-rent cities such as Munich may exceed €992/month.',
  },
  Japan: {
    country: 'Japan',
    cityOrRegion: 'National Graduate Standard (MEXT Research Scholarship Stipend Baseline)',
    annualAmount: 1680000,
    currency: 'JPY',
    usdEquivalentApprox: 11256,
    benchmarkCategory: 'SCHOLARSHIP_STIPEND_STANDARD',
    benchmarkCategoryLabel: 'Scholarship Stipend Standard (Proxy)',
    verificationStatus: 'Unverified Reference Policy Constant (Not Live-Extracted from DOM)',
    sourceExcerpt:
      'studyinjapan.go.jp was fetched (HTTP 200), but the overview HTML snippet in db.snapshots does not contain the numeric monthly stipend table.',
    sourceName: 'MEXT / JASSO Japanese Government Research Student Scholarship Stipend Baseline (¥140,000–¥144,000/month)',
    sourceUrl: 'https://www.studyinjapan.go.jp/en/planning/scholarships/mext-scholarships/',
    effectiveDate: '2026-04-01',
    calculationNotes:
      '¥140,000/month × 12 months = ¥1,680,000/year baseline MEXT scholarship stipend proxy (MEXT Master’s/PhD research rates are ¥143,000–¥145,000/month = ¥1,716,000–¥1,740,000/year). USD approx at 0.0067 = $11,256/yr.',
    limitationsNote:
      'Scholarship stipend standard used as a comparison proxy (not a statutory Japanese immigration minimum or unsubsidized Tokyo private-rental cost).',
  },
  China: {
    country: 'China',
    cityOrRegion: 'National Graduate Standard (CSC Doctoral Stipend Baseline + Dormitory)',
    annualAmount: 42000,
    currency: 'CNY',
    usdEquivalentApprox: 5880,
    benchmarkCategory: 'SCHOLARSHIP_STIPEND_STANDARD',
    benchmarkCategoryLabel: 'Scholarship Stipend Standard (Proxy)',
    verificationStatus: 'Unverified Reference Policy Constant (Not Live-Extracted from DOM)',
    sourceExcerpt:
      'english.ucas.ac.cn and tsinghua.edu.cn were fetched (HTTP 200), but their homepage HTML snippets do not contain the numeric CGS stipend table.',
    sourceName: 'China Scholarship Council (CSC) Type B Doctoral Stipend Standard (CNY 3,500/month + Free University Dormitory)',
    sourceUrl: 'https://english.ucas.ac.cn/',
    effectiveDate: '2026-09-01',
    calculationNotes:
      'CNY 3,500/month × 12 months = CNY 42,000/year standard CSC doctoral stipend (CNY 3,000/month = CNY 36,000/year for Master’s; CAS-TWAS/ANSO PhD stipend is CNY 6,000–7,000/month = CNY 72,000/year).',
    limitationsNote:
      'Scholarship stipend standard assuming free on-campus dormitory or housing subsidy; does not represent unsubsidized off-campus private rent in Beijing or Shanghai.',
  },
  'Saudi Arabia': {
    country: 'Saudi Arabia',
    cityOrRegion: 'Thuwal Campus (KAUST Fellowship Stipend + Free Campus Housing)',
    annualAmount: 20000,
    currency: 'USD',
    usdEquivalentApprox: 20000,
    benchmarkCategory: 'SCHOLARSHIP_STIPEND_STANDARD',
    benchmarkCategoryLabel: 'Scholarship Stipend Standard (Proxy)',
    verificationStatus: 'Unverified Reference Policy Constant (Not Live-Extracted from DOM)',
    sourceExcerpt:
      'kaust.edu.sa/en/study/applying-to-kaust was fetched (HTTP 200, confirming 2027 cycle & IELTS 6.5 / TOEFL 81), but the numeric $20,000–$30,000 stipend figure is not in the admissions-page snippet.',
    sourceName: 'KAUST Graduate Fellowship Baseline Annual Stipend ($20,000–$30,000/yr + Free On-Campus Housing)',
    sourceUrl: 'https://www.kaust.edu.sa/en/study/applying-to-kaust',
    effectiveDate: '2026-09-01',
    calculationNotes: 'USD $20,000/year baseline KAUST Fellowship stipend paired with 100% tuition, free on-campus housing, and medical coverage.',
    limitationsNote:
      'Institutional fellowship stipend standard assuming free on-campus housing; not a statutory Saudi immigration requirement or unsubsidized market living cost.',
  },
  Australia: {
    country: 'Australia',
    cityOrRegion: 'National Subclass 500 Student Visa Financial Capacity Requirement',
    annualAmount: 29710,
    currency: 'AUD',
    usdEquivalentApprox: 19609,
    benchmarkCategory: 'STATUTORY_IMMIGRATION_REQUIREMENT',
    benchmarkCategoryLabel: 'Statutory Immigration Requirement',
    verificationStatus: 'Unverified Reference Policy Constant (Not Live-Extracted from DOM)',
    sourceExcerpt: 'No live DOM excerpt in db.claims (immi.homeaffairs.gov.au is not crawled in db.sources; reference statutory policy constant).',
    sourceName: 'Australian Department of Home Affairs Student Visa (Subclass 500) Statutory Living Cost Requirement',
    sourceUrl: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/student-500',
    effectiveDate: '2026-05-10',
    calculationNotes: 'AUD $29,710/year statutory financial capacity requirement for a single Student Visa (Subclass 500) applicant. USD approx at 0.66 = $19,609/yr.',
    limitationsNote:
      'Statutory visa financial capacity threshold (distinct from the Australian Government RTP scholarship stipend standard); actual Sydney/Melbourne inner-city rent may vary.',
  },
  Pakistan: {
    country: 'Pakistan',
    cityOrRegion: 'Domestic Graduate Standard (HEC Indigenous PhD Stipend Baseline)',
    annualAmount: 480000,
    currency: 'PKR',
    usdEquivalentApprox: 1728,
    benchmarkCategory: 'SCHOLARSHIP_STIPEND_STANDARD',
    benchmarkCategoryLabel: 'Scholarship Stipend Standard (Proxy)',
    verificationStatus: 'Unverified Reference Policy Constant (Not Live-Extracted from DOM)',
    sourceExcerpt:
      'hec.gov.pk was fetched, but the portal landing page does not contain the numeric Indigenous PhD stipend schedule in db.claims.',
    sourceName: 'Higher Education Commission (HEC) Pakistan Indigenous PhD Stipend Standard (PKR 40,000/month)',
    sourceUrl: 'https://www.hec.gov.pk/english/scholarshipsgrants/Pages/default.aspx',
    effectiveDate: '2026-07-01',
    calculationNotes: 'PKR 40,000/month × 12 months = PKR 480,000/year domestic scholarship stipend standard. USD approx at 0.0036 = $1,728/yr.',
    limitationsNote:
      'Domestic HEC scholarship stipend standard; does not represent an official household cost-of-living index.',
  },
};

const APPROX_USD_RATES: Record<string, number> = {
  USD: 1.0,
  GBP: 1.28,
  CHF: 1.14,
  EUR: 1.09,
  CAD: 0.73,
  JPY: 0.0067,
  CNY: 0.14,
  RMB: 0.14,
  AUD: 0.66,
  SAR: 0.266,
  PKR: 0.0036,
};

export function convertToUsdApprox(amount: number | null, currency: string | null): number | null {
  if (amount === null || amount === undefined || !currency) return null;
  const rate = APPROX_USD_RATES[currency.toUpperCase()];
  if (!rate) return null;
  return Math.round(amount * rate);
}

export interface FundingInput {
  scholarshipId: string;
  country: string;
  tuitionCoveragePercent: number | null;
  mandatoryFeesCovered: boolean | null;
  stipendAmountAnnual: number | null;
  stipendCurrency: string | null;
  stipendFrequency?: 'MONTHLY' | 'ANNUAL' | 'QUARTERLY' | 'UNKNOWN';
  durationMonths?: number | null;
  accommodationCovered?: boolean | null;
  healthInsuranceCovered?: boolean | null;
  travelAllowanceCovered?: boolean | null;
  relocationSupportCovered?: boolean | null;
  renewalConditions?: string | null;
  awardBasis?: 'GUARANTEED' | 'COMPETITIVE' | 'CONDITIONAL' | 'SEPARATE_APPLICATION';
  verificationStatus: VerificationStatus;
  applicantCategoryAccessible?: boolean; // default true unless restricted
}

/**
 * Deterministic Funding Classification Engine (Section 8).
 * Strict Invariants:
 * 1. NEVER classify tuition-only awards as fully funded.
 * 2. To qualify as 'Fully Funded — Confirmed', evidence must be Officially Confirmed or Cross-Verified,
 *    applicant category must have access, tuition coverage must be 100%, mandatory fees must be covered,
 *    and annual stipend must meet or exceed the official living-cost benchmark (or accommodation + living costs explicitly covered).
 * 3. Supports 'Fully Funded — Likely', 'Substantial Funding', 'Partially Funded', 'Tuition Only',
 *    'Stipend Only', 'Funding Unverified', and 'Self-Funded / No Scholarship Found'.
 */
export function evaluateFundingPackage(input: FundingInput): FundingPackageRecord {
  const benchmark = OFFICIAL_LIVING_COST_BENCHMARKS[input.country] || null;
  const tuitionPct = input.tuitionCoveragePercent;
  const stipendAnnual = input.stipendAmountAnnual;
  const stipendCurr = input.stipendCurrency;
  const isVerified =
    input.verificationStatus === 'Officially Confirmed' ||
    input.verificationStatus === 'Cross-Verified';
  const awardBasis = input.awardBasis || 'COMPETITIVE';

  let livingCostSurplusOrDeficit: number | null = null;
  let livingCostAdequacyStatus: 'ADEQUATE' | 'INSUFFICIENT' | 'UNCERTAIN' = 'UNCERTAIN';
  let benchmarkCoverageRatio: number | null = null;

  if (stipendAnnual !== null && stipendAnnual > 0 && benchmark) {
    if (stipendCurr && stipendCurr.toUpperCase() === benchmark.currency.toUpperCase()) {
      livingCostSurplusOrDeficit = Math.round(stipendAnnual - benchmark.annualAmount);
      benchmarkCoverageRatio = stipendAnnual / benchmark.annualAmount;
      livingCostAdequacyStatus = stipendAnnual >= benchmark.annualAmount ? 'ADEQUATE' : 'INSUFFICIENT';
    } else {
      const stipendUsd = convertToUsdApprox(stipendAnnual, stipendCurr);
      if (stipendUsd !== null) {
        livingCostSurplusOrDeficit = Math.round(stipendUsd - benchmark.usdEquivalentApprox);
        benchmarkCoverageRatio = stipendUsd / benchmark.usdEquivalentApprox;
        livingCostAdequacyStatus = stipendUsd >= benchmark.usdEquivalentApprox ? 'ADEQUATE' : 'INSUFFICIENT';
      }
    }
  } else if (stipendAnnual === 0 || (stipendAnnual === null && tuitionPct !== null && tuitionPct > 0)) {
    livingCostAdequacyStatus = input.accommodationCovered ? 'UNCERTAIN' : 'INSUFFICIENT';
  }

  let classification: FundingClassification = 'Funding Unverified';
  let explanation = '';

  if (
    input.verificationStatus === 'Unverified' ||
    input.verificationStatus === 'Unavailable' ||
    input.verificationStatus === 'Conflicting Evidence' ||
    input.verificationStatus === 'Ambiguous'
  ) {
    classification = 'Funding Unverified';
    explanation = `Funding claims are currently ${input.verificationStatus} and cannot be relied upon as confirmed support.`;
  } else if (tuitionPct === 0 && (stipendAnnual === null || stipendAnnual === 0)) {
    classification = 'Self-Funded / No Scholarship Found';
    explanation = 'No tuition waiver or living stipend is provided; applicant must self-finance tuition and living costs.';
  } else if (tuitionPct !== null && tuitionPct > 0 && (stipendAnnual === null || stipendAnnual === 0) && !input.accommodationCovered) {
    // STRICT RULE: Never classify tuition-only awards as fully funded!
    classification = 'Tuition Only';
    explanation = `Covers ${tuitionPct}% of tuition fees but provides 0 confirmed living stipend. Applicant must independently fund living expenses${
      benchmark ? ` (benchmark: ${benchmark.currency} ${benchmark.annualAmount.toLocaleString()}/yr)` : ''
    }.`;
  } else if ((tuitionPct === null || tuitionPct === 0) && stipendAnnual !== null && stipendAnnual > 0) {
    classification = 'Stipend Only';
    explanation = `Provides a stipend of ${stipendCurr || ''} ${stipendAnnual.toLocaleString()}/yr, but tuition fee waiver is not included.`;
  } else if (awardBasis === 'CONDITIONAL' || (input.renewalConditions && /conditional on supervisor contract|subject to external grant/i.test(input.renewalConditions))) {
    classification = 'Conditional Funding';
    explanation = `Funding depends on fulfilling specific conditions (${input.renewalConditions || 'conditional award basis'}).`;
  } else if (tuitionPct === 100) {
    if (livingCostAdequacyStatus === 'ADEQUATE') {
      if (isVerified && input.mandatoryFeesCovered === true && input.applicantCategoryAccessible !== false) {
        classification = 'Fully Funded — Confirmed';
        explanation = `Verified 100% tuition + mandatory fees + annual stipend (${stipendCurr} ${stipendAnnual?.toLocaleString()}/yr) exceeding the official ${benchmark?.country} benchmark (${benchmark?.currency} ${benchmark?.annualAmount.toLocaleString()}/yr).`;
      } else {
        classification = 'Fully Funded — Likely';
        explanation = `Covers 100% tuition and meets the living-cost benchmark (${stipendCurr} ${stipendAnnual?.toLocaleString()}/yr), though mandatory fee coverage or full independent verification is pending.`;
      }
    } else if (livingCostAdequacyStatus === 'UNCERTAIN' || (stipendAnnual !== null && stipendAnnual > 0 && !benchmark)) {
      classification = 'Tuition Funded, Living Costs Uncertain';
      explanation = `Covers 100% tuition with a stipend of ${stipendCurr || ''} ${stipendAnnual?.toLocaleString() ?? 'unknown'}/yr, but adequacy against local living-cost benchmarks cannot be deterministically confirmed.`;
    } else if (benchmarkCoverageRatio !== null && benchmarkCoverageRatio >= 0.75) {
      classification = 'Substantial Funding';
      explanation = `Covers 100% tuition plus a substantial stipend (${stipendCurr} ${stipendAnnual?.toLocaleString()}/yr, ${Math.round(
        benchmarkCoverageRatio * 100
      )}% of the ${benchmark?.country} benchmark of ${benchmark?.currency} ${benchmark?.annualAmount.toLocaleString()}/yr).`;
    } else {
      classification = 'Partially Funded';
      explanation = `Covers 100% tuition and provides a partial living stipend (${stipendCurr} ${stipendAnnual?.toLocaleString()}/yr), which falls below the official ${benchmark?.country} living-cost benchmark (${benchmark?.currency} ${benchmark?.annualAmount.toLocaleString()}/yr).`;
    }
  } else if (tuitionPct !== null && tuitionPct > 0 && tuitionPct < 100) {
    classification = 'Partially Funded';
    explanation = `Covers partial tuition (${tuitionPct}%)${
      stipendAnnual ? ` plus ${stipendCurr} ${stipendAnnual.toLocaleString()}/yr stipend` : ''
    }; remaining balance must be covered by the student.`;
  } else {
    classification = 'Funding Unverified';
    explanation = 'Insufficient structured evidence to deterministically classify tuition and living support.';
  }

  return {
    id: `fp-${input.scholarshipId}`,
    scholarshipId: input.scholarshipId,
    tuitionCoveragePercent: tuitionPct,
    mandatoryFeesCovered: input.mandatoryFeesCovered,
    stipendAmountAnnual: stipendAnnual,
    stipendCurrency: stipendCurr,
    stipendAmountUsdApprox: convertToUsdApprox(stipendAnnual, stipendCurr),
    stipendFrequency: input.stipendFrequency || 'UNKNOWN',
    durationMonths: input.durationMonths ?? null,
    accommodationCovered: input.accommodationCovered ?? null,
    healthInsuranceCovered: input.healthInsuranceCovered ?? null,
    travelAllowanceCovered: input.travelAllowanceCovered ?? null,
    relocationSupportCovered: input.relocationSupportCovered ?? null,
    renewalConditions: input.renewalConditions ?? null,
    awardBasis,
    livingCostBenchmarkAnnual: benchmark ? benchmark.annualAmount : null,
    livingCostBenchmarkCurr: benchmark ? benchmark.currency : null,
    livingCostBenchmarkSource: benchmark ? benchmark.sourceName : null,
    livingCostBenchmarkDate: benchmark ? benchmark.effectiveDate : null,
    livingCostSurplusOrDeficit,
    livingCostAdequacyStatus,
    classification,
    classificationExplanation: explanation,
    updatedAt: new Date().toISOString(),
  };
}
