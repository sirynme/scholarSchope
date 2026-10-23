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
} from '../lib/student-dashboard';
import {
  getOpportunityTypeMeta,
  getProgramTypeKey,
  humanDeadlinePill,
  humanFundingLine,
  humanRequirementsLine,
} from '../lib/opportunity-presentation';
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
  TUITION_COVERAGE: 'Tuition coverage',
  STIPEND_AMOUNT: 'Living stipend',
  MANDATORY_FEES: 'Mandatory fees',
  LIVING_COST_BENCHMARK: 'Living-cost benchmark',
  ELIGIBILITY_CITIZENSHIP: 'Who can apply',
  ELIGIBILITY_GPA: 'Grade requirement',
  ELIGIBILITY_LANGUAGE: 'English requirement',
  DEADLINE_DATE: 'Application deadline',
  SUPERVISOR_REQUIREMENT: 'Supervisor contact',
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-bold text-stone-900 tracking-tight border-b border-stone-200 pb-2">
      {children}
    </h3>
  );
}

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
      if (e.key === 'Escape') onClose();
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
  const funding = humanFundingLine(program, scholarships);
  const deadlinePill = humanDeadlinePill(program);
  const typeMeta = getOpportunityTypeMeta(getProgramTypeKey(program, scholarships));
  const TypeIcon = typeMeta.icon;

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
    .filter((f) => (linkedSource ? f.sourceId === linkedSource.id : f.url.includes(programDomain)))
    .slice(0, 5);

  const tuitionClaim = claims.find((c) => c.claimType === 'TUITION_COVERAGE');

  const handleSave = async () => {
    setSaving(true);
    setSaveFeedback(null);
    try {
      await onSaveOrUpdate(program.id, status, notes);
      setSaveFeedback(
        savedRecord ? 'Updated in your application tracker.' : 'Saved to My Journey.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-stone-950/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="opportunity-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative h-full w-full max-w-4xl overflow-y-auto bg-stone-50 border-l border-stone-200 flex flex-col">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-stone-50/95 backdrop-blur border-b border-stone-200 px-6 md:px-8 py-4 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-stone-700 hover:text-stone-900 px-3 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
              studentVerification.tier === 'CONFIRMED'
                ? 'text-emerald-700'
                : studentVerification.tier === 'UNAVAILABLE'
                ? 'text-red-700'
                : 'text-amber-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            {studentVerification.label}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="p-2 text-stone-500 hover:text-stone-900 border border-stone-200 bg-white rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 md:px-8 py-8 space-y-10 max-w-3xl">
          {/* ============ AT A GLANCE ============ */}
          <section className="space-y-5">
            <div className="space-y-3">
              <span
                title={typeMeta.whatItIs}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${typeMeta.badgeClass}`}
              >
                <TypeIcon className="w-4 h-4" />
                {typeMeta.label}
              </span>
              <p className="text-[13px] text-stone-500 leading-relaxed max-w-xl">
                {typeMeta.whatItIs}
              </p>
              <div className="text-[13px] text-stone-500 font-medium">
                {destination.institutionName} · {destination.destinationCountry}
                {destination.city ? ` · ${destination.city}` : ''} · {program.degreeLevel}
              </div>
              <h2
                id="opportunity-detail-title"
                className="text-2xl md:text-3xl font-bold text-stone-900 tracking-tight leading-tight"
              >
                {program.title}
              </h2>
              {primaryScholarship && (
                <p className="text-[13px] text-stone-500">
                  Funded through{' '}
                  <span className="font-semibold text-stone-800">{primaryScholarship.name}</span>
                </p>
              )}
            </div>

            {/* Key facts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white border border-stone-200 rounded-2xl p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
                  You get
                </div>
                <div
                  className={`text-sm font-bold ${funding.isFull ? 'text-emerald-800' : 'text-stone-900'}`}
                >
                  {funding.headline}
                </div>
              </div>
              <div className="bg-white border border-stone-200 rounded-2xl p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
                  You need
                </div>
                <div className="text-sm font-bold text-stone-900">
                  {humanRequirementsLine(program)}
                </div>
              </div>
              <div className="bg-white border border-stone-200 rounded-2xl p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
                  Deadline
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${deadlinePill.pillClass}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${deadlinePill.dotClass}`} />
                  {deadlinePill.text}
                </span>
                <div className="text-[11px] text-stone-400 mt-1.5">{deadlinePill.sub}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={program.officialProgramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-stone-900 text-white text-sm font-bold hover:bg-stone-700 transition-colors"
              >
                Official program page <ExternalLink className="w-4 h-4" />
              </a>
              {program.officialApplicationUrl && (
                <a
                  href={program.officialApplicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white border border-stone-300 text-stone-900 text-sm font-bold hover:bg-stone-100 transition-colors"
                >
                  Application portal <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            {/* Save */}
            <div className="bg-white border border-stone-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <label htmlFor="detail-app-status" className="text-[13px] text-stone-500 font-medium">
                  Track as:
                </label>
                <select
                  id="detail-app-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
                  className="px-3 py-2 text-[13px] font-medium bg-stone-50 border border-stone-300 rounded-xl text-stone-900"
                >
                  <option value="Researching">Researching</option>
                  <option value="Preparing Documents">Preparing documents</option>
                  <option value="Ready to Apply">Ready to apply</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Interview">Interview</option>
                  <option value="Offer Received">Offer received</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[13px] font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-xl transition-colors disabled:opacity-60"
              >
                <Bookmark className="w-4 h-4" />
                {savedRecord ? 'Update saved' : 'Save to My Journey'}
              </button>
            </div>
            {saveFeedback && (
              <div className="flex items-center gap-2 text-[13px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {saveFeedback}
              </div>
            )}
          </section>

          {/* ============ CAN YOU APPLY? ============ */}
          <section className="space-y-4">
            <SectionTitle>Can you apply?</SectionTitle>
            <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                <p className="text-[13px] text-stone-600 leading-relaxed">
                  <strong
                    className={
                      studentEligibility.category === 'ELIGIBLE'
                        ? 'text-emerald-700'
                        : studentEligibility.category === 'NOT_ELIGIBLE'
                        ? 'text-red-700'
                        : studentEligibility.category === 'POTENTIALLY_ELIGIBLE'
                        ? 'text-amber-700'
                        : 'text-stone-900'
                    }
                  >
                    {studentEligibility.label}
                  </strong>{' '}
                  — {studentEligibility.shortExplanation || 'Complete your profile for a personal check.'}
                </p>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                We only mark you "not eligible" on an explicit published rule — never just
                because a profile field is blank.
              </p>
              {studentEligibility.category === 'NOT_ASSESSED' && onNavigateToProfile && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateToProfile();
                  }}
                  className="px-4 py-2 text-[13px] font-bold text-white bg-stone-900 rounded-xl hover:bg-stone-700"
                >
                  Complete my profile to check
                </button>
              )}
            </div>

            {eligibility && eligibility.decisions.length > 0 && (
              <div className="overflow-x-auto border border-stone-200 rounded-2xl bg-white">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
                      <th className="py-3 px-4 font-semibold text-xs">Requirement</th>
                      <th className="py-3 px-4 font-semibold text-xs">You</th>
                      <th className="py-3 px-4 font-semibold text-xs">They ask for</th>
                      <th className="py-3 px-4 font-semibold text-xs">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {eligibility.decisions.map((d, idx) => (
                      <tr key={idx}>
                        <td className="py-3 px-4 font-medium text-stone-900">{d.criterion}</td>
                        <td className="py-3 px-4 text-stone-600">{d.profileValue}</td>
                        <td className="py-3 px-4 text-stone-600">{d.publishedRequirement}</td>
                        <td className="py-3 px-4 font-semibold">
                          <span
                            className={
                              d.result === 'Likely Eligible'
                                ? 'text-emerald-700'
                                : d.result === 'Not Eligible'
                                ? 'text-red-700'
                                : 'text-amber-700'
                            }
                          >
                            {d.result === 'Likely Eligible'
                              ? '✓ Eligible'
                              : d.result === 'Not Eligible'
                              ? '✕ Not eligible'
                              : d.result === 'Insufficient Information'
                              ? '○ Need more info'
                              : '◐ Possibly'}
                          </span>
                          {d.missingInformation && (
                            <div className="text-[11px] font-normal text-stone-400 mt-0.5">
                              {d.missingInformation}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {primaryScholarship && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
                <div className="bg-white border border-stone-200 rounded-2xl p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1">
                    For Pakistanis
                  </div>
                  <div className="font-semibold text-stone-900">
                    {primaryScholarship.excludedCitizenships.includes('Pakistan')
                      ? 'Not open to Pakistanis'
                      : '✓ Open to Pakistanis'}
                  </div>
                </div>
                <div className="bg-white border border-stone-200 rounded-2xl p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1">
                    Who it's for
                  </div>
                  <div className="font-medium text-stone-800">
                    {primaryScholarship.eligibleCountries.slice(0, 3).join(', ')}
                    {primaryScholarship.eligibleCountries.length > 3 && ' + more'}
                  </div>
                </div>
                <div className="bg-white border border-stone-200 rounded-2xl p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1">
                    Age limit
                  </div>
                  <div className="font-medium text-stone-800">
                    {req.maxAgeLimit ? `${req.maxAgeLimit} years` : 'None published'}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ============ WHAT YOU NEED ============ */}
          <section className="space-y-4">
            <SectionTitle>What you need</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
              {[
                ['Previous degree', req.acceptedBackgrounds.length > 0
                  ? req.acceptedBackgrounds.slice(0, 2).join(' / ')
                  : 'BS / MSc in a relevant field'],
                ['Grades', req.minGpa !== null
                  ? `${req.minGpa} on ${req.gradingScale || '4.0'}`
                  : req.minGradingClassification || 'Not stated — check official page'],
                ['English', req.ieltsMinScore === null && req.toeflMinScore === null
                  ? 'Check exemption / medium-of-instruction rules'
                  : `IELTS ${req.ieltsMinScore ?? '—'} / TOEFL ${req.toeflMinScore ?? '—'}`],
                ['GRE / tests', req.greRequirement || 'Not required'],
                ['Research & supervisor', `Research: ${req.researchExpRequired ? 'required' : 'helpful'} · Supervisor: ${
                  program.supervisorContactReq === 'REQUIRED' ? 'contact first' : program.supervisorContactReq === 'RECOMMENDED' ? 'recommended' : 'not needed yet'
                }`],
                ['Duration', program.durationMonths ? `${program.durationMonths} months, full-time` : 'Full-time'],
              ].map(([label, value]) => (
                <div key={label} className="bg-white border border-stone-200 rounded-2xl p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1">
                    {label}
                  </div>
                  <div className="font-semibold text-stone-900">{value}</div>
                </div>
              ))}
            </div>
            {((program.specializations && program.specializations.length > 0) || req.prerequisiteCourses.length > 0) && (
              <p className="text-[13px] text-stone-500 leading-relaxed">
                <strong className="text-stone-800">Relevant areas:</strong>{' '}
                {[...(program.specializations || []), ...req.prerequisiteCourses.map((c) => `needs ${c}`)]
                  .slice(0, 6)
                  .join(' · ')}
              </p>
            )}
          </section>

          {/* ============ WHAT YOU GET ============ */}
          <section className="space-y-4">
            <SectionTitle>What you get</SectionTitle>
            <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
              {pkg?.classificationExplanation && (
                <p className="text-[13px] text-stone-600 leading-relaxed bg-stone-50 p-4 rounded-xl border border-stone-100">
                  {pkg.classificationExplanation}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
                <div>
                  <div className="text-stone-400 font-medium mb-0.5">Tuition</div>
                  <div className="font-semibold text-stone-900">{studentFunding.tuitionText}</div>
                  {tuitionClaim && (
                    <div className="text-[11px] text-stone-400 mt-0.5">
                      Published: {tuitionClaim.normalizedValue}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-stone-400 font-medium mb-0.5">Living stipend</div>
                  <div className="font-semibold text-stone-900">{studentFunding.stipendText}</div>
                </div>
                <div>
                  <div className="text-stone-400 font-medium mb-0.5">University fees</div>
                  <div className="font-semibold text-stone-900">{studentFunding.mandatoryFeesText}</div>
                  {program.applicationFeeAmount !== null && (
                    <div className="text-[11px] text-stone-400 mt-0.5">
                      Application fee: {program.applicationFeeCurrency || ''} {program.applicationFeeAmount}
                      {req.feeWaiverAvailable ? ' (waiver available)' : ''}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-stone-400 font-medium mb-0.5">Health insurance</div>
                  <div className="font-semibold text-stone-900">
                    {pkg?.healthInsuranceCovered === true ? '✓ Covered'
                      : pkg?.healthInsuranceCovered === false ? '✕ Not covered' : 'Not stated'}
                  </div>
                </div>
                <div>
                  <div className="text-stone-400 font-medium mb-0.5">Travel</div>
                  <div className="font-semibold text-stone-900">
                    {pkg?.travelAllowanceCovered === true ? '✓ Included'
                      : pkg?.travelAllowanceCovered === false ? '✕ Not covered' : 'Not stated'}
                  </div>
                </div>
                <div>
                  <div className="text-stone-400 font-medium mb-0.5">Housing</div>
                  <div className="font-semibold text-stone-900">
                    {pkg?.accommodationCovered === true ? '✓ Included'
                      : pkg?.accommodationCovered === false ? 'From your stipend' : 'Not stated separately'}
                  </div>
                </div>
              </div>

              {pkg?.livingCostBenchmarkAnnual !== null && pkg?.livingCostBenchmarkAnnual !== undefined && (
                <div className="pt-4 border-t border-stone-100">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-2">
                    Can you actually live on it?
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-50 p-4 rounded-xl border border-stone-100">
                    <div className="text-[13px] text-stone-600">
                      Official cost of living: <strong className="text-stone-900">
                        {pkg.livingCostBenchmarkCurr} {pkg.livingCostBenchmarkAnnual.toLocaleString()}/yr
                      </strong>
                      {OFFICIAL_LIVING_COST_BENCHMARKS[destination.destinationCountry] && (
                        <span className="text-stone-400"> · {OFFICIAL_LIVING_COST_BENCHMARKS[destination.destinationCountry].benchmarkCategoryLabel}</span>
                      )}
                    </div>
                    <span
                      className={`font-bold text-sm ${
                        pkg.livingCostAdequacyStatus === 'ADEQUATE' ? 'text-emerald-700'
                        : pkg.livingCostAdequacyStatus === 'INSUFFICIENT' ? 'text-red-700' : 'text-amber-700'
                      }`}
                    >
                      {pkg.livingCostSurplusOrDeficit !== null && pkg.livingCostSurplusOrDeficit !== undefined
                        ? `${pkg.livingCostSurplusOrDeficit >= 0 ? '+' : ''}${pkg.livingCostBenchmarkCurr} ${pkg.livingCostSurplusOrDeficit.toLocaleString()}/yr`
                        : pkg.livingCostAdequacyStatus}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ============ WHEN TO APPLY ============ */}
          <section className="space-y-4">
            <SectionTitle>When to apply</SectionTitle>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-[13px]">
              <div className="bg-white border border-stone-200 rounded-2xl p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1">Program deadline</div>
                <div className="font-bold text-stone-900">
                  {program.deadlineDate ? program.deadlineDate.slice(0, 10) : 'Rolling'}
                </div>
              </div>
              <div className="bg-white border border-stone-200 rounded-2xl p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1">Scholarship deadline</div>
                <div className="font-bold text-stone-900">
                  {primaryScholarship?.deadlineDate ? primaryScholarship.deadlineDate.slice(0, 10)
                    : program.deadlineDate ? program.deadlineDate.slice(0, 10) : 'Check portal'}
                </div>
              </div>
              <div className="bg-white border border-stone-200 rounded-2xl p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1">Intake</div>
                <div className="font-bold text-stone-900">{program.intakeTerm || 'Autumn'}</div>
              </div>
              <div className="bg-white border border-stone-200 rounded-2xl p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1">Status</div>
                <div className={`font-bold ${studentDeadline.status === 'CLOSING_SOON' ? 'text-amber-700' : studentDeadline.status === 'OPEN' ? 'text-emerald-700' : 'text-stone-700'}`}>
                  {studentDeadline.label}
                </div>
              </div>
            </div>
          </section>

          {/* ============ DOCUMENTS ============ */}
          <section className="space-y-4">
            <SectionTitle>Documents you'll need ({req.requiredDocuments.length})</SectionTitle>
            {req.requiredDocuments.length > 0 ? (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {req.requiredDocuments.map((doc, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-stone-200 text-[13px] font-medium text-stone-800"
                  >
                    <FileText className="w-4 h-4 text-stone-400 shrink-0" />
                    {doc}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-stone-500">
                No separate list published — save this opportunity and we'll track the standard
                graduate documents for you in My Journey.
              </p>
            )}
          </section>

          {/* ============ HOW TO APPLY ============ */}
          <section className="space-y-4">
            <SectionTitle>How to apply</SectionTitle>
            <ol className="space-y-3">
              {[
                `Check the official requirements — degree equivalence and English test rules — on the program page.`,
                program.supervisorContactReq === 'REQUIRED'
                  ? 'Contact a potential supervisor with your CV and proposal before applying — it is required.'
                  : 'No need to contact a supervisor before applying.',
                primaryScholarship?.nominationProcessNote
                  ? primaryScholarship.nominationProcessNote
                  : primaryScholarship?.separateApplicationReq
                  ? `Apply twice: once for university admission, once for the ${primaryScholarship.name} — before the deadline.`
                  : 'Apply through the official portal; eligible applicants are considered for funding automatically.',
              ].map((step, i) => (
                <li key={i} className="flex gap-3.5 bg-white border border-stone-200 rounded-2xl p-4">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-stone-900 text-white text-[13px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <p className="text-[13px] text-stone-700 leading-relaxed pt-0.5">{step}</p>
                </li>
              ))}
            </ol>
            <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-2">
              <label htmlFor="student-private-notes" className="block text-[13px] font-bold text-stone-900">
                Your notes
              </label>
              <textarea
                id="student-private-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Professors to email, HEC attestation progress, essay drafts…"
                className="w-full p-3 text-[13px] bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-900"
              />
            </div>
          </section>

          {/* ============ HOW WE VERIFIED THIS ============ */}
          <section className="space-y-4">
            <SectionTitle>How we verified this</SectionTitle>
            <p className="text-[13px] text-stone-500 leading-relaxed">
              Every key fact above is backed by a quote from an official page. Nothing here is
              guessed.
            </p>
            <div className="space-y-3">
              {claims.map((claim) => {
                const label = CLAIM_TYPE_LABELS[claim.claimType] || claim.claimType;
                const confirmed =
                  claim.verificationStatus === 'Officially Confirmed' ||
                  claim.verificationStatus === 'Cross-Verified';
                const bad =
                  claim.verificationStatus === 'Unavailable' ||
                  claim.verificationStatus === 'Conflicting Evidence';
                return (
                  <div key={claim.id} className="border border-stone-200 rounded-2xl p-4 space-y-2.5 bg-white">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[13px] font-bold text-stone-900">
                        {label}: <span className="font-medium text-stone-700">{claim.normalizedValue}</span>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${confirmed ? 'text-emerald-700' : bad ? 'text-red-700' : 'text-amber-700'}`}>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {claim.verificationStatus}
                      </span>
                    </div>
                    <blockquote className="text-[13px] text-stone-600 bg-stone-50 p-3.5 rounded-xl border border-stone-100 leading-relaxed">
                      “{claim.supportingExcerpt}”
                    </blockquote>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-400">
                      <span>
                        <strong className="text-stone-600">{claim.sourceOrganization}</strong> · checked {claim.retrievedAt.slice(0, 10)}
                      </span>
                      <a
                        href={claim.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-stone-600 underline hover:text-stone-900"
                      >
                        Official page <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Technical disclosure */}
            <div className="border border-stone-200 rounded-2xl bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setShowTechnicalSources((v) => !v)}
                aria-expanded={showTechnicalSources}
                className="w-full flex items-center justify-between gap-4 px-5 py-3.5 text-left text-[13px] font-semibold text-stone-800 hover:bg-stone-50 transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-stone-400" />
                  Technical audit trail
                </span>
                {showTechnicalSources ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showTechnicalSources && (
                <div className="p-5 border-t border-stone-200 space-y-4 text-xs text-stone-500">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div><div className="font-semibold text-stone-400 text-[11px]">Domain</div><div className="font-mono text-stone-800">{linkedSource?.domain || programDomain}</div></div>
                    <div><div className="font-semibold text-stone-400 text-[11px]">Last checked</div><div className="font-mono text-stone-800">{program.lastCheckedAt ? program.lastCheckedAt.slice(0, 10) : '—'}</div></div>
                    <div><div className="font-semibold text-stone-400 text-[11px]">Refresh</div><div className="font-mono text-stone-800">{linkedSource?.refreshPolicy || 'DAILY'}</div></div>
                    <div><div className="font-semibold text-stone-400 text-[11px]">Evidence records</div><div className="font-mono text-stone-800">{claims.length}</div></div>
                  </div>
                  {recentAttempts.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="font-semibold text-stone-700">Recent page checks</div>
                      {recentAttempts.map((att) => (
                        <div key={att.id} className="flex justify-between gap-2 font-mono text-[11px]">
                          <span>{att.attemptedAt.slice(0, 10)} · {att.httpStatus ? `HTTP ${att.httpStatus}` : 'network error'}</span>
                          <span>{att.responseTimeMs}ms</span>
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
    </div>
  );
};
