import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  StravaApiKeys,
  StravaTokenData,
  StravaAthlete,
  StravaSyncSettings,
  getStoredApiKeys,
  saveStoredApiKeys,
  getStoredTokenData,
  saveStoredTokenData,
  clearStoredTokenData,
  getStoredSettings,
  saveStoredSettings,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  restoreStravaSession,
  getValidAccessToken,
  fetchAthleteProfile,
  fetchAthleteActivities,
  fetchActivityStreams,
  fetchAthleteRoutes,
  calculateActivityTss,
  StravaSegmentItem,
  CURATED_STRAVA_SEGMENTS,
  fetchStarredSegments,
  fetchSegmentDetails,
  extractBestMmpFromActivities,
  setDynamicPlatformClientId
} from '../services/stravaService';
import {
  StravaActivityRecord,
  StravaStreamsRecord,
  StravaRouteRecord,
  saveActivitiesToDb,
  getAllActivitiesFromDb,
  getStreamFromDb,
  saveStreamToDb,
  getAllRoutesFromDb,
  setMetaToDb,
  getMetaFromDb,
  clearStravaDb
} from '../utils/indexedDb';
import { generateSimulatedStravaStream } from '../utils/stravaStreamAdapter';
import { generateDemoStravaActivities } from '../utils/stravaCockpitAnalytics';
import { useRiderProfile } from './RiderProfileContext';
import { migrateBikeProfile } from '../types/garage';
import { useToast } from './ToastContext';

export interface StravaSyncProgress {
  current: number;
  total: number;
  stage: 'profile' | 'activities' | 'saving' | 'done';
  message: string;
}

interface StravaContextType {
  apiKeys: StravaApiKeys | null;
  tokenData: StravaTokenData | null;
  athlete: StravaAthlete | null;
  isConnected: boolean;
  isSyncing: boolean;
  syncProgress: StravaSyncProgress | null;
  lastSyncTime: number | null;
  activities: StravaActivityRecord[];
  syncSettings: StravaSyncSettings;
  saveApiKeys: (keys: StravaApiKeys) => void;
  initiateAuth: () => void;
  disconnect: () => Promise<void>;
  syncActivities: (forceFullRefresh?: boolean) => Promise<{ count: number }>;
  getActivityStreams: (activityId: number) => Promise<StravaStreamsRecord | null>;
  getRoutes: () => Promise<StravaRouteRecord[]>;
  getStarredSegments: () => Promise<StravaSegmentItem[]>;
  getSegmentDetails: (segmentId: number) => Promise<any>;
  extractBestPowerPeaks: () => Promise<{
    p5s: number;
    p1m: number;
    p5m: number;
    p20m: number;
    bestActivityName?: string;
    sampleCount: number;
  } | null>;
  clearCache: () => Promise<void>;
  reloadActivities: () => Promise<void>;
  updateSettings: (settings: Partial<StravaSyncSettings>) => void;
}

const StravaContext = createContext<StravaContextType | undefined>(undefined);

