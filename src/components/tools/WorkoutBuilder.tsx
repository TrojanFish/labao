import React, { useState, useMemo, useEffect } from 'react';
import {
  Dumbbell,
  Play,
  Download,
  Copy,
  Plus,
  Trash2,
  Clock,
  Zap,
  Flame,
  Activity,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
  FileCode,
  RotateCcw,
  Sliders,
  Award,
  Calendar as CalendarIcon
} from 'lucide-react';
import { useRiderProfile } from '../../context/RiderProfileContext';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';
import { useToast } from '../../context/ToastContext';
import { IOSCard, IOSMetricTile } from '../common/IOSCard';
import { IOSToolHeader } from '../common/IOSToolHeader';
import { IOSSegmentedControl } from '../common/IOSSegmentedControl';
import { NumberStepper } from '../common/NumberStepper';
import { consumePendingTransfer, setPendingTransfer } from '../../hooks/useToolDraftState';
import { Tooltip } from '../common/Tooltip';
import { ShareCardModal } from '../common/ShareCardModal';
import { generateWorkoutPoster } from '../../utils/shareCardGenerators';
import {
  PlannedWorkout,
  loadPlannedWorkouts,
  savePlannedWorkouts,
  formatDateYMD
} from '../../utils/periodizationEngine';

export interface WorkoutBuilderProps {
  onNavigateTool?: (toolId: string) => void;
}

export type SegmentType = 'warmup' | 'steady' | 'interval' | 'cooldown' | 'ramp';

