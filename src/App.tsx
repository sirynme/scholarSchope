import React from 'react';
import {
  Bookmark,
  Compass,
  GraduationCap,
  Home,
  Lock,
  Shield,
  User,
} from 'lucide-react';
import {
  ApplicationStatus,
  ApplicationTaskRecord,
  AuditLogRecord,
  CountryCoverageMetric,
  DocumentChecklistItemRecord,
  EligibilityResultRecord,
  EvidenceClaimRecord,
  FetchAttemptRecord,
  InstitutionRecord,
  JobQueueItemRecord,
  NotificationRecord,
  ProgramRecord,
  ResearchRunRecord,
  SavedOpportunityRecord,
  ScholarshipRecord,
  SourceRegistryRecord,
  SourceSnapshotRecord,
  SystemHealthRecord,
  UserProfileRecord,
  UserQualificationRecord,
} from './lib/types';
import {
  CatalogueFilterState,
  DEFAULT_CATALOGUE_FILTERS,
  JourneySectionId,
  resolveNavigationStateFromQuery,
  StudentPrimaryNavId,
} from './lib/student-dashboard';
import { HomeView } from './components/HomeView';
import { ExploreOpportunitiesView } from './components/ExploreOpportunitiesView';
import { MyJourneyView } from './components/MyJourneyView';
import { ProfileView } from './components/ProfileView';
import { AdminAndSourcesView } from './components/AdminAndSourcesView';
import { EvidenceModal } from './components/EvidenceModal';
import { AuthModal } from './components/AuthModal';

