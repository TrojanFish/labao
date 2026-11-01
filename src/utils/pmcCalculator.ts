/**
 * PMC (Performance Management Chart) Calculator
 * Implements the Coggan / Bannister Impulse-Response Model
 * - CTL (Chronic Training Load / Fitness): 42-day time constant
 * - ATL (Acute Training Load / Fatigue): 7-day time constant
 * - TSB (Training Stress Balance / Form): CTL - ATL
 */

export interface PmcDayData {
  day: number;
  date: string;
  tss: number;
  ctl: number;
  atl: number;
  tsb: number;
  phase: string;
  notes?: string;
}

export type PmcMesocycleType = 'base' | 'build' | 'taper' | 'grand_tour';

export interface TsbZoneInfo {
  zone: 'overload' | 'productive' | 'neutral' | 'peak' | 'detraining';
  label: string;
  labelTw: string;
  labelEn?: string;
  color: string;
  advice: string;
  adviceTw: string;
  adviceEn?: string;
}

export const getTsbZoneInfo = (tsb: number): TsbZoneInfo => {
  if (tsb < -30) {
    return {
      zone: 'overload',
      label: '深度透支 / 疲劳超载',
      labelTw: '深度透支 / 疲勞超載',
      labelEn: 'Extreme Overload / Fatigue',
      color: '#ef4444', // red
      advice: '机体处于极度疲劳与免疫抑制期，极易诱发伤病或生病。强烈建议安排 2-3 天主动恢复骑（Z1 功率 < 55% FTP）或彻底休骑。',
      adviceTw: '機體處於極度疲勞與免疫抑制期，極易誘發傷病或生病。強烈建議安排 2-3 天主動恢復騎（Z1 功率 < 55% FTP）或徹底休騎。',
      adviceEn: 'High risk of illness and overtraining. Active recovery rides or complete rest strongly advised.'
    };
  }
  if (tsb >= -30 && tsb < -10) {
    return {
      zone: 'productive',
      label: '高收益强化训练期',
      labelTw: '高收益強化訓練期',
      labelEn: 'Productive Training Stimulus',
      color: '#00AFFF', // blue
      advice: '处于最佳超量恢复刺激区间。机体正建立深层有氧与无氧耐力适应，保证每晚 8 小时深度睡眠和高碳水补给。',
      adviceTw: '處於最佳超量恢復刺激區間。機體正建立深層有氧與無氧耐力適應，保證每晚 8 小時深度睡眠和高碳水補給。',
      adviceEn: 'Optimal zone for building deep aerobic and anaerobic adaptations. Ensure adequate sleep and carb fueling.'
    };
  }
  if (tsb >= -10 && tsb <= 5) {
    return {
      zone: 'neutral',
      label: '负荷过渡与维持期',
      labelTw: '負荷過渡與維持期',
      labelEn: 'Maintenance / Transition',
      color: '#10b981', // green
      advice: '体能与疲劳基本持平，适合常规周末俱乐部团骑或日常训练维持。',
      adviceTw: '體能與疲勞基本持平，適合常規週末俱樂部團騎或日常訓練維持。',
      adviceEn: 'Fitness and fatigue in equilibrium. Suitable for club group rides or steady aerobic maintenance.'
    };
  }
  if (tsb > 5 && tsb <= 25) {
    return {
      zone: 'peak',
      label: '黄金巅峰竞技状态',
      labelTw: '黃金巔峰競技狀態',
      labelEn: 'Peak Racing Form',
      color: '#f59e0b', // amber
      advice: '绝佳比赛状态！疲劳已大部分消退，肌肉储备完全充能，踏频与心率反应敏锐，正是冲击 A 级目标赛事最佳成绩的黄金窗口！',
      adviceTw: '絕佳比賽狀態！疲勞已大部分消退，肌肉儲備完全充能，踏頻與心率反應敏銳，正是衝擊 A 級目標賽事最佳成績的黃金窗口！',
      adviceEn: 'Peak racing sharpness! Fatigue has cleared and energy reserves are fully restored. Ideal for A-priority target races.'
    };
  }
  return {
    zone: 'detraining',
    label: '过度减量 / 体能衰退',
    labelTw: '過度減量 / 體能衰退',
    labelEn: 'Detraining / Prolonged Rest',
    color: '#94a3b8', // slate
    advice: '休息或减量时间过长，疲劳虽为 0 但有氧血浆容量和线粒体活性开始滑坡。建议尽快重启节奏骑行或甜区刺激以保住 CTL。',
    adviceTw: '休息或減量時間過長，疲勞雖為 0 但有氧血漿容量和線粒體活性開始滑坡。建議盡快重啟節奏騎行或甜區刺激以保住 CTL。',
    adviceEn: 'Taper prolonged too long; aerobic adaptations declining. Resume tempo or sweet spot rides to protect CTL.'
  };
};