export interface WorkoutSegment {
  id: string;
  type: SegmentType;
  name: string;
  durationSec: number;
  powerStartPct: number; // 0.65 = 65% FTP
  powerEndPct: number;   // 0.65 = 65% FTP
  cadenceRpm?: number;
  // Repeat interval specifics
  repeatCount?: number;
  onDurationSec?: number;
  onPowerPct?: number;
  offDurationSec?: number;
  offPowerPct?: number;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  nameTw?: string;
  subtitle: string;
  subtitleTw?: string;
  category: 'vo2max' | 'threshold' | 'anaerobic' | 'endurance';
  categoryLabel: string;
  description: string;
  descriptionTw?: string;
  targetAdaptation: string;
  segments: WorkoutSegment[];
}

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'ronnestad_30_15',
    name: 'Rønnestad 30/15s 微间歇',
    nameTw: 'Rønnestad 30/15s 微間歇',
    subtitle: '挪威名宿方案 / 3组x13次 / 高摄氧低神经疲劳',
    subtitleTw: '挪威名宿方案 / 3組x13次 / 高攝氧低神經疲勞',
    category: 'vo2max',
    categoryLabel: '最大摄氧量 VO₂max',
    description: 'Bent R. Rønnestad 博士经典微间歇。3 组 x 13 次 (30s @ 125% FTP + 15s @ 50% FTP)，组间 3 分钟巡航。相比传统长间歇，微间歇能在积累极高 VO₂max 刺激时间的同时，大幅降低乳酸与神经系统破坏。',
    descriptionTw: 'Bent R. Rønnestad 博士經典微間歇。3 組 x 13 次 (30s @ 125% FTP + 15s @ 50% FTP)，組間 3 分鐘巡航。相比傳統長間歇，微間歇能在積累極高 VO₂max 刺激時間的同時，大幅降低乳酸與神經系統破壞。',
    targetAdaptation: 'VO₂max 最大摄氧量拓展 · 神经肌肉快速抗乳酸恢复',
    segments: [
      { id: '1', type: 'warmup', name: '渐进热身', durationSec: 600, powerStartPct: 0.50, powerEndPct: 0.75, cadenceRpm: 90 },
      { id: '2', type: 'steady', name: '准备踩踏', durationSec: 120, powerStartPct: 0.60, powerEndPct: 0.60, cadenceRpm: 90 },
      { id: '3', type: 'interval', name: '第 1 组 30/15s (13次)', durationSec: 585, powerStartPct: 1.25, powerEndPct: 1.25, repeatCount: 13, onDurationSec: 30, onPowerPct: 1.25, offDurationSec: 15, offPowerPct: 0.50, cadenceRpm: 100 },
      { id: '4', type: 'steady', name: '积极恢复 1', durationSec: 180, powerStartPct: 0.50, powerEndPct: 0.50, cadenceRpm: 85 },
      { id: '5', type: 'interval', name: '第 2 组 30/15s (13次)', durationSec: 585, powerStartPct: 1.25, powerEndPct: 1.25, repeatCount: 13, onDurationSec: 30, onPowerPct: 1.25, offDurationSec: 15, offPowerPct: 0.50, cadenceRpm: 100 },
      { id: '6', type: 'steady', name: '积极恢复 2', durationSec: 180, powerStartPct: 0.50, powerEndPct: 0.50, cadenceRpm: 85 },
      { id: '7', type: 'interval', name: '第 3 组 30/15s (13次)', durationSec: 585, powerStartPct: 1.25, powerEndPct: 1.25, repeatCount: 13, onDurationSec: 30, onPowerPct: 1.25, offDurationSec: 15, offPowerPct: 0.50, cadenceRpm: 100 },
      { id: '8', type: 'cooldown', name: '冷身排酸', durationSec: 600, powerStartPct: 0.65, powerEndPct: 0.45, cadenceRpm: 85 }
    ]
  },
  {
    id: 'norwegian_4x4',
    name: '4x4 min 挪威经典最大摄氧量',
    nameTw: '4x4 min 挪威經典最大攝氧量',
    subtitle: 'Helgerud & Hoff 协议 / 4组4分 / 心肺泵血重构',
    subtitleTw: 'Helgerud & Hoff 協議 / 4組4分 / 心肺泵血重構',
    category: 'vo2max',
    categoryLabel: '最大摄氧量 VO₂max',
    description: '挪威科技大学 Helgerud & Hoff 实验室金牌课表。4 组 4 分钟 @ 110% FTP，逼近 90-95% HRmax，组间 3 分钟积极恢复。被运动医学界证实为单位时间内提升左心室每搏输出量与摄氧量效率最高的手段之一。',
    descriptionTw: '挪威科技大學 Helgerud & Hoff 實驗室金牌課表。4 組 4 分鐘 @ 110% FTP，逼近 90-95% HRmax，組間 3 分鐘積極恢復。被運動醫學界證實為單位時間內提升左心室每搏輸出量與攝氧量效率最高的手法之一。',
    targetAdaptation: '心肌收缩力增强 · 最大心输出量 · 爬坡爆发力',
    segments: [
      { id: '1', type: 'warmup', name: '渐进热身', durationSec: 600, powerStartPct: 0.50, powerEndPct: 0.75, cadenceRpm: 90 },
      { id: '2', type: 'steady', name: '第 1 组 4min VO₂max', durationSec: 240, powerStartPct: 1.10, powerEndPct: 1.10, cadenceRpm: 95 },
      { id: '3', type: 'steady', name: '积极恢复 1', durationSec: 180, powerStartPct: 0.55, powerEndPct: 0.55, cadenceRpm: 85 },
      { id: '4', type: 'steady', name: '第 2 组 4min VO₂max', durationSec: 240, powerStartPct: 1.10, powerEndPct: 1.10, cadenceRpm: 95 },
      { id: '5', type: 'steady', name: '积极恢复 2', durationSec: 180, powerStartPct: 0.55, powerEndPct: 0.55, cadenceRpm: 85 },
      { id: '6', type: 'steady', name: '第 3 组 4min VO₂max', durationSec: 240, powerStartPct: 1.10, powerEndPct: 1.10, cadenceRpm: 95 },
      { id: '7', type: 'steady', name: '积极恢复 3', durationSec: 180, powerStartPct: 0.55, powerEndPct: 0.55, cadenceRpm: 85 },
      { id: '8', type: 'steady', name: '第 4 组 4min VO₂max', durationSec: 240, powerStartPct: 1.10, powerEndPct: 1.10, cadenceRpm: 95 },
      { id: '9', type: 'cooldown', name: '冷身排酸', durationSec: 600, powerStartPct: 0.60, powerEndPct: 0.40, cadenceRpm: 85 }
    ]
  },
  {
    id: 'threshold_2x20',
    name: '2x20 min 经典乳酸阈值巡航',
    nameTw: '2x20 min 經典乳酸閾值巡航',
    subtitle: '公路计时赛/长爬坡基石 / 2组20分 / FTP 铁壁锚定',
    subtitleTw: '公路計時賽/長爬坡基石 / 2組20分 / FTP 鐵壁錨定',
    category: 'threshold',
    categoryLabel: '乳酸阈值 FTP',
    description: '所有耐力车手的奠基经典。2 组 20 分钟 @ 98% FTP（组间 5 分钟轻度巡航）。极强的心智毅力与肌肉耐酸磨练，直接拓展 TTE 极限维持时长，是计时赛与名山大坡的绝对制胜王牌。',
    descriptionTw: '所有耐力車手的奠基經典。2 組 20 分鐘 @ 98% FTP（組間 5 分鐘輕度巡航）。極強的心智毅力與肌肉耐酸磨練，直接拓展 TTE 極限維持時長，是計時賽與名山大坡的絕對制勝王牌。',
    targetAdaptation: '功能阈值功率 TTE 延展 · 抗疲劳耐受力 · 心理坚韧度',
    segments: [
      { id: '1', type: 'warmup', name: '渐进热身', durationSec: 900, powerStartPct: 0.50, powerEndPct: 0.80, cadenceRpm: 90 },
      { id: '2', type: 'steady', name: '第 1 组 20min 阈值', durationSec: 1200, powerStartPct: 0.98, powerEndPct: 0.98, cadenceRpm: 92 },
      { id: '3', type: 'steady', name: '间歇恢复', durationSec: 300, powerStartPct: 0.55, powerEndPct: 0.55, cadenceRpm: 85 },
      { id: '4', type: 'steady', name: '第 2 组 20min 阈值', durationSec: 1200, powerStartPct: 0.98, powerEndPct: 0.98, cadenceRpm: 92 },
      { id: '5', type: 'cooldown', name: '冷身排酸', durationSec: 600, powerStartPct: 0.60, powerEndPct: 0.40, cadenceRpm: 85 }
    ]
  },
  {
    id: 'over_under',
    name: 'Over-Under 乳酸清除波动间歇',
    nameTw: 'Over-Under 乳酸清除波動間歇',
    subtitle: '穿梭波浪 / 3组x(2m@90% + 1m@108%) / 模拟大组突围',
    subtitleTw: '穿梭波浪 / 3組x(2m@90% + 1m@108%) / 模擬大組突圍',
    category: 'threshold',
    categoryLabel: '乳酸阈值 FTP',
    description: '模拟大组赛中突围进攻与跟骑拉扯的黄金课表。在门槛下 90% FTP 与门槛上 108% FTP 之间周期性交替，强制机体在疲劳状态下调动慢肌纤维快速吸收并氧化快肌纤维产生的多余乳酸。',
    descriptionTw: '模擬大組賽中突圍進攻與跟騎拉扯的黃金課表。在門檻下 90% FTP 與門檻上 108% FTP 之間週期性交替，強制機體在疲勞狀態下調動慢肌纖維快速吸收並氧化快肌纖維產生的多餘乳酸。',
    targetAdaptation: '乳酸穿梭循环能力 · 变速拉扯耐受 · 动态负荷恢复',
    segments: [
      { id: '1', type: 'warmup', name: '渐进热身', durationSec: 600, powerStartPct: 0.50, powerEndPct: 0.75, cadenceRpm: 90 },
      { id: '2', type: 'interval', name: '第 1 组 Over-Under (3波)', durationSec: 540, powerStartPct: 0.90, powerEndPct: 1.08, repeatCount: 3, onDurationSec: 60, onPowerPct: 1.08, offDurationSec: 120, offPowerPct: 0.90, cadenceRpm: 95 },
      { id: '3', type: 'steady', name: '积极恢复 1', durationSec: 300, powerStartPct: 0.55, powerEndPct: 0.55, cadenceRpm: 85 },
      { id: '4', type: 'interval', name: '第 2 组 Over-Under (3波)', durationSec: 540, powerStartPct: 0.90, powerEndPct: 1.08, repeatCount: 3, onDurationSec: 60, onPowerPct: 1.08, offDurationSec: 120, offPowerPct: 0.90, cadenceRpm: 95 },
      { id: '5', type: 'steady', name: '积极恢复 2', durationSec: 300, powerStartPct: 0.55, powerEndPct: 0.55, cadenceRpm: 85 },
      { id: '6', type: 'interval', name: '第 3 组 Over-Under (3波)', durationSec: 540, powerStartPct: 0.90, powerEndPct: 1.08, repeatCount: 3, onDurationSec: 60, onPowerPct: 1.08, offDurationSec: 120, offPowerPct: 0.90, cadenceRpm: 95 },
      { id: '7', type: 'cooldown', name: '冷身排酸', durationSec: 600, powerStartPct: 0.60, powerEndPct: 0.40, cadenceRpm: 85 }
    ]
  },
  {
    id: 'tabata_sprint',
    name: 'Tabata 20/10s 极致冲刺',
    nameTw: 'Tabata 20/10s 極致衝刺',
    subtitle: '田畑泉无氧模型 / 8次全开 / W\'能量池爆发性放电',
    subtitleTw: '田畑泉無氧模型 / 8次全開 / W\'能量池爆發性放電',
    category: 'anaerobic',
    categoryLabel: '无氧爆发与冲刺',
    description: 'Tabata 经典高强度无氧间歇。20 秒全力 @ 160% FTP + 10 秒极短喘息，连续 8 轮。极短时间内将 W\' 无氧电量池彻底榨干，对心肺、无氧糖酵解与末段冲刺抗酸耐受产生剧烈刺激。',
    descriptionTw: 'Tabata 經典高強度無氧間歇。20 秒全力 @ 160% FTP + 10 秒極短喘息，連續 8 輪。極短時間內將 W\' 無氧電量池徹底榨乾，對心肺、無氧糖酵解與末段衝刺抗酸耐受產生劇烈刺激。',
    targetAdaptation: 'W\' 无氧能量池扩容 · 终点爆发冲刺 · 短时间极限耐受',
    segments: [
      { id: '1', type: 'warmup', name: '充分热身', durationSec: 600, powerStartPct: 0.50, powerEndPct: 0.80, cadenceRpm: 95 },
      { id: '2', type: 'steady', name: '定速开脚', durationSec: 180, powerStartPct: 0.65, powerEndPct: 0.65, cadenceRpm: 100 },
      { id: '3', type: 'interval', name: 'Tabata 20/10s (8次全开)', durationSec: 240, powerStartPct: 1.60, powerEndPct: 0.40, repeatCount: 8, onDurationSec: 20, onPowerPct: 1.60, offDurationSec: 10, offPowerPct: 0.40, cadenceRpm: 110 },
      { id: '4', type: 'steady', name: '平缓恢复', durationSec: 300, powerStartPct: 0.50, powerEndPct: 0.50, cadenceRpm: 85 },
      { id: '5', type: 'cooldown', name: '冷身放松', durationSec: 600, powerStartPct: 0.60, powerEndPct: 0.35, cadenceRpm: 85 }
    ]
  },
  {
    id: 'zone2_endurance',
    name: 'Z2 基础有氧耐力与燃脂巡航',
    nameTw: 'Z2 基礎有氧耐力與燃脂巡航',
    subtitle: 'San-Millán 博士代谢方案 / 90分钟恒定 / 线粒体基石',
    subtitleTw: 'San-Millán 博士代謝方案 / 90分鐘恆定 / 線粒體基石',
    category: 'endurance',
    categoryLabel: '基础耐力 Z2',
    description: '职业车手训练计划中占比 75% 以上的真正基石。90 分钟稳定输出在 65% FTP。在此区间脂肪氧化率达到 FatMax 峰值，刺激骨骼肌慢肌纤维与细胞线粒体大量增生。',
    descriptionTw: '職業車手訓練計劃中佔比 75% 以上的真正基石。90 分鐘穩定輸出在 65% FTP。在此區間脂肪氧化率達到 FatMax 峰值，刺激骨骼肌慢肌纖維與細胞線粒體大量增生。',
    targetAdaptation: '线粒体密度增生 · 脂肪氧化利用率 · 有氧底功筑基',
    segments: [
      { id: '1', type: 'warmup', name: '平缓热身', durationSec: 600, powerStartPct: 0.50, powerEndPct: 0.65, cadenceRpm: 90 },
      { id: '2', type: 'steady', name: 'Z2 有氧核心巡航', durationSec: 4200, powerStartPct: 0.65, powerEndPct: 0.65, cadenceRpm: 90 },
      { id: '3', type: 'cooldown', name: '平稳冷身', durationSec: 600, powerStartPct: 0.60, powerEndPct: 0.45, cadenceRpm: 85 }
    ]
  }
];

