/**
 * Spoke Length & Wheel Mechanics Calculation Engine
 * Supports standard J-Bend, Straight-Pull hubs, Asymmetric rims, and 2:1 Triplet lacing.
 */

export type WheelPosition = 'rear' | 'front';
export type BrakeType = 'disc' | 'rim';
export type HubType = 'j_bend' | 'straight_pull';
export type LacingPattern = 'standard' | 'triplet_2_to_1';

export interface SpokeCalcParams {
  wheelPosition: WheelPosition;
  brakeType: BrakeType;
  hubType?: HubType;
  lacingPattern?: LacingPattern;
  erdMm: number;
  rimOffsetMm: number;
  spokeCount: number; // e.g. 24
  leftPcdMm: number;
  leftCenterDistMm: number;
  leftCross: number;
  rightPcdMm: number;
  rightCenterDistMm: number;
  rightCross: number;
  spokeHoleDiaMm?: number; // default 2.5mm (for J-bend)
  spokeStretchCompensationMm?: number; // default 0.6mm
  nippleLengthMm?: number; // 12, 14, 16
  nippleWasherMm?: number; // 0, 0.5, 1.0
  spOffsetMm?: number; // Straight-pull spoke offset distance from hub axis tangent (default 10mm)
}

export interface SpokeCalcResult {
  effectiveErd: number;
  rawLeft: number;
  rawRight: number;
  netLeft: number;
  netRight: number;
  roundedLeft: number;
  roundedRight: number;
  leftSpokeCount: number;
  rightSpokeCount: number;
  angleLeftDeg: number;
  angleRightDeg: number;
  effLeftCenter: number;
  effRightCenter: number;
  tensionRatioPercent: number;
  tensionDesc: string;
  is2To1Balanced: boolean;
  warnings: string[];
}

/**
 * Calculate precise spoke length and tension balance ratio
 */
