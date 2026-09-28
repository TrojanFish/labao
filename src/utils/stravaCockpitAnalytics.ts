/**
 * Rouleur Strava Cockpit Analytics Engine
 * Comprehensive sports science, habit tracking, and fleet analytics engine.
 * Combines Dreeve (Eddington, heatmaps, trophies) + Intervals.icu (PMC, eFTP, ACWR ramp rate)
 */

import { StravaActivityRecord } from './indexedDb';
import { StravaBike, StravaSegmentItem } from '../services/stravaService';

export type TimePeriod = 'all-time' | 'ytd' | '30d' | '7d';
export type AthleteStatus = 'peak' | 'productive' | 'overstress' | 'overreach';

export interface KpiMetrics {
  totalDistanceKm: number;
  totalElevationM: number;
  totalMovingTimeMin: number;
  totalCaloriesKcal: number;
  totalRides: number;
  avgNpWatts: number;
  avgSpeedKmh: number;
  avgHeartRate: number;
  // Fun equivalents
  everestRatio: number; // e.g. 4.3x Everest
  bananasBurned: number; // 90 kcal per banana
  pizzasBurned: number; // 280 kcal per slice
  earthCircumferencePct: number; // 40075 km
}

export interface PmcPoint {
  date: string;
  shortDate: string;
  tss: number;
  ctl: number; // Fitness (42-day EWMA)
  atl: number; // Fatigue (7-day EWMA)
  tsb: number; // Form (CTL - ATL)
  isProjection?: boolean;
}

export interface StatusDiagnosis {
  status: AthleteStatus;
  label: string;
  colorToken: string;
  badgeBg: string;
  badgeText: string;
  advice: string;
  weeklyRampRate: number;
  rampRateWarning?: string;
}

export interface EddingtonResult {
  E: number;
  nextE: number;
  ridesNeededForNextE: number;
  qualifyingRidesForNext: number;
  histogramData: {
    distanceKm: number;
    cumulativeCount: number;
    isAboveThreshold: boolean;
  }[];
  allTimeE: number;
  yearlyE: number;
}

export type IntensityLevel = 0 | 1 | 2 | 3 | 4;

export interface DayCell {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0-6 (0=Sun, 1=Mon)
  distanceKm: number;
  elevationM: number;
  hasRide: boolean;
  level: IntensityLevel;
  rides: number;
}

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  thisMonthActiveDays: number;
  thisMonthTotalDays: number;
  totalActiveDays: number;
}

export interface ActivityRingData {
  distance: { current: number; target: number; pct: number };
  elevation: { current: number; target: number; pct: number };
  tss: { current: number; target: number; pct: number };
}

export interface BioclockStats {
  byTimeSlot: {
    id: string;
    label: string;
    rides: number;
    distanceKm: number;
    pct: number;
  }[];
  byDayOfWeek: {
    day: number;
    label: string;
    rides: number;
    distanceKm: number;
  }[];
  riderPattern: string;
}

export interface EftpEstimate {
  eFTP: number;
  eFTPWkg: number;
  wPrimeKj: number;
  pMax: number;
  p5s: number;
  p1m: number;
  p5m: number;
  p20m: number;
}

export interface ComponentHealth {
  name: string;
  componentKey: 'chain' | 'tire' | 'brake';
  currentKm: number;
  warnKm: number;
  criticalKm: number;
  status: 'ok' | 'warn' | 'critical';
  remainingPct: number;
}

export interface BikeFleetItem {
  id: string;
  name: string;
  type: 'road' | 'gravel' | 'mtb' | 'indoor' | 'unknown';
  totalDistanceKm: number;
  totalRides: number;
  lastRideDate: string;
  distancePct: number;
  components: ComponentHealth[];
}

export interface MilestoneItem {
  id: string;
  title: string;
  subtitle: string;
  achieved: boolean;
  count?: number;
  currentValue?: number | string;
  targetValue?: number | string;
  progressPct?: number;
  achievedDate?: string;
}

export interface WeeklyVolumePoint {
  weekKey: string;
  label: string;
  startDate: string;
  endDate: string;
  tss: number;
  distanceKm: number;
  elevationM: number;
  movingTimeMin: number;
  rides: number;
  isPeakTss?: boolean;
  isPeakDistance?: boolean;
}

export interface WeeklyVolumeResult {
  weeks: WeeklyVolumePoint[];
  peakTssWeek: WeeklyVolumePoint | null;
  peakDistanceWeek: WeeklyVolumePoint | null;
  avgWeeklyTss: number;
  avgWeeklyDistanceKm: number;
  totalVolumeTss: number;
  totalVolumeDistanceKm: number;
}

export interface AnnualGoalProgress {
  year: number;
  targetKm: number;
  currentKm: number;
  progressPct: number;
  remainingKm: number;
  daysPassed: number;
  daysRemaining: number;
  totalDaysInYear: number;
  expectedPaceKm: number;
  paceDeltaKm: number;
  isAheadOfPace: boolean;
  monthlyRateKm: number;
  requiredDailyKm: number;
  projectedYearEndKm: number;
  projectedCompletionDate: string | null;
  monthlyBreakdown: {
    month: number;
    label: string;
    actualKm: number;
    targetPaceKm: number;
  }[];
}

export interface AnnualElevationGoalProgress {
  year: number;
  targetElevationM: number;
  currentElevationM: number;
  progressPct: number;
  remainingElevationM: number;
  daysPassed: number;
  daysRemaining: number;
  totalDaysInYear: number;
  expectedPaceElevationM: number;
  paceDeltaElevationM: number;
  isAheadOfPace: boolean;
  monthlyRateElevationM: number;
  requiredDailyElevationM: number;
  projectedYearEndElevationM: number;
  projectedCompletionDate: string | null;
  everestingCount: number;
  monthlyBreakdown: {
    month: number;
    label: string;
    actualElevationM: number;
    targetPaceElevationM: number;
  }[];
}

export interface OptimalRaceWindow {
  peakDate: string | null;
  peakShortDate: string | null;
  peakTsb: number;
  daysUntilPeak: number;
  inOptimalFormToday: boolean;
  optimalDateRange: string | null;
}

export interface PowerZoneItem {
  zone: 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5' | 'Z6' | 'Z7';
  name: string;
  rangeWatts: string;
  seconds: number;
  hours: number;
  pct: number;
  colorHex: string;
  badgeBg: string;
  badgeText: string;
}

export interface PowerZoneDistributionResult {
  zones: PowerZoneItem[];
  totalMovingSec: number;
  pattern: 'pyramidal' | 'polarized' | 'threshold' | 'unstructured';
  patternLabel: string;
  patternDescription: string;
}

export interface RampRateWeekItem {
  weekKey: string;
  label: string;
  rampRate: number;
  endCtl: number;
  status: 'recovery' | 'safe' | 'aggressive' | 'danger';
  colorHex: string;
  bgToken: string;
  textToken: string;
}

export interface RampRateHistoryResult {
  weeks: RampRateWeekItem[];
  maxRamp: number;
  avgRamp: number;
  cautionWeeksCount: number;
}

export interface FtpHistoryPoint {
  id: string;
  date: string;
  shortDate: string;
  ftpWatts: number;
  wkg: number;
  source: 'manual' | 'breakthrough' | 'initial';
  note?: string;
}

export interface FtpHistoryResult {
  timeline: FtpHistoryPoint[];
  currentFtp: number;
  currentWkg: number;
  startFtp: number;
  gainWatts: number;
  gainPct: number;
  peakFtp: number;
}

export interface PersonalRecordItem {
  id: string;
  type: 'distance' | 'elevation' | 'duration' | 'power' | 'speed';
  label: string;
  value: number;
  formattedValue: string;
  unit: string;
  date: string;
  shortDate: string;
  activityId?: number;
  activityName: string;
  previousValue?: number;
  improvementPct?: number;
}

export interface AerobicEfficiencyResult {
  avgEf: number;
  ridesWithEfCount: number;
  trend: 'improving' | 'stable' | 'declining';
  trendPct: number;
  recentEf: {
    date: string;
    activityName: string;
    ef: number;
    np: number;
    hr: number;
  }[];
}

// -----------------------------------------------------------------------------
// 1. Period Filtering
// -----------------------------------------------------------------------------
export function filterByPeriod(activities: StravaActivityRecord[], period: TimePeriod): StravaActivityRecord[] {
  if (!activities || activities.length === 0) return [];
  if (period === 'all-time') return activities;

  const now = new Date();
  const currentYear = now.getFullYear();

  return activities.filter(a => {
    const actDate = new Date(a.start_date);
    if (isNaN(actDate.getTime())) return false;

    if (period === 'ytd') {
      return actDate.getFullYear() === currentYear;
    }
    if (period === '30d') {
      const diffDays = (now.getTime() - actDate.getTime()) / (1000 * 3600 * 24);
      return diffDays >= 0 && diffDays <= 30;
    }
    if (period === '7d') {
      const diffDays = (now.getTime() - actDate.getTime()) / (1000 * 3600 * 24);
      return diffDays >= 0 && diffDays <= 7;
    }
    return true;
  });
}

