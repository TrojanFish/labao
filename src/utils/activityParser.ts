import { Decoder, Stream } from '@garmin/fitsdk';

export interface ActivityPoint {
  time: number; // Elapsed seconds from ride start
  timestamp?: Date;
  distance: number; // Cumulative meters
  power?: number; // Watts
  heartRate?: number; // BPM
  cadence?: number; // RPM
  speed?: number; // km/h
  altitude?: number; // meters
  lat?: number;
  lon?: number;
}

export interface PowerZoneDistribution {
  zone: string;
  label: string;
  labelEn: string;
  range: string;
  minWatts: number;
  maxWatts: number;
  seconds: number;
  percent: number;
  color: string;
}

export interface HrZoneDistribution {
  zone: string;
  label: string;
  labelEn: string;
  range: string;
  minBpm: number;
  maxBpm: number;
  seconds: number;
  percent: number;
  color: string;
}

export interface MmpValue {
  durationSec: number;
  label: string;
  watts: number;
  wkg: number;
}

export interface DeviceInfo {
  deviceIndex?: number | string;
  deviceType?: string | number;
  productName?: string;
  manufacturer?: string | number;
  serialNumber?: number;
  batteryStatus?: string | number;
  batteryVoltage?: number;
  sourceType?: string | number;
  antplusDeviceType?: string | number;
  hasDataRecorded: boolean;
}

export interface ElectronicShiftingEvent {
  timeSec: number;
  frontGearNum?: number;
  rearGearNum?: number;
  frontGear?: number;
  rearGear?: number;
  gearRatio?: number;
}

export interface SensorDiagnostics {
  hasHardwarePower: boolean;
  hasHardwareCadence: boolean;
  hasHeartRate: boolean;
  hasSpeed: boolean;
  hasShifting: boolean;
  devices: DeviceInfo[];
  detectedNotes: string[];
}

export interface LeftRightBalance {
  leftPercent: number;
  rightPercent: number;
}

export interface ActivityAnalysis {
  fileName: string;
  fileType: 'fit' | 'gpx' | 'tcx' | 'demo' | 'strava';
  totalDurationSec: number;
  movingTimeSec: number;
  totalDistanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  avgPower: number;
  maxPower: number;
  normalizedPower: number; // NP
  intensityFactor: number; // IF
  tss: number; // Training Stress Score
  variabilityIndex: number; // VI = NP / avgPower
  efficiencyFactor?: number; // EF = NP / avgHR
  aerobicDecoupling?: number; // Pw:HR % drift
  workKj: number;
  caloriesKcal: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgCadence?: number;
  maxCadence?: number;
  pedalingPercent?: number;
  leftRightBalance?: LeftRightBalance;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  timeInPowerZones: PowerZoneDistribution[];
  timeInHrZones: HrZoneDistribution[];
  mmp: MmpValue[];
  points: ActivityPoint[];
  sampledPoints: ActivityPoint[]; // Downsampled for smooth chart rendering
  isEstimatedPower?: boolean;
  sensorDiagnostics?: SensorDiagnostics;
  shiftingEvents?: ElectronicShiftingEvent[];
  shiftCount?: number;
  recordedCalories?: number;
  rawPoints?: ActivityPoint[];
}

/**
 * Calculates Normalized Power (NP) using the Coggan algorithm:
 * 1. 30-second rolling average of power
 * 2. Raise 30s values to the 4th power
 * 3. Average the 4th powers
 * 4. Take the 4th root
 */
export function calculateNormalizedPower(powerValues: number[]): number {
  if (!powerValues || powerValues.length < 30) {
    if (!powerValues || powerValues.length === 0) return 0;
    const sum = powerValues.reduce((a, b) => a + b, 0);
    return Math.round(sum / powerValues.length);
  }

  const rolling30s: number[] = [];
  let rollingSum = 0;

  for (let i = 0; i < powerValues.length; i++) {
    rollingSum += powerValues[i];
    if (i >= 30) {
      rollingSum -= powerValues[i - 30];
      rolling30s.push(rollingSum / 30);
    } else if (i === 29) {
      rolling30s.push(rollingSum / 30);
    }
  }

  if (rolling30s.length === 0) return 0;

  const sumFourthPowers = rolling30s.reduce((acc, p) => acc + Math.pow(p, 4), 0);
  const avgFourthPower = sumFourthPowers / rolling30s.length;
  return Math.round(Math.pow(avgFourthPower, 0.25));
}

export interface CogganBenchmarkLevel {
  level: string;
  label: string;
  color: string;
  wkg5s: number;
  wkg1m: number;
  wkg5m: number;
  wkg20m: number;
  wkg60m: number;
}

export const COGGAN_BENCHMARKS: CogganBenchmarkLevel[] = [
  { level: 'world_tour', label: '世巡职业级', color: '#FF2D55', wkg5s: 23.5, wkg1m: 11.5, wkg5m: 7.6, wkg20m: 6.7, wkg60m: 6.4 },
  { level: 'cat1', label: '国家精英级', color: '#AF52DE', wkg5s: 20.0, wkg1m: 9.6, wkg5m: 5.8, wkg20m: 5.2, wkg60m: 4.9 },
  { level: 'cat2', label: '省级健将级', color: '#007AFF', wkg5s: 17.5, wkg1m: 8.4, wkg5m: 5.0, wkg20m: 4.4, wkg60m: 4.2 },
  { level: 'cat3', label: '俱乐部高阶', color: '#34C759', wkg5s: 15.2, wkg1m: 7.3, wkg5m: 4.3, wkg20m: 3.7, wkg60m: 3.5 },
  { level: 'cat4', label: '进阶骑手', color: '#FF9500', wkg5s: 13.0, wkg1m: 6.2, wkg5m: 3.6, wkg20m: 3.1, wkg60m: 2.9 },
  { level: 'cat5', label: '业余入门', color: '#8E8E93', wkg5s: 10.5, wkg1m: 5.0, wkg5m: 2.8, wkg20m: 2.4, wkg60m: 2.3 }
];

export interface WPrimeBalanceResult {
  cpWatts: number;
  wPrimeJoules: number;
  minWPrimeJoules: number;
  minWPrimePercent: number;
  minPointSec: number;
  matchesBurned: number;
  workAboveCpKj: number;
  timeAboveCpSec: number;
  dataPoints: {
    timeSec: number;
    power: number;
    wBalJoules: number;
    wBalPercent: number;
  }[];
}

/**
 * Calculates Mean Maximal Power (MMP) curve for high-resolution durations
 */
