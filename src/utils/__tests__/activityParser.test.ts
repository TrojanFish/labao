import { describe, it, expect } from 'vitest';
import {
  calculateNormalizedPower,
  calculateMmpCurve,
  calculateSkibaWPrimeBalance,
  downsamplePoints,
  analyzePoints,
  generateRealisticDemoRide,
  ActivityPoint
} from '../activityParser';

describe('Activity Parser & Advanced Physiological Metrics', () => {
  describe('calculateNormalizedPower (Coggan Algorithm)', () => {
    it('returns 0 for empty or undefined power values array', () => {
      expect(calculateNormalizedPower([])).toBe(0);
    });

    it('falls back to arithmetic average for short efforts (<30 seconds)', () => {
      const shortEffort = [200, 210, 190, 200];
      const avg = Math.round((200 + 210 + 190 + 200) / 4);
      expect(calculateNormalizedPower(shortEffort)).toBe(avg);
    });

    it('calculates NP identical to average power for steady-state flat power', () => {
      // 120 seconds of constant 200W
      const steadyPowers = new Array(120).fill(200);
      const np = calculateNormalizedPower(steadyPowers);
      expect(np).toBe(200);
    });

    it('weighs surges higher than arithmetic average due to 4th power weighting', () => {
      // Intervals longer than the 30s smoothing window:
      // 60s at 300W, then 60s at 100W (total 120s, average power 200W)
      const powers: number[] = [];
      for (let i = 0; i < 60; i++) powers.push(300);
      for (let i = 0; i < 60; i++) powers.push(100);

      const avgPower = Math.round(powers.reduce((a, b) => a + b, 0) / powers.length);
      const np = calculateNormalizedPower(powers);

      expect(avgPower).toBe(200);
      // Because high physiological stress is exponentially penalized by 4th power, NP must exceed AP
      expect(np).toBeGreaterThan(avgPower);
      expect(np).toBeGreaterThanOrEqual(235);
    });
  });

  describe('calculateMmpCurve (Mean Maximal Power)', () => {
    it('extracts peak power for multiple durations accurately', () => {
      // Create a 180-second activity with a known 5-second sprint of 600W at second 30
      const points: ActivityPoint[] = [];
      for (let s = 0; s < 180; s++) {
        let p = 180; // Baseline endurance 180W
        if (s >= 30 && s < 35) {
          p = 600; // 5-second sprint
        }
        points.push({
          time: s,
          distance: s * 8,
          power: p
        });
      }

      const mmp = calculateMmpCurve(points, 70);
      expect(mmp.length).toBeGreaterThan(0);

      const mmp1s = mmp.find(m => m.label === '1s');
      const mmp5s = mmp.find(m => m.label === '5s');
      const mmp1m = mmp.find(m => m.label === '1m');

      expect(mmp1s?.watts).toBe(600);
      expect(mmp5s?.watts).toBe(600);
      // 1-minute window should dilute the 5s surge: (5 * 600 + 55 * 180) / 60 = 215W
      expect(mmp1m?.watts).toBe(215);
      expect(mmp5s?.wkg).toBeCloseTo(600 / 70, 2);
    });
  });

  describe("calculateSkibaWPrimeBalance (Skiba 2012 Dynamic W')", () => {
    it('handles empty activity points safely', () => {
      const res = calculateSkibaWPrimeBalance([], 250, 20000);
      expect(res.minWPrimePercent).toBe(100);
      expect(res.matchesBurned).toBe(0);
      expect(res.workAboveCpKj).toBe(0);
    });

    it('keeps W\' at 100% during sub-CP endurance cruising', () => {
      const points: ActivityPoint[] = [];
      for (let s = 0; s < 100; s++) {
        points.push({ time: s, distance: s * 8, power: 180 }); // CP is 250W, so 180W is aerobic
      }
      const res = calculateSkibaWPrimeBalance(points, 250, 20000);
      expect(res.minWPrimePercent).toBe(100);
      expect(res.matchesBurned).toBe(0);
      expect(res.workAboveCpKj).toBe(0);
    });

    it('depletes W\' during supra-CP anaerobic surges and records burned matches', () => {
      const points: ActivityPoint[] = [];
      let t = 0;

      // 1. Initial warm up 60s at 150W
      for (let i = 0; i < 60; i++) {
        points.push({ time: t++, distance: t * 8, power: 150 });
      }

      // 2. Severe anaerobic attack: 500W for 40s (CP = 250W)
      // Expenditure: (500 - 250) * 40 = 10,000 Joules (50% of 20,000 W')
      for (let i = 0; i < 40; i++) {
        points.push({ time: t++, distance: t * 8, power: 500 });
      }

      const res = calculateSkibaWPrimeBalance(points, 250, 20000);
      expect(res.minWPrimeJoules).toBeLessThanOrEqual(10000);
      expect(res.minWPrimePercent).toBeLessThanOrEqual(50);
      expect(res.workAboveCpKj).toBeCloseTo(10.0, 1);
    });

    it('models reconstitution of W\' during recovery periods below CP', () => {
      const points: ActivityPoint[] = [];
      let t = 0;

      // Exhaustive sprint: 500W for 60s -> (500 - 250) * 60 = 15,000J expended, W' drops to 25%
      for (let i = 0; i < 60; i++) {
        points.push({ time: t++, distance: t * 8, power: 500 });
      }

      // Easy spin recovery: 100W for 300s -> dynamic recovery
      for (let i = 0; i < 300; i++) {
        points.push({ time: t++, distance: t * 8, power: 100 });
      }

      const res = calculateSkibaWPrimeBalance(points, 250, 20000);
      const lastPoint = res.dataPoints[res.dataPoints.length - 1];

      expect(res.minWPrimePercent).toBeLessThan(30);
      expect(res.matchesBurned).toBeGreaterThanOrEqual(1);
      // W' should have reconstituted significantly after 5 minutes of low-power recovery
      expect(lastPoint.wBalPercent).toBeGreaterThan(res.minWPrimePercent);
      expect(lastPoint.wBalPercent).toBeGreaterThan(60);
    });
  });

  describe('downsamplePoints', () => {
    it('does not downsample if array length is below target count', () => {
      const small = [{ time: 1, distance: 10 }, { time: 2, distance: 20 }];
      expect(downsamplePoints(small, 600)).toBe(small);
    });

    it('reduces point count to target while preserving boundary points', () => {
      const large: ActivityPoint[] = [];
      for (let i = 0; i < 2000; i++) {
        large.push({ time: i, distance: i * 5, power: 200 + (i % 50) });
      }
      const sampled = downsamplePoints(large, 600);
      expect(sampled.length).toBe(600);
      expect(sampled[0].time).toBe(0);
      expect(sampled[sampled.length - 1].time).toBeGreaterThan(1900);
    });
  });

  describe('analyzePoints & Left-Right Pedal Balance (Phase 1)', () => {
    it('properly preserves leftRightBalance from analysis options', () => {
      const points: ActivityPoint[] = [
        { time: 0, distance: 0, power: 200 },
        { time: 10, distance: 80, power: 210 },
        { time: 20, distance: 160, power: 220 }
      ];

      const result = analyzePoints(points, 'test.fit', 'fit', 250, 70, 190, {
        leftRightBalance: { leftPercent: 48, rightPercent: 52 }
      });

      expect(result.leftRightBalance).toBeDefined();
      expect(result.leftRightBalance?.leftPercent).toBe(48);
      expect(result.leftRightBalance?.rightPercent).toBe(52);
    });

    it('generates demo activity with valid dual-sided balance', () => {
      const demo = generateRealisticDemoRide(260, 68, 185);
      expect(demo.leftRightBalance).toBeDefined();
      expect(demo.leftRightBalance?.leftPercent).toBe(49);
      expect(demo.leftRightBalance?.rightPercent).toBe(51);
      expect(demo.normalizedPower).toBeGreaterThan(0);
    });
  });
});
