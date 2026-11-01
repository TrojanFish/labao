import React, { useState, useMemo, useEffect } from 'react';
import { Zap, Activity, Info, Mountain, Wind, Flame, Gauge, Share2, Award, Sliders, ChevronDown, Disc, AlertTriangle, Bike } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Tooltip } from '../common/Tooltip';
import { NumberStepper } from '../common/NumberStepper';
import { IOSSegmentedControl } from '../common/IOSSegmentedControl';
import { IOSCard, IOSCardHeader, IOSMetricTile } from '../common/IOSCard';
import { IOSToolHeader } from '../common/IOSToolHeader';
import { ShareCardModal } from '../common/ShareCardModal';
import { generateCyclePowerPoster } from '../../utils/shareCardGenerators';
import { useRiderProfile } from '../../context/RiderProfileContext';
import { useToast } from '../../context/ToastContext';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

export const CyclePowerCalculator: React.FC = () => {
  const { profile, activeBike, updateProfile } = useRiderProfile();
  const { unitSystem, language } = useLanguageAndUnit();
  const { showToast } = useToast();

  const isImperial = unitSystem === 'imperial';

  const [calcMode, setCalcMode] = useState<'speed' | 'power' | 'wkg'>('speed');
  const [powerInput, setPowerInput] = useState<number>(profile.ftpWatts || 220);
  const [targetSpeedKmh, setTargetSpeedKmh] = useState<number>(35);
  const [targetWkg, setTargetWkg] = useState<number>(3.5);

  // Share Poster State
  const [sharePosterUrl, setSharePosterUrl] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  const [riderWeight, setRiderWeight] = useState<number>(profile.weightKg || 68);
  const [bikeWeight, setBikeWeight] = useState<number>(activeBike?.weightKg || profile.bikeWeightKg || 8.5);
  const [grade, setGrade] = useState<number>(0);
  const [windSpeedKmh, setWindSpeedKmh] = useState<number>(0);
  const [windDirection, setWindDirection] = useState<'headwind' | 'tailwind'>('headwind');

  // Reactively synchronize whenever global rider profile or active bike updates
  useEffect(() => {
    if (profile.weightKg) setRiderWeight(profile.weightKg);
    if (profile.ftpWatts) setPowerInput(profile.ftpWatts);
    if (activeBike) {
      if (activeBike.weightKg) setBikeWeight(activeBike.weightKg);
      if (activeBike.cda) setCustomCda(activeBike.cda);
      if (activeBike.crr) setCustomCrr(activeBike.crr);
    } else if (profile.bikeWeightKg) {
      setBikeWeight(profile.bikeWeightKg);
    }
  }, [profile.weightKg, profile.bikeWeightKg, profile.ftpWatts, activeBike]);

  // Advanced aero & physics parameters
  const [altitudeM, setAltitudeM] = useState<number>(50);
  const [tempC, setTempC] = useState<number>(20);
  const [cdaPreset, setCdaPreset] = useState<'extreme_tt' | 'tt' | 'drops' | 'hoods' | 'tops'>('hoods');
  const [customCda, setCustomCda] = useState<number>(activeBike?.cda || 0.32);
  const [hasHeadShrug, setHasHeadShrug] = useState<boolean>(false);
  const [customCrr, setCustomCrr] = useState<number>(activeBike?.crr || 0.0035);
  const [yawAngleDeg, setYawAngleDeg] = useState<number>(0); // 0°~20° yaw angle

  // Dedicated Climb & VAM test parameters
  const [climbDistanceKm, setClimbDistanceKm] = useState<number>(10);
  const [climbElevationGainM, setClimbElevationGainM] = useState<number>(600);

  // Active chart view tab
  const [chartTab, setChartTab] = useState<'speed' | 'weight'>('speed');

  // Dynamic Air Density Barometric Formula: p = p0 * (1 - 0.0000225577 * h)^5.25588, rho = p / (R * T)
  const airDensityRho = useMemo(() => {
    const p0 = 101325;
    const T = tempC + 273.15;
    const pressure = p0 * Math.pow(1 - 0.0000225577 * altitudeM, 5.25588);
    const rho = pressure / (287.05 * T);
    return parseFloat(rho.toFixed(3));
  }, [altitudeM, tempC]);

  const handleCdaPresetChange = (preset: 'extreme_tt' | 'tt' | 'drops' | 'hoods' | 'tops') => {
    setCdaPreset(preset);
    if (preset === 'extreme_tt') setCustomCda(0.20);
    else if (preset === 'tt') setCustomCda(0.22);
    else if (preset === 'drops') setCustomCda(0.28);
    else if (preset === 'hoods') setCustomCda(0.32);
    else if (preset === 'tops') setCustomCda(0.38);
  };

  // Main Comprehensive Physical Calculation Engine
  const result = useMemo(() => {
    const g = 9.80665;
    const safeRiderWeight = Math.max(20, riderWeight || 68);
    const safeBikeWeight = Math.max(3, bikeWeight || 8);
    const totalMass = safeRiderWeight + safeBikeWeight;
    const gradeRad = Math.atan(grade / 100);
    const fGravity = totalMass * g * Math.sin(gradeRad);
    const fRolling = totalMass * g * Math.cos(gradeRad) * customCrr;

    // Base CdA incorporating Head Shrug aerodynamic savings (-0.015 m² CdA)
    const baseCda = Math.max(0.15, customCda - (hasHeadShrug ? 0.015 : 0));

    // Crosswind Yaw angle CdA empirical correction
    const yawRad = (yawAngleDeg * Math.PI) / 180;
    const effectiveCda = baseCda * (1 + Math.pow(Math.sin(yawRad), 2) * 0.28);

    const windMs = (windSpeedKmh / 3.6) * (windDirection === 'headwind' ? 1 : -1);

    let effectiveWatts = powerInput;
    let effectiveSpeedKmh = targetSpeedKmh;

    if (calcMode === 'wkg') {
      effectiveWatts = Math.round(targetWkg * safeRiderWeight);
    }

    if (calcMode === 'speed' || calcMode === 'wkg') {
      // Binary search for velocity from power
      let low = 0;
      let high = 45; // m/s
      let v = 0;
      for (let i = 0; i < 50; i++) {
        v = (low + high) / 2;
        const vRel = v + windMs;
        const currentAero = 0.5 * airDensityRho * effectiveCda * Math.pow(Math.max(0, vRel), 2);
        const requiredPower = (fGravity + fRolling + currentAero) * v;
        if (requiredPower < effectiveWatts) {
          low = v;
        } else {
          high = v;
        }
      }
      effectiveSpeedKmh = Math.max(0, parseFloat((v * 3.6).toFixed(1)));
    } else {
      // Direct solve power from speed
      const v = targetSpeedKmh / 3.6;
      const vRel = v + windMs;
      const currentAero = 0.5 * airDensityRho * effectiveCda * Math.pow(Math.max(0, vRel), 2);
      effectiveWatts = Math.max(0, Math.round((fGravity + fRolling + currentAero) * v));
      effectiveSpeedKmh = targetSpeedKmh;
    }

    const vFinal = effectiveSpeedKmh / 3.6;
    const vRelFinal = vFinal + windMs;
    const fAero = 0.5 * airDensityRho * effectiveCda * Math.pow(Math.max(0, vRelFinal), 2);

    const wkg = parseFloat((effectiveWatts / safeRiderWeight).toFixed(2));
    const totalForce = Math.max(0.1, Math.abs(fGravity) + fRolling + fAero);
    const aeroPct = Math.round((Math.max(0, fAero) / totalForce) * 100);
    const rollingPct = Math.round((Math.max(0, fRolling) / totalForce) * 100);
    const gravityPct = Math.max(0, 100 - aeroPct - rollingPct);

    // Coggan FTP Level Evaluation
    let levelTitle = language === 'zh-TW' ? '業餘騎遊' : '业余骑游';
    let levelBadgeColor = 'text-sky-400 bg-sky-500/10 border-sky-500/20';
    if (wkg >= 5.2) {
      levelTitle = language === 'zh-TW' ? '世界職業級' : '世界职业级';
      levelBadgeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    } else if (wkg >= 4.2) {
      levelTitle = language === 'zh-TW' ? '業餘精英一級' : '业余精英一级';
      levelBadgeColor = 'text-purple-400 bg-purple-500/10 border-purple-500/20';
    } else if (wkg >= 3.2) {
      levelTitle = language === 'zh-TW' ? '強力進階騎士' : '强力进阶骑士';
      levelBadgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    } else if (wkg >= 2.4) {
      levelTitle = language === 'zh-TW' ? '活躍俱樂部車手' : '活跃俱乐部车手';
      levelBadgeColor = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
    }

    // Coggan 7-Zone FTP Training Ranges
    const ftpBase = calcMode === 'speed' ? effectiveWatts : profile.ftpWatts || 220;
    const ftpZones = [
      { zone: language === 'zh-TW' ? 'Z1 主動恢復' : 'Z1 主动恢复', pct: '< 55%', min: 0, max: Math.round(ftpBase * 0.55), desc: language === 'zh-TW' ? '輕鬆排酸，加速代謝恢復' : '轻松排酸，加速代谢恢复' },
      { zone: language === 'zh-TW' ? 'Z2 有氧耐力' : 'Z2 有氧耐力', pct: '56% - 75%', min: Math.round(ftpBase * 0.56), max: Math.round(ftpBase * 0.75), desc: language === 'zh-TW' ? '提升線粒體密度與脂肪燃燒效率' : '提升线粒体密度与脂肪燃烧效率' },
      { zone: language === 'zh-TW' ? 'Z3 節奏區間' : 'Z3 节奏区间', pct: '76% - 90%', min: Math.round(ftpBase * 0.76), max: Math.round(ftpBase * 0.90), desc: language === 'zh-TW' ? '高效率巡航與長距離有氧輸出' : '高效率巡航与长距离有氧输出' },
      { zone: language === 'zh-TW' ? 'Z4 甜點/乳酸閾值' : 'Z4 甜点/乳酸阈值', pct: '91% - 105%', min: Math.round(ftpBase * 0.91), max: Math.round(ftpBase * 1.05), desc: language === 'zh-TW' ? '提升 FTP 閾值功率的核心訓練區間' : '提升 FTP 阈值功率的核心训练区间' },
      { zone: language === 'zh-TW' ? 'Z5 最大攝氧量' : 'Z5 最大摄氧量', pct: '106% - 120%', min: Math.round(ftpBase * 1.06), max: Math.round(ftpBase * 1.20), desc: language === 'zh-TW' ? '3~5分鐘短坡與破風突圍極限' : '3~5分钟短坡与破风突围极限' },
      { zone: language === 'zh-TW' ? 'Z6 無氧耐力' : 'Z6 无氧耐力', pct: '121% - 150%', min: Math.round(ftpBase * 1.21), max: Math.round(ftpBase * 1.50), desc: language === 'zh-TW' ? '30秒~2分鐘陡坡進攻與超車' : '30秒~2分钟陡坡进攻与超车' },
      { zone: language === 'zh-TW' ? 'Z7 神經肌肉衝刺' : 'Z7 神经肌肉冲刺', pct: '> 150%', min: Math.round(ftpBase * 1.51), max: 9999, desc: language === 'zh-TW' ? '全速衝刺與瞬間終點爆發' : '全速冲刺与瞬间终点爆发' }
    ];

    // Metabolic energy consumption (24% mechanical efficiency)
    const kcalPerHour = Math.round((effectiveWatts * 3.6) / 4.184 / 0.24);

    // VAM & Climbing calculation
    const avgClimbGrade = climbDistanceKm > 0 ? (climbElevationGainM / (climbDistanceKm * 1000)) * 100 : 6;
    const climbSpeedMs = (effectiveSpeedKmh / 3.6);
    const vam = Math.round(climbSpeedMs * (avgClimbGrade / 100) * 3600);
    const climbTimeMinutes = vam > 0 ? Math.round((climbElevationGainM / vam) * 60) : 0;

    // Downhill Terminal Coasting Speed at 0W
    let terminalCoastingKmh = 0;
    if (grade < 0) {
      const fGravityForward = -fGravity; // forward component of gravity
      if (fGravityForward > fRolling) {
        const netForwardForce = fGravityForward - fRolling;
        const vRelTerm = Math.sqrt((2 * netForwardForce) / (airDensityRho * effectiveCda));
        const vTerm = Math.max(0, vRelTerm - windMs);
        terminalCoastingKmh = parseFloat((vTerm * 3.6).toFixed(1));
      }
    }
    const isDownhillAlert = grade < 0 && (effectiveSpeedKmh > 75 || terminalCoastingKmh > 75);

    return {
      power: effectiveWatts,
      speedKmh: effectiveSpeedKmh,
      wkg,
      fGravity: Math.round(fGravity),
      fRolling: Math.round(fRolling),
      fAero: Math.round(fAero),
      aeroPct,
      rollingPct,
      gravityPct,
      levelTitle,
      levelBadgeColor,
      ftpZones,
      kcalPerHour,
      vam,
      climbTimeMinutes,
      avgClimbGrade: avgClimbGrade.toFixed(1),
      terminalCoastingKmh,
      isDownhillAlert
    };
  }, [calcMode, powerInput, targetSpeedKmh, targetWkg, riderWeight, bikeWeight, grade, windSpeedKmh, windDirection, yawAngleDeg, hasHeadShrug, airDensityRho, customCda, customCrr, climbDistanceKm, climbElevationGainM, profile.ftpWatts]);

  // Chart datasets
  const speedChartData = useMemo(() => {
    const baseCda = Math.max(0.15, customCda - (hasHeadShrug ? 0.015 : 0));
    const yawRad = (yawAngleDeg * Math.PI) / 180;
    const effectiveCda = baseCda * (1 + Math.pow(Math.sin(yawRad), 2) * 0.28);
    const speeds = [20, 25, 30, 35, 40, 45, 50];
    const powers = speeds.map(spd => {
      const v = spd / 3.6;
      const g = 9.80665;
      const totalMass = riderWeight + bikeWeight;
      const fG = totalMass * g * Math.sin(Math.atan(grade / 100));
      const fR = totalMass * g * Math.cos(Math.atan(grade / 100)) * customCrr;
      const fA = 0.5 * airDensityRho * effectiveCda * Math.pow(v, 2);
      return Math.round(Math.max(0, (fG + fR + fA) * v));
    });

    return {
      labels: speeds.map(s => (isImperial ? `${(s * 0.621371).toFixed(0)} mph` : `${s} km/h`)),
      datasets: [
        {
          label: isImperial ? 'Required Power (W)' : '平路/坡道所需功率 (W)',
          data: powers,
          borderColor: '#00AFFF',
          backgroundColor: 'rgba(0, 175, 255, 0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#00AFFF'
        }
      ]
    };
  }, [riderWeight, bikeWeight, grade, airDensityRho, customCda, hasHeadShrug, yawAngleDeg, customCrr, isImperial]);

  const weightChartData = useMemo(() => {
    const baseCda = Math.max(0.15, customCda - (hasHeadShrug ? 0.015 : 0));
    const yawRad = (yawAngleDeg * Math.PI) / 180;
    const effectiveCda = baseCda * (1 + Math.pow(Math.sin(yawRad), 2) * 0.28);
    const weights = [55, 60, 65, 70, 75, 80, 85];
    const powers = weights.map(w => {
      const v = 35 / 3.6; // 35 km/h standard
      const g = 9.80665;
      const totalMass = w + bikeWeight;
      const fG = totalMass * g * Math.sin(Math.atan(grade / 100));
      const fR = totalMass * g * Math.cos(Math.atan(grade / 100)) * customCrr;
      const fA = 0.5 * airDensityRho * effectiveCda * Math.pow(v, 2);
      return Math.round(Math.max(0, (fG + fR + fA) * v));
    });

    return {
      labels: weights.map(w => (isImperial ? `${Math.round(w * 2.20462)} lbs` : `${w} kg`)),
      datasets: [
        {
          label: isImperial ? 'Power vs Weight at 22mph (W)' : '35km/h 巡航不同体重所需功率 (W)',
          data: powers,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointBackgroundColor: '#10b981'
        }
      ]
    };
  }, [bikeWeight, grade, airDensityRho, customCda, hasHeadShrug, yawAngleDeg, customCrr, isImperial]);

  const handleGeneratePoster = () => {
    const url = generateCyclePowerPoster({
      speedKmh: result.speedKmh,
      power: result.power,
      wkg: result.wkg,
      levelTitle: result.levelTitle,
      grade,
      kcalPerHour: result.kcalPerHour,
      vam: result.vam,
      aeroPct: result.aeroPct,
      gravityPct: result.gravityPct,
      rollingPct: result.rollingPct
    });
    setSharePosterUrl(url);
    setIsShareModalOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Unified Tool Header */}
      <IOSToolHeader
        category={language === 'zh-TW' ? '動力與傳動' : '动力与传动'}
        categoryIcon={Zap}
        title={language === 'zh-TW' ? '功率與速度' : '功率与速度'}
        description={
          language === 'zh-TW'
            ? '高精度空氣阻力、滾阻、重力分量與海拔密度推算，支援功速互推、Coggan 7 區間劃分與 VAM 爬坡耗時求解。'
            : '高精度空气阻力、滚阻、重力分量与海拔密度推算，支持功速互推、Coggan 7 区间划分与 VAM 爬坡耗时求解。'
        }
        tint="blue"
        onShare={handleGeneratePoster}
        shareTitle={language === 'zh-TW' ? '生成動力海報' : '生成动力海报'}
        actions={
          <IOSSegmentedControl
            options={[
              {
                id: 'speed',
                label: (
                  <>
                    <span className="sm:hidden">{language === 'zh-TW' ? '求速度' : '求速度'}</span>
                    <span className="hidden sm:inline">{language === 'zh-TW' ? '功率求速度' : '功率求速度'}</span>
                  </>
                )
              },
              {
                id: 'power',
                label: (
                  <>
                    <span className="sm:hidden">{language === 'zh-TW' ? '求功率' : '求功率'}</span>
                    <span className="hidden sm:inline">{language === 'zh-TW' ? '速度求功率' : '速度求功率'}</span>
                  </>
                )
              },
              {
                id: 'wkg',
                label: (
                  <>
                    <span className="sm:hidden">{language === 'zh-TW' ? '求推重比' : '求推重比'}</span>
                    <span className="hidden sm:inline">{language === 'zh-TW' ? '推重比求功率' : '推重比求功率'}</span>
                  </>
                )
              },
            ]}
            value={calcMode}
            onChange={(val) => setCalcMode(val as any)}
            size="md"
          />
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Left Inputs (macOS Inspector) */}
        <div className="lg:col-span-5 space-y-4 sm:space-y-5">
          <IOSCard variant="default" className="space-y-4">
            <IOSCardHeader
              title={language === 'zh-TW' ? '動力與環境變量輸入' : '动力与环境变量输入'}
              subtitle={language === 'zh-TW' ? '精密動力學與氣象設定' : '精密动力学与气象设定'}
              icon={Activity}
              iconColor="blue"
            />

            {/* Active Bike Indicator */}
            {activeBike && (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-ios-blue/10 dark:bg-ios-blue/15 border border-ios-blue/20 text-xs text-ios-blue dark:text-ios-blue-dark font-medium">
                <div className="flex items-center gap-2 min-w-0">
                  <Bike className="w-4 h-4 shrink-0" />
                  <span className="truncate">已载入战车动力学设定：<strong>{activeBike.name.split('/')[0]}</strong></span>
                </div>
                <span className="shrink-0 text-[11px] font-mono opacity-80">CdA {activeBike.cda} · Crr {activeBike.crr}</span>
              </div>
            )}

            {/* Target Input */}
            {calcMode === 'speed' && (
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
                  {language === 'zh-TW' ? '輸入騎行功率' : '输入骑行功率'} (W)
                </label>
                <NumberStepper value={powerInput} onChange={setPowerInput} step={5} min={20} max={1500} unit="W" />
              </div>
            )}
            {calcMode === 'power' && (
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
                  {language === 'zh-TW' ? '目標巡航速度' : '目标巡航速度'} ({isImperial ? 'mph' : 'km/h'})
                </label>
                <NumberStepper
                  value={isImperial ? parseFloat((targetSpeedKmh * 0.621371).toFixed(1)) : targetSpeedKmh}
                  onChange={(v) => setTargetSpeedKmh(isImperial ? parseFloat((v / 0.621371).toFixed(1)) : v)}
                  step={0.5}
                  min={isImperial ? 3 : 5}
                  max={isImperial ? 55 : 90}
                  unit={isImperial ? 'mph' : 'km/h'}
                  decimals={1}
                />
              </div>
            )}
            {calcMode === 'wkg' && (
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
                  {language === 'zh-TW' ? '目標推重比' : '目标推重比'} (W/kg)
                </label>
                <NumberStepper value={targetWkg} onChange={setTargetWkg} step={0.1} min={1.0} max={8.0} unit="W/kg" decimals={1} />
              </div>
            )}

            {/* Weight Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
                  {language === 'zh-TW' ? '車手體重' : '车手体重'} ({isImperial ? 'lbs' : 'kg'})
                </label>
                <NumberStepper
                  value={isImperial ? parseFloat((riderWeight * 2.20462).toFixed(1)) : riderWeight}
                  onChange={(v) => {
                    const kg = isImperial ? parseFloat((v / 2.20462).toFixed(1)) : v;
                    setRiderWeight(kg);
                    updateProfile({ weightKg: kg });
                  }}
                  step={isImperial ? 1 : 0.5}
                  min={isImperial ? 66 : 30}
                  max={isImperial ? 330 : 150}
                  unit={isImperial ? 'lbs' : 'kg'}
                  decimals={1}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
                  {language === 'zh-TW' ? '整車自重' : '整车自重'} ({isImperial ? 'lbs' : 'kg'})
                </label>
                <NumberStepper
                  value={isImperial ? parseFloat((bikeWeight * 2.20462).toFixed(1)) : bikeWeight}
                  onChange={(v) => {
                    const kg = isImperial ? parseFloat((v / 2.20462).toFixed(1)) : v;
                    setBikeWeight(kg);
                    updateProfile({ bikeWeightKg: kg });
                  }}
                  step={0.1}
                  min={isImperial ? 11 : 5}
                  max={isImperial ? 44 : 20}
                  unit={isImperial ? 'lbs' : 'kg'}
                  decimals={1}
                />
              </div>
            </div>

            {/* Slope & Wind */}
            <div className="space-y-4 pt-1">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {language === 'zh-TW' ? '道路坡度' : '道路坡度'} (%)
                  </label>
                  <span className="text-ios-blue font-mono font-semibold text-xs">{grade}%</span>
                </div>
                <input
                  type="range"
                  min="-15"
                  max="25"
                  step="0.5"
                  value={grade}
                  onChange={(e) => setGrade(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-ios-blue"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {language === 'zh-TW' ? '風速與方向' : '风速与方向'}
                  </label>
                  <span className="text-ios-blue font-mono font-semibold text-xs">
                    {isImperial ? `${(windSpeedKmh * 0.621371).toFixed(1)} mph` : `${windSpeedKmh} km/h`}{' '}
                    ({windDirection === 'headwind' ? (language === 'zh-TW' ? '頂風' : '顶风') : (language === 'zh-TW' ? '順風' : '顺风')})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="1"
                    value={windSpeedKmh}
                    onChange={(e) => setWindSpeedKmh(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-ios-blue"
                  />
                  <button
                    onClick={() => setWindDirection(windDirection === 'headwind' ? 'tailwind' : 'headwind')}
                    className="px-2.5 py-1 bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/10 dark:hover:bg-white/15 border border-black/[0.05] dark:border-white/[0.08] rounded-xl text-[11px] text-ios-blue shrink-0 font-semibold transition apple-touch"
                  >
                    {windDirection === 'headwind' ? (language === 'zh-TW' ? '頂風' : '顶风') : (language === 'zh-TW' ? '順風' : '顺风')}
                  </button>
                </div>
              </div>
            </div>

            {/* Aero Posture Presets */}
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-2 flex items-center">
                {language === 'zh-TW' ? '騎行姿態與風阻面積 CdA' : '骑行姿态与风阻面积 CdA'}
                <Tooltip content="CdA 代表风阻系数乘以正面投影迎风面积，值越小越气动省力。" />
              </label>
              <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
                {[
                  { id: 'extreme_tt', label: language === 'zh-TW' ? '祈禱 TT' : '极限祈祷', cda: 0.20 },
                  { id: 'tt', label: language === 'zh-TW' ? 'TT 破風' : 'TT 破风', cda: 0.22 },
                  { id: 'drops', label: language === 'zh-TW' ? '下把位' : '下把位', cda: 0.28 },
                  { id: 'hoods', label: language === 'zh-TW' ? '手變位' : '手变位', cda: 0.32 },
                  { id: 'tops', label: language === 'zh-TW' ? '上把位' : '上把位', cda: 0.38 },
                ].map((p) => {
                  const isSelected = cdaPreset === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleCdaPresetChange(p.id as any)}
                      className={`py-1.5 sm:py-2 px-0.5 sm:px-1 rounded-xl border text-center transition apple-touch ${
                        isSelected
                          ? 'bg-ios-blue text-white border-ios-blue font-bold shadow-sm ring-1.5 ring-ios-blue/30 scale-[1.01]'
                          : 'bg-black/[0.02] dark:bg-white/[0.04] border-black/[0.05] dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:border-black/10 dark:hover:border-white/15'
                      }`}
                    >
                      <div className={`text-[11px] leading-tight truncate ${isSelected ? 'font-bold text-white' : 'font-semibold'}`}>{p.label}</div>
                      <div className={`text-[11px] font-mono mt-0.5 ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>{p.cda} m²</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Head Shrug / Turtle Head Aero Technique */}
            <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-200">
                      {language === 'zh-TW' ? '頭部下潛' : '头部下潜'}
                    </span>
                    <Tooltip content="世界巡回赛 TT 计时赛核心控风技巧：头部下沉嵌于双肩之间，压平后背高速气流湍流。风洞实测平均降低 CdA 约 0.015 m²（40km/h 下省约 12~18W）。" />
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    下沉下颌嵌入双肩，抹平后颈气流剥离
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {hasHeadShrug && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      -0.015 m² (~15W)
                    </span>
                  )}
                  <input
                    type="checkbox"
                    checked={hasHeadShrug}
                    onChange={(e) => setHasHeadShrug(e.target.checked)}
                    className="w-4 h-4 rounded accent-ios-blue cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Yaw Angle (Crosswind Angle) */}
            <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1">
                  <Wind className="w-3.5 h-3.5 text-ios-blue" />
                  {language === 'zh-TW' ? '側風偏航角' : '侧风偏航角'}
                  <Tooltip content="偏航角为车手行进方向与合成风矢量的夹角（0°为正迎风，5°~12°为典型公路侧风，20°为强横风）。偏航角增加时身体侧向受风投影面积增大，气动阻力相应上升。" />
                </span>
                <span className="font-mono font-bold text-xs text-ios-blue">
                  {yawAngleDeg}° {yawAngleDeg === 0 ? '· 正迎风' : yawAngleDeg <= 10 ? '· 小角度侧风' : '· 强横风'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={yawAngleDeg}
                  onChange={(e) => setYawAngleDeg(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-ios-blue"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1 text-[11px]">
                {[
                  { val: 0, label: '0° 正迎风' },
                  { val: 5, label: '5° 微侧风' },
                  { val: 10, label: '10° 典型公路风' },
                  { val: 15, label: '15° 大偏航角' },
                  { val: 20, label: '20° 极限横风' }
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setYawAngleDeg(item.val)}
                    className={`px-2 py-0.5 rounded-lg border transition font-medium apple-touch ${
                      yawAngleDeg === item.val
                        ? 'bg-ios-blue text-white border-ios-blue font-bold shadow-xs'
                        : 'bg-black/[0.02] dark:bg-white/[0.04] border-black/[0.05] dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:border-black/10 dark:hover:border-white/15'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Precision Altitude & Temperature Air Density */}
            <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1">
                  <Wind className="w-3.5 h-3.5 text-ios-blue" />
                  {language === 'zh-TW' ? '海拔與氣壓密度校正' : '海拔与气压密度校正'}
                </span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-ios-blue font-bold text-xs">ρ = {airDensityRho} kg/m³</span>
                  {altitudeM > 100 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                      气阻 -{Math.round((1 - airDensityRho / 1.225) * 100)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Altitude Presets */}
              <div className="flex flex-wrap items-center gap-1 text-[11px]">
                {[
                  { val: 0, label: '海平面 0m' },
                  { val: 500, label: '丘陵 500m' },
                  { val: 2200, label: '青海湖 2200m' },
                  { val: 4200, label: '折多山 4200m' },
                ].map((item) => (
                  <button
                    key={item.val}
                    onClick={() => setAltitudeM(item.val)}
                    className={`px-2 py-0.5 rounded-lg border transition font-medium apple-touch ${
                      altitudeM === item.val
                        ? 'bg-ios-blue text-white border-ios-blue font-bold shadow-xs'
                        : 'bg-black/[0.02] dark:bg-white/[0.04] border-black/[0.05] dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:border-black/10 dark:hover:border-white/15'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
                    {language === 'zh-TW' ? '海拔' : '骑行海拔'}: {altitudeM} m {isImperial ? `(${Math.round(altitudeM * 3.28084)} ft)` : ''}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="4500"
                    step="50"
                    value={altitudeM}
                    onChange={(e) => setAltitudeM(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-ios-blue"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
                    {language === 'zh-TW' ? '環境氣溫' : '环境气温'}: {tempC} °C {isImperial ? `(${Math.round((tempC * 9)/5 + 32)} °F)` : ''}
                  </label>
                  <input
                    type="range"
                    min="-10"
                    max="45"
                    step="1"
                    value={tempC}
                    onChange={(e) => setTempC(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-ios-blue"
                  />
                </div>
              </div>
            </div>
          </IOSCard>
        </div>

        {/* Right Output Results & Full Analytics (macOS Sticky Canvas) */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-5 lg:sticky lg:top-20 self-start">
          {/* Downhill High Speed & Thermal Warning */}
          {grade < 0 && (
            <div className={`p-4 rounded-2xl border transition-all shadow-ios-sm ${
              result.isDownhillAlert
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-200'
                : 'bg-ios-blue/10 border-ios-blue/20 text-slate-800 dark:text-slate-200'
            }`}>
              <div className="flex items-start gap-3 text-xs">
                <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${result.isDownhillAlert ? 'text-rose-500' : 'text-ios-blue'}`} />
                <div className="space-y-1 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-sm">
                      {result.isDownhillAlert ? '下坡极速与制动热衰减安全预警' : '下坡滑行力学平衡'}
                    </span>
                    {result.terminalCoastingKmh > 0 && (
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10">
                        0W 终端放坡滑行极速: {result.terminalCoastingKmh} km/h
                      </span>
                    )}
                  </div>
                  <p className="leading-relaxed opacity-90 text-[11px] sm:text-xs">
                    {result.isDownhillAlert
                      ? '当前下坡车速或终端滑行速度突破 75 km/h 极速警戒线！请务必警惕弯道横风切变、碳纤维轮圈刹车热衰减（或碟刹油路气阻沸腾导致制动力丧失），提早点刹并保持充足跟车安全间距。'
                      : `在 ${Math.abs(grade)}% 负坡度下，重力向前分量克服地面滚阻持续做功。当空气阻力与净重力完全平衡时，0W 纯滑行终端速度为 ${result.terminalCoastingKmh} km/h。`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Main Hero Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <IOSMetricTile
              label={language === 'zh-TW' ? '估算速度' : '估算速度'}
              value={isImperial ? (result.speedKmh * 0.621371).toFixed(1) : result.speedKmh}
              unit={isImperial ? 'mph' : 'km/h'}
              subtext={isImperial ? `${result.speedKmh} km/h` : `${(result.speedKmh * 0.621371).toFixed(1)} mph`}
              accentColor="blue"
              icon={Gauge}
            />

            <IOSMetricTile
              label={language === 'zh-TW' ? '推重比 (W/kg)' : '推重比 (W/kg)'}
              value={result.wkg}
              unit="W/kg"
              subtext={`${result.power} ${language === 'zh-TW' ? '瓦實際總輸出' : '瓦实际总输出'}`}
              accentColor="green"
              icon={Zap}
            />

            <IOSMetricTile
              label={language === 'zh-TW' ? '人體能耗代謝' : '人体能耗代谢'}
              value={result.kcalPerHour}
              unit="kcal/h"
              subtext="24% 机械效率推算"
              accentColor="orange"
              icon={Flame}
            />
          </div>

          {/* Coggan Level Badge */}
          <div className="p-4 rounded-2xl bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border border-black/[0.05] dark:border-white/[0.08] flex items-center justify-between shadow-ios-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-ios-blue/10 flex items-center justify-center text-ios-blue">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  {language === 'zh-TW' ? '車手競技水平評估' : '车手竞技水平评估'}
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">{result.levelTitle}</span>
              </div>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full font-mono font-bold border ${result.levelBadgeColor}`}>
              {result.wkg} W/kg
            </span>
          </div>

          {/* VAM Climbing Estimator Card */}
          <div className="p-4 sm:p-5 rounded-2xl border border-ios-blue/20 bg-ios-blue/[0.04] dark:bg-ios-blue/[0.08] backdrop-blur-xl space-y-4 shadow-ios-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Mountain className="w-4 h-4 text-ios-blue" />
                {language === 'zh-TW' ? '爬坡性能與垂直攀升率 VAM 推算' : '爬坡性能与垂直攀升率 VAM 推算'}
              </h3>
              <span className="text-xs font-mono text-ios-blue dark:text-blue-400 font-bold tabular-nums">
                VAM: {result.vam} m/h {isImperial ? `(${Math.round(result.vam * 3.28084)} ft/h)` : ''}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                  {language === 'zh-TW' ? '爬坡路程' : '爬坡路程'}
                </span>
                <span className="text-slate-900 dark:text-slate-200 font-mono font-bold tabular-nums">
                  {climbDistanceKm} km {isImperial ? `(${(climbDistanceKm * 0.621371).toFixed(1)} mi)` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                  {language === 'zh-TW' ? '累計爬升' : '累计爬升'}
                </span>
                <span className="text-slate-900 dark:text-slate-200 font-mono font-bold tabular-nums">
                  +{climbElevationGainM} m {isImperial ? `(+${Math.round(climbElevationGainM * 3.28084)} ft)` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                  {language === 'zh-TW' ? '平均坡度' : '平均坡度'}
                </span>
                <span className="text-slate-900 dark:text-slate-200 font-mono font-bold tabular-nums">{result.avgClimbGrade}%</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                  {language === 'zh-TW' ? '預計登頂耗時' : '预计登顶耗时'}
                </span>
                <span className="text-ios-green font-mono font-bold tabular-nums">
                  {result.climbTimeMinutes} {language === 'zh-TW' ? '分鐘' : '分钟'}
                </span>
              </div>
            </div>
          </div>

          {/* Resistance Breakdown Bar */}
          <div className="p-4 sm:p-5 rounded-2xl border border-black/[0.05] dark:border-white/[0.08] bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl space-y-3 shadow-ios-sm">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
              {language === 'zh-TW' ? '三大物理阻力占比分解' : '三大物理阻力占比分解'}
            </span>
            <div className="h-3 w-full bg-black/[0.05] dark:bg-white/[0.08] rounded-full overflow-hidden flex">
              <div style={{ width: `${result.aeroPct}%` }} className="bg-ios-blue h-full transition-all duration-300" title={`Aero: ${result.aeroPct}%`} />
              <div style={{ width: `${result.rollingPct}%` }} className="bg-ios-green h-full transition-all duration-300" title={`Rolling: ${result.rollingPct}%`} />
              <div style={{ width: `${result.gravityPct}%` }} className="bg-ios-orange h-full transition-all duration-300" title={`Gravity: ${result.gravityPct}%`} />
            </div>

            <div className="flex justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              <span className="text-ios-blue font-semibold flex items-center gap-1">
                <Wind className="w-3.5 h-3.5" />
                <span>{language === 'zh-TW' ? '風阻' : '风阻'} {result.aeroPct}% ({result.fAero}N)</span>
              </span>
              <span className="text-ios-green font-semibold flex items-center gap-1">
                <Disc className="w-3.5 h-3.5" />
                <span>{language === 'zh-TW' ? '滾阻' : '滚阻'} {result.rollingPct}% ({result.fRolling}N)</span>
              </span>
              <span className="text-ios-orange font-semibold flex items-center gap-1">
                <Mountain className="w-3.5 h-3.5" />
                <span>{language === 'zh-TW' ? '重力' : '重力'} {result.gravityPct}% ({result.fGravity}N)</span>
              </span>
            </div>
          </div>

          {/* Coggan 7-Zone FTP Table */}
          <div className="p-4 sm:p-5 rounded-2xl border border-black/[0.05] dark:border-white/[0.08] bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl space-y-3 shadow-ios-sm">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                {language === 'zh-TW' ? `Coggan 7 區間功率訓練參考 · 基準 FTP ${profile.ftpWatts || 220}W` : `Coggan 7 区间功率训练参考 · 基准 FTP ${profile.ftpWatts || 220}W`}
              </span>
            </div>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full min-w-[460px] sm:min-w-0 text-xs text-left">
                <thead>
                  <tr className="border-b border-black/[0.04] dark:border-white/[0.06] text-slate-500 dark:text-slate-400">
                    <th className="pb-2 font-medium whitespace-nowrap">{language === 'zh-TW' ? '訓練區間' : '训练区间'}</th>
                    <th className="pb-2 font-medium whitespace-nowrap">{'FTP 比例'}</th>
                    <th className="pb-2 font-medium whitespace-nowrap">{language === 'zh-TW' ? '目標功率 (W)' : '目标功率 (W)'}</th>
                    <th className="pb-2 font-medium">{language === 'zh-TW' ? '主要訓練效益' : '主要训练效益'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.03] dark:divide-white/[0.04] text-slate-700 dark:text-slate-300 font-mono tabular-nums">
                  {result.ftpZones.map((z, idx) => (
                    <tr key={idx} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                      <td className="py-2 font-sans font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {z.zone}
                      </td>
                      <td className="whitespace-nowrap tabular-nums">{z.pct}</td>
                      <td className="whitespace-nowrap tabular-nums text-ios-blue font-bold">{z.min} - {z.max === 9999 ? 'MAX' : `${z.max} W`}</td>
                      <td className="font-sans text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">{z.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Chart Tabs */}
          <div className="p-4 sm:p-5 rounded-2xl border border-black/[0.05] dark:border-white/[0.08] bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl space-y-4 shadow-ios-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {language === 'zh-TW' ? '多維動力學預測曲線' : '多维动力学预测曲线'}
              </span>
              <div className="w-full sm:w-auto">
                <IOSSegmentedControl
                  options={[
                    { id: 'speed', label: language === 'zh-TW' ? '速度-功率' : '速度-功率' },
                    { id: 'weight', label: language === 'zh-TW' ? '體重-功率' : '体重-功率' },
                  ]}
                  value={chartTab}
                  onChange={(val) => setChartTab(val as any)}
                  size="sm"
                  fullWidth
                />
              </div>
            </div>

            <div className="h-56">
              <Line
                data={chartTab === 'speed' ? speedChartData : weightChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      titleColor: '#38bdf8',
                      bodyColor: '#f8fafc',
                      borderColor: 'rgba(56, 189, 248, 0.3)',
                      borderWidth: 1,
                      padding: 10
                    }
                  },
                  scales: {
                    x: { grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                    y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, title: { display: true, text: '功率 (W)' } }
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Social Share Poster Modal */}
      <ShareCardModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        imageUrl={sharePosterUrl}
        title={language === 'zh-TW' ? '騎行功率與速度戰報' : '骑行功率与速度战报'}
        downloadFileName={`YoloCycling_功率速度_${result.speedKmh}kmh_${result.power}W.png`}
      />
    </div>
  );
};