export function calculateMmpCurve(points: ActivityPoint[], riderWeightKg: number): MmpValue[] {
  const durations = [
    { sec: 1, label: '1s' },
    { sec: 5, label: '5s' },
    { sec: 10, label: '10s' },
    { sec: 15, label: '15s' },
    { sec: 30, label: '30s' },
    { sec: 60, label: '1m' },
    { sec: 120, label: '2m' },
    { sec: 180, label: '3m' },
    { sec: 300, label: '5m' },
    { sec: 480, label: '8m' },
    { sec: 600, label: '10m' },
    { sec: 720, label: '12m' },
    { sec: 900, label: '15m' },
    { sec: 1200, label: '20m' },
    { sec: 1800, label: '30m' },
    { sec: 2700, label: '45m' },
    { sec: 3600, label: '60m' }
  ];

  const powers = points.map(p => p.power ?? 0);
  const results: MmpValue[] = [];

  for (const d of durations) {
    if (powers.length < d.sec) continue;

    let maxWindowSum = 0;
    let currentWindowSum = 0;

    for (let i = 0; i < d.sec; i++) {
      currentWindowSum += powers[i];
    }
    maxWindowSum = currentWindowSum;

    for (let i = d.sec; i < powers.length; i++) {
      currentWindowSum += powers[i] - powers[i - d.sec];
      if (currentWindowSum > maxWindowSum) {
        maxWindowSum = currentWindowSum;
      }
    }

    const peakWatts = Math.round(maxWindowSum / d.sec);
    results.push({
      durationSec: d.sec,
      label: d.label,
      watts: peakWatts,
      wkg: parseFloat((peakWatts / (riderWeightKg || 68)).toFixed(2))
    });
  }

  return results;
}

/**
 * Calculates Skiba (2012) W' Balance dynamic anaerobic energy depletion and reconstitution
 */
export function calculateSkibaWPrimeBalance(
  points: ActivityPoint[],
  cpWatts: number,
  wPrimeJoules = 20000,
  downsampleTarget = 300
): WPrimeBalanceResult {
  if (!points || points.length === 0) {
    return {
      cpWatts,
      wPrimeJoules,
      minWPrimeJoules: wPrimeJoules,
      minWPrimePercent: 100,
      minPointSec: 0,
      matchesBurned: 0,
      workAboveCpKj: 0,
      timeAboveCpSec: 0,
      dataPoints: []
    };
  }

  let currentWBal = wPrimeJoules;
  let minWBal = wPrimeJoules;
  let minSec = 0;
  let matchesBurned = 0;
  let isInDeepDeficit = false;
  let workAboveCp = 0;
  let timeAboveCp = 0;

  const rawSeries: { timeSec: number; power: number; wBalJoules: number; wBalPercent: number }[] = [];

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const power = pt.power ?? 0;
    const dt = i === 0 ? 1 : Math.max(1, Math.min(5, pt.time - points[i - 1].time));

    if (power > cpWatts) {
      const expJ = (power - cpWatts) * dt;
      currentWBal = Math.max(0, currentWBal - expJ);
      workAboveCp += expJ;
      timeAboveCp += dt;
    } else {
      // Dynamic exponential recovery based on Skiba (2012) tau
      const diff = cpWatts - power;
      const tau = 546 * Math.exp(-0.01 * diff) + 316;
      currentWBal = wPrimeJoules - (wPrimeJoules - currentWBal) * Math.exp(-dt / tau);
      currentWBal = Math.min(wPrimeJoules, Math.max(0, currentWBal));
    }

    const pct = Math.round((currentWBal / wPrimeJoules) * 100);

    if (pct < 30 && !isInDeepDeficit) {
      matchesBurned++;
      isInDeepDeficit = true;
    } else if (pct >= 35 && isInDeepDeficit) {
      isInDeepDeficit = false;
    }

    if (currentWBal < minWBal) {
      minWBal = currentWBal;
      minSec = pt.time;
    }

    rawSeries.push({
      timeSec: pt.time,
      power,
      wBalJoules: Math.round(currentWBal),
      wBalPercent: pct
    });
  }

  // Downsample for smooth chart rendering
  let dataPoints = rawSeries;
  if (rawSeries.length > downsampleTarget) {
    const step = rawSeries.length / downsampleTarget;
    dataPoints = [];
    for (let i = 0; i < downsampleTarget; i++) {
      const idx = Math.min(Math.floor(i * step), rawSeries.length - 1);
      dataPoints.push(rawSeries[idx]);
    }
    if (dataPoints[dataPoints.length - 1] !== rawSeries[rawSeries.length - 1]) {
      dataPoints.push(rawSeries[rawSeries.length - 1]);
    }
  }

  return {
    cpWatts,
    wPrimeJoules,
    minWPrimeJoules: Math.round(minWBal),
    minWPrimePercent: Math.round((minWBal / wPrimeJoules) * 100),
    minPointSec: minSec,
    matchesBurned,
    workAboveCpKj: parseFloat((workAboveCp / 1000).toFixed(1)),
    timeAboveCpSec: Math.round(timeAboveCp),
    dataPoints
  };
}

/**
 * Downsample points for fluid 60fps chart rendering on mobile devices
 */
export function downsamplePoints(points: ActivityPoint[], targetCount = 600): ActivityPoint[] {
  if (points.length <= targetCount) return points;

  const step = points.length / targetCount;
  const sampled: ActivityPoint[] = [];

  for (let i = 0; i < targetCount; i++) {
    const idx = Math.min(Math.floor(i * step), points.length - 1);
    sampled.push(points[idx]);
  }

  return sampled;
}

/**
 * Physics-based dynamic cycling power simulation to reconstruct estimated power
 * when a ride has GPS, elevation, speed, and rider weight, but lacks a hardware power meter.
 */
