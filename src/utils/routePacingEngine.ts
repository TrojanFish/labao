/**
 * Route Pacing & Aerodynamic Strategy Engine (Best Bike Split style physics solver)
 * 
 * Computes:
 * 1. Great-circle spherical forward bearing and Haversine distance
 * 2. Barometric air density via International Standard Atmosphere (ISA)
 * 3. Gradient profiling and micro-segmentation with Apple HIG semantic colors
 * 4. Environmental wind vector decomposition (headwind, tailwind, crosswind)
 * 5. Energy-optimized dynamic target power allocation (gradient & wind pacing)
 * 6. Newton-Raphson / Bisection numerical equilibrium speed solver
 * 7. Normalized Power (NP), Intensity Factor (IF), TSS, and glycogen/hydration requirements
 */

export interface RouteCoordinate {
  lat: number;
  lng: number;
  elevation: number;
  name?: string;
}

export type GradientCategory =
  | 'downhill'       // < -1.5%
  | 'flat'           // -1.5% to 2%
  | 'mild_climb'     // 2% to 5%
  | 'moderate_climb' // 5% to 8.5%
  | 'steep_climb'    // 8.5% to 12%
  | 'extreme_hc';    // > 12%

export type WindRelation =
  | 'headwind'        // 0° - 45°
  | 'cross_headwind' // 45° - 80°
  | 'crosswind'      // 80° - 100°
  | 'cross_tailwind' // 100° - 135°
  | 'tailwind';      // 135° - 180°

export interface CourseSegment {
  id: string;
  index: number;
  startDistKm: number;
  endDistKm: number;
  distKm: number;
  distM: number;
  startEleM: number;
  endEleM: number;
  eleDeltaM: number;
  gradePct: number;
  bearingDeg: number;
  lat: number;
  lng: number;
  gradientCategory: GradientCategory;
  color: string;
  gradientLabel: string;
  
  // Aero & Climate
  airDensityRho: number;
  localTempC?: number;
  safeDescentCornerKmh?: number;
  relativeWindAngleDeg: number;
  headwindComponentMs: number; // positive = headwind, negative = tailwind
  crosswindComponentMs: number;
  windRelation: WindRelation;
  windRelationLabel: string;

  // Pacing Outputs
  targetWatts: number;
  targetWkg: number;
  targetFtpPct: number;
  speedKmh: number;
  speedMs: number;
  durationSec: number;
  durationStr: string;
  vam: number; // m/h
  workKj: number;
}

export interface PacingEngineOptions {
  ftpWatts: number;
  riderWeightKg: number;
  bikeWeightKg: number;
  cda: number;
  crr: number;
  drivetrainEfficiency?: number; // default 0.975 (97.5%)
  windSpeedKmh: number;
  windDirectionDeg: number; // 0° = North, 90° = East, 180° = South, 270° = West (direction wind is blowing FROM)
  ambientTempC: number;
  strategyMode: 'conservative' | 'balanced' | 'aggressive';
}

export interface CoursePacingSummary {
  totalDistanceKm: number;
  totalElevationGainM: number;
  totalDescentM: number;
  avgGradePct: number;
  maxGradePct: number;
  totalDurationSec: number;
  totalDurationFormatted: string;
  avgSpeedKmh: number;
  avgWatts: number;
  normalizedPowerWatts: number;
  intensityFactor: number;
  trainingStressScore: number;
  totalWorkKj: number;
  estCaloriesKcal: number;
  
  // Wind breakdown
  headwindDistKm: number;
  headwindPct: number;
  tailwindDistKm: number;
  tailwindPct: number;
  crosswindDistKm: number;
  crosswindPct: number;
  avgAirDensity: number;

  // Metabolic Nutrition Plan
  nutrition: {
    recommendedCarbsPerHourG: number;
    totalCarbsG: number;
    energyGelsCount: number;
    recommendedFluidPerHourMl: number;
    totalFluidMl: number;
    hydrationBottlesCount: number;
    sodiumMgPerHour: number;
  };

