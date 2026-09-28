import React, { useState, useMemo, useEffect } from 'react';
import { Scale, Zap, Flame, Award, CheckSquare, Square, DollarSign, TrendingDown, Clock, ShieldCheck, Plus, Trash2, RotateCcw, Sparkles, HelpCircle, ChevronDown, Check, Star, Lightbulb } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
import { NumberStepper } from '../common/NumberStepper';
import { Tooltip } from '../common/Tooltip';
import { IOSSegmentedControl } from '../common/IOSSegmentedControl';
import { IOSCard, IOSCardHeader, IOSMetricTile } from '../common/IOSCard';
import { IOSToolHeader } from '../common/IOSToolHeader';
import { ShareCardModal } from '../common/ShareCardModal';
import { generateUpgradeRoiPoster } from '../../utils/shareCardGenerators';
import { useRiderProfile } from '../../context/RiderProfileContext';
import { useToast } from '../../context/ToastContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  ChartTooltip,
  Legend
);

export interface SpecPreset {
  label: string;
  weightG: number;
  baseWatts40: number; // Aero/rolling watt save @ 40 km/h baseline
  refPrice: number;
  note: string;
}

export interface UpgradeItem {
  id: string;
  name: string;
  category: 'aero' | 'weight' | 'rolling' | 'drivetrain';
  weightSaveG: number;
  powerSaveWatts: number;
  costYuan: number;
  enabled: boolean;
  selectedSpecIndex?: number;
  specs: SpecPreset[];
}

