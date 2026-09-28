/**
 * LaBao Offline Map Tile Cache (IndexedDB)
 * Enables seamless offline route exploration and roadbook inspection in remote/mountainous areas.
 * Caches recently viewed map tiles (CartoDB, OpenStreetMap, ArcGIS satellite) in browser IndexedDB.
 */

import type L from 'leaflet';

export interface MapTileRecord {
  key: string;        // Normalized tile key, e.g. "sub.basemaps.cartocdn.com/rastertiles/voyager/12/3345/1782.png"
  dataUrl: string;    // Base64 image data URL (data:image/png;base64,...)
  timestamp: number;  // Access timestamp for LRU eviction
  size: number;       // Approximate size in bytes
}

export const MAP_TILES_DB_NAME = 'labao_map_tiles_db';
export const MAP_TILES_DB_VERSION = 1;
export const MAP_TILES_STORE = 'tiles';
export const MAX_CACHED_TILES = 3000;
export const PRUNE_BATCH_SIZE = 500;

// In-memory fallback for environments without IndexedDB, private browsing quota blocks, or test runners
const inMemoryTileCache = new Map<string, MapTileRecord>();

let dbPromise: Promise<IDBDatabase> | null = null;

export function getTileDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    try {
      const request = window.indexedDB.open(MAP_TILES_DB_NAME, MAP_TILES_DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(MAP_TILES_STORE)) {
          const store = db.createObjectStore(MAP_TILES_STORE, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open map tiles database'));
      };
    } catch (err) {
      reject(err);
    }
  });

  return dbPromise;
}

/**
 * Normalize tile URL to a deterministic storage key
 * Unifies subdomains (e.g. a/b/c/d.basemaps) so that tile cache hits are subdomain-independent.
 */
export function normalizeTileKey(url: string): string {
  return url.replace(/https?:\/\/[a-d]\./i, 'https://sub.');
}

/**
 * Retrieve a cached tile from IndexedDB (or fallback memory cache)
 */
