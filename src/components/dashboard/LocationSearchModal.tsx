/**
 * LocationSearchModal — Apple HIG Dual-Platform Location Search
 *
 * Provides a location search experience for the Pre-Ride Cockpit:
 *   - Mounted via ReactDOM.createPortal at body level with z-[100] so it's NEVER
 *     covered by the bottom navigation bar or floating buttons
 *   - Body scroll locked when opened
 *   - Proper touch scrolling with flex min-h-0 and overscroll containment
 *   - Smart Chinese query-to-result mapping (converts Pinyin like "Qiandaohu" to Chinese "千岛湖")
 *   - Quick "📍 Use Current GPS" action
 *   - Curated list of popular Chinese & Taiwan cycling destinations
 *   - Desktop: centered modal with backdrop blur
 *   - Mobile: iOS 18 bottom sheet with grabber handle (rounded-t-[28px])
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  X,
  MapPin,
  Navigation,
  Loader2,
  Compass,
  Check,
} from 'lucide-react';
import { PRE_RIDE_LOCATIONS, PreRideLocation } from '../../data/preRideLocations';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';

interface GeocodingResultItem {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string; // Province / State
  admin2?: string; // Prefecture / City
}

interface LocationSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: PreRideLocation;
  onSelectLocation: (loc: PreRideLocation) => void;
  onRequestGps: () => void;
  isGpsLocating?: boolean;
}

export const LocationSearchModal: React.FC<LocationSearchModalProps> = ({
  isOpen,
  onClose,
  currentLocation,
  onSelectLocation,
  onRequestGps,
  isGpsLocating = false,
}) => {
  const { language } = useLanguageAndUnit();
  const isTw = language === 'zh-TW';

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Body scroll locking
  useEffect(() => {
    if (isOpen && typeof document !== 'undefined') {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSearchResults([]);
      setSearchError(null);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Debounced live search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=10&language=zh&format=json`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setSearchResults((data.results as GeocodingResultItem[]) || []);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setSearchError(isTw ? '搜尋超時或無網絡' : '搜索超时或网络异常');
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, isTw]);

  if (!isOpen) return null;

  const handleSelectSearchResult = (item: GeocodingResultItem) => {
    let displayName = item.name;

    // If user searched in Chinese and Open-Meteo returned ASCII Pinyin (e.g. user searched "千岛湖" and item.name is "Qiandaohu")
    const trimmedQuery = query.trim();
    if (/[\u4e00-\u9fa5]/.test(trimmedQuery) && !/[\u4e00-\u9fa5]/.test(item.name)) {
      if (trimmedQuery.length <= 6) {
        displayName = trimmedQuery;
      }
    }

    const loc: PreRideLocation = {
      id: `geo-${item.id}`,
      name: displayName,
      desc: [item.admin2, item.admin1, item.country].filter(Boolean).join(' · '),
      lat: item.latitude,
      lng: item.longitude,
      isGps: false,
    };

    onSelectLocation(loc);
    onClose();
  };

  const handleSelectPreset = (preset: PreRideLocation) => {
    onSelectLocation(preset);
    onClose();
  };

  const handleUseGps = () => {
    onRequestGps();
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm transition-opacity no-print">
      {/* Click outside backdrop */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal / Sheet Container: with fixed height bounds and flex column layout */}
      <div className="relative z-10 w-full sm:max-w-md bg-white dark:bg-[#1C1C1E] rounded-t-[28px] sm:rounded-2xl shadow-ios-popover border border-black/10 dark:border-white/10 flex flex-col h-[75vh] sm:h-auto sm:max-h-[600px] animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200 overflow-hidden pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-0">
        
        {/* Mobile Grabber Capsule */}
        <div className="w-full flex justify-center pt-2.5 pb-1 sm:hidden shrink-0">
          <div className="w-9 h-1 bg-black/20 dark:bg-white/20 rounded-full" />
        </div>

        {/* Modal Header & Search Bar (Sticky top) */}
        <div className="p-4 border-b border-black/[0.06] dark:border-white/[0.08] space-y-2.5 shrink-0 bg-white dark:bg-[#1C1C1E]">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-display flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-ios-mint" />
              <span>{isTw ? '搜尋氣象位置' : '搜索气象位置'}</span>
            </h3>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 flex items-center justify-center text-slate-500 dark:text-slate-400 transition apple-touch"
              aria-label={isTw ? '關閉' : '关闭'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isTw ? '輸入城市、區縣或騎行勝地 (如: 千島湖、崇明、大理)...' : '输入城市、区县或骑行胜地 (如: 千岛湖、崇明、大理)...'}
              className="w-full h-10 pl-9 pr-8 rounded-xl bg-slate-100 dark:bg-white/10 border-none text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-ios-mint"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Modal Body: Scrollable Results / Presets (min-h-0 guarantees flex scrollability on mobile) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 overscroll-contain touch-pan-y pb-24 sm:pb-4">
          
          {/* 1. Quick Action: Current GPS Location */}
          <div>
            <button
              onClick={handleUseGps}
              className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition apple-touch ${
                currentLocation.isGps
                  ? 'bg-ios-mint/10 border-ios-mint/30 text-ios-mint'
                  : 'bg-black/[0.02] dark:bg-white/[0.04] border-black/[0.06] dark:border-white/[0.08] hover:bg-ios-mint/5 text-slate-800 dark:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-ios-mint/15 text-ios-mint flex items-center justify-center shrink-0">
                  <Navigation className={`w-4 h-4 ${isGpsLocating ? 'animate-spin' : ''}`} />
                </div>
                <div className="text-left min-w-0">
                  <div className="text-xs font-semibold flex items-center gap-1.5">
                    <span>{isTw ? '使用目前 GPS 定位' : '使用当前 GPS 精准定位'}</span>
                    {currentLocation.isGps && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-ios-mint text-slate-950 font-bold">
                        当前
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                    {isTw ? '依據手機 / 瀏覽器原生坐標讀取當地微氣候' : '依据手机 / 浏览器原生坐标读取当地微气候'}
                  </div>
                </div>
              </div>
              {currentLocation.isGps && <Check className="w-4 h-4 text-ios-mint shrink-0" />}
            </button>
          </div>

          {/* 2. Live Search Results */}
          {isSearching && (
            <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-ios-mint" />
              <span className="text-xs">{isTw ? '正在搜尋全域地理庫...' : '正在检索全球地理库...'}</span>
            </div>
          )}

          {!isSearching && query.trim() && searchResults.length === 0 && (
            <div className="py-8 text-center text-slate-400 space-y-1">
              <p className="text-xs font-medium">{isTw ? '未找到符合的地點' : '未找到匹配的地点'}</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {isTw ? '請嘗試輸入更通用的城市名或縣區名' : '请尝试输入更通用的市县名称'}
              </p>
            </div>
          )}

          {!isSearching && searchResults.length > 0 && (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 px-1 mb-1">
                {isTw ? '搜尋結果' : '搜索结果'} ({searchResults.length})
              </div>
              <div className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                {searchResults.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectSearchResult(item)}
                    className="w-full p-2.5 text-left rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition flex items-center justify-between gap-2 apple-touch"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-ios-mint shrink-0" />
                        <span className="truncate">{item.name}</span>
                        {item.admin2 && item.admin2 !== item.name && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                            ({item.admin2})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 pl-5 truncate">
                        {[item.admin1, item.country].filter(Boolean).join(' · ')}
                        <span className="ml-2 font-mono text-[10px] text-slate-400">
                          {item.latitude.toFixed(2)}°N, {item.longitude.toFixed(2)}°E
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. Preset Popular Cycling Destinations (when no query) */}
          {!query.trim() && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 px-1 flex items-center justify-between">
                <span>{isTw ? '熱門騎行勝地' : '热门骑行胜地 / 经典路线'}</span>
                <span className="text-[10px] font-normal">{PRE_RIDE_LOCATIONS.length} {isTw ? '個地點' : '个地点'}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {PRE_RIDE_LOCATIONS.map((preset) => {
                  const isSelected = !currentLocation.isGps && currentLocation.id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      className={`p-2.5 rounded-xl border text-left transition apple-touch flex items-center justify-between ${
                        isSelected
                          ? 'bg-ios-mint/10 border-ios-mint/30 text-ios-mint'
                          : 'bg-black/[0.02] dark:bg-white/[0.04] border-black/[0.05] dark:border-white/[0.06] hover:bg-black/[0.04] text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <div className="min-w-0 pr-1">
                        <div className="text-xs font-bold truncate">
                          {isTw && preset.nameTw ? preset.nameTw : preset.name}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                          {preset.desc}
                        </div>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-ios-mint shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {searchError && (
            <div className="p-2.5 text-xs text-ios-red bg-ios-red/10 rounded-xl text-center">
              {searchError}
            </div>
          )}

        </div>

        {/* Footer Hint */}
        <div className="p-3 bg-black/[0.02] dark:bg-white/[0.02] border-t border-black/[0.05] dark:border-white/[0.06] text-center shrink-0">
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {isTw ? '支援搜尋全球任意城市、鄉鎮或山峰經緯度' : '支持搜索全国及全球任意市、县、区及骑行地标'}
          </p>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
