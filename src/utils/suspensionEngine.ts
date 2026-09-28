/**
 * MTB & E-MTB Suspension Tuning Engine
 *
 * Implements empirical spring curves, leverage ratio physics, damping click mapping,
 * and chassis sprung-mass compensation for E-MTB (electric assist mountain bikes).
 */

export type SuspensionDiscipline = 'xc' | 'trail' | 'enduro' | 'dh';
export type RidingStyle = 'balanced' | 'plush' | 'firm';
export type ForkBrand = 'fox' | 'rockshox' | 'other';
export type ForkDamper = 'grip2' | 'fit4' | 'charger3' | 'standard';
export type ShockType = 'air' | 'coil';
export type LinkageProgressivity = 'linear' | 'progressive' | 'high_progressive';

export interface SuspensionInput {
  riderWeightKg: number;
  gearWeightKg: number;
  isEmtb?: boolean;
  discipline: SuspensionDiscipline;
  ridingStyle: RidingStyle;
  // Fork
  forkBrand: ForkBrand;
  forkStanchionMm: number;
  forkTravelMm: number;
  forkPsiOffset?: number;
  measuredForkSagMm: number;
  // Rear Shock
  shockType: ShockType;
  frameRearTravelMm: number;
  shockStrokeMm: number;
  linkageProgressivity: LinkageProgressivity;
  shockPsiOffset?: number;
  measuredShockSagMm: number;
}

export interface EmtbAdvisory {
  pressureSummaryZh: string;
  dampingSummaryZh: string;
  spacerSummaryZh: string;
}

export interface SuspensionOutput {
  totalRiderWeightKg: number;
  totalRiderWeightLbs: number;
  isEmtb: boolean;
  emtbForkPsiBonus: number;
  emtbShockPsiBonus: number;
  emtbCoilRateBonus: number;
  targetForkSagPct: number;
  targetShockSagPct: number;
  targetForkSagMm: number;
  targetShockSagMm: number;
  baseForkPsi: number;
  finalForkPsi: number;
  reboundClicksOut: number;
  lscClicksOut: number;
  hscClicksOut: number;
  hsrClicksOut: number;
  recommendedForkTokens: number;
  leverageRatio: number;
  baseShockPsi: number;
  finalShockPsi: number;
  shockReboundClicks: number;
  shockLscClicks: number;
  exactSpringRate: number;
  closestSpringRate: number;
  actualForkSagPct: number;
  actualShockSagPct: number;
  forkSagDiagnosis: 'optimal' | 'too_soft' | 'too_stiff';
  shockSagDiagnosis: 'optimal' | 'too_soft' | 'too_stiff';
  emtbAdvisory?: EmtbAdvisory;
}

/**
 * Calculates MTB and E-MTB suspension parameters including air pressure,
 * spring rate, damping clicks, and SAG tolerances.
 */
