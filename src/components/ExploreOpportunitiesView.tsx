import React from 'react';
import { ChevronDown, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import {
  ApplicationStatus,
  EligibilityResultRecord,
  InstitutionRecord,
  MANDATORY_DESTINATION_COUNTRIES,
  ProgramRecord,
  SavedOpportunityRecord,
  ScholarshipRecord,
  SUBJECT_TAXONOMY,
  UserProfileRecord,
} from '../lib/types';
import {
  CatalogueFilterState,
  DEFAULT_CATALOGUE_FILTERS,
  filterAndSortCataloguePrograms,
  getProgramStudyDestination,
} from '../lib/student-dashboard';
import { OPPORTUNITY_TYPE_META, programInField, type StudyField } from '../lib/opportunity-presentation';
import { OpportunityCard } from './OpportunityCard';

interface ExploreOpportunitiesViewProps {
  programs: ProgramRecord[];
  institutions: InstitutionRecord[];
  scholarships: ScholarshipRecord[];
  eligibilityResults: EligibilityResultRecord[];
  savedOpportunities: SavedOpportunityRecord[];
  profile: UserProfileRecord | null;
  filters: CatalogueFilterState;
  onUpdateFilters: (updater: (prev: CatalogueFilterState) => CatalogueFilterState) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  onInspectProgram: (programId: string) => void;
  onSaveOrUpdateOpportunity: (
    programId: string,
    status?: ApplicationStatus,
    notes?: string
  ) => Promise<void>;
  onNavigateToProfile?: () => void;
  activeField: StudyField;
}

const ITEMS_PER_PAGE = 9;

const selectClass =
  'w-full px-3 py-2 text-[13px] bg-white border border-stone-300 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900';

export const ExploreOpportunitiesView: React.FC<ExploreOpportunitiesViewProps> = ({
  programs,
  institutions,
  scholarships,
  eligibilityResults,
  savedOpportunities,
  profile,
  filters,
  onUpdateFilters,
  currentPage,
  onPageChange,
  onInspectProgram,
  onSaveOrUpdateOpportunity,
  onNavigateToProfile,
  activeField,
}) => {
  const [advancedOpen, setAdvancedOpen] = React.useState(false);

  const filteredPrograms = React.useMemo(
    () =>
      filterAndSortCataloguePrograms(programs, filters, {
        institutions,
        scholarships,
        eligibilityResults,
        profile,
      }),
    [programs, filters, institutions, scholarships, eligibilityResults, profile]
  );

  // Specializations follow the global study field (subject filter is now global, not per-view).
  const availableSpecializations = React.useMemo(() => {
    return SUBJECT_TAXONOMY.filter((s) =>
      s.broadField === activeField.subject ||
      s.broadField === 'Interdisciplinary (CS & Bio)'
    );
  }, [activeField]);

  const totalPages = Math.max(1, Math.ceil(filteredPrograms.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPrograms = React.useMemo(() => {
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredPrograms.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPrograms, safePage]);

  const savedProgramIds = React.useMemo(
    () => new Set(savedOpportunities.map((s) => s.programId)),
    [savedOpportunities]
  );

  const countryCounts = React.useMemo(() => {
    const counts: Record<string, number> = { ALL: programs.length };
    for (const c of MANDATORY_DESTINATION_COUNTRIES) {
      counts[c] = programs.filter((p) => {
        const dest = getProgramStudyDestination(p, institutions, scholarships);
        return (
          dest.destinationCountry.toLowerCase() === c.toLowerCase() ||
          dest.administeringCountry.toLowerCase() === c.toLowerCase()
        );
      }).length;
    }
    return counts;
  }, [programs, institutions, scholarships]);

  const hasActiveFilters =
    filters.searchQuery.trim() !== '' ||
    filters.subject !== 'ALL' ||
    filters.specialization !== 'ALL' ||
    filters.country !== 'ALL' ||
    filters.degreeLevel !== 'ALL' ||
    filters.opportunityType !== 'ALL' ||
    filters.fundingCoverage !== 'ALL' ||
    filters.eligibilityStatus !== 'ALL' ||
    filters.deadlineStatus !== 'ALL' ||
    filters.verificationStatus !== 'ALL';

  const handleFilterChange = <K extends keyof CatalogueFilterState>(
    key: K,
    value: CatalogueFilterState[K]
  ) => {
    onUpdateFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'subject') next.specialization = 'ALL';
      return next;
    });
    onPageChange(1);
  };

  const handleResetFilters = () => {
    onUpdateFilters(() => ({ ...DEFAULT_CATALOGUE_FILTERS }));
    onPageChange(1);
  };

  const setQuickFilter = (patch: Partial<CatalogueFilterState>) => {
    onUpdateFilters((prev) => ({ ...prev, ...patch }));
    onPageChange(1);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-1 px-1">
        <h2 className="text-2xl font-bold text-stone-900 tracking-tight">{activeField.label} opportunities</h2>
        <p className="text-[13px] text-stone-500">
          Every listing shows what kind of award it is, what it pays, what you need, and when
          it closes. Showing {activeField.label} only — switch fields from the top bar.
        </p>
      </div>

      {/* Filter panel */}
      <section className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <label htmlFor="explore-search-input" className="sr-only">
            Search opportunities
          </label>
          <input
            id="explore-search-input"
            type="search"
            value={filters.searchQuery}
            onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
            placeholder="Search — try “DAAD”, “PhD”, “MEXT”, “machine learning”…"
            className="w-full pl-11 pr-4 py-3 text-sm bg-stone-50 border border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-900"
          />
        </div>

        {/* Quick chips */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setQuickFilter({ fundingCoverage: 'CONFIRMED_FULL_FUNDING', deadlineStatus: 'ALL' })
            }
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
              filters.fundingCoverage === 'CONFIRMED_FULL_FUNDING'
                ? 'bg-emerald-700 text-white border-emerald-700'
                : 'bg-white text-stone-700 border-stone-300 hover:border-stone-400'
            }`}
          >
            ✨ Fully funded
          </button>
          <button
            type="button"
            onClick={() =>
              setQuickFilter({ deadlineStatus: 'CLOSING_SOON', fundingCoverage: 'ALL' })
            }
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
              filters.deadlineStatus === 'CLOSING_SOON'
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white text-stone-700 border-stone-300 hover:border-stone-400'
            }`}
          >
            ⏰ Closing soon
          </button>
          {MANDATORY_DESTINATION_COUNTRIES.map((c) => {
            const active = filters.country.toLowerCase() === c.toLowerCase();
            return (
              <button
                key={c}
                type="button"
                onClick={() => setQuickFilter({ country: active ? 'ALL' : c })}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                  active
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-stone-700 border-stone-300 hover:border-stone-400'
                }`}
              >
                {c} ({countryCounts[c] ?? 0})
              </button>
            );
          })}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-stone-500 hover:text-stone-900"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear all
            </button>
          )}
        </div>

        {/* Essential selects */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label htmlFor="f-degree" className="block text-[11px] font-semibold text-stone-500 mb-1">
              Degree
            </label>
            <select
              id="f-degree"
              value={filters.degreeLevel}
              onChange={(e) => handleFilterChange('degreeLevel', e.target.value)}
              className={selectClass}
            >
              <option value="ALL">Any degree</option>
              <option value="PhD">PhD</option>
              <option value="MSc">MSc</option>
              <option value="MS">MS</option>
              <option value="MPhil">MPhil</option>
            </select>
          </div>
          <div>
            <label htmlFor="f-funding" className="block text-[11px] font-semibold text-stone-500 mb-1">
              Funding
            </label>
            <select
              id="f-funding"
              value={filters.fundingCoverage}
              onChange={(e) => handleFilterChange('fundingCoverage', e.target.value)}
              className={selectClass}
            >
              <option value="ALL">Any funding</option>
              <option value="CONFIRMED_FULL_FUNDING">Fully funded</option>
              <option value="TUITION_COVERED">Tuition covered</option>
              <option value="PARTIAL_OR_STIPEND">Partial / stipend</option>
              <option value="SELF_FUNDED">Self-funded</option>
            </select>
          </div>
          <div>
            <label htmlFor="f-deadline" className="block text-[11px] font-semibold text-stone-500 mb-1">
              Deadline
            </label>
            <select
              id="f-deadline"
              value={filters.deadlineStatus}
              onChange={(e) => handleFilterChange('deadlineStatus', e.target.value)}
              className={selectClass}
            >
              <option value="ALL">Any time</option>
              <option value="CLOSING_SOON">Closing soon</option>
              <option value="OPEN">Open</option>
              <option value="UNVERIFIED_OR_ROLLING">Rolling / no date</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <div>
            <label htmlFor="f-type" className="block text-[11px] font-semibold text-stone-500 mb-1">
              Award type
            </label>
            <select
              id="f-type"
              value={filters.opportunityType}
              onChange={(e) => handleFilterChange('opportunityType', e.target.value)}
              className={selectClass}
            >
              <option value="ALL">Any type</option>
              {Object.entries(OPPORTUNITY_TYPE_META).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Advanced */}
        <div>
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            aria-expanded={advancedOpen}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {advancedOpen ? 'Hide' : 'Show'} more filters
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {advancedOpen && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3">
              {/* Subject is now the global study-field switcher in the top bar */}
              <div>
                <label htmlFor="f-spec" className="block text-[11px] font-semibold text-stone-500 mb-1">
                  Specialization
                </label>
                <select
                  id="f-spec"
                  value={filters.specialization}
                  onChange={(e) => handleFilterChange('specialization', e.target.value)}
                  className={selectClass}
                >
                  <option value="ALL">Any specialization</option>
                  {availableSpecializations.map((spec) => (
                    <option key={spec.id} value={spec.label}>
                      {spec.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="f-elig" className="block text-[11px] font-semibold text-stone-500 mb-1">
                  My fit
                </label>
                <select
                  id="f-elig"
                  value={filters.eligibilityStatus}
                  onChange={(e) => handleFilterChange('eligibilityStatus', e.target.value)}
                  className={selectClass}
                >
                  <option value="ALL">Any</option>
                  <option value="ELIGIBLE">Good fit</option>
                  <option value="POTENTIALLY_ELIGIBLE">Could fit</option>
                  <option value="NOT_ELIGIBLE">Not a fit</option>
                  <option value="NOT_ASSESSED">Not checked</option>
                </select>
              </div>
              <div>
                <label htmlFor="f-ver" className="block text-[11px] font-semibold text-stone-500 mb-1">
                  Verification
                </label>
                <select
                  id="f-ver"
                  value={filters.verificationStatus}
                  onChange={(e) => handleFilterChange('verificationStatus', e.target.value)}
                  className={selectClass}
                >
                  <option value="ALL">Any</option>
                  <option value="VERIFIED_ONLY">Verified only</option>
                  <option value="Officially Confirmed">Officially confirmed</option>
                  <option value="Cross-Verified">Cross-verified</option>
                </select>
              </div>
              <div>
                <label htmlFor="f-sort" className="block text-[11px] font-semibold text-stone-500 mb-1">
                  Sort by
                </label>
                <select
                  id="f-sort"
                  value={filters.sortBy}
                  onChange={(e) =>
                    handleFilterChange('sortBy', e.target.value as CatalogueFilterState['sortBy'])
                  }
                  className={selectClass}
                >
                  <option value="rank">Best match</option>
                  <option value="deadline">Earliest deadline</option>
                  <option value="stipend">Highest stipend</option>
                  <option value="title">A–Z</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Results meta */}
      <div className="flex items-center justify-between text-[13px] text-stone-500 px-1">
        <span>
          <strong className="text-stone-900">{filteredPrograms.length}</strong>{' '}
          {filteredPrograms.length === 1 ? 'opportunity' : 'opportunities'}
          {hasActiveFilters && ' match your filters'}
        </span>
        {totalPages > 1 && (
          <span>
            Page {safePage} of {totalPages}
          </span>
        )}
      </div>

      {/* Results */}
      {paginatedPrograms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {paginatedPrograms.map((prog) => (
            <OpportunityCard
              key={prog.id}
              program={prog}
              institutions={institutions}
              scholarships={scholarships}
              eligibilityResults={eligibilityResults}
              profile={profile}
              isSaved={savedProgramIds.has(prog.id)}
              onInspect={onInspectProgram}
              onSave={onSaveOrUpdateOpportunity}
              onNavigateToProfile={onNavigateToProfile}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center space-y-3">
          <h3 className="text-lg font-bold text-stone-900">Nothing matches those filters</h3>
          <p className="text-[13px] text-stone-500 max-w-md mx-auto">
            Try removing a filter or two — the catalogue is small but every listing is verified.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-stone-900 rounded-xl hover:bg-stone-700"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear all filters
          </button>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav
          aria-label="Pages"
          className="flex items-center justify-center gap-2 pt-2"
        >
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            className="px-4 py-2 text-[13px] font-semibold rounded-xl border border-stone-300 text-stone-700 disabled:opacity-40 hover:bg-white bg-white"
          >
            ← Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
            <button
              key={pageNum}
              type="button"
              onClick={() => onPageChange(pageNum)}
              aria-current={pageNum === safePage ? 'page' : undefined}
              className={`w-9 h-9 rounded-xl text-[13px] font-semibold transition-colors ${
                pageNum === safePage
                  ? 'bg-stone-900 text-white'
                  : 'bg-white border border-stone-200 text-stone-700 hover:border-stone-400'
              }`}
            >
              {pageNum}
            </button>
          ))}
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            className="px-4 py-2 text-[13px] font-semibold rounded-xl border border-stone-300 text-stone-700 disabled:opacity-40 hover:bg-white bg-white"
          >
            Next →
          </button>
        </nav>
      )}
    </div>
  );
};
