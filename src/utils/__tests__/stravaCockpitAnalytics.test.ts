import { describe, it, expect } from 'vitest';
import {
  computeWeeklyVolume,
  computeAnnualGoalProgress,
  computeAnnualElevationGoalProgress,
  computePmcTimeline,
  findOptimalRaceWindow,
  generateDemoStravaActivities,
  computePowerZoneDistribution,
  computeRampRateHistory,
  computeFtpHistory,
  computePersonalRecordsTimeline,
  computeAerobicEfficiency,
  exportActivitiesToCsv,
  exportActivitiesToJson,
  computeSegmentSummaryStats,
  computeGearFleet
} from '../stravaCockpitAnalytics';
import { StravaActivityRecord } from '../indexedDb';
import { CURATED_STRAVA_SEGMENTS } from '../../services/stravaService';

describe('StravaCockpitAnalytics - Sports Science Calculations', () => {
  const demoActivities = generateDemoStravaActivities();

  describe('computeWeeklyVolume', () => {
    it('handles empty activities gracefully', () => {
      const res = computeWeeklyVolume([], 250, 12);
      expect(res.weeks).toHaveLength(12);
      expect(res.peakTssWeek).toBeNull();
      expect(res.peakDistanceWeek).toBeNull();
      expect(res.avgWeeklyTss).toBe(0);
      expect(res.avgWeeklyDistanceKm).toBe(0);
      expect(res.totalVolumeTss).toBe(0);
      expect(res.totalVolumeDistanceKm).toBe(0);
    });

    it('aggregates demo activities correctly across weeks', () => {
      const res = computeWeeklyVolume(demoActivities, 250, 26);
      expect(res.weeks).toHaveLength(26);
      expect(res.totalVolumeDistanceKm).toBeGreaterThan(0);
      expect(res.totalVolumeTss).toBeGreaterThan(0);
      expect(res.avgWeeklyDistanceKm).toBeGreaterThan(0);
      expect(res.avgWeeklyTss).toBeGreaterThan(0);

      // Verify peak week detection
      if (res.peakTssWeek) {
        expect(res.peakTssWeek.tss).toBeGreaterThanOrEqual(res.avgWeeklyTss);
        expect(res.peakTssWeek.isPeakTss).toBe(true);
      }
      if (res.peakDistanceWeek) {
        expect(res.peakDistanceWeek.distanceKm).toBeGreaterThanOrEqual(res.avgWeeklyDistanceKm);
        expect(res.peakDistanceWeek.isPeakDistance).toBe(true);
      }
    });

    it('accurately groups custom activities in the same week', () => {
      const now = new Date();
      const mockActivities: StravaActivityRecord[] = [
        {
          id: 1,
          name: 'Ride 1',
          distance: 50000,
          moving_time: 5400,
          elapsed_time: 6000,
          total_elevation_gain: 400,
          type: 'Ride',
          start_date: now.toISOString(),
          start_date_local: now.toISOString(),
          average_speed: 9.2,
          max_speed: 15.0,
          average_watts: 200,
          weighted_average_watts: 210,
          tss: 90
        },
        {
          id: 2,
          name: 'Ride 2',
          distance: 70000,
          moving_time: 7200,
          elapsed_time: 7800,
          total_elevation_gain: 600,
          type: 'Ride',
          start_date: now.toISOString(),
          start_date_local: now.toISOString(),
          average_speed: 9.7,
          max_speed: 16.0,
          average_watts: 210,
          weighted_average_watts: 220,
          tss: 120
        }
      ];

      const res = computeWeeklyVolume(mockActivities, 250, 4);
      const currentWeek = res.weeks[res.weeks.length - 1];
      expect(currentWeek.rides).toBe(2);
      expect(currentWeek.distanceKm).toBe(120);
      expect(currentWeek.elevationM).toBe(1000);
      expect(currentWeek.tss).toBe(210);
      expect(currentWeek.isPeakTss).toBe(true);
      expect(currentWeek.isPeakDistance).toBe(true);
    });
  });

  describe('computeAnnualGoalProgress', () => {
    const currentYear = new Date().getFullYear();

    it('handles empty activities with zero progress', () => {
      const goal = computeAnnualGoalProgress([], 5000, currentYear);
      expect(goal.year).toBe(currentYear);
      expect(goal.targetKm).toBe(5000);
      expect(goal.currentKm).toBe(0);
      expect(goal.progressPct).toBe(0);
      expect(goal.remainingKm).toBe(5000);
      expect(goal.monthlyBreakdown).toHaveLength(12);
      expect(goal.isAheadOfPace).toBe(false);
      expect(goal.projectedCompletionDate).toBeNull();
    });

    it('correctly calculates completed goal status', () => {
      const mockActivities: StravaActivityRecord[] = [
        {
          id: 101,
          name: 'Epic Ultra',
          distance: 6000000, // 6,000 km
          moving_time: 360000,
          elapsed_time: 400000,
          total_elevation_gain: 30000,
          type: 'Ride',
          start_date: `${currentYear}-02-15T08:00:00Z`,
          start_date_local: `${currentYear}-02-15T08:00:00Z`,
          average_speed: 8.5,
          max_speed: 15.0
        }
      ];

      const goal = computeAnnualGoalProgress(mockActivities, 5000, currentYear);
      expect(goal.currentKm).toBe(6000);
      expect(goal.progressPct).toBe(120);
      expect(goal.remainingKm).toBe(0);
      expect(goal.isAheadOfPace).toBe(true);
      expect(goal.projectedCompletionDate).toBe('已达成');
      expect(goal.monthlyBreakdown[1].actualKm).toBe(6000); // February is index 1
    });

    it('calculates pace delta and required daily km for ongoing season', () => {
      const goal = computeAnnualGoalProgress(demoActivities, 6000, currentYear);
      expect(goal.monthlyBreakdown).toHaveLength(12);
      expect(goal.daysPassed).toBeGreaterThan(0);
      expect(goal.totalDaysInYear).toBeGreaterThanOrEqual(365);
      expect(typeof goal.isAheadOfPace).toBe('boolean');
      expect(typeof goal.requiredDailyKm).toBe('number');
    });
  });

  describe('computeAnnualElevationGoalProgress', () => {
    const currentYear = new Date().getFullYear();

    it('handles empty activities with zero elevation progress and 0 Everesting count', () => {
      const goal = computeAnnualElevationGoalProgress([], 50000, currentYear);
      expect(goal.year).toBe(currentYear);
      expect(goal.targetElevationM).toBe(50000);
      expect(goal.currentElevationM).toBe(0);
      expect(goal.progressPct).toBe(0);
      expect(goal.remainingElevationM).toBe(50000);
      expect(goal.monthlyBreakdown).toHaveLength(12);
      expect(goal.isAheadOfPace).toBe(false);
      expect(goal.everestingCount).toBe(0);
      expect(goal.projectedCompletionDate).toBeNull();
    });

    it('correctly calculates completed elevation goal and Everesting equivalents', () => {
      const mockActivities: StravaActivityRecord[] = [
        {
          id: 201,
          name: 'Everesting Challenge',
          distance: 250000,
          moving_time: 43200,
          elapsed_time: 50000,
          total_elevation_gain: 53088, // 6 x 8848m
          type: 'Ride',
          start_date: `${currentYear}-03-20T06:00:00Z`,
          start_date_local: `${currentYear}-03-20T06:00:00Z`,
          average_speed: 5.7,
          max_speed: 18.0
        }
      ];

      const goal = computeAnnualElevationGoalProgress(mockActivities, 50000, currentYear);
      expect(goal.currentElevationM).toBe(53088);
      expect(goal.progressPct).toBe(106.2);
      expect(goal.remainingElevationM).toBe(0);
      expect(goal.isAheadOfPace).toBe(true);
      expect(goal.projectedCompletionDate).toBe('已达成');
      expect(goal.everestingCount).toBe(6.0); // 53088 / 8848 = 6.0
      expect(goal.monthlyBreakdown[2].actualElevationM).toBe(53088); // March is index 2
    });

    it('calculates elevation pace delta and monthly breakdown for demo activities', () => {
      const goal = computeAnnualElevationGoalProgress(demoActivities, 60000, currentYear);
      expect(goal.monthlyBreakdown).toHaveLength(12);
      expect(goal.daysPassed).toBeGreaterThan(0);
      expect(typeof goal.paceDeltaElevationM).toBe('number');
      expect(typeof goal.isAheadOfPace).toBe('boolean');
      expect(typeof goal.monthlyRateElevationM).toBe('number');
      expect(typeof goal.requiredDailyElevationM).toBe('number');
      expect(goal.everestingCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('computePmcTimeline with forward projection', () => {
    it('creates forward projection points with 0 TSS and increasing/decaying metrics', () => {
      const timeline = computePmcTimeline(demoActivities, 250, 60, 14);
      expect(timeline).toHaveLength(60 + 14);

      const history = timeline.slice(0, 60);
      const projection = timeline.slice(60);

      expect(history.every(p => p.isProjection === false)).toBe(true);
      expect(projection.every(p => p.isProjection === true)).toBe(true);
      expect(projection.every(p => p.tss === 0)).toBe(true);

      const firstProj = projection[0];
      const lastProj = projection[projection.length - 1];
      expect(lastProj.atl).toBeLessThan(firstProj.atl);
      expect(lastProj.ctl).toBeLessThan(firstProj.ctl);

      // During taper, rapid ATL decay allows TSB to rebound to a peak form window
      const maxProjTsb = Math.max(...projection.map(p => p.tsb));
      expect(maxProjTsb).toBeGreaterThanOrEqual(firstProj.tsb);
    });

    it('findOptimalRaceWindow identifies valid race form window', () => {
      const timeline = computePmcTimeline(demoActivities, 250, 60, 14);
      const raceWindow = findOptimalRaceWindow(timeline);

      expect(raceWindow.peakDate).toBeDefined();
      expect(raceWindow.daysUntilPeak).toBeGreaterThanOrEqual(1);
      expect(raceWindow.daysUntilPeak).toBeLessThanOrEqual(14);
      expect(typeof raceWindow.peakTsb).toBe('number');
    });
  });

  describe('computePowerZoneDistribution (Phase 2)', () => {
    it('calculates all 7 Coggan zones summing to 100%', () => {
      const result = computePowerZoneDistribution(demoActivities, 250);
      expect(result.zones).toHaveLength(7);
      expect(result.totalMovingSec).toBeGreaterThan(0);

      const sumPct = result.zones.reduce((sum, z) => sum + z.pct, 0);
      expect(Math.round(sumPct)).toBeGreaterThanOrEqual(99);
      expect(Math.round(sumPct)).toBeLessThanOrEqual(101);

      expect(result.zones[0].zone).toBe('Z1');
      expect(result.zones[1].zone).toBe('Z2');
      expect(result.zones[6].zone).toBe('Z7');
      expect(result.pattern).toBeDefined();
      expect(result.patternLabel).toBeDefined();
    });

    it('handles empty activities safely', () => {
      const result = computePowerZoneDistribution([], 250);
      expect(result.zones).toHaveLength(7);
      expect(result.totalMovingSec).toBe(1); // guarded safe minimum
      expect(result.pattern).toBe('unstructured');
    });
  });

  describe('computeRampRateHistory (Phase 2)', () => {
    it('computes weekly CTL differences and classifies safety', () => {
      const timeline = computePmcTimeline(demoActivities, 250, 90, 0);
      const rampResult = computeRampRateHistory(timeline, 10);

      expect(rampResult.weeks.length).toBeGreaterThan(0);
      expect(typeof rampResult.maxRamp).toBe('number');
      expect(typeof rampResult.avgRamp).toBe('number');

      for (const w of rampResult.weeks) {
        expect(['recovery', 'safe', 'aggressive', 'danger']).toContain(w.status);
        expect(w.colorHex).toBeDefined();
      }
    });
  });

  describe('computeFtpHistory (Phase 2)', () => {
    it('generates chronological progression and breakthrough markers', () => {
      const history = computeFtpHistory(demoActivities, 260, 68);
      expect(history.timeline.length).toBeGreaterThanOrEqual(2);
      expect(history.currentFtp).toBe(260);
      expect(history.currentWkg).toBe(parseFloat((260 / 68).toFixed(2)));
      expect(history.gainWatts).toBeGreaterThanOrEqual(0);
      expect(history.peakFtp).toBeGreaterThanOrEqual(260);
    });
  });

  describe('computePersonalRecordsTimeline (Phase 3)', () => {
    it('extracts progressive PR breakthroughs chronologically', () => {
      const prs = computePersonalRecordsTimeline(demoActivities);
      expect(prs.length).toBeGreaterThan(0);

      // Verify that every PR has label, formattedValue, and activity details
      const firstPr = prs[0];
      expect(firstPr.type).toBeDefined();
      expect(firstPr.label).toBeDefined();
      expect(firstPr.formattedValue).toBeDefined();
      expect(firstPr.date).toBeDefined();
    });

    it('handles empty activities without crashing', () => {
      const prs = computePersonalRecordsTimeline([]);
      expect(prs).toEqual([]);
    });
  });

  describe('computeAerobicEfficiency (Phase 3)', () => {
    it('computes EF (NP/HR) and detects trend for eligible rides', () => {
      const result = computeAerobicEfficiency(demoActivities);
      expect(result.avgEf).toBeGreaterThan(0);
      expect(result.ridesWithEfCount).toBeGreaterThan(0);
      expect(['improving', 'stable', 'declining']).toContain(result.trend);
      expect(result.recentEf.length).toBeGreaterThan(0);
    });

    it('handles activities with missing heart rate cleanly', () => {
      const activitiesWithoutHr: StravaActivityRecord[] = [
        {
          id: 999,
          name: 'No HR Ride',
          distance: 50000,
          moving_time: 3600,
          elapsed_time: 3600,
          total_elevation_gain: 100,
          type: 'Ride',
          start_date: '2026-05-01T08:00:00Z',
          start_date_local: '2026-05-01T08:00:00Z',
          average_speed: 10.0,
          max_speed: 15.0,
          weighted_average_watts: 200
        }
      ];
      const result = computeAerobicEfficiency(activitiesWithoutHr);
      expect(result.avgEf).toBe(0);
      expect(result.ridesWithEfCount).toBe(0);
      expect(result.trend).toBe('stable');
    });
  });

  describe('Client-side Data Export (Phase 3)', () => {
    it('generates valid UTF-8 BOM CSV string with escaped fields', () => {
      const csv = exportActivitiesToCsv(demoActivities.slice(0, 3));
      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('活动ID');
      expect(csv).toContain('NP标准化功率(W)');

      const lines = csv.split('\n');
      expect(lines.length).toBe(4); // 1 header + 3 data lines
    });

    it('generates valid parseable JSON string', () => {
      const jsonStr = exportActivitiesToJson(demoActivities.slice(0, 2));
      const parsed = JSON.parse(jsonStr);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBe(demoActivities[0].id);
    });
  });

  describe('computeSegmentSummaryStats', () => {
    it('handles empty segments gracefully', () => {
      const stats = computeSegmentSummaryStats([]);
      expect(stats.totalSegments).toBe(0);
      expect(stats.totalGainM).toBe(0);
      expect(stats.prCount).toBe(0);
      expect(stats.komCount).toBe(0);
      expect(stats.totalAttempts).toBe(0);
    });

    it('correctly calculates summary stats for curated segments', () => {
      const stats = computeSegmentSummaryStats(CURATED_STRAVA_SEGMENTS);
      expect(stats.totalSegments).toBe(8);
      expect(stats.prCount).toBe(8);
      expect(stats.totalGainM).toBeGreaterThan(8000);
      expect(stats.totalAttempts).toBeGreaterThan(50);
      expect(stats.avgGradePct).toBeGreaterThan(5.0);
    });
  });

  describe('computeGearFleet (Phase 1)', () => {
    it('handles fallback bikes when empty bikes array provided', () => {
      const fleet = computeGearFleet([], []);
      expect(fleet.length).toBeGreaterThan(0);
      expect(fleet[0].components).toHaveLength(3);
      expect(fleet[0].components[0].status).toBeDefined();
    });

    it('retains maximum distance between bike profile mileage and recorded activities', () => {
      const customBikes = [
        { id: 'b_custom_1', name: 'Pinarello Dogma F', distance: 5000000, primary: true }
      ];
      const customActivities: StravaActivityRecord[] = [
        {
          id: 101,
          name: 'Sunday Morning Loop',
          distance: 60000,
          gear_id: 'b_custom_1',
          moving_time: 7200,
          elapsed_time: 7500,
          total_elevation_gain: 500,
          type: 'Ride',
          start_date: '2026-06-01T08:00:00Z',
          start_date_local: '2026-06-01T08:00:00Z',
          average_speed: 8.3,
          max_speed: 16.0
        }
      ];

      const fleet = computeGearFleet(customBikes, customActivities);
      expect(fleet).toHaveLength(1);
      expect(fleet[0].id).toBe('b_custom_1');
      // 5000000m = 5000km, which is > 60km, so distance should be 5000km
      expect(fleet[0].totalDistanceKm).toBe(5000);
      expect(fleet[0].components).toHaveLength(3);
    });
  });
});
