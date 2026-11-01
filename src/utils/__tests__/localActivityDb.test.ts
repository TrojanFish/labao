import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getLocalActivityDb,
  saveActivityToDb,
  saveActivitiesBatchToDb,
  getAllLocalActivities,
  getLocalActivitiesInRange,
  getLocalActivityStream,
  deleteLocalActivity,
  clearAllLocalActivities,
  exportActivitiesBackup,
  importActivitiesBackup,
  seedDemoSeasonActivities,
  LocalActivityRecord
} from '../localActivityDb';

/**
 * Lightweight in-memory IndexedDB Mock for Vitest Node.js test runner
 */
class MockIDBKeyRange {
  lower: number;
  upper: number;
  constructor(lower: number, upper: number) {
    this.lower = lower;
    this.upper = upper;
  }
  static bound(lower: number, upper: number) {
    return new MockIDBKeyRange(lower, upper);
  }
}

function createMockIndexedDB() {
  const storeData: Record<string, Map<any, any>> = {};
  const storeIndexes: Record<string, Record<string, string>> = {};

  const getStore = (name: string) => {
    if (!storeData[name]) storeData[name] = new Map();
    return storeData[name];
  };

  const mockDb = {
    objectStoreNames: {
      contains: (name: string) => !!storeData[name]
    },
    createObjectStore: (name: string, options?: { keyPath?: string }) => {
      storeData[name] = new Map();
      storeIndexes[name] = {};
      const keyPath = options?.keyPath || 'id';

      return {
        createIndex: (idxName: string, path: string) => {
          storeIndexes[name][idxName] = path;
        }
      };
    },
    transaction: (storeNames: string | string[], _mode: 'readonly' | 'readwrite') => {
      const tx: any = {
        error: null,
        oncomplete: null as any,
        onerror: null as any,
        objectStore: (storeName: string) => {
          const map = getStore(storeName);
          return {
            put: (val: any) => {
              const key = val.id !== undefined ? val.id : (val.activityId !== undefined ? val.activityId : val.key);
              map.set(key, JSON.parse(JSON.stringify(val)));
            },
            get: (key: any) => {
              const req: any = { result: map.get(key) ? JSON.parse(JSON.stringify(map.get(key))) : undefined };
              queueMicrotask(() => req.onsuccess && req.onsuccess({ target: req }));
              return req;
            },
            getAll: (range?: MockIDBKeyRange) => {
              let items = Array.from(map.values()).map(v => JSON.parse(JSON.stringify(v)));
              if (range) {
                items = items.filter(it => it.startTime >= range.lower && it.startTime <= range.upper);
              }
              const req: any = { result: items };
              queueMicrotask(() => req.onsuccess && req.onsuccess({ target: req }));
              return req;
            },
            delete: (key: any) => {
              map.delete(key);
            },
            clear: () => {
              map.clear();
            },
            index: (idxName: string) => {
              const field = storeIndexes[storeName]?.[idxName] || idxName;
              return {
                getAll: (range?: MockIDBKeyRange) => {
                  let items = Array.from(map.values()).map(v => JSON.parse(JSON.stringify(v)));
                  if (range) {
                    items = items.filter(it => {
                      const val = it[field];
                      return val >= range.lower && val <= range.upper;
                    });
                  }
                  const req: any = { result: items };
                  queueMicrotask(() => req.onsuccess && req.onsuccess({ target: req }));
                  return req;
                }
              };
            }
          };
        }
      };

      queueMicrotask(() => {
        if (tx.oncomplete) tx.oncomplete({ target: tx });
      });

      return tx;
    }
  };

  const indexedDB = {
    open: (_name: string, _version: number) => {
      const openReq: any = {
        result: mockDb,
        error: null,
        onsuccess: null as any,
        onerror: null as any,
        onupgradeneeded: null as any
      };

      queueMicrotask(() => {
        if (openReq.onupgradeneeded) {
          openReq.onupgradeneeded({ target: openReq });
        }
        if (openReq.onsuccess) {
          openReq.onsuccess({ target: openReq });
        }
      });

      return openReq;
    }
  };

  return { indexedDB, storeData };
}

