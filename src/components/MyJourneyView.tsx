import React from 'react';
import {
  Bell,
  Bookmark,
  Calendar,
  CheckSquare,
  Compass,
  ExternalLink,
  FileCheck,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  ApplicationStatus,
  ApplicationTaskRecord,
  DocumentChecklistItemRecord,
  EligibilityResultRecord,
  InstitutionRecord,
  NotificationRecord,
  ProgramRecord,
  SavedOpportunityRecord,
  ScholarshipRecord,
} from '../lib/types';
import {
  getProgramStudyDestination,
  JourneySectionId,
  mapDeadlineStatus,
  mapStudentFundingSummary,
} from '../lib/student-dashboard';

type DocumentChecklistStatus = DocumentChecklistItemRecord['status'];

interface MyJourneyViewProps {
  activeSection: JourneySectionId;
  onSelectSection: (section: JourneySectionId) => void;
  programs: ProgramRecord[];
  institutions: InstitutionRecord[];
  scholarships: ScholarshipRecord[];
  eligibilityResults: EligibilityResultRecord[];
  savedOpportunities: SavedOpportunityRecord[];
  tasks: ApplicationTaskRecord[];
  checklistItems: DocumentChecklistItemRecord[];
  notifications: NotificationRecord[];
  onInspectProgram: (programId: string) => void;
  onNavigateToExplore: () => void;
  onSaveOrUpdateOpportunity: (
    programId: string,
    status?: ApplicationStatus,
    notes?: string
  ) => Promise<void>;
  onDeleteSavedOpportunity: (programId: string) => Promise<void>;
  onCreateTask: (task: {
    title: string;
    category: ApplicationTaskRecord['category'];
    dueDate: string | null;
    programId: string | null;
  }) => Promise<void>;
  onToggleTask: (taskId: string, completed: boolean) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onUpdateChecklistStatus: (
    itemId: string,
    status: DocumentChecklistStatus,
    userNotes?: string
  ) => Promise<void>;
  onCreateChecklistItem: (item: {
    documentName: string;
    programId: string | null;
    userNotes: string;
  }) => Promise<void>;
  onDeleteChecklistItem: (itemId: string) => Promise<void>;
  onMarkNotificationsRead: () => Promise<void>;
}

const APPLICATION_STAGES: ApplicationStatus[] = [
  'Researching',
  'Preparing Documents',
  'Ready to Apply',
  'Submitted',
  'Interview',
  'Offer Received',
  'Accepted',
  'Rejected',
];

const TASK_CATEGORY_LABELS: Record<ApplicationTaskRecord['category'], string> = {
  DOCUMENT: 'Documents & Attestation',
  EXAM: 'Language / Standardized Test',
  SUPERVISOR_CONTACT: 'Supervisor Contact',
  PORTAL_SUBMISSION: 'Online Portal Submission',
  SCHOLARSHIP_ESSAY: 'Research Proposal / Essay',
};

