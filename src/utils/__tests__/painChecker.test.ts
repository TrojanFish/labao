import { describe, it, expect } from 'vitest';
import {
  PAIN_AREAS,
  TIMING_SCENARIOS,
  AREA_TIMING_PRESCRIPTIONS,
  getPainPrescription
} from '../../data/painCheckerData';

describe('Pain Checker Diagnostic & Prescription Engine', () => {
  it('covers all 6 major physiological pain areas', () => {
    const requiredAreas = ['knee', 'lower_back', 'neck_shoulder', 'wrist_hand', 'buttock', 'foot'];
    expect(Object.keys(PAIN_AREAS)).toEqual(expect.arrayContaining(requiredAreas));
  });

  it('defines 4 riding timing/context scenarios', () => {
    expect(TIMING_SCENARIOS).toHaveLength(4);
    const scenarioIds = TIMING_SCENARIOS.map(s => s.id);
    expect(scenarioIds).toContain('early_ride');
    expect(scenarioIds).toContain('fatigue_endurance');
    expect(scenarioIds).toContain('high_torque_climb');
    expect(scenarioIds).toContain('aero_drop_posture');
  });

  it('provides tailored prescription for knee pain under early_ride scenario', () => {
    const pres = getPainPrescription('knee', 'early_ride');
    expect(pres.diagnosis).toBeDefined();
    expect(pres.mechanicalAdjustments.length).toBeGreaterThan(0);
    expect(pres.ridingAdjustments.length).toBeGreaterThan(0);
    expect(pres.stretchExercises.length).toBeGreaterThan(0);
    // Should mention float cleats or saddle adjustment
    const allAdjustments = pres.mechanicalAdjustments.join(' ');
    expect(allAdjustments).toContain('浮动');
  });

  it('provides tailored prescription for lower_back pain under aero_drop_posture', () => {
    const pres = getPainPrescription('lower_back', 'aero_drop_posture');
    expect(pres.diagnosis).toContain('落差');
    expect(pres.stretchExercises.some(e => e.name.includes('前屈') || e.name.includes('支撑'))).toBe(true);
  });

  it('provides tailored prescription for buttock pain under fatigue_endurance', () => {
    const pres = getPainPrescription('buttock', 'fatigue_endurance');
    expect(pres.diagnosis).toContain('坐垫');
    expect(pres.mechanicalAdjustments.some(a => a.includes('坐垫') || a.includes('骑行裤'))).toBe(true);
  });

  it('provides fallback gracefully for invalid area or scenario', () => {
    const fallback = getPainPrescription('unknown_area', 'early_ride');
    expect(fallback).toBeDefined();
    expect(fallback.diagnosis).toBeDefined();
  });
});
