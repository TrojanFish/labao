import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Info,
  Dumbbell,
  ArrowRight,
  Flame,
  X
} from 'lucide-react';
import { WORKOUT_TEMPLATES, WorkoutTemplate } from '../WorkoutBuilder';

export interface SmartWorkoutRecommendation {
  deficiencyTitle: string;
  deficiencyDesc: string;
  actionAdvice: string;
  template: WorkoutTemplate;
}

interface FitCoachingTabProps {
  coachingNotes: Array<{ type: 'success' | 'warning' | 'info'; title: string; desc: string }>;
  smartWorkoutRecommendation: SmartWorkoutRecommendation | null;
  workKj: number;
  caloriesKcal: number;
  onNavigateTool?: (toolId: string) => void;
  onDispatchSmartWorkout: (template: WorkoutTemplate) => void;
}

export const FitCoachingTab: React.FC<FitCoachingTabProps> = React.memo(({
  coachingNotes,
  smartWorkoutRecommendation,
  workKj,
  caloriesKcal,
  onNavigateTool,
  onDispatchSmartWorkout
}) => {
  const [smartWorkoutModalOpen, setSmartWorkoutModalOpen] = useState(false);
  const [selectedSmartTemplateId, setSelectedSmartTemplateId] = useState<string>('');

  const activeTemplate = smartWorkoutRecommendation
    ? WORKOUT_TEMPLATES.find(t => t.id === (selectedSmartTemplateId || smartWorkoutRecommendation.template.id)) || smartWorkoutRecommendation.template
    : null;

  return (
    <>
      <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-3.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-ios-blue" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {'自动化运动生理学诊断与复原窗口评估'}
          </h3>
        </div>

        <div className="space-y-3">
          {coachingNotes.map((note, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                note.type === 'success'
                  ? 'bg-ios-green/10 border-ios-green/30 text-slate-900 dark:text-emerald-100'
                  : note.type === 'warning'
                  ? 'bg-ios-orange/10 border-ios-orange/30 text-slate-900 dark:text-amber-100'
                  : 'bg-ios-blue/10 border-ios-blue/30 text-slate-900 dark:text-sky-100'
              }`}
            >
              {note.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-ios-green shrink-0 mt-0.5" />
              ) : note.type === 'warning' ? (
                <AlertTriangle className="w-5 h-5 text-ios-orange shrink-0 mt-0.5" />
              ) : (
                <Info className="w-5 h-5 text-ios-blue shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-bold text-sm">{note.title}</div>
                <div className="leading-relaxed opacity-90">{note.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Smart Targeted Workout Recommendation Card */}
        {smartWorkoutRecommendation && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-ios-red/10 via-ios-orange/10 to-transparent border border-ios-red/25 space-y-3 shadow-ios-sm relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-ios-red/15 text-ios-red text-xs font-bold border border-ios-red/25">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>运动科学智能靶向补强推荐</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  短板诊断：{smartWorkoutRecommendation.deficiencyTitle}
                </h4>
              </div>

              {onNavigateTool && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSmartTemplateId(smartWorkoutRecommendation.template.id);
                    setSmartWorkoutModalOpen(true);
                  }}
                  className="apple-touch self-start sm:self-auto shrink-0 h-9 inline-flex items-center gap-2 px-3.5 rounded-xl bg-ios-red hover:bg-ios-red/90 text-white font-bold text-xs shadow-ios-sm transition active:scale-95"
                >
                  <Dumbbell className="w-4 h-4" />
                  <span>配置补强课表</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {smartWorkoutRecommendation.deficiencyDesc}
            </p>

            <div className="p-3 rounded-xl bg-white/80 dark:bg-white/5 border border-black/[0.04] dark:border-white/[0.08] flex items-center justify-between text-xs">
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">推荐专属科学课表</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {smartWorkoutRecommendation.template.name}
                </span>
              </div>
              <span className="text-[11px] text-ios-red font-medium">
                {smartWorkoutRecommendation.template.targetAdaptation}
              </span>
            </div>
          </div>
        )}

        {/* Recovery & Nutrition Advice */}
        <div className="p-3.5 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 text-xs space-y-2">
          <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-ios-orange" />
            {'赛后糖原与肌肉超量恢复建议'}
          </div>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            {`本次骑行累计机械做功 ${workKj} kJ（约消耗 ${caloriesKcal} kcal 热量）。建议骑行结束后 45 分钟黄金恢复窗口内摄入约 ${(caloriesKcal * 0.4 / 4).toFixed(0)}g 易吸收碳水化合物，配合 25g 优质乳清蛋白，促进肌糖原重组与肌原纤维合成。`}
          </p>
        </div>
      </div>

      {/* Smart Workout Generator Modal */}
      {smartWorkoutModalOpen && smartWorkoutRecommendation && activeTemplate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 dark:bg-black/75 backdrop-blur-2xl animate-in fade-in duration-200">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="智能靶向补强课表生成"
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-t-[28px] sm:rounded-2xl p-4 sm:p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-ios-popover space-y-4 sm:space-y-5 bg-white dark:bg-[#1C1C1E] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-5"
          >
            {/* iOS Bottom Sheet Drag Handle */}
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-neutral-600 mx-auto -mt-1 mb-1 sm:hidden shrink-0" />

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-ios-red text-white flex items-center justify-center shadow-ios-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    智能靶向补强课表生成
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    基于本次骑行真实心率、功率与疲劳数据生成
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSmartWorkoutModalOpen(false)}
                className="apple-touch w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Physiological Deficit Diagnosis Alert */}
            <div className="p-3.5 rounded-xl bg-ios-red/10 border border-ios-red/25 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-ios-red">
                <AlertTriangle className="w-4 h-4" />
                <span>生理学短板评估：{smartWorkoutRecommendation.deficiencyTitle}</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {smartWorkoutRecommendation.deficiencyDesc}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium pt-1">
                训练建议：{smartWorkoutRecommendation.actionAdvice}
              </p>
            </div>

            {/* Scientific Workout Template Selection */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>选择训练课表方案：</span>
                <span className="text-[11px] text-ios-red font-normal">已预选最匹配短板方案</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {WORKOUT_TEMPLATES.map((tmpl) => {
                  const isRecommended = tmpl.id === smartWorkoutRecommendation.template.id;
                  const isSelected = activeTemplate.id === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => setSelectedSmartTemplateId(tmpl.id)}
                      className={`p-3 rounded-xl border text-left transition relative apple-touch ${
                        isSelected
                          ? 'bg-ios-red/10 dark:bg-ios-red/20 border-ios-red text-slate-900 dark:text-white ring-2 ring-ios-red/30'
                          : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      {isRecommended && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[11px] font-bold rounded-full bg-ios-red text-white shadow-2xs">
                          推荐
                        </span>
                      )}
                      <div className="font-bold text-xs pr-8">{tmpl.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{tmpl.subtitle}</div>
                      <div className="text-[11px] text-ios-red font-medium mt-1">{tmpl.categoryLabel}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Template Details Preview */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white">{activeTemplate.name}</span>
                <span className="font-mono text-slate-500">共 {activeTemplate.segments.length} 个结构化分段</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                {activeTemplate.description}
              </p>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                靶向适应：{activeTemplate.targetAdaptation}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSmartWorkoutModalOpen(false)}
                className="apple-touch h-9 px-4 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  setSmartWorkoutModalOpen(false);
                  onDispatchSmartWorkout(activeTemplate);
                }}
                className="apple-touch h-9 px-4.5 rounded-xl bg-ios-red hover:bg-ios-red/90 text-white text-xs font-bold shadow-ios-sm flex items-center gap-2 transition active:scale-95"
              >
                <Dumbbell className="w-4 h-4" />
                <span>载入课表工坊并开始训练</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

FitCoachingTab.displayName = 'FitCoachingTab';