export const MyJourneyView: React.FC<MyJourneyViewProps> = ({
  activeSection,
  onSelectSection,
  programs,
  institutions,
  scholarships,
  savedOpportunities,
  tasks,
  checklistItems,
  notifications,
  onInspectProgram,
  onNavigateToExplore,
  onSaveOrUpdateOpportunity,
  onDeleteSavedOpportunity,
  onCreateTask,
  onToggleTask,
  onDeleteTask,
  onUpdateChecklistStatus,
  onCreateChecklistItem,
  onDeleteChecklistItem,
  onMarkNotificationsRead,
}) => {
  const [newTaskTitle, setNewTaskTitle] = React.useState('');
  const [newTaskCategory, setNewTaskCategory] =
    React.useState<ApplicationTaskRecord['category']>('DOCUMENT');
  const [newTaskDueDate, setNewTaskDueDate] = React.useState('');
  const [newTaskProgramId, setNewTaskProgramId] = React.useState<string>('');

  const [newDocName, setNewDocName] = React.useState('');
  const [newDocProgramId, setNewDocProgramId] = React.useState<string>('');
  const [newDocNotes, setNewDocNotes] = React.useState('');

  const unreadCount = notifications.filter((n) => !n.read).length;
  const openTasksCount = tasks.filter((t) => !t.completed).length;
  const pendingDocsCount = checklistItems.filter(
    (c) => c.status !== 'READY' && c.status !== 'UPLOADED'
  ).length;

  const validatedDeadlines = React.useMemo(() => {
    const savedProgramIdSet = new Set(savedOpportunities.map((s) => s.programId));
    return programs
      .map((program) => ({
        program,
        isSaved: savedProgramIdSet.has(program.id),
        deadline: mapDeadlineStatus(program),
        destination: getProgramStudyDestination(program, institutions, scholarships),
        funding: mapStudentFundingSummary(program, scholarships),
      }))
      .sort((a, b) => {
        if (a.isSaved !== b.isSaved) return a.isSaved ? -1 : 1;
        return (a.deadline.daysRemaining ?? 9999) - (b.deadline.daysRemaining ?? 9999);
      });
  }, [programs, savedOpportunities, institutions, scholarships]);

  const handleAddTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    await onCreateTask({
      title: newTaskTitle.trim(),
      category: newTaskCategory,
      dueDate: newTaskDueDate ? newTaskDueDate : null,
      programId: newTaskProgramId ? newTaskProgramId : null,
    });
    setNewTaskTitle('');
    setNewTaskDueDate('');
  };

  const handleAddDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim()) return;
    await onCreateChecklistItem({
      documentName: newDocName.trim(),
      programId: newDocProgramId ? newDocProgramId : null,
      userNotes: newDocNotes.trim(),
    });
    setNewDocName('');
    setNewDocNotes('');
  };

  return (
    <div className="space-y-6">
      {/* Header & Section Tabs */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              My Journey
            </h2>
            <p className="text-xs text-slate-600">
              Manage your saved scholarships, application stages, preparation tasks, required documents, and verified closing dates in one place.
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateToExplore}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors self-start md:self-auto"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Find more opportunities</span>
          </button>
        </div>

        {/* Sub-navigation Tabs */}
        <div
          className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200"
          role="tablist"
          aria-label="My Journey sections"
        >
          {[
            {
              id: 'saved' as JourneySectionId,
              label: `Saved & Applications (${savedOpportunities.length})`,
              icon: Bookmark,
            },
            {
              id: 'tasks' as JourneySectionId,
              label: `Preparation Tasks (${openTasksCount} open)`,
              icon: CheckSquare,
            },
            {
              id: 'documents' as JourneySectionId,
              label: `Document Checklist (${pendingDocsCount} pending)`,
              icon: FileCheck,
            },
            {
              id: 'deadlines' as JourneySectionId,
              label: 'Deadlines Calendar',
              icon: Calendar,
            },
            {
              id: 'updates' as JourneySectionId,
              label: `Portal Updates (${unreadCount} unread)`,
              icon: Bell,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectSection(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ==================================================================
          TAB 1: SAVED OPPORTUNITIES & APPLICATIONS
         ================================================================== */}
      {activeSection === 'saved' && (
        <section className="space-y-4" aria-label="Saved opportunities and applications">
          {savedOpportunities.length > 0 ? (
            <div className="space-y-4">
              {savedOpportunities.map((saved) => {
                const prog = programs.find((p) => p.id === saved.programId);
                if (!prog) return null;
                const dest = getProgramStudyDestination(prog, institutions, scholarships);
                const funding = mapStudentFundingSummary(prog, scholarships);
                const deadline = mapDeadlineStatus(prog);
                const linkedDocs = checklistItems.filter((c) => c.programId === prog.id);
                const readyDocs = linkedDocs.filter(
                  (c) => c.status === 'READY' || c.status === 'UPLOADED'
                ).length;

                return (
                  <article
                    key={saved.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-xs text-slate-600">
                          <strong className="text-slate-900">{dest.institutionName}</strong> ·{' '}
                          {dest.destinationCountry} · {prog.degreeLevel} ·{' '}
                          {prog.broadField || prog.discipline}
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">
                          <button
                            type="button"
                            onClick={() => onInspectProgram(prog.id)}
                            className="hover:underline text-left"
                          >
                            {prog.title}
                          </button>
                        </h3>
                        <div className="text-xs text-slate-600">
                          Funding: <strong className="text-slate-900">{funding.headline}</strong> ·
                          Deadline:{' '}
                          <strong className="font-mono text-slate-900">
                            {deadline.formattedDate}
                          </strong>{' '}
                          ({deadline.label})
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <label
                          htmlFor={`stage-${saved.id}`}
                          className="text-xs font-medium text-slate-600"
                        >
                          Application Stage:
                        </label>
                        <select
                          id={`stage-${saved.id}`}
                          value={saved.applicationStatus}
                          onChange={(e) =>
                            onSaveOrUpdateOpportunity(
                              prog.id,
                              e.target.value as ApplicationStatus,
                              saved.privateNotes
                            )
                          }
                          className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-md text-slate-900"
                        >
                          {APPLICATION_STAGES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => onInspectProgram(prog.id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800"
                        >
                          View Details
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteSavedOpportunity(prog.id)}
                          aria-label={`Remove ${prog.title} from saved opportunities`}
                          className="p-1.5 text-slate-500 hover:text-red-700 border border-slate-200 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-500 block mb-1">Personal Notes</span>
                        <p className="text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200">
                          {saved.privateNotes ||
                            'No personal notes added yet. Open details to add notes.'}
                        </p>
                      </div>
                      <div className="flex flex-col justify-between bg-slate-50 p-3 rounded border border-slate-200">
                        <div>
                          <span className="text-slate-500 block">Document Readiness</span>
                          <span className="font-mono font-semibold text-slate-900">
                            {readyDocs} of {linkedDocs.length} required documents ready
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <button
                            type="button"
                            onClick={() => onSelectSection('documents')}
                            className="font-semibold text-slate-900 hover:underline"
                          >
                            Open Document Checklist →
                          </button>
                          <a
                            href={prog.officialProgramUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-slate-700 hover:text-slate-900 underline"
                          >
                            <span>Official portal</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
              <h3 className="text-base font-bold text-slate-900">
                You haven&apos;t saved any opportunities or applications yet
              </h3>
              <p className="text-xs text-slate-600 max-w-lg mx-auto">
                Explore verified scholarships in Computer Science and Microbiology and click &ldquo;Save opportunity&rdquo; to track your application progress and required documents here.
              </p>
              <button
                type="button"
                onClick={onNavigateToExplore}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
              >
                <Compass className="w-4 h-4" />
                <span>Explore opportunities</span>
              </button>
            </div>
          )}
        </section>
      )}

      {/* ==================================================================
          TAB 2: PREPARATION TASKS
         ================================================================== */}
      {activeSection === 'tasks' && (
        <section className="space-y-5" aria-label="Application preparation tasks">
          <form
            onSubmit={handleAddTaskSubmit}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
          >
            <h3 className="text-sm font-bold text-slate-900">Add a New Preparation Task</h3>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
              <div className="sm:col-span-5">
                <label htmlFor="new-task-title" className="sr-only">
                  Task description
                </label>
                <input
                  id="new-task-title"
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g., Request HEC degree attestation or contact TU Munich supervisor"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="new-task-category" className="sr-only">
                  Task category
                </label>
                <select
                  id="new-task-category"
                  value={newTaskCategory}
                  onChange={(e) =>
                    setNewTaskCategory(e.target.value as ApplicationTaskRecord['category'])
                  }
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-md text-slate-900"
                >
                  <option value="DOCUMENT">Documents & Attestation</option>
                  <option value="SUPERVISOR_CONTACT">Supervisor Contact</option>
                  <option value="EXAM">Language / GRE Exam</option>
                  <option value="SCHOLARSHIP_ESSAY">Research Proposal / Essay</option>
                  <option value="PORTAL_SUBMISSION">Portal Submission</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="new-task-program" className="sr-only">
                  Linked opportunity
                </label>
                <select
                  id="new-task-program"
                  value={newTaskProgramId}
                  onChange={(e) => setNewTaskProgramId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-md text-slate-900"
                >
                  <option value="">General (All Applications)</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <input
                  type="date"
                  aria-label="Task due date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="w-full px-2 py-2 bg-white border border-slate-300 rounded-md text-slate-900 font-mono"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1 px-3 py-2 font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </form>

          {tasks.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
              {tasks.map((task) => {
                const linkedProg = programs.find((p) => p.id === task.programId);
                return (
                  <div
                    key={task.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={(e) => onToggleTask(task.id, e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900"
                      />
                      <div>
                        <span
                          className={`font-semibold block ${
                            task.completed ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {task.title}
                        </span>
                        <span className="text-slate-500">
                          {TASK_CATEGORY_LABELS[task.category] || task.category}
                          {linkedProg ? ` · Program: ${linkedProg.title}` : ''}
                          {task.dueDate ? ` · Due: ${task.dueDate.slice(0, 10)}` : ''}
                        </span>
                      </div>
                    </label>

                    <button
                      type="button"
                      onClick={() => onDeleteTask(task.id)}
                      aria-label={`Delete task ${task.title}`}
                      className="p-1.5 text-slate-400 hover:text-red-700 self-end sm:self-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-600">
              No preparation tasks added yet. Use the form above to add tasks for HEC attestation, recommendation letters, or supervisor emails.
            </div>
          )}
        </section>
      )}

      {/* ==================================================================
          TAB 3: DOCUMENT CHECKLIST
         ================================================================== */}
      {activeSection === 'documents' && (
        <section className="space-y-5" aria-label="Application document checklist">
          <form
            onSubmit={handleAddDocSubmit}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
          >
            <h3 className="text-sm font-bold text-slate-900">Add a Document to Your Checklist</h3>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
              <div className="sm:col-span-4">
                <input
                  type="text"
                  aria-label="Document name"
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  placeholder="e.g., HEC Attested BS Transcript & Degree"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900"
                />
              </div>
              <div className="sm:col-span-4">
                <select
                  aria-label="Associated program"
                  value={newDocProgramId}
                  onChange={(e) => setNewDocProgramId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-md text-slate-900"
                >
                  <option value="">General Document (All Programs)</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-4 flex gap-2">
                <input
                  type="text"
                  aria-label="Document notes"
                  value={newDocNotes}
                  onChange={(e) => setNewDocNotes(e.target.value)}
                  placeholder="Optional note (e.g., 2 sealed copies)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-slate-900"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 px-3 py-2 font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </form>

          {checklistItems.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
              {checklistItems.map((item) => {
                const linkedProg = programs.find((p) => p.id === item.programId);
                return (
                  <div
                    key={item.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-900">{item.documentName}</div>
                      <div className="text-slate-500">
                        {linkedProg ? `Program: ${linkedProg.title}` : 'General Application Document'}
                        {item.userNotes ? ` · Note: ${item.userNotes}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        aria-label={`Status for ${item.documentName}`}
                        value={item.status}
                        onChange={(e) =>
                          onUpdateChecklistStatus(
                            item.id,
                            e.target.value as DocumentChecklistStatus,
                            item.userNotes
                          )
                        }
                        className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-md text-slate-900"
                      >
                        <option value="MISSING">Missing</option>
                        <option value="DRAFTING">Drafting / In Progress</option>
                        <option value="READY">Ready</option>
                        <option value="UPLOADED">Uploaded / Submitted</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => onDeleteChecklistItem(item.id)}
                        aria-label={`Remove ${item.documentName}`}
                        className="p-1.5 text-slate-400 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-600">
              Your document checklist is empty. When you save an opportunity, its required documents are automatically added here.
            </div>
          )}
        </section>
      )}

      {/* ==================================================================
          TAB 4: VALIDATED DEADLINES CALENDAR
         ================================================================== */}
      {activeSection === 'deadlines' && (
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-base font-bold text-slate-900">
              Verified Scholarship & Admission Deadlines
            </h3>
            <p className="text-xs text-slate-600">
              Saved opportunities appear first, sorted by closing date. Programs without a fixed published date are clearly marked.
            </p>
          </div>

          <div className="divide-y divide-slate-200">
            {validatedDeadlines.map((item) => (
              <div
                key={item.program.id}
                className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onInspectProgram(item.program.id)}
                      className="font-bold text-slate-900 hover:underline text-left"
                    >
                      {item.program.title}
                    </button>
                    {item.isSaved && (
                      <span className="font-semibold text-emerald-800">· Saved in My Journey</span>
                    )}
                  </div>
                  <div className="text-slate-600">
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
                          : item.deadline.status === 'OPEN'
                          ? 'text-emerald-700'
                          : 'text-slate-500'
                      }`}
                    >
                      {item.deadline.label}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onInspectProgram(item.program.id)}
                    className="px-3 py-1.5 font-semibold text-slate-800 border border-slate-300 rounded-md hover:bg-slate-50"
                  >
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ==================================================================
          TAB 5: PORTAL UPDATES & NOTIFICATIONS
         ================================================================== */}
      {activeSection === 'updates' && (
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Scholarship & Deadline Updates
              </h3>
              <p className="text-xs text-slate-600">
                Real-time alerts when a monitored official portal updates its stipend, deadline, or eligibility rules.
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkNotificationsRead}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50"
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {notifications.map((notif) => (
                <div key={notif.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">{notif.title}</span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {notif.createdAt.slice(0, 10)}
                    </span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">{notif.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600 py-4">
              No portal change alerts recorded yet.
            </p>
          )}
        </section>
      )}
    </div>
  );
};
