import React, { useState } from 'react';
import {
  Calendar,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Zap,
  Flame,
  Award,
  Download,
  Dumbbell,
  Activity,
  Layers,
  ChevronRight
} from 'lucide-react';
import { IOSCard } from '../common/IOSCard';
import { LocalActivityRecord } from '../../utils/localActivityDb';
import { PlannedWorkout } from '../../utils/periodizationEngine';
import { WORKOUT_TEMPLATES } from './WorkoutBuilder';
import { useToast } from '../../context/ToastContext';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';

interface DayWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string; // 'YYYY-MM-DD'
  completedActivities: LocalActivityRecord[];
  plannedWorkouts: PlannedWorkout[];
  onAddWorkout: (workout: PlannedWorkout) => void;
  onDeleteWorkout: (id: string) => void;
}

export const DayWorkoutModal: React.FC<DayWorkoutModalProps> = ({
  isOpen,
  onClose,
  dateStr,
  completedActivities,
  plannedWorkouts,
  onAddWorkout,
  onDeleteWorkout
}) => {
  const { showToast } = useToast();
  const { unitSystem } = useLanguageAndUnit();
  const isImperial = unitSystem === 'imperial';
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(WORKOUT_TEMPLATES[0].id);
  const [customTitle, setCustomTitle] = useState<string>('');
  const [customTss, setCustomTss] = useState<number>(65);
  const [customDuration, setCustomDuration] = useState<number>(60);

  if (!isOpen) return null;

  const handleAddTemplate = () => {
    const tmpl = WORKOUT_TEMPLATES.find(t => t.id === selectedTemplateId);
    if (!tmpl) return;

    // Calculate approximate TSS: ~65 TSS/hr for sweetspot/threshold
    const durationMin = Math.round(tmpl.segments.reduce((acc, s) => acc + s.durationSec, 0) / 60);
    const approxTss = Math.round((durationMin / 60) * 70);

    const newWorkout: PlannedWorkout = {
      id: `wkt-${Date.now()}`,
      date: dateStr,
      title: tmpl.name,
      targetTss: approxTss,
      durationMin,
      category: 'sweetspot',
      templateId: tmpl.id,
      notes: tmpl.description
    };

    onAddWorkout(newWorkout);
    setIsAdding(false);
    showToast(`已将「${tmpl.name}」添加至 ${dateStr}`, 'success');
  };

  const handleAddCustom = () => {
    if (!customTitle.trim()) return;

    const newWorkout: PlannedWorkout = {
      id: `wkt-${Date.now()}`,
      date: dateStr,
      title: customTitle,
      targetTss: customTss,
      durationMin: customDuration,
      category: 'endurance'
    };

    onAddWorkout(newWorkout);
    setIsAdding(false);
    setCustomTitle('');
    showToast(`已添加课表「${customTitle}」`, 'success');
  };

  // Export ZWO file for Zwift
  const handleExportZwo = (wkt: PlannedWorkout) => {
    const zwoXml = `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
  <author>LaBao Pro ATP</author>
  <name>${wkt.title}</name>
  <description>LaBao Pro 年度周期训练课表 · 计划 TSS: ${wkt.targetTss}</description>
  <sportType>bike</sportType>
  <workout>
    <Warmup Duration="600" PowerLow="0.5" PowerHigh="0.75" />
    <SteadyState Duration="${Math.max(600, (wkt.durationMin - 20) * 60)}" Power="0.88" />
    <Cooldown Duration="600" PowerLow="0.75" PowerHigh="0.5" />
  </workout>
</workout_file>`;

    const blob = new Blob([zwoXml], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${wkt.title.replace(/\s+/g, '_')}.zwo`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Zwift 格式课表「${wkt.title}.zwo」已下载！`, 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="w-full sm:max-w-lg bg-white dark:bg-[#1C1C1E] rounded-t-[28px] sm:rounded-2xl border border-black/10 dark:border-white/10 shadow-ios-popover overflow-hidden max-h-[85vh] flex flex-col">
        {/* Mobile Pull Bar */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-white/20"></div>
        </div>

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-ios-blue/15 text-ios-blue flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {dateStr} 训练与活动明细
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                包含已完成实测骑行与排程课表
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 hover:text-slate-700 dark:hover:text-white flex items-center justify-center transition apple-touch"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* Section 1: Completed Activities from IndexedDB */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-500" />
                实际完成活动 ({completedActivities.length})
              </span>
            </div>

            {completedActivities.length > 0 ? (
              <div className="space-y-2">
                {completedActivities.map(act => (
                  <div key={act.id} className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white truncate max-w-[240px]">
                        {act.name}
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {act.tss} TSS
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      <span>{isImperial ? `${(act.distanceKm * 0.621371).toFixed(1)} mi` : `${act.distanceKm} km`}</span>
                      <span>+{isImperial ? `${Math.round(act.elevationGainM * 3.28084)} ft` : `${act.elevationGainM} m`}</span>
                      <span>{Math.round(act.movingTimeSec / 60)} 分钟</span>
                      <span>NP {act.normalizedPower}W</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10 text-xs text-slate-400 text-center">
                当日暂无历史骑行记录
              </div>
            )}
          </div>

          {/* Section 2: Planned Workouts */}
          <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-white/10">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Dumbbell className="w-3.5 h-3.5 text-ios-blue" />
                排程计划课表 ({plannedWorkouts.length})
              </span>
              {!isAdding && (
                <button
                  onClick={() => setIsAdding(true)}
                  className="text-[11px] text-ios-blue hover:underline font-bold flex items-center gap-1 apple-touch"
                >
                  <Plus className="w-3 h-3" />
                  <span>添加课表</span>
                </button>
              )}
            </div>

            {plannedWorkouts.length > 0 ? (
              <div className="space-y-2">
                {plannedWorkouts.map(wkt => (
                  <div key={wkt.id} className="p-3 rounded-xl bg-ios-blue/10 border border-ios-blue/20 text-xs flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{wkt.title}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-ios-blue text-white font-mono">
                          {wkt.targetTss} TSS
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
                        时长 {wkt.durationMin} 分钟 {wkt.notes ? `· ${wkt.notes.slice(0, 20)}...` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleExportZwo(wkt)}
                        className="p-1.5 rounded-lg bg-white/80 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:text-ios-blue transition apple-touch"
                        title="导出 Zwift ZWO 课表"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteWorkout(wkt.id)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition apple-touch"
                        title="删除排课"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : !isAdding ? (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10 text-xs text-slate-400 text-center">
                尚未排布课表，点击上方「添加课表」排入经典训练
              </div>
            ) : null}

            {/* Add Workout Form */}
            {isAdding && (
              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-white flex items-center justify-between">
                  <span>从经典课表库中选择：</span>
                  <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600 apple-touch">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="w-full h-9 bg-white dark:bg-black/40 border border-slate-200/80 dark:border-white/15 rounded-xl px-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-ios-blue"
                  >
                    {WORKOUT_TEMPLATES.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.subtitle})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => setIsAdding(false)}
                    className="apple-touch h-8 px-3 rounded-xl text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 transition"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleAddTemplate}
                    className="apple-touch h-8 px-3.5 rounded-xl bg-ios-blue text-white text-xs font-bold hover:bg-ios-blue/90 transition shadow-ios-sm flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>确认排课</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200/80 dark:border-white/10 flex justify-end bg-slate-50/50 dark:bg-white/5">
          <button
            onClick={onClose}
            className="apple-touch h-9 px-5 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white text-xs font-semibold hover:bg-slate-300 dark:hover:bg-white/15 transition"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
