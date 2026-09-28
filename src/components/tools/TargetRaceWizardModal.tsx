import React, { useState } from 'react';
import {
  Trophy,
  Calendar,
  X,
  CheckCircle2,
  Clock,
  Target,
  Zap,
  Sparkles,
  Mountain,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { IOSCard } from '../common/IOSCard';
import { NumberStepper } from '../common/NumberStepper';
import {
  GoalEvent,
  PRESET_GOAL_EVENTS,
  RacePriority,
  RaceDiscipline
} from '../../utils/periodizationEngine';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';

interface TargetRaceWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveEvent: (event: GoalEvent, weeklyHours: number) => void;
  currentCtl: number;
}

export const TargetRaceWizardModal: React.FC<TargetRaceWizardModalProps> = ({
  isOpen,
  onClose,
  onSaveEvent,
  currentCtl
}) => {
  const { unitSystem } = useLanguageAndUnit();
  const isImperial = unitSystem === 'imperial';
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESET_GOAL_EVENTS[0].id);
  const [name, setName] = useState<string>(PRESET_GOAL_EVENTS[0].name);
  const [date, setDate] = useState<string>(PRESET_GOAL_EVENTS[0].date);
  const [priority, setPriority] = useState<RacePriority>('A');
  const [discipline, setDiscipline] = useState<RaceDiscipline>('gran_fondo');
  const [targetCtl, setTargetCtl] = useState<number>(Math.max(currentCtl + 15, 85));
  const [targetTsb, setTargetTsb] = useState<number>(18);
  const [weeklyHours, setWeeklyHours] = useState<number>(8);
  const [distanceKm, setDistanceKm] = useState<number>(136);
  const [elevationGainM, setElevationGainM] = useState<number>(1100);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: GoalEvent) => {
    setSelectedPresetId(preset.id);
    setName(preset.name);
    setDate(preset.date);
    setPriority(preset.priority);
    setDiscipline(preset.discipline);
    setTargetCtl(preset.targetCtl);
    setTargetTsb(preset.targetTsb);
    if (preset.distanceKm) setDistanceKm(preset.distanceKm);
    if (preset.elevationGainM) setElevationGainM(preset.elevationGainM);
  };

  const handleConfirm = () => {
    const goal: GoalEvent = {
      id: `event-${Date.now()}`,
      name: name || 'A级目标赛事',
      date,
      priority,
      discipline,
      targetCtl,
      targetTsb,
      distanceKm,
      elevationGainM
    };
    onSaveEvent(goal, weeklyHours);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      {/* Container: Desktop Centered Panel / Mobile Bottom Sheet */}
      <div className="w-full sm:max-w-xl bg-white dark:bg-[#1C1C1E] rounded-t-[28px] sm:rounded-2xl border border-black/10 dark:border-white/10 shadow-ios-popover overflow-hidden max-h-[90vh] flex flex-col">
        {/* Mobile Pull Handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-white/20"></div>
        </div>

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-ios-blue/15 text-ios-blue flex items-center justify-center">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                赛事与周期规划
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                第 {step} / 3 步 · {step === 1 ? '选定目标赛事' : step === 2 ? '设定巅峰体能' : '每周训练时间'}
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

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-xs text-slate-600 dark:text-slate-300">
                请选择知名经典耐力赛预设，或手动输入您的赛季 A 级决战赛事：
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRESET_GOAL_EVENTS.map(preset => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      className={`p-3 rounded-xl border text-left transition apple-touch flex flex-col justify-between ${
                        isSelected
                          ? 'bg-ios-blue/15 border-ios-blue text-ios-blue dark:text-white ring-1.5 ring-ios-blue/40'
                          : 'bg-white/60 dark:bg-white/5 border-slate-200/70 dark:border-white/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            preset.priority === 'A' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white'
                          }`}>
                            {preset.priority} 级重点
                          </span>
                          <span className="text-[11px] font-mono tabular-nums text-slate-400">
                            {preset.date}
                          </span>
                        </div>
                        <div className="text-xs font-bold truncate">{preset.name}</div>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 flex items-center justify-between border-t border-slate-200/50 dark:border-white/5 pt-1.5">
                        <span>{preset.distanceKm != null ? (isImperial ? `${(preset.distanceKm * 0.621371).toFixed(1)}mi` : `${preset.distanceKm}km`) : '--'}</span>
                        <span className="text-ios-orange font-semibold">+{preset.elevationGainM != null ? (isImperial ? `${Math.round(preset.elevationGainM * 3.28084)}ft` : `${preset.elevationGainM}m`) : '--'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Event Inputs */}
              <div className="space-y-3 pt-2 border-t border-slate-200/70 dark:border-white/10">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    赛事名称
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setSelectedPresetId('custom');
                    }}
                    className="w-full h-9 bg-white/90 dark:bg-black/40 border border-slate-200/80 dark:border-white/15 rounded-xl px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-ios-blue"
                    placeholder="输入比赛或挑战名称..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      比赛日期
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value);
                        setSelectedPresetId('custom');
                      }}
                      className="w-full h-9 bg-white/90 dark:bg-black/40 border border-slate-200/80 dark:border-white/15 rounded-xl px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-ios-blue"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      赛事优先级
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as RacePriority)}
                      className="w-full h-9 bg-white/90 dark:bg-black/40 border border-slate-200/80 dark:border-white/15 rounded-xl px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-ios-blue"
                    >
                      <option value="A">A 级 · 年度决战，需充分减量巅峰</option>
                      <option value="B">B 级 · 中期检阅，轻度减量</option>
                      <option value="C">C 级 · 以赛代练，无需减量</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-ios-blue/10 border border-ios-blue/20 text-xs text-ios-blue">
                💡 <b>体能反推法则 · Tudor Bompa 模型</b>：算法将以比赛日为锚点，以当前实际体能为基准，向后倒推每周进阶梯度与赛前减量幅度。
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">
                      当前 CTL
                    </span>
                    <span className="text-slate-400 text-[11px]">IndexedDB 最新</span>
                  </div>
                  <div className="w-full h-9 bg-slate-100 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 rounded-xl px-3 flex items-center text-xs font-mono font-bold text-ios-blue tabular-nums">
                    {currentCtl} CTL · 历史均值
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">
                      比赛日目标体能 CTL
                    </span>
                    <span className="text-ios-green text-[11px] font-semibold">推荐 +15~25</span>
                  </div>
                  <NumberStepper
                    value={targetCtl}
                    onChange={setTargetCtl}
                    min={40}
                    max={130}
                    step={5}
                    unit="CTL"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">
                    比赛日目标 TSB
                  </span>
                  <span className="text-amber-500 font-bold tabular-nums">+{targetTsb}</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  TSB 在 +15 ~ +25 属于绝佳比赛状态（疲劳消退，身体充满活力）。
                </div>
                <NumberStepper
                  value={targetTsb}
                  onChange={setTargetTsb}
                  min={5}
                  max={30}
                  step={2}
                  unit="TSB"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  每周可支配训练时长配额
                </label>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
                  算法将根据可用小时数智能匹配每周目标 TSS 与课表长短：
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 8, 10, 14].map(h => (
                    <button
                      key={h}
                      onClick={() => setWeeklyHours(h)}
                      className={`apple-touch h-12 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center transition ${
                        weeklyHours === h
                          ? 'bg-ios-blue text-white border-ios-blue shadow-ios-sm'
                          : 'bg-white/70 dark:bg-white/5 border-slate-200/70 dark:border-white/10 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="font-bold tabular-nums">{h} 小时/周</span>
                      <span className="text-[10px] opacity-75">~{h * 55} TSS</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Plan Preview Banner */}
              <IOSCard variant="default" padding="none" className="p-3.5 space-y-2 bg-slate-50 dark:bg-white/5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
                  <Sparkles className="w-3.5 h-3.5 text-ios-blue" />
                  <span>即将为您构建的周期化架构：</span>
                </div>
                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <li>• <b>3:1 周期递增</b>：3 周负荷递增超量刺激 + 1 周恢复减量巩固；</li>
                  <li>• <b>智能阶段衔接</b>：有氧底盘 Base → 进阶建立 Build → 巅峰 Peak → 赛前 2 周减量 Taper；</li>
                  <li>• <b>课表库自动互联</b>：每周精选 2-3 堂核心训练（Rønnestad 30/15, 2x20min FTP, Z2 长距离）。</li>
                </ul>
              </IOSCard>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-white/5">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as any)}
              className="apple-touch h-9 px-4 rounded-xl bg-white dark:bg-white/10 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200/80 dark:border-white/10 transition flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>上一步</span>
            </button>
          ) : (
            <div></div>
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as any)}
              className="apple-touch h-9 px-4 rounded-xl bg-ios-blue hover:bg-ios-blue/90 text-white text-xs font-bold transition shadow-ios-sm flex items-center gap-1"
            >
              <span>下一步</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              className="apple-touch h-9 px-4 rounded-xl bg-ios-blue hover:bg-ios-blue/90 text-white text-xs font-bold transition shadow-ios-sm flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>一键生成 ATP 周期规划</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