export function computeEstimatedPowerPoints(
  rawPoints: ActivityPoint[],
  riderWeightKg = 68,
  bikeWeightKg = 9,
  crr = 0.004,
  cda = 0.32,
  rho = 1.205
): ActivityPoint[] {
  if (!rawPoints || rawPoints.length === 0) return [];

  const totalMass = (riderWeightKg || 68) + (bikeWeightKg || 9);
  const g = 9.80665;
  const eta = 0.975; // Drivetrain mechanical efficiency

  // Smooth speeds using 3-point moving average to eliminate GPS micro-jitter
  const smoothedSpeeds = rawPoints.map((pt, i) => {
    const s = pt.speed ?? 0;
    const p = i > 0 ? (rawPoints[i - 1].speed ?? s) : s;
    const n = i < rawPoints.length - 1 ? (rawPoints[i + 1].speed ?? s) : s;
    return (p + s + n) / 3;
  });

  return rawPoints.map((pt, i) => {
    const speedKmh = smoothedSpeeds[i];
    const speedMs = speedKmh / 3.6;

    // Stationary or extremely slow (walking / waiting at light)
    if (speedMs < 0.8) {
      return { ...pt, power: 0 };
    }

    // Slope calculation
    let slope = 0;
    const window = 4;
    const pIdx = Math.max(0, i - window);
    const nIdx = Math.min(rawPoints.length - 1, i + window);
    const dDist = rawPoints[nIdx].distance - rawPoints[pIdx].distance;
    if (
      dDist > 10 &&
      rawPoints[nIdx].altitude !== undefined &&
      rawPoints[pIdx].altitude !== undefined
    ) {
      const dAlt = rawPoints[nIdx].altitude! - rawPoints[pIdx].altitude!;
      slope = Math.max(-0.25, Math.min(0.25, dAlt / dDist));
    }

    // Acceleration calculation
    let accel = 0;
    if (i > 0) {
      const dt = Math.max(1, pt.time - rawPoints[i - 1].time);
      const prevSpeedMs = smoothedSpeeds[i - 1] / 3.6;
      accel = (speedMs - prevSpeedMs) / dt;
      accel = Math.max(-1.5, Math.min(1.5, accel));
    }

    // Forces (Newtons)
    const theta = Math.atan(slope);
    const fGravity = totalMass * g * Math.sin(theta);
    const fRolling = totalMass * g * crr * Math.cos(theta);
    const fAero = 0.5 * rho * cda * Math.pow(speedMs, 2);
    const fAccel = accel > 0 ? totalMass * accel * 0.75 : 0;

    const fTotal = fGravity + fRolling + fAero + fAccel;
    let powerWatts = (fTotal * speedMs) / eta;

    // Downhill coasting detector: steep descent (slope < -1.5%) or negative total force
    if (slope < -0.015 || powerWatts < 15) {
      powerWatts = 0;
    }

    // Realistic upper bound cap (850W for road cycling simulation)
    powerWatts = Math.max(0, Math.min(850, Math.round(powerWatts)));

    return {
      ...pt,
      power: powerWatts
    };
  });
}

/**
 * Core analysis engine computing all Coggan physiological training metrics
 */