// -----------------------------------------------------------------------------
// 2. KPI Metrics & Fun Equivalents
// -----------------------------------------------------------------------------
export function computeKpiMetrics(activities: StravaActivityRecord[]): KpiMetrics {
  if (!activities || activities.length === 0) {
    return {
      totalDistanceKm: 0,
      totalElevationM: 0,
      totalMovingTimeMin: 0,
      totalCaloriesKcal: 0,
      totalRides: 0,
      avgNpWatts: 0,
      avgSpeedKmh: 0,
      avgHeartRate: 0,
      everestRatio: 0,
      bananasBurned: 0,
      pizzasBurned: 0,
      earthCircumferencePct: 0
    };
  }

  let totalDistM = 0;
  let totalEleM = 0;
  let totalTimeSec = 0;
  let totalKcal = 0;
  let weightedWattsSum = 0;
  let powerCount = 0;
  let heartRateSum = 0;
  let hrCount = 0;

  for (const act of activities) {
    totalDistM += act.distance || 0;
    totalEleM += act.total_elevation_gain || 0;
    totalTimeSec += act.moving_time || 0;

    // Calories estimate: kilojoules ~ kcal, or approximate from duration
    if (act.kilojoules && act.kilojoules > 0) {
      totalKcal += Math.round(act.kilojoules * 1.05);
    } else {
      totalKcal += Math.round(((act.moving_time || 0) / 3600) * 550);
    }

    const np = act.weighted_average_watts || act.average_watts || 0;
    if (np > 0) {
      weightedWattsSum += np;
      powerCount++;
    }

    if (act.average_heartrate && act.average_heartrate > 0) {
      heartRateSum += act.average_heartrate;
      hrCount++;
    }
  }

  const totalDistanceKm = parseFloat((totalDistM / 1000).toFixed(1));
  const totalElevationM = Math.round(totalEleM);
  const totalMovingTimeMin = Math.round(totalTimeSec / 60);
  const totalCaloriesKcal = Math.round(totalKcal);
  const totalRides = activities.length;
  const avgNpWatts = powerCount > 0 ? Math.round(weightedWattsSum / powerCount) : 0;
  const avgSpeedKmh = totalTimeSec > 0 ? parseFloat(((totalDistM / totalTimeSec) * 3.6).toFixed(1)) : 0;
  const avgHeartRate = hrCount > 0 ? Math.round(heartRateSum / hrCount) : 0;

  return {
    totalDistanceKm,
    totalElevationM,
    totalMovingTimeMin,
    totalCaloriesKcal,
    totalRides,
    avgNpWatts,
    avgSpeedKmh,
    avgHeartRate,
    everestRatio: parseFloat((totalElevationM / 8848).toFixed(2)),
    bananasBurned: Math.round(totalCaloriesKcal / 90),
    pizzasBurned: Math.round(totalCaloriesKcal / 280),
    earthCircumferencePct: parseFloat(((totalDistanceKm / 40075) * 100).toFixed(2))
  };
}

// -----------------------------------------------------------------------------
// 3. PMC (CTL, ATL, TSB) & Status Diagnosis (Intervals.icu Model)
// -----------------------------------------------------------------------------
export function computePmcTimeline(
  activities: StravaActivityRecord[],
  riderFtp: number = 240,
  daysBack: number = 90,
  daysForward: number = 0
): PmcPoint[] {
  const ftp = Math.max(80, riderFtp);
  const LAMBDA_CTL = 2 / (42 + 1);
  const LAMBDA_ATL = 2 / (7 + 1);

  // Group TSS by date (YYYY-MM-DD)
  const tssByDate = new Map<string, number>();
  for (const a of activities) {
    if (!a.start_date) continue;
    const dStr = a.start_date.split('T')[0];
    let actTss = a.tss;
    if (actTss === undefined || actTss === null) {
      const movingSec = a.moving_time || 0;
      const np = a.weighted_average_watts || a.average_watts || 0;
      if (np > 0) {
        const ifVal = np / ftp;
        actTss = Math.round(((movingSec * np * ifVal) / (ftp * 3600)) * 100);
      } else if (a.suffer_score && a.suffer_score > 0) {
        actTss = Math.round(a.suffer_score * 0.95);
      } else {
        actTss = Math.round((movingSec / 3600) * 50);
      }
    }
    tssByDate.set(dStr, (tssByDate.get(dStr) || 0) + actTss);
  }

  // Generate date timeline backwards
  const result: PmcPoint[] = [];
  const now = new Date();
  let ctl = 40; // baseline seed
  let atl = 35;

  for (let i = daysBack - 1; i >= 0; i--) {
    const targetDate = new Date(now.getTime() - i * 24 * 3600 * 1000);
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const shortDate = `${targetDate.getMonth() + 1}/${targetDate.getDate()}`;

    const dayTss = tssByDate.get(dateStr) || 0;
    ctl = ctl * (1 - LAMBDA_CTL) + dayTss * LAMBDA_CTL;
    atl = atl * (1 - LAMBDA_ATL) + dayTss * LAMBDA_ATL;
    const tsb = ctl - atl;

    result.push({
      date: dateStr,
      shortDate,
      tss: dayTss,
      ctl: parseFloat(ctl.toFixed(1)),
      atl: parseFloat(atl.toFixed(1)),
      tsb: parseFloat(tsb.toFixed(1)),
      isProjection: false
    });
  }

  // Generate forward projection under tapering / rest conditions (0 TSS)
  if (daysForward > 0) {
    for (let f = 1; f <= daysForward; f++) {
      const targetDate = new Date(now.getTime() + f * 24 * 3600 * 1000);
      const yyyy = targetDate.getFullYear();
      const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
      const dd = String(targetDate.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const shortDate = `${targetDate.getMonth() + 1}/${targetDate.getDate()}`;

      const dayTss = 0;
      ctl = ctl * (1 - LAMBDA_CTL) + dayTss * LAMBDA_CTL;
      atl = atl * (1 - LAMBDA_ATL) + dayTss * LAMBDA_ATL;
      const tsb = ctl - atl;

      result.push({
        date: dateStr,
        shortDate,
        tss: dayTss,
        ctl: parseFloat(ctl.toFixed(1)),
        atl: parseFloat(atl.toFixed(1)),
        tsb: parseFloat(tsb.toFixed(1)),
        isProjection: true
      });
    }
  }

  return result;
}

export function diagnoseAthleteStatus(
  latestTsb: number,
  pmcTimeline: PmcPoint[]
): StatusDiagnosis {
  // Compute weekly ramp rate using historical non-projected days
  let weeklyRampRate = 0;
  const historyPoints = pmcTimeline.filter(p => !p.isProjection);
  if (historyPoints.length >= 8) {
    const todayCtl = historyPoints[historyPoints.length - 1].ctl;
    const weekAgoCtl = historyPoints[historyPoints.length - 8].ctl;
    weeklyRampRate = parseFloat((todayCtl - weekAgoCtl).toFixed(1));
  }

  let rampRateWarning: string | undefined;
  if (weeklyRampRate > 10) {
    rampRateWarning = `负荷激增预警: 本周 CTL 攀升 +${weeklyRampRate} TSS/周，超过安全上限 +8，注意预防过度劳损！`;
  }

  if (latestTsb >= 5) {
    return {
      status: 'peak',
      label: '巅峰竞技态',
      colorToken: 'text-ios-green',
      badgeBg: 'bg-ios-green/10 dark:bg-ios-green/20',
      badgeText: 'text-ios-green',
      advice: '体能充沛，疲劳彻底排解！极适宜周末破个人 PR、大坡攻坚或参加竞赛冲刺。',
      weeklyRampRate,
      rampRateWarning
    };
  }
  if (latestTsb >= -15) {
    return {
      status: 'productive',
      label: '高效提升态',
      colorToken: 'text-ios-blue',
      badgeBg: 'bg-ios-blue/10 dark:bg-ios-blue/20',
      badgeText: 'text-ios-blue',
      advice: '负荷与恢复节奏极佳！处于耐力与 FTP 稳健爬坡的黄金窗口期，继续保持训练。',
      weeklyRampRate,
      rampRateWarning
    };
  }
  if (latestTsb >= -30) {
    return {
      status: 'overstress',
      label: '高负荷警戒',
      colorToken: 'text-ios-orange',
      badgeBg: 'bg-ios-orange/10 dark:bg-ios-orange/20',
      badgeText: 'text-ios-orange',
      advice: '近期训练强度偏高，累积了一定深度疲劳。建议今明两天安排 Z2 排酸慢骑或主动休息。',
      weeklyRampRate,
      rampRateWarning
    };
  }

  return {
    status: 'overreach',
    label: '过负荷危险态',
    colorToken: 'text-ios-red',
    badgeBg: 'bg-ios-red/10 dark:bg-ios-red/20',
    badgeText: 'text-ios-red',
    advice: '深度疲劳超标！免疫力与受伤风险显著增加，请立即安排彻底休息日或补充高碳睡眠。',
    weeklyRampRate,
    rampRateWarning
  };
}

export function findOptimalRaceWindow(pmcTimeline: PmcPoint[]): OptimalRaceWindow {
  if (!pmcTimeline || pmcTimeline.length === 0) {
    return {
      peakDate: null,
      peakShortDate: null,
      peakTsb: 0,
      daysUntilPeak: 0,
      inOptimalFormToday: false,
      optimalDateRange: null
    };
  }

  const projectionPoints = pmcTimeline.filter(p => p.isProjection);
  const historyPoints = pmcTimeline.filter(p => !p.isProjection);
  const todayPoint = historyPoints.length > 0 ? historyPoints[historyPoints.length - 1] : pmcTimeline[0];
  const inOptimalFormToday = todayPoint.tsb >= 5 && todayPoint.tsb <= 25;

  if (projectionPoints.length === 0) {
    return {
      peakDate: todayPoint.date,
      peakShortDate: todayPoint.shortDate,
      peakTsb: todayPoint.tsb,
      daysUntilPeak: 0,
      inOptimalFormToday,
      optimalDateRange: inOptimalFormToday ? todayPoint.shortDate : null
    };
  }

  // Golden race window is TSB between +8 and +22
  const optimalPoints = projectionPoints.filter(p => p.tsb >= 8 && p.tsb <= 22);
  let bestPoint = projectionPoints[0];
  let bestScore = -999;

  for (const p of projectionPoints) {
    // Score based on ideal form window (TSB +10 to +20) while preserving chronic fitness CTL
    const formBonus = p.tsb >= 8 && p.tsb <= 22 ? 30 - Math.abs(p.tsb - 14) : -Math.abs(p.tsb - 14);
    const score = p.ctl * 0.6 + formBonus * 1.5;
    if (score > bestScore) {
      bestScore = score;
      bestPoint = p;
    }
  }

  const daysUntilPeak = projectionPoints.indexOf(bestPoint) + 1;
  const optimalDateRange = optimalPoints.length > 0
    ? `${optimalPoints[0].shortDate} ~ ${optimalPoints[optimalPoints.length - 1].shortDate}`
    : null;

  return {
    peakDate: bestPoint.date,
    peakShortDate: bestPoint.shortDate,
    peakTsb: bestPoint.tsb,
    daysUntilPeak: Math.max(1, daysUntilPeak),
    inOptimalFormToday,
    optimalDateRange
  };
}

// -----------------------------------------------------------------------------
// 4. Eddington Number (E) Calculation
// -----------------------------------------------------------------------------
export function computeEddingtonNumber(activities: StravaActivityRecord[]): EddingtonResult {
  if (!activities || activities.length === 0) {
    return {
      E: 0,
      nextE: 1,
      ridesNeededForNextE: 1,
      qualifyingRidesForNext: 0,
      histogramData: [],
      allTimeE: 0,
      yearlyE: 0
    };
  }

  // Daily max distance to count single days
  const dailyDistances = new Map<string, number>();
  for (const a of activities) {
    if (!a.start_date) continue;
    const dStr = a.start_date.split('T')[0];
    const km = (a.distance || 0) / 1000;
    dailyDistances.set(dStr, (dailyDistances.get(dStr) || 0) + km);
  }

  const distList = Array.from(dailyDistances.values()).map(d => Math.floor(d));
  distList.sort((a, b) => b - a);

  let E = 0;
  for (let i = 0; i < distList.length; i++) {
    if (distList[i] >= i + 1) {
      E = i + 1;
    } else {
      break;
    }
  }

  const nextE = E + 1;
  const qualifyingRidesForNext = distList.filter(d => d >= nextE).length;
  const ridesNeededForNextE = Math.max(0, nextE - qualifyingRidesForNext);

  // Histogram data up to max(E + 20, 100)
  const maxBucket = Math.max(E + 20, 100);
  const step = 5;
  const histogramData: EddingtonResult['histogramData'] = [];

  for (let dist = step; dist <= maxBucket; dist += step) {
    const cumulativeCount = distList.filter(d => d >= dist).length;
    histogramData.push({
      distanceKm: dist,
      cumulativeCount,
      isAboveThreshold: cumulativeCount >= dist
    });
  }

  return {
    E,
    nextE,
    ridesNeededForNextE,
    qualifyingRidesForNext,
    histogramData,
    allTimeE: E,
    yearlyE: Math.max(0, Math.round(E * 0.7))
  };
}

// -----------------------------------------------------------------------------
// 5. 91-Day Heatmap Grid & Streak Calculation
// -----------------------------------------------------------------------------
export function buildHeatmapGrid(
  activities: StravaActivityRecord[],
  weeks: number = 13
): { grid: DayCell[][]; stats: StreakStats } {
  const totalDays = weeks * 7;
  const now = new Date();
  // Align to end on Saturday of current week
  const currentDayOfWeek = now.getDay(); // 0 is Sunday
  const daysToEndOfWeek = 6 - currentDayOfWeek;
  const endDate = new Date(now.getTime() + daysToEndOfWeek * 24 * 3600 * 1000);

  // Map daily activities
  const activityMap = new Map<string, { km: number; ele: number; rides: number }>();
  for (const a of activities) {
    if (!a.start_date) continue;
    const dStr = a.start_date.split('T')[0];
    const prev = activityMap.get(dStr) || { km: 0, ele: 0, rides: 0 };
    prev.km += (a.distance || 0) / 1000;
    prev.ele += a.total_elevation_gain || 0;
    prev.rides += 1;
    activityMap.set(dStr, prev);
  }

  // Generate array of days from oldest to newest
  const allCells: DayCell[] = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(endDate.getTime() - i * 24 * 3600 * 1000);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayOfWeek = d.getDay();

    const data = activityMap.get(dateStr) || { km: 0, ele: 0, rides: 0 };
    const distanceKm = parseFloat(data.km.toFixed(1));
    const elevationM = Math.round(data.ele);
    const hasRide = distanceKm > 0;

    let level: IntensityLevel = 0;
    if (distanceKm > 100) level = 4;
    else if (distanceKm >= 60) level = 3;
    else if (distanceKm >= 30) level = 2;
    else if (distanceKm > 0) level = 1;

    allCells.push({
      date: dateStr,
      dayOfWeek,
      distanceKm,
      elevationM,
      hasRide,
      level,
      rides: data.rides
    });
  }

  // Slice into weeks (columns)
  const grid: DayCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    grid.push(allCells.slice(w * 7, (w + 1) * 7));
  }

  // Calculate Streak stats
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  // Streak scanning backwards from today
  const todayStr = now.toISOString().split('T')[0];
  const todayIndex = allCells.findIndex(c => c.date === todayStr);
  const scanIndex = todayIndex >= 0 ? todayIndex : allCells.length - 1;

  for (let i = scanIndex; i >= 0; i--) {
    if (allCells[i].hasRide) {
      currentStreak++;
    } else {
      // Allow today to not be completed yet without breaking streak if yesterday had ride
      if (i === scanIndex) continue;
      break;
    }
  }

  for (let i = 0; i < allCells.length; i++) {
    if (allCells[i].hasRide) {
      tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  }

  // Monthly active days
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonthCells = allCells.filter(c => c.date.startsWith(currentYearMonth));
  const thisMonthActiveDays = thisMonthCells.filter(c => c.hasRide).length;
  const thisMonthTotalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const totalActiveDays = allCells.filter(c => c.hasRide).length;

  return {
    grid,
    stats: {
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
      thisMonthActiveDays,
      thisMonthTotalDays,
      totalActiveDays
    }
  };
}

