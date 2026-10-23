import { z } from 'zod';

// ============================================================================
// 1. Canonical Domain Enums & Statuses (Sections 7, 8, 9, 11, 13)
// ============================================================================

export type VerificationStatus =
  | 'Officially Confirmed'
  | 'Cross-Verified'
  | 'Official Source, Not Fully Verified'
  | 'Ambiguous'
  | 'Conflicting Evidence'
  | 'Possibly Stale'
  | 'Stale'
  | 'Unverified'
  | 'Unavailable';

export type FundingClassification =
  | 'Fully Funded — Confirmed'
  | 'Fully Funded — Likely'
  | 'Substantial Funding'
  | 'Tuition Funded, Living Costs Covered'
  | 'Tuition Funded, Living Costs Uncertain'
  | 'Partial Funding'
  | 'Partially Funded'
  | 'Tuition Only'
  | 'Stipend Only'
  | 'Conditional Funding'
  | 'Self-Funded'
  | 'Self-Funded / No Scholarship Found'
  | 'Funding Unverified';

export type EligibilityStatus =
  | 'Likely Eligible'
  | 'Potentially Eligible'
  | 'Not Eligible'
  | 'Insufficient Information'
  | 'Needs Verification';

export type AutomationState = 'Active' | 'Degraded' | 'Paused' | 'Failed';

export type ApplicationStatus =
  | 'Researching'
  | 'Preparing Documents'
  | 'Ready to Apply'
  | 'Submitted'
  | 'Interview'
  | 'Offer Received'
  | 'Accepted'
  | 'Rejected';

export type GradingScale =
  | '4.0'
  | '5.0'
  | '10.0'
  | '100%'
  | 'UK_HONORS'
  | 'GERMAN_1_5'
  | 'ECTS'
  | 'SWISS_6_0';

export type ClaimType =
  | 'DEADLINE'
  | 'MIN_GPA'
  | 'LANGUAGE_REQUIREMENT'
  | 'GRE_REQUIREMENT'
  | 'TUITION_COVERAGE'
  | 'STIPEND_AMOUNT'
  | 'CITIZENSHIP_RULE'
  | 'APPLICATION_FEE'
  | 'REQUIRED_DOCUMENTS'
  | 'DURATION'
  | 'PROGRAM_TITLE'
  | 'AGE_LIMIT'
  | 'NOMINATION_PROCESS';

export type BroadFieldCategory = 'Computer Science' | 'Microbiology' | 'Interdisciplinary (CS & Bio)';

export type OpportunityType =
  | 'DEGREE_ADMISSION'
  | 'GOVERNMENT_SCHOLARSHIP'
  | 'UNIVERSITY_SCHOLARSHIP'
  | 'FOUNDATION_FELLOWSHIP'
  | 'RESEARCH_STUDENTSHIP'
  | 'RA_TA_ASSISTANTSHIP'
  | 'PAID_RESEARCH_POSITION'
  | 'FELLOWSHIP_EXCHANGE'
  | 'SELF_FUNDED_ADMISSION';

export type FundingPreferenceMode =
  | 'FULLY_FUNDED_ONLY'
  | 'SUBSTANTIAL_FUNDING'
  | 'ANY_FUNDING'
  | 'INCLUDE_SELF_FUNDED';

export type PakistaniEligibilityStatus =
  | 'Eligible based on available evidence'
  | 'Potentially eligible — requirements need confirmation'
  | 'Ineligible based on an explicit requirement'
  | 'Insufficient Information / Unknown';

export type GlobalRegion =
  | 'Pakistan'
  | 'UK & Ireland'
  | 'Europe'
  | 'United States & Canada'
  | 'Australia & New Zealand'
  | 'Asia'
  | 'Middle East';

export const MANDATORY_DESTINATION_COUNTRIES = [
  'Germany',
  'United Kingdom',
  'United States',
  'Japan',
  'China',
] as const;

export type MandatoryDestinationCountry = (typeof MANDATORY_DESTINATION_COUNTRIES)[number];