export function analyzePoints(
  rawPoints: ActivityPoint[],
  fileName: string,
  fileType: 'fit' | 'gpx' | 'tcx' | 'demo' | 'strava',
  ftpWatts = 240,
  weightKg = 68,
  maxHr = 185,
  options?: {
    isEstimatedPower?: boolean;
    sensorDiagnostics?: SensorDiagnostics;
    shiftingEvents?: ElectronicShiftingEvent[];
    recordedCalories?: number;
    rawPoints?: ActivityPoint[];
    leftRightBalance?: LeftRightBalance;
  }
): ActivityAnalysis {
  if (rawPoints.length === 0) {
    throw new Error('航迹点列表为空，无法解析活动指标');
  }

  // Ensure monotonic time & distance
  const points: ActivityPoint[] = [];
  let prevTime = 0;
  let prevDist = 0;

  for (let i = 0; i < rawPoints.length; i++) {
    const pt = rawPoints[i];
    const t = pt.time !== undefined && !isNaN(pt.time) ? pt.time : (i === 0 ? 0 : prevTime + 1);
    const d = pt.distance !== undefined && !isNaN(pt.distance) ? pt.distance : prevDist;
    points.push({ ...pt, time: t, distance: d });
    prevTime = t;
    prevDist = d;
  }

  const totalDurationSec = points.length > 1 ? Math.max(1, points[points.length - 1].time - points[0].time) : 1;
  const totalDistanceKm = points.length > 0 ? (points[points.length - 1].distance - points[0].distance) / 1000 : 0;

  // Moving time calculation: where speed > 1 km/h or cadence > 0 or power > 0
  let movingPointsCount = 0;
  let sumPower = 0;
  let maxPower = 0;
  let sumHr = 0;
  let hrCount = 0;
  let maxHrObserved = 0;
  let sumCadence = 0;
  let cadenceCount = 0;
  let maxCadence = 0;
  let pedalingCount = 0;
  let maxSpeedKmh = 0;
  let elevationGainM = 0;
  let elevationLossM = 0;

  const validPowers: number[] = [];

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const power = p.power ?? 0;
    const speed = p.speed ?? 0;
    const hr = p.heartRate ?? 0;
    const cad = p.cadence ?? 0;

    const isMoving = speed > 1.2 || cad > 0 || power > 15;
    if (isMoving) movingPointsCount++;

    if (power > 0) {
      validPowers.push(power);
      sumPower += power;
      if (power > maxPower) maxPower = power;
    } else {
      validPowers.push(0);
    }

    if (hr > 30) {
      sumHr += hr;
      hrCount++;
      if (hr > maxHrObserved) maxHrObserved = hr;
    }

    if (cad > 0) {
      sumCadence += cad;
      cadenceCount++;
      pedalingCount++;
      if (cad > maxCadence) maxCadence = cad;
    }

    if (speed > maxSpeedKmh) maxSpeedKmh = speed;

    if (i > 0 && p.altitude !== undefined && points[i - 1].altitude !== undefined) {
      const dEle = p.altitude - points[i - 1].altitude!;
      if (dEle > 0.3) elevationGainM += dEle;
      else if (dEle < -0.3) elevationLossM += Math.abs(dEle);
    }
  }

  // Calculate moving time: handle both 1Hz telemetry and sparse/smart-recorded intervals
  let movingTimeSec = 0;
  const isOneHz = points.length > 1 && (points[points.length - 1].time - points[0].time) <= points.length;

  if (isOneHz) {
    // Standard 1Hz recording: each point represents 1 second
    movingTimeSec = Math.max(1, movingPointsCount > 0 ? movingPointsCount : totalDurationSec);
  } else if (points.length > 1) {
    // Non-1Hz recording (e.g. smart recording GPX, course trackpoints): accumulate interval deltas
    for (let i = 1; i < points.length; i++) {
      const pPrev = points[i - 1];
      const pCurr = points[i];
      const dt = Math.max(0, pCurr.time - pPrev.time);
      if (dt === 0) continue;

      const intervalSpeed = ((pCurr.distance - pPrev.distance) / dt) * 3.6;
      const isMoving =
        (pCurr.speed ?? intervalSpeed) > 1.2 ||
        (pPrev.speed ?? intervalSpeed) > 1.2 ||
        (pCurr.cadence ?? 0) > 0 ||
        (pCurr.power ?? 0) > 15;

      if (isMoving) {
        movingTimeSec += dt;
      }
    }
    movingTimeSec = Math.max(1, movingTimeSec > 0 ? movingTimeSec : totalDurationSec);
  } else {
    movingTimeSec = 1;
  }

  const avgPower = validPowers.length > 0 ? Math.round(sumPower / validPowers.length) : 0;
  const normalizedPower = calculateNormalizedPower(validPowers);
  const intensityFactor = parseFloat((normalizedPower / (ftpWatts || 240)).toFixed(3));
  const tss = Math.round(((movingTimeSec * normalizedPower * intensityFactor) / ((ftpWatts || 240) * 3600)) * 100);
  const variabilityIndex = avgPower > 0 ? parseFloat((normalizedPower / avgPower).toFixed(2)) : 1.0;

  const avgHeartRate = hrCount > 0 ? Math.round(sumHr / hrCount) : undefined;
  const avgCadence = cadenceCount > 0 ? Math.round(sumCadence / cadenceCount) : undefined;
  const pedalingPercent = points.length > 0 ? Math.round((pedalingCount / points.length) * 100) : undefined;
  const avgSpeedKmh = movingTimeSec > 0 ? parseFloat(((totalDistanceKm / (movingTimeSec / 3600))).toFixed(1)) : 0;

  const efficiencyFactor = avgHeartRate && avgHeartRate > 0 ? parseFloat((normalizedPower / avgHeartRate).toFixed(2)) : undefined;

  // Aerobic Decoupling (Pw:HR drift between 1st half and 2nd half)
  let aerobicDecoupling: number | undefined = undefined;
  if (validPowers.length >= 600 && hrCount >= 600) {
    const half = Math.floor(points.length / 2);
    const p1 = validPowers.slice(0, half);
    const p2 = validPowers.slice(half);
    const hr1Pts = points.slice(0, half).filter(pt => (pt.heartRate ?? 0) > 40);
    const hr2Pts = points.slice(half).filter(pt => (pt.heartRate ?? 0) > 40);

    if (hr1Pts.length > 60 && hr2Pts.length > 60) {
      const np1 = calculateNormalizedPower(p1);
      const np2 = calculateNormalizedPower(p2);
      const avgHr1 = hr1Pts.reduce((acc, cur) => acc + cur.heartRate!, 0) / hr1Pts.length;
      const avgHr2 = hr2Pts.reduce((acc, cur) => acc + cur.heartRate!, 0) / hr2Pts.length;

      if (avgHr1 > 0 && avgHr2 > 0) {
        const ef1 = np1 / avgHr1;
        const ef2 = np2 / avgHr2;
        aerobicDecoupling = parseFloat((((ef1 - ef2) / ef1) * 100).toFixed(1));
      }
    }
  }

  // Work in kJ and estimated Calories (assuming 24% human gross mechanical efficiency)
  // For 1Hz, sumPower * 1; for variable delta, avgPower * movingTimeSec
  const workJoules = isOneHz ? sumPower : avgPower * movingTimeSec;
  const workKj = Math.round(workJoules / 1000);
  let caloriesKcal = Math.round(workKj / 1.05); // 1 kJ ≈ 1 kcal at ~24% gross mechanical efficiency
  if ((workKj === 0 || caloriesKcal === 0) && options?.recordedCalories && options.recordedCalories > 0) {
    caloriesKcal = options.recordedCalories;
  }

  // Coggan 7 Power Zones
  const pFtp = ftpWatts || 240;
  const powerZoneDefs = [
    { zone: 'Z1', label: '主动恢复', labelEn: 'Active Recovery', min: 0, max: Math.round(pFtp * 0.55), color: '#94a3b8' },
    { zone: 'Z2', label: '有氧耐力', labelEn: 'Endurance', min: Math.round(pFtp * 0.55), max: Math.round(pFtp * 0.75), color: '#3b82f6' },
    { zone: 'Z3', label: '节奏区间', labelEn: 'Tempo', min: Math.round(pFtp * 0.75), max: Math.round(pFtp * 0.90), color: '#10b981' },
    { zone: 'Z4', label: '乳酸阈值', labelEn: 'Lactate Threshold', min: Math.round(pFtp * 0.90), max: Math.round(pFtp * 1.05), color: '#f59e0b' },
    { zone: 'Z5', label: '最大摄氧', labelEn: 'VO2 Max', min: Math.round(pFtp * 1.05), max: Math.round(pFtp * 1.20), color: '#f97316' },
    { zone: 'Z6', label: '无氧能力', labelEn: 'Anaerobic Capacity', min: Math.round(pFtp * 1.20), max: Math.round(pFtp * 1.50), color: '#ef4444' },
    { zone: 'Z7', label: '神经冲刺', labelEn: 'Neuromuscular', min: Math.round(pFtp * 1.50), max: 9999, color: '#a855f7' }
  ];

  const zoneSeconds = new Array(powerZoneDefs.length).fill(0);
  for (const pw of validPowers) {
    for (let z = 0; z < powerZoneDefs.length; z++) {
      if (pw >= powerZoneDefs[z].min && (pw < powerZoneDefs[z].max || z === powerZoneDefs.length - 1)) {
        zoneSeconds[z]++;
        break;
      }
    }
  }

  const timeInPowerZones: PowerZoneDistribution[] = powerZoneDefs.map((def, idx) => ({
    zone: def.zone,
    label: def.label,
    labelEn: def.labelEn,
    range: def.max >= 9999 ? `>${def.min}W` : `${def.min}-${def.max}W`,
    minWatts: def.min,
    maxWatts: def.max,
    seconds: zoneSeconds[idx],
    percent: validPowers.length > 0 ? parseFloat(((zoneSeconds[idx] / validPowers.length) * 100).toFixed(1)) : 0,
    color: def.color
  }));

  // Heart Rate 5 Zones
  const effMaxHr = maxHr || 185;
  const hrZoneDefs = [
    { zone: 'Z1', label: '热身恢复', labelEn: 'Warm Up', min: 0, max: Math.round(effMaxHr * 0.60), color: '#94a3b8' },
    { zone: 'Z2', label: '燃脂耐力', labelEn: 'Easy', min: Math.round(effMaxHr * 0.60), max: Math.round(effMaxHr * 0.70), color: '#3b82f6' },
    { zone: 'Z3', label: '有氧糖原', labelEn: 'Aerobic', min: Math.round(effMaxHr * 0.70), max: Math.round(effMaxHr * 0.80), color: '#10b981' },
    { zone: 'Z4', label: '乳酸阈值', labelEn: 'Threshold', min: Math.round(effMaxHr * 0.80), max: Math.round(effMaxHr * 0.90), color: '#f59e0b' },
    { zone: 'Z5', label: '极限无氧', labelEn: 'Maximum', min: Math.round(effMaxHr * 0.90), max: 250, color: '#ef4444' }
  ];

  const hrZoneSeconds = new Array(hrZoneDefs.length).fill(0);
  let totalHrSeconds = 0;
  for (const pt of points) {
    const hr = pt.heartRate ?? 0;
    if (hr > 30) {
      totalHrSeconds++;
      for (let z = 0; z < hrZoneDefs.length; z++) {
        if (hr >= hrZoneDefs[z].min && (hr < hrZoneDefs[z].max || z === hrZoneDefs.length - 1)) {
          hrZoneSeconds[z]++;
          break;
        }
      }
    }
  }

  const timeInHrZones: HrZoneDistribution[] = hrZoneDefs.map((def, idx) => ({
    zone: def.zone,
    label: def.label,
    labelEn: def.labelEn,
    range: `${def.min}-${def.max}bpm`,
    minBpm: def.min,
    maxBpm: def.max,
    seconds: hrZoneSeconds[idx],
    percent: totalHrSeconds > 0 ? parseFloat(((hrZoneSeconds[idx] / totalHrSeconds) * 100).toFixed(1)) : 0,
    color: def.color
  }));

  // Mean Maximal Power (MMP)
  const mmp = calculateMmpCurve(points, weightKg || 68);

  return {
    fileName,
    fileType,
    totalDurationSec,
    movingTimeSec,
    totalDistanceKm: parseFloat(totalDistanceKm.toFixed(2)),
    elevationGainM: Math.round(elevationGainM),
    elevationLossM: Math.round(elevationLossM),
    avgPower,
    maxPower,
    normalizedPower,
    intensityFactor,
    tss,
    variabilityIndex,
    efficiencyFactor,
    aerobicDecoupling,
    workKj,
    caloriesKcal,
    avgHeartRate,
    maxHeartRate: maxHrObserved > 0 ? maxHrObserved : undefined,
    avgCadence,
    maxCadence: maxCadence > 0 ? maxCadence : undefined,
    pedalingPercent,
    avgSpeedKmh,
    maxSpeedKmh: parseFloat(maxSpeedKmh.toFixed(1)),
    timeInPowerZones,
    timeInHrZones,
    mmp,
    points,
    sampledPoints: downsamplePoints(points, 600),
    isEstimatedPower: options?.isEstimatedPower ?? false,
    sensorDiagnostics: options?.sensorDiagnostics,
    shiftingEvents: options?.shiftingEvents,
    shiftCount: options?.shiftingEvents?.length,
    recordedCalories: options?.recordedCalories,
    rawPoints: options?.rawPoints ?? rawPoints,
    leftRightBalance: options?.leftRightBalance
  };
}

