import { describe, it, expect } from 'vitest';
import { calculateSpokeLengths, SpokeCalcParams } from '../spokeCalculatorEngine';

describe('Spoke Length & Wheel Mechanics Calculation Engine', () => {
  const baseRearParams: SpokeCalcParams = {
    wheelPosition: 'rear',
    brakeType: 'disc',
    hubType: 'j_bend',
    lacingPattern: 'standard',
    erdMm: 540,
    rimOffsetMm: 0,
    spokeCount: 24,
    leftPcdMm: 58,
    leftCenterDistMm: 34.5,
    leftCross: 2,
    rightPcdMm: 58,
    rightCenterDistMm: 19.2,
    rightCross: 2,
    spokeHoleDiaMm: 2.5,
    spokeStretchCompensationMm: 0.6,
    nippleLengthMm: 12,
    nippleWasherMm: 0
  };

  it('calculates standard J-bend rear wheel spoke length accurately', () => {
    const res = calculateSpokeLengths(baseRearParams);
    expect(res.effectiveErd).toBe(540);
    // Typical 540mm ERD with 2X cross yields ~258-265mm spokes
    expect(res.roundedLeft).toBeGreaterThan(255);
    expect(res.roundedLeft).toBeLessThan(270);
    expect(res.roundedRight).toBeGreaterThan(250);
    expect(res.roundedRight).toBeLessThan(265);
    // Drive side spoke is slightly shorter due to smaller center distance
    expect(res.netRight).toBeLessThan(res.netLeft);
    // Standard 1:1 tension ratio is around 56%
    expect(res.tensionRatioPercent).toBeCloseTo(56, -1);
    expect(res.leftSpokeCount).toBe(12);
    expect(res.rightSpokeCount).toBe(12);
    expect(res.is2To1Balanced).toBe(false);
  });

  it('calculates Straight-Pull hub spoke length without elbow hole radius deduction', () => {
    const spParams: SpokeCalcParams = {
      ...baseRearParams,
      hubType: 'straight_pull'
    };
    const jBendRes = calculateSpokeLengths(baseRearParams);
    const spRes = calculateSpokeLengths(spParams);

    // In Straight-pull, holeRadius (1.25mm) is not deducted from nail head to tip
    expect(spRes.netLeft).toBeGreaterThan(jBendRes.netLeft);
    expect(Math.abs(spRes.netLeft - jBendRes.netLeft - 1.25)).toBeLessThanOrEqual(0.1);
  });

  it('calculates 2:1 Triplet lacing with 16 DS / 8 NDS and dramatically improved tension balance', () => {
    const tripletParams: SpokeCalcParams = {
      ...baseRearParams,
      lacingPattern: 'triplet_2_to_1',
      leftCross: 0, // radial NDS
      rightCross: 2 // 2X DS
    };

    const res = calculateSpokeLengths(tripletParams);
    expect(res.rightSpokeCount).toBe(16);
    expect(res.leftSpokeCount).toBe(8);
    expect(res.is2To1Balanced).toBe(true);

    // In 2:1, NDS tension ratio jumps from ~56% to ~111%
    expect(res.tensionRatioPercent).toBeGreaterThan(95);
    expect(res.tensionRatioPercent).toBeLessThan(125);
    expect(res.tensionDesc).toContain('2:1 均衡配比');
  });

  it('triggers safety hazard warning for front disc brake 0X radial lacing', () => {
    const hazardousFrontParams: SpokeCalcParams = {
      ...baseRearParams,
      wheelPosition: 'front',
      brakeType: 'disc',
      leftCross: 0 // 0X on rotor side!
    };
    const res = calculateSpokeLengths(hazardousFrontParams);
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.warnings.some(w => w.includes('碟刹前轮左侧严禁采用 0X'))).toBe(true);
  });
});