// -----------------------------------------------------------------------------
// 6. Activity Rings (Apple Fitness Style)
// -----------------------------------------------------------------------------
export function computeActivityRings(
  activities: StravaActivityRecord[],
  targets = { distanceKm: 150, elevationM: 1500, tss: 350 }
): ActivityRingData {
  const weekly = filterByPeriod(activities, '7d');
  const metrics = computeKpiMetrics(weekly);

  // Compute 7d TSS
  let weeklyTss = 0;
  for (const a of weekly) {
    if (a.tss) weeklyTss += a.tss;
    else weeklyTss += Math.round(((a.moving_time || 0) / 3600) * 50);
  }

  const distPct = Math.min(2, metrics.totalDistanceKm / targets.distanceKm);
  const elePct = Math.min(2, metrics.totalElevationM / targets.elevationM);
  const tssPct = Math.min(2, weeklyTss / targets.tss);

  return {
    distance: { current: metrics.totalDistanceKm, target: targets.distanceKm, pct: distPct },
    elevation: { current: metrics.totalElevationM, target: targets.elevationM, pct: elePct },
    tss: { current: weeklyTss, target: targets.tss, pct: tssPct }
  };
}

// -----------------------------------------------------------------------------
// 7. Bioclock: Time-of-Day & Day-of-Week Insights
// -----------------------------------------------------------------------------
export function computeBioclock(activities: StravaActivityRecord[]): BioclockStats {
  const slotCounts = {
    dawn: { label: '黎明破晓', range: '04:00-06:59', rides: 0, km: 0 },
    morning: { label: '清晨早鸟', range: '07:00-09:59', rides: 0, km: 0 },
    midday: { label: '日间巡航', range: '10:00-16:59', rides: 0, km: 0 },
    evening: { label: '晚风夜骑', range: '17:00-20:59', rides: 0, km: 0 },
    night: { label: '深夜突围', range: '21:00-03:59', rides: 0, km: 0 }
  };

  const dayCounts = [
    { day: 0, label: '周日', rides: 0, distanceKm: 0 },
    { day: 1, label: '周一', rides: 0, distanceKm: 0 },
    { day: 2, label: '周二', rides: 0, distanceKm: 0 },
    { day: 3, label: '周三', rides: 0, distanceKm: 0 },
    { day: 4, label: '周四', rides: 0, distanceKm: 0 },
    { day: 5, label: '周五', rides: 0, distanceKm: 0 },
    { day: 6, label: '周六', rides: 0, distanceKm: 0 }
  ];

  let totalRides = 0;
  for (const a of activities) {
    if (!a.start_date) continue;
    const date = new Date(a.start_date);
    if (isNaN(date.getTime())) continue;

    const hour = date.getHours();
    const day = date.getDay();
    const km = (a.distance || 0) / 1000;
    totalRides++;

    dayCounts[day].rides++;
    dayCounts[day].distanceKm += km;

    if (hour >= 4 && hour < 7) {
      slotCounts.dawn.rides++;
      slotCounts.dawn.km += km;
    } else if (hour >= 7 && hour < 10) {
      slotCounts.morning.rides++;
      slotCounts.morning.km += km;
    } else if (hour >= 10 && hour < 17) {
      slotCounts.midday.rides++;
      slotCounts.midday.km += km;
    } else if (hour >= 17 && hour < 21) {
      slotCounts.evening.rides++;
      slotCounts.evening.km += km;
    } else {
      slotCounts.night.rides++;
      slotCounts.night.km += km;
    }
  }

  // Format byTimeSlot
  const byTimeSlot = Object.entries(slotCounts).map(([key, val]) => ({
    id: key,
    label: val.label,
    rides: val.rides,
    distanceKm: parseFloat(val.km.toFixed(1)),
    pct: totalRides > 0 ? Math.round((val.rides / totalRides) * 100) : 0
  }));

  // Re-order days from Monday to Sunday for cycling convention
  const byDayOfWeek = [
    dayCounts[1],
    dayCounts[2],
    dayCounts[3],
    dayCounts[4],
    dayCounts[5],
    dayCounts[6],
    dayCounts[0]
  ].map(d => ({ ...d, distanceKm: parseFloat(d.distanceKm.toFixed(1)) }));

  // Pattern detection
  const weekdayKm = dayCounts.slice(1, 6).reduce((s, d) => s + d.distanceKm, 0);
  const weekendKm = dayCounts[0].distanceKm + dayCounts[6].distanceKm;
  const totalKm = weekdayKm + weekendKm;
  const weekendPct = totalKm > 0 ? weekendKm / totalKm : 0.5;

  let riderPattern = '均衡全能型骑行者';

  if (weekendPct > 0.65) {
    riderPattern = '周末长途拉练型车手';
  } else if (weekendPct < 0.35) {
    riderPattern = '工作日高频自律型车手';
  } else if (slotCounts.dawn.rides + slotCounts.morning.rides > totalRides * 0.5) {
    riderPattern = '清晨破风早鸟型车手';
  } else if (slotCounts.evening.rides + slotCounts.night.rides > totalRides * 0.5) {
    riderPattern = '晚风夜骑巡航型车手';
  }

  return {
    byTimeSlot,
    byDayOfWeek,
    riderPattern
  };
}