export type BaselineFitnessLevel = 'rec' | 'club' | 'elite' | 'pro';

export interface ManualTssEntry {
  id: string;
  dayOffset: number; // 0 for today, -1 for yesterday
  tss: number;
  title: string;
}

export const BASELINE_FITNESS_OPTIONS: Record<BaselineFitnessLevel, { ctl: number; atl: number; label: string; desc: string }> = {
  rec: { ctl: 35, atl: 30, label: '业余骑游', desc: '周骑 3-5h' },
  club: { ctl: 65, atl: 60, label: '进阶俱乐部', desc: '周骑 6-10h' },
  elite: { ctl: 90, atl: 85, label: '业余精英', desc: '周骑 12-16h' },
  pro: { ctl: 115, atl: 110, label: '职业世巡', desc: '周骑 18h+' }
};

/**
 * Generate a realistic timeline of daily TSS based on mesocycle type & baseline fitness
 */
export const generatePmcSeries = (
  mesocycle: PmcMesocycleType,
  injectedTodayTss?: number,
  baselineLevel: BaselineFitnessLevel = 'club',
  manualEntries?: ManualTssEntry[],
  stravaActivities?: Array<{ start_date: string; start_date_local?: string; tss?: number; name: string }>
): PmcDayData[] => {
  let daysCount = 60;
  let initialCtl = BASELINE_FITNESS_OPTIONS[baselineLevel]?.ctl ?? 65;
  let initialAtl = BASELINE_FITNESS_OPTIONS[baselineLevel]?.atl ?? 60;

  if (mesocycle === 'base') {
    daysCount = 60;
  } else if (mesocycle === 'build') {
    daysCount = 45;
  } else if (mesocycle === 'taper') {
    daysCount = 28;
  } else if (mesocycle === 'grand_tour') {
    daysCount = 24;
  }

  // If Strava activities are present and cover more days, adjust daysCount adaptively (up to 365 days)
  const now = new Date();
  if (stravaActivities && stravaActivities.length > 0) {
    let minTime = now.getTime();
    for (const a of stravaActivities) {
      const t = new Date(a.start_date_local || a.start_date).getTime();
      if (!isNaN(t) && t < minTime) minTime = t;
    }
    const daysDiff = Math.ceil((now.getTime() - minTime) / (1000 * 60 * 60 * 24)) + 1;
    daysCount = Math.max(daysCount, Math.min(365, daysDiff));
  }

  // Pre-index Strava activities into an O(1) day map to prevent O(daysCount * N) search bottleneck
  const actByDateMap = new Map<string, { tss: number; names: string[] }>();
  if (stravaActivities && stravaActivities.length > 0) {
    for (const a of stravaActivities) {
      const aDate = new Date(a.start_date_local || a.start_date);
      if (isNaN(aDate.getTime())) continue;
      const key = `${aDate.getFullYear()}-${aDate.getMonth()}-${aDate.getDate()}`;
      const cur = actByDateMap.get(key) || { tss: 0, names: [] };
      cur.tss += a.tss || 0;
      if (a.name) cur.names.push(a.name);
      actByDateMap.set(key, cur);
    }
  }

  const series: PmcDayData[] = [];
  let curCtl = initialCtl;
  let curAtl = initialAtl;

  const TC_CTL = 42;
  const TC_ATL = 7;

  for (let d = 1; d <= daysCount; d++) {
    let dayTss = 0;
    let phaseName = '日常训练';

    const dayTarget = new Date(now);
    dayTarget.setDate(now.getDate() - (daysCount - d));
    const dateStr = `${dayTarget.getMonth() + 1}/${dayTarget.getDate()}`;
    const dayYear = dayTarget.getFullYear();
    const dayMonth = dayTarget.getMonth();
    const dayDate = dayTarget.getDate();
    const dayOfWeek = dayTarget.getDay();

    if (mesocycle === 'base') {
      // 3 weeks build, 1 week recovery cycle
      const cycleWeek = Math.floor((d - 1) / 7) % 4;
      if (cycleWeek === 3) {
        // Recovery week
        phaseName = '基础期·恢复周';
        dayTss = dayOfWeek === 1 || dayOfWeek === 5 ? 0 : dayOfWeek === 0 || dayOfWeek === 6 ? 50 : 35;
      } else {
        phaseName = '基础期·有氧积累';
        if (dayOfWeek === 1) dayTss = 0; // Monday rest
        else if (dayOfWeek === 2) dayTss = 65; // Tempo
        else if (dayOfWeek === 3) dayTss = 80; // Sweet Spot
        else if (dayOfWeek === 4) dayTss = 50; // Recovery ride
        else if (dayOfWeek === 5) dayTss = 0; // Pre-weekend rest
        else if (dayOfWeek === 6) dayTss = 130; // Long Endurance Saturday
        else dayTss = 100; // Sunday group ride
      }
    } else if (mesocycle === 'build') {
      phaseName = '强化期·高负荷突破';
      if (dayOfWeek === 1) dayTss = 0;
      else if (dayOfWeek === 2) dayTss = 90; // VO2Max intervals
      else if (dayOfWeek === 3) dayTss = 110; // Threshold
      else if (dayOfWeek === 4) dayTss = 40; // Easy spin
      else if (dayOfWeek === 5) dayTss = 70; // Openers
      else if (dayOfWeek === 6) dayTss = 160; // Race simulation
      else dayTss = 120; // Hard group ride
    } else if (mesocycle === 'taper') {
      if (d <= 7) {
        phaseName = '超量突破冲顶';
        dayTss = dayOfWeek === 1 ? 0 : 120;
      } else if (d <= 21) {
        phaseName = '减量备战';
        // Cut volume by 50% while maintaining sharpness
        dayTss = dayOfWeek === 1 || dayOfWeek === 4 ? 0 : dayOfWeek === 6 ? 55 : 35;
      } else {
        phaseName = '比赛日巅峰窗口';
        dayTss = d === 24 ? 220 : 25; // Race day!
      }
    } else if (mesocycle === 'grand_tour') {
      if (d === 1) {
        phaseName = '赛前定妆发车';
        dayTss = 60;
      } else if (d === 9 || d === 16) {
        phaseName = '大环赛休战日';
        dayTss = 25;
      } else {
        phaseName = '大环赛赛段';
        // Brutal Grand Tour stages: 180 - 320 TSS
        const isMountain = d % 3 === 0;
        dayTss = isMountain ? 280 : 190;
      }
    }

    // If Strava activities are present, match activities for this specific day via O(1) day map
    if (stravaActivities && stravaActivities.length > 0) {
      const dayKey = `${dayYear}-${dayMonth}-${dayDate}`;
      const matched = actByDateMap.get(dayKey);
      if (matched && matched.tss > 0) {
        dayTss = Math.round(matched.tss);
        phaseName = matched.names.join(' / ');
      } else {
        // Rest day if no activity recorded on this day
        dayTss = 0;
        phaseName = '休息/未记录';
      }
    }

    // Manual TSS entries override for specific day offsets (0 = today, -1 = yesterday, etc.)
    if (manualEntries && manualEntries.length > 0) {
      const match = manualEntries.find(e => d === (daysCount + e.dayOffset));
      if (match) {
        dayTss = match.tss;
        phaseName = match.title || '手动记录训练';
      }
    }

    // Inject today's activity TSS if on final day
    if (d === daysCount && injectedTodayTss !== undefined && injectedTodayTss > 0) {
      dayTss = Math.round(injectedTodayTss);
      phaseName = 'FIT活动解析写入';
    }

    // Exponential moving averages (standard impulse-response formula)
    curCtl = curCtl + (dayTss - curCtl) / TC_CTL;
    curAtl = curAtl + (dayTss - curAtl) / TC_ATL;
    const curTsb = curCtl - curAtl;

    series.push({
      day: d,
      date: dateStr,
      tss: dayTss,
      ctl: Math.round(curCtl * 10) / 10,
      atl: Math.round(curAtl * 10) / 10,
      tsb: Math.round(curTsb * 10) / 10,
      phase: phaseName
    });
  }

  return series;
};

