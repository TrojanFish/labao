import { describe, it, expect } from 'vitest';
import {
  calculateHandlebarPosition,
  solveFrameFromHandlebar,
  solveSpacersForTargetDrop,
  calculateStemDelta,
  calculateSaddleHeightFromBB,
  calculateDynamicBioCompensation
} from '../bikeFitGeometry';

describe('bikeFitGeometry (Apple HIG & Biomechanics Standard)', () => {
  const defaultFrame = { stackMm: 540, reachMm: 380 };
  const standardCockpit = {
    headTubeAngleDeg: 73.0,
    headsetCapMm: 10,
    spacersMm: 15,
    stemClampHeightMm: 40,
    stemLengthMm: 100,
    stemAngleDeg: -6
  };

  it('calculates handlebar position correctly with trigonometric precision', () => {
    const coords = calculateHandlebarPosition(defaultFrame, standardCockpit);

    // Total steerer offset = 10 + 15 + 20 = 45mm
    // steererRise = 45 * sin(73°) ≈ 43.0mm
    // steererSetback = 45 * cos(73°) ≈ 13.2mm
    // stem angle = 90 - 73 - 6 = 11°
    // stemRise = 100 * sin(11°) ≈ 19.1mm
    // stemReach = 100 * cos(11°) ≈ 98.2mm
    expect(coords.steererRiseMm).toBeCloseTo(43.0, 1);
    expect(coords.steererSetbackMm).toBeCloseTo(13.2, 1);
    expect(coords.stemRiseMm).toBeCloseTo(19.1, 1);
    expect(coords.stemReachMm).toBeCloseTo(98.2, 1);

    expect(coords.handlebarStackMm).toBeCloseTo(540 + 43.0 + 19.1, 0);
    expect(coords.handlebarReachMm).toBeCloseTo(380 - 13.2 + 98.2, 0);
  });

  it('performs exact reversible inverse solving for bare frame Stack & Reach', () => {
    const coords = calculateHandlebarPosition(defaultFrame, standardCockpit);
    const solvedFrame = solveFrameFromHandlebar(
      { handlebarStackMm: coords.handlebarStackMm, handlebarReachMm: coords.handlebarReachMm },
      standardCockpit
    );

    expect(solvedFrame.stackMm).toBe(defaultFrame.stackMm);
    expect(solvedFrame.reachMm).toBe(defaultFrame.reachMm);
  });

  it('accurately computes stem swap impact (e.g. -6° standard vs -17° slammed horizontal stem)', () => {
    const delta = calculateStemDelta(
      73.0,
      { lengthMm: 100, angleDeg: -6 },
      { lengthMm: 100, angleDeg: -17 }
    );

    // -17° stem on 73° head tube is horizontal (0° to ground)
    // Drops stack by ~19mm and extends reach slightly by ~1.8mm
    expect(delta.deltaStackMm).toBeCloseTo(-19.1, 1);
    expect(delta.deltaReachMm).toBeCloseTo(1.8, 1);
    expect(delta.summaryText).toContain('车把降低');
    expect(delta.summaryText).toContain('前伸增加');
  });

  it('solves spacer requirements and provides correct physiological status', () => {
    const saddleHeightMm = 720;
    const targetDropMm = 60; // 6cm drop
    const saddleVert = calculateSaddleHeightFromBB(saddleHeightMm, 73.5);
    // targetHandlebarStack = saddleVert - 60

    const fit = solveSpacersForTargetDrop({
      saddleHeightMm,
      targetDropMm,
      frameStackMm: 560,
      headTubeAngleDeg: 73.0,
      headsetCapMm: 10,
      stemLengthMm: 100,
      stemAngleDeg: -6
    });

    expect(fit.fitStatus).toMatch(/optimal|acceptable|slammed/);
    expect(fit.roundedSpacersMm).toBeGreaterThanOrEqual(0);
    expect(fit.roundedSpacersMm % 2.5).toBe(0);
    expect(Math.abs(fit.dropErrorMm)).toBeLessThan(5); // Error should be within single spacer resolution
  });

  it('detects unreachably high frame stack gracefully', () => {
    const fit = solveSpacersForTargetDrop({
      saddleHeightMm: 650, // Short rider
      targetDropMm: 90,    // Very aggressive drop
      frameStackMm: 580,   // Oversized frame
      headTubeAngleDeg: 73.0,
      headsetCapMm: 15,
      stemLengthMm: 90,
      stemAngleDeg: -6
    });

    expect(fit.fitStatus).toBe('unreachable_too_high');
    expect(fit.message).toContain('车架 Stack 偏高');
  });

  it('detects dangerously low frame stack requiring excessive spacers', () => {
    const fit = solveSpacersForTargetDrop({
      saddleHeightMm: 800, // Tall rider
      targetDropMm: 20,    // Very upright endurance position
      frameStackMm: 510,   // Undersized frame
      headTubeAngleDeg: 73.0,
      headsetCapMm: 10,
      stemLengthMm: 110,
      stemAngleDeg: -6
    });

    expect(fit.fitStatus).toBe('unreachable_too_low');
    expect(fit.message).toContain('所需垫圈超过 45mm 安全极限');
  });

  it('calculates dynamic bio-compensation for toe-down and rearward cleats', () => {
    const bio = calculateDynamicBioCompensation({
      baseSaddleHeightMm: 720,
      anklingStyle: 'toe_down',
      cleatPosition: 'rearward_midfoot',
      flexibility: 'high'
    });

    expect(bio.anklingOffsetMm).toBe(5);
    expect(bio.cleatOffsetMm).toBe(-4);
    expect(bio.effectiveDynamicSaddleHeightMm).toBe(721);
    expect(bio.targetKneeAngleMinDeg).toBe(30);
    expect(bio.targetKneeAngleMaxDeg).toBe(35);
    expect(bio.recommendationZh).toContain('脚尖下踩提踵');
  });
});