export interface CountryCoverageMetric {
  country: MandatoryDestinationCountry;
  flagCode: string;
  configuredSourcesCount: number;
  enabledSourcesCount: number;
  checkedSourcesCount: number;
  http200SourcesCount: number;
  failedOrRestrictedSourcesCount: number;
  lastRetrievalAt: string | null;
  opportunitiesDiscoveredCount: number;
  verifiedOpportunitiesCount: number;
  csOpportunitiesCount: number;
  microbiologyOpportunitiesCount: number;
  fullyFundedCount: number;
  pendingJobsCount: number;
  freshnessStatus: 'Fresh (< 24h)' | 'Recent (< 72h)' | 'Pending / Stale';
  pakistaniPathwaySummary: string;
}

export interface SpecializationTaxonomyItem {
  id: string;
  label: string;
  broadField: BroadFieldCategory;
  keywords: string[];
}

export const SUBJECT_TAXONOMY: SpecializationTaxonomyItem[] = [
  // Computer Science Specializations
  {
    id: 'cs-ai-ml',
    label: 'Artificial Intelligence and Machine Learning',
    broadField: 'Computer Science',
    keywords: ['artificial intelligence', 'machine learning', 'deep learning', 'neural networks', 'ai', 'ml', 'reinforcement learning'],
  },
  {
    id: 'cs-cv-nlp',
    label: 'Computer Vision and Natural Language Processing',
    broadField: 'Computer Science',
    keywords: ['computer vision', 'natural language processing', 'nlp', 'computational linguistics', 'image processing', 'speech recognition', 'large language models'],
  },
  {
    id: 'cs-data-science',
    label: 'Data Science, Big Data, and Analytics',
    broadField: 'Computer Science',
    keywords: ['data science', 'big data', 'data analytics', 'data mining', 'statistical learning', 'predictive modeling'],
  },
  {
    id: 'cs-cybersecurity',
    label: 'Cybersecurity and Information Security',
    broadField: 'Computer Science',
    keywords: ['cybersecurity', 'information security', 'network security', 'cryptography', 'privacy', 'secure systems'],
  },
  {
    id: 'cs-se-pl',
    label: 'Software Engineering and Programming Languages',
    broadField: 'Computer Science',
    keywords: ['software engineering', 'programming languages', 'compilers', 'formal methods', 'software architecture', 'program verification'],
  },
  {
    id: 'cs-systems-cloud',
    label: 'Computer Systems, Cloud Computing, and Distributed Systems',
    broadField: 'Computer Science',
    keywords: ['computer systems', 'cloud computing', 'distributed systems', 'operating systems', 'high performance computing', 'parallel computing', 'computer architecture'],
  },
  {
    id: 'cs-networks',
    label: 'Computer Networks and Telecommunications',
    broadField: 'Computer Science',
    keywords: ['computer networks', 'telecommunications', 'wireless networks', 'internet of things', 'iot', 'mobile computing', '5g', '6g'],
  },
  {
    id: 'cs-robotics',
    label: 'Robotics and Intelligent Systems',
    broadField: 'Computer Science',
    keywords: ['robotics', 'intelligent systems', 'autonomous systems', 'cyber-physical systems', 'embedded systems', 'control systems'],
  },
  {
    id: 'cs-hci',
    label: 'Human-Computer Interaction',
    broadField: 'Computer Science',
    keywords: ['human-computer interaction', 'hci', 'interaction design', 'ubiquitous computing', 'social computing', 'accessibility'],
  },
  {
    id: 'cs-theory-algorithms',
    label: 'Theoretical Computer Science and Algorithms',
    broadField: 'Computer Science',
    keywords: ['theoretical computer science', 'algorithms', 'computational complexity', 'quantum computing', 'graph theory', 'combinatorics'],
  },
  {
    id: 'cs-databases-ir',
    label: 'Databases and Information Retrieval',
    broadField: 'Computer Science',
    keywords: ['databases', 'information retrieval', 'data management', 'search engines', 'knowledge graphs', 'information systems'],
  },
  // Interdisciplinary CS & Microbiology
  {
    id: 'inter-bioinformatics',
    label: 'Bioinformatics and Computational Biology',
    broadField: 'Interdisciplinary (CS & Bio)',
    keywords: ['bioinformatics', 'computational biology', 'genomic data science', 'systems biology', 'biostatistics', 'computational genomics', 'biological data'],
  },
  // Microbiology Specializations
  {
    id: 'micro-medical-clinical',
    label: 'Medical and Clinical Microbiology',
    broadField: 'Microbiology',
    keywords: ['medical microbiology', 'clinical microbiology', 'diagnostic microbiology', 'clinical pathology', 'hospital infection'],
  },
  {
    id: 'micro-molecular',
    label: 'Molecular Microbiology',
    broadField: 'Microbiology',
    keywords: ['molecular microbiology', 'cellular microbiology', 'microbial physiology', 'gene regulation', 'bacterial cell biology'],
  },
  {
    id: 'micro-genetics-genomics',
    label: 'Microbial Genetics and Genomics',
    broadField: 'Microbiology',
    keywords: ['microbial genetics', 'microbial genomics', 'metagenomics', 'comparative genomics', 'plasmid biology', 'horizontal gene transfer'],
  },
  {
    id: 'micro-virology',
    label: 'Virology',
    broadField: 'Microbiology',
    keywords: ['virology', 'viral pathogenesis', 'emerging viruses', 'rna viruses', 'dna viruses', 'bacteriophages', 'antiviral'],
  },
  {
    id: 'micro-bacteriology',
    label: 'Bacteriology',
    broadField: 'Microbiology',
    keywords: ['bacteriology', 'bacterial pathogenesis', 'bacterial physiology', 'biofilms', 'prokaryotic biology'],
  },
  {
    id: 'micro-mycology',
    label: 'Mycology',
    broadField: 'Microbiology',
    keywords: ['mycology', 'fungal biology', 'medical mycology', 'fungal pathogens', 'yeast genetics'],
  },
  {
    id: 'micro-parasitology',
    label: 'Parasitology',
    broadField: 'Microbiology',
    keywords: ['parasitology', 'molecular parasitology', 'protozoology', 'malaria', 'neglected tropical diseases', 'vector-borne pathogens'],
  },
  {
    id: 'micro-immunology-host',
    label: 'Immunology and Host–Pathogen Interactions',
    broadField: 'Microbiology',
    keywords: ['immunology', 'host-pathogen interactions', 'host–pathogen', 'innate immunity', 'adaptive immunity', 'vaccine development', 'immunobiology'],
  },
  {
    id: 'micro-infectious-diseases',
    label: 'Infectious Diseases and Pathogen Biology',
    broadField: 'Microbiology',
    keywords: ['infectious diseases', 'pathogen biology', 'epidemiology', 'zoonotic diseases', 'global health', 'infection biology', 'pathology'],
  },
  {
    id: 'micro-environmental-agri',
    label: 'Environmental and Agricultural Microbiology',
    broadField: 'Microbiology',
    keywords: ['environmental microbiology', 'agricultural microbiology', 'soil microbiology', 'microbial ecology', 'biogeochemistry', 'plant-microbe'],
  },
  {
    id: 'micro-industrial-food',
    label: 'Industrial and Food Microbiology',
    broadField: 'Microbiology',
    keywords: ['industrial microbiology', 'food microbiology', 'fermentation', 'food safety', 'bioprocessing'],
  },
  {
    id: 'micro-amr',
    label: 'Antimicrobial Resistance',
    broadField: 'Microbiology',
    keywords: ['antimicrobial resistance', 'amr', 'antibiotic resistance', 'multidrug resistance', 'superbugs', 'antimicrobial stewardship'],
  },
  {
    id: 'micro-biotech',
    label: 'Microbial Biotechnology',
    broadField: 'Microbiology',
    keywords: ['microbial biotechnology', 'synthetic biology', 'metabolic engineering', 'biomanufacturing', 'CRISPR', 'bioscience', 'bioengineering'],
  },
  {
    id: 'micro-microbiome',
    label: 'Microbiome Research',
    broadField: 'Microbiology',
    keywords: ['microbiome', 'human microbiome', 'gut microbiota', 'symbiotic microbes', 'microbiota'],
  },
];

