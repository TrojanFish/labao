import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart as LineChartIcon,
  Upload,
  FileSpreadsheet,
  Activity,
  Zap,
  Heart,
  Timer,
  TrendingUp,
  Mountain,
  Flame,
  Award,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Gauge,
  Layers,
  BarChart3,
  Cloud,
  RefreshCw,
  Battery,
  Sliders,
  ArrowRight,
  Dumbbell,
  Cpu,
  X,
  FolderArchive
} from 'lucide-react';
import { PoweredByStravaBadge } from '../common/PoweredByStravaBadge';
import { WORKOUT_TEMPLATES, WorkoutTemplate, WorkoutSegment } from './WorkoutBuilder';
import { Line, Bar } from 'react-chartjs-2';
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
import { IOSCard, IOSMetricTile } from '../common/IOSCard';
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
import {
  generatePmcSeries,
  getTsbZoneInfo,
  predictTaperDays,
  PmcMesocycleType,
  PmcDayData,
  BaselineFitnessLevel,
  ManualTssEntry,
  BASELINE_FITNESS_OPTIONS,
  calculateContinuousSeasonPmc,
  PmcTimeRange,
  ContinuousPmcResult,
  SeasonPmcSummary
} from '../../utils/pmcCalculator';
import { useStrava } from '../../context/StravaContext';
import { StravaActivityRecord } from '../../utils/indexedDb';
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
  const [smartWorkoutModalOpen, setSmartWorkoutModalOpen] = useState<boolean>(false);
  const [selectedSmartTemplateId, setSelectedSmartTemplateId] = useState<string>('');
  const [pmcMesocycle, setPmcMesocycle] = useState<PmcMesocycleType>('build');
  const [targetTsbForPeak, setTargetTsbForPeak] = useState<number>(15);
  const [baselineFitness, setBaselineFitness] = useState<BaselineFitnessLevel>('club');
  const [manualTssEntries, setManualTssEntries] = useState<ManualTssEntry[]>(() => {
    try {
      const saved = localStorage.getItem('yolo_cycling_pmc_manual_tss');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [newManualTss, setNewManualTss] = useState<number>(80);
  const [newManualTitle, setNewManualTitle] = useState<string>('');
  const [newManualDayOffset, setNewManualDayOffset] = useState<number>(0);

  // Local-First Activity Database State
  const [localActivities, setLocalActivities] = useState<LocalActivityRecord[]>([]);
  const [activeLocalActivityId, setActiveLocalActivityId] = useState<string | null>(null);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState<boolean>(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<BatchImportProgress | null>(null);

  // PMC Real Season State
  const [pmcDataSource, setPmcDataSource] = useState<'local_history' | 'preset_mesocycle'>('local_history');
  const [pmcTimeRange, setPmcTimeRange] = useState<PmcTimeRange>('90d');
  const [futureProjectionDays, setFutureProjectionDays] = useState<number>(0);

  // MMP Multi-Layer Envelope State
  const [mmpShowCurrent, setMmpShowCurrent] = useState<boolean>(true);
  const [mmpShow90d, setMmpShow90d] = useState<boolean>(true);
  const [mmpShowAllTime, setMmpShowAllTime] = useState<boolean>(true);

  const refreshLocalActivities = async () => {
    try {
      const list = await getAllLocalActivities();
      setLocalActivities(list);
      if (list.length > 0) {
        setPmcDataSource('local_history');
      }
    } catch {
      // IndexedDB storage temporarily unavailable
    }
  };

  useEffect(() => {
    refreshLocalActivities();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('yolo_cycling_pmc_manual_tss', JSON.stringify(manualTssEntries));
    } catch {
      // LocalStorage quota or access exception
    }
  }, [manualTssEntries]);

  const handleAddManualTss = () => {
    const entry: ManualTssEntry = {
      id: Date.now().toString(),
      dayOffset: newManualDayOffset,
      tss: Math.max(1, newManualTss),
      title: newManualTitle.trim() || (newManualDayOffset === 0 ? '今日手动训练' : newManualDayOffset === -1 ? '昨日手动训练' : '前日手动训练')
    };
    setManualTssEntries(prev => [...prev.filter(e => e.dayOffset !== newManualDayOffset), entry]);
    setNewManualTitle('');
    showToast(`已成功录入 ${entry.tss} TSS 训练负荷！`, 'success');
  };

  const handleRemoveManualTss = (id: string) => {
    setManualTssEntries(prev => prev.filter(e => e.id !== id));
    showToast('已移除手动训练负荷', 'info');
  };

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

  // PMC Calculation (driven by continuous Local-First IndexedDB activities or simulated template)
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
      analysis?.tss,
      baselineFitness,
      manualTssEntries,
      isStravaConnected ? stravaActivities : undefined
    );
  }, [pmcMesocycle, analysis?.tss, baselineFitness, manualTssEntries, isStravaConnected, stravaActivities]);

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
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          borderWidth: 1.5,
          fill: true,
          tension: 0.3,
          pointRadius: 1,
          yAxisID: 'y1'
        }
      ]
    };
  }, [pmcData, language]);

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
    const tmpl = targetTemplate || (selectedSmartTemplateId ? WORKOUT_TEMPLATES.find(t => t.id === selectedSmartTemplateId) : smartWorkoutRecommendation?.template) || WORKOUT_TEMPLATES[0];
    const payload = {
      templateId: tmpl.id,
      title: `${tmpl.name} · 专属靶向补强`,
      reason: smartWorkoutRecommendation?.deficiencyTitle || '骑行诊断补强',
      segments: JSON.parse(JSON.stringify(tmpl.segments))
    };
    const ok = setPendingTransfer('solorider_pending_workout', payload);
    if (ok) {
      showToast('已生成专属靶向补强课表，正在跳转工坊...', 'success');
      setSmartWorkoutModalOpen(false);
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
            <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-ios-blue/10 text-ios-blue flex items-center justify-center shrink-0">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{language === 'zh-TW' ? '碼表傳感器接入與數據流診斷' : '码表传感器接入与数据流诊断'}</span>
                      {analysis.isEstimatedPower && (
                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-ios-amber/15 text-ios-amber border border-ios-amber/30">
                          {language === 'zh-TW' ? '⚡ 物理動力學仿真估算中' : '⚡ 物理动力学仿真估算中'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {language === 'zh-TW'
                        ? '深度解析 FIT 底層硬件通道配對與秒級採樣信號流'
                        : '深度解析 FIT 底层硬件通道配对与秒级采样信号流'}
                    </div>
                  </div>
                </div>

                {/* Power Reconstruction Action Button when hardware power is absent */}
                {!analysis.sensorDiagnostics.hasHardwarePower && (
                  <button
                    onClick={handleToggleEstimatedPower}
                    className={`apple-touch h-9 px-3.5 rounded-xl font-semibold text-xs transition flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-ios-sm ${
                      analysis.isEstimatedPower
                        ? 'bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10'
                        : 'bg-ios-blue hover:bg-ios-blue/90 text-white'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>
                      {analysis.isEstimatedPower
                        ? (language === 'zh-TW' ? '切換回硬件原始無功率數據' : '切换回硬件原始无功率数据')
                        : (language === 'zh-TW' ? '開啟物理動力學仿真估算功率' : '开启物理动力学仿真估算功率')}
                    </span>
                  </button>
                )}
              </div>

              {/* 4-Channel Status Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Heart Rate Channel */}
                <div className={`p-2.5 sm:p-3 rounded-xl border flex flex-col justify-between ${
                  analysis.sensorDiagnostics.hasHeartRate
                    ? 'bg-ios-green/5 border-ios-green/20'
                    : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200/60 dark:border-white/10'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 text-ios-red" />
                      {language === 'zh-TW' ? '心率通道' : '心率通道'}
                    </span>
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                      analysis.sensorDiagnostics.hasHeartRate
                        ? 'bg-ios-green/15 text-ios-green'
                        : 'bg-slate-200 dark:bg-white/10 text-slate-500'
                    }`}>
                      {analysis.sensorDiagnostics.hasHeartRate ? (language === 'zh-TW' ? '已記錄' : '已记录') : (language === 'zh-TW' ? '無信號' : '无信号')}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
                    {analysis.avgHeartRate ? `${analysis.avgHeartRate} bpm` : (language === 'zh-TW' ? '未連接心率帶' : '未连接心率带')}
                  </div>
                </div>

                {/* Shifting Channel */}
                <div className={`p-2.5 sm:p-3 rounded-xl border flex flex-col justify-between ${
                  analysis.sensorDiagnostics.hasShifting
                    ? 'bg-ios-purple/5 border-ios-purple/20'
                    : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200/60 dark:border-white/10'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-ios-purple" />
                      {language === 'zh-TW' ? '電子變速' : '电子变速'}
                    </span>
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                      analysis.sensorDiagnostics.hasShifting
                        ? 'bg-ios-purple/15 text-ios-purple'
                        : 'bg-slate-200 dark:bg-white/10 text-slate-500'
                    }`}>
                      {analysis.sensorDiagnostics.hasShifting ? (language === 'zh-TW' ? '已連接' : '已连接') : (language === 'zh-TW' ? '未連接' : '未连接')}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
                    {analysis.shiftCount ? `${analysis.shiftCount} ${language === 'zh-TW' ? '次換擋' : '次换挡'}` : (language === 'zh-TW' ? '無變速數據' : '无变速数据')}
                  </div>
                </div>

                {/* Power Channel */}
                <div className={`p-2.5 sm:p-3 rounded-xl border flex flex-col justify-between ${
                  analysis.sensorDiagnostics.hasHardwarePower
                    ? 'bg-ios-blue/5 border-ios-blue/20'
                    : analysis.isEstimatedPower
                    ? 'bg-ios-amber/5 border-ios-amber/20'
                    : 'bg-ios-orange/5 border-ios-orange/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-ios-blue" />
                      {language === 'zh-TW' ? '功率計通道' : '功率计通道'}
                    </span>
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                      analysis.sensorDiagnostics.hasHardwarePower
                        ? 'bg-ios-green/15 text-ios-green'
                        : analysis.isEstimatedPower
                        ? 'bg-ios-amber/15 text-ios-amber'
                        : 'bg-ios-orange/15 text-ios-orange'
                    }`}>
                      {analysis.sensorDiagnostics.hasHardwarePower
                        ? (language === 'zh-TW' ? '硬件採集' : '硬件采集')
                        : analysis.isEstimatedPower
                        ? (language === 'zh-TW' ? '物理估算' : '物理估算')
                        : (language === 'zh-TW' ? '無硬件數據' : '无硬件数据')}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
                    {analysis.sensorDiagnostics.hasHardwarePower
                      ? `${analysis.avgPower}W · NP ${analysis.normalizedPower}W`
                      : analysis.isEstimatedPower
                      ? `${analysis.avgPower}W · 估算 NP ${analysis.normalizedPower}W`
                      : (language === 'zh-TW' ? '硬件功率計離線' : '硬件功率计离线')}
                  </div>
                </div>

                {/* Cadence Channel */}
                <div className={`p-2.5 sm:p-3 rounded-xl border flex flex-col justify-between ${
                  analysis.sensorDiagnostics.hasHardwareCadence
                    ? 'bg-ios-green/5 border-ios-green/20'
                    : 'bg-ios-orange/5 border-ios-orange/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <RotateCcw className="w-3.5 h-3.5 text-ios-orange" />
                      {language === 'zh-TW' ? '踏頻傳感器' : '踏频传感器'}
                    </span>
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                      analysis.sensorDiagnostics.hasHardwareCadence
                        ? 'bg-ios-green/15 text-ios-green'
                        : 'bg-ios-orange/15 text-ios-orange'
                    }`}>
                      {analysis.sensorDiagnostics.hasHardwareCadence
                        ? (language === 'zh-TW' ? '已記錄' : '已记录')
                        : (language === 'zh-TW' ? '無硬件數據' : '无硬件数据')}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
                    {analysis.avgCadence ? `${analysis.avgCadence} rpm` : (language === 'zh-TW' ? '踏頻計離線' : '踏频计离线')}
                  </div>
                </div>
              </div>

              {/* Detailed Diagnostic Notes */}
              {analysis.sensorDiagnostics.detectedNotes.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/10 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {analysis.sensorDiagnostics.detectedNotes.map((note, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 text-ios-blue shrink-0 mt-0.5" />
                      <span>{note}</span>
                    </div>
                  ))}
                  {!analysis.sensorDiagnostics.hasHardwarePower && !analysis.isEstimatedPower && (
                    <div className="pt-1 text-[11px] text-ios-blue font-medium flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-ios-amber" />
                      <span>
                        {language === 'zh-TW'
                          ? '提示：您可以點擊右上角「開啟物理動力學仿真估算功率」按鈕，基於速度、坡度與質量模型還原騎行做功、NP 與 TSS。'
                          : '提示：您可以点击右上角「开启物理动力学仿真估算功率」按钮，基于速度、坡度与质量模型还原骑行做功、NP 与 TSS。'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5">
            <IOSMetricTile
              label="NP"
              value={analysis.normalizedPower}
              unit="W"
              subtext={`标准化功率 · ${(analysis.normalizedPower / (weightKg || 68)).toFixed(2)} W/kg${analysis.isEstimatedPower ? ' · 物理估算' : ''}`}
              theme={analysis.isEstimatedPower ? 'amber' : 'blue'}
              icon={<Zap className={`w-4 h-4 ${analysis.isEstimatedPower ? 'text-ios-amber' : 'text-ios-blue'}`} />}
            />
            <IOSMetricTile
              label="强度系数"
              value={analysis.intensityFactor}
              subtext={`${Math.round(analysis.intensityFactor * 100)}% FTP负荷${analysis.isEstimatedPower ? ' · 估算' : ''}`}
              theme="amber"
              icon={<Flame className="w-4 h-4 text-ios-orange" />}
            />
            <IOSMetricTile
              label="训练压力"
              value={analysis.tss}
              subtext={analysis.tss < 150 ? '低度疲劳' : analysis.tss < 300 ? '中度疲劳' : '重度负荷'}
              theme="purple"
              icon={<Award className="w-4 h-4 text-ios-purple" />}
            />
            <IOSMetricTile
              label="变化指数"
              value={analysis.variabilityIndex}
              subtext={analysis.variabilityIndex <= 1.05 ? '平稳巡航' : analysis.variabilityIndex <= 1.15 ? '起伏路段' : '高频突围'}
              theme="blue"
              icon={<TrendingUp className="w-4 h-4 text-ios-blue" />}
            />
            <IOSMetricTile
              label="里程与净骑行"
              value={analysis.totalDistanceKm}
              unit="km"
              subtext={`${formatDuration(analysis.movingTimeSec)} (${analysis.avgSpeedKmh} km/h)`}
              theme="green"
              icon={<Timer className="w-4 h-4 text-ios-green" />}
            />
            <IOSMetricTile
              label="累计爬升与做功"
              value={`+${analysis.elevationGainM}`}
              unit="m"
              subtext={`${analysis.workKj} kJ (${analysis.caloriesKcal} kcal${analysis.workKj === 0 && analysis.recordedCalories ? ' · 码表测算' : ''})`}
              theme="mint"
              icon={<Mountain className="w-4 h-4 text-ios-mint" />}
            />
          </div>

          {/* Secondary Biological & Efficiency Strip */}
          <div className="ios-card px-4 py-2.5 rounded-xl border border-slate-200/80 dark:border-white/10 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4 text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-ios-red" />
                <span>{'平均心率'}: <strong className="text-slate-900 dark:text-white tabular-nums">{analysis.avgHeartRate ?? '--'} bpm</strong></span>
                <span className="text-slate-400 text-[11px]">({'最高'} <span className="tabular-nums">{analysis.maxHeartRate ?? '--'}</span>)</span>
              </span>

              <span className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-ios-orange" />
                <span>{'平均踏频'}: <strong className="text-slate-900 dark:text-white tabular-nums">{analysis.avgCadence ?? '--'} rpm</strong></span>
                <span className="text-slate-400 text-[11px]">
                  ({'踩踏'} <span className="tabular-nums">{analysis.pedalingPercent ?? 100}%</span> · {'滑行'} <span className="tabular-nums">{100 - (analysis.pedalingPercent ?? 100)}%</span>)
                </span>
              </span>

              {analysis.leftRightBalance && (
                <span className="inline-flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-ios-teal" />
                  <span>{language === 'zh-TW' ? '雙邊平衡' : '双边平衡'}: <strong className="text-slate-900 dark:text-white tabular-nums">{analysis.leftRightBalance.leftPercent}% L / {analysis.leftRightBalance.rightPercent}% R</strong></span>
                  {Math.abs(analysis.leftRightBalance.leftPercent - 50) > 3 ? (
                    <span className="text-ios-amber text-[11px] font-medium">({language === 'zh-TW' ? '偏重' : '偏重'} {analysis.leftRightBalance.leftPercent > 50 ? '左' : '右'})</span>
                  ) : (
                    <span className="text-ios-green text-[11px] font-medium">({language === 'zh-TW' ? '均衡' : '均衡'})</span>
                  )}
                </span>
              )}

              {analysis.efficiencyFactor && (
                <span className="hidden sm:inline-flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-ios-blue" />
                  <span>{'效率因子'}: <strong className="text-ios-blue tabular-nums">{analysis.efficiencyFactor} W/bpm</strong></span>
                </span>
              )}

              {analysis.aerobicDecoupling !== undefined && (
                <span className="hidden sm:inline-flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-ios-purple" />
                  <span>{'有氧解耦率 (Pw:HR)'}: <strong className={`tabular-nums ${analysis.aerobicDecoupling > 5 ? 'text-ios-orange' : 'text-ios-green'}`}>{analysis.aerobicDecoupling}%</strong></span>
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {'总历时'}: <span className="tabular-nums">{formatDuration(analysis.totalDurationSec)}</span> · <span className="tabular-nums">{analysis.points.length}</span> {'个秒级采样点'}
            </div>
          </div>

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
            <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-3.5 select-none">
              {/* Header Bar with Scrubbed Time & Presets */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-black/[0.05] dark:border-white/[0.06] pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-2 h-2 rounded-full bg-ios-blue animate-pulse shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    {language === 'zh-TW' ? '多軌時序遙測曲線' : '多轨时序遥测曲线'}
                  </span>
                  {currentScrubbedPoint ? (
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-ios-blue/15 text-ios-blue border border-ios-blue/30 tabular-nums">
                      ⏱️ {formatDuration(currentScrubbedPoint.time)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                      0:00 ~ {formatDuration(analysis.totalDurationSec)}
                    </span>
                  )}
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    {language === 'zh-TW' ? '推薦組合:' : '推荐组合:'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPresetChannels('physiology')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold apple-touch transition ${
                      isPhysiologyPreset
                        ? 'bg-ios-blue text-white shadow-ios-sm'
                        : 'bg-black/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-black/[0.08]'
                    }`}
                  >
                    {language === 'zh-TW' ? '生理動力' : '生理动力'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetChannels('transmission')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold apple-touch transition ${
                      isTransmissionPreset
                        ? 'bg-ios-blue text-white shadow-ios-sm'
                        : 'bg-black/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-black/[0.08]'
                    }`}
                  >
                    {language === 'zh-TW' ? '巡航表現' : '巡航表现'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetChannels('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold apple-touch transition ${
                      isAllPreset
                        ? 'bg-ios-blue text-white shadow-ios-sm'
                        : 'bg-black/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-black/[0.08]'
                    }`}
                  >
                    {language === 'zh-TW' ? '全開' : '全开'}
                  </button>
                </div>
              </div>

              {/* 5-Channel Unified HUD & Toggle Controls */}
              <div className="grid grid-cols-5 gap-1 sm:gap-2 text-xs">
                {/* 1. Power */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setShowPower(!showPower);
                  }}
                  className={`apple-touch transition-all duration-150 rounded-xl px-1 sm:px-3 py-1.5 sm:py-2 flex flex-col items-center justify-center min-w-0 ${
                    showPower
                      ? 'bg-cyan-500 text-white shadow-ios-sm ring-1 ring-cyan-400/40'
                      : 'bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-slate-500 opacity-60 hover:opacity-80'
                  }`}
                  title={language === 'zh-TW' ? '功率通道開關' : '功率通道开关'}
                >
                  <div className="flex items-center gap-1 text-[11px] font-semibold leading-none truncate max-w-full">
                    <Zap className="w-3 h-3 shrink-0" />
                    <span className="truncate">{language === 'zh-TW' ? '功率' : '功率'}</span>
                  </div>
                  <div className="text-[10px] sm:text-xs font-bold tabular-nums mt-1 leading-tight truncate max-w-full">
                    {currentScrubbedPoint ? (
                      currentScrubbedPoint.power !== undefined ? `${currentScrubbedPoint.power}W` : '--'
                    ) : (
                      <>
                        <span>{analysis.avgPower}W</span>
                        <span className="text-[9px] opacity-75 ml-0.5 hidden sm:inline">均</span>
                      </>
                    )}
                  </div>
                </button>

                {/* 2. Heart Rate */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setShowHeartRate(!showHeartRate);
                  }}
                  className={`apple-touch transition-all duration-150 rounded-xl px-1 sm:px-3 py-1.5 sm:py-2 flex flex-col items-center justify-center min-w-0 ${
                    showHeartRate
                      ? 'bg-rose-500 text-white shadow-ios-sm ring-1 ring-rose-400/40'
                      : 'bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-slate-500 opacity-60 hover:opacity-80'
                  }`}
                  title={language === 'zh-TW' ? '心率通道開關' : '心率通道开关'}
                >
                  <div className="flex items-center gap-1 text-[11px] font-semibold leading-none truncate max-w-full">
                    <Heart className="w-3 h-3 shrink-0" />
                    <span className="truncate">{language === 'zh-TW' ? '心率' : '心率'}</span>
                  </div>
                  <div className="text-[10px] sm:text-xs font-bold tabular-nums mt-1 leading-tight truncate max-w-full">
                    {currentScrubbedPoint ? (
                      currentScrubbedPoint.heartRate ? `${currentScrubbedPoint.heartRate}` : '--'
                    ) : (
                      <>
                        <span>{analysis.avgHeartRate ?? '--'}</span>
                        <span className="text-[9px] opacity-75 ml-0.5 hidden sm:inline">均</span>
                      </>
                    )}
                  </div>
                </button>

                {/* 3. Elevation */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setShowElevation(!showElevation);
                  }}
                  className={`apple-touch transition-all duration-150 rounded-xl px-1 sm:px-3 py-1.5 sm:py-2 flex flex-col items-center justify-center min-w-0 ${
                    showElevation
                      ? 'bg-emerald-500 text-white shadow-ios-sm ring-1 ring-emerald-400/40'
                      : 'bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-slate-500 opacity-60 hover:opacity-80'
                  }`}
                  title={language === 'zh-TW' ? '海拔通道開關' : '海拔通道开关'}
                >
                  <div className="flex items-center gap-1 text-[11px] font-semibold leading-none truncate max-w-full">
                    <Mountain className="w-3 h-3 shrink-0" />
                    <span className="truncate">{language === 'zh-TW' ? '海拔' : '海拔'}</span>
                  </div>
                  <div className="text-[10px] sm:text-xs font-bold tabular-nums mt-1 leading-tight truncate max-w-full">
                    {currentScrubbedPoint ? (
                      currentScrubbedPoint.altitude !== undefined ? `${Math.round(currentScrubbedPoint.altitude)}m` : '--'
                    ) : (
                      <span>+{analysis.elevationGainM}m</span>
                    )}
                  </div>
                </button>

                {/* 4. Speed */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setShowSpeed(!showSpeed);
                  }}
                  className={`apple-touch transition-all duration-150 rounded-xl px-1 sm:px-3 py-1.5 sm:py-2 flex flex-col items-center justify-center min-w-0 ${
                    showSpeed
                      ? 'bg-blue-500 text-white shadow-ios-sm ring-1 ring-blue-400/40'
                      : 'bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-slate-500 opacity-60 hover:opacity-80'
                  }`}
                  title={language === 'zh-TW' ? '速度通道開關' : '速度通道开关'}
                >
                  <div className="flex items-center gap-1 text-[11px] font-semibold leading-none truncate max-w-full">
                    <Gauge className="w-3 h-3 shrink-0" />
                    <span className="truncate">{language === 'zh-TW' ? '速度' : '速度'}</span>
                  </div>
                  <div className="text-[10px] sm:text-xs font-bold tabular-nums mt-1 leading-tight truncate max-w-full">
                    {currentScrubbedPoint ? (
                      currentScrubbedPoint.speed !== undefined ? `${currentScrubbedPoint.speed.toFixed(1)}` : '--'
                    ) : (
                      <>
                        <span>{analysis.avgSpeedKmh}</span>
                        <span className="text-[9px] opacity-75 ml-0.5 hidden sm:inline">均</span>
                      </>
                    )}
                  </div>
                </button>

                {/* 5. Cadence */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('selection');
                    setShowCadence(!showCadence);
                  }}
                  className={`apple-touch transition-all duration-150 rounded-xl px-1 sm:px-3 py-1.5 sm:py-2 flex flex-col items-center justify-center min-w-0 ${
                    showCadence
                      ? 'bg-amber-500 text-white shadow-ios-sm ring-1 ring-amber-400/40'
                      : 'bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-slate-500 opacity-60 hover:opacity-80'
                  }`}
                  title={language === 'zh-TW' ? '踏頻通道開關' : '踏频通道开关'}
                >
                  <div className="flex items-center gap-1 text-[11px] font-semibold leading-none truncate max-w-full">
                    <RotateCcw className="w-3 h-3 shrink-0" />
                    <span className="truncate">{language === 'zh-TW' ? '踏頻' : '踏频'}</span>
                  </div>
                  <div className="text-[10px] sm:text-xs font-bold tabular-nums mt-1 leading-tight truncate max-w-full">
                    {currentScrubbedPoint ? (
                      currentScrubbedPoint.cadence !== undefined ? `${currentScrubbedPoint.cadence}` : '--'
                    ) : (
                      <>
                        <span>{analysis.avgCadence ?? '--'}</span>
                        <span className="text-[9px] opacity-75 ml-0.5 hidden sm:inline">均</span>
                      </>
                    )}
                  </div>
                </button>
              </div>

              {/* Chart Canvas with Scrubbing Touch Handlers */}
              <div
                className="h-72 sm:h-96 w-full touch-none select-none relative"
                onMouseLeave={() => setHoveredPointIndex(null)}
                onTouchEnd={() => setHoveredPointIndex(null)}
              >
                <Line data={trendChartData} options={trendChartOptions} />
              </div>
            </div>
          )}

          {/* TAB 2: Time in Zones */}
          {activeTab === 'zones' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
              {/* Coggan 7-Zone Power Distribution */}
              <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-ios-blue" />
                    {'Coggan 功率 7 区分布'}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">FTP: {ftpWatts}W</span>
                </div>

                <div className="h-56">
                  <Bar
                    data={powerZoneBarData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { ticks: { font: { size: 9 }, color: '#AEAEB2' } },
                        y: { ticks: { font: { size: 10 }, color: '#8E8E93' } }
                      }
                    }}
                  />
                </div>

                <div className="space-y-2">
                  {analysis.timeInPowerZones.map((z) => (
                    <div key={z.zone} className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: z.color }}></span>
                        <strong className="text-slate-800 dark:text-white">{z.zone} {z.label}</strong>
                        <span className="text-slate-400 text-[11px] tabular-nums">({z.range})</span>
                      </div>
                      <div className="font-mono flex items-center gap-3">
                        <span className="text-slate-500 tabular-nums">{formatDuration(z.seconds)}</span>
                        <span className="font-bold text-slate-900 dark:text-white min-w-[40px] text-right tabular-nums">{z.percent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Heart Rate 5-Zone Distribution */}
              <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Heart className="w-4 h-4 text-ios-red" />
                    {'心率 5 区分布'}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{'最大心率'}: {maxHr}bpm</span>
                </div>

                <div className="h-56">
                  <Bar
                    data={hrZoneBarData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { ticks: { font: { size: 9 }, color: '#AEAEB2' } },
                        y: { ticks: { font: { size: 10 }, color: '#8E8E93' } }
                      }
                    }}
                  />
                </div>

                <div className="space-y-2">
                  {analysis.timeInHrZones.map((z) => (
                    <div key={z.zone} className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: z.color }}></span>
                        <strong className="text-slate-800 dark:text-white">{z.zone} {z.label}</strong>
                        <span className="text-slate-400 text-[11px] tabular-nums">({z.range})</span>
                      </div>
                      <div className="font-mono flex items-center gap-3">
                        <span className="text-slate-500 tabular-nums">{formatDuration(z.seconds)}</span>
                        <span className="font-bold text-slate-900 dark:text-white min-w-[40px] text-right tabular-nums">{z.percent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MMP Power Curve & Skiba W' Balance */}
          {activeTab === 'mmp' && (
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
                    onChange={(v) => setMmpSubView(v as any)}
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
                            <button
                              type="button"
                              onClick={() => {
                                if (smartWorkoutRecommendation) {
                                  setSelectedSmartTemplateId(smartWorkoutRecommendation.template.id);
                                }
                                setSmartWorkoutModalOpen(true);
                              }}
                              className="apple-touch h-9 inline-flex items-center justify-center gap-1.5 px-3.5 rounded-xl bg-ios-red hover:bg-ios-red/90 text-white text-xs font-bold transition shadow-ios-sm active:scale-95"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>智能生成靶向补强课表</span>
                            </button>
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
          )}

          {/* TAB: Electronic Shifting Analysis */}
          {activeTab === 'shifting' && analysis.shiftingEvents && (
            <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="text-xs font-bold text-slate-850 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-ios-purple" />
                  <span>{language === 'zh-TW' ? '電子變速換擋深度解析' : '电子变速换挡深度解析'}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {language === 'zh-TW' ? '全程累計換擋' : '全程累计换挡'}: <strong className="text-slate-900 dark:text-white tabular-nums">{analysis.shiftingEvents.length}</strong> {language === 'zh-TW' ? '次' : '次'}
                </div>
              </div>

              {/* Shifting Metric Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/10">
                  <div className="text-[11px] text-slate-500">{language === 'zh-TW' ? '總換擋次數' : '总换挡次数'}</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">{analysis.shiftingEvents.length} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{language === 'zh-TW' ? '次' : '次'}</span></div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {analysis.totalDistanceKm > 0 ? `${(analysis.shiftingEvents.length / (analysis.totalDistanceKm / 10)).toFixed(1)} 次 / 10km` : '--'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/10">
                  <div className="text-[11px] text-slate-500">{language === 'zh-TW' ? '前撥換檔' : '前拨换挡'}</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                    {analysis.shiftingEvents.filter(e => e.frontGearNum !== undefined).length} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{language === 'zh-TW' ? '次' : '次'}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {language === 'zh-TW' ? '牙盤切換' : '牙盘切换'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/10">
                  <div className="text-[11px] text-slate-500">{language === 'zh-TW' ? '後撥換擋' : '后拨换挡'}</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                    {analysis.shiftingEvents.filter(e => e.rearGearNum !== undefined).length} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{language === 'zh-TW' ? '次' : '次'}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {language === 'zh-TW' ? '飛輪微調' : '飞轮微调'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/10">
                  <div className="text-[11px] text-slate-500">{language === 'zh-TW' ? '換擋頻率' : '换挡频率'}</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                    {analysis.movingTimeSec > 0 ? (analysis.shiftingEvents.length / (analysis.movingTimeSec / 3600)).toFixed(1) : '0'} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{language === 'zh-TW' ? '次/小時' : '次/小时'}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {language === 'zh-TW' ? '平均節奏調頻' : '平均节奏调频'}
                  </div>
                </div>
              </div>

              {/* Rear Gear Distribution Bar */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {language === 'zh-TW' ? '後撥檔位切換使用次數分佈 (Gear Index 1~12)' : '后拨档位切换使用次数分布 (Gear Index 1~12)'}
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(gNum => {
                    const count = analysis.shiftingEvents!.filter(e => e.rearGearNum === gNum).length;
                    const maxCount = Math.max(1, ...Array.from({ length: 12 }, (_, j) => analysis.shiftingEvents!.filter(e => e.rearGearNum === j + 1).length));
                    const pct = Math.round((count / maxCount) * 100);
                    return (
                      <div key={gNum} className="p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/10 text-center flex flex-col justify-between">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">{gNum}档</span>
                        <div className="h-10 w-full bg-slate-100 dark:bg-white/5 rounded-md flex items-end justify-center my-1 overflow-hidden">
                          <div
                            style={{ height: `${pct}%` }}
                            className={`w-full transition-all duration-300 ${count > 0 ? 'bg-ios-purple' : 'bg-transparent'}`}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 tabular-nums">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB: PMC (Performance Management Chart) */}
          {activeTab === 'pmc' && (
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
                        {language === 'zh-TW'
                          ? '體能管理模型'
                          : '体能管理模型'}
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
                          onClick={() => setFutureProjectionDays(prev => prev === 0 ? 14 : 0)}
                          className={`apple-touch px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                            futureProjectionDays > 0
                              ? 'bg-ios-purple text-white border-ios-purple shadow-xs font-bold'
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
                    <span className="text-[11px] font-semibold text-ios-blue block">
                      当前长期体能
                    </span>
                    <span className="text-2xl sm:text-3xl font-bold font-mono text-ios-blue block my-1 tabular-nums">
                      {latestPmcDay ? latestPmcDay.ctl : '--'}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">42 天滚动体能均线</span>
                  </div>

                  <div className="p-3 sm:p-3.5 rounded-xl bg-ios-orange/10 border border-ios-orange/20 text-center">
                    <span className="text-[11px] font-semibold text-ios-orange block">
                      当前急性疲劳
                    </span>
                    <span className="text-2xl sm:text-3xl font-bold font-mono text-ios-orange block my-1 tabular-nums">
                      {latestPmcDay ? latestPmcDay.atl : '--'}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">7 天短期负荷均线</span>
                  </div>

                  <div className="p-3 sm:p-3.5 rounded-xl bg-ios-green/10 border border-ios-green/20 text-center">
                    <span className="text-[11px] font-semibold text-ios-green block">
                      当前竞技状态
                    </span>
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
                      {pmcSummary ? pmcSummary.acwr : (analysis ? analysis.tss : '--')}
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
                      <span className="font-bold text-slate-800 dark:text-white">
                        时序统计宏观战报:
                      </span>
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
          )}

          {/* TAB 4: Physiological Coaching Insights */}
          {activeTab === 'coaching' && (
            <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-3.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-ios-blue" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {'自动化运动生理学诊断与复原窗口评估'}
                </h3>
              </div>

              <div className="space-y-3">
                {coachingNotes.map((note, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                      note.type === 'success'
                        ? 'bg-ios-green/10 border-ios-green/30 text-slate-900 dark:text-emerald-100'
                        : note.type === 'warning'
                        ? 'bg-ios-orange/10 border-ios-orange/30 text-slate-900 dark:text-amber-100'
                        : 'bg-ios-blue/10 border-ios-blue/30 text-slate-900 dark:text-sky-100'
                    }`}
                  >
                    {note.type === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 text-ios-green shrink-0 mt-0.5" />
                    ) : note.type === 'warning' ? (
                      <AlertTriangle className="w-5 h-5 text-ios-orange shrink-0 mt-0.5" />
                    ) : (
                      <Info className="w-5 h-5 text-ios-blue shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <div className="font-bold text-sm">{note.title}</div>
                      <div className="leading-relaxed opacity-90">{note.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Smart Targeted Workout Recommendation Card */}
              {smartWorkoutRecommendation && (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-ios-red/10 via-ios-orange/10 to-transparent border border-ios-red/25 space-y-3 shadow-ios-sm relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-ios-red/15 text-ios-red text-xs font-bold border border-ios-red/25">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>运动科学智能靶向补强推荐</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        短板诊断：{smartWorkoutRecommendation.deficiencyTitle}
                      </h4>
                    </div>

                    {onNavigateTool && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSmartTemplateId(smartWorkoutRecommendation.template.id);
                          setSmartWorkoutModalOpen(true);
                        }}
                        className="apple-touch self-start sm:self-auto shrink-0 h-9 inline-flex items-center gap-2 px-3.5 rounded-xl bg-ios-red hover:bg-ios-red/90 text-white font-bold text-xs shadow-ios-sm transition active:scale-95"
                      >
                        <Dumbbell className="w-4 h-4" />
                        <span>配置补强课表</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {smartWorkoutRecommendation.deficiencyDesc}
                  </p>

                  <div className="p-3 rounded-xl bg-white/80 dark:bg-white/5 border border-black/[0.04] dark:border-white/[0.08] flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">推荐专属科学课表</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {smartWorkoutRecommendation.template.name}
                      </span>
                    </div>
                    <span className="text-[11px] text-ios-red font-medium">
                      {smartWorkoutRecommendation.template.targetAdaptation}
                    </span>
                  </div>
                </div>
              )}

              {/* Recovery & Nutrition Advice */}
              <div className="p-3.5 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 text-xs space-y-2">
                <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-ios-orange" />
                  {'赛后糖原与肌肉超量恢复建议'}
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {`本次骑行累计机械做功 ${analysis.workKj} kJ（约消耗 ${analysis.caloriesKcal} kcal 热量）。建议骑行结束后 45 分钟黄金恢复窗口内摄入约 ${(analysis.caloriesKcal * 0.4 / 4).toFixed(0)}g 易吸收碳水化合物，配合 25g 优质乳清蛋白，促进肌糖原重组与肌原纤维合成。`}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Smart Workout Generator Modal */}
      {smartWorkoutModalOpen && smartWorkoutRecommendation && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 dark:bg-black/75 backdrop-blur-2xl animate-in fade-in duration-200">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-t-[28px] sm:rounded-2xl p-4 sm:p-5 border border-black/[0.06] dark:border-white/[0.08] shadow-ios-popover space-y-4 sm:space-y-5 bg-white dark:bg-[#1C1C1E] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-5">
            {/* iOS Bottom Sheet Drag Handle */}
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-neutral-600 mx-auto -mt-1 mb-1 sm:hidden shrink-0" />

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-ios-red text-white flex items-center justify-center shadow-ios-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    智能靶向补强课表生成
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    基于本次骑行真实心率、功率与疲劳数据生成
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSmartWorkoutModalOpen(false)}
                className="apple-touch w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Physiological Deficit Diagnosis Alert */}
            <div className="p-3.5 rounded-xl bg-ios-red/10 border border-ios-red/25 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-ios-red">
                <AlertTriangle className="w-4 h-4" />
                <span>生理学短板评估：{smartWorkoutRecommendation.deficiencyTitle}</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {smartWorkoutRecommendation.deficiencyDesc}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium pt-1">
                训练建议：{smartWorkoutRecommendation.actionAdvice}
              </p>
            </div>

            {/* Scientific Workout Template Selection */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>选择训练课表方案：</span>
                <span className="text-[11px] text-ios-red font-normal">已预选最匹配短板方案</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {WORKOUT_TEMPLATES.map((tmpl) => {
                  const isRecommended = tmpl.id === smartWorkoutRecommendation.template.id;
                  const isSelected = (selectedSmartTemplateId || smartWorkoutRecommendation.template.id) === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => setSelectedSmartTemplateId(tmpl.id)}
                      className={`p-3 rounded-xl border text-left transition relative apple-touch ${
                        isSelected
                          ? 'bg-ios-red/10 dark:bg-ios-red/20 border-ios-red text-slate-900 dark:text-white ring-2 ring-ios-red/30'
                          : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      {isRecommended && (
                        <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[11px] font-bold rounded-full bg-ios-red text-white shadow-2xs">
                          推荐
                        </span>
                      )}
                      <div className="font-bold text-xs pr-8">{tmpl.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{tmpl.subtitle}</div>
                      <div className="text-[11px] text-ios-red font-medium mt-1">{tmpl.categoryLabel}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Template Details Preview */}
            {(() => {
              const activeTmpl = WORKOUT_TEMPLATES.find(t => t.id === (selectedSmartTemplateId || smartWorkoutRecommendation.template.id)) || smartWorkoutRecommendation.template;
              return (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">{activeTmpl.name}</span>
                    <span className="font-mono text-slate-500">共 {activeTmpl.segments.length} 个结构化分段</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                    {activeTmpl.description}
                  </p>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    靶向适应：{activeTmpl.targetAdaptation}
                  </div>
                </div>
              );
            })()}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSmartWorkoutModalOpen(false)}
                className="apple-touch h-9 px-4 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => handleDispatchSmartWorkout()}
                className="apple-touch h-9 px-4.5 rounded-xl bg-ios-red hover:bg-ios-red/90 text-white text-xs font-bold shadow-ios-sm flex items-center gap-2 transition active:scale-95"
              >
                <Dumbbell className="w-4 h-4" />
                <span>载入课表工坊并开始训练</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
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