/**
 * Decode Garmin binary .FIT file
 */
export async function parseFitFile(
  file: File,
  ftpWatts = 240,
  weightKg = 68,
  maxHr = 185
): Promise<ActivityAnalysis> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const stream = Stream.fromByteArray(bytes);
  const decoder = new Decoder(stream);

  const { messages, errors } = decoder.read({
    includeUnknownData: true,
    expandSubFields: true,
    expandComponents: true
  });
  if (errors && errors.length > 0 && (!messages || !messages.recordMesgs)) {
    throw new Error(`FIT 文件解析异常: ${errors[0].message || '格式无法识别'}`);
  }

  const recordMesgs = messages?.recordMesgs || [];
  if (recordMesgs.length === 0) {
    throw new Error('该 FIT 文件中未提取到有效的骑行记录点');
  }

  // Build developer fields map to decode custom power/cadence data
  const devFieldMap = new Map<number, { fieldName: string; nativeFieldNum?: number; nativeMesgNum?: number }>();
  if (messages?.fieldDescriptionMesgs) {
    for (const rawFd of messages.fieldDescriptionMesgs) {
      const fd = rawFd as any;
      if (fd.key !== undefined) {
        devFieldMap.set(Number(fd.key), {
          fieldName: String(fd.fieldName || ''),
          nativeFieldNum: typeof fd.nativeFieldNum === 'number' ? fd.nativeFieldNum : undefined,
          nativeMesgNum: typeof fd.nativeMesgNum === 'number' ? fd.nativeMesgNum : undefined
        });
      }
    }
  }

  const points: ActivityPoint[] = [];
  const lrSamples: number[] = [];
  let baseTimestamp: number | null = null;
  let maxRecordedCalories = 0;

  for (let i = 0; i < recordMesgs.length; i++) {
    const r: any = recordMesgs[i];
    const ts = r.timestamp instanceof Date ? r.timestamp.getTime() / 1000 : (typeof r.timestamp === 'number' ? r.timestamp : i);
    if (baseTimestamp === null) baseTimestamp = ts;
    const elapsed = Math.max(0, Math.round(ts - (baseTimestamp !== null ? baseTimestamp : ts)));

    // Garmin coordinates in semicircles
    let lat: number | undefined = undefined;
    let lon: number | undefined = undefined;
    if (r.positionLat !== undefined && r.positionLat !== null) {
      lat = parseFloat((r.positionLat * (180 / 2147483648)).toFixed(6));
    }
    if (r.positionLong !== undefined && r.positionLong !== null) {
      lon = parseFloat((r.positionLong * (180 / 2147483648)).toFixed(6));
    }

    const dist = r.distance !== undefined && r.distance !== null ? r.distance : (i * 7);
    const speedKmh = r.speed !== undefined && r.speed !== null ? parseFloat((r.speed * 3.6).toFixed(1)) : undefined;

    // Developer fields extraction
    let devPower: number | undefined = undefined;
    let devCadence: number | undefined = undefined;
    if (r.developerFields && typeof r.developerFields === 'object') {
      for (const [kStr, val] of Object.entries(r.developerFields)) {
        const kNum = Number(kStr);
        const desc = devFieldMap.get(kNum);
        const numVal = typeof val === 'number' ? val : (typeof val === 'string' ? parseFloat(val) : undefined);
        if (numVal !== undefined && !isNaN(numVal)) {
          if (desc) {
            const nameLower = desc.fieldName.toLowerCase();
            if (desc.nativeFieldNum === 7 || nameLower === 'power' || nameLower === 'watts' || nameLower.includes('power')) {
              devPower = numVal;
            } else if (desc.nativeFieldNum === 4 || nameLower === 'cadence' || nameLower.includes('cadence') || nameLower === 'rpm') {
              devCadence = numVal;
            }
          }
        }
      }
    }

    // Power resolution (supporting standard power, watts, motorPower, devPower)
    const rawPower = r.power ?? r.watts ?? r.instantaneousPower ?? (r.motorPower !== undefined ? r.motorPower : undefined) ?? devPower;
    const powerVal = rawPower !== undefined && rawPower !== null && !isNaN(rawPower) ? Math.round(rawPower) : undefined;

    // Cadence resolution (supporting standard cadence, cadence256, fractionalCadence, devCadence)
    let rawCad = r.cadence ?? r.cadence256 ?? devCadence;
    if (rawCad !== undefined && r.fractionalCadence !== undefined) {
      rawCad = rawCad + r.fractionalCadence;
    } else if (rawCad === undefined && r.fractionalCadence !== undefined) {
      rawCad = r.fractionalCadence;
    }
    const cadenceVal = rawCad !== undefined && rawCad !== null && !isNaN(rawCad) ? Math.round(rawCad) : undefined;

    if (r.calories !== undefined && typeof r.calories === 'number' && r.calories > maxRecordedCalories) {
      maxRecordedCalories = Math.round(r.calories);
    }

    // Left-Right Balance decoding (Garmin FIT protocol native field)
    const rawLr = r.leftRightBalance ?? r.left_right_balance;
    if (rawLr !== undefined && rawLr !== null && typeof rawLr === 'number') {
      let isRight = false;
      let rightPct = 50;
      if (rawLr > 1000) {
        // 16-bit 0.01%
        isRight = (rawLr & 0x8000) !== 0;
        const val = (rawLr & 0x7FFF) / 100;
        rightPct = isRight ? val : 100 - val;
      } else {
        // 8-bit standard FIT
        isRight = (rawLr & 0x80) !== 0;
        const val = rawLr & 0x7F;
        rightPct = isRight ? val : 100 - val;
      }
      if (rightPct >= 10 && rightPct <= 90) {
        lrSamples.push(rightPct);
      }
    }

    points.push({
      time: elapsed,
      timestamp: r.timestamp instanceof Date ? r.timestamp : undefined,
      distance: dist,
      power: powerVal,
      heartRate: r.heartRate !== undefined && r.heartRate !== null ? Math.round(r.heartRate) : undefined,
      cadence: cadenceVal,
      speed: speedKmh,
      altitude: r.altitude !== undefined && r.altitude !== null ? parseFloat(r.altitude.toFixed(1)) : undefined,
      lat,
      lon
    });
  }

  // Extract electronic shifting events (Shimano Di2, SRAM eTap, Campagnolo EPS)
  const shiftingEvents: ElectronicShiftingEvent[] = [];
  if (messages?.eventMesgs) {
    for (const ev of messages.eventMesgs) {
      if (
        ev.event === 'rearGearChange' ||
        ev.event === 'frontGearChange' ||
        ev.frontGearNum !== undefined ||
        ev.rearGearNum !== undefined
      ) {
        const evTs = ev.timestamp instanceof Date ? ev.timestamp.getTime() / 1000 : (typeof ev.timestamp === 'number' ? ev.timestamp : 0);
        const elapsed = baseTimestamp !== null ? Math.max(0, Math.round(evTs - baseTimestamp)) : 0;
        shiftingEvents.push({
          timeSec: elapsed,
          frontGearNum: ev.frontGearNum,
          rearGearNum: ev.rearGearNum,
          frontGear: ev.frontGear,
          rearGear: ev.rearGear,
          gearRatio: ev.frontGear && ev.rearGear ? parseFloat((ev.frontGear / ev.rearGear).toFixed(2)) : undefined
        });
      }
    }
  }

  // Device & Sensor status evaluation
  const hasHardwarePower = points.some(p => p.power !== undefined && p.power > 0);
  const hasHardwareCadence = points.some(p => p.cadence !== undefined && p.cadence > 0);
  const hasHeartRate = points.some(p => p.heartRate !== undefined && p.heartRate > 30);
  const hasSpeed = points.some(p => p.speed !== undefined && p.speed > 0);
  const hasShifting = shiftingEvents.length > 0;

  const devices: DeviceInfo[] = [];
  const devInfoList = messages?.deviceInfoMesgs || [];
  const seenDeviceKeys = new Set<string>();

  for (const d of devInfoList) {
    const key = `${d.deviceType}_${d.antplusDeviceType}_${d.productName}_${d.manufacturer}`;
    if (seenDeviceKeys.has(key)) continue;
    seenDeviceKeys.add(key);

    let recorded = false;
    if (d.antplusDeviceType === 'bikePower' || d.deviceType === 11) recorded = hasHardwarePower;
    else if (d.antplusDeviceType === 'bikeCadence' || d.antplusDeviceType === 'bikeSpeedCadence' || d.deviceType === 122) recorded = hasHardwareCadence;
    else if (d.antplusDeviceType === 'heartRate' || d.deviceType === 120) recorded = hasHeartRate;
    else if (d.antplusDeviceType === 'shifting' || d.deviceType === 34) recorded = hasShifting;
    else if (d.antplusDeviceType === 'bikeSpeed' || d.deviceType === 123) recorded = hasSpeed;

    devices.push({
      deviceIndex: d.deviceIndex as any,
      deviceType: d.deviceType as any,
      productName: d.productName ? String(d.productName) : undefined,
      manufacturer: d.manufacturer as any,
      serialNumber: d.serialNumber ?? d.antDeviceNumber,
      batteryStatus: d.batteryStatus as any,
      batteryVoltage: d.batteryVoltage,
      sourceType: d.sourceType as any,
      antplusDeviceType: d.antplusDeviceType as any,
      hasDataRecorded: recorded
    });
  }

  // Build intelligent diagnostic notes
  const detectedNotes: string[] = [];

  const powerDev = devices.find(d => d.antplusDeviceType === 'bikePower' || d.deviceType === 11);
  if (hasHardwarePower) {
    detectedNotes.push('硬件功率计数据流正常采集。');
  } else if (powerDev) {
    const name = `${powerDev.manufacturer ? String(powerDev.manufacturer).toUpperCase() + ' ' : ''}${powerDev.productName || '功率计'}`;
    detectedNotes.push(`码表配对设备中存在「${name}」，但本次骑行未接收到功率数据流（可能功率计未开机、电池耗尽或 ANT+ 连接中断）。`);
  } else {
    detectedNotes.push('本次骑行未检测到硬件功率计数据流。');
  }

  const cadenceDev = devices.find(d => d.antplusDeviceType === 'bikeCadence' || d.antplusDeviceType === 'bikeSpeedCadence' || d.deviceType === 122);
  if (hasHardwareCadence) {
    detectedNotes.push('踏频传感器数据流正常采集。');
  } else if (cadenceDev) {
    const name = `${cadenceDev.manufacturer ? String(cadenceDev.manufacturer).toUpperCase() + ' ' : ''}${cadenceDev.productName || '踏频计'}`;
    detectedNotes.push(`码表配对设备中存在「${name}」，但本次骑行未接收到踏频数据流。`);
  } else {
    detectedNotes.push('本次骑行未检测到独立踏频数据流。');
  }

  if (hasShifting) {
    const shiftDev = devices.find(d => d.antplusDeviceType === 'shifting' || d.deviceType === 34);
    const name = shiftDev ? `${shiftDev.manufacturer ? String(shiftDev.manufacturer).toUpperCase() + ' ' : ''}${shiftDev.productName || '电子变速'}` : '电子变速';
    detectedNotes.push(`检测到 ${name} 系统，全程共记录 ${shiftingEvents.length} 次换挡操作。`);
  }

  const sensorDiagnostics: SensorDiagnostics = {
    hasHardwarePower,
    hasHardwareCadence,
    hasHeartRate,
    hasSpeed,
    hasShifting,
    devices,
    detectedNotes
  };

  const sessionCalories = messages?.sessionMesgs?.[0]?.totalCalories;
  const recordedCalories = sessionCalories && sessionCalories > 0 ? sessionCalories : (maxRecordedCalories > 0 ? maxRecordedCalories : undefined);

  let leftRightBalance: LeftRightBalance | undefined = undefined;
  const rawSessionLr = messages?.sessionMesgs?.[0]?.leftRightBalance ?? (messages?.sessionMesgs?.[0] as any)?.avg_left_right_balance;
  if (rawSessionLr !== undefined && typeof rawSessionLr === 'number') {
    const isRight = rawSessionLr > 1000 ? (rawSessionLr & 0x8000) !== 0 : (rawSessionLr & 0x80) !== 0;
    const val = rawSessionLr > 1000 ? (rawSessionLr & 0x7FFF) / 100 : (rawSessionLr & 0x7F);
    const rPct = Math.round(isRight ? val : 100 - val);
    if (rPct >= 10 && rPct <= 90) {
      leftRightBalance = { leftPercent: 100 - rPct, rightPercent: rPct };
    }
  } else if (lrSamples.length > 0) {
    const avgR = Math.round(lrSamples.reduce((a, b) => a + b, 0) / lrSamples.length);
    if (avgR >= 10 && avgR <= 90) {
      leftRightBalance = { leftPercent: 100 - avgR, rightPercent: avgR };
    }
  }

  return analyzePoints(points, file.name, 'fit', ftpWatts, weightKg, maxHr, {
    isEstimatedPower: false,
    sensorDiagnostics,
    shiftingEvents,
    recordedCalories,
    rawPoints: points,
    leftRightBalance
  });
}

