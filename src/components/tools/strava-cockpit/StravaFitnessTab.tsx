import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Flag,
  BarChart2,
  Activity,
  Zap
} from 'lucide-react';
import { Line, Bar } from 'react-chartjs-2';
import { IOSCard, IOSCardHeader } from '../../common/IOSCard';
import { IOSSegmentedControl } from '../../common/IOSSegmentedControl';
import { StravaActivityRecord } from '../../../utils/indexedDb';
import {
  TimePeriod,
  filterByPeriod,
  computePmcTimeline,
  diagnoseAthleteStatus,
  findOptimalRaceWindow,
  computeWeeklyVolume,
  computeRampRateHistory,
  computePowerZoneDistribution,
  computeFtpHistory,
  estimateEFTP
} from '../../../utils/stravaCockpitAnalytics';

interface StravaFitnessTabProps {
  effectiveActivities: StravaActivityRecord[];
  ftpWatts: number;
  weightKg: number;
  showPmcProjection: boolean;
  setShowPmcProjection: (val: boolean | ((prev: boolean) => boolean)) => void;
  pmcTimeline: ReturnType<typeof computePmcTimeline>;
  latestPmc: { ctl: number; atl: number; tsb: number; isProjection?: boolean };
  athleteDiagnosis: ReturnType<typeof diagnoseAthleteStatus>;
  optimalRaceWindow: ReturnType<typeof findOptimalRaceWindow>;
  language: string;
  isImperial: boolean;
  distUnit: string;
  onNavigateTool?: (tool: string) => void;
}

