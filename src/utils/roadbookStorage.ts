/**
 * Local Roadbook & Custom GPX Persistence Engine (IndexedDB + Storage Fallback)
 * Provides high-capacity client-side persistence for custom roadbooks, waypoints, and starred routes.
 * Avoids localStorage 5MB quota exhaustion when storing high-resolution elevation coordinates.
 */

import { RoadbookItem } from '../data/roadbookDatabase';

const DB_NAME = 'solorider_roadbooks_db';
const DB_VERSION = 1;
const LOCALSTORAGE_ROUTES_KEY = 'yolo_cycling_personal_roadbooks';
const LOCALSTORAGE_BOOKMARKS_KEY = 'yolo_cycling_bookmarked_roadbooks';

let dbInstance: IDBDatabase | null = null;

export const resetRoadbookDbInstance = () => {
  dbInstance = null;
};

const getDb = (): Promise<IDBDatabase> => {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('personal_routes')) {
        db.createObjectStore('personal_routes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
};

/**
 * Save or update a single custom roadbook to IndexedDB (with localStorage sync fallback)
 */
export const savePersonalRouteToDb = async (route: RoadbookItem): Promise<void> => {
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('personal_routes', 'readwrite');
      const store = tx.objectStore('personal_routes');
      store.put(route);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Graceful fallback to localStorage
    try {
      const existingStr = localStorage.getItem(LOCALSTORAGE_ROUTES_KEY);
      const existing: RoadbookItem[] = existingStr ? JSON.parse(existingStr) : [];
      const updated = [route, ...existing.filter(r => r.id !== route.id)];
      localStorage.setItem(LOCALSTORAGE_ROUTES_KEY, JSON.stringify(updated));
    } catch {
      // Storage unavailable or full
    }
  }
};

/**
 * Retrieve all custom roadbooks from IndexedDB with migration from localStorage
 */
export const getAllPersonalRoutesFromDb = async (): Promise<RoadbookItem[]> => {
  try {
    const db = await getDb();
    const routesFromDb = await new Promise<RoadbookItem[]>((resolve, reject) => {
      const tx = db.transaction('personal_routes', 'readonly');
      const store = tx.objectStore('personal_routes');
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result as RoadbookItem[]) || []);
      request.onerror = () => reject(request.error);
    });

    // Check if there are legacy localStorage routes that need migrating
    let legacyRoutes: RoadbookItem[] = [];
    try {
      const raw = localStorage.getItem(LOCALSTORAGE_ROUTES_KEY);
      if (raw) {
        legacyRoutes = JSON.parse(raw);
      }
    } catch {
      legacyRoutes = [];
    }

    if (legacyRoutes.length > 0) {
      const existingIds = new Set(routesFromDb.map(r => r.id));
      for (const leg of legacyRoutes) {
        if (!existingIds.has(leg.id)) {
          await savePersonalRouteToDb(leg);
          routesFromDb.push(leg);
        }
      }
    }

    return routesFromDb;
  } catch {
    // Fallback to localStorage
    try {
      const raw = localStorage.getItem(LOCALSTORAGE_ROUTES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
};

/**
 * Delete a custom roadbook by ID from IndexedDB
 */
export const deletePersonalRouteFromDb = async (id: string): Promise<void> => {
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('personal_routes', 'readwrite');
      const store = tx.objectStore('personal_routes');
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback to localStorage
  }

  // Also clean from localStorage
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_ROUTES_KEY);
    if (raw) {
      const list: RoadbookItem[] = JSON.parse(raw);
      const filtered = list.filter(r => r.id !== id);
      localStorage.setItem(LOCALSTORAGE_ROUTES_KEY, JSON.stringify(filtered));
    }
  } catch {
    // Ignore
  }
};

/**
 * Save bookmarked/starred route IDs
 */
export const saveBookmarkedRouteIdsToDb = async (ids: string[]): Promise<void> => {
  try {
    const db = await getDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('meta', 'readwrite');
      const store = tx.objectStore('meta');
      store.put({ key: 'bookmarked_ids', value: ids });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback
  }

  try {
    localStorage.setItem(LOCALSTORAGE_BOOKMARKS_KEY, JSON.stringify(ids));
  } catch {
    // Ignore
  }
};

/**
 * Get bookmarked/starred route IDs
 */
export const getBookmarkedRouteIdsFromDb = async (): Promise<string[]> => {
  const defaultBookmarks = ['hz-westlake-longjing', 'anji-tianhuangping'];
  try {
    const db = await getDb();
    const result = await new Promise<string[] | null>((resolve, reject) => {
      const tx = db.transaction('meta', 'readonly');
      const store = tx.objectStore('meta');
      const request = store.get('bookmarked_ids');
      request.onsuccess = () => resolve(request.result ? (request.result.value as string[]) : null);
      request.onerror = () => reject(request.error);
    });

    if (result && Array.isArray(result) && result.length > 0) {
      return result;
    }
  } catch {
    // Fallback
  }

  try {
    const raw = localStorage.getItem(LOCALSTORAGE_BOOKMARKS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Ignore
  }

  return defaultBookmarks;
};

/**
 * Export all personal routes as a portable JSON backup string
 */
export const exportPersonalRoutesJson = (routes: RoadbookItem[]): string => {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      type: 'yolo_cycling_roadbooks_backup',
      routes
    },
    null,
    2
  );
};

/**
 * Import routes from a JSON backup string with validation
 */
export const importPersonalRoutesJson = async (
  jsonStr: string
): Promise<{ imported: RoadbookItem[]; count: number }> => {
  const parsed = JSON.parse(jsonStr);
  const candidateRoutes: RoadbookItem[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.routes)
    ? parsed.routes
    : [];

  const validRoutes: RoadbookItem[] = [];
  for (const r of candidateRoutes) {
    if (r && r.id && r.name && Array.isArray(r.waypoints) && r.waypoints.length > 0) {
      await savePersonalRouteToDb(r);
      validRoutes.push(r);
    }
  }

  return {
    imported: validRoutes,
    count: validRoutes.length
  };
};
