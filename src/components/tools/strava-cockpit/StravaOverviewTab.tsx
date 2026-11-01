import React, { useState, useMemo } from 'react';
import {
  Route,
  Mountain,
  Clock,
  Flame,
  Calendar,
  Zap,
  Target,
  Activity,
  Sun
} from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { IOSCard, IOSCardHeader, IOSMetricTile } from '../../common/IOSCard';
import { IOSSegmentedControl } from '../../common/IOSSegmentedControl';
import {
  computeKpiMetrics,
  computeAnnualGoalProgress,
  computeAnnualElevationGoalProgress,
  computeActivityRings,
  buildHeatmapGrid,
  computeBioclock,
  computeAerobicEfficiency
} from '../../../utils/stravaCockpitAnalytics';

interface StravaOverviewTabProps {
  kpi: ReturnType<typeof computeKpiMetrics>;
  streakStats: { currentStreak: number; longestStreak: number; thisMonthActiveDays: number };
  aerobicEfficiency: ReturnType<typeof computeAerobicEfficiency>;
  annualProgress: ReturnType<typeof computeAnnualGoalProgress>;
  annualElevationProgress: ReturnType<typeof computeAnnualElevationGoalProgress>;
  ringData: ReturnType<typeof computeActivityRings>;
  heatmapGrid: ReturnType<typeof buildHeatmapGrid>['grid'];
  bioclock: ReturnType<typeof computeBioclock>;
  language: string;
  convertDistance: (km: number) => { value: number; unit: string; formatted: string };
  convertElevation: (m: number) => { value: number; unit: string; formatted: string };
  convertSpeed: (kmh: number) => { value: number; unit: string; formatted: string };
  isImperial: boolean;
  distUnit: string;
  eleUnit: string;
}

