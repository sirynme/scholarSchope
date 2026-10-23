import React from 'react';
import { Bookmark, ChevronRight, ExternalLink } from 'lucide-react';
import type {
  EligibilityResultRecord,
  InstitutionRecord,
  ProgramRecord,
  ScholarshipRecord,
  UserProfileRecord,
} from '../lib/types';
import { mapStudentEligibilityCategory } from '../lib/student-dashboard';
import {
  countryAccent,
  getOpportunityTypeMeta,
  getProgramTypeKey,
  humanDeadlinePill,
  humanDestinationLine,
  humanFundingLine,
  humanRequirementsLine,
} from '../lib/opportunity-presentation';

interface OpportunityCardProps {
  program: ProgramRecord;
  institutions: InstitutionRecord[];
  scholarships: ScholarshipRecord[];
  eligibilityResults: EligibilityResultRecord[];
  profile: UserProfileRecord | null;
  isSaved: boolean;
  onInspect: (programId: string) => void;
  onSave: (programId: string) => void;
  onNavigateToProfile?: () => void;
}

/**
 * One opportunity, explained like a human counselor would:
 * what kind of scholarship it is, what you get, what you need, when it closes.
 */
export const OpportunityCard: React.FC<OpportunityCardProps> = ({
  program,
  institutions,
  scholarships,
  eligibilityResults,
  profile,
  isSaved,
  onInspect,
  onSave,
  onNavigateToProfile,
}) => {
  const typeMeta = getOpportunityTypeMeta(getProgramTypeKey(program, scholarships));
  const TypeIcon = typeMeta.icon;
  const funding = humanFundingLine(program, scholarships);
  const deadline = humanDeadlinePill(program);
  const destination = humanDestinationLine(program, institutions, scholarships);
  const requirements = humanRequirementsLine(program);
  const linkedScholarship = scholarships.find((s) => program.scholarshipIds.includes(s.id));

  const eligibility = mapStudentEligibilityCategory(
    program,
    eligibilityResults.find((e) => e.programId === program.id),
    profile
  );
  const hasProfileData = Boolean(profile?.gpaValue || (profile?.targetFields?.length ?? 0) > 0);

  const destCountry =
    program.institutionId && institutions.find((i) => i.id === program.institutionId)?.country;

  return (
    <article className="group bg-white border border-stone-200 rounded-2xl p-5 flex flex-col gap-4 hover:border-stone-300 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)] transition-all">
      {/* Type badge + degree — answers "what kind of scholarship is this?" first */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          title={typeMeta.whatItIs}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${typeMeta.badgeClass}`}
        >
          <TypeIcon className="w-3.5 h-3.5" />
          {typeMeta.label}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-stone-500">
          <span className={`w-2 h-2 rounded-full ${countryAccent(destCountry || '')}`} />
          {program.degreeLevel}
        </span>
        {program.isExpired && (
          <span className="text-[11px] font-semibold text-stone-400">Applications closed</span>
        )}
      </div>

      {/* Title block */}
      <div className="space-y-1">
        <div className="text-xs text-stone-500 font-medium">{destination}</div>
        <button
          type="button"
          onClick={() => onInspect(program.id)}
          className="text-left text-[17px] font-bold text-stone-900 leading-snug hover:underline decoration-2 underline-offset-2"
        >
          {program.title}
        </button>
        {linkedScholarship && (
          <div className="text-xs text-stone-500">
            via <span className="font-semibold text-stone-700">{linkedScholarship.name}</span>
          </div>
        )}
      </div>

      {/* The deal / what you need — plain language */}
      <dl className="space-y-2 text-[13px] bg-stone-50 border border-stone-100 rounded-xl p-3.5">
        <div className="flex gap-2.5">
          <dt className="shrink-0 w-20 text-stone-400 font-medium text-xs pt-px">You get</dt>
          <dd className={`font-semibold ${funding.isFull ? 'text-emerald-800' : 'text-stone-800'}`}>
            {funding.headline}
          </dd>
        </div>
        <div className="flex gap-2.5">
          <dt className="shrink-0 w-20 text-stone-400 font-medium text-xs pt-px">You need</dt>
          <dd className="text-stone-700">{requirements}</dd>
        </div>
        <div className="flex gap-2.5 items-center">
          <dt className="shrink-0 w-20 text-stone-400 font-medium text-xs">Deadline</dt>
          <dd>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${deadline.pillClass}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${deadline.dotClass}`} />
              {deadline.text}
            </span>
            <span className="text-[11px] text-stone-400 ml-2">{deadline.sub}</span>
          </dd>
        </div>
      </dl>

      {/* Fit line — one human sentence instead of AI bullet lists */}
      <div className="text-xs">
        {hasProfileData ? (
          <span
            className={`font-semibold ${
              eligibility.category === 'ELIGIBLE'
                ? 'text-emerald-700'
                : eligibility.category === 'NOT_ELIGIBLE'
                ? 'text-red-700'
                : eligibility.category === 'POTENTIALLY_ELIGIBLE'
                ? 'text-amber-700'
                : 'text-stone-500'
            }`}
          >
            {eligibility.category === 'ELIGIBLE' && '✓ Looks like a good fit for you'}
            {eligibility.category === 'POTENTIALLY_ELIGIBLE' && '◐ Could fit — check the details'}
            {eligibility.category === 'NOT_ELIGIBLE' && '✕ Likely not a fit for your profile'}
            {eligibility.category === 'NOT_ASSESSED' && '○ Fit not checked yet'}
            {eligibility.shortExplanation && eligibility.category !== 'NOT_ASSESSED' && (
              <span className="font-normal text-stone-500"> — {eligibility.shortExplanation}</span>
            )}
          </span>
        ) : (
          <button
            type="button"
            onClick={onNavigateToProfile}
            className="text-stone-500 hover:text-stone-800 hover:underline text-xs"
          >
            Add your grades to check if you fit →
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 mt-auto">
        <button
          type="button"
          onClick={() => onInspect(program.id)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-900 text-white text-[13px] font-semibold hover:bg-stone-700 transition-colors"
        >
          See details
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onSave(program.id)}
          aria-label={isSaved ? 'Saved' : 'Save this opportunity'}
          className={`p-2.5 rounded-xl border transition-colors ${
            isSaved
              ? 'bg-amber-50 border-amber-300 text-amber-700'
              : 'bg-white border-stone-200 text-stone-500 hover:text-stone-900 hover:border-stone-300'
          }`}
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-amber-400 text-amber-500' : ''}`} />
        </button>
        <a
          href={program.officialProgramUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open official page"
          className="p-2.5 rounded-xl border border-stone-200 text-stone-500 hover:text-stone-900 hover:border-stone-300 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </article>
  );
};