/**
 * Predict days of taper needed to reach target TSB (e.g. +15)
 */
export const predictTaperDays = (
  currentCtl: number,
  currentAtl: number,
  targetTsb: number = 15,
  dailyTaperTss: number = 25
): { daysNeeded: number; predictedCtl: number; predictedAtl: number } => {
  let simCtl = currentCtl;
  let simAtl = currentAtl;
  let days = 0;

  while (days < 35) {
    const tsb = simCtl - simAtl;
    if (tsb >= targetTsb) {
      break;
    }
    days++;
    simCtl = simCtl + (dailyTaperTss - simCtl) / 42;
    simAtl = simAtl + (dailyTaperTss - simAtl) / 7;
  }

  return {
    daysNeeded: days,
    predictedCtl: Math.round(simCtl * 10) / 10,
    predictedAtl: Math.round(simAtl * 10) / 10
  };
};

export type PmcTimeRange = '30d' | '90d' | '180d' | 'ytd' | 'all';

export interface ContinuousPmcInputActivity {
  id?: string;
  startDate: string; // ISO
  startTime?: number;
  tss: number;
  name: string;
  distanceKm?: number;
}

export interface SeasonPmcSummary {
  currentCtl: number;
  currentAtl: number;
  currentTsb: number;
  acwr: number; // ATL / CTL (Acute:Chronic Workload Ratio)
  rampRate7d: number; // CTL change in the last 7 days
  totalSeasonKm: number;
  totalSeasonTss: number;
  weeklyAvgTss: number;
  activeDaysCount: number;
  readinessZone: TsbZoneInfo;
  acwrStatus: {
    status: 'optimal' | 'moderate' | 'high_risk' | 'low';
    label: string;
    advice: string;
  };
}

