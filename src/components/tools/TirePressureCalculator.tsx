import React, { useState, useMemo, useEffect } from 'react';
import { Gauge, Info, AlertTriangle, Layers, Share2, Check, User, Package, Bike, Thermometer } from 'lucide-react';
import { SURFACE_FACTORS, TIRE_SETUP_FACTORS, getBaseTirePsi, calculateTemperatureCompensatedPressure } from '../../data/tirePressureConfig';
import { Tooltip } from '../common/Tooltip';
import { TireGauge } from '../common/TireGauge';
import { IOSCard, IOSCardHeader, IOSMetricTile } from '../common/IOSCard';
import { IOSGarageSyncFooter } from '../common/IOSGarageSyncFooter';
import { IOSToolHeader } from '../common/IOSToolHeader';
import { IOSSegmentedControl } from '../common/IOSSegmentedControl';
import { NumberStepper } from '../common/NumberStepper';
import { ShareCardModal } from '../common/ShareCardModal';
import { generateTirePressurePoster } from '../../utils/shareCardGenerators';
import { useToast } from '../../context/ToastContext';
import { useRiderProfile } from '../../context/RiderProfileContext';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';

export const TirePressureCalculator: React.FC = () => {
  const { showToast } = useToast();
  const { profile, activeBike, updateActiveBikeWheelTire } = useRiderProfile();
  const { unitSystem, language } = useLanguageAndUnit();
  const isImperial = unitSystem === 'imperial';

  // Share Poster State
  const [sharePosterUrl, setSharePosterUrl] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  const [bikeType, setBikeType] = useState<'road' | 'gravel' | 'mtb'>('road');
  const [riderWeight, setRiderWeight] = useState<number>(profile.weightKg || 68);
  const [bikeGearWeight, setBikeGearWeight] = useState<number>(activeBike?.weightKg || profile.bikeWeightKg || 8.5);
  const [tireSetup, setTireSetup] = useState<'tubeless' | 'tube' | 'tubular'>(activeBike?.wheelTire?.tireSetup || 'tubeless');
  const [nominalWidth, setNominalWidth] = useState<number>(activeBike?.wheelTire?.nominalWidthMm || 28);
  const [actualWidth, setActualWidth] = useState<number>(activeBike?.wheelTire?.actualWidthMm || 29.5);
  const [isStaggeredWidth, setIsStaggeredWidth] = useState<boolean>(false);
  const [nominalWidthFront, setNominalWidthFront] = useState<number>(activeBike?.wheelTire?.nominalWidthMm || 28);
  const [nominalWidthRear, setNominalWidthRear] = useState<number>(activeBike?.wheelTire?.nominalWidthMm ? Math.min(54, activeBike.wheelTire.nominalWidthMm + 2) : 30);
  const [actualWidthFront, setActualWidthFront] = useState<number>(activeBike?.wheelTire?.actualWidthMm || 29.5);
  const [actualWidthRear, setActualWidthRear] = useState<number>(activeBike?.wheelTire?.actualWidthMm ? activeBike.wheelTire.actualWidthMm + 2 : 31.5);
  const [rideTempC, setRideTempC] = useState<number>(20);
  const [rimInnerWidth, setRimInnerWidth] = useState<number>(activeBike?.wheelTire?.rimInternalWidthMm || 21);
  const [isHookless, setIsHookless] = useState<boolean>(Boolean(activeBike?.wheelTire?.isHookless));
  const [hasTireInsert, setHasTireInsert] = useState<boolean>(false);
  const [weightDistFront, setWeightDistFront] = useState<number>(44);
  const [isBikepacking, setIsBikepacking] = useState<boolean>(false);
  const [luggageKg, setLuggageKg] = useState<number>(12);
  const [luggageBias, setLuggageBias] = useState<'front' | 'frame' | 'rear'>('rear');
  const [surfaceKey, setSurfaceKey] = useState<string>('smooth_asphalt');
  const [pressureUnit, setPressureUnit] = useState<'psi' | 'bar' | 'kpa'>(isImperial ? 'psi' : 'bar');

  // Reactively sync with global rider profile
  useEffect(() => {
    if (profile.weightKg) setRiderWeight(profile.weightKg);
  }, [profile.weightKg]);

  // Reactively sync with active bike from Virtual Garage
  useEffect(() => {
    if (activeBike) {
      if (activeBike.weightKg) setBikeGearWeight(activeBike.weightKg);
      if (activeBike.wheelTire) {
        if (activeBike.wheelTire.nominalWidthMm) setNominalWidth(activeBike.wheelTire.nominalWidthMm);
        if (activeBike.wheelTire.actualWidthMm) setActualWidth(activeBike.wheelTire.actualWidthMm);
        if (activeBike.wheelTire.rimInternalWidthMm) setRimInnerWidth(activeBike.wheelTire.rimInternalWidthMm);
        if (activeBike.wheelTire.tireSetup) setTireSetup(activeBike.wheelTire.tireSetup);
        setIsHookless(Boolean(activeBike.wheelTire.isHookless));
      }
      if (activeBike.type === 'gravel') setBikeType('gravel');
      else if (activeBike.type.startsWith('mtb')) setBikeType('mtb');
      else setBikeType('road');
    }
  }, [activeBike]);

  // Reactively sync default unit with global unit system
  useEffect(() => {
    setPressureUnit(unitSystem === 'imperial' ? 'psi' : 'bar');
  }, [unitSystem]);

  const effectiveLuggage = isBikepacking ? Math.max(0, luggageKg) : 0;
  const totalSystemWeight = riderWeight + bikeGearWeight + effectiveLuggage;
  const weightDistRear = 100 - weightDistFront;

  // Dynamic front/rear distribution adjustment when bikepacking luggage is loaded
  const { effectiveFrontPct, effectiveRearPct } = useMemo(() => {
    if (!isBikepacking || effectiveLuggage <= 0) {
      return { effectiveFrontPct: weightDistFront, effectiveRearPct: 100 - weightDistFront };
    }
    const baseFrontKg = (riderWeight + bikeGearWeight) * (weightDistFront / 100);
    const baseRearKg = (riderWeight + bikeGearWeight) * ((100 - weightDistFront) / 100);

    // Front biased (handlebar + fork bags): 60% front, 40% rear
    // Frame bag balanced: 45% front, 55% rear
    // Rear biased (saddle pack / rear rack panniers): 15% front, 85% rear
    const lugFrontRatio = luggageBias === 'front' ? 0.60 : luggageBias === 'frame' ? 0.45 : 0.15;
    const lugRearRatio = 1 - lugFrontRatio;

    const totalFrontKg = baseFrontKg + effectiveLuggage * lugFrontRatio;
    const totalRearKg = baseRearKg + effectiveLuggage * lugRearRatio;
    const frontPct = Math.round((totalFrontKg / totalSystemWeight) * 100);
    return { effectiveFrontPct: frontPct, effectiveRearPct: 100 - frontPct };
  }, [isBikepacking, effectiveLuggage, luggageBias, riderWeight, bikeGearWeight, weightDistFront, totalSystemWeight]);

  // Compute recommendations
  const result = useMemo(() => {
    const effNominalFront = isStaggeredWidth ? nominalWidthFront : nominalWidth;
    const effNominalRear = isStaggeredWidth ? nominalWidthRear : nominalWidth;
    const effActualFront = isStaggeredWidth ? actualWidthFront : actualWidth;
    const effActualRear = isStaggeredWidth ? actualWidthRear : actualWidth;

    const basePsiFront = getBaseTirePsi(effNominalFront, totalSystemWeight, bikeType);
    const basePsiRear = getBaseTirePsi(effNominalRear, totalSystemWeight, bikeType);
    const surfaceFactor = SURFACE_FACTORS[surfaceKey]?.factor || 1.0;
    const setupFactor = TIRE_SETUP_FACTORS[tireSetup]?.factor || 1.0;

    let adjustedFront = basePsiFront * surfaceFactor * setupFactor;
    let adjustedRear = basePsiRear * surfaceFactor * setupFactor;

    if (effActualFront && effNominalFront && effActualFront !== effNominalFront) {
      adjustedFront -= (effActualFront - effNominalFront) * 1.8;
    }
    if (effActualRear && effNominalRear && effActualRear !== effNominalRear) {
      adjustedRear -= (effActualRear - effNominalRear) * 1.8;
    }

    if (rimInnerWidth && rimInnerWidth >= 21) {
      if (effNominalFront <= 30) adjustedFront -= 1.5;
      if (effNominalRear <= 30) adjustedRear -= 1.5;
    }

    // Adaptive pressure reduction for tire insert (cushcore / vittoria)
    if (hasTireInsert) {
      adjustedFront -= 2.5;
      adjustedRear -= 2.5;
    }

    // Weight distribution factor relative to equal 50/50 balance (e.g. 44% front -> 0.94, 56% rear -> 1.06)
    const frontRatio = 0.5 + (effectiveFrontPct / 100);
    const rearRatio = 0.5 + (effectiveRearPct / 100);

    let frontRec = Math.round(adjustedFront * frontRatio);
    let rearRec = Math.round(adjustedRear * rearRatio);

    if (bikeType === 'road') {
      frontRec = Math.max(45, Math.min(110, frontRec));
      rearRec = Math.max(48, Math.min(115, rearRec));
    } else if (bikeType === 'gravel') {
      frontRec = Math.max(22, Math.min(60, frontRec));
      rearRec = Math.max(24, Math.min(65, rearRec));
    } else {
      frontRec = Math.max(16, Math.min(40, frontRec));
      rearRec = Math.max(18, Math.min(45, rearRec));
    }

    const frontMin = Math.round(frontRec * 0.94);
    const frontMax = Math.round(frontRec * 1.06);
    const rearMin = Math.round(rearRec * 0.94);
    const rearMax = Math.round(rearRec * 1.06);

    // Temperature compensation (Gay-Lussac Ideal Gas Law)
    const frontComp = calculateTemperatureCompensatedPressure(frontRec, rideTempC, 20);
    const rearComp = calculateTemperatureCompensatedPressure(rearRec, rideTempC, 20);

    const formatVal = (psiVal: number) => {
      if (pressureUnit === 'bar') return (psiVal * 0.0689476).toFixed(2);
      if (pressureUnit === 'kpa') return Math.round(psiVal * 6.89476).toString();
      return Math.round(psiVal).toString();
    };

    const isHooklessWidthMismatch = isHookless && rimInnerWidth >= 23 && (effNominalFront < 28 || effNominalRear < 28);
    const isHooklessPressureExceeded = isHookless && (rearRec > 72.5 || frontRec > 72.5);
    const isHooklessPressureWarning = isHookless && !isHooklessPressureExceeded && (rearRec >= 68 || frontRec >= 68);
    const hasHooklessWarning = isHooklessPressureExceeded || isHooklessPressureWarning || isHooklessWidthMismatch;

    return {
      front: {
        rec: formatVal(frontRec),
        min: formatVal(frontMin),
        max: formatVal(frontMax),
        rawPsi: frontRec,
        pumpRec: formatVal(frontComp.recommendedPumpPsi),
        widthDesc: `${effNominalFront}c`
      },
      rear: {
        rec: formatVal(rearRec),
        min: formatVal(rearMin),
        max: formatVal(rearMax),
        rawPsi: rearRec,
        pumpRec: formatVal(rearComp.recommendedPumpPsi),
        widthDesc: `${effNominalRear}c`
      },
      tempDeltaPsi: frontComp.deltaPsi,
      hasHooklessWarning,
      isHooklessWidthMismatch,
      isHooklessPressureExceeded,
      isHooklessPressureWarning,
      notes: [
        rideTempC !== 20
          ? `环境气温热力学补偿（骑行环境 ${rideTempC}°C vs 打气环境 20°C）：气压温差偏移量约 ${frontComp.deltaPsi > 0 ? '+' : ''}${frontComp.deltaPsi} PSI。${
              rideTempC < 20
                ? '冬季室外寒冷气体遇冷收缩，室内充气需稍微多打以防出门欠压。'
                : '夏季酷暑柏油地表暴晒，气体升温膨胀，室内充气需预留余量防超压。'
            }`
          : null,
        isStaggeredWidth
          ? `前后异宽设定生效：前轮 ${effNominalFront}c 侧重低风阻气动与操控，后轮 ${effNominalRear}c 侧重更强承重吸震与更低滚阻。`
          : null,
        isHooklessWidthMismatch ? 'ETRTO 规范安全红线：无钩轮圈内宽 ≥23mm 严禁搭配小于 28c 外胎，极易脱圈导致严重摔车事故！' : null,
        surfaceKey === 'wet_slick' ? '雨天/湿滑路面：建议胎压调低 5~8 PSI 提升橡胶抓地力与刹车循迹性。' : null,
        tireSetup === 'tubeless' ? '真空胎优势：自补液自动密封微小穿孔，可安心使用较低胎压享受极致滤震与更低滚阻。' : '普通内胎：请勿低于推荐下限，以防过坑或减速带发生蛇咬爆胎。',
        hasTireInsert ? '已启用真空胎防爆胎垫：胎垫提供侧向渐进支撑并防止轮圈磕底，推荐胎压已自适应调低 2.5 PSI，兼顾极致抓地循迹与轮圈防护。' : null,
        isBikepacking && effectiveLuggage > 0
          ? `长途重装 Bikepacking 模式 (+${effectiveLuggage}kg 行囊)：前后轮载荷动态平衡重构为 [前 ${effectiveFrontPct}% / 后 ${effectiveRearPct}%]。${
              luggageBias === 'rear'
                ? '后轮承重显著升高，后胎压已自适应调升以防坑洼过坎砸框'
                : luggageBias === 'front'
                ? '前轮载荷升高，转向手感沉稳，已提升前胎气压维持支撑刚性'
                : '中央车架包重心居中均衡，前后胎压同步增强'
            }。重车状态下制动距离显著延长，下长坡务必提前阶梯式制动控速，注意碟片热衰竭。`
          : null,
        effActualRear > effNominalRear ? `实测胎宽宽于标称，已自动优化下调胎压以获得更平坦接地印记。` : null,
        isHooklessPressureExceeded ? '无钩轮圈极限安全气压为 72.5 PSI / 5.0 Bar，计算气压已超标，请立即更换更宽外胎降低胎压！' : null,
        isHooklessPressureWarning ? '当前气压逼近无钩轮圈 72.5 PSI 上限临界点，建议充气时预留余量以防日晒升温爆胎。' : null
      ].filter(Boolean) as string[]
    };
  }, [
    bikeType,
    totalSystemWeight,
    tireSetup,
    nominalWidth,
    actualWidth,
    isStaggeredWidth,
    nominalWidthFront,
    nominalWidthRear,
    actualWidthFront,
    actualWidthRear,
    rideTempC,
    rimInnerWidth,
    isHookless,
    hasTireInsert,
    effectiveFrontPct,
    effectiveRearPct,
    isBikepacking,
    effectiveLuggage,
    luggageBias,
    surfaceKey,
    pressureUnit
  ]);

  const handleGeneratePoster = () => {
    const url = generateTirePressurePoster({
      bikeType: bikeType === 'road' ? '公路车' : bikeType === 'gravel' ? '全地形车' : '山地车',
      totalWeightKg: totalSystemWeight,
      tireSetup: tireSetup === 'tubeless' ? '真空胎 Tubeless' : tireSetup === 'tube' ? '开口胎 + 内胎 Tube' : '管胎 Tubular',
      tireWidth: actualWidth,
      surface: surfaceKey,
      frontRec: parseFloat(result.front.rec) || 0,
      rearRec: parseFloat(result.rear.rec) || 0,
      frontRange: `${result.front.min}-${result.front.max}`,
      rearRange: `${result.rear.min}-${result.rear.max}`,
      unit: pressureUnit,
      isHookless
    });
    setSharePosterUrl(url);
    setIsShareModalOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Unified Tool Header */}
      <IOSToolHeader
        category={language === 'zh-TW' ? '動力與傳動' : '动力与传动'}
        categoryIcon={Gauge}
        title={language === 'zh-TW' ? '智能胎壓' : '智能胎压'}
        description={
          language === 'zh-TW'
            ? '綜合車手體重、無內胎結構、實測胎寬與路面狀況，精準計算前後輪差異化最佳胎壓。'
            : '综合车手体重、真空胎结构、实测胎宽与路面状况，精准计算前后轮差异化最佳气压。'
        }
        tint="blue"
        onShare={handleGeneratePoster}
        shareTitle={language === 'zh-TW' ? '生成胎壓調校卡片' : '生成胎压调校卡片'}
        actions={
          <IOSSegmentedControl
            options={[
              { id: 'psi', label: 'PSI' },
              { id: 'bar', label: 'BAR' },
              { id: 'kpa', label: 'KPA' },
            ]}
            value={pressureUnit}
            onChange={(val) => setPressureUnit(val as any)}
            size="md"
          />
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Left Inputs */}
        <div className="lg:col-span-6 space-y-4 sm:space-y-5">
          <IOSCard variant="default" className="space-y-4">
            <IOSCardHeader
              title={language === 'zh-TW' ? '車輛與騎行參數' : '车辆与骑行参数'}
              subtitle={language === 'zh-TW' ? '車型、重量與輪胎結構' : '车型、重量与轮胎结构'}
              icon={Layers}
              iconColor="text-ios-blue bg-ios-blue/10 dark:bg-ios-blue/20"
            />

            {/* Bike Type Selector */}
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-2">{language === 'zh-TW' ? '車輛類型' : '车辆类型'}</label>
              <IOSSegmentedControl
                options={[
                  { id: 'road', label: language === 'zh-TW' ? '公路車' : '公路车' },
                  { id: 'gravel', label: 'Gravel' },
                  { id: 'mtb', label: language === 'zh-TW' ? '山地車' : '山地车' },
                ]}
                value={bikeType}
                onChange={(val) => {
                  const bId = val as 'road' | 'gravel' | 'mtb';
                  setBikeType(bId);
                  const defTire = bId === 'road' ? 28 : bId === 'gravel' ? 40 : 55;
                  setNominalWidth(defTire);
                  setActualWidth(defTire + 1);
                }}
                size="md"
              />
            </div>

            {/* Weight Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    {language === 'zh-TW' ? '車手體重' : '车手体重'}
                    {profile.weightKg ? (
                      <span className="text-[11px] text-ios-blue font-normal">
                        {language === 'zh-TW' ? '已同步檔案' : '已同步档案'}
                      </span>
                    ) : null}
                  </label>
                  <span className="text-ios-blue font-mono font-semibold text-xs">
                    {isImperial ? `${(riderWeight * 2.20462).toFixed(1)} lbs` : `${riderWeight} kg`}
                  </span>
                </div>
                <NumberStepper
                  value={isImperial ? parseFloat((riderWeight * 2.20462).toFixed(1)) : riderWeight}
                  onChange={(val) => setRiderWeight(isImperial ? parseFloat((val / 2.20462).toFixed(1)) : val)}
                  step={isImperial ? 1 : 0.5}
                  min={isImperial ? 66 : 30}
                  max={isImperial ? 330 : 150}
                  unit={isImperial ? 'lbs' : 'kg'}
                  decimals={1}
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {language === 'zh-TW' ? '車重 + 裝備水壺' : '车重 + 装备水壶'}
                  </label>
                  <span className="text-ios-blue font-mono font-semibold text-xs">
                    {isImperial ? `${(bikeGearWeight * 2.20462).toFixed(1)} lbs` : `${bikeGearWeight} kg`}
                  </span>
                </div>
                <NumberStepper
                  value={isImperial ? parseFloat((bikeGearWeight * 2.20462).toFixed(1)) : bikeGearWeight}
                  onChange={(val) => setBikeGearWeight(isImperial ? parseFloat((val / 2.20462).toFixed(1)) : val)}
                  step={isImperial ? 0.2 : 0.1}
                  min={isImperial ? 11 : 4}
                  max={isImperial ? 66 : 30}
                  unit={isImperial ? 'lbs' : 'kg'}
                  decimals={1}
                />
              </div>
            </div>

            {/* Weight Distribution Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center">
                  {language === 'zh-TW' ? '前後軸重分配' : '前后轴重分配'}
                  <Tooltip content="公路车上体前倾常见比例为前轮 42%~45%，后轮 55%~58%" />
                </label>
                <span className="text-ios-blue font-mono font-semibold text-xs">前 {weightDistFront}% / 后 {weightDistRear}%</span>
              </div>
              <input
                type="range"
                min="38"
                max="50"
                step="1"
                value={weightDistFront}
                onChange={(e) => setWeightDistFront(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-ios-blue"
              />
            </div>

            {/* Bikepacking / Long-Distance Luggage Tuning */}
            <div className="p-3.5 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      {language === 'zh-TW' ? '長途馱包載荷' : '长途驮包载荷'}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      附加行囊载荷、重心重构与防砸圈胎压补偿
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isBikepacking}
                  onChange={(e) => setIsBikepacking(e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                />
              </div>

              {isBikepacking && (
                <div className="pt-2 border-t border-amber-500/15 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      {language === 'zh-TW' ? '行囊負重' : '行囊负重'}
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 font-mono font-bold text-xs">
                      +{luggageKg} kg ({Math.round(luggageKg * 2.20462)} lbs)
                    </span>
                  </div>
                  <NumberStepper
                    value={luggageKg}
                    onChange={(val) => setLuggageKg(val)}
                    step={1}
                    min={1}
                    max={40}
                    unit="kg"
                    decimals={0}
                  />

                  <div>
                    <span className="text-xs text-slate-700 dark:text-slate-300 font-medium block mb-1.5">
                      {language === 'zh-TW' ? '主要裝載重心分佈' : '主要装载重心分布'}
                    </span>
                    <IOSSegmentedControl
                      options={[
                        {
                          id: 'front',
                          label: (
                            <>
                              <span className="sm:hidden">前叉包</span>
                              <span className="hidden sm:inline">车头/前叉包</span>
                            </>
                          )
                        },
                        {
                          id: 'frame',
                          label: (
                            <>
                              <span className="sm:hidden">车架包</span>
                              <span className="hidden sm:inline">车架包均衡</span>
                            </>
                          )
                        },
                        {
                          id: 'rear',
                          label: (
                            <>
                              <span className="sm:hidden">后鞍包</span>
                              <span className="hidden sm:inline">后鞍包/后驮包</span>
                            </>
                          )
                        }
                      ]}
                      value={luggageBias}
                      onChange={(val) => setLuggageBias(val as any)}
                      size="sm"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl bg-white/70 dark:bg-black/20 border border-amber-500/20 text-[11px] flex items-center justify-between text-slate-600 dark:text-slate-300">
                    <span>重构后动态前后载荷比：</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                      前轮 {effectiveFrontPct}% / 后轮 {effectiveRearPct}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Tire Setup */}
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-2">{language === 'zh-TW' ? '外胎系統' : '轮胎系统'}</label>
              <IOSSegmentedControl
                options={[
                  { id: 'tubeless', label: language === 'zh-TW' ? '真空胎' : '真空胎' },
                  { id: 'tube', label: language === 'zh-TW' ? '內胎' : '内胎' },
                  { id: 'tubular', label: language === 'zh-TW' ? '管胎' : '管胎' },
                ]}
                value={tireSetup}
                onChange={(val) => setTireSetup(val as any)}
                size="md"
              />
            </div>

            {/* Dimensions & Hookless toggle */}
            {/* Dimensions & Staggered Width */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {language === 'zh-TW' ? '外胎規格設定' : '外胎规格设定'}
                </label>
                <button
                  type="button"
                  onClick={() => setIsStaggeredWidth(!isStaggeredWidth)}
                  className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-colors border apple-touch flex items-center gap-1 ${
                    isStaggeredWidth
                      ? 'bg-ios-blue text-white border-ios-blue'
                      : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{isStaggeredWidth ? (language === 'zh-TW' ? '前後異寬模式已開啟' : '前后异宽模式已开启') : (language === 'zh-TW' ? '切換前後異寬' : '切换前后异宽')}</span>
                </button>
              </div>

              {!isStaggeredWidth ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">标称胎宽 (mm)</label>
                    <select
                      value={nominalWidth}
                      onChange={(e) => {
                        const w = Number(e.target.value);
                        setNominalWidth(w);
                        setActualWidth(w + 1.5);
                      }}
                      className="w-full h-9 bg-slate-50 dark:bg-black/40 border border-slate-200/80 dark:border-white/15 rounded-xl px-3 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-ios-blue"
                    >
                      {[23, 25, 28, 30, 32, 35, 38, 40, 42, 45, 50, 54].map((w) => (
                        <option key={w} value={w}>{w}c / {w}mm</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">实测胎宽 (mm)</label>
                    <NumberStepper
                      value={actualWidth}
                      onChange={setActualWidth}
                      step={0.5}
                      min={18}
                      max={70}
                      unit="mm"
                      decimals={1}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">车圈内宽 (mm)</label>
                    <NumberStepper
                      value={rimInnerWidth}
                      onChange={setRimInnerWidth}
                      step={0.5}
                      min={13}
                      max={45}
                      unit="mm"
                      decimals={1}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 p-3 rounded-2xl bg-ios-blue/5 dark:bg-ios-blue/10 border border-ios-blue/20">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                        <span>前轮规格 (注重气动破风)</span>
                        <span className="font-mono text-ios-blue">{nominalWidthFront}c</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={nominalWidthFront}
                          onChange={(e) => {
                            const w = Number(e.target.value);
                            setNominalWidthFront(w);
                            setActualWidthFront(w + 1.5);
                          }}
                          className="w-full h-9 bg-white dark:bg-black/40 border border-slate-200/80 dark:border-white/15 rounded-xl px-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-ios-blue"
                        >
                          {[23, 25, 28, 30, 32, 35, 38, 40, 42, 45, 50, 54].map((w) => (
                            <option key={w} value={w}>前 {w}c</option>
                          ))}
                        </select>
                        <NumberStepper
                          value={actualWidthFront}
                          onChange={setActualWidthFront}
                          step={0.5}
                          min={18}
                          max={70}
                          unit="mm"
                          decimals={1}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                        <span>后轮规格 (注重滤震与滚阻)</span>
                        <span className="font-mono text-ios-blue">{nominalWidthRear}c</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={nominalWidthRear}
                          onChange={(e) => {
                            const w = Number(e.target.value);
                            setNominalWidthRear(w);
                            setActualWidthRear(w + 1.5);
                          }}
                          className="w-full h-9 bg-white dark:bg-black/40 border border-slate-200/80 dark:border-white/15 rounded-xl px-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-ios-blue"
                        >
                          {[23, 25, 28, 30, 32, 35, 38, 40, 42, 45, 50, 54].map((w) => (
                            <option key={w} value={w}>后 {w}c</option>
                          ))}
                        </select>
                        <NumberStepper
                          value={actualWidthRear}
                          onChange={setActualWidthRear}
                          step={0.5}
                          min={18}
                          max={70}
                          unit="mm"
                          decimals={1}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">车圈内宽 (mm)</label>
                    <NumberStepper
                      value={rimInnerWidth}
                      onChange={setRimInnerWidth}
                      step={0.5}
                      min={13}
                      max={45}
                      unit="mm"
                      decimals={1}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Hookless & Tire Insert Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Hookless Rim Option */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08]">
                <div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-200 block">
                    {language === 'zh-TW' ? '無鈎車圈' : '无钩车圈'}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">ETRTO 强制上限 72.5 PSI / 5.0 Bar</span>
                </div>
                <input
                  type="checkbox"
                  checked={isHookless}
                  onChange={(e) => setIsHookless(e.target.checked)}
                  className="w-4 h-4 rounded accent-ios-blue cursor-pointer"
                />
              </div>

              {/* Tire Insert Option */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08]">
                <div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-200 block">
                    {language === 'zh-TW' ? '防爆胎墊 / 內襯' : '防爆胎垫 / 内衬'}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">如 CushCore/Vittoria，防磕圈自适应降压 2.5 PSI</span>
                </div>
                <input
                  type="checkbox"
                  checked={hasTireInsert}
                  onChange={(e) => setHasTireInsert(e.target.checked)}
                  className="w-4 h-4 rounded accent-ios-blue cursor-pointer"
                />
              </div>
            </div>

            {/* Ambient Temperature Compensation Slider */}
            <div className="p-3.5 rounded-2xl bg-sky-500/5 dark:bg-sky-500/10 border border-sky-500/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Thermometer className="w-4 h-4 text-sky-500 shrink-0" />
                  <label className="text-xs font-semibold text-slate-900 dark:text-white">
                    {language === 'zh-TW' ? '騎行環境氣溫補償' : '骑行环境气温补偿'}
                  </label>
                  <Tooltip content="根据盖-吕萨克理想气体热力学定律，室外温度与打气筒所在室内温度存在温差时，实际骑行胎压会发生热胀冷缩偏移（约 0.1 Bar / 10°C）" />
                </div>
                <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                  {rideTempC}°C ({Math.round(rideTempC * 1.8 + 32)}°F)
                </span>
              </div>
              <input
                type="range"
                min="-5"
                max="45"
                step="1"
                value={rideTempC}
                onChange={(e) => setRideTempC(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-sky-500"
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>寒冬 -5°C</span>
                <span>常温 20°C (基准)</span>
                <span>酷暑 45°C</span>
              </div>
            </div>

            {/* Surface Type */}
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-2">
                {language === 'zh-TW' ? '主要路面條件' : '主要路面条件'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(SURFACE_FACTORS).map(([key, s]) => {
                  const isSelected = surfaceKey === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setSurfaceKey(key)}
                      className={`p-2.5 rounded-xl border text-left transition apple-touch ${
                        isSelected
                          ? 'bg-ios-blue text-white border-ios-blue font-bold shadow-sm ring-1.5 ring-ios-blue/30 scale-[1.01]'
                          : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20'
                      }`}
                    >
                      <div className={`text-xs ${isSelected ? 'font-bold text-white' : 'font-medium'}`}>{s.label}</div>
                      <div className={`text-[11px] mt-0.5 ${isSelected ? 'text-white/85' : 'text-slate-500 dark:text-slate-400'}`}>{s.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </IOSCard>
        </div>

        {/* Right Output Results (macOS Sticky Canvas / Inspector on desktop) */}
        <div className="lg:col-span-6 space-y-4 sm:space-y-5 lg:sticky lg:top-20 self-start">
          {/* Hookless ETRTO Width Mismatch Banner */}
          {result.isHooklessWidthMismatch && (
            <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-950 dark:text-rose-200 text-xs space-y-1.5 shadow-ios-sm">
              <div className="font-bold flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>ETRTO 安全规范警报：无钩圈与外胎规格不匹配</span>
              </div>
              <p className="leading-relaxed opacity-95">
                当前车圈内宽为 <strong>{rimInnerWidth}mm</strong>（≥23mm），而外胎规格为 <strong>{nominalWidth}c</strong>（&lt;28c）。根据欧洲轮胎轮圈组织 ETRTO 规范，宽内宽无钩轮圈严禁搭配小于 28c 外胎，否则胎圈无法产生足够的机械锁紧拉力，存在高速脱圈风险。建议更换为 28c 或以上规格外胎。
              </p>
            </div>
          )}

          {/* Hookless Pressure Danger/Warning */}
          {result.isHooklessPressureExceeded && (
            <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-900 dark:text-rose-200 text-xs space-y-1.5 shadow-ios-sm">
              <div className="font-bold flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>突破无钩轮圈 72.5 PSI 极限安全红线！</span>
              </div>
              <p className="leading-relaxed opacity-95">
                当前计算气压（前 {result.front.rec} / 后 {result.rear.rec} {pressureUnit.toUpperCase()}）已突破国际 ETRTO/ISO 无钩轮圈 <strong>72.5 PSI / 5.0 Bar</strong> 绝对强制安全上限！无钩轮圈没有内扣机械锁止突缘，超压极易导致外胎炸出车圈。强烈建议选用 28c~32c 更宽外胎以将安全气压降至 50~65 PSI。
              </p>
            </div>
          )}

          {result.isHooklessPressureWarning && (
            <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs space-y-1.5 shadow-ios-sm">
              <div className="font-bold flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>气压临近无钩圈 72.5 PSI 安全阈值</span>
              </div>
              <p className="leading-relaxed opacity-95">
                当前推荐气压（后轮 {result.rear.rec} {pressureUnit.toUpperCase()}）已处于 68~72.5 PSI 高压临界区间。夏季柏油路面温度可达 50°C+，会导致胎内空气热膨胀再升高 3~5 PSI，建议充气时预留 3 PSI 冗余，或升级更宽外胎获得更高舒适性与安全性。
              </p>
            </div>
          )}

          {/* Recommended Output Card */}
          <IOSCard variant="default" className="space-y-4">
            <IOSCardHeader
              title={language === 'zh-TW' ? '推薦胎壓計算結果' : '推荐胎压计算结果'}
              subtitle={language === 'zh-TW' ? '基於專業滾阻測試模型' : '基于专业滚阻测试模型'}
              icon={Gauge}
              iconColor="text-ios-blue bg-ios-blue/10 dark:bg-ios-blue/20"
            />

            {/* Visual Dials Row */}
            <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
            <TireGauge
              label={language === 'zh-TW' ? '前輪推薦胎壓儀表' : '前轮推荐气压仪表'}
              psi={result.front.rawPsi}
              minPsi={result.front.rawPsi * 0.94}
              maxPsi={result.front.rawPsi * 1.06}
              unit={pressureUnit}
              displayValue={result.front.rec}
            />
            <TireGauge
              label={language === 'zh-TW' ? '後輪推薦胎壓儀表' : '后轮推荐气压仪表'}
              psi={result.rear.rawPsi}
              minPsi={result.rear.rawPsi * 0.94}
              maxPsi={result.rear.rawPsi * 1.06}
              unit={pressureUnit}
              displayValue={result.rear.rec}
            />
          </div>

          {/* Numerical Display Cards */}
          <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
            <IOSMetricTile
              label={isStaggeredWidth ? `${result.front.widthDesc} ${language === 'zh-TW' ? '前輪區間' : '前轮区间'}` : (language === 'zh-TW' ? '前輪建議區間' : '前轮建议区间')}
              value={`${result.front.min} - ${result.front.max}`}
              unit={pressureUnit.toUpperCase()}
              subtext={language === 'zh-TW' ? '前轴抓地与舒适滤震' : '前轴抓地与舒适滤震'}
              accent="blue"
            />
            <IOSMetricTile
              label={isStaggeredWidth ? `${result.rear.widthDesc} ${language === 'zh-TW' ? '後輪區間' : '后轮区间'}` : (language === 'zh-TW' ? '後輪建議區间' : '后轮建议区间')}
              value={`${result.rear.min} - ${result.rear.max}`}
              unit={pressureUnit.toUpperCase()}
              subtext={language === 'zh-TW' ? '驱动承重与低滚阻' : '驱动承重与低滚阻'}
              accent="blue"
            />
          </div>

          {/* Temperature Compensation Indoor Pump Guidance */}
          {rideTempC !== 20 && (
            <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/40 text-xs space-y-1">
              <div className="flex items-center justify-between font-semibold text-sky-900 dark:text-sky-300">
                <span className="flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                  <span>{language === 'zh-TW' ? '室內打氣基準建議 (20°C 基準)' : '室内打气基准建议 (20°C 基准)'}</span>
                </span>
                <span className="font-mono text-sky-600 dark:text-sky-400 font-bold tabular-nums">
                  {result.tempDeltaPsi > 0 ? `+${result.tempDeltaPsi}` : result.tempDeltaPsi} PSI
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {rideTempC < 20
                  ? `室外气温低（${rideTempC}°C），气体冷缩。建议在 20°C 室内打气时打至 前 ${result.front.pumpRec} / 后 ${result.rear.pumpRec} ${pressureUnit.toUpperCase()}，到室外冷缩后刚好达到最佳骑行胎压。`
                  : `室外地面高温（${rideTempC}°C），气体受热膨胀。建议在 20°C 室内打气时预留余量打至 前 ${result.front.pumpRec} / 后 ${result.rear.pumpRec} ${pressureUnit.toUpperCase()}，上路升温后即可达到最佳骑行胎压。`}
              </p>
            </div>
          )}

          {/* Quick Sync to Active Bike Footer */}
          {activeBike && (
            <IOSGarageSyncFooter
              bikeName={activeBike.name}
              badgeText="气压联动"
              detailText={`建议前 ${result.front.rec} / 后 ${result.rear.rec} ${pressureUnit.toUpperCase()}`}
              buttonText={language === 'zh-TW' ? '保存氣壓至戰車' : '保存气压至战车'}
              onSave={() => {
                const fPsi = Math.round(result.front.rawPsi);
                const rPsi = Math.round(result.rear.rawPsi);
                updateActiveBikeWheelTire({
                  nominalWidthMm: nominalWidth,
                  actualWidthMm: actualWidth,
                  rimInternalWidthMm: rimInnerWidth,
                  tireSetup,
                  isHookless,
                  frontPressurePsi: fPsi,
                  rearPressurePsi: rPsi,
                });
                showToast(
                  language === 'zh-TW'
                    ? `已將計算胎壓前 ${fPsi} / 後 ${rPsi} PSI 保存至戰車【${activeBike.name.split('/')[0]}】`
                    : `已将计算胎压前 ${fPsi} / 后 ${rPsi} PSI 保存至战车【${activeBike.name.split('/')[0]}】`,
                  'success'
                );
              }}
            />
          )}
        </IOSCard>

        {/* Tips and Explanation Box */}
        <IOSCard variant="default" className="space-y-4">
          <IOSCardHeader
            title={language === 'zh-TW' ? '氣壓微調與防扎防護建議' : '气压微调与防扎防护建议'}
            icon={Info}
            iconColor="text-ios-blue bg-ios-blue/10 dark:bg-ios-blue/20"
          />
          <ul className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
            {result.notes.map((note, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-ios-blue mt-1.5 shrink-0"></span>
                <span className="leading-relaxed">{note}</span>
              </li>
            ))}
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-ios-blue mt-1.5 shrink-0"></span>
              <span className="leading-relaxed">
                <strong>温度气压效应：</strong>气温每上升或下降 5°C，外胎气压会随之波动约 1~1.5 PSI。夏季室外暴晒骑行前建议留有余量。
              </span>
            </li>
          </ul>
          <div className="flex items-start gap-2 pt-2 border-t border-black/[0.05] dark:border-white/[0.08]">
            <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              <strong className="text-slate-600 dark:text-slate-300">算法说明：</strong>
              建议胎压基于 Frank Berto 经验公式与 Silca 15% 胎面下沉量法则推算，路面系数与气嘴类型修正值为工程估算，并非独立实验室测试数据。
              输出结果仅作参考起点，实际骑行体感（贴地感、滚阻、防扎余量）应作为最终调整依据。
            </p>
          </div>
        </IOSCard>
      </div>
    </div>

      {/* Social Share Poster Modal */}
      <ShareCardModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        imageUrl={sharePosterUrl}
        title="科学胎压调校卡"
        downloadFileName={`LaBao_科学胎压_${actualWidth}mm_${pressureUnit.toUpperCase()}.png`}
      />
    </div>
  );
};