// ============================================================================
// 2. Zod Schemas for Input & Extraction Validation (Sections 3, 4, 15)
// ============================================================================

export const RegisterSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name is required').max(120),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const PasswordRecoverySchema = z.object({
  email: z.string().email(),
  currentPassword: z.string().min(1).optional(),
  recoveryToken: z.string().min(6).optional(),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

export const UserProfileInputSchema = z.object({
  citizenship: z.string().nullable().optional(),
  residencyCountry: z.string().nullable().optional(),
  ageYears: z.number().int().min(15).max(80).nullable().optional(),
  hecEquivalenceConfirmed: z.boolean().optional(),
  currentDegree: z.string().nullable().optional(),
  currentUniversity: z.string().nullable().optional(),
  gpaValue: z.number().min(0).max(100).nullable().optional(),
  gradingScale: z
    .enum(['4.0', '5.0', '10.0', '100%', 'UK_HONORS', 'GERMAN_1_5', 'ECTS', 'SWISS_6_0'])
    .nullable()
    .optional(),
  gradingClassification: z.string().nullable().optional(), // e.g. "First Class", "2:1", "2:2"
  graduationDate: z.string().nullable().optional(),
  completedPrerequisites: z.array(z.string()).default([]),
  englishTestType: z.enum(['IELTS', 'TOEFL_IBT', 'CAMBRIDGE', 'NATIVE_EXEMPT', 'NONE']).nullable().optional(),
  englishTestScore: z.number().min(0).max(200).nullable().optional(),
  greVerbal: z.number().int().min(130).max(170).nullable().optional(),
  greQuant: z.number().int().min(130).max(170).nullable().optional(),
  greWriting: z.number().min(0).max(6).nullable().optional(),
  researchMonths: z.number().int().min(0).default(0),
  publicationsCount: z.number().int().min(0).default(0),
  workExperienceMonths: z.number().int().min(0).default(0),
  technicalSkills: z.array(z.string()).default([]),
  applicationBudgetUsd: z.number().min(0).nullable().optional(),
  // Preferences
  targetDegrees: z.array(z.string()).default(['MS', 'MSc', 'MPhil', 'PhD']),
  targetFields: z.array(z.string()).default(['Computer Science', 'Microbiology']),
  fundingPreferenceMode: z
    .enum(['FULLY_FUNDED_ONLY', 'SUBSTANTIAL_FUNDING', 'ANY_FUNDING', 'INCLUDE_SELF_FUNDED'])
    .optional(),
  preferredCountries: z.array(z.string()).default([]),
  preferredUniversities: z.array(z.string()).default([]),
  requireFullFunding: z.boolean().default(false),
  minAnnualLivingSupportUsd: z.number().min(0).nullable().optional(),
  preferredIntakes: z.array(z.string()).default(['Autumn 2027']),
  applicationCycles: z.array(z.string()).default(['2026-2027', '2027-2028']),
  emailNotificationsEnabled: z.boolean().default(true),
  inAppNotificationsEnabled: z.boolean().default(true),
  reminderDaysBeforeDeadline: z.array(z.number().int()).default([30, 14, 7, 1]),
});

