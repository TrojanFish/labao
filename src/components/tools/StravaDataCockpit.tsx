import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  RefreshCw,
  Sparkles,
  Upload,
  AlertTriangle,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';
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
import { saveActivityToDb, getAllLocalActivities, LocalActivityRecord } from '../../utils/localActivityDb';
import { batchIngestActivityFiles } from '../../utils/batchFitImporter';
import {
  convertStravaToLocalRecord,
  convertLocalToStravaRecord,
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
  computeAnnualGoalProgress,
  computeAnnualElevationGoalProgress,
  computeEddingtonNumber,
  buildHeatmapGrid,
  computeActivityRings,
  computeBioclock,
  computeGearFleet,
  computeMilestones,
  generateDemoStravaActivities,
  computePersonalRecordsTimeline,
  computeAerobicEfficiency,
  exportActivitiesToCsv,
  exportActivitiesToJson
} from '../../utils/stravaCockpitAnalytics';
import { CURATED_STRAVA_SEGMENTS, StravaSegmentItem } from '../../services/stravaService';
import { generateStravaCockpitPoster } from '../../utils/shareCardGenerators';

import { StravaOverviewTab } from './strava-cockpit/StravaOverviewTab';
import { StravaFitnessTab } from './strava-cockpit/StravaFitnessTab';
import { StravaSegmentsTab } from './strava-cockpit/StravaSegmentsTab';
import { StravaFleetTab } from './strava-cockpit/StravaFleetTab';

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
  onNavigateTool?: (tool: string) => void;
}

type CockpitTab = 'overview' | 'fitness' | 'segments' | 'fleet';

