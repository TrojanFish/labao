import React, { useState, useMemo } from 'react';
import {
  Bike,
  Wrench,
  Award,
  Trophy,
  History,
  Route,
  Download,
  Activity,
  MapPin,
  Loader2,
  Link2,
  Disc,
  Sliders,
  Flag,
  Mountain,
  Zap
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { IOSCard, IOSCardHeader } from '../../common/IOSCard';
import { IOSSegmentedControl } from '../../common/IOSSegmentedControl';
import { BikeProfile } from '../../../context/RiderProfileContext';
import { StravaActivityRecord } from '../../../utils/indexedDb';
import {
  computeGearFleet,
  computeEddingtonNumber,
  computeMilestones,
  computePersonalRecordsTimeline
} from '../../../utils/stravaCockpitAnalytics';

interface StravaFleetTabProps {
  fleet: ReturnType<typeof computeGearFleet>;
  userBikes?: BikeProfile[];
  switchBike: (id: string) => void;
  eddington: ReturnType<typeof computeEddingtonNumber>;
  milestones: ReturnType<typeof computeMilestones>;
  prTimeline: ReturnType<typeof computePersonalRecordsTimeline>;
  recentActivities: StravaActivityRecord[];
  language: string;
  isImperial: boolean;
  distUnit: string;
  onNavigateTool?: (tool: string) => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onAnalyzeActivity: (act: StravaActivityRecord) => void;
  onSendToGpx: (act: StravaActivityRecord) => void;
  onExportGpx: (act: StravaActivityRecord) => void;
  loadingActId: number | null;
  loadingActAction: 'analyze' | 'gpx' | 'export' | null;
}

export const StravaFleetTab: React.FC<StravaFleetTabProps> = React.memo(({
  fleet,
  userBikes,
  switchBike,
  eddington,
  milestones,
  prTimeline,
  recentActivities,
  language,
  isImperial,
  distUnit,
  onNavigateTool,
  onExportCsv,
  onExportJson,
  onAnalyzeActivity,
  onSendToGpx,
  onExportGpx,
  loadingActId,
  loadingActAction
}) => {
  const [selectedBikeIdx, setSelectedBikeIdx] = useState<number>(0);
  const [trophyTab, setTrophyTab] = useState<'trophies' | 'prs'>('trophies');

  const activeBike = fleet[selectedBikeIdx] || fleet[0];

  const renderComponentIcon = (key: 'chain' | 'tire' | 'brake') => {
    if (key === 'chain') return <Link2 className="w-3.5 h-3.5 text-ios-blue shrink-0" />;
    if (key === 'tire') return <Disc className="w-3.5 h-3.5 text-ios-green shrink-0" />;
    return <Sliders className="w-3.5 h-3.5 text-ios-orange shrink-0" />;
  };

  const renderMilestoneIcon = (id: string, achieved: boolean) => {
    let Icon = Award;
    let colorClass = achieved ? 'text-ios-blue' : 'text-slate-400';
    if (id === 'century') {
      Icon = Flag;
      colorClass = achieved ? 'text-ios-green' : 'text-slate-400';
    } else if (id === 'double_century') {
      Icon = Trophy;
      colorClass = achieved ? 'text-ios-yellow' : 'text-slate-400';
    } else if (id === 'climb_1000') {
      Icon = Mountain;
      colorClass = achieved ? 'text-ios-orange' : 'text-slate-400';
    } else if (id === 'power_300') {
      Icon = Zap;
      colorClass = achieved ? 'text-ios-purple' : 'text-slate-400';
    }
    return (
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2.5 transition-all ${achieved ? 'bg-ios-blue/10' : 'bg-slate-100 dark:bg-white/5'}`}>
        <Icon className={`w-4 h-4 ${colorClass}`} />
      </div>
    );
  };

  // Eddington Histogram Chart Data
  const eddingtonChartData = useMemo(() => {
    const labels = eddington.histogramData.map(h => `${h.distanceKm}k`);
    const counts = eddington.histogramData.map(h => h.cumulativeCount);
    const thresholds = eddington.histogramData.map(h => h.distanceKm);

    return {
      labels,
      datasets: [
        {
          type: 'bar' as const,
          label: '达标场次',
          data: counts,
          backgroundColor: eddington.histogramData.map(h => h.isAboveThreshold ? '#007AFF' : '#AEAEB2'),
          borderRadius: 4
        },
        {
          type: 'line' as const,
          label: 'y=x 达标线',
          data: thresholds,
          borderColor: '#FF9500',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }
      ]
    };
  }, [eddington]);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. Fleet Management & Component Health */}
      <IOSCard className="space-y-3.5">
        <IOSCardHeader
          title={language === 'zh-TW' ? '戰車機隊與損耗' : '战车机队与损耗'}
          subtitle="各车出勤里程统计 · 链条/外胎/刹车健康度寿命预警"
          icon={Bike}
          iconColor="text-ios-blue bg-ios-blue/10"
        />

        {/* Bike Selector Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {fleet.map((b, idx) => (
            <button
              key={b.id}
              onClick={() => setSelectedBikeIdx(idx)}
              className={`h-8 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition apple-touch shrink-0 flex items-center gap-1.5 ${
                selectedBikeIdx === idx
                  ? 'bg-ios-blue text-white shadow-ios-sm ring-1.5 ring-ios-blue/35'
                  : 'bg-slate-100/90 hover:bg-slate-200/80 dark:bg-white/10 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Bike className="w-3.5 h-3.5 shrink-0" />
              <span>{b.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {activeBike && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-ios-blue/10 flex items-center justify-center text-ios-blue">
                  <Bike className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">{activeBike.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    最后出勤: {activeBike.lastRideDate} · 共出勤 {activeBike.totalRides} 场
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                  {isImperial ? `${Math.round(activeBike.totalDistanceKm * 0.621371).toLocaleString()} mi` : `${activeBike.totalDistanceKm.toLocaleString()} km`}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">占全队总里程 {activeBike.distancePct}%</div>
              </div>
            </div>

            {/* Components Wear Bars */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {activeBike.components.map((comp) => (
                <div
                  key={comp.name}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                      {renderComponentIcon(comp.componentKey)}
                      <span>{comp.name}</span>
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                        comp.status === 'critical'
                          ? 'bg-ios-red/10 text-ios-red'
                          : comp.status === 'warn'
                          ? 'bg-ios-orange/10 text-ios-orange'
                          : 'bg-ios-green/10 text-ios-green'
                      }`}
                    >
                      {comp.status === 'critical' ? '超期预警' : comp.status === 'warn' ? '接近保养' : '健康'}
                    </span>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        comp.status === 'critical' ? 'bg-ios-red' : comp.status === 'warn' ? 'bg-ios-orange' : 'bg-ios-green'
                      }`}
                      style={{ width: `${Math.min(100, (comp.currentKm / comp.criticalKm) * 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>已骑 {isImperial ? Math.round(comp.currentKm * 0.621371) : comp.currentKm} {distUnit}</span>
                    <span>上限 {isImperial ? Math.round(comp.criticalKm * 0.621371) : comp.criticalKm} {distUnit}</span>
                  </div>
                </div>
              ))}
            </div>

            {onNavigateTool && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const matched = userBikes?.find(gb => gb.id === activeBike.id || gb.stravaGearId === activeBike.id || gb.name === activeBike.name);
                    if (matched) {
                      switchBike(matched.id);
                    }
                    onNavigateTool('garage');
                  }}
                  className="h-8 px-3 rounded-xl text-xs font-medium text-ios-blue hover:bg-ios-blue/10 border border-ios-blue/20 transition-colors flex items-center gap-1.5 apple-touch"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>{language === 'zh-TW' ? '在虛擬車庫中檢視 / 配置配件' : '在虚拟车库中查看 / 配置配件'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </IOSCard>

      {/* 2. Two Columns: Eddington Number Hero + Milestones & PR Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Left 5 cols: Eddington Number Hero */}
        <IOSCard className="lg:col-span-5 space-y-3.5">
          <IOSCardHeader
            title={language === 'zh-TW' ? '愛丁頓數' : '爱丁顿数'}
            subtitle="全球严肃骑行者耐力终极勋章"
            icon={Award}
            iconColor="text-ios-blue bg-ios-blue/10"
          />

          {/* Hero E readout */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-ios-blue/10 via-transparent to-ios-purple/10 border border-ios-blue/20 text-center space-y-1">
            <div className="text-xs font-semibold text-ios-blue tracking-wide uppercase">当前耐力爱丁顿数</div>
            <div className="text-5xl sm:text-6xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight">
              E = {eddington.E}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              代表车手一生中至少有 <strong className="text-ios-blue">{eddington.E}</strong> 天，单日骑行突破了 <strong className="text-ios-blue">{eddington.E} km{isImperial ? ` (${(eddington.E * 0.621371).toFixed(0)} mi)` : ''}</strong>。
            </p>
          </div>

          {/* Next E+1 Target Countdown */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                冲级至 <strong className="text-ios-blue">E = {eddington.nextE}</strong>
              </span>
              <span className="text-slate-500 dark:text-slate-400 font-mono">
                差 <strong>{eddington.ridesNeededForNextE}</strong> 场 ≥ {eddington.nextE}km{isImperial ? ` (${(eddington.nextE * 0.621371).toFixed(0)}mi)` : ''} 骑行
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
              <div
                className="h-full bg-ios-blue rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (eddington.qualifyingRidesForNext / Math.max(1, eddington.nextE)) * 100)}%` }}
              />
            </div>
          </div>

          {/* Eddington Histogram */}
          <div className="h-44 w-full">
            <Bar
              data={eddingtonChartData as any}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: { backgroundColor: 'rgba(28, 28, 30, 0.95)' }
                },
                scales: {
                  x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 10 } },
                  y: { grid: { color: 'rgba(120, 120, 128, 0.12)' }, ticks: { font: { size: 9 } } }
                }
              }}
            />
          </div>
        </IOSCard>

        {/* Right 7 cols: Milestones & PR Progression Timeline */}
        <IOSCard className="lg:col-span-7 space-y-3.5">
          <IOSCardHeader
            title={
              trophyTab === 'trophies'
                ? (language === 'zh-TW' ? '榮譽里程碑' : '荣誉里程碑')
                : (language === 'zh-TW' ? 'PR 突破史' : 'PR 突破史')
            }
            subtitle={trophyTab === 'trophies' ? '破百勋章 · 珠峰攀登 · 生涯最高战力记录' : '里程、爬升、加权功率与极速历史跃升记录'}
            icon={trophyTab === 'trophies' ? Trophy : History}
            iconColor="text-ios-yellow bg-ios-yellow/10"
            action={
              <IOSSegmentedControl
                value={trophyTab}
                onChange={(v) => setTrophyTab(v as 'trophies' | 'prs')}
                options={[
                  { value: 'trophies', label: language === 'zh-TW' ? '勳章殿堂' : '勋章殿堂' },
                  { value: 'prs', label: language === 'zh-TW' ? 'PR 突破史' : 'PR 突破史' }
                ]}
                size="sm"
                mobileFullWidth={false}
                className="shrink-0"
              />
            }
          />

          {trophyTab === 'trophies' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {milestones.map((m) => (
                <div
                  key={m.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    m.achieved
                      ? 'bg-white dark:bg-[#2C2C2E] border-black/[0.06] dark:border-white/10 shadow-2xs'
                      : 'bg-slate-50/60 dark:bg-white/[0.02] border-dashed border-black/[0.08] dark:border-white/[0.08] opacity-60'
                  }`}
                >
                  {renderMilestoneIcon(m.id, m.achieved)}
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{m.title}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{m.subtitle}</div>
                  {m.count !== undefined && (
                    <div className="mt-2 text-xs font-bold text-ios-blue tabular-nums">达成 {m.count} 次</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {prTimeline.length > 0 ? (
                prTimeline.slice(0, 8).map((pr) => (
                  <div
                    key={pr.id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 dark:text-white truncate">{pr.label}</span>
                        {pr.improvementPct !== undefined && pr.improvementPct > 0 && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-ios-green/10 text-ios-green">
                            +{pr.improvementPct}%
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {pr.date} · {pr.activityName}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-ios-blue tabular-nums">{pr.formattedValue}</div>
                      {pr.previousValue !== undefined && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">前纪录: {pr.previousValue}</div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">暂无检测到突破纪录</div>
              )}
            </div>
          )}
        </IOSCard>
      </div>

      {/* 3. Recent Activities List with Export Actions */}
      <IOSCard className="space-y-3.5">
        <IOSCardHeader
          title={language === 'zh-TW' ? '近期活動流' : '近期活动流'}
          subtitle="点击「深度解析」可直接联动 FitActivityAnalyzer 逐秒回放"
          icon={Route}
          iconColor="text-ios-blue bg-ios-blue/10"
          action={
            <div className="flex items-center gap-1.5">
              <button
                onClick={onExportCsv}
                className="h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-medium apple-touch transition flex items-center gap-1"
                title="导出全部筛选活动为 CSV 格式表格"
              >
                <Download className="w-3.5 h-3.5 text-ios-blue" />
                <span>{language === 'zh-TW' ? '導出 CSV' : '导出 CSV'}</span>
              </button>
              <button
                onClick={onExportJson}
                className="h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-medium apple-touch transition flex items-center gap-1"
                title="导出全部筛选活动为原始 JSON 格式"
              >
                <Download className="w-3.5 h-3.5 text-ios-purple" />
                <span>{language === 'zh-TW' ? '導出 JSON' : '导出 JSON'}</span>
              </button>
            </div>
          }
        />

        <div className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
          {recentActivities.map((act) => {
            const distKm = parseFloat(((act.distance || 0) / 1000).toFixed(1));
            const eleM = Math.round(act.total_elevation_gain || 0);
            const hrs = Math.floor((act.moving_time || 0) / 3600);
            const mins = Math.round(((act.moving_time || 0) % 3600) / 60);

            return (
              <div
                key={act.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-black/[0.01] dark:hover:bg-white/[0.02] -mx-2 px-2 rounded-xl transition"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{act.name}</span>
                    {act.gear_id && (
                      <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                        {act.sport_type || 'Ride'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2.5 tabular-nums">
                    <span>{act.start_date.split('T')[0]}</span>
                    <span>·</span>
                    <span>{isImperial ? `${(distKm * 0.621371).toFixed(1)} mi` : `${distKm} km`}</span>
                    <span>·</span>
                    <span>+{isImperial ? `${Math.round(eleM * 3.28084)} ft` : `${eleM} m`}</span>
                    <span>·</span>
                    <span>{hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`}</span>
                    {act.weighted_average_watts && (
                      <>
                        <span>·</span>
                        <span className="text-ios-blue font-medium">{act.weighted_average_watts}W NP</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                  {onNavigateTool && (
                    <button
                      type="button"
                      onClick={() => onAnalyzeActivity(act)}
                      disabled={loadingActId === act.id}
                      className="h-8 px-2.5 sm:px-3 rounded-lg bg-ios-blue/10 hover:bg-ios-blue/20 text-ios-blue text-xs font-semibold apple-touch transition flex items-center gap-1 disabled:opacity-50"
                      title={language === 'zh-TW' ? '從本地調取該次騎行秒級數據並轉入深度分析' : '从本地调取该次骑行秒级数据并转入深度分析'}
                    >
                      {loadingActId === act.id && loadingActAction === 'analyze' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Activity className="w-3.5 h-3.5" />
                      )}
                      <span>{language === 'zh-TW' ? '深度分析' : '深度分析'}</span>
                    </button>
                  )}

                  {onNavigateTool && (
                    <button
                      type="button"
                      onClick={() => onSendToGpx(act)}
                      disabled={loadingActId === act.id}
                      className="h-8 px-2.5 sm:px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold apple-touch transition flex items-center gap-1 disabled:opacity-50"
                      title={language === 'zh-TW' ? '將該次騎行 GPS 軌跡載入 GPX 路線工坊' : '将该次骑行 GPS 轨迹载入 GPX 路线工坊'}
                    >
                      {loadingActId === act.id && loadingActAction === 'gpx' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5" />
                      )}
                      <span className="hidden sm:inline">GPX </span>
                      <span>{language === 'zh-TW' ? '工坊' : '工坊'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onExportGpx(act)}
                    disabled={loadingActId === act.id}
                    className="h-8 px-2 sm:px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 text-xs font-medium apple-touch transition flex items-center gap-1 disabled:opacity-50"
                    title={language === 'zh-TW' ? '匯出為標準 GPX 航跡檔' : '导出为标准 GPX 航迹文件'}
                  >
                    {loadingActId === act.id && loadingActAction === 'export' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">{language === 'zh-TW' ? '匯出' : '导出'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </IOSCard>
    </div>
  );
});

StravaFleetTab.displayName = 'StravaFleetTab';
