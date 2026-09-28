import React, { useState, useMemo, useEffect } from 'react';
import { Mountain, Activity, Zap, Play, Plus, Trash2, Clock, ArrowUpRight, Flame, ShieldAlert, Award, CheckCircle2, TrendingUp, Upload, Search, ExternalLink, X, ChevronRight, Star, BookOpen } from 'lucide-react';
import { Line } from 'react-chartjs-2';
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
  Filler,
} from 'chart.js';
import { NumberStepper } from '../common/NumberStepper';
import { IOSCard, IOSCardHeader, IOSMetricTile } from '../common/IOSCard';
import { IOSToolHeader } from '../common/IOSToolHeader';
import { IOSSegmentedControl } from '../common/IOSSegmentedControl';
import { ShareCardModal } from '../common/ShareCardModal';
import { generateClimbPacingPoster } from '../../utils/shareCardGenerators';
import { useRiderProfile } from '../../context/RiderProfileContext';
import { useToast } from '../../context/ToastContext';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';
import { useStrava } from '../../context/StravaContext';
import { StravaSegmentItem } from '../../services/stravaService';
import { consumePendingTransfer } from '../../hooks/useToolDraftState';
import { calculateLapseRateAirDensity, calculateCorneringCentrifugalLimit } from '../../utils/routePacingEngine';

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

interface ClimbSegment {
  id: string;
  name: string;
  distanceKm: number;
  gradePct: number;
  customPowerTargetPct?: number; // % of FTP
}

// Distance calc helper
const distanceHaversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Intelligent auto-segmentation algorithm
const segmentizePoints = (rawPoints: { lat: number; lon: number; ele: number }[]): ClimbSegment[] => {
  if (rawPoints.length < 2) return [];

  let totalDistM = 0;
  const ptsWithDist: { distM: number; ele: number }[] = [{ distM: 0, ele: rawPoints[0].ele }];
  for (let i = 1; i < rawPoints.length; i++) {
    const d = distanceHaversine(rawPoints[i - 1].lat, rawPoints[i - 1].lon, rawPoints[i].lat, rawPoints[i].lon);
    totalDistM += d;
    ptsWithDist.push({ distM: totalDistM, ele: rawPoints[i].ele });
  }

  const numSegments = Math.min(7, Math.max(3, Math.round(totalDistM / 2200)));
  const segTargetDist = totalDistM / numSegments;

  const generatedSegments: ClimbSegment[] = [];
  let currentSegStartIdx = 0;

  for (let s = 1; s <= numSegments; s++) {
    const targetDist = s * segTargetDist;
    let endIdx = ptsWithDist.findIndex(p => p.distM >= targetDist);
    if (endIdx === -1 || s === numSegments) endIdx = ptsWithDist.length - 1;

    const startPt = ptsWithDist[currentSegStartIdx];
    const endPt = ptsWithDist[endIdx];
    const distKm = parseFloat(((endPt.distM - startPt.distM) / 1000).toFixed(1));
    const eleDiff = endPt.ele - startPt.ele;
    let gradePct = distKm > 0 ? parseFloat(((eleDiff / (distKm * 1000)) * 100).toFixed(1)) : 0;
    gradePct = Math.max(-15, Math.min(25, gradePct));

    let segTypeLabel = '平缓推进段';
    if (gradePct >= 9.5) segTypeLabel = '极限发卡急陡坡';
    else if (gradePct >= 6.8) segTypeLabel = '核心陡坡攻坚段';
    else if (gradePct >= 4.0) segTypeLabel = '持续盘山爬升段';
    else if (gradePct < 0) segTypeLabel = '起伏/下坡缓和段';

    generatedSegments.push({
      id: Date.now().toString() + s,
      name: `第${s}段: ${segTypeLabel} (${gradePct >= 0 ? '+' : ''}${gradePct}%)`,
      distanceKm: Math.max(0.2, distKm),
      gradePct: gradePct
    });

    currentSegStartIdx = endIdx;
  }

  return generatedSegments;
};

interface ClimbPacingPlannerProps {
  onNavigateTool?: (toolId: string) => void;
}