/**
 * Decode standard XML .GPX file (including Garmin TrackPointExtensions with hr, cad, power)
 */
export async function parseGpxFile(
  file: File,
  ftpWatts = 240,
  weightKg = 68,
  maxHr = 185
): Promise<ActivityAnalysis> {
  const text = await file.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'text/xml');

  let trkpts = xml.getElementsByTagName('trkpt');
  if (trkpts.length === 0) trkpts = xml.getElementsByTagName('rtept');

  if (trkpts.length < 2) {
    throw new Error('未能从 GPX 文件中提取到有效的航迹坐标点');
  }

  const points: ActivityPoint[] = [];
  let prevDist = 0;
  let prevLat = 0;
  let prevLon = 0;
  let baseTime: number | null = null;

  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  for (let i = 0; i < trkpts.length; i++) {
    const pt = trkpts[i];
    const lat = parseFloat(pt.getAttribute('lat') || '0');
    const lon = parseFloat(pt.getAttribute('lon') || '0');

    let ele: number | undefined = undefined;
    const eleElem = pt.getElementsByTagName('ele')[0];
    if (eleElem && eleElem.textContent) ele = parseFloat(eleElem.textContent);

    let timeSec = i;
    const timeElem = pt.getElementsByTagName('time')[0];
    if (timeElem && timeElem.textContent) {
      const parsed = new Date(timeElem.textContent).getTime() / 1000;
      if (!isNaN(parsed)) {
        if (baseTime === null) baseTime = parsed;
        timeSec = Math.round(parsed - (baseTime !== null ? baseTime : parsed));
      }
    }

    if (i > 0) {
      prevDist += haversine(prevLat, prevLon, lat, lon);
    }
    prevLat = lat;
    prevLon = lon;

    // Look for power, hr, cadence inside extensions
    let power: number | undefined = undefined;
    let hr: number | undefined = undefined;
    let cad: number | undefined = undefined;

    const pwElem = pt.getElementsByTagName('power')[0] || pt.getElementsByTagName('watts')[0];
    if (pwElem && pwElem.textContent) power = parseFloat(pwElem.textContent);

    const hrElem = pt.getElementsByTagName('hr')[0] || pt.getElementsByTagName('gpxtpx:hr')[0];
    if (hrElem && hrElem.textContent) hr = parseFloat(hrElem.textContent);

    const cadElem = pt.getElementsByTagName('cad')[0] || pt.getElementsByTagName('gpxtpx:cad')[0];
    if (cadElem && cadElem.textContent) cad = parseFloat(cadElem.textContent);

    points.push({
      time: timeSec,
      distance: Math.round(prevDist),
      power: power !== undefined && !isNaN(power) ? Math.round(power) : undefined,
      heartRate: hr !== undefined && !isNaN(hr) ? Math.round(hr) : undefined,
      cadence: cad !== undefined && !isNaN(cad) ? Math.round(cad) : undefined,
      altitude: ele,
      lat,
      lon
    });
  }

  // Derive speeds from distance and time deltas
  for (let i = 1; i < points.length; i++) {
    const dt = points[i].time - points[i - 1].time;
    const dd = points[i].distance - points[i - 1].distance;
    if (dt > 0) {
      points[i].speed = parseFloat(((dd / dt) * 3.6).toFixed(1));
    }
  }

  return analyzePoints(points, file.name, 'gpx', ftpWatts, weightKg, maxHr, { rawPoints: points });
}

