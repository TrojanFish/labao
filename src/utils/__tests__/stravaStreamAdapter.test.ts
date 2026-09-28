import { describe, it, expect } from 'vitest';
import {
  stravaStreamsToActivityPoints,
  stravaStreamsToWaypoints,
  exportStravaActivityToGpxXml,
  convertStravaToLocalRecord,
  convertLocalToStravaRecord
} from '../stravaStreamAdapter';
import { StravaActivityRecord, StravaStreamsRecord } from '../indexedDb';

describe('stravaStreamAdapter', () => {
  const mockActivity: StravaActivityRecord = {
    id: 12345678,
    name: 'Longjing Hill Climb Intervals',
    distance: 25000,
    moving_time: 3600,
    elapsed_time: 3700,
    total_elevation_gain: 450,
    type: 'Ride',
    start_date: '2026-05-18T08:00:00Z',
    start_date_local: '2026-05-18T16:00:00Z',
    average_speed: 6.94, // ~25 km/h
    max_speed: 13.88,
    average_watts: 200,
    weighted_average_watts: 220,
    kilojoules: 720,
    device_watts: true,
    has_heartrate: true,
    average_heartrate: 150,
    max_heartrate: 178
  };

  const mockStreams: StravaStreamsRecord = {
    activityId: 12345678,
    updatedAt: Date.now(),
    time: [0, 1, 2, 3, 4, 5],
    watts: [180, 200, 220, 240, 260, 280],
    heartrate: [140, 142, 145, 148, 150, 152],
    cadence: [85, 86, 88, 90, 92, 90],
    velocity_smooth: [6.5, 6.8, 7.0, 7.2, 7.5, 7.8],
    altitude: [100, 102, 105, 108, 112, 115],
    latlng: [
      [30.221, 120.112],
      [30.222, 120.113],
      [30.223, 120.114],
      [30.224, 120.115],
      [30.225, 120.116],
      [30.226, 120.117]
    ]
  };

  it('converts StravaStreamsRecord to ActivityPoint[] correctly', () => {
    const points = stravaStreamsToActivityPoints(mockStreams, mockActivity);
    expect(points.length).toBe(6);

    const p0 = points[0];
    expect(p0.time).toBe(0);
    expect(p0.power).toBe(180);
    expect(p0.heartRate).toBe(140);
    expect(p0.cadence).toBe(85);
    expect(p0.speed).toBeCloseTo(23.4, 1); // 6.5 * 3.6
    expect(p0.altitude).toBe(100);
    expect(p0.lat).toBe(30.221);
    expect(p0.lon).toBe(120.112);

    // Distance should be monotonically non-decreasing
    for (let i = 1; i < points.length; i++) {
      expect(points[i].distance).toBeGreaterThanOrEqual(points[i - 1].distance);
    }
  });

  it('extracts GPS waypoints suitable for GPX route editor', () => {
    const waypoints = stravaStreamsToWaypoints(mockActivity, mockStreams, 10);
    expect(waypoints.length).toBe(6);
    expect(waypoints[0].lat).toBe(30.221);
    expect(waypoints[0].lng).toBe(120.112);
    expect(waypoints[0].elevation).toBe(100);
    expect(waypoints[0].distanceKm).toBe(0);
    expect(waypoints[waypoints.length - 1].distanceKm).toBeGreaterThan(0);
  });

  it('exports standard GPX 1.1 XML with TrackPointExtensions', () => {
    const xml = exportStravaActivityToGpxXml(mockActivity, mockStreams);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<name>Longjing Hill Climb Intervals</name>');
    expect(xml).toContain('<trkpt lat="30.221" lon="120.112">');
    expect(xml).toContain('<ele>100</ele>');
    expect(xml).toContain('<gpxtpx:TrackPointExtension>');
    expect(xml).toContain('<gpxtpx:hr>140</gpxtpx:hr>');
    expect(xml).toContain('<gpxtpx:cad>85</gpxtpx:cad>');
    expect(xml).toContain('<gpxtpx:power>180</gpxtpx:power>');
  });

  it('throws error when exporting GPX for indoor activity without GPS', () => {
    const indoorStreams: StravaStreamsRecord = {
      activityId: 999,
      updatedAt: Date.now(),
      time: [0, 1, 2],
      watts: [150, 160, 170]
    };
    expect(() => exportStravaActivityToGpxXml(mockActivity, indoorStreams)).toThrowError(
      '当前活动无 GPS 航迹点，无法生成 GPX 路线'
    );
  });

  it('converts Strava activity with stream to LocalActivityRecord with Coggan metrics', () => {
    // Generate 40 seconds of stream to allow NP calculation
    const extendedStreams: StravaStreamsRecord = {
      activityId: 12345678,
      updatedAt: Date.now(),
      time: Array.from({ length: 45 }, (_, i) => i),
      watts: Array.from({ length: 45 }, () => 220),
      heartrate: Array.from({ length: 45 }, () => 150),
      cadence: Array.from({ length: 45 }, () => 90),
      velocity_smooth: Array.from({ length: 45 }, () => 7.0),
      altitude: Array.from({ length: 45 }, (_, i) => 100 + i * 2)
    };

    const { record, analysis, points } = convertStravaToLocalRecord(
      mockActivity,
      extendedStreams,
      220,
      68,
      185
    );

    expect(record.id).toBe('strava-12345678');
    expect(record.fileType).toBe('strava');
    expect(record.hasHardwarePower).toBe(true);
    expect(points.length).toBe(45);
    expect(analysis.fileType).toBe('strava');
    expect(analysis.normalizedPower).toBeGreaterThan(0);
    expect(analysis.intensityFactor).toBeGreaterThan(0);
  });

  it('handles activity conversion gracefully when no stream is present (fallback mode)', () => {
    const { record, analysis, points } = convertStravaToLocalRecord(
      mockActivity,
      null,
      220,
      68,
      185
    );

    expect(record.id).toBe('strava-12345678');
    expect(record.fileType).toBe('strava');
    expect(points.length).toBe(0);
    expect(analysis.normalizedPower).toBe(220);
    expect(analysis.totalDistanceKm).toBe(25);
  });

  it('converts LocalActivityRecord to StravaActivityRecord accurately', () => {
    const localRecord = {
      id: 'local-act-987654',
      name: 'Sunday Morning Century Ride',
      startDate: '2026-06-21T06:30:00.000Z',
      startTime: 1782023400000,
      distanceKm: 102.5,
      totalDurationSec: 14400,
      movingTimeSec: 13500,
      elevationGainM: 1250,
      elevationLossM: 1240,
      avgPower: 215,
      maxPower: 680,
      normalizedPower: 238,
      intensityFactor: 0.85,
      tss: 260,
      variabilityIndex: 1.11,
      workKj: 2900,
      caloriesKcal: 2750,
      avgHeartRate: 148,
      maxHeartRate: 175,
      avgCadence: 88,
      maxCadence: 112,
      avgSpeedKmh: 27.33,
      maxSpeedKmh: 58.4,
      mmp: [],
      fileType: 'fit' as const,
      hasHardwarePower: true,
      hasHeartRate: true,
      createdAt: Date.now()
    };

    const stravaRecord = convertLocalToStravaRecord(localRecord);
    expect(stravaRecord.name).toBe('Sunday Morning Century Ride');
    expect(stravaRecord.distance).toBe(102500); // 102.5 km -> 102500 m
    expect(stravaRecord.moving_time).toBe(13500);
    expect(stravaRecord.elapsed_time).toBe(14400);
    expect(stravaRecord.total_elevation_gain).toBe(1250);
    expect(stravaRecord.average_watts).toBe(215);
    expect(stravaRecord.weighted_average_watts).toBe(238);
    expect(stravaRecord.tss).toBe(260);
    expect(stravaRecord.intensityFactor).toBe(0.85);
    expect(stravaRecord.device_watts).toBe(true);
    expect(stravaRecord.has_heartrate).toBe(true);
    expect(stravaRecord.average_heartrate).toBe(148);
  });
});
