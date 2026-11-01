import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveActivitiesToDb,
  getAllActivitiesFromDb,
  saveStreamToDb,
  getStreamFromDb,
  clearStravaDb,
  getStravaStorageInfo,
  StravaActivityRecord
} from '../indexedDb';

function createMockIndexedDB() {
  const storeData: Record<string, Map<any, any>> = {
    activities: new Map(),
    streams: new Map(),
    routes: new Map(),
    meta: new Map()
  };

  const mockDb = {
    objectStoreNames: {
      contains: (name: string) => !!storeData[name]
    },
    createObjectStore: (name: string) => {
      if (!storeData[name]) storeData[name] = new Map();
      return {};
    },
    transaction: (_storeNames: string | string[], _mode: 'readonly' | 'readwrite') => {
      const tx: any = {
        error: null,
        oncomplete: null as any,
        onerror: null as any,
        objectStore: (storeName: string) => {
          const map = storeData[storeName] || new Map();
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
            getAll: () => {
              const req: any = { result: Array.from(map.values()).map(v => JSON.parse(JSON.stringify(v))) };
              queueMicrotask(() => req.onsuccess && req.onsuccess({ target: req }));
              return req;
            },
            count: () => {
              const req: any = { result: map.size };
              queueMicrotask(() => req.onsuccess && req.onsuccess({ target: req }));
              return req;
            },
            clear: () => {
              map.clear();
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

  return {
    open: (_name: string, _version: number) => {
      const req: any = {
        result: mockDb,
        onsuccess: null as any,
        onerror: null as any,
        onupgradeneeded: null as any
      };
      queueMicrotask(() => {
        if (req.onupgradeneeded) {
          req.onupgradeneeded({ target: req });
        }
        if (req.onsuccess) {
          req.onsuccess({ target: req });
        }
      });
      return req;
    }
  };
}

describe('indexedDb - Strava Local-First Storage & Health', () => {
  let originalIndexedDB: any;

  beforeEach(() => {
    originalIndexedDB = (globalThis as any).indexedDB;
    (globalThis as any).indexedDB = createMockIndexedDB();
    (globalThis as any).window = globalThis;
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        storage: {
          estimate: vi.fn().mockResolvedValue({
            quota: 10 * 1024 * 1024 * 1024, // 10 GB
            usage: 50 * 1024 * 1024 // 50 MB
          })
        }
      },
      configurable: true,
      writable: true
    });
  });

  afterEach(() => {
    (globalThis as any).indexedDB = originalIndexedDB;
  });

  it('saves and retrieves activities with sorting', async () => {
    const mockActs: StravaActivityRecord[] = [
      {
        id: 1,
        name: 'Morning Ride',
        distance: 30000,
        moving_time: 3600,
        elapsed_time: 3800,
        total_elevation_gain: 250,
        type: 'Ride',
        start_date: '2026-05-10T08:00:00Z',
        start_date_local: '2026-05-10T16:00:00Z',
        average_speed: 8.33,
        max_speed: 15.0
      },
      {
        id: 2,
        name: 'Evening Ride',
        distance: 40000,
        moving_time: 4200,
        elapsed_time: 4500,
        total_elevation_gain: 350,
        type: 'Ride',
        start_date: '2026-05-12T18:00:00Z',
        start_date_local: '2026-05-13T02:00:00Z',
        average_speed: 9.52,
        max_speed: 16.5
      }
    ];

    await saveActivitiesToDb(mockActs);
    const retrieved = await getAllActivitiesFromDb();
    expect(retrieved).toHaveLength(2);
    // Should be sorted start_date descending
    expect(retrieved[0].id).toBe(2);
    expect(retrieved[1].id).toBe(1);
  });

  it('correctly reports storage info and hardware quota', async () => {
    const info = await getStravaStorageInfo();
    expect(info).toBeDefined();
    expect(typeof info.activityCount).toBe('number');
    expect(typeof info.streamCount).toBe('number');
    expect(typeof info.approxDbSizeBytes).toBe('number');
    expect(info.browserQuotaBytes).toBe(10 * 1024 * 1024 * 1024);
    expect(info.browserUsageBytes).toBe(50 * 1024 * 1024);
  });

  it('saves stream and clears DB safely', async () => {
    await saveStreamToDb({
      activityId: 101,
      updatedAt: Date.now(),
      time: [0, 1, 2],
      watts: [150, 180, 200]
    });

    const stream = await getStreamFromDb(101);
    expect(stream).toBeDefined();
    expect(stream?.watts).toEqual([150, 180, 200]);

    await clearStravaDb();
    const afterClear = await getAllActivitiesFromDb();
    expect(afterClear).toHaveLength(0);
  });
});