/**
 * Decode XML .TCX file (Garmin Training Center XML)
 */
export async function parseTcxFile(
  file: File,
  ftpWatts = 240,
  weightKg = 68,
  maxHr = 185
): Promise<ActivityAnalysis> {
  const text = await file.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'text/xml');

  const trackpoints = xml.getElementsByTagName('Trackpoint');
  if (trackpoints.length < 2) {
    throw new Error('未能从 TCX 文件中提取到有效的 Trackpoint 记录');
  }

  const points: ActivityPoint[] = [];
  let baseTime: number | null = null;

  for (let i = 0; i < trackpoints.length; i++) {
    const tp = trackpoints[i];

    let timeSec = i;
    const timeElem = tp.getElementsByTagName('Time')[0];
    if (timeElem && timeElem.textContent) {
      const parsed = new Date(timeElem.textContent).getTime() / 1000;
      if (!isNaN(parsed)) {
        if (baseTime === null) baseTime = parsed;
        timeSec = Math.round(parsed - (baseTime !== null ? baseTime : parsed));
      }
    }

    let dist = i * 7;
    const distElem = tp.getElementsByTagName('DistanceMeters')[0];
    if (distElem && distElem.textContent) dist = parseFloat(distElem.textContent);

    let ele: number | undefined = undefined;
    const eleElem = tp.getElementsByTagName('AltitudeMeters')[0];
    if (eleElem && eleElem.textContent) ele = parseFloat(eleElem.textContent);

    let hr: number | undefined = undefined;
    const hrElem = tp.getElementsByTagName('HeartRateBpm')[0]?.getElementsByTagName('Value')[0];
    if (hrElem && hrElem.textContent) hr = parseFloat(hrElem.textContent);

    let cad: number | undefined = undefined;
    const cadElem = tp.getElementsByTagName('Cadence')[0];
    if (cadElem && cadElem.textContent) cad = parseFloat(cadElem.textContent);

    let power: number | undefined = undefined;
    const pwElem = tp.getElementsByTagName('Watts')[0];
    if (pwElem && pwElem.textContent) power = parseFloat(pwElem.textContent);

    points.push({
      time: timeSec,
      distance: Math.round(dist),
      power: power !== undefined && !isNaN(power) ? Math.round(power) : undefined,
      heartRate: hr !== undefined && !isNaN(hr) ? Math.round(hr) : undefined,
      cadence: cad !== undefined && !isNaN(cad) ? Math.round(cad) : undefined,
      altitude: ele
    });
  }

  return analyzePoints(points, file.name, 'tcx', ftpWatts, weightKg, maxHr, { rawPoints: points });
}