const DEFAULT_ITEMS_WITH_SPECS: UpgradeItem[] = [
  {
    id: '1',
    name: '骑行服 / 连体服',
    category: 'aero',
    weightSaveG: 0,
    powerSaveWatts: 7.5,
    costYuan: 450,
    enabled: true,
    selectedSpecIndex: 1,
    specs: [
      { label: '修身骑行服', weightG: 0, baseWatts40: 4.0, refPrice: 200, note: '相比宽松风衣，消除衣物兜风鼓包，风洞实测省 ~4W' },
      { label: '破风分体服', weightG: 0, baseWatts40: 7.5, refPrice: 450, note: '手臂与肩部采用低风阻导流面料，实测省 ~7.5W' },
      { label: '破风连体服', weightG: 0, baseWatts40: 11.0, refPrice: 1500, note: '无接缝极致贴合，职业风洞黄金升级，省 ~11W' },
    ]
  },
  {
    id: '2',
    name: '内胎与轮胎系统',
    category: 'rolling',
    weightSaveG: 140,
    powerSaveWatts: 3.2,
    costYuan: 160,
    enabled: true,
    selectedSpecIndex: 1,
    specs: [
      { label: '乳胶内胎', weightG: 80, baseWatts40: 2.2, refPrice: 120, note: '相比普通丁基胶滞后损失小，路感柔和，滚阻省 ~2.2W' },
      { label: '超轻 TPU 内胎', weightG: 140, baseWatts40: 3.2, refPrice: 160, note: '28g-36g 对装，极致减重 140g 旋转质量，滚阻省 ~3.2W' },
      { label: '真空胎系统', weightG: 180, baseWatts40: 4.8, refPrice: 900, note: '免除内胎摩擦，极低滚阻兼顾防扎，省 ~4.8W' },
    ]
  },
  {
    id: '3',
    name: '气动头盔',
    category: 'aero',
    weightSaveG: 0,
    powerSaveWatts: 4.5,
    costYuan: 850,
    enabled: true,
    selectedSpecIndex: 1,
    specs: [
      { label: '半透气破风盔', weightG: 0, baseWatts40: 3.0, refPrice: 450, note: '兼顾散热与正面破风导流，省 ~3W' },
      { label: '全气动破风盔', weightG: -10, baseWatts40: 5.0, refPrice: 1200, note: '如 Evade/Utopia，针对头部正面高风压区优化，省 ~5W' },
      { label: 'TT 计时水滴盔', weightG: -60, baseWatts40: 8.5, refPrice: 2200, note: '后部气流平滑顺延背部，极致省 ~8.5W' },
    ]
  },
  {
    id: '4',
    name: '碳纤气动轮组',
    category: 'aero',
    weightSaveG: 280,
    powerSaveWatts: 6.0,
    costYuan: 4200,
    enabled: true,
    selectedSpecIndex: 1,
    specs: [
      { label: '38mm 爬坡碳轮', weightG: 400, baseWatts40: 3.5, refPrice: 3200, note: '相比铝轮大减重适合山地爬坡，平路气动省 ~3.5W' },
      { label: '50mm 综合碳轮', weightG: 280, baseWatts40: 6.5, refPrice: 4200, note: '破风兼顾侧风，黄金综合高度，平路巡航利器，省 ~6.5W' },
      { label: '60mm+ 破风碳轮', weightG: 120, baseWatts40: 9.0, refPrice: 6500, note: '大深框破风惯性极佳，平路高速省 ~9W' },
    ]
  },
  {
    id: '5',
    name: '一体把与内走线',
    category: 'aero',
    weightSaveG: 90,
    powerSaveWatts: 3.5,
    costYuan: 1200,
    enabled: true,
    selectedSpecIndex: 1,
    specs: [
      { label: '分体气动碳把', weightG: 50, baseWatts40: 2.0, refPrice: 500, note: '上把位机翼扁平截面，减少把前风阻 ~2W' },
      { label: '一体全内走线碳把', weightG: 90, baseWatts40: 3.8, refPrice: 1200, note: '隐藏全部外露线管，车头迎风面极度纯净，省 ~3.8W' },
    ]
  },
  {
    id: '6',
    name: '锁鞋与脚部系统',
    category: 'weight',
    weightSaveG: 160,
    powerSaveWatts: 1.5,
    costYuan: 990,
    enabled: false,
    selectedSpecIndex: 0,
    specs: [
      { label: '全碳硬底锁鞋', weightG: 160, baseWatts40: 1.5, refPrice: 990, note: '相比尼龙底，硬度指数10+极大提高踩踏刚性，减重足底旋转质量' },
      { label: '气动破风鞋套', weightG: -40, baseWatts40: 3.0, refPrice: 150, note: '平滑包裹鞋面旋钮与卡扣，降低脚部旋转扰流 ~3W' },
    ]
  },
  {
    id: '7',
    name: '传动链条与导轮陶瓷化',
    category: 'drivetrain',
    weightSaveG: -20,
    powerSaveWatts: 1.2,
    costYuan: 880,
    enabled: false,
    selectedSpecIndex: 0,
    specs: [
      { label: '浸蜡链条 / 陶瓷大导轮', weightG: -20, baseWatts40: 1.5, refPrice: 880, note: '降低链节弯折角度与摩擦阻力，机械传动省 ~1.5W' },
    ]
  },
];

import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';