export const StravaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, updateProfile, bikes, addBike, updateBike } = useRiderProfile();
  const { showToast } = useToast();

  const [apiKeys, setApiKeys] = useState<StravaApiKeys | null>(() => getStoredApiKeys());
  const [tokenData, setTokenData] = useState<StravaTokenData | null>(() => getStoredTokenData());
  const [syncSettings, setSyncSettings] = useState<StravaSyncSettings>(() => getStoredSettings());
  const [activities, setActivities] = useState<StravaActivityRecord[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<StravaSyncProgress | null>(null);

  const isConnected = Boolean(tokenData && tokenData.accessToken);
  const athlete = tokenData?.athlete || null;

  // Load cached activities and meta from IndexedDB on startup
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const cached = await getAllActivitiesFromDb();
        const syncMeta = await getMetaFromDb<number>('last_sync_timestamp');
        if (isMounted) {
          setActivities(cached);
          if (syncMeta) setLastSyncTime(syncMeta);
        }
      } catch {
        // IndexedDB cache unavailable on initial mount
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    restoreStravaSession().then(session => {
      if (session) setTokenData(session);
    }).catch(() => undefined);

    if (!apiKeys?.clientId) {
      fetch('/api/strava/config')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.clientId) {
            setDynamicPlatformClientId(data.clientId);
            setApiKeys({ clientId: data.clientId });
          }
        })
        .catch(() => undefined);
    }
  }, [apiKeys]);

  // Save API keys
  const saveApiKeys = useCallback((keys: StravaApiKeys) => {
    saveStoredApiKeys(keys);
    setApiKeys(keys);
  }, []);

  // Update Settings
  const updateSettings = useCallback((newSettings: Partial<StravaSyncSettings>) => {
    setSyncSettings(prev => {
      const next = { ...prev, ...newSettings };
      saveStoredSettings(next);
      return next;
    });
  }, []);

  // Initiate OAuth Authorization
  const initiateAuth = useCallback(() => {
    if (!apiKeys?.clientId) {
      showToast('Strava 服务尚未配置，请联系管理员', 'warning');
      return;
    }
    const url = buildAuthorizeUrl(apiKeys.clientId);
    window.location.href = url;
  }, [apiKeys, showToast]);

  // Disconnect & Clear
  const disconnect = useCallback(async () => {
    await fetch('/api/strava/logout', { method: 'POST', credentials: 'include' });
    clearStoredTokenData();
    setTokenData(null);
    setActivities([]);
    setLastSyncTime(null);
    try {
      await clearStravaDb();
    } catch {
      // Ignore IndexedDB deletion failure
    }
    showToast('已断开与 Strava 的连接并清理本地缓存', 'info');
  }, [showToast]);

  // Clear offline cached activities and streams without disconnecting
  const clearCache = useCallback(async () => {
    try {
      await clearStravaDb();
      setActivities([]);
      setLastSyncTime(null);
      showToast('已清空 Strava 本地离线活动及流数据缓存', 'success');
    } catch {
      showToast('清理本地离线缓存失败', 'error');
    }
  }, [showToast]);

  // Re-read all activities from IndexedDB without invoking Strava cloud API
  const reloadActivities = useCallback(async () => {
    try {
      const cached = await getAllActivitiesFromDb();
      setActivities(cached);
    } catch {
      // IndexedDB query failed silently
    }
  }, []);

  // Sync Activities
  const syncActivities = useCallback(async (forceFullRefresh: boolean = false): Promise<{ count: number }> => {
    const token = await getValidAccessToken();
    if (!token) {
      showToast('Strava 授权无效或已过期，请重新连接', 'error');
      return { count: 0 };
    }

    setIsSyncing(true);
    setSyncProgress({ current: 10, total: 100, stage: 'profile', message: '正在同步车手最新档案与战车装备...' });
    try {
      // Refresh athlete profile
      const latestAthlete = await fetchAthleteProfile(token);
      setTokenData(prev => {
        if (!prev) return null;
        const updated = { ...prev, athlete: latestAthlete };
        saveStoredTokenData(updated);
        return updated;
      });

      // Auto sync bikes to Garage
      if (syncSettings.autoSyncBikes && latestAthlete.bikes && latestAthlete.bikes.length > 0) {
        for (const stravaBike of latestAthlete.bikes) {
          const mileageKm = Math.round(stravaBike.distance / 1000);
          const existingBike = bikes.find(
            b => (b.stravaGearId && b.stravaGearId === stravaBike.id) ||
                 b.name.toLowerCase() === stravaBike.name.toLowerCase()
          );
          if (existingBike) {
            // Update mileage and attach stravaGearId
            updateBike(existingBike.id, {
              mileageKm,
              stravaGearId: stravaBike.id
            });
          } else {
            // Add as new bike with enriched specs
            addBike(migrateBikeProfile({
              id: `strava-bike-${stravaBike.id}`,
              name: stravaBike.name,
              type: 'road_aero',
              weightKg: 8.0,
              cda: 0.32,
              crr: 0.0035,
              mileageKm,
              stravaGearId: stravaBike.id
            }));
          }
        }
      }

      // Calculate 'after' timestamp
      let afterSec: number | undefined = undefined;
      const nowSec = Math.floor(Date.now() / 1000);

      if (!forceFullRefresh && lastSyncTime && lastSyncTime > 0) {
        afterSec = lastSyncTime;
      } else {
        // Sync past N days (or all time if >= 3650)
        const daysBack = syncSettings.syncDays || 365;
        afterSec = daysBack >= 3650 ? undefined : nowSec - daysBack * 86400;
      }

      setSyncProgress({
        current: 30,
        total: 100,
        stage: 'activities',
        message: forceFullRefresh ? '正在全量拉取 Strava 活动记录...' : '正在增量拉取 Strava 活动记录...'
      });

      // Fetch pages
      const rawActivities: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore && page <= 10) { // safety ceiling: max 500 activities per sync
        setSyncProgress({
          current: Math.min(80, 25 + page * 5),
          total: 100,
          stage: 'activities',
          message: `正在拉取第 ${page} 页 Strava 骑行活动...`
        });
        const pageData = await fetchAthleteActivities(token, afterSec, page, 50);
        if (pageData && pageData.length > 0) {
          rawActivities.push(...pageData);
          if (pageData.length < 50) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      setSyncProgress({
        current: 85,
        total: 100,
        stage: 'saving',
        message: `正在核算 ${rawActivities.length} 条活动 TSS 并存入本地缓存...`
      });

      // Process and calculate TSS for each activity
      const processed: StravaActivityRecord[] = rawActivities.map(act => {
        const { tss, intensityFactor } = calculateActivityTss(act, profile.ftpWatts);
        return {
          id: act.id,
          name: act.name,
          distance: act.distance,
          moving_time: act.moving_time,
          elapsed_time: act.elapsed_time,
          total_elevation_gain: act.total_elevation_gain,
          type: act.type,
          sport_type: act.sport_type,
          start_date: act.start_date,
          start_date_local: act.start_date_local,
          start_latlng: act.start_latlng,
          end_latlng: act.end_latlng,
          average_speed: act.average_speed,
          max_speed: act.max_speed,
          average_watts: act.average_watts,
          weighted_average_watts: act.weighted_average_watts,
          kilojoules: act.kilojoules,
          device_watts: act.device_watts,
          has_heartrate: act.has_heartrate,
          average_heartrate: act.average_heartrate,
          max_heartrate: act.max_heartrate,
          suffer_score: act.suffer_score,
          gear_id: act.gear_id,
          summary_polyline: act.map?.summary_polyline,
          tss,
          intensityFactor
        };
      });

      if (processed.length > 0) {
        await saveActivitiesToDb(processed);
      }

      await setMetaToDb('last_sync_timestamp', nowSec);
      setLastSyncTime(nowSec);

      // Re-read all from DB to ensure complete sorted state
      const updatedList = await getAllActivitiesFromDb();
      setActivities(updatedList);

      setSyncProgress({
        current: 100,
        total: 100,
        stage: 'done',
        message: `同步完成！更新 ${processed.length} 条活动`
      });
      setTimeout(() => {
        setSyncProgress(null);
      }, 1500);

      showToast(`Strava 骑行数据同步成功！共更新 ${processed.length} 条活动`, 'success');
      return { count: processed.length };
    } catch (err: any) {
      setSyncProgress(null);
      showToast(`Strava 同步失败: ${err.message || '网络异常'}`, 'error');
      return { count: 0 };
    } finally {
      setIsSyncing(false);
    }
  }, [profile.ftpWatts, profile.weightKg, syncSettings, lastSyncTime, bikes, updateProfile, addBike, updateBike, showToast]);

  // Get Activity Streams (cached, fetched, or simulation fallback)
  const getActivityStreams = useCallback(async (activityId: number): Promise<StravaStreamsRecord | null> => {
    try {
      // 1. Check local IndexedDB cache
      const cached = await getStreamFromDb(activityId);
      if (cached && cached.time && cached.time.length > 0) {
        return cached;
      }

      // 2. Fetch from API if token valid
      const token = await getValidAccessToken();
      if (token) {
        const streams = await fetchActivityStreams(token, activityId);
        if (streams && streams.time && streams.time.length > 0) {
          return streams;
        }
      }

      // 3. Simulation & Demo Fallback: synthesize high-fidelity telemetry stream
      const allActs = activities.length > 0 ? activities : generateDemoStravaActivities();
      const targetAct = allActs.find(a => a.id === activityId);
      if (targetAct) {
        const simStream = generateSimulatedStravaStream(targetAct);
        await saveStreamToDb(simStream).catch(() => {});
        return simStream;
      }

      return null;
    } catch {
      return null;
    }
  }, [activities]);

  // Get Routes (cached or fetched)
  const getRoutes = useCallback(async (): Promise<StravaRouteRecord[]> => {
    try {
      const token = await getValidAccessToken();
      if (token) {
        const freshRoutes = await fetchAthleteRoutes(token);
        return freshRoutes;
      }
      return await getAllRoutesFromDb();
    } catch {
      return await getAllRoutesFromDb();
    }
  }, []);

  // Get Starred Segments with fallback to Curated Segments
  const getStarredSegments = useCallback(async (): Promise<StravaSegmentItem[]> => {
    try {
      const token = await getValidAccessToken();
      if (token) {
        const liveStarred = await fetchStarredSegments(token);
        if (liveStarred && liveStarred.length > 0) {
          // Merge with curated to give rich choice
          const merged = [...liveStarred];
          for (const c of CURATED_STRAVA_SEGMENTS) {
            if (!merged.some(s => s.id === c.id)) {
              merged.push(c);
            }
          }
          return merged;
        }
      }
      return CURATED_STRAVA_SEGMENTS;
    } catch {
      return CURATED_STRAVA_SEGMENTS;
    }
  }, []);

  // Get Segment Details
  const getSegmentDetails = useCallback(async (segmentId: number): Promise<any> => {
    try {
      const curated = CURATED_STRAVA_SEGMENTS.find(s => s.id === segmentId);
      const token = await getValidAccessToken();
      if (token) {
        const details = await fetchSegmentDetails(token, segmentId);
        return { ...curated, ...details };
      }
      return curated || null;
    } catch {
      return CURATED_STRAVA_SEGMENTS.find(s => s.id === segmentId) || null;
    }
  }, []);

  // Extract Best MMP (5s, 1m, 5m, 20m) from activities and streams
  const extractBestPowerPeaks = useCallback(async () => {
    try {
      let activityList = activities;
      if (activityList.length === 0) {
        activityList = await getAllActivitiesFromDb();
      }

      if (activityList.length === 0) {
        const token = await getValidAccessToken();
        if (token) {
          showToast('正在从 Strava 获取近期骑行活动...', 'info');
          const syncRes = await syncActivities(false);
          if (syncRes.count > 0) {
            activityList = await getAllActivitiesFromDb();
          }
        }
      }

      if (activityList.length === 0) {
        showToast('未在本地找到 Strava 骑行活动，请先连接并同步 Strava 活动', 'warning');
        return null;
      }

      showToast('正在计算分析近期活动 MMP 功率曲线...', 'info');
      const result = await extractBestMmpFromActivities(activityList, getActivityStreams, 8);
      return result;
    } catch (err: any) {
      showToast(`提取 Strava 峰值功率失败: ${err.message}`, 'error');
      return null;
    }
  }, [activities, getActivityStreams, syncActivities, showToast]);

  // Capture OAuth Code from URL on page load
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      showToast(`Strava 授权被取消或失败: ${error}`, 'warning');
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      return;
    }

    if (code && state === 'solorider_strava_auth') {
      (async () => {
        try {
          showToast('正在完成 Strava 授权握手...', 'info');
          const tokenRes = await exchangeCodeForToken(code);
          setTokenData(tokenRes);

          // Clean URL
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);

          showToast(`Strava 账号连接成功！欢迎，${tokenRes.athlete.firstname}`, 'success');

          // Trigger initial sync in background
          setTimeout(() => {
            syncActivities(true);
          }, 600);
        } catch (err: any) {
          showToast(`Strava 授权失败: ${err.message}`, 'error');
        }
      })();
    }
  }, [showToast, syncActivities]);

  const value = useMemo(
    () => ({
      apiKeys,
      tokenData,
      athlete,
      isConnected,
      isSyncing,
      syncProgress,
      lastSyncTime,
      activities,
      syncSettings,
      saveApiKeys,
      initiateAuth,
      disconnect,
      syncActivities,
      getActivityStreams,
      getRoutes,
      getStarredSegments,
      getSegmentDetails,
      extractBestPowerPeaks,
      clearCache,
      reloadActivities,
      updateSettings
    }),
    [
      apiKeys,
      tokenData,
      athlete,
      isConnected,
      isSyncing,
      syncProgress,
      lastSyncTime,
      activities,
      syncSettings,
      saveApiKeys,
      initiateAuth,
      disconnect,
      syncActivities,
      getActivityStreams,
      getRoutes,
      getStarredSegments,
      getSegmentDetails,
      extractBestPowerPeaks,
      clearCache,
      reloadActivities,
      updateSettings
    ]
  );

  return <StravaContext.Provider value={value}>{children}</StravaContext.Provider>;
};

export const useStrava = (): StravaContextType => {
  const context = useContext(StravaContext);
  if (!context) {
    throw new Error('useStrava must be used within a StravaProvider');
  }
  return context;
};