export const SourceConfigSchema = z.object({
  name: z.string().min(2).max(150),
  seedUrl: z.string().url(),
  category: z.enum([
    'UNIVERSITY_DIRECTORY',
    'GOVERNMENT_PORTAL',
    'NATIONAL_AGENCY',
    'FELLOWSHIP_PROGRAM',
    'DEPARTMENT_LAB',
    'UNIVERSITY_SCHOLARSHIP',
  ]),
  country: z.string().min(2),
  authorityLevel: z.enum(['PRIMARY_OFFICIAL', 'SECONDARY_OFFICIAL']).default('PRIMARY_OFFICIAL'),
  refreshPolicy: z.enum(['DAILY', 'EVERY_3_DAYS', 'WEEKLY', 'MONTHLY']).default('DAILY'),
  rateLimitPerMinute: z.number().int().min(1).max(60).default(10),
  maxConcurrency: z.number().int().min(1).max(5).default(2),
});

export const SavedOpportunityUpdateSchema = z.object({
  programId: z.string().min(1),
  applicationStatus: z.enum([
    'Researching',
    'Preparing Documents',
    'Ready to Apply',
    'Submitted',
    'Interview',
    'Offer Received',
    'Accepted',
    'Rejected',
  ]).optional(),
  privateNotes: z.string().max(5000).optional(),
  priorityLevel: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
});