export const UpgradeRoiCalculator: React.FC = () => {
  const { profile } = useRiderProfile();
  const { unitSystem, language } = useLanguageAndUnit();
  const { showToast } = useToast();
  const isImperial = unitSystem === 'imperial';

  const [totalSystemWeightKg, setTotalSystemWeightKg] = useState<number>((profile.weightKg || 68) + (profile.bikeWeightKg || 8.5));
  const [flatCruiseSpeedKmh, setFlatCruiseSpeedKmh] = useState<number>(35);
  const [climbPowerWatts, setClimbPowerWatts] = useState<number>(profile.ftpWatts || 240);
  const [climbGradePct, setClimbGradePct] = useState<number>(7.5);

  // Share Poster State
  const [sharePosterUrl, setSharePosterUrl] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  // Reactively synchronize with global rider profile
  useEffect(() => {
    const totalW = (profile.weightKg || 68) + (profile.bikeWeightKg || 8.5);
    setTotalSystemWeightKg(totalW);
    if (profile.ftpWatts) setClimbPowerWatts(profile.ftpWatts);
  }, [profile.weightKg, profile.bikeWeightKg, profile.ftpWatts]);

  // Adaptive currency symbol based on global language & unit system
  const currencySymbol = useMemo(() => {
    if (language === 'zh-TW') return 'NT$';
    if (isImperial) return '$';
    return '¥';
  }, [language, isImperial]);

  const [items, setItems] = useState<UpgradeItem[]>(DEFAULT_ITEMS_WITH_SPECS);

  // Speed scaling factor for aerodynamic power (P_aero proportional to v^3)
  const speedScalingFactor = useMemo(() => {
    // Standard wind tunnel benchmarks are tested at 40 km/h (11.11 m/s)
    return Math.pow(flatCruiseSpeedKmh / 40, 3);
  }, [flatCruiseSpeedKmh]);

  // Toggle item participation
  const toggleItem = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, enabled: !item.enabled } : item));
  };

  // Select a preset spec for an item (auto-calculates realistic weights and watts!)
  const handleSelectSpec = (itemId: string, specIndex: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const spec = item.specs[specIndex];
        if (spec) {
          return {
            ...item,
            selectedSpecIndex: specIndex,
            weightSaveG: spec.weightG,
            powerSaveWatts: parseFloat((spec.baseWatts40 * speedScalingFactor).toFixed(1)),
            costYuan: spec.refPrice
          };
        }
      }
      return item;
    }));
  };

  // In-place field updates
  const updateItemField = (id: string, field: keyof UpgradeItem, value: any) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  // Add Custom Upgrade Component
  const handleAddCustomItem = () => {
    const newId = Date.now().toString();
    setItems(prev => [
      ...prev,
      {
        id: newId,
        name: language === 'zh-TW' ? `自訂改裝件 #${prev.length + 1}` : `自定义改装件 #${prev.length + 1}`,
        category: 'aero',
        weightSaveG: 50,
        powerSaveWatts: 2.0,
        costYuan: 500,
        enabled: true,
        selectedSpecIndex: 0,
        specs: [
          {
            label: language === 'zh-TW' ? '自訂規格 · 可自由修改下方參數' : '自定义规格 · 可自由修改下方参数',
            weightG: 50,
            baseWatts40: 2.0,
            refPrice: 500,
            note: language === 'zh-TW' ? '可在下方卡片中自由微調實測價格、減重克數與省瓦收益' : '可在下方卡片中自由微调实测价格、减重克数与省瓦收益'
          }
        ]
      }
    ]);
    showToast(language === 'zh-TW' ? '已新增自訂改裝升級項目！' : '已添加自定义改装升级项！', 'success');
  };

  // Delete item
  const handleDeleteItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const resetToDefaults = () => {
    setItems(DEFAULT_ITEMS_WITH_SPECS);
    showToast(language === 'zh-TW' ? '已恢復預設改裝清單' : '已恢复默认预设改装清单', 'info');
  };

  // Calculation of Savings and ROI
  const analysis = useMemo(() => {
    const activeItems = items.filter(i => i.enabled);

    const totalWeightSaveG = activeItems.reduce((sum, i) => sum + (Number(i.weightSaveG) || 0), 0);

    // Aerodynamic savings CANNOT be linearly stacked:
    // multiple aero items (skinsuit, helmet, wheels, bars) all reduce the same system CdA —
    // stacking them yields diminishing returns due to cross-item drag overlap.
    // Non-aero items (rolling resistance, drivetrain friction, weight) affect independent
    // energy loss components and can be summed linearly.
    const aeroItems = activeItems.filter(i => i.category === 'aero');
    const nonAeroItems = activeItems.filter(i => i.category !== 'aero');

    const nonAeroPowerSave = nonAeroItems.reduce((sum, i) => sum + (Number(i.powerSaveWatts) || 0), 0);

    // Sort aero items largest-first so the highest-impact item gets full credit.
    // Each additional stacked aero item provides ~8% less benefit due to CdA overlap regions.
    // Floor at 0.60 — even with many items the combined benefit stays physically plausible.
    const sortedAeroItems = [...aeroItems].sort(
      (a, b) => (Number(b.powerSaveWatts) || 0) - (Number(a.powerSaveWatts) || 0)
    );
    let aeroPowerSave = 0;
    let stackFactor = 1.0;
    for (const item of sortedAeroItems) {
      aeroPowerSave += (Number(item.powerSaveWatts) || 0) * stackFactor;
      stackFactor = Math.max(0.60, stackFactor - 0.08);
    }
    // Track whether a correction was applied so the UI can show a notice.
    const aeroCorrectionApplied = aeroItems.length >= 2;

    const totalPowerSaveWatts = nonAeroPowerSave + aeroPowerSave;
    const totalCostYuan = activeItems.reduce((sum, i) => sum + (Number(i.costYuan) || 0), 0);

    // 1. Flat 40km time saved (at baseline cruise speed)
    const flatDistM = 40000;
    const safeCruiseSpeedKmh = Math.max(10, flatCruiseSpeedKmh || 35);
    const vBaseMs = safeCruiseSpeedKmh / 3.6;
    const pBaseAero = 0.5 * 1.20 * 0.32 * Math.pow(vBaseMs, 3);
    const pNewAero = Math.max(10, pBaseAero - totalPowerSaveWatts);
    const vNewMs = Math.pow(pBaseAero / pNewAero, 1 / 3) * vBaseMs;
    const flatTimeBaseSec = flatDistM / vBaseMs;
    const flatTimeNewSec = flatDistM / vNewMs;
    const flatTimeSavedSec = Math.max(0, Math.round(flatTimeBaseSec - flatTimeNewSec));

    // 2. Climb 10km @ 7.5% time saved (physically separated aero v^3 & mechanical/rolling v^1 components)
    const climbDistM = 10000;
    const safeTotalWeightKg = Math.max(30, totalSystemWeightKg || 76.5);
    const safeClimbPowerWatts = Math.max(50, climbPowerWatts || 200);
    const safeClimbGradePct = Math.max(0.5, climbGradePct || 7.5);
    const massBase = safeTotalWeightKg;
    const massNew = Math.max(30, safeTotalWeightKg - totalWeightSaveG / 1000);

    const denomBase = massBase * 9.81 * (safeClimbGradePct / 100) + massBase * 9.81 * 0.004;
    const denomNew = massNew * 9.81 * (safeClimbGradePct / 100) + massNew * 9.81 * 0.004;
    const vClimbBaseMs = Math.max(0.5, safeClimbPowerWatts / Math.max(1, denomBase));

    // Dynamic physical scaling: aero savings scale with (v_climb / v_flat)^3;
    // mechanical & rolling resistance savings scale linearly with (v_climb / v_flat).
    const aeroClimbScaling = Math.pow(vClimbBaseMs / Math.max(1, vBaseMs), 3);
    const nonAeroClimbScaling = vClimbBaseMs / Math.max(1, vBaseMs);
    const effectiveClimbPowerSave = (aeroPowerSave * aeroClimbScaling) + (nonAeroPowerSave * nonAeroClimbScaling);

    const vClimbNewMs = Math.max(0.5, (safeClimbPowerWatts + effectiveClimbPowerSave) / Math.max(1, denomNew));

    const climbTimeBaseSec = climbDistM / vClimbBaseMs;
    const climbTimeNewSec = climbDistM / vClimbNewMs;
    const climbTimeSavedSec = Math.max(0, Math.round(climbTimeBaseSec - climbTimeNewSec));

    // 3. ROI Metric: Cost per Watt & Cost per Gram
    const costPerWatt = totalPowerSaveWatts > 0 ? Math.round(totalCostYuan / totalPowerSaveWatts) : 0;
    const costPerGram = totalWeightSaveG > 0 ? parseFloat((totalCostYuan / totalWeightSaveG).toFixed(1)) : 0;

    let roiLevel = '极高性价比 · 首选神装';
    let roiBadgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (totalPowerSaveWatts <= 0) {
      if (totalWeightSaveG > 0) {
        roiLevel = costPerGram < 15 ? '超轻量化优选 · 爬坡利器' : '边际轻量化 · 极限偷轻';
        roiBadgeColor = costPerGram < 15 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      } else {
        roiLevel = '外观型改装 · 无有效动力增益';
        roiBadgeColor = 'text-slate-400 bg-slate-500/10 border-slate-500/30';
      }
    } else if (costPerWatt > 1000) {
      roiLevel = '边际递减奢华件 · 极限追瓦';
      roiBadgeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    } else if (costPerWatt > 400) {
      roiLevel = '良好进阶升级 · 适中性价比';
      roiBadgeColor = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
    }

    return {
      activeCount: activeItems.length,
      totalWeightSaveG,
      totalPowerSaveWatts: parseFloat(totalPowerSaveWatts.toFixed(1)),
      totalCostYuan,
      flatTimeSavedSec,
      climbTimeSavedSec,
      costPerWatt,
      costPerGram,
      roiLevel,
      roiBadgeColor,
      aeroCorrectionApplied
    };
  }, [items, totalSystemWeightKg, flatCruiseSpeedKmh, climbPowerWatts, climbGradePct]);

  // Chart Data
  const chartData = useMemo(() => {
    return {
      labels: items.map(i => i.name.slice(0, 10)),
      datasets: [
        {
          label: '单品省瓦 (W)',
          data: items.map(i => Number(i.powerSaveWatts) || 0),
          backgroundColor: items.map(i => i.enabled ? 'rgba(0, 175, 255, 0.75)' : 'rgba(100, 116, 139, 0.2)'),
          borderRadius: 6,
        }
      ]
    };
  }, [items]);

  const handleGeneratePoster = () => {
    const url = generateUpgradeRoiPoster({
      activeCount: analysis.activeCount,
      totalWeightSaveG: analysis.totalWeightSaveG,
      totalPowerSaveWatts: analysis.totalPowerSaveWatts,
      totalCost: analysis.totalCostYuan,
      currency: currencySymbol,
      flatTimeSavedSec: analysis.flatTimeSavedSec,
      climbTimeSavedSec: analysis.climbTimeSavedSec,
      costPerWatt: analysis.costPerWatt,
      roiLevel: analysis.roiLevel
    });
    setSharePosterUrl(url);
    setIsShareModalOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Unified Tool Header */}
      <IOSToolHeader
        category={language === 'zh-TW' ? '動力與傳動' : '动力与传动'}
        categoryIcon={Scale}
        title={language === 'zh-TW' ? '改裝省瓦' : '改装省瓦'}
        description="精确测算各部件风阻省瓦、旋转质量与轻量化时间收益，科学量化改装边际效益与每瓦克重投入产出比。"
        tint="blue"
        onShare={handleGeneratePoster}
        shareTitle="生成改装升级省瓦战报海报"
        actions={
          <button
            onClick={resetToDefaults}
            className="apple-touch h-9 px-3.5 sm:px-4 rounded-xl bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 text-xs font-semibold border border-black/[0.04] dark:border-white/[0.06] transition flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            title={language === 'zh-TW' ? '重設為預設改裝件清單' : '重置为预设改装件清单'}
          >
            <RotateCcw className="w-3.5 h-3.5 text-ios-blue" />
            <span>{language === 'zh-TW' ? '重設預設' : '重置预设'}</span>
          </button>
        }
      />

      {/* Cruise speed and baseline controls */}
      <IOSCard variant="inset" className="p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-ios-blue" />
            {language === 'zh-TW' ? '基準巡航車速' : '基准巡航车速'}:
          </span>
          <div className="w-36">
            <NumberStepper
              value={flatCruiseSpeedKmh}
              onChange={setFlatCruiseSpeedKmh}
              step={1}
              min={20}
              max={55}
              unit="km/h"
            />
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline font-mono">
            {isImperial ? `(${(flatCruiseSpeedKmh * 0.621371).toFixed(1)} mph)` : ''} (P ∝ v³: ×{(speedScalingFactor).toFixed(2)})
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
            {language === 'zh-TW' ? '人車總重' : '人车总重'} ({isImperial ? 'lbs' : 'kg'}):
          </span>
          <div className="w-36">
            <NumberStepper
              value={isImperial ? parseFloat((totalSystemWeightKg * 2.20462).toFixed(1)) : totalSystemWeightKg}
              onChange={(v) => setTotalSystemWeightKg(isImperial ? parseFloat((v / 2.20462).toFixed(1)) : v)}
              step={isImperial ? 1 : 0.5}
              min={isImperial ? 99 : 45}
              max={isImperial ? 330 : 150}
              unit={isImperial ? 'lbs' : 'kg'}
              decimals={1}
            />
          </div>
        </div>
      </IOSCard>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Left Upgrade Items (Spec Picker + Custom In-place Inputs) */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-5">
          <IOSCard variant="default" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-ios-blue shrink-0" />
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-200 tracking-tight">
                    {language === 'zh-TW' ? '備選改裝清單（下拉選型自動帶出實測參數）' : '备选改装清单（下拉选择规格自动带出实测参数）'}
                  </h2>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    已生效 {analysis.activeCount} / {items.length} 件
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleAddCustomItem}
                  className="apple-touch h-8 px-2.5 sm:px-3 rounded-xl bg-ios-blue hover:bg-ios-blue/90 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{language === 'zh-TW' ? '新增改裝' : '新增改装'}</span>
                </button>
                <button
                  type="button"
                  onClick={resetToDefaults}
                  className="apple-touch h-8 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-600 dark:text-slate-300 text-xs font-medium flex items-center gap-1 transition"
                  title={language === 'zh-TW' ? '還原為預設改裝清單' : '还原为默认预设清单'}
                >
                  <RotateCcw className="w-3.5 h-3.5 text-ios-gray" />
                  <span>{language === 'zh-TW' ? '重置' : '重置'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-3.5">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border space-y-3 transition ${
                    item.enabled
                      ? 'bg-black/[0.02] dark:bg-white/[0.04] border-ios-blue/40 ring-1 ring-ios-blue/20'
                      : 'bg-white/40 dark:bg-white/[0.02] border-black/[0.05] dark:border-white/[0.08] opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <button
                        onClick={() => toggleItem(item.id)}
                        className="text-ios-blue shrink-0 hover:scale-110 transition"
                      >
                        {item.enabled ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-400 dark:text-slate-600" />}
                      </button>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItemField(item.id, 'name', e.target.value)}
                        className="bg-transparent font-bold text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:text-ios-blue w-full truncate border-b border-transparent focus:border-ios-blue/50 pb-0.5"
                      />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {items.length > 1 && (
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="text-slate-400 hover:text-rose-500 p-1 transition"
                          title="删除该项目"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Spec Dropdown (Autofills wind tunnel baseline!) */}
                  {item.specs && item.specs.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                        <span>规格选型 · 自动填入风洞与重量基准:</span>
                      </label>
                      <select
                        value={item.selectedSpecIndex ?? 0}
                        onChange={(e) => handleSelectSpec(item.id, parseInt(e.target.value, 10))}
                        className="w-full h-9 bg-slate-100/80 dark:bg-white/5 border border-black/[0.05] dark:border-white/[0.08] rounded-xl px-3 text-xs text-ios-blue font-medium focus:outline-none focus:ring-1 focus:ring-ios-blue truncate"
                      >
                        {item.specs.map((sp, sIdx) => (
                          <option key={sIdx} value={sIdx}>
                            {sp.label} (40km/h实测省 {sp.baseWatts40}W / 减 {sp.weightG}g)
                          </option>
                        ))}
                      </select>
                      {item.specs[item.selectedSpecIndex ?? 0]?.note && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400/90 pl-1 leading-relaxed flex items-start gap-1">
                          <Lightbulb className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                          <span>{item.specs[item.selectedSpecIndex ?? 0].note}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Editable 3 Inputs: Price, Weight Save, Watt Save */}
                  <div className="grid grid-cols-3 gap-2 text-xs pt-1.5 border-t border-black/[0.05] dark:border-white/[0.08] font-mono">
                    <div className="bg-slate-100/80 dark:bg-white/5 rounded-xl p-2.5 border border-black/[0.05] dark:border-white/[0.08]">
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5 font-sans">{language === 'zh-TW' ? '實際價格' : '实际价格'} ({currencySymbol})</span>
                      <div className="flex items-center text-amber-500 dark:text-amber-400 font-bold">
                        <span className="text-[11px] mr-1">{currencySymbol}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={item.costYuan === 0 ? '' : item.costYuan}
                          onChange={(e) => {
                            const raw = e.target.value;
                            updateItemField(item.id, 'costYuan', raw === '' ? 0 : (parseFloat(raw) || 0));
                          }}
                          className="bg-transparent w-full focus:outline-none text-amber-600 dark:text-amber-400 text-xs font-mono tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="bg-slate-100/80 dark:bg-white/5 rounded-xl p-2.5 border border-black/[0.05] dark:border-white/[0.08]">
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5 font-sans">减重幅度 (g)</span>
                      <div className="flex items-center text-emerald-600 dark:text-emerald-400 font-bold">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={item.weightSaveG === 0 ? '' : item.weightSaveG}
                          onChange={(e) => {
                            const raw = e.target.value;
                            updateItemField(item.id, 'weightSaveG', raw === '' ? 0 : (parseFloat(raw) || 0));
                          }}
                          className="bg-transparent w-full focus:outline-none text-emerald-600 dark:text-emerald-400 text-xs font-mono tabular-nums"
                        />
                        <span className="text-[11px] text-slate-500 font-normal ml-0.5">g</span>
                      </div>
                    </div>

                    <div className="bg-slate-100/80 dark:bg-white/5 rounded-xl p-2.5 border border-black/[0.05] dark:border-white/[0.08]">
                      <span className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5 font-sans">
                        省瓦收益 ({flatCruiseSpeedKmh}km/h)
                      </span>
                      <div className="flex items-center text-ios-blue font-bold">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          value={item.powerSaveWatts === 0 ? '' : item.powerSaveWatts}
                          onChange={(e) => {
                            const raw = e.target.value;
                            updateItemField(item.id, 'powerSaveWatts', raw === '' ? 0 : (parseFloat(raw) || 0));
                          }}
                          className="bg-transparent w-full focus:outline-none text-ios-blue text-xs font-mono tabular-nums"
                        />
                        <span className="text-[11px] text-slate-500 font-normal ml-0.5">W</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Action Bar */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handleAddCustomItem}
                className="flex-1 h-10 rounded-xl border border-dashed border-ios-blue/40 hover:border-ios-blue bg-ios-blue/5 hover:bg-ios-blue/10 text-ios-blue text-xs font-semibold flex items-center justify-center gap-1.5 transition apple-touch shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>{language === 'zh-TW' ? '新增自訂改裝升級項目' : '新增自定义改装升级项目'}</span>
              </button>
              <button
                type="button"
                onClick={resetToDefaults}
                className="h-10 px-4 rounded-xl border border-black/[0.06] dark:border-white/[0.08] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition apple-touch"
              >
                <RotateCcw className="w-3.5 h-3.5 text-ios-gray" />
                <span>{language === 'zh-TW' ? '恢復預設清單' : '恢复默认清单'}</span>
              </button>
            </div>
          </IOSCard>
        </div>

        {/* Right Output Dashboard & ROI Rating (macOS Sticky Canvas) */}
        <div className="lg:col-span-5 space-y-4 sm:space-y-5 lg:sticky lg:top-20 self-start">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="space-y-1.5">
              <IOSMetricTile
                label="总计省瓦收益"
                value={`+${analysis.totalPowerSaveWatts}`}
                unit="W"
                accentColor="blue"
                icon={Zap}
              />
              {analysis.aeroCorrectionApplied && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-start gap-1 px-1 leading-snug">
                  <Lightbulb className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                  已按气动叠加折减修正（多件气动件共享同一 CdA 减阻空间，叠加收益非线性）
                </p>
              )}
            </div>

            <IOSMetricTile
              label="整车总减重"
              value={`-${analysis.totalWeightSaveG}`}
              unit="g"
              accentColor="green"
              icon={Scale}
            />

            <IOSMetricTile
              label="改装总投资"
              value={`${currencySymbol}${analysis.totalCostYuan}`}
              unit=""
              accentColor="orange"
              icon={DollarSign}
            />
          </div>

          {/* Time Saved Comparisons */}
          <div className="grid grid-cols-2 gap-3">
            <IOSCard variant="inset" className="p-4 space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-ios-blue" />
                40km 平路巡航省时
              </span>
              <div className="text-xl font-bold font-mono text-ios-blue">
                节省 {analysis.flatTimeSavedSec} 秒
              </div>
              <span className="text-[11px] text-slate-500">约 {(analysis.flatTimeSavedSec / 60).toFixed(1)} 分钟优势</span>
            </IOSCard>

            <IOSCard variant="inset" className="p-4 space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                10km 7.5% 爬坡省时
              </span>
              <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                节省 {analysis.climbTimeSavedSec} 秒
              </div>
              <span className="text-[11px] text-slate-500">约 {(analysis.climbTimeSavedSec / 60).toFixed(1)} 分钟优势</span>
            </IOSCard>
          </div>

          {/* ROI Metric & Badge */}
          <IOSCard variant="default" className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-600 dark:text-slate-400">改装性价比与边际收益评级</span>
              <span className={`text-xs px-3 py-1 rounded-full font-bold border ${analysis.roiBadgeColor}`}>
                {currencySymbol}{analysis.costPerWatt} / W
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
              <span>{analysis.roiLevel}</span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed space-y-1">
              <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>风洞与改装避坑法则：</span>
              </div>
              <p>• <strong>黄金第一阶 (&lt;{currencySymbol}200/W)</strong>：修身/破风骑行服、TPU 超轻内胎/真空胎，花费较低立省 7~10W。</p>
              <p>• <strong>进阶第二阶 ({currencySymbol}300~600/W)</strong>：50mm 综合气动碳轮、一体把、气动头盔，兼具巡航破风与整车颜值。</p>
              <p>• <strong>边际递减阶 (&gt;{currencySymbol}1000/W)</strong>：陶瓷大导轮、钛合金螺丝，适合发烧竞技车手追求极限边际增益。</p>
            </div>
          </IOSCard>

          {/* Single Item Wattage Contribution Chart */}
          <IOSCard variant="default" className="space-y-4">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-300 block">各单品省瓦贡献对比柱状图 (Watts @ {flatCruiseSpeedKmh}km/h)</span>
            <div className="h-44">
              <Bar
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { color: 'rgba(150, 150, 150, 0.1)' }, ticks: { font: { size: 10 } } },
                    y: { grid: { color: 'rgba(150, 150, 150, 0.1)' }, title: { display: true, text: '节省瓦数 (W)', font: { size: 10 } } }
                  }
                }}
              />
            </div>
          </IOSCard>
        </div>
      </div>

      {/* Social Share Poster Modal */}
      <ShareCardModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        imageUrl={sharePosterUrl}
        title="改装升级省瓦战报"
        downloadFileName={`LaBao_改装省瓦_${analysis.activeCount}项_${analysis.totalWeightSaveG}g.png`}
      />
    </div>
  );
};