  // Terrain summary
  climbDistanceKm: number;
  flatDistanceKm: number;
  descentDistanceKm: number;

  segments: CourseSegment[];
}

/**
 * Great-circle distance using Haversine formula (in meters)
 */
export function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Spherical forward azimuth bearing (in degrees, 0°~360°)
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return ((theta * 180) / Math.PI + 360) % 360;
}

/**
 * International Standard Atmosphere (ISA) air density formula
 * p = p0 * (1 - 0.0000225577 * h)^5.25588
 * rho = p / (R_specific * T)
 */
export function calculateAirDensity(elevationM: number, tempC: number): number {
  const p0 = 101325; // standard sea level atmospheric pressure (Pa)
  const T = tempC + 273.15; // absolute temperature in Kelvin
  const safeElevation = Math.max(0, elevationM);
  const pressure = p0 * Math.pow(1 - 0.0000225577 * safeElevation, 5.25588);
  const rho = pressure / (287.05 * T);
  return parseFloat(rho.toFixed(3));
}

/**
 * Calculates environmental lapse rate adjusted temperature and air density at given elevation.
 * Standard atmospheric lapse rate: -0.0065 °C / m (-0.65 °C per 100 meters).
 */
export function calculateLapseRateAirDensity(
  elevationM: number,
  baseElevationM: number,
  baseTempC: number
): { localTempC: number; airDensityRho: number } {
  const deltaElev = Math.max(0, elevationM - baseElevationM);
  const localTempC = parseFloat((baseTempC - deltaElev * 0.0065).toFixed(1));
  const airDensityRho = calculateAirDensity(elevationM, localTempC);
  return { localTempC, airDensityRho };
}

/**
 * Calculates maximum safe cornering speed on descents based on centrifugal force and tire grip.
 * v_max = sqrt(mu * g * R)
 * @param cornerRadiusM Corner radius in meters (e.g. 15m for hairpin switchback, 35m for sweeping curve)
 * @param surfaceCondition 'dry' | 'wet' | 'gravel'
 */
export function calculateCorneringCentrifugalLimit(
  cornerRadiusM: number,
  surfaceCondition: 'dry' | 'wet' | 'gravel' = 'dry'
): { maxSpeedMs: number; maxSpeedKmh: number; warning: string } {
  const g = 9.80665;
  const mu = surfaceCondition === 'wet' ? 0.45 : surfaceCondition === 'gravel' ? 0.35 : 0.80;
  const maxSpeedMs = Math.sqrt(Math.max(1, mu * g * cornerRadiusM));
  const maxSpeedKmh = parseFloat((maxSpeedMs * 3.6).toFixed(1));
  const warning = maxSpeedKmh < 35
    ? `急弯/发卡弯极限安全过弯速度 ${maxSpeedKmh} km/h，入弯前必须充分减速制动防侧滑离心甩出！`
    : `缓弯极限过弯速度 ${maxSpeedKmh} km/h，注意倾角压弯与对向车流。`;
  return {
    maxSpeedMs,
    maxSpeedKmh,
    warning
  };
}

/**
 * Decompose ambient wind vector relative to the segment's traveling direction
 */
export function decomposeWind(bearingDeg: number, windDirectionFromDeg: number, windSpeedKmh: number) {
  const windMs = windSpeedKmh / 3.6;
  // Angle difference between rider heading and the direction wind blows FROM
  const diff = Math.abs(bearingDeg - windDirectionFromDeg) % 360;
  const relativeAngle = diff > 180 ? 360 - diff : diff;

  // Headwind component: if relativeAngle is 0° (traveling straight into wind), headwind = +windMs
  // If relativeAngle is 180° (wind coming from directly behind), headwind = -windMs (tailwind)
  const headwindComponentMs = parseFloat((windMs * Math.cos((relativeAngle * Math.PI) / 180)).toFixed(2));
  const crosswindComponentMs = parseFloat((windMs * Math.sin((relativeAngle * Math.PI) / 180)).toFixed(2));

  let windRelation: WindRelation = 'headwind';
  let windRelationLabel = '强顶风';

  if (relativeAngle <= 45) {
    windRelation = 'headwind';
    windRelationLabel = '强顶风';
  } else if (relativeAngle <= 80) {
    windRelation = 'cross_headwind';
    windRelationLabel = '侧顶风';
  } else if (relativeAngle <= 100) {
    windRelation = 'crosswind';
    windRelationLabel = '纯侧风';
  } else if (relativeAngle <= 135) {
    windRelation = 'cross_tailwind';
    windRelationLabel = '侧顺风';
  } else {
    windRelation = 'tailwind';
    windRelationLabel = '顺风推进';
  }

  return {
    relativeWindAngleDeg: Math.round(relativeAngle),
    headwindComponentMs,
    crosswindComponentMs,
    windRelation,
    windRelationLabel
  };
}