export function calculateSuspensionSetup(input: SuspensionInput): SuspensionOutput {
  const {
    riderWeightKg,
    gearWeightKg,
    isEmtb = false,
    discipline,
    ridingStyle,
    forkBrand,
    forkStanchionMm,
    forkTravelMm,
    forkPsiOffset = 0,
    measuredForkSagMm,
    shockType,
    frameRearTravelMm,
    shockStrokeMm,
    linkageProgressivity,
    shockPsiOffset = 0,
    measuredShockSagMm
  } = input;

  const totalRiderWeightKg = Math.max(30, riderWeightKg + Math.max(0, gearWeightKg));
  const totalRiderWeightLbs = totalRiderWeightKg * 2.20462;

  // 1. Target SAG Percentages
  let targetForkSagPct = 20;
  let targetShockSagPct = 25;

  if (discipline === 'xc') {
    targetForkSagPct = ridingStyle === 'firm' ? 15 : ridingStyle === 'plush' ? 22 : 18;
    targetShockSagPct = ridingStyle === 'firm' ? 20 : ridingStyle === 'plush' ? 26 : 22;
  } else if (discipline === 'trail') {
    targetForkSagPct = ridingStyle === 'firm' ? 20 : ridingStyle === 'plush' ? 26 : 23;
    targetShockSagPct = ridingStyle === 'firm' ? 25 : ridingStyle === 'plush' ? 30 : 27;
  } else if (discipline === 'enduro') {
    targetForkSagPct = ridingStyle === 'firm' ? 24 : ridingStyle === 'plush' ? 30 : 27;
    targetShockSagPct = ridingStyle === 'firm' ? 28 : ridingStyle === 'plush' ? 33 : 30;
  } else {
    // dh
    targetForkSagPct = ridingStyle === 'firm' ? 28 : ridingStyle === 'plush' ? 35 : 31;
    targetShockSagPct = ridingStyle === 'firm' ? 30 : ridingStyle === 'plush' ? 36 : 33;
  }

  const safeForkTravelMm = Math.max(50, forkTravelMm);
  const safeShockStrokeMm = Math.max(20, shockStrokeMm);

  const targetForkSagMm = Math.round((safeForkTravelMm * targetForkSagPct) / 100);
  const targetShockSagMm = Math.round(((safeShockStrokeMm * targetShockSagPct) / 100) * 10) / 10;

  // 2. Fork Pressure Calculation (empirical model calibrated against Fox & RS official charts)
  const wLbs = totalRiderWeightLbs;
  let baseForkPsi = 0;

  if (forkBrand === 'fox') {
    if (forkStanchionMm <= 32) {
      baseForkPsi = wLbs * 0.72 + 10;
    } else if (forkStanchionMm === 34) {
      baseForkPsi = wLbs * 0.78 + 8;
    } else if (forkStanchionMm === 36) {
      baseForkPsi = wLbs * 0.82 + 5;
    } else if (forkStanchionMm === 38) {
      baseForkPsi = wLbs * 0.92 + 2;
    } else {
      // 40
      baseForkPsi = wLbs * 0.70 + 8;
    }
  } else if (forkBrand === 'rockshox') {
    if (forkStanchionMm <= 32) {
      baseForkPsi = wLbs * 0.85 + 5;
    } else if (forkStanchionMm === 35) {
      baseForkPsi = wLbs * 0.92;
    } else if (forkStanchionMm === 38) {
      baseForkPsi = wLbs * 0.98 - 3;
    } else {
      // 40 (Boxxer)
      baseForkPsi = wLbs * 0.80 + 4;
    }
  } else {
    baseForkPsi = wLbs * 0.85;
  }

  // Riding style compensation
  if (ridingStyle === 'firm') baseForkPsi += 6;
  if (ridingStyle === 'plush') baseForkPsi -= 6;

  // E-MTB chassis mass compensation:
  // Motors + batteries add 10-15kg (~22-33 lbs) sprung mass.
  // Front fork needs +16 to +18 PSI to prevent excessive dive under heavy chassis braking
  const emtbForkPsiBonus = isEmtb ? 16 : 0;
  const finalForkPsi = Math.round(baseForkPsi + emtbForkPsiBonus + forkPsiOffset);

  // Fork Damping Clicks (counted from FULLY CLOSED / Clockwise)
  // Higher weight / higher spring pressure requires more damping (fewer clicks out)
  // E-MTB adds chassis inertia: reduce clicks out by 1-2 to prevent pogo rebound
  let rawReboundClicks = Math.round(18 - (wLbs / 220) * 10);
  let rawLscClicks = Math.round(16 - (wLbs / 220) * 7);
  let rawHscClicks = Math.round(7 - (wLbs / 220) * 3);
  let rawHsrClicks = Math.round(8 - (wLbs / 220) * 4);

  if (isEmtb) {
    rawReboundClicks -= 2; // +2 clicks slower damping
    rawLscClicks -= 2; // firmer low-speed compression against braking pitch
    rawHscClicks -= 1;
    rawHsrClicks -= 1;
  }

  const reboundClicksOut = Math.max(2, Math.min(16, rawReboundClicks));
  const lscClicksOut = Math.max(3, Math.min(18, rawLscClicks));
  const hscClicksOut = Math.max(2, Math.min(8, rawHscClicks));
  const hsrClicksOut = Math.max(2, Math.min(8, rawHsrClicks));

  // Volume Spacer recommendation
  let recommendedForkTokens = 1;
  if (wLbs < 145) recommendedForkTokens = 0;
  else if (wLbs < 185) recommendedForkTokens = 1;
  else if (wLbs < 215) recommendedForkTokens = 2;
  else recommendedForkTokens = 3;

  if (ridingStyle === 'plush') recommendedForkTokens = Math.max(0, recommendedForkTokens - 1);
  if (ridingStyle === 'firm') recommendedForkTokens += 1;
  if (isEmtb) {
    // E-MTBs carry more kinetic energy; extra token prevents harsh bottom-out
    recommendedForkTokens = Math.min(4, recommendedForkTokens + 1);
  }

  // 3. Rear Shock Calculations
  const leverageRatio = safeShockStrokeMm > 0 ? frameRearTravelMm / safeShockStrokeMm : 2.5;
  const rearWeightDistrib = discipline === 'dh' ? 0.65 : discipline === 'enduro' ? 0.62 : 0.60;

  // For Air Shock:
  let progFactor = 1.0;
  if (linkageProgressivity === 'linear') progFactor = 1.15;
  else if (linkageProgressivity === 'progressive') progFactor = 1.02;
  else progFactor = 0.92;

  let baseShockPsi = wLbs * leverageRatio * 0.64 * progFactor;
  if (ridingStyle === 'firm') baseShockPsi += 10;
  if (ridingStyle === 'plush') baseShockPsi -= 10;

  // E-MTB rear shock air compensation (+28 PSI average due to motor/battery load through leverage ratio)
  const emtbShockPsiBonus = isEmtb ? Math.round(28 * (leverageRatio / 2.5)) : 0;
  const finalShockPsi = Math.round(baseShockPsi + emtbShockPsiBonus + shockPsiOffset);

  let rawShockReboundClicks = Math.round(16 - (wLbs / 220) * 9);
  let rawShockLscClicks = Math.round(12 - (wLbs / 220) * 5);

  if (isEmtb) {
    rawShockReboundClicks -= 2; // Increase rebound damping to curb heavy rear triangle rebound
    rawShockLscClicks -= 1; // Increase LSC to prevent wallowing under motor torque
  }

  const shockReboundClicks = Math.max(2, Math.min(16, rawShockReboundClicks));
  const shockLscClicks = Math.max(2, Math.min(14, rawShockLscClicks));

  // For Coil Shock (TFTuned / Push spring rate formula):
  const strokeInches = safeShockStrokeMm / 25.4;
  const sagDecimal = Math.max(0.1, targetShockSagPct / 100);
  const coilProgComp = linkageProgressivity === 'linear' ? 1.0 : linkageProgressivity === 'progressive' ? 0.92 : 0.86;

  // E-MTB coil spring rate compensation (+50~75 lbs/in)
  const emtbCoilRateBonus = isEmtb ? 50 : 0;
  const rawSpringRate = ((wLbs * rearWeightDistrib * leverageRatio) / (strokeInches * sagDecimal * coilProgComp)) + emtbCoilRateBonus;
  const exactSpringRate = Math.round(rawSpringRate);
  const closestSpringRate = Math.round(exactSpringRate / 25) * 25;

  // Measured SAG Status
  const actualForkSagPct = Math.round((measuredForkSagMm / safeForkTravelMm) * 100);
  const actualShockSagPct = Math.round((measuredShockSagMm / safeShockStrokeMm) * 100);

  const forkSagDelta = actualForkSagPct - targetForkSagPct;
  let forkSagDiagnosis: 'optimal' | 'too_soft' | 'too_stiff' = 'optimal';
  if (forkSagDelta > 3) forkSagDiagnosis = 'too_soft';
  else if (forkSagDelta < -3) forkSagDiagnosis = 'too_stiff';

  const shockSagDelta = actualShockSagPct - targetShockSagPct;
  let shockSagDiagnosis: 'optimal' | 'too_soft' | 'too_stiff' = 'optimal';
  if (shockSagDelta > 3) shockSagDiagnosis = 'too_soft';
  else if (shockSagDelta < -3) shockSagDiagnosis = 'too_stiff';

  let emtbAdvisory: EmtbAdvisory | undefined = undefined;
  if (isEmtb) {
    emtbAdvisory = {
      pressureSummaryZh: `前叉补偿 +${emtbForkPsiBonus} PSI，后避震补偿 +${shockType === 'air' ? `${emtbShockPsiBonus} PSI` : `${emtbCoilRateBonus} lbs/in 弹簧磅数`}`,
      dampingSummaryZh: '低速回弹与压缩阻尼均收紧 1~2 格（减小退格数），抑制电机电池重车身的弹跳与刹车点头',
      spacerSummaryZh: '建议前叉与后胆各增加 1 枚容积垫块，增强深行程渐进支撑，防止重车冲击打底'
    };
  }

  return {
    totalRiderWeightKg,
    totalRiderWeightLbs,
    isEmtb,
    emtbForkPsiBonus,
    emtbShockPsiBonus,
    emtbCoilRateBonus,
    targetForkSagPct,
    targetShockSagPct,
    targetForkSagMm,
    targetShockSagMm,
    baseForkPsi: Math.round(baseForkPsi),
    finalForkPsi,
    reboundClicksOut,
    lscClicksOut,
    hscClicksOut,
    hsrClicksOut,
    recommendedForkTokens,
    leverageRatio: Math.round(leverageRatio * 100) / 100,
    baseShockPsi: Math.round(baseShockPsi),
    finalShockPsi,
    shockReboundClicks,
    shockLscClicks,
    exactSpringRate,
    closestSpringRate,
    actualForkSagPct,
    actualShockSagPct,
    forkSagDiagnosis,
    shockSagDiagnosis,
    emtbAdvisory
  };
}
