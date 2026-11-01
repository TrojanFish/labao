import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart as LineChartIcon,
  Upload,
  Sparkles,
  CheckCircle2,
  RotateCcw,
  Cloud,
  FolderArchive,
  RefreshCw,
  Gauge
} from 'lucide-react';
import { PoweredByStravaBadge } from '../common/PoweredByStravaBadge';
import { WORKOUT_TEMPLATES, WorkoutTemplate } from './WorkoutBuilder';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler
} from 'chart.js';
import { useRiderProfile } from '../../context/RiderProfileContext';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';
import { useToast } from '../../context/ToastContext';
import { setPendingTransfer, consumePendingTransfer } from '../../hooks/useToolDraftState';
import { IOSToolHeader } from '../common/IOSToolHeader';
import { IOSSegmentedControl } from '../common/IOSSegmentedControl';
import { NumberStepper } from '../common/NumberStepper';
import { ShareCardModal } from '../common/ShareCardModal';
import { generateFitActivityPoster } from '../../utils/shareCardGenerators';
import { triggerHaptic } from '../../utils/haptics';
import {
  ActivityAnalysis,
  ActivityPoint,
  parseFitFile,
  parseGpxFile,
  parseTcxFile,
  generateRealisticDemoRide,
  analyzePoints,
  computeEstimatedPowerPoints,
  COGGAN_BENCHMARKS,
  CogganBenchmarkLevel,
  calculateSkibaWPrimeBalance,
  WPrimeBalanceResult
} from '../../utils/activityParser';
import { useStrava } from '../../context/StravaContext';
import {
  LocalActivityRecord,
  saveActivityToDb,
  getAllLocalActivities,
  getLocalActivityStream
} from '../../utils/localActivityDb';
import {
  batchIngestActivityFiles,
  BatchImportProgress
} from '../../utils/batchFitImporter';
import {
  computeMmpEnvelope,
  detectActivityPrs
} from '../../utils/mmpAggregator';
import { ActivityArchiveModal } from './ActivityArchiveModal';
import { BatchImportModal } from './BatchImportModal';
import { FitSensorDiagnostics } from './fit-analyzer/FitSensorDiagnostics';
import { FitMetricsGrid } from './fit-analyzer/FitMetricsGrid';
import { FitTrendsTab } from './fit-analyzer/FitTrendsTab';
import { FitZonesTab } from './fit-analyzer/FitZonesTab';
import { FitMmpTab } from './fit-analyzer/FitMmpTab';
import { FitShiftingTab } from './fit-analyzer/FitShiftingTab';
import { FitPmcTab } from './fit-analyzer/FitPmcTab';
import { FitCoachingTab } from './fit-analyzer/FitCoachingTab';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

interface FitActivityAnalyzerProps {
  onNavigateTool?: (toolId: string) => void;
}