export const StravaOverviewTab: React.FC<StravaOverviewTabProps> = React.memo(({
  kpi,
  streakStats,
  aerobicEfficiency,
  annualProgress,
  annualElevationProgress,
  ringData,
  heatmapGrid,
  bioclock,
  language,
  convertDistance,
  convertElevation,
  convertSpeed,
  isImperial,
  distUnit,
  eleUnit
}) => {
  // Annual Goal Card Metric Mode: 'distance' vs 'elevation'
  const [annualGoalMetric, setAnnualGoalMetric] = useState<'distance' | 'elevation'>('distance');

  // Bioclock sub-tab: 'time' vs 'day'
  const [bioclockTab, setBioclockTab] = useState<'time' | 'day'>('time');

  // Annual Goal Monthly Chart Data & Options
  const annualGoalMonthlyChartData = useMemo(() => {
    const isElevation = annualGoalMetric === 'elevation';
    if (isElevation) {
      return {
        labels: annualElevationProgress.monthlyBreakdown.map(m => m.label),
        datasets: [
          {
            type: 'bar' as const,
            label: language === 'zh-TW' ? `實際累計爬升 (${eleUnit})` : `实际累计爬升 (${eleUnit})`,
            data: annualElevationProgress.monthlyBreakdown.map(m => isImperial ? Math.round(m.actualElevationM * 3.28084) : m.actualElevationM),
            backgroundColor: '#34C759',
            borderRadius: 4
          },
          {
            type: 'line' as const,
            label: language === 'zh-TW' ? `目標月均基準線 (${eleUnit})` : `目标月均基准线 (${eleUnit})`,
            data: annualElevationProgress.monthlyBreakdown.map(m => isImperial ? Math.round(m.targetPaceElevationM * 3.28084) : m.targetPaceElevationM),
            borderColor: '#AF52DE',
            borderWidth: 1.5,
            borderDash: [4, 4],
            pointRadius: 0,
            fill: false
          }
        ]
      };
    }

    return {
      labels: annualProgress.monthlyBreakdown.map(m => m.label),
      datasets: [
        {
          type: 'bar' as const,
          label: language === 'zh-TW' ? `實際完成里程 (${distUnit})` : `实际完成里程 (${distUnit})`,
          data: annualProgress.monthlyBreakdown.map(m => isImperial ? parseFloat((m.actualKm * 0.621371).toFixed(1)) : m.actualKm),
          backgroundColor: '#007AFF',
          borderRadius: 4
        },
        {
          type: 'line' as const,
          label: language === 'zh-TW' ? `目標月均基準線 (${distUnit})` : `目标月均基准线 (${distUnit})`,
          data: annualProgress.monthlyBreakdown.map(m => isImperial ? parseFloat((m.targetPaceKm * 0.621371).toFixed(1)) : m.targetPaceKm),
          borderColor: '#FF9500',
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointRadius: 0,
          fill: false
        }
      ]
    };
  }, [annualGoalMetric, annualElevationProgress, annualProgress, language, isImperial, distUnit, eleUnit]);

  const annualGoalMonthlyChartOptions = useMemo(() => {
    const isElevation = annualGoalMetric === 'elevation';
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: { boxWidth: 10, font: { size: 11 } }
        },
        tooltip: {
          backgroundColor: 'rgba(28, 28, 30, 0.95)',
          titleFont: { size: 12 },
          bodyFont: { size: 11 },
          callbacks: {
            label: (context: { parsed: { y: number }; dataset: { label?: string } }) => {
              const val = context.parsed.y;
              return ` ${context.dataset.label || ''}: ${val.toLocaleString()} ${isElevation ? eleUnit : distUnit}`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: {
          grid: { color: 'rgba(120, 120, 128, 0.12)' },
          ticks: {
            font: { size: 10 },
            callback: (v: number | string) => `${Number(v).toLocaleString()} ${isElevation ? eleUnit : distUnit}`
          }
        }
      }
    };
  }, [annualGoalMetric, distUnit, eleUnit]);

  // Bioclock Time Doughnut Data
  const bioclockDoughnutData = useMemo(() => {
    return {
      labels: bioclock.byTimeSlot.map(s => s.label),
      datasets: [
        {
          data: bioclock.byTimeSlot.map(s => s.rides),
          backgroundColor: ['#FF9500', '#FFCC00', '#007AFF', '#5856D6', '#AF52DE'],
          borderWidth: 0
        }
      ]
    };
  }, [bioclock]);

  // Bioclock Day Bar Data
  const bioclockDayBarData = useMemo(() => {
    return {
      labels: bioclock.byDayOfWeek.map(d => d.label),
      datasets: [
        {
          label: isImperial ? '骑行里程 (mi)' : '骑行里程 (km)',
          data: bioclock.byDayOfWeek.map(d => isImperial ? parseFloat((d.distanceKm * 0.621371).toFixed(1)) : d.distanceKm),
          backgroundColor: '#007AFF',
          borderRadius: 6
        }
      ]
    };
  }, [bioclock, isImperial]);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 6 Key Metric Tiles Array */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <IOSMetricTile
          label="总骑行里程"
          value={convertDistance(kpi.totalDistanceKm).formatted}
          subtext={`已绕地球 ${kpi.earthCircumferencePct}%`}
          icon={<Route className="w-3.5 h-3.5 text-ios-blue" />}
          accentColor="blue"
        />
        <IOSMetricTile
          label="累计总爬升"
          value={convertElevation(kpi.totalElevationM).formatted}
          subtext={`相当于 ${kpi.everestRatio} 座珠峰攀升`}
          icon={<Mountain className="w-3.5 h-3.5 text-ios-green" />}
          accentColor="green"
        />
        <IOSMetricTile
          label="鞍上总时长"
          value={`${Math.floor(kpi.totalMovingTimeMin / 60)}h ${kpi.totalMovingTimeMin % 60}m`}
          subtext={`场均 ${(kpi.totalMovingTimeMin / Math.max(1, kpi.totalRides) / 60).toFixed(1)} 小时`}
          icon={<Clock className="w-3.5 h-3.5 text-ios-orange" />}
          accentColor="orange"
        />
        <IOSMetricTile
          label="活跃卡路里"
          value={`${kpi.totalCaloriesKcal.toLocaleString()}`}
          unit="kcal"
          subtext={`约 ${kpi.bananasBurned} 根香蕉等效能量`}
          icon={<Flame className="w-3.5 h-3.5 text-ios-red" />}
          accentColor="red"
        />
        <IOSMetricTile
          label="出勤总场次"
          value={`${kpi.totalRides}`}
          unit="次"
          subtext={`月度活跃 ${streakStats.thisMonthActiveDays} 天`}
          icon={<Calendar className="w-3.5 h-3.5 text-ios-purple" />}
          accentColor="purple"
        />
        <IOSMetricTile
          label="加权平均功率"
          value={kpi.avgNpWatts > 0 ? `${kpi.avgNpWatts}` : '--'}
          unit="W NP"
          subtext={`EF ${aerobicEfficiency.avgEf > 0 ? aerobicEfficiency.avgEf : '--'} · 均速 ${convertSpeed(kpi.avgSpeedKmh).formatted}`}
          icon={<Zap className="w-3.5 h-3.5 text-ios-mint" />}
          accentColor="mint"
        />
      </div>

      {/* Row 1: Annual Goal Progress (Strava Model) + Activity Rings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Left 7 cols: Annual Goal Card (Distance ↔ Elevation Dual-Mode) */}
        <IOSCard className="lg:col-span-7 space-y-3.5">
          <IOSCardHeader
            title={
              annualGoalMetric === 'distance'
                ? (language === 'zh-TW' ? '年度里程目標' : '年度里程目标')
                : (language === 'zh-TW' ? '年度爬升目標' : '年度爬升目标')
            }
            subtitle={
              annualGoalMetric === 'distance'
                ? `${annualProgress.year} 年度目标 ${(isImperial ? Math.round(annualProgress.targetKm * 0.621371) : annualProgress.targetKm).toLocaleString()} ${distUnit} · 已完成 ${(isImperial ? Math.round(annualProgress.currentKm * 0.621371) : annualProgress.currentKm).toLocaleString()} ${distUnit} (${annualProgress.progressPct}%)`
                : `${annualElevationProgress.year} 年度目标 ${(isImperial ? Math.round(annualElevationProgress.targetElevationM * 3.28084) : annualElevationProgress.targetElevationM).toLocaleString()} ${eleUnit} · 已完成 ${(isImperial ? Math.round(annualElevationProgress.currentElevationM * 3.28084) : annualElevationProgress.currentElevationM).toLocaleString()} ${eleUnit} (${annualElevationProgress.progressPct}%) · 相当于 ${annualElevationProgress.everestingCount} 座珠峰 ⛰️`
            }
            icon={annualGoalMetric === 'distance' ? Target : Mountain}
            iconColor={annualGoalMetric === 'distance' ? 'text-ios-blue bg-ios-blue/10' : 'text-ios-green bg-ios-green/10'}
            action={
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap justify-end">
                <IOSSegmentedControl
                  value={annualGoalMetric}
                  onChange={(v) => setAnnualGoalMetric(v as 'distance' | 'elevation')}
                  options={[
                    { value: 'distance', label: language === 'zh-TW' ? '里程' : '里程' },
                    { value: 'elevation', label: language === 'zh-TW' ? '爬升' : '爬升' }
                  ]}
                  size="sm"
                  mobileFullWidth={false}
                  className="shrink-0"
                />
                <div
                  className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shrink-0 ${
                    (annualGoalMetric === 'distance' ? annualProgress.isAheadOfPace : annualElevationProgress.isAheadOfPace)
                      ? 'bg-ios-green/10 text-ios-green'
                      : 'bg-ios-orange/10 text-ios-orange'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  <span>
                    {annualGoalMetric === 'distance'
                      ? (annualProgress.isAheadOfPace
                          ? `超前 +${isImperial ? (annualProgress.paceDeltaKm * 0.621371).toFixed(1) : annualProgress.paceDeltaKm} ${distUnit}`
                          : `落后 ${isImperial ? (annualProgress.paceDeltaKm * 0.621371).toFixed(1) : annualProgress.paceDeltaKm} ${distUnit}`)
                      : (annualElevationProgress.isAheadOfPace
                          ? `超前 +${(isImperial ? Math.round(annualElevationProgress.paceDeltaElevationM * 3.28084) : annualElevationProgress.paceDeltaElevationM).toLocaleString()} ${eleUnit}`
                          : `落后 ${(isImperial ? Math.round(annualElevationProgress.paceDeltaElevationM * 3.28084) : annualElevationProgress.paceDeltaElevationM).toLocaleString()} ${eleUnit}`)}
                  </span>
                </div>
              </div>
            }
          />

          {/* Goal Readout Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] text-center">
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{language === 'zh-TW' ? '已達目標' : '已达目标'}</div>
              <div className={`text-xl sm:text-2xl font-bold tabular-nums ${annualGoalMetric === 'distance' ? 'text-ios-blue' : 'text-ios-green'}`}>
                {annualGoalMetric === 'distance' ? annualProgress.progressPct : annualElevationProgress.progressPct}%
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {language === 'zh-TW' ? '剩餘 ' : '剩余 '}
                {annualGoalMetric === 'distance'
                  ? `${(isImperial ? Math.round(annualProgress.remainingKm * 0.621371) : annualProgress.remainingKm).toLocaleString()} ${distUnit}`
                  : `${(isImperial ? Math.round(annualElevationProgress.remainingElevationM * 3.28084) : annualElevationProgress.remainingElevationM).toLocaleString()} ${eleUnit}`}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{language === 'zh-TW' ? '預估達成日' : '预估达成日'}</div>
              <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tabular-nums pt-0.5">
                {(annualGoalMetric === 'distance' ? annualProgress.projectedCompletionDate : annualElevationProgress.projectedCompletionDate) || (language === 'zh-TW' ? '計算中' : '计算中')}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {language === 'zh-TW' ? '年終預估 ' : '年终预估 '}
                {annualGoalMetric === 'distance'
                  ? `${(isImperial ? Math.round(annualProgress.projectedYearEndKm * 0.621371) : annualProgress.projectedYearEndKm).toLocaleString()} ${distUnit}`
                  : `${(isImperial ? Math.round(annualElevationProgress.projectedYearEndElevationM * 3.28084) : annualElevationProgress.projectedYearEndElevationM).toLocaleString()} ${eleUnit}`}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{language === 'zh-TW' ? '達成需日均' : '达成需日均'}</div>
              <div className="text-xl sm:text-2xl font-bold text-ios-orange tabular-nums">
                {annualGoalMetric === 'distance'
                  ? (isImperial ? (annualProgress.requiredDailyKm * 0.621371).toFixed(1) : annualProgress.requiredDailyKm)
                  : (isImperial ? Math.round(annualElevationProgress.requiredDailyElevationM * 3.28084) : annualElevationProgress.requiredDailyElevationM).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {annualGoalMetric === 'distance' ? (language === 'zh-TW' ? `${distUnit} / 剩餘日` : `${distUnit} / 剩余日`) : (language === 'zh-TW' ? `${eleUnit} / 剩餘日` : `${eleUnit} / 剩余日`)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{language === 'zh-TW' ? '當期月均量' : '当期月均量'}</div>
              <div className="text-xl sm:text-2xl font-bold text-ios-green tabular-nums">
                {annualGoalMetric === 'distance'
                  ? (isImperial ? Math.round(annualProgress.monthlyRateKm * 0.621371) : annualProgress.monthlyRateKm).toLocaleString()
                  : (isImperial ? Math.round(annualElevationProgress.monthlyRateElevationM * 3.28084) : annualElevationProgress.monthlyRateElevationM).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {annualGoalMetric === 'distance' ? (language === 'zh-TW' ? `${distUnit} / 月` : `${distUnit} / 月`) : (language === 'zh-TW' ? `${eleUnit} / 月` : `${eleUnit} / 月`)}
              </div>
            </div>
          </div>

          {/* Annual Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">{language === 'zh-TW' ? '當前累積完成率' : '当前累积完成率'}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                {annualGoalMetric === 'distance'
                  ? `${(isImperial ? Math.round(annualProgress.currentKm * 0.621371) : annualProgress.currentKm).toLocaleString()} / ${(isImperial ? Math.round(annualProgress.targetKm * 0.621371) : annualProgress.targetKm).toLocaleString()} ${distUnit}`
                  : `${(isImperial ? Math.round(annualElevationProgress.currentElevationM * 3.28084) : annualElevationProgress.currentElevationM).toLocaleString()} / ${(isImperial ? Math.round(annualElevationProgress.targetElevationM * 3.28084) : annualElevationProgress.targetElevationM).toLocaleString()} ${eleUnit}`}
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden relative">
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-slate-900/60 dark:bg-white/70 z-10"
                style={{
                  left: `${Math.min(
                    100,
                    annualGoalMetric === 'distance'
                      ? (annualProgress.expectedPaceKm / annualProgress.targetKm) * 100
                      : (annualElevationProgress.expectedPaceElevationM / annualElevationProgress.targetElevationM) * 100
                  )}%`
                }}
                title={`${language === 'zh-TW' ? '標準進度线: ' : '标准进度线: '}${
                  annualGoalMetric === 'distance'
                    ? `${isImperial ? (annualProgress.expectedPaceKm * 0.621371).toFixed(1) : annualProgress.expectedPaceKm} ${distUnit}`
                    : `${(isImperial ? Math.round(annualElevationProgress.expectedPaceElevationM * 3.28084) : annualElevationProgress.expectedPaceElevationM).toLocaleString()} ${eleUnit}`
                }`}
              />
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  (annualGoalMetric === 'distance' ? annualProgress.isAheadOfPace : annualElevationProgress.isAheadOfPace)
                    ? 'bg-ios-green'
                    : annualGoalMetric === 'distance'
                    ? 'bg-ios-blue'
                    : 'bg-ios-mint'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    annualGoalMetric === 'distance'
                      ? annualProgress.progressPct
                      : annualElevationProgress.progressPct
                  )}%`
                }}
              />
            </div>
          </div>

          {/* Monthly Breakdown Bar Chart */}
          <div className="h-44 sm:h-48 w-full pt-1">
            <Bar data={annualGoalMonthlyChartData as any} options={annualGoalMonthlyChartOptions as any} />
          </div>
        </IOSCard>

        {/* Right 5 cols: Apple Fitness Style Activity Rings */}
        <IOSCard className="lg:col-span-5 space-y-3.5">
          <IOSCardHeader
            title={language === 'zh-TW' ? '運動三環' : '运动三环'}
            subtitle="Apple Fitness 风格同心圆环"
            icon={Activity}
            iconColor="text-ios-red bg-ios-red/10"
          />

          <div className="flex items-center justify-center py-2">
            <div className="relative w-40 h-40 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="7" fill="transparent" className="text-ios-red/15" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="#FF2D55"
                  strokeWidth="7"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - Math.min(1, ringData.distance.pct))}`}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-1000 ease-out"
                />

                <circle cx="50" cy="50" r="32" stroke="currentColor" strokeWidth="7" fill="transparent" className="text-ios-green/15" />
                <circle
                  cx="50"
                  cy="50"
                  r="32"
                  stroke="#34C759"
                  strokeWidth="7"
                  strokeDasharray={`${2 * Math.PI * 32}`}
                  strokeDashoffset={`${2 * Math.PI * 32 * (1 - Math.min(1, ringData.elevation.pct))}`}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-1000 ease-out"
                />

                <circle cx="50" cy="50" r="22" stroke="currentColor" strokeWidth="7" fill="transparent" className="text-ios-blue/15" />
                <circle
                  cx="50"
                  cy="50"
                  r="22"
                  stroke="#007AFF"
                  strokeWidth="7"
                  strokeDasharray={`${2 * Math.PI * 22}`}
                  strokeDashoffset={`${2 * Math.PI * 22 * (1 - Math.min(1, ringData.tss.pct))}`}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">周综合</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                  {Math.round(((ringData.distance.pct + ringData.elevation.pct + ringData.tss.pct) / 3) * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Legends */}
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-ios-pink font-medium">
                <div className="w-2.5 h-2.5 rounded-full bg-ios-pink" />
                <span>里程</span>
              </div>
              <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                {isImperial ? (ringData.distance.current * 0.621371).toFixed(1) : ringData.distance.current} / {isImperial ? Math.round(ringData.distance.target * 0.621371) : ringData.distance.target} {distUnit} ({Math.round(ringData.distance.pct * 100)}%)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-ios-green font-medium">
                <div className="w-2.5 h-2.5 rounded-full bg-ios-green" />
                <span>爬升</span>
              </div>
              <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                +{isImperial ? Math.round(ringData.elevation.current * 3.28084) : ringData.elevation.current} / +{isImperial ? Math.round(ringData.elevation.target * 3.28084) : ringData.elevation.target} {eleUnit} ({Math.round(ringData.elevation.pct * 100)}%)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-ios-blue font-medium">
                <div className="w-2.5 h-2.5 rounded-full bg-ios-blue" />
                <span>负荷</span>
              </div>
              <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                {ringData.tss.current} / {ringData.tss.target} TSS ({Math.round(ringData.tss.pct * 100)}%)
              </span>
            </div>
          </div>
        </IOSCard>
      </div>

      {/* Row 2: Heatmap + Bioclock */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Left 7 cols: 91-Day Heatmap Grid */}
        <IOSCard className="lg:col-span-7 space-y-3.5">
          <IOSCardHeader
            title={language === 'zh-TW' ? '出勤熱力牆' : '出勤热力墙'}
            subtitle="每日里程热力阶梯 · 连击打卡记录"
            icon={Calendar}
            iconColor="text-ios-green bg-ios-green/10"
            action={
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span>当前连击: <strong className="text-ios-blue font-mono">{streakStats.currentStreak} 天</strong></span>
                <span>最长连击: <strong className="text-ios-green font-mono">{streakStats.longestStreak} 天</strong></span>
              </div>
            }
          />

          <div className="overflow-x-auto pb-2">
            <div className="inline-flex flex-col gap-1 min-w-[580px]">
              <div className="flex gap-1">
                {heatmapGrid.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-1">
                    {week.map((cell) => {
                      const colorClass =
                        cell.level === 4
                          ? 'bg-ios-blue dark:bg-ios-blue'
                          : cell.level === 3
                          ? 'bg-ios-blue/70 dark:bg-ios-blue/65'
                          : cell.level === 2
                          ? 'bg-ios-blue/45 dark:bg-ios-blue/40'
                          : cell.level === 1
                          ? 'bg-ios-blue/20 dark:bg-ios-blue/20'
                          : 'bg-slate-100 dark:bg-[#2C2C2E]/60';

                      return (
                        <div
                          key={cell.date}
                          className={`w-3.5 h-3.5 rounded-[3px] ${colorClass} transition-all hover:scale-125 cursor-pointer`}
                          title={`${cell.date}: ${isImperial ? (cell.distanceKm * 0.621371).toFixed(1) : cell.distanceKm} ${distUnit}, +${isImperial ? Math.round(cell.elevationM * 3.28084) : cell.elevationM} ${eleUnit} (${cell.rides} 场)`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-2">
                <span>13 周前</span>
                <div className="flex items-center gap-1.5">
                  <span>休整</span>
                  <div className="w-2.5 h-2.5 rounded-sm bg-slate-100 dark:bg-[#2C2C2E]" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-ios-blue/20" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-ios-blue/45" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-ios-blue/70" />
                  <div className="w-2.5 h-2.5 rounded-sm bg-ios-blue" />
                  <span>破百大强度</span>
                </div>
                <span>本周</span>
              </div>
            </div>
          </div>
        </IOSCard>

        {/* Right 5 cols: Bioclock & Habit Insights */}
        <IOSCard className="lg:col-span-5 space-y-3.5">
          <IOSCardHeader
            title={language === 'zh-TW' ? '生理時鐘畫像' : '生物钟画像'}
            subtitle={`判定车手类型: ${bioclock.riderPattern}`}
            icon={Sun}
            iconColor="text-ios-orange bg-ios-orange/10"
            action={
              <IOSSegmentedControl
                value={bioclockTab}
                onChange={(v) => setBioclockTab(v as 'time' | 'day')}
                options={[
                  { value: 'time', label: '时段分布' },
                  { value: 'day', label: '周度规律' }
                ]}
                size="sm"
                mobileFullWidth={false}
                className="shrink-0"
              />
            }
          />

          <div className="h-56 w-full flex items-center justify-center">
            {bioclockTab === 'time' ? (
              <Doughnut
                data={bioclockDoughnutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'right' as const, labels: { boxWidth: 10, font: { size: 11 } } }
                  }
                }}
              />
            ) : (
              <Bar
                data={bioclockDayBarData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                    y: { grid: { color: 'rgba(120, 120, 128, 0.12)' }, ticks: { font: { size: 10 } } }
                  }
                }}
              />
            )}
          </div>
        </IOSCard>
      </div>
    </div>
  );
});