describe('Local-First Activity IndexedDB Storage Suite', () => {
  let originalWindow: any;

  beforeEach(async () => {
    originalWindow = globalThis.window;
    if (!(globalThis as any).window?.indexedDB) {
      const { indexedDB } = createMockIndexedDB();
      (globalThis as any).window = {
        indexedDB
      };
      (globalThis as any).IDBKeyRange = MockIDBKeyRange;
    }
    await clearAllLocalActivities();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects to native IndexedDB instance successfully', async () => {
    const db = await getLocalActivityDb();
    expect(db).toBeDefined();
    expect(db.objectStoreNames.contains('activities')).toBe(true);
    expect(db.objectStoreNames.contains('streams')).toBe(true);
    expect(db.objectStoreNames.contains('meta')).toBe(true);
  });

  it('stores and retrieves a single activity record with streams', async () => {
    const now = Date.now();
    const testRecord: LocalActivityRecord = {
      id: 'ride_hangzhou_climb_01',
      name: '龙井问茶 · 晨间高踏频爬坡',
      startDate: new Date(now).toISOString(),
      startTime: now,
      distanceKm: 24.5,
      totalDurationSec: 3600,
      movingTimeSec: 3520,
      elevationGainM: 420,
      elevationLossM: 410,
      avgPower: 220,
      maxPower: 480,
      normalizedPower: 238,
      intensityFactor: 0.95,
      tss: 88,
      variabilityIndex: 1.08,
      workKj: 774,
      avgHeartRate: 155,
      maxHeartRate: 178,
      avgCadence: 88,
      maxCadence: 104,
      avgSpeedKmh: 25.1,
      maxSpeedKmh: 54.2,
      mmp: [{ durationSec: 5, label: '5s', watts: 450, wkg: 6.62 }],
      fileType: 'fit',
      hasHardwarePower: true,
      hasHeartRate: true,
      hasCadence: true,
      createdAt: now
    };

    const mockPoints = [
      { time: 0, distance: 0, power: 210, heartRate: 130, cadence: 85, speed: 20 },
      { time: 10, distance: 55, power: 235, heartRate: 145, cadence: 88, speed: 22 }
    ];

    await saveActivityToDb(testRecord, mockPoints);

    // Retrieve activities
    const all = await getAllLocalActivities();
    expect(all.length).toBe(1);
    expect(all[0].id).toBe('ride_hangzhou_climb_01');
    expect(all[0].name).toBe('龙井问茶 · 晨间高踏频爬坡');
    expect(all[0].normalizedPower).toBe(238);

    // Retrieve stream
    const stream = await getLocalActivityStream('ride_hangzhou_climb_01');
    expect(stream).not.toBeNull();
    expect(stream!.activityId).toBe('ride_hangzhou_climb_01');
    expect(stream!.points.length).toBe(2);
    expect(stream!.points[1].power).toBe(235);
  });

  it('supports atomic batch insertions and sorts descending by startTime', async () => {
    const baseTime = Date.now();
    const batch: Array<{ record: LocalActivityRecord }> = [
      {
        record: {
          id: 'ride_1_older',
          name: '旧骑行',
          startDate: new Date(baseTime - 86400000).toISOString(),
          startTime: baseTime - 86400000,
          distanceKm: 30,
          totalDurationSec: 3600,
          movingTimeSec: 3600,
          elevationGainM: 100,
          elevationLossM: 100,
          avgPower: 180,
          maxPower: 300,
          normalizedPower: 185,
          intensityFactor: 0.74,
          tss: 55,
          variabilityIndex: 1.03,
          workKj: 648,
          avgSpeedKmh: 30,
          maxSpeedKmh: 45,
          mmp: [],
          fileType: 'gpx',
          createdAt: baseTime
        }
      },
      {
        record: {
          id: 'ride_2_newer',
          name: '新骑行',
          startDate: new Date(baseTime).toISOString(),
          startTime: baseTime,
          distanceKm: 45,
          totalDurationSec: 4500,
          movingTimeSec: 4400,
          elevationGainM: 300,
          elevationLossM: 300,
          avgPower: 210,
          maxPower: 400,
          normalizedPower: 220,
          intensityFactor: 0.88,
          tss: 85,
          variabilityIndex: 1.05,
          workKj: 924,
          avgSpeedKmh: 34,
          maxSpeedKmh: 52,
          mmp: [],
          fileType: 'fit',
          createdAt: baseTime
        }
      }
    ];

    await saveActivitiesBatchToDb(batch);

    const sorted = await getAllLocalActivities();
    expect(sorted.length).toBe(2);
    // Newest ride must be first
    expect(sorted[0].id).toBe('ride_2_newer');
    expect(sorted[1].id).toBe('ride_1_older');
  });

  it('filters activities within a timestamp range accurately', async () => {
    const t0 = 1700000000000;
    const items = [
      { id: 'act_1', startTime: t0 + 1000 },
      { id: 'act_2', startTime: t0 + 5000 },
      { id: 'act_3', startTime: t0 + 9000 }
    ].map(it => ({
      record: {
        id: it.id,
        name: it.id,
        startDate: new Date(it.startTime).toISOString(),
        startTime: it.startTime,
        distanceKm: 10,
        totalDurationSec: 1000,
        movingTimeSec: 1000,
        elevationGainM: 50,
        elevationLossM: 50,
        avgPower: 200,
        maxPower: 300,
        normalizedPower: 200,
        intensityFactor: 0.8,
        tss: 40,
        variabilityIndex: 1,
        workKj: 200,
        avgSpeedKmh: 25,
        maxSpeedKmh: 35,
        mmp: [],
        fileType: 'manual' as const,
        createdAt: it.startTime
      }
    }));

    await saveActivitiesBatchToDb(items);

    // Filter between t0 + 2000 and t0 + 8000 -> should only find act_2
    const results = await getLocalActivitiesInRange(t0 + 2000, t0 + 8000);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('act_2');
  });

  it('exports activities backup and re-imports cleanly', async () => {
    const now = Date.now();
    await saveActivityToDb({
      id: 'backup_test_01',
      name: '备份测试活动',
      startDate: new Date(now).toISOString(),
      startTime: now,
      distanceKm: 50,
      totalDurationSec: 5000,
      movingTimeSec: 4800,
      elevationGainM: 600,
      elevationLossM: 600,
      avgPower: 215,
      maxPower: 500,
      normalizedPower: 230,
      intensityFactor: 0.92,
      tss: 110,
      variabilityIndex: 1.07,
      workKj: 1032,
      avgSpeedKmh: 31.2,
      maxSpeedKmh: 58.0,
      mmp: [],
      fileType: 'fit',
      createdAt: now
    });

    const backupJson = await exportActivitiesBackup();
    expect(backupJson).toContain('YoloCycling Pro');
    expect(backupJson).toContain('backup_test_01');

    // Clear DB
    await clearAllLocalActivities();
    expect((await getAllLocalActivities()).length).toBe(0);

    // Re-import
    const count = await importActivitiesBackup(backupJson);
    expect(count).toBe(1);

    const reloaded = await getAllLocalActivities();
    expect(reloaded.length).toBe(1);
    expect(reloaded[0].name).toBe('备份测试活动');
  });

  it('rejects corrupt or invalid JSON when importing backup', async () => {
    await expect(importActivitiesBackup('INVALID_JSON_CORRUPT{')).rejects.toThrow('备份文件非有效的 JSON 格式');
  });

  it('seeds 15 realistic season training activities across past 90 days', async () => {
    const seeded = await seedDemoSeasonActivities(250, 68, 185);
    expect(seeded.length).toBe(15);

    // Verify all seeded activities have valid MMP curves and physiological metrics
    for (const act of seeded) {
      expect(act.mmp.length).toBe(17);
      expect(act.tss).toBeGreaterThan(0);
      expect(act.normalizedPower).toBeGreaterThan(0);
      expect(act.distanceKm).toBeGreaterThan(10);
    }

    // Verify persisted in DB
    const all = await getAllLocalActivities();
    expect(all.length).toBe(15);
  });

  it('deletes an activity and cleans up its stream', async () => {
    const now = Date.now();
    await saveActivityToDb(
      {
        id: 'act_to_delete',
        name: '待删除测试活动',
        startDate: new Date(now).toISOString(),
        startTime: now,
        distanceKm: 20,
        totalDurationSec: 2000,
        movingTimeSec: 1900,
        elevationGainM: 100,
        elevationLossM: 100,
        avgPower: 200,
        maxPower: 300,
        normalizedPower: 210,
        intensityFactor: 0.84,
        tss: 45,
        variabilityIndex: 1.05,
        workKj: 380,
        avgSpeedKmh: 30,
        maxSpeedKmh: 45,
        mmp: [],
        fileType: 'fit',
        createdAt: now
      },
      [{ time: 0, distance: 0, power: 200 }]
    );

    expect(await getLocalActivityStream('act_to_delete')).not.toBeNull();
    await deleteLocalActivity('act_to_delete');

    const all = await getAllLocalActivities();
    expect(all.find(a => a.id === 'act_to_delete')).toBeUndefined();
    expect(await getLocalActivityStream('act_to_delete')).toBeNull();
  });
});