export interface ContinuousPmcResult {
  series: PmcDayData[];
  summary: SeasonPmcSummary;
  todayIndex: number;
}

/**
 * Calculate continuous real season PMC based on actual activities stored in Local-First IndexedDB
 */
export const calculateContinuousSeasonPmc = (
  activities: ContinuousPmcInputActivity[],
  timeRange: PmcTimeRange = '90d',
  baselineLevel: BaselineFitnessLevel = 'club',
  futureProjectionDays: number = 0,
  dailyTaperTss: number = 25
): ContinuousPmcResult => {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const ONE_DAY_MS = 86400 * 1000;

  // 1. Determine date range
  let startTimestamp = todayMidnight - 90 * ONE_DAY_MS;

  if (timeRange === '30d') {
    startTimestamp = todayMidnight - 30 * ONE_DAY_MS;
  } else if (timeRange === '90d') {
    startTimestamp = todayMidnight - 90 * ONE_DAY_MS;
  } else if (timeRange === '180d') {
    startTimestamp = todayMidnight - 180 * ONE_DAY_MS;
  } else if (timeRange === 'ytd') {
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
    startTimestamp = Math.min(startOfYear, todayMidnight - 60 * ONE_DAY_MS);
  } else if (timeRange === 'all') {
    if (activities.length > 0) {
      const earliestActTime = Math.min(
        ...activities.map(a => (a.startTime ? a.startTime : new Date(a.startDate).getTime()))
      );
      startTimestamp = Math.min(earliestActTime, todayMidnight - 90 * ONE_DAY_MS);
    } else {
      startTimestamp = todayMidnight - 90 * ONE_DAY_MS;
    }
  }

  // 2. Warm-up 42 days prior to startTimestamp so initial CTL/ATL are stabilized
  const warmUpStart = startTimestamp - 42 * ONE_DAY_MS;
  const endTimestamp = todayMidnight + futureProjectionDays * ONE_DAY_MS;

  // Build day map: 'YYYY-MM-DD' -> { tss, names, distance }
  const dailyActivityMap = new Map<string, { tss: number; names: string[]; distance: number }>();

  activities.forEach(act => {
    const actDate = new Date(act.startTime || act.startDate);
    const key = `${actDate.getFullYear()}-${String(actDate.getMonth() + 1).padStart(2, '0')}-${String(actDate.getDate()).padStart(2, '0')}`;
    const cur = dailyActivityMap.get(key) || { tss: 0, names: [], distance: 0 };
    cur.tss += act.tss || 0;
    if (act.name) cur.names.push(act.name);
    cur.distance += act.distanceKm || 0;
    dailyActivityMap.set(key, cur);
  });

  const TC_CTL = 42;
  const TC_ATL = 7;

  let curCtl = BASELINE_FITNESS_OPTIONS[baselineLevel]?.ctl ?? 65;
  let curAtl = BASELINE_FITNESS_OPTIONS[baselineLevel]?.atl ?? 60;

  // Walk from warmUpStart to endTimestamp
  const allPoints: Array<{
    timestamp: number;
    dateStr: string;
    tss: number;
    ctl: number;
    atl: number;
    tsb: number;
    phase: string;
    isFuture: boolean;
    distance: number;
  }> = [];

  let cursor = warmUpStart;
  let dayCounter = 1;

  while (cursor <= endTimestamp) {
    const dObj = new Date(cursor);
    const key = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;
    const isFuture = cursor > todayMidnight;

    let dayTss = 0;
    let phase = '休息/低负荷';
    let distance = 0;

    if (isFuture) {
      dayTss = dailyTaperTss;
      phase = '未来预测 · 赛前减量';
    } else {
      const match = dailyActivityMap.get(key);
      if (match && match.tss > 0) {
        dayTss = Math.round(match.tss);
        phase = match.names.join(' / ');
        distance = match.distance;
      }
    }

    curCtl = curCtl + (dayTss - curCtl) / TC_CTL;
    curAtl = curAtl + (dayTss - curAtl) / TC_ATL;
    const curTsb = curCtl - curAtl;

    // Only record into allPoints if cursor >= startTimestamp
    if (cursor >= startTimestamp) {
      allPoints.push({
        timestamp: cursor,
        dateStr: `${dObj.getMonth() + 1}/${dObj.getDate()}`,
        tss: dayTss,
        ctl: Math.round(curCtl * 10) / 10,
        atl: Math.round(curAtl * 10) / 10,
        tsb: Math.round(curTsb * 10) / 10,
        phase,
        isFuture,
        distance
      });
    }

    cursor += ONE_DAY_MS;
    dayCounter++;
  }

  // Find index corresponding to today
  let todayIdx = allPoints.findIndex(p => Math.abs(p.timestamp - todayMidnight) < ONE_DAY_MS / 2);
  if (todayIdx === -1) {
    todayIdx = allPoints.length - 1 - futureProjectionDays;
    if (todayIdx < 0) todayIdx = allPoints.length - 1;
  }

  const todayPoint = allPoints[todayIdx] || allPoints[allPoints.length - 1];
  const ctlToday = todayPoint ? todayPoint.ctl : 60;
  const atlToday = todayPoint ? todayPoint.atl : 50;
  const tsbToday = todayPoint ? todayPoint.tsb : 10;

  // ACWR (Acute:Chronic Workload Ratio)
  const acwr = ctlToday > 0 ? parseFloat((atlToday / ctlToday).toFixed(2)) : 1.0;

  let acwrStatus: SeasonPmcSummary['acwrStatus'] = {
    status: 'optimal',
    label: '黄金负荷收益区',
    advice: '急性疲劳与慢性体能比例健康处于 0.8~1.3，体能稳步超量恢复，伤病风险处于最低区间。'
  };

  if (acwr < 0.8) {
    acwrStatus = {
      status: 'low',
      label: '训练负荷偏低',
      advice: '近期负荷显著低于基准均线，体能可能逐步回落。如非重大赛后调整，建议适当提高甜区或节奏课表频次。'
    };
  } else if (acwr >= 1.3 && acwr <= 1.5) {
    acwrStatus = {
      status: 'moderate',
      label: '负荷快速增量',
      advice: '近期训练量快速攀升至 1.3~1.5，机体进入高刺激适应期。建议加强深层拉伸、电解质补充与睡眠监测。'
    };
  } else if (acwr > 1.5) {
    acwrStatus = {
      status: 'high_risk',
      label: '急性过载高危',
      advice: 'ACWR > 1.5 属于伤病与过度疲劳高危红线！强烈建议立即插入 1-2 天主动休骑或排酸骑，严防免疫力崩解。'
    };
  }

  // 7-day Ramp Rate
  const idx7dAgo = Math.max(0, todayIdx - 7);
  const point7dAgo = allPoints[idx7dAgo];
  const rampRate7d = point7dAgo ? Math.round((ctlToday - point7dAgo.ctl) * 10) / 10 : 0;

  // Window totals
  const nonFuturePoints = allPoints.filter(p => !p.isFuture);
  const totalSeasonTss = nonFuturePoints.reduce((acc, p) => acc + p.tss, 0);
  const totalSeasonKm = Math.round(nonFuturePoints.reduce((acc, p) => acc + p.distance, 0));
  const activeDaysCount = nonFuturePoints.filter(p => p.tss > 0).length;
  const totalWeeks = Math.max(1, Math.round(nonFuturePoints.length / 7));
  const weeklyAvgTss = Math.round(totalSeasonTss / totalWeeks);

  const series: PmcDayData[] = allPoints.map((p, idx) => ({
    day: idx + 1,
    date: p.dateStr,
    tss: p.tss,
    ctl: p.ctl,
    atl: p.atl,
    tsb: p.tsb,
    phase: p.phase
  }));

  const summary: SeasonPmcSummary = {
    currentCtl: ctlToday,
    currentAtl: atlToday,
    currentTsb: tsbToday,
    acwr,
    rampRate7d,
    totalSeasonKm,
    totalSeasonTss,
    weeklyAvgTss,
    activeDaysCount,
    readinessZone: getTsbZoneInfo(tsbToday),
    acwrStatus
  };

  return {
    series,
    summary,
    todayIndex: todayIdx
  };
};
