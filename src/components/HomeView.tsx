import React from 'react';
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Compass,
  Info,
  Search,
  Sparkles,
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
  buildStudentNextSteps,
  deriveStudentAutomationNotice,
  getProgramStudyDestination,
  JourneySectionId,
  mapDeadlineStatus,
  StudentPrimaryNavId,
} from '../lib/student-dashboard';
import { OPPORTUNITY_TYPE_META, type StudyField } from '../lib/opportunity-presentation';
import { OpportunityCard } from './OpportunityCard';

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
  onNavigate: (
    view: StudentPrimaryNavId,
    options?: { journeySection?: JourneySectionId; quickFilter?: string; searchQuery?: string }
  ) => void;
  onInspectProgram: (programId: string) => void;
  onSaveOrUpdateOpportunity: (programId: string, status?: ApplicationStatus, notes?: string) => Promise<void>;
  activeField: StudyField;
}

const COUNTRY_CHIPS = ['Germany', 'United Kingdom', 'United States', 'Japan', 'China'];

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
  activeField,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [legendOpen, setLegendOpen] = React.useState(false);

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
    () => deriveStudentAutomationNotice({ systemHealth, latestRun, sources, programs }),
    [systemHealth, latestRun, sources, programs]
  );

  const closingSoon = React.useMemo(() => {
    return programs
      .map((p) => ({ program: p, deadline: mapDeadlineStatus(p) }))
      .filter((x) => x.deadline.status === 'CLOSING_SOON' && !x.program.isExpired)
      .sort((a, b) => (a.deadline.daysRemaining ?? 9999) - (b.deadline.daysRemaining ?? 9999))
      .slice(0, 3);
  }, [programs]);

  const fullyFunded = React.useMemo(() => {
    return programs
      .filter((p) => p.fundingClassification === 'Fully Funded — Confirmed' && !p.isExpired)
      .slice(0, 6);
  }, [programs]);

  const savedProgramIds = React.useMemo(
    () => new Set(savedOpportunities.map((s) => s.programId)),
    [savedOpportunities]
  );

  const fullyFundedCount = programs.filter(
    (p) => p.fundingClassification === 'Fully Funded — Confirmed'
  ).length;

  const lastChecked = React.useMemo(() => {
    const dates = programs
      .map((p) => p.lastCheckedAt)
      .filter(Boolean)
      .sort()
      .reverse();
    if (!dates[0]) return null;
    return new Date(dates[0] as string).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, [programs]);

  const firstName = currentUser?.fullName ? currentUser.fullName.split(' ')[0] : null;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigate('explore', { searchQuery: searchQuery.trim() });
  };

  const goToProfile = () => onNavigate('profile');

  return (
    <div className="space-y-10">
      {/* ================= HERO — search first, human words ================= */}
      <section className="relative overflow-hidden rounded-3xl bg-stone-900 text-white px-6 py-10 md:px-12 md:py-14">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(600px 300px at 15% 20%, rgba(16,185,129,0.25), transparent 60%), radial-gradient(500px 280px at 85% 80%, rgba(251,191,36,0.18), transparent 60%)',
          }}
        />
        <div className="relative max-w-2xl space-y-5">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-emerald-300">
            <BadgeCheck className="w-4 h-4" />
            Verified {activeField.label} scholarships · for Pakistani students
          </div>
          <h2 className="text-3xl md:text-[2.75rem] font-bold tracking-tight leading-[1.1]">
            {firstName ? (
              <>
                Assalam-o-Alaikum, {firstName}.<br />
                Let's find your funded {activeField.label.toLowerCase()} degree.
              </>
            ) : (
              <>
                Find a funded {activeField.label.toLowerCase()} master's
                <br />
                or PhD abroad.
              </>
            )}
          </h2>
          <p className="text-[15px] text-stone-300 leading-relaxed max-w-xl">
            Every stipend, deadline and requirement here was checked against an official
            source — no guesswork, no sponsored listings. Tell us what you're looking for.
          </p>

          <form onSubmit={submitSearch} className="relative max-w-xl">
            <Search className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Try “DAAD”, “PhD ${activeField.label.toLowerCase()}”, “Japan”…`}
              aria-label="Search scholarships"
              className="w-full pl-12 pr-28 py-3.5 rounded-2xl bg-white/10 border border-white/20 text-white placeholder:text-stone-400 text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white/15"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-5 py-2 rounded-xl bg-emerald-400 text-stone-950 text-sm font-bold hover:bg-emerald-300 transition-colors"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-stone-400 mr-1">Popular:</span>
            {COUNTRY_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onNavigate('explore', { searchQuery: c })}
                className="px-3 py-1.5 text-xs font-semibold rounded-full border border-white/20 text-stone-200 hover:bg-white/10 transition-colors"
              >
                {c}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onNavigate('explore', { quickFilter: 'CONFIRMED_FULL_FUNDING' })}
              className="px-3 py-1.5 text-xs font-semibold rounded-full bg-amber-300/15 border border-amber-300/40 text-amber-200 hover:bg-amber-300/25 transition-colors"
            >
              ✨ Fully funded only
            </button>
          </div>
        </div>
      </section>

      {/* ================= Trust strip — plain numbers ================= */}
      <section className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-stone-600 px-1">
        <span>
          <strong className="text-stone-900 font-bold">{programs.length}</strong> opportunities
          tracked
        </span>
        <span>
          <strong className="text-emerald-700 font-bold">{fullyFundedCount}</strong> fully funded
        </span>
        <span>
          <strong className="text-stone-900 font-bold">{closingSoon.length}</strong> closing within
          60 days
        </span>
        {lastChecked && (
          <span className="text-stone-400">Figures last checked {lastChecked}</span>
        )}
      </section>

      {/* ================= Freshness notice (only when it matters) ================= */}
      {automationNotice.shouldShowNotice && (
        <section
          aria-label="Data freshness notice"
          className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 flex items-start gap-3 text-[13px] text-stone-700"
        >
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-stone-900">A quick heads-up:</strong>{' '}
            {automationNotice.practicalImpact}
          </p>
        </section>
      )}

      {/* ================= Closing soon ================= */}
      {closingSoon.length > 0 && (
        <section className="space-y-4" aria-labelledby="home-closing-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h3
                id="home-closing-heading"
                className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2"
              >
                <CalendarClock className="w-5 h-5 text-amber-600" />
                Closing soon — don't miss these
              </h3>
              <p className="text-[13px] text-stone-500 mt-1">
                Deadlines verified on official pages. If you're interested, start now.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('explore')}
              className="shrink-0 inline-flex items-center gap-1 text-[13px] font-semibold text-stone-900 hover:underline"
            >
              View all <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {closingSoon.map(({ program }) => (
              <OpportunityCard
                key={program.id}
                program={program}
                institutions={institutions}
                scholarships={scholarships}
                eligibilityResults={eligibilityResults}
                profile={profile}
                isSaved={savedProgramIds.has(program.id)}
                onInspect={onInspectProgram}
                onSave={onSaveOrUpdateOpportunity}
                onNavigateToProfile={goToProfile}
              />
            ))}
          </div>
        </section>
      )}

      {/* ================= Fully funded ================= */}
      <section className="space-y-4" aria-labelledby="home-funded-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h3
              id="home-funded-heading"
              className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2"
            >
              <Sparkles className="w-5 h-5 text-emerald-600" />
              Fully funded — tuition plus living costs
            </h3>
            <p className="text-[13px] text-stone-500 mt-1">
              These cover 100% of tuition and pay you a living stipend. The real deal.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('explore', { quickFilter: 'CONFIRMED_FULL_FUNDING' })}
            className="shrink-0 inline-flex items-center gap-1 text-[13px] font-semibold text-stone-900 hover:underline"
          >
            View all <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {fullyFunded.map((program) => (
            <OpportunityCard
              key={program.id}
              program={program}
              institutions={institutions}
              scholarships={scholarships}
              eligibilityResults={eligibilityResults}
              profile={profile}
              isSaved={savedProgramIds.has(program.id)}
              onInspect={onInspectProgram}
              onSave={onSaveOrUpdateOpportunity}
              onNavigateToProfile={goToProfile}
            />
          ))}
        </div>
      </section>

      {/* ================= What do the labels mean? ================= */}
      <section className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setLegendOpen((v) => !v)}
          aria-expanded={legendOpen}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-stone-50 transition-colors"
        >
          <span className="text-[15px] font-bold text-stone-900">
            What do these labels mean? <span className="font-normal text-stone-500">— not all “scholarships” work the same way</span>
          </span>
          <ChevronDown
            className={`w-5 h-5 text-stone-400 transition-transform ${legendOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {legendOpen && (
          <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.values(OPPORTUNITY_TYPE_META).map((meta) => {
              const Icon = meta.icon;
              return (
                <div
                  key={meta.label}
                  className="flex gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-100"
                >
                  <span
                    className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full border ${meta.badgeClass}`}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <div>
                    <div className="text-[13px] font-bold text-stone-900">{meta.label}</div>
                    <div className="text-xs text-stone-500 leading-relaxed mt-0.5">
                      {meta.whatItIs}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ================= Your next steps ================= */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-bold text-stone-900 tracking-tight">Your next steps</h3>
          <div className="space-y-3">
            {nextSteps.slice(0, 4).map((step) => (
              <div key={step.id} className="flex gap-3 items-start">
                {step.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <span className="w-5 h-5 rounded-full border-2 border-stone-300 shrink-0 mt-0.5" />
                )}
                <div className="text-[13px]">
                  <div className="font-semibold text-stone-900">{step.title}</div>
                  <div className="text-stone-500 leading-relaxed mt-0.5">{step.description}</div>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate(step.targetView, { journeySection: step.targetJourneySection })
                    }
                    className="inline-flex items-center gap-1 font-semibold text-stone-900 hover:underline mt-1"
                  >
                    {step.actionLabel} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-stone-900 tracking-tight">
              Saved ({savedOpportunities.length})
            </h3>
            {savedOpportunities.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigate('journey', { journeySection: 'saved' })}
                className="text-[13px] font-semibold text-stone-700 hover:text-stone-900 hover:underline"
              >
                Open My Journey
              </button>
            )}
          </div>
          {savedOpportunities.length > 0 ? (
            <div className="space-y-2">
              {savedOpportunities.slice(0, 4).map((saved) => {
                const prog = programs.find((p) => p.id === saved.programId);
                if (!prog) return null;
                const dest = getProgramStudyDestination(prog, institutions, scholarships);
                return (
                  <button
                    key={saved.id}
                    type="button"
                    onClick={() => onInspectProgram(prog.id)}
                    className="w-full text-left p-3 rounded-xl border border-stone-200 hover:border-stone-300 hover:bg-stone-50 transition-colors"
                  >
                    <div className="text-[13px] font-semibold text-stone-900 truncate">
                      {prog.title}
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5">
                      {dest.destinationCountry} · {saved.applicationStatus}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-[13px] text-stone-500 leading-relaxed space-y-3">
              <p>
                Nothing saved yet. Tap the bookmark on any opportunity and it lands here —
                with a document checklist and deadline reminders.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('explore')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 text-white text-[13px] font-semibold hover:bg-stone-700 transition-colors"
              >
                <Compass className="w-4 h-4" /> Browse opportunities
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