// -----------------------------------------------------------------------------
// 8. MMP Curve & eFTP Estimation
// -----------------------------------------------------------------------------
export function estimateEFTP(
  p5s: number,
  p1m: number,
  p5m: number,
  p20m: number,
  riderWeightKg: number = 68
): EftpEstimate {
  const ftp = Math.round(p20m * 0.95);
  const wPrimeKj = Math.max(10, Math.round(((p1m - ftp) * 60) / 1000));
  const wkg = parseFloat((ftp / Math.max(40, riderWeightKg)).toFixed(2));

  return {
    eFTP: ftp,
    eFTPWkg: wkg,
    wPrimeKj,
    pMax: p5s,
    p5s,
    p1m,
    p5m,
    p20m
  };
}

// -----------------------------------------------------------------------------
// 9. Gear Fleet Management & Component Health
// -----------------------------------------------------------------------------
export function computeGearFleet(
  bikes: StravaBike[],
  activities: StravaActivityRecord[]
): BikeFleetItem[] {
  // If no bikes in athlete profile, aggregate from activities gear_id or fallback
  const bikeDistances = new Map<string, { km: number; rides: number; lastDate: string }>();

  for (const a of activities) {
    const gearKey = a.gear_id || 'primary_bike';
    const cur = bikeDistances.get(gearKey) || { km: 0, rides: 0, lastDate: '' };
    cur.km += (a.distance || 0) / 1000;
    cur.rides++;
    if (!cur.lastDate || a.start_date > cur.lastDate) {
      cur.lastDate = a.start_date;
    }
    bikeDistances.set(gearKey, cur);
  }

  const totalAllKm = Array.from(bikeDistances.values()).reduce((sum, b) => sum + b.km, 0);

  const fleetList: BikeFleetItem[] = [];

  const rawBikes = bikes && bikes.length > 0
    ? bikes
    : [
        { id: 'b_road_1', name: 'Canyon Aeroad CFR 气动公路车', distance: 4820000, primary: true },
        { id: 'b_gravel_2', name: 'Specialized Diverge 全地形公路车', distance: 2150000, primary: false }
      ];

  for (const b of rawBikes) {
    const record = bikeDistances.get(b.id) || {
      km: Math.round((b.distance || 0) / 1000),
      rides: Math.round(((b.distance || 0) / 1000) / 45),
      lastDate: new Date().toISOString()
    };
    const distKm = Math.max(Math.round((b.distance || 0) / 1000), Math.round(record.km));
    const distPct = totalAllKm > 0 ? Math.round((distKm / totalAllKm) * 100) : 50;

    // Component health calculation
    const chainWearKm = distKm % 3000;
    const tireWearKm = distKm % 4000;
    const brakeWearKm = distKm % 5000;

    const components: ComponentHealth[] = [
      {
        name: '传动链条',
        componentKey: 'chain',
        currentKm: chainWearKm,
        warnKm: 2500,
        criticalKm: 3000,
        status: chainWearKm >= 3000 ? 'critical' : chainWearKm >= 2500 ? 'warn' : 'ok',
        remainingPct: Math.max(0, Math.round(((3000 - chainWearKm) / 3000) * 100))
      },
      {
        name: '真空外胎',
        componentKey: 'tire',
        currentKm: tireWearKm,
        warnKm: 3500,
        criticalKm: 4000,
        status: tireWearKm >= 4000 ? 'critical' : tireWearKm >= 3500 ? 'warn' : 'ok',
        remainingPct: Math.max(0, Math.round(((4000 - tireWearKm) / 4000) * 100))
      },
      {
        name: '刹车夹片',
        componentKey: 'brake',
        currentKm: brakeWearKm,
        warnKm: 4200,
        criticalKm: 5000,
        status: brakeWearKm >= 5000 ? 'critical' : brakeWearKm >= 4200 ? 'warn' : 'ok',
        remainingPct: Math.max(0, Math.round(((5000 - brakeWearKm) / 5000) * 100))
      }
    ];

    let type: BikeFleetItem['type'] = 'road';
    const lowerName = b.name.toLowerCase();
    if (lowerName.includes('gravel') || lowerName.includes('diverge')) type = 'gravel';
    else if (lowerName.includes('mtb') || lowerName.includes('spark') || lowerName.includes('epic')) type = 'mtb';
    else if (lowerName.includes('zwift') || lowerName.includes('kickr') || lowerName.includes('trainer')) type = 'indoor';

    fleetList.push({
      id: b.id,
      name: b.name,
      type,
      totalDistanceKm: distKm,
      totalRides: record.rides,
      lastRideDate: record.lastDate.split('T')[0] || '近期',
      distancePct: distPct,
      components
    });
  }

  return fleetList;
}

// -----------------------------------------------------------------------------
// 10. Milestones & PR Hall
// -----------------------------------------------------------------------------
export function computeMilestones(activities: StravaActivityRecord[]): MilestoneItem[] {
  let centuryCount = 0;
  let imperialCenturyCount = 0;
  let doubleCenturyCount = 0;
  let maxDistanceKm = 0;
  let maxElevationM = 0;
  let maxNpWatts = 0;
  let maxDurationSec = 0;
  let totalElevationM = 0;
  let dawnRideCount = 0;

  for (const a of activities) {
    const km = (a.distance || 0) / 1000;
    const ele = a.total_elevation_gain || 0;
    const sec = a.moving_time || 0;
    const np = a.weighted_average_watts || a.average_watts || 0;

    totalElevationM += ele;

    if (km >= 100) centuryCount++;
    if (km >= 160.9) imperialCenturyCount++;
    if (km >= 200) doubleCenturyCount++;

    if (km > maxDistanceKm) maxDistanceKm = km;
    if (ele > maxElevationM) maxElevationM = ele;
    if (np > maxNpWatts) maxNpWatts = np;
    if (sec > maxDurationSec) maxDurationSec = sec;

    if (a.start_date) {
      const hour = new Date(a.start_date).getHours();
      if (hour >= 4 && hour < 7) dawnRideCount++;
    }
  }

  const everestPct = Math.round((totalElevationM / 8848) * 100);

  return [
    {
      id: 'century',
      title: '破百挑战者',
      subtitle: '单次骑行突破 100 公里大关',
      achieved: centuryCount > 0,
      count: centuryCount,
      targetValue: '100 km',
      progressPct: Math.min(100, (maxDistanceKm / 100) * 100)
    },
    {
      id: 'imperial_century',
      title: '百英里大满贯',
      subtitle: '完成单次 160.9 公里帝国世纪骑行',
      achieved: imperialCenturyCount > 0,
      count: imperialCenturyCount,
      targetValue: '160.9 km',
      progressPct: Math.min(100, (maxDistanceKm / 160.9) * 100)
    },
    {
      id: 'double_century',
      title: '双百超级壮举',
      subtitle: '单日长途耐力极限破 200 公里',
      achieved: doubleCenturyCount > 0,
      count: doubleCenturyCount,
      targetValue: '200 km',
      progressPct: Math.min(100, (maxDistanceKm / 200) * 100)
    },
    {
      id: 'everest_challenge',
      title: '珠峰攀登累计',
      subtitle: `累计爬升已达 ${everestPct}% · 目标 8,848m`,
      achieved: totalElevationM >= 8848,
      currentValue: `${Math.round(totalElevationM)}m`,
      targetValue: '8,848m',
      progressPct: Math.min(100, everestPct)
    },
    {
      id: 'dawn_patrol',
      title: '破晓先锋',
      subtitle: '在清晨 07:00 前破风出征 ≥ 5次',
      achieved: dawnRideCount >= 5,
      count: dawnRideCount,
      targetValue: '5 次',
      progressPct: Math.min(100, (dawnRideCount / 5) * 100)
    },
    {
      id: 'pr_distance',
      title: '个人最远单日记录',
      subtitle: `${maxDistanceKm.toFixed(1)} km 历史巅峰`,
      achieved: maxDistanceKm > 0,
      currentValue: `${maxDistanceKm.toFixed(1)} km`
    },
    {
      id: 'pr_elevation',
      title: '单场最大爬升记录',
      subtitle: `+${Math.round(maxElevationM)} m 垂直攀爬`,
      achieved: maxElevationM > 0,
      currentValue: `+${Math.round(maxElevationM)} m`
    },
    {
      id: 'pr_power',
      title: '单场最高加权功率',
      subtitle: `${maxNpWatts} W 强劲输出`,
      achieved: maxNpWatts > 0,
      currentValue: `${maxNpWatts} W`
    }
  ];
}

