import React, { useState, useMemo } from 'react';
import {
  Sliders,
  Gauge,
  HelpCircle,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowDownCircle,
  Activity,
  ChevronRight,
  ShieldAlert,
  Zap,
  Layers,
  Wrench,
  Compass,
  Share2
} from 'lucide-react';
import { IOSCard, IOSCardHeader, IOSMetricTile } from '../common/IOSCard';
import { IOSToolHeader } from '../common/IOSToolHeader';
import { IOSSegmentedControl } from '../common/IOSSegmentedControl';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';
import { useToast } from '../../context/ToastContext';
import { useRiderProfile } from '../../context/RiderProfileContext';
import { ShareCardModal } from '../common/ShareCardModal';
import { generateSuspensionPoster } from '../../utils/shareCardGenerators';
import { calculateSuspensionSetup } from '../../utils/suspensionEngine';

export const MtbSuspensionTuner: React.FC = () => {
  const { language, unitSystem } = useLanguageAndUnit();
  const { showToast } = useToast();
  const { profile, activeRider } = useRiderProfile();
  const isImperial = unitSystem === 'imperial';

  // Rider & Gear Weight
  const baseWeightKg = activeRider?.weightKg || profile.weightKg || 70;
  const [gearWeightKg, setGearWeightKg] = useState<number>(4.5); // Helmet, pads, shoes, hydration pack
  const totalRiderWeightKg = baseWeightKg + gearWeightKg;
  const totalRiderWeightLbs = totalRiderWeightKg * 2.20462;

  // Vehicle Powertrain Type
  const [isEmtb, setIsEmtb] = useState<boolean>(false);

  // Discipline & Riding Style
  const [discipline, setDiscipline] = useState<'xc' | 'trail' | 'enduro' | 'dh'>('enduro');
  const [ridingStyle, setRidingStyle] = useState<'balanced' | 'plush' | 'firm'>('balanced');

  // Fork Specs
  const [forkBrand, setForkBrand] = useState<'fox' | 'rockshox' | 'other'>('fox');
  const [forkModel, setForkModel] = useState<string>('fox36');
  const [forkTravelMm, setForkTravelMm] = useState<number>(160);
  const [forkStanchionMm, setForkStanchionMm] = useState<number>(36);
  const [forkDamper, setForkDamper] = useState<'grip2' | 'fit4' | 'charger3' | 'standard'>('grip2');
  const [measuredForkSagMm, setMeasuredForkSagMm] = useState<number>(38);

  // Rear Shock Specs
  const [shockType, setShockType] = useState<'air' | 'coil'>('air');
  const [frameRearTravelMm, setFrameRearTravelMm] = useState<number>(150);
  const [shockStrokeMm, setShockStrokeMm] = useState<number>(55);
  const [linkageProgressivity, setLinkageProgressivity] = useState<'linear' | 'progressive' | 'high_progressive'>('progressive');
  const [measuredShockSagMm, setMeasuredShockSagMm] = useState<number>(16);

  // Fine tune offset sliders
  const [forkPsiOffset, setForkPsiOffset] = useState<number>(0);
  const [shockPsiOffset, setShockPsiOffset] = useState<number>(0);

  // Presets
  const applyPreset = (presetKey: 'xc_race' | 'trail_allround' | 'enduro_race' | 'dh_park') => {
    if (presetKey === 'xc_race') {
      setDiscipline('xc');
      setRidingStyle('firm');
      setForkBrand('rockshox');
      setForkModel('rs_sid');
      setForkTravelMm(120);
      setForkStanchionMm(35);
      setForkDamper('charger3');
      setShockType('air');
      setFrameRearTravelMm(115);
      setShockStrokeMm(45);
      setLinkageProgressivity('progressive');
      setGearWeightKg(2.5);
      setForkPsiOffset(0);
      setShockPsiOffset(0);
      setMeasuredForkSagMm(20);
      setMeasuredShockSagMm(9);
      showToast(language === 'zh-TW' ? '已載入 XC 競速輕量化設定' : '已载入 XC 竞速轻量化设定', 'info');
    } else if (presetKey === 'trail_allround') {
      setDiscipline('trail');
      setRidingStyle('balanced');
      setForkBrand('fox');
      setForkModel('fox34');
      setForkTravelMm(140);
      setForkStanchionMm(34);
      setForkDamper('fit4');
      setShockType('air');
      setFrameRearTravelMm(130);
      setShockStrokeMm(50);
      setLinkageProgressivity('progressive');
      setGearWeightKg(3.8);
      setForkPsiOffset(0);
      setShockPsiOffset(0);
      setMeasuredForkSagMm(32);
      setMeasuredShockSagMm(13);
      showToast(language === 'zh-TW' ? '已載入 Trail 林道全能平衡設定' : '已载入 Trail 林道全能平衡设定', 'info');
    } else if (presetKey === 'enduro_race') {
      setDiscipline('enduro');
      setRidingStyle('balanced');
      setForkBrand('fox');
      setForkModel('fox38');
      setForkTravelMm(170);
      setForkStanchionMm(38);
      setForkDamper('grip2');
      setShockType('air');
      setFrameRearTravelMm(160);
      setShockStrokeMm(62.5);
      setLinkageProgressivity('high_progressive');
      setGearWeightKg(5.2);
      setForkPsiOffset(0);
      setShockPsiOffset(0);
      setMeasuredForkSagMm(46);
      setMeasuredShockSagMm(18);
      showToast(language === 'zh-TW' ? '已載入 Enduro 耐力重裝設定' : '已载入 Enduro 耐力重装设定', 'info');
    } else if (presetKey === 'dh_park') {
      setDiscipline('dh');
      setRidingStyle('plush');
      setForkBrand('fox');
      setForkModel('fox40');
      setForkTravelMm(200);
      setForkStanchionMm(40);
      setForkDamper('grip2');
      setShockType('coil');
      setFrameRearTravelMm(200);
      setShockStrokeMm(75);
      setLinkageProgressivity('progressive');
      setGearWeightKg(6.5);
      setForkPsiOffset(0);
      setShockPsiOffset(0);
      setMeasuredForkSagMm(62);
      setMeasuredShockSagMm(24);
      showToast(language === 'zh-TW' ? '已載入 DH 速降重裝彈簧設定' : '已载入 DH 速降重装弹簧设定', 'info');
    }
  };

  // Calculations using pure suspensionEngine
  const calc = useMemo(() => {
    return calculateSuspensionSetup({
      riderWeightKg: baseWeightKg,
      gearWeightKg,
      isEmtb,
      discipline,
      ridingStyle,
      forkBrand,
      forkStanchionMm,
      forkTravelMm,
      forkPsiOffset,
      measuredForkSagMm,
      shockType,
      frameRearTravelMm,
      shockStrokeMm,
      linkageProgressivity,
      shockPsiOffset,
      measuredShockSagMm
    });
  }, [
    baseWeightKg,
    gearWeightKg,
    isEmtb,
    discipline,
    ridingStyle,
    forkBrand,
    forkStanchionMm,
    forkTravelMm,
    forkPsiOffset,
    measuredForkSagMm,
    shockType,
    frameRearTravelMm,
    shockStrokeMm,
    linkageProgressivity,
    shockPsiOffset,
    measuredShockSagMm
  ]);

  // Social Share Poster State
  const [sharePosterUrl, setSharePosterUrl] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  const handleGeneratePoster = async () => {
    try {
      const url = await generateSuspensionPoster({
        riderName: activeRider?.name || 'Rider',
        totalWeightKg: Math.round(totalRiderWeightKg * 10) / 10,
        discipline: (isEmtb ? 'E-MTB ' : '') + discipline.toUpperCase() + ' 越野',
        forkModel: forkBrand.toUpperCase() + ' ' + forkStanchionMm + 'mm',
        forkTravel: forkTravelMm,
        forkPsi: calc.finalForkPsi,
        forkSagPct: calc.targetForkSagPct,
        forkLsr: calc.reboundClicksOut,
        forkLsc: calc.lscClicksOut,
        shockType: shockType,
        shockTravel: frameRearTravelMm,
        shockPsiOrSpring: shockType === 'air' ? `${calc.finalShockPsi} PSI` : `${calc.closestSpringRate} lbs/in`,
        shockSagPct: calc.targetShockSagPct,
        shockRebound: calc.shockReboundClicks
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
        category={language === 'zh-TW' ? '動力與傳動' : '动力与传动'}
        categoryIcon={Sliders}
        title={
          language === 'zh-TW'
            ? '避震設定'
            : '避震设定'
        }
        description={
          language === 'zh-TW'
            ? '前叉氣壓/後膽彈簧磅數 · 下沉量標尺推導 · 阻尼點位 · 槓桿比與氣室容積'
            : '前叉气压/后胆弹簧磅数 · 下沉量标尺推导 · 阻尼点位 · 杠杆比与气室容积'
        }
        tint="blue"
        onShare={handleGeneratePoster}
        shareTitle="生成避震设定卡"
        actions={
          <div className="h-9 px-3.5 rounded-xl bg-slate-100/90 dark:bg-white/10 border border-black/[0.05] dark:border-white/10 text-xs font-mono shadow-2xs flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-600 dark:text-slate-300">
              {activeRider ? activeRider.name : 'Rider'}:
            </span>
            <span className="font-bold text-slate-900 dark:text-white tabular-nums">
              {baseWeightKg} kg
            </span>
            <span className="text-slate-400 tabular-nums">+ 装具 {gearWeightKg}kg</span>
          </div>
        }
      >
        {/* Quick Discipline Presets */}
        <div className="w-full">
          <IOSSegmentedControl
            options={[
              {
                value: 'xc_race',
                label: (
                  <>
                    <span className="sm:hidden">XC 120</span>
                    <span className="hidden sm:inline">XC 竞速 120mm</span>
                  </>
                )
              },
              {
                value: 'trail_allround',
                label: (
                  <>
                    <span className="sm:hidden">Trail 140</span>
                    <span className="hidden sm:inline">林道全地形 140mm</span>
                  </>
                )
              },
              {
                value: 'enduro_race',
                label: (
                  <>
                    <span className="sm:hidden">Enduro 170</span>
                    <span className="hidden sm:inline">耐力下坡 170mm</span>
                  </>
                )
              },
              {
                value: 'dh_park',
                label: (
                  <>
                    <span className="sm:hidden">DH 200</span>
                    <span className="hidden sm:inline">速降极限 200mm</span>
                  </>
                )
              },
            ]}
            value={
              discipline === 'xc' ? 'xc_race' :
              discipline === 'trail' ? 'trail_allround' :
              discipline === 'enduro' ? 'enduro_race' : 'dh_park'
            }
            onChange={(val) => applyPreset(val as any)}
            size="sm"
          />
        </div>
      </IOSToolHeader>

      {/* Top Tuning Parameters & Rider Loading */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Weight & Gear */}
        <IOSCard>
          <IOSCardHeader title={language === 'zh-TW' ? '車手全負重' : '车手全负重'} />
          <div className="space-y-4 pt-3">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-600 dark:text-slate-400">车手裸重</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {baseWeightKg} kg / {Math.round(baseWeightKg * 2.20462)} lbs
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-600 dark:text-slate-400">
                  {language === 'zh-TW' ? '防護裝具/背包/水壺重' : '防护装具/背包/水壶重'}
                </span>
                <span className="font-mono font-bold text-ios-blue">
                  +{gearWeightKg} kg (+{Math.round(gearWeightKg * 2.20462)} lbs)
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={0.5}
                value={gearWeightKg}
                onChange={(e) => setGearWeightKg(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-ios-blue"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                <span>轻装 2kg</span>
                <span>重装全盔护甲 6kg</span>
                <span>重载 10kg</span>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-600 dark:text-slate-400 mb-1.5 block">
                {language === 'zh-TW' ? '車輛動力形式' : '车辆动力形式'}
              </label>
              <IOSSegmentedControl
                options={[
                  {
                    value: 'acoustic',
                    label: (
                      <>
                        <span className="sm:hidden">人力</span>
                        <span className="hidden sm:inline">{language === 'zh-TW' ? '傳統人力' : '传统人力'}</span>
                      </>
                    )
                  },
                  {
                    value: 'emtb',
                    label: (
                      <>
                        <span className="sm:hidden">E-MTB</span>
                        <span className="hidden sm:inline">E-MTB (+10~15kg)</span>
                      </>
                    )
                  }
                ]}
                value={isEmtb ? 'emtb' : 'acoustic'}
                onChange={(v) => setIsEmtb(v === 'emtb')}
              />
            </div>

            <div className="p-3 rounded-xl bg-ios-blue/10 border border-ios-blue/20 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {language === 'zh-TW' ? '避震計算總負重' : '避震计算总负重'}
              </span>
              <div className="text-right">
                <span className="text-base font-bold font-mono text-ios-blue">
                  {Math.round(totalRiderWeightKg * 10) / 10} kg ({Math.round(totalRiderWeightLbs)} lbs)
                </span>
                {isEmtb && (
                  <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    + E-MTB 电机电池重车身补偿
                  </span>
                )}
              </div>
            </div>
          </div>
        </IOSCard>

        {/* Riding Style & Feel */}
        <IOSCard>
          <IOSCardHeader title={language === 'zh-TW' ? '風格與預壓偏好' : '风格与预压偏好'} />
          <div className="space-y-4 pt-3">
            <div>
              <label className="text-xs text-slate-600 dark:text-slate-400 mb-2 block">
                {language === 'zh-TW' ? '支撐性偏好' : '支撑性偏好'}
              </label>
              <IOSSegmentedControl
                options={[
                  {
                    value: 'plush',
                    label: (
                      <>
                        <span className="sm:hidden">{language === 'zh-TW' ? '柔順' : '柔顺'}</span>
                        <span className="hidden sm:inline">{language === 'zh-TW' ? '柔順吸震' : '柔顺吸震'}</span>
                      </>
                    )
                  },
                  {
                    value: 'balanced',
                    label: (
                      <>
                        <span className="sm:hidden">{language === 'zh-TW' ? '平衡' : '平衡'}</span>
                        <span className="hidden sm:inline">{language === 'zh-TW' ? '黃金平衡' : '黄金平衡'}</span>
                      </>
                    )
                  },
                  {
                    value: 'firm',
                    label: (
                      <>
                        <span className="sm:hidden">{language === 'zh-TW' ? '堅挺' : '坚挺'}</span>
                        <span className="hidden sm:inline">{language === 'zh-TW' ? '堅挺支撐' : '坚挺支撑'}</span>
                      </>
                    )
                  }
                ]}
                value={ridingStyle}
                onChange={(v) => setRidingStyle(v as 'balanced' | 'plush' | 'firm')}
              />
            </div>

            <div>
              <label className="text-xs text-slate-600 dark:text-slate-400 mb-2 block">
                {language === 'zh-TW' ? '越野車種分類' : '越野车种分类'}
              </label>
              <IOSSegmentedControl
                options={[
                  {
                    value: 'xc',
                    label: (
                      <>
                        <span className="sm:hidden">XC</span>
                        <span className="hidden sm:inline">XC 竞速</span>
                      </>
                    )
                  },
                  { value: 'trail', label: 'Trail' },
                  { value: 'enduro', label: 'Enduro' },
                  {
                    value: 'dh',
                    label: (
                      <>
                        <span className="sm:hidden">DH</span>
                        <span className="hidden sm:inline">DH 速降</span>
                      </>
                    )
                  }
                ]}
                value={discipline}
                onChange={(v) => setDiscipline(v as any)}
              />
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 p-2.5 rounded-xl leading-relaxed">
              <span className="font-semibold text-slate-700 dark:text-slate-300">目标下沉率：</span>
              前叉 {calc.targetForkSagPct}% ({calc.targetForkSagMm}mm) · 后避震 {calc.targetShockSagPct}% ({calc.targetShockSagMm}mm)
            </div>
          </div>
        </IOSCard>

        {/* Linkage & Frame Leverage */}
        <IOSCard>
          <IOSCardHeader title={language === 'zh-TW' ? '後輪槓桿比' : '后轮杠杆比'} />
          <div className="space-y-4 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
                  后轮行程 (mm)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={80}
                  max={230}
                  value={frameRearTravelMm || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFrameRearTravelMm(v === '' ? 0 : (parseInt(v, 10) || 0));
                  }}
                  onBlur={() => {
                    if (!frameRearTravelMm || frameRearTravelMm < 80) setFrameRearTravelMm(80);
                    else if (frameRearTravelMm > 230) setFrameRearTravelMm(230);
                  }}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-mono font-bold text-slate-900 dark:text-white tabular-nums"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
                  后胆行程 (mm)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min={35}
                  max={85}
                  step={0.5}
                  value={shockStrokeMm || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setShockStrokeMm(v === '' ? 0 : (parseFloat(v) || 0));
                  }}
                  onBlur={() => {
                    if (!shockStrokeMm || shockStrokeMm < 30) setShockStrokeMm(30);
                    else if (shockStrokeMm > 85) setShockStrokeMm(85);
                  }}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm font-mono font-bold text-slate-900 dark:text-white tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-600 dark:text-slate-400 mb-1.5 block">
                {language === 'zh-TW' ? '連桿壓縮漸進率' : '连杆压缩渐进率'}
              </label>
              <IOSSegmentedControl
                options={[
                  {
                    value: 'linear',
                    label: (
                      <>
                        <span className="sm:hidden">线性</span>
                        <span className="hidden sm:inline">线性单转点</span>
                      </>
                    )
                  },
                  {
                    value: 'progressive',
                    label: (
                      <>
                        <span className="sm:hidden">渐进</span>
                        <span className="hidden sm:inline">渐进多连杆</span>
                      </>
                    )
                  },
                  {
                    value: 'high_progressive',
                    label: (
                      <>
                        <span className="sm:hidden">超渐进</span>
                        <span className="hidden sm:inline">{'高渐进曲率'}</span>
                      </>
                    )
                  }
                ]}
                value={linkageProgressivity}
                onChange={(v) => setLinkageProgressivity(v as any)}
              />
            </div>

            <div className="p-2.5 rounded-xl bg-ios-blue/10 border border-ios-blue/20 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                平均杠杆比
              </span>
              <span className="text-sm font-bold font-mono text-ios-blue">
                {calc.leverageRatio}:1
              </span>
            </div>
          </div>
        </IOSCard>
      </div>

      {/* E-MTB Compensation Active Banner */}
      {isEmtb && calc.emtbAdvisory && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <Zap className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>E-MTB 重车架气室气压与回弹阻尼代偿已激活</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono font-bold">
                  E-BIKE TUNED
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {calc.emtbAdvisory.pressureSummaryZh} · {calc.emtbAdvisory.dampingSummaryZh}
              </p>
            </div>
          </div>
          <div className="text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/15 px-3 py-1.5 rounded-xl shrink-0 self-start sm:self-center">
            {calc.emtbAdvisory.spacerSummaryZh}
          </div>
        </div>
      )}

      {/* Main Suspension Tuning Hub: 2 Columns (Fork vs Rear Shock) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* LEFT: FRONT FORK */}
        <div className="space-y-4">
          <IOSCard>
            <IOSCardHeader
              title={language === 'zh-TW' ? '前叉設定' : '前叉设定'}
              action={
                <span className="text-xs font-mono font-bold text-ios-blue">
                  {forkBrand.toUpperCase()} {forkStanchionMm}mm / {forkTravelMm}mm
                </span>
              }
            />
            <div className="space-y-4 pt-3">
              {/* Brand & Damper Selector */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
                    前叉品牌
                  </label>
                  <select
                    value={forkBrand}
                    onChange={(e) => setForkBrand(e.target.value as any)}
                    className="w-full h-9 px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-800 dark:text-white"
                  >
                    <option value="fox">FOX Racing Shox</option>
                    <option value="rockshox">RockShox (SRAM)</option>
                    <option value="other">Marzocchi / Öhlins / 其他</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-600 dark:text-slate-400 block mb-1">
                    内管管径
                  </label>
                  <select
                    value={forkStanchionMm}
                    onChange={(e) => setForkStanchionMm(parseInt(e.target.value))}
                    className="w-full h-9 px-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-800 dark:text-white"
                  >
                    <option value={32}>32mm</option>
                    <option value={34}>34mm / 35mm</option>
                    <option value={36}>36mm</option>
                    <option value={38}>38mm</option>
                    <option value={40}>40mm</option>
                  </select>
                </div>
              </div>

              {/* Travel Slider */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-400">前叉行程</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {forkTravelMm} mm
                  </span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={203}
                  step={10}
                  value={forkTravelMm}
                  onChange={(e) => setForkTravelMm(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-ios-blue"
                />
              </div>

              {/* PRIMARY OUTPUT: FORK AIR PRESSURE & SAG */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-4 rounded-2xl bg-ios-blue/15 border border-ios-blue/30 text-center">
                  <div className="text-[11px] font-semibold text-ios-blue">
                    推荐前叉主气室气压
                  </div>
                  <div className="text-3xl font-bold font-mono tabular-nums text-ios-blue my-1">
                    {calc.finalForkPsi}
                    <span className="text-sm ml-1 font-sans">PSI</span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    微调偏移: {forkPsiOffset > 0 ? `+${forkPsiOffset}` : forkPsiOffset} PSI
                    {isEmtb && (
                      <span className="ml-1 text-amber-600 dark:text-amber-400 font-semibold">
                        (含 E-MTB +{calc.emtbForkPsiBonus})
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] text-center">
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    标准静态下沉量
                  </div>
                  <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white my-1">
                    {calc.targetForkSagMm}
                    <span className="text-sm ml-1 font-sans">mm</span>
                  </div>
                  <div className="text-[11px] font-bold text-ios-blue">
                    目标下沉率: {calc.targetForkSagPct}%
                  </div>
                </div>
              </div>

              {/* Fine tune slider */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 whitespace-nowrap">气压微调:</span>
                <input
                  type="range"
                  min={-15}
                  max={15}
                  value={forkPsiOffset}
                  onChange={(e) => setForkPsiOffset(parseInt(e.target.value))}
                  className="flex-1 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-ios-blue"
                />
                <button
                  onClick={() => setForkPsiOffset(0)}
                  className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400"
                  title="复位"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Fork Damping Clicks */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-2.5">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>阻尼旋钮点击建议（由全闭 / Fully Closed 逆时针开退）</span>
                  <span className="text-[11px] font-mono text-ios-blue">CLICKS OUT</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <div className="text-red-500 font-semibold text-[11px]">低速回弹 LSR</div>
                    <div className="font-mono font-bold text-slate-900 dark:text-white text-base mt-0.5">
                      {calc.reboundClicksOut}
                    </div>
                    <div className="text-[11px] text-slate-400">格</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <div className="text-blue-500 font-semibold text-[11px]">低速压缩 LSC</div>
                    <div className="font-mono font-bold text-slate-900 dark:text-white text-base mt-0.5">
                      {calc.lscClicksOut}
                    </div>
                    <div className="text-[11px] text-slate-400">格</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <div className="text-purple-500 font-semibold text-[11px]">高速压缩 HSC</div>
                    <div className="font-mono font-bold text-slate-900 dark:text-white text-base mt-0.5">
                      {calc.hscClicksOut}
                    </div>
                    <div className="text-[11px] text-slate-400">格</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <div className="text-ios-blue font-semibold text-[11px]">气室垫块 Token</div>
                    <div className="font-mono font-bold text-slate-900 dark:text-white text-base mt-0.5">
                      {calc.recommendedForkTokens}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {isEmtb ? '枚 (+1 E-MTB)' : '枚'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive SAG Ruler Bar for Fork */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    实测前叉下沉量核验:
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {measuredForkSagMm} mm ({calc.actualForkSagPct}%)
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={Math.round(forkTravelMm * 0.55)}
                  value={measuredForkSagMm}
                  onChange={(e) => setMeasuredForkSagMm(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-ios-blue"
                />

                {/* Status Indicator */}
                <div
                  className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-medium transition ${
                    calc.forkSagDiagnosis === 'optimal'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                      : calc.forkSagDiagnosis === 'too_soft'
                      ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {calc.forkSagDiagnosis === 'optimal' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                      <span>前叉下沉量完美契合黄金区间（误差 ≤ 3%），平衡了小震动滤震与大冲击支撑！</span>
                    </>
                  ) : calc.forkSagDiagnosis === 'too_soft' ? (
                    <>
                      <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                      <span>
                        前叉下沉过大（过软），急刹容易点头且下台阶易打底！建议将气压增加 5~10 PSI 或添加 1 个气室垫块。
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                      <span>
                        前叉下沉偏小（过硬），小臂容易发酸充血！建议释放 5~8 PSI 气压以恢复初段顺滑贴地。
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </IOSCard>
        </div>

        {/* RIGHT: REAR SHOCK (AIR OR COIL) */}
        <div className="space-y-4">
          <IOSCard>
            <IOSCardHeader
              title={language === 'zh-TW' ? '後避震調校' : '后避震调校'}
              action={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShockType('air')}
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition ${
                      shockType === 'air'
                        ? 'bg-ios-blue text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-500'
                    }`}
                  >
                    气压后胆
                  </button>
                  <button
                    type="button"
                    onClick={() => setShockType('coil')}
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition ${
                      shockType === 'coil'
                        ? 'bg-ios-blue text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-white/5 text-slate-500'
                    }`}
                  >
                    钢簧后胆
                  </button>
                </div>
              }
            />
            <div className="space-y-4 pt-3">
              {/* PRIMARY SHOCK OUTPUT */}
              {shockType === 'air' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-ios-blue/15 border border-ios-blue/30 text-center">
                      <div className="text-[11px] font-semibold text-ios-blue">
                        推荐后胆主气室气压
                      </div>
                      <div className="text-3xl font-bold font-mono tabular-nums text-ios-blue my-1">
                        {calc.finalShockPsi}
                        <span className="text-sm ml-1 font-sans">PSI</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        杠杆比 {calc.leverageRatio}:1 补偿修正
                        {isEmtb && (
                          <span className="ml-1 text-amber-600 dark:text-amber-400 font-semibold">
                            (含 E-MTB +{calc.emtbShockPsiBonus} PSI)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center">
                      <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        后胆 O 圈标称下沉距离
                      </div>
                      <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white my-1">
                        {calc.targetShockSagMm}
                        <span className="text-sm ml-1 font-sans">mm</span>
                      </div>
                      <div className="text-[11px] font-bold text-ios-blue">
                        目标下沉率: {calc.targetShockSagPct}%
                      </div>
                    </div>
                  </div>

                  {/* Shock PSI Fine-tune */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 whitespace-nowrap">后胆微调:</span>
                    <input
                      type="range"
                      min={-20}
                      max={20}
                      value={shockPsiOffset}
                      onChange={(e) => setShockPsiOffset(parseInt(e.target.value))}
                      className="flex-1 h-1.5 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-ios-blue"
                    />
                    <button
                      onClick={() => setShockPsiOffset(0)}
                      className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400"
                      title="复位"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              ) : (
                /* Coil Shock Spring Rate Output */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-2xl bg-ios-blue/15 border border-ios-blue/30 text-center">
                      <div className="text-[11px] font-semibold text-ios-blue">
                        推荐市售弹簧磅数
                      </div>
                      <div className="text-3xl font-bold font-mono tabular-nums text-ios-blue my-1">
                        {calc.closestSpringRate}
                        <span className="text-sm ml-1 font-sans">lbs/in</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        精确理论计算: {calc.exactSpringRate} lbs/in
                        {isEmtb && (
                          <span className="ml-1 text-amber-600 dark:text-amber-400 font-sans font-semibold">
                            (含 E-MTB +{calc.emtbCoilRateBonus} lbs)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] text-center">
                      <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        预紧环调节圈数
                      </div>
                      <div className="text-3xl font-bold font-mono tabular-nums text-slate-900 dark:text-white my-1">
                        1 ~ 2
                        <span className="text-sm ml-1 font-sans">圈</span>
                      </div>
                      <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        注意：预紧切勿超过 2.5 圈！
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08] text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      弹簧选型提示：
                    </span>
                    若想要更敏锐的贴地循迹性可选{' '}
                    <strong className="text-ios-blue">{calc.closestSpringRate - 25} lbs</strong> 弹簧；
                    若常飞大落差抛台推荐选配{' '}
                    <strong className="text-ios-blue">{calc.closestSpringRate} ~ {calc.closestSpringRate + 25} lbs</strong>。
                  </div>
                </div>
              )}

              {/* Shock Damping Controls */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-2.5">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                  <span>后避震阻尼点击点位（由全闭逆时针旋转）</span>
                  <span className="text-[11px] font-mono text-ios-blue">CLICKS OUT</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <div className="text-red-500 font-semibold text-[11px]">后胆回弹 Rebound</div>
                    <div className="font-mono font-bold text-slate-900 dark:text-white text-base mt-0.5">
                      {calc.shockReboundClicks}
                    </div>
                    <div className="text-[11px] text-slate-400">格</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <div className="text-blue-500 font-semibold text-[11px]">后胆低速压缩 LSC</div>
                    <div className="font-mono font-bold text-slate-900 dark:text-white text-base mt-0.5">
                      {calc.shockLscClicks}
                    </div>
                    <div className="text-[11px] text-slate-400">格</div>
                  </div>
                </div>
              </div>

              {/* Shock Measured Sag Slider */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    实测后胆 O 圈滑动距离:
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {measuredShockSagMm} mm ({calc.actualShockSagPct}%)
                  </span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={Math.round(shockStrokeMm * 0.6)}
                  step={0.5}
                  value={measuredShockSagMm}
                  onChange={(e) => setMeasuredShockSagMm(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-ios-blue"
                />

                {/* Status Indicator */}
                <div
                  className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-medium transition ${
                    calc.shockSagDiagnosis === 'optimal'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                      : calc.shockSagDiagnosis === 'too_soft'
                      ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {calc.shockSagDiagnosis === 'optimal' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                      <span>后轮下沉量恰处于车架踩踏平台与滤震最佳区间！</span>
                    </>
                  ) : calc.shockSagDiagnosis === 'too_soft' ? (
                    <>
                      <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                      <span>
                        后避震过软（下沉过大），上坡容易泄力下沉，建议补充 10~15 PSI 或调高弹簧磅数。
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                      <span>
                        后避震偏硬，后轮在碎石与树根路段容易弹跳失控，建议释放 8~12 PSI 气压。
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </IOSCard>
        </div>
      </div>

      {/* Pro Dynamic SAG Graphic Ruler (SVG) */}
      <IOSCard>
        <IOSCardHeader
          title={language === 'zh-TW' ? '行程與 O 圈' : '行程与 O 圈'}
          subtitle={language === 'zh-TW' ? '動態視覺化避震行程狀態' : '动态可视化避震行程状态'}
        />
        <div className="space-y-4 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08]">
            {/* Fork SVG */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                <span>前叉内管与 O 圈位置</span>
                <span className="font-mono text-ios-blue tabular-nums">
                  {measuredForkSagMm}mm / {forkTravelMm}mm ({calc.actualForkSagPct}%)
                </span>
              </div>
              <div className="h-10 bg-black/[0.05] dark:bg-white/[0.08] rounded-xl relative overflow-hidden border border-black/[0.05] dark:border-white/[0.08]">
                {/* Target Zone */}
                <div
                  className="absolute top-0 bottom-0 bg-emerald-500/25 border-r-2 border-emerald-500 z-0"
                  style={{
                    left: `${Math.max(0, calc.targetForkSagPct - 3)}%`,
                    width: '6%'
                  }}
                  title="最佳 SAG 窗口"
                />
                {/* Travel Used Fill */}
                <div
                  className="h-full bg-gradient-to-r from-ios-blue/40 to-ios-blue/70 transition-all duration-200"
                  style={{ width: `${Math.min(100, calc.actualForkSagPct)}%` }}
                />
                {/* O-Ring Marker */}
                <div
                  className="absolute top-0 bottom-0 w-2.5 bg-red-500 rounded-xs shadow-ios-sm border border-white dark:border-black cursor-pointer transform -translate-x-1/2 transition-all duration-200 z-10"
                  style={{ left: `${Math.min(100, calc.actualForkSagPct)}%` }}
                  title="前叉密封 O 圈"
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
                <span>0mm (Top Out)</span>
                <span className="text-emerald-500 font-bold">Target: {calc.targetForkSagMm}mm</span>
                <span>{forkTravelMm}mm (Bottom Out)</span>
              </div>
            </div>

            {/* Shock SVG */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
                <span>后胆主轴与 O 圈位置</span>
                <span className="font-mono text-ios-blue tabular-nums">
                  {measuredShockSagMm}mm / {shockStrokeMm}mm ({calc.actualShockSagPct}%)
                </span>
              </div>
              <div className="h-10 bg-black/[0.05] dark:bg-white/[0.08] rounded-xl relative overflow-hidden border border-black/[0.05] dark:border-white/[0.08]">
                {/* Target Zone */}
                <div
                  className="absolute top-0 bottom-0 bg-ios-blue/25 border-r-2 border-ios-blue z-0"
                  style={{
                    left: `${Math.max(0, calc.targetShockSagPct - 3)}%`,
                    width: '6%'
                  }}
                  title="最佳 SAG 窗口"
                />
                {/* Travel Used Fill */}
                <div
                  className="h-full bg-gradient-to-r from-ios-blue/40 to-ios-blue/70 transition-all duration-200"
                  style={{ width: `${Math.min(100, calc.actualShockSagPct)}%` }}
                />
                {/* O-Ring Marker */}
                <div
                  className="absolute top-0 bottom-0 w-2.5 bg-red-500 rounded-xs shadow-ios-sm border border-white dark:border-black cursor-pointer transform -translate-x-1/2 transition-all duration-200 z-10"
                  style={{ left: `${Math.min(100, calc.actualShockSagPct)}%` }}
                  title="后避震 O 圈"
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-mono">
                <span>0mm（完全展开）</span>
                <span className="text-ios-blue font-bold">Target: {calc.targetShockSagMm}mm</span>
                <span>{shockStrokeMm}mm（彻底触底）</span>
              </div>
            </div>
          </div>
        </div>
      </IOSCard>

      {/* Pro Trailside Tuning & Diagnostics Playbook */}
      <IOSCard>
        <IOSCardHeader
          title={language === 'zh-TW' ? '疑難排解' : '疑难排解'}
          subtitle={language === 'zh-TW' ? '車隊級避震調校疑難排解指南' : '车队级避震调校疑难排解指南'}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-3">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              连续刹车坑颠簸/手臂发酸
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              <strong>症状</strong>：前轮发硬、震手，抓地力不足。<br />
              <strong>对策</strong>：逆时针放退 2 格低速回弹加快回弹速度，防止避震器连续受压缩进深处无法回弹；或释放 4~6 PSI 气压。
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-red-600 dark:text-red-400">
              <ShieldAlert className="w-4 h-4" />
              飞坠或大落差频繁触底打底
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              <strong>症状</strong>：打底发出金属撞击声，O 圈被推至行程极限。<br />
              <strong>对策</strong>：切勿盲目过量打高气压（会破坏初段贴地）。建议在正气室增加 <strong>1 枚容积垫块</strong>，大幅拉高末段渐进曲线。
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-ios-blue">
              <Wrench className="w-4 h-4" />
              重刹前叉过度下沉点头
            </div>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              <strong>症状</strong>：入弯前重刹前叉过度下沉压缩，导致头管角度过陡而险些翻车。<br />
              <strong>对策</strong>：顺时针拧入 2~3 格<strong>低速压缩阻尼</strong>，增强中段平台支撑性。
            </p>
          </div>

          {isEmtb && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1.5 sm:col-span-3">
              <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                <Zap className="w-4 h-4" />
                E-MTB 重车身入弯制动与电机扭矩防泄力指南
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                <strong>重车身制动点头</strong>：E-MTB 整车重比传统山地车多 10~15kg，入弯重刹时动能显著增加。前叉务必收紧低速压缩（LSC）1~2 格，防止车头过度压缩导致头管角度变陡。<br />
                <strong>出弯大扭矩蹲坑</strong>：电机瞬间大扭矩介入时易压迫后避震。建议后避震保持推荐气压（含 E-MTB 代偿），切勿盲目降低后胆气压追求软度。
              </p>
            </div>
          )}
        </div>
      </IOSCard>

      {/* Social Share Poster Modal */}
      <ShareCardModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        posterUrl={sharePosterUrl}
        fileName={`避震调校设定卡_${discipline.toUpperCase()}_${forkBrand}.png`}
        title="山地车避震设定海报"
      />
    </div>
  );
};
