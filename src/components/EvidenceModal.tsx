import React from 'react';
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  HelpCircle,
  Info,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  ApplicationStatus,
  EligibilityResultRecord,
  EvidenceClaimRecord,
  FetchAttemptRecord,
  InstitutionRecord,
  ProgramRecord,
  SavedOpportunityRecord,
  ScholarshipRecord,
  SourceRegistryRecord,
  UserProfileRecord,
} from '../lib/types';
import {
  getProgramStudyDestination,
  mapDeadlineStatus,
  mapStudentEligibilityCategory,
  mapStudentFundingSummary,
  mapStudentVerificationConfidence,
  OPPORTUNITY_TYPE_LABELS,
} from '../lib/student-dashboard';
import { OFFICIAL_LIVING_COST_BENCHMARKS } from '../lib/funding-engine';

interface EvidenceModalProps {
  program: ProgramRecord | null;
  institution?: InstitutionRecord;
  institutions?: InstitutionRecord[];
  scholarships: ScholarshipRecord[];
  claims: EvidenceClaimRecord[];
  eligibility?: EligibilityResultRecord;
  profile?: UserProfileRecord | null;
  savedRecord?: SavedOpportunityRecord;
  sources?: SourceRegistryRecord[];
  fetchAttempts?: FetchAttemptRecord[];
  onClose: () => void;
  onSaveOrUpdate: (programId: string, status?: ApplicationStatus, notes?: string) => Promise<void>;
  onNavigateToProfile?: () => void;
}

const CLAIM_TYPE_LABELS: Record<string, string> = {
  TUITION_COVERAGE: 'Tuition Coverage',
  STIPEND_AMOUNT: 'Living Stipend',
  MANDATORY_FEES: 'Mandatory Fees',
  LIVING_COST_BENCHMARK: 'Official Living-Cost Benchmark',
  ELIGIBILITY_CITIZENSHIP: 'Pakistani / International Eligibility',
  ELIGIBILITY_GPA: 'Minimum Academic Grade / GPA',
  ELIGIBILITY_LANGUAGE: 'English Language Requirement',
  DEADLINE_DATE: 'Application Deadline',
  SUPERVISOR_REQUIREMENT: 'Supervisor Contact Policy',
};

