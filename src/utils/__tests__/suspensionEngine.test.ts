import { describe, it, expect } from 'vitest';
import { calculateSuspensionSetup, SuspensionInput } from '../suspensionEngine';

describe('suspensionEngine', () => {
  const baseEnduroInput: SuspensionInput = {
    riderWeightKg: 70,
    gearWeightKg: 5,
    isEmtb: false,
    discipline: 'enduro',
    ridingStyle: 'balanced',
    forkBrand: 'fox',
    forkStanchionMm: 38,
    forkTravelMm: 170,
    forkPsiOffset: 0,
    measuredForkSagMm: 46,
    shockType: 'air',
    frameRearTravelMm: 160,
    shockStrokeMm: 62.5,
    linkageProgressivity: 'progressive',
    shockPsiOffset: 0,
    measuredShockSagMm: 18
  };

  it('calculates standard acoustic MTB suspension setup accurately', () => {
    const result = calculateSuspensionSetup(baseEnduroInput);

    expect(result.totalRiderWeightKg).toBe(75);
    expect(result.isEmtb).toBe(false);
    expect(result.emtbForkPsiBonus).toBe(0);
    expect(result.emtbShockPsiBonus).toBe(0);

    // Enduro balanced target sag: fork 27%, shock 30%
    expect(result.targetForkSagPct).toBe(27);
    expect(result.targetShockSagPct).toBe(30);
    expect(result.targetForkSagMm).toBe(Math.round(170 * 0.27));
    expect(result.targetShockSagMm).toBe(Math.round(62.5 * 0.3 * 10) / 10);

    // Fox 38: wLbs * 0.92 + 2
    const wLbs = 75 * 2.20462;
    expect(result.finalForkPsi).toBe(Math.round(wLbs * 0.92 + 2));
    expect(result.reboundClicksOut).toBeGreaterThan(0);
    expect(result.lscClicksOut).toBeGreaterThan(0);
    expect(result.emtbAdvisory).toBeUndefined();
  });

  it('applies E-MTB chassis mass compensation for air shock and fork', () => {
    const acousticResult = calculateSuspensionSetup(baseEnduroInput);
    const emtbResult = calculateSuspensionSetup({
      ...baseEnduroInput,
      isEmtb: true
    });

    expect(emtbResult.isEmtb).toBe(true);
    expect(emtbResult.emtbForkPsiBonus).toBe(16);
    expect(emtbResult.finalForkPsi).toBe(acousticResult.finalForkPsi + 16);

    // E-MTB rear shock pressure increases
    expect(emtbResult.emtbShockPsiBonus).toBeGreaterThanOrEqual(25);
    expect(emtbResult.finalShockPsi).toBe(acousticResult.finalShockPsi + emtbResult.emtbShockPsiBonus);

    // Rebound clicks decrease (closer to closed, slower rebound)
    expect(emtbResult.reboundClicksOut).toBeLessThanOrEqual(acousticResult.reboundClicksOut);
    expect(emtbResult.shockReboundClicks).toBeLessThanOrEqual(acousticResult.shockReboundClicks);

    // Tokens increase for bottom-out control
    expect(emtbResult.recommendedForkTokens).toBeGreaterThanOrEqual(acousticResult.recommendedForkTokens);

    // Advisory present
    expect(emtbResult.emtbAdvisory).toBeDefined();
    expect(emtbResult.emtbAdvisory?.pressureSummaryZh).toContain('前叉补偿 +16 PSI');
  });

  it('applies E-MTB chassis mass compensation for coil shock', () => {
    const coilInput: SuspensionInput = {
      ...baseEnduroInput,
      shockType: 'coil'
    };

    const acousticCoil = calculateSuspensionSetup(coilInput);
    const emtbCoil = calculateSuspensionSetup({
      ...coilInput,
      isEmtb: true
    });

    expect(emtbCoil.emtbCoilRateBonus).toBe(50);
    expect(emtbCoil.exactSpringRate).toBeGreaterThan(acousticCoil.exactSpringRate);
    expect(emtbCoil.closestSpringRate).toBeGreaterThanOrEqual(acousticCoil.closestSpringRate);
  });

  it('correctly evaluates SAG diagnoses', () => {
    // Optimal SAG
    const optimal = calculateSuspensionSetup({
      ...baseEnduroInput,
      measuredForkSagMm: 46 // 46 / 170 = 27.05% => delta ~0
    });
    expect(optimal.forkSagDiagnosis).toBe('optimal');

    // Too soft (measured sag too big)
    const soft = calculateSuspensionSetup({
      ...baseEnduroInput,
      measuredForkSagMm: 60 // 60 / 170 = 35.3% => delta > 3%
    });
    expect(soft.forkSagDiagnosis).toBe('too_soft');

    // Too stiff (measured sag too small)
    const stiff = calculateSuspensionSetup({
      ...baseEnduroInput,
      measuredForkSagMm: 25 // 25 / 170 = 14.7% => delta < -3%
    });
    expect(stiff.forkSagDiagnosis).toBe('too_stiff');
  });

  it('safely handles extreme or boundary zero inputs without NaN or crashes', () => {
    const boundaryResult = calculateSuspensionSetup({
      ...baseEnduroInput,
      riderWeightKg: 0,
      gearWeightKg: -10,
      forkTravelMm: 0,
      shockStrokeMm: 0,
      frameRearTravelMm: 0
    });

    expect(Number.isFinite(boundaryResult.finalForkPsi)).toBe(true);
    expect(Number.isFinite(boundaryResult.finalShockPsi)).toBe(true);
    expect(Number.isFinite(boundaryResult.leverageRatio)).toBe(true);
    expect(boundaryResult.reboundClicksOut).toBeGreaterThan(0);
  });
});
