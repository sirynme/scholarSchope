import React from 'react';
import {
  ArrowRight,
  Bookmark,
  Calendar,
  CheckCircle2,
  Compass,
  ExternalLink,
  Info,
  ShieldCheck,
} from 'lucide-react';
import {
  ApplicationStatus,
  EligibilityResultRecord,
  InstitutionRecord,
  ProgramRecord,
  ResearchRunRecord,
  SavedOpportunityRecord,
  ScholarshipRecord,
  SourceRegistryRecord,
  SystemHealthRecord,
  UserProfileRecord,
  UserQualificationRecord,
  ApplicationTaskRecord,
  DocumentChecklistItemRecord,
} from '../lib/types';
import {
  buildRecommendedOpportunities,
  buildStudentNextSteps,
  computeStudentHomeMetrics,
  deriveStudentAutomationNotice,
  getProgramStudyDestination,
  JourneySectionId,
  mapDeadlineStatus,
  mapStudentFundingSummary,
  StudentPrimaryNavId,
} from '../lib/student-dashboard';

interface HomeViewProps {
  currentUser: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    onboardingCompleted: boolean;
  } | null;
  profile: UserProfileRecord | null;
  qualifications: UserQualificationRecord[];
  programs: ProgramRecord[];
  institutions: InstitutionRecord[];
  scholarships: ScholarshipRecord[];
  eligibilityResults: EligibilityResultRecord[];
  savedOpportunities: SavedOpportunityRecord[];
  tasks: ApplicationTaskRecord[];
  checklistItems: DocumentChecklistItemRecord[];
  systemHealth: SystemHealthRecord;
  latestRun: ResearchRunRecord | null;
  sources: SourceRegistryRecord[];
  onNavigate: (view: StudentPrimaryNavId, options?: { journeySection?: JourneySectionId; quickFilter?: string }) => void;
  onInspectProgram: (programId: string) => void;
  onSaveOrUpdateOpportunity: (programId: string, status?: ApplicationStatus, notes?: string) => Promise<void>;
}

