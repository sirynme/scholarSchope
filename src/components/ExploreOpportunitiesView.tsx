import React from 'react';
import {
  Bookmark,
  ExternalLink,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
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
  mapDeadlineStatus,
  mapStudentEligibilityCategory,
  mapStudentFundingSummary,
  mapStudentVerificationConfidence,
  OPPORTUNITY_TYPE_LABELS,
} from '../lib/student-dashboard';

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
}

const ITEMS_PER_PAGE = 8;

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
}) => {
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

  const availableSpecializations = React.useMemo(() => {
    if (filters.subject === 'Computer Science') {
      return SUBJECT_TAXONOMY.filter((s) => s.broadField === 'Computer Science');
    }
    if (filters.subject === 'Microbiology') {
      return SUBJECT_TAXONOMY.filter((s) => s.broadField === 'Microbiology');
    }
    if (filters.subject === 'Interdisciplinary (CS & Bio)') {
      return SUBJECT_TAXONOMY.filter((s) => s.broadField === 'Interdisciplinary (CS & Bio)');
    }
    return SUBJECT_TAXONOMY;
  }, [filters.subject]);

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

  const hasActiveFilters = React.useMemo(() => {
    return (
      filters.searchQuery.trim() !== '' ||
      filters.subject !== 'ALL' ||
      filters.specialization !== 'ALL' ||
      filters.country !== 'ALL' ||
      filters.degreeLevel !== 'ALL' ||
      filters.opportunityType !== 'ALL' ||
      filters.fundingCoverage !== 'ALL' ||
      filters.eligibilityStatus !== 'ALL' ||
      filters.deadlineStatus !== 'ALL' ||
      filters.verificationStatus !== 'ALL'
    );
  }, [filters]);

  const handleFilterChange = <K extends keyof CatalogueFilterState>(
    key: K,
    value: CatalogueFilterState[K]
  ) => {
    onUpdateFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'subject') {
        next.specialization = 'ALL';
      }
      return next;
    });
    onPageChange(1);
  };

  const handleResetFilters = () => {
    onUpdateFilters(() => ({ ...DEFAULT_CATALOGUE_FILTERS }));
    onPageChange(1);
  };

  return (
    <div className="space-y-6">
      {/* Page Header & Quick Subject / Country Selector */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              Explore Opportunities
            </h2>
            <p className="text-xs text-slate-600">
              Search and filter verified graduate programs and scholarships in Computer Science, Microbiology, and Computational Biology across Germany, the UK, the US, Japan, and China.
            </p>
          </div>

          {/* Quick Subject Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by broad subject">
            {[
              { value: 'ALL', label: 'All Subjects' },
              { value: 'Computer Science', label: 'Computer Science' },
              { value: 'Microbiology', label: 'Microbiology' },
              { value: 'Interdisciplinary (CS & Bio)', label: 'Computational Biology (CS & Bio)' },
            ].map((subj) => {
              const active = filters.subject === subj.value;
              return (
                <button
                  key={subj.value}
                  type="button"
                  onClick={() => handleFilterChange('subject', subj.value)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {subj.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Destination Country Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100" role="group" aria-label="Filter by study destination">
          <span className="text-xs font-semibold text-slate-500 mr-1">Study Destination:</span>
          <button
            type="button"
            onClick={() => handleFilterChange('country', 'ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
              filters.country === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            All Destinations ({countryCounts.ALL})
          </button>
          {MANDATORY_DESTINATION_COUNTRIES.map((countryName) => {
            const active = filters.country.toLowerCase() === countryName.toLowerCase();
            return (
              <button
                key={countryName}
                type="button"
                onClick={() => handleFilterChange('country', countryName)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {countryName} ({countryCounts[countryName] ?? 0})
              </button>
            );
          })}
        </div>

        {/* Search & Comprehensive 9-Filter Grid */}
        <div className="space-y-4 pt-3 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <label htmlFor="explore-search-input" className="sr-only">
                Search by program, university, specialization, or scholarship name
              </label>
              <input
                id="explore-search-input"
                type="search"
                value={filters.searchQuery}
                onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
                placeholder="Search by program title, university, scholarship (e.g., DAAD, MEXT, Gates, Fulbright), or subfield..."
                className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="explore-sort-select" className="text-xs font-semibold text-slate-600">
                Sort by:
              </label>
              <select
                id="explore-sort-select"
                value={filters.sortBy}
                onChange={(e) =>
                  handleFilterChange(
                    'sortBy',
                    e.target.value as CatalogueFilterState['sortBy']
                  )
                }
                className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-900"
              >
                <option value="rank">Best Match for My Profile</option>
                <option value="deadline">Earliest Application Deadline</option>
                <option value="stipend">Highest Annual Stipend (USD eq.)</option>
                <option value="title">Alphabetical (A–Z)</option>
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* 8 Detailed Filter Controls (with Subject & Country above = all 9 required filters) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {/* 1. Specialization */}
            <div>
              <label
                htmlFor="filter-specialization"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Specialization Subfield
              </label>
              <select
                id="filter-specialization"
                value={filters.specialization}
                onChange={(e) => handleFilterChange('specialization', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value="ALL">All Specializations ({availableSpecializations.length})</option>
                {availableSpecializations.map((spec) => (
                  <option key={spec.id} value={spec.label}>
                    {spec.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Degree Level */}
            <div>
              <label
                htmlFor="filter-degree"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Degree Level
              </label>
              <select
                id="filter-degree"
                value={filters.degreeLevel}
                onChange={(e) => handleFilterChange('degreeLevel', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value="ALL">All Degree Levels</option>
                <option value="PhD">PhD / Doctoral</option>
                <option value="MSc">MSc (Master of Science)</option>
                <option value="MS">MS (Master&apos;s)</option>
                <option value="MPhil">MPhil (Research Master&apos;s)</option>
              </select>
            </div>

            {/* 3. Opportunity Type */}
            <div>
              <label
                htmlFor="filter-opp-type"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Opportunity Type
              </label>
              <select
                id="filter-opp-type"
                value={filters.opportunityType}
                onChange={(e) => handleFilterChange('opportunityType', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value="ALL">All Opportunity Types</option>
                {Object.entries(OPPORTUNITY_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Funding Coverage */}
            <div>
              <label
                htmlFor="filter-funding"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Funding Coverage
              </label>
              <select
                id="filter-funding"
                value={filters.fundingCoverage}
                onChange={(e) => handleFilterChange('fundingCoverage', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value="ALL">All Funding Levels</option>
                <option value="CONFIRMED_FULL_FUNDING">
                  Confirmed Full Funding (Tuition + Stipend)
                </option>
                <option value="TUITION_COVERED">Tuition Covered (Full or Partial Stipend)</option>
                <option value="PARTIAL_OR_STIPEND">Partial Funding or Unconfirmed Stipend</option>
                <option value="SELF_FUNDED">Self-Funded Admission</option>
                <option value="UNVERIFIED">Funding Unverified</option>
              </select>
            </div>

            {/* 5. Eligibility Status */}
            <div>
              <label
                htmlFor="filter-eligibility"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Your Eligibility Assessment
              </label>
              <select
                id="filter-eligibility"
                value={filters.eligibilityStatus}
                onChange={(e) => handleFilterChange('eligibilityStatus', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value="ALL">All Eligibility Categories</option>
                <option value="ELIGIBLE">Eligible</option>
                <option value="POTENTIALLY_ELIGIBLE">Potentially eligible</option>
                <option value="NOT_ASSESSED">Not assessed</option>
                <option value="NOT_ELIGIBLE">Not eligible</option>
              </select>
            </div>

            {/* 6. Deadline Status */}
            <div>
              <label
                htmlFor="filter-deadline"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Deadline Status
              </label>
              <select
                id="filter-deadline"
                value={filters.deadlineStatus}
                onChange={(e) => handleFilterChange('deadlineStatus', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value="ALL">All Deadline States</option>
                <option value="CLOSING_SOON">Closing Soon (within 60 days)</option>
                <option value="OPEN">Open (future fixed deadline)</option>
                <option value="UNVERIFIED_OR_ROLLING">Rolling or Date Not Yet Published</option>
                <option value="CLOSED">Closed for Current Cycle</option>
              </select>
            </div>

            {/* 7. Verification Status */}
            <div>
              <label
                htmlFor="filter-verification"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Verification Status
              </label>
              <select
                id="filter-verification"
                value={filters.verificationStatus}
                onChange={(e) => handleFilterChange('verificationStatus', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value="ALL">All Verification Levels</option>
                <option value="VERIFIED_ONLY">Verified Only (Confirmed + Cross-Verified)</option>
                <option value="Officially Confirmed">Officially Confirmed</option>
                <option value="Cross-Verified">Cross-Verified</option>
                <option value="Official Source, Not Fully Verified">
                  Official Source — Needs Confirmation
                </option>
                <option value="Unavailable">Official Page Temporarily Unreachable</option>
              </select>
            </div>

            {/* 8. Country Dropdown (mirrors quick bar for accessibility) */}
            <div>
              <label
                htmlFor="filter-country-select"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Study Destination Country
              </label>
              <select
                id="filter-country-select"
                value={filters.country}
                onChange={(e) => handleFilterChange('country', e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-slate-900"
              >
                <option value="ALL">All 5 Destination Countries</option>
                {MANDATORY_DESTINATION_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Results Count Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 px-1">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
          <span>
            Showing <strong className="font-mono text-slate-900">{paginatedPrograms.length}</strong>{' '}
            of <strong className="font-mono text-slate-900">{filteredPrograms.length}</strong>{' '}
            matching opportunities (Total catalogue: {programs.length})
          </span>
        </div>
        {totalPages > 1 && (
          <div className="font-mono text-slate-600">
            Page {safePage} of {totalPages}
          </div>
        )}
      </div>

      {/* Results List */}
      {paginatedPrograms.length > 0 ? (
        <div className="space-y-4">
          {paginatedPrograms.map((prog) => {
            const dest = getProgramStudyDestination(prog, institutions, scholarships);
            const elig = eligibilityResults.find((e) => e.programId === prog.id);
            const studentElig = mapStudentEligibilityCategory(prog, elig, profile);
            const studentFund = mapStudentFundingSummary(prog, scholarships);
            const studentDead = mapDeadlineStatus(prog);
            const studentVer = mapStudentVerificationConfidence(prog);
            const isSaved = savedProgramIds.has(prog.id);
            const primarySch = scholarships.find((s) => prog.scholarshipIds.includes(s.id));

            return (
              <article
                key={prog.id}
                className="bg-white border border-slate-200 rounded-xl p-5 md:p-6 hover:border-slate-300 transition-colors space-y-4"
              >
                {/* Top Metadata Line: Institution, Destination, Degree, Discipline, Verification Confidence */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2 text-slate-600">
                    <span className="font-semibold text-slate-900">{dest.institutionName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-800">
                      Study Destination: {dest.destinationCountry}
                    </span>
                    {dest.isCrossBorderAdministered && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-500">
                          Administered in {dest.administeringCountry}
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {prog.degreeLevel}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-800">
                      {prog.broadField || prog.discipline}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs">
                    <ShieldCheck
                      className={`w-3.5 h-3.5 ${
                        studentVer.tier === 'CONFIRMED'
                          ? 'text-emerald-700'
                          : studentVer.tier === 'UNAVAILABLE'
                          ? 'text-red-700'
                          : 'text-amber-700'
                      }`}
                    />
                    <span
                      className={`font-semibold ${
                        studentVer.tier === 'CONFIRMED'
                          ? 'text-emerald-700'
                          : studentVer.tier === 'UNAVAILABLE'
                          ? 'text-red-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {studentVer.label}
                    </span>
                  </div>
                </div>

                {/* Title & Linked Award */}
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                    <button
                      type="button"
                      onClick={() => onInspectProgram(prog.id)}
                      className="text-left hover:underline"
                    >
                      {prog.title}
                    </button>
                  </h3>
                  <div className="text-xs text-slate-600">
                    {primarySch ? (
                      <span>
                        Scholarship / Award: <strong className="text-slate-800">{primarySch.name}</strong> (
                        {primarySch.awardingOrganization})
                      </span>
                    ) : (
                      <span>Admission & Departmental Program Track</span>
                    )}
                    {prog.specializations && prog.specializations.length > 0 && (
                      <span> · Subfields: {prog.specializations.slice(0, 4).join(', ')}</span>
                    )}
                  </div>
                </div>

                {/* 4-Column Structured Card Details: Funding, Eligibility, Deadline, Requirements */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 border border-slate-200/80 rounded-lg p-3.5 text-xs">
                  <div>
                    <span className="text-slate-500 block">Funding Summary</span>
                    <span
                      className={`font-semibold mt-0.5 block ${
                        studentFund.isConfirmedFullFunding
                          ? 'text-emerald-800'
                          : 'text-slate-900'
                      }`}
                    >
                      {studentFund.headline}
                    </span>
                    <span className="text-[11px] text-slate-600 block mt-0.5">
                      {studentFund.plainSummary}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block">Eligibility Assessment</span>
                    <span
                      className={`font-semibold mt-0.5 block ${
                        studentElig.category === 'ELIGIBLE'
                          ? 'text-emerald-700'
                          : studentElig.category === 'NOT_ELIGIBLE'
                          ? 'text-red-700'
                          : studentElig.category === 'POTENTIALLY_ELIGIBLE'
                          ? 'text-amber-700'
                          : 'text-slate-700'
                      }`}
                    >
                      {studentElig.label}
                    </span>
                    <span className="text-[11px] text-slate-600 block mt-0.5 line-clamp-2">
                      {studentElig.shortExplanation}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block">Application Deadline</span>
                    <span className="font-mono font-semibold text-slate-900 mt-0.5 block">
                      {studentDead.formattedDate}
                    </span>
                    <span
                      className={`text-[11px] block mt-0.5 ${
                        studentDead.status === 'CLOSING_SOON'
                          ? 'text-amber-700 font-semibold'
                          : studentDead.status === 'OPEN'
                          ? 'text-emerald-700'
                          : 'text-slate-500'
                      }`}
                    >
                      {studentDead.label}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block">Published Academic Criteria</span>
                    <span className="font-mono font-semibold text-slate-900 mt-0.5 block">
                      {prog.requirement.minGpa !== null
                        ? `Min GPA: ${prog.requirement.minGpa}/${prog.requirement.gradingScale || '4.0'}`
                        : prog.requirement.minGradingClassification || 'Grade threshold not stated'}
                    </span>
                    <span className="text-[11px] text-slate-600 block mt-0.5">
                      {prog.requirement.ieltsMinScore
                        ? `IELTS ${prog.requirement.ieltsMinScore}`
                        : 'Check English rules'}{' '}
                      ·GRE: {prog.requirement.greRequirement}
                    </span>
                  </div>
                </div>

                {/* Bottom Action Row: Official Link, Save Action, Open Detail View */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                  <a
                    href={prog.officialProgramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-slate-900 underline underline-offset-4"
                  >
                    <span>Official details link</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onSaveOrUpdateOpportunity(prog.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border font-semibold transition-colors ${
                        isSaved
                          ? 'bg-slate-100 border-slate-300 text-slate-900'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>{isSaved ? 'Saved in My Journey' : 'Save opportunity'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onInspectProgram(prog.id)}
                      className="px-4 py-1.5 rounded-md bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors"
                    >
                      View full breakdown & evidence
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
          <h3 className="text-base font-bold text-slate-900">
            No opportunities match your selected filter combination
          </h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Try clearing one or more filters (such as specialization or deadline state) to view all verified opportunities in the catalogue.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset all filters</span>
          </button>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <nav
          aria-label="Catalogue pagination"
          className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-3 text-xs"
        >
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            className="px-3 py-1.5 font-semibold rounded-md border border-slate-300 text-slate-700 disabled:opacity-40 hover:bg-slate-50"
          >
            Previous Page
          </button>

          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={`w-8 h-8 rounded-md font-mono font-semibold transition-colors ${
                  pageNum === safePage
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {pageNum}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            className="px-3 py-1.5 font-semibold rounded-md border border-slate-300 text-slate-700 disabled:opacity-40 hover:bg-slate-50"
          >
            Next Page
          </button>
        </nav>
      )}
    </div>
  );
};