/**
 * Generates an authentic, highly detailed 85km undulating Grand Tour classic climb & sprint training ride
 */
export function generateRealisticDemoRide(
  ftpWatts = 250,
  weightKg = 68,
  maxHr = 188
): ActivityAnalysis {
  const points: ActivityPoint[] = [];
  const durationSec = 5400; // 90 minutes / 1.5 hours
  let currentDistance = 0;
  let currentAltitude = 120; // Starts at 120m

  // Generate 1-second records with realistic physiological dynamics
  for (let t = 0; t < durationSec; t++) {
    const minute = t / 60;
    let targetPower = 0;
    let targetCadence = 88;
    let gradient = 0;

    if (minute < 12) {
      // Phase 1: Warmup Z2 (12 mins)
      const progress = minute / 12;
      targetPower = Math.round(ftpWatts * (0.50 + 0.18 * progress));
      targetCadence = 86 + Math.sin(t / 10) * 3;
      gradient = 0.5 + Math.sin(t / 50) * 0.5;
    } else if (minute < 40) {
      // Phase 2: Category 2 Mountain Climb (28 mins) - SweetSpot Z4 effort
      const climbProgress = (minute - 12) / 28;
      gradient = 5.5 + Math.sin(t / 45) * 2.8 + (climbProgress > 0.8 ? 2.5 : 0); // 5% to 9.5%
      targetPower = Math.round(ftpWatts * (0.88 + 0.12 * Math.sin(t / 60) + (climbProgress > 0.85 ? 0.15 : 0)));
      targetCadence = 78 + Math.sin(t / 15) * 5;
    } else if (minute < 52) {
      // Phase 3: High-speed Technical Descent (12 mins) - Recovery Z1
      gradient = -6.5 + Math.sin(t / 40) * 2.0;
      targetPower = Math.max(0, Math.round(35 + Math.sin(t / 20) * 45));
      targetCadence = targetPower > 20 ? 82 : 0; // Coasting intermittently
    } else if (minute < 72) {
      // Phase 4: Rolling Hills Paceline / Breakaway Z3/Z4 (20 mins)
      gradient = 1.8 * Math.sin(t / 30);
      targetPower = Math.round(ftpWatts * (0.80 + 0.16 * Math.sin(t / 40)));
      targetCadence = 92 + Math.sin(t / 12) * 4;
    } else if (minute < 76) {
      // Phase 5: Final Punchy Hill Attack (4 mins) - VO2max Z5
      gradient = 8.0;
      targetPower = Math.round(ftpWatts * 1.25 + Math.sin(t / 8) * 35);
      targetCadence = 84 + Math.sin(t / 10) * 6;
    } else if (minute < 80) {
      // Phase 6: Final 200m Sprint Finish (4 mins setup + 30s all-out sprint)
      if (minute < 79.5) {
        gradient = 0;
        targetPower = Math.round(ftpWatts * 0.95);
        targetCadence = 98;
      } else {
        // All-out sprint
        gradient = 0;
        targetPower = Math.round(ftpWatts * 3.8 + Math.sin(t / 3) * 60); // ~950W sprint
        targetCadence = 118;
      }
    } else {
      // Phase 7: Cooldown Z1 (10 mins)
      gradient = -0.5;
      targetPower = Math.round(ftpWatts * 0.42);
      targetCadence = 85;
    }

    // Add high-frequency micro-variations
    const noise = (Math.sin(t * 1.3) + Math.cos(t * 0.7)) * 8;
    const finalPower = Math.max(0, Math.round(targetPower + noise));

    // Dynamic speed based on power and gradient
    let speedKmh = 32;
    if (gradient > 0) {
      speedKmh = Math.max(8, 28 - gradient * 2.2 + (finalPower - ftpWatts) * 0.04);
    } else {
      speedKmh = Math.min(72, 38 + Math.abs(gradient) * 3.6 + finalPower * 0.02);
    }
    speedKmh = Math.max(0, parseFloat(speedKmh.toFixed(1)));

    // Cumulative distance and elevation
    const distDeltaMeters = (speedKmh * 1000) / 3600;
    currentDistance += distDeltaMeters;
    currentAltitude += (distDeltaMeters * gradient) / 100;

    // Physiological heart rate lag with cardiac drift
    const hrRatio = Math.min(1.0, finalPower / (ftpWatts * 1.15));
    const baselineHr = 100 + hrRatio * (maxHr - 105);
    const cardiacDrift = (minute / 90) * 7; // ~7 bpm cardiac drift over 90 mins
    const finalHr = Math.min(maxHr + 2, Math.round(baselineHr + cardiacDrift + Math.sin(t / 8) * 2));

    points.push({
      time: t,
      distance: Math.round(currentDistance),
      power: finalPower,
      heartRate: finalHr,
      cadence: Math.round(targetCadence),
      speed: speedKmh,
      altitude: parseFloat(currentAltitude.toFixed(1))
    });
  }

  return analyzePoints(
    points,
    '千岛湖经典起伏丘陵实测.fit',
    'demo',
    ftpWatts,
    weightKg,
    maxHr,
    {
      leftRightBalance: { leftPercent: 49, rightPercent: 51 }
    }
  );
}
