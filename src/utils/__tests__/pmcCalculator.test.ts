import { describe, it, expect } from 'vitest';
import {
  getTsbZoneInfo,
  generatePmcSeries,
  predictTaperDays,
  calculateContinuousSeasonPmc,
  BASELINE_FITNESS_OPTIONS
} from '../pmcCalculator';

describe('PMC Calculator - Impulse-Response Model & Zones', () => {
  describe('getTsbZoneInfo', () => {
    it('correctly classifies deep fatigue overload (TSB < -30)', () => {
      const info = getTsbZoneInfo(-35);
      expect(info.zone).toBe('overload');
      expect(info.color).toBe('#ef4444');
      expect(info.label).toContain('深度透支');
      expect(info.labelEn).toBeDefined();
      expect(info.adviceEn).toBeDefined();
    });

    it('correctly classifies productive overreaching (-30 <= TSB < -10)', () => {
      const info1 = getTsbZoneInfo(-30);
      expect(info1.zone).toBe('productive');
      const info2 = getTsbZoneInfo(-15);
      expect(info2.zone).toBe('productive');
    });

    it('correctly classifies neutral maintenance (-10 <= TSB <= 5)', () => {
      const info0 = getTsbZoneInfo(0);
      expect(info0.zone).toBe('neutral');
      const infoNeg10 = getTsbZoneInfo(-10);
      expect(infoNeg10.zone).toBe('neutral');
      const info5 = getTsbZoneInfo(5);
      expect(info5.zone).toBe('neutral');
    });

    it('correctly classifies race ready peak (5 < TSB <= 25)', () => {
      const info = getTsbZoneInfo(15);
      expect(info.zone).toBe('peak');
      expect(info.color).toBe('#f59e0b');
      expect(info.label).toContain('黄金巅峰');
    });

    it('correctly classifies detraining (TSB > 25)', () => {
      const info = getTsbZoneInfo(26);
      expect(info.zone).toBe('detraining');
      expect(info.color).toBe('#94a3b8');
    });
  });

  describe('generatePmcSeries', () => {
    it('generates expected day count for base mesocycle', () => {
      const series = generatePmcSeries('base', undefined, 'club');
      expect(series).toHaveLength(60);
      expect(series[0].day).toBe(1);
      expect(series[59].day).toBe(60);
    });

    it('generates expected day count for taper mesocycle', () => {
      const series = generatePmcSeries('taper', undefined, 'club');
      expect(series).toHaveLength(28);
    });

    it('adaptively expands daysCount beyond 60 when historical Strava activities cover 120 days', () => {
      const now = new Date();
      const past120Days = new Date(now.getTime() - 120 * 86400 * 1000).toISOString();
      const past60Days = new Date(now.getTime() - 60 * 86400 * 1000).toISOString();

      const stravaActs = [
        { start_date: past120Days, tss: 120, name: 'Century Ride 4 Months Ago' },
        { start_date: past60Days, tss: 85, name: 'Tempo Ride 2 Months Ago' }
      ];

      const series = generatePmcSeries('base', undefined, 'club', undefined, stravaActs);
      expect(series.length).toBeGreaterThanOrEqual(120);
      expect(series[0].day).toBe(1);
    });

    it('injects today TSS correctly into the final day', () => {
      const series = generatePmcSeries('build', 185, 'elite');
      const finalDay = series[series.length - 1];
      expect(finalDay.tss).toBe(185);
      expect(finalDay.phase).toBe('FIT活动解析写入');
    });

    it('ensures CTL and ATL exponentially respond to training stress', () => {
      const series = generatePmcSeries('grand_tour', undefined, 'pro');
      // Pro grand tour stages have high TSS (180-280), so ATL should spike quickly
      const initialAtl = series[0].atl;
      const midAtl = series[10].atl;
      expect(midAtl).toBeGreaterThan(initialAtl);
      // TSB should be CTL - ATL (within floating point precision)
      for (const pt of series) {
        expect(Math.abs(pt.tsb - (Math.round((pt.ctl - pt.atl) * 10) / 10))).toBeLessThanOrEqual(0.15);
      }
    });
  });

  describe('predictTaperDays', () => {
    it('calculates days needed to reach target peak TSB', () => {
      // Current: heavy fatigue (CTL 80, ATL 100 => TSB -20)
      const res = predictTaperDays(80, 100, 15, 25);
      expect(res.daysNeeded).toBeGreaterThan(0);
      expect(res.daysNeeded).toBeLessThanOrEqual(35);
      expect(res.predictedCtl - res.predictedAtl).toBeGreaterThanOrEqual(14.9);
    });

    it('returns 0 days if current TSB is already at or above target', () => {
      // Current: already fresh (CTL 70, ATL 50 => TSB +20)
      const res = predictTaperDays(70, 50, 15, 25);
      expect(res.daysNeeded).toBe(0);
      expect(res.predictedCtl).toBe(70);
      expect(res.predictedAtl).toBe(50);
    });
  });

  describe('calculateContinuousSeasonPmc', () => {
    it('handles empty activities gracefully with safe defaults and no NaN', () => {
      const res = calculateContinuousSeasonPmc([], '90d', 'club');
      expect(res.series.length).toBeGreaterThan(0);
      expect(res.summary).toBeDefined();
      expect(Number.isNaN(res.summary.currentCtl)).toBe(false);
      expect(Number.isNaN(res.summary.currentAtl)).toBe(false);
      expect(Number.isNaN(res.summary.acwr)).toBe(false);
      expect(res.summary.acwr).toBeGreaterThanOrEqual(0);
      expect(res.summary.acwrStatus.status).toBe('low');
    });

    it('correctly aggregates real activities and computes ACWR and ramp rate', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 86400 * 1000).toISOString();
      const threeDaysAgo = new Date(now.getTime() - 3 * 86400 * 1000).toISOString();

      const activities = [
        { startDate: yesterday, tss: 120, name: 'Threshold Intervals', distanceKm: 45 },
        { startDate: threeDaysAgo, tss: 150, name: 'Long Weekend Ride', distanceKm: 85 }
      ];

      const res = calculateContinuousSeasonPmc(activities, '90d', 'club');
      expect(res.summary.totalSeasonTss).toBeGreaterThanOrEqual(270);
      expect(res.summary.totalSeasonKm).toBeGreaterThanOrEqual(130);
      expect(res.summary.activeDaysCount).toBe(2);
      expect(res.summary.acwrStatus).toBeDefined();
    });

    it('defends against division by zero when CTL is 0', () => {
      // In extreme zero CTL conditions, ACWR must default safely to finite number
      const res = calculateContinuousSeasonPmc([], '30d', 'rec');
      expect(res.summary.acwr).toBeDefined();
      expect(Number.isFinite(res.summary.acwr)).toBe(true);
    });
  });
});