// -----------------------------------------------------------------------------
// 11. High-Fidelity 90-Day Demo Dataset Generator
// -----------------------------------------------------------------------------
export function generateDemoStravaActivities(): StravaActivityRecord[] {
  const list: StravaActivityRecord[] = [];
  const now = new Date();

  // Route Templates
  const routeTemplates = [
    { name: '西湖龙井与梅灵南路起伏拉练', dist: 38500, ele: 420, np: 215, hr: 148, gear: 'b_road_1' },
    { name: '安吉天荒坪 18km 连续爬坡攻坚', dist: 52000, ele: 1120, np: 245, hr: 165, gear: 'b_road_1' },
    { name: '钱塘江绿道晨风巡航刷脂', dist: 28000, ele: 45, np: 185, hr: 135, gear: 'b_road_1' },
    { name: '千岛湖经典环湖大满贯 140km', dist: 142000, ele: 1250, np: 228, hr: 154, gear: 'b_road_1' },
    { name: '莫干山后山古道 Gravel 探路', dist: 45000, ele: 780, np: 205, hr: 146, gear: 'b_gravel_2' },
    { name: '工作日晨曦破晓通勤刷里程', dist: 22000, ele: 35, np: 175, hr: 130, gear: 'b_road_1' },
    { name: '周末车队百公里破风进攻训练', dist: 105000, ele: 680, np: 238, hr: 158, gear: 'b_road_1' },
    { name: '西溪湿地外环晚间短途有氧', dist: 25000, ele: 30, np: 170, hr: 128, gear: 'b_road_1' }
  ];

  let idCounter = 9001;

  for (let dayOffset = 89; dayOffset >= 0; dayOffset--) {
    const actDate = new Date(now.getTime() - dayOffset * 24 * 3600 * 1000);
    const dayOfWeek = actDate.getDay(); // 0 is Sunday

    // Ride probability: Weekends (Sat/Sun) 90%, Weekdays 45%
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const shouldRide = isWeekend ? Math.random() < 0.9 : Math.random() < 0.45;

    if (!shouldRide) continue;

    // Pick template
    let tpl = routeTemplates[0];
    if (isWeekend) {
      // High chance of long rides on weekends
      tpl = Math.random() < 0.4 ? routeTemplates[3] : Math.random() < 0.7 ? routeTemplates[6] : routeTemplates[1];
    } else {
      tpl = Math.random() < 0.5 ? routeTemplates[5] : routeTemplates[2];
    }

    // Add slight random jitter
    const distance = Math.round(tpl.dist * (0.92 + Math.random() * 0.16));
    const ele = Math.round(tpl.ele * (0.9 + Math.random() * 0.2));
    const avgSpeed = 7.5 + Math.random() * 1.5; // ~27-32 km/h
    const movingTime = Math.round(distance / avgSpeed);
    const np = Math.round(tpl.np * (0.95 + Math.random() * 0.1));
    const hr = Math.round(tpl.hr * (0.96 + Math.random() * 0.08));

    // Time of day
    const hour = isWeekend ? (Math.random() < 0.7 ? 7 : 8) : (Math.random() < 0.6 ? 6 : 19);
    actDate.setHours(hour, Math.floor(Math.random() * 59), 0, 0);

    // Calculate TSS
    const ftp = 240;
    const ifVal = parseFloat((np / ftp).toFixed(3));
    const tss = Math.round(((movingTime * np * ifVal) / (ftp * 3600)) * 100);

    list.push({
      id: idCounter++,
      name: tpl.name,
      distance,
      moving_time: movingTime,
      elapsed_time: Math.round(movingTime * 1.1),
      total_elevation_gain: ele,
      type: 'Ride',
      sport_type: tpl.gear === 'b_gravel_2' ? 'GravelRide' : 'Ride',
      start_date: actDate.toISOString(),
      start_date_local: actDate.toISOString(),
      average_speed: parseFloat(avgSpeed.toFixed(2)),
      max_speed: parseFloat((avgSpeed * 1.6).toFixed(1)),
      average_watts: Math.round(np * 0.92),
      weighted_average_watts: np,
      kilojoules: Math.round(((np * movingTime) / 1000) * 1.05),
      device_watts: true,
      has_heartrate: true,
      average_heartrate: hr,
      max_heartrate: Math.min(195, Math.round(hr * 1.18)),
      suffer_score: Math.round(tss * 0.9),
      gear_id: tpl.gear,
      tss,
      intensityFactor: ifVal
    });
  }

  return list;
}

// -----------------------------------------------------------------------------
// 11. Weekly Training Volume Breakdown (Intervals.icu Model)
// -----------------------------------------------------------------------------
export function computeWeeklyVolume(
  activities: StravaActivityRecord[],
  riderFtp: number = 240,
  weeksBack: number = 52
): WeeklyVolumeResult {
  const ftp = Math.max(80, riderFtp);
  const now = new Date();

  // Find Monday of current week
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const currentMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
  currentMonday.setHours(0, 0, 0, 0);

  const weeks: WeeklyVolumePoint[] = [];

  for (let w = weeksBack - 1; w >= 0; w--) {
    const startOfWeek = new Date(currentMonday.getTime() - w * 7 * 24 * 3600 * 1000);
    const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 3600 * 1000 - 1);

    const startY = startOfWeek.getFullYear();
    const startM = String(startOfWeek.getMonth() + 1).padStart(2, '0');
    const startD = String(startOfWeek.getDate()).padStart(2, '0');
    const startDateStr = `${startY}-${startM}-${startD}`;

    const endY = endOfWeek.getFullYear();
    const endM = String(endOfWeek.getMonth() + 1).padStart(2, '0');
    const endD = String(endOfWeek.getDate()).padStart(2, '0');
    const endDateStr = `${endY}-${endM}-${endD}`;

    const label = `${startOfWeek.getMonth() + 1}/${startOfWeek.getDate()}`;
    const weekKey = `${startY}-W${Math.ceil((startOfWeek.getDate() + 6) / 7)}_${label}`;

    let weekTss = 0;
    let weekDistM = 0;
    let weekElevM = 0;
    let weekMovingSec = 0;
    let weekRides = 0;

    for (const a of activities) {
      if (!a.start_date) continue;
      const aTime = new Date(a.start_date).getTime();
      if (aTime >= startOfWeek.getTime() && aTime <= endOfWeek.getTime()) {
        weekRides++;
        weekDistM += (a.distance || 0);
        weekElevM += (a.total_elevation_gain || 0);
        const movingSec = a.moving_time || 0;
        weekMovingSec += movingSec;

        let actTss = a.tss;
        if (actTss === undefined || actTss === null) {
          const np = a.weighted_average_watts || a.average_watts || 0;
          if (np > 0) {
            const ifVal = np / ftp;
            actTss = Math.round(((movingSec * np * ifVal) / (ftp * 3600)) * 100);
          } else if (a.suffer_score && a.suffer_score > 0) {
            actTss = Math.round(a.suffer_score * 0.95);
          } else {
            actTss = Math.round((movingSec / 3600) * 50);
          }
        }
        weekTss += actTss;
      }
    }

    weeks.push({
      weekKey,
      label,
      startDate: startDateStr,
      endDate: endDateStr,
      tss: weekTss,
      distanceKm: parseFloat((weekDistM / 1000).toFixed(1)),
      elevationM: Math.round(weekElevM),
      movingTimeMin: Math.round(weekMovingSec / 60),
      rides: weekRides
    });
  }

  let maxTss = 0;
  let maxDist = 0;
  let peakTssIdx = -1;
  let peakDistIdx = -1;

  for (let i = 0; i < weeks.length; i++) {
    if (weeks[i].tss > maxTss) {
      maxTss = weeks[i].tss;
      peakTssIdx = i;
    }
    if (weeks[i].distanceKm > maxDist) {
      maxDist = weeks[i].distanceKm;
      peakDistIdx = i;
    }
  }

  if (peakTssIdx >= 0 && maxTss > 0) {
    weeks[peakTssIdx].isPeakTss = true;
  }
  if (peakDistIdx >= 0 && maxDist > 0) {
    weeks[peakDistIdx].isPeakDistance = true;
  }

  const activeWeeks = weeks.filter(w => w.rides > 0);
  const totalVolumeTss = weeks.reduce((sum, w) => sum + w.tss, 0);
  const totalVolumeDistanceKm = parseFloat(weeks.reduce((sum, w) => sum + w.distanceKm, 0).toFixed(1));
  const activeCount = Math.max(1, activeWeeks.length);

  return {
    weeks,
    peakTssWeek: peakTssIdx >= 0 && maxTss > 0 ? weeks[peakTssIdx] : null,
    peakDistanceWeek: peakDistIdx >= 0 && maxDist > 0 ? weeks[peakDistIdx] : null,
    avgWeeklyTss: Math.round(totalVolumeTss / activeCount),
    avgWeeklyDistanceKm: parseFloat((totalVolumeDistanceKm / activeCount).toFixed(1)),
    totalVolumeTss,
    totalVolumeDistanceKm
  };
}

// -----------------------------------------------------------------------------
// 12. Annual Goal Progress & Pace Forecast (Strava Model)
// -----------------------------------------------------------------------------
export function computeAnnualGoalProgress(
  activities: StravaActivityRecord[],
  targetKm: number = 5000,
  year?: number
): AnnualGoalProgress {
  const now = new Date();
  const targetYear = year ?? now.getFullYear();
  const currentYear = now.getFullYear();

  const isLeapYear = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
  const totalDaysInYear = isLeapYear ? 366 : 365;

  let daysPassed: number;
  let daysRemaining: number;

  if (targetYear < currentYear) {
    daysPassed = totalDaysInYear;
    daysRemaining = 0;
  } else if (targetYear > currentYear) {
    daysPassed = 1;
    daysRemaining = totalDaysInYear - 1;
  } else {
    const startOfYear = new Date(targetYear, 0, 1);
    daysPassed = Math.max(1, Math.min(totalDaysInYear, Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 3600 * 1000)) + 1));
    daysRemaining = Math.max(0, totalDaysInYear - daysPassed);
  }

  // Monthly buckets: 1 to 12
  const monthDistances = new Array(12).fill(0);
  let totalDistM = 0;

  for (const a of activities) {
    if (!a.start_date) continue;
    const aDate = new Date(a.start_date);
    if (isNaN(aDate.getTime())) continue;

    if (aDate.getFullYear() === targetYear) {
      const dist = a.distance || 0;
      totalDistM += dist;
      const mIdx = aDate.getMonth();
      if (mIdx >= 0 && mIdx < 12) {
        monthDistances[mIdx] += dist;
      }
    }
  }

  const currentKm = parseFloat((totalDistM / 1000).toFixed(1));
  const safeTargetKm = Math.max(100, targetKm);
  const progressPct = parseFloat(((currentKm / safeTargetKm) * 100).toFixed(1));
  const remainingKm = Math.max(0, parseFloat((safeTargetKm - currentKm).toFixed(1)));

  const expectedPaceKm = parseFloat((safeTargetKm * (daysPassed / totalDaysInYear)).toFixed(1));
  const paceDeltaKm = parseFloat((currentKm - expectedPaceKm).toFixed(1));
  const isAheadOfPace = paceDeltaKm >= 0;

  const currentDailyRate = currentKm / Math.max(1, daysPassed);
  const monthlyRateKm = parseFloat((currentDailyRate * 30.4).toFixed(1));
  const requiredDailyKm = daysRemaining > 0 ? parseFloat((remainingKm / daysRemaining).toFixed(1)) : 0;
  const projectedYearEndKm = Math.round(currentDailyRate * totalDaysInYear);

  let projectedCompletionDate: string | null = null;
  if (currentKm >= safeTargetKm) {
    projectedCompletionDate = '已达成';
  } else if (currentDailyRate > 0 && remainingKm > 0) {
    const daysNeeded = Math.ceil(remainingKm / currentDailyRate);
    if (daysNeeded <= 365 * 2) {
      const completionTime = new Date(now.getTime() + daysNeeded * 24 * 3600 * 1000);
      const cY = completionTime.getFullYear();
      const cM = String(completionTime.getMonth() + 1).padStart(2, '0');
      const cD = String(completionTime.getDate()).padStart(2, '0');
      projectedCompletionDate = `${cY}-${cM}-${cD}`;
    }
  }

  const monthlyTargetPaceKm = parseFloat((safeTargetKm / 12).toFixed(1));
  const monthlyBreakdown = monthDistances.map((distM, idx) => ({
    month: idx + 1,
    label: `${idx + 1}月`,
    actualKm: parseFloat((distM / 1000).toFixed(1)),
    targetPaceKm: monthlyTargetPaceKm
  }));

  return {
    year: targetYear,
    targetKm: safeTargetKm,
    currentKm,
    progressPct,
    remainingKm,
    daysPassed,
    daysRemaining,
    totalDaysInYear,
    expectedPaceKm,
    paceDeltaKm,
    isAheadOfPace,
    monthlyRateKm,
    requiredDailyKm,
    projectedYearEndKm,
    projectedCompletionDate,
    monthlyBreakdown
  };
}

