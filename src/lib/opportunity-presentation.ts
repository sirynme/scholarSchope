import {
  Award,
  Banknote,
  Briefcase,
  Building2,
  GraduationCap,
  HandCoins,
  Landmark,
  Microscope,
  Repeat,
  type LucideIcon,
} from 'lucide-react';
import type { ProgramRecord, ScholarshipRecord } from './types';
import {
  getProgramStudyDestination,
  mapDeadlineStatus,
  mapStudentFundingSummary,
} from './student-dashboard';
import type { InstitutionRecord } from './types';

/**
 * Plain-English presentation layer for ScholarScope.
 * Every opportunity gets a clear TYPE badge that answers the first question
 * a student asks: "what kind of scholarship is this, and how does it work?"
 */

export interface OpportunityTypeMeta {
  /** Short badge label, e.g. "Government scholarship" */
  label: string;
  /** One-line plain-English explainer shown under the badge / in tooltips. */
  whatItIs: string;
  icon: LucideIcon;
  /** Tailwind classes for the badge pill. */
  badgeClass: string;
}

export const OPPORTUNITY_TYPE_META: Record<string, OpportunityTypeMeta> = {
  GOVERNMENT_SCHOLARSHIP: {
    label: 'Government scholarship',
    whatItIs:
      'A government pays for your degree. You apply to the scholarship program itself — not the university.',
    icon: Landmark,
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  UNIVERSITY_SCHOLARSHIP: {
    label: 'University scholarship',
    whatItIs:
      'The university itself funds you. Usually one application covers both admission and the funding.',
    icon: Building2,
    badgeClass: 'bg-violet-50 text-violet-800 border-violet-200',
  },
  FOUNDATION_FELLOWSHIP: {
    label: 'Foundation fellowship',
    whatItIs:
      'A private foundation or trust pays. Often the most generous awards — and the most competitive.',
    icon: Award,
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
  },
  RESEARCH_STUDENTSHIP: {
    label: 'Funded PhD position',
    whatItIs:
      'A research position that is the PhD. You are hired to do the research, and the degree comes with it.',
    icon: Microscope,
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  RA_TA_ASSISTANTSHIP: {
    label: 'Assistantship',
    whatItIs:
      'Tuition is covered and you earn a living stipend by assisting in research or teaching.',
    icon: Briefcase,
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
  },
  PAID_RESEARCH_POSITION: {
    label: 'Paid research job',
    whatItIs:
      'A salaried research position that includes a PhD. You earn a real salary while you study.',
    icon: Banknote,
    badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  },
  FELLOWSHIP_EXCHANGE: {
    label: 'Exchange fellowship',
    whatItIs:
      'A funded research stay or exchange — usually shorter than a full degree, great for building a profile.',
    icon: Repeat,
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
  },
  DEGREE_ADMISSION: {
    label: 'Degree admission',
    whatItIs:
      'Apply for the degree itself. Funding, if any, is handled separately — check the linked award.',
    icon: GraduationCap,
    badgeClass: 'bg-stone-100 text-stone-700 border-stone-200',
  },
  SELF_FUNDED_ADMISSION: {
    label: 'Self-funded admission',
    whatItIs:
      'Admission without a linked scholarship. You would cover tuition and living costs yourself.',
    icon: HandCoins,
    badgeClass: 'bg-stone-100 text-stone-600 border-stone-200',
  },
};

export function getOpportunityTypeMeta(typeKey?: string | null): OpportunityTypeMeta {
  if (typeKey && OPPORTUNITY_TYPE_META[typeKey]) return OPPORTUNITY_TYPE_META[typeKey];
  return {
    label: 'Graduate program',
    whatItIs: 'A graduate degree program. Check the funding details to see what is covered.',
    icon: GraduationCap,
    badgeClass: 'bg-stone-100 text-stone-700 border-stone-200',
  };
}

export function getProgramTypeKey(
  program: ProgramRecord,
  scholarships: ScholarshipRecord[]
): string | null {
  if (program.opportunityType) return program.opportunityType;
  const linked = scholarships.find((s) => program.scholarshipIds.includes(s.id));
  return linked?.opportunityType ?? null;
}

/** "Full funding — tuition + £23,152/yr living" in plain words. */
export function humanFundingLine(
  program: ProgramRecord,
  scholarships: ScholarshipRecord[]
): { headline: string; detail: string; isFull: boolean } {
  const funding = mapStudentFundingSummary(program, scholarships);
  const linked = scholarships.filter((s) => program.scholarshipIds.includes(s.id));
  const pkg = linked[0]?.fundingPackage;

  let headline = funding.headline;
  if (funding.isConfirmedFullFunding) {
    const stipend =
      pkg?.stipendAmountAnnual && pkg.stipendAmountAnnual > 0
        ? ` + ${pkg.stipendCurrency || ''} ${pkg.stipendAmountAnnual.toLocaleString()}/yr living`
        : ' + living stipend';
    headline = `Full funding — tuition${stipend}`;
  } else if (program.fundingClassification === 'Tuition Only') {
    headline = 'Tuition covered — you fund living costs';
  } else if (program.fundingClassification === 'Stipend Only') {
    headline = 'Living stipend — tuition not covered';
  } else if (program.fundingClassification === 'Self-Funded / No Scholarship Found') {
    headline = 'No scholarship — self-funded';
  } else if (program.fundingClassification === 'Funding Unverified') {
    headline = 'Funding not yet verified';
  } else if (program.fundingClassification === 'Tuition Funded, Living Costs Uncertain') {
    headline = 'Tuition covered — living costs unclear';
  }

  return { headline, detail: funding.plainSummary, isFull: funding.isConfirmedFullFunding };
}

/** "GPA 3.8 · IELTS 6.5 · 2 yrs work" in plain words. */
export function humanRequirementsLine(program: ProgramRecord): string {
  const req = program.requirement;
  const parts: string[] = [];
  if (req.minGpa !== null && req.minGpa !== undefined) {
    parts.push(`GPA ${req.minGpa}/${req.gradingScale || '4.0'}`);
  } else if (req.minGradingClassification) {
    parts.push(req.minGradingClassification);
  }
  if (req.ieltsMinScore) parts.push(`IELTS ${req.ieltsMinScore}`);
  if (req.workExperienceReq) parts.push(req.workExperienceReq);
  if (parts.length === 0) return 'Check official page for requirements';
  return parts.join('  ·  ');
}

export interface DeadlinePill {
  text: string;
  sub: string;
  pillClass: string;
  dotClass: string;
}

/** Deadline rendered as a human urgency pill. */
export function humanDeadlinePill(program: ProgramRecord): DeadlinePill {
  const d = mapDeadlineStatus(program);
  if (d.status === 'CLOSED') {
    return {
      text: 'Closed',
      sub: d.label,
      pillClass: 'bg-stone-100 text-stone-500 border-stone-200',
      dotClass: 'bg-stone-400',
    };
  }
  if (d.status === 'CLOSING_SOON') {
    const days = d.daysRemaining ?? 0;
    const urgent = days <= 30;
    return {
      text: days <= 1 ? 'Closes tomorrow' : `Closes in ${days} days`,
      sub: d.formattedDate,
      pillClass: urgent
        ? 'bg-red-50 text-red-800 border-red-200'
        : 'bg-amber-50 text-amber-900 border-amber-200',
      dotClass: urgent ? 'bg-red-500' : 'bg-amber-500',
    };
  }
  if (d.status === 'OPEN') {
    return {
      text: `Open — closes ${d.formattedDate}`,
      sub: d.label,
      pillClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      dotClass: 'bg-emerald-500',
    };
  }
  return {
    text: 'Rolling / date not published',
    sub: 'Check the official page',
    pillClass: 'bg-stone-50 text-stone-600 border-stone-200',
    dotClass: 'bg-stone-300',
  };
}

/** "ETH Zurich · Switzerland" style destination line. */
export function humanDestinationLine(
  program: ProgramRecord,
  institutions: InstitutionRecord[],
  scholarships: ScholarshipRecord[]
): string {
  const dest = getProgramStudyDestination(program, institutions, scholarships);
  let line = `${dest.institutionName} · ${dest.destinationCountry}`;
  if (dest.isCrossBorderAdministered && dest.administeringCountry) {
    line += ` (run from ${dest.administeringCountry})`;
  }
  return line;
}

/** Country flag-ish dot color per destination for quick scanning. */
export function countryAccent(country: string): string {
  const c = country.toLowerCase();
  if (c.includes('german')) return 'bg-yellow-400';
  if (c.includes('united kingdom') || c.includes('uk')) return 'bg-indigo-500';
  if (c.includes('united states') || c === 'usa') return 'bg-blue-600';
  if (c.includes('japan')) return 'bg-red-500';
  if (c.includes('china')) return 'bg-red-700';
  if (c.includes('switzerland')) return 'bg-red-400';
  if (c.includes('canada')) return 'bg-red-500';
  return 'bg-stone-400';
}