export default function App() {
  const [loading, setLoading] = React.useState(true);
  const [runningDiscovery, setRunningDiscovery] = React.useState(false);
  const [authModalOpen, setAuthModalOpen] = React.useState(false);
  const [selectedProgramId, setSelectedProgramId] = React.useState<string | null>(null);

  // Persisted State from Server
  const [currentUser, setCurrentUser] = React.useState<{
    id: string;
    email: string;
    fullName: string;
    role: string;
    onboardingCompleted: boolean;
  } | null>(null);
  const [availableAccounts, setAvailableAccounts] = React.useState<
    Array<{ id: string; email: string; fullName: string; role: string }>
  >([]);
  const [profile, setProfile] = React.useState<UserProfileRecord | null>(null);
  const [qualifications, setQualifications] = React.useState<UserQualificationRecord[]>([]);
  const [institutions, setInstitutions] = React.useState<InstitutionRecord[]>([]);
  const [programs, setPrograms] = React.useState<ProgramRecord[]>([]);
  const [scholarships, setScholarships] = React.useState<ScholarshipRecord[]>([]);
  const [sources, setSources] = React.useState<SourceRegistryRecord[]>([]);
  const [fetchAttempts, setFetchAttempts] = React.useState<FetchAttemptRecord[]>([]);
  const [snapshots, setSnapshots] = React.useState<SourceSnapshotRecord[]>([]);
  const [claims, setClaims] = React.useState<EvidenceClaimRecord[]>([]);
  const [eligibilityResults, setEligibilityResults] = React.useState<EligibilityResultRecord[]>([]);
  const [savedOpportunities, setSavedOpportunities] = React.useState<SavedOpportunityRecord[]>([]);
  const [tasks, setTasks] = React.useState<ApplicationTaskRecord[]>([]);
  const [checklistItems, setChecklistItems] = React.useState<DocumentChecklistItemRecord[]>([]);
  const [notifications, setNotifications] = React.useState<NotificationRecord[]>([]);
  const [researchRuns, setResearchRuns] = React.useState<ResearchRunRecord[]>([]);
  const [jobQueue, setJobQueue] = React.useState<JobQueueItemRecord[]>([]);
  const [auditLogs, setAuditLogs] = React.useState<AuditLogRecord[]>([]);
  const [countryCoverage, setCountryCoverage] = React.useState<CountryCoverageMetric[]>([]);
  const [systemHealth, setSystemHealth] = React.useState<SystemHealthRecord>({
    automationState: 'Active',
    stateReason: 'Initializing...',
    cronSchedule: '0 4 * * *',
    lastScheduledRunAt: null,
    lastSuccessfulRunAt: null,
    missedRunsCount: 0,
    totalRequestsMade: 0,
    totalBytesFetched: 0,
    searchProviderEnabled: false,
    aiProviderEnabled: false,
    emailProviderEnabled: false,
    updatedAt: new Date().toISOString(),
  });

  // Navigation & Preserved Filter State
  const [activeView, setActiveView] = React.useState<StudentPrimaryNavId>('home');
  const [journeySection, setJourneySection] = React.useState<JourneySectionId>('saved');
  const [catalogueFilters, setCatalogueFilters] = React.useState<CatalogueFilterState>(() => ({
    ...DEFAULT_CATALOGUE_FILTERS,
  }));
  const [cataloguePage, setCataloguePage] = React.useState<number>(1);
  const [unauthorizedAdminBanner, setUnauthorizedAdminBanner] = React.useState<boolean>(false);
  const [bootstrapError, setBootstrapError] = React.useState<string | null>(null);

  const fetchBootstrap = React.useCallback(async () => {
    setBootstrapError(null);
    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Server returned HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.authenticated) {
        setCurrentUser(null);
        setAvailableAccounts(data.availableTestAccounts || []);
        setLoading(false);
        return;
      }
      setCurrentUser(data.user);
      setAvailableAccounts(data.availableAccounts || []);
      setProfile(data.profile || null);
      setQualifications(data.qualifications || []);
      setInstitutions(data.institutions || []);
      setPrograms(data.programs || []);
      setScholarships(data.scholarships || []);
      setSources(data.sources || []);
      setFetchAttempts(data.fetchAttempts || []);
      setSnapshots(data.snapshots || []);
      setClaims(data.claims || []);
      setEligibilityResults(data.eligibilityResults || []);
      setSavedOpportunities(data.savedOpportunities || []);
      setTasks(data.tasks || []);
      setChecklistItems(data.checklistItems || []);
      setNotifications(data.notifications || []);
      setResearchRuns(data.researchRuns || []);
      setJobQueue(data.jobQueue || []);
      setAuditLogs(data.auditLogs || []);
      setCountryCoverage(data.countryCoverage || []);
      if (data.systemHealth) setSystemHealth(data.systemHealth);

      // Resolve initial or updated URL route with actual role knowledge
      if (typeof window !== 'undefined') {
        const navState = resolveNavigationStateFromQuery(
          window.location.search,
          data.user?.role === 'admin'
        );
        setActiveView(navState.activeView);
        setUnauthorizedAdminBanner(navState.unauthorizedAdminAttempt);
        if (navState.impliedJourneySection) {
          setJourneySection(navState.impliedJourneySection);
        }
        if (navState.impliedSubject || navState.impliedCountry) {
          setCatalogueFilters((prev) => ({
            ...prev,
            subject: navState.impliedSubject || prev.subject,
            country: navState.impliedCountry || prev.country,
          }));
        }
      }
    } catch (err: any) {
      console.error('Failed to load bootstrap state:', err);
      setBootstrapError(
        err?.message ||
          'Unable to connect to the ScholarScope server. Check your internet connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchBootstrap();
  }, [fetchBootstrap]);

  // Keep URL query synchronized with activeView, filters, and journeySection
  React.useEffect(() => {
    if (typeof window === 'undefined' || loading) return;
    const params = new URLSearchParams();
    params.set('view', activeView);
    if (activeView === 'explore') {
      if (catalogueFilters.country !== 'ALL') {
        params.set('country', catalogueFilters.country);
      }
      if (catalogueFilters.subject !== 'ALL') {
        params.set('field', catalogueFilters.subject);
      }
    } else if (activeView === 'journey') {
      params.set('section', journeySection);
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [activeView, catalogueFilters.country, catalogueFilters.subject, journeySection, loading]);

  const handleNavigate = (
    targetView: StudentPrimaryNavId,
    options?: { journeySection?: JourneySectionId; quickFilter?: string }
  ) => {
    if (targetView === 'admin' && currentUser?.role !== 'admin') {
      setUnauthorizedAdminBanner(true);
      setActiveView('home');
      return;
    }
    setUnauthorizedAdminBanner(false);
    setActiveView(targetView);
    if (options?.journeySection) {
      setJourneySection(options.journeySection);
    }
    if (options?.quickFilter === 'CONFIRMED_FULL_FUNDING') {
      setCatalogueFilters((prev) => ({
        ...prev,
        fundingCoverage: 'CONFIRMED_FULL_FUNDING',
      }));
      setCataloguePage(1);
    }
  };

  const handleTriggerDiscoveryRun = async () => {
    if (currentUser?.role !== 'admin') return;
    setRunningDiscovery(true);
    try {
      await fetch('/api/research/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxSources: 25 }),
      });
      await fetchBootstrap();
    } finally {
      setRunningDiscovery(false);
    }
  };

  const handleSaveOrUpdateOpportunity = async (
    programId: string,
    applicationStatus?: ApplicationStatus,
    privateNotes?: string
  ) => {
    const res = await fetch('/api/saved-opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ programId, applicationStatus, privateNotes }),
    });
    if (res.ok) {
      const data = await res.json();
      setSavedOpportunities(data.savedOpportunities || []);
      if (data.checklistItems) setChecklistItems(data.checklistItems);
    }
  };

  const handleDeleteSavedOpportunity = async (programId: string) => {
    const res = await fetch(`/api/saved-opportunities/${programId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      const data = await res.json();
      setSavedOpportunities(data.savedOpportunities || []);
    }
  };

  const handleSaveProfile = async (updated: Partial<UserProfileRecord>) => {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Could not save profile changes. Please verify your inputs and try again.');
    }
    await fetchBootstrap();
  };

  const handleAddQualification = async (q: {
    title: string;
    institution: string;
    category: string;
    details: string;
    completedDate: string;
  }) => {
    const res = await fetch('/api/profile/qualifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(q),
    });
    if (res.ok) await fetchBootstrap();
  };

  const handleDeleteQualification = async (id: string) => {
    const res = await fetch(`/api/profile/qualifications/${id}`, { method: 'DELETE' });
    if (res.ok) await fetchBootstrap();
  };

  const handleCreateTask = async (task: {
    title: string;
    category: ApplicationTaskRecord['category'];
    dueDate: string | null;
    programId: string | null;
  }) => {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    if (res.ok) {
      const data = await res.json();
      setTasks(data.tasks || []);
    }
  };

  const handleToggleTask = async (taskId: string, completed: boolean) => {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    });
    if (res.ok) {
      const data = await res.json();
      setTasks(data.tasks || []);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      setTasks(data.tasks || []);
    }
  };

  const handleCreateChecklistItem = async (item: {
    documentName: string;
    programId: string | null;
    userNotes: string;
  }) => {
    const res = await fetch('/api/checklists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentName: item.documentName,
        programId: item.programId,
        status: 'DRAFTING',
        userNotes: item.userNotes,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setChecklistItems(data.checklistItems || []);
    }
  };

  const handleUpdateChecklistStatus = async (
    itemId: string,
    status: DocumentChecklistItemRecord['status'],
    userNotes?: string
  ) => {
    const res = await fetch(`/api/checklists/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, userNotes }),
    });
    if (res.ok) {
      const data = await res.json();
      setChecklistItems(data.checklistItems || []);
    }
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    const res = await fetch(`/api/checklists/${itemId}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      setChecklistItems(data.checklistItems || []);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    const res = await fetch('/api/notifications/read-all', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setNotifications(data.notifications || []);
    }
  };

  // Lookups for Selected Opportunity Detail Modal
  const selectedProgram = programs.find((p) => p.id === selectedProgramId) || null;
  const selectedInstitution = selectedProgram
    ? institutions.find((i) => i.id === selectedProgram.institutionId)
    : undefined;
  const selectedScholarships = selectedProgram
    ? scholarships.filter((s) => selectedProgram.scholarshipIds.includes(s.id))
    : [];
  const selectedClaims = selectedProgram
    ? claims.filter(
        (c) =>
          c.programId === selectedProgram.id ||
          (c.scholarshipId && selectedProgram.scholarshipIds.includes(c.scholarshipId))
      )
    : [];
  const selectedEligibility = selectedProgram
    ? eligibilityResults.find((e) => e.programId === selectedProgram.id)
    : undefined;
  const selectedSavedRecord = selectedProgram
    ? savedOpportunities.find((s) => s.programId === selectedProgram.id)
    : undefined;

  const isAdmin = currentUser?.role === 'admin';
  const latestRun = researchRuns.length > 0 ? researchRuns[0] : null;

  const primaryStudentNavItems: Array<{
    id: StudentPrimaryNavId;
    label: string;
    shortLabel: string;
    icon: React.FC<{ className?: string }>;
    badgeCount?: number;
  }> = [
    { id: 'home', label: 'Home', shortLabel: 'Home', icon: Home },
    {
      id: 'explore',
      label: 'Explore Opportunities',
      shortLabel: 'Explore',
      icon: Compass,
      badgeCount: programs.length,
    },
    {
      id: 'journey',
      label: 'My Journey',
      shortLabel: 'My Journey',
      icon: Bookmark,
      badgeCount: savedOpportunities.length,
    },
    { id: 'profile', label: 'My Profile', shortLabel: 'My Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      {/* ====================================================================
          DESKTOP & TABLET SIDEBAR NAVIGATION (4 Student Items + Protected Admin)
         ==================================================================== */}
      <aside
        aria-label="Primary navigation"
        className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-slate-200 z-30"
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-200 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none">
              ScholarScope
            </h1>
            <p className="text-[11px] text-slate-500 mt-1">
              Graduate Scholarship Guide
            </p>
          </div>
        </div>

        {/* 4 Simplified Student Navigation Items */}
        <nav className="flex-1 p-4 space-y-1.5" aria-label="Student navigation">
          {primaryStudentNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.badgeCount !== undefined && item.badgeCount > 0 && (
                  <span
                    className={`font-mono text-[11px] ${
                      active ? 'text-slate-200' : 'text-slate-500'
                    }`}
                  >
                    {item.badgeCount}
                  </span>
                )}
              </button>
            );
          })}

          {/* Separate Administrator Console Link (Visible ONLY to admins) */}
          {isAdmin && (
            <div className="pt-4 mt-4 border-t border-slate-200">
              <div className="px-3.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Administration
              </div>
              <button
                type="button"
                onClick={() => handleNavigate('admin')}
                aria-current={activeView === 'admin' ? 'page' : undefined}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeView === 'admin'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4 shrink-0" />
                  <span>Admin Console</span>
                </span>
              </button>
            </div>
          )}
        </nav>

        {/* Authenticated User Footer Card */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/60 space-y-2.5">
          {currentUser ? (
            <div className="space-y-2">
              <div className="text-xs">
                <div className="font-bold text-slate-900 truncate">{currentUser.fullName}</div>
                <div className="text-slate-500 truncate text-[11px]">{currentUser.email}</div>
              </div>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="w-full px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
              >
                Account & Switch User
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="w-full px-3 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800"
            >
              Sign In / Create Account
            </button>
          )}
        </div>
      </aside>

      {/* ====================================================================
          MAIN CONTENT COLUMN
         ==================================================================== */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen pb-16 md:pb-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 md:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="md:hidden w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900">
                {activeView === 'home' && 'Home'}
                {activeView === 'explore' && 'Explore Opportunities'}
                {activeView === 'journey' && 'My Journey'}
                {activeView === 'profile' && 'My Profile'}
                {activeView === 'admin' && 'Administrator Console'}
              </span>
              {profile?.citizenship && (
                <span className="hidden sm:inline text-xs text-slate-500 ml-2">
                  · {profile.citizenship} Applicant Profile ({profile.currentDegree || 'BS/MSc'})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isAdmin && (
              <button
                type="button"
                onClick={() => handleNavigate(activeView === 'admin' ? 'home' : 'admin')}
                className="md:hidden inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 border border-slate-300 rounded-md bg-white"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>{activeView === 'admin' ? 'Student View' : 'Admin'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              <span className="truncate max-w-[140px]">
                {currentUser ? currentUser.fullName : 'Sign In'}
              </span>
            </button>
          </div>
        </header>

        {/* Main Workspace Container */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
          {/* Access Denied Banner if a non-admin student attempted to open an admin route */}
          {unauthorizedAdminBanner && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start justify-between gap-4 text-xs text-red-900"
            >
              <div className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold">Administrator Console Access Restricted</div>
                  <p className="text-red-800">
                    Source diagnostics, crawler queues, and discovery execution controls are restricted to administrator accounts. You have been redirected to your student dashboard.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUnauthorizedAdminBanner(false)}
                className="text-xs font-semibold underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {loading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2">
              <div className="text-sm font-semibold text-slate-900">
                Loading your ScholarScope workspace…
              </div>
              <p className="text-xs text-slate-500">
                Retrieving verified scholarships, funding benchmarks, and your profile preferences.
              </p>
            </div>
          ) : bootstrapError ? (
            <div
              role="alert"
              className="bg-white border border-red-200 rounded-xl p-8 text-center space-y-4 max-w-lg mx-auto my-8"
            >
              <h2 className="text-lg font-bold text-slate-900">
                We couldn&apos;t load your scholarship workspace
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">{bootstrapError}</p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  fetchBootstrap();
                }}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Retry loading workspace
              </button>
            </div>
          ) : !currentUser ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4 max-w-lg mx-auto my-8">
              <h2 className="text-xl font-bold text-slate-900">
                Sign in to access your personalized scholarship workspace
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Create a student account or sign in to check your eligibility against verified Computer Science and Microbiology programs, save opportunities, and track your application documents.
              </p>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Sign In or Register
              </button>
            </div>
          ) : (
            <>
              {activeView === 'home' && (
                <HomeView
                  currentUser={currentUser}
                  profile={profile}
                  qualifications={qualifications}
                  programs={programs}
                  institutions={institutions}
                  scholarships={scholarships}
                  eligibilityResults={eligibilityResults}
                  savedOpportunities={savedOpportunities}
                  tasks={tasks}
                  checklistItems={checklistItems}
                  systemHealth={systemHealth}
                  latestRun={latestRun}
                  sources={sources}
                  onNavigate={handleNavigate}
                  onInspectProgram={(progId) => setSelectedProgramId(progId)}
                  onSaveOrUpdateOpportunity={handleSaveOrUpdateOpportunity}
                />
              )}

              {activeView === 'explore' && (
                <ExploreOpportunitiesView
                  programs={programs}
                  institutions={institutions}
                  scholarships={scholarships}
                  eligibilityResults={eligibilityResults}
                  savedOpportunities={savedOpportunities}
                  profile={profile}
                  filters={catalogueFilters}
                  onUpdateFilters={setCatalogueFilters}
                  currentPage={cataloguePage}
                  onPageChange={setCataloguePage}
                  onInspectProgram={(progId) => setSelectedProgramId(progId)}
                  onSaveOrUpdateOpportunity={handleSaveOrUpdateOpportunity}
                />
              )}

              {activeView === 'journey' && (
                <MyJourneyView
                  activeSection={journeySection}
                  onSelectSection={setJourneySection}
                  programs={programs}
                  institutions={institutions}
                  scholarships={scholarships}
                  eligibilityResults={eligibilityResults}
                  savedOpportunities={savedOpportunities}
                  tasks={tasks}
                  checklistItems={checklistItems}
                  notifications={notifications}
                  onInspectProgram={(progId) => setSelectedProgramId(progId)}
                  onNavigateToExplore={() => handleNavigate('explore')}
                  onSaveOrUpdateOpportunity={handleSaveOrUpdateOpportunity}
                  onDeleteSavedOpportunity={handleDeleteSavedOpportunity}
                  onCreateTask={handleCreateTask}
                  onToggleTask={handleToggleTask}
                  onDeleteTask={handleDeleteTask}
                  onUpdateChecklistStatus={handleUpdateChecklistStatus}
                  onCreateChecklistItem={handleCreateChecklistItem}
                  onDeleteChecklistItem={handleDeleteChecklistItem}
                  onMarkNotificationsRead={handleMarkAllNotificationsRead}
                />
              )}

              {activeView === 'profile' && (
                <ProfileView
                  profile={profile}
                  qualifications={qualifications}
                  onSaveProfile={handleSaveProfile}
                  onAddQualification={handleAddQualification}
                  onDeleteQualification={handleDeleteQualification}
                />
              )}

              {activeView === 'admin' && isAdmin && (
                <AdminAndSourcesView
                  mode="governance"
                  userRole={currentUser.role}
                  sources={sources}
                  countryCoverage={countryCoverage}
                  fetchAttempts={fetchAttempts}
                  snapshots={snapshots}
                  jobQueue={jobQueue}
                  researchRuns={researchRuns}
                  systemHealth={systemHealth}
                  auditLogs={auditLogs}
                  onTriggerDiscoveryRun={handleTriggerDiscoveryRun}
                  onRefreshBootstrap={fetchBootstrap}
                  runningDiscovery={runningDiscovery}
                />
              )}
            </>
          )}
        </main>

        {/* Clean Academic Footer */}
        <footer className="border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4">
          <div>
            ScholarScope — Verified Graduate Admissions & Scholarship Guide for Pakistani Students (Computer Science & Microbiology)
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => handleNavigate('explore')}
              className="hover:text-slate-900 underline"
            >
              Explore Opportunities
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => handleNavigate('journey')}
              className="hover:text-slate-900 underline"
            >
              My Journey
            </button>
            {isAdmin && (
              <>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => handleNavigate('admin')}
                  className="hover:text-slate-900 underline"
                >
                  Admin Console
                </button>
              </>
            )}
          </div>
        </footer>
      </div>

      {/* ====================================================================
          COMPACT MOBILE BOTTOM NAVIGATION BAR (4 Primary Student Destinations)
         ==================================================================== */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 grid grid-cols-4"
      >
        {primaryStudentNavItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center py-2.5 px-1 text-[11px] font-semibold transition-colors ${
                active ? 'text-slate-900 bg-slate-100/80' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="truncate">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Trustworthy Opportunity Detail Page / Modal (8 Required Student Sections) */}
      <EvidenceModal
        program={selectedProgram}
        institution={selectedInstitution}
        institutions={institutions}
        scholarships={selectedScholarships}
        claims={selectedClaims}
        eligibility={selectedEligibility}
        profile={profile}
        savedRecord={selectedSavedRecord}
        sources={sources}
        fetchAttempts={fetchAttempts}
        onClose={() => setSelectedProgramId(null)}
        onSaveOrUpdate={handleSaveOrUpdateOpportunity}
        onNavigateToProfile={() => handleNavigate('profile')}
      />

      {/* Account Authentication & User Switcher Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        currentUser={currentUser}
        availableAccounts={availableAccounts}
        onRefreshBootstrap={fetchBootstrap}
      />
    </div>
  );
}