export function computeAnnualElevationGoalProgress(
  activities: StravaActivityRecord[],
  targetElevationM: number = 50000,
  year?: number
): AnnualElevationGoalProgress {
  const now = new Date();
  const targetYear = year ?? now.getFullYear();
  const currentYear = now.getFullYear();

  const isLeapYear = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
  const totalDaysInYear = isLeapYear ? 366 : 365;

  let daysPassed: number;
  let daysRemaining: number;

  if (targetYear < currentYear) {
    daysPassed = totalDaysInYear;
    daysRemaining = 0;
  } else if (targetYear > currentYear) {
    daysPassed = 1;
    daysRemaining = totalDaysInYear - 1;
  } else {
    const startOfYear = new Date(targetYear, 0, 1);
    daysPassed = Math.max(1, Math.min(totalDaysInYear, Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 3600 * 1000)) + 1));
    daysRemaining = Math.max(0, totalDaysInYear - daysPassed);
  }

  // Monthly buckets: 1 to 12
  const monthElevations = new Array(12).fill(0);
  let totalEleM = 0;

  for (const a of activities) {
    if (!a.start_date) continue;
    const aDate = new Date(a.start_date);
    if (isNaN(aDate.getTime())) continue;

    if (aDate.getFullYear() === targetYear) {
      const ele = a.total_elevation_gain || 0;
      totalEleM += ele;
      const mIdx = aDate.getMonth();
      if (mIdx >= 0 && mIdx < 12) {
        monthElevations[mIdx] += ele;
      }
    }
  }

  const currentElevationM = Math.round(totalEleM);
  const safeTargetElevationM = Math.max(100, targetElevationM);
  const progressPct = parseFloat(((currentElevationM / safeTargetElevationM) * 100).toFixed(1));
  const remainingElevationM = Math.max(0, safeTargetElevationM - currentElevationM);

  const expectedPaceElevationM = Math.round(safeTargetElevationM * (daysPassed / totalDaysInYear));
  const paceDeltaElevationM = currentElevationM - expectedPaceElevationM;
  const isAheadOfPace = paceDeltaElevationM >= 0;

  const currentDailyRate = currentElevationM / Math.max(1, daysPassed);
  const monthlyRateElevationM = Math.round(currentDailyRate * 30.4);
  const requiredDailyElevationM = daysRemaining > 0 ? Math.round(remainingElevationM / daysRemaining) : 0;
  const projectedYearEndElevationM = Math.round(currentDailyRate * totalDaysInYear);

  let projectedCompletionDate: string | null = null;
  if (currentElevationM >= safeTargetElevationM) {
    projectedCompletionDate = '已达成';
  } else if (currentDailyRate > 0 && remainingElevationM > 0) {
    const daysNeeded = Math.ceil(remainingElevationM / currentDailyRate);
    if (daysNeeded <= 365 * 2) {
      const completionTime = new Date(now.getTime() + daysNeeded * 24 * 3600 * 1000);
      const cY = completionTime.getFullYear();
      const cM = String(completionTime.getMonth() + 1).padStart(2, '0');
      const cD = String(completionTime.getDate()).padStart(2, '0');
      projectedCompletionDate = `${cY}-${cM}-${cD}`;
    }
  }

  const monthlyTargetPaceElevationM = Math.round(safeTargetElevationM / 12);
  const monthlyBreakdown = monthElevations.map((eleM, idx) => ({
    month: idx + 1,
    label: `${idx + 1}月`,
    actualElevationM: Math.round(eleM),
    targetPaceElevationM: monthlyTargetPaceElevationM
  }));

  const everestingCount = parseFloat((currentElevationM / 8848).toFixed(1));

  return {
    year: targetYear,
    targetElevationM: safeTargetElevationM,
    currentElevationM,
    progressPct,
    remainingElevationM,
    daysPassed,
    daysRemaining,
    totalDaysInYear,
    expectedPaceElevationM,
    paceDeltaElevationM,
    isAheadOfPace,
    monthlyRateElevationM,
    requiredDailyElevationM,
    projectedYearEndElevationM,
    projectedCompletionDate,
    everestingCount,
    monthlyBreakdown
  };
}

// -----------------------------------------------------------------------------
// 13. Coggan Classic 7-Zone Power Distribution & Training Pattern
// -----------------------------------------------------------------------------
export function computePowerZoneDistribution(
  activities: StravaActivityRecord[],
  riderFtp: number = 240
): PowerZoneDistributionResult {
  const ftp = Math.max(80, riderFtp);

  // Coggan 7 zones definitions
  const z1Upper = Math.round(ftp * 0.55);
  const z2Upper = Math.round(ftp * 0.75);
  const z3Upper = Math.round(ftp * 0.90);
  const z4Upper = Math.round(ftp * 1.05);
  const z5Upper = Math.round(ftp * 1.20);
  const z6Upper = Math.round(ftp * 1.50);

  let z1Sec = 0;
  let z2Sec = 0;
  let z3Sec = 0;
  let z4Sec = 0;
  let z5Sec = 0;
  let z6Sec = 0;
  let z7Sec = 0;

  for (const a of activities) {
    const movingSec = a.moving_time || 0;
    if (movingSec <= 0) continue;

    const np = a.weighted_average_watts || a.average_watts || 0;
    const avgW = a.average_watts || np || 0;

    if (np <= 0) {
      z1Sec += movingSec * 0.7;
      z2Sec += movingSec * 0.3;
      continue;
    }

    const ifVal = np / ftp;
    const vi = avgW > 0 ? np / avgW : 1.05;

    // Distribute time based on continuous intensity kernel
    if (ifVal <= 0.60) {
      z1Sec += movingSec * 0.65;
      z2Sec += movingSec * 0.30;
      z3Sec += movingSec * 0.05;
    } else if (ifVal <= 0.75) {
      z1Sec += movingSec * 0.20;
      z2Sec += movingSec * 0.60;
      z3Sec += movingSec * 0.15;
      z4Sec += movingSec * 0.05;
    } else if (ifVal <= 0.88) {
      z1Sec += movingSec * 0.12;
      z2Sec += movingSec * 0.38;
      z3Sec += movingSec * 0.38;
      z4Sec += movingSec * 0.09;
      z5Sec += movingSec * 0.03;
    } else if (ifVal <= 0.98) {
      z1Sec += movingSec * 0.10;
      z2Sec += movingSec * 0.22;
      z3Sec += movingSec * 0.35;
      z4Sec += movingSec * 0.23;
      z5Sec += movingSec * 0.08;
      z6Sec += movingSec * 0.02;
    } else {
      z1Sec += movingSec * 0.12;
      z2Sec += movingSec * 0.16;
      z3Sec += movingSec * 0.22;
      z4Sec += movingSec * 0.26;
      z5Sec += movingSec * 0.14;
      z6Sec += movingSec * 0.07;
      z7Sec += movingSec * 0.03;
    }

    // Punchy rides (high VI) shift 4% into high zones
    if (vi > 1.15) {
      const punchShift = movingSec * 0.04;
      z2Sec = Math.max(0, z2Sec - punchShift);
      z5Sec += punchShift * 0.5;
      z6Sec += punchShift * 0.3;
      z7Sec += punchShift * 0.2;
    }
  }

  const totalSec = Math.max(1, z1Sec + z2Sec + z3Sec + z4Sec + z5Sec + z6Sec + z7Sec);

  const zones: PowerZoneItem[] = [
    {
      zone: 'Z1',
      name: '积极恢复',
      rangeWatts: `< ${z1Upper}W`,
      seconds: Math.round(z1Sec),
      hours: parseFloat((z1Sec / 3600).toFixed(1)),
      pct: parseFloat(((z1Sec / totalSec) * 100).toFixed(1)),
      colorHex: '#8E8E93',
      badgeBg: 'bg-slate-500/10 dark:bg-slate-400/20',
      badgeText: 'text-slate-600 dark:text-slate-400'
    },
    {
      zone: 'Z2',
      name: '基础有氧',
      rangeWatts: `${z1Upper + 1}-${z2Upper}W`,
      seconds: Math.round(z2Sec),
      hours: parseFloat((z2Sec / 3600).toFixed(1)),
      pct: parseFloat(((z2Sec / totalSec) * 100).toFixed(1)),
      colorHex: '#007AFF',
      badgeBg: 'bg-ios-blue/10 dark:bg-ios-blue/20',
      badgeText: 'text-ios-blue dark:text-ios-blue-dark'
    },
    {
      zone: 'Z3',
      name: '节奏骑行',
      rangeWatts: `${z2Upper + 1}-${z3Upper}W`,
      seconds: Math.round(z3Sec),
      hours: parseFloat((z3Sec / 3600).toFixed(1)),
      pct: parseFloat(((z3Sec / totalSec) * 100).toFixed(1)),
      colorHex: '#34C759',
      badgeBg: 'bg-ios-green/10 dark:bg-ios-green/20',
      badgeText: 'text-ios-green dark:text-ios-green-dark'
    },
    {
      zone: 'Z4',
      name: '乳酸阈值',
      rangeWatts: `${z3Upper + 1}-${z4Upper}W`,
      seconds: Math.round(z4Sec),
      hours: parseFloat((z4Sec / 3600).toFixed(1)),
      pct: parseFloat(((z4Sec / totalSec) * 100).toFixed(1)),
      colorHex: '#FFCC00',
      badgeBg: 'bg-ios-yellow/10 dark:bg-ios-yellow/20',
      badgeText: 'text-ios-yellow dark:text-ios-yellow-dark'
    },
    {
      zone: 'Z5',
      name: '最大摄氧量',
      rangeWatts: `${z4Upper + 1}-${z5Upper}W`,
      seconds: Math.round(z5Sec),
      hours: parseFloat((z5Sec / 3600).toFixed(1)),
      pct: parseFloat(((z5Sec / totalSec) * 100).toFixed(1)),
      colorHex: '#FF9500',
      badgeBg: 'bg-ios-orange/10 dark:bg-ios-orange/20',
      badgeText: 'text-ios-orange dark:text-ios-orange-dark'
    },
    {
      zone: 'Z6',
      name: '无氧耐力',
      rangeWatts: `${z5Upper + 1}-${z6Upper}W`,
      seconds: Math.round(z6Sec),
      hours: parseFloat((z6Sec / 3600).toFixed(1)),
      pct: parseFloat(((z6Sec / totalSec) * 100).toFixed(1)),
      colorHex: '#FF3B30',
      badgeBg: 'bg-ios-red/10 dark:bg-ios-red/20',
      badgeText: 'text-ios-red dark:text-ios-red-dark'
    },
    {
      zone: 'Z7',
      name: '神经肌肉冲刺',
      rangeWatts: `> ${z6Upper}W`,
      seconds: Math.round(z7Sec),
      hours: parseFloat((z7Sec / 3600).toFixed(1)),
      pct: parseFloat(((z7Sec / totalSec) * 100).toFixed(1)),
      colorHex: '#AF52DE',
      badgeBg: 'bg-ios-purple/10 dark:bg-ios-purple/20',
      badgeText: 'text-ios-purple dark:text-ios-purple-dark'
    }
  ];

  // Determine Pattern
  const basePct = zones[0].pct + zones[1].pct;
  const midPct = zones[2].pct + zones[3].pct;
  const highPct = zones[4].pct + zones[5].pct + zones[6].pct;

  let pattern: 'pyramidal' | 'polarized' | 'threshold' | 'unstructured' = 'unstructured';
  let patternLabel = '混合型训练结构';
  let patternDescription = '中低高各强度均匀分布，适合全地形自由出勤与日常骑聚。';

  if (basePct >= 68 && midPct >= 18 && highPct <= 14) {
    pattern = 'pyramidal';
    patternLabel = '金字塔型结构';
    patternDescription = '经典耐力赛季模型！低强度地基扎实，中高强度逐级递减，极其稳健防伤病。';
  } else if (basePct >= 72 && midPct <= 14 && highPct >= 12) {
    pattern = 'polarized';
    patternLabel = '两极化训练模型 80/20';
    patternDescription = '严格落实强弱分明法则！80% 极低心率排酸打底，20% 顶峰冲刺，极高效拉升摄氧量。';
  } else if (midPct >= 35) {
    pattern = 'threshold';
    patternLabel = '甜区/阈值集中型';
    patternDescription = '中高负荷占比偏高，易在短期内快速拉升 FTP，但需密切关注深层疲劳堆积与防爆缸。';
  }

  return {
    zones,
    totalMovingSec: Math.round(totalSec),
    pattern,
    patternLabel,
    patternDescription
  };
}

