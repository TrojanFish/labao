/**
 * Strava Stream & Activity Adapter
 * Bridges Strava IndexedDB records into standard ActivityPoint[], LocalActivityRecord,
 * and GPX Waypoint formats for cross-tool analytical and mapping pipelines.
 */

import { ActivityPoint, analyzePoints, ActivityAnalysis } from './activityParser';
import { LocalActivityRecord } from './localActivityDb';
import { StravaActivityRecord, StravaStreamsRecord } from './indexedDb';

/**
 * Calculates Great-Circle distance (Haversine formula) in meters between two coordinates.
 */
function haversineDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Transforms StravaStreamsRecord into standard chronologically sorted ActivityPoint[]
 */
export function stravaStreamsToActivityPoints(
  stream: StravaStreamsRecord,
  activity?: StravaActivityRecord
): ActivityPoint[] {
  const len = Math.max(
    stream.time?.length || 0,
    stream.watts?.length || 0,
    stream.heartrate?.length || 0,
    stream.cadence?.length || 0,
    stream.altitude?.length || 0,
    stream.latlng?.length || 0
  );

  if (len === 0) return [];

  const points: ActivityPoint[] = [];
  const baseStartDate = activity?.start_date ? new Date(activity.start_date).getTime() : Date.now();

  let cumDistanceM = 0;
  let lastLat: number | undefined;
  let lastLon: number | undefined;

  for (let i = 0; i < len; i++) {
    const timeSec = stream.time?.[i] ?? i;
    const power = stream.watts?.[i];
    const heartRate = stream.heartrate?.[i];
    const cadence = stream.cadence?.[i];
    const velocityMs = stream.velocity_smooth?.[i];
    const speedKmh = velocityMs !== undefined ? Math.round(velocityMs * 3.6 * 10) / 10 : undefined;
    const altitude = stream.altitude?.[i];
    const lat = stream.latlng?.[i]?.[0];
    const lon = stream.latlng?.[i]?.[1];

    // Distance calculation: prefer haversine when GPS coordinates are available, else velocity integration
    if (lat !== undefined && lon !== undefined) {
      if (lastLat !== undefined && lastLon !== undefined) {
        const stepM = haversineDistanceM(lastLat, lastLon, lat, lon);
        cumDistanceM += stepM;
      }
      lastLat = lat;
      lastLon = lon;
    } else if (velocityMs !== undefined && i > 0) {
      const dt = Math.max(0, timeSec - (stream.time?.[i - 1] ?? (i - 1)));
      cumDistanceM += velocityMs * dt;
    }

    const timestamp = new Date(baseStartDate + timeSec * 1000);

    points.push({
      time: timeSec,
      timestamp,
      distance: Math.round(cumDistanceM),
      power: power !== undefined && !isNaN(power) ? Math.max(0, Math.round(power)) : undefined,
      heartRate: heartRate !== undefined && !isNaN(heartRate) ? Math.max(0, Math.round(heartRate)) : undefined,
      cadence: cadence !== undefined && !isNaN(cadence) ? Math.max(0, Math.round(cadence)) : undefined,
      speed: speedKmh,
      altitude: altitude !== undefined && !isNaN(altitude) ? Math.round(altitude * 10) / 10 : undefined,
      lat,
      lon
    });
  }

  return points;
}

export interface StravaWaypoint {
  id: string;
  lat: number;
  lng: number;
  elevation: number;
  distanceKm: number;
}

/**
 * Extracts standard GPS waypoints from Strava stream suitable for GpxRouteCreator map editing
 */
export function stravaStreamsToWaypoints(
  activity: StravaActivityRecord,
  stream?: StravaStreamsRecord | null,
  maxPoints = 800
): StravaWaypoint[] {
  if (!stream?.latlng || stream.latlng.length === 0) {
    return [];
  }

  const rawCount = stream.latlng.length;
  const step = rawCount > maxPoints ? Math.ceil(rawCount / maxPoints) : 1;
  const waypoints: StravaWaypoint[] = [];

  let cumDistM = 0;
  let prevLat: number | undefined;
  let prevLon: number | undefined;

  for (let i = 0; i < rawCount; i += step) {
    const coord = stream.latlng[i];
    if (!coord || coord.length < 2) continue;

    const [lat, lng] = coord;
    const elevation = stream.altitude?.[i] ?? 0;

    if (prevLat !== undefined && prevLon !== undefined) {
      cumDistM += haversineDistanceM(prevLat, prevLon, lat, lng);
    }
    prevLat = lat;
    prevLon = lng;

    waypoints.push({
      id: `wp-strava-${activity.id}-${i}`,
      lat,
      lng,
      elevation: Math.round(elevation),
      distanceKm: Math.round((cumDistM / 1000) * 100) / 100
    });
  }

  return waypoints;
}

