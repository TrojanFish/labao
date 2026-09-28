import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeTileKey,
  getCachedTile,
  putCachedTile,
  clearTileCache,
  getTileCacheStats,
  resetTileDb,
  blobToDataUrl,
  createCachedTileLayer,
  getCachedTileLayerClass
} from '../mapTileCache';

describe('MapTileCache (IndexedDB Offline Map Cache)', () => {
  beforeEach(async () => {
    resetTileDb();
    await clearTileCache();
  });

  describe('normalizeTileKey', () => {
    it('normalizes various subdomains to a uniform cache key', () => {
      const urlA = 'https://a.basemaps.cartocdn.com/rastertiles/voyager/12/3345/1782.png';
      const urlB = 'https://b.basemaps.cartocdn.com/rastertiles/voyager/12/3345/1782.png';
      const urlC = 'https://c.basemaps.cartocdn.com/rastertiles/voyager/12/3345/1782.png';
      const expected = 'https://sub.basemaps.cartocdn.com/rastertiles/voyager/12/3345/1782.png';

      expect(normalizeTileKey(urlA)).toBe(expected);
      expect(normalizeTileKey(urlB)).toBe(expected);
      expect(normalizeTileKey(urlC)).toBe(expected);
    });

    it('leaves standard non-subdomain URLs intact', () => {
      const url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/3345/1782';
      expect(normalizeTileKey(url)).toBe(url);
    });
  });

  describe('putCachedTile and getCachedTile', () => {
    it('stores and retrieves a tile payload correctly via memory/IndexedDB fallback', async () => {
      const url = 'https://a.basemaps.cartocdn.com/rastertiles/voyager/12/100/200.png';
      const mockDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      await putCachedTile(url, mockDataUrl);

      // Fetch with same URL
      const retrieved = await getCachedTile(url);
      expect(retrieved).toBe(mockDataUrl);

      // Fetch with alternative subdomain 'b.' (should still hit cache due to normalization)
      const altSubdomainUrl = 'https://b.basemaps.cartocdn.com/rastertiles/voyager/12/100/200.png';
      const retrievedAlt = await getCachedTile(altSubdomainUrl);
      expect(retrievedAlt).toBe(mockDataUrl);
    });

    it('returns null for uncached tiles', async () => {
      const retrieved = await getCachedTile('https://unknown.tile.server/10/20/30.png');
      expect(retrieved).toBeNull();
    });

    it('updates cache stats when tiles are added and cleared', async () => {
      const mockDataUrl = 'data:image/png;base64,dummy12345';
      await putCachedTile('https://tile.org/1/1/1.png', mockDataUrl);
      await putCachedTile('https://tile.org/1/1/2.png', mockDataUrl);

      const stats = await getTileCacheStats();
      expect(stats.count).toBe(2);
      expect(stats.sizeMb).toBeGreaterThanOrEqual(0);

      await clearTileCache();
      const clearedStats = await getTileCacheStats();
      expect(clearedStats.count).toBe(0);
    });
  });

  describe('blobToDataUrl', () => {
    it('converts a Blob into a base64 Data URL', async () => {
      const blob = new Blob(['mock-image-bytes'], { type: 'image/png' });
      const dataUrl = await blobToDataUrl(blob);
      expect(dataUrl).toContain('data:image/png;base64,');
    });
  });

  describe('createCachedTileLayer & getCachedTileLayerClass', () => {
    it('dynamically constructs CachedTileLayer class with injected Leaflet instance', () => {
      class MockTileLayer {
        urlTemplate: string;
        options: Record<string, unknown>;
        constructor(url: string, options?: Record<string, unknown>) {
          this.urlTemplate = url;
          this.options = options || {};
        }
        getTileUrl() { return this.urlTemplate; }
      }

      const mockL = {
        TileLayer: MockTileLayer,
        DomEvent: {
          on: () => {}
        }
      };

      const Cls = getCachedTileLayerClass(mockL as unknown as typeof import('leaflet'));
      expect(typeof Cls).toBe('function');

      const layerInstance = createCachedTileLayer(
        mockL as unknown as typeof import('leaflet'),
        'https://{s}.tile.osm.org/{z}/{x}/{y}.png',
        { maxZoom: 18 }
      );
      expect(layerInstance).toBeDefined();
    });
  });
});