export const ClimbPacingPlanner: React.FC<ClimbPacingPlannerProps> = ({ onNavigateTool }) => {
  const { profile } = useRiderProfile();
  const { unitSystem, language } = useLanguageAndUnit();
  const { showToast } = useToast();

  const isImperial = unitSystem === 'imperial';

  const [riderWeight, setRiderWeight] = useState<number>(profile.weightKg || 68);
  const [bikeWeight, setBikeWeight] = useState<number>(profile.bikeWeightKg || 8.5);
  const [ftpWatts, setFtpWatts] = useState<number>(profile.ftpWatts || 240);

  // Reactively synchronize with global rider profile
  useEffect(() => {
    if (profile.weightKg) setRiderWeight(profile.weightKg);
    if (profile.bikeWeightKg) setBikeWeight(profile.bikeWeightKg);
    if (profile.ftpWatts) setFtpWatts(profile.ftpWatts);
  }, [profile.weightKg, profile.bikeWeightKg, profile.ftpWatts]);

  const { isConnected: isStravaConnected, getStarredSegments, getSegmentDetails } = useStrava();

  const [pacingStrategy, setPacingStrategy] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');

  const [segments, setSegments] = useState<ClimbSegment[]>([
    { id: '1', name: '起步缓坡过渡段', distanceKm: 2.0, gradePct: 4.5 },
    { id: '2', name: '核心陡坡攻坚段', distanceKm: 3.5, gradePct: 8.5 },
    { id: '3', name: '盘山连续发卡弯', distanceKm: 2.5, gradePct: 6.8 },
    { id: '4', name: '终点冲刺顶峰段', distanceKm: 1.5, gradePct: 5.2 },
  ]);

  const [climbName, setClimbName] = useState<string>('莫干山经典挑战爬坡线');

  // Share Poster State
  const [sharePosterUrl, setSharePosterUrl] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  // Strava Segments & KOM Modal State
  const [isStravaModalOpen, setIsStravaModalOpen] = useState<boolean>(false);
  const [stravaSegments, setStravaSegments] = useState<StravaSegmentItem[]>([]);
  const [isLoadingSegments, setIsLoadingSegments] = useState<boolean>(false);
  const [segmentSearchQuery, setSegmentSearchQuery] = useState<string>('');
  const [customSegmentInput, setCustomSegmentInput] = useState<string>('');
  const [isFetchingCustomId, setIsFetchingCustomId] = useState<boolean>(false);
  const [segmentFilterTab, setSegmentFilterTab] = useState<'all' | 'tour' | 'starred'>('all');

  // Open Strava Segments modal and fetch segments
  const handleOpenStravaSegments = async () => {
    setIsStravaModalOpen(true);
    setIsLoadingSegments(true);
    try {
      const segs = await getStarredSegments();
      setStravaSegments(segs);
    } catch {
      showToast('获取 Strava 赛段失败，请检查网络或授权状态', 'error');
    } finally {
      setIsLoadingSegments(false);
    }
  };

  // Import a segment (either curated or starred or by ID)
  const handleSelectSegment = (segment: StravaSegmentItem) => {
    if (segment.climbSegments && segment.climbSegments.length > 0) {
      const segs: ClimbSegment[] = segment.climbSegments.map((s, idx) => ({
        id: `${Date.now()}-${idx}`,
        name: s.name,
        distanceKm: s.distanceKm,
        gradePct: s.gradePct
      }));
      setSegments(segs);
    } else {
      const distKm = parseFloat((segment.distance / 1000).toFixed(1));
      const avgGrade = segment.average_grade;
      const maxGrade = segment.maximum_grade || Math.round(avgGrade * 1.6);

      const s1Dist = parseFloat((distKm * 0.25).toFixed(1));
      const s2Dist = parseFloat((distKm * 0.35).toFixed(1));
      const s3Dist = parseFloat((distKm * 0.25).toFixed(1));
      const s4Dist = Math.max(0.2, parseFloat((distKm - s1Dist - s2Dist - s3Dist).toFixed(1)));

      const generated: ClimbSegment[] = [
        {
          id: `${Date.now()}-1`,
          name: '第1段: 起步暖身过渡段',
          distanceKm: s1Dist,
          gradePct: parseFloat((avgGrade * 0.65).toFixed(1))
        },
        {
          id: `${Date.now()}-2`,
          name: '第2段: 核心稳态爬升段',
          distanceKm: s2Dist,
          gradePct: parseFloat((avgGrade * 1.05).toFixed(1))
        },
        {
          id: `${Date.now()}-3`,
          name: '第3段: 连续发卡攻坚陡坡',
          distanceKm: s3Dist,
          gradePct: parseFloat(Math.min(maxGrade, avgGrade * 1.35).toFixed(1))
        },
        {
          id: `${Date.now()}-4`,
          name: '第4段: 终点冲线顶峰段',
          distanceKm: s4Dist,
          gradePct: parseFloat((avgGrade * 0.9).toFixed(1))
        }
      ];
      setSegments(generated);
    }

    setClimbName(segment.name);
    setActiveMountainPreset('');
    setIsStravaModalOpen(false);
    showToast(
      language === 'zh-TW'
        ? `已成功從 Strava 匯入「${segment.name}」並完成配速分段拆解！`
        : `已成功从 Strava 导入「${segment.name}」并完成配速分段拆解！`,
      'success'
    );
  };

  const handleFetchCustomSegment = async () => {
    if (!customSegmentInput.trim()) return;

    const match = customSegmentInput.match(/(\d{4,12})/);
    if (!match) {
      showToast('请输入有效的 Strava 赛段 ID 或链接 (例如: 661401)', 'warning');
      return;
    }

    const segId = parseInt(match[1], 10);
    setIsFetchingCustomId(true);
    try {
      const details = await getSegmentDetails(segId);
      if (details) {
        const item: StravaSegmentItem = {
          id: details.id || segId,
          name: details.name || `Strava 赛段 #${segId}`,
          distance: details.distance || 5000,
          average_grade: details.average_grade || 6.5,
          maximum_grade: details.maximum_grade || 10.0,
          elevation_high: details.elevation_high || 800,
          elevation_low: details.elevation_low || 200,
          total_elevation_gain: details.total_elevation_gain || 600,
          climb_category: details.climb_category || 2,
          city: details.city,
          state: details.state,
          country: details.country,
          climbSegments: details.climbSegments
        };
        handleSelectSegment(item);
      } else {
        showToast(`未能获取赛段 #${segId} 数据，请确认 ID 是否正确或已授权 Strava`, 'error');
      }
    } catch (e: any) {
      showToast(`获取赛段失败: ${e.message}`, 'error');
    } finally {
      setIsFetchingCustomId(false);
    }
  };

  // Check for route transferred from RoadbookLibrary
  useEffect(() => {
    const pending = consumePendingTransfer<{ name?: string; waypoints?: any[] }>('solorider_pending_climb_route');
    if (pending && Array.isArray(pending.waypoints) && pending.waypoints.length >= 2) {
      const rawPts = pending.waypoints.map((wp: any) => ({
        lat: wp.lat,
        lon: wp.lng,
        ele: wp.elevation || 20
      }));
      const segs = segmentizePoints(rawPts);
      if (segs.length > 0) {
        setSegments(segs);
        if (pending.name) {
          setClimbName(pending.name);
        }
        showToast(
          language === 'zh-TW'
            ? `已根據路書「${pending.name || '外部路線'}」智能拆解為 ${segs.length} 個爬坡配速分段！`
            : `已根据路书「${pending.name || '外部路线'}」智能拆解为 ${segs.length} 个爬坡配速分段！`,
          'success'
        );
      }
    }
  }, [showToast, language]);

  // Manual GPX / TCX Climbing Route Upload & Intelligent Auto-segmentation
  const handleGpxClimbUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, 'text/xml');
        let trkpts = xmlDoc.getElementsByTagName('trkpt');
        if (trkpts.length === 0) trkpts = xmlDoc.getElementsByTagName('rtept');
        if (trkpts.length === 0) trkpts = xmlDoc.getElementsByTagName('Trackpoint');

        if (trkpts.length < 2) {
          showToast('未能识别到有效的 GPS 航迹点数据！', 'error', '请确认上传的是标准 .gpx / .tcx 爬坡路线文件');
          return;
        }

        interface RawPoint {
          lat: number;
          lon: number;
          ele: number;
        }
        const rawPoints: RawPoint[] = [];
        for (let i = 0; i < trkpts.length; i++) {
          const pt = trkpts[i];
          let lat = parseFloat(pt.getAttribute('lat') || '0');
          let lon = parseFloat(pt.getAttribute('lon') || '0');
          if (!lat) {
            const pos = pt.getElementsByTagName('Position')[0];
            if (pos) {
              lat = parseFloat(pos.getElementsByTagName('LatitudeDegrees')[0]?.textContent || '0');
              lon = parseFloat(pos.getElementsByTagName('LongitudeDegrees')[0]?.textContent || '0');
            }
          }
          const eleNode = pt.getElementsByTagName('ele')[0] || pt.getElementsByTagName('AltitudeMeters')[0];
          const ele = eleNode ? parseFloat(eleNode.textContent || '0') : 0;
          if (lat && lon) {
            rawPoints.push({ lat, lon, ele });
          }
        }

        if (rawPoints.length < 4) {
          showToast('轨迹点数量过少，无法进行高精度分段！', 'warning');
          return;
        }

        const generatedSegments = segmentizePoints(rawPoints);
        if (generatedSegments.length === 0) {
          showToast('无法生成有效的爬坡分段，请检查数据！', 'warning');
          return;
        }

        const totalDistKm = generatedSegments.reduce((acc, cur) => acc + cur.distanceKm, 0).toFixed(1);
        setSegments(generatedSegments);
        const parsedName = file.name.replace(/\.[^/.]+$/, '');
        setClimbName(parsedName);
        showToast('GPX 爬坡路线导入成功！', 'success', `已智能拆解为 ${generatedSegments.length} 个爬坡分段，总里程 ${totalDistKm}km`);
      } catch (err) {
        showToast('GPX 文件解析失败，请检查文件格式！', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const [activeMountainPreset, setActiveMountainPreset] = useState<string>('longjing');

  // Classic Mountain Presets (Domestic & International Grand Tours)
  const loadPreset = (key: string) => {
    setActiveMountainPreset(key);
    if (key === 'longjing') {
      setClimbName('杭州龙井问茶经典爬坡');
      setSegments([
        { id: '1', name: '龙井路口起步', distanceKm: 1.0, gradePct: 4.2 },
        { id: '2', name: '中段陡坡发卡弯', distanceKm: 1.4, gradePct: 7.8 },
        { id: '3', name: '翁家山顶峰冲刺', distanceKm: 0.8, gradePct: 5.5 }
      ]);
      showToast('已加载龙井问茶爬坡预设', 'info');
    } else if (key === 'miaofeng') {
      setClimbName('北京门头沟妙峰山经典路段');
      setSegments([
        { id: '1', name: '牌坊起步热身', distanceKm: 5.0, gradePct: 3.8 },
        { id: '2', name: '涧沟村前持续爬坡', distanceKm: 6.5, gradePct: 5.2 },
        { id: '3', name: '涧沟村发卡陡坡', distanceKm: 4.0, gradePct: 7.0 },
        { id: '4', name: '顶峰娘娘庙终点', distanceKm: 5.0, gradePct: 4.5 }
      ]);
      showToast('已加载北京妙峰山预设', 'info');
    } else if (key === 'tianhuang') {
      setClimbName('安吉天荒坪江南天池天路');
      setSegments([
        { id: '1', name: '大溪峡谷入山口', distanceKm: 4.0, gradePct: 4.5 },
        { id: '2', name: '长谷洞天连续弯道', distanceKm: 5.5, gradePct: 6.2 },
        { id: '3', name: '藏龙百瀑高坡段', distanceKm: 5.0, gradePct: 7.5 },
        { id: '4', name: '天池大坝冲顶', distanceKm: 3.5, gradePct: 4.8 }
      ]);
      showToast('已加载安吉天荒坪预设', 'info');
    } else if (key === 'balang') {
      setClimbName('川西巴朗山熊猫王国巅峰天路');
      setSegments([
        { id: '1', name: '邓生沟峡谷段 海拔2700m', distanceKm: 8.0, gradePct: 4.6 },
        { id: '2', name: '贝母坪高山草甸 海拔3400m', distanceKm: 10.0, gradePct: 5.8 },
        { id: '3', name: '巴朗山垭口冲顶 海拔4487m', distanceKm: 12.0, gradePct: 6.5 }
      ]);
      showToast('已加载巴朗山高原天路预设', 'info');
    } else if (key === 'alpedhuez') {
      setClimbName('环法·阿尔普迪埃 21道拐');
      setSegments([
        { id: '1', name: '谷底起步急升弯', distanceKm: 2.5, gradePct: 10.2 },
        { id: '2', name: '圣尼古拉森林路段', distanceKm: 4.5, gradePct: 8.5 },
        { id: '3', name: '于埃村中间平缓段', distanceKm: 3.5, gradePct: 7.2 },
        { id: '4', name: '终点滑雪场冲刺 1860m', distanceKm: 3.3, gradePct: 8.9 }
      ]);
      showToast('已加载环法阿尔普迪埃 21道拐预设', 'info');
    } else if (key === 'stelvio') {
      setClimbName('环意·斯泰尔维奥 48弯');
      setSegments([
        { id: '1', name: '特劳福伊入山口', distanceKm: 8.0, gradePct: 5.8 },
        { id: '2', name: '48道高山发卡弯攻坚', distanceKm: 9.0, gradePct: 8.2 },
        { id: '3', name: '终点雪山垭口冲顶 海拔2757m', distanceKm: 7.3, gradePct: 8.6 }
      ]);
      showToast('已加载环意最高殿堂斯泰尔维奥预设', 'info');
    } else if (key === 'sacalobra') {
      setClimbName('马略卡·卡洛布拉');
      setSegments([
        { id: '1', name: '海港峡湾起点盘旋', distanceKm: 2.5, gradePct: 6.5 },
        { id: '2', name: '悬崖岩石发卡急坡', distanceKm: 4.0, gradePct: 7.8 },
        { id: '3', name: '领带扣360度立交冲顶', distanceKm: 2.9, gradePct: 6.8 }
      ]);
      showToast('已加载马略卡骑行圣地卡洛布拉预设', 'info');
    }
  };

  // Base strategy factor on FTP
  const baseStrategyFactor = useMemo(() => {
    if (pacingStrategy === 'conservative') return 0.88; // 88% FTP (Z3 Tempo)
    if (pacingStrategy === 'balanced') return 0.96; // 96% FTP (SweetSpot/Threshold)
    return 1.05; // 105% FTP (Z4 Threshold/Z5)
  }, [pacingStrategy]);

  // Main Calculation Engine for Pacing & Climbing Physics
  const planResults = useMemo(() => {
    const g = 9.80665;
    const totalMass = riderWeight + bikeWeight;
    const crr = 0.0038;
    const cda = 0.32;
    const rho = 1.20;

    let accumulatedDistanceKm = 0;
    let accumulatedElevationM = 0;
    let totalSeconds = 0;
    let weightedPowerSeconds = 0;

    const segmentOutputs = segments.map((seg, idx) => {
      const eleGain = seg.distanceKm * 1000 * (seg.gradePct / 100);
      accumulatedElevationM += eleGain;

      // Scientific altitude lapse rate: temperature decreases ~0.65°C / 100m climb
      const midElevation = Math.max(0, accumulatedElevationM - eleGain / 2);
      const { localTempC, airDensityRho: rho } = calculateLapseRateAirDensity(midElevation, 0, 22);

      // Smart Gradient Pacing: on steep slopes (>7%), slightly increase power up to +6%, on gentle slopes (<4%), save energy
      let slopePacingMod = 1.0;
      if (seg.gradePct >= 8) slopePacingMod = 1.05;
      else if (seg.gradePct >= 6) slopePacingMod = 1.02;
      else if (seg.gradePct <= 3.5) slopePacingMod = 0.94;

      const targetWatts = Math.round(ftpWatts * baseStrategyFactor * slopePacingMod);
      const targetWkg = parseFloat((targetWatts / riderWeight).toFixed(2));
      const targetFtpPct = Math.round((targetWatts / ftpWatts) * 100);

      // Solve velocity for this segment: P = (F_g + F_r + F_a) * v
      const gradeRad = Math.atan(seg.gradePct / 100);
      const fGrav = totalMass * g * Math.sin(gradeRad);
      const fRoll = totalMass * g * Math.cos(gradeRad) * crr;

      let low = 0.5, high = 30, v = 3;
      for (let i = 0; i < 40; i++) {
        v = (low + high) / 2;
        const fAero = 0.5 * rho * cda * (v * v);
        const reqPower = (fGrav + fRoll + fAero) * v;
        if (reqPower < targetWatts) low = v;
        else high = v;
      }

      const speedKmh = parseFloat((v * 3.6).toFixed(1));
      const segSeconds = (seg.distanceKm / Math.max(1, speedKmh)) * 3600;
      totalSeconds += segSeconds;
      weightedPowerSeconds += targetWatts * segSeconds;

      const vam = Math.round(v * (seg.gradePct / 100) * 3600);
      const minutes = Math.floor(segSeconds / 60);
      const seconds = Math.round(segSeconds % 60);
      const timeStr = `${minutes}分${seconds < 10 ? '0' : ''}${seconds}秒`;

      accumulatedDistanceKm += seg.distanceKm;

      // Descent and hairpin centrifugal safety check
      const isSwitchbackOrDescent = seg.gradePct < 0 || seg.name.includes('发卡') || seg.name.includes('连续弯') || seg.name.includes('盘山');
      let cornerLimitKmh: number | undefined = undefined;
      let cornerWarning: string | undefined = undefined;
      if (isSwitchbackOrDescent) {
        const radius = seg.name.includes('发卡') ? 14 : 26;
        const lim = calculateCorneringCentrifugalLimit(radius, 'dry');
        cornerLimitKmh = lim.maxSpeedKmh;
        if (speedKmh > cornerLimitKmh || seg.gradePct < 0) {
          cornerWarning = lim.warning;
        }
      }

      // Cadence calculation under compact 34-34T ratio (~2.15m rollout)
      const estimatedCadenceRpm = Math.max(30, Math.round((speedKmh * 1000 / 60) / 2.15));
      const isSteepTorqueHazard = seg.gradePct >= 11 && estimatedCadenceRpm < 65;

      return {
        ...seg,
        eleGain: Math.round(eleGain),
        targetWatts,
        targetWkg,
        targetFtpPct,
        speedKmh,
        segSeconds,
        timeStr,
        vam,
        localTempC,
        airDensityRho: rho,
        cornerLimitKmh,
        cornerWarning,
        estimatedCadenceRpm,
        isSteepTorqueHazard,
        isOverThreshold: targetFtpPct > 102
      };
    });

    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalRemSeconds = Math.round(totalSeconds % 60);
    const totalHours = (totalSeconds / 3600).toFixed(2);
    const overallTimeStr = totalMinutes >= 60
      ? `${Math.floor(totalMinutes / 60)}小时${totalMinutes % 60}分${totalRemSeconds}秒`
      : `${totalMinutes}分${totalRemSeconds}秒`;

    const avgWatts = Math.round(weightedPowerSeconds / Math.max(1, totalSeconds));
    const avgWkg = parseFloat((avgWatts / riderWeight).toFixed(2));
    const overallVam = totalSeconds > 0 ? Math.round((accumulatedElevationM / totalSeconds) * 3600) : 0;
    const avgGrade = accumulatedDistanceKm > 0 ? parseFloat(((accumulatedElevationM / (accumulatedDistanceKm * 1000)) * 100).toFixed(1)) : 0;
    const hasSteepTorqueHazard = segmentOutputs.some(s => s.isSteepTorqueHazard);

    // Physiological Sustainability & Blowout (Critical Power / Exhaustion) Risk Calculation
    const intensityFactor = ftpWatts > 0 ? parseFloat((avgWatts / ftpWatts).toFixed(2)) : 1.0;
    const anaerobicWorkJoules = segmentOutputs
      .filter(s => s.targetWatts > ftpWatts)
      .reduce((sum, s) => sum + (s.targetWatts - ftpWatts) * s.segSeconds, 0);
    const anaerobicWorkKj = parseFloat((anaerobicWorkJoules / 1000).toFixed(1));

    let feasibilityStatus: 'safe' | 'challenging' | 'high_risk' = 'safe';
    let feasibilityTitle = '稳健可行 · 有氧主导巡航';
    let feasibilityAdvice = '全程目标功率维持在阈值以内或接近甜蜜区，糖原消耗可控，属于健康可持续的配速方案。';

    if (totalSeconds > 1800 && intensityFactor > 1.02) {
      // Climbing for > 30 minutes at > 102% FTP is physiologically impossible or extreme high blowout risk
      feasibilityStatus = 'high_risk';
      feasibilityTitle = '高危爆缸风险 · 超持续极限';
      feasibilityAdvice = `预计爬坡总耗时 ${overallTimeStr}，而全程规划均瓦达 ${Math.round(intensityFactor * 100)}% FTP，IF 达 ${intensityFactor}。根据临界功率生理模型，人类在 >100% FTP 的持续做功极限仅约 30~50 分钟。极易在后半程心率飙升爆表、双腿乳酸衰竭弃赛，强烈建议将配速策略下调至「均衡」或「稳健」！`;
    } else if (totalSeconds > 3600 && intensityFactor > 0.95) {
      feasibilityStatus = 'high_risk';
      feasibilityTitle = '超高负荷 · 极难持续到底';
      feasibilityAdvice = `持续 1 小时以上的长坡若设定均瓦超过 95% FTP，对糖原储备与耐乳酸要求极高，极难按计划执行到底，建议留出 5%~10% 的体能余量。`;
    } else if (intensityFactor > 0.98 || anaerobicWorkKj > 15) {
      feasibilityStatus = 'challenging';
      feasibilityTitle = '极限挑战 · 考验无氧储备';
      feasibilityAdvice = `超阈值分段累计做功达 ${anaerobicWorkKj} kJ（约耗费大部分 W' 无氧储备）。需依赖陡坡后的平缓段迅速排酸与深呼吸恢复，必须严格按照目标瓦数控制节奏。`;
    }

    return {
      totalDistanceKm: parseFloat(accumulatedDistanceKm.toFixed(1)),
      totalElevationM: Math.round(accumulatedElevationM),
      avgGrade,
      overallTimeStr,
      avgWatts,
      avgWkg,
      overallVam,
      hasSteepTorqueHazard,
      intensityFactor,
      anaerobicWorkKj,
      feasibilityStatus,
      feasibilityTitle,
      feasibilityAdvice,
      segmentOutputs
    };
  }, [segments, riderWeight, bikeWeight, ftpWatts, baseStrategyFactor]);

  // Chart dataset for Elevation Profile vs Target Power
  const chartData = useMemo(() => {
    const labels = planResults.segmentOutputs.map(s => s.name);
    return {
      labels,
      datasets: [
        {
          type: 'line' as const,
          label: '坡度 (%)',
          data: planResults.segmentOutputs.map(s => s.gradePct),
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          yAxisID: 'y1',
          tension: 0.2,
          pointRadius: 4,
          pointBackgroundColor: '#f59e0b'
        },
        {
          type: 'bar' as const,
          label: '建议输出功率 (W)',
          data: planResults.segmentOutputs.map(s => s.targetWatts),
          backgroundColor: 'rgba(0, 175, 255, 0.4)',
          borderColor: '#00AFFF',
          borderWidth: 1.5,
          borderRadius: 6,
          yAxisID: 'y',
        }
      ]
    };
  }, [planResults]);

  const addSegment = () => {
    const newId = (segments.length + 1).toString();
    setSegments(prev => [
      ...prev,
      { id: newId, name: `分段 #${newId}`, distanceKm: 2.0, gradePct: 6.0 }
    ]);
  };

  const removeSegment = (id: string) => {
    if (segments.length <= 1) return;
    setSegments(prev => prev.filter(s => s.id !== id));
  };

  const handleGeneratePoster = () => {
    const url = generateClimbPacingPoster({
      climbName,
      totalDistanceKm: planResults.totalDistanceKm,
      totalElevationM: planResults.totalElevationM,
      avgGrade: planResults.avgGrade,
      overallTimeStr: planResults.overallTimeStr,
      avgWatts: planResults.avgWatts,
      avgWkg: planResults.avgWkg,
      overallVam: planResults.overallVam,
      ftpWatts,
      segments: planResults.segmentOutputs.map(s => ({
        name: s.name,
        distanceKm: s.distanceKm,
        gradePct: s.gradePct,
        targetWatts: s.targetWatts,
        targetFtpPct: s.targetFtpPct,
        timeStr: s.timeStr
      }))
    });
    setSharePosterUrl(url);
    setIsShareModalOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Standard Apple HIG Tool Header */}
      <IOSToolHeader
        category={language === 'zh-TW' ? '動力與傳動' : '动力与传动'}
        categoryIcon={Mountain}
        title={language === 'zh-TW' ? '爬坡配速' : '爬坡配速'}
        description={
          language === 'zh-TW'
            ? '分段拆解爬坡路段坡度，結合 FTP 與推重比科學規劃各分段目標功率，預估登頂耗時與體能負荷。'
            : '分段拆解爬坡路段坡度，结合 FTP 与推重比科学规划各分段目标功率，预估登顶耗时与体能负荷。'
        }
        tint="blue"
        onShare={handleGeneratePoster}
        shareTitle={language === 'zh-TW' ? '生成名山爬坡攻堅海報' : '生成名山爬坡攻坚海报'}
        actions={
          <>
            {onNavigateTool && (
              <button
                type="button"
                onClick={() => onNavigateTool('roadbook')}
                className="apple-touch h-9 px-3.5 sm:px-4 rounded-xl bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200/80 dark:border-white/10 transition shadow-ios-sm flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                title="打开路书库挑选路线"
              >
                <BookOpen className="w-3.5 h-3.5 text-ios-teal shrink-0" />
                <span>{language === 'zh-TW' ? '路書庫' : '路书库'}</span>
              </button>
            )}

            <button
              onClick={handleOpenStravaSegments}
              className="apple-touch h-9 px-3.5 sm:px-4 rounded-xl bg-[#FC4C02]/10 hover:bg-[#FC4C02]/20 text-[#FC4C02] text-xs font-semibold border border-[#FC4C02]/25 transition shadow-ios-sm flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              title="从 Strava 检索赛段并导入"
            >
              <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.01 13.828h4.172" />
              </svg>
              <span>{language === 'zh-TW' ? 'Strava 賽段' : 'Strava 赛段'}</span>
            </button>

            <label className="apple-touch h-9 px-3.5 sm:px-4 rounded-xl bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200/80 dark:border-white/10 cursor-pointer transition shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0">
              <Upload className="w-3.5 h-3.5 text-ios-blue shrink-0" />
              <span className="hidden sm:inline">{language === 'zh-TW' ? '匯入 GPX 爬坡路線' : '导入 GPX 爬坡路线'}</span>
              <span className="sm:hidden">{language === 'zh-TW' ? '匯入 GPX' : '导入 GPX'}</span>
              <input type="file" accept=".gpx,.tcx,.xml" onChange={handleGpxClimbUpload} className="hidden" />
            </label>
          </>
        }
      />

      {/* Preset Mountains & Route Upload Bar */}
      <div className="ios-card p-3 rounded-2xl border border-slate-200/80 dark:border-white/10 flex flex-wrap items-center justify-between gap-2.5 shadow-ios-card">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {language === 'zh-TW' ? '精選名山:' : '精选名山:'}
          </span>
          <button
            onClick={handleOpenStravaSegments}
            className="flex items-center gap-1 h-9 px-3 rounded-xl text-xs font-bold transition shadow-ios-sm apple-touch border bg-[#FC4C02]/10 hover:bg-[#FC4C02]/20 text-[#FC4C02] border-[#FC4C02]/30 whitespace-nowrap shrink-0"
            title="浏览并导入 Strava 赛段与经典 KOM 坡度"
          >
            <svg className="w-3 h-3 fill-current shrink-0" viewBox="0 0 24 24">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.01 13.828h4.172" />
            </svg>
            <span>{language === 'zh-TW' ? 'Strava 賽段庫' : 'Strava 赛段库'}</span>
          </button>
          {[
            { id: 'longjing', name: '杭州龙井', title: '杭州龙井 3.2km' },
            { id: 'miaofeng', name: '北京妙峰山', title: '北京妙峰山 20.5km' },
            { id: 'tianhuang', name: '安吉天荒坪', title: '安吉天荒坪 18km' },
            { id: 'balang', name: '巴朗山', title: '巴朗山 30km' },
            { id: 'alpedhuez', name: '阿尔普迪埃', title: "环法殿堂阿尔普迪埃 21道拐 13.8km", isTour: true },
            { id: 'stelvio', name: '斯泰尔维奥', title: '环意最高峰斯泰尔维奥 48弯 24.3km', isTour: true },
            { id: 'sacalobra', name: '卡洛布拉', title: '马略卡骑行圣地卡洛布拉 9.4km', isTour: true },
          ].map((m) => {
            const isSelected = activeMountainPreset === m.id;
            return (
              <button
                key={m.id}
                onClick={() => loadPreset(m.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold transition shadow-ios-sm apple-touch border ${
                  isSelected
                    ? 'bg-ios-blue text-white border-ios-blue shadow-ios-sm font-bold'
                    : 'bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-white/10'
                }`}
                title={m.title}
              >
                {m.isTour && <Mountain className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-ios-blue'}`} />}
                <span>{m.name}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
            {language === 'zh-TW' ? '當前爬坡:' : '当前爬坡:'}
          </label>
          <input
            type="text"
            value={climbName}
            onChange={(e) => setClimbName(e.target.value)}
            className="w-full bg-white/80 dark:bg-black/40 border border-slate-200/80 dark:border-white/15 rounded-xl px-2.5 py-1 text-xs text-ios-blue font-semibold focus:outline-none focus:border-ios-blue"
          />
        </div>
      </div>

      {/* 4 Hero Metric Summary Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <IOSMetricTile
          label={language === 'zh-TW' ? '預計登頂總耗時' : '预计登顶总耗时'}
          value={planResults.overallTimeStr}
          unit=""
          subValue={`${planResults.totalDistanceKm} km`}
          accent="blue"
        />
        <IOSMetricTile
          label={language === 'zh-TW' ? '累計爬升高度' : '累计爬升高度'}
          value={`+${planResults.totalElevationM}`}
          unit="m"
          subValue={`${language === 'zh-TW' ? '平均坡度' : '平均坡度'} ${planResults.avgGrade}%`}
          accent="orange"
        />
        <IOSMetricTile
          label={language === 'zh-TW' ? '建議全程均瓦' : '建议全程均瓦'}
          value={planResults.avgWatts}
          unit="W"
          subValue={`${planResults.avgWkg} W/kg`}
          accent="green"
        />
        <IOSMetricTile
          label={language === 'zh-TW' ? '預估垂直升速' : '预估垂直升速'}
          value={planResults.overallVam}
          unit="m/h"
          subValue="VAM"
          accent="purple"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Left Inputs & Segments */}
        <div className="lg:col-span-5 space-y-4">
          {/* Rider Parameters */}
          <IOSCard variant="default" className="p-4 sm:p-5 space-y-4">
            <IOSCardHeader
              title={language === 'zh-TW' ? '車手功率與爬坡攻堅策略' : '车手功率与爬坡攻坚策略'}
              icon={Zap}
              iconColor="blue"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  {language === 'zh-TW' ? '車手 FTP 閾值功率' : '车手 FTP 阈值功率'} (W)
                </label>
                <NumberStepper value={ftpWatts} onChange={setFtpWatts} step={5} min={100} max={500} unit="W" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  {language === 'zh-TW' ? '車手體重' : '车手体重'} ({isImperial ? 'lbs' : 'kg'})
                </label>
                <NumberStepper
                  value={isImperial ? parseFloat((riderWeight * 2.20462).toFixed(1)) : riderWeight}
                  onChange={(v) => setRiderWeight(isImperial ? parseFloat((v / 2.20462).toFixed(1)) : v)}
                  step={isImperial ? 1 : 0.5}
                  min={isImperial ? 66 : 40}
                  max={isImperial ? 330 : 120}
                  unit={isImperial ? 'lbs' : 'kg'}
                  decimals={1}
                />
              </div>
            </div>

            {/* Pacing Strategy Segmented Control */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                {language === 'zh-TW' ? '攀爬攻堅策略激進度' : '攀爬攻坚策略激进度'}
              </label>
              <IOSSegmentedControl
                options={[
                  { value: 'conservative', label: language === 'zh-TW' ? '穩妥 (88%)' : '稳妥 (88%)' },
                  { value: 'balanced', label: language === 'zh-TW' ? '均衡 (96%)' : '均衡 (96%)' },
                  { value: 'aggressive', label: language === 'zh-TW' ? '極限 (105%)' : '极限 (105%)' }
                ]}
                value={pacingStrategy}
                onChange={(v) => setPacingStrategy(v as any)}
              />
            </div>
          </IOSCard>

          {/* Segments Editor */}
          <IOSCard variant="default" className="p-4 sm:p-5 space-y-4">
            <IOSCardHeader
              title={language === 'zh-TW' ? `爬坡路段分段拆解 (${segments.length} 個分段)` : `爬坡路段分段拆解 (${segments.length} 个分段)`}
              icon={Mountain}
              iconColor="blue"
              action={
                <button
                  onClick={addSegment}
                  className="apple-touch flex items-center gap-1 text-xs text-ios-blue hover:opacity-80 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {language === 'zh-TW' ? '添加分段' : '添加分段'}
                </button>
              }
            />

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {segments.map((seg, idx) => (
                <div key={seg.id} className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08] space-y-2.5">
                  <div className="flex justify-between items-center">
                    <input
                      type="text"
                      value={seg.name}
                      onChange={(e) => {
                        const copy = [...segments];
                        copy[idx].name = e.target.value;
                        setSegments(copy);
                      }}
                      className="text-xs font-bold text-slate-900 dark:text-slate-200 bg-transparent focus:outline-none focus:text-ios-blue flex-1 mr-2"
                    />
                    {segments.length > 1 && (
                      <button
                        onClick={() => removeSegment(seg.id)}
                        className="apple-touch text-slate-400 hover:text-rose-500 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                        {language === 'zh-TW' ? '分段長度' : '分段长度'} (km) {isImperial ? `(${(seg.distanceKm * 0.621371).toFixed(1)} mi)` : ''}
                      </span>
                      <NumberStepper
                        value={seg.distanceKm}
                        onChange={(v) => {
                          const copy = [...segments];
                          copy[idx].distanceKm = v;
                          setSegments(copy);
                        }}
                        step={0.5}
                        min={0.2}
                        max={30}
                        unit="km"
                        decimals={1}
                      />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                        {language === 'zh-TW' ? '平均坡度' : '平均坡度'} (%)
                      </span>
                      <NumberStepper
                        value={seg.gradePct}
                        onChange={(v) => {
                          const copy = [...segments];
                          copy[idx].gradePct = v;
                          setSegments(copy);
                        }}
                        step={0.5}
                        min={0.5}
                        max={25}
                        unit="%"
                        decimals={1}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </IOSCard>
        </div>

        {/* Right Output & Pacing Blueprint */}
        <div className="lg:col-span-7 space-y-4">
          {/* Visual Chart: Elevation Profile & Target Watts */}
          <IOSCard variant="default" className="p-4 sm:p-5 space-y-3">
            <IOSCardHeader
              title={language === 'zh-TW' ? '分段配速階梯' : '分段配速阶梯'}
              subtitle={language === 'zh-TW' ? '各分段坡度與目標功率動態擬合' : '各分段坡度与目标功率动态拟合'}
              icon={TrendingUp}
              iconColor="blue"
              action={<span className="text-slate-400 dark:text-slate-500 text-[11px] hidden sm:inline">*双坐标轴动态拟合</span>}
            />

            <div className="h-52">
              <Line
                data={chartData as any}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { font: { size: 10 } } },
                    y: {
                      type: 'linear' as const,
                      display: true,
                      position: 'left' as const,
                      grid: { color: 'rgba(255, 255, 255, 0.05)' },
                      title: { display: true, text: '功率 (W)', color: '#007aff', font: { size: 10 } }
                    },
                    y1: {
                      type: 'linear' as const,
                      display: true,
                      position: 'right' as const,
                      grid: { drawOnChartArea: false },
                      title: { display: true, text: '坡度 (%)', color: '#ff9500', font: { size: 10 } }
                    }
                  }
                }}
              />
            </div>
          </IOSCard>

          {/* Pacing Feasibility & Critical Power Blowout Risk Alert */}
          {planResults.feasibilityStatus !== 'safe' && (
            <div className={`ios-card p-4 rounded-2xl border flex items-start gap-3 shadow-ios-card ${
              planResults.feasibilityStatus === 'high_risk'
                ? 'border-ios-red/40 bg-ios-red/10'
                : 'border-amber-500/40 bg-amber-500/10'
            }`}>
              <ShieldAlert className={`w-5 h-5 shrink-0 mt-0.5 ${
                planResults.feasibilityStatus === 'high_risk' ? 'text-ios-red' : 'text-amber-500'
              }`} />
              <div className="space-y-1 text-xs">
                <div className="font-bold text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                  <span>{planResults.feasibilityTitle}</span>
                  <span className={`font-mono px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    planResults.feasibilityStatus === 'high_risk'
                      ? 'bg-ios-red/20 text-ios-red'
                      : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  }`}>
                    IF: {planResults.intensityFactor} · 超阈做功 {planResults.anaerobicWorkKj} kJ
                  </span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {planResults.feasibilityAdvice}
                </p>
              </div>
            </div>
          )}

          {/* Steep Slope Low-Cadence Torque Alert */}
          {planResults.hasSteepTorqueHazard && (
            <div className="ios-card p-4 rounded-2xl border border-ios-red/30 bg-ios-red/10 flex items-start gap-3 shadow-ios-card">
              <ShieldAlert className="w-5 h-5 text-ios-red shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{language === 'zh-TW' ? '陡坡極低踏頻與肌力負荷預警' : '陡坡极低踏频与肌力负荷预警'}</span>
                  <span className="font-mono px-2 py-0.5 bg-ios-red/20 text-ios-red rounded-full text-[11px] font-bold">
                    {'踏频 < 65 RPM'}
                  </span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {language === 'zh-TW'
                    ? '檢測到路線存在坡度 ≥11% 的攻堅分段！在常規 34-34T 齒比下，踩踏踏頻將逼近 60 RPM 甚至更低。極低踏頻重踏危害：將急劇加大膝蓋髕股關節剪切壓，引發局部乳酸暴增與抽筋。戰術建議：① 改裝 36T / 40T 爬坡大飛輪；② 進坡前提前拉高踏頻蓄勢；③ 採取「坐騎結合間歇站姿搖車」卸載股四頭肌峰值扭矩。'
                    : '检测到路线存在坡度 ≥11% 的攻坚分段！在常规 34-34T 齿比下，踩踏踏频将逼近 60 RPM 甚至更低。极低踏频重踏危害：将急剧加大膝盖髌股关节剪切压，引发局部肌酸暴增与抽筋。战术建议：① 改装 36T / 40T 爬坡大飞轮；② 进坡前提前拉高踏频蓄势；③ 采取「坐骑结合间歇站姿摇车」卸载股四头肌峰值扭矩。'}
                </p>
              </div>
            </div>
          )}

          {/* Descent & Hairpin Cornering Centrifugal Safety Alert */}
          {planResults.segmentOutputs.some(s => s.cornerWarning) && (
            <div className="ios-card p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3 shadow-ios-card">
              <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{language === 'zh-TW' ? '下坡與連續發卡彎離心制動安全預警' : '下坡与连续发卡弯离心制动安全预警'}</span>
                  <span className="font-mono px-2 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full text-[11px] font-bold">
                    离心限速
                  </span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {language === 'zh-TW'
                    ? '路線包含急彎或下坡分段！受輪胎地面側向附著力與離心力物理極限限制，入彎速度切勿超標。下坡進發卡彎前必須提前減速，彎中嚴禁猛捏前剎以防側滑失控。'
                    : '路线包含急弯或下坡分段！受轮胎地面侧向附着力与离心力物理极限限制，入弯速度切勿超标。下坡进发卡弯前必须提前减速，弯中严禁猛捏前刹以防侧滑失控。'}
                </p>
              </div>
            </div>
          )}

          {/* Segment Details Table */}
          <IOSCard variant="default" className="p-4 sm:p-5 space-y-3">
            <IOSCardHeader
              title={language === 'zh-TW' ? '功率執行方案' : '功率执行方案'}
              subtitle={language === 'zh-TW' ? '各路段功率目標與預計耗時明細' : '各路段功率目标与预计耗时明细'}
              icon={Activity}
              iconColor="blue"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-white/10 text-slate-500 dark:text-slate-400">
                    <th className="pb-2">{language === 'zh-TW' ? '分段名' : '分段名'}</th>
                    <th className="pb-2">{language === 'zh-TW' ? '距離 / 坡度' : '距离 / 坡度'}</th>
                    <th className="pb-2">{language === 'zh-TW' ? '建議功率' : '建议功率'}</th>
                    <th className="pb-2">{'推重比 / FTP%'}</th>
                    <th className="pb-2">{language === 'zh-TW' ? '預估踏頻' : '预估踏频'}</th>
                    <th className="pb-2">{language === 'zh-TW' ? '預估耗時' : '预估耗时'}</th>
                    <th className="pb-2">{'VAM'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 dark:divide-white/5 font-mono text-slate-700 dark:text-slate-300">
                  {planResults.segmentOutputs.map((s, idx) => (
                    <tr key={idx} className="hover:bg-black/5 dark:hover:bg-white/5 transition">
                      <td className="py-2.5 font-sans font-semibold text-slate-900 dark:text-white">
                        <div className="flex flex-col gap-1">
                          <span>{s.name}</span>
                          {s.cornerWarning && (
                            <span className="inline-flex items-center w-fit px-1.5 py-0.5 rounded-md text-[10px] font-sans font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400">
                              过弯限速 {s.cornerLimitKmh} km/h
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div>
                          {s.distanceKm}km {isImperial ? `(${(s.distanceKm * 0.621371).toFixed(1)}mi)` : ''} /{' '}
                          <span className="text-ios-orange font-bold">{s.gradePct}%</span>
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-sans tabular-nums block">
                          {s.localTempC}°C · ρ {s.airDensityRho}
                        </span>
                      </td>
                      <td className="text-ios-blue font-bold">{s.targetWatts} W</td>
                      <td>{s.targetWkg} W/kg ({s.targetFtpPct}%)</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          s.isSteepTorqueHazard
                            ? 'bg-ios-red/15 text-ios-red font-bold'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}>
                          ~{s.estimatedCadenceRpm} RPM
                        </span>
                      </td>
                      <td className="text-ios-green font-semibold">{s.timeStr}</td>
                      <td className="text-ios-purple">
                        {s.vam} m/h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </IOSCard>
        </div>
      </div>

      {/* Strava Segments & KOM Explorer Modal */}
      {isStravaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 dark:bg-black/75 backdrop-blur-2xl animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] rounded-t-[28px] sm:rounded-2xl w-full max-w-2xl max-h-[90vh] sm:max-h-[88vh] flex flex-col shadow-ios-popover overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 pb-safe sm:pb-0">
            {/* Mobile Sheet Drag Handle */}
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-neutral-600 mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-black/[0.05] dark:border-white/[0.08] flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FC4C02]/10 text-[#FC4C02] flex items-center justify-center">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.01 13.828h4.172" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{language === 'zh-TW' ? 'Strava 賽段與經典 KOM 智慧匯入' : 'Strava 赛段与经典 KOM 智能导入'}</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#FC4C02]/10 text-[#FC4C02] font-bold">
                      Segments
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {language === 'zh-TW'
                      ? '直接檢索 Strava 經典 KOM / 星標賽段，將坡度與里程自動拆解為科學配速區間'
                      : '直接检索 Strava 经典 KOM / 星标赛段，将坡度与里程自动拆解为科学配速区间'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsStravaModalOpen(false)}
                className="apple-touch text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Direct ID Import Bar */}
            <div className="p-3 sm:p-4 bg-slate-50 dark:bg-black/20 border-b border-slate-200/80 dark:border-white/10 space-y-2.5">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={segmentSearchQuery}
                    onChange={(e) => setSegmentSearchQuery(e.target.value)}
                    placeholder={language === 'zh-TW' ? '搜尋賽段名稱、城市或國家...' : '搜索赛段名称、城市或国家...'}
                    className="w-full bg-white dark:bg-[#1E1E22] border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2 sm:py-1.5 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-ios-blue"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={customSegmentInput}
                    onChange={(e) => setCustomSegmentInput(e.target.value)}
                    placeholder="输入赛段 ID，如 661401"
                    className="flex-1 sm:w-44 h-9 bg-white dark:bg-[#1E1E22] border border-slate-200 dark:border-white/10 rounded-xl px-3 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-[#FC4C02]"
                  />
                  <button
                    onClick={handleFetchCustomSegment}
                    disabled={isFetchingCustomId || !customSegmentInput.trim()}
                    className="apple-touch h-9 px-3.5 flex items-center justify-center rounded-xl bg-[#FC4C02] text-white text-xs font-semibold hover:bg-[#e04300] transition disabled:opacity-50 shrink-0 whitespace-nowrap"
                  >
                    {isFetchingCustomId ? '查询中' : '解析导入'}
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="overflow-x-auto no-scrollbar py-0.5">
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    onClick={() => setSegmentFilterTab('all')}
                    className={`px-3 py-1.5 rounded-xl transition apple-touch whitespace-nowrap ${
                      segmentFilterTab === 'all'
                        ? 'bg-black dark:bg-white text-white dark:text-black font-semibold shadow-xs'
                        : 'bg-white/80 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 font-medium border border-slate-200/60 dark:border-white/5'
                    }`}
                  >
                    全部赛段 ({stravaSegments.length})
                  </button>
                  <button
                    onClick={() => setSegmentFilterTab('tour')}
                    className={`px-3 py-1.5 rounded-xl transition apple-touch whitespace-nowrap ${
                      segmentFilterTab === 'tour'
                        ? 'bg-black dark:bg-white text-white dark:text-black font-semibold shadow-xs'
                        : 'bg-white/80 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 font-medium border border-slate-200/60 dark:border-white/5'
                    }`}
                  >
                    环法/环意传奇 KOM
                  </button>
                  <button
                    onClick={() => setSegmentFilterTab('starred')}
                    className={`px-3 py-1.5 rounded-xl transition apple-touch flex items-center gap-1 whitespace-nowrap ${
                      segmentFilterTab === 'starred'
                        ? 'bg-black dark:bg-white text-white dark:text-black font-semibold shadow-xs'
                        : 'bg-white/80 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10 font-medium border border-slate-200/60 dark:border-white/5'
                    }`}
                  >
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span>我的星标 ({stravaSegments.filter(s => s.starred).length})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Segments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[260px]">
              {isLoadingSegments ? (
                <div className="h-48 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <div className="w-6 h-6 border-2 border-[#FC4C02] border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">正在从 Strava 检索赛段数据...</span>
                </div>
              ) : (
                (() => {
                  const filtered = stravaSegments.filter(s => {
                    if (segmentFilterTab === 'starred' && !s.starred) return false;
                    if (segmentFilterTab === 'tour' && (s.country === 'China' || !s.country)) return false;
                    if (segmentSearchQuery.trim()) {
                      const q = segmentSearchQuery.toLowerCase();
                      const matchName = s.name.toLowerCase().includes(q);
                      const matchLoc = (s.city || '').toLowerCase().includes(q) || (s.country || '').toLowerCase().includes(q);
                      return matchName || matchLoc;
                    }
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="h-48 flex flex-col items-center justify-center gap-1.5 text-slate-400 text-xs">
                        <Mountain className="w-8 h-8 opacity-40 mb-1" />
                        <span>未找到匹配的赛段</span>
                        <span className="text-[11px] text-slate-500">
                          可直接在上方的输入框填入 Strava 赛段 ID 一键抓取
                        </span>
                      </div>
                    );
                  }

                  return filtered.map((seg) => {
                    const distKm = (seg.distance / 1000).toFixed(1);
                    const catLabel = seg.climb_category === 5 ? 'HC 级' : seg.climb_category > 0 ? `Cat ${5 - seg.climb_category}` : '爬坡段';

                    return (
                      <div
                        key={seg.id}
                        className="p-3.5 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/10 hover:border-[#FC4C02]/40 transition shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {seg.name}
                            </span>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-ios-orange/15 text-ios-orange font-bold whitespace-nowrap shrink-0">
                              {catLabel}
                            </span>
                            {seg.starred && (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-current" />
                                <span>已星标</span>
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            <span>里程: <strong className="text-slate-800 dark:text-slate-200">{distKm} km</strong></span>
                            <span>爬升: <strong className="text-slate-800 dark:text-slate-200">+{seg.total_elevation_gain} m</strong></span>
                            <span>均坡: <strong className="text-ios-orange">{seg.average_grade}%</strong></span>
                            {seg.maximum_grade ? (
                              <span>极陡: <strong className="text-ios-red">{seg.maximum_grade}%</strong></span>
                            ) : null}
                            {seg.country && (
                              <span className="text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 font-sans">
                                {seg.country} {seg.city ? `· ${seg.city}` : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <a
                            href={`https://www.strava.com/segments/${seg.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-xl text-slate-400 hover:text-[#FC4C02] hover:bg-[#FC4C02]/10 transition"
                            title="在 Strava 查看赛段主页"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>

                          <button
                            onClick={() => handleSelectSegment(seg)}
                            className="apple-touch px-3 py-1.5 rounded-xl bg-ios-blue hover:bg-ios-blue/90 text-white text-xs font-semibold flex items-center gap-1 transition active:scale-95 shadow-xs"
                          >
                            <span>导入配速分段</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-3.5 border-t border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="text-[11px] flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isStravaConnected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                <span>{isStravaConnected ? '已连接 Strava 官方 API' : '离线状态 · 可导入赛段 ID'}</span>
              </span>

              <button
                onClick={() => setIsStravaModalOpen(false)}
                className="apple-touch px-3.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Social Share Poster Modal */}
      <ShareCardModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        imageUrl={sharePosterUrl}
        title={language === 'zh-TW' ? '名山爬坡攻堅戰報' : '名山爬坡攻坚战报'}
        downloadFileName={`LaBao_爬坡配速_${climbName}.png`}
      />
    </div>
  );
};