// -----------------------------------------------------------------------------
// 14. Weekly CTL Ramp Rate History & Safe Progression Window
// -----------------------------------------------------------------------------
export function computeRampRateHistory(
  pmcTimeline: PmcPoint[],
  weeksBack: number = 26
): RampRateHistoryResult {
  const historyPoints = pmcTimeline.filter(p => !p.isProjection);
  const weeks: RampRateWeekItem[] = [];

  const totalDays = historyPoints.length;
  let cautionWeeksCount = 0;
  let sumRamp = 0;
  let maxRamp = 0;

  for (let w = 0; w < weeksBack; w++) {
    const endIdx = totalDays - 1 - w * 7;
    const startIdx = endIdx - 7;
    if (startIdx < 0 || endIdx < 0) break;

    const endPoint = historyPoints[endIdx];
    const startPoint = historyPoints[startIdx];
    const deltaCtl = parseFloat((endPoint.ctl - startPoint.ctl).toFixed(1));
    sumRamp += deltaCtl;
    if (deltaCtl > maxRamp) maxRamp = deltaCtl;

    let status: 'recovery' | 'safe' | 'aggressive' | 'danger' = 'safe';
    let colorHex = '#007AFF';
    let bgToken = 'bg-ios-blue/10';
    let textToken = 'text-ios-blue';

    if (deltaCtl <= 0) {
      status = 'recovery';
      colorHex = '#34C759';
      bgToken = 'bg-ios-green/10';
      textToken = 'text-ios-green';
    } else if (deltaCtl <= 5) {
      status = 'safe';
      colorHex = '#007AFF';
      bgToken = 'bg-ios-blue/10';
      textToken = 'text-ios-blue';
    } else if (deltaCtl <= 8) {
      status = 'aggressive';
      colorHex = '#FF9500';
      bgToken = 'bg-ios-orange/10';
      textToken = 'text-ios-orange';
    } else {
      status = 'danger';
      colorHex = '#FF3B30';
      bgToken = 'bg-ios-red/10';
      textToken = 'text-ios-red';
      cautionWeeksCount++;
    }

    weeks.unshift({
      weekKey: `W${weeksBack - w}`,
      label: endPoint.shortDate,
      rampRate: deltaCtl,
      endCtl: endPoint.ctl,
      status,
      colorHex,
      bgToken,
      textToken
    });
  }

  const avgRamp = weeks.length > 0 ? parseFloat((sumRamp / weeks.length).toFixed(1)) : 0;

  return {
    weeks,
    maxRamp,
    avgRamp,
    cautionWeeksCount
  };
}