export async function getCachedTile(url: string): Promise<string | null> {
  const key = normalizeTileKey(url);

  // Check in-memory fallback first
  const memHit = inMemoryTileCache.get(key);
  if (memHit) {
    memHit.timestamp = Date.now();
    return memHit.dataUrl;
  }

  try {
    const db = await getTileDb();
    return await new Promise<string | null>((resolve) => {
      const tx = db.transaction([MAP_TILES_STORE], 'readonly');
      const store = tx.objectStore(MAP_TILES_STORE);
      const req = store.get(key);

      req.onsuccess = () => {
        const record = req.result as MapTileRecord | undefined;
        if (record && record.dataUrl) {
          // Touch access timestamp asynchronously in background for LRU
          touchTileTimestamp(key).catch(() => {});
          resolve(record.dataUrl);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Touch tile timestamp for LRU ordering
 */
async function touchTileTimestamp(key: string): Promise<void> {
  try {
    const db = await getTileDb();
    const tx = db.transaction([MAP_TILES_STORE], 'readwrite');
    const store = tx.objectStore(MAP_TILES_STORE);
    const getReq = store.get(key);
    getReq.onsuccess = () => {
      const record = getReq.result as MapTileRecord | undefined;
      if (record) {
        record.timestamp = Date.now();
        store.put(record);
      }
    };
  } catch {
    // Non-critical, ignore
  }
}

/**
 * Store a tile in IndexedDB with LRU capacity pruning
 */
export async function putCachedTile(url: string, dataUrl: string): Promise<void> {
  const key = normalizeTileKey(url);
  const size = dataUrl.length;
  const record: MapTileRecord = {
    key,
    dataUrl,
    timestamp: Date.now(),
    size
  };

  // Keep in memory fallback as well
  inMemoryTileCache.set(key, record);
  if (inMemoryTileCache.size > 200) {
    const firstKey = inMemoryTileCache.keys().next().value;
    if (firstKey) inMemoryTileCache.delete(firstKey);
  }

  try {
    const db = await getTileDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([MAP_TILES_STORE], 'readwrite');
      const store = tx.objectStore(MAP_TILES_STORE);
      const putReq = store.put(record);

      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    });

    // Prune if over capacity (non-blocking)
    pruneOldTilesIfNeeded().catch(() => {});
  } catch {
    // Graceful fallback to memory cache only
  }
}

/**
 * Automatically prune oldest tiles if total count exceeds MAX_CACHED_TILES
 */
export async function pruneOldTilesIfNeeded(): Promise<number> {
  try {
    const db = await getTileDb();
    const count = await new Promise<number>((resolve) => {
      const tx = db.transaction([MAP_TILES_STORE], 'readonly');
      const store = tx.objectStore(MAP_TILES_STORE);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });

    if (count <= MAX_CACHED_TILES) {
      return 0;
    }

    const keysToDelete: string[] = [];
    await new Promise<void>((resolve) => {
      const tx = db.transaction([MAP_TILES_STORE], 'readonly');
      const store = tx.objectStore(MAP_TILES_STORE);
      const index = store.index('timestamp');
      const cursorReq = index.openCursor(); // ascending by timestamp (oldest first)

      cursorReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor && keysToDelete.length < PRUNE_BATCH_SIZE) {
          keysToDelete.push(cursor.value.key);
          cursor.continue();
        } else {
          resolve();
        }
      };
      cursorReq.onerror = () => resolve();
    });

    if (keysToDelete.length > 0) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction([MAP_TILES_STORE], 'readwrite');
        const store = tx.objectStore(MAP_TILES_STORE);
        for (const k of keysToDelete) {
          store.delete(k);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }

    return keysToDelete.length;
  } catch {
    return 0;
  }
}

/**
 * Fetch tile image as blob and convert to Base64 data URL, then cache it
 */
export async function fetchAndCacheTile(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    await putCachedTile(url, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}

/**
 * Convert Blob to base64 DataURL
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to read blob as data URL'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  // Cross-environment (Browser, Web Worker & Node.js test runner)
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const nodeBuffer = (globalThis as unknown as { Buffer?: { from: (b: ArrayBuffer) => { toString: (enc: string) => string } } }).Buffer;
  const base64 = typeof btoa !== 'undefined'
    ? btoa(binary)
    : (nodeBuffer ? nodeBuffer.from(buffer).toString('base64') : '');
  return `data:${blob.type || 'image/png'};base64,${base64}`;
}

/**
 * Get map tile cache statistics (count and approximate size in MB)
 */
export async function getTileCacheStats(): Promise<{ count: number; sizeMb: number }> {
  try {
    const db = await getTileDb();
    return await new Promise((resolve) => {
      const tx = db.transaction([MAP_TILES_STORE], 'readonly');
      const store = tx.objectStore(MAP_TILES_STORE);
      const req = store.getAll();

      req.onsuccess = () => {
        const records = (req.result as MapTileRecord[]) || [];
        const count = records.length;
        const totalBytes = records.reduce((acc, r) => acc + (r.size || 0), 0);
        resolve({
          count,
          sizeMb: parseFloat((totalBytes / (1024 * 1024)).toFixed(2))
        });
      };

      req.onerror = () => {
        resolve({ count: inMemoryTileCache.size, sizeMb: 0 });
      };
    });
  } catch {
    return { count: inMemoryTileCache.size, sizeMb: 0 };
  }
}

/**
 * Clear all cached tiles from IndexedDB and memory
 */
export async function clearTileCache(): Promise<void> {
  inMemoryTileCache.clear();
  try {
    const db = await getTileDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([MAP_TILES_STORE], 'readwrite');
      const store = tx.objectStore(MAP_TILES_STORE);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Ignore error
  }
}

/**
 * Reset DB connection (primarily for testing and mock reset)
 */
export function resetTileDb(): void {
  dbPromise = null;
  inMemoryTileCache.clear();
}

type CachedTileLayerConstructor = new (
  urlTemplate: string,
  options?: L.TileLayerOptions
) => L.TileLayer;

let cachedTileLayerClass: CachedTileLayerConstructor | null = null;

/**
 * Dynamically constructs the CachedTileLayer class using the caller's Leaflet instance.
 * Completely eliminates static module-level `import L from 'leaflet'` execution in Node.js test runners.
 */
export function getCachedTileLayerClass(LInstance: typeof L): CachedTileLayerConstructor {
  if (cachedTileLayerClass) return cachedTileLayerClass;

  class CachedTileLayerImpl extends LInstance.TileLayer {
    createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
      const tile = document.createElement('img');

      LInstance.DomEvent.on(tile, 'load', () => done(undefined, tile));
      LInstance.DomEvent.on(tile, 'error', () => {
        const url = this.getTileUrl(coords);
        getCachedTile(url).then(cached => {
          if (cached && tile.src !== cached) {
            tile.src = cached;
          } else {
            done(new Error(`Failed to load tile: ${url}`), tile);
          }
        }).catch(() => {
          done(new Error(`Failed to load tile: ${url}`), tile);
        });
      });

      if (this.options.crossOrigin || this.options.crossOrigin === '') {
        tile.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
      }

      tile.alt = '';
      tile.setAttribute('role', 'presentation');

      const url = this.getTileUrl(coords);

      getCachedTile(url).then(cached => {
        if (cached) {
          tile.src = cached;
        } else {
          tile.src = url;
          if (typeof navigator === 'undefined' || navigator.onLine !== false) {
            fetchAndCacheTile(url).catch(() => {});
          }
        }
      }).catch(() => {
        tile.src = url;
      });

      return tile;
    }
  }

  cachedTileLayerClass = CachedTileLayerImpl;
  return CachedTileLayerImpl;
}

/**
 * Factory function to create a cached tile layer drop-in compatible with L.tileLayer
 */
export function createCachedTileLayer(
  LInstance: typeof L,
  urlTemplate: string,
  options?: L.TileLayerOptions
): L.TileLayer {
  const Cls = getCachedTileLayerClass(LInstance);
  return new Cls(urlTemplate, options);
}