export const EvidenceModal: React.FC<EvidenceModalProps> = ({
  program,
  institution,
  institutions = [],
  scholarships,
  claims,
  eligibility,
  profile = null,
  savedRecord,
  sources = [],
  fetchAttempts = [],
  onClose,
  onSaveOrUpdate,
  onNavigateToProfile,
}) => {
  const [notes, setNotes] = React.useState(savedRecord?.privateNotes || '');
  const [status, setStatus] = React.useState<ApplicationStatus>(
    savedRecord?.applicationStatus || 'Researching'
  );
  const [saving, setSaving] = React.useState(false);
  const [saveFeedback, setSaveFeedback] = React.useState<string | null>(null);
  const [showTechnicalSources, setShowTechnicalSources] = React.useState(false);

  React.useEffect(() => {
    setNotes(savedRecord?.privateNotes || '');
    setStatus(savedRecord?.applicationStatus || 'Researching');
    setSaveFeedback(null);
    setShowTechnicalSources(false);
  }, [savedRecord, program?.id]);

  React.useEffect(() => {
    if (!program) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [program, onClose]);

  if (!program) return null;

  const allInstitutions =
    institutions.length > 0 ? institutions : institution ? [institution] : [];
  const destination = getProgramStudyDestination(program, allInstitutions, scholarships);
  const studentEligibility = mapStudentEligibilityCategory(program, eligibility, profile);
  const studentFunding = mapStudentFundingSummary(program, scholarships);
  const studentDeadline = mapDeadlineStatus(program);
  const studentVerification = mapStudentVerificationConfidence(program);

  const primaryScholarship = scholarships[0];
  const pkg = primaryScholarship?.fundingPackage;
  const req = program.requirement;

  const programDomain = (() => {
    try {
      return new URL(program.officialProgramUrl).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();

  const linkedSource = sources.find(
    (s) =>
      s.domain === programDomain ||
      programDomain.endsWith(`.${s.domain}`) ||
      s.domain.endsWith(`.${programDomain}`)
  );

  const recentAttempts = fetchAttempts
    .filter((f) =>
      linkedSource ? f.sourceId === linkedSource.id : f.url.includes(programDomain)
    )
    .slice(0, 5);

  const tuitionClaim = claims.find((c) => c.claimType === 'TUITION_COVERAGE');

  const handleSave = async () => {
    setSaving(true);
    setSaveFeedback(null);
    try {
      await onSaveOrUpdate(program.id, status, notes);
      setSaveFeedback(
        savedRecord
          ? 'Saved changes to your application tracker.'
          : 'Saved to My Journey and synced required documents.'
      );
    } finally {
      setSaving(false);
    }
  };

  const opportunityTypeLabel =
    (program.opportunityType && OPPORTUNITY_TYPE_LABELS[program.opportunityType]) ||
    (primaryScholarship?.opportunityType &&
      OPPORTUNITY_TYPE_LABELS[primaryScholarship.opportunityType]) ||
    'Graduate Scholarship / Program';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="opportunity-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative h-full w-full max-w-4xl overflow-y-auto bg-white border-l border-slate-200 p-6 md:p-8 flex flex-col gap-8">
        {/* Top Back Navigation Bar */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to opportunities</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {studentVerification.label}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close opportunity details"
              className="p-1.5 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-md transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ==================================================================
            1. OVERVIEW
           ================================================================== */}
        <section className="space-y-4" aria-labelledby="section-overview">
          <div className="space-y-2">
            <h3
              id="section-overview"
              className="text-xs font-semibold uppercase tracking-wider text-slate-500"
            >
              1. Overview
            </h3>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-900">{destination.institutionName}</span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-slate-800">
                Study Destination: {destination.destinationCountry}
              </span>
              {destination.isCrossBorderAdministered && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-600">
                    Administered in {destination.administeringCountry}
                  </span>
                </>
              )}
              {destination.city && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{destination.city}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono font-semibold text-slate-900">{program.degreeLevel}</span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-slate-800">
                {program.broadField || program.discipline}
              </span>
            </div>

            <h2
              id="opportunity-detail-title"
              className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight"
            >
              {program.title}
            </h2>

            <p className="text-xs text-slate-600 leading-relaxed">
              {opportunityTypeLabel}
              {primaryScholarship ? ` · Linked Award: ${primaryScholarship.name}` : ''} ·{' '}
              {studentVerification.explanation}
            </p>
          </div>

          {/* Key Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs">
            <div>
              <span className="text-slate-500 block">Your Eligibility Assessment</span>
              <span
                className={`mt-1 block font-semibold ${
                  studentEligibility.category === 'ELIGIBLE'
                    ? 'text-emerald-700'
                    : studentEligibility.category === 'NOT_ELIGIBLE'
                    ? 'text-red-700'
                    : studentEligibility.category === 'POTENTIALLY_ELIGIBLE'
                    ? 'text-amber-700'
                    : 'text-slate-700'
                }`}
              >
                {studentEligibility.label}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Funding Summary</span>
              <span className="mt-1 block font-semibold text-slate-900">
                {studentFunding.headline}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Application Deadline</span>
              <span className="mt-1 block font-mono font-semibold text-slate-900">
                {studentDeadline.formattedDate}{' '}
                <span className="font-sans font-normal text-slate-600">
                  ({studentDeadline.label})
                </span>
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Verification Confidence</span>
              <span
                className={`mt-1 block font-semibold ${
                  studentVerification.tier === 'CONFIRMED'
                    ? 'text-emerald-700'
                    : studentVerification.tier === 'UNAVAILABLE'
                    ? 'text-red-700'
                    : 'text-amber-700'
                }`}
              >
                {studentVerification.label}
              </span>
            </div>
          </div>

          {/* Official Links & Save Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-lg">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <a
                href={program.officialProgramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-slate-900 underline underline-offset-4 hover:text-slate-700"
              >
                <span>Official Program Website ({programDomain || 'official-portal'})</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              {program.officialApplicationUrl && (
                <a
                  href={program.officialApplicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900"
                >
                  <span>Official Application Portal</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="detail-app-status" className="text-xs text-slate-600 font-medium">
                Stage:
              </label>
              <select
                id="detail-app-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
                className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value="Researching">Researching</option>
                <option value="Preparing Documents">Preparing Documents</option>
                <option value="Ready to Apply">Ready to Apply</option>
                <option value="Submitted">Submitted</option>
                <option value="Interview">Interview</option>
                <option value="Offer Received">Offer Received</option>
                <option value="Accepted">Accepted</option>
                <option value="Rejected">Rejected</option>
              </select>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>{savedRecord ? 'Update Saved Opportunity' : 'Save Opportunity'}</span>
              </button>
            </div>
          </div>

          {saveFeedback && (
            <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
              <span>{saveFeedback}</span>
            </div>
          )}
        </section>

        {/* ==================================================================
            2. ELIGIBILITY REQUIREMENTS
           ================================================================== */}
        <section className="space-y-3" aria-labelledby="section-eligibility">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-2">
            <h3 id="section-eligibility" className="text-sm font-semibold text-slate-900">
              2. Eligibility requirements
            </h3>
            <span className="text-xs text-slate-600">
              Assessment:{' '}
              <strong
                className={
                  studentEligibility.category === 'ELIGIBLE'
                    ? 'text-emerald-700'
                    : studentEligibility.category === 'NOT_ELIGIBLE'
                    ? 'text-red-700'
                    : studentEligibility.category === 'POTENTIALLY_ELIGIBLE'
                    ? 'text-amber-700'
                    : 'text-slate-800'
                }
              >
                {studentEligibility.label}
              </strong>
            </span>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/70 space-y-2 text-xs">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-slate-900">
                  {studentEligibility.label} — {studentEligibility.shortExplanation}
                </p>
                <p className="text-slate-600">
                  ScholarScope never marks you as &ldquo;Not eligible&rdquo; simply because a profile field is blank or a source page did not state a numeric threshold. Only an explicit mismatch against a published rule results in &ldquo;Not eligible&rdquo;.
                </p>
              </div>
            </div>

            {studentEligibility.category === 'NOT_ASSESSED' && onNavigateToProfile && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateToProfile();
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                >
                  Complete My Profile to Check Eligibility
                </button>
              </div>
            )}
          </div>

          {eligibility && eligibility.decisions.length > 0 && (
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="py-2.5 px-3 font-semibold">Requirement</th>
                    <th className="py-2.5 px-3 font-semibold">Your Profile</th>
                    <th className="py-2.5 px-3 font-semibold">Published Rule</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold">What to Check Next</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {eligibility.decisions.map((d, idx) => {
                    const ruleLabel =
                      d.result === 'Likely Eligible'
                        ? 'Eligible'
                        : d.result === 'Not Eligible'
                        ? 'Not eligible'
                        : d.result === 'Insufficient Information'
                        ? 'Not assessed (profile incomplete)'
                        : 'Potentially eligible';
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3 font-medium text-slate-900">{d.criterion}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">{d.profileValue}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {d.publishedRequirement}
                        </td>
                        <td className="py-2.5 px-3 font-semibold">
                          <span
                            className={
                              d.result === 'Likely Eligible'
                                ? 'text-emerald-700'
                                : d.result === 'Not Eligible'
                                ? 'text-red-700'
                                : 'text-amber-700'
                            }
                          >
                            {ruleLabel}
                          </span>
                          {d.missingInformation && (
                            <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                              Note: {d.missingInformation}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{d.nextRecommendedAction}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {primaryScholarship && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border border-slate-200 rounded-lg p-4 bg-white text-xs">
              <div>
                <span className="text-slate-500 block">Pakistani Citizenship Rule</span>
                <span className="font-semibold text-slate-900">
                  {primaryScholarship.excludedCitizenships.includes('Pakistan')
                    ? 'Ineligible based on explicit citizenship rule'
                    : 'Open to Pakistani citizens'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Eligible Applicant Group</span>
                <span className="font-semibold text-slate-900">
                  {primaryScholarship.eligibleCountries.join(', ')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Residency & Age Limit</span>
                <span className="font-mono text-slate-800">
                  {req.residencyRule || 'Standard international rule'} · Max Age:{' '}
                  {req.maxAgeLimit ? `${req.maxAgeLimit} years` : 'No published age cap'}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* ==================================================================
            3. ACADEMIC REQUIREMENTS
           ================================================================== */}
        <section className="space-y-3" aria-labelledby="section-academic">
          <h3
            id="section-academic"
            className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2"
          >
            3. Academic requirements
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 border border-slate-200 rounded-lg p-4 bg-white text-xs">
            <div>
              <span className="text-slate-500 block">Required Prior Degree</span>
              <span className="font-semibold text-slate-900">
                {req.acceptedBackgrounds.length > 0
                  ? `Bachelor's or Master's in ${req.acceptedBackgrounds.slice(0, 2).join(' or ')}`
                  : '16-year BS / MSc / MPhil degree in relevant field'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Minimum Grade / GPA</span>
              <span className="font-mono font-semibold text-slate-900">
                {req.minGpa !== null
                  ? `${req.minGpa} on ${req.gradingScale || '4.0'} scale`
                  : req.minGradingClassification || 'Not explicitly stated on summary page'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">English Language Requirement</span>
              <span className="font-mono font-semibold text-slate-900">
                {req.ieltsMinScore === null && req.toeflMinScore === null
                  ? 'Check department exemption or medium-of-instruction certificate rules'
                  : `IELTS ${req.ieltsMinScore ?? '—'} / TOEFL iBT ${req.toeflMinScore ?? '—'}`}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">GRE / Standardized Test</span>
              <span className="font-semibold text-slate-900">{req.greRequirement}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Research Experience & Supervisor</span>
              <span className="font-semibold text-slate-900">
                Research experience: {req.researchExpRequired ? 'Required' : 'Helpful'} · Supervisor contact:{' '}
                {program.supervisorContactReq === 'REQUIRED'
                  ? 'Required before applying'
                  : program.supervisorContactReq === 'RECOMMENDED'
                  ? 'Recommended'
                  : 'Not required prior to application'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Program Duration & Mode</span>
              <span className="font-mono font-semibold text-slate-900">
                Full-time · {program.durationMonths ? `${program.durationMonths} months` : 'Standard duration'}
              </span>
            </div>
            <div className="sm:col-span-2 lg:col-span-3 pt-2 border-t border-slate-100">
              <span className="text-slate-500 block mb-1">
                Relevant Specializations & Prerequisite Subjects
              </span>
              <span className="text-slate-800">
                {program.specializations && program.specializations.length > 0
                  ? program.specializations.join(' · ')
                  : program.discipline}
                {req.prerequisiteCourses.length > 0 &&
                  ` · Prerequisites: ${req.prerequisiteCourses.join(', ')}`}
              </span>
            </div>
          </div>
        </section>

        {/* ==================================================================
            4. FUNDING BREAKDOWN
           ================================================================== */}
        <section className="space-y-3" aria-labelledby="section-funding">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-2">
            <h3 id="section-funding" className="text-sm font-semibold text-slate-900">
              4. Funding breakdown
            </h3>
            <span className="text-xs font-semibold text-slate-800">{studentFunding.headline}</span>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-4 text-xs">
            {pkg?.classificationExplanation && (
              <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded border border-slate-200">
                {pkg.classificationExplanation}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <span className="text-slate-500 block">1. Tuition Coverage</span>
                <span className="font-semibold text-slate-900 mt-0.5 block">
                  {studentFunding.tuitionText}
                </span>
                {tuitionClaim && (
                  <span className="text-[11px] font-mono text-slate-500 block mt-0.5">
                    Published tuition: {tuitionClaim.normalizedValue}
                  </span>
                )}
              </div>

              <div>
                <span className="text-slate-500 block">2. Living Stipend</span>
                <span className="font-mono font-semibold text-slate-900 mt-0.5 block">
                  {studentFunding.stipendText}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">3. Mandatory Fees</span>
                <span className="font-semibold text-slate-900 mt-0.5 block">
                  {studentFunding.mandatoryFeesText}
                </span>
                {program.applicationFeeAmount !== null && (
                  <span className="text-[11px] font-mono text-slate-500 block mt-0.5">
                    Application fee: {program.applicationFeeCurrency || ''}{' '}
                    {program.applicationFeeAmount}
                    {req.feeWaiverAvailable ? ' (waiver available)' : ''}
                  </span>
                )}
              </div>

              <div>
                <span className="text-slate-500 block">4. Health Insurance</span>
                <span className="font-semibold text-slate-900 mt-0.5 block">
                  {pkg?.healthInsuranceCovered === true
                    ? 'Covered by scholarship / fellowship'
                    : pkg?.healthInsuranceCovered === false
                    ? 'Not covered (student responsibility)'
                    : 'Not explicitly stated on summary page'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">5. Travel / Airfare Allowance</span>
                <span className="font-semibold text-slate-900 mt-0.5 block">
                  {pkg?.travelAllowanceCovered === true
                    ? 'Return airfare / travel allowance included'
                    : pkg?.travelAllowanceCovered === false
                    ? 'Not covered'
                    : 'Not explicitly stated on summary page'}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block">6. Housing / Accommodation</span>
                <span className="font-semibold text-slate-900 mt-0.5 block">
                  {pkg?.accommodationCovered === true
                    ? 'University dormitory or housing subsidy included'
                    : pkg?.accommodationCovered === false
                    ? 'Paid from living stipend / independent'
                    : 'Covered via living stipend or not separately stated'}
                </span>
              </div>
            </div>

            {/* National Living-Cost Benchmark Comparison */}
            <div className="pt-3 border-t border-slate-200 space-y-1.5">
              <span className="text-slate-500 block font-medium">
                7. Living-Cost Benchmark Comparison (Curated Policy Reference Constant — Not Live-Extracted from Program Page)
              </span>
              {pkg?.livingCostBenchmarkAnnual !== null &&
              pkg?.livingCostBenchmarkAnnual !== undefined ? (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded border border-slate-200">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-900">
                      Reference Benchmark Constant:{' '}
                      <span className="font-mono">
                        {pkg.livingCostBenchmarkCurr}{' '}
                        {pkg.livingCostBenchmarkAnnual.toLocaleString()}/year
                      </span>
                      {OFFICIAL_LIVING_COST_BENCHMARKS[destination.destinationCountry] && (
                        <span className="ml-1.5 text-[11px] font-normal text-slate-600">
                          · Category:{' '}
                          {
                            OFFICIAL_LIVING_COST_BENCHMARKS[destination.destinationCountry]
                              .benchmarkCategoryLabel
                          }
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Reference Policy Source: {pkg.livingCostBenchmarkSource || 'National reference standard'}{' '}
                      {pkg.livingCostBenchmarkDate ? `(Effective ${pkg.livingCostBenchmarkDate})` : ''}{' '}
                      · Curated reference constant used to evaluate stipend adequacy; not a live DOM excerpt from the university page.
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <span
                      className={`font-semibold ${
                        pkg.livingCostAdequacyStatus === 'ADEQUATE'
                          ? 'text-emerald-700'
                          : pkg.livingCostAdequacyStatus === 'INSUFFICIENT'
                          ? 'text-red-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {pkg.livingCostSurplusOrDeficit !== null &&
                      pkg.livingCostSurplusOrDeficit !== undefined
                        ? `${pkg.livingCostSurplusOrDeficit >= 0 ? '+' : ''}${
                            pkg.livingCostBenchmarkCurr
                          } ${pkg.livingCostSurplusOrDeficit.toLocaleString()}/yr (${
                            pkg.livingCostAdequacyStatus
                          })`
                        : pkg.livingCostAdequacyStatus}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-slate-600">
                  No scholarship stipend is linked for benchmark comparison, or living costs must be covered independently.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ==================================================================
            5. DEADLINES
           ================================================================== */}
        <section className="space-y-3" aria-labelledby="section-deadlines">
          <h3
            id="section-deadlines"
            className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2"
          >
            5. Deadlines
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border border-slate-200 rounded-lg p-4 bg-white text-xs">
            <div>
              <span className="text-slate-500 block">Program Closing Date</span>
              <span className="font-mono font-semibold text-slate-900">
                {program.deadlineDate ? program.deadlineDate.slice(0, 10) : 'Not yet published / Rolling'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Scholarship Closing Date</span>
              <span className="font-mono font-semibold text-slate-900">
                {primaryScholarship?.deadlineDate
                  ? primaryScholarship.deadlineDate.slice(0, 10)
                  : program.deadlineDate
                  ? program.deadlineDate.slice(0, 10)
                  : 'Check official scholarship portal'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Intake Term & Academic Cycle</span>
              <span className="font-semibold text-slate-900">
                {program.intakeTerm || 'Autumn Intake'} · {program.applicationCycle || '2026–2027'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Current Status</span>
              <span
                className={`font-mono font-semibold ${
                  studentDeadline.status === 'CLOSING_SOON'
                    ? 'text-amber-700'
                    : studentDeadline.status === 'OPEN'
                    ? 'text-emerald-700'
                    : 'text-slate-700'
                }`}
              >
                {studentDeadline.label}
              </span>
            </div>
          </div>
        </section>

        {/* ==================================================================
            6. REQUIRED DOCUMENTS
           ================================================================== */}
        <section className="space-y-3" aria-labelledby="section-documents">
          <h3
            id="section-documents"
            className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2"
          >
            6. Required documents ({req.requiredDocuments.length})
          </h3>
          <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-3">
            {req.requiredDocuments.length > 0 ? (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-800">
                {req.requiredDocuments.map((doc, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-2 p-2.5 rounded bg-slate-50 border border-slate-200"
                  >
                    <span className="inline-flex items-center gap-2 font-medium text-slate-900">
                      <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{doc}</span>
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {savedRecord ? 'Added to My Journey' : 'Save to track'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-600">
                Document checklist items are not separately itemized on the summary page. Save this opportunity to track standard graduate documents in My Journey.
              </p>
            )}
          </div>
        </section>

        {/* ==================================================================
            7. APPLICATION STEPS
           ================================================================== */}
        <section className="space-y-3" aria-labelledby="section-steps">
          <h3
            id="section-steps"
            className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2"
          >
            7. Application steps
          </h3>
          <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-3 text-xs text-slate-700">
            <ol className="list-decimal list-inside space-y-2 leading-relaxed">
              <li>
                <strong className="text-slate-900">Review official program requirements:</strong>{' '}
                Confirm your degree equivalence (such as 16-year HEC education for Pakistani BS/MSc holders) and language test validity on{' '}
                <a
                  href={program.officialProgramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium text-slate-900"
                >
                  {programDomain || 'the official website'}
                </a>
                .
              </li>
              <li>
                <strong className="text-slate-900">Supervisor contact:</strong>{' '}
                {program.supervisorContactReq === 'REQUIRED'
                  ? 'Contact a potential faculty supervisor with your CV and research proposal to secure provisional acceptance before submitting.'
                  : 'Prior supervisor acceptance is not mandatory before submitting the online application.'}
              </li>
              <li>
                <strong className="text-slate-900">Scholarship & admission submission:</strong>{' '}
                {primaryScholarship?.nominationProcessNote
                  ? primaryScholarship.nominationProcessNote
                  : primaryScholarship?.separateApplicationReq
                  ? `Submit both the university admission application and the separate ${primaryScholarship.name} application before the closing date.`
                  : 'Submit your graduate application via the official university portal; eligible applicants are considered for linked funding.'}
              </li>
            </ol>

            {/* Personal Notes box for saved tracker */}
            <div className="pt-3 border-t border-slate-200 space-y-1.5">
              <label htmlFor="student-private-notes" className="block text-xs font-semibold text-slate-800">
                Your Personal Application Notes (saved to My Journey)
              </label>
              <textarea
                id="student-private-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about professors to email, HEC attestation progress, or essay drafts..."
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>
        </section>

        {/* ==================================================================
            8. OFFICIAL SOURCES AND SUPPORTING EVIDENCE
           ================================================================== */}
        <section className="space-y-4" aria-labelledby="section-evidence">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-200 pb-2">
            <h3 id="section-evidence" className="text-sm font-semibold text-slate-900">
              8. Official sources and supporting evidence
            </h3>
            <span className="text-xs text-slate-600">
              {claims.length} verified source {claims.length === 1 ? 'excerpt' : 'excerpts'}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Every key fact shown above is backed by an excerpt from an official university or scholarship authority page. Verification status is shown beside each claim.
          </p>

          {/* Student-Readable Claims List */}
          <div className="space-y-3">
            {claims.map((claim) => {
              const friendlyClaimLabel =
                CLAIM_TYPE_LABELS[claim.claimType] || `${claim.claimType} (${claim.fieldName})`;
              const isConfirmed =
                claim.verificationStatus === 'Officially Confirmed' ||
                claim.verificationStatus === 'Cross-Verified';
              const isUnavailable =
                claim.verificationStatus === 'Unavailable' ||
                claim.verificationStatus === 'Conflicting Evidence';

              return (
                <div
                  key={claim.id}
                  className="border border-slate-200 rounded-lg p-4 space-y-2 bg-white"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="font-semibold text-slate-900">
                      {friendlyClaimLabel}:{' '}
                      <span className="font-mono font-normal text-slate-800">
                        {claim.normalizedValue}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <ShieldCheck
                        className={`w-3.5 h-3.5 ${
                          isConfirmed
                            ? 'text-emerald-700'
                            : isUnavailable
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }`}
                      />
                      <span
                        className={`font-semibold ${
                          isConfirmed
                            ? 'text-emerald-700'
                            : isUnavailable
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {claim.verificationStatus}
                      </span>
                    </div>
                  </div>

                  <blockquote className="text-xs text-slate-700 bg-slate-50 p-3 rounded border border-slate-200 leading-relaxed">
                    &ldquo;{claim.supportingExcerpt}&rdquo;
                  </blockquote>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span>
                      Source: <strong className="text-slate-700">{claim.sourceOrganization}</strong> (
                      {claim.sourceDomain}) · Checked {claim.retrievedAt.slice(0, 10)}
                    </span>
                    <a
                      href={claim.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-slate-700 underline hover:text-slate-900"
                    >
                      <span>View official page</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Expandable "Sources and verification" technical disclosure */}
          <div className="border border-slate-200 rounded-lg bg-slate-50/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTechnicalSources((prev) => !prev)}
              aria-expanded={showTechnicalSources}
              className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left text-xs font-semibold text-slate-800 hover:bg-slate-100/80 transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-slate-500" />
                <span>Sources and verification (Technical audit & cryptographic provenance)</span>
              </span>
              {showTechnicalSources ? (
                <ChevronUp className="w-4 h-4 text-slate-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {showTechnicalSources && (
              <div className="p-4 border-t border-slate-200 bg-white space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-slate-500 block">Registered Domain</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {linkedSource?.domain || programDomain || 'Official Portal'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Last Verified Timestamp</span>
                    <span className="font-mono text-slate-900">
                      {program.lastCheckedAt
                        ? program.lastCheckedAt.slice(0, 19).replace('T', ' ') + ' UTC'
                        : 'Not recorded'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Refresh Cadence</span>
                    <span className="font-mono text-slate-900">
                      {linkedSource?.refreshPolicy || 'DAILY'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Evidence Record Count</span>
                    <span className="font-mono text-slate-900">{claims.length} claims</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="text-[11px] font-semibold text-slate-700">
                    Cryptographic Excerpt Hashes (SHA-256) & Extraction Confidence
                  </div>
                  <div className="space-y-1.5 font-mono text-[11px] text-slate-600">
                    {claims.map((claim) => (
                      <div
                        key={`tech-${claim.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-slate-50 border border-slate-200"
                      >
                        <span>
                          {claim.claimType} ({claim.fieldName})
                        </span>
                        <span>
                          Method: {claim.verificationMethod} (
                          {Math.round(claim.evidenceQualityScore * 100)}%) · SHA-256:{' '}
                          {claim.excerptHash.slice(0, 16)}… · Versions: {claim.versions.length}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {recentAttempts.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="text-[11px] font-semibold text-slate-700">
                      Recent Automated Retrieval Log
                    </div>
                    {recentAttempts.map((att) => (
                      <div
                        key={att.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-600"
                      >
                        <span>
                          {att.attemptedAt.slice(0, 19).replace('T', ' ')} UTC ·{' '}
                          {att.httpStatus ? `Status ${att.httpStatus}` : 'Network Error'}
                        </span>
                        <span>
                          {att.responseTimeMs}ms ·{' '}
                          {att.bytesReceived !== null && att.bytesReceived > 0
                            ? `${(att.bytesReceived / 1024).toFixed(1)} KB`
                            : att.errorMessage || 'No payload'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