export const StravaDataCockpit: React.FC<StravaDataCockpitProps> = ({ onNavigateTool }) => {
  const {
    athlete,
    activities: realActivities,
    isConnected,
    isSyncing,
    syncProgress,
    syncActivities,
    getActivityStreams,
    getStarredSegments
  } = useStrava();

  const { profile, bikes: userBikes, switchBike } = useRiderProfile();
  const { language, unitSystem, convertDistance, convertElevation, convertSpeed } = useLanguageAndUnit();
  const isImperial = unitSystem === 'imperial';
  const distUnit = isImperial ? 'mi' : 'km';
  const eleUnit = isImperial ? 'ft' : 'm';
  const { showToast } = useToast();

  const [loadingActId, setLoadingActId] = useState<number | null>(null);
  const [loadingActAction, setLoadingActAction] = useState<'analyze' | 'gpx' | 'export' | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localActivities, setLocalActivities] = useState<LocalActivityRecord[]>([]);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    getAllLocalActivities()
      .then((records) => {
        if (isMounted) setLocalActivities(records);
      })
      .catch(() => undefined);
    return () => {
      isMounted = false;
    };
  }, []);

  // Tab State: Overview vs Fitness vs Fleet
  const [activeTab, setActiveTab] = useState<CockpitTab>('overview');

  // Mode: Use Demo Data vs Live Data
  const [useDemoMode, setUseDemoMode] = useState<boolean>(() => {
    return !isConnected || realActivities.length === 0;
  });

  // Selected Time Period for Global Overview
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('all-time');

  // Activity Ring Targets
  const [ringTargets] = useState({ distanceKm: 150, elevationM: 1500, tss: 350 });

  // PMC Forward 14-day Projection Toggle
  const [showPmcProjection, setShowPmcProjection] = useState<boolean>(true);

  // Share Poster Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [sharePosterUrl, setSharePosterUrl] = useState<string | null>(null);

  // Segments State (Tab 3)
  const [starredSegments, setStarredSegments] = useState<StravaSegmentItem[]>(CURATED_STRAVA_SEGMENTS);

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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知错误';
      showToast(`载入深度分析失败: ${msg}`, 'error');
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知错误';
      showToast(`载入 GPX 工坊失败: ${msg}`, 'error');
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '导出 GPX 失败';
      showToast(msg, 'error');
    } finally {
      setLoadingActId(null);
      setLoadingActAction(null);
    }
  };

  // Handle local FIT / GPX / TCX multi-file batch ingestion
  const handleImportFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsImporting(true);
    try {
      showToast(
        language === 'zh-TW'
          ? `正在解析並匯入 ${files.length} 個碼表文件...`
          : `正在解析并导入 ${files.length} 个码表文件...`,
        'info'
      );
      const ftp = profile.ftpWatts || 220;
      const weight = profile.weightKg || 68;
      const maxHr = profile.maxHr || 185;
      const result = await batchIngestActivityFiles(files, ftp, weight, maxHr);

      if (result.successfulCount > 0) {
        showToast(
          language === 'zh-TW'
            ? `成功匯入 ${result.successfulCount} 筆活動，已即時更新數據羅盤與 PMC！`
            : `成功导入 ${result.successfulCount} 笔活动，已即时更新数据罗盘与 PMC！`,
          'success'
        );
        const updated = await getAllLocalActivities();
        setLocalActivities(updated);
        setUseDemoMode(false);
      } else {
        showToast(language === 'zh-TW' ? '未解析到有效騎行資料' : '未解析到有效骑行数据', 'warning');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '解析失败';
      showToast(`导入失败: ${msg}`, 'error');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Demo Activities Cache
  const demoActivities = useMemo(() => generateDemoStravaActivities(), []);

  // Effective Activities Array (Seamlessly combines Strava cloud sync + local imported FIT/GPX rides)
  const effectiveActivities: StravaActivityRecord[] = useMemo(() => {
    if (useDemoMode) {
      return demoActivities;
    }

    const localConverted = localActivities.map(convertLocalToStravaRecord);
    const combined = [...realActivities];

    for (const act of localConverted) {
      const isDup = combined.some(ca =>
        Math.abs(new Date(ca.start_date).getTime() - new Date(act.start_date).getTime()) < 60000 ||
        (ca.distance > 0 && Math.abs(ca.distance - act.distance) < 50 && Math.abs(new Date(ca.start_date).getTime() - new Date(act.start_date).getTime()) < 300000)
      );
      if (!isDup) {
        combined.push(act);
      }
    }

    if (combined.length === 0) {
      return demoActivities;
    }

    return combined;
  }, [useDemoMode, realActivities, localActivities, demoActivities]);

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

  // 4. Personal Records (PR) Progressive Timeline
  const prTimeline = useMemo(() => {
    return computePersonalRecordsTimeline(effectiveActivities);
  }, [effectiveActivities]);

  // 5. Aerobic Efficiency Factor (EF)
  const aerobicEfficiency = useMemo(() => {
    return computeAerobicEfficiency(periodFilteredActivities);
  }, [periodFilteredActivities]);

  // 6. Eddington Number
  const eddington = useMemo(() => {
    return computeEddingtonNumber(effectiveActivities);
  }, [effectiveActivities]);

  // 7. Heatmap & Streaks (91-day / 13-week)
  const { grid: heatmapGrid, stats: streakStats } = useMemo(() => {
    return buildHeatmapGrid(effectiveActivities, 13);
  }, [effectiveActivities]);

  // 8. Activity Rings
  const ringData = useMemo(() => {
    return computeActivityRings(effectiveActivities, ringTargets);
  }, [effectiveActivities, ringTargets]);

  // 9. Bioclock & Habit Insights
  const bioclock = useMemo(() => {
    return computeBioclock(periodFilteredActivities);
  }, [periodFilteredActivities]);

  // 10. Gear Fleet
  const combinedBikes = useMemo(() => {
    const list: Array<{ id: string; name: string; distance: number; primary: boolean; garageId?: string }> = [];
    const seenIds = new Set<string>();

    if (athlete?.bikes && athlete.bikes.length > 0) {
      for (const b of athlete.bikes) {
        const matchingGarageBike = userBikes?.find(gb => gb.stravaGearId === b.id || gb.id === b.id);
        const garageDistMeters = (matchingGarageBike?.mileageKm || 0) * 1000;
        list.push({
          id: b.id,
          name: b.name || matchingGarageBike?.name || '未知战车',
          distance: Math.max(b.distance || 0, garageDistMeters),
          primary: Boolean(b.primary),
          garageId: matchingGarageBike?.id
        });
        seenIds.add(b.id);
        if (matchingGarageBike) {
          seenIds.add(matchingGarageBike.id);
        }
      }
    }

    if (userBikes && userBikes.length > 0) {
      for (const b of userBikes) {
        if (!seenIds.has(b.id) && (!b.stravaGearId || !seenIds.has(b.stravaGearId))) {
          list.push({
            id: b.id,
            name: b.name,
            distance: (b.mileageKm || 0) * 1000,
            primary: false,
            garageId: b.id
          });
          seenIds.add(b.id);
        }
      }
    }

    return list;
  }, [athlete?.bikes, userBikes]);

  const fleet = useMemo(() => {
    return computeGearFleet(combinedBikes, effectiveActivities);
  }, [combinedBikes, effectiveActivities]);

  // 11. Milestones & PRs
  const milestones = useMemo(() => {
    return computeMilestones(effectiveActivities);
  }, [effectiveActivities]);

  // 12. Recent Activities
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
      const athleteName = athlete ? `${athlete.firstname} ${athlete.lastname}` : profile.name || 'YoloCycling 车手';
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
            {/* Hidden File Input for FIT/GPX/TCX Batch Ingestion */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".fit,.gpx,.tcx"
              onChange={handleImportFiles}
              className="hidden"
            />

            {/* Local FIT / GPX File Ingestion Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="h-9 px-3 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 apple-touch transition flex items-center gap-1.5 shrink-0"
              title={language === 'zh-TW' ? '匯入本地碼表原始檔 (FIT / GPX / TCX)' : '导入本地码表原始文件 (FIT / GPX / TCX)'}
            >
              <Upload className={`w-3.5 h-3.5 text-ios-blue ${isImporting ? 'animate-bounce' : ''}`} />
              <span>{isImporting ? (language === 'zh-TW' ? '解析中...' : '解析中...') : (language === 'zh-TW' ? '匯入碼表' : '导入码表')}</span>
            </button>

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

      {/* 2.1 Strava Non-Member / Policy Reassurance Banner */}
      {isConnected && realActivities.length === 0 && !useDemoMode && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                {language === 'zh-TW' ? 'Strava 官方 API 與非會員資料拉取說明' : 'Strava 官方 API 与非会员数据拉取说明'}
              </p>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px] sm:text-xs">
                {language === 'zh-TW'
                  ? 'Strava 最新開發者條款對非付費會員帳號及自建應用的活動拉取實施了嚴格限制，API 接口常因會員權限或隱私設定返回 0 筆雲端記錄。無需開通 Strava 付費會員！點擊上方「匯入碼表」，將 Garmin / Wahoo / 邁金 / iGPSport / 高馳的原始 FIT/GPX 檔拖入，YoloCycling 100% 本地離線引擎即可為您呈現無損精度的 PMC 體能模型、功率曲線與生理診斷。'
                  : 'Strava 最新开发者条款对非付费会员账号及自建应用的活动拉取实施了严格限制，API 接口常因会员权限或隐私设置返回 0 条云端记录。无需开通 Strava 付费会员！点击上方「导入码表」，将 Garmin / Wahoo / 迈金 / iGPSport / 高驰的原始 FIT/GPX 文件拖入，YoloCycling 100% 本地离线引擎即可为您呈现无损精度的 PMC 体能模型、功率曲线与生理诊断。'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1 pl-6">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="apple-touch h-8 px-3 rounded-lg bg-amber-500 text-white font-medium text-xs hover:bg-amber-600 transition flex items-center gap-1.5 shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{language === 'zh-TW' ? '立即匯入本地 FIT/GPX' : '立即导入本地 FIT/GPX'}</span>
            </button>
            {onNavigateTool && (
              <button
                type="button"
                onClick={() => onNavigateTool('activity-analyzer')}
                className="apple-touch h-8 px-3 rounded-lg bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-medium text-xs hover:bg-slate-300/80 dark:hover:bg-white/15 transition flex items-center gap-1.5"
              >
                <span>{language === 'zh-TW' ? '前往碼表工坊' : '前往码表工坊'}</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

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
        <StravaOverviewTab
          kpi={kpi}
          streakStats={streakStats}
          aerobicEfficiency={aerobicEfficiency}
          annualProgress={annualProgress}
          annualElevationProgress={annualElevationProgress}
          ringData={ringData}
          heatmapGrid={heatmapGrid}
          bioclock={bioclock}
          language={language}
          convertDistance={convertDistance}
          convertElevation={convertElevation}
          convertSpeed={convertSpeed}
          isImperial={isImperial}
          distUnit={distUnit}
          eleUnit={eleUnit}
        />
      )}

      {/* TAB 2: 体能与周期 */}
      {activeTab === 'fitness' && (
        <StravaFitnessTab
          effectiveActivities={effectiveActivities}
          ftpWatts={ftpWatts}
          weightKg={weightKg}
          showPmcProjection={showPmcProjection}
          setShowPmcProjection={setShowPmcProjection}
          pmcTimeline={pmcTimeline}
          latestPmc={latestPmc}
          athleteDiagnosis={athleteDiagnosis}
          optimalRaceWindow={optimalRaceWindow}
          language={language}
          isImperial={isImperial}
          distUnit={distUnit}
          onNavigateTool={onNavigateTool}
        />
      )}

      {/* TAB 3: 赛段与 KOM */}
      {activeTab === 'segments' && (
        <StravaSegmentsTab
          starredSegments={starredSegments}
          weightKg={weightKg}
          language={language}
          isImperial={isImperial}
          distUnit={distUnit}
          eleUnit={eleUnit}
          onNavigatePacing={handleNavigatePacing}
        />
      )}

      {/* TAB 4: 机队与活动 */}
      {activeTab === 'fleet' && (
        <StravaFleetTab
          fleet={fleet}
          userBikes={userBikes}
          switchBike={switchBike}
          eddington={eddington}
          milestones={milestones}
          prTimeline={prTimeline}
          recentActivities={recentActivities}
          language={language}
          isImperial={isImperial}
          distUnit={distUnit}
          onNavigateTool={onNavigateTool}
          onExportCsv={handleExportCsv}
          onExportJson={handleExportJson}
          onAnalyzeActivity={handleAnalyzeStravaActivity}
          onSendToGpx={handleSendStravaToGpx}
          onExportGpx={handleExportStravaGpx}
          loadingActId={loadingActId}
          loadingActAction={loadingActAction}
        />
      )}

      {/* Share Poster Modal */}
      <ShareCardModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        posterUrl={sharePosterUrl}
        title="车手战报海报"
        fileName={`YoloCycling_车手数据战报_${selectedPeriod}.png`}
      />
    </div>
  );
};
