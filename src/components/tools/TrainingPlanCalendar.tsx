import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Trophy,
  Dumbbell,
  TrendingUp,
  Zap,
  Flame,
  Award,
  Clock,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Plus,
  Share2,
  Download,
  CheckCircle2,
  AlertCircle,
  BarChart2,
  Activity,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler
} from 'chart.js';
import { useToast } from '../../context/ToastContext';
import { useRiderProfile } from '../../context/RiderProfileContext';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';
import { IOSCard, IOSMetricTile } from '../common/IOSCard';
import { IOSToolHeader } from '../common/IOSToolHeader';
import { IOSSegmentedControl } from '../common/IOSSegmentedControl';
import { ShareCardModal } from '../common/ShareCardModal';
import {
  GoalEvent,
  PlannedWorkout,
  PeriodizationPlanSummary,
  generateAnnualTrainingPlan,
  loadSavedGoalEvent,
  saveGoalEvent,
  loadPlannedWorkouts,
  savePlannedWorkouts,
  formatDateYMD,
  PRESET_GOAL_EVENTS
} from '../../utils/periodizationEngine';
import {
  getAllLocalActivities,
  LocalActivityRecord
} from '../../utils/localActivityDb';
import { TargetRaceWizardModal } from './TargetRaceWizardModal';
import { DayWorkoutModal } from './DayWorkoutModal';
import { generateTrainingCalendarPoster } from '../../utils/shareCardGenerators';
import { consumePendingTransfer } from '../../hooks/useToolDraftState';

