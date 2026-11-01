import React from 'react';
import {
  Award,
  Battery,
  Dumbbell,
  Info,
  Sparkles
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { IOSSegmentedControl } from '../../common/IOSSegmentedControl';
import { NumberStepper } from '../../common/NumberStepper';
import { ActivityAnalysis, WPrimeBalanceResult } from '../../../utils/activityParser';
import { LocalActivityRecord } from '../../../utils/localActivityDb';
import { detectActivityPrs } from '../../../utils/mmpAggregator';
import type { ChartData } from 'chart.js';

interface FitMmpTabProps {
  analysis: ActivityAnalysis;
  localActivities: LocalActivityRecord[];
  language: string;
  mmpUnit: 'wkg' | 'watts';
  setMmpUnit: (u: 'wkg' | 'watts') => void;
  mmpSubView: 'mmp_curve' | 'w_balance';
  setMmpSubView: (v: 'mmp_curve' | 'w_balance') => void;
  selectedCogganTier: string;
  setSelectedCogganTier: (tier: string) => void;
  mmpShowCurrent: boolean;
  setMmpShowCurrent: (v: boolean) => void;
  mmpShow90d: boolean;
  setMmpShow90d: (v: boolean) => void;
  mmpShowAllTime: boolean;
  setMmpShowAllTime: (v: boolean) => void;
  currentActivityPrs: ReturnType<typeof detectActivityPrs> | null;
  riderPhenotype: { type: string; title: string; badgeColor: string; description: string; trainingFocus: string } | null;
  mmpChartData: ChartData<'line'>;
  wPrimeResult: WPrimeBalanceResult | null;
  wPrimeChartData: ChartData<'line'>;
  cpWatts: number;
  setCpWatts: (w: number) => void;
  wPrimeKj: number;
  setWPrimeKj: (kj: number) => void;
  formatDuration: (sec: number) => string;
  onNavigateTool?: (toolId: string) => void;
  onOpenSmartWorkoutModal?: () => void;
}

export const FitMmpTab: React.FC<FitMmpTabProps> = React.memo(({
  analysis,
  localActivities,
  language,
  mmpUnit,
  setMmpUnit,
  mmpSubView,
  setMmpSubView,
  selectedCogganTier,
  setSelectedCogganTier,
  mmpShowCurrent,
  setMmpShowCurrent,
  mmpShow90d,
  setMmpShow90d,
  mmpShowAllTime,
  setMmpShowAllTime,
  currentActivityPrs,
  riderPhenotype,
  mmpChartData,
  wPrimeResult,
  wPrimeChartData,
  cpWatts,
  setCpWatts,
  wPrimeKj,
  setWPrimeKj,
  formatDuration,
  onNavigateTool,
  onOpenSmartWorkoutModal
}) => {
  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Sub-view switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="w-full sm:max-w-xs">
          <IOSSegmentedControl
            options={[
              {
                value: 'mmp_curve',
                label: (
                  <>
                    <span className="sm:hidden">{language === 'zh-TW' ? 'MMP 天梯' : 'MMP 天梯'}</span>
                    <span className="hidden sm:inline">{language === 'zh-TW' ? 'MMP 峰值與天梯' : 'MMP 峰值与天梯'}</span>
                  </>
                )
              },
              {
                value: 'w_balance',
                label: (
                  <>
                    <span className="sm:hidden">W' 耗竭</span>
                    <span className="hidden sm:inline">{language === 'zh-TW' ? "W' Balance 耗竭模型" : "W' Balance 耗竭模型"}</span>
                  </>
                )
              }
            ]}
            value={mmpSubView}
            onChange={(v) => setMmpSubView(v as 'mmp_curve' | 'w_balance')}
          />
        </div>

        {mmpSubView === 'mmp_curve' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Multi-Layer Envelope Toggles */}
            {localActivities.length > 0 && (
              <div className="flex items-center bg-slate-100 dark:bg-white/10 p-0.5 rounded-xl border border-slate-200/80 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setMmpShowCurrent(!mmpShowCurrent)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition apple-touch ${
                    mmpShowCurrent ? 'bg-white dark:bg-[#2C2C2E] text-ios-purple shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  本次
                </button>
                <button
                  type="button"
                  onClick={() => setMmpShow90d(!mmpShow90d)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition apple-touch ${
                    mmpShow90d ? 'bg-white dark:bg-[#2C2C2E] text-ios-orange shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="sm:hidden">90天</span>
                  <span className="hidden sm:inline">90天包络</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMmpShowAllTime(!mmpShowAllTime)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition apple-touch ${
                    mmpShowAllTime ? 'bg-white dark:bg-[#2C2C2E] text-ios-red shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="sm:hidden">最佳</span>
                  <span className="hidden sm:inline">历史最佳</span>
                </button>
              </div>
            )}

            {/* Unit Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-white/10 p-0.5 rounded-xl border border-slate-200/80 dark:border-white/10">
              <button
                type="button"
                onClick={() => setMmpUnit('wkg')}
                className={`px-2.5 py-1 rounded-lg font-medium transition apple-touch ${
                  mmpUnit === 'wkg' ? 'bg-white dark:bg-[#2C2C2E] text-ios-purple shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="sm:hidden">W/kg</span>
                <span className="hidden sm:inline">推重比</span>
              </button>
              <button
                type="button"
                onClick={() => setMmpUnit('watts')}
                className={`px-2.5 py-1 rounded-lg font-medium transition apple-touch ${
                  mmpUnit === 'watts' ? 'bg-white dark:bg-[#2C2C2E] text-ios-purple shadow-2xs font-bold' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="sm:hidden">瓦特</span>
                <span className="hidden sm:inline">绝对功率</span>
              </button>
            </div>

            {/* Coggan Benchmark Tier Selector */}
            <select
              value={selectedCogganTier}
              onChange={(e) => setSelectedCogganTier(e.target.value)}
              className="h-9 bg-white dark:bg-[#1C1C1E] border border-slate-200 dark:border-white/10 rounded-xl px-3 text-xs text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:border-ios-purple"
            >
              <option value="all">能力分级全天梯标尺</option>
              <option value="world_tour">世巡职业级</option>
              <option value="cat1">国家精英级</option>
              <option value="cat2">省级健将级</option>
              <option value="cat3">俱乐部高阶</option>
              <option value="cat4">进阶骑手</option>
              <option value="cat5">业余入门</option>
              <option value="none">隐藏天梯对比线</option>
            </select>
          </div>
        )}
      </div>

      {/* VIEW 1: Continuous MMP Curve & Coggan Benchmarks */}
      {mmpSubView === 'mmp_curve' && (
        <div className="space-y-4 sm:space-y-5">
          {/* PR Celebration Banner */}
          {currentActivityPrs && (currentActivityPrs.total90dPrs > 0 || currentActivityPrs.totalAllTimePrs > 0) && (
            <div className="p-3 sm:p-3.5 rounded-2xl bg-ios-orange/10 border border-ios-orange/30 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-ios-orange text-white flex items-center justify-center shrink-0 shadow-xs font-bold">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    本次骑行共刷新 {currentActivityPrs.totalAllTimePrs + currentActivityPrs.total90dPrs} 项个人功率峰值记录！
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-mono">
                    包含 {currentActivityPrs.totalAllTimePrs} 项历史全时域新纪录 🏆 与 {currentActivityPrs.total90dPrs} 项近90天巅峰新高 👑
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Rider Phenotype Card */}
          {riderPhenotype && (
            <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                      {language === 'zh-TW' ? '車手表型畫像診斷' : '车手表型画像诊断'}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${riderPhenotype.badgeColor}`}>
                      {riderPhenotype.title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                    {riderPhenotype.description}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    训练建议：{riderPhenotype.trainingFocus}
                  </p>
                </div>

                {onNavigateTool && (
                  <div className="flex items-center gap-2 shrink-0">
                    {onOpenSmartWorkoutModal && (
                      <button
                        type="button"
                        onClick={onOpenSmartWorkoutModal}
                        className="apple-touch h-9 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-xl bg-ios-red hover:bg-ios-red/90 text-white text-xs font-bold transition shadow-ios-sm active:scale-95"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>智能生成靶向补强课表</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onNavigateTool('workout-builder')}
                      className="apple-touch h-9 w-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300 text-xs font-semibold transition flex items-center justify-center"
                      title="直接打开训练工坊"
                    >
                      <Dumbbell className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MMP Chart */}
          <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {language === 'zh-TW' ? 'MMP 功率曲線' : 'MMP 功率曲线'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {'车手在各个标准时段内所维持的最高平均输出（瓦特与推重比对比 Coggan 世界标准）'}
                </p>
              </div>
            </div>

            <div className="h-72 sm:h-84">
              <Line
                data={mmpChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: true,
                      position: 'top' as const,
                      labels: { font: { size: 10 }, boxWidth: 12, color: '#94a3b8' }
                    }
                  },
                  scales: {
                    x: { ticks: { font: { size: 10 }, color: '#AEAEB2' } },
                    y: {
                      ticks: { font: { size: 10 }, color: '#8E8E93' },
                      title: {
                        display: true,
                        text: mmpUnit === 'wkg' ? 'W/kg' : 'W',
                        color: '#AF52DE',
                        font: { size: 11 }
                      }
                    }
                  }
                }}
              />
            </div>

            {/* MMP Grid Table */}
            <div className="pt-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                {language === 'zh-TW' ? 'MMP 階梯數據表' : 'MMP 阶梯数据表'}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {analysis.mmp.map((m) => {
                  const pr = currentActivityPrs?.prs.find(p => p.durationSec === m.durationSec);
                  return (
                    <div key={m.label} className="p-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 text-center space-y-0.5 relative overflow-hidden">
                      {pr?.isAllTimePr ? (
                        <span className="absolute top-1 right-1 px-1 py-0.2 rounded text-[9px] font-bold bg-ios-red text-white uppercase">
                          PR
                        </span>
                      ) : pr?.is90dPr ? (
                        <span className="absolute top-1 right-1 px-1 py-0.2 rounded text-[9px] font-bold bg-ios-orange text-white uppercase">
                          90d
                        </span>
                      ) : null}
                      <div className="text-[11px] font-bold text-ios-purple uppercase">{m.label}</div>
                      <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">{m.watts} W</div>
                      <div className="text-[11px] text-slate-500 tabular-nums">{m.wkg} W/kg</div>
                      {pr && (pr.isAllTimePr || pr.is90dPr) && pr.wattsGain > 0 && (
                        <div className="text-[10px] text-ios-green font-bold tabular-nums">
                          +{pr.wattsGain}W
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: Skiba W' Balance Anaerobic Battery Exhaustion Model */}
      {mmpSubView === 'w_balance' && wPrimeResult && (
        <div className="space-y-4 sm:space-y-5">
          {/* Parameter Tuning Bar */}
          <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Battery className="w-4 h-4 text-ios-green" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {language === 'zh-TW' ? "W' Balance 無氧電量" : "W' Balance 无氧电量"}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  模拟无氧电池在临界功率以上踩踏时的放电耗竭与低于临界功率时的动态指数重充
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">临界功率 CP:</span>
                  <NumberStepper
                    value={cpWatts}
                    onChange={setCpWatts}
                    min={100}
                    max={500}
                    step={5}
                    unit="W"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">无氧容量 W' max:</span>
                  <NumberStepper
                    value={wPrimeKj}
                    onChange={setWPrimeKj}
                    min={5}
                    max={40}
                    step={1}
                    unit="kJ"
                  />
                </div>
              </div>
            </div>

            {/* Metric Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 space-y-1">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">最低剩余无氧电量</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white flex items-baseline gap-1.5 tabular-nums">
                  <span>{wPrimeResult.minWPrimePercent}%</span>
                  <span className="text-xs font-normal text-slate-500">({(wPrimeResult.minWPrimeJoules / 1000).toFixed(1)} kJ)</span>
                </div>
                <div className="text-[11px]">
                  {wPrimeResult.minWPrimePercent <= 10 ? (
                    <span className="text-ios-red font-bold">⚠️ 濒临爆缸临界</span>
                  ) : wPrimeResult.minWPrimePercent <= 30 ? (
                    <span className="text-ios-orange font-bold">⚡ 深度无氧亏损</span>
                  ) : (
                    <span className="text-ios-green font-bold">✓ 电量充裕安全</span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 space-y-1">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">电量最低点时刻</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatDuration(wPrimeResult.minPointSec)}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">本次骑行最艰苦攻坚点</div>
              </div>

              <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 space-y-1">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">深红放电次数 (&lt;30%)</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                  {wPrimeResult.matchesBurned} <span className="text-xs font-normal text-slate-500">次火柴</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">燃烧极限火柴次数</div>
              </div>

              <div className="p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 space-y-1">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">超阈值做功 (Work &gt; CP)</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                  {wPrimeResult.workAboveCpKj} <span className="text-xs font-normal text-slate-500">kJ</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  历时 <span className="tabular-nums">{formatDuration(wPrimeResult.timeAboveCpSec)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* W' Balance Dynamic Time-Series Chart */}
          <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-850 dark:text-white">
                {"W' Balance 实时电量耗竭波形与踩踏功率对照"}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                CP 临界基准: {cpWatts} W · W' max: {wPrimeKj} kJ
              </span>
            </div>

            <div className="h-72 sm:h-84">
              <Line
                data={wPrimeChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { mode: 'index', intersect: false },
                  plugins: {
                    legend: {
                      display: true,
                      position: 'top' as const,
                      labels: { font: { size: 10 }, boxWidth: 12, color: '#94a3b8' }
                    }
                  },
                  scales: {
                    x: { ticks: { font: { size: 10 }, color: '#94a3b8' } },
                    yWBal: {
                      type: 'linear' as const,
                      position: 'left' as const,
                      min: 0,
                      max: 100,
                      ticks: { font: { size: 10 }, color: '#10b981', callback: (v) => `${v}%` },
                      title: { display: true, text: "W' 剩余百分比 (%)", color: '#10b981', font: { size: 10 } }
                    },
                    yPower: {
                      type: 'linear' as const,
                      position: 'right' as const,
                      grid: { display: false },
                      ticks: { font: { size: 10 }, color: '#3b82f6', callback: (v) => `${v}W` },
                      title: { display: true, text: '功率 (W)', color: '#3b82f6', font: { size: 10 } }
                    }
                  }
                }}
              />
            </div>

            {/* Scientific Explanation Banner */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-ios-blue shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-slate-600 dark:text-slate-300 leading-relaxed">
                  <p>
                    <strong>科学原理</strong>：当输出功率高于临界功率时，身体主要依靠无氧糖酵解供能，迅速消耗 W' 储备；当功率降回临界功率以下时，机体利用有氧代谢乳酸穿梭逐步重充电量。若 W' 降至 0%，将引发急性力竭。
                  </p>
                </div>
              </div>

              {onNavigateTool && (
                <button
                  type="button"
                  onClick={() => onNavigateTool('workout-builder')}
                  className="apple-touch self-start sm:self-auto shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ios-blue/10 hover:bg-ios-blue/20 text-ios-blue font-bold text-xs border border-ios-blue/20 transition shadow-2xs"
                >
                  <Dumbbell className="w-3.5 h-3.5" />
                  <span>去课表工坊强化无氧池</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

FitMmpTab.displayName = 'FitMmpTab';