export const TaskInputSchema = z.object({
  programId: z.string().nullable().optional(),
  title: z.string().min(2).max(240),
  category: z.enum(['DOCUMENT', 'EXAM', 'SUPERVISOR_CONTACT', 'PORTAL_SUBMISSION', 'SCHOLARSHIP_ESSAY']),
  dueDate: z.string().nullable().optional(),
  userNotes: z.string().max(2000).default(''),
});

// ============================================================================
// 3. Domain Interfaces for Persistence & API
// ============================================================================

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role: 'student' | 'admin';
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileRecord {
  id: string;
  userId: string;
  citizenship: string | null;
  residencyCountry: string | null;
  ageYears?: number | null;
  hecEquivalenceConfirmed?: boolean;
  currentDegree: string | null;
  currentUniversity: string | null;
  gpaValue: number | null;
  gradingScale: GradingScale | null;
  gradingClassification: string | null;
  graduationDate: string | null;
  completedPrerequisites: string[];
  englishTestType: 'IELTS' | 'TOEFL_IBT' | 'CAMBRIDGE' | 'NATIVE_EXEMPT' | 'NONE' | null;
  englishTestScore: number | null;
  greVerbal: number | null;
  greQuant: number | null;
  greWriting: number | null;
  researchMonths: number;
  publicationsCount: number;
  workExperienceMonths: number;
  technicalSkills: string[];
  applicationBudgetUsd: number | null;
  // Embedded preferences
  targetDegrees: string[];
  targetFields: string[];
  fundingPreferenceMode?: FundingPreferenceMode;
  preferredCountries: string[];
  preferredUniversities: string[];
  requireFullFunding: boolean;
  minAnnualLivingSupportUsd: number | null;
  preferredIntakes: string[];
  applicationCycles: string[];
  emailNotificationsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  reminderDaysBeforeDeadline: number[];
  updatedAt: string;
}

export interface UserQualificationRecord {
  id: string;
  userId: string;
  title: string;
  institution: string;
  category: 'transcript' | 'publication' | 'project' | 'employment' | 'exam';
  details: string;
  completedDate: string | null;
  createdAt: string;
}

export interface ClaimVersionRecord {
  id: string;
  claimId: string;
  normalizedValue: string;
  supportingExcerpt: string;
  sourceUrl: string;
  verificationStatus: VerificationStatus;
  observedAt: string;
}

export interface EvidenceClaimRecord {
  id: string;
  programId: string | null;
  scholarshipId: string | null;
  claimType: ClaimType;
  fieldName: string;
  normalizedValue: string;
  supportingExcerpt: string;
  excerptHash: string;
  sourceUrl: string;
  sourceDomain: string;
  sourceOrganization: string;
  pageSection: string | null;
  retrievedAt: string;
  extractedAt: string;
  lastContentChangeAt: string | null;
  verificationMethod: 'AUTHORITATIVE_DOM_EXTRACTION' | 'INDEPENDENT_CORROBORATION' | 'STRUCTURED_JSON_LD';
  verificationStatus: VerificationStatus;
  evidenceQualityScore: number;
  applicationCycle: string | null;
  freshnessPolicy: 'DAILY' | 'EVERY_3_DAYS' | 'WEEKLY' | 'MONTHLY';
  conflictingClaimIds: string[];
  versions: ClaimVersionRecord[];
}

