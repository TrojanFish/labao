import React, { useState, useMemo, useEffect } from 'react';
import {
  Droplets,
  Gauge,
  Calendar,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Wrench,
  Thermometer,
  Clock,
  Layers,
  Download,
  ArrowUpRight
} from 'lucide-react';
import { IOSCard, IOSMetricTile, IOSCardHeader } from '../common/IOSCard';
import { IOSToolHeader } from '../common/IOSToolHeader';
import { IOSSegmentedControl } from '../common/IOSSegmentedControl';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';
import { useToast } from '../../context/ToastContext';
import { useRiderProfile } from '../../context/RiderProfileContext';
import { setPendingTransfer } from '../../hooks/useToolDraftState';

export interface TubelessSealantCalculatorProps {
  onNavigateTool?: (toolId: string) => void;
}

export const TubelessSealantCalculator: React.FC<TubelessSealantCalculatorProps> = ({ onNavigateTool }) => {
  const { language, unitSystem } = useLanguageAndUnit();
  const { showToast } = useToast();
  const { activeBike } = useRiderProfile();
  const isImperial = unitSystem === 'imperial';

  // Wheel & Tire System
  const [wheelStandard, setWheelStandard] = useState<'700c' | '650b' | '29er' | '26er'>(
    activeBike?.wheelTire?.wheelStandard || '700c'
  );
  const [tireCategory, setTireCategory] = useState<'road' | 'gravel' | 'mtb'>(
    activeBike?.type === 'gravel' ? 'gravel' : activeBike?.type?.startsWith('mtb') ? 'mtb' : 'road'
  );
  const [tireWidthMm, setTireWidthMm] = useState<number>(activeBike?.wheelTire?.nominalWidthMm || 28);
  const [innerRimWidthMm, setInnerRimWidthMm] = useState<number>(activeBike?.wheelTire?.rimInternalWidthMm || 21);

  // Sync with active bike
  useEffect(() => {
    if (activeBike?.wheelTire) {
      if (activeBike.wheelTire.wheelStandard) setWheelStandard(activeBike.wheelTire.wheelStandard);
      if (activeBike.wheelTire.nominalWidthMm) setTireWidthMm(activeBike.wheelTire.nominalWidthMm);
      if (activeBike.wheelTire.rimInternalWidthMm) setInnerRimWidthMm(activeBike.wheelTire.rimInternalWidthMm);
    }
    if (activeBike?.type === 'gravel') setTireCategory('gravel');
    else if (activeBike?.type?.startsWith('mtb')) setTireCategory('mtb');
    else setTireCategory('road');
  }, [activeBike]);

  // Casing & Usage Environment
  const [casingType, setCasingType] = useState<'race' | 'standard' | 'heavy'>('standard');
  const [climate, setClimate] = useState<'hot_dry' | 'moderate' | 'cool_humid'>('moderate');
  const [rideFrequency, setRideFrequency] = useState<'frequent' | 'occasional' | 'stored'>('frequent');
  const [sealantType, setSealantType] = useState<'latex' | 'endurance' | 'synthetic'>('latex');

  const [activePreset, setActivePreset] = useState<'road28' | 'road32' | 'gravel40' | 'gravel45' | 'mtb225' | 'mtb24' | null>('road28');

  // Quick Preset Handlers
  const handlePreset = (preset: 'road28' | 'road32' | 'gravel40' | 'gravel45' | 'mtb225' | 'mtb24') => {
    setActivePreset(preset);
    if (preset === 'road28') {
      setWheelStandard('700c');
      setTireCategory('road');
      setTireWidthMm(28);
      setInnerRimWidthMm(21);
      setCasingType('standard');
      showToast('已载入主流公路 700x28c 预设', 'info');
    } else if (preset === 'road32') {
      setWheelStandard('700c');
      setTireCategory('road');
      setTireWidthMm(32);
      setInnerRimWidthMm(23);
      setCasingType('standard');
      showToast('已载入宽胎公路 700x32c 预设', 'info');
    } else if (preset === 'gravel40') {
      setWheelStandard('700c');
      setTireCategory('gravel');
      setTireWidthMm(40);
      setInnerRimWidthMm(25);
      setCasingType('standard');
      showToast('已载入全地形 Gravel 700x40c 预设', 'info');
    } else if (preset === 'gravel45') {
      setWheelStandard('700c');
      setTireCategory('gravel');
      setTireWidthMm(45);
      setInnerRimWidthMm(25);
      setCasingType('heavy');
      showToast('已载入重载探险 700x45c 预设', 'info');
    } else if (preset === 'mtb225') {
      setWheelStandard('29er');
      setTireCategory('mtb');
      setTireWidthMm(57); // 2.25"
      setInnerRimWidthMm(28);
      setCasingType('standard');
      showToast('已载入山地 XC 29x2.25" 预设', 'info');
    } else if (preset === 'mtb24') {
      setWheelStandard('29er');
      setTireCategory('mtb');
      setTireWidthMm(61); // 2.4"
      setInnerRimWidthMm(30);
      setCasingType('heavy');
      showToast('已载入山地 Enduro 29x2.4" 预设', 'info');
    }
  };

  // Scientific Torus Model & Sealant Dosage Calculation
  const calculation = useMemo(() => {
    // Wheel Major Radius R in mm
    let majorR = 311; // 700c / 29er
    if (wheelStandard === '650b') majorR = 292;
    if (wheelStandard === '26er') majorR = 279;

    // Actual inflated width adjusted for inner rim width
    // Every 1mm wider inner rim adds approx 0.4mm to inflated tire width
    const effectiveTireWidth = tireWidthMm + 0.4 * (innerRimWidthMm - 19);

    // Minor Radius r in mm
    // Casing thickness approx 1.2mm for road, 1.8mm for MTB
    const casingThickness = tireCategory === 'mtb' ? 1.8 : 1.2;
    const minorR = Math.max(8, (effectiveTireWidth - 2 * casingThickness) / 2);

    // Tire internal volume in Liters: V = 2 * pi^2 * R * r^2
    const volumeMm3 = 2 * Math.PI * Math.PI * majorR * (minorR * minorR);
    const volumeLiters = volumeMm3 / 1000000;

    // Baseline sealant required for coating internal surface area + fluid reservoir
    // Surface Area A = 4 * pi^2 * R * r
    const areaMm2 = 4 * Math.PI * Math.PI * majorR * minorR;
    const areaCm2 = areaMm2 / 100;

    // Film coating volume: approx 0.08mm layer across internal surface
    const filmVolumeMl = (areaCm2 * 0.008);

    // Dynamic fluid pool reservoir (for instant puncture plugging while rolling)
    let poolVolumeMl = 18;
    if (tireCategory === 'gravel') poolVolumeMl = 28;
    if (tireCategory === 'mtb') poolVolumeMl = 42;

    // Casing Porosity Factor: absorbs sealant during first 48 hours
    let casingAddMl = 0;
    if (casingType === 'race') casingAddMl = 15; // Thin cotton/skinwall breathes & absorbs
    if (casingType === 'heavy') casingAddMl = 6;  // Robust butyl layer doesn't leak pores

    // Base initial volume in ml
    let initialDoseMl = Math.round(filmVolumeMl + poolVolumeMl + casingAddMl);

    // Round to sensible workshop increments (multiples of 5ml)
    initialDoseMl = Math.ceil(initialDoseMl / 5) * 5;

    // Ensure safe minimums
    if (tireCategory === 'road' && initialDoseMl < 35) initialDoseMl = 35;
    if (tireCategory === 'gravel' && initialDoseMl < 55) initialDoseMl = 55;
    if (tireCategory === 'mtb' && initialDoseMl < 85) initialDoseMl = 85;

    // Maintenance Top-Up Dose (roughly 45-55% of initial dose)
    const topUpDoseMl = Math.round(initialDoseMl * 0.5);

    // Evaporation & Inspection Schedule
    let baseDays = 120; // ~4 months baseline

    // Climate adjustment
    if (climate === 'hot_dry') baseDays *= 0.65; // ~75 days
    if (climate === 'cool_humid') baseDays *= 1.35; // ~160 days

    // Casing breathability adjustment
    if (casingType === 'race') baseDays *= 0.8;
    if (casingType === 'heavy') baseDays *= 1.15;

    // Usage & storage adjustment
    if (rideFrequency === 'stored') baseDays *= 0.75; // settles at bottom into solid rubber booger

    // Sealant formula longevity
    if (sealantType === 'endurance') baseDays *= 1.4;
    if (sealantType === 'synthetic') baseDays *= 1.25;

    const inspectionDays = Math.round(baseDays);
    const inspectionMonths = parseFloat((inspectionDays / 30).toFixed(1));

    // Puncture sealing capacity
    let maxPunctureMm = 3;
    if (sealantType === 'endurance') maxPunctureMm = 4.5;
    if (tireCategory === 'mtb') maxPunctureMm = 6.0;

    return {
      volumeLiters: parseFloat(volumeLiters.toFixed(2)),
      effectiveTireWidth: parseFloat(effectiveTireWidth.toFixed(1)),
      initialDoseMl,
      initialDoseFlOz: parseFloat((initialDoseMl * 0.033814).toFixed(1)),
      pairTotalMl: initialDoseMl * 2,
      pairTotalFlOz: parseFloat((initialDoseMl * 2 * 0.033814).toFixed(1)),
      topUpDoseMl,
      topUpDoseFlOz: parseFloat((topUpDoseMl * 0.033814).toFixed(1)),
      inspectionDays,
      inspectionMonths,
      maxPunctureMm
    };
  }, [wheelStandard, tireCategory, tireWidthMm, innerRimWidthMm, casingType, climate, rideFrequency, sealantType]);

  // Recommended maintenance target date
  const nextMaintenanceDateStr = useMemo(() => {
    const d = new Date(Date.now() + calculation.inspectionDays * 86400000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, [calculation.inspectionDays]);

  const handleExportIcsReminder = () => {
    const dStr = nextMaintenanceDateStr.replace(/-/g, '');
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Yolo Cycling//Tubeless Sealant//CN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:tubeless-sealant-${Date.now()}@labao.app
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART;VALUE=DATE:${dStr}
DTEND;VALUE=DATE:${dStr}
SUMMARY:🛠️ 真空胎补液例行维护: 单轮补充 ${calculation.topUpDoseMl}ml
DESCRIPTION:外胎规格: ${wheelStandard} ${tireWidthMm}mm\\n推荐定期补液量: 单轮 ${calculation.topUpDoseMl}ml (整车双轮约 ${calculation.pairTotalMl}ml)\\n建议操作: 拔出气嘴芯用注胶量筒补注自补液，并摇晃车轮确认流动性！
STATUS:CONFIRMED
BEGIN:VALARM
TRIGGER:-P1D
ACTION:DISPLAY
DESCRIPTION:明天需进行真空胎自补液补液维护
END:VALARM
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LaBao_真空胎自补液维护提醒_${nextMaintenanceDateStr}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(language === 'zh-TW' ? '已成功匯出維護提醒日曆 (.ics)，可加入手機行事曆！' : '已成功导出维护提醒日历 (.ics)，可加入手机日历！', 'success');
  };

  const handleScheduleIntoCalendar = () => {
    const ok = setPendingTransfer('solorider_pending_calendar_workout', {
      targetDate: nextMaintenanceDateStr,
      workout: {
        id: `maint-${Date.now()}`,
        date: nextMaintenanceDateStr,
        title: `🛠️ 真空胎补液维护 (${calculation.topUpDoseMl}ml)`,
        type: 'recovery',
        durationMin: 15,
        targetTss: 0,
        focusAdaptation: '器材保养与自补液注胶'
      }
    });
    if (ok) {
      showToast(
        language === 'zh-TW'
          ? `已將「${nextMaintenanceDateStr} 自補液維護」排入賽歷！`
          : `已将「${nextMaintenanceDateStr} 自补液维护」排入赛历！`,
        'success'
      );
      if (onNavigateTool) {
        onNavigateTool('training-calendar');
      }
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Unified Tool Header */}
      <IOSToolHeader
        category={language === 'zh-TW' ? '動力學與傳動' : '动力学与传动'}
        categoryIcon={Droplets}
        title={language === 'zh-TW' ? '自補液用量' : '自补液用量'}
        description={
          language === 'zh-TW'
            ? '基於外胎環面幾何內部容積、胎體孔隙率吸附、車圈內寬及氣候溫濕度揮發函數，精準計算單輪/整車首次注膠量、乾涸失效檢查週期及補液劑量。'
            : '基于外胎环面几何内部容积、胎体孔隙率吸附、车圈内宽及气候温湿度挥发函数，精准计算单轮/整车首次注胶量、干涸失效检查周期及补液剂量。'
        }
        tint="blue"
        actions={
          <IOSSegmentedControl
            options={[
              {
                value: 'road28',
                label: (
                  <>
                    <span className="sm:hidden">28c</span>
                    <span className="hidden sm:inline">{language === 'zh-TW' ? '公路 28c' : '公路 28c'}</span>
                  </>
                )
              },
              {
                value: 'road32',
                label: (
                  <>
                    <span className="sm:hidden">32c</span>
                    <span className="hidden sm:inline">{language === 'zh-TW' ? '全路況 32c' : '全路况 32c'}</span>
                  </>
                )
              },
              {
                value: 'gravel40',
                label: (
                  <>
                    <span className="sm:hidden">40c</span>
                    <span className="hidden sm:inline">Gravel 40c</span>
                  </>
                )
              },
              {
                value: 'mtb225',
                label: (
                  <>
                    <span className="sm:hidden">2.25"</span>
                    <span className="hidden sm:inline">{language === 'zh-TW' ? '山地 2.25"' : '山地 2.25"'}</span>
                  </>
                )
              },
            ]}
            value={activePreset || ''}
            onChange={(val) => handlePreset(val as any)}
            size="md"
          />
        }
      />

      {/* Hero Metric Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <IOSMetricTile
          label={language === 'zh-TW' ? '單輪初次加注' : '单轮初次加注'}
          value={calculation.initialDoseMl}
          unit="ml"
          subValue={`${calculation.initialDoseFlOz} fl oz`}
          accent="blue"
        />
        <IOSMetricTile
          label={language === 'zh-TW' ? '整車前後雙輪' : '整车前后双轮'}
          value={calculation.pairTotalMl}
          unit="ml"
          subValue={`${calculation.pairTotalFlOz} fl oz`}
          accent="mint"
        />
        <IOSMetricTile
          label={language === 'zh-TW' ? '單輪補液補充' : '单轮补液补充'}
          value={calculation.topUpDoseMl}
          unit="ml"
          subValue={`${calculation.topUpDoseFlOz} fl oz`}
          accent="purple"
        />
        <IOSMetricTile
          label={language === 'zh-TW' ? '檢查補液週期' : '检查补液周期'}
          value={calculation.inspectionDays}
          unit={language === 'zh-TW' ? '天' : '天'}
          subValue={`~${calculation.inspectionMonths} 个月`}
          accent="orange"
        />
      </div>

      {/* Main Interactive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Left Input Configuration (7 cols) */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-5">
          {/* Section 1: Wheel & Tire Geometry */}
          <IOSCard variant="default" className="space-y-4">
            <IOSCardHeader
              title={language === 'zh-TW' ? '輪組規格與幾何參數' : '轮组规格与几何参数'}
              subtitle={language === 'zh-TW' ? '輪徑、胎寬與框寬設定' : '轮径、胎宽与框宽设定'}
              icon={Gauge}
              iconColor="text-ios-blue bg-ios-blue/10 dark:bg-ios-blue/20"
            />

            {/* Wheel Standard & Category */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
                  {language === 'zh-TW' ? '輪徑規格' : '轮径规格'}
                </label>
                <IOSSegmentedControl
                  options={[
                    { value: '700c', label: '700c' },
                    { value: '650b', label: '650b' },
                    { value: '29er', label: '29er' },
                    { value: '26er', label: '26er' }
                  ]}
                  value={wheelStandard}
                  onChange={(v) => setWheelStandard(v as any)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
                  {language === 'zh-TW' ? '車型分類' : '车型分类'}
                </label>
                <IOSSegmentedControl
                  options={[
                    { value: 'road', label: language === 'zh-TW' ? '公路車' : '公路车' },
                    { value: 'gravel', label: language === 'zh-TW' ? '全地形' : '全地形' },
                    { value: 'mtb', label: language === 'zh-TW' ? '山地車' : '山地车' }
                  ]}
                  value={tireCategory}
                  onChange={(cat) => {
                    setTireCategory(cat as any);
                    if (cat === 'road' && tireWidthMm > 35) setTireWidthMm(28);
                    if (cat === 'gravel' && (tireWidthMm < 35 || tireWidthMm > 52)) setTireWidthMm(40);
                    if (cat === 'mtb' && tireWidthMm < 50) setTireWidthMm(57);
                  }}
                />
              </div>
            </div>

            {/* Tire Width & Inner Rim Width Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Tire Width */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">{'标称外胎胎宽'}</span>
                  <span className="font-mono font-bold text-ios-blue">
                    {tireWidthMm} mm {tireCategory === 'mtb' ? `(~${(tireWidthMm / 25.4).toFixed(2)}")` : `${tireWidthMm}c`}
                  </span>
                </div>
                <input
                  type="range"
                  min={23}
                  max={66}
                  step={1}
                  value={tireWidthMm}
                  onChange={(e) => {
                    setTireWidthMm(Number(e.target.value));
                    setActivePreset(null);
                  }}
                  className="w-full accent-ios-blue cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>23c · 公路细胎</span>
                  <span>40c · 全地形</span>
                  <span>2.6" · 山地越野</span>
                </div>
              </div>

              {/* Inner Rim Width */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">{'车圈内部宽度'}</span>
                  <span className="font-mono font-bold text-ios-blue">{innerRimWidthMm} mm</span>
                </div>
                <input
                  type="range"
                  min={17}
                  max={35}
                  step={1}
                  value={innerRimWidthMm}
                  onChange={(e) => {
                    setInnerRimWidthMm(Number(e.target.value));
                    setActivePreset(null);
                  }}
                  className="w-full accent-ios-blue cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>19mm · 公路标准</span>
                  <span>25mm · 全地形</span>
                  <span>30mm+ · 超宽圈</span>
                </div>
              </div>
            </div>
          </IOSCard>

          {/* Section 2: Casing Type & Climate */}
          <IOSCard variant="default" className="space-y-4">
            <IOSCardHeader
              title={language === 'zh-TW' ? '胎體孔隙率與環境揮發工況' : '胎体孔隙率与环境挥发工况'}
              subtitle={language === 'zh-TW' ? '外胎構造、當地氣候與騎乘頻率' : '外胎构造、当地气候与骑行频率'}
              icon={Thermometer}
              iconColor="text-ios-red bg-ios-red/10 dark:bg-ios-red/20"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Casing Construction */}
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
                  {language === 'zh-TW' ? '外胎胎體構造' : '外胎胎体构造'}
                </label>
                <div className="space-y-1.5">
                  {[
                    { id: 'race', label: language === 'zh-TW' ? '超輕棉線 / 黃邊競速胎' : '超轻棉线 / 黄边竞速胎' },
                    { id: 'standard', label: language === 'zh-TW' ? '標準無內胎 TLR' : '标准真空胎 TLR' },
                    { id: 'heavy', label: language === 'zh-TW' ? '重型防穿刺 / 丁基加強層' : '重型防穿刺 / 丁基加强层' }
                  ].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setCasingType(c.id as any)}
                      className={`w-full py-2 px-3 text-xs text-left rounded-2xl border transition flex items-center justify-between apple-touch ${
                        casingType === c.id
                          ? 'bg-ios-blue text-white border-ios-blue font-bold shadow-sm shadow-ios-blue/20 ring-2 ring-ios-blue/30 scale-[1.01]'
                          : 'bg-white/70 dark:bg-white/5 border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20'
                      }`}
                    >
                      <span className={casingType === c.id ? 'font-bold text-white' : ''}>{c.label}</span>
                      {casingType === c.id && <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Climate & Temperature */}
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
                  {language === 'zh-TW' ? '當地騎行氣候環境' : '当地骑行气候环境'}
                </label>
                <div className="space-y-1.5">
                  {[
                    { id: 'hot_dry', label: language === 'zh-TW' ? '炎熱乾燥 (>28°C)' : '炎热干燥 (>28°C)' },
                    { id: 'moderate', label: language === 'zh-TW' ? '溫和適宜 (15-25°C)' : '温和适宜 (15-25°C)' },
                    { id: 'cool_humid', label: language === 'zh-TW' ? '濕潤陰冷 (<15°C)' : '湿润阴冷 (<15°C)' }
                  ].map((cl) => (
                    <button
                      key={cl.id}
                      onClick={() => setClimate(cl.id as any)}
                      className={`w-full py-2 px-3 text-xs text-left rounded-2xl border transition flex items-center justify-between apple-touch ${
                        climate === cl.id
                          ? 'bg-ios-red text-white border-ios-red font-bold shadow-sm shadow-ios-red/20 ring-2 ring-ios-red/30 scale-[1.01]'
                          : 'bg-white/70 dark:bg-white/5 border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20'
                      }`}
                    >
                      <span className={climate === cl.id ? 'font-bold text-white' : ''}>{cl.label}</span>
                      {climate === cl.id && <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sealant Formula & Riding Frequency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200/80 dark:border-white/10">
              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
                  {language === 'zh-TW' ? '自補液配方類型' : '自补液配方类型'}
                </label>
                <select
                  value={sealantType}
                  onChange={(e) => setSealantType(e.target.value as any)}
                  className="w-full h-9 bg-white/80 dark:bg-black/40 border border-slate-200/80 dark:border-white/15 rounded-xl px-3 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-ios-blue"
                >
                  <option value="latex">{language === 'zh-TW' ? '天然水基乳膠配方' : '天然水基乳胶配方'}</option>
                  <option value="endurance">{language === 'zh-TW' ? '微粒纖維強化長效版' : '微粒纤维强化长效版'}</option>
                  <option value="synthetic">{language === 'zh-TW' ? '無氨合成環保液' : '无氨合成环保液'}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1.5">
                  {language === 'zh-TW' ? '騎行與停放習慣' : '骑行与停放习惯'}
                </label>
                <select
                  value={rideFrequency}
                  onChange={(e) => setRideFrequency(e.target.value as any)}
                  className="w-full h-9 bg-white/80 dark:bg-black/40 border border-slate-200/80 dark:border-white/15 rounded-xl px-3 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-ios-blue"
                >
                  <option value="frequent">{language === 'zh-TW' ? '高頻騎行 · 每週 2-4 次' : '高频骑行 · 每周 2-4 次'}</option>
                  <option value="occasional">{language === 'zh-TW' ? '中頻騎行 · 雙週 1 次' : '中频骑行 · 双周 1 次'}</option>
                  <option value="stored">{language === 'zh-TW' ? '長期懸掛停放' : '长期悬挂停放'}</option>
                </select>
              </div>
            </div>
          </IOSCard>
        </div>

        {/* Right Output Scoreboard (macOS Sticky Canvas) */}
        <div className="lg:col-span-5 space-y-4 sm:space-y-5 lg:sticky lg:top-20 self-start">
          {/* Main Dosage Recommendation Card */}
          <IOSCard variant="default" className="space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ios-blue uppercase tracking-wider flex items-center gap-1.5">
                <Droplets className="w-4 h-4" />
                {language === 'zh-TW' ? '推薦首次加注量' : '推荐首次加注量'}
              </span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-ios-blue/10 text-ios-blue font-mono font-medium">
                {calculation.effectiveTireWidth}mm {language === 'zh-TW' ? '實測充氣胎寬' : '实测充气胎宽'}
              </span>
            </div>

            {/* Single Wheel Hero Number */}
            <div className="space-y-1">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {language === 'zh-TW' ? '單輪首次加注推薦量' : '单轮首次加注推荐量'}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight font-display tabular-nums">
                  {calculation.initialDoseMl}
                </span>
                <span className="text-lg font-bold text-ios-blue">ml</span>
                <span className="text-sm font-mono text-slate-400 ml-1 tabular-nums">
                  ({calculation.initialDoseFlOz} fl oz)
                </span>
              </div>
            </div>

            {/* Secondary Output Grid */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-black/[0.05] dark:border-white/[0.08]">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08] space-y-1">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-ios-blue" />
                  <span>{language === 'zh-TW' ? '整車前後雙輪總量' : '整车前后双轮总量'}</span>
                </div>
                <div className="text-lg font-bold text-ios-blue font-mono tabular-nums">
                  {calculation.pairTotalMl} ml
                </div>
                <div className="text-[11px] text-slate-400 tabular-nums">
                  {calculation.pairTotalFlOz} fl oz
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08] space-y-1">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5 text-ios-purple" />
                  <span>{language === 'zh-TW' ? '單輪定期補液量' : '单轮定期补液量'}</span>
                </div>
                <div className="text-lg font-bold text-ios-purple font-mono tabular-nums">
                  {calculation.topUpDoseMl} ml
                </div>
                <div className="text-[11px] text-slate-400 tabular-nums">
                  {calculation.topUpDoseFlOz} fl oz
                </div>
              </div>
            </div>

            {/* Inspection & Expiry Timeline */}
            <div className="p-3.5 rounded-2xl bg-ios-orange/10 border border-ios-orange/20 text-slate-900 dark:text-white space-y-2.5 text-xs">
              <div className="font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-ios-orange">
                  <Calendar className="w-4 h-4" />
                  <span>{language === 'zh-TW' ? '建議檢查與補液週期' : '建议检查与补液周期'}</span>
                </span>
                <span className="font-mono text-ios-orange text-sm font-bold">
                  {calculation.inspectionDays} {language === 'zh-TW' ? '天' : '天'} (~{calculation.inspectionMonths} {language === 'zh-TW' ? '個月' : '个月'})
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                {`受当地${climate === 'hot_dry' ? '高温炎热' : '常温'}气候与${casingType === 'race' ? '竞速薄胎壁' : '标准'}胎体影响，乳胶在此周期后将逐渐胶化脱水。建议下次维护日期：`}
                <strong className="text-slate-900 dark:text-white font-mono font-bold ml-1">{nextMaintenanceDateStr}</strong>
              </p>

              {/* Maintenance Schedule Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-ios-orange/20">
                <button
                  type="button"
                  onClick={handleExportIcsReminder}
                  className="apple-touch h-8 rounded-xl bg-white/80 dark:bg-white/10 hover:bg-white text-slate-800 dark:text-slate-200 border border-ios-orange/30 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition shadow-2xs"
                  title="导出标准 iCalendar 维护事件"
                >
                  <Download className="w-3 h-3 text-ios-orange" />
                  <span>{language === 'zh-TW' ? '匯出 .ICS 日曆' : '导出 .ICS 日历'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleScheduleIntoCalendar}
                  className="apple-touch h-8 rounded-xl bg-ios-orange/20 hover:bg-ios-orange/30 text-ios-orange border border-ios-orange/30 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition shadow-2xs"
                  title="将维护日期排入训练赛历"
                >
                  <Calendar className="w-3 h-3" />
                  <span>{language === 'zh-TW' ? '排入訓練賽歷' : '排入训练赛历'}</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Puncture Threshold Gauge */}
            <div className="flex items-center justify-between text-xs py-2 px-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08]">
              <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-ios-green" />
                <span>{language === 'zh-TW' ? '最大刺穿自封孔徑能力' : '最大刺穿自封孔径能力'}</span>
              </span>
              <strong className="text-ios-green font-mono text-sm">≤ {calculation.maxPunctureMm} mm</strong>
            </div>
          </IOSCard>

          {/* Interactive Cross-Section SVG Diagram */}
          <IOSCard variant="default" className="space-y-3">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span>{language === 'zh-TW' ? '無內胎截面與注膠池物理示意' : '真空轮胎截面与注胶池物理示意'}</span>
              <span className="text-[11px] text-slate-400">容积 ~{calculation.volumeLiters} L</span>
            </div>

            <div className="h-44 w-full flex items-center justify-center bg-black/5 dark:bg-white/5 rounded-2xl p-2 border border-slate-200/60 dark:border-white/10 relative">
              <svg viewBox="0 0 200 160" className="w-full h-full max-h-40">
                {/* Tire Casing Outer Curve */}
                <path
                  d="M 50 130 C 20 80, 40 20, 100 20 C 160 20, 180 80, 150 130"
                  fill="none"
                  stroke={casingType === 'race' ? '#ff9500' : '#3A3A3C'}
                  strokeWidth="8"
                  strokeLinecap="round"
                />

                {/* Tire Inner Chamber */}
                <path
                  d="M 54 126 C 28 82, 46 28, 100 28 C 154 28, 172 82, 146 126"
                  fill="rgba(0, 122, 255, 0.05)"
                  stroke="#8E8E93"
                  strokeWidth="1"
                />

                {/* Liquid Sealant Pool at bottom */}
                <path
                  d="M 68 126 Q 100 138 132 126 Q 100 118 68 126 Z"
                  fill="#007aff"
                  opacity="0.85"
                />

                {/* Liquid Droplets coating sidewalls */}
                <circle cx="56" cy="70" r="2.5" fill="#007aff" opacity="0.7" />
                <circle cx="144" cy="65" r="2" fill="#007aff" opacity="0.7" />
                <circle cx="100" cy="35" r="1.8" fill="#007aff" opacity="0.6" />

                {/* Rim Hook & Bed */}
                <path
                  d="M 40 130 L 52 130 L 60 145 L 140 145 L 148 130 L 160 130"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="4"
                  strokeLinejoin="round"
                />

                {/* Rim Tape (Blue) */}
                <path
                  d="M 54 133 L 62 143 L 138 143 L 146 133"
                  fill="none"
                  stroke="#007aff"
                  strokeWidth="2.5"
                />

                {/* Presta Valve Stem */}
                <line x1="100" y1="145" x2="100" y2="158" stroke="#cbd5e1" strokeWidth="4" />
                <circle cx="100" cy="143" r="2" fill="#1C1C1E" />

                {/* Annotations */}
                <text x="100" y="105" textAnchor="middle" fill="#007aff" fontSize="9" fontWeight="bold">
                  {calculation.initialDoseMl}ml 液池
                </text>
                <text x="100" y="15" textAnchor="middle" fill="#94a3b8" fontSize="8">
                  {tireWidthMm}mm 胎冠
                </text>
              </svg>
            </div>
          </IOSCard>
        </div>
      </div>

      {/* Workshop Pro Tips & Tubeless FAQ */}
      <IOSCard variant="default" className="space-y-4">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-ios-blue" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {language === 'zh-TW' ? '專業技師真空胎裝調與免拆胎自查秘笈' : '专业技师真空胎装调与免拆胎自查秘笈'}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08] space-y-2">
            <div className="font-bold text-ios-blue flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>1. 摇轮听声法</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              无需拆卸外胎！将车轮拆下在耳边快速晃动。若能听到清脆的“哗啦哗啦”水撞击声，表明胶水充足活跃；若声音沉闷微弱或完全无声，说明乳胶已干涸结块，需立即补液。
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08] space-y-2">
            <div className="font-bold text-ios-blue flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>2. 气门嘴注胶与气芯防堵</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              拆下气门芯后用注射器注胶。注完后先空打数下气吹净管道残留乳胶，在气门芯螺牙涂抹微量硅油防粘连，防止乳胶干固锁死气门。车座包内建议备用 2 个铜制气门芯。
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08] space-y-2">
            <div className="font-bold text-ios-orange flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>3. 开封保质期与仓储</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              原装密封自补液保质期通常为 24~36 个月；开封接触空气后溶剂缓慢挥发，建议在 6~12 个月内用完。每次注胶前务必剧烈摇匀瓶身 30 秒，确保天然微粒晶核完全悬浮分散。
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08] space-y-2">
            <div className="font-bold text-ios-purple flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>4. 扎钉与培根胶条配合</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              自补液对 2-3mm 以下微孔可在旋转中数秒自封；对于 3-5mm 较大划口，应迅速将破口朝下让液态胶水浸润，并立即插拔培根胶条，机械填补瞬间止漏。
            </p>
          </div>
        </div>
      </IOSCard>
    </div>
  );
};
