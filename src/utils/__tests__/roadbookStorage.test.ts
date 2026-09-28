import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  savePersonalRouteToDb,
  getAllPersonalRoutesFromDb,
  deletePersonalRouteFromDb,
  saveBookmarkedRouteIdsToDb,
  getBookmarkedRouteIdsFromDb,
  exportPersonalRoutesJson,
  importPersonalRoutesJson,
  resetRoadbookDbInstance
} from '../roadbookStorage';
import { RoadbookItem } from '../../data/roadbookDatabase';

function createMockIndexedDB() {
  const storeData: Record<string, Map<any, any>> = {
    personal_routes: new Map(),
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
              const key = val.id !== undefined ? val.id : val.key;
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
            delete: (key: any) => {
              map.delete(key);
            }
          };
        }
      };

      queueMicrotask(() => {
        if (tx.oncomplete) tx.oncomplete();
      });

      return tx;
    }
  };

  const mockIDBFactory = {
    open: (_name: string, _version: number) => {
      const req: any = {
        result: mockDb,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null
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

  return { mockIDBFactory, storeData };
}

describe('Roadbook IndexedDB Storage & Backup Engine', () => {
  let originalIndexedDB: any;

  beforeEach(() => {
    resetRoadbookDbInstance();
    originalIndexedDB = (globalThis as any).indexedDB;
    const { mockIDBFactory } = createMockIndexedDB();
    (globalThis as any).indexedDB = mockIDBFactory;
    (globalThis as any).window = { indexedDB: mockIDBFactory };
  });

  afterEach(() => {
    resetRoadbookDbInstance();
    (globalThis as any).indexedDB = originalIndexedDB;
  });

  const mockRoute: RoadbookItem = {
    id: 'test-route-1',
    name: '测试自定义龙井盘山线',
    sourceCode: '自定义 GPX',
    region: '杭州·西湖',
    province: '浙江',
    category: 'climb',
    categoryLabel: '硬核爬坡',
    difficulty: '进阶爬坡',
    distanceKm: 18.5,
    elevationGainM: 350,
    maxAltitudeM: 210,
    avgGradePct: 4.5,
    sceneryRating: 5,
    roadCondition: '沥青路面',
    bestSeason: '春秋',
    description: '测试路线描述',
    highlights: ['龙井', '满觉陇'],
    tips: ['注意弯道减速'],
    waypoints: [
      { lat: 30.24, lng: 120.12, elevation: 20, name: '起点' },
      { lat: 30.25, lng: 120.13, elevation: 180, name: '顶峰' }
    ]
  };

  it('saves and retrieves personal routes from IndexedDB', async () => {
    await savePersonalRouteToDb(mockRoute);
    const routes = await getAllPersonalRoutesFromDb();
    expect(routes).toHaveLength(1);
    expect(routes[0].name).toBe('测试自定义龙井盘山线');
    expect(routes[0].waypoints).toHaveLength(2);
  });

  it('deletes personal route from IndexedDB', async () => {
    await savePersonalRouteToDb(mockRoute);
    await deletePersonalRouteFromDb('test-route-1');
    const routes = await getAllPersonalRoutesFromDb();
    expect(routes).toHaveLength(0);
  });

  it('saves and retrieves bookmarked route ids', async () => {
    const bookmarks = ['test-route-1', 'hz-westlake-longjing'];
    await saveBookmarkedRouteIdsToDb(bookmarks);
    const retrieved = await getBookmarkedRouteIdsFromDb();
    expect(retrieved).toEqual(bookmarks);
  });

  it('exports and imports routes to/from JSON successfully', async () => {
    const jsonStr = exportPersonalRoutesJson([mockRoute]);
    expect(jsonStr).toContain('yolo_cycling_roadbooks_backup');
    expect(jsonStr).toContain('测试自定义龙井盘山线');

    const importRes = await importPersonalRoutesJson(jsonStr);
    expect(importRes.count).toBe(1);
    expect(importRes.imported[0].id).toBe('test-route-1');
  });
});
