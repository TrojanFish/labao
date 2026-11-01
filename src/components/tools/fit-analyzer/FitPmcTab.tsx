import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Cloud,
  RefreshCw,
  Award,
  Zap
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { NumberStepper } from '../../common/NumberStepper';
import {
  generatePmcSeries,
  getTsbZoneInfo,
  predictTaperDays,
  PmcMesocycleType,
  BaselineFitnessLevel,
  ManualTssEntry,
  BASELINE_FITNESS_OPTIONS,
  calculateContinuousSeasonPmc,
  PmcTimeRange
} from '../../../utils/pmcCalculator';
import { LocalActivityRecord } from '../../../utils/localActivityDb';
import { StravaActivityRecord } from '../../../utils/indexedDb';

interface FitPmcTabProps {
  localActivities: LocalActivityRecord[];
  stravaActivities: StravaActivityRecord[];
  isStravaConnected: boolean;
  isStravaSyncing: boolean;
  syncStravaActivities: (force: boolean) => Promise<unknown>;
  analysisTss?: number;
  language: string;
}

export const FitPmcTab: React.FC<FitPmcTabProps> = React.memo(({
  localActivities,
  stravaActivities,
  isStravaConnected,
  isStravaSyncing,
  syncStravaActivities,
  analysisTss,
  language
}) => {
  // Source Selection: Local History (if available) vs Preset Mesocycle
  const [pmcDataSource, setPmcDataSource] = useState<'local_history' | 'preset_mesocycle'>(
    localActivities.length > 0 ? 'local_history' : 'preset_mesocycle'
  );
  const [pmcTimeRange, setPmcTimeRange] = useState<PmcTimeRange>('90d');
  const [pmcMesocycle, setPmcMesocycle] = useState<PmcMesocycleType>('base');
  const [baselineFitness, setBaselineFitness] = useState<BaselineFitnessLevel>('club');
  const [futureProjectionDays, setFutureProjectionDays] = useState<number>(0);
  const [targetTsbForPeak, setTargetTsbForPeak] = useState<number>(15);

  // Manual TSS Input State
  const [manualTssEntries, setManualTssEntries] = useState<ManualTssEntry[]>([]);
  const [newManualDayOffset, setNewManualDayOffset] = useState<number>(0);
  const [newManualTss, setNewManualTss] = useState<number>(85);
  const [newManualTitle, setNewManualTitle] = useState<string>('');

  const handleAddManualTss = () => {
    if (newManualTss <= 0) return;
    const entry: ManualTssEntry = {
      id: `manual_${Date.now()}`,
      dayOffset: newManualDayOffset,
      tss: newManualTss,
      title: newManualTitle.trim() || '日常训练'
    };
    setManualTssEntries(prev => [...prev.filter(e => e.dayOffset !== newManualDayOffset), entry]);
    setNewManualTitle('');
  };

  const handleRemoveManualTss = (id: string) => {
    setManualTssEntries(prev => prev.filter(e => e.id !== id));
  };

  // Continuous Season PMC Calculation from Local-First DB
  const continuousPmcResult = useMemo(() => {
    if (pmcDataSource === 'local_history' && localActivities.length > 0) {
      return calculateContinuousSeasonPmc(
        localActivities,
        pmcTimeRange,
        baselineFitness,
        futureProjectionDays,
        25
      );
    }
    return null;
  }, [pmcDataSource, localActivities, pmcTimeRange, baselineFitness, futureProjectionDays]);

  const simulatedPmcData = useMemo(() => {
    return generatePmcSeries(
      pmcMesocycle,
      analysisTss,
      baselineFitness,
      manualTssEntries,
      isStravaConnected ? stravaActivities : undefined
    );
  }, [pmcMesocycle, analysisTss, baselineFitness, manualTssEntries, isStravaConnected, stravaActivities]);

  const pmcData = continuousPmcResult ? continuousPmcResult.series : simulatedPmcData;
  const pmcSummary = continuousPmcResult ? continuousPmcResult.summary : null;

  const latestPmcDay = pmcData[pmcData.length - 1];
  const currentTsbVal = pmcSummary ? pmcSummary.currentTsb : (latestPmcDay ? latestPmcDay.tsb : 0);
  const currentTsbZone = getTsbZoneInfo(currentTsbVal);
  const currentCtlVal = pmcSummary ? pmcSummary.currentCtl : (latestPmcDay ? latestPmcDay.ctl : 50);
  const currentAtlVal = pmcSummary ? pmcSummary.currentAtl : (latestPmcDay ? latestPmcDay.atl : 40);

  const taperPrediction = predictTaperDays(
    currentCtlVal,
    currentAtlVal,
    targetTsbForPeak
  );

  const pmcChartData = useMemo(() => {
    return {
      labels: pmcData.map(d => d.date),
      datasets: [
        {
          label: language === 'zh-TW' ? '長期體能' : '长期体能',
          data: pmcData.map(d => d.ctl),
          borderColor: '#00AFFF',
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          tension: 0.3,
          pointRadius: 1,
          yAxisID: 'y'
        },
        {
          label: language === 'zh-TW' ? '急性疲勞' : '急性疲劳',
          data: pmcData.map(d => d.atl),
          borderColor: '#f43f5e',
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          tension: 0.3,
          pointRadius: 1,
          yAxisID: 'y'
        },
        {
          label: language === 'zh-TW' ? '競技狀態' : '竞技状态',
          data: pmcData.map(d => d.tsb),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
          borderWidth: 1.8,
          tension: 0.3,
          pointRadius: 1,
          yAxisID: 'y1'
        }
      ]
    };
  }, [pmcData, language]);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* PMC Overview Card */}
      <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-4">
        {/* Strava Live Sync Banner if Connected */}
        {isStravaConnected && (
          <div className="p-3 sm:p-3.5 rounded-xl bg-[#FC4C02]/10 border border-[#FC4C02]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-[#FC4C02] text-white flex items-center justify-center shrink-0 shadow-xs font-bold">
                <Cloud className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-slate-900 dark:text-white block truncate">
                  Strava 云端真实训练负荷时序已激活
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  已自动汇入 {stravaActivities.length} 次真实骑行 TSS 驱动 42天 CTL/ATL/TSB 曲线
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => syncStravaActivities(false)}
              disabled={isStravaSyncing}
              className="apple-touch self-start sm:self-auto px-3 py-1.5 rounded-xl bg-white dark:bg-[#1C1C1E] hover:bg-slate-50 dark:hover:bg-white/10 text-[#FC4C02] font-semibold text-xs border border-[#FC4C02]/30 shrink-0 flex items-center gap-1.5 transition shadow-2xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isStravaSyncing ? 'animate-spin' : ''}`} />
              <span>{isStravaSyncing ? '同步中...' : '同步最新'}</span>
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-ios-blue" />
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                {language === 'zh-TW' ? '體能管理模型' : '体能管理模型'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-ios-blue/10 text-ios-blue border border-ios-blue/20">
                {pmcDataSource === 'local_history' ? 'Local-First 真实时序' : 'Bannister EWMA 模拟'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {pmcDataSource === 'local_history'
                ? `由本地持久化时序库中 ${localActivities.length} 场真实骑行连续驱动，每日自动递推计算体能累积与疲劳消退。`
                : '长期体能积累 (42天)、急性疲劳 (7天) 与比赛竞技状态动态时序监测。'}
            </p>
          </div>

          {/* Mode & Timeframe Controls */}
          <div className="flex flex-col xl:flex-row items-start xl:items-center gap-2.5">
            {/* Source Switcher */}
            {localActivities.length > 0 && (
              <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setPmcDataSource('local_history')}
                  className={`apple-touch px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    pmcDataSource === 'local_history'
                      ? 'bg-white dark:bg-white/20 text-ios-blue shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  真实历史时序
                </button>
                <button
                  type="button"
                  onClick={() => setPmcDataSource('preset_mesocycle')}
                  className={`apple-touch px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    pmcDataSource === 'preset_mesocycle'
                      ? 'bg-white dark:bg-white/20 text-ios-blue shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  周期课表模拟
                </button>
              </div>
            )}

            {/* Controls for Local History Mode */}
            {pmcDataSource === 'local_history' && (
              <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
                {(['30d', '90d', '180d', 'ytd', 'all'] as PmcTimeRange[]).map((tr) => (
                  <button
                    key={tr}
                    type="button"
                    onClick={() => setPmcTimeRange(tr)}
                    className={`apple-touch px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      pmcTimeRange === tr
                        ? 'bg-white dark:bg-white/20 text-ios-blue shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {tr === '30d' ? '近30天' : tr === '90d' ? '近90天' : tr === '180d' ? '近半年' : tr === 'ytd' ? '本赛季' : '全周期'}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setFutureProjectionDays(prev => prev > 0 ? 0 : 14)}
                  className={`apple-touch px-2.5 py-1 rounded-lg text-xs font-semibold transition border ${
                    futureProjectionDays > 0
                      ? 'bg-ios-orange/15 border-ios-orange/30 text-ios-orange font-bold'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                  title="向未来延长 14 天赛前减量预测"
                >
                  {futureProjectionDays > 0 ? '✓ +14天减量' : '+14天预测'}
                </button>
              </div>
            )}

            {/* Controls for Simulated Mesocycle Mode */}
            {pmcDataSource === 'preset_mesocycle' && (
              <>
                <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 overflow-x-auto max-w-full">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-2 shrink-0">
                    体能起点:
                  </span>
                  {(['rec', 'club', 'elite', 'pro'] as BaselineFitnessLevel[]).map((level) => (
                    <button
                      key={level}
                      onClick={() => setBaselineFitness(level)}
                      className={`apple-touch px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                        baselineFitness === level
                          ? 'bg-white dark:bg-white/20 text-ios-blue shadow-xs font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                      title={BASELINE_FITNESS_OPTIONS[level].desc}
                    >
                      {BASELINE_FITNESS_OPTIONS[level].label.split(' ')[0]} ({BASELINE_FITNESS_OPTIONS[level].ctl})
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
                  <button
                    onClick={() => setPmcMesocycle('base')}
                    className={`apple-touch px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      pmcMesocycle === 'base'
                        ? 'bg-white dark:bg-white/20 text-ios-blue shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    基础期 (60天)
                  </button>
                  <button
                    onClick={() => setPmcMesocycle('build')}
                    className={`apple-touch px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      pmcMesocycle === 'build'
                        ? 'bg-white dark:bg-white/20 text-ios-blue shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    强化期 (45天)
                  </button>
                  <button
                    onClick={() => setPmcMesocycle('taper')}
                    className={`apple-touch px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      pmcMesocycle === 'taper'
                        ? 'bg-white dark:bg-white/20 text-ios-blue shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    减量备战 (28天)
                  </button>
                  <button
                    onClick={() => setPmcMesocycle('grand_tour')}
                    className={`apple-touch px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      pmcMesocycle === 'grand_tour'
                        ? 'bg-white dark:bg-white/20 text-ios-blue shadow-xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    多日赛重负荷 (21天)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 4 Core Current Numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 sm:p-3.5 rounded-xl bg-ios-blue/10 border border-ios-blue/20 text-center">
            <span className="text-[11px] font-semibold text-ios-blue block">当前长期体能</span>
            <span className="text-2xl sm:text-3xl font-bold font-mono text-ios-blue block my-1 tabular-nums">
              {latestPmcDay ? latestPmcDay.ctl : '--'}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">42 天滚动体能均线</span>
          </div>

          <div className="p-3 sm:p-3.5 rounded-xl bg-ios-orange/10 border border-ios-orange/20 text-center">
            <span className="text-[11px] font-semibold text-ios-orange block">当前急性疲劳</span>
            <span className="text-2xl sm:text-3xl font-bold font-mono text-ios-orange block my-1 tabular-nums">
              {latestPmcDay ? latestPmcDay.atl : '--'}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">7 天短期负荷均线</span>
          </div>

          <div className="p-3 sm:p-3.5 rounded-xl bg-ios-green/10 border border-ios-green/20 text-center">
            <span className="text-[11px] font-semibold text-ios-green block">当前竞技状态</span>
            <span
              className="text-2xl sm:text-3xl font-bold font-mono block my-1 tabular-nums"
              style={{ color: currentTsbZone.color }}
            >
              {latestPmcDay ? (latestPmcDay.tsb > 0 ? `+${latestPmcDay.tsb}` : latestPmcDay.tsb) : '--'}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">CTL - ATL 差值</span>
          </div>

          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
              {pmcSummary ? 'ACWR 负荷比率' : '本次骑行载入 TSS'}
            </span>
            <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900 dark:text-white block my-1 tabular-nums">
              {pmcSummary ? pmcSummary.acwr : (analysisTss ?? '--')}
            </span>
            <span className="text-[11px] text-ios-green font-medium truncate block">
              {pmcSummary ? `7日爬升: ${pmcSummary.rampRate7d > 0 ? `+${pmcSummary.rampRate7d}` : pmcSummary.rampRate7d}/周` : '已合并进末日时间轴'}
            </span>
          </div>
        </div>

        {/* Macro Season Summary Card when in Local-First history */}
        {pmcSummary && (
          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-ios-blue" />
              <span className="font-bold text-slate-800 dark:text-white">时序统计宏观战报:</span>
              <span className="text-slate-500">
                所选时段累计已完成 <strong className="text-slate-900 dark:text-white font-mono tabular-nums">{pmcSummary.activeDaysCount}</strong> 天出勤训练
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-slate-600 dark:text-slate-300 text-[11px] tabular-nums">
              <span>总里程: <strong className="text-slate-900 dark:text-white font-bold">{pmcSummary.totalSeasonKm}</strong> km</span>
              <span>累计负荷: <strong className="text-slate-900 dark:text-white font-bold">{pmcSummary.totalSeasonTss}</strong> TSS</span>
              <span>周均负荷: <strong className="text-slate-900 dark:text-white font-bold">{pmcSummary.weeklyAvgTss}</strong> TSS/周</span>
            </div>
          </div>
        )}

        {/* Triple-Curve Line Chart */}
        <div className="h-80 w-full pt-2">
          <Line
            data={pmcChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: {
                mode: 'index',
                intersect: false
              },
              scales: {
                x: {
                  grid: { color: 'rgba(150, 150, 150, 0.08)' },
                  ticks: { color: '#94a3b8', font: { size: 10 } }
                },
                y: {
                  type: 'linear',
                  display: true,
                  position: 'left',
                  grid: { color: 'rgba(150, 150, 150, 0.08)' },
                  ticks: { color: '#AEAEB2', font: { size: 10 } },
                  title: { display: true, text: '长期体能 / 急性疲劳', color: '#8E8E93', font: { size: 11 } }
                },
                y1: {
                  type: 'linear',
                  display: true,
                  position: 'right',
                  grid: { drawOnChartArea: false },
                  ticks: { color: '#10b981', font: { size: 10 } },
                  title: { display: true, text: '竞技状态', color: '#10b981', font: { size: 11 } }
                }
              },
              plugins: {
                legend: {
                  position: 'top',
                  labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 14 }
                },
                tooltip: {
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  borderColor: 'rgba(56, 189, 248, 0.3)',
                  borderWidth: 1
                }
              }
            }}
          />
        </div>
      </div>

      {/* Race Day Peak Predictor & Coach Diagnostic */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {/* Left: TSB Status Diagnostic */}
        <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              当前机体竞技状态判定
            </span>
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono"
              style={{ backgroundColor: `${currentTsbZone.color}20`, color: currentTsbZone.color }}
            >
              {language === 'zh-TW' ? currentTsbZone.labelTw : currentTsbZone.label}
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10">
            {language === 'zh-TW' ? currentTsbZone.adviceTw : currentTsbZone.advice}
          </p>

          {/* 5 TSB Reference Zones */}
          <div className="space-y-1.5 pt-2">
            <div className="text-[11px] font-bold text-slate-500">TSB 黄金区间速查：</div>
            <div className="grid grid-cols-5 gap-1 text-[11px] text-center font-mono font-bold">
              <div className="p-1 rounded-lg bg-red-500/10 text-red-500" title="过度透支">&lt; -30 透支</div>
              <div className="p-1 rounded-lg bg-blue-500/10 text-blue-500" title="强化提升">-30~-10 增能</div>
              <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-500" title="维持">-10~+5 维持</div>
              <div className="p-1 rounded-lg bg-amber-500/10 text-amber-500" title="巅峰状态">+5~+25 巅峰</div>
              <div className="p-1 rounded-lg bg-slate-500/10 text-slate-500" title="衰退">&gt; +25 衰退</div>
            </div>
          </div>
        </div>

        {/* Right: Target Race Peak Predictor */}
        <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" />
              目标赛事巅峰状态倒计时预测
            </span>
            <span className="text-xs font-mono font-bold text-amber-500 tabular-nums">
              目标 TSB: +{targetTsbForPeak}
            </span>
          </div>

          <div>
            <input
              type="range"
              min={5}
              max={25}
              value={targetTsbForPeak}
              onChange={(e) => setTargetTsbForPeak(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
              <span>+5 稳健参赛</span>
              <span>+15 爆发力巅峰</span>
              <span>+25 极限减量</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-1">
            <div className="text-xs text-amber-700 dark:text-amber-300 font-semibold">
              预计所需减量备赛周期
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">
              {taperPrediction.daysNeeded} <span className="text-sm font-sans">天</span>
            </div>
            <div className="text-[11px] text-slate-600 dark:text-slate-300">
              出关比赛日预测 CTL 体能保全值：<strong className="font-mono text-slate-900 dark:text-white tabular-nums">{taperPrediction.predictedCtl}</strong>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            在减量期保持每天 20~35 TSS 的低量高频刺激（短冲刺激活神经，缩减总骑行时间 40%），可确保疲劳迅速消退而有氧酶活性不失。
          </p>
        </div>
      </div>

      {/* Manual TSS Workout Logging Card */}
      <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-3">
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-ios-blue" />
            手动补录日常训练负荷
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            可补记未导出 FIT 文件的骑行台训练、通勤或周末外骑，实时重塑 42 天 CTL 体能与 ATL 疲劳走势。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <div className="w-28 sm:w-32">
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">训练日期</label>
            <select
              value={newManualDayOffset}
              onChange={(e) => setNewManualDayOffset(Number(e.target.value))}
              className="w-full h-9 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 text-xs text-slate-900 dark:text-white focus:outline-none"
            >
              <option value={0}>今天</option>
              <option value={-1}>昨天</option>
              <option value={-2}>前天</option>
              <option value={-3}>3天前</option>
            </select>
          </div>

          <div className="w-28 sm:w-32">
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">TSS 负荷点数</label>
            <NumberStepper
              value={newManualTss}
              onChange={setNewManualTss}
              min={10}
              max={400}
              step={5}
              unit="TSS"
            />
          </div>

          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">训练备注</label>
            <input
              type="text"
              value={newManualTitle}
              onChange={(e) => setNewManualTitle(e.target.value)}
              placeholder="例：90min 甜区团骑"
              className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          <button
            onClick={handleAddManualTss}
            className="apple-touch self-end h-9 px-4 bg-ios-blue/10 hover:bg-ios-blue/15 text-ios-blue dark:text-ios-blue-dark border border-ios-blue/25 rounded-xl text-xs font-semibold active:scale-95 transition shrink-0"
          >
            录入 PMC
          </button>
        </div>

        {manualTssEntries.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.06]">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 self-center">已录入负荷:</span>
            {manualTssEntries.map((entry) => (
              <div
                key={entry.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ios-blue/10 border border-ios-blue/20 text-ios-blue text-xs font-mono"
              >
                <span>{entry.dayOffset === 0 ? '今日' : `${Math.abs(entry.dayOffset)}天前`}: <strong className="tabular-nums">{entry.tss}</strong> TSS ({entry.title})</span>
                <button
                  onClick={() => handleRemoveManualTss(entry.id)}
                  className="apple-touch hover:text-red-500 font-bold ml-1 text-slate-400"
                  title="删除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

FitPmcTab.displayName = 'FitPmcTab';