export const WorkoutBuilder: React.FC<WorkoutBuilderProps> = ({ onNavigateTool }) => {
  const { profile } = useRiderProfile();
  const { language, t } = useLanguageAndUnit();
  const { showToast } = useToast();

  const [ftpWatts, setFtpWatts] = useState<number>(profile.ftpWatts || 240);
  const [riderWeightKg, setRiderWeightKg] = useState<number>(profile.weightKg || 68);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('ronnestad_30_15');
  const [workoutTitle, setWorkoutTitle] = useState<string>('Rønnestad 30/15s 微间歇课表');

  // Schedule to Calendar State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState<boolean>(false);
  const [scheduleDate, setScheduleDate] = useState<string>(() => {
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    return formatDateYMD(tmr);
  });

  // Share Poster State
  const [sharePosterUrl, setSharePosterUrl] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  const [segments, setSegments] = useState<WorkoutSegment[]>(() => {
    return JSON.parse(JSON.stringify(WORKOUT_TEMPLATES[0].segments));
  });

  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<'zwo' | 'mrc'>('zwo');

  useEffect(() => {
    if (profile.ftpWatts) setFtpWatts(profile.ftpWatts);
    if (profile.weightKg) setRiderWeightKg(profile.weightKg);
  }, [profile.ftpWatts, profile.weightKg]);

  // Auto-load pending workout generated from FitActivityAnalyzer
  useEffect(() => {
    const pending = consumePendingTransfer<any>('solorider_pending_workout');
    if (pending && pending.segments && Array.isArray(pending.segments)) {
      setWorkoutTitle(pending.title || '智能靶向补强训练课表');
      setSegments(pending.segments);
      setSelectedTemplateId(pending.templateId || 'custom_smart');
      showToast(
        pending.reason
          ? `已为您载入针对「${pending.reason}」的靶向补强课表！`
          : '已为您自动载入定制的靶向强化课表！',
        'success'
      );
    }
  }, [showToast]);

  const handleSelectTemplate = (tmpl: WorkoutTemplate) => {
    setSelectedTemplateId(tmpl.id);
    setWorkoutTitle(language === 'zh-TW' && tmpl.nameTw ? tmpl.nameTw : tmpl.name);
    setSegments(JSON.parse(JSON.stringify(tmpl.segments)));
    showToast(`已加载课表模板：${tmpl.name}`, 'info');
  };

  // Workout duration, work & TSS calculations
  const workoutMetrics = useMemo(() => {
    let totalSec = 0;
    let totalWorkJoules = 0;
    const secondPowers: number[] = [];

    segments.forEach((seg) => {
      if (seg.type === 'interval' && seg.repeatCount && seg.onDurationSec && seg.offDurationSec) {
        const onWatts = (seg.onPowerPct || 1.0) * ftpWatts;
        const offWatts = (seg.offPowerPct || 0.5) * ftpWatts;
        for (let r = 0; r < seg.repeatCount; r++) {
          for (let s = 0; s < seg.onDurationSec; s++) secondPowers.push(onWatts);
          for (let s = 0; s < seg.offDurationSec; s++) secondPowers.push(offWatts);
          totalWorkJoules += onWatts * seg.onDurationSec + offWatts * seg.offDurationSec;
        }
        totalSec += (seg.onDurationSec + seg.offDurationSec) * seg.repeatCount;
      } else {
        const startWatts = seg.powerStartPct * ftpWatts;
        const endWatts = seg.powerEndPct * ftpWatts;
        const dur = seg.durationSec;
        totalSec += dur;
        for (let s = 0; s < dur; s++) {
          const w = startWatts + ((endWatts - startWatts) * s) / Math.max(1, dur);
          secondPowers.push(w);
          totalWorkJoules += w;
        }
      }
    });

    const totalHours = totalSec / 3600;
    const avgPower = totalSec > 0 ? Math.round(totalWorkJoules / totalSec) : 0;

    // Coggan Normalized Power (NP) estimate
    let np = avgPower;
    if (secondPowers.length >= 30) {
      let rolling30s: number[] = [];
      let sum = 0;
      for (let i = 0; i < secondPowers.length; i++) {
        sum += secondPowers[i];
        if (i >= 30) {
          sum -= secondPowers[i - 30];
          rolling30s.push(sum / 30);
        } else if (i === 29) {
          rolling30s.push(sum / 30);
        }
      }
      if (rolling30s.length > 0) {
        const fourthPowers = rolling30s.reduce((acc, p) => acc + Math.pow(p, 4), 0);
        np = Math.round(Math.pow(fourthPowers / rolling30s.length, 0.25));
      }
    }

    const ifFactor = ftpWatts > 0 ? parseFloat((np / ftpWatts).toFixed(2)) : 0;
    const tss = totalHours > 0 && ftpWatts > 0
      ? Math.round(((totalSec * np * ifFactor) / (ftpWatts * 3600)) * 100)
      : 0;
    const totalKj = Math.round(totalWorkJoules / 1000);

    return {
      totalSec,
      totalMinutes: Math.round(totalSec / 60),
      formattedDuration: `${Math.floor(totalSec / 3600)}h ${Math.floor((totalSec % 3600) / 60)}m`,
      avgPower,
      np,
      ifFactor,
      tss,
      totalKj
    };
  }, [segments, ftpWatts]);

  // Segment operations
  const handleAddSegment = (type: SegmentType) => {
    const newSeg: WorkoutSegment = {
      id: Date.now().toString(),
      type,
      name: type === 'interval' ? '间歇重复段落' : type === 'steady' ? '稳态巡航段落' : '段落',
      durationSec: type === 'interval' ? 300 : 300,
      powerStartPct: type === 'steady' ? 0.75 : 0.65,
      powerEndPct: type === 'steady' ? 0.75 : 0.65,
      cadenceRpm: 90,
      repeatCount: type === 'interval' ? 5 : undefined,
      onDurationSec: type === 'interval' ? 30 : undefined,
      onPowerPct: type === 'interval' ? 1.20 : undefined,
      offDurationSec: type === 'interval' ? 30 : undefined,
      offPowerPct: type === 'interval' ? 0.55 : undefined
    };
    setSegments((prev) => [...prev, newSeg]);
    showToast('已添加新训练段落', 'info');
  };

  const handleDeleteSegment = (id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id));
    showToast('已移除训练段落', 'info');
  };

  const handleMoveSegment = (index: number, direction: 'up' | 'down') => {
    setSegments((prev) => {
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[target];
      copy[target] = temp;
      return copy;
    });
  };

  const handleUpdateSegment = (id: string, field: keyof WorkoutSegment, val: any) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: val } : s))
    );
  };

  // Helper for Coggan zone colors
  const getZoneColor = (pct: number) => {
    if (pct < 0.55) return '#94a3b8'; // Z1 Active Recovery (slate)
    if (pct < 0.75) return '#3b82f6'; // Z2 Endurance (blue)
    if (pct < 0.90) return '#10b981'; // Z3 Tempo (green)
    if (pct < 1.05) return '#f59e0b'; // Z4 Threshold (amber)
    if (pct < 1.20) return '#f97316'; // Z5 VO₂ Max (orange)
    if (pct < 1.50) return '#ef4444'; // Z6 Anaerobic (red)
    return '#a855f7';                 // Z7 Neuromuscular (purple)
  };

  // Generate Zwift .ZWO (XML format)
  const zwoXmlContent = useMemo(() => {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<workout_file>\n`;
    xml += `  <author>LaBao</author>\n`;
    xml += `  <name>${workoutTitle.replace(/[<>&]/g, '')}</name>\n`;
    xml += `  <description>Generated via LaBao Workout Builder. Target FTP: ${ftpWatts}W, TSS: ${workoutMetrics.tss}, IF: ${workoutMetrics.ifFactor}.</description>\n`;
    xml += `  <sportType>bike</sportType>\n`;
    xml += `  <workout>\n`;

    segments.forEach((seg) => {
      if (seg.type === 'warmup') {
        xml += `    <Warmup Duration="${seg.durationSec}" PowerLow="${seg.powerStartPct.toFixed(2)}" PowerHigh="${seg.powerEndPct.toFixed(2)}"${seg.cadenceRpm ? ` Cadence="${seg.cadenceRpm}"` : ''}/>\n`;
      } else if (seg.type === 'cooldown') {
        xml += `    <Cooldown Duration="${seg.durationSec}" PowerLow="${seg.powerStartPct.toFixed(2)}" PowerHigh="${seg.powerEndPct.toFixed(2)}"${seg.cadenceRpm ? ` Cadence="${seg.cadenceRpm}"` : ''}/>\n`;
      } else if (seg.type === 'interval' && seg.repeatCount && seg.onDurationSec && seg.offDurationSec) {
        xml += `    <IntervalsT Repeat="${seg.repeatCount}" OnDuration="${seg.onDurationSec}" OffDuration="${seg.offDurationSec}" OnPower="${(seg.onPowerPct || 1.0).toFixed(2)}" OffPower="${(seg.offPowerPct || 0.5).toFixed(2)}"${seg.cadenceRpm ? ` Cadence="${seg.cadenceRpm}"` : ''}/>\n`;
      } else if (seg.powerStartPct !== seg.powerEndPct) {
        xml += `    <Ramp Duration="${seg.durationSec}" PowerLow="${seg.powerStartPct.toFixed(2)}" PowerHigh="${seg.powerEndPct.toFixed(2)}"${seg.cadenceRpm ? ` Cadence="${seg.cadenceRpm}"` : ''}/>\n`;
      } else {
        xml += `    <SteadyState Duration="${seg.durationSec}" Power="${seg.powerStartPct.toFixed(2)}"${seg.cadenceRpm ? ` Cadence="${seg.cadenceRpm}"` : ''}/>\n`;
      }
    });

    xml += `  </workout>\n</workout_file>`;
    return xml;
  }, [segments, workoutTitle, ftpWatts, workoutMetrics]);

  // Generate Garmin / Wahoo .MRC format (Minutes Percent)
  const mrcContent = useMemo(() => {
    let out = `[COURSE HEADER]\nVERSION = 2\nUNITS = ENGLISH\nDESCRIPTION = ${workoutTitle}\nFILE NAME = workout.mrc\nMINUTES PERCENT\n[END COURSE HEADER]\n[COURSE DATA]\n`;

    let currentMinutes = 0.0;

    segments.forEach((seg) => {
      if (seg.type === 'interval' && seg.repeatCount && seg.onDurationSec && seg.offDurationSec) {
        const onMin = seg.onDurationSec / 60;
        const offMin = seg.offDurationSec / 60;
        const onPct = Math.round((seg.onPowerPct || 1.0) * 100);
        const offPct = Math.round((seg.offPowerPct || 0.5) * 100);

        for (let r = 0; r < seg.repeatCount; r++) {
          out += `${currentMinutes.toFixed(2)} ${onPct}\n`;
          currentMinutes += onMin;
          out += `${currentMinutes.toFixed(2)} ${onPct}\n`;

          out += `${currentMinutes.toFixed(2)} ${offPct}\n`;
          currentMinutes += offMin;
          out += `${currentMinutes.toFixed(2)} ${offPct}\n`;
        }
      } else {
        const segMin = seg.durationSec / 60;
        const startPct = Math.round(seg.powerStartPct * 100);
        const endPct = Math.round(seg.powerEndPct * 100);

        out += `${currentMinutes.toFixed(2)} ${startPct}\n`;
        currentMinutes += segMin;
        out += `${currentMinutes.toFixed(2)} ${endPct}\n`;
      }
    });

    out += `[END COURSE DATA]\n`;
    return out;
  }, [segments, workoutTitle]);

  const handleDownloadFile = () => {
    const isZwo = exportFormat === 'zwo';
    const content = isZwo ? zwoXmlContent : mrcContent;
    const mimeType = isZwo ? 'application/xml' : 'text/plain';
    const ext = isZwo ? 'zwo' : 'mrc';
    const cleanFileName = workoutTitle.trim().replace(/\s+/g, '_') || 'workout';

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanFileName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`已成功下载 ${cleanFileName}.${ext} 文件！`, 'success');
  };

  const handleGeneratePoster = () => {
    const formattedSegments: Array<{ name: string; durationSec: number; powerPct: number; cadenceRpm?: number }> = [];
    segments.forEach(seg => {
      if (seg.type === 'interval' && seg.repeatCount && seg.onDurationSec && seg.offDurationSec) {
        for (let i = 1; i <= Math.min(seg.repeatCount, 3); i++) {
          formattedSegments.push({
            name: `${seg.name} (#${i} 爆发)`,
            durationSec: seg.onDurationSec,
            powerPct: Math.round((seg.onPowerPct || 1.0) * 100),
            cadenceRpm: seg.cadenceRpm
          });
          formattedSegments.push({
            name: `${seg.name} (#${i} 间歇)`,
            durationSec: seg.offDurationSec,
            powerPct: Math.round((seg.offPowerPct || 0.5) * 100),
            cadenceRpm: seg.cadenceRpm
          });
        }
        if (seg.repeatCount > 3) {
          formattedSegments.push({
            name: `... 循环重复剩余 ${seg.repeatCount - 3} 组`,
            durationSec: (seg.onDurationSec + seg.offDurationSec) * (seg.repeatCount - 3),
            powerPct: Math.round((seg.onPowerPct || 1.0) * 100)
          });
        }
      } else {
        formattedSegments.push({
          name: seg.name,
          durationSec: seg.durationSec || 300,
          powerPct: Math.round(((seg.powerStartPct + seg.powerEndPct) / 2) * 100),
          cadenceRpm: seg.cadenceRpm
        });
      }
    });

    const activeTmpl = WORKOUT_TEMPLATES.find(t => t.id === selectedTemplateId);
    const desc = activeTmpl?.description || '根据生理动力学与代谢功率阶梯科学定制的间歇训练课表。';

    const url = generateWorkoutPoster({
      workoutTitle,
      ftpWatts,
      totalDurationStr: workoutMetrics.formattedDuration,
      tss: workoutMetrics.tss,
      intensityFactor: workoutMetrics.ifFactor,
      calories: Math.round(workoutMetrics.totalKj * 1.05),
      description: desc,
      segments: formattedSegments
    });
    setSharePosterUrl(url);
    setIsShareModalOpen(true);
  };

  const handleScheduleToCalendar = () => {
    if (!scheduleDate) return;
    const tmplCategory = selectedTemplateId ? WORKOUT_TEMPLATES.find(t => t.id === selectedTemplateId)?.category : undefined;
    let workoutCategory: PlannedWorkout['category'] = 'threshold';
    if (tmplCategory === 'vo2max') workoutCategory = 'vo2max';
    else if (tmplCategory === 'anaerobic') workoutCategory = 'anaerobic';
    else if (tmplCategory === 'endurance') workoutCategory = 'endurance';

    const newWorkout: PlannedWorkout = {
      id: `w_custom_${Date.now()}`,
      date: scheduleDate,
      title: workoutTitle,
      targetTss: workoutMetrics.tss,
      durationMin: workoutMetrics.totalMinutes,
      category: workoutCategory,
      templateId: selectedTemplateId || undefined,
      notes: `由间歇课表工坊定制：${workoutMetrics.formattedDuration} · 预估 NP ${workoutMetrics.np}W · TSS ${workoutMetrics.tss}`
    };

    const currentList = loadPlannedWorkouts();
    const updatedList = [...currentList, newWorkout];
    savePlannedWorkouts(updatedList);

    setPendingTransfer('solorider_pending_calendar_workout', newWorkout);
    setIsScheduleModalOpen(false);
    showToast(
      language === 'zh-TW'
        ? `已將課表「${workoutTitle}」排入 ${scheduleDate} 訓練賽歷！`
        : `已将课表「${workoutTitle}」排入 ${scheduleDate} 训练赛历！`,
      'success'
    );

    if (onNavigateTool) {
      onNavigateTool('training-calendar');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Standard Apple HIG Tool Header */}
      <IOSToolHeader
        category={language === 'zh-TW' ? '生理與代謝' : '生理与代谢'}
        categoryIcon={Dumbbell}
        title={language === 'zh-TW' ? '間歇課表' : '间歇课表'}
        description="内置 6 大经典名将科学训练协议，支持秒级段落编辑与功率踏频靶向定制，无缝导出 Zwift 与码表训练文件。"
        tint="red"
        onShare={handleGeneratePoster}
        shareTitle="生成社交分享课表海报"
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(true)}
              className="apple-touch h-9 px-3 sm:px-3.5 rounded-xl border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 font-semibold text-xs shadow-ios-sm flex items-center justify-center gap-1.5 transition whitespace-nowrap shrink-0"
              title="将当前课表排入训练赛历日程"
            >
              <CalendarIcon className="w-3.5 h-3.5 text-ios-red shrink-0" />
              <span>{language === 'zh-TW' ? '排入賽歷' : '排入赛历'}</span>
            </button>
            <button
              type="button"
              onClick={() => setExportModalOpen(true)}
              className="apple-touch h-9 px-3.5 sm:px-4 rounded-xl bg-ios-red hover:bg-ios-red/90 text-white font-semibold text-xs shadow-ios-sm flex items-center justify-center gap-1.5 transition whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>{language === 'zh-TW' ? '匯出課表' : '导出课表'}</span>
            </button>
          </div>
        }
      />

      {/* Physiological Anchors Bar */}
      <div className="ios-card p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card flex flex-wrap items-center justify-between gap-3.5">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">车手 FTP:</span>
            <NumberStepper
              value={ftpWatts}
              onChange={setFtpWatts}
              min={100}
              max={550}
              step={5}
              unit="W"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">车手体重:</span>
            <NumberStepper
              value={riderWeightKg}
              onChange={setRiderWeightKg}
              min={35}
              max={130}
              step={1}
              unit="kg"
            />
          </div>
        </div>

        {/* Live Summary Chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 text-slate-700 dark:text-slate-300">
            总时长: <strong className="tabular-nums">{workoutMetrics.formattedDuration}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-ios-blue/10 border border-ios-blue/20 text-ios-blue font-bold">
            NP: <strong className="tabular-nums">{workoutMetrics.np}W</strong>
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-ios-purple/10 border border-ios-purple/20 text-ios-purple font-bold">
            IF: <strong className="tabular-nums">{workoutMetrics.ifFactor}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-ios-orange/10 border border-ios-orange/20 text-ios-orange font-bold">
            TSS: <strong className="tabular-nums">{workoutMetrics.tss}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 text-slate-500">
            总做功: <strong className="tabular-nums">{workoutMetrics.totalKj} kJ</strong>
          </span>
        </div>
      </div>

      {/* 6 Science-Backed Templates Showcase */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-ios-red" />
            <span>世界殿堂经典训练协议预设</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {WORKOUT_TEMPLATES.map((tmpl) => {
            const isSelected = selectedTemplateId === tmpl.id;
            return (
              <div
                key={tmpl.id}
                onClick={() => handleSelectTemplate(tmpl)}
                className={`p-3.5 sm:p-4 rounded-2xl border transition cursor-pointer apple-touch flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'bg-ios-red/5 dark:bg-ios-red/10 border-ios-red shadow-ios-sm'
                    : 'bg-white/80 dark:bg-[#1C1C1E]/80 border-slate-200/80 dark:border-white/10 hover:border-slate-300'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                      {tmpl.categoryLabel}
                    </span>
                    {isSelected && (
                      <span className="text-[11px] font-bold text-ios-red flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        当前编辑
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {language === 'zh-TW' && tmpl.nameTw ? tmpl.nameTw : tmpl.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {language === 'zh-TW' && tmpl.descriptionTw ? tmpl.descriptionTw : tmpl.description}
                  </p>
                </div>

                <div className="text-[11px] text-slate-400 font-medium pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <span>{tmpl.targetAdaptation}</span>
                  <span className="text-ios-red font-semibold">加载模板</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Workout Visual Profile Timeline */}
      <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={workoutTitle}
                onChange={(e) => setWorkoutTitle(e.target.value)}
                className="text-base sm:text-lg font-bold text-slate-900 dark:text-white bg-transparent border-b border-dashed border-slate-300 dark:border-white/20 hover:border-ios-red focus:outline-none focus:border-ios-red px-1 py-0.5"
                placeholder="课表名称..."
              />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              课表功率踏频时序图谱 · Coggan 7 区色系
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleAddSegment('steady')}
              className="apple-touch px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-medium transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>加稳态巡航</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddSegment('interval')}
              className="apple-touch px-3 py-1.5 rounded-xl bg-ios-red/10 hover:bg-ios-red/20 text-ios-red font-bold transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>加微间歇循环</span>
            </button>
          </div>
        </div>

        {/* SVG Workout Timeline Profile */}
        <div className="w-full h-32 sm:h-36 bg-slate-50 dark:bg-white/5 rounded-xl p-2.5 sm:p-3 border border-slate-200/60 dark:border-white/5 relative overflow-hidden flex items-end gap-1">
          {segments.map((seg, idx) => {
            const widthPct = Math.max(2, (seg.durationSec / Math.max(1, workoutMetrics.totalSec)) * 100);
            const avgPct = (seg.powerStartPct + seg.powerEndPct) / 2;
            const heightPct = Math.min(100, Math.max(15, (avgPct / 1.7) * 100));
            const color = getZoneColor(avgPct);

            return (
              <div
                key={seg.id || idx}
                style={{ width: `${widthPct}%`, height: `${heightPct}%`, backgroundColor: color }}
                className="rounded-t-md relative group transition-all hover:opacity-90 flex flex-col justify-between p-1 overflow-hidden"
                title={`${seg.name}: ${Math.round(seg.durationSec / 60)}分 @ ${Math.round(avgPct * 100)}% (${Math.round(avgPct * ftpWatts)}W)`}
              >
                <span className="text-[11px] text-white font-mono font-bold truncate drop-shadow-xs tabular-nums">
                  {Math.round(avgPct * 100)}%
                </span>
                <span className="text-[11px] text-white/90 font-mono truncate hidden sm:block drop-shadow-xs tabular-nums">
                  {Math.round(seg.durationSec / 60)}m
                </span>
              </div>
            );
          })}
        </div>

        {/* Coggan Zones Legend Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#94a3b8' }}></span> Z1 恢复 &lt;55%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }}></span> Z2 有氧 55-75%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#10b981' }}></span> Z3 节奏 76-90%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f59e0b' }}></span> Z4 阈值 91-105%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f97316' }}></span> Z5 摄氧 106-120%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#ef4444' }}></span> Z6 无氧 121-150%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#a855f7' }}></span> Z7 冲刺 &gt;150%</span>
        </div>
      </div>

      {/* Segments Detailed Editor List */}
      <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
            课表段落明细编辑器 ({segments.length} 个训练分段)
          </div>
        </div>

        <div className="space-y-2.5">
          {segments.map((seg, idx) => {
            const isInterval = seg.type === 'interval';
            const avgWatts = Math.round(((seg.powerStartPct + seg.powerEndPct) / 2) * ftpWatts);

            return (
              <div
                key={seg.id}
                className="p-3 sm:p-3.5 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition"
              >
                {/* Left: Sequence & Info */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                    {idx + 1}
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <input
                      type="text"
                      value={seg.name}
                      onChange={(e) => handleUpdateSegment(seg.id, 'name', e.target.value)}
                      className="text-xs font-bold text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 focus:outline-none focus:border-ios-red w-full truncate"
                    />

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-mono">
                      <span className="tabular-nums">{Math.round(seg.durationSec / 60)} 分钟</span>
                      <span>·</span>
                      {isInterval ? (
                        <span className="tabular-nums">
                          {seg.repeatCount}次 x ({seg.onDurationSec}s @ {Math.round((seg.onPowerPct || 1.0) * 100)}% + {seg.offDurationSec}s @ {Math.round((seg.offPowerPct || 0.5) * 100)}%)
                        </span>
                      ) : (
                        <span className="tabular-nums">
                          {Math.round(seg.powerStartPct * 100)}%~{Math.round(seg.powerEndPct * 100)}% FTP ({avgWatts}W · {(avgWatts / riderWeightKg).toFixed(1)} W/kg)
                        </span>
                      )}
                      {seg.cadenceRpm && <span className="tabular-nums">· 目标踏频: {seg.cadenceRpm} rpm</span>}
                    </div>
                  </div>
                </div>

                {/* Center / Right: Power & Cadence Controls */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {!isInterval ? (
                    <div className="flex items-center gap-2">
                      <div className="text-center">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-0.5">功率区间</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={20}
                            max={250}
                            step={5}
                            value={seg.powerStartPct ? Math.round(seg.powerStartPct * 100) : ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              handleUpdateSegment(seg.id, 'powerStartPct', raw === '' ? 0 : ((parseInt(raw, 10) || 0) / 100));
                            }}
                            onBlur={() => {
                              if (!seg.powerStartPct || seg.powerStartPct < 0.2) handleUpdateSegment(seg.id, 'powerStartPct', 0.5);
                            }}
                            className="w-13 px-1.5 py-1 text-xs font-mono font-bold text-center rounded-lg bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white tabular-nums"
                          />
                          <span className="text-slate-500 dark:text-slate-400 text-xs">%</span>
                        </div>
                      </div>

                      <div className="text-center">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-0.5">目标踏频</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={50}
                            max={130}
                            step={5}
                            value={seg.cadenceRpm || ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              handleUpdateSegment(seg.id, 'cadenceRpm', raw === '' ? 0 : (parseInt(raw, 10) || 0));
                            }}
                            onBlur={() => {
                              if (!seg.cadenceRpm || seg.cadenceRpm < 40) handleUpdateSegment(seg.id, 'cadenceRpm', 90);
                            }}
                            className="w-13 px-1.5 py-1 text-xs font-mono text-center rounded-lg bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white tabular-nums"
                          />
                          <span className="text-slate-500 dark:text-slate-400 text-xs">rpm</span>
                        </div>
                      </div>

                      <div className="text-center">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-0.5">分段时长</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={120}
                            step={1}
                            value={seg.durationSec ? Math.round(seg.durationSec / 60) : ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              handleUpdateSegment(seg.id, 'durationSec', raw === '' ? 0 : ((parseInt(raw, 10) || 0) * 60));
                            }}
                            onBlur={() => {
                              if (!seg.durationSec || seg.durationSec < 60) handleUpdateSegment(seg.id, 'durationSec', 60);
                            }}
                            className="w-13 px-1.5 py-1 text-xs font-mono text-center rounded-lg bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white tabular-nums"
                          />
                          <span className="text-slate-500 dark:text-slate-400 text-xs">分</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-center">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block mb-0.5">循环次数</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={30}
                          value={seg.repeatCount || ''}
                          onChange={(e) => {
                            const raw = e.target.value;
                            handleUpdateSegment(seg.id, 'repeatCount', raw === '' ? 0 : (parseInt(raw, 10) || 0));
                          }}
                          onBlur={() => {
                            if (!seg.repeatCount || seg.repeatCount < 1) handleUpdateSegment(seg.id, 'repeatCount', 1);
                          }}
                          className="w-11 px-1.5 py-1 text-xs font-mono font-bold text-center rounded-lg bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white tabular-nums"
                        />
                      </div>

                      <div className="text-center">
                        <span className="text-xs text-red-500 font-bold block mb-0.5">ON 时长/功率</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={5}
                            max={600}
                            step={5}
                            value={seg.onDurationSec || ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              handleUpdateSegment(seg.id, 'onDurationSec', raw === '' ? 0 : (parseInt(raw, 10) || 0));
                            }}
                            onBlur={() => {
                              if (!seg.onDurationSec || seg.onDurationSec < 5) handleUpdateSegment(seg.id, 'onDurationSec', 30);
                            }}
                            className="w-11 px-1 py-1 text-xs font-mono text-center rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 font-bold tabular-nums"
                          />
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">s@</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={50}
                            max={300}
                            step={5}
                            value={seg.onPowerPct ? Math.round(seg.onPowerPct * 100) : ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              handleUpdateSegment(seg.id, 'onPowerPct', raw === '' ? 0 : ((parseInt(raw, 10) || 0) / 100));
                            }}
                            onBlur={() => {
                              if (!seg.onPowerPct || seg.onPowerPct < 0.5) handleUpdateSegment(seg.id, 'onPowerPct', 1.0);
                            }}
                            className="w-11 px-1 py-1 text-xs font-mono text-center rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 font-bold tabular-nums"
                          />
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">%</span>
                        </div>
                      </div>

                      <div className="text-center">
                        <span className="text-xs text-emerald-500 font-bold block mb-0.5">OFF 间歇/功率</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={5}
                            max={600}
                            step={5}
                            value={seg.offDurationSec || ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              handleUpdateSegment(seg.id, 'offDurationSec', raw === '' ? 0 : (parseInt(raw, 10) || 0));
                            }}
                            onBlur={() => {
                              if (!seg.offDurationSec || seg.offDurationSec < 5) handleUpdateSegment(seg.id, 'offDurationSec', 30);
                            }}
                            className="w-11 px-1 py-1 text-xs font-mono text-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold tabular-nums"
                          />
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">s@</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={30}
                            max={100}
                            step={5}
                            value={seg.offPowerPct ? Math.round(seg.offPowerPct * 100) : ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              handleUpdateSegment(seg.id, 'offPowerPct', raw === '' ? 0 : ((parseInt(raw, 10) || 0) / 100));
                            }}
                            onBlur={() => {
                              if (!seg.offPowerPct || seg.offPowerPct < 0.3) handleUpdateSegment(seg.id, 'offPowerPct', 0.5);
                            }}
                            className="w-11 px-1 py-1 text-xs font-mono text-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold tabular-nums"
                          />
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">%</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Move Up/Down & Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveSegment(idx, 'up')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 transition"
                      title="上移"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === segments.length - 1}
                      onClick={() => handleMoveSegment(idx, 'down')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-20 transition"
                      title="下移"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSegment(seg.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 transition"
                      title="删除此段"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Export Drawer / Modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 dark:bg-black/75 backdrop-blur-2xl animate-in fade-in duration-200">
          <div className="w-full max-w-2xl p-4 sm:p-5 rounded-t-[28px] sm:rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.06] dark:border-white/[0.08] shadow-ios-popover space-y-4 sm:space-y-5 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-5">
            {/* iOS Bottom Sheet Drag Handle */}
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-neutral-600 mx-auto -mt-1 mb-1 sm:hidden shrink-0" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-ios-red" />
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  导出与下载骑行课表文件
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="apple-touch w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            {/* Format Selector */}
            <div className="w-full sm:max-w-xs">
              <IOSSegmentedControl
                options={[
                  {
                    value: 'zwo',
                    label: (
                      <>
                        <span className="sm:hidden">Zwift (.ZWO)</span>
                        <span className="hidden sm:inline">Zwift (.ZWO XML)</span>
                      </>
                    )
                  },
                  {
                    value: 'mrc',
                    label: (
                      <>
                        <span className="sm:hidden">Garmin (.MRC)</span>
                        <span className="hidden sm:inline">Garmin/Wahoo (.MRC)</span>
                      </>
                    )
                  }
                ]}
                value={exportFormat}
                onChange={(v) => setExportFormat(v as any)}
              />
            </div>

            {/* Code Preview Box */}
            <div className="relative">
              <pre className="p-3.5 sm:p-4 rounded-2xl bg-[#1C1C1E] text-slate-200 text-xs font-mono h-60 sm:h-64 overflow-y-auto leading-relaxed border border-white/10 selection:bg-ios-red selection:text-white">
                {exportFormat === 'zwo' ? zwoXmlContent : mrcContent}
              </pre>
            </div>

            {/* Hardware Import Guidelines */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <div className="font-bold text-slate-700 dark:text-slate-300">码表与软件导入指引：</div>
              {exportFormat === 'zwo' ? (
                <p>
                  <strong>Zwift 导入</strong>：下载 <code>.zwo</code> 文件后，将其放入电脑本地目录 <code>文档/Zwift/Workouts/&lt;你的Zwift用户ID&gt;/</code>，重启 Zwift 即可在“Custom Workouts”中找到并启动课表。
                </p>
              ) : (
                <p>
                  <strong>Garmin 导入</strong>：使用 USB 连接 Garmin 码表，将下载的 <code>.mrc</code> 文件放入 <code>Garmin/NewFiles/</code> 文件夹，安全弹出码表后在“训练/课表”菜单中即可直接执行。
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1 sm:pt-2">
              <button
                type="button"
                onClick={handleDownloadFile}
                className="apple-touch h-9 px-4.5 rounded-xl bg-ios-red hover:bg-ios-red/90 text-white font-semibold text-xs shadow-ios-sm flex items-center gap-2 transition"
              >
                <Download className="w-4 h-4" />
                <span>下载 .{exportFormat} 文件</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule to Calendar Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="ios-card p-4 sm:p-5 rounded-2xl max-w-md w-full border border-slate-200/80 dark:border-white/10 shadow-ios-popover space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-ios-red/10 flex items-center justify-center text-ios-red">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-white">
                    {language === 'zh-TW' ? '排入訓練賽歷' : '排入训练赛历'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {language === 'zh-TW' ? '設定執行日期並自動同步至 ATP 週期排程' : '设定执行日期并自动同步至 ATP 周期排程'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition"
              >
                ✕
              </button>
            </div>

            {/* Workout Summary Preview */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 space-y-2">
              <div className="font-bold text-xs text-slate-800 dark:text-white">
                {workoutTitle}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-white dark:bg-black/20 border border-slate-100 dark:border-white/5">
                  <div className="text-[10px] text-slate-400">时长</div>
                  <div className="font-bold tabular-nums text-slate-700 dark:text-slate-300">{workoutMetrics.formattedDuration}</div>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-black/20 border border-slate-100 dark:border-white/5">
                  <div className="text-[10px] text-slate-400">预估 TSS</div>
                  <div className="font-bold tabular-nums text-ios-orange">{workoutMetrics.tss}</div>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-black/20 border border-slate-100 dark:border-white/5">
                  <div className="text-[10px] text-slate-400">预估 NP</div>
                  <div className="font-bold tabular-nums text-ios-blue">{workoutMetrics.np}W</div>
                </div>
              </div>
            </div>

            {/* Target Date Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {language === 'zh-TW' ? '排定訓練日期' : '排定训练日期'}
              </label>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#2C2C2E] text-slate-800 dark:text-white text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-ios-red/40"
              />
              {/* Quick Preset Date Pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setScheduleDate(formatDateYMD(new Date()))}
                  className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-ios-red/10 hover:text-ios-red transition apple-touch"
                >
                  今天
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    setScheduleDate(formatDateYMD(d));
                  }}
                  className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-ios-red/10 hover:text-ios-red transition apple-touch"
                >
                  明天
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    const day = d.getDay();
                    const daysUntilSat = (6 - day + 7) % 7 || 7;
                    d.setDate(d.getDate() + daysUntilSat);
                    setScheduleDate(formatDateYMD(d));
                  }}
                  className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-ios-red/10 hover:text-ios-red transition apple-touch"
                >
                  本周六
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    const day = d.getDay();
                    const daysUntilSun = (7 - day) % 7 || 7;
                    d.setDate(d.getDate() + daysUntilSun);
                    setScheduleDate(formatDateYMD(d));
                  }}
                  className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-ios-red/10 hover:text-ios-red transition apple-touch"
                >
                  本周日
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="apple-touch h-9 px-3.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 font-semibold text-xs transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleScheduleToCalendar}
                className="apple-touch h-9 px-4.5 rounded-xl bg-ios-red hover:bg-ios-red/90 text-white font-semibold text-xs shadow-ios-sm flex items-center gap-1.5 transition"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>确认排入赛历</span>
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
        title="科学间歇训练课表"
        downloadFileName={`LaBao_训练课表_${workoutTitle.replace(/\s+/g, '_')}.png`}
      />
    </div>
  );
};
