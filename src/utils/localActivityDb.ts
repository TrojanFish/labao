/**
 * Rouleur Local-First Activity Database
 * High-performance, zero-dependency client-side IndexedDB repository for cycling activities.
 * Privacy Guarantee: All ride telemetries, streams, and metrics stay 100% in browser storage.
 */

import { MmpValue, PowerZoneDistribution, HrZoneDistribution, ActivityPoint, ElectronicShiftingEvent } from './activityParser';

export interface LocalActivityRecord {
  id: string;
  name: string;
  startDate: string; // ISO string e.g. "2026-05-18T08:30:00.000Z"
  startTime: number; // ms timestamp for fast range filtering
  distanceKm: number;
  totalDurationSec: number;
  movingTimeSec: number;
  elevationGainM: number;
  elevationLossM: number;
  avgPower: number;
  maxPower: number;
  normalizedPower: number;
  intensityFactor: number;
  tss: number;
  variabilityIndex: number;
  workKj: number;
  caloriesKcal?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgCadence?: number;
  maxCadence?: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  mmp: MmpValue[]; // Standard durations: 1s, 5s, 10s, 15s, 30s, 1m, 2m, 3m, 5m, 8m, 10m, 12m, 15m, 20m, 30m, 45m, 60m
  timeInPowerZones?: PowerZoneDistribution[];
  timeInHrZones?: HrZoneDistribution[];
  fileType: 'fit' | 'gpx' | 'tcx' | 'demo' | 'strava' | 'manual';
  fileName?: string;
  fileSize?: number;
  fileHash?: string;
  hasHardwarePower?: boolean;
  hasHeartRate?: boolean;
  hasCadence?: boolean;
  hasShifting?: boolean;
  shiftCount?: number;
  isEstimatedPower?: boolean;
  notes?: string;
  createdAt: number;
}

export interface LocalActivityStream {
  activityId: string;
  points: ActivityPoint[];
  shiftingEvents?: ElectronicShiftingEvent[];
  updatedAt: number;
}