export const HomeView: React.FC<HomeViewProps> = ({
  currentUser,
  profile,
  qualifications,
  programs,
  institutions,
  scholarships,
  eligibilityResults,
  savedOpportunities,
  tasks,
  checklistItems,
  systemHealth,
  latestRun,
  sources,
  onNavigate,
  onInspectProgram,
  onSaveOrUpdateOpportunity,
}) => {
  const metrics = React.useMemo(
    () =>
      computeStudentHomeMetrics({
        programs,
        institutions,
        scholarships,
        eligibilityResults,
        savedOpportunities,
        profile,
      }),
    [programs, institutions, scholarships, eligibilityResults, savedOpportunities, profile]
  );

  const recommended = React.useMemo(
    () =>
      buildRecommendedOpportunities({
        programs,
        institutions,
        scholarships,
        eligibilityResults,
        profile,
        limit: 6,
      }),
    [programs, institutions, scholarships, eligibilityResults, profile]
  );

  const nextSteps = React.useMemo(
    () =>
      buildStudentNextSteps({
        profile,
        qualifications,
        eligibilityResults,
        savedOpportunities,
        tasks,
        checklistItems,
        programs,
      }),
    [profile, qualifications, eligibilityResults, savedOpportunities, tasks, checklistItems, programs]
  );

  const automationNotice = React.useMemo(
    () =>
      deriveStudentAutomationNotice({
        systemHealth,
        latestRun,
        sources,
        programs,
      }),
    [systemHealth, latestRun, sources, programs]
  );

  const upcomingDeadlinesList = React.useMemo(() => {
    return programs
      .map((program) => ({
        program,
        deadline: mapDeadlineStatus(program),
        destination: getProgramStudyDestination(program, institutions, scholarships),
        funding: mapStudentFundingSummary(program, scholarships),
      }))
      .filter(
        (item) =>
          item.deadline.status === 'CLOSING_SOON' || item.deadline.status === 'OPEN'
      )
      .sort((a, b) => (a.deadline.daysRemaining ?? 9999) - (b.deadline.daysRemaining ?? 9999));
  }, [programs, institutions, scholarships]);

  const savedProgramIds = React.useMemo(
    () => new Set(savedOpportunities.map((s) => s.programId)),
    [savedOpportunities]
  );

  const firstName = currentUser?.fullName ? currentUser.fullName.split(' ')[0] : 'Student';

  return (
    <div className="space-y-8">
      {/* ==================================================================
          A & B. WELCOMING HERO & ONE PRIMARY ACTION ("Explore opportunities")
         ================================================================== */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-3xl">
          <div className="text-xs font-medium text-slate-500">
            ScholarScope · Pakistani Graduate Scholarship & Admission Guide
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Assalam-o-Alaikum, {firstName}. Find verified scholarships that fit your academic background.
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Compare official Master&apos;s and PhD programs in Computer Science and Microbiology across Germany, the United Kingdom, the United States, Japan, and China — with transparent funding breakdowns, Pakistani degree equivalence guidance, and direct links to official university portals.
          </p>
        </div>

        <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('explore')}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
          >
            <Compass className="w-4 h-4" />
            <span>Explore opportunities</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ==================================================================
          STUDENT-FRIENDLY AUTOMATION / SOURCE NOTICE (Only when relevant)
         ================================================================== */}
      {automationNotice.shouldShowNotice && (
        <section
          aria-label="Portal update notice"
          className="bg-amber-50/70 border border-amber-200/90 rounded-lg px-4 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-800"
        >
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-semibold text-slate-900">
                {automationNotice.headline}{' '}
                <span className="font-normal text-slate-600">
                  ({automationNotice.lastRunStateLabel} · {automationNotice.sourceHealthStateLabel})
                </span>
              </div>
              <p className="text-slate-700 leading-relaxed">
                {automationNotice.practicalImpact}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ==================================================================
          C. FOUR SIMPLE SUMMARY CARDS WITH EXPLICIT DEFINITIONS
         ================================================================== */}
      <section aria-label="Your scholarship summary">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Matching preferences */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-600">
                {metrics.matchingPreferences.title}
              </div>
              <div className="text-3xl font-bold font-mono text-slate-900 tabular-nums">
                {metrics.matchingPreferences.value}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {metrics.matchingPreferences.definition}
              </p>
              <button
                type="button"
                onClick={() => onNavigate('explore')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 hover:underline"
              >
                <span>View matching programs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 2: Verified full-funding information */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-600">
                {metrics.verifiedFullFunding.title}
              </div>
              <div className="text-3xl font-bold font-mono text-emerald-700 tabular-nums">
                {metrics.verifiedFullFunding.value}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {metrics.verifiedFullFunding.definition}
              </p>
              <button
                type="button"
                onClick={() => onNavigate('explore', { quickFilter: 'CONFIRMED_FULL_FUNDING' })}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline"
              >
                <span>Filter full-funding awards</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 3: Saved opportunities */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-600">
                {metrics.savedOpportunities.title}
              </div>
              <div className="text-3xl font-bold font-mono text-slate-900 tabular-nums">
                {metrics.savedOpportunities.value}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {metrics.savedOpportunities.definition}
              </p>
              <button
                type="button"
                onClick={() => onNavigate('journey', { journeySection: 'saved' })}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 hover:underline"
              >
                <span>Open My Journey</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 4: Upcoming deadlines */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-600">
                {metrics.upcomingDeadlines.title}
              </div>
              <div className="text-3xl font-bold font-mono text-slate-900 tabular-nums">
                {metrics.upcomingDeadlines.value}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                {metrics.upcomingDeadlines.definition}
              </p>
              <button
                type="button"
                onClick={() => onNavigate('journey', { journeySection: 'deadlines' })}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 hover:underline"
              >
                <span>See deadline calendar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================
          D. RECOMMENDED OPPORTUNITIES BASED ON PROFILE + SAVED STATUS
         ================================================================== */}
      <section className="space-y-4" aria-labelledby="home-recommended-heading">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h3 id="home-recommended-heading" className="text-lg font-bold text-slate-900">
              Recommended opportunities for your profile
            </h3>
            <p className="text-xs text-slate-600">
              Ranked using your target fields (
              {profile?.targetFields && profile.targetFields.length > 0
                ? profile.targetFields.slice(0, 3).join(', ')
                : 'Computer Science & Microbiology'}
              ), GPA ({profile?.gpaValue ?? '—'}/{profile?.gradingScale ?? '4.0'}), and verified scholarship evidence.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('explore')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 hover:underline shrink-0"
          >
            <span>Browse all {programs.length} opportunities</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recommended.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {recommended.map((item) => {
              const isSaved = savedProgramIds.has(item.program.id);
              return (
                <article
                  key={item.program.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors"
                >
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                      <span>
                        <strong className="text-slate-900">
                          {item.destination.institutionName}
                        </strong>{' '}
                        · {item.destination.destinationCountry}
                        {item.destination.isCrossBorderAdministered
                          ? ` (Administered in ${item.destination.administeringCountry})`
                          : ''}
                      </span>
                      <span
                        className={`font-semibold ${
                          item.eligibility.category === 'ELIGIBLE'
                            ? 'text-emerald-700'
                            : item.eligibility.category === 'POTENTIALLY_ELIGIBLE'
                            ? 'text-amber-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {item.eligibility.label}
                      </span>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => onInspectProgram(item.program.id)}
                        className="text-left text-base font-bold text-slate-900 hover:underline"
                      >
                        {item.program.title}
                      </button>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {item.program.degreeLevel} · {item.program.broadField || item.program.discipline} ·{' '}
                        <span className="font-semibold text-slate-900">
                          {item.funding.headline}
                        </span>
                      </div>
                    </div>

                    {/* Evidence-based explanation of relevance */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 space-y-1 text-xs">
                      <div className="font-semibold text-slate-800">
                        Why this suits your profile:
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                        {item.evidenceReasons.map((reason, idx) => (
                          <li key={idx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="text-slate-600">
                      <span>Deadline: </span>
                      <strong className="font-mono text-slate-900">
                        {item.deadline.formattedDate}
                      </strong>{' '}
                      <span className="text-slate-500">({item.deadline.label})</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSaveOrUpdateOpportunity(item.program.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border font-medium transition-colors ${
                          isSaved
                            ? 'bg-slate-100 border-slate-300 text-slate-900'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        <span>{isSaved ? 'Saved' : 'Save'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onInspectProgram(item.program.id)}
                        className="px-3 py-1.5 rounded-md bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors"
                      >
                        View details & evidence
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-900">
              No opportunities matched all of your current strict filters.
            </p>
            <p className="text-xs text-slate-600 max-w-lg mx-auto">
              Update your target subjects or funding preferences in My Profile, or browse the complete verified catalogue directly.
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('explore')}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800"
              >
                Explore all opportunities
              </button>
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Adjust My Profile
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ==================================================================
          E & F. VALIDATED UPCOMING DEADLINES + HELPFUL NEXT STEPS & SAVED SUMMARY
         ================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* E. Validated Upcoming Deadlines */}
        <section
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          aria-labelledby="home-deadlines-heading"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-700" />
              <h3 id="home-deadlines-heading" className="text-base font-bold text-slate-900">
                Approaching deadlines (Verified dates)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('journey', { journeySection: 'deadlines' })}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900 hover:underline"
            >
              Full calendar
            </button>
          </div>

          {upcomingDeadlinesList.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {upcomingDeadlinesList.slice(0, 6).map((item) => (
                <div
                  key={item.program.id}
                  className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => onInspectProgram(item.program.id)}
                      className="font-semibold text-slate-900 hover:underline text-left"
                    >
                      {item.program.title}
                    </button>
                    <div className="text-slate-500">
                      {item.destination.institutionName} · {item.destination.destinationCountry} ·{' '}
                      {item.funding.headline}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right font-mono">
                      <div className="font-semibold text-slate-900">
                        {item.deadline.formattedDate}
                      </div>
                      <div
                        className={`text-[11px] ${
                          item.deadline.status === 'CLOSING_SOON'
                            ? 'text-amber-700 font-semibold'
                            : 'text-emerald-700'
                        }`}
                      >
                        {item.deadline.label}
                      </div>
                    </div>
                    <a
                      href={item.program.officialProgramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open official website for ${item.program.title}`}
                      className="p-1.5 text-slate-500 hover:text-slate-900 border border-slate-200 rounded-md"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600 py-4">
              No future fixed deadlines are currently published; remaining programs operate on rolling admissions or await next-cycle dates.
            </p>
          )}
        </section>

        {/* F. What Should I Do Next? & Saved Snapshot */}
        <section
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-5"
          aria-labelledby="home-next-steps-heading"
        >
          <div className="border-b border-slate-200 pb-3">
            <h3 id="home-next-steps-heading" className="text-base font-bold text-slate-900">
              What should I do next?
            </h3>
            <p className="text-xs text-slate-600">
              Practical steps to move your scholarship applications forward.
            </p>
          </div>

          <div className="space-y-3">
            {nextSteps.map((step) => (
              <div
                key={step.id}
                className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                    {step.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 text-slate-600 shrink-0" />
                    )}
                    <span>{step.title}</span>
                  </div>
                </div>
                <p className="text-slate-600 leading-relaxed">{step.description}</p>
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate(step.targetView, {
                        journeySection: step.targetJourneySection,
                      })
                    }
                    className="inline-flex items-center gap-1 font-semibold text-slate-900 hover:underline"
                  >
                    <span>{step.actionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Saved Opportunities Quick Status / Helpful Empty State */}
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900">
                Your Saved Opportunities ({savedOpportunities.length})
              </span>
              {savedOpportunities.length > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigate('journey', { journeySection: 'saved' })}
                  className="font-semibold text-slate-700 hover:text-slate-900 hover:underline"
                >
                  Manage in My Journey
                </button>
              )}
            </div>

            {savedOpportunities.length > 0 ? (
              <div className="space-y-2">
                {savedOpportunities.slice(0, 3).map((saved) => {
                  const prog = programs.find((p) => p.id === saved.programId);
                  if (!prog) return null;
                  const dest = getProgramStudyDestination(prog, institutions, scholarships);
                  return (
                    <div
                      key={saved.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded border border-slate-200 bg-white text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => onInspectProgram(prog.id)}
                        className="font-medium text-slate-900 hover:underline text-left truncate"
                      >
                        {prog.title} ({dest.destinationCountry})
                      </button>
                      <span className="font-mono text-[11px] text-slate-600 shrink-0">
                        {saved.applicationStatus}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 text-xs text-slate-600 space-y-2">
                <p>
                  You haven&apos;t saved any opportunities yet. Bookmark programs that interest you to generate a personalized document checklist and deadline tracker.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('explore')}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
                >
                  Explore opportunities to save
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