/**
 * Generates valid standard GPX 1.1 XML string from Strava activity and streams
 */
export function exportStravaActivityToGpxXml(
  activity: StravaActivityRecord,
  stream?: StravaStreamsRecord | null
): string {
  if (!stream?.latlng || stream.latlng.length === 0) {
    throw new Error('当前活动无 GPS 航迹点，无法生成 GPX 路线');
  }

  const startTime = activity.start_date || new Date().toISOString();
  const baseTimeMs = new Date(startTime).getTime();
  const safeName = (activity.name || 'Strava_Activity').replace(/[<>&'"]/g, '');

  let trkptsXml = '';
  for (let i = 0; i < stream.latlng.length; i++) {
    const coord = stream.latlng[i];
    if (!coord || coord.length < 2) continue;
    const [lat, lon] = coord;
    const ele = stream.altitude?.[i] !== undefined ? `<ele>${stream.altitude[i]}</ele>` : '';
    const timeSec = stream.time?.[i] ?? i;
    const ptIso = new Date(baseTimeMs + timeSec * 1000).toISOString();

    let extensions = '';
    const hr = stream.heartrate?.[i];
    const cad = stream.cadence?.[i];
    const watts = stream.watts?.[i];

    if (hr !== undefined || cad !== undefined || watts !== undefined) {
      extensions = '<extensions><gpxtpx:TrackPointExtension>';
      if (hr !== undefined) extensions += `<gpxtpx:hr>${hr}</gpxtpx:hr>`;
      if (cad !== undefined) extensions += `<gpxtpx:cad>${cad}</gpxtpx:cad>`;
      if (watts !== undefined) extensions += `<gpxtpx:power>${watts}</gpxtpx:power>`;
      extensions += '</gpxtpx:TrackPointExtension></extensions>';
    }

    trkptsXml += `      <trkpt lat="${lat}" lon="${lon}">${ele}<time>${ptIso}</time>${extensions}</trkpt>\n`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="LaBao Cycling Tools (https://yolocycling.app)"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd http://www.garmin.com/xmlschemas/TrackPointExtension/v1 http://www.garmin.com/xmlschemas/TrackPointExtensionv1.xsd">
  <metadata>
    <name>${safeName}</name>
    <time>${startTime}</time>
  </metadata>
  <trk>
    <name>${safeName}</name>
    <type>Cycling</type>
    <trkseg>
${trkptsXml}    </trkseg>
  </trk>
</gpx>`;
}

/**
 * Ingests a Strava activity into a full LocalActivityRecord with computed Coggan analysis
 */
export function convertStravaToLocalRecord(
  activity: StravaActivityRecord,
  stream?: StravaStreamsRecord | null,
  ftpWatts = 220,
  weightKg = 68,
  maxHr = 185
): { record: LocalActivityRecord; analysis: ActivityAnalysis; points: ActivityPoint[] } {
  const points = stream ? stravaStreamsToActivityPoints(stream, activity) : [];

  let analysis: ActivityAnalysis;

  if (points.length > 0) {
    analysis = analyzePoints(
      points,
      activity.name,
      'strava',
      ftpWatts,
      weightKg,
      maxHr,
      {
        recordedCalories: activity.kilojoules ? Math.round(activity.kilojoules * 0.95) : undefined,
        rawPoints: points
      }
    );
  } else {
    // Synthetic analysis when no detailed stream is present
    const distKm = Math.round((activity.distance / 1000) * 100) / 100;
    const durSec = activity.elapsed_time || activity.moving_time || 0;
    const movSec = activity.moving_time || durSec;
    const np = activity.weighted_average_watts || activity.average_watts || 0;
    const ifScore = ftpWatts > 0 ? np / ftpWatts : 0;
    const tss = activity.tss || (durSec > 0 && ftpWatts > 0 ? (durSec * np * ifScore) / (ftpWatts * 3600) * 100 : 0);

    analysis = {
      fileName: `${activity.name}.strava`,
      fileType: 'strava',
      totalDurationSec: durSec,
      movingTimeSec: movSec,
      totalDistanceKm: distKm,
      elevationGainM: Math.round(activity.total_elevation_gain || 0),
      elevationLossM: 0,
      avgPower: Math.round(activity.average_watts || 0),
      maxPower: 0,
      normalizedPower: Math.round(np),
      intensityFactor: Math.round(ifScore * 100) / 100,
      tss: Math.round(tss),
      variabilityIndex: activity.average_watts && activity.average_watts > 0 ? Math.round((np / activity.average_watts) * 100) / 100 : 1,
      workKj: Math.round(activity.kilojoules || 0),
      caloriesKcal: Math.round((activity.kilojoules || 0) * 0.95),
      avgHeartRate: activity.average_heartrate ? Math.round(activity.average_heartrate) : undefined,
      maxHeartRate: activity.max_heartrate ? Math.round(activity.max_heartrate) : undefined,
      avgCadence: undefined,
      maxCadence: undefined,
      avgSpeedKmh: Math.round((activity.average_speed || 0) * 3.6 * 10) / 10,
      maxSpeedKmh: Math.round((activity.max_speed || 0) * 3.6 * 10) / 10,
      timeInPowerZones: [],
      timeInHrZones: [],
      mmp: [],
      points: [],
      sampledPoints: []
    };
  }

  const record: LocalActivityRecord = {
    id: `strava-${activity.id}`,
    name: activity.name,
    startDate: activity.start_date || new Date().toISOString(),
    startTime: new Date(activity.start_date || Date.now()).getTime(),
    distanceKm: analysis.totalDistanceKm,
    totalDurationSec: analysis.totalDurationSec,
    movingTimeSec: analysis.movingTimeSec,
    elevationGainM: analysis.elevationGainM,
    elevationLossM: analysis.elevationLossM,
    avgPower: analysis.avgPower,
    maxPower: analysis.maxPower,
    normalizedPower: analysis.normalizedPower,
    intensityFactor: analysis.intensityFactor,
    tss: analysis.tss,
    variabilityIndex: analysis.variabilityIndex,
    workKj: analysis.workKj,
    caloriesKcal: analysis.caloriesKcal,
    avgHeartRate: analysis.avgHeartRate,
    maxHeartRate: analysis.maxHeartRate,
    avgCadence: analysis.avgCadence,
    maxCadence: analysis.maxCadence,
    avgSpeedKmh: analysis.avgSpeedKmh,
    maxSpeedKmh: analysis.maxSpeedKmh,
    mmp: analysis.mmp,
    timeInPowerZones: analysis.timeInPowerZones,
    timeInHrZones: analysis.timeInHrZones,
    fileType: 'strava',
    fileName: `${activity.name}.strava`,
    hasHardwarePower: Boolean(activity.device_watts || (stream?.watts && stream.watts.length > 0)),
    hasHeartRate: Boolean(activity.has_heartrate || (stream?.heartrate && stream.heartrate.length > 0)),
    hasCadence: Boolean(stream?.cadence && stream.cadence.length > 0),
    createdAt: Date.now()
  };

  return { record, analysis, points };
}

/**
 * Generates a high-fidelity synthetic StravaStreamsRecord for offline simulation,
 * demo rides, or activities missing sensor streams.
 */
export function generateSimulatedStravaStream(
  activity: StravaActivityRecord,
  pointCount = 360
): StravaStreamsRecord {
  const durSec = Math.max(60, activity.moving_time || activity.elapsed_time || 3600);
  const distM = Math.max(1000, activity.distance || 30000);
  const eleGainM = Math.max(10, activity.total_elevation_gain || 300);
  const baseWatts = Math.max(80, activity.average_watts || activity.weighted_average_watts || 200);
  const baseHr = Math.max(90, activity.average_heartrate || 145);
  const maxHr = Math.min(205, activity.max_heartrate || Math.round(baseHr * 1.2));

  // Determine geo-anchor based on activity name keywords
  let baseLat = 30.225; // Default: Hangzhou West Lake / Longjing
  let baseLon = 120.125;
  let baseAlt = 45;

  const name = activity.name || '';
  if (name.includes('天荒坪') || name.includes('安吉')) {
    baseLat = 30.450;
    baseLon = 119.580;
    baseAlt = 220;
  } else if (name.includes('千岛湖')) {
    baseLat = 29.605;
    baseLon = 119.010;
    baseAlt = 108;
  } else if (name.includes('莫干山')) {
    baseLat = 30.610;
    baseLon = 119.850;
    baseAlt = 180;
  } else if (name.includes('钱塘江') || name.includes('绿道')) {
    baseLat = 30.180;
    baseLon = 120.210;
    baseAlt = 15;
  }

  // Determine sampling steps
  const pts = Math.min(1800, Math.max(60, pointCount));
  const timeStep = durSec / pts;
  const distStepM = distM / pts;

  const time: number[] = [];
  const watts: number[] = [];
  const heartrate: number[] = [];
  const cadence: number[] = [];
  const velocity_smooth: number[] = [];
  const altitude: number[] = [];
  const latlng: [number, number][] = [];

  const radiusDeg = (distM / 1000) * 0.0028; // ~0.0028 deg per km

  for (let i = 0; i < pts; i++) {
    const tSec = Math.round(i * timeStep);
    time.push(tSec);

    const progress = i / pts;

    // Realistic altitude with climbs, rolling peaks, and descent
    const hillWave = Math.sin(progress * Math.PI * 3.5) * 0.6 + Math.sin(progress * Math.PI * 8) * 0.4;
    const currentEle = Math.round(baseAlt + Math.max(0, hillWave * eleGainM * 0.95));
    altitude.push(currentEle);

    // Instantaneous gradient
    const prevEle = i > 0 ? altitude[i - 1] : baseAlt;
    const dEle = currentEle - prevEle;
    const gradePct = distStepM > 0 ? (dEle / distStepM) * 100 : 0;

    // Power model: higher on uphill, lower/zero on downhill
    let p = baseWatts;
    if (gradePct > 1.0) {
      p = Math.round(baseWatts * (1 + Math.min(0.65, (gradePct / 10) * 0.75)));
    } else if (gradePct < -1.5) {
      p = Math.max(0, Math.round(baseWatts * 0.3 - Math.abs(gradePct) * 15));
    }
    // Add micro surges and noise
    const surge = Math.sin(i / 12) * 25 + Math.cos(i / 5) * 15;
    const finalPower = Math.max(0, Math.round(p + surge));
    watts.push(finalPower);

    // Cadence model: 86-94 rpm when pedaling, 0 when coasting downhill
    if (finalPower > 30) {
      const cad = Math.round(88 + Math.sin(i / 8) * 5 + (finalPower > baseWatts * 1.2 ? 6 : 0));
      cadence.push(Math.max(60, Math.min(120, cad)));
    } else {
      cadence.push(0);
    }

    // Velocity model: depends on power and gradient
    let velMs = distM / durSec;
    if (gradePct > 2.0) {
      velMs = Math.max(2.8, velMs * (1 - Math.min(0.6, gradePct * 0.05)));
    } else if (gradePct < -2.0) {
      velMs = Math.min(20.0, velMs * (1 + Math.min(0.8, Math.abs(gradePct) * 0.07)));
    }
    velocity_smooth.push(parseFloat(velMs.toFixed(2)));

    // Heart rate model: lagged response to power + cardiac drift
    const driftBpm = progress * 6; // ~6 bpm cardiac drift
    const hrIntensity = finalPower / Math.max(100, baseWatts * 1.3);
    const targetHr = Math.round(baseHr * 0.85 + hrIntensity * (maxHr - baseHr * 0.85) + driftBpm);
    const finalHr = Math.min(maxHr, Math.max(80, targetHr));
    heartrate.push(finalHr);

    // GPS coordinates: parametric curving road trajectory
    const angle = progress * Math.PI * 2.8;
    const latOffset = Math.sin(angle) * radiusDeg * (0.85 + 0.15 * Math.cos(progress * 5));
    const lonOffset = Math.cos(angle) * radiusDeg * (1.1 + 0.1 * Math.sin(progress * 6));
    latlng.push([
      parseFloat((baseLat + latOffset).toFixed(6)),
      parseFloat((baseLon + lonOffset).toFixed(6))
    ]);
  }

  return {
    activityId: activity.id,
    updatedAt: Date.now(),
    time,
    watts,
    heartrate,
    cadence,
    velocity_smooth,
    altitude,
    latlng
  };
}

/**
 * Converts a LocalActivityRecord into a StravaActivityRecord
 * allowing local FIT/GPX/TCX activities to feed seamlessly into Strava Data Cockpit & PMC.
 */
export function convertLocalToStravaRecord(record: LocalActivityRecord): StravaActivityRecord {
  let numId = parseInt(record.id.replace(/\D/g, ''), 10);
  if (isNaN(numId) || numId <= 0) {
    numId = Math.abs(record.id.split('').reduce((acc, char) => ((acc << 5) - acc) + char.charCodeAt(0), 0)) || Date.now();
  }

  return {
    id: numId,
    name: record.name,
    distance: Math.round(record.distanceKm * 1000),
    moving_time: record.movingTimeSec || record.totalDurationSec,
    elapsed_time: record.totalDurationSec,
    total_elevation_gain: Math.round(record.elevationGainM),
    type: 'Ride',
    sport_type: 'Ride',
    start_date: record.startDate,
    start_date_local: record.startDate,
    average_speed: record.avgSpeedKmh > 0 ? parseFloat((record.avgSpeedKmh / 3.6).toFixed(2)) : 0,
    max_speed: record.maxSpeedKmh > 0 ? parseFloat((record.maxSpeedKmh / 3.6).toFixed(2)) : 0,
    average_watts: record.avgPower,
    weighted_average_watts: record.normalizedPower,
    kilojoules: record.workKj,
    device_watts: Boolean(record.hasHardwarePower),
    has_heartrate: Boolean(record.hasHeartRate),
    average_heartrate: record.avgHeartRate,
    max_heartrate: record.maxHeartRate,
    tss: record.tss,
    intensityFactor: record.intensityFactor
  };
}