export interface TrainingPlanCalendarProps {
  onNavigateTool?: (toolId: string) => void;
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

export const TrainingPlanCalendar: React.FC<TrainingPlanCalendarProps> = ({ onNavigateTool }) => {
  const { language } = useLanguageAndUnit();
  const { showToast } = useToast();
  const { profile } = useRiderProfile();

  // Active View Tab
  const [activeTab, setActiveTab] = useState<'month' | 'macro' | 'week'>('month');

  // Month navigation state
  const [currentDisplayDate, setCurrentDisplayDate] = useState<Date>(() => new Date());

  // Goal Event & Planned Workouts
  const [goalEvent, setGoalEvent] = useState<GoalEvent>(() => loadSavedGoalEvent());
  const [plannedWorkouts, setPlannedWorkouts] = useState<PlannedWorkout[]>(() => loadPlannedWorkouts());
  const [weeklyHours, setWeeklyHours] = useState<number>(8);

  // Completed Activities from Local IndexedDB
  const [activities, setActivities] = useState<LocalActivityRecord[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState<boolean>(true);

  // Modals
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState<boolean>(false);

  // Share Poster
  const [sharePosterUrl, setSharePosterUrl] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  // Check for workout transferred from WorkoutBuilder
  useEffect(() => {
    const transferred = consumePendingTransfer<PlannedWorkout>('solorider_pending_calendar_workout');
    if (transferred && transferred.date && transferred.title) {
      setPlannedWorkouts(prev => {
        if (prev.some(w => w.id === transferred.id || (w.date === transferred.date && w.title === transferred.title))) {
          return prev;
        }
        const updated = [...prev, transferred];
        savePlannedWorkouts(updated);
        return updated;
      });

      // Jump calendar month view to the scheduled workout's date
      const targetDate = new Date(transferred.date + 'T00:00:00');
      if (!isNaN(targetDate.getTime())) {
        setCurrentDisplayDate(targetDate);
        setSelectedDayDate(transferred.date);
        setIsDayModalOpen(true);
      }

      showToast(
        language === 'zh-TW'
          ? `已成功排入課表「${transferred.title}」至 ${transferred.date}！`
          : `已成功排入课表「${transferred.title}」至 ${transferred.date}！`,
        'success'
      );
    }
  }, [showToast, language]);

  // Load activities from IndexedDB
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setIsLoadingActivities(true);
        const acts = await getAllLocalActivities();
        if (isMounted) setActivities(acts);
      } catch {
        // Fallback gracefully when IndexedDB is unavailable
      } finally {
        if (isMounted) setIsLoadingActivities(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute Current Estimated CTL based on recent activities
  const currentCtl = useMemo(() => {
    if (activities.length === 0) return 60;
    // Calculate simple exponential moving average or take 42-day rolling
    const now = Date.now();
    const past42Days = activities.filter(a => now - (a.startTime || new Date(a.startDate).getTime()) <= 42 * 86400 * 1000);
    const totalTss = past42Days.reduce((acc, a) => acc + (a.tss || 0), 0);
    const avgDailyTss = totalTss / 42;
    return Math.max(30, Math.round(avgDailyTss * 1.15));
  }, [activities]);

  // Generate the Master Annual Training Plan (ATP)
  const planSummary: PeriodizationPlanSummary = useMemo(() => {
    return generateAnnualTrainingPlan(
      goalEvent,
      currentCtl,
      Math.round(currentCtl * 0.9),
      weeklyHours
    );
  }, [goalEvent, currentCtl, weeklyHours]);

  // Handle saving new goal event from wizard
  const handleSaveGoalEvent = (event: GoalEvent, hours: number) => {
    setGoalEvent(event);
    setWeeklyHours(hours);
    saveGoalEvent(event);
    showToast(`已成功制定「${event.name}」目标周期计划！`, 'success');
  };

  // Workout add/delete
  const handleAddWorkout = (workout: PlannedWorkout) => {
    const next = [...plannedWorkouts, workout];
    setPlannedWorkouts(next);
    savePlannedWorkouts(next);
  };

  const handleDeleteWorkout = (id: string) => {
    const next = plannedWorkouts.filter(w => w.id !== id);
    setPlannedWorkouts(next);
    savePlannedWorkouts(next);
    showToast('已移除该计划课表', 'info');
  };

  // Calendar Month Navigation
  const prevMonth = () => {
    setCurrentDisplayDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDisplayDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };
  const goToToday = () => {
    setCurrentDisplayDate(new Date());
  };

  // Month Grid Calculation (Monday as first day of week)
  const monthCalendarDays = useMemo(() => {
    const year = currentDisplayDate.getFullYear();
    const month = currentDisplayDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Day of week: 0 is Sun, 1 is Mon ... convert so Mon = 0, Sun = 6
    const firstDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInMonth = lastDayOfMonth.getDate();

    const days: {
      date: Date;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      completedActs: LocalActivityRecord[];
      plannedWkts: PlannedWorkout[];
      event?: GoalEvent;
    }[] = [];

    const todayStr = formatDateYMD(new Date());

    // Map activities by YYYY-MM-DD
    const actMap = new Map<string, LocalActivityRecord[]>();
    activities.forEach(a => {
      const d = formatDateYMD(new Date(a.startTime || a.startDate));
      const list = actMap.get(d) || [];
      list.push(a);
      actMap.set(d, list);
    });

    // Map planned workouts by YYYY-MM-DD
    const wktMap = new Map<string, PlannedWorkout[]>();
    plannedWorkouts.forEach(w => {
      const list = wktMap.get(w.date) || [];
      list.push(w);
      wktMap.set(w.date, list);
    });

    // Previous month padding days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const dStr = formatDateYMD(d);
      days.push({
        date: d,
        dateStr: dStr,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        completedActs: actMap.get(dStr) || [],
        plannedWkts: wktMap.get(dStr) || [],
        event: dStr === goalEvent.date ? goalEvent : undefined
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dStr = formatDateYMD(d);
      days.push({
        date: d,
        dateStr: dStr,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        completedActs: actMap.get(dStr) || [],
        plannedWkts: wktMap.get(dStr) || [],
        event: dStr === goalEvent.date ? goalEvent : undefined
      });
    }

    // Next month padding days to fill 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dStr = formatDateYMD(d);
      days.push({
        date: d,
        dateStr: dStr,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
        completedActs: actMap.get(dStr) || [],
        plannedWkts: wktMap.get(dStr) || [],
        event: dStr === goalEvent.date ? goalEvent : undefined
      });
    }

    return days;
  }, [currentDisplayDate, activities, plannedWorkouts, goalEvent]);

  // Open Day modal
  const handleOpenDay = (dateStr: string) => {
    setSelectedDayDate(dateStr);
    setIsDayModalOpen(true);
  };

  // Macro PMC Chart Dataset
  const pmcChartData = useMemo(() => {
    const points = planSummary.projectedPmc;
    return {
      labels: points.map(p => p.dateLabel),
      datasets: [
        {
          type: 'line' as const,
          label: 'CTL',
          data: points.map(p => p.ctl),
          borderColor: '#0A84FF', // Apple Blue
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          tension: 0.3,
          pointRadius: points.map(p => p.event ? 6 : 0),
          pointBackgroundColor: '#0A84FF'
        },
        {
          type: 'line' as const,
          label: 'ATL',
          data: points.map(p => p.atl),
          borderColor: '#FF453A', // Apple Red
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [3, 3],
          tension: 0.3,
          pointRadius: 0
        },
        {
          type: 'line' as const,
          label: 'TSB',
          data: points.map(p => p.tsb),
          borderColor: '#FFD60A', // Apple Gold
          backgroundColor: 'rgba(255, 214, 10, 0.1)',
          fill: true,
          borderWidth: 2,
          tension: 0.3,
          pointRadius: points.map(p => p.event ? 7 : 0),
          pointBackgroundColor: '#FFD60A'
        }
      ]
    };
  }, [planSummary]);

  // Current Week Plan
  const currentWeekPlan = useMemo(() => {
    return planSummary.weeks.find(w => w.isCurrentWeek) || planSummary.weeks[0];
  }, [planSummary]);

  // Export Calendar as iCal (.ics)
  const handleExportICal = () => {
    let icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//LaBao Pro//Cycling ATP Calendar//CN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:LaBao Pro 周期训练赛历
`;

    // Add Goal Event
    const evDateStr = goalEvent.date.replace(/-/g, '');
    icsContent += `BEGIN:VEVENT
UID:goal-${goalEvent.id}@labao.app
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART;VALUE=DATE:${evDateStr}
DTEND;VALUE=DATE:${evDateStr}
SUMMARY:🏆 ${goalEvent.name} [${goalEvent.priority}级目标]
DESCRIPTION:LaBao Pro 目标赛事 · 目标 CTL: ${goalEvent.targetCtl} · 目标 TSB: +${goalEvent.targetTsb}
STATUS:CONFIRMED
END:VEVENT
`;

    // Add Planned Workouts
    plannedWorkouts.forEach(w => {
      const dStr = w.date.replace(/-/g, '');
      icsContent += `BEGIN:VEVENT
UID:${w.id}@labao.app
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART;VALUE=DATE:${dStr}
DTEND;VALUE=DATE:${dStr}
SUMMARY:⚡ 骑行训练: ${w.title} (${w.targetTss} TSS)
DESCRIPTION:计划课表: ${w.title}\\n计划时长: ${w.durationMin}分钟\\n目标 TSS: ${w.targetTss}
STATUS:CONFIRMED
END:VEVENT
`;
    });

    icsContent += `END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LaBao_Pro_训练赛历_${goalEvent.name.replace(/\s+/g, '_')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('已导出标准 iCalendar 日历，可直接导入 Apple / Google 日历！', 'success');
  };

  // Generate Poster
  const handleGeneratePoster = () => {
    try {
      const url = generateTrainingCalendarPoster({
        eventName: goalEvent.name,
        raceDate: goalEvent.date,
        daysRemaining: planSummary.daysUntilRace,
        targetCtl: planSummary.targetRaceCtl,
        targetTsb: planSummary.targetRaceTsb,
        totalWeeks: planSummary.totalWeeks,
        currentPhase: currentWeekPlan?.phaseLabel || '基础有氧期',
        avgWeeklyTss: planSummary.avgWeeklyTss,
        weeksOverview: planSummary.weeks.slice(0, 6).map(w => ({
          weekIdx: w.weekIndex,
          phaseName: w.phaseLabel,
          targetTss: w.targetTss,
          focus: w.focusAdaptation
        }))
      });
      setSharePosterUrl(url);
      setIsShareModalOpen(true);
    } catch (e) {
      showToast('海报生成失败，请重试', 'error');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Standard Apple HIG Tool Header */}
      <IOSToolHeader
        category={language === 'zh-TW' ? '生理與代謝' : '生理与代谢'}
        categoryIcon={CalendarIcon}
        title={language === 'zh-TW' ? '訓練賽歷' : '训练赛历'}
        description="基于 Tudor Bompa 周期化模型，以目标 A 级赛事为锚点反推体能负荷，排布结构化课表并前瞻推演未来 60 天 PMC 竞技巅峰。"
        tint="blue"
        onShare={handleGeneratePoster}
        shareTitle="生成周期规划海报"
        actions={
          <>
            <button
              onClick={() => setIsWizardOpen(true)}
              className="apple-touch h-9 px-3.5 sm:px-4 rounded-xl bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200/80 dark:border-white/10 shadow-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-ios-blue shrink-0" />
              <span>{language === 'zh-TW' ? '規劃向導' : '规划向导'}</span>
            </button>
            <button
              onClick={handleExportICal}
              className="apple-touch h-9 px-3.5 sm:px-4 rounded-xl bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200/80 dark:border-white/10 shadow-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              title="导出至手机或电脑日历"
            >
              <Download className="w-3.5 h-3.5 text-ios-blue shrink-0" />
              <span>导出 .ICS 日历</span>
            </button>
          </>
        }
      />

      {/* Target Race & Countdown Hero Card */}
      <IOSCard variant="default" padding="none" className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 dark:border-white/10 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-md font-bold bg-rose-500 text-white">
                  {goalEvent.priority} 级年度决战
                </span>
                <span className="text-xs text-slate-400 font-mono tabular-nums">
                  {goalEvent.date}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                {goalEvent.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setIsWizardOpen(true)}
              className="apple-touch h-9 px-3.5 rounded-xl bg-ios-blue text-white text-xs font-bold hover:bg-ios-blue/90 transition shadow-ios-sm flex items-center gap-1.5"
            >
              <span>调整赛事与目标</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 4 Summary KPI Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          <IOSMetricTile
            label="决战倒计时"
            value={planSummary.daysUntilRace}
            unit="天"
            subtext={`全计划共 ${planSummary.totalWeeks} 周`}
            theme="amber"
            className="p-3 sm:p-4"
          />
          <IOSMetricTile
            label="CTL 目标"
            value={`${currentCtl} → ${planSummary.targetRaceCtl}`}
            unit="CTL"
            subtext="基于历史 42 日负荷"
            theme="blue"
            className="p-3 sm:p-4"
          />
          <IOSMetricTile
            label="比赛日状态"
            value={`+${planSummary.targetRaceTsb}`}
            unit="TSB"
            subtext="黄金比赛窗口 +15~+25"
            theme="green"
            className="p-3 sm:p-4"
          />
          <IOSMetricTile
            label="当前训练周期"
            value={currentWeekPlan?.phaseLabel.split(' ')[0] || '基础期'}
            unit=""
            subtext={`本周第 ${planSummary.currentWeekIndex} 周 · 目标 ${currentWeekPlan?.targetTss || 400} TSS`}
            theme="purple"
            className="p-3 sm:p-4"
          />
        </div>
      </IOSCard>

      {/* Mode Switcher: Apple HIG Segmented Control */}
      <div className="flex justify-center sm:justify-start">
        <IOSSegmentedControl
          options={[
            {
              id: 'month',
              value: 'month',
              label: (
                <>
                  <span className="sm:hidden">月历看板</span>
                  <span className="hidden sm:inline">月历全景看板</span>
                </>
              ),
              icon: CalendarIcon
            },
            {
              id: 'macro',
              value: 'macro',
              label: (
                <>
                  <span className="sm:hidden">周期 PMC</span>
                  <span className="hidden sm:inline">宏观周期与未来 PMC 模拟</span>
                </>
              ),
              icon: TrendingUp
            },
            {
              id: 'week',
              value: 'week',
              label: (
                <>
                  <span className="sm:hidden">本周课表</span>
                  <span className="hidden sm:inline">本周课表执行</span>
                </>
              ),
              icon: Dumbbell
            }
          ]}
          value={activeTab}
          onChange={(val) => setActiveTab(val as any)}
          tint="blue"
          mobileFullWidth={true}
          className="w-full sm:w-auto"
        />
      </div>

      {/* VIEW 1: Month Calendar Grid */}
      {activeTab === 'month' && (
        <IOSCard variant="default" padding="none" className="p-4 sm:p-5 space-y-4">
          {/* Month Header with Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 flex items-center justify-center transition apple-touch"
                title="上个月"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h3 className="text-base font-bold text-slate-900 dark:text-white min-w-[140px] text-center font-mono tabular-nums">
                {currentDisplayDate.getFullYear()} 年 {currentDisplayDate.getMonth() + 1} 月
              </h3>
              <button
                onClick={nextMonth}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 flex items-center justify-center transition apple-touch"
                title="下个月"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={goToToday}
                className="apple-touch h-8 px-3 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
              >
                回到今天
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="space-y-1">
            {/* Weekday Labels (Mon-Sun) */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 pb-1">
              <span>周一</span>
              <span>周二</span>
              <span>周三</span>
              <span>周四</span>
              <span>周五</span>
              <span className="text-ios-blue">周六</span>
              <span className="text-ios-blue">周日</span>
            </div>

            {/* Day Cells Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {monthCalendarDays.map((dayItem, idx) => {
                const totalActTss = dayItem.completedActs.reduce((acc, a) => acc + (a.tss || 0), 0);
                const totalWktTss = dayItem.plannedWkts.reduce((acc, w) => acc + w.targetTss, 0);

                return (
                  <div
                    key={idx}
                    onClick={() => handleOpenDay(dayItem.dateStr)}
                    className={`min-h-[82px] sm:min-h-[96px] p-1.5 sm:p-2 rounded-xl border text-left transition apple-touch cursor-pointer flex flex-col justify-between ${
                      dayItem.isToday
                        ? 'bg-ios-blue/10 border-ios-blue ring-1 ring-ios-blue/40'
                        : dayItem.isCurrentMonth
                        ? 'bg-white/60 dark:bg-white/5 border-slate-200/70 dark:border-white/10 hover:border-ios-blue/50'
                        : 'bg-slate-50/50 dark:bg-white/[0.02] border-slate-200/40 dark:border-white/5 opacity-40 hover:opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold font-mono tabular-nums ${
                        dayItem.isToday
                          ? 'w-5 h-5 rounded-full bg-ios-blue text-white flex items-center justify-center text-[11px]'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {dayItem.date.getDate()}
                      </span>

                      {/* Goal Event Badge */}
                      {dayItem.event && (
                        <span className="text-[10px] px-1 py-0.2 rounded bg-rose-500 text-white font-bold flex items-center gap-0.5">
                          <Trophy className="w-2.5 h-2.5" />
                          <span>比赛日</span>
                        </span>
                      )}
                    </div>

                    {/* Content inside cell: Completed rides + Planned workouts */}
                    <div className="space-y-1 my-1 overflow-hidden">
                      {/* Completed Rides (Solid Emerald) */}
                      {dayItem.completedActs.slice(0, 1).map(act => (
                        <div
                          key={act.id}
                          className="px-1.5 py-0.5 rounded-md bg-emerald-500 text-white text-[10px] font-bold truncate flex items-center justify-between"
                          title={`${act.name}: ${act.tss} TSS`}
                        >
                          <span className="truncate">{act.name}</span>
                          <span className="ml-1 font-mono tabular-nums shrink-0">{act.tss}T</span>
                        </div>
                      ))}

                      {/* Planned Workouts (Dashed Blue) */}
                      {dayItem.plannedWkts.slice(0, 1).map(wkt => (
                        <div
                          key={wkt.id}
                          className="px-1.5 py-0.5 rounded-md bg-ios-blue/15 border border-dashed border-ios-blue/50 text-ios-blue dark:text-ios-blue text-[10px] font-bold truncate flex items-center justify-between"
                          title={`计划: ${wkt.title} (${wkt.targetTss} TSS)`}
                        >
                          <span className="truncate">{wkt.title}</span>
                          <span className="ml-1 font-mono tabular-nums shrink-0">{wkt.targetTss}T</span>
                        </div>
                      ))}

                      {/* Overflow indicator */}
                      {dayItem.completedActs.length + dayItem.plannedWkts.length > 2 && (
                        <div className="text-[9px] text-slate-400 text-center font-mono">
                          +{dayItem.completedActs.length + dayItem.plannedWkts.length - 2} 更多
                        </div>
                      )}
                    </div>

                    {/* Bottom Day TSS Stat */}
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-200/40 dark:border-white/5">
                      <span>{dayItem.completedActs.length > 0 ? '完成' : dayItem.plannedWkts.length > 0 ? '计划' : ''}</span>
                      <span className="tabular-nums font-bold text-slate-600 dark:text-slate-300">
                        {totalActTss > 0 ? `${totalActTss}T` : totalWktTss > 0 ? `${totalWktTss}T` : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </IOSCard>
      )}

      {/* VIEW 2: Macro Periodization & Future PMC Projection */}
      {activeTab === 'macro' && (
        <div className="space-y-4 sm:space-y-5">
          {/* PMC Projected Line Chart */}
          <IOSCard variant="default" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-white/10 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-ios-blue" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    全赛季 PMC 走势前瞻模拟
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  向前连续推演每日 CTL、ATL 与 TSB，比赛日当天预计 TSB 达到 <b className="text-amber-500 font-bold tabular-nums">+{planSummary.targetRaceTsb}</b>
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 font-bold text-ios-blue">
                  <span className="w-3 h-0.5 bg-ios-blue inline-block"></span> CTL
                </span>
                <span className="flex items-center gap-1 font-bold text-rose-500">
                  <span className="w-3 h-0.5 bg-rose-500 inline-block"></span> ATL
                </span>
                <span className="flex items-center gap-1 font-bold text-amber-500">
                  <span className="w-3 h-0.5 bg-amber-500 inline-block"></span> TSB
                </span>
              </div>
            </div>

            <div className="h-64">
              <Line
                data={pmcChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: 'rgba(28, 28, 30, 0.95)',
                      titleColor: '#0A84FF',
                      bodyColor: '#ffffff',
                      borderColor: 'rgba(10, 132, 255, 0.3)',
                      borderWidth: 1,
                      padding: 10
                    }
                  },
                  scales: {
                    x: { grid: { color: 'rgba(148, 163, 184, 0.08)' } },
                    y: {
                      grid: { color: 'rgba(148, 163, 184, 0.08)' },
                      title: { display: true, text: '负荷积分 (TSS/日)' }
                    }
                  }
                }}
              />
            </div>
          </IOSCard>

          {/* Week-by-Week Periodization Plan Table */}
          <IOSCard variant="default" padding="none" className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-ios-blue" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  年度周期训练总计划
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                共 {planSummary.weeks.length} 周 · 目标总负荷 {planSummary.totalPlannedTss} TSS
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200/70 dark:border-white/10 text-slate-400 text-[11px]">
                    <th className="pb-2 font-medium">周序号</th>
                    <th className="pb-2 font-medium">时间跨度</th>
                    <th className="pb-2 font-medium">所属阶段</th>
                    <th className="pb-2 font-medium text-right">目标 TSS</th>
                    <th className="pb-2 font-medium text-right">建议时长</th>
                    <th className="pb-2 font-medium">核心生理适应与推荐课表</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50 dark:divide-white/5 font-mono">
                  {planSummary.weeks.map(w => (
                    <tr
                      key={w.weekIndex}
                      className={`transition hover:bg-slate-50 dark:hover:bg-white/5 ${
                        w.isCurrentWeek ? 'bg-ios-blue/10 dark:bg-ios-blue/20 font-bold' : ''
                      }`}
                    >
                      <td className="py-2.5">
                        <span className="flex items-center gap-1.5">
                          <span>W{w.weekIndex}</span>
                          {w.isCurrentWeek && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-ios-blue text-white font-sans">
                              本周
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-500 tabular-nums">
                        {w.startDate.slice(5)} ~ {w.endDate.slice(5)}
                      </td>
                      <td className="py-2.5 font-sans">
                        <span
                          className="px-2 py-0.5 rounded-md font-bold text-white text-[10px]"
                          style={{ backgroundColor: w.phaseColor }}
                        >
                          {w.phaseLabel}
                        </span>
                        {w.isRecoveryWeek && (
                          <span className="text-[10px] text-emerald-500 font-bold ml-1.5">
                            减量恢复
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-right font-bold text-amber-500 tabular-nums">
                        {w.targetTss} TSS
                      </td>
                      <td className="py-2.5 text-right text-slate-600 dark:text-slate-300 tabular-nums">
                        ~{w.targetHours} 小时
                      </td>
                      <td className="py-2.5 font-sans text-slate-600 dark:text-slate-300">
                        <span>{w.focusAdaptation}</span>
                        <span className="text-slate-400 text-[11px] block mt-0.5">
                          推荐: {w.recommendedWorkouts.slice(0, 2).join(' · ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </IOSCard>
        </div>
      )}

      {/* VIEW 3: Current Week Execution */}
      {activeTab === 'week' && currentWeekPlan && (
        <IOSCard variant="default" padding="none" className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-white/10 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md font-bold text-white text-xs" style={{ backgroundColor: currentWeekPlan.phaseColor }}>
                  {currentWeekPlan.phaseLabel}
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  本周训练计划与执行看板 (W{currentWeekPlan.weekIndex} · {currentWeekPlan.startDate} ~ {currentWeekPlan.endDate})
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                生理目标: {currentWeekPlan.focusAdaptation}
              </p>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-400">本周目标负荷</div>
              <div className="text-base font-bold text-amber-500 font-mono tabular-nums">
                {currentWeekPlan.targetTss} TSS
              </div>
            </div>
          </div>

          {/* Recommended Workouts for this week */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
              本周官方推荐训练课表：
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {currentWeekPlan.recommendedWorkouts.map((wName, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 flex items-center gap-2 text-xs">
                  <div className="w-6 h-6 rounded-lg bg-ios-blue/15 text-ios-blue flex items-center justify-center shrink-0 font-bold font-mono">
                    {idx + 1}
                  </div>
                  <span className="font-bold text-slate-800 dark:text-white">{wName}</span>
                </div>
              ))}
            </div>
          </div>
        </IOSCard>
      )}

      {/* Target Race Wizard Modal */}
      <TargetRaceWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSaveEvent={handleSaveGoalEvent}
        currentCtl={currentCtl}
      />

      {/* Day Workout & Event Inspector Modal */}
      {selectedDayDate && (
        <DayWorkoutModal
          isOpen={isDayModalOpen}
          onClose={() => setIsDayModalOpen(false)}
          dateStr={selectedDayDate}
          completedActivities={activities.filter(a => formatDateYMD(new Date(a.startTime || a.startDate)) === selectedDayDate)}
          plannedWorkouts={plannedWorkouts.filter(w => w.date === selectedDayDate)}
          onAddWorkout={handleAddWorkout}
          onDeleteWorkout={handleDeleteWorkout}
        />
      )}

      {/* Share Poster Modal */}
      <ShareCardModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        posterUrl={sharePosterUrl}
        fileName={`LaBao_Pro_年度周期赛历海报.png`}
        title="年度周期规划与训练赛历海报"
      />
    </div>
  );
};