// -----------------------------------------------------------------------------
// 15. FTP History Tracking & eFTP Breakthrough Milestones
// -----------------------------------------------------------------------------
export function computeFtpHistory(
  activities: StravaActivityRecord[],
  currentFtp: number = 240,
  currentWeight: number = 68
): FtpHistoryResult {
  const safeFtp = Math.max(80, currentFtp);
  const safeWeight = Math.max(35, currentWeight);

  let savedList: FtpHistoryPoint[] = [];
  try {
    const raw = localStorage.getItem('yolo_cycling_ftp_history');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        savedList = parsed;
      }
    }
  } catch {
    // Fallback on memory
  }

  // If saved list is empty or single point, auto-backfill from historical activities
  if (savedList.length < 2 && activities.length > 0) {
    const sorted = [...activities]
      .filter(a => a.start_date)
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

    const monthlyBests = new Map<string, { date: string; bestW: number }>();
    for (const a of sorted) {
      const ym = a.start_date.substring(0, 7);
      const np = a.weighted_average_watts || a.average_watts || 0;
      if (np > 100) {
        const prev = monthlyBests.get(ym);
        if (!prev || np > prev.bestW) {
          monthlyBests.set(ym, { date: a.start_date.split('T')[0], bestW: np });
        }
      }
    }

    const points: FtpHistoryPoint[] = [];
    let runningFtp = Math.max(140, Math.round(safeFtp * 0.88));

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const startYm = oneYearAgo.toISOString().split('T')[0];

    points.push({
      id: 'ftp-seed',
      date: startYm,
      shortDate: `${oneYearAgo.getMonth() + 1}/${oneYearAgo.getDate()}`,
      ftpWatts: runningFtp,
      wkg: parseFloat((runningFtp / safeWeight).toFixed(2)),
      source: 'initial',
      note: '赛季基准起点'
    });

    for (const [_, item] of monthlyBests) {
      if (item.bestW > runningFtp) {
        runningFtp = Math.min(safeFtp, Math.round(item.bestW));
        const dt = new Date(item.date);
        points.push({
          id: `ftp-bt-${item.date}`,
          date: item.date,
          shortDate: `${dt.getMonth() + 1}/${dt.getDate()}`,
          ftpWatts: runningFtp,
          wkg: parseFloat((runningFtp / safeWeight).toFixed(2)),
          source: 'breakthrough',
          note: '大负荷骑行 eFTP 自动突破'
        });
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date();
    if (points[points.length - 1].ftpWatts !== safeFtp || points[points.length - 1].date !== todayStr) {
      points.push({
        id: 'ftp-now',
        date: todayStr,
        shortDate: `${today.getMonth() + 1}/${today.getDate()}`,
        ftpWatts: safeFtp,
        wkg: parseFloat((safeFtp / safeWeight).toFixed(2)),
        source: 'manual',
        note: '当前设定值'
      });
    }

    savedList = points;
    try {
      localStorage.setItem('yolo_cycling_ftp_history', JSON.stringify(savedList));
    } catch {
      // storage guard
    }
  } else if (savedList.length > 0) {
    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date();
    const lastPoint = savedList[savedList.length - 1];
    if (lastPoint.ftpWatts !== safeFtp) {
      if (lastPoint.date === todayStr) {
        lastPoint.ftpWatts = safeFtp;
        lastPoint.wkg = parseFloat((safeFtp / safeWeight).toFixed(2));
      } else {
        savedList.push({
          id: `ftp-${Date.now()}`,
          date: todayStr,
          shortDate: `${today.getMonth() + 1}/${today.getDate()}`,
          ftpWatts: safeFtp,
          wkg: parseFloat((safeFtp / safeWeight).toFixed(2)),
          source: 'manual',
          note: '当前设定值'
        });
      }
      try {
        localStorage.setItem('yolo_cycling_ftp_history', JSON.stringify(savedList));
      } catch {
        // storage guard
      }
    }
  }

  const startFtp = savedList[0]?.ftpWatts || safeFtp;
  const peakFtp = Math.max(...savedList.map(p => p.ftpWatts), safeFtp);
  const gainWatts = safeFtp - startFtp;
  const gainPct = parseFloat(((gainWatts / Math.max(1, startFtp)) * 100).toFixed(1));

  return {
    timeline: savedList,
    currentFtp: safeFtp,
    currentWkg: parseFloat((safeFtp / safeWeight).toFixed(2)),
    startFtp,
    gainWatts,
    gainPct,
    peakFtp
  };
}

// -----------------------------------------------------------------------------
// 16. Personal Records (PR) Progression Timeline
// -----------------------------------------------------------------------------
export function computePersonalRecordsTimeline(
  activities: StravaActivityRecord[]
): PersonalRecordItem[] {
  if (!activities || activities.length === 0) return [];

  const sorted = [...activities]
    .filter(a => a.start_date)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  const prs: PersonalRecordItem[] = [];

  let maxDistM = 30000;      // Initial threshold: 30 km
  let maxElevM = 200;        // Initial threshold: 200 m
  let maxDurationSec = 3600; // Initial threshold: 1 hour
  let maxNpWatts = 180;      // Initial threshold: 180W NP
  let maxSpeedKmh = 40.0;    // Initial threshold: 40 km/h

  for (const a of sorted) {
    const actDate = a.start_date.split('T')[0];
    const dt = new Date(a.start_date);
    const shortDate = `${dt.getMonth() + 1}/${dt.getDate()}`;
    const actName = a.name || '骑行活动';

    // 1. Distance PR
    if (a.distance && a.distance > maxDistM) {
      const prevKm = parseFloat((maxDistM / 1000).toFixed(1));
      const newKm = parseFloat((a.distance / 1000).toFixed(1));
      const impPct = Math.round(((newKm - prevKm) / prevKm) * 100);
      maxDistM = a.distance;
      prs.push({
        id: `pr-dist-${a.id}`,
        type: 'distance',
        label: '单次最长里程突破',
        value: newKm,
        formattedValue: `${newKm} km`,
        unit: 'km',
        date: actDate,
        shortDate,
        activityId: a.id,
        activityName: actName,
        previousValue: prevKm,
        improvementPct: impPct
      });
    }

    // 2. Elevation PR
    if (a.total_elevation_gain && a.total_elevation_gain > maxElevM) {
      const prevM = maxElevM;
      const newM = Math.round(a.total_elevation_gain);
      const impPct = Math.round(((newM - prevM) / prevM) * 100);
      maxElevM = a.total_elevation_gain;
      prs.push({
        id: `pr-ele-${a.id}`,
        type: 'elevation',
        label: '单日爬升新记录',
        value: newM,
        formattedValue: `+${newM} m`,
        unit: 'm',
        date: actDate,
        shortDate,
        activityId: a.id,
        activityName: actName,
        previousValue: prevM,
        improvementPct: impPct
      });
    }

    // 3. Duration PR
    if (a.moving_time && a.moving_time > maxDurationSec) {
      const prevHrs = parseFloat((maxDurationSec / 3600).toFixed(1));
      const newHrs = parseFloat((a.moving_time / 3600).toFixed(1));
      const impPct = Math.round(((newHrs - prevHrs) / prevHrs) * 100);
      maxDurationSec = a.moving_time;
      prs.push({
        id: `pr-dur-${a.id}`,
        type: 'duration',
        label: '鞍上最长续航突破',
        value: newHrs,
        formattedValue: `${newHrs} 小时`,
        unit: '小时',
        date: actDate,
        shortDate,
        activityId: a.id,
        activityName: actName,
        previousValue: prevHrs,
        improvementPct: impPct
      });
    }

    // 4. Power PR (NP)
    const np = a.weighted_average_watts || 0;
    if (np > maxNpWatts && (a.moving_time || 0) >= 1200) {
      const prevW = maxNpWatts;
      const impPct = Math.round(((np - prevW) / prevW) * 100);
      maxNpWatts = np;
      prs.push({
        id: `pr-pow-${a.id}`,
        type: 'power',
        label: '最高加权功率突破',
        value: np,
        formattedValue: `${np} W`,
        unit: 'W',
        date: actDate,
        shortDate,
        activityId: a.id,
        activityName: actName,
        previousValue: prevW,
        improvementPct: impPct
      });
    }

    // 5. Max Speed PR
    const currentSpeed = parseFloat(((a.max_speed || 0) * 3.6).toFixed(1));
    if (currentSpeed > maxSpeedKmh && currentSpeed < 125) {
      const prevSpd = maxSpeedKmh;
      const impPct = Math.round(((currentSpeed - prevSpd) / prevSpd) * 100);
      maxSpeedKmh = currentSpeed;
      prs.push({
        id: `pr-spd-${a.id}`,
        type: 'speed',
        label: '下坡/冲刺最高极速',
        value: currentSpeed,
        formattedValue: `${currentSpeed} km/h`,
        unit: 'km/h',
        date: actDate,
        shortDate,
        activityId: a.id,
        activityName: actName,
        previousValue: prevSpd,
        improvementPct: impPct
      });
    }
  }

  return prs.reverse();
}

// -----------------------------------------------------------------------------
// 17. Aerobic Efficiency Factor (EF = NP / HR)
// -----------------------------------------------------------------------------
export function computeAerobicEfficiency(
  activities: StravaActivityRecord[]
): AerobicEfficiencyResult {
  const eligibleRides: { date: string; activityName: string; ef: number; np: number; hr: number }[] = [];

  for (const a of activities) {
    const np = a.weighted_average_watts || a.average_watts || 0;
    const hr = a.average_heartrate || 0;
    const movingSec = a.moving_time || 0;

    if (np >= 80 && hr >= 50 && movingSec >= 1200) {
      const ef = parseFloat((np / hr).toFixed(2));
      eligibleRides.push({
        date: a.start_date.split('T')[0],
        activityName: a.name || '骑行活动',
        ef,
        np,
        hr
      });
    }
  }

  if (eligibleRides.length === 0) {
    return {
      avgEf: 0,
      ridesWithEfCount: 0,
      trend: 'stable',
      trendPct: 0,
      recentEf: []
    };
  }

  const sumEf = eligibleRides.reduce((acc, r) => acc + r.ef, 0);
  const avgEf = parseFloat((sumEf / eligibleRides.length).toFixed(2));

  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  let trendPct = 0;

  if (eligibleRides.length >= 6) {
    const half = Math.floor(eligibleRides.length / 2);
    const olderRides = eligibleRides.slice(0, half);
    const newerRides = eligibleRides.slice(half);

    const oldAvg = olderRides.reduce((acc, r) => acc + r.ef, 0) / olderRides.length;
    const newAvg = newerRides.reduce((acc, r) => acc + r.ef, 0) / newerRides.length;

    trendPct = parseFloat((((newAvg - oldAvg) / Math.max(0.1, oldAvg)) * 100).toFixed(1));
    if (trendPct >= 3.0) trend = 'improving';
    else if (trendPct <= -3.0) trend = 'declining';
  }

  return {
    avgEf,
    ridesWithEfCount: eligibleRides.length,
    trend,
    trendPct,
    recentEf: eligibleRides.slice(-8).reverse()
  };
}

// -----------------------------------------------------------------------------
// 18. Client-side Data Export (CSV with UTF-8 BOM & JSON)
// -----------------------------------------------------------------------------
export function exportActivitiesToCsv(activities: StravaActivityRecord[]): string {
  const headers = [
    '活动ID', '活动名称', '日期', '类型', '骑行距离(km)', '累计爬升(m)',
    '移动用时(分)', '平均速度(km/h)', '最高速度(km/h)', '平均功率(W)',
    'NP标准化功率(W)', 'TSS训练负荷', 'IF强度系数', '平均心率(bpm)', '最高心率(bpm)', '消耗热量(kcal)'
  ];

  const rows = activities.map(a => {
    const distKm = parseFloat(((a.distance || 0) / 1000).toFixed(2));
    const movingMin = Math.round((a.moving_time || 0) / 60);
    const avgSpeedKmh = parseFloat(((a.average_speed || 0) * 3.6).toFixed(1));
    const maxSpeedKmh = parseFloat(((a.max_speed || 0) * 3.6).toFixed(1));
    const dateStr = a.start_date ? a.start_date.split('T')[0] : '';
    const safeName = `"${(a.name || '骑行活动').replace(/"/g, '""')}"`;

    return [
      a.id,
      safeName,
      dateStr,
      a.sport_type || a.type || 'Ride',
      distKm,
      Math.round(a.total_elevation_gain || 0),
      movingMin,
      avgSpeedKmh,
      maxSpeedKmh,
      a.average_watts || '',
      a.weighted_average_watts || '',
      a.tss || '',
      a.intensityFactor || '',
      a.average_heartrate || '',
      a.max_heartrate || '',
      a.kilojoules ? Math.round(a.kilojoules * 1.05) : ''
    ].join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\n');
}

export function exportActivitiesToJson(activities: StravaActivityRecord[]): string {
  return JSON.stringify(activities, null, 2);
}

// -----------------------------------------------------------------------------
// 19. Strava Segments & Efforts Analytics
// -----------------------------------------------------------------------------
export interface SegmentSummaryStats {
  totalSegments: number;
  komCount: number;
  prCount: number;
  totalGainM: number;
  totalDistanceKm: number;
  totalAttempts: number;
  avgGradePct: number;
}

export function computeSegmentSummaryStats(segments: StravaSegmentItem[]): SegmentSummaryStats {
  if (!segments || segments.length === 0) {
    return {
      totalSegments: 0,
      komCount: 0,
      prCount: 0,
      totalGainM: 0,
      totalDistanceKm: 0,
      totalAttempts: 0,
      avgGradePct: 0
    };
  }

  let totalDistM = 0;
  let totalGainM = 0;
  let totalGrade = 0;
  let komCount = 0;
  let prCount = 0;
  let totalAttempts = 0;

  for (const s of segments) {
    totalDistM += s.distance || 0;
    totalGainM += s.total_elevation_gain || 0;
    totalGrade += s.average_grade || 0;
    totalAttempts += s.athlete_attempts || 0;

    if (s.athlete_pr_effort) {
      prCount++;
      if (s.kom_time && s.athlete_pr_effort.elapsed_time <= s.kom_time) {
        komCount++;
      }
    }
  }

  return {
    totalSegments: segments.length,
    komCount,
    prCount,
    totalGainM: Math.round(totalGainM),
    totalDistanceKm: parseFloat((totalDistM / 1000).toFixed(1)),
    totalAttempts,
    avgGradePct: parseFloat((totalGrade / segments.length).toFixed(1))
  };
}