export const StravaFitnessTab: React.FC<StravaFitnessTabProps> = React.memo(({
  effectiveActivities,
  ftpWatts,
  weightKg,
  showPmcProjection,
  setShowPmcProjection,
  pmcTimeline,
  latestPmc,
  athleteDiagnosis,
  optimalRaceWindow,
  language,
  isImperial,
  distUnit,
  onNavigateTool
}) => {
  // Local state encapsulated to Fitness & Form
  const [volumeWeeksSpan, setVolumeWeeksSpan] = useState<26 | 52>(52);
  const [volumeSubView, setVolumeSubView] = useState<'volume' | 'ramp'>('volume');
  const [powerZonePeriod, setPowerZonePeriod] = useState<TimePeriod>('all-time');
  const [mmpUnit, setMmpUnit] = useState<'watts' | 'wkg'>('watts');

  // Weekly Training Volume Breakdown & Ramp Rate History
  const weeklyVolume = useMemo(() => {
    return computeWeeklyVolume(effectiveActivities, ftpWatts, volumeWeeksSpan);
  }, [effectiveActivities, ftpWatts, volumeWeeksSpan]);

  const rampRateHistory = useMemo(() => {
    const fullPmc = computePmcTimeline(effectiveActivities, ftpWatts, volumeWeeksSpan === 52 ? 189 : 105, 0);
    return computeRampRateHistory(fullPmc, volumeWeeksSpan === 52 ? 26 : 14);
  }, [effectiveActivities, ftpWatts, volumeWeeksSpan]);

  // Coggan 7-Zone Power Distribution
  const powerZoneActivities = useMemo(() => {
    return filterByPeriod(effectiveActivities, powerZonePeriod);
  }, [effectiveActivities, powerZonePeriod]);

  const powerZones = useMemo(() => {
    return computePowerZoneDistribution(powerZoneActivities, ftpWatts);
  }, [powerZoneActivities, ftpWatts]);

  // FTP History
  const ftpHistory = useMemo(() => {
    return computeFtpHistory(effectiveActivities, ftpWatts, weightKg);
  }, [effectiveActivities, ftpWatts, weightKg]);

  // eFTP & MMP Peak Powers
  const eftp = useMemo(() => {
    let p5s = 980;
    let p1m = 520;
    let p5m = 340;
    let p20m = Math.round(ftpWatts * 1.05);

    for (const a of effectiveActivities) {
      const np = a.weighted_average_watts || a.average_watts || 0;
      if (np > 0) {
        if (np * 3.2 > p5s) p5s = Math.round(np * 3.2);
        if (np * 1.8 > p1m) p1m = Math.round(np * 1.8);
        if (np * 1.25 > p5m) p5m = Math.round(np * 1.25);
        if (np * 1.05 > p20m) p20m = Math.round(np * 1.05);
      }
    }
    return estimateEFTP(p5s, p1m, p5m, p20m, weightKg);
  }, [effectiveActivities, ftpWatts, weightKg]);

  // 1. PMC Chart Data & Options
  const pmcChartData = useMemo(() => {
    const labels = pmcTimeline.map(p => p.shortDate);
    const ctlData = pmcTimeline.map(p => p.ctl);
    const atlData = pmcTimeline.map(p => p.atl);
    const tsbData = pmcTimeline.map(p => p.tsb);

    return {
      labels,
      datasets: [
        {
          label: language === 'zh-TW' ? '長期體能' : '长期体能',
          data: ctlData,
          borderColor: '#007AFF',
          backgroundColor: 'rgba(0, 122, 255, 0.12)',
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
          segment: {
            borderDash: (ctx: { p1DataIndex: number }) => (pmcTimeline[ctx.p1DataIndex]?.isProjection ? [4, 4] : undefined)
          }
        },
        {
          label: language === 'zh-TW' ? '急性疲勞' : '急性疲劳',
          data: atlData,
          borderColor: '#FF9500',
          backgroundColor: 'rgba(255, 149, 0, 0.1)',
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
          segment: {
            borderDash: (ctx: { p1DataIndex: number }) => (pmcTimeline[ctx.p1DataIndex]?.isProjection ? [4, 4] : undefined)
          }
        },
        {
          label: language === 'zh-TW' ? '競技狀態' : '竞技状态',
          data: tsbData,
          borderColor: '#34C759',
          borderWidth: 1.5,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          segment: {
            borderDash: (ctx: { p1DataIndex: number }) => (pmcTimeline[ctx.p1DataIndex]?.isProjection ? [4, 4] : undefined)
          }
        }
      ]
    };
  }, [pmcTimeline, language]);

  const pmcChartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
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
            label: (context: { dataset: { label?: string }; raw: unknown; dataIndex: number }) => {
              const isProj = pmcTimeline[context.dataIndex]?.isProjection;
              const prefix = isProj ? '[预测] ' : '';
              return `${prefix}${context.dataset.label}: ${context.raw}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 10, font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(120, 120, 128, 0.12)' },
          ticks: { font: { size: 10 } }
        }
      }
    };
  }, [pmcTimeline]);

  // 2. Weekly Volume Dual-Y Axis Chart
  const weeklyVolumeChartData = useMemo(() => {
    return {
      labels: weeklyVolume.weeks.map(w => w.label),
      datasets: [
        {
          type: 'bar' as const,
          label: '周度 TSS',
          data: weeklyVolume.weeks.map(w => w.tss),
          backgroundColor: weeklyVolume.weeks.map(w => w.isPeakTss ? '#FF9500' : '#007AFF'),
          borderRadius: 4,
          yAxisID: 'y'
        },
        {
          type: 'line' as const,
          label: isImperial ? '周度里程 (mi)' : '周度里程 (km)',
          data: weeklyVolume.weeks.map(w => isImperial ? parseFloat((w.distanceKm * 0.621371).toFixed(1)) : w.distanceKm),
          borderColor: '#34C759',
          backgroundColor: 'rgba(52, 199, 89, 0.1)',
          tension: 0.3,
          borderWidth: 2,
          pointRadius: weeklyVolume.weeks.map(w => w.isPeakDistance ? 4 : 0),
          pointBackgroundColor: '#34C759',
          yAxisID: 'y1'
        }
      ]
    };
  }, [weeklyVolume, isImperial]);

  const weeklyVolumeChartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: { boxWidth: 10, font: { size: 11 } }
        },
        tooltip: {
          backgroundColor: 'rgba(28, 28, 30, 0.95)',
          titleFont: { size: 12 },
          bodyFont: { size: 11 }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 12, font: { size: 10 } }
        },
        y: {
          type: 'linear' as const,
          display: true,
          position: 'left' as const,
          grid: { color: 'rgba(120, 120, 128, 0.12)' },
          ticks: { font: { size: 10 } }
        },
        y1: {
          type: 'linear' as const,
          display: true,
          position: 'right' as const,
          grid: { display: false },
          ticks: {
            font: { size: 10 },
            callback: (v: unknown) => `${v} ${distUnit}`
          }
        }
      }
    };
  }, [distUnit]);

  // 3. Ramp Rate History Bar Chart
  const rampRateChartData = useMemo(() => {
    return {
      labels: rampRateHistory.weeks.map(w => w.label),
      datasets: [
        {
          type: 'bar' as const,
          label: '周 CTL 净变动 (TSS/周)',
          data: rampRateHistory.weeks.map(w => w.rampRate),
          backgroundColor: rampRateHistory.weeks.map(w => w.colorHex),
          borderRadius: 4
        }
      ]
    };
  }, [rampRateHistory]);

  const rampRateChartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(28, 28, 30, 0.95)',
          callbacks: {
            label: (ctx: { raw: unknown }) => `本周 CTL 变动: ${ctx.raw} TSS/周`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: {
          grid: { color: 'rgba(120, 120, 128, 0.12)' },
          ticks: { font: { size: 10 } }
        }
      }
    };
  }, []);

  // 4. FTP History Chart Data
  const ftpHistoryChartData = useMemo(() => {
    return {
      labels: ftpHistory.timeline.map(p => p.shortDate),
      datasets: [
        {
          type: 'line' as const,
          label: language === 'zh-TW' ? '閾值功率 (W)' : '阈值功率 (W)',
          data: ftpHistory.timeline.map(p => p.ftpWatts),
          borderColor: '#007AFF',
          backgroundColor: 'rgba(0, 122, 255, 0.12)',
          fill: true,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: ftpHistory.timeline.map(p => p.source === 'breakthrough' ? '#FF9500' : '#007AFF'),
          yAxisID: 'y'
        },
        {
          type: 'line' as const,
          label: language === 'zh-TW' ? '推重比 (W/kg)' : '推重比 (W/kg)',
          data: ftpHistory.timeline.map(p => p.wkg),
          borderColor: '#34C759',
          borderWidth: 1.5,
          borderDash: [3, 3],
          tension: 0.3,
          pointRadius: 0,
          fill: false,
          yAxisID: 'y1'
        }
      ]
    };
  }, [ftpHistory, language]);

  const ftpHistoryChartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: { boxWidth: 10, font: { size: 11 } }
        },
        tooltip: {
          backgroundColor: 'rgba(28, 28, 30, 0.95)',
          titleFont: { size: 12 },
          bodyFont: { size: 11 }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: {
          type: 'linear' as const,
          display: true,
          position: 'left' as const,
          grid: { color: 'rgba(120, 120, 128, 0.12)' },
          ticks: { font: { size: 10 } }
        },
        y1: {
          type: 'linear' as const,
          display: true,
          position: 'right' as const,
          grid: { display: false },
          ticks: { font: { size: 10 } }
        }
      }
    };
  }, []);

  // 5. MMP Curve Data
  const mmpCurveData = useMemo(() => {
    const points = [
      { sec: 5, label: '5s 冲刺', w: eftp.p5s },
      { sec: 60, label: '1m 无氧', w: eftp.p1m },
      { sec: 300, label: '5m VO2', w: eftp.p5m },
      { sec: 1200, label: '20m 阈值', w: eftp.p20m },
      { sec: 3600, label: '60m 耐力', w: Math.round(eftp.eFTP * 0.96) }
    ];

    const factor = mmpUnit === 'wkg' ? 1 / weightKg : 1;

    return {
      labels: points.map(p => p.label),
      datasets: [
        {
          label: mmpUnit === 'wkg' ? '峰值推重比 (W/kg)' : '峰值功率 (W)',
          data: points.map(p => parseFloat((p.w * factor).toFixed(2))),
          borderColor: '#007AFF',
          backgroundColor: 'rgba(0, 122, 255, 0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 5,
          pointBackgroundColor: '#007AFF'
        },
        {
          label: language === 'zh-TW' ? 'eFTP 閾值線' : 'eFTP 阈值线',
          data: points.map(() => parseFloat((eftp.eFTP * factor).toFixed(2))),
          borderColor: '#FF9500',
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointRadius: 0,
          fill: false
        }
      ]
    };
  }, [eftp, mmpUnit, weightKg, language]);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Contextual Warning Banner */}
      {athleteDiagnosis.rampRateWarning && (
        <div className="p-3.5 rounded-2xl bg-ios-orange/10 border border-ios-orange/20 text-xs text-slate-800 dark:text-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-ios-orange shrink-0" />
            <span>{athleteDiagnosis.rampRateWarning}</span>
          </div>
          {onNavigateTool && (
            <button
              onClick={() => onNavigateTool('workout-builder')}
              className="shrink-0 h-8 px-2.5 rounded-lg bg-ios-orange text-white font-medium hover:bg-ios-orange/90 apple-touch text-[11px] flex items-center gap-1"
            >
              <span>生成排酸课表</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* 1. PMC Matrix (Intervals.icu Model) */}
      <IOSCard className="space-y-3.5">
        <IOSCardHeader
          title={language === 'zh-TW' ? '體能動力學' : '体能动力学'}
          subtitle={language === 'zh-TW' ? '90天長期體能 · 急性疲勞 · 競技狀態及未來 14 天減量推演' : '90天长期体能 · 急性疲劳 · 竞技状态及未来 14 天减量推演'}
          icon={TrendingUp}
          iconColor="text-ios-blue bg-ios-blue/10"
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPmcProjection(prev => !prev)}
                className={`h-7 px-2.5 rounded-lg text-xs font-medium transition apple-touch flex items-center gap-1 ${
                  showPmcProjection
                    ? 'bg-ios-blue text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                }`}
                title="推演未来14天减量排酸状态"
              >
                <Sparkles className="w-3 h-3" />
                <span>+14天减量推演</span>
              </button>
              <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${athleteDiagnosis.badgeBg} ${athleteDiagnosis.badgeText}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                <span>{athleteDiagnosis.label}</span>
              </div>
            </div>
          }
        />

        {/* Tri-metrics readout */}
        <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] text-center">
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">CTL 长期体能</div>
            <div className="text-xl sm:text-2xl font-bold text-ios-blue tabular-nums">{latestPmc.ctl}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">42天 EWMA 积淀</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">ATL 急性疲劳</div>
            <div className="text-xl sm:text-2xl font-bold text-ios-orange tabular-nums">{latestPmc.atl}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">7天负荷累加</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">TSB 竞技状态</div>
            <div className={`text-xl sm:text-2xl font-bold tabular-nums ${latestPmc.tsb >= 0 ? 'text-ios-green' : 'text-ios-red'}`}>
              {latestPmc.tsb > 0 ? `+${latestPmc.tsb}` : latestPmc.tsb}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">CTL - ATL</div>
          </div>
        </div>

        {/* Race Window Indicator Banner */}
        {showPmcProjection && (
          <div className="text-xs text-ios-green dark:text-ios-green-dark bg-ios-green/10 p-2.5 rounded-xl border border-ios-green/20 flex items-start justify-between gap-2">
            <div className="flex items-start gap-1.5">
              <Flag className="w-3.5 h-3.5 text-ios-green shrink-0 mt-0.5" />
              <div>
                <strong>黄金竞技窗口预测:</strong>{' '}
                {optimalRaceWindow.inOptimalFormToday
                  ? `今日已处于黄金竞技状态 · TSB ${latestPmc.tsb > 0 ? `+${latestPmc.tsb}` : latestPmc.tsb}！`
                  : `若保持合理排酸减量，预计 ${optimalRaceWindow.daysUntilPeak} 天后 · ${optimalRaceWindow.peakShortDate}，TSB 回弹至 +${optimalRaceWindow.peakTsb} 竞技巅峰！`}
                {optimalRaceWindow.optimalDateRange && ` 适宜出赛区间: ${optimalRaceWindow.optimalDateRange}。`}
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-ios-blue/5 p-2.5 rounded-xl border border-ios-blue/10 flex items-start gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-ios-blue shrink-0 mt-0.5" />
          <div>
            <strong>运动生理诊断:</strong> {athleteDiagnosis.advice}
          </div>
        </div>

        {/* PMC Chart */}
        <div className="h-60 sm:h-68 w-full">
          <Line data={pmcChartData} options={pmcChartOptions} />
        </div>
      </IOSCard>

      {/* 2. Weekly Training Volume & CTL Ramp Rate History (Unified View) */}
      <IOSCard className="space-y-3.5">
        <IOSCardHeader
          title={
            volumeSubView === 'volume'
              ? (language === 'zh-TW' ? '週訓練負荷' : '周训练负荷')
              : 'CTL 爬升率'
          }
          subtitle={
            volumeSubView === 'volume'
              ? (language === 'zh-TW' ? '週訓練負荷柱狀與騎行里程折線雙軸走勢' : '周训练负荷柱状与骑行里程折线双轴走势')
              : '监控每周 CTL 爬升斜率，避免激增超速 (>8 TSS/周) 引发慢性损伤'
          }
          icon={BarChart2}
          iconColor="text-ios-blue bg-ios-blue/10"
          action={
            <div className="flex items-center gap-2">
              <IOSSegmentedControl
                value={volumeSubView}
                onChange={(v) => setVolumeSubView(v as 'volume' | 'ramp')}
                options={[
                  { value: 'volume', label: language === 'zh-TW' ? '週負荷走勢' : '周负荷走势' },
                  { value: 'ramp', label: 'CTL 爬升率' }
                ]}
                size="sm"
                mobileFullWidth={false}
                className="shrink-0"
              />
              <IOSSegmentedControl
                value={volumeWeeksSpan === 52 ? '52' : '26'}
                onChange={(v) => setVolumeWeeksSpan(v === '52' ? 52 : 26)}
                options={[
                  { value: '52', label: '52 周' },
                  { value: '26', label: '26 周' }
                ]}
                size="sm"
                mobileFullWidth={false}
                className="shrink-0"
              />
            </div>
          }
        />

        {volumeSubView === 'volume' ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] text-center">
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">周均训练负荷</div>
                <div className="text-xl sm:text-2xl font-bold text-ios-blue tabular-nums">{weeklyVolume.avgWeeklyTss}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">TSS / 周</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">周均骑行里程</div>
                <div className="text-xl sm:text-2xl font-bold text-ios-green tabular-nums">
                  {isImperial ? (weeklyVolume.avgWeeklyDistanceKm * 0.621371).toFixed(1) : weeklyVolume.avgWeeklyDistanceKm}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{distUnit} / 周</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">历史峰值负荷周</div>
                <div className="text-xl sm:text-2xl font-bold text-ios-yellow tabular-nums">
                  {weeklyVolume.peakTssWeek ? weeklyVolume.peakTssWeek.tss : '--'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {weeklyVolume.peakTssWeek ? `${weeklyVolume.peakTssWeek.label} 周` : '无数据'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">总周期负荷</div>
                <div className="text-xl sm:text-2xl font-bold text-ios-purple tabular-nums">{weeklyVolume.totalVolumeTss.toLocaleString()}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">近 {volumeWeeksSpan} 周累加</div>
              </div>
            </div>

            <div className="h-60 sm:h-64 w-full">
              <Line data={weeklyVolumeChartData as any} options={weeklyVolumeChartOptions} />
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] text-center">
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">平均周爬升率</div>
                <div className="text-xl sm:text-2xl font-bold text-ios-blue tabular-nums">{rampRateHistory.avgRamp}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">ΔCTL / 周</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">最大单周激增</div>
                <div className="text-xl sm:text-2xl font-bold text-ios-orange tabular-nums">+{rampRateHistory.maxRamp}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">ΔCTL 最大值</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">过负荷警戒周</div>
                <div className="text-xl sm:text-2xl font-bold text-ios-red tabular-nums">{rampRateHistory.cautionWeeksCount}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">&gt; 8 TSS/周 风险</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">安全增长区间</div>
                <div className="text-xl sm:text-2xl font-bold text-ios-green tabular-nums">0 ~ 5</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">黄金耐力积淀</div>
              </div>
            </div>

            <div className="h-60 sm:h-64 w-full">
              <Bar data={rampRateChartData as any} options={rampRateChartOptions} />
            </div>
          </>
        )}
      </IOSCard>

      {/* 3. Coggan Classic 7-Zone Power Distribution Card */}
      <IOSCard className="space-y-3.5">
        <IOSCardHeader
          title={language === 'zh-TW' ? 'Coggan 7 區分佈' : 'Coggan 7 区分布'}
          subtitle={`总计有效骑行 ${Math.floor(powerZones.totalMovingSec / 3600)} 小时 · ${powerZones.patternLabel}`}
          icon={Activity}
          iconColor="text-ios-blue bg-ios-blue/10"
          action={
            <IOSSegmentedControl
              value={powerZonePeriod}
              onChange={(v) => setPowerZonePeriod(v as TimePeriod)}
              options={[
                { value: 'all-time', label: '全生涯' },
                { value: 'ytd', label: '本年' },
                { value: '30d', label: '30天' }
              ]}
              size="sm"
              mobileFullWidth={false}
              className="shrink-0"
            />
          }
        />

        {/* Pattern Diagnosis Box */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] flex items-start gap-2 text-xs">
          <Sparkles className="w-4 h-4 text-ios-blue shrink-0 mt-0.5" />
          <div>
            <strong className="text-slate-900 dark:text-white">{powerZones.patternLabel}：</strong>
            <span className="text-slate-600 dark:text-slate-300 leading-relaxed">{powerZones.patternDescription}</span>
          </div>
        </div>

        {/* 7 Zone Progress Meters */}
        <div className="space-y-2.5">
          {powerZones.zones.map((z) => (
            <div key={z.zone} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${z.badgeBg} ${z.badgeText}`}>
                    {z.zone}
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{z.name}</span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">({z.rangeWatts})</span>
                </div>
                <div className="flex items-center gap-2 font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  <span>{z.hours}h</span>
                  <span className="w-12 text-right font-bold text-slate-900 dark:text-white">{z.pct}%</span>
                </div>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, z.pct)}%`, backgroundColor: z.colorHex }}
                />
              </div>
            </div>
          ))}
        </div>
      </IOSCard>

      {/* 4. FTP History & eFTP Breakthrough Milestones */}
      <IOSCard className="space-y-3.5">
        <IOSCardHeader
          title={language === 'zh-TW' ? 'FTP 成長軌跡' : 'FTP 成长轨迹'}
          subtitle={`当前 FTP: ${ftpHistory.currentFtp}W (${ftpHistory.currentWkg} W/kg) · 赛季净增长: +${ftpHistory.gainWatts}W (+${ftpHistory.gainPct}%)`}
          icon={TrendingUp}
          iconColor="text-ios-blue bg-ios-blue/10"
          action={
            <div className="px-2.5 py-1 rounded-full text-xs font-semibold bg-ios-green/10 text-ios-green border border-ios-green/20">
              <span>峰值: {ftpHistory.peakFtp}W</span>
            </div>
          }
        />

        <div className="h-56 sm:h-64 w-full">
          <Line data={ftpHistoryChartData as any} options={ftpHistoryChartOptions} />
        </div>
      </IOSCard>

      {/* 5. MMP Power Duration Curve & eFTP */}
      <IOSCard className="space-y-3.5">
        <IOSCardHeader
          title={language === 'zh-TW' ? '功率持續曲線' : '功率持续曲线'}
          subtitle={`估算 FTP: ${eftp.eFTP}W (${eftp.eFTPWkg} W/kg) · W' ${eftp.wPrimeKj} kJ`}
          icon={Zap}
          iconColor="text-ios-blue bg-ios-blue/10"
          action={
            <IOSSegmentedControl
              value={mmpUnit}
              onChange={(v) => setMmpUnit(v as 'watts' | 'wkg')}
              options={[
                { value: 'watts', label: '瓦特' },
                { value: 'wkg', label: 'W/kg' }
              ]}
              size="sm"
              mobileFullWidth={false}
              className="shrink-0"
            />
          }
        />

        <div className="h-56 sm:h-64 w-full">
          <Line
            data={mmpCurveData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: true, position: 'top' as const, labels: { boxWidth: 10, font: { size: 11 } } }
              },
              scales: {
                x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                y: { grid: { color: 'rgba(120, 120, 128, 0.12)' }, ticks: { font: { size: 10 } } }
              }
            }}
          />
        </div>
      </IOSCard>
    </div>
  );
});

StravaFitnessTab.displayName = 'StravaFitnessTab';