/**
 * Categorize gradient into Apple HIG color tokens and taxonomy
 */
export function categorizeGradient(gradePct: number): {
  category: GradientCategory;
  color: string;
  label: string;
} {
  if (gradePct < -1.5) {
    return {
      category: 'downhill',
      color: '#38BDF8', // Apple Sky Blue
      label: '下坡段'
    };
  }
  if (gradePct <= 2.0) {
    return {
      category: 'flat',
      color: '#10B981', // Apple Green / Mint
      label: '平路段'
    };
  }
  if (gradePct <= 5.0) {
    return {
      category: 'mild_climb',
      color: '#FBBF24', // Apple Yellow / Amber
      label: '缓起伏坡'
    };
  }
  if (gradePct <= 8.5) {
    return {
      category: 'moderate_climb',
      color: '#FB923C', // Apple Orange
      label: '中度攻坚坡'
    };
  }
  if (gradePct <= 12.0) {
    return {
      category: 'steep_climb',
      color: '#EF4444', // Apple Red
      label: '陡坡攀爬'
    };
  }
  return {
    category: 'extreme_hc',
    color: '#C084FC', // Apple Purple / HC
    label: 'HC 极限绝望坡'
  };
}

/**
 * Best Bike Split dynamic target power allocation rule
 */
export function calculateTargetPower(
  gradePct: number,
  headwindComponentMs: number,
  ftpWatts: number,
  strategyMode: 'conservative' | 'balanced' | 'aggressive'
): { targetWatts: number; targetFtpPct: number } {
  // Strategy baseline multiplier
  let strategyMultiplier = 1.0;
  if (strategyMode === 'conservative') strategyMultiplier = 0.90;
  else if (strategyMode === 'aggressive') strategyMultiplier = 1.08;

  let powerFactor = 0.80; // default flat tempo (80% FTP)

  if (gradePct <= -5.0) {
    // Steep descent: super-tuck or active recovery spin
    powerFactor = 0.20;
  } else if (gradePct <= -2.0) {
    // Moderate descent: light pedal to keep chain tension
    powerFactor = 0.55;
  } else if (gradePct < 0.5) {
    // False flat down or flat: base tempo
    powerFactor = 0.78;
    // If fighting headwind on flat, increase power slightly (time benefit)
    if (headwindComponentMs > 3.0) powerFactor += 0.06;
    else if (headwindComponentMs < -3.0) powerFactor -= 0.05; // tailwind: save energy
  } else if (gradePct < 3.0) {
    // False flat up: sweetspot entry
    powerFactor = 0.88;
    if (headwindComponentMs > 3.0) powerFactor += 0.05;
  } else if (gradePct < 6.0) {
    // Mild climb: sweetspot
    powerFactor = 0.96;
  } else if (gradePct < 9.0) {
    // Moderate steep climb: threshold
    powerFactor = 1.04;
  } else if (gradePct < 13.0) {
    // Steep climb: threshold / VO2max entry
    powerFactor = 1.10;
  } else {
    // HC extreme ramp: surge cap
    powerFactor = 1.15;
  }

  // Multiply by strategy factor
  const effectiveFactor = powerFactor * strategyMultiplier;
  const targetWatts = Math.round(ftpWatts * effectiveFactor);
  const targetFtpPct = Math.round(effectiveFactor * 100);

  return {
    targetWatts: Math.max(0, targetWatts),
    targetFtpPct
  };
}