export function calculateSpokeLengths(params: SpokeCalcParams): SpokeCalcResult {
  const {
    wheelPosition,
    brakeType,
    hubType = 'j_bend',
    lacingPattern = 'standard',
    erdMm,
    rimOffsetMm,
    spokeCount,
    leftPcdMm,
    leftCenterDistMm,
    leftCross,
    rightPcdMm,
    rightCenterDistMm,
    rightCross,
    spokeHoleDiaMm = 2.5,
    spokeStretchCompensationMm = 0.6,
    nippleLengthMm = 12,
    nippleWasherMm = 0
  } = params;

  // 1. Effective Rim Diameter (ERD) with nipple length and washer adjustments
  const effectiveErd =
    erdMm +
    nippleWasherMm * 2 +
    (nippleLengthMm === 14 ? -0.5 : nippleLengthMm === 16 ? -1.0 : 0);

  const rRim = effectiveErd / 2;
  const rLeftHub = leftPcdMm / 2;
  const rRightHub = rightPcdMm / 2;

  // 2. Rim asymmetry offset moves rim holes relative to hub center
  let effLeftCenter = leftCenterDistMm;
  let effRightCenter = rightCenterDistMm;

  if (wheelPosition === 'rear') {
    effLeftCenter = Math.max(5, leftCenterDistMm - rimOffsetMm);
    effRightCenter = Math.max(5, rightCenterDistMm + rimOffsetMm);
  } else {
    effLeftCenter = Math.max(5, leftCenterDistMm + rimOffsetMm);
    effRightCenter = Math.max(5, rightCenterDistMm - rimOffsetMm);
  }

  // 3. Spoke count per side & cross angle (radians)
  let leftSpokeCount = Math.round(spokeCount / 2);
  let rightSpokeCount = Math.round(spokeCount / 2);

  let thetaLeft = 0;
  let thetaRight = 0;

  if (lacingPattern === 'triplet_2_to_1') {
    if (wheelPosition === 'rear') {
      // Rear: Drive Side has 2/3 of spokes, NDS has 1/3
      rightSpokeCount = Math.round((spokeCount * 2) / 3);
      leftSpokeCount = Math.max(4, spokeCount - rightSpokeCount);
      // DS spacing on rim
      thetaRight = ((720 * rightCross) / (spokeCount * (4 / 3))) * (Math.PI / 180);
      // NDS spacing on rim (usually 0X or 1X)
      thetaLeft = ((720 * leftCross) / (spokeCount * (2 / 3))) * (Math.PI / 180);
    } else {
      // Front Disc: Rotor Side (left) has 2/3 of spokes, non-rotor has 1/3
      leftSpokeCount = Math.round((spokeCount * 2) / 3);
      rightSpokeCount = Math.max(4, spokeCount - leftSpokeCount);
      thetaLeft = ((720 * leftCross) / (spokeCount * (4 / 3))) * (Math.PI / 180);
      thetaRight = ((720 * rightCross) / (spokeCount * (2 / 3))) * (Math.PI / 180);
    }
  } else {
    // Standard 1:1 lacing
    thetaLeft = ((720 * leftCross) / spokeCount) * (Math.PI / 180);
    thetaRight = ((720 * rightCross) / spokeCount) * (Math.PI / 180);
  }

  // 4. 2D chord distance in wheel plane
  const chordSqLeft = rRim * rRim + rLeftHub * rLeftHub - 2 * rRim * rLeftHub * Math.cos(thetaLeft);
  const chordSqRight = rRim * rRim + rRightHub * rRightHub - 2 * rRim * rRightHub * Math.cos(thetaRight);

  // 5. 3D spoke vector length
  const rawLeft = Math.sqrt(Math.max(1, chordSqLeft + effLeftCenter * effLeftCenter));
  const rawRight = Math.sqrt(Math.max(1, chordSqRight + effRightCenter * effRightCenter));

  // 6. Correction for hub spoke hole diameter and tensile elongation
  // Straight-pull spokes are measured directly from under the nail head to thread tip; no hole radius subtraction
  const holeRadius = hubType === 'straight_pull' ? 0 : spokeHoleDiaMm / 2;
  const netLeft = rawLeft - holeRadius - spokeStretchCompensationMm;
  const netRight = rawRight - holeRadius - spokeStretchCompensationMm;

  const roundedLeft = Math.round(netLeft);
  const roundedRight = Math.round(netRight);

  // 7. Lateral Bracing Angle
  const angleLeftDeg = (Math.atan(effLeftCenter / rRim) * 180) / Math.PI;
  const angleRightDeg = (Math.atan(effRightCenter / rRim) * 180) / Math.PI;

  // 8. Tension Balance Ratio Calculation
  const safeLeftCenter = Math.max(0.1, effLeftCenter);
  const safeRightCenter = Math.max(0.1, effRightCenter);

  let tensionRatioPercent = 100;
  let tensionDesc = '';
  let is2To1Balanced = false;

  if (wheelPosition === 'rear') {
    if (lacingPattern === 'triplet_2_to_1') {
      // 2:1 ratio multiplies NDS tension by 2!
      const rawRatio = (safeRightCenter / safeLeftCenter) * (rightSpokeCount / leftSpokeCount);
      tensionRatioPercent = Math.min(130, Math.max(20, Math.round(rawRatio * 100)));
      is2To1Balanced = true;
      tensionDesc = `2:1 均衡配比 · 驱动侧 DS 100% (基准 120kgf) : 非驱动侧 NDS ${tensionRatioPercent}% (${Math.round(120 * (tensionRatioPercent / 100))}kgf)`;
    } else {
      const rawRatio = safeRightCenter / safeLeftCenter;
      tensionRatioPercent = Math.min(100, Math.max(10, Math.round(rawRatio * 100)));
      tensionDesc = `驱动侧 DS 100% (基准 120kgf) : 非驱动侧 NDS ${tensionRatioPercent}% (${Math.round(120 * (tensionRatioPercent / 100))}kgf)`;
    }
  } else {
    // Front wheel
    if (lacingPattern === 'triplet_2_to_1') {
      const rawRatio = (safeLeftCenter / safeRightCenter) * (leftSpokeCount / rightSpokeCount);
      tensionRatioPercent = Math.min(130, Math.max(20, Math.round(rawRatio * 100)));
      is2To1Balanced = true;
      tensionDesc = `2:1 均衡配比 · 碟刹侧 100% (基准 120kgf) : 右侧 ${tensionRatioPercent}% (${Math.round(120 * (tensionRatioPercent / 100))}kgf)`;
    } else {
      const rawRatio = safeLeftCenter / safeRightCenter;
      tensionRatioPercent = Math.min(100, Math.max(10, Math.round(rawRatio * 100)));
      tensionDesc = `碟刹侧 100% (基准 120kgf) : 右侧 ${tensionRatioPercent}% (${Math.round(120 * (tensionRatioPercent / 100))}kgf)`;
    }
  }

  // 9. Safety & Engineering Warnings
  const warnings: string[] = [];

  if (brakeType === 'disc' && wheelPosition === 'front' && leftCross === 0) {
    warnings.push('严重安全隐患：碟刹前轮左侧严禁采用 0X 放射状直拉！刹车卡钳将产生数百牛米扭矩，直拉编法极易撕裂花鼓法兰或断条！');
  }
  if (brakeType === 'disc' && wheelPosition === 'rear' && leftCross === 0) {
    warnings.push('安全警告：碟刹后轮碟刹侧采用 0X 直拉无法承受制动扭矩，必须至少采用 1X 或 2X 交叉！');
  }
  if (wheelPosition === 'rear' && rightCross === 0) {
    warnings.push('传动警告：后轮驱动侧塔基端采用 0X 直拉无法有效传递链条踩踏扭矩，除非搭配超粗筒体花鼓或 2:1 异索编法。');
  }
  if (spokeCount <= 24 && (leftCross >= 3 || rightCross >= 3)) {
    warnings.push('几何提示：24孔或更少孔数下采用 3X 交叉，辐条出条角度过大可能遮挡相邻辐条孔头或引起折角。建议 24孔使用 2X。');
  }

  return {
    effectiveErd: parseFloat(effectiveErd.toFixed(1)),
    rawLeft: parseFloat(rawLeft.toFixed(1)),
    rawRight: parseFloat(rawRight.toFixed(1)),
    netLeft: parseFloat(netLeft.toFixed(1)),
    netRight: parseFloat(netRight.toFixed(1)),
    roundedLeft,
    roundedRight,
    leftSpokeCount,
    rightSpokeCount,
    angleLeftDeg: parseFloat(angleLeftDeg.toFixed(1)),
    angleRightDeg: parseFloat(angleRightDeg.toFixed(1)),
    effLeftCenter: parseFloat(effLeftCenter.toFixed(1)),
    effRightCenter: parseFloat(effRightCenter.toFixed(1)),
    tensionRatioPercent,
    tensionDesc,
    is2To1Balanced,
    warnings
  };
}
