import React, { useState, useMemo, useEffect } from 'react';
import {
  LayoutDashboard,
  RefreshCw,
  Route,
  Mountain,
  Clock,
  Flame,
  Calendar,
  Zap,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Bike,
  Activity,
  TrendingUp,
  Award,
  Trophy,
  Link2,
  Disc,
  Sliders,
  Sun,
  Target,
  BarChart2,
  Flag,
  Download,
  History,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Loader2
} from 'lucide-react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

import { IOSCard, IOSCardHeader, IOSMetricTile } from '../common/IOSCard';
import { IOSToolHeader } from '../common/IOSToolHeader';
import { IOSSegmentedControl } from '../common/IOSSegmentedControl';
import { ShareCardModal } from '../common/ShareCardModal';
import { PoweredByStravaBadge } from '../common/PoweredByStravaBadge';
import { useStrava } from '../../context/StravaContext';
import { useRiderProfile } from '../../context/RiderProfileContext';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';
import { useToast } from '../../context/ToastContext';
import { StravaActivityRecord } from '../../utils/indexedDb';
import { setPendingTransfer } from '../../hooks/useToolDraftState';
import { saveActivityToDb } from '../../utils/localActivityDb';
import {
  convertStravaToLocalRecord,
  stravaStreamsToWaypoints,
  exportStravaActivityToGpxXml
} from '../../utils/stravaStreamAdapter';
import {
  TimePeriod,
  filterByPeriod,
  computeKpiMetrics,
  computePmcTimeline,
  diagnoseAthleteStatus,
  findOptimalRaceWindow,
  computeWeeklyVolume,
  computeAnnualGoalProgress,
  computeAnnualElevationGoalProgress,
  computeEddingtonNumber,
  buildHeatmapGrid,
  computeActivityRings,
  computeBioclock,
  estimateEFTP,
  computeGearFleet,
  computeMilestones,
  generateDemoStravaActivities,
  computePowerZoneDistribution,
  computeRampRateHistory,
  computeFtpHistory,
  computePersonalRecordsTimeline,
  computeAerobicEfficiency,
  exportActivitiesToCsv,
  exportActivitiesToJson,
  computeSegmentSummaryStats
} from '../../utils/stravaCockpitAnalytics';
import { CURATED_STRAVA_SEGMENTS, StravaSegmentItem } from '../../services/stravaService';
import { generateStravaCockpitPoster } from '../../utils/shareCardGenerators';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface StravaDataCockpitProps {
  onNavigateTool?: (toolId: string) => void;
}

type CockpitTab = 'overview' | 'fitness' | 'segments' | 'fleet';