/**
 * Solve equilibrium velocity v using Bisection / Newton search
 * Equation: P_target * eta = (F_gravity + F_rolling + F_aero) * v
 */
export function solveEquilibriumSpeed(
  targetWatts: number,
  gradePct: number,
  headwindComponentMs: number,
  totalMassKg: number,
  cda: number,
  crr: number,
  airDensityRho: number,
  drivetrainEfficiency: number = 0.975
): { speedKmh: number; speedMs: number } {
  const g = 9.80665;
  const gradeRad = Math.atan(gradePct / 100);
  const fGravity = totalMassKg * g * Math.sin(gradeRad);
  const fRolling = totalMassKg * g * Math.cos(gradeRad) * crr;

  // Downhill terminal coasting check: if rider produces 0W or very low power downhill
  if (gradePct < -2.0 && fGravity < 0 && Math.abs(fGravity) > fRolling) {
    const forwardGravityPull = -fGravity - fRolling;
    // Aerodynamic terminal velocity at coasting: forwardGravityPull = 0.5 * rho * cda * (v + hw)^2
    const termRelSpeed = Math.sqrt(Math.max(0, (2 * forwardGravityPull) / (airDensityRho * cda)));
    const coastingSpeedMs = Math.max(0, termRelSpeed - headwindComponentMs);
    
    // If pedaling with power, solve regular equation
    if (targetWatts <= 30) {
      const clampedSpeed = Math.min(25, coastingSpeedMs); // cap terminal safe speed at 90 km/h (25 m/s)
      return {
        speedKmh: parseFloat((clampedSpeed * 3.6).toFixed(1)),
        speedMs: clampedSpeed
      };
    }
  }

  const effectivePowerWatts = targetWatts * drivetrainEfficiency;

  let low = 0.2; // 0.72 km/h
  let high = 27.8; // 100 km/h
  let v = 5.0;

  for (let i = 0; i < 45; i++) {
    v = (low + high) / 2;
    const vAero = Math.max(0, v + headwindComponentMs);
    const fAero = 0.5 * airDensityRho * cda * Math.pow(vAero, 2);
    const requiredPower = (fGravity + fRolling + fAero) * v;

    if (requiredPower < effectivePowerWatts) {
      low = v;
    } else {
      high = v;
    }
  }

  const safeSpeedKmh = Math.max(2.0, parseFloat((v * 3.6).toFixed(1)));
  return {
    speedKmh: safeSpeedKmh,
    speedMs: safeSpeedKmh / 3.6
  };
}

/**
 * Format duration in seconds into human-readable string
 */
export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const remSec = s % 60;

  if (hours > 0) {
    return `${hours}小时${minutes}分${remSec}秒`;
  }
  return `${minutes}分${remSec}秒`;
}

/**
 * Main Orchestrator: Discretizes GPX route, models aerodynamics, target pacing, and nutrition
 */