const DB_NAME = 'rouleur_activities_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export const getLocalActivityDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('activities')) {
        const actStore = db.createObjectStore('activities', { keyPath: 'id' });
        actStore.createIndex('startTime', 'startTime', { unique: false });
        actStore.createIndex('startDate', 'startDate', { unique: false });
        actStore.createIndex('fileHash', 'fileHash', { unique: false });
        actStore.createIndex('fileType', 'fileType', { unique: false });
      }
      if (!db.objectStoreNames.contains('streams')) {
        db.createObjectStore('streams', { keyPath: 'activityId' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
};

/**
 * Save a single activity record along with its detailed points stream
 */
export const saveActivityToDb = async (
  record: LocalActivityRecord,
  points?: ActivityPoint[],
  shiftingEvents?: ElectronicShiftingEvent[]
): Promise<void> => {
  const db = await getLocalActivityDb();
  return new Promise((resolve, reject) => {
    const stores = points && points.length > 0 ? ['activities', 'streams'] : ['activities'];
    const tx = db.transaction(stores, 'readwrite');
    const actStore = tx.objectStore('activities');
    actStore.put(record);

    if (points && points.length > 0) {
      const streamStore = tx.objectStore('streams');
      const streamRecord: LocalActivityStream = {
        activityId: record.id,
        points,
        shiftingEvents,
        updatedAt: Date.now()
      };
      streamStore.put(streamRecord);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

/**
 * Save multiple activity records in a single atomic transaction
 */
export const saveActivitiesBatchToDb = async (
  items: Array<{
    record: LocalActivityRecord;
    points?: ActivityPoint[];
    shiftingEvents?: ElectronicShiftingEvent[];
  }>
): Promise<void> => {
  if (items.length === 0) return;
  const db = await getLocalActivityDb();
  return new Promise((resolve, reject) => {
    const hasStreams = items.some(it => it.points && it.points.length > 0);
    const stores = hasStreams ? ['activities', 'streams'] : ['activities'];
    const tx = db.transaction(stores, 'readwrite');
    const actStore = tx.objectStore('activities');
    const streamStore = hasStreams ? tx.objectStore('streams') : null;

    for (const item of items) {
      actStore.put(item.record);
      if (streamStore && item.points && item.points.length > 0) {
        streamStore.put({
          activityId: item.record.id,
          points: item.points,
          shiftingEvents: item.shiftingEvents,
          updatedAt: Date.now()
        });
      }
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

/**
 * Get all activities ordered by startTime descending (newest first)
 */
export const getAllLocalActivities = async (): Promise<LocalActivityRecord[]> => {
  const db = await getLocalActivityDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('activities', 'readonly');
    const store = tx.objectStore('activities');
    const request = store.getAll();

    request.onsuccess = () => {
      const list = (request.result as LocalActivityRecord[]) || [];
      list.sort((a, b) => b.startTime - a.startTime);
      resolve(list);
    };

    request.onerror = () => reject(request.error);
  });
};

/**
 * Get activities within a timestamp window (ms)
 */
export const getLocalActivitiesInRange = async (
  startTimeMs: number,
  endTimeMs: number
): Promise<LocalActivityRecord[]> => {
  const db = await getLocalActivityDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('activities', 'readonly');
    const store = tx.objectStore('activities');
    const index = store.index('startTime');
    const range = IDBKeyRange.bound(startTimeMs, endTimeMs);
    const request = index.getAll(range);

    request.onsuccess = () => {
      const list = (request.result as LocalActivityRecord[]) || [];
      list.sort((a, b) => b.startTime - a.startTime);
      resolve(list);
    };

    request.onerror = () => reject(request.error);
  });
};

/**
 * Get detailed stream for a specific activity
 */
export const getLocalActivityStream = async (
  activityId: string
): Promise<LocalActivityStream | null> => {
  const db = await getLocalActivityDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('streams', 'readonly');
    const store = tx.objectStore('streams');
    const request = store.get(activityId);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Delete a single activity and its stream
 */
export const deleteLocalActivity = async (activityId: string): Promise<void> => {
  const db = await getLocalActivityDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['activities', 'streams'], 'readwrite');
    tx.objectStore('activities').delete(activityId);
    tx.objectStore('streams').delete(activityId);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

/**
 * Clear all local activities and streams
 */
export const clearAllLocalActivities = async (): Promise<void> => {
  const db = await getLocalActivityDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['activities', 'streams', 'meta'], 'readwrite');
    tx.objectStore('activities').clear();
    tx.objectStore('streams').clear();
    tx.objectStore('meta').clear();

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

/**
 * Export all local activity metadata as JSON string for backup
 */
export const exportActivitiesBackup = async (): Promise<string> => {
  const activities = await getAllLocalActivities();
  const backup = {
    version: 1,
    exportDate: new Date().toISOString(),
    appName: 'YoloCycling Pro',
    totalActivities: activities.length,
    activities
  };
  return JSON.stringify(backup, null, 2);
};

/**
 * Import activities from JSON backup
 */
export const importActivitiesBackup = async (jsonContent: string): Promise<number> => {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonContent);
  } catch {
    throw new Error('备份文件非有效的 JSON 格式');
  }

  const items: LocalActivityRecord[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.activities)
    ? parsed.activities
    : [];

  if (items.length === 0) return 0;

  await saveActivitiesBatchToDb(items.map(record => ({ record })));
  return items.length;
};

/**
 * Seed 15 realistic season activities across the past 90 days
 */
export const seedDemoSeasonActivities = async (
  ftpWatts: number = 240,
  weightKg: number = 68,
  maxHr: number = 185
): Promise<LocalActivityRecord[]> => {
  const now = Date.now();
  const DAY_MS = 86400 * 1000;

  const demoBlueprints = [
    {
      daysAgo: 85,
      name: '赛季启动 · 基础有氧耐力巡航',
      dist: 65.4,
      dur: 8100, // 2h 15m
      mov: 7800,
      elev: 340,
      pAvg: Math.round(ftpWatts * 0.65),
      pNp: Math.round(ftpWatts * 0.68),
      hrAvg: Math.round(maxHr * 0.68),
      cadAvg: 88,
      speedAvg: 30.2,
      tss: 105
    },
    {
      daysAgo: 78,
      name: '平路踏频微循环与节奏巡航',
      dist: 46.2,
      dur: 5400,
      mov: 5100,
      elev: 180,
      pAvg: Math.round(ftpWatts * 0.76),
      pNp: Math.round(ftpWatts * 0.79),
      hrAvg: Math.round(maxHr * 0.74),
      cadAvg: 92,
      speedAvg: 32.5,
      tss: 78
    },
    {
      daysAgo: 71,
      name: '周末俱乐部百公里长途拉练',
      dist: 104.8,
      dur: 13200, // 3h 40m
      mov: 12600,
      elev: 890,
      pAvg: Math.round(ftpWatts * 0.69),
      pNp: Math.round(ftpWatts * 0.76),
      hrAvg: Math.round(maxHr * 0.73),
      cadAvg: 86,
      speedAvg: 29.8,
      tss: 182
    },
    {
      daysAgo: 64,
      name: '甜区 3x15min 进阶阈值间歇',
      dist: 42.0,
      dur: 4800,
      mov: 4500,
      elev: 210,
      pAvg: Math.round(ftpWatts * 0.83),
      pNp: Math.round(ftpWatts * 0.90),
      hrAvg: Math.round(maxHr * 0.82),
      cadAvg: 90,
      speedAvg: 33.6,
      tss: 96
    },
    {
      daysAgo: 57,
      name: '丘陵起伏路爬坡突围拉练',
      dist: 76.5,
      dur: 9600,
      mov: 9000,
      elev: 1140,
      pAvg: Math.round(ftpWatts * 0.78),
      pNp: Math.round(ftpWatts * 0.86),
      hrAvg: Math.round(maxHr * 0.79),
      cadAvg: 84,
      speedAvg: 30.6,
      tss: 148
    },
    {
      daysAgo: 50,
      name: '雨天骑行台稳态补课',
      dist: 35.0,
      dur: 3900,
      mov: 3900,
      elev: 0,
      pAvg: Math.round(ftpWatts * 0.68),
      pNp: Math.round(ftpWatts * 0.70),
      hrAvg: Math.round(maxHr * 0.69),
      cadAvg: 91,
      speedAvg: 32.3,
      tss: 54
    },
    {
      daysAgo: 43,
      name: '半赛季 20min 功率峰值基准测试',
      dist: 38.5,
      dur: 4500,
      mov: 4200,
      elev: 190,
      pAvg: Math.round(ftpWatts * 0.88),
      pNp: Math.round(ftpWatts * 0.98),
      hrAvg: Math.round(maxHr * 0.88),
      cadAvg: 93,
      speedAvg: 33.1,
      tss: 94
    },
    {
      daysAgo: 36,
      name: 'Over-Under 4x8min 乳酸穿梭间歇',
      dist: 43.8,
      dur: 5100,
      mov: 4800,
      elev: 240,
      pAvg: Math.round(ftpWatts * 0.85),
      pNp: Math.round(ftpWatts * 0.93),
      hrAvg: Math.round(maxHr * 0.84),
      cadAvg: 89,
      speedAvg: 32.8,
      tss: 104
    },
    {
      daysAgo: 29,
      name: '周末大团骑冲刺抢分赛',
      dist: 82.6,
      dur: 10200,
      mov: 9600,
      elev: 640,
      pAvg: Math.round(ftpWatts * 0.79),
      pNp: Math.round(ftpWatts * 0.91),
      hrAvg: Math.round(maxHr * 0.81),
      cadAvg: 87,
      speedAvg: 31.0,
      tss: 165
    },
    {
      daysAgo: 22,
      name: 'VO2max 5x3min 摄氧极限突破',
      dist: 39.2,
      dur: 4500,
      mov: 4200,
      elev: 180,
      pAvg: Math.round(ftpWatts * 0.84),
      pNp: Math.round(ftpWatts * 0.97),
      hrAvg: Math.round(maxHr * 0.87),
      cadAvg: 94,
      speedAvg: 33.5,
      tss: 95
    },
    {
      daysAgo: 17,
      name: '千岛湖环湖经典耐力挑战',
      dist: 91.8,
      dur: 11400,
      mov: 10800,
      elev: 790,
      pAvg: Math.round(ftpWatts * 0.74),
      pNp: Math.round(ftpWatts * 0.83),
      hrAvg: Math.round(maxHr * 0.76),
      cadAvg: 88,
      speedAvg: 30.6,
      tss: 172
    },
    {
      daysAgo: 12,
      name: 'Tabata 40/20 无氧电量极致冲刺',
      dist: 33.4,
      dur: 3700,
      mov: 3500,
      elev: 130,
      pAvg: Math.round(ftpWatts * 0.86),
      pNp: Math.round(ftpWatts * 1.02),
      hrAvg: Math.round(maxHr * 0.89),
      cadAvg: 96,
      speedAvg: 34.3,
      tss: 80
    },
    {
      daysAgo: 8,
      name: '赛前两周高负荷最后冲顶',
      dist: 69.5,
      dur: 8400,
      mov: 8100,
      elev: 660,
      pAvg: Math.round(ftpWatts * 0.80),
      pNp: Math.round(ftpWatts * 0.90),
      hrAvg: Math.round(maxHr * 0.82),
      cadAvg: 89,
      speedAvg: 30.9,
      tss: 138
    },
    {
      daysAgo: 4,
      name: '赛前减量开机骑行',
      dist: 28.2,
      dur: 3200,
      mov: 3000,
      elev: 110,
      pAvg: Math.round(ftpWatts * 0.72),
      pNp: Math.round(ftpWatts * 0.80),
      hrAvg: Math.round(maxHr * 0.72),
      cadAvg: 92,
      speedAvg: 33.8,
      tss: 45
    },
    {
      daysAgo: 1,
      name: '赛前热身定妆与装备校验',
      dist: 18.5,
      dur: 2300,
      mov: 2100,
      elev: 60,
      pAvg: Math.round(ftpWatts * 0.65),
      pNp: Math.round(ftpWatts * 0.69),
      hrAvg: Math.round(maxHr * 0.66),
      cadAvg: 90,
      speedAvg: 31.7,
      tss: 26
    }
  ];

  const standardDurations = [
    { sec: 1, label: '1s', factor: 3.8 },
    { sec: 5, label: '5s', factor: 3.4 },
    { sec: 10, label: '10s', factor: 2.9 },
    { sec: 15, label: '15s', factor: 2.6 },
    { sec: 30, label: '30s', factor: 2.0 },
    { sec: 60, label: '1m', factor: 1.6 },
    { sec: 120, label: '2m', factor: 1.35 },
    { sec: 180, label: '3m', factor: 1.25 },
    { sec: 300, label: '5m', factor: 1.15 },
    { sec: 480, label: '8m', factor: 1.08 },
    { sec: 600, label: '10m', factor: 1.04 },
    { sec: 720, label: '12m', factor: 1.01 },
    { sec: 900, label: '15m', factor: 0.98 },
    { sec: 1200, label: '20m', factor: 0.95 },
    { sec: 1800, label: '30m', factor: 0.90 },
    { sec: 2700, label: '45m', factor: 0.85 },
    { sec: 3600, label: '60m', factor: 0.80 }
  ];

  const records: LocalActivityRecord[] = demoBlueprints.map((b, idx) => {
    const actTime = now - b.daysAgo * DAY_MS + 9 * 3600 * 1000; // 9:00 AM
    const dateObj = new Date(actTime);
    const ifScore = parseFloat((b.pNp / ftpWatts).toFixed(2));
    const vi = parseFloat((b.pNp / b.pAvg).toFixed(2));
    const workKj = Math.round((b.pAvg * b.mov) / 1000);

    // Generate realistic MMP array based on activity profile
    const sprintBoost = b.name.includes('Sprints') || b.name.includes('Anaerobic') ? 1.2 : 0.95;
    const enduranceBoost = b.name.includes('Century') || b.name.includes('Lake') ? 1.05 : 0.92;
    const thresholdBoost = b.name.includes('FTP') || b.name.includes('Sweet Spot') ? 1.1 : 0.94;

    const mmp: MmpValue[] = standardDurations.map(d => {
      let f = d.factor;
      if (d.sec <= 30) f *= sprintBoost;
      else if (d.sec <= 1200) f *= thresholdBoost;
      else f *= enduranceBoost;

      // Add a tiny variation
      const noise = 0.98 + (idx % 5) * 0.01;
      const peakW = Math.round(ftpWatts * f * noise);
      return {
        durationSec: d.sec,
        label: d.label,
        watts: peakW,
        wkg: parseFloat((peakW / weightKg).toFixed(2))
      };
    });

    const maxPower = mmp[0].watts + 30;

    return {
      id: `demo_season_${idx + 1}_${actTime}`,
      name: b.name,
      startDate: dateObj.toISOString(),
      startTime: actTime,
      distanceKm: b.dist,
      totalDurationSec: b.dur,
      movingTimeSec: b.mov,
      elevationGainM: b.elev,
      elevationLossM: b.elev,
      avgPower: b.pAvg,
      maxPower,
      normalizedPower: b.pNp,
      intensityFactor: ifScore,
      tss: b.tss,
      variabilityIndex: vi,
      workKj,
      caloriesKcal: Math.round(workKj * 1.08),
      avgHeartRate: b.hrAvg,
      maxHeartRate: Math.min(maxHr, b.hrAvg + 22),
      avgCadence: b.cadAvg,
      maxCadence: b.cadAvg + 28,
      avgSpeedKmh: b.speedAvg,
      maxSpeedKmh: parseFloat((b.speedAvg * 1.8).toFixed(1)),
      mmp,
      fileType: 'demo',
      hasHardwarePower: true,
      hasHeartRate: true,
      hasCadence: true,
      createdAt: now
    };
  });

  await saveActivitiesBatchToDb(records.map(record => ({ record })));
  return records;
};