export const StravaDataCockpit: React.FC<StravaDataCockpitProps> = ({ onNavigateTool }) => {
  const { isConnected, athlete, activities: realActivities, isSyncing, syncActivities, getStarredSegments, syncProgress, getActivityStreams } = useStrava();
  const { profile, bikes: userBikes } = useRiderProfile();
  const { language, unitSystem, convertDistance, convertElevation, convertSpeed } = useLanguageAndUnit();
  const isImperial = unitSystem === 'imperial';
  const distUnit = isImperial ? 'mi' : 'km';
  const eleUnit = isImperial ? 'ft' : 'm';
  const speedUnit = isImperial ? 'mph' : 'km/h';
  const { showToast } = useToast();

  const [loadingActId, setLoadingActId] = useState<number | null>(null);
  const [loadingActAction, setLoadingActAction] = useState<'analyze' | 'gpx' | 'export' | null>(null);

  // Tab State: Overview vs Fitness vs Fleet
  const [activeTab, setActiveTab] = useState<CockpitTab>('overview');

  // Mode: Use Demo Data vs Live Data
  const [useDemoMode, setUseDemoMode] = useState<boolean>(() => {
    return !isConnected || realActivities.length === 0;
  });

  // Selected Time Period for Global Overview
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('all-time');

  // MMP Curve Unit: Watts vs W/kg
  const [mmpUnit, setMmpUnit] = useState<'watts' | 'wkg'>('watts');

  // Bioclock sub-tab: 'time' vs 'day'
  const [bioclockTab, setBioclockTab] = useState<'time' | 'day'>('time');

  // Selected Bike Index for fleet view
  const [selectedBikeIdx, setSelectedBikeIdx] = useState<number>(0);

  // Activity Ring Targets
  const [ringTargets] = useState({ distanceKm: 150, elevationM: 1500, tss: 350 });

  // PMC Forward 14-day Projection Toggle
  const [showPmcProjection, setShowPmcProjection] = useState<boolean>(true);

  // Weekly Volume Span: 52 weeks or 26 weeks
  const [volumeWeeksSpan, setVolumeWeeksSpan] = useState<26 | 52>(52);

  // Weekly Volume Card Sub-view: 'volume' vs 'ramp'
  const [volumeSubView, setVolumeSubView] = useState<'volume' | 'ramp'>('volume');

  // Annual Goal Card Metric Mode: 'distance' vs 'elevation'
  const [annualGoalMetric, setAnnualGoalMetric] = useState<'distance' | 'elevation'>('distance');

  // Power Zone Period filter
  const [powerZonePeriod, setPowerZonePeriod] = useState<TimePeriod>('all-time');

  // Trophy Cabinet Sub-view: 'trophies' vs 'prs'
  const [trophyTab, setTrophyTab] = useState<'trophies' | 'prs'>('trophies');

  // Share Poster Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [sharePosterUrl, setSharePosterUrl] = useState<string | null>(null);

  // Segments State & Filters (Tab 3)
  const [starredSegments, setStarredSegments] = useState<StravaSegmentItem[]>(CURATED_STRAVA_SEGMENTS);
  const [segmentCategoryFilter, setSegmentCategoryFilter] = useState<'all' | 'hc' | 'cat1-2' | 'cat3-4'>('all');
  const [segmentSortBy, setSegmentSortBy] = useState<'default' | 'distance' | 'gain' | 'grade' | 'kom_gap'>('default');

  useEffect(() => {
    let isMounted = true;
    if (isConnected && getStarredSegments) {
      getStarredSegments()
        .then((segs) => {
          if (isMounted && segs && segs.length > 0) {
            setStarredSegments(segs);
          }
        })
        .catch(() => {
          if (isMounted) setStarredSegments(CURATED_STRAVA_SEGMENTS);
        });
    } else {
      setStarredSegments(CURATED_STRAVA_SEGMENTS);
    }
    return () => {
      isMounted = false;
    };
  }, [isConnected, getStarredSegments]);

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

  const handleNavigatePacing = (segment: StravaSegmentItem) => {
    if (onNavigateTool) {
      showToast(`已选定路段「${segment.name}」，正在前往爬坡配速规划师...`, 'success');
      onNavigateTool('climb-pacing-planner');
    }
  };

  const handleAnalyzeStravaActivity = async (act: StravaActivityRecord) => {
    setLoadingActId(act.id);
    setLoadingActAction('analyze');
    try {
      showToast(language === 'zh-TW' ? `正在從本地調取「${act.name}」秒級數據...` : `正在从本地调取「${act.name}」秒级数据...`, 'info');
      const stream = await getActivityStreams(act.id);
      const ftp = profile.ftpWatts || 220;
      const weight = profile.weightKg || 68;
      const maxHr = profile.maxHr || 185;

      const { record, points } = convertStravaToLocalRecord(act, stream, ftp, weight, maxHr);
      await saveActivityToDb(record, points);

      setPendingTransfer('solorider_pending_activity_analysis', {
        activityId: record.id,
        name: act.name,
      });

      if (onNavigateTool) {
        onNavigateTool('activity-analyzer');
      }
    } catch (err: any) {
      showToast(`载入深度分析失败: ${err.message || '未知错误'}`, 'error');
    } finally {
      setLoadingActId(null);
      setLoadingActAction(null);
    }
  };

  const handleSendStravaToGpx = async (act: StravaActivityRecord) => {
    setLoadingActId(act.id);
    setLoadingActAction('gpx');
    try {
      showToast(language === 'zh-TW' ? `正在讀取「${act.name}」GPS 航跡...` : `正在读取「${act.name}」GPS 航迹...`, 'info');
      const stream = await getActivityStreams(act.id);
      const waypoints = stravaStreamsToWaypoints(act, stream);
      if (waypoints.length === 0) {
        showToast(language === 'zh-TW' ? '該次騎行無 GPS 座標航跡，無法載入工坊' : '该次骑行无 GPS 坐标航迹，无法载入工坊', 'warning');
        return;
      }

      setPendingTransfer('solorider_pending_gpx_route', {
        name: act.name,
        waypoints,
      });

      if (onNavigateTool) {
        onNavigateTool('gpx-creator');
      }
    } catch (err: any) {
      showToast(`载入 GPX 工坊失败: ${err.message || '未知错误'}`, 'error');
    } finally {
      setLoadingActId(null);
      setLoadingActAction(null);
    }
  };

  const handleExportStravaGpx = async (act: StravaActivityRecord) => {
    setLoadingActId(act.id);
    setLoadingActAction('export');
    try {
      showToast(language === 'zh-TW' ? `正在生成「${act.name}」GPX 文件...` : `正在生成「${act.name}」GPX 文件...`, 'info');
      const stream = await getActivityStreams(act.id);
      const xml = exportStravaActivityToGpxXml(act, stream);
      const blob = new Blob([xml], { type: 'application/gpx+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(act.name || 'Strava_Activity').replace(/[\\/:*?"<>|]/g, '_')}.gpx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(language === 'zh-TW' ? 'GPX 檔案匯出成功！' : 'GPX 文件导出成功！', 'success');
    } catch (err: any) {
      showToast(err.message || '导出 GPX 失败', 'error');
    } finally {
      setLoadingActId(null);
      setLoadingActAction(null);
    }
  };

  // Demo Activities Cache
  const demoActivities = useMemo(() => generateDemoStravaActivities(), []);

  // Effective Activities Array
  const effectiveActivities: StravaActivityRecord[] = useMemo(() => {
    if (useDemoMode || !isConnected || realActivities.length === 0) {
      return demoActivities;
    }
    return realActivities;
  }, [useDemoMode, isConnected, realActivities, demoActivities]);

  // Filtered by selected period
  const periodFilteredActivities = useMemo(() => {
    return filterByPeriod(effectiveActivities, selectedPeriod);
  }, [effectiveActivities, selectedPeriod]);

  // 1. KPI Metrics
  const kpi = useMemo(() => {
    return computeKpiMetrics(periodFilteredActivities);
  }, [periodFilteredActivities]);

  // 2. PMC Fitness & Freshness Timeline with Forward Projection
  const ftpWatts = profile.ftpWatts || athlete?.ftp || 240;
  const weightKg = profile.weightKg || athlete?.weight || 68;

  const pmcTimeline = useMemo(() => {
    return computePmcTimeline(effectiveActivities, ftpWatts, 90, showPmcProjection ? 14 : 0);
  }, [effectiveActivities, ftpWatts, showPmcProjection]);

  const historyPmcPoints = useMemo(() => {
    return pmcTimeline.filter(p => !p.isProjection);
  }, [pmcTimeline]);

  const latestPmc = historyPmcPoints[historyPmcPoints.length - 1] || { ctl: 65, atl: 68, tsb: -3 };
  const athleteDiagnosis = useMemo(() => {
    return diagnoseAthleteStatus(latestPmc.tsb, pmcTimeline);
  }, [latestPmc.tsb, pmcTimeline]);

  const optimalRaceWindow = useMemo(() => {
    return findOptimalRaceWindow(pmcTimeline);
  }, [pmcTimeline]);

  // 3. Annual Goal Progress (Distance & Elevation)
  const annualGoalKm = profile.annualGoalKm || 5000;
  const annualProgress = useMemo(() => {
    return computeAnnualGoalProgress(effectiveActivities, annualGoalKm);
  }, [effectiveActivities, annualGoalKm]);

  const annualGoalElevationM = profile.annualGoalElevationM || 50000;
  const annualElevationProgress = useMemo(() => {
    return computeAnnualElevationGoalProgress(effectiveActivities, annualGoalElevationM);
  }, [effectiveActivities, annualGoalElevationM]);

  // 4. Weekly Training Volume Breakdown & Ramp Rate History
  const weeklyVolume = useMemo(() => {
    return computeWeeklyVolume(effectiveActivities, ftpWatts, volumeWeeksSpan);
  }, [effectiveActivities, ftpWatts, volumeWeeksSpan]);

  const rampRateHistory = useMemo(() => {
    const fullPmc = computePmcTimeline(effectiveActivities, ftpWatts, volumeWeeksSpan === 52 ? 189 : 105, 0);
    return computeRampRateHistory(fullPmc, volumeWeeksSpan === 52 ? 26 : 14);
  }, [effectiveActivities, ftpWatts, volumeWeeksSpan]);

  // 5. Coggan 7-Zone Power Distribution
  const powerZoneActivities = useMemo(() => {
    return filterByPeriod(effectiveActivities, powerZonePeriod);
  }, [effectiveActivities, powerZonePeriod]);

  const powerZones = useMemo(() => {
    return computePowerZoneDistribution(powerZoneActivities, ftpWatts);
  }, [powerZoneActivities, ftpWatts]);

  // 6. FTP History & eFTP Breakthrough Milestones
  const ftpHistory = useMemo(() => {
    return computeFtpHistory(effectiveActivities, ftpWatts, weightKg);
  }, [effectiveActivities, ftpWatts, weightKg]);

  // 7. Personal Records (PR) Progressive Timeline
  const prTimeline = useMemo(() => {
    return computePersonalRecordsTimeline(effectiveActivities);
  }, [effectiveActivities]);

  // 8. Aerobic Efficiency Factor (EF)
  const aerobicEfficiency = useMemo(() => {
    return computeAerobicEfficiency(periodFilteredActivities);
  }, [periodFilteredActivities]);

  // 9. Eddington Number
  const eddington = useMemo(() => {
    return computeEddingtonNumber(effectiveActivities);
  }, [effectiveActivities]);

  // 10. Heatmap & Streaks (91-day / 13-week)
  const { grid: heatmapGrid, stats: streakStats } = useMemo(() => {
    return buildHeatmapGrid(effectiveActivities, 13);
  }, [effectiveActivities]);

  // 11. Activity Rings
  const ringData = useMemo(() => {
    return computeActivityRings(effectiveActivities, ringTargets);
  }, [effectiveActivities, ringTargets]);

  // 12. Bioclock & Habit Insights
  const bioclock = useMemo(() => {
    return computeBioclock(periodFilteredActivities);
  }, [periodFilteredActivities]);

  // 13. eFTP & MMP Peak Powers
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

  // 14. Gear Fleet
  const combinedBikes = useMemo(() => {
    if (athlete?.bikes && athlete.bikes.length > 0) {
      return athlete.bikes;
    }
    if (userBikes && userBikes.length > 0) {
      return userBikes.map(b => ({
        id: b.id,
        name: b.name,
        distance: (b.mileageKm || 0) * 1000,
        primary: false
      }));
    }
    return [];
  }, [athlete?.bikes, userBikes]);

  const fleet = useMemo(() => {
    return computeGearFleet(combinedBikes, effectiveActivities);
  }, [combinedBikes, effectiveActivities]);

  const activeBike = fleet[selectedBikeIdx] || fleet[0];

  // 15. Milestones & PRs
  const milestones = useMemo(() => {
    return computeMilestones(effectiveActivities);
  }, [effectiveActivities]);

  // 16. Recent Activities
  const recentActivities = useMemo(() => {
    return [...effectiveActivities]
      .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
      .slice(0, 10);
  }, [effectiveActivities]);

  // Sync Strava Data Trigger
  const handleSync = async () => {
    if (!isConnected) {
      showToast('请先在个人设置中连接 Strava', 'info');
      return;
    }
    try {
      showToast('正在从 Strava 同步最新骑行活动...', 'info');
      const res = await syncActivities(realActivities.length === 0);
      setUseDemoMode(false);
      showToast(`同步完成，成功刷新 ${res.count} 场骑行记录！`, 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '网络异常';
      showToast(`同步失败: ${message}`, 'error');
    }
  };

  // Generate Share Poster
  const handleGeneratePoster = async () => {
    showToast('正在渲染 Retina 高清车手战报海报...', 'info');
    try {
      const athleteName = athlete ? `${athlete.firstname} ${athlete.lastname}` : profile.name || 'LaBao 车手';
      const posterUrl = await generateStravaCockpitPoster({
        periodLabel: selectedPeriod === 'all-time' ? '全生涯历史总览' : selectedPeriod === 'ytd' ? '本年度骑行战报' : selectedPeriod === '30d' ? '近30天体能速报' : '近7天周报',
        athleteName,
        totalDistanceKm: kpi.totalDistanceKm,
        totalElevationM: kpi.totalElevationM,
        totalMovingTimeMin: kpi.totalMovingTimeMin,
        totalCaloriesKcal: kpi.totalCaloriesKcal,
        totalRides: kpi.totalRides,
        avgNpWatts: kpi.avgNpWatts,
        avgSpeedKmh: kpi.avgSpeedKmh,
        eddingtonE: eddington.E,
        ctl: latestPmc.ctl,
        atl: latestPmc.atl,
        tsb: latestPmc.tsb,
        tsbLabel: athleteDiagnosis.label,
        streakDays: streakStats.currentStreak,
        riderPattern: bioclock.riderPattern,
        everestCount: kpi.everestRatio
      });
      setSharePosterUrl(posterUrl);
      setIsShareModalOpen(true);
    } catch {
      showToast('海报生成失败', 'error');
    }
  };

  // CSV Export Trigger
  const handleExportCsv = () => {
    try {
      const csvContent = exportActivitiesToCsv(periodFilteredActivities);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `YoloCycling_Activities_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('CSV 骑行战报已生成并开始下载', 'success');
    } catch {
      showToast('导出 CSV 失败', 'error');
    }
  };

  // JSON Export Trigger
  const handleExportJson = () => {
    try {
      const jsonContent = exportActivitiesToJson(periodFilteredActivities);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `YoloCycling_Activities_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('JSON 骑行数据已生成并开始下载', 'success');
    } catch {
      showToast('导出 JSON 失败', 'error');
    }
  };

  // Charts Options & Data
  // 1. PMC Chart with projection
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

  // 2. Annual Goal Monthly Breakdown Chart (Distance vs Elevation)
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
            label: (context: any) => {
              const val = context.parsed.y;
              return ` ${context.dataset.label}: ${val.toLocaleString()} ${isElevation ? eleUnit : distUnit}`;
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
            callback: (v: any) => `${v.toLocaleString()} ${isElevation ? eleUnit : distUnit}`
          }
        }
      }
    };
  }, [annualGoalMetric, distUnit, eleUnit]);

  // 3. Weekly Volume Dual-Y Axis Chart
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
            callback: (v: any) => `${v} ${distUnit}`
          }
        }
      }
    };
  }, [distUnit]);

  // 4. Ramp Rate History Bar Chart
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

  // 5. FTP History Chart Data
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

  // 6. Eddington Histogram Chart
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

  // 7. Bioclock Time Doughnut Data
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

  // 8. Bioclock Day Bar Data
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

  // 9. MMP Curve Data
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

  const renderComponentIcon = (key: 'chain' | 'tire' | 'brake') => {
    if (key === 'chain') return <Link2 className="w-3.5 h-3.5 text-ios-blue shrink-0" />;
    if (key === 'tire') return <Disc className="w-3.5 h-3.5 text-ios-green shrink-0" />;
    return <Sliders className="w-3.5 h-3.5 text-ios-orange shrink-0" />;
  };

  const renderMilestoneIcon = (id: string, achieved: boolean) => {
    let Icon = Award;
    let colorClass = achieved ? 'text-ios-blue' : 'text-slate-400';
    let bgClass = achieved ? 'bg-ios-blue/10' : 'bg-slate-100 dark:bg-white/5';

    if (id === 'imperial_century') {
      Icon = Trophy;
      colorClass = achieved ? 'text-ios-yellow' : 'text-slate-400';
      bgClass = achieved ? 'bg-ios-yellow/10' : 'bg-slate-100 dark:bg-white/5';
    } else if (id === 'double_century') {
      Icon = Sparkles;
      colorClass = achieved ? 'text-ios-purple' : 'text-slate-400';
      bgClass = achieved ? 'bg-ios-purple/10' : 'bg-slate-100 dark:bg-white/5';
    } else if (id === 'everest_challenge') {
      Icon = Mountain;
      colorClass = achieved ? 'text-ios-green' : 'text-slate-400';
      bgClass = achieved ? 'bg-ios-green/10' : 'bg-slate-100 dark:bg-white/5';
    } else if (id === 'dawn_patrol') {
      Icon = Sun;
      colorClass = achieved ? 'text-ios-orange' : 'text-slate-400';
      bgClass = achieved ? 'bg-ios-orange/10' : 'bg-slate-100 dark:bg-white/5';
    } else if (id === 'pr_distance') {
      Icon = Route;
      colorClass = achieved ? 'text-ios-blue' : 'text-slate-400';
      bgClass = achieved ? 'bg-ios-blue/10' : 'bg-slate-100 dark:bg-white/5';
    } else if (id === 'pr_elevation') {
      Icon = TrendingUp;
      colorClass = achieved ? 'text-ios-teal' : 'text-slate-400';
      bgClass = achieved ? 'bg-ios-teal/10' : 'bg-slate-100 dark:bg-white/5';
    } else if (id === 'pr_power') {
      Icon = Zap;
      colorClass = achieved ? 'text-ios-pink' : 'text-slate-400';
      bgClass = achieved ? 'bg-ios-pink/10' : 'bg-slate-100 dark:bg-white/5';
    }

    return (
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2.5 ${bgClass} ${colorClass}`}>
        <Icon className="w-4 h-4" />
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-5 pb-12">
      {/* 1. Header with Actions & Live/Demo Indicator */}
      <IOSToolHeader
        title={language === 'zh-TW' ? 'Strava 羅盤' : 'Strava 罗盘'}
        description={language === 'zh-TW' ? '宏觀數據看板 · 運動生理診斷 · 愛丁頓數 · 戰車管家' : '宏观数据看板 · 运动生理诊断 · 爱丁顿数 · 战车管家'}
        category={language === 'zh-TW' ? '生理與代謝' : '生理与代谢'}
        categoryIcon={LayoutDashboard}
        tint="blue"
        onShare={handleGeneratePoster}
        shareTitle={language === 'zh-TW' ? '生成數據羅盤海報' : '生成数据罗盘海报'}
        actions={
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Demo Toggle Pill */}
            <button
              onClick={() => setUseDemoMode(!useDemoMode)}
              className="h-9 px-3 rounded-xl text-xs font-medium bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 apple-touch transition flex items-center gap-1.5"
              title={language === 'zh-TW' ? '切換真實數據與演示樣本' : '切换真实数据与演示样本'}
            >
              <Sparkles className="w-3.5 h-3.5 text-ios-blue" />
              <span>{useDemoMode ? (language === 'zh-TW' ? '切回真實' : '切回真实') : (language === 'zh-TW' ? '載入演示' : '载入演示')}</span>
            </button>

            {/* Sync Button */}
            {isConnected && (
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="h-9 px-3 rounded-xl text-xs font-medium bg-ios-blue text-white hover:bg-ios-blue/90 disabled:opacity-50 apple-touch transition flex items-center gap-1.5 shadow-ios-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="tabular-nums">
                  {isSyncing
                    ? (syncProgress ? `${language === 'zh-TW' ? '同步中' : '同步中'} ${syncProgress.current}%` : (language === 'zh-TW' ? '同步中' : '同步中'))
                    : (language === 'zh-TW' ? '同步' : '同步')}
                </span>
              </button>
            )}
          </div>
        }
      />

      {/* 2. Top Banner: Strava Connection Status & Period Segmented Control */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-black/[0.05] dark:border-white/[0.08] shadow-ios-card">
        <div className="flex items-center gap-2.5">
          <PoweredByStravaBadge />
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {useDemoMode ? '当前展示 90 天高保真演示数据集' : `已连接车手: ${athlete?.firstname || profile.name || '车手'}`}
          </span>
        </div>

        <IOSSegmentedControl
          value={selectedPeriod}
          onChange={(val) => setSelectedPeriod(val as TimePeriod)}
          options={[
            { value: 'all-time', label: '全生涯' },
            { value: 'ytd', label: '本年度' },
            { value: '30d', label: '近30天' },
            { value: '7d', label: '近7天' }
          ]}
        />
      </div>

      {/* 2.2 Live Sync Progress Bar Banner (Collapsible Apple HIG HUD) */}
      {syncProgress && (
        <div className="p-3 sm:p-3.5 rounded-2xl bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-md border border-ios-blue/20 dark:border-ios-blue/30 shadow-ios-card space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  syncProgress.stage === 'done'
                    ? 'bg-ios-green/15 text-ios-green'
                    : 'bg-ios-blue/15 text-ios-blue'
                }`}
              >
                {syncProgress.stage === 'done' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                )}
              </div>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                {syncProgress.message}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 pl-2">
              <span
                className={`font-mono font-bold tabular-nums text-xs ${
                  syncProgress.stage === 'done' ? 'text-ios-green' : 'text-ios-blue'
                }`}
              >
                {syncProgress.current}%
              </span>
            </div>
          </div>

          {/* Progress Track */}
          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ease-out ${
                syncProgress.stage === 'done' ? 'bg-ios-green' : 'bg-ios-blue'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, syncProgress.current))}%` }}
            />
          </div>
        </div>
      )}

      {/* 2.5 Cockpit Category Navigation Tabs */}
      <div className="flex items-center justify-start sm:justify-center">
        <IOSSegmentedControl
          value={activeTab}
          onChange={(val) => setActiveTab(val as CockpitTab)}
          options={[
            { value: 'overview', label: language === 'zh-TW' ? '綜合總覽' : '综合总览' },
            { value: 'fitness', label: language === 'zh-TW' ? '體能與週期' : '体能与周期' },
            { value: 'segments', label: language === 'zh-TW' ? '賽段與 KOM' : '赛段与 KOM' },
            { value: 'fleet', label: language === 'zh-TW' ? '機隊與活動' : '机队与活动' }
          ]}
          className="w-full sm:w-auto"
        />
      </div>

      {/* TAB 1: 综合总览 */}
      {activeTab === 'overview' && (
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
                <Bar data={annualGoalMonthlyChartData as any} options={annualGoalMonthlyChartOptions} />
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
      )}

      {/* TAB 2: 体能与周期 (FITNESS & FORM) */}
      {activeTab === 'fitness' && (
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
                    onClick={() => setShowPmcProjection(!showPmcProjection)}
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
                      { value: 'ramp', label: language === 'zh-TW' ? 'CTL 爬升率' : 'CTL 爬升率' }
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
      )}

      {/* TAB 3: 赛段与 KOM (SEGMENTS & EFFORTS) */}
      {activeTab === 'segments' && (
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
                onChange={(val) => setSegmentCategoryFilter(val as any)}
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
                onChange={(val) => setSegmentSortBy(val as any)}
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
                    {onNavigateTool && (
                      <button
                        type="button"
                        onClick={() => handleNavigatePacing(seg)}
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
      )}

      {/* TAB 4: 机队与活动 (FLEET & ACTIVITIES) */}
      {activeTab === 'fleet' && (
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
                    onClick={handleExportCsv}
                    className="h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-medium apple-touch transition flex items-center gap-1"
                    title="导出全部筛选活动为 CSV 格式表格"
                  >
                    <Download className="w-3.5 h-3.5 text-ios-blue" />
                    <span>{language === 'zh-TW' ? '導出 CSV' : '导出 CSV'}</span>
                  </button>
                  <button
                    onClick={handleExportJson}
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
                          onClick={() => handleAnalyzeStravaActivity(act)}
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
                          onClick={() => handleSendStravaToGpx(act)}
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
                        onClick={() => handleExportStravaGpx(act)}
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
      )}

      {/* Share Poster Modal */}
      <ShareCardModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        posterUrl={sharePosterUrl}
        title="车手战报海报"
        fileName={`LaBao_车手数据战报_${selectedPeriod}.png`}
      />
    </div>
  );
};