export interface InstitutionRecord {
  id: string;
  name: string;
  country: string;
  city: string | null;
  campus: string | null;
  officialDomain: string;
  officialWebsiteUrl: string;
  authorityTier: 'UNIVERSITY' | 'GOVERNMENT' | 'NATIONAL_AGENCY' | 'FOUNDATION';
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentRecord {
  id: string;
  institutionId: string;
  name: string;
  researchAreas: string[];
  websiteUrl: string | null;
}

export interface AdmissionRequirementRecord {
  id: string;
  programId: string;
  minGpa: number | null;
  gradingScale: GradingScale | null;
  minGradingClassification: string | null; // e.g., "First Class" or "2:1"
  acceptedBackgrounds: string[];
  prerequisiteCourses: string[];
  ieltsMinScore: number | null;
  toeflMinScore: number | null;
  greRequirement: 'REQUIRED' | 'OPTIONAL' | 'NOT_REQUIRED' | 'UNKNOWN';
  citizenshipRule: string | null; // e.g., "NON_UK_CITIZENS_ONLY", "ALL_NATIONALITIES", "INTERNATIONAL_STUDENTS", "PAKISTAN_CITIZENS_ONLY"
  excludedCitizenships: string[];
  maxAgeLimit?: number | null;
  residencyRule?: string | null;
  workExperienceReq?: string | null;
  feeWaiverAvailable?: boolean | null;
  researchExpRequired: boolean;
  requiredDocuments: string[];
  verificationStatus: VerificationStatus;
  supportingClaimIds: string[];
}

export interface FundingPackageRecord {
  id: string;
  scholarshipId: string;
  tuitionCoveragePercent: number | null;
  mandatoryFeesCovered: boolean | null;
  stipendAmountAnnual: number | null;
  stipendCurrency: string | null;
  stipendAmountUsdApprox: number | null;
  stipendFrequency: 'MONTHLY' | 'ANNUAL' | 'QUARTERLY' | 'UNKNOWN';
  durationMonths: number | null;
  accommodationCovered: boolean | null;
  healthInsuranceCovered: boolean | null;
  travelAllowanceCovered: boolean | null;
  relocationSupportCovered: boolean | null;
  renewalConditions: string | null;
  awardBasis: 'GUARANTEED' | 'COMPETITIVE' | 'CONDITIONAL' | 'SEPARATE_APPLICATION';
  livingCostBenchmarkAnnual: number | null;
  livingCostBenchmarkCurr: string | null;
  livingCostBenchmarkSource: string | null;
  livingCostBenchmarkDate: string | null;
  livingCostSurplusOrDeficit: number | null;
  livingCostAdequacyStatus: 'ADEQUATE' | 'INSUFFICIENT' | 'UNCERTAIN';
  classification: FundingClassification;
  classificationExplanation: string;
  updatedAt: string;
}

export interface ScholarshipRecord {
  id: string;
  name: string;
  awardingOrganization: string;
  authorityType: 'GOVERNMENT' | 'UNIVERSITY' | 'NATIONAL_AGENCY' | 'FOUNDATION';
  opportunityType?: OpportunityType;
  country: string;
  officialUrl: string;
  eligibleDegrees: string[];
  eligibleCountries: string[];
  excludedCitizenships: string[];
  eligibleFields: string[];
  deadlineDate: string | null;
  deadlineTimezone: string | null;
  applicationCycle: string | null;
  separateApplicationReq: boolean;
  nominationProcessNote?: string | null;
  fundingClassification: FundingClassification;
  verificationStatus: VerificationStatus;
  lastCheckedAt: string | null;
  fundingPackage: FundingPackageRecord;
  claimIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProgramRecord {
  id: string;
  institutionId: string;
  departmentId: string | null;
  title: string;
  degreeLevel: string; // "MS", "MSc", "PhD", "MPhil", "MRes", "Integrated MS/PhD"
  discipline: string;
  broadField?: BroadFieldCategory;
  specializations?: string[];
  opportunityType?: OpportunityType;
  globalRegion?: GlobalRegion;
  durationMonths: number | null;
  intakeTerm: string | null;
  applicationCycle: string | null;
  officialProgramUrl: string;
  officialApplicationUrl: string | null;
  contactEmail: string | null;
  applicationStages: string[];
  applicationFeeAmount: number | null;
  applicationFeeCurrency: string | null;
  supervisorContactReq: 'REQUIRED' | 'RECOMMENDED' | 'NOT_REQUIRED' | 'UNKNOWN';
  deadlineDate: string | null;
  deadlineTimezone: string | null;
  openingDate: string | null;
  isActive: boolean;
  isExpired: boolean;
  verificationStatus: VerificationStatus;
  fundingClassification: FundingClassification;
  scholarshipIds: string[];
  requirement: AdmissionRequirementRecord;
  claimIds: string[];
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RuleDecisionItem {
  criterion: string;
  profileValue: string;
  publishedRequirement: string;
  sourceEvidenceExcerpt: string;
  sourceUrl: string;
  verificationStatus: VerificationStatus;
  result: EligibilityStatus;
  missingInformation: string | null;
  nextRecommendedAction: string;
}

export interface RankingFactorBreakdown {
  fundingCompletenessScore: number; // 0-25
  eligibilityScore: number;         // 0-20
  academicRelevanceScore: number;   // 0-15
  citizenshipScore: number;         // 0-10
  countryPreferenceScore: number;   // 0-10
  deadlineProximityScore: number;   // 0-5
  sourceAuthorityScore: number;     // 0-5
  evidenceQualityScore: number;     // 0-5
  effortScore: number;              // 0-5
  totalScore: number;               // 0-100
  reasons: string[];
}

export interface EligibilityResultRecord {
  id: string;
  userId: string;
  programId: string;
  admissionStatus: EligibilityStatus;
  scholarshipStatus: EligibilityStatus;
  fundingCompletenessStatus: EligibilityStatus;
  pakistaniEligibilityStatus?: PakistaniEligibilityStatus;
  overallRankScore: number;
  decisions: RuleDecisionItem[];
  rankingFactors: RankingFactorBreakdown;
  evaluatedAt: string;
}

export interface SourceRegistryRecord {
  id: string;
  name: string;
  domain: string;
  seedUrl: string;
  category:
    | 'UNIVERSITY_DIRECTORY'
    | 'GOVERNMENT_PORTAL'
    | 'NATIONAL_AGENCY'
    | 'FELLOWSHIP_PROGRAM'
    | 'DEPARTMENT_LAB'
    | 'UNIVERSITY_SCHOLARSHIP';
  country: string;
  authorityLevel: 'PRIMARY_OFFICIAL' | 'SECONDARY_OFFICIAL';
  refreshPolicy: 'DAILY' | 'EVERY_3_DAYS' | 'WEEKLY' | 'MONTHLY';
  priority?: 'HIGH' | 'NORMAL' | 'LOW';
  rateLimitPerMinute: number;
  maxConcurrency: number;
  enabled: boolean;
  robotsTxtAllowed: boolean;
  lastFetchedAt: string | null;
  lastHttpStatus: number | null;
  lastResponseTimeMs: number | null;
  consecutiveFailures: number;
  isolatedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FetchAttemptRecord {
  id: string;
  sourceId: string;
  url: string;
  normalizedUrl: string;
  httpStatus: number | null;
  responseTimeMs: number;
  contentType: string | null;
  bytesReceived: number | null;
  etag: string | null;
  lastModifiedHdr: string | null;
  errorMessage: string | null;
  attemptedAt: string;
}

export interface SourceSnapshotRecord {
  id: string;
  sourceId: string;
  normalizedUrl: string;
  contentHash: string;
  title: string | null;
  extractedTextSnippet: string;
  discoveredChildLinks: string[];
  retrievedAt: string;
}

export interface JobQueueItemRecord {
  id: string;
  idempotencyKey: string;
  jobType: 'DISCOVER_SOURCE' | 'FETCH_AND_EXTRACT' | 'VERIFY_CLAIMS' | 'RECALCULATE_MATCHES';
  targetDomain: string;
  sourceId: string | null;
  url: string | null;
  priority: number;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTER';
  attempts: number;
  maxAttempts: number;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  nextRunAt: string;
  lastError: string | null;
  executionLog: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ResearchRunRecord {
  id: string;
  triggerType: 'SCHEDULED_CRON' | 'DIAGNOSTIC_RUN' | 'INITIAL_DISCOVERY' | 'SOURCE_REFRESH';
  status: 'RUNNING' | 'COMPLETED' | 'DEGRADED' | 'FAILED';
  sourcesChecked: number;
  urlsDiscovered: number;
  httpSuccessCount: number;
  httpFailureCount: number;
  claimsExtracted: number;
  changesDetected: number;
  notificationsCreated: number;
  summaryLog: string[];
  startedAt: string;
  completedAt: string | null;
}

export interface ChangeEventRecord {
  id: string;
  entityType: 'PROGRAM' | 'SCHOLARSHIP' | 'DEADLINE' | 'FUNDING' | 'REQUIREMENT' | 'SOURCE_STATUS';
  entityId: string;
  entityTitle: string;
  fieldChanged: string;
  previousValue: string | null;
  newValue: string;
  sourceUrl: string;
  isGenuineChange: boolean;
  detectedAt: string;
}

export interface SavedOpportunityRecord {
  id: string;
  userId: string;
  programId: string;
  applicationStatus: ApplicationStatus;
  privateNotes: string;
  priorityLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  savedAt: string;
  updatedAt: string;
}

export interface ApplicationTaskRecord {
  id: string;
  userId: string;
  programId: string | null;
  title: string;
  category: 'DOCUMENT' | 'EXAM' | 'SUPERVISOR_CONTACT' | 'PORTAL_SUBMISSION' | 'SCHOLARSHIP_ESSAY';
  dueDate: string | null;
  completed: boolean;
  syncedFromEvidence: boolean;
  userNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChecklistItemRecord {
  id: string;
  userId: string;
  programId: string | null;
  documentName: string;
  status: 'MISSING' | 'DRAFTING' | 'READY' | 'UPLOADED';
  sourceRequirement: string | null;
  userNotes: string;
  updatedAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  dedupeKey: string;
  category:
    | 'NEW_OPPORTUNITY'
    | 'FULLY_FUNDED_CONFIRMED'
    | 'ELIGIBILITY_CHANGE'
    | 'FUNDING_CHANGE'
    | 'DEADLINE_REMINDER'
    | 'BROKEN_LINK'
    | 'CONFLICT_DETECTED'
    | 'AUTOMATION_ALERT';
  title: string;
  message: string;
  sourceUrl: string | null;
  isUncertainDate: boolean;
  read: boolean;
  createdAt: string;
}

export interface EmailDeliveryRecord {
  id: string;
  userId: string;
  notificationId: string | null;
  recipientEmail: string;
  subject: string;
  provider: 'RESEND';
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED_PROVIDER_UNCONFIGURED';
  providerMsgId: string | null;
  errorMessage: string | null;
  attempts: number;
  createdAt: string;
}

export interface AuditLogRecord {
  id: string;
  userId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  details: string;
  createdAt: string;
}

export interface SystemHealthRecord {
  automationState: AutomationState;
  stateReason: string;
  cronSchedule: string;
  lastScheduledRunAt: string | null;
  lastSuccessfulRunAt: string | null;
  missedRunsCount: number;
  totalRequestsMade: number;
  totalBytesFetched: number;
  searchProviderEnabled: boolean;
  aiProviderEnabled: boolean;
  emailProviderEnabled: boolean;
  updatedAt: string;
}
