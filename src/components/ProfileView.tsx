import React from 'react';
import { Plus, Trash2, Save, CheckCircle2 } from 'lucide-react';
import {
  FundingPreferenceMode,
  GradingScale,
  SUBJECT_TAXONOMY,
  UserProfileRecord,
  UserQualificationRecord,
} from '../lib/types';
import { STUDY_FIELDS, type StudyField } from '../lib/opportunity-presentation';

interface ProfileViewProps {
  profile: UserProfileRecord | null;
  qualifications: UserQualificationRecord[];
  activeField: StudyField | undefined;
  onSelectField: (fieldId: string) => void;
  onSaveProfile: (updated: Partial<UserProfileRecord>) => Promise<void>;
  onAddQualification: (q: {
    title: string;
    institution: string;
    category: string;
    details: string;
    completedDate: string;
  }) => Promise<void>;
  onDeleteQualification: (id: string) => Promise<void>;
}

const AVAILABLE_DEGREES = ['MS', 'MSc', 'MPhil', 'MRes', 'PhD', 'Integrated MS/PhD'];
const MANDATORY_FIVE_COUNTRIES = [
  'Germany',
  'United Kingdom',
  'United States',
  'Japan',
  'China',
];
const AVAILABLE_COUNTRIES = [
  'Germany',
  'United Kingdom',
  'United States',
  'Japan',
  'China',
  'Switzerland',
  'Canada',
  'Saudi Arabia',
  'Australia',
  'Pakistan',
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  qualifications,
  activeField,
  onSelectField,
  onSaveProfile,
  onAddQualification,
  onDeleteQualification,
}) => {
  const [citizenship, setCitizenship] = React.useState(profile?.citizenship || 'Pakistan');
  const [residencyCountry, setResidencyCountry] = React.useState(profile?.residencyCountry || 'Pakistan');
  const [ageYears, setAgeYears] = React.useState<string>(
    profile?.ageYears !== null && profile?.ageYears !== undefined ? String(profile.ageYears) : '23'
  );
  const [currentDegree, setCurrentDegree] = React.useState(profile?.currentDegree || '');
  const [currentUniversity, setCurrentUniversity] = React.useState(profile?.currentUniversity || '');
  const [gpaValue, setGpaValue] = React.useState<string>(
    profile?.gpaValue !== null && profile?.gpaValue !== undefined ? String(profile.gpaValue) : ''
  );
  const [gradingScale, setGradingScale] = React.useState<GradingScale>(
    profile?.gradingScale || '4.0'
  );
  const [gradingClassification, setGradingClassification] = React.useState(
    profile?.gradingClassification || 'First Class'
  );
  const [graduationDate, setGraduationDate] = React.useState(profile?.graduationDate || '2026-07-15');
  const [prereqsText, setPrereqsText] = React.useState(
    (profile?.completedPrerequisites || []).join(', ')
  );
  const [englishTestType, setEnglishTestType] = React.useState<
    'IELTS' | 'TOEFL_IBT' | 'CAMBRIDGE' | 'NATIVE_EXEMPT' | 'NONE'
  >(profile?.englishTestType || 'IELTS');
  const [englishTestScore, setEnglishTestScore] = React.useState<string>(
    profile?.englishTestScore !== null && profile?.englishTestScore !== undefined
      ? String(profile.englishTestScore)
      : ''
  );
  const [greVerbal, setGreVerbal] = React.useState<string>(
    profile?.greVerbal ? String(profile.greVerbal) : ''
  );
  const [greQuant, setGreQuant] = React.useState<string>(
    profile?.greQuant ? String(profile.greQuant) : ''
  );
  const [researchMonths, setResearchMonths] = React.useState<string>(
    String(profile?.researchMonths ?? 0)
  );
  const [publicationsCount, setPublicationsCount] = React.useState<string>(
    String(profile?.publicationsCount ?? 0)
  );
  const [workExperienceMonths, setWorkExperienceMonths] = React.useState<string>(
    String(profile?.workExperienceMonths ?? 0)
  );
  const [skillsText, setSkillsText] = React.useState(
    (profile?.technicalSkills || []).join(', ')
  );
  const [applicationBudgetUsd, setApplicationBudgetUsd] = React.useState<string>(
    profile?.applicationBudgetUsd !== null && profile?.applicationBudgetUsd !== undefined
      ? String(profile.applicationBudgetUsd)
      : ''
  );
  const [targetDegrees, setTargetDegrees] = React.useState<string[]>(
    profile?.targetDegrees || ['MSc', 'MS', 'MPhil', 'PhD']
  );
  const [targetFields, setTargetFields] = React.useState<string[]>(
    profile?.targetFields ||
      (activeField ? [activeField.subject] : ['Computer Science'])
  );
  const [fundingPreferenceMode, setFundingPreferenceMode] = React.useState<FundingPreferenceMode>(
    profile?.fundingPreferenceMode ||
      (profile?.requireFullFunding ? 'FULLY_FUNDED_ONLY' : 'INCLUDE_SELF_FUNDED')
  );
  const [preferredCountries, setPreferredCountries] = React.useState<string[]>(
    profile?.preferredCountries || [
      'Germany',
      'United Kingdom',
      'United States',
      'Japan',
      'China',
    ]
  );
  const [requireFullFunding, setRequireFullFunding] = React.useState<boolean>(
    profile?.requireFullFunding ?? false
  );
  const [minAnnualLivingSupportUsd, setMinAnnualLivingSupportUsd] = React.useState<string>(
    profile?.minAnnualLivingSupportUsd !== null && profile?.minAnnualLivingSupportUsd !== undefined
      ? String(profile.minAnnualLivingSupportUsd)
      : '15000'
  );
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = React.useState<boolean>(
    profile?.emailNotificationsEnabled ?? true
  );
  const [reminderDays, setReminderDays] = React.useState<string>(
    (profile?.reminderDaysBeforeDeadline || [30, 14, 7, 1]).join(', ')
  );

  // Qualification form
  const [qualTitle, setQualTitle] = React.useState('');
  const [qualInst, setQualInst] = React.useState('');
  const [qualCat, setQualCat] = React.useState('transcript');
  const [qualDetails, setQualDetails] = React.useState('');
  const [qualDate, setQualDate] = React.useState('2026-06-01');

  const [saving, setSaving] = React.useState(false);
  const [saveBanner, setSaveBanner] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!profile) return;
    setCitizenship(profile.citizenship || 'Pakistan');
    setResidencyCountry(profile.residencyCountry || 'Pakistan');
    setAgeYears(profile.ageYears !== null && profile.ageYears !== undefined ? String(profile.ageYears) : '');
    setCurrentDegree(profile.currentDegree || '');
    setCurrentUniversity(profile.currentUniversity || '');
    setGpaValue(profile.gpaValue !== null ? String(profile.gpaValue) : '');
    setGradingScale(profile.gradingScale || '4.0');
    setGradingClassification(profile.gradingClassification || '');
    setGraduationDate(profile.graduationDate || '');
    setPrereqsText((profile.completedPrerequisites || []).join(', '));
    setEnglishTestType(profile.englishTestType || 'IELTS');
    setEnglishTestScore(profile.englishTestScore !== null ? String(profile.englishTestScore) : '');
    setGreVerbal(profile.greVerbal ? String(profile.greVerbal) : '');
    setGreQuant(profile.greQuant ? String(profile.greQuant) : '');
    setResearchMonths(String(profile.researchMonths ?? 0));
    setPublicationsCount(String(profile.publicationsCount ?? 0));
    setWorkExperienceMonths(String(profile.workExperienceMonths ?? 0));
    setSkillsText((profile.technicalSkills || []).join(', '));
    setApplicationBudgetUsd(
      profile.applicationBudgetUsd !== null ? String(profile.applicationBudgetUsd) : ''
    );
    setTargetDegrees(profile.targetDegrees || []);
    setTargetFields(profile.targetFields || []);
    setFundingPreferenceMode(
      profile.fundingPreferenceMode ||
        (profile.requireFullFunding ? 'FULLY_FUNDED_ONLY' : 'INCLUDE_SELF_FUNDED')
    );
    setPreferredCountries(profile.preferredCountries || []);
    setRequireFullFunding(profile.requireFullFunding);
    setMinAnnualLivingSupportUsd(
      profile.minAnnualLivingSupportUsd !== null ? String(profile.minAnnualLivingSupportUsd) : ''
    );
    setEmailNotificationsEnabled(profile.emailNotificationsEnabled);
    setReminderDays((profile.reminderDaysBeforeDeadline || [30, 14, 7, 1]).join(', '));
  }, [profile]);

  const toggleItem = (list: string[], item: string, setter: (v: string[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter((x) => x !== item));
    } else {
      setter([...list, item]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveBanner(null);
    setSaveError(null);
    try {
      const effectiveRequireFull = fundingPreferenceMode === 'FULLY_FUNDED_ONLY';
      await onSaveProfile({
        citizenship: citizenship.trim() || null,
        residencyCountry: residencyCountry.trim() || null,
        ageYears: ageYears.trim() !== '' ? Number(ageYears) : null,
        currentDegree: currentDegree.trim() || null,
        currentUniversity: currentUniversity.trim() || null,
        gpaValue: gpaValue.trim() !== '' ? Number(gpaValue) : null,
        gradingScale,
        gradingClassification: gradingClassification.trim() || null,
        graduationDate: graduationDate.trim() || null,
        completedPrerequisites: prereqsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        englishTestType,
        englishTestScore: englishTestScore.trim() !== '' ? Number(englishTestScore) : null,
        greVerbal: greVerbal.trim() !== '' ? Number(greVerbal) : null,
        greQuant: greQuant.trim() !== '' ? Number(greQuant) : null,
        researchMonths: Number(researchMonths) || 0,
        publicationsCount: Number(publicationsCount) || 0,
        workExperienceMonths: Number(workExperienceMonths) || 0,
        technicalSkills: skillsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        applicationBudgetUsd:
          applicationBudgetUsd.trim() !== '' ? Number(applicationBudgetUsd) : null,
        targetDegrees,
        targetFields,
        fundingPreferenceMode,
        preferredCountries,
        requireFullFunding: effectiveRequireFull,
        minAnnualLivingSupportUsd:
          minAnnualLivingSupportUsd.trim() !== '' ? Number(minAnnualLivingSupportUsd) : null,
        emailNotificationsEnabled,
        reminderDaysBeforeDeadline: reminderDays
          .split(',')
          .map((d) => Number.parseInt(d.trim(), 10))
          .filter((n) => !Number.isNaN(n) && n > 0),
      });
      setSaveBanner(
        'Profile preferences saved. All Pakistani citizenship, CS/Microbiology taxonomy, and 5-country funding eligibility matches have been deterministically recalculated.'
      );
    } catch (err: any) {
      setSaveError(
        err?.message ||
          'Failed to save profile changes. Your entered information is still on this form — please review and try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAddQual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qualTitle.trim() || !qualInst.trim()) return;
    await onAddQualification({
      title: qualTitle,
      institution: qualInst,
      category: qualCat,
      details: qualDetails,
      completedDate: qualDate,
    });
    setQualTitle('');
    setQualInst('');
    setQualDetails('');
  };

  const handleSelectAllFiveCountries = () => {
    const merged = Array.from(new Set([...preferredCountries, ...MANDATORY_FIVE_COUNTRIES]));
    setPreferredCountries(merged);
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-stone-200 pb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900">
            Pakistani Applicant Profile, Academic Scales & 5-Country Preferences
          </h1>
          <p className="text-xs text-stone-600 mt-1">
            ScholarScope evaluates your exact grading scale without invented linear conversions. Missing fields are flagged as Insufficient Information rather than disqualifying you.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSelectAllFiveCountries}
          className="px-3.5 py-2 text-xs font-semibold text-stone-900 bg-stone-100 hover:bg-stone-200 border border-stone-300 rounded-md transition-colors"
        >
          Include All 5 Priority Countries (DE · UK · US · JP · CN)
        </button>
      </div>

      {saveError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-900"
        >
          <span>{saveError}</span>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="font-semibold underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {saveBanner && (
        <div className="flex items-center gap-2 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{saveBanner}</span>
        </div>
      )}

      {/* Progressive Onboarding Quick Summary Bar */}
      <div className="bg-stone-900 text-white rounded-lg p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
        <div>
          <span className="text-stone-400 block text-[11px]">Citizenship & Residency</span>
          <span className="font-semibold text-white">
            {citizenship || 'Unset'} ({residencyCountry || 'Unset'})
          </span>
        </div>
        <div>
          <span className="text-stone-400 block text-[11px]">Academic Scale & GPA</span>
          <span className="font-mono font-semibold text-white">
            {gpaValue ? `${gpaValue} / ${gradingScale}` : 'GPA Unset'}
          </span>
        </div>
        <div>
          <span className="text-stone-400 block text-[11px]">English Exam Status</span>
          <span className="font-mono font-semibold text-white">
            {englishTestType} {englishTestScore ? `(${englishTestScore})` : ''}
          </span>
        </div>
        <div>
          <span className="text-stone-400 block text-[11px]">Target Fields</span>
          <span className="font-semibold text-white truncate block">
            {activeField ? activeField.label : targetFields[0] || 'Not chosen yet'}
          </span>
        </div>
        <div>
          <span className="text-stone-400 block text-[11px]">Target Degrees</span>
          <span className="font-mono font-semibold text-white">
            {targetDegrees.join(', ') || 'MSc, PhD'}
          </span>
        </div>
        <div>
          <span className="text-stone-400 block text-[11px]">Priority Countries Active</span>
          <span className="font-mono font-semibold text-emerald-400">
            {MANDATORY_FIVE_COUNTRIES.filter((c) => preferredCountries.includes(c)).length}/5 Core
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 1. Citizenship, Academic Standing & Grading Scale */}
        <section className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-stone-900 border-b border-stone-100 pb-2">
            01. Your background
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="prof-citizenship" className="block text-xs font-medium text-stone-700 mb-1">
                Country of Citizenship (Prioritized: Pakistan)
              </label>
              <input
                id="prof-citizenship"
                type="text"
                value={citizenship}
                onChange={(e) => setCitizenship(e.target.value)}
                placeholder="e.g. Pakistan"
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="prof-residency" className="block text-xs font-medium text-stone-700 mb-1">
                Country of Current Residency (Required for USEFP / HEC / Commonwealth)
              </label>
              <input
                id="prof-residency"
                type="text"
                value={residencyCountry}
                onChange={(e) => setResidencyCountry(e.target.value)}
                placeholder="e.g. Pakistan"
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="prof-age" className="block text-xs font-medium text-stone-700 mb-1">
                Applicant Age (Years — Evaluated for MEXT / HEC Age Caps)
              </label>
              <input
                id="prof-age"
                type="number"
                min={16}
                max={80}
                value={ageYears}
                onChange={(e) => setAgeYears(e.target.value)}
                placeholder="e.g. 24"
                className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="prof-degree" className="block text-xs font-medium text-stone-700 mb-1">
                Current / Most Recent Degree
              </label>
              <input
                id="prof-degree"
                type="text"
                value={currentDegree}
                onChange={(e) => setCurrentDegree(e.target.value)}
                placeholder="e.g. BS in Computer Science or BS in Microbiology"
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="prof-univ" className="block text-xs font-medium text-stone-700 mb-1">
                Current / Awarding University
              </label>
              <input
                id="prof-univ"
                type="text"
                value={currentUniversity}
                onChange={(e) => setCurrentUniversity(e.target.value)}
                placeholder="e.g. NUST Islamabad, LUMS, Quaid-i-Azam University"
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="prof-scale" className="block text-xs font-medium text-stone-700 mb-1">
                Official Grading Scale (No Invented Conversion)
              </label>
              <select
                id="prof-scale"
                value={gradingScale}
                onChange={(e) => setGradingScale(e.target.value as GradingScale)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-md bg-white"
              >
                <option value="4.0">4.0 Scale (HEC Pakistan / US Standard CGPA)</option>
                <option value="100%">100% Percentage / Annual System Scale</option>
                <option value="UK_HONORS">UK Honours Classification (First / 2:1 / 2:2)</option>
                <option value="10.0">10.0 Scale (International CGPA)</option>
                <option value="GERMAN_1_5">German 1.0–5.0 Scale (1.0 = Best)</option>
                <option value="SWISS_6_0">Swiss 6.0 Scale (6.0 = Best)</option>
              </select>
            </div>

            <div>
              <label htmlFor="prof-gpa" className="block text-xs font-medium text-stone-700 mb-1">
                Numeric GPA / Grade Value (Leave blank if unknown)
              </label>
              <input
                id="prof-gpa"
                type="number"
                step="0.01"
                value={gpaValue}
                onChange={(e) => setGpaValue(e.target.value)}
                placeholder="e.g. 3.88"
                className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="prof-honors" className="block text-xs font-medium text-stone-700 mb-1">
                Honours / Degree Classification (if applicable)
              </label>
              <select
                id="prof-honors"
                value={gradingClassification}
                onChange={(e) => setGradingClassification(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-md bg-white"
              >
                <option value="">None / Numeric Only</option>
                <option value="First Class">First Class Honours / 1st Division</option>
                <option value="2:1">Upper Second-Class (2:1)</option>
                <option value="2:2">Lower Second-Class (2:2)</option>
              </select>
            </div>

            <div>
              <label htmlFor="prof-grad-date" className="block text-xs font-medium text-stone-700 mb-1">
                Graduation Date (Actual or Expected)
              </label>
              <input
                id="prof-grad-date"
                type="date"
                value={graduationDate}
                onChange={(e) => setGraduationDate(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-md"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label htmlFor="prof-prereqs" className="block text-xs font-medium text-stone-700 mb-1">
                Completed Prerequisite Courses (Comma-separated)
              </label>
              <input
                id="prof-prereqs"
                type="text"
                value={prereqsText}
                onChange={(e) => setPrereqsText(e.target.value)}
                placeholder="Algorithms, Linear Algebra, Molecular Biology, Microbial Genetics, Biochemistry..."
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-md"
              />
            </div>
          </div>
        </section>

        {/* 2. Language Tests, GRE, Research & Budget */}
        <section className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-stone-900 border-b border-stone-100 pb-2">
            02. Tests, research & budget
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="prof-eng-type" className="block text-xs font-medium text-stone-700 mb-1">
                English Language Qualification
              </label>
              <select
                id="prof-eng-type"
                value={englishTestType}
                onChange={(e) => setEnglishTestType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-md bg-white"
              >
                <option value="IELTS">IELTS Academic</option>
                <option value="TOEFL_IBT">TOEFL iBT</option>
                <option value="CAMBRIDGE">Cambridge C1/C2</option>
                <option value="NATIVE_EXEMPT">English-Medium Instruction Certificate / Waiver</option>
                <option value="NONE">Not Yet Taken</option>
              </select>
            </div>

            <div>
              <label htmlFor="prof-eng-score" className="block text-xs font-medium text-stone-700 mb-1">
                English Test Overall Score
              </label>
              <input
                id="prof-eng-score"
                type="number"
                step="0.5"
                value={englishTestScore}
                onChange={(e) => setEnglishTestScore(e.target.value)}
                placeholder="e.g. 8.0 or 108"
                className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="prof-gre-q" className="block text-xs font-medium text-stone-700 mb-1">
                GRE Quantitative (130–170, optional)
              </label>
              <input
                id="prof-gre-q"
                type="number"
                value={greQuant}
                onChange={(e) => setGreQuant(e.target.value)}
                placeholder="168"
                className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="prof-gre-v" className="block text-xs font-medium text-stone-700 mb-1">
                GRE Verbal (130–170, optional)
              </label>
              <input
                id="prof-gre-v"
                type="number"
                value={greVerbal}
                onChange={(e) => setGreVerbal(e.target.value)}
                placeholder="162"
                className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="prof-res-mos" className="block text-xs font-medium text-stone-700 mb-1">
                Research Experience (Months)
              </label>
              <input
                id="prof-res-mos"
                type="number"
                min={0}
                value={researchMonths}
                onChange={(e) => setResearchMonths(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="prof-pubs" className="block text-xs font-medium text-stone-700 mb-1">
                Peer-Reviewed Publications
              </label>
              <input
                id="prof-pubs"
                type="number"
                min={0}
                value={publicationsCount}
                onChange={(e) => setPublicationsCount(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="prof-work" className="block text-xs font-medium text-stone-700 mb-1">
                Work / Industry Experience (Months)
              </label>
              <input
                id="prof-work"
                type="number"
                min={0}
                value={workExperienceMonths}
                onChange={(e) => setWorkExperienceMonths(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="prof-budget" className="block text-xs font-medium text-stone-700 mb-1">
                Application Fee Budget (USD)
              </label>
              <input
                id="prof-budget"
                type="number"
                min={0}
                value={applicationBudgetUsd}
                onChange={(e) => setApplicationBudgetUsd(e.target.value)}
                placeholder="250"
                className="w-full px-3 py-2 text-xs font-mono border border-stone-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label htmlFor="prof-skills" className="block text-xs font-medium text-stone-700 mb-1">
              Technical & Laboratory Skills (Comma-separated)
            </label>
            <input
              id="prof-skills"
              type="text"
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              placeholder="Python, PyTorch, C++, PCR, Whole-Genome Sequencing, Antimicrobial Susceptibility Testing, Bioinformatics..."
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-md"
            />
          </div>
        </section>

        {/* 3. Target Degrees, CS & Microbiology Taxonomies, Countries & Funding Preferences */}
        <section className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-semibold text-stone-900 border-b border-stone-100 pb-2">
            03. Your field, degrees & funding
          </h2>

          <div className="space-y-5">
            <div>
              <span className="block text-xs font-medium text-stone-700 mb-2">
                Target Degree & Pathway Levels
              </span>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_DEGREES.map((deg) => {
                  const active = targetDegrees.includes(deg);
                  return (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => toggleItem(targetDegrees, deg, setTargetDegrees)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                        active
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      {deg}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-stone-700 mb-2">
                Your field of study
              </span>
              <p className="text-[11px] text-stone-500 mb-2">
                One field at a time — recommendations, deadlines and the catalogue all
                follow this choice.
              </p>
              <div className="flex flex-wrap gap-2">
                {STUDY_FIELDS.map((f) => {
                  const Icon = f.icon;
                  const isActive = activeField?.id === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        onSelectField(f.id);
                        // Keep the saved profile consistent: field first, keep only
                        // specializations that belong to the newly chosen field.
                        setTargetFields((prev) => {
                          const specs = prev.filter((t) =>
                            SUBJECT_TAXONOMY.some(
                              (s) =>
                                s.label === t &&
                                (s.broadField === f.subject ||
                                  s.broadField === 'Interdisciplinary (CS & Bio)')
                            )
                          );
                          return [f.subject, ...specs];
                        });
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                        isActive
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-stone-100">
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-stone-800">
                  {activeField ? activeField.label : 'Field'} specializations
                  <span className="font-normal text-stone-500">
                    {' '}— pick the areas closest to your degree
                  </span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SUBJECT_TAXONOMY.filter(
                    (s) =>
                      (activeField && s.broadField === activeField.subject) ||
                      s.broadField === 'Interdisciplinary (CS & Bio)'
                  ).map((spec) => {
                    const active = targetFields.includes(spec.label);
                    return (
                      <button
                        key={spec.id}
                        type="button"
                        onClick={() =>
                          toggleItem(targetFields, spec.label, setTargetFields)
                        }
                        className={`px-2.5 py-1 text-[11px] font-medium rounded border transition-colors ${
                          active
                            ? 'bg-stone-900 text-white border-stone-900'
                            : 'bg-stone-50 text-stone-700 border-stone-300 hover:bg-stone-100'
                        }`}
                      >
                        {spec.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-stone-700 mb-2">
                Preferred Destination Countries Worldwide
              </span>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_COUNTRIES.map((country) => {
                  const active = preferredCountries.includes(country);
                  return (
                    <button
                      key={country}
                      type="button"
                      onClick={() =>
                        toggleItem(preferredCountries, country, setPreferredCountries)
                      }
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                        active
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      {country}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-stone-100">
              <div>
                <label
                  htmlFor="prof-funding-mode"
                  className="block text-xs font-medium text-stone-700 mb-1"
                >
                  Funding Preference Mode (4-Tier Filter)
                </label>
                <select
                  id="prof-funding-mode"
                  value={fundingPreferenceMode}
                  onChange={(e) => {
                    const mode = e.target.value as FundingPreferenceMode;
                    setFundingPreferenceMode(mode);
                    setRequireFullFunding(mode === 'FULLY_FUNDED_ONLY');
                  }}
                  className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-md bg-white"
                >
                  <option value="FULLY_FUNDED_ONLY">
                    1. Fully Funded Only (100% Tuition + Benchmarked Stipend)
                  </option>
                  <option value="SUBSTANTIAL_FUNDING">
                    2. Substantial Funding (Full + Partial + Tuition Waivers)
                  </option>
                  <option value="ANY_FUNDING">
                    3. Any Scholarship, Fellowship or Assistantship
                  </option>
                  <option value="INCLUDE_SELF_FUNDED">
                    4. Include Self-Funded Degree Admissions
                  </option>
                </select>
              </div>

              <div>
                <label htmlFor="prof-min-stipend" className="block text-xs font-medium text-stone-700 mb-1">
                  Min Acceptable Annual Living Support (USD)
                </label>
                <input
                  id="prof-min-stipend"
                  type="number"
                  value={minAnnualLivingSupportUsd}
                  onChange={(e) => setMinAnnualLivingSupportUsd(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono border border-stone-300 rounded-md"
                />
              </div>

              <div>
                <label htmlFor="prof-reminders" className="block text-xs font-medium text-stone-700 mb-1">
                  Deadline Reminder Windows (Days Before)
                </label>
                <input
                  id="prof-reminders"
                  type="text"
                  value={reminderDays}
                  onChange={(e) => setReminderDays(e.target.value)}
                  placeholder="30, 14, 7, 1"
                  className="w-full px-3 py-1.5 text-xs font-mono border border-stone-300 rounded-md"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-md transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Recalculating Matches…' : 'Save Profile & Recalculate All Matches'}</span>
            </button>
          </div>
        </section>
      </form>

      {/* 4. Academic Transcripts, Publications & Qualifications Ledger */}
      <section className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-stone-900 border-b border-stone-100 pb-2">
          04. Transcripts, publications & projects ({qualifications.length})
        </h2>

        <div className="space-y-3">
          {qualifications.map((q) => (
            <div
              key={q.id}
              className="flex items-start justify-between gap-4 border border-stone-200 rounded-md p-3.5 text-xs"
            >
              <div className="space-y-1">
                <div className="font-semibold text-stone-900">
                  {q.title} <span className="font-normal text-stone-500">· {q.institution} · {q.category.toUpperCase()}</span>
                </div>
                <p className="text-stone-600">{q.details}</p>
                {q.completedDate && (
                  <div className="text-[11px] font-mono text-stone-500">Date: {q.completedDate}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDeleteQualification(q.id)}
                aria-label={`Delete qualification ${q.title}`}
                className="p-1.5 text-stone-400 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddQual} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-stone-100">
          <input
            type="text"
            required
            value={qualTitle}
            onChange={(e) => setQualTitle(e.target.value)}
            placeholder="Qualification / Paper Title"
            aria-label="Qualification Title"
            className="px-3 py-2 text-xs border border-stone-300 rounded-md"
          />
          <input
            type="text"
            required
            value={qualInst}
            onChange={(e) => setQualInst(e.target.value)}
            placeholder="Institution / Venue"
            aria-label="Qualification Institution"
            className="px-3 py-2 text-xs border border-stone-300 rounded-md"
          />
          <select
            value={qualCat}
            onChange={(e) => setQualCat(e.target.value)}
            aria-label="Qualification Category"
            className="px-3 py-2 text-xs border border-stone-300 rounded-md bg-white"
          >
            <option value="transcript">Academic Transcript</option>
            <option value="publication">Research Publication</option>
            <option value="project">Technical Project</option>
            <option value="employment">Research / Industry Employment</option>
            <option value="exam">Standardized Examination</option>
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-md"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Qualification Record</span>
          </button>
          <input
            type="text"
            value={qualDetails}
            onChange={(e) => setQualDetails(e.target.value)}
            placeholder="Supporting details (grade breakdown, DOI, supervisor, key coursework)..."
            aria-label="Qualification Details"
            className="sm:col-span-4 px-3 py-2 text-xs border border-stone-300 rounded-md"
          />
        </form>
      </section>
    </div>
  );
};
