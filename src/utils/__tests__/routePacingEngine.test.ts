import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistance,
  calculateBearing,
  calculateAirDensity,
  calculateLapseRateAirDensity,
  calculateCorneringCentrifugalLimit,
  solveEquilibriumSpeed,
  formatDuration,
  computeCoursePacingPlan
} from '../routePacingEngine';

describe('Route Pacing & Aerodynamics Physics Engine', () => {
  describe('Geodesic & Atmospheric Physics', () => {
    it('calculates accurate Haversine distance between two coordinates', () => {
      // Hangzhou West Lake (approx 30.24, 120.14) to Qianjiang New City (approx 30.21, 120.21)
      const dist = calculateHaversineDistance(30.24, 120.14, 30.21, 120.21);
      expect(dist).toBeGreaterThan(7000); // ~7-8 km
      expect(dist).toBeLessThan(9500);
    });

    it('returns 0 distance for identical coordinates', () => {
      const dist = calculateHaversineDistance(30.25, 120.15, 30.25, 120.15);
      expect(dist).toBe(0);
    });

    it('calculates spherical forward bearing correctly', () => {
      // Due North: lat increases, lon constant
      const bearingNorth = calculateBearing(30.0, 120.0, 31.0, 120.0);
      expect(Math.round(bearingNorth)).toBe(0);

      // Due East: lat constant, lon increases
      const bearingEast = calculateBearing(30.0, 120.0, 30.0, 121.0);
      expect(Math.round(bearingEast)).toBe(90);
    });

    it('calculates ISA air density rho decreasing with altitude and temperature', () => {
      const seaLevelDensity = calculateAirDensity(0, 15); // Sea level, 15°C standard ISA
      expect(seaLevelDensity).toBeCloseTo(1.225, 1);

      const mountainDensity = calculateAirDensity(2000, 15); // 2000m altitude
      expect(mountainDensity).toBeLessThan(seaLevelDensity);
      expect(mountainDensity).toBeGreaterThan(0.95);
    });

    it('calculates environmental lapse rate temperature drop and air density', () => {
      // 1000m altitude gain from 0m with base temp 20°C: lapse rate is -6.5°C/1000m -> 13.5°C
      const lapse1000 = calculateLapseRateAirDensity(1000, 0, 20);
      expect(lapse1000.localTempC).toBe(13.5);
      expect(lapse1000.airDensityRho).toBeLessThan(1.225);

      // 2000m high mountain pass from 500m base with base temp 25°C: delta 1500m -> -9.75°C -> 15.2°C (or 15.3°C rounded)
      const pass2000 = calculateLapseRateAirDensity(2000, 500, 25);
      expect(pass2000.localTempC).toBe(15.3);
      expect(pass2000.airDensityRho).toBeLessThan(1.10);
    });

    it('calculates centrifugal cornering speed caps for dry vs wet hairpins', () => {
      // Hairpin curve radius = 15m, dry asphalt (mu = 0.8)
      const dryHairpin = calculateCorneringCentrifugalLimit(15, 'dry');
      expect(dryHairpin.maxSpeedKmh).toBeGreaterThan(35);
      expect(dryHairpin.maxSpeedKmh).toBeLessThan(42);

      // Hairpin curve radius = 15m, wet asphalt (mu = 0.45)
      const wetHairpin = calculateCorneringCentrifugalLimit(15, 'wet');
      expect(wetHairpin.maxSpeedKmh).toBeLessThan(32);
      expect(wetHairpin.maxSpeedKmh).toBeGreaterThan(25);
      expect(wetHairpin.warning).toContain('急弯/发卡弯极限安全过弯速度');

      // Gravel surface (mu = 0.35)
      const gravelHairpin = calculateCorneringCentrifugalLimit(15, 'gravel');
      expect(gravelHairpin.maxSpeedKmh).toBeLessThan(wetHairpin.maxSpeedKmh);
    });
  });

  describe('Aerodynamic & Mechanical Equilibrium Speed Solver', () => {
    const defaultParams = {
      totalMassKg: 75,
      cda: 0.32,
      crr: 0.004,
      airDensityRho: 1.225,
      drivetrainEfficiency: 0.975
    };

    it('solves realistic flat cruising speed for 200W endurance output', () => {
      // 200W on 0% flat road with 0 wind
      const res = solveEquilibriumSpeed(
        200,
        0,
        0,
        defaultParams.totalMassKg,
        defaultParams.cda,
        defaultParams.crr,
        defaultParams.airDensityRho,
        defaultParams.drivetrainEfficiency
      );
      // Expected road bike speed for 200W on hoods is ~32-35 km/h
      expect(res.speedKmh).toBeGreaterThan(30);
      expect(res.speedKmh).toBeLessThan(37);
      expect(res.speedMs).toBeCloseTo(res.speedKmh / 3.6, 2);
    });

    it('models speed reduction under steep climb', () => {
      // 250W threshold on 8% climb
      const resClimb = solveEquilibriumSpeed(
        250,
        8.0,
        0,
        defaultParams.totalMassKg,
        defaultParams.cda,
        defaultParams.crr,
        defaultParams.airDensityRho,
        defaultParams.drivetrainEfficiency
      );
      // On 8% grade at 250W (~3.3 W/kg), speed is ~13-16 km/h
      expect(resClimb.speedKmh).toBeGreaterThan(12);
      expect(resClimb.speedKmh).toBeLessThan(18);
    });

    it('models headwind drag deceleration', () => {
      const calm = solveEquilibriumSpeed(200, 0, 0, 75, 0.32, 0.004, 1.225);
      const headwind = solveEquilibriumSpeed(200, 0, 5.5, 75, 0.32, 0.004, 1.225); // 20 km/h headwind (~5.5 m/s)
      expect(headwind.speedKmh).toBeLessThan(calm.speedKmh);
      expect(calm.speedKmh - headwind.speedKmh).toBeGreaterThan(5);
    });

    it('safely caps terminal speed on steep descent when coasting (0W)', () => {
      const downhillCoasting = solveEquilibriumSpeed(0, -8.0, 0, 75, 0.32, 0.004, 1.225);
      expect(downhillCoasting.speedKmh).toBeGreaterThan(40);
      expect(downhillCoasting.speedKmh).toBeLessThanOrEqual(90); // Capped at safe terminal limit (25 m/s = 90 km/h)
    });

    it('never returns NaN or speeds below safe threshold (2.0 km/h) even under extreme 0W uphill', () => {
      const stall = solveEquilibriumSpeed(0, 15.0, 0, 75, 0.32, 0.004, 1.225);
      expect(Number.isNaN(stall.speedKmh)).toBe(false);
      expect(stall.speedKmh).toBeGreaterThanOrEqual(2.0);
    });
  });

  describe('formatDuration', () => {
    it('formats seconds into minutes and seconds', () => {
      expect(formatDuration(125)).toBe('2分5秒');
    });

    it('formats hours, minutes, and seconds', () => {
      expect(formatDuration(3665)).toBe('1小时1分5秒');
    });
  });

  describe('computeCoursePacingPlan', () => {
    const options = {
      ftpWatts: 250,
      riderWeightKg: 68,
      bikeWeightKg: 8,
      cda: 0.32,
      crr: 0.004,
      windSpeedKmh: 10,
      windDirectionDeg: 90,
      ambientTempC: 20,
      strategyMode: 'balanced' as const
    };

    it('returns empty pacing plan if coordinates have fewer than 2 points', () => {
      const empty1 = computeCoursePacingPlan([], options);
      expect(empty1.totalDistanceKm).toBe(0);
      expect(empty1.segments).toHaveLength(0);

      const empty2 = computeCoursePacingPlan([{ lat: 30.0, lng: 120.0, elevation: 10 }], options);
      expect(empty2.totalDistanceKm).toBe(0);
    });

    it('computes complete course summary with segments and energy expenditure for valid path', () => {
      const route = [
        { lat: 30.24, lng: 120.14, elevation: 15 },
        { lat: 30.25, lng: 120.15, elevation: 45 },
        { lat: 30.26, lng: 120.16, elevation: 120 },
        { lat: 30.27, lng: 120.17, elevation: 180 },
        { lat: 30.28, lng: 120.18, elevation: 80 }
      ];

      const plan = computeCoursePacingPlan(route, options);
      expect(plan.totalDistanceKm).toBeGreaterThan(3);
      expect(plan.totalElevationGainM).toBeGreaterThan(100);
      expect(plan.segments.length).toBeGreaterThan(0);
      expect(plan.avgSpeedKmh).toBeGreaterThan(10);
      expect(plan.normalizedPowerWatts).toBeGreaterThan(150);
      expect(plan.totalWorkKj).toBeGreaterThan(0);
      expect(plan.nutrition).toBeDefined();
      expect(plan.nutrition.totalCarbsG).toBeGreaterThan(0);
      expect(plan.nutrition.totalFluidMl).toBeGreaterThan(0);
    });
  });
});
