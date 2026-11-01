import React, { useState, useMemo, useEffect } from 'react';
import { HeartPulse, Flame, Activity, User, Scale, Shield, Sparkles, Droplet, Apple, Heart, Percent, TrendingDown, TrendingUp, Info } from 'lucide-react';
import { useRiderProfile } from '../../context/RiderProfileContext';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';
import { NumberStepper } from '../common/NumberStepper';
import { IOSSegmentedControl } from '../common/IOSSegmentedControl';
import { IOSCard, IOSCardHeader, IOSMetricTile } from '../common/IOSCard';
import { IOSToolHeader } from '../common/IOSToolHeader';

export const HealthCalculator: React.FC = () => {
  const { profile } = useRiderProfile();
  const { unitSystem, language } = useLanguageAndUnit();
  const isImperial = unitSystem === 'imperial';

  const [activeTab, setActiveTab] = useState<'fueling' | 'hr_zones' | 'bmr' | 'bmi' | 'bfp'>('fueling');

  // Universal Inputs (Linked with Rider Profile)
  const [heightCm, setHeightCm] = useState<number>(profile.heightCm || 175);
  const [weightKg, setWeightKg] = useState<number>(profile.weightKg || 68);
  const [age, setAge] = useState<number>(profile.age || 28);
  const [gender, setGender] = useState<'male' | 'female'>(profile.gender || 'male');
  const [activityFactor, setActivityFactor] = useState<number>(1.55);

  // Heart Rate Inputs
  const [restingHr, setRestingHr] = useState<number>(profile.restingHr || 58);
  const [maxHr, setMaxHr] = useState<number>(profile.maxHr || 190);

  // Reactively synchronize with global rider profile
  useEffect(() => {
    if (profile.heightCm) setHeightCm(profile.heightCm);
    if (profile.weightKg) setWeightKg(profile.weightKg);
    if (profile.age) setAge(profile.age);
    if (profile.gender) setGender(profile.gender);
    if (profile.restingHr) setRestingHr(profile.restingHr);
    if (profile.maxHr) setMaxHr(profile.maxHr);
  }, [profile.heightCm, profile.weightKg, profile.age, profile.gender, profile.restingHr, profile.maxHr]);

  // In-ride Fueling Inputs
  const [rideDurationHours, setRideDurationHours] = useState<number>(3.0);
  const [rideIntensity, setRideIntensity] = useState<'z2' | 'z3' | 'race'>('z3');

  // 1. In-ride Carbohydrate & Fluid Fueling Plan (ISSN / Jeukendrup Sports Nutrition Framework)
  const fuelingResult = useMemo(() => {
    // Carbohydrate intake dynamically scales with duration & metabolic intensity:
    let carbsPerHour = 45; // g/h baseline
    if (rideDurationHours <= 1.0) {
      if (rideIntensity === 'z2') carbsPerHour = 0; // Endogenous glycogen sufficient
      else if (rideIntensity === 'z3') carbsPerHour = 25;
      else carbsPerHour = 45;
    } else if (rideDurationHours <= 2.5) {
      if (rideIntensity === 'z2') carbsPerHour = 30;
      else if (rideIntensity === 'z3') carbsPerHour = 50;
      else carbsPerHour = 65;
    } else {
      // Long endurance > 2.5 hours: requires higher oxidation capacity
      if (rideIntensity === 'z2') carbsPerHour = 50;
      else if (rideIntensity === 'z3') carbsPerHour = 70;
      else carbsPerHour = 85;
    }

    // Hydration: base sweat rate dynamically scaled with rider body weight (8~12.5 ml/kg/h):
    const sweatRatePerKg = rideIntensity === 'z2' ? 8.5 : rideIntensity === 'z3' ? 10.5 : 12.5;
    const rawFluidPerHour = weightKg * sweatRatePerKg;
    const fluidPerHour = Math.max(400, Math.min(1100, Math.round(rawFluidPerHour / 25) * 25));

    // Electrolyte Sodium: sweat sodium concentration (~600~900 mg/L) scaled with fluid loss:
    const sodiumConc = rideIntensity === 'z2' ? 650 : rideIntensity === 'z3' ? 750 : 850; // mg/L
    const sodiumPerHour = Math.round((fluidPerHour / 1000) * sodiumConc);

    const totalCarbsG = Math.round(carbsPerHour * rideDurationHours);
    const totalFluidMl = fluidPerHour * rideDurationHours;
    const totalFluidL = parseFloat((totalFluidMl / 1000).toFixed(1));
    const bottles550 = parseFloat((totalFluidMl / 550).toFixed(1));
    const bottles750 = parseFloat((totalFluidMl / 750).toFixed(1));
    const totalSodiumMg = Math.round(sodiumPerHour * rideDurationHours);
    const gelCount = Math.ceil(totalCarbsG / 25); // ~25g carbs per energy gel

    const requiresDualSource = carbsPerHour > 60;

    return {
      carbsPerHour,
      fluidPerHour,
      sodiumPerHour,
      totalCarbsG,
      totalFluidL,
      totalFluidMl,
      bottles550,
      bottles750,
      totalSodiumMg,
      gelCount,
      requiresDualSource
    };
  }, [rideDurationHours, rideIntensity, weightKg]);

  // 2. Karvonen Heart Rate Zones Calculation: Target HR = ((MaxHR − RestHR) × %Intensity) + RestHR
  const hrZonesResult = useMemo(() => {
    const hrr = Math.max(20, maxHr - restingHr); // Heart Rate Reserve
    const zones = [
      {
        zone: 'Z1 积极恢复',
        range: `${Math.round(restingHr + hrr * 0.50)} - ${Math.round(restingHr + hrr * 0.60)} bpm`,
        pct: '50% - 60% HRR',
        desc: '极低强度轻松骑行，促进血液循环与乳酸代谢，适合排酸日。'
      },
      {
        zone: 'Z2 基础有氧',
        range: `${Math.round(restingHr + hrr * 0.60)} - ${Math.round(restingHr + hrr * 0.70)} bpm`,
        pct: '60% - 70% HRR',
        desc: '线粒体与毛细血管生长核心区间，以脂肪氧化为主要能量供给，长距离骑行基石。'
      },
      {
        zone: 'Z3 节奏巡航',
        range: `${Math.round(restingHr + hrr * 0.70)} - ${Math.round(restingHr + hrr * 0.80)} bpm`,
        pct: '70% - 80% HRR',
        desc: '有氧与糖原氧化混合供能，接近马拉松/长距离爬坡配速。'
      },
      {
        zone: 'Z4 乳酸阈值',
        range: `${Math.round(restingHr + hrr * 0.80)} - ${Math.round(restingHr + hrr * 0.90)} bpm`,
        pct: '80% - 90% HRR',
        desc: '临界功率区间，乳酸产生与清除处于动态平衡，提升 FTP 的关键区间。'
      },
      {
        zone: 'Z5 无氧与最大摄氧',
        range: `${Math.round(restingHr + hrr * 0.90)} - ${maxHr} bpm`,
        pct: '90% - 100% HRR',
        desc: '高心率极限刺激，极度依赖无氧糖酵解，快速产生乳酸，用于短坡突围与冲刺。'
      }
    ];

    return { hrr, zones };
  }, [restingHr, maxHr]);

  // 3. Deurenberg Adult Body Fat Percentage (BFP) formula:
  // BFP = (1.20 × BMI) + (0.23 × Age) − (10.8 × gender_factor) − 5.4  (male=1, female=0)
  const bfpResult = useMemo(() => {
    const heightM = heightCm / 100;
    const bmiVal = weightKg / (heightM * heightM);
    const genderFactor = gender === 'male' ? 1 : 0;

    let bfpVal = 1.2 * bmiVal + 0.23 * age - 10.8 * genderFactor - 5.4;
    bfpVal = parseFloat(Math.max(3, Math.min(60, bfpVal)).toFixed(1));

    let level = '标准';
    let levelColor = 'text-emerald-500';

    if (gender === 'male') {
      if (bfpVal < 6) { level = '极端偏低，职业级'; levelColor = 'text-amber-500'; }
      else if (bfpVal <= 13) { level = '竞技运动员级别'; levelColor = 'text-blue-500'; }
      else if (bfpVal <= 17) { level = '优秀健康健美'; levelColor = 'text-emerald-500'; }
      else if (bfpVal <= 24) { level = '正常水平'; levelColor = 'text-slate-500'; }
      else { level = '体脂偏高'; levelColor = 'text-rose-500'; }
    } else {
      if (bfpVal < 14) { level = '极端偏低，职业级'; levelColor = 'text-amber-500'; }
      else if (bfpVal <= 20) { level = '竞技运动员级别'; levelColor = 'text-blue-500'; }
      else if (bfpVal <= 24) { level = '优秀健康健美'; levelColor = 'text-emerald-500'; }
      else if (bfpVal <= 31) { level = '正常水平'; levelColor = 'text-slate-500'; }
      else { level = '体脂偏高'; levelColor = 'text-rose-500'; }
    }

    return {
      bfp: bfpVal,
      level,
      levelColor
    };
  }, [weightKg, heightCm, age, gender]);

  // 4. Dual Metabolic Engine: Mifflin-St Jeor & Katch-McArdle LBM Formula
  const bmrResult = useMemo(() => {
    let bmr = 10 * weightKg + 6.25 * heightCm - 5 * age;
    bmr += gender === 'male' ? 5 : -161;
    bmr = Math.round(bmr);

    const leanBodyMassKg = parseFloat((weightKg * (1 - bfpResult.bfp / 100)).toFixed(1));
    const katchMcArdleBmr = Math.round(370 + 21.6 * leanBodyMassKg);
    const cunninghamBmr = Math.round(500 + 22 * leanBodyMassKg);

    const tdee = Math.round(bmr * activityFactor);
    const athleteTdee = Math.round(katchMcArdleBmr * activityFactor);
    const loseWeightCal = Math.round(tdee * 0.80);
    const maintainCal = tdee;
    const gainMuscleCal = Math.round(tdee * 1.15);

    return {
      bmr,
      leanBodyMassKg,
      katchMcArdleBmr,
      cunninghamBmr,
      tdee,
      athleteTdee,
      loseWeightCal,
      maintainCal,
      gainMuscleCal
    };
  }, [weightKg, heightCm, age, gender, activityFactor, bfpResult.bfp]);

  // 4. BMI Formula: weight(kg) / [height(m)]²
  const bmiResult = useMemo(() => {
    const heightM = heightCm / 100;
    const bmiVal = parseFloat((weightKg / (heightM * heightM)).toFixed(1));

    let category = '正常健康标准';
    let color = 'text-emerald-500';

    if (bmiVal < 18.5) {
      category = '偏瘦，爬坡体型';
      color = 'text-amber-500';
    } else if (bmiVal < 24.0) {
      category = '正常标准耐力体型';
      color = 'text-emerald-500';
    } else if (bmiVal < 28.0) {
      category = '偏高，力量型体格';
      color = 'text-sky-500';
    } else {
      category = '超重，建议减脂';
      color = 'text-rose-500';
    }

    const idealMin = parseFloat((18.5 * heightM * heightM).toFixed(1));
    const idealMax = parseFloat((23.9 * heightM * heightM).toFixed(1));

    return {
      bmi: bmiVal,
      category,
      color,
      idealMin,
      idealMax
    };
  }, [weightKg, heightCm]);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Unified Tool Header */}
      <IOSToolHeader
        category={language === 'zh-TW' ? '生理與代謝' : '生理与代谢'}
        categoryIcon={HeartPulse}
        title={language === 'zh-TW' ? '代謝與能耗' : '代谢与能耗'}
        description={
          language === 'zh-TW'
            ? '一站式計算騎行能量補給、Karvonen 靶心率區間、BMR 基礎代謝、TDEE 每日總能耗及體脂率。'
            : '一站式计算骑行能量补给、Karvonen 靶心率区间、BMR 基础代谢、TDEE 每日总能耗及体脂率。'
        }
        tint="red"
        actions={
          <div className="w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <IOSSegmentedControl
              options={[
                { id: 'fueling', label: language === 'zh-TW' ? '補給' : '补给', icon: Apple },
                { id: 'hr_zones', label: language === 'zh-TW' ? '心率' : '心率', icon: Heart },
                { id: 'bmr', label: language === 'zh-TW' ? '代謝' : '代谢', icon: Flame },
                { id: 'bmi', label: 'BMI', icon: Scale },
                { id: 'bfp', label: language === 'zh-TW' ? '體脂' : '体脂', icon: Percent },
              ]}
              value={activeTab}
              onChange={(val) => setActiveTab(val as any)}
              size="md"
            />
          </div>
        }
      />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Left Inputs */}
        <div className="lg:col-span-5 space-y-4 sm:space-y-5">
          <IOSCard variant="default" className="p-4 sm:p-5 space-y-4">
            <IOSCardHeader
              title={language === 'zh-TW' ? '身體與心率' : '身体与心率'}
              subtitle={language === 'zh-TW' ? '自動同步車手檔案' : '自动同步车手档案'}
              icon={User}
              iconColor="red"
            />

            {/* Gender & Age */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  {language === 'zh-TW' ? '生理性別' : '生理性别'}
                </label>
                <IOSSegmentedControl
                  options={[
                    { id: 'male', label: language === 'zh-TW' ? '男性' : '男性' },
                    { id: 'female', label: language === 'zh-TW' ? '女性' : '女性' },
                  ]}
                  value={gender}
                  onChange={(val) => setGender(val as any)}
                  size="sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
                  {language === 'zh-TW' ? '年齡' : '年龄'}
                </label>
                <NumberStepper value={age} onChange={setAge} min={10} max={100} unit={'岁'} />
              </div>
            </div>

            {/* Height & Weight */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {language === 'zh-TW' ? '身高' : '身高'} (cm)
                  </label>
                  {isImperial && (
                    <span className="text-[11px] text-ios-blue font-mono font-medium">
                      {Math.floor(heightCm / 30.48)}'{Math.round((heightCm % 30.48) / 2.54)}"
                    </span>
                  )}
                </div>
                <NumberStepper value={heightCm} onChange={setHeightCm} step={0.5} min={120} max={220} unit="cm" decimals={1} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
                  {language === 'zh-TW' ? '體重' : '体重'} ({isImperial ? 'lbs' : 'kg'})
                </label>
                <NumberStepper
                  value={isImperial ? parseFloat((weightKg * 2.20462).toFixed(1)) : weightKg}
                  onChange={(v) => setWeightKg(isImperial ? parseFloat((v / 2.20462).toFixed(1)) : v)}
                  step={isImperial ? 1 : 0.5}
                  min={isImperial ? 66 : 30}
                  max={isImperial ? 330 : 150}
                  unit={isImperial ? 'lbs' : 'kg'}
                  decimals={1}
                />
              </div>
            </div>

            {/* Heart Rate Inputs */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-black/[0.05] dark:border-white/[0.08]">
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
                  {language === 'zh-TW' ? '靜息心率' : '静息心率'} (bpm)
                </label>
                <NumberStepper value={restingHr} onChange={setRestingHr} min={35} max={100} unit="bpm" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
                  {language === 'zh-TW' ? '最大心率' : '最大心率'} (bpm)
                </label>
                <NumberStepper value={maxHr} onChange={setMaxHr} min={140} max={230} unit="bpm" />
              </div>
            </div>

            {/* Activity Level */}
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-2">
                {language === 'zh-TW' ? '每週運動活動強度' : '每周运动活动强度'}
              </label>
              <select
                value={activityFactor}
                onChange={(e) => setActivityFactor(parseFloat(e.target.value))}
                className="w-full h-9 bg-slate-100/80 dark:bg-white/5 border border-black/[0.05] dark:border-white/[0.08] rounded-xl px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-ios-blue"
              >
                <option value={1.2}>久坐不动 · 办公室或极少运动 × 1.2</option>
                <option value={1.375}>轻度活跃 · 每周轻度骑行 1-3 天 × 1.375</option>
                <option value={1.55}>中度活跃 · 每周中等强度骑行 3-5 天 × 1.55</option>
                <option value={1.725}>高强度训练 · 每周规律大强度训练 6-7 天 × 1.725</option>
                <option value={1.9}>专业运动员 · 每天高负荷双练 × 1.9</option>
              </select>
            </div>
          </IOSCard>
        </div>

        {/* Right Output Panels */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-5">
          {/* TAB 1: In-ride Fueling Plan View */}
          {activeTab === 'fueling' && (
            <div className="space-y-4 sm:space-y-5">
              {/* Ride Duration & Intensity Selectors */}
              <IOSCard variant="inset" className="p-4 sm:p-5 space-y-3.5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                  <Apple className="w-4 h-4 text-emerald-500" />
                  本次骑行规划与补给策略
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-slate-700 dark:text-slate-300">计划骑行时长</label>
                      <span className="text-ios-blue font-mono font-semibold text-xs tabular-nums">{rideDurationHours} 小时</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="12"
                      step="0.5"
                      value={rideDurationHours}
                      onChange={(e) => setRideDurationHours(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-ios-red"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-700 dark:text-slate-300 block mb-1">骑行强度区间</label>
                    <select
                      value={rideIntensity}
                      onChange={(e) => setRideIntensity(e.target.value as any)}
                      className="w-full h-9 bg-white dark:bg-[#2C2C2E] border border-black/[0.05] dark:border-white/[0.08] rounded-xl px-3 text-xs text-slate-900 dark:text-slate-200"
                    >
                      <option value="z2">Z2 基础耐力 · 脂肪氧化为主</option>
                      <option value="z3">Z3 节奏巡航 · 中高糖原消耗</option>
                      <option value="race">Z4+ 竞技突围 · 极高碳水代谢</option>
                    </select>
                  </div>
                </div>
              </IOSCard>

              {/* Fueling Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <IOSMetricTile
                  label="总碳水化合物需求"
                  value={fuelingResult.totalCarbsG}
                  unit="g"
                  subtext={`约合 ${fuelingResult.gelCount} 支能量胶`}
                  accentColor="blue"
                  icon={Apple}
                />

                <IOSMetricTile
                  label="全程总饮水需求"
                  value={fuelingResult.totalFluidL}
                  unit="L"
                  subtext={`≈ ${fuelingResult.bottles550} 壶 · 550ml`}
                  accentColor="green"
                  icon={Droplet}
                />

                <IOSMetricTile
                  label="电解质钠补充"
                  value={fuelingResult.totalSodiumMg}
                  unit="mg"
                  subtext="预防肌肉抽筋衰竭"
                  accentColor="orange"
                  icon={Flame}
                />
              </div>

              {/* Hourly Intake Rate & Sports Science Notice */}
              <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] space-y-2 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-slate-700 dark:text-slate-200 font-semibold gap-1">
                  <span className="flex items-center gap-1.5">
                    <Apple className="w-3.5 h-3.5 text-ios-blue" />
                    每小时补给执行指标 · 基于 {weightKg}kg 体重动态计算
                  </span>
                  <span className="font-mono text-ios-blue text-[11px] sm:text-xs">
                    ~{fuelingResult.carbsPerHour}g/h 碳水 · ~{fuelingResult.fluidPerHour}ml/h 水分 · ~{fuelingResult.sodiumPerHour}mg/h 钠
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed space-y-1">
                  {fuelingResult.requiresDualSource ? (
                    <p className="text-amber-600 dark:text-amber-400 flex items-start gap-1">
                      <Info className="w-3 h-3 shrink-0 mt-0.5" />
                      <span><strong>多源碳水提示：</strong>计划每小时碳水摄入 ≥60g，人体单一葡萄糖转运蛋白 SGLT1 趋于饱和，建议选用麦芽糊精:果糖约为 1:0.8 的双通道能量胶或冲剂，避免胃肠道不适。</span>
                    </p>
                  ) : (
                    <p className="flex items-start gap-1">
                      <Info className="w-3 h-3 shrink-0 mt-0.5 text-slate-400" />
                      <span><strong>营养学依据：</strong>基于 ISSN / Jeukendrup 运动营养指南，补水量与出汗率按体重基准动态修正，建议少量多次（每 15~20 分钟补水 150~200ml）。</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Karvonen Heart Rate Training Zones */}
          {activeTab === 'hr_zones' && (
            <IOSCard variant="default" className="p-4 sm:p-5 space-y-3.5">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-rose-500" />
                    Karvonen 靶心率储备区间 (HRR: <span className="tabular-nums font-mono">{hrZonesResult.hrr}</span> bpm)
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">结合静息心率与最大心率的科学心率区间推导</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-black/[0.05] dark:border-white/[0.08] text-slate-500 dark:text-slate-400">
                      <th className="pb-2 font-medium">心率区间</th>
                      <th className="pb-2 font-medium">心率储备比例</th>
                      <th className="pb-2 font-medium">目标心率范围 (BPM)</th>
                      <th className="pb-2 font-medium">主要生理刺激</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.08] font-mono text-slate-700 dark:text-slate-300">
                    {hrZonesResult.zones.map((z, idx) => (
                      <tr key={idx} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-colors">
                        <td className="py-2 font-sans font-semibold text-slate-900 dark:text-slate-200">{z.zone}</td>
                        <td className="text-slate-500 dark:text-slate-400 tabular-nums">{z.pct}</td>
                        <td className="text-rose-500 font-bold font-mono tabular-nums">{z.range}</td>
                        <td className="font-sans text-slate-600 dark:text-slate-400 text-[11px]">{z.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </IOSCard>
          )}

          {/* TAB 3: BMR & TDEE View */}
          {activeTab === 'bmr' && (
            <div className="space-y-4 sm:space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <IOSMetricTile
                  label={language === 'zh-TW' ? '基礎代謝 BMR' : '基础代谢 BMR'}
                  value={bmrResult.bmr}
                  unit="kcal/天"
                  subtext="维持机体存活最基本的能量消耗"
                  accentColor="blue"
                  icon={Flame}
                />

                <IOSMetricTile
                  label={language === 'zh-TW' ? '每日總能耗 TDEE' : '每日总能耗 TDEE'}
                  value={bmrResult.tdee}
                  unit="kcal/天"
                  subtext="包含日常骑行及所有活动能耗"
                  accentColor="green"
                  icon={Activity}
                />
              </div>

              {/* Goals Targets */}
              <IOSCard variant="default" className="p-4 sm:p-5 space-y-3.5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  不同目标每日推荐热量摄入
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] space-y-1">
                    <div className="text-xs font-medium text-sky-500 dark:text-sky-400 flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5" />
                      <span>{language === 'zh-TW' ? '減脂減重目標' : '减脂减重目标'}</span>
                    </div>
                    <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums">{bmrResult.loseWeightCal} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">kcal</span></div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">热量缺口 20%，稳步减脂保持肌肉</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] space-y-1">
                    <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5" />
                      <span>{language === 'zh-TW' ? '體重維持平衡' : '体重维持平衡'}</span>
                    </div>
                    <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums">{bmrResult.maintainCal} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">kcal</span></div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">收支平衡，维持当前竞技体重</p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] space-y-1">
                    <div className="text-xs font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>{language === 'zh-TW' ? '增肌增力目標' : '增肌增力目标'}</span>
                    </div>
                    <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums">{bmrResult.gainMuscleCal} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">kcal</span></div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">轻微盈余 15%，配合力量训练</p>
                  </div>
                </div>
              </IOSCard>

              {/* Athlete LBM & Mechanical Work Coupling Card */}
              <IOSCard variant="default" className="p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-ios-purple" />
                    {language === 'zh-TW' ? '運動員去脂瘦體重代謝方程（Katch-McArdle）' : '运动员去脂瘦体重代谢方程（Katch-McArdle）'}
                  </h3>
                  <span className="text-[11px] font-mono text-ios-purple font-semibold">
                    去脂瘦体重: {bmrResult.leanBodyMassKg} kg
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-ios-purple/10 border border-ios-purple/20 space-y-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Katch-McArdle 竞技基础代谢</span>
                    <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                      {bmrResult.katchMcArdleBmr} <span className="text-xs font-normal text-slate-500">kcal/天</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      消除常规人群体脂干扰，基于纯肌肉骨骼代谢消耗精算
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-ios-blue/10 border border-ios-blue/20 space-y-1">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Cunningham 耐力选手 BMR</span>
                    <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                      {bmrResult.cunninghamBmr} <span className="text-xs font-normal text-slate-500">kcal/天</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      适配高有氧训练容积，线粒体密度高激活水平
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  💡 <b>骑行机械做功与人体代谢能耗换算定理</b>：人类踩踏毛效率（Gross Mechanical Efficiency）约为 21.5% ~ 22%。在码表上完成 <b>1 kJ</b> 机械做功，机体实际消耗热量约为 <b>1.11 kcal</b>（1 kJ / 4.184 / 0.215 ≈ 1.11 kcal）。因此骑行做功与卡路里消耗近乎 1:1.1 严格正比！
                </div>
              </IOSCard>
            </div>
          )}

          {/* TAB 4: BMI View */}
          {activeTab === 'bmi' && (
            <IOSCard variant="default" className="p-4 sm:p-5 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">{language === 'zh-TW' ? '身體質量指數 (BMI, kg/m²)' : '身体质量指数 (BMI, kg/m²)'}</span>
                  <div className="text-3xl sm:text-4xl font-bold font-mono text-ios-blue mt-1 tabular-nums">
                    {bmiResult.bmi}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">体型评估结论</span>
                  <div className={`text-lg sm:text-xl font-bold ${bmiResult.color} mt-1`}>
                    {bmiResult.category}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] space-y-2">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">同身高健康理想体重参考区间:</span>
                  <div className="text-base sm:text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {bmiResult.idealMin} kg - {bmiResult.idealMax} kg
                  </div>
                </div>
                <div className="pt-2 border-t border-black/[0.05] dark:border-white/[0.08] text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-1">
                  <Info className="w-3.5 h-3.5 text-ios-blue shrink-0 mt-0.5" />
                  <span><strong>骑行专项体型说明：</strong>冲刺手与计时赛车手肌肉量充沛，BMI 常在 24~27 之间属于健康竞技体型；纯爬坡手则多在 19~21。BMI 无法区分骨骼肌与脂肪，建议切换「体脂」页签交叉验证。</span>
                </div>
              </div>
            </IOSCard>
          )}

          {/* TAB 5: BFP View */}
          {activeTab === 'bfp' && (
            <IOSCard variant="default" className="p-4 sm:p-5 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">估算体脂率 BFP</span>
                  <div className="text-3xl sm:text-4xl font-bold font-mono text-ios-blue mt-1 tabular-nums">
                    {bfpResult.bfp} <span className="text-xl text-slate-500 dark:text-slate-400 font-normal">%</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">体脂等级划分</span>
                  <div className={`text-lg sm:text-xl font-bold ${bfpResult.levelColor} mt-1`}>
                    {bfpResult.level}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed flex items-start gap-1">
                <Info className="w-3.5 h-3.5 text-ios-blue shrink-0 mt-0.5" />
                <span><strong>算法说明：</strong>采用成人 Deurenberg 经验回归公式。若为常年系统训练、大腿肌群高度发达的高水平骑行者，估算值可能偏高 2%~4%，建议以皮褶厚度夹或 DEXA 扫描为准。</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-black/[0.05] dark:border-white/[0.08] text-slate-500 dark:text-slate-400">
                      <th className="pb-2 font-medium">体脂分类</th>
                      <th className="pb-2 font-medium">男性范围</th>
                      <th className="pb-2 font-medium">女性范围</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.08] font-mono text-slate-700 dark:text-slate-300">
                    <tr><td className="py-2 font-sans">必需脂肪 · 极低</td><td className="tabular-nums">2% - 5%</td><td className="tabular-nums">10% - 13%</td></tr>
                    <tr><td className="py-2 font-sans text-ios-blue font-semibold">竞技运动员</td><td className="tabular-nums">6% - 13%</td><td className="tabular-nums">14% - 20%</td></tr>
                    <tr><td className="py-2 font-sans text-emerald-600 dark:text-emerald-400 font-semibold">健身良好</td><td className="tabular-nums">14% - 17%</td><td className="tabular-nums">21% - 24%</td></tr>
                    <tr><td className="py-2 font-sans">可接受区间</td><td className="tabular-nums">18% - 24%</td><td className="tabular-nums">25% - 31%</td></tr>
                    <tr><td className="py-2 font-sans text-rose-500 dark:text-rose-400 font-semibold">肥胖</td><td className="tabular-nums">&gt; 25%</td><td className="tabular-nums">&gt; 32%</td></tr>
                  </tbody>
                </table>
              </div>
            </IOSCard>
          )}
        </div>
      </div>
    </div>
  );
};