export const FitActivityAnalyzer: React.FC<FitActivityAnalyzerProps> = ({ onNavigateTool }) => {
  const { profile } = useRiderProfile();
  const { unitSystem, language, convertDistance, convertElevation, convertSpeed, convertWeight } = useLanguageAndUnit();
  const { showToast } = useToast();
  const isImperial = unitSystem === 'imperial';

  // Rider Physiological Anchors
  const [ftpWatts, setFtpWatts] = useState<number>(profile.ftpWatts || 240);
  const [weightKg, setWeightKg] = useState<number>(profile.weightKg || 68);
  const [maxHr, setMaxHr] = useState<number>(profile.maxHr || 185);

  useEffect(() => {
    if (profile.ftpWatts) setFtpWatts(profile.ftpWatts);
    if (profile.weightKg) setWeightKg(profile.weightKg);
    if (profile.maxHr) setMaxHr(profile.maxHr);
  }, [profile.ftpWatts, profile.weightKg, profile.maxHr]);

  // MMP & W' Balance State
  const [mmpUnit, setMmpUnit] = useState<'wkg' | 'watts'>('wkg');
  const [mmpSubView, setMmpSubView] = useState<'mmp_curve' | 'w_balance'>('mmp_curve');
  const [selectedCogganTier, setSelectedCogganTier] = useState<string>('all');
  const [cpWatts, setCpWatts] = useState<number>(profile.ftpWatts || 240);
  const [wPrimeKj, setWPrimeKj] = useState<number>(20);

  useEffect(() => {
    if (profile.ftpWatts) setCpWatts(profile.ftpWatts);
  }, [profile.ftpWatts]);

  // Activity State
  const [analysis, setAnalysis] = useState<ActivityAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'trends' | 'zones' | 'mmp' | 'shifting' | 'coaching' | 'pmc'>('trends');

  // Local-First Activity Database State
  const [localActivities, setLocalActivities] = useState<LocalActivityRecord[]>([]);
  const [activeLocalActivityId, setActiveLocalActivityId] = useState<string | null>(null);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState<boolean>(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<BatchImportProgress | null>(null);

  // MMP Multi-Layer Envelope State
  const [mmpShowCurrent, setMmpShowCurrent] = useState<boolean>(true);
  const [mmpShow90d, setMmpShow90d] = useState<boolean>(true);
  const [mmpShowAllTime, setMmpShowAllTime] = useState<boolean>(true);

  const refreshLocalActivities = async () => {
    try {
      const list = await getAllLocalActivities();
      setLocalActivities(list);
    } catch {
      // IndexedDB storage temporarily unavailable
    }
  };

  useEffect(() => {
    refreshLocalActivities();
  }, []);

  const {
    isConnected: isStravaConnected,
    activities: stravaActivities,
    getActivityStreams,
    isSyncing: isStravaSyncing,
    syncActivities: syncStravaActivities
  } = useStrava();

  const [selectedStravaActivityId, setSelectedStravaActivityId] = useState<string>('');

  const handleLoadStravaActivity = async (activityIdStr: string) => {
    const actId = parseInt(activityIdStr, 10);
    if (isNaN(actId)) return;
    const act = stravaActivities.find(a => a.id === actId);
    if (!act) return;

    setSelectedStravaActivityId(activityIdStr);
    setIsLoading(true);
    try {
      showToast(`正在从 Strava 载入「${act.name}」秒级数据流...`, 'info');
      const streams = await getActivityStreams(act.id);
      if (!streams || !streams.time || streams.time.length === 0) {
        showToast('该骑行暂无秒级详细流数据（可能无码表传感器记录）', 'warning');
        return;
      }

      let cumDistanceMeters = 0;
      const baseTime = new Date(act.start_date).getTime();
      const points: ActivityPoint[] = streams.time.map((tSec, i) => {
        const dt = i > 0 ? (streams.time![i] - streams.time![i - 1]) : 1;
        const velMs = streams.velocity_smooth ? (streams.velocity_smooth[i] || 0) : 0;
        cumDistanceMeters += velMs * dt;

        return {
          time: tSec,
          timestamp: new Date(baseTime + tSec * 1000),
          distance: cumDistanceMeters,
          power: streams.watts ? streams.watts[i] : undefined,
          heartRate: streams.heartrate ? streams.heartrate[i] : undefined,
          cadence: streams.cadence ? streams.cadence[i] : undefined,
          speed: velMs > 0 ? parseFloat((velMs * 3.6).toFixed(1)) : undefined,
          altitude: streams.altitude ? streams.altitude[i] : undefined,
          lat: streams.latlng && streams.latlng[i] ? streams.latlng[i][0] : undefined,
          lon: streams.latlng && streams.latlng[i] ? streams.latlng[i][1] : undefined
        };
      });

      const parsed = analyzePoints(points, act.name, 'fit', ftpWatts, weightKg, maxHr);
      setAnalysis(parsed);
      setActiveTab('trends');
      showToast(`成功载入 Strava 骑行「${act.name}」！`, 'success');
    } catch (err: any) {
      showToast(`载入 Strava 骑行流失败: ${err.message || '网络异常'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };


  // Chart Channel Visibility Toggles
  const [showPower, setShowPower] = useState<boolean>(true);
  const [showHeartRate, setShowHeartRate] = useState<boolean>(true);
  const [showElevation, setShowElevation] = useState<boolean>(true);
  const [showSpeed, setShowSpeed] = useState<boolean>(false);
  const [showCadence, setShowCadence] = useState<boolean>(false);

  // Real-time Scrubbed / Hovered Point Index for Telemetry HUD
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  const currentScrubbedPoint = useMemo(() => {
    if (!analysis || !analysis.sampledPoints || hoveredPointIndex === null) return null;
    return analysis.sampledPoints[hoveredPointIndex] || null;
  }, [analysis, hoveredPointIndex]);

  const setPresetChannels = (preset: 'physiology' | 'transmission' | 'all') => {
    triggerHaptic('selection');
    if (preset === 'physiology') {
      setShowPower(true);
      setShowHeartRate(true);
      setShowElevation(true);
      setShowSpeed(false);
      setShowCadence(false);
    } else if (preset === 'transmission') {
      setShowPower(true);
      setShowSpeed(true);
      setShowCadence(true);
      setShowHeartRate(false);
      setShowElevation(false);
    } else if (preset === 'all') {
      setShowPower(true);
      setShowHeartRate(true);
      setShowElevation(true);
      setShowSpeed(true);
      setShowCadence(true);
    }
  };

  const isPhysiologyPreset = showPower && showHeartRate && showElevation && !showSpeed && !showCadence;
  const isTransmissionPreset = showPower && showSpeed && showCadence && !showHeartRate && !showElevation;
  const isAllPreset = showPower && showHeartRate && showElevation && showSpeed && showCadence;

  // Automatically load demo ride on first render so user has immediate rich data
  useEffect(() => {
    if (!analysis) {
      try {
        const demo = generateRealisticDemoRide(ftpWatts, weightKg, maxHr);
        setAnalysis(demo);
      } catch {
        // Fallback to empty state
      }
    }
  }, []);

  // When FTP/Weight/MaxHR changes, re-analyze current activity points
  const handleProfileRecompute = () => {
    if (!analysis) return;
    try {
      const raw = analysis.rawPoints || analysis.points;
      const pointsToUse = analysis.isEstimatedPower
        ? computeEstimatedPowerPoints(raw, weightKg, 9)
        : raw;
      const updated = analyzePoints(
        pointsToUse,
        analysis.fileName,
        analysis.fileType,
        ftpWatts,
        weightKg,
        maxHr,
        {
          isEstimatedPower: analysis.isEstimatedPower,
          sensorDiagnostics: analysis.sensorDiagnostics,
          shiftingEvents: analysis.shiftingEvents,
          recordedCalories: analysis.recordedCalories,
          rawPoints: raw
        }
      );
      setAnalysis(updated);
      showToast(
        language === 'zh-TW'
          ? '已基於調整後之車手生理指標重新計算所有數據'
          : '已基于调整后的车手生理指标重新计算所有数据',
        'success'
      );
    } catch (err: any) {
      showToast(err.message || '重算失败', 'error');
    }
  };

  // Toggle physics estimated power reconstruction
  const handleToggleEstimatedPower = () => {
    if (!analysis) return;
    try {
      const raw = analysis.rawPoints || analysis.points;
      if (!analysis.isEstimatedPower) {
        const estPoints = computeEstimatedPowerPoints(raw, weightKg, 9);
        const updated = analyzePoints(
          estPoints,
          analysis.fileName,
          analysis.fileType,
          ftpWatts,
          weightKg,
          maxHr,
          {
            isEstimatedPower: true,
            sensorDiagnostics: analysis.sensorDiagnostics,
            shiftingEvents: analysis.shiftingEvents,
            recordedCalories: analysis.recordedCalories,
            rawPoints: raw
          }
        );
        setAnalysis(updated);
        showToast(
          language === 'zh-TW'
            ? '已基於經典物理力學模型重構仿真功率 · NP、TSS、總做功與功率曲線'
            : '已基于经典物理力学模型重构仿真功率 · NP、TSS、总做功与功率曲线',
          'success'
        );
      } else {
        const updated = analyzePoints(
          raw,
          analysis.fileName,
          analysis.fileType,
          ftpWatts,
          weightKg,
          maxHr,
          {
            isEstimatedPower: false,
            sensorDiagnostics: analysis.sensorDiagnostics,
            shiftingEvents: analysis.shiftingEvents,
            recordedCalories: analysis.recordedCalories,
            rawPoints: raw
          }
        );
        setAnalysis(updated);
        showToast(
          language === 'zh-TW' ? '已切換回硬件傳感器原始記錄數據' : '已切换回硬件传感器原始记录数据',
          'info'
        );
      }
    } catch (err: any) {
      showToast(err.message || '切换失败', 'error');
    }
  };

  const batchFileInputRef = React.useRef<HTMLInputElement>(null);

  // File Upload Handlers
  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    const ext = file.name.split('.').pop()?.toLowerCase();

    try {
      let result: ActivityAnalysis;
      if (ext === 'fit') {
        result = await parseFitFile(file, ftpWatts, weightKg, maxHr);
      } else if (ext === 'gpx') {
        result = await parseGpxFile(file, ftpWatts, weightKg, maxHr);
      } else if (ext === 'tcx') {
        result = await parseTcxFile(file, ftpWatts, weightKg, maxHr);
      } else {
        throw new Error(
          '格式不支持！仅支持上传 .fit, .gpx, 或 .tcx 文件'
        );
      }

      setAnalysis(result);

      // Persist to Local-First IndexedDB
      const firstPoint = result.points && result.points.length > 0 ? result.points[0] : null;
      const startTimeMs = firstPoint?.timestamp
        ? new Date(firstPoint.timestamp).getTime()
        : Date.now() - result.totalDurationSec * 1000;
      const actId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const record: LocalActivityRecord = {
        id: actId,
        name: result.fileName.replace(/\.(fit|gpx|tcx)$/i, ''),
        startDate: new Date(startTimeMs).toISOString(),
        startTime: startTimeMs,
        distanceKm: result.totalDistanceKm,
        totalDurationSec: result.totalDurationSec,
        movingTimeSec: result.movingTimeSec,
        elevationGainM: result.elevationGainM,
        elevationLossM: result.elevationLossM,
        avgPower: result.avgPower,
        maxPower: result.maxPower,
        normalizedPower: result.normalizedPower,
        intensityFactor: result.intensityFactor,
        tss: result.tss,
        variabilityIndex: result.variabilityIndex,
        workKj: result.workKj,
        caloriesKcal: result.caloriesKcal,
        avgHeartRate: result.avgHeartRate,
        maxHeartRate: result.maxHeartRate,
        avgCadence: result.avgCadence,
        maxCadence: result.maxCadence,
        avgSpeedKmh: result.avgSpeedKmh,
        maxSpeedKmh: result.maxSpeedKmh,
        mmp: result.mmp,
        timeInPowerZones: result.timeInPowerZones,
        timeInHrZones: result.timeInHrZones,
        fileType: (ext as any) || 'fit',
        fileName: file.name,
        fileSize: file.size,
        hasHardwarePower: !result.isEstimatedPower,
        hasHeartRate: !!result.avgHeartRate,
        hasCadence: !!result.avgCadence,
        hasShifting: !!(result.shiftingEvents && result.shiftingEvents.length > 0),
        shiftCount: result.shiftCount,
        isEstimatedPower: result.isEstimatedPower,
        createdAt: Date.now()
      };

      await saveActivityToDb(record, result.points, result.shiftingEvents);
      setActiveLocalActivityId(actId);
      await refreshLocalActivities();

      showToast(
        `解析成功并已持久化入库！共包含 ${result.totalDistanceKm}km 骑行数据`,
        'success'
      );
    } catch (error: any) {
      showToast(error.message || '文件解析失败，请检查文件是否损坏', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBatchFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ext === 'fit' || ext === 'gpx' || ext === 'tcx';
    });

    if (fileArray.length === 0) {
      showToast('未检测到有效的 .fit, .gpx 或 .tcx 文件', 'warning');
      return;
    }

    setIsBatchModalOpen(true);
    try {
      const result = await batchIngestActivityFiles(
        fileArray,
        ftpWatts,
        weightKg,
        maxHr,
        (p) => setBatchProgress(p)
      );

      await refreshLocalActivities();

      if (result.successfulCount > 0) {
        showToast(`成功批量入库 ${result.successfulCount} 场活动！`, 'success');
        if (!analysis && result.importedRecords.length > 0) {
          handleLoadLocalActivity(result.importedRecords[0]);
        }
      } else if (result.skippedCount > 0) {
        showToast(`所有 ${result.skippedCount} 个文件已存在，已自动跳过重复`, 'info');
      }
    } catch (err: any) {
      showToast(`批量导入失败: ${err.message}`, 'error');
    }
  };

  const handleLoadLocalActivity = async (record: LocalActivityRecord) => {
    setIsLoading(true);
    try {
      showToast(`正在从本地时序库调出「${record.name}」...`, 'info');
      const stream = await getLocalActivityStream(record.id);
      const points: ActivityPoint[] = stream?.points || [];

      if (points.length > 0) {
        const parsed = analyzePoints(
          points,
          record.fileName || `${record.name}.${record.fileType}`,
          record.fileType === 'demo' ? 'demo' : (record.fileType as any) || 'fit',
          ftpWatts,
          weightKg,
          maxHr
        );
        if (stream?.shiftingEvents) {
          parsed.shiftingEvents = stream.shiftingEvents;
          parsed.shiftCount = stream.shiftingEvents.length;
        }
        setAnalysis(parsed);
      } else {
        const synthAnalysis: ActivityAnalysis = {
          fileName: record.fileName || `${record.name}.${record.fileType}`,
          fileType: record.fileType === 'demo' ? 'demo' : (record.fileType as any) || 'fit',
          totalDurationSec: record.totalDurationSec,
          movingTimeSec: record.movingTimeSec,
          totalDistanceKm: record.distanceKm,
          elevationGainM: record.elevationGainM,
          elevationLossM: record.elevationLossM,
          avgPower: record.avgPower,
          maxPower: record.maxPower,
          normalizedPower: record.normalizedPower,
          intensityFactor: record.intensityFactor,
          tss: record.tss,
          variabilityIndex: record.variabilityIndex,
          workKj: record.workKj,
          caloriesKcal: record.caloriesKcal || Math.round(record.workKj * 1.08),
          avgHeartRate: record.avgHeartRate,
          maxHeartRate: record.maxHeartRate,
          avgCadence: record.avgCadence,
          maxCadence: record.maxCadence,
          avgSpeedKmh: record.avgSpeedKmh,
          maxSpeedKmh: record.maxSpeedKmh,
          timeInPowerZones: record.timeInPowerZones || [],
          timeInHrZones: record.timeInHrZones || [],
          mmp: record.mmp,
          points: [],
          sampledPoints: []
        };
        setAnalysis(synthAnalysis);
      }
      setActiveLocalActivityId(record.id);
      setIsArchiveModalOpen(false);
      setActiveTab('trends');
      showToast(`已成功载入「${record.name}」！`, 'success');
    } catch (err: any) {
      showToast(`载入本地活动失败: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Consume incoming cross-tool transfer (e.g. from StravaDataCockpit)
  useEffect(() => {
    const pending = consumePendingTransfer<{ activityId: string; name?: string }>('solorider_pending_activity_analysis');
    if (pending && pending.activityId) {
      (async () => {
        try {
          const list = await getAllLocalActivities();
          const target = list.find(a => a.id === pending.activityId);
          if (target) {
            await handleLoadLocalActivity(target);
          }
        } catch {
          // Ignore transfer error
        }
      })();
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (e.dataTransfer.files.length > 1) {
        handleBatchFiles(e.dataTransfer.files);
      } else {
        handleFileUpload(e.dataTransfer.files[0]);
      }
    }
  };

  const handleLoadDemo = () => {
    setIsLoading(true);
    setTimeout(() => {
      const demo = generateRealisticDemoRide(ftpWatts, weightKg, maxHr);
      setAnalysis(demo);
      setIsLoading(false);
      showToast(
        '已成功加载千岛湖丘陵经典实测样本航迹！',
        'info'
      );
    }, 150);
  };

  // Format Helper: Seconds to HH:MM:SS
  const formatDuration = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  // Time-Series Trend Line Chart Data
  const trendChartData = useMemo(() => {
    if (!analysis) return { labels: [], datasets: [] };

    const pts = analysis.sampledPoints;
    const labels = pts.map(p => {
      const m = Math.floor(p.time / 60);
      const s = p.time % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    });

    const datasets: any[] = [];

    if (showPower) {
      datasets.push({
        type: 'line' as const,
        label: '功率 (W)',
        data: pts.map(p => p.power ?? null),
        borderColor: '#06b6d4', // cyan-500
        backgroundColor: 'rgba(6, 182, 212, 0.08)',
        fill: true,
        yAxisID: 'yPower',
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.1,
        order: 1
      });
    }

    if (showHeartRate) {
      datasets.push({
        type: 'line' as const,
        label: '心率 (bpm)',
        data: pts.map(p => p.heartRate ?? null),
        borderColor: '#f43f5e', // rose-500
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        yAxisID: 'yHr',
        pointRadius: 0,
        tension: 0.2,
        order: 2
      });
    }

    if (showElevation) {
      datasets.push({
        type: 'line' as const,
        label: '海拔 (m)',
        data: pts.map(p => p.altitude ?? null),
        borderColor: '#10b981', // emerald-500
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        fill: true,
        borderWidth: 1.2,
        yAxisID: 'yElevation',
        pointRadius: 0,
        tension: 0.2,
        order: 10
      });
    }

    if (showSpeed) {
      datasets.push({
        type: 'line' as const,
        label: '速度 (km/h)',
        data: pts.map(p => p.speed ?? null),
        borderColor: '#3b82f6', // blue-500
        backgroundColor: 'transparent',
        borderWidth: 1.2,
        yAxisID: 'ySpeed',
        pointRadius: 0,
        tension: 0.2,
        order: 3
      });
    }

    if (showCadence) {
      datasets.push({
        type: 'line' as const,
        label: '踏频 (rpm)',
        data: pts.map(p => p.cadence ?? null),
        borderColor: '#eab308', // yellow-500
        backgroundColor: 'transparent',
        borderWidth: 1.2,
        yAxisID: 'yCadence',
        pointRadius: 0,
        tension: 0.1,
        order: 4
      });
    }

    return { labels, datasets };
  }, [analysis, showPower, showHeartRate, showElevation, showSpeed, showCadence, language]);

  const trendChartOptions: any = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
      interaction: {
        mode: 'index',
        intersect: false
      },
      onHover: (_e: any, elements: any[]) => {
        if (elements && elements.length > 0) {
          setHoveredPointIndex(elements[0].index);
        } else {
          setHoveredPointIndex(null);
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(15, 23, 42, 0.94)',
          titleColor: '#38bdf8',
          bodyColor: '#f1f5f9',
          borderColor: 'rgba(255, 255, 255, 0.12)',
          borderWidth: 1,
          padding: 8,
          boxPadding: 4,
          cornerRadius: 10,
          titleFont: { size: 11, weight: 'bold' },
          bodyFont: { size: 10 },
          displayColors: true
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#8E8E93',
            maxTicksLimit: 6,
            font: { size: 10 }
          }
        },
        yPower: {
          type: 'linear',
          display: showPower,
          position: 'left',
          grid: { color: 'rgba(148, 163, 184, 0.08)' },
          ticks: {
            color: '#06b6d4',
            font: { size: 10 },
            maxTicksLimit: 5
          },
          title: {
            display: showPower && (!showSpeed || !showHeartRate),
            text: 'Watts',
            color: '#06b6d4',
            font: { size: 9, weight: 'bold' }
          }
        },
        yHr: {
          type: 'linear',
          display: showHeartRate,
          position: 'right',
          grid: { display: false },
          ticks: {
            color: '#f43f5e',
            font: { size: 10 },
            maxTicksLimit: 5
          },
          title: {
            display: showHeartRate && (!showCadence || !showPower),
            text: 'BPM',
            color: '#f43f5e',
            font: { size: 9, weight: 'bold' }
          }
        },
        ySpeed: {
          type: 'linear',
          display: showSpeed,
          position: !showPower ? 'left' : (!showHeartRate ? 'right' : 'left'),
          grid: {
            display: !showPower,
            color: 'rgba(148, 163, 184, 0.08)'
          },
          min: 0,
          max: (analysis?.maxSpeedKmh ? Math.max(50, Math.ceil(analysis.maxSpeedKmh * 1.15)) : 60),
          ticks: {
            color: '#3b82f6',
            font: { size: 10 },
            maxTicksLimit: 5
          },
          title: {
            display: !showPower || !showHeartRate,
            text: 'km/h',
            color: '#3b82f6',
            font: { size: 9, weight: 'bold' }
          }
        },
        yCadence: {
          type: 'linear',
          display: showCadence,
          position: !showHeartRate ? 'right' : (!showPower && !showSpeed ? 'left' : 'right'),
          grid: {
            display: !showPower && !showSpeed && !showHeartRate,
            color: 'rgba(148, 163, 184, 0.08)'
          },
          min: 0,
          max: (analysis?.maxCadence ? Math.max(120, Math.ceil(analysis.maxCadence * 1.1)) : 130),
          ticks: {
            color: '#eab308',
            font: { size: 10 },
            maxTicksLimit: 5
          },
          title: {
            display: !showHeartRate || (!showPower && !showSpeed),
            text: 'RPM',
            color: '#eab308',
            font: { size: 9, weight: 'bold' }
          }
        },
        yElevation: {
          type: 'linear',
          display: showElevation && (!showPower || !showHeartRate || (!showSpeed && !showCadence)),
          position: (!showPower && !showSpeed && !showCadence) ? 'left' : 'right',
          grid: {
            display: !showPower && !showSpeed && !showCadence,
            color: 'rgba(148, 163, 184, 0.08)'
          },
          ticks: {
            color: '#10b981',
            font: { size: 10 },
            maxTicksLimit: 5
          },
          title: {
            display: !showPower && !showSpeed && !showCadence,
            text: '米 (m)',
            color: '#10b981',
            font: { size: 9, weight: 'bold' }
          }
        }
      }
    };
  }, [showPower, showHeartRate, showElevation, showSpeed, showCadence, analysis]);

  // Coggan 7-Zone Bar Chart
  const powerZoneBarData = useMemo(() => {
    if (!analysis) return { labels: [], datasets: [] };
    const zones = analysis.timeInPowerZones;
    return {
      labels: zones.map(z => `${z.zone} ${z.label}`),
      datasets: [
        {
          label: '占比 (%)',
          data: zones.map(z => z.percent),
          backgroundColor: zones.map(z => z.color),
          borderRadius: 6
        }
      ]
    };
  }, [analysis, language]);

  // Heart Rate 5-Zone Bar Chart
  const hrZoneBarData = useMemo(() => {
    if (!analysis) return { labels: [], datasets: [] };
    const zones = analysis.timeInHrZones;
    return {
      labels: zones.map(z => `${z.zone} ${z.label}`),
      datasets: [
        {
          label: '占比 (%)',
          data: zones.map(z => z.percent),
          backgroundColor: zones.map(z => z.color),
          borderRadius: 6
        }
      ]
    };
  }, [analysis, language]);

  // Coggan benchmark duration interpolator
  const getBenchmarkWkgForDuration = (b: CogganBenchmarkLevel, sec: number): number => {
    if (sec <= 5) return b.wkg5s;
    if (sec <= 60) {
      const ratio = Math.log(sec / 5) / Math.log(60 / 5);
      return parseFloat((b.wkg5s + ratio * (b.wkg1m - b.wkg5s)).toFixed(1));
    }
    if (sec <= 300) {
      const ratio = Math.log(sec / 60) / Math.log(300 / 60);
      return parseFloat((b.wkg1m + ratio * (b.wkg5m - b.wkg1m)).toFixed(1));
    }
    if (sec <= 1200) {
      const ratio = Math.log(sec / 300) / Math.log(1200 / 300);
      return parseFloat((b.wkg5m + ratio * (b.wkg20m - b.wkg5m)).toFixed(1));
    }
    const ratio = Math.min(1, Math.log(sec / 1200) / Math.log(3600 / 1200));
    return parseFloat((b.wkg20m + ratio * (b.wkg60m - b.wkg20m)).toFixed(1));
  };

  // Skiba W' Balance anaerobic battery calculation
  const wPrimeResult: WPrimeBalanceResult | null = useMemo(() => {
    if (!analysis || !analysis.points || analysis.points.length === 0) return null;
    return calculateSkibaWPrimeBalance(analysis.points, cpWatts, wPrimeKj * 1000);
  }, [analysis, cpWatts, wPrimeKj]);

  // Rider phenotype analysis based on MMP profile
  const riderPhenotype = useMemo(() => {
    if (!analysis || !analysis.mmp || analysis.mmp.length === 0) return null;
    const m5s = analysis.mmp.find(m => m.durationSec === 5)?.wkg || 0;
    const m1m = analysis.mmp.find(m => m.durationSec === 60)?.wkg || 0;
    const m5m = analysis.mmp.find(m => m.durationSec === 300)?.wkg || 0;
    const m20m = analysis.mmp.find(m => m.durationSec === 1200)?.wkg || ((analysis.normalizedPower || 200) / (weightKg || 68));

    // Baseline benchmark scores relative to Cat 3 club standard
    const score5s = m5s / 15.2;
    const score1m = m1m / 7.3;
    const score5m = m5m / 4.3;
    const score20m = m20m / 3.7;

    const maxScore = Math.max(score5s, score1m, score5m, score20m);
    const minScore = Math.min(score5s, score1m, score5m, score20m);

    if (maxScore - minScore < 0.25) {
      return {
        type: 'all_rounder',
        title: language === 'zh-TW' ? '全能均衡型' : '全能均衡型',
        badgeColor: 'text-ios-blue bg-ios-blue/10 border-ios-blue/20',
        description: '冲刺、无氧摄氧与阈值巡航能力全面且均衡，能够从容应对多起伏丘陵、大组突围与平路追击等各类综合赛况。',
        trainingFocus: '建议保持全面素质，结合「训练课表工坊」针对短板（如 VO₂max 4x4 或 2x20 阈值）进行特定专项突破。'
      };
    }
    if (score5s === maxScore) {
      return {
        type: 'sprinter',
        title: language === 'zh-TW' ? '衝刺爆發型' : '冲刺爆发型',
        badgeColor: 'text-ios-pink bg-ios-pink/10 border-ios-pink/20',
        description: '瞬时神经肌肉爆发力极高，终点冲刺与短陡坡超车优势显著，具备优秀的无氧电量快速放电能力。',
        trainingFocus: '建议搭配「Ronnestad 30/15s 微间歇」提升抗乳酸恢复速度，并补充「Z2 基础耐力」避免后半程电量耗尽。'
      };
    }
    if (score1m === maxScore || score5m === maxScore) {
      return {
        type: 'puncher',
        title: language === 'zh-TW' ? '阿登突圍/陡坡型' : '阿登突围/陡坡型',
        badgeColor: 'text-ios-orange bg-ios-orange/10 border-ios-orange/20',
        description: '最大摄氧量 VO₂max 与抗乳酸能力突出，擅长 1~5 分钟的短陡坡爆击、反复突围拉扯与追赶。',
        trainingFocus: '可配合「Over-Under 乳酸清除间歇」与「4x4 VO₂max 课表」进一步强化乳酸穿梭再循环能力。'
      };
    }
    return {
      type: 'time_trialist',
      title: language === 'zh-TW' ? '計時賽/長坡巡航型' : '计时赛/长坡巡航型',
      badgeColor: 'text-ios-green bg-ios-green/10 border-ios-green/20',
      description: '功能阈值功率持续输出坚如磐石，有氧底蕴深厚，长距离平路巡航与稳态爬坡表现优异。',
      trainingFocus: '建议使用「2x20 经典阈值巡航」巩固推重比，同时适度补充「Tabata 冲刺」激活无氧能量池储备。'
    };
  }, [analysis, weightKg, language]);

  // Intelligent Targeted Workout Recommendation derived from ride telemetry & physiological deficits
  const smartWorkoutRecommendation = useMemo(() => {
    if (!analysis) return null;

    // 1. Aerobic Decoupling deficiency: Pw:HR > 5% indicates severe cardiac drift & insufficient aerobic base
    if (analysis.aerobicDecoupling !== undefined && analysis.aerobicDecoupling > 5.0) {
      const tmpl = WORKOUT_TEMPLATES.find(t => t.id === 'zone2_endurance') || WORKOUT_TEMPLATES[5];
      return {
        template: tmpl,
        deficiencyTitle: language === 'zh-TW' ? '有氧耐力脫節 · 心率漂移過大' : '有氧耐力脱节 · 心率漂移过大',
        deficiencyDesc: `本次骑行后程有氧解耦率高达 ${analysis.aerobicDecoupling}%。在同等踩踏功率下心率出现显著代偿性爬升，表明基础有氧能力、肌纤维抗疲劳度与线粒体容量亟待加强。`,
        actionAdvice: '推荐通过 90 分钟 Zone 2 恒定巡航课表，最大化脂肪氧化率，建立扎实有氧金字塔基石。'
      };
    }

    // Check MMP continuous power scores
    if (analysis.mmp && analysis.mmp.length > 0) {
      const m5s = analysis.mmp.find(m => m.durationSec === 5)?.wkg || 0;
      const m1m = analysis.mmp.find(m => m.durationSec === 60)?.wkg || 0;
      const m5m = analysis.mmp.find(m => m.durationSec === 300)?.wkg || 0;
      const m20m = analysis.mmp.find(m => m.durationSec === 1200)?.wkg || ((analysis.normalizedPower || 200) / (weightKg || 68));

      const score5s = m5s / 15.2;
      const score1m = m1m / 7.3;
      const score5m = m5m / 4.3;
      const score20m = m20m / 3.7;

      const minScore = Math.min(score5s, score1m, score5m, score20m);

      // 2. VO2max / Short climb surge deficiency
      if (minScore === score5m || minScore === score1m) {
        const tmpl = WORKOUT_TEMPLATES.find(t => t.id === 'ronnestad_30_15') || WORKOUT_TEMPLATES[0];
        return {
          template: tmpl,
          deficiencyTitle: language === 'zh-TW' ? '最大攝氧量儲備不足' : '最大摄氧量储备不足',
          deficiencyDesc: `本次骑行 1m~5m 相对推重比偏弱 (5m 推重比: ${m5m.toFixed(1)} W/kg)。面对急陡坡爆击或高强度拉扯突围时易进入急性缺氧力竭。`,
          actionAdvice: '推荐执行 Rønnestad 30/15s 微间歇或 4x4 min 高摄氧课表，快速提升左心室泵血输出与神经抗乳酸效率。'
        };
      }

      // 3. FTP / Sustained threshold cruise deficiency
      if (minScore === score20m) {
        const tmpl = WORKOUT_TEMPLATES.find(t => t.id === 'threshold_2x20') || WORKOUT_TEMPLATES[2];
        return {
          template: tmpl,
          deficiencyTitle: language === 'zh-TW' ? '乳酸閾值續航持久力不足' : '乳酸阈值续航持久力不足',
          deficiencyDesc: `本次骑行 20m 稳态功率或长坡表现相对滞后 (20m 推重比: ${m20m.toFixed(1)} W/kg)。乳酸拐点下的维持极限时间存在短板。`,
          actionAdvice: '推荐执行 2x20 min 经典阈值巡航或 Over-Under 乳酸清除课表，铁壁锚定阈值输出，拓展名山长爬坡统治力。'
        };
      }

      // 4. Sprint peak power deficiency
      if (minScore === score5s) {
        const tmpl = WORKOUT_TEMPLATES.find(t => t.id === 'tabata_sprint') || WORKOUT_TEMPLATES[4];
        return {
          template: tmpl,
          deficiencyTitle: language === 'zh-TW' ? '神經肌肉瞬時衝刺爆發力不足' : '神经肌肉瞬时冲刺爆发力不足',
          deficiencyDesc: `本次骑行 5s 神经肌肉峰值功率相对偏低 (5s 冲刺: ${m5s.toFixed(1)} W/kg)。无氧电量快速放电与高速抢位超车能力待唤醒。`,
          actionAdvice: '推荐执行 Tabata 20/10s 极致冲刺课表，激活快肌纤维运动神经元放电与 ATP-CP 供能效率。'
        };
      }
    }

    // 5. Default/Balanced: Over-Under lactate clearing
    const tmpl = WORKOUT_TEMPLATES.find(t => t.id === 'over_under_lactate') || WORKOUT_TEMPLATES[3];
    return {
      template: tmpl,
      deficiencyTitle: language === 'zh-TW' ? '綜合能力均衡 · 進階抗乳酸突破' : '综合能力均衡 · 进阶抗乳酸突破',
      deficiencyDesc: '各项生理区间推重比表现均衡，无明显单项短板。适合进入乳酸穿梭与动态抗乳酸进阶期，直接推升巡航天花板。',
      actionAdvice: '推荐执行 Over-Under 乳酸清除间歇，在乳酸生成与有氧清除的交替波动中强化学科级乳酸再循环利用能力。'
    };
  }, [analysis, weightKg, language]);

  const handleDispatchSmartWorkout = (targetTemplate?: WorkoutTemplate) => {
    const tmpl = targetTemplate || smartWorkoutRecommendation?.template || WORKOUT_TEMPLATES[0];
    const payload = {
      templateId: tmpl.id,
      title: `${tmpl.name} · 专属靶向补强`,
      reason: smartWorkoutRecommendation?.deficiencyTitle || '骑行诊断补强',
      segments: JSON.parse(JSON.stringify(tmpl.segments))
    };
    const ok = setPendingTransfer('solorider_pending_workout', payload);
    if (ok) {
      showToast('已生成专属靶向补强课表，正在跳转工坊...', 'success');
      if (onNavigateTool) {
        onNavigateTool('workout-builder');
      }
    } else {
      showToast('生成课表失败，请检查浏览器本地存储', 'error');
    }
  };

  // MMP Power Duration Envelopes across all local activities
  const mmpEnvelope90d = useMemo(() => {
    return computeMmpEnvelope(localActivities, weightKg, 90);
  }, [localActivities, weightKg]);

  const mmpEnvelopeAllTime = useMemo(() => {
    return computeMmpEnvelope(localActivities, weightKg, undefined);
  }, [localActivities, weightKg]);

  // PR Detection for the currently active ride
  const currentActivityPrs = useMemo(() => {
    if (!analysis || !analysis.mmp || analysis.mmp.length === 0) return null;
    return detectActivityPrs(analysis.mmp, localActivities, weightKg, activeLocalActivityId || undefined);
  }, [analysis, localActivities, weightKg, activeLocalActivityId]);

  // MMP Curve Chart Data with Coggan Benchmarks & Multi-Layer Envelopes
  const mmpChartData = useMemo(() => {
    if (!analysis && localActivities.length === 0) return { labels: [], datasets: [] };
    const baseMmp = analysis?.mmp && analysis.mmp.length > 0 ? analysis.mmp : mmpEnvelope90d;
    const labels = baseMmp.map(m => m.label);
    const isWkg = mmpUnit === 'wkg';
    const datasets: any[] = [];

    // Layer 1: Current Activity (if active & toggled)
    if (analysis && mmpShowCurrent) {
      datasets.push({
        type: 'line' as const,
        label: isWkg ? '本次活动 (W/kg)' : '本次活动 (W)',
        data: analysis.mmp.map(m => isWkg ? m.wkg : m.watts),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.18)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#8b5cf6',
        borderWidth: 2.5,
        order: 1
      });
    }

    // Layer 2: 90-Day Best Envelope (if toggled and data exists)
    if (mmpShow90d && localActivities.length > 0) {
      datasets.push({
        type: 'line' as const,
        label: isWkg ? '近90天最佳包络 (W/kg)' : '近90天最佳包络 (W)',
        data: mmpEnvelope90d.map(m => isWkg ? m.wkg : m.watts),
        borderColor: '#f59e0b',
        borderDash: [5, 3],
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.25,
        pointRadius: 3,
        pointBackgroundColor: '#f59e0b',
        borderWidth: 2,
        order: 2
      });
    }

    // Layer 3: All-Time Best Record (if toggled and data exists)
    if (mmpShowAllTime && localActivities.length > 0) {
      datasets.push({
        type: 'line' as const,
        label: isWkg ? '历史最佳纪录 (W/kg)' : '历史最佳纪录 (W)',
        data: mmpEnvelopeAllTime.map(m => isWkg ? m.wkg : m.watts),
        borderColor: '#ef4444',
        borderDash: [8, 4],
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.25,
        pointRadius: 3,
        pointBackgroundColor: '#ef4444',
        borderWidth: 2,
        order: 3
      });
    }

    // Layer 4: Coggan Benchmark Tiers
    const tiersToInclude = selectedCogganTier === 'all'
      ? COGGAN_BENCHMARKS
      : selectedCogganTier === 'none'
        ? []
        : COGGAN_BENCHMARKS.filter(b => b.level === selectedCogganTier);

    tiersToInclude.forEach(b => {
      datasets.push({
        type: 'line' as const,
        label: `${b.label} ${isWkg ? '(W/kg)' : '(W)'}`,
        data: baseMmp.map(m => {
          const wkgVal = getBenchmarkWkgForDuration(b, m.durationSec);
          return isWkg ? wkgVal : Math.round(wkgVal * weightKg);
        }),
        borderColor: b.color,
        borderDash: [5, 4],
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.25,
        pointRadius: 0,
        borderWidth: 1.5,
        order: 4
      });
    });

    return {
      labels,
      datasets
    };
  }, [analysis, localActivities, mmpShowCurrent, mmpShow90d, mmpShowAllTime, mmpEnvelope90d, mmpEnvelopeAllTime, mmpUnit, selectedCogganTier, weightKg]);

  // Skiba W' Balance Chart Data
  const wPrimeChartData = useMemo(() => {
    if (!wPrimeResult || !wPrimeResult.dataPoints || wPrimeResult.dataPoints.length === 0) {
      return { labels: [], datasets: [] };
    }
    const labels = wPrimeResult.dataPoints.map(p => formatDuration(p.timeSec));
    const wBalData = wPrimeResult.dataPoints.map(p => p.wBalPercent);
    const powerData = wPrimeResult.dataPoints.map(p => p.power);

    return {
      labels,
      datasets: [
        {
          type: 'line' as const,
          label: "W' 无氧剩余电量 (%)",
          data: wBalData,
          yAxisID: 'yWBal',
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          fill: true,
          tension: 0.2,
          pointRadius: 0,
          borderWidth: 2,
          order: 1
        },
        {
          type: 'line' as const,
          label: '实时输出功率 (W)',
          data: powerData,
          yAxisID: 'yPower',
          borderColor: 'rgba(59, 130, 246, 0.4)',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 1,
          order: 2
        }
      ]
    };
  }, [wPrimeResult]);

  // Coaching Insights Computation
  const coachingNotes = useMemo(() => {
    if (!analysis) return [];
    const notes: { type: 'success' | 'warning' | 'info'; title: string; desc: string }[] = [];

    // IF insight
    if (analysis.intensityFactor < 0.75) {
      notes.push({
        type: 'info',
        title: '恢复与基础耐力骑行 (L2为主)',
        desc: `本次骑行强度系数 IF 为 ${analysis.intensityFactor}，属于标准的有氧低压耐力骑行，促进线粒体增生且对肌肉神经系统破坏小。`
      });
    } else if (analysis.intensityFactor <= 0.90) {
      notes.push({
        type: 'success',
        title: '高效节奏与甜点训练',
        desc: `本次骑行强度系数 IF 为 ${analysis.intensityFactor}，训练刺激充分，是提升巡航能力与推重比的黄金区间。`
      });
    } else {
      notes.push({
        type: 'warning',
        title: '高负荷竞赛 / 极限抗乳酸骑行',
        desc: `本次骑行强度系数达到 ${analysis.intensityFactor}，接近或超越比赛工况，糖原消耗剧烈，建议 36-48 小时内以恢复骑或休息为主。`
      });
    }

    // VI insight
    if (analysis.variabilityIndex > 1.20) {
      notes.push({
        type: 'info',
        title: '高波动性输出 · VI > 1.20',
        desc: `变化指数 VI 达 ${analysis.variabilityIndex}，说明存在大量突围、陡坡踩踏与下坡滑行，属于典型的起伏赛道或绕圈进攻战术。`
      });
    } else if (analysis.variabilityIndex <= 1.06) {
      notes.push({
        type: 'success',
        title: '极平稳巡航配速 · VI ≤ 1.06',
        desc: `变化指数 VI 仅为 ${analysis.variabilityIndex}，动力输出平稳如钟摆，堪称计时赛教科书般的配速掌控。`
      });
    }

    // Decoupling insight
    if (analysis.aerobicDecoupling !== undefined) {
      if (Math.abs(analysis.aerobicDecoupling) <= 5.0) {
        notes.push({
          type: 'success',
          title: '极佳有氧耐力稳定性 (心率漂移 < 5%)',
          desc: `有氧解耦率仅为 ${analysis.aerobicDecoupling}%，后半段同等功率下心率几乎未发生代偿性漂移，说明有氧底子扎实、脱水控制极佳。`
        });
      } else {
        notes.push({
          type: 'warning',
          title: '后半程存在显著心率漂移 (心率漂移 > 5%)',
          desc: `后半程有氧解耦率达到 ${analysis.aerobicDecoupling}%，相同瓦数下心率显著爬升，可能由长距离疲劳、环境高温或电解质水化不足引起。`
        });
      }
    }

    return notes;
  }, [analysis, language]);

  // Social Share Poster State
  const [sharePosterUrl, setSharePosterUrl] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  const handleGeneratePoster = () => {
    if (!analysis) {
      showToast('请先加载或上传码表记录文件', 'warning');
      return;
    }
    try {
      const startDate = analysis.points?.[0]?.timestamp ? new Date(analysis.points[0].timestamp).toLocaleDateString() : new Date().toLocaleDateString();
      const url = generateFitActivityPoster({
        activityName: analysis.fileName?.replace(/\.[^/.]+$/, '') || '骑行活动深度复盘',
        dateStr: startDate,
        distanceKm: analysis.totalDistanceKm,
        durationStr: formatDuration(analysis.movingTimeSec),
        normalizedPower: analysis.normalizedPower,
        avgPower: analysis.avgPower,
        intensityFactor: analysis.intensityFactor,
        tss: analysis.tss,
        elevationGainM: analysis.elevationGainM,
        maxWatts: analysis.maxPower || 0,
        avgHeartRate: analysis.avgHeartRate || 0,
        calories: analysis.caloriesKcal || analysis.workKj || 0,
        powerZones: analysis.timeInPowerZones
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
        categoryIcon={LineChartIcon}
        title={language === 'zh-TW' ? '活動解析' : '活动解析'}
        description="纯前端离线直接解析 Garmin/Wahoo/迈金/行者/iGPSPORT 等码表生成的 .fit / .gpx / .tcx 活动文件。精准计算加权标准化功率、强度系数、训练压力、变化指数、效率因子、有氧解耦率及 Coggan 7 区时间驻留分布，数据绝不上云。"
        tint="red"
        onShare={handleGeneratePoster}
        shareTitle={language === 'zh-TW' ? '生成復盤海報' : '生成复盘海报'}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsArchiveModalOpen(true)}
              className="apple-touch h-9 px-3 rounded-xl bg-ios-blue/10 hover:bg-ios-blue/20 text-ios-blue font-bold text-xs border border-ios-blue/20 shadow-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              title="查看已持久化的本地活动时序库"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>{language === 'zh-TW' ? '本地檔案庫' : '本地档案库'} ({localActivities.length})</span>
            </button>

            <label className="apple-touch h-9 px-3 rounded-xl bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-semibold text-xs border border-slate-200/80 dark:border-white/10 shadow-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-ios-blue" />
              <span>批量导入</span>
              <input
                ref={batchFileInputRef}
                type="file"
                multiple
                accept=".fit,.gpx,.tcx"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleBatchFiles(e.target.files);
                  }
                }}
                className="hidden"
              />
            </label>

            <button
              onClick={handleLoadDemo}
              className="apple-touch h-9 px-3 sm:px-3.5 rounded-xl bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 font-semibold text-xs border border-slate-200/80 dark:border-white/10 shadow-xs transition flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 text-ios-red" />
              <span>{language === 'zh-TW' ? '載入樣本' : '加载样本'}</span>
            </button>
          </div>
        }
      />

      {/* File Upload Zone & Rider Anchor Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Upload Dropzone & Strava Quick Load Bar */}
        <div className="lg:col-span-2 space-y-3">
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="ios-card p-4 sm:p-5 rounded-2xl border-2 border-dashed border-slate-300/80 dark:border-white/20 hover:border-ios-blue dark:hover:border-ios-blue transition flex flex-col items-center justify-center text-center group cursor-pointer relative shadow-ios-card"
          >
            <input
              type="file"
              multiple
              accept=".fit,.gpx,.tcx"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  if (e.target.files.length > 1) {
                    handleBatchFiles(e.target.files);
                  } else {
                    handleFileUpload(e.target.files[0]);
                  }
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />

            <div className="w-11 h-11 rounded-xl bg-ios-blue/10 border border-ios-blue/20 text-ios-blue flex items-center justify-center mb-2.5 group-hover:scale-105 transition apple-touch">
              <Upload className="w-5 h-5" />
            </div>

            <div className="font-bold text-sm text-slate-800 dark:text-white">
              {'点击选择或拖拽码表文件至此（FIT / GPX / TCX）'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {'全面兼容佳明 Garmin、Wahoo、迈金、行者、iGPSPORT、百锐腾等各大主流品牌'}
            </div>

            {analysis && (
              <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ios-blue/10 border border-ios-blue/20 text-ios-blue text-xs font-mono">
                <CheckCircle2 className="w-3.5 h-3.5 text-ios-green" />
                <span className="font-semibold">{analysis.fileName}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-ios-blue text-white uppercase font-bold">{analysis.fileType}</span>
              </div>
            )}
          </div>

          {/* Strava Quick Select Bar (when connected) */}
          {isStravaConnected && stravaActivities.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.05] dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-xs">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#FC4C02]/15 text-[#FC4C02] flex items-center justify-center shrink-0">
                  <Cloud className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  从 Strava 快速选择骑行深度复盘:
                </span>
                <PoweredByStravaBadge />
              </div>

              <div className="flex items-center gap-2 flex-1 sm:max-w-md">
                <select
                  value={selectedStravaActivityId}
                  onChange={(e) => handleLoadStravaActivity(e.target.value)}
                  className="flex-1 h-9 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1.5 focus:ring-[#FC4C02]"
                >
                  <option value="">-- 选择近期 Strava 骑行 (共 {stravaActivities.length} 条) --</option>
                  {stravaActivities.slice(0, 30).map((act) => (
                    <option key={act.id} value={String(act.id)}>
                      {new Date(act.start_date_local || act.start_date).toLocaleDateString()} • {act.name} ({(act.distance / 1000).toFixed(0)}km | {act.tss || 0} TSS)
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => syncStravaActivities(false)}
                  disabled={isStravaSyncing}
                  className="apple-touch w-9 h-9 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] text-slate-600 dark:text-slate-300 text-xs shrink-0 flex items-center justify-center transition"
                  title="刷新 Strava 活动"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isStravaSyncing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Rider Physiological Anchor Card */}
        <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-ios-red" />
              {'车手基准生理参数'}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span>{language === 'zh-TW' ? '檔案體重' : '档案体重'}</span>
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{weightKg} kg</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">FTP (W)</label>
              <NumberStepper
                value={ftpWatts}
                onChange={setFtpWatts}
                min={50}
                max={600}
                step={5}
                unit="W"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">
                {language === 'zh-TW' ? '最大心率 (bpm)' : '最大心率 (bpm)'}
              </label>
              <NumberStepper
                value={maxHr}
                onChange={setMaxHr}
                min={120}
                max={240}
                step={1}
                unit="bpm"
              />
            </div>
          </div>

          <button
            onClick={handleProfileRecompute}
            className="w-full h-9 rounded-xl bg-slate-100/80 dark:bg-white/10 hover:bg-ios-red/10 hover:text-ios-red text-slate-700 dark:text-slate-300 text-xs font-semibold transition apple-touch flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{language === 'zh-TW' ? '更新分析' : '更新分析'}</span>
          </button>
        </div>
      </div>

      {/* Main Analysis Display */}
      {analysis && (
        <div className="space-y-4 sm:space-y-5">
          {/* Sensor Diagnostics Banner */}
          {analysis.sensorDiagnostics && (
            <FitSensorDiagnostics
              sensorDiagnostics={analysis.sensorDiagnostics}
              isEstimatedPower={analysis.isEstimatedPower}
              avgHeartRate={analysis.avgHeartRate}
              avgPower={analysis.avgPower}
              normalizedPower={analysis.normalizedPower}
              avgCadence={analysis.avgCadence}
              shiftCount={analysis.shiftingEvents?.length}
              language={language}
              onToggleEstimatedPower={handleToggleEstimatedPower}
            />
          )}

          {/* Key Metrics Grid */}
          <FitMetricsGrid
            analysis={analysis}
            weightKg={weightKg}
            language={language}
            formatDuration={formatDuration}
          />

          {/* Interactive Tabbed Navigation */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="w-full sm:max-w-md">
              <IOSSegmentedControl
                options={[
                  {
                    value: 'trends',
                    label: (
                      <>
                        <span className="sm:hidden">{language === 'zh-TW' ? '趨勢' : '趋势'}</span>
                        <span className="hidden sm:inline">{language === 'zh-TW' ? '時序趨勢' : '时序趋势'}</span>
                      </>
                    )
                  },
                  {
                    value: 'zones',
                    label: (
                      <>
                        <span className="sm:hidden">{language === 'zh-TW' ? '區間' : '区间'}</span>
                        <span className="hidden sm:inline">{language === 'zh-TW' ? '區間駐留' : '区间驻留'}</span>
                      </>
                    )
                  },
                  {
                    value: 'mmp',
                    label: (
                      <>
                        <span className="sm:hidden">MMP</span>
                        <span className="hidden sm:inline">{language === 'zh-TW' ? 'MMP 曲線' : 'MMP 曲线'}</span>
                      </>
                    )
                  },
                  ...(analysis.shiftingEvents && analysis.shiftingEvents.length > 0
                    ? [
                        {
                          value: 'shifting' as const,
                          label: (
                            <>
                              <span className="sm:hidden">{language === 'zh-TW' ? '變速' : '变速'}</span>
                              <span className="hidden sm:inline">{language === 'zh-TW' ? '電子變速' : '电子变速'}</span>
                            </>
                          )
                        }
                      ]
                    : []),
                  {
                    value: 'pmc',
                    label: (
                      <>
                        <span className="sm:hidden">PMC</span>
                        <span className="hidden sm:inline">{language === 'zh-TW' ? 'PMC 負荷' : 'PMC 负荷'}</span>
                      </>
                    )
                  },
                  {
                    value: 'coaching',
                    label: (
                      <>
                        <span className="sm:hidden">{language === 'zh-TW' ? '診斷' : '诊断'}</span>
                        <span className="hidden sm:inline">{language === 'zh-TW' ? '生理診斷' : '生理诊断'}</span>
                      </>
                    )
                  }
                ]}
                value={activeTab}
                onChange={(v) => setActiveTab(v as any)}
              />
            </div>
          </div>

          {/* TAB 1: Time-Series Trends */}
          {activeTab === 'trends' && (
            <FitTrendsTab
              language={language}
              currentScrubbedPoint={currentScrubbedPoint}
              totalDurationSec={analysis.totalDurationSec}
              avgPower={analysis.avgPower}
              avgHeartRate={analysis.avgHeartRate}
              elevationGainM={analysis.elevationGainM}
              avgSpeedKmh={analysis.avgSpeedKmh}
              avgCadence={analysis.avgCadence}
              showPower={showPower}
              setShowPower={setShowPower}
              showHeartRate={showHeartRate}
              setShowHeartRate={setShowHeartRate}
              showElevation={showElevation}
              setShowElevation={setShowElevation}
              showSpeed={showSpeed}
              setShowSpeed={setShowSpeed}
              showCadence={showCadence}
              setShowCadence={setShowCadence}
              onSetPresetChannels={setPresetChannels}
              isPhysiologyPreset={isPhysiologyPreset}
              isTransmissionPreset={isTransmissionPreset}
              isAllPreset={isAllPreset}
              trendChartData={trendChartData}
              trendChartOptions={trendChartOptions}
              setHoveredPointIndex={setHoveredPointIndex}
              formatDuration={formatDuration}
            />
          )}

          {/* TAB 2: Time in Zones */}
          {activeTab === 'zones' && (
            <FitZonesTab
              timeInPowerZones={analysis.timeInPowerZones}
              timeInHrZones={analysis.timeInHrZones}
              powerZoneBarData={powerZoneBarData}
              hrZoneBarData={hrZoneBarData}
              ftpWatts={ftpWatts}
              maxHr={maxHr}
              formatDuration={formatDuration}
            />
          )}

          {/* TAB 3: MMP Power Curve & Skiba W' Balance */}
          {activeTab === 'mmp' && (
            <FitMmpTab
              analysis={analysis}
              localActivities={localActivities}
              language={language}
              mmpUnit={mmpUnit}
              setMmpUnit={setMmpUnit}
              mmpSubView={mmpSubView}
              setMmpSubView={setMmpSubView}
              selectedCogganTier={selectedCogganTier}
              setSelectedCogganTier={setSelectedCogganTier}
              mmpShowCurrent={mmpShowCurrent}
              setMmpShowCurrent={setMmpShowCurrent}
              mmpShow90d={mmpShow90d}
              setMmpShow90d={setMmpShow90d}
              mmpShowAllTime={mmpShowAllTime}
              setMmpShowAllTime={setMmpShowAllTime}
              currentActivityPrs={currentActivityPrs}
              riderPhenotype={riderPhenotype}
              mmpChartData={mmpChartData}
              wPrimeResult={wPrimeResult}
              wPrimeChartData={wPrimeChartData}
              cpWatts={cpWatts}
              setCpWatts={setCpWatts}
              wPrimeKj={wPrimeKj}
              setWPrimeKj={setWPrimeKj}
              formatDuration={formatDuration}
              onNavigateTool={onNavigateTool}
              onOpenSmartWorkoutModal={() => setActiveTab('coaching')}
            />
          )}

          {/* TAB: Electronic Shifting Analysis */}
          {activeTab === 'shifting' && analysis.shiftingEvents && (
            <FitShiftingTab
              shiftingEvents={analysis.shiftingEvents}
              totalDistanceKm={analysis.totalDistanceKm}
              movingTimeSec={analysis.movingTimeSec}
              language={language}
            />
          )}

          {/* TAB 5: PMC (Performance Management Chart) */}
          {activeTab === 'pmc' && (
            <FitPmcTab
              localActivities={localActivities}
              stravaActivities={stravaActivities}
              isStravaConnected={isStravaConnected}
              isStravaSyncing={isStravaSyncing}
              syncStravaActivities={syncStravaActivities}
              analysisTss={analysis.tss}
              language={language}
            />
          )}

          {/* TAB 6: Coaching Insights & Targeted Workouts */}
          {activeTab === 'coaching' && (
            <FitCoachingTab
              coachingNotes={coachingNotes}
              smartWorkoutRecommendation={smartWorkoutRecommendation}
              workKj={analysis.workKj}
              caloriesKcal={analysis.caloriesKcal || analysis.workKj}
              onNavigateTool={onNavigateTool}
              onDispatchSmartWorkout={handleDispatchSmartWorkout}
            />
          )}
        </div>
      )}

      {/* Social Share Poster Modal */}
      <ShareCardModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        posterUrl={sharePosterUrl}
        fileName={`${analysis?.fileName?.replace(/\.[^/.]+$/, '') || 'Ride'}_复盘海报.png`}
        title="FIT 码表深度复盘海报"
      />

      {/* Local Activity Archive Modal */}
      <ActivityArchiveModal
        isOpen={isArchiveModalOpen}
        activities={localActivities}
        activeActivityId={activeLocalActivityId || undefined}
        ftpWatts={ftpWatts}
        weightKg={weightKg}
        maxHr={maxHr}
        onClose={() => setIsArchiveModalOpen(false)}
        onLoadActivity={handleLoadLocalActivity}
        onRefreshList={refreshLocalActivities}
      />

      {/* Batch Import Progress Modal */}
      <BatchImportModal
        isOpen={isBatchModalOpen}
        progress={batchProgress}
        onClose={() => setIsBatchModalOpen(false)}
      />
    </div>
  );
};