export function computeCoursePacingPlan(
  rawCoordinates: RouteCoordinate[],
  options: PacingEngineOptions
): CoursePacingSummary {
  if (rawCoordinates.length < 2) {
    return getEmptyPacingSummary();
  }

  const totalMassKg = options.riderWeightKg + options.bikeWeightKg;
  const drivetrainEfficiency = options.drivetrainEfficiency ?? 0.975;

  // 1. Build cumulative distance array
  let runningDistM = 0;
  const pointsWithDist: {
    lat: number;
    lng: number;
    elevation: number;
    distM: number;
    name?: string;
  }[] = [{ ...rawCoordinates[0], distM: 0 }];

  for (let i = 1; i < rawCoordinates.length; i++) {
    const prev = rawCoordinates[i - 1];
    const curr = rawCoordinates[i];
    const d = calculateHaversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
    runningDistM += d;
    pointsWithDist.push({
      ...curr,
      distM: runningDistM
    });
  }

  const totalCourseDistM = runningDistM;
  if (totalCourseDistM <= 10) {
    return getEmptyPacingSummary();
  }

  // 2. Adaptive segmentation: Target slice length around 200m - 350m
  // Keep segment count between 8 and 70 for optimal chart performance and resolution
  const targetSegmentLengthM = Math.min(
    600,
    Math.max(150, totalCourseDistM / 35)
  );
  const numSegments = Math.min(
    70,
    Math.max(6, Math.round(totalCourseDistM / targetSegmentLengthM))
  );
  const actualSliceDistM = totalCourseDistM / numSegments;

  const segments: CourseSegment[] = [];
  let currentStartIdx = 0;

  let totalElevationGainM = 0;
  let totalDescentM = 0;
  let totalDurationSec = 0;
  let weightedPower4Sec = 0; // for Normalized Power
  let totalWorkJoules = 0;

  let headwindDistM = 0;
  let tailwindDistM = 0;
  let crosswindDistM = 0;
  let climbDistanceM = 0;
  let flatDistanceM = 0;
  let descentDistanceM = 0;

  let maxGrade = -999;

  for (let s = 1; s <= numSegments; s++) {
    const targetEndDistM = s * actualSliceDistM;
    let endIdx = pointsWithDist.findIndex((p) => p.distM >= targetEndDistM);
    if (endIdx === -1 || s === numSegments) {
      endIdx = pointsWithDist.length - 1;
    }

    const startPt = pointsWithDist[currentStartIdx];
    const endPt = pointsWithDist[endIdx];

    const segDistM = Math.max(10, endPt.distM - startPt.distM);
    const segDistKm = parseFloat((segDistM / 1000).toFixed(2));
    const startDistKm = parseFloat((startPt.distM / 1000).toFixed(2));
    const endDistKm = parseFloat((endPt.distM / 1000).toFixed(2));

    const eleDeltaM = Math.round(endPt.elevation - startPt.elevation);
    if (eleDeltaM > 0) totalElevationGainM += eleDeltaM;
    else totalDescentM += Math.abs(eleDeltaM);

    const rawGradePct = (eleDeltaM / segDistM) * 100;
    const gradePct = parseFloat(Math.max(-25, Math.min(30, rawGradePct)).toFixed(1));
    if (gradePct > maxGrade) maxGrade = gradePct;

    if (gradePct > 2.0) climbDistanceM += segDistM;
    else if (gradePct < -1.5) descentDistanceM += segDistM;
    else flatDistanceM += segDistM;

    const bearingDeg = Math.round(
      calculateBearing(startPt.lat, startPt.lng, endPt.lat, endPt.lng)
    );
    const midLat = (startPt.lat + endPt.lat) / 2;
    const midLng = (startPt.lng + endPt.lng) / 2;
    const avgEleM = (startPt.elevation + endPt.elevation) / 2;

    const baseEleM = pointsWithDist[0]?.elevation || 0;
    const { localTempC, airDensityRho } = calculateLapseRateAirDensity(avgEleM, baseEleM, options.ambientTempC);

    let safeDescentCornerKmh: number | undefined = undefined;
    if (gradePct < -4.0) {
      const cornerLimit = calculateCorneringCentrifugalLimit(18, 'dry');
      safeDescentCornerKmh = cornerLimit.maxSpeedKmh;
    }

    const windDecomp = decomposeWind(
      bearingDeg,
      options.windDirectionDeg,
      options.windSpeedKmh
    );

    if (windDecomp.windRelation === 'headwind' || windDecomp.windRelation === 'cross_headwind') {
      headwindDistM += segDistM;
    } else if (windDecomp.windRelation === 'tailwind' || windDecomp.windRelation === 'cross_tailwind') {
      tailwindDistM += segDistM;
    } else {
      crosswindDistM += segDistM;
    }

    const gradientInfo = categorizeGradient(gradePct);

    // Target power calculation
    const { targetWatts, targetFtpPct } = calculateTargetPower(
      gradePct,
      windDecomp.headwindComponentMs,
      options.ftpWatts,
      options.strategyMode
    );
    const targetWkg = parseFloat((targetWatts / options.riderWeightKg).toFixed(2));

    // Physics velocity solution
    const { speedKmh, speedMs } = solveEquilibriumSpeed(
      targetWatts,
      gradePct,
      windDecomp.headwindComponentMs,
      totalMassKg,
      options.cda,
      options.crr,
      airDensityRho,
      drivetrainEfficiency
    );

    const segDurationSec = segDistM / speedMs;
    totalDurationSec += segDurationSec;
    weightedPower4Sec += Math.pow(targetWatts, 4) * segDurationSec;
    const segWorkJ = targetWatts * segDurationSec;
    totalWorkJoules += segWorkJ;

    const vam = gradePct > 0 ? Math.round((speedMs * (gradePct / 100)) * 3600) : 0;

    const minutes = Math.floor(segDurationSec / 60);
    const remSec = Math.round(segDurationSec % 60);
    const durationStr = minutes > 0 ? `${minutes}分${remSec}秒` : `${remSec}秒`;

    segments.push({
      id: `seg-${s}`,
      index: s,
      startDistKm,
      endDistKm,
      distKm: segDistKm,
      distM: Math.round(segDistM),
      startEleM: Math.round(startPt.elevation),
      endEleM: Math.round(endPt.elevation),
      eleDeltaM,
      gradePct,
      bearingDeg,
      lat: midLat,
      lng: midLng,
      gradientCategory: gradientInfo.category,
      color: gradientInfo.color,
      gradientLabel: gradientInfo.label,
      airDensityRho,
      localTempC,
      safeDescentCornerKmh,
      relativeWindAngleDeg: windDecomp.relativeWindAngleDeg,
      headwindComponentMs: windDecomp.headwindComponentMs,
      crosswindComponentMs: windDecomp.crosswindComponentMs,
      windRelation: windDecomp.windRelation,
      windRelationLabel: windDecomp.windRelationLabel,
      targetWatts,
      targetWkg,
      targetFtpPct,
      speedKmh,
      speedMs,
      durationSec: Math.round(segDurationSec),
      durationStr,
      vam,
      workKj: Math.round(segWorkJ / 1000)
    });

    currentStartIdx = endIdx;
  }

  // 3. Aggregate Course Metrics
  const totalDistanceKm = parseFloat((totalCourseDistM / 1000).toFixed(1));
  const avgSpeedKmh = totalDurationSec > 0 ? parseFloat(((totalDistanceKm / (totalDurationSec / 3600))).toFixed(1)) : 0;
  
  // Normalized Power (NP) = 4th root of (sum(P^4 * dt) / sum(dt))
  const npWatts = totalDurationSec > 0 ? Math.round(Math.pow(weightedPower4Sec / totalDurationSec, 0.25)) : options.ftpWatts;
  const avgWatts = totalDurationSec > 0 ? Math.round(totalWorkJoules / totalDurationSec) : options.ftpWatts;
  const intensityFactor = options.ftpWatts > 0 ? parseFloat((npWatts / options.ftpWatts).toFixed(2)) : 0.8;
  
  // TSS = (t * NP * IF) / (FTP * 3600) * 100
  const tss = options.ftpWatts > 0
    ? Math.round(((totalDurationSec * npWatts * intensityFactor) / (options.ftpWatts * 3600)) * 100)
    : 0;

  const totalWorkKj = Math.round(totalWorkJoules / 1000);
  const estCaloriesKcal = Math.round(totalWorkKj / (4.184 * 0.24));

  const avgGradePct = totalDistanceKm > 0
    ? parseFloat(((totalElevationGainM / (totalDistanceKm * 1000)) * 100).toFixed(1))
    : 0;

  // Wind percentages
  const headwindPct = Math.round((headwindDistM / totalCourseDistM) * 100);
  const tailwindPct = Math.round((tailwindDistM / totalCourseDistM) * 100);
  const crosswindPct = Math.max(0, 100 - headwindPct - tailwindPct);

  // 4. Metabolic Nutrition Planning
  const totalHours = totalDurationSec / 3600;
  let recommendedCarbsPerHourG = 40;
  if (totalHours >= 2.5) {
    recommendedCarbsPerHourG = 80; // High carb endurance
  } else if (totalHours >= 1.5) {
    recommendedCarbsPerHourG = 60; // Standard race carb
  } else {
    recommendedCarbsPerHourG = 30; // Short duration
  }

  const totalCarbsG = Math.round(recommendedCarbsPerHourG * totalHours);
  const energyGelsCount = Math.ceil(totalCarbsG / 25); // assuming ~25g carb per standard energy gel

  // Fluid intake (ml/h): Baseline 500ml/h + 15ml per degree above 20°C, multiplied by intensity
  let baseFluidPerHour = 500;
  if (options.ambientTempC > 20) {
    baseFluidPerHour += (options.ambientTempC - 20) * 15;
  }
  const recommendedFluidPerHourMl = Math.min(1000, Math.max(450, Math.round(baseFluidPerHour * intensityFactor)));
  const totalFluidMl = Math.round(recommendedFluidPerHourMl * totalHours);
  const hydrationBottlesCount = Math.ceil(totalFluidMl / 600); // 600ml bidon

  const sodiumMgPerHour = options.ambientTempC >= 28 ? 650 : 450;

  return {
    totalDistanceKm,
    totalElevationGainM: Math.round(totalElevationGainM),
    totalDescentM: Math.round(totalDescentM),
    avgGradePct,
    maxGradePct: Math.max(0, maxGrade),
    totalDurationSec: Math.round(totalDurationSec),
    totalDurationFormatted: formatDuration(totalDurationSec),
    avgSpeedKmh,
    avgWatts,
    normalizedPowerWatts: npWatts,
    intensityFactor,
    trainingStressScore: tss,
    totalWorkKj,
    estCaloriesKcal,
    headwindDistKm: parseFloat((headwindDistM / 1000).toFixed(1)),
    headwindPct,
    tailwindDistKm: parseFloat((tailwindDistM / 1000).toFixed(1)),
    tailwindPct,
    crosswindDistKm: parseFloat((crosswindDistM / 1000).toFixed(1)),
    crosswindPct,
    avgAirDensity: parseFloat((calculateAirDensity(totalElevationGainM / 2, options.ambientTempC)).toFixed(3)),
    nutrition: {
      recommendedCarbsPerHourG,
      totalCarbsG,
      energyGelsCount,
      recommendedFluidPerHourMl,
      totalFluidMl,
      hydrationBottlesCount,
      sodiumMgPerHour
    },
    climbDistanceKm: parseFloat((climbDistanceM / 1000).toFixed(1)),
    flatDistanceKm: parseFloat((flatDistanceM / 1000).toFixed(1)),
    descentDistanceKm: parseFloat((descentDistanceM / 1000).toFixed(1)),
    segments
  };
}

function getEmptyPacingSummary(): CoursePacingSummary {
  return {
    totalDistanceKm: 0,
    totalElevationGainM: 0,
    totalDescentM: 0,
    avgGradePct: 0,
    maxGradePct: 0,
    totalDurationSec: 0,
    totalDurationFormatted: '0分00秒',
    avgSpeedKmh: 0,
    avgWatts: 0,
    normalizedPowerWatts: 0,
    intensityFactor: 0,
    trainingStressScore: 0,
    totalWorkKj: 0,
    estCaloriesKcal: 0,
    headwindDistKm: 0,
    headwindPct: 0,
    tailwindDistKm: 0,
    tailwindPct: 0,
    crosswindDistKm: 0,
    crosswindPct: 0,
    avgAirDensity: 1.225,
    nutrition: {
      recommendedCarbsPerHourG: 0,
      totalCarbsG: 0,
      energyGelsCount: 0,
      recommendedFluidPerHourMl: 0,
      totalFluidMl: 0,
      hydrationBottlesCount: 0,
      sodiumMgPerHour: 0
    },
    climbDistanceKm: 0,
    flatDistanceKm: 0,
    descentDistanceKm: 0,
    segments: []
  };
}
