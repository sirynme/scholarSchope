import React from 'react';
import { ArrowRight, GraduationCap } from 'lucide-react';
import { STUDY_FIELDS, programInField } from '../lib/opportunity-presentation';
import type { ProgramRecord } from '../lib/types';

interface FieldPickerProps {
  programs: ProgramRecord[];
  onSelectField: (fieldId: string) => void;
}

/**
 * One-tap gate shown before anything else: CS and Microbiology are different
 * worlds, so the student picks their field first and the whole site follows.
 * Renders from STUDY_FIELDS — adding a field there adds a card here.
 */
export const FieldPicker: React.FC<FieldPickerProps> = ({ programs, onSelectField }) => {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 py-16">
      <div className="w-14 h-14 rounded-2xl bg-stone-900 text-white flex items-center justify-center mb-6">
        <GraduationCap className="w-7 h-7" />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700 mb-3">
        ScholarScope · Verified scholarships
      </p>
      <h2 className="text-3xl md:text-4xl font-bold text-stone-900 tracking-tight mb-3">
        What do you study?
      </h2>
      <p className="text-[15px] text-stone-500 max-w-md leading-relaxed mb-10">
        Pick your field once. Everything — recommendations, deadlines, the full
        catalogue — will be scoped to it. You can switch anytime from the top bar.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
        {STUDY_FIELDS.map((field) => {
          const Icon = field.icon;
          const count = programs.filter((p) => programInField(p, field.subject)).length;
          return (
            <button
              key={field.id}
              type="button"
              onClick={() => onSelectField(field.id)}
              className="group text-left bg-white border-2 border-stone-200 rounded-3xl p-7 hover:border-stone-900 hover:shadow-[0_16px_40px_-16px_rgba(0,0,0,0.2)] transition-all"
            >
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-stone-100 text-stone-900 group-hover:bg-stone-900 group-hover:text-white transition-colors mb-4">
                <Icon className="w-6 h-6" />
              </span>
              <div className="text-xl font-bold text-stone-900 mb-1">{field.label}</div>
              <div className="text-[13px] text-stone-500 mb-4">{field.tagline}</div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700">
                  {count} verified opportunities
                </span>
                <span className="inline-flex items-center gap-1 text-[13px] font-bold text-stone-900">
                  Choose <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
