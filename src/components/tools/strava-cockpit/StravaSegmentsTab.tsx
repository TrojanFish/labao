import React, { useState, useMemo } from 'react';
import {
  Flag,
  Trophy,
  Mountain,
  Flame,
  ExternalLink,
  Zap
} from 'lucide-react';
import { IOSCard, IOSMetricTile } from '../../common/IOSCard';
import { IOSSegmentedControl } from '../../common/IOSSegmentedControl';
import { StravaSegmentItem } from '../../../services/stravaService';
import { computeSegmentSummaryStats } from '../../../utils/stravaCockpitAnalytics';

interface StravaSegmentsTabProps {
  starredSegments: StravaSegmentItem[];
  weightKg: number;
  language: string;
  isImperial: boolean;
  distUnit: string;
  eleUnit: string;
  onNavigatePacing?: (segment: StravaSegmentItem) => void;
}

export const StravaSegmentsTab: React.FC<StravaSegmentsTabProps> = React.memo(({
  starredSegments,
  weightKg,
  language,
  isImperial,
  distUnit,
  eleUnit,
  onNavigatePacing
}) => {
  const [segmentCategoryFilter, setSegmentCategoryFilter] = useState<'all' | 'hc' | 'cat1-2' | 'cat3-4'>('all');
  const [segmentSortBy, setSegmentSortBy] = useState<'default' | 'distance' | 'gain' | 'grade' | 'kom_gap'>('default');

  const segmentStats = useMemo(() => {
    return computeSegmentSummaryStats(starredSegments);
  }, [starredSegments]);

  const filteredSegments = useMemo(() => {
    let list = [...starredSegments];
    if (segmentCategoryFilter === 'hc') {
      list = list.filter(s => s.climb_category === 5);
    } else if (segmentCategoryFilter === 'cat1-2') {
      list = list.filter(s => s.climb_category === 4 || s.climb_category === 3);
    } else if (segmentCategoryFilter === 'cat3-4') {
      list = list.filter(s => s.climb_category <= 2);
    }

    if (segmentSortBy === 'distance') {
      list.sort((a, b) => b.distance - a.distance);
    } else if (segmentSortBy === 'gain') {
      list.sort((a, b) => b.total_elevation_gain - a.total_elevation_gain);
    } else if (segmentSortBy === 'grade') {
      list.sort((a, b) => b.average_grade - a.average_grade);
    } else if (segmentSortBy === 'kom_gap') {
      list.sort((a, b) => {
        const gapA = (a.athlete_pr_effort?.elapsed_time || 99999) - (a.kom_time || 0);
        const gapB = (b.athlete_pr_effort?.elapsed_time || 99999) - (b.kom_time || 0);
        return gapA - gapB;
      });
    }
    return list;
  }, [starredSegments, segmentCategoryFilter, segmentSortBy]);

  const formatDuration = (totalSec?: number) => {
    if (!totalSec || totalSec <= 0) return '--';
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  const getCategoryBadge = (cat: number) => {
    switch (cat) {
      case 5:
        return {
          label: 'HC 顶级攻坚壁',
          cls: 'bg-slate-900 text-amber-300 border border-amber-400/40 dark:bg-black dark:border-amber-400/50'
        };
      case 4:
        return {
          label: 'Cat 1 极高难度',
          cls: 'bg-ios-purple/10 text-ios-purple border border-ios-purple/20'
        };
      case 3:
        return {
          label: 'Cat 2 高难度坡',
          cls: 'bg-ios-blue/10 text-ios-blue border border-ios-blue/20'
        };
      case 2:
        return {
          label: 'Cat 3 中度爬升',
          cls: 'bg-ios-green/10 text-ios-green border border-ios-green/20'
        };
      default:
        return {
          label: 'Cat 4 丘陵缓坡',
          cls: 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-black/5 dark:border-white/10'
        };
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. Top Segments Summary KPI Grid (4 Tiles) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <IOSMetricTile
          label={language === 'zh-TW' ? '標星賽段' : '标星赛段'}
          value={`${segmentStats.totalSegments}`}
          unit="个"
          subtext={`覆盖 ${isImperial ? (segmentStats.totalDistanceKm * 0.621371).toFixed(1) : segmentStats.totalDistanceKm} ${distUnit} 经典赛线`}
          icon={<Flag className="w-3.5 h-3.5 text-ios-blue" />}
          accentColor="blue"
        />
        <IOSMetricTile
          label={language === 'zh-TW' ? '榮譽勳章' : '荣誉勋章'}
          value={`${segmentStats.komCount > 0 ? `${segmentStats.komCount} 👑 · ` : ''}${segmentStats.prCount}`}
          unit="PR 🥇"
          subtext="个人赛段最佳战绩记录"
          icon={<Trophy className="w-3.5 h-3.5 text-ios-yellow" />}
          accentColor="yellow"
        />
        <IOSMetricTile
          label="攻坚累计爬升"
          value={`${(isImperial ? Math.round(segmentStats.totalGainM * 3.28084) : segmentStats.totalGainM).toLocaleString()}`}
          unit={eleUnit}
          subtext={`平均攀爬坡度 ${segmentStats.avgGradePct}%`}
          icon={<Mountain className="w-3.5 h-3.5 text-ios-green" />}
          accentColor="green"
        />
        <IOSMetricTile
          label={language === 'zh-TW' ? '攻段總次數' : '攻段总次数'}
          value={`${segmentStats.totalAttempts}`}
          unit="次"
          subtext="高负荷推重比实测数据"
          icon={<Flame className="w-3.5 h-3.5 text-ios-orange" />}
          accentColor="orange"
        />
      </div>

      {/* 2. Filter & Sort Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-md border border-black/[0.05] dark:border-white/[0.08] shadow-ios-card">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0 mr-1 hidden sm:inline">
            {language === 'zh-TW' ? '難度分級:' : '难度分级:'}
          </span>
          <IOSSegmentedControl
            value={segmentCategoryFilter}
            onChange={(val) => setSegmentCategoryFilter(val as 'all' | 'hc' | 'cat1-2' | 'cat3-4')}
            options={[
              { value: 'all', label: language === 'zh-TW' ? '全部' : '全部' },
              { value: 'hc', label: 'HC 顶级' },
              { value: 'cat1-2', label: 'Cat 1-2' },
              { value: 'cat3-4', label: 'Cat 3-4' },
            ]}
            size="sm"
            mobileFullWidth={false}
          />
        </div>

        <div className="flex items-center gap-1.5 justify-end">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0 mr-1 hidden sm:inline">
            {language === 'zh-TW' ? '排序方式:' : '排序方式:'}
          </span>
          <IOSSegmentedControl
            value={segmentSortBy}
            onChange={(val) => setSegmentSortBy(val as 'default' | 'distance' | 'gain' | 'grade' | 'kom_gap')}
            options={[
              { value: 'default', label: language === 'zh-TW' ? '推薦' : '推荐' },
              { value: 'distance', label: language === 'zh-TW' ? '距離' : '距离' },
              { value: 'gain', label: language === 'zh-TW' ? '爬升' : '爬升' },
              { value: 'grade', label: language === 'zh-TW' ? '坡度' : '坡度' },
              { value: 'kom_gap', label: 'KOM 差' },
            ]}
            size="sm"
            mobileFullWidth={false}
          />
        </div>
      </div>

      {/* 3. Segment Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {filteredSegments.map((seg) => {
          const badge = getCategoryBadge(seg.climb_category);
          const prEffort = seg.athlete_pr_effort;
          const hasPr = !!prEffort;
          const prTime = prEffort?.elapsed_time || 0;
          const komTime = seg.kom_time || 0;
          const gapSec = hasPr && komTime > 0 ? prTime - komTime : null;
          const isKom = gapSec !== null && gapSec <= 0;
          const prWkg = prEffort?.average_watts && weightKg > 0
            ? (prEffort.average_watts / weightKg).toFixed(2)
            : null;

          return (
            <IOSCard key={seg.id} className="space-y-3.5 flex flex-col justify-between">
              <div className="space-y-3">
                {/* Top Segment Header */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide shrink-0 ${badge.cls}`}>
                        {badge.label}
                      </span>
                      {seg.city && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          {seg.city}, {seg.country}
                        </span>
                      )}
                      {!seg.city && seg.country && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          {seg.country}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug line-clamp-1" title={seg.name}>
                      {seg.name}
                    </h3>
                  </div>

                  <a
                    href={`https://www.strava.com/segments/${seg.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 h-7 px-2.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300 text-xs font-medium flex items-center gap-1 apple-touch transition"
                    title="在 Strava 官网查看路段详情"
                  >
                    <span className="hidden xs:inline">Strava</span>
                    <ExternalLink className="w-3 h-3 text-ios-blue" />
                  </a>
                </div>

                {/* Physical Specs 4-Pill Row */}
                <div className="grid grid-cols-4 gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] text-center">
                  <div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">赛段距离</div>
                    <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                      {isImperial ? `${((seg.distance / 1000) * 0.621371).toFixed(2)} mi` : `${(seg.distance / 1000).toFixed(1)} km`}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">平均坡度</div>
                    <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                      {seg.average_grade}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">累计爬升</div>
                    <div className="text-xs sm:text-sm font-bold text-ios-green tabular-nums">
                      {isImperial ? `${Math.round(seg.total_elevation_gain * 3.28084)} ft` : `${seg.total_elevation_gain} m`}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">最大坡度</div>
                    <div className="text-xs sm:text-sm font-bold text-ios-orange tabular-nums">
                      {seg.maximum_grade}%
                    </div>
                  </div>
                </div>

                {/* PR vs KOM Dual-Column Head-to-Head */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Left: Personal Record */}
                  <div className="p-2.5 rounded-xl bg-ios-blue/5 dark:bg-ios-blue/10 border border-ios-blue/15 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-ios-blue flex items-center gap-1">
                        <span>🥇 {language === 'zh-TW' ? '個人最佳' : '个人最佳'}</span>
                      </span>
                      {seg.athlete_attempts && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          共挑战 {seg.athlete_attempts} 次
                        </span>
                      )}
                    </div>

                    {hasPr ? (
                      <>
                        <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums leading-tight">
                          {formatDuration(prTime)}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                          {prEffort.average_watts && (
                            <div className="flex justify-between">
                              <span>均瓦 / 推重:</span>
                              <strong className="text-slate-800 dark:text-slate-200 font-mono">
                                {prEffort.average_watts}W {prWkg ? `· ${prWkg}W/kg` : ''}
                              </strong>
                            </div>
                          )}
                          {prEffort.vam && (
                            <div className="flex justify-between">
                              <span>垂直爬升率:</span>
                              <strong className="text-ios-green font-mono">{prEffort.vam} m/h</strong>
                            </div>
                          )}
                          {prEffort.average_heartrate && (
                            <div className="flex justify-between">
                              <span>平均心率:</span>
                              <strong className="text-ios-red font-mono">{prEffort.average_heartrate} BPM</strong>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="py-2 text-center text-xs text-slate-400">
                        暂无攻段记录
                      </div>
                    )}
                  </div>

                  {/* Right: KOM Benchmark */}
                  <div className="p-2.5 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <span>👑 {language === 'zh-TW' ? '全網紀錄' : '全网纪录'}</span>
                      </span>
                      {seg.kom_athlete && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[80px]" title={seg.kom_athlete}>
                          {seg.kom_athlete}
                        </span>
                      )}
                    </div>

                    {komTime > 0 ? (
                      <>
                        <div className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono tabular-nums leading-tight">
                          {formatDuration(komTime)}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                          <div className="flex justify-between">
                            <span>距标杆落差:</span>
                            {isKom ? (
                              <strong className="text-ios-green">👑 您是 KOM!</strong>
                            ) : gapSec !== null ? (
                              <strong className="text-ios-orange font-mono">+{formatDuration(gapSec)}</strong>
                            ) : (
                              <span>--</span>
                            )}
                          </div>
                          <div className="flex justify-between">
                            <span>标杆 VAM:</span>
                            <strong className="text-amber-600 dark:text-amber-400 font-mono">
                              {Math.round((seg.total_elevation_gain / komTime) * 3600)} m/h {isImperial ? `(${Math.round((seg.total_elevation_gain / komTime) * 3600 * 3.28084)} ft/h)` : ''}
                            </strong>
                          </div>
                          {gapSec !== null && !isKom && (
                            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
                              <span>时间比率:</span>
                              <span>超标杆 {((gapSec / komTime) * 100).toFixed(1)}%</span>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="py-2 text-center text-xs text-slate-400">
                        未设定标杆
                      </div>
                    )}
                  </div>
                </div>

                {/* Climb Slicing Profile (if available) */}
                {seg.climbSegments && seg.climbSegments.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>长坡分段坡度切片</span>
                      <span className="text-[10px]">
                        {seg.climbSegments.length} 个攻坚阶段
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-lg overflow-hidden flex gap-0.5 bg-slate-200 dark:bg-white/10 p-0.5">
                      {seg.climbSegments.map((cs, idx) => {
                        const pct = Math.max(10, (cs.distanceKm / (seg.distance / 1000)) * 100);
                        let color = 'bg-emerald-500';
                        if (cs.gradePct >= 9.0) color = 'bg-rose-500';
                        else if (cs.gradePct >= 7.5) color = 'bg-ios-orange';
                        else if (cs.gradePct >= 5.0) color = 'bg-ios-blue';

                        return (
                          <div
                            key={idx}
                            style={{ width: `${pct}%` }}
                            className={`h-full rounded-sm ${color} transition-all duration-300 hover:opacity-80`}
                            title={`${cs.name}: ${isImperial ? (cs.distanceKm * 0.621371).toFixed(1) + 'mi' : cs.distanceKm + 'km'} @ ${cs.gradePct}%`}
                          />
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[10px] text-slate-500 dark:text-slate-400 pt-0.5">
                      {seg.climbSegments.slice(0, 4).map((cs, idx) => (
                        <div key={idx} className="truncate">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{cs.gradePct}%</span>
                          <span className="ml-1 truncate">{cs.name.split(':')[0]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Action Bar: Climb Pacing Planner synergy */}
              <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between gap-2">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {isImperial ? `${Math.round(seg.elevation_low * 3.28084)}ft ~ ${Math.round(seg.elevation_high * 3.28084)}ft` : `${seg.elevation_low}m ~ ${seg.elevation_high}m`} 海拔跨度
                </div>
                {onNavigatePacing && (
                  <button
                    type="button"
                    onClick={() => onNavigatePacing(seg)}
                    className="h-8 px-3 rounded-xl bg-ios-blue hover:bg-ios-blue/90 text-white text-xs font-semibold flex items-center gap-1.5 transition apple-touch shadow-ios-sm shrink-0"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>{language === 'zh-TW' ? '配速規劃' : '配速规划'}</span>
                  </button>
                )}
              </div>
            </IOSCard>
          );
        })}
      </div>
    </div>
  );
});

StravaSegmentsTab.displayName = 'StravaSegmentsTab';
