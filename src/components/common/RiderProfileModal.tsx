import React, { useState } from 'react';
import { useRiderProfile, TeamRider, BikeProfile } from '../../context/RiderProfileContext';
import { useStrava } from '../../context/StravaContext';
import { useToast } from '../../context/ToastContext';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';
import { useSwipeToDismiss } from '../../hooks/useSwipeToDismiss';
import {
  User,
  X,
  RotateCcw,
  Activity,
  ShieldCheck,
  Gauge,
  Globe,
  Sun,
  Moon,
  Smartphone,
  SlidersHorizontal,
  Home,
  Lock,
  Bike,
  Users,
  Plus,
  Trash2,
  CheckCircle2,
  Zap,
  Sparkles,
  MapPin,
  Flame,
  Award,
  Cloud,
  RefreshCw,
  ExternalLink,
  Key,
  Eye,
  EyeOff,
  Check,
  Database,
  LogOut,
  Wrench,
  ChevronDown,
  ChevronUp,
  Download
} from 'lucide-react';
import { PoweredByStravaBadge } from './PoweredByStravaBadge';
import { NumberStepper } from './NumberStepper';
import { IOSSegmentedControl } from './IOSSegmentedControl';
import { getStravaStorageInfo, getAllActivitiesFromDb, StravaStorageInfo } from '../../utils/indexedDb';
import { exportActivitiesToJson } from '../../utils/stravaCockpitAnalytics';
import {
  ALL_NAV_TOOLS,
  NAV_PRESETS,
  getNavToolById
} from '../../utils/toolNavHelper';
import { DEFAULT_ENRICHED_BIKE_GARAGE } from '../../types/garage';

interface RiderProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeMode?: 'system' | 'dark' | 'light';
  setThemeMode?: (mode: 'system' | 'dark' | 'light') => void;
  initialTab?: 'profile' | 'roster' | 'garage' | 'strava' | 'system';
}

export const RiderProfileModal: React.FC<RiderProfileModalProps> = ({
  isOpen,
  onClose,
  themeMode,
  setThemeMode,
  initialTab
}) => {
  const {
    profile,
    updateProfile,
    resetProfile,
    roster,
    activeRiderId,
    activeRider,
    switchRider,
    addRider,
    deleteRider,
    updateRider,
    bikes,
    activeBikeId,
    activeBike,
    switchBike,
    addBike,
    deleteBike,
    updateBike,
    navShortcuts,
    setNavShortcut,
    setAllNavShortcuts,
    resetNavShortcuts
  } = useRiderProfile();

  const { unitSystem, setUnitSystem, language, setLanguage } = useLanguageAndUnit();
  const { showToast } = useToast();

  const {
    apiKeys,
    tokenData,
    athlete,
    isConnected: isStravaConnected,
    isSyncing: isStravaSyncing,
    syncProgress: stravaSyncProgress,
    lastSyncTime: stravaLastSyncTime,
    activities: stravaActivities,
    syncSettings: stravaSyncSettings,
    initiateAuth: initiateStravaAuth,
    disconnect: disconnectStrava,
    clearCache: clearStravaCache,
    syncActivities: syncStravaActivities,
    updateSettings: updateStravaSettings
  } = useStrava();

  const [modalTab, setModalTab] = useState<'profile' | 'roster' | 'garage' | 'strava' | 'system'>(initialTab || 'profile');
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [editingBikeId, setEditingBikeId] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialTab && isOpen) {
      setModalTab(initialTab);
    }
  }, [initialTab, isOpen]);

  const [showGuide, setShowGuide] = useState(false);

  const [storageInfo, setStorageInfo] = useState<StravaStorageInfo | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  React.useEffect(() => {
    if (modalTab === 'strava') {
      getStravaStorageInfo().then(setStorageInfo);
    }
  }, [modalTab, isStravaConnected, stravaActivities.length]);

  const handleExportBackup = async () => {
    try {
      let activitiesToExport = stravaActivities;
      if (!activitiesToExport || activitiesToExport.length === 0) {
        const dbActivities = await getAllActivitiesFromDb();
        if (dbActivities && dbActivities.length > 0) {
          activitiesToExport = dbActivities as any;
        }
      }
      if (!activitiesToExport || activitiesToExport.length === 0) {
        showToast(language === 'zh-TW' ? '暫無可匯出的騎行資料' : '暂无可导出的骑行数据', 'info');
        return;
      }
      const jsonStr = exportActivitiesToJson(activitiesToExport);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Strava_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(language === 'zh-TW' ? '已成功匯出離線備份' : '已成功导出离线备份', 'success');
    } catch {
      showToast(language === 'zh-TW' ? '匯出備份失敗' : '导出备份失败', 'error');
    }
  };

  const handleClearCacheWithRefresh = async () => {
    await clearStravaCache();
    getStravaStorageInfo().then(setStorageInfo);
  };

  const { sheetStyle, handlers: swipeHandlers } = useSwipeToDismiss({ onClose });

  if (!isOpen) return null;

  const handleReset = () => {
    resetProfile();
    resetNavShortcuts();
    showToast(
      language === 'zh-TW'
        ? '車手檔案與底部導航已重置為標準預設值'
        : '车手档案与底部导航已重置为标准默认值',
      'info'
    );
  };

  const isImperial = unitSystem === 'imperial';

  // Imperial weight conversions (1 kg = 2.20462 lbs)
  const currentWeightLbs = parseFloat((profile.weightKg * 2.20462).toFixed(1));
  const currentBikeWeightLbs = parseFloat((profile.bikeWeightKg * 2.20462).toFixed(1));

  // Height feet/inches calculation
  const heightFeet = Math.floor(profile.heightCm / 30.48);
  const heightInches = Math.round((profile.heightCm % 30.48) / 2.54);

  const roleLabelMap: Record<string, { label: string; labelTw: string; color: string }> = {
    gc: { label: 'GC 主将', labelTw: 'GC 主將', color: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
    sprinter: { label: '冲刺手', labelTw: '衝刺手', color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
    climber: { label: '爬坡手', labelTw: '爬坡手', color: 'bg-rose-500/15 text-rose-600 border-rose-500/30' },
    rouleur: { label: '计时突围', labelTw: '計時突圍', color: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
    domestique: { label: '破风副将', labelTw: '破風副將', color: 'bg-slate-500/15 text-slate-600 border-slate-500/30' },
    custom: { label: '自定义', labelTw: '自訂', color: 'bg-purple-500/15 text-purple-600 border-purple-500/30' }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 dark:bg-black/75 backdrop-blur-2xl animate-in fade-in duration-200"
    >
      <div
        style={sheetStyle}
        className="relative w-full max-w-xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto bg-ios-bg-grouped-light dark:bg-[#121214] p-4 sm:p-5 rounded-t-[28px] sm:rounded-2xl border-t sm:border border-black/[0.06] dark:border-white/[0.08] shadow-ios-popover space-y-4 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-5"
      >
        {/* iOS Presentation Detent Drag Indicator Handle (Mobile only) with Native Pull-Down to Dismiss */}
        <div
          {...swipeHandlers}
          className="sm:hidden w-full py-2 -mt-2 mb-1 flex justify-center cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <div className="w-10 h-1.5 rounded-full bg-black/20 dark:bg-white/25" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-black/[0.05] dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-ios-blue/15 text-ios-blue dark:text-ios-blue-dark flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  {language === 'zh-TW' ? '車隊管理與車手檔案' : '车队管理与车手档案'}
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-ios-blue/10 text-ios-blue font-bold">
                  Pro Team
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {language === 'zh-TW' ? '多車手/多戰車配置即時聯動全站 20 款計算工具' : '多车手/多战车配置即时联动全站 20 款计算工具'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 dark:bg-[#2C2C2E] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white apple-touch transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Segmented Navigation Tabs (Adaptive Layout for Mobile & Desktop) */}
        <div className="w-full">
          <IOSSegmentedControl
            options={[
              { id: 'profile', label: language === 'zh-TW' ? '數據' : '数据', icon: Activity },
              { id: 'roster', label: language === 'zh-TW' ? '車隊' : '车队', icon: Users, badge: roster.length },
              { id: 'garage', label: language === 'zh-TW' ? '戰車' : '战车', icon: Bike, badge: bikes.length },
              { id: 'strava', label: 'Strava', icon: Cloud, dot: isStravaConnected },
              { id: 'system', label: language === 'zh-TW' ? '偏好' : '偏好', icon: SlidersHorizontal }
            ]}
            value={modalTab}
            onChange={(val) => setModalTab(val as any)}
            fullWidth
            hideIconOnMobile
            size="sm"
          />
        </div>

        {/* TAB 1: CURRENT ACTIVE PROFILE DETAILS */}
        {modalTab === 'profile' && (
          <div className="space-y-4">
            {/* Active Rider & Bike Hero Card */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.05] dark:border-white/[0.08] shadow-xs space-y-2.5">
              {/* Row 1: Active Rider Identity & Quick Action Buttons */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                    {activeRider.name}
                  </span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap shrink-0 ${roleLabelMap[activeRider.role || 'custom']?.color}`}>
                    {language === 'zh-TW' ? roleLabelMap[activeRider.role || 'custom']?.labelTw : roleLabelMap[activeRider.role || 'custom']?.label}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setModalTab('roster')}
                    className="h-7 px-2.5 rounded-xl text-[11px] font-semibold text-ios-blue bg-ios-blue/10 hover:bg-ios-blue/15 transition apple-touch"
                  >
                    {language === 'zh-TW' ? '換車手' : '换车手'}
                  </button>
                  <button
                    onClick={() => setModalTab('garage')}
                    className="h-7 px-2.5 rounded-xl text-[11px] font-semibold text-ios-blue bg-ios-blue/10 hover:bg-ios-blue/15 transition apple-touch"
                  >
                    {language === 'zh-TW' ? '換戰車' : '换战车'}
                  </button>
                </div>
              </div>

              {/* Row 2: Clean 2-Column Metrics Tiles */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.06] text-[11px] font-mono">
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.03] dark:border-white/[0.05]">
                  <span className="text-slate-500 dark:text-slate-400 font-sans">{language === 'zh-TW' ? '推重比' : '推重比'}</span>
                  <span className="font-bold text-ios-blue tabular-nums">
                    {(activeRider.weightKg > 0 ? (activeRider.ftpWatts / activeRider.weightKg).toFixed(2) : '--')}{' '}
                    <span className="font-normal text-[10px] text-slate-400">W/kg</span>
                  </span>
                </div>
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.03] dark:border-white/[0.05] min-w-0">
                  <span className="text-slate-500 dark:text-slate-400 font-sans shrink-0">{language === 'zh-TW' ? '戰車' : '战车'}</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate ml-1 text-right" title={activeBike.name}>
                    {activeBike.name.split('/')[0]}{' '}
                    <span className="font-normal text-[10px] text-slate-400 tabular-nums">({activeBike.weightKg}kg)</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Inset Group: Rider Physical & Bike Specs */}
            <div className="bg-white dark:bg-[#1C1C1E] p-4 sm:p-4.5 rounded-2xl border border-black/[0.05] dark:border-white/[0.08] space-y-3.5 shadow-xs">
              <div className="flex items-center gap-2 pb-1 border-b border-black/[0.04] dark:border-white/[0.06]">
                <Activity className="w-4 h-4 text-ios-blue dark:text-ios-blue-dark" />
                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                  {language === 'zh-TW' ? '車手身體與心率生理基準' : '车手身体与心率生理基准'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {language === 'zh-TW' ? '身高' : '身高'}
                    </label>
                    {isImperial && (
                      <span className="text-[11px] text-ios-blue dark:text-ios-blue-dark font-mono">
                        {heightFeet}'{heightInches}"
                      </span>
                    )}
                  </div>
                  <NumberStepper
                    value={profile.heightCm}
                    onChange={(v) => updateProfile({ heightCm: v })}
                    step={0.5}
                    min={120}
                    max={220}
                    unit="cm"
                    decimals={1}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
                    {language === 'zh-TW' ? '跨高' : '跨高'}
                  </label>
                  <NumberStepper
                    value={profile.inseamCm}
                    onChange={(v) => updateProfile({ inseamCm: v })}
                    step={0.5}
                    min={50}
                    max={110}
                    unit="cm"
                    decimals={1}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {language === 'zh-TW' ? '車手淨體重' : '车手净体重'}
                    </label>
                    {isImperial && (
                      <span className="text-[11px] text-ios-blue dark:text-ios-blue-dark font-mono">
                        {currentWeightLbs} lbs
                      </span>
                    )}
                  </div>
                  <NumberStepper
                    value={profile.weightKg}
                    onChange={(v) => updateProfile({ weightKg: v })}
                    step={0.5}
                    min={35}
                    max={150}
                    unit="kg"
                    decimals={1}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {language === 'zh-TW' ? '整車裝備重量' : '整车装备重量'}
                    </label>
                    {isImperial && (
                      <span className="text-[11px] text-ios-blue dark:text-ios-blue-dark font-mono">
                        {currentBikeWeightLbs} lbs
                      </span>
                    )}
                  </div>
                  <NumberStepper
                    value={profile.bikeWeightKg}
                    onChange={(v) => {
                      updateProfile({ bikeWeightKg: v });
                      updateBike(activeBikeId, { weightKg: v });
                    }}
                    step={0.1}
                    min={4}
                    max={30}
                    unit="kg"
                    decimals={1}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
                    {language === 'zh-TW' ? '車手閾值功率 FTP' : '车手阈值功率 FTP'}
                  </label>
                  <NumberStepper
                    value={profile.ftpWatts}
                    onChange={(v) => updateProfile({ ftpWatts: v })}
                    step={5}
                    min={100}
                    max={600}
                    unit="W"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
                    {language === 'zh-TW' ? (
                      <span>最大心率 (HR<sub className="text-[11px]">max</sub>)</span>
                    ) : (
                      <span>最大心率 (HR<sub className="text-[11px]">max</sub>)</span>
                    )}
                  </label>
                  <NumberStepper
                    value={profile.maxHr}
                    onChange={(v) => updateProfile({ maxHr: v })}
                    step={1}
                    min={140}
                    max={230}
                    unit="BPM"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
                    {language === 'zh-TW' ? (
                      <span>靜息心率 (HR<sub className="text-[11px]">rest</sub>)</span>
                    ) : (
                      <span>静息心率 (HR<sub className="text-[11px]">rest</sub>)</span>
                    )}
                  </label>
                  <NumberStepper
                    value={profile.restingHr}
                    onChange={(v) => updateProfile({ restingHr: v })}
                    step={1}
                    min={30}
                    max={100}
                    unit="BPM"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
                    {language === 'zh-TW' ? '年齡' : '年龄'}
                  </label>
                  <NumberStepper
                    value={profile.age}
                    onChange={(v) => updateProfile({ age: v })}
                    step={1}
                    min={12}
                    max={90}
                    unit="岁"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
                    {language === 'zh-TW' ? '年度目標里程' : '年度目标里程'}
                  </label>
                  <NumberStepper
                    value={profile.annualGoalKm ?? 5000}
                    onChange={(v) => updateProfile({ annualGoalKm: v })}
                    step={500}
                    min={500}
                    max={50000}
                    unit="km"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-300 block mb-1">
                    {language === 'zh-TW' ? '年度目標爬升' : '年度目标爬升'}
                  </label>
                  <NumberStepper
                    value={profile.annualGoalElevationM ?? 50000}
                    onChange={(v) => updateProfile({ annualGoalElevationM: v })}
                    step={2000}
                    min={1000}
                    max={300000}
                    unit="m"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TEAM ROSTER (MULTI-RIDER MANAGEMENT) */}
        {modalTab === 'roster' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                {language === 'zh-TW' ? '車隊現役車手名單' : '车队现役车手名单'}
                <span className="hidden sm:inline font-normal text-slate-500 dark:text-slate-400 ml-1">(点击立即切换出赛)</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  const newId = `rider-${Date.now()}`;
                  addRider({
                    id: newId,
                    name: `新车手 ${roster.length + 1}`,
                    role: 'domestique',
                    heightCm: 175,
                    inseamCm: 81,
                    weightKg: 68,
                    bikeWeightKg: 7.5,
                    ftpWatts: 300,
                    restingHr: 50,
                    maxHr: 190,
                    gender: 'male',
                    age: 24,
                    annualGoalKm: 5000,
                    annualGoalElevationM: 50000,
                  });
                  showToast('已创建并载入新车手档案', 'success');
                }}
                className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-ios-blue/10 hover:bg-ios-blue/15 text-ios-blue dark:text-ios-blue-dark text-xs font-semibold border border-ios-blue/20 transition shrink-0 apple-touch"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{language === 'zh-TW' ? '添加車手' : '添加车手'}</span>
              </button>
            </div>

            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {roster.map((rider) => {
                const isActive = activeRiderId === rider.id;
                const roleMeta = roleLabelMap[rider.role || 'custom'];
                const wkg = rider.weightKg > 0 ? (rider.ftpWatts / rider.weightKg).toFixed(2) : '--';

                return (
                  <div
                    key={rider.id}
                    onClick={() => {
                      switchRider(rider.id);
                      showToast(
                        language === 'zh-TW'
                          ? `已切換當前出賽車手為【${rider.name}】`
                          : `已切换当前出赛车手为【${rider.name}】`,
                        'success'
                      );
                    }}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer apple-touch flex items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-ios-blue/10 dark:bg-ios-blue/20 border-ios-blue ring-2 ring-ios-blue/30 shadow-xs'
                        : 'bg-white dark:bg-[#1C1C1E] border-black/[0.05] dark:border-white/[0.08] hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className={`text-xs font-bold ${isActive ? 'text-ios-blue' : 'text-slate-900 dark:text-white'}`}>
                          {rider.name}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold whitespace-nowrap shrink-0 ${roleMeta?.color}`}>
                          {language === 'zh-TW' ? roleMeta?.labelTw : roleMeta?.label}
                        </span>
                        {isActive && (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-ios-green font-mono shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            出赛中
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        <span>体重: <strong className="text-slate-700 dark:text-slate-300">{rider.weightKg} kg</strong></span>
                        <span>FTP: <strong className="text-slate-700 dark:text-slate-300">{rider.ftpWatts} W</strong></span>
                        <span>推重比: <strong className="text-ios-blue font-bold">{wkg} W/kg</strong></span>
                        <span>身高: {rider.heightCm}cm</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-1">
                      {roster.length > 1 && !isActive && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteRider(rider.id);
                            showToast('已移除该车手', 'info');
                          }}
                          className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-ios-red hover:bg-ios-red/10 flex items-center justify-center transition apple-touch shrink-0"
                          title="删除车手"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: BIKE GARAGE (MULTI-BIKE CONFIGURATION & DATA BUS) */}
        {modalTab === 'garage' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                {language === 'zh-TW' ? '車隊戰車車庫 · 動力學數據總線' : '车队战车车库 · 动力学数据总线'}
                <span className="hidden sm:inline font-normal text-slate-500 dark:text-slate-400 ml-1">· 点击装配并联动全站计算</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  const newId = `bike-${Date.now()}`;
                  addBike({
                    ...(bikes[0] || DEFAULT_ENRICHED_BIKE_GARAGE[0]),
                    id: newId,
                    name: `新战车 ${bikes.length + 1}`,
                    notes: '自定义自组战车'
                  });
                  setEditingBikeId(newId);
                  showToast('已添加新战车并进入配置模式', 'success');
                }}
                className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-ios-blue/10 hover:bg-ios-blue/15 text-ios-blue dark:text-ios-blue-dark text-xs font-semibold border border-ios-blue/20 transition shrink-0 apple-touch"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{language === 'zh-TW' ? '新增戰車' : '新增战车'}</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
              {bikes.map((b) => {
                const isActive = activeBikeId === b.id;
                const isEditing = editingBikeId === b.id;
                const typeName =
                  b.type === 'road_aero' ? '气动公路' :
                  b.type === 'road_climb' ? '轻量爬坡' :
                  b.type === 'road_allround' ? '全能综合' :
                  b.type === 'road_endurance' ? '长途耐力' :
                  b.type === 'road_tt' ? '计时赛 TT' :
                  b.type === 'gravel' ? 'Gravel 砂石' :
                  b.type === 'mtb_xc' ? '山地 XC' : '山地林道';

                return (
                  <div
                    key={b.id}
                    onClick={() => {
                      if (!isEditing) {
                        switchBike(b.id);
                        showToast(
                          language === 'zh-TW'
                            ? `已裝配戰車【${b.name.split('/')[0]}】，全站工具已同步更新`
                            : `已装配战车【${b.name.split('/')[0]}】，全站工具已同步更新`,
                          'success'
                        );
                      }
                    }}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer apple-touch space-y-2.5 ${
                      isActive
                        ? 'bg-ios-blue/10 dark:bg-ios-blue/20 border-ios-blue ring-2 ring-ios-blue/30 shadow-xs'
                        : 'bg-white dark:bg-[#1C1C1E] border-black/[0.05] dark:border-white/[0.08] hover:border-slate-300'
                    }`}
                  >
                    {/* Card Top Row: Identity & Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                        <Bike className={`w-4 h-4 shrink-0 ${isActive ? 'text-ios-blue' : 'text-slate-400'}`} />
                        <span className={`text-xs font-bold truncate ${isActive ? 'text-ios-blue' : 'text-slate-900 dark:text-white'}`}>
                          {b.name}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-white/10 text-slate-700 dark:text-slate-300 font-medium shrink-0">
                          {typeName}
                        </span>
                        {isActive && (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-ios-blue font-mono shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            装配中
                          </span>
                        )}
                        {b.stravaGearId && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/15 text-[#FC4C02] font-semibold flex items-center gap-1 shrink-0">
                            <svg className="w-2.5 h-2.5 fill-[#FC4C02] shrink-0" viewBox="0 0 24 24">
                              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.925 15.632h4.17" />
                            </svg>
                            <span>Strava</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setEditingBikeId(isEditing ? null : b.id)}
                          className={`h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition apple-touch ${
                            isEditing
                              ? 'bg-ios-blue text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300'
                          }`}
                          title="配置战车规格"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{isEditing ? '收起' : '配置'}</span>
                          {isEditing ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {bikes.length > 1 && !isActive && (
                          <button
                            type="button"
                            onClick={() => {
                              deleteBike(b.id);
                              if (editingBikeId === b.id) setEditingBikeId(null);
                              showToast('已从车库移出该车', 'info');
                            }}
                            className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-ios-red hover:bg-ios-red/10 flex items-center justify-center transition apple-touch shrink-0"
                            title="删除战车"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Specifications Grid Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                      <div className="p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06]">
                        <span className="text-slate-400 block text-[10px] font-sans">整备质量</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums">{b.weightKg} kg</span>
                      </div>
                      <div className="p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06]">
                        <span className="text-slate-400 block text-[10px] font-sans">传动齿比</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums truncate block">
                          {b.drivetrain.chainringType === 'single' ? `${b.drivetrain.bigRing}T` : `${b.drivetrain.bigRing}/${b.drivetrain.smallRing}T`} · {b.drivetrain.cassette[0]}-{b.drivetrain.cassette[b.drivetrain.cassette.length - 1]}T
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06]">
                        <span className="text-slate-400 block text-[10px] font-sans">外胎规格</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums truncate block">
                          {b.wheelTire.nominalWidthMm}c · {b.wheelTire.rimInternalWidthMm}mm内宽
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06]">
                        <span className="text-slate-400 block text-[10px] font-sans">设定胎压</span>
                        <span className="font-bold text-ios-blue tabular-nums">
                          {b.wheelTire.frontPressurePsi || '--'} / {b.wheelTire.rearPressurePsi || '--'} PSI
                        </span>
                      </div>
                    </div>

                    {/* Strava Gear Selector */}
                    {isStravaConnected && athlete?.bikes && athlete.bikes.length > 0 && (
                      <div
                        className="pt-2 border-t border-black/[0.04] dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1.5 shrink-0">
                          <svg className="w-3 h-3 fill-[#FC4C02] shrink-0" viewBox="0 0 24 24">
                            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7.925 15.632h4.17" />
                          </svg>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {language === 'zh-TW' ? 'Strava 裝備關聯:' : 'Strava 装备关联:'}
                          </span>
                        </div>
                        <select
                          value={b.stravaGearId || ''}
                          onChange={(e) => {
                            const gearId = e.target.value;
                            if (!gearId) {
                              updateBike(b.id, { stravaGearId: undefined });
                              showToast('已解除与 Strava 装备的绑定', 'info');
                            } else {
                              const matched = athlete?.bikes?.find(sb => sb.id === gearId);
                              const km = matched ? Math.round(matched.distance / 1000) : (b.mileageKm || 0);
                              updateBike(b.id, { stravaGearId: gearId, mileageKm: km });
                              showToast(
                                language === 'zh-TW'
                                  ? `戰車已成功關聯 Strava【${matched?.name || gearId}】，里程同步為 ${km} km`
                                  : `战车已成功关联 Strava【${matched?.name || gearId}】，里程同步为 ${km} km`,
                                'success'
                              );
                            }
                          }}
                          className="w-full sm:flex-1 h-9 bg-black/5 dark:bg-white/10 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 border border-black/[0.06] dark:border-white/[0.1] focus:ring-1 focus:ring-orange-500 min-w-0 font-sans"
                        >
                          <option value="">未绑定</option>
                          {athlete.bikes.map(sb => (
                            <option key={sb.id} value={sb.id}>
                              {sb.name} ({Math.round(sb.distance / 1000)} km)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Inline Detailed Configuration Editor */}
                    {isEditing && (
                      <div
                        className="mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] space-y-3 cursor-default"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            战车全维工程参数调校
                          </span>
                          <span className="text-[11px] text-slate-400">修改实时保存生效</span>
                        </div>

                        {/* Section A: Name & Classification */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="sm:col-span-2">
                            <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">战车命名与型号</label>
                            <input
                              type="text"
                              value={b.name}
                              onChange={(e) => updateBike(b.id, { name: e.target.value })}
                              className="w-full h-9 px-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/[0.06] dark:border-white/[0.08] text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-ios-blue"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">车型分类</label>
                            <select
                              value={b.type}
                              onChange={(e) => updateBike(b.id, { type: e.target.value as any })}
                              className="w-full h-9 px-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/[0.06] dark:border-white/[0.08] text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-ios-blue"
                            >
                              <option value="road_aero">气动公路</option>
                              <option value="road_climb">超轻爬坡</option>
                              <option value="road_allround">全能大组</option>
                              <option value="road_endurance">长途耐力</option>
                              <option value="road_tt">计时赛战车</option>
                              <option value="gravel">砂石越野</option>
                              <option value="mtb_xc">山地全避震</option>
                            </select>
                          </div>
                        </div>

                        {/* Section B: Weight & Aero */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">整车重量 (kg)</label>
                            <NumberStepper
                              value={b.weightKg}
                              onChange={(v) => updateBike(b.id, { weightKg: v })}
                              step={0.1}
                              min={4.5}
                              max={20.0}
                              unit="kg"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">风阻面积 CdA (m²)</label>
                            <NumberStepper
                              value={b.cda}
                              onChange={(v) => updateBike(b.id, { cda: v })}
                              step={0.01}
                              min={0.18}
                              max={0.50}
                              unit="m²"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">滚阻系数 Crr</label>
                            <NumberStepper
                              value={b.crr}
                              onChange={(v) => updateBike(b.id, { crr: v })}
                              step={0.0002}
                              min={0.0020}
                              max={0.0120}
                              unit=""
                            />
                          </div>
                        </div>

                        {/* Section C: Drivetrain */}
                        <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] space-y-2">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                            ⚙️ 传动系统
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">盘片结构</label>
                              <select
                                value={b.drivetrain.chainringType}
                                onChange={(e) => updateBike(b.id, {
                                  drivetrain: {
                                    ...b.drivetrain,
                                    chainringType: e.target.value as 'double' | 'single'
                                  }
                                })}
                                className="w-full h-9 px-2 rounded-xl bg-white dark:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] text-xs font-medium"
                              >
                                <option value="double">双盘</option>
                                <option value="single">单盘</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">大盘齿数</label>
                              <NumberStepper
                                value={b.drivetrain.bigRing}
                                onChange={(v) => updateBike(b.id, {
                                  drivetrain: { ...b.drivetrain, bigRing: v }
                                })}
                                step={1}
                                min={30}
                                max={60}
                                unit="T"
                              />
                            </div>
                            {b.drivetrain.chainringType === 'double' && (
                              <div>
                                <label className="text-[10px] text-slate-400 block mb-0.5">小盘齿数</label>
                                <NumberStepper
                                  value={b.drivetrain.smallRing}
                                  onChange={(v) => updateBike(b.id, {
                                    drivetrain: { ...b.drivetrain, smallRing: v }
                                  })}
                                  step={1}
                                  min={28}
                                  max={46}
                                  unit="T"
                                />
                              </div>
                            )}
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">曲柄长度</label>
                              <select
                                value={b.drivetrain.crankLengthMm}
                                onChange={(e) => updateBike(b.id, {
                                  drivetrain: { ...b.drivetrain, crankLengthMm: Number(e.target.value) }
                                })}
                                className="w-full h-9 px-2 rounded-xl bg-white dark:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] text-xs font-mono font-medium"
                              >
                                <option value={160}>160.0 mm</option>
                                <option value={165}>165.0 mm</option>
                                <option value={167.5}>167.5 mm</option>
                                <option value={170}>170.0 mm</option>
                                <option value={172.5}>172.5 mm</option>
                                <option value={175}>175.0 mm</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Section D: Wheels & Tires */}
                        <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] space-y-2">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                            🛞 轮组与外胎系统
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">标称胎宽</label>
                              <NumberStepper
                                value={b.wheelTire.nominalWidthMm}
                                onChange={(v) => updateBike(b.id, {
                                  wheelTire: { ...b.wheelTire, nominalWidthMm: v }
                                })}
                                step={1}
                                min={20}
                                max={65}
                                unit="mm"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">轮圈内宽</label>
                              <NumberStepper
                                value={b.wheelTire.rimInternalWidthMm}
                                onChange={(v) => updateBike(b.id, {
                                  wheelTire: { ...b.wheelTire, rimInternalWidthMm: v }
                                })}
                                step={1}
                                min={15}
                                max={35}
                                unit="mm"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">外胎结构</label>
                              <select
                                value={b.wheelTire.tireSetup}
                                onChange={(e) => updateBike(b.id, {
                                  wheelTire: { ...b.wheelTire, tireSetup: e.target.value as any }
                                })}
                                className="w-full h-9 px-2 rounded-xl bg-white dark:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] text-xs font-medium"
                              >
                                <option value="tubeless">真空胎</option>
                                <option value="tube">开口内胎</option>
                                <option value="tubular">管胎</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">轮圈钩型</label>
                              <select
                                value={b.wheelTire.isHookless ? 'hookless' : 'hooked'}
                                onChange={(e) => updateBike(b.id, {
                                  wheelTire: { ...b.wheelTire, isHookless: e.target.value === 'hookless' }
                                })}
                                className="w-full h-9 px-2 rounded-xl bg-white dark:bg-[#2C2C2E] border border-black/[0.06] dark:border-white/[0.08] text-xs font-medium"
                              >
                                <option value="hooked">传统有钩圈</option>
                                <option value="hookless">无钩圈 (≤72.5 PSI)</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Section E: Fitting Geometry */}
                        <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] space-y-2">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                            📐 Fitting 设定几何 (mm)
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">坐垫高度 · BB中心</label>
                              <NumberStepper
                                value={b.geometry?.saddleHeightMm || 710}
                                onChange={(v) => updateBike(b.id, {
                                  geometry: { ...(b.geometry || {}), saddleHeightMm: v }
                                })}
                                step={1}
                                min={550}
                                max={900}
                                unit="mm"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">把立长度</label>
                              <NumberStepper
                                value={b.geometry?.stemLengthMm || 100}
                                onChange={(v) => updateBike(b.id, {
                                  geometry: { ...(b.geometry || {}), stemLengthMm: v }
                                })}
                                step={5}
                                min={60}
                                max={150}
                                unit="mm"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">车把宽度</label>
                              <NumberStepper
                                value={b.geometry?.handlebarWidthMm || 400}
                                onChange={(v) => updateBike(b.id, {
                                  geometry: { ...(b.geometry || {}), handlebarWidthMm: v }
                                })}
                                step={10}
                                min={360}
                                max={800}
                                unit="mm"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">坐垫把落差</label>
                              <NumberStepper
                                value={b.geometry?.saddleDropMm || 60}
                                onChange={(v) => updateBike(b.id, {
                                  geometry: { ...(b.geometry || {}), saddleDropMm: v }
                                })}
                                step={5}
                                min={0}
                                max={160}
                                unit="mm"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingBikeId(null)}
                            className="h-9 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 text-xs font-semibold transition apple-touch"
                          >
                            完成调校并保存
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: STRAVA CLOUD SYNC & API INTEGRATION */}
        {modalTab === 'strava' && (
          <div className="space-y-4">
            {!isStravaConnected ? (
              /* UNCONNECTED: BYOK Connect Form */
              <div className="space-y-4">
                {/* Intro Card */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.05] dark:border-white/[0.08] shadow-ios-card space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#FC4C02]/15 text-[#FC4C02] flex items-center justify-center font-bold shrink-0">
                      <Cloud className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            Strava 开放平台直连
                          </h3>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#FC4C02]/15 text-[#FC4C02] font-semibold border border-[#FC4C02]/20 shrink-0">
                            个人 API 模式
                          </span>
                        </div>
                        <div className="shrink-0">
                          <PoweredByStravaBadge />
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        零云端服务器中转，本地直连您的 Strava 账号。自动同步骑行历史、真实心率功率与战车行驶里程。
                      </p>
                    </div>
                  </div>

                  {/* Collapsible Guide */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06] space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowGuide(!showGuide)}
                      className="w-full flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
                    >
                      <span className="flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-[#FC4C02]" />
                        如何免费获取 Strava API 密钥？（1分钟极简图文指引）
                      </span>
                      <span className="text-slate-400 text-xs">{showGuide ? '收起' : '展开'}</span>
                    </button>

                    {showGuide && (
                      <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.06] text-[11px] text-slate-600 dark:text-slate-400 space-y-1.5 leading-relaxed">
                        <p>1. 电脑或手机浏览器打开 <a href="https://www.strava.com/settings/api" target="_blank" rel="noreferrer" className="text-[#FC4C02] underline font-medium">strava.com/settings/api</a> 登录您的账号；</p>
                        <p>2. 创建应用：<strong>Application Name</strong> 填 <code className="bg-black/5 dark:bg-white/10 px-1 rounded">LaBao</code>，<strong>Category</strong> 选 <code className="bg-black/5 dark:bg-white/10 px-1 rounded">Other</code>；</p>
                        <p>3. <strong>Authorization Callback Domain</strong> 填入 <code className="bg-black/5 dark:bg-white/10 px-1 rounded">localhost</code>（或您访问本系统的域名）；</p>
                        <p>4. 平台统一使用 LaBao Strava 应用，密钥由服务器安全保管，您无需填写任何 API 密钥。</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-1">
                    <p className="text-xs text-slate-600 dark:text-slate-300">本平台使用统一的 LaBao Strava 应用，Client Secret 由服务器安全保管，浏览器不会保存或接触。</p>
                    <button
                      type="button"
                      onClick={initiateStravaAuth}
                      className="apple-touch w-full h-9 rounded-xl bg-[#FC4C02] hover:bg-[#E34402] text-white font-bold text-xs shadow-ios-sm flex items-center justify-center gap-2 transition active:scale-98"
                    >
                      <Cloud className="w-4 h-4" />
                      <span>前往 Strava 授权连接</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* CONNECTED: Athlete Status, Sync Actions, Preferences */
              <div className="space-y-4">
                {/* Connected Athlete Banner */}
                <div className="p-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.05] dark:border-white/[0.08] shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {athlete?.profile_medium && !avatarError && !athlete.profile_medium.includes('avatar/athlete/') ? (
                        <img
                          src={athlete.profile_medium}
                          alt={athlete.firstname}
                          onError={() => setAvatarError(true)}
                          className="w-11 h-11 rounded-2xl object-cover border border-black/10 dark:border-white/10 shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-2xl bg-[#FC4C02]/15 text-[#FC4C02] flex items-center justify-center font-bold text-base shrink-0">
                          {athlete?.firstname?.charAt(0) || 'S'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {athlete?.firstname} {athlete?.lastname}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20 flex items-center gap-1 shrink-0">
                            <Check className="w-2.5 h-2.5" />
                            已连接
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                          {athlete?.city ? `${athlete.city}, ${athlete.country || ''}` : 'Strava 认证车手'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-black/[0.04] dark:border-white/[0.06] w-full sm:w-auto">
                      <PoweredByStravaBadge />
                      <button
                        type="button"
                        onClick={() => syncStravaActivities(true)}
                        disabled={isStravaSyncing}
                        className="apple-touch px-3.5 py-1.5 rounded-xl bg-[#FC4C02]/10 hover:bg-[#FC4C02]/20 text-[#FC4C02] text-xs font-semibold border border-[#FC4C02]/20 flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 shrink-0"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isStravaSyncing ? 'animate-spin' : ''}`} />
                        <span>{isStravaSyncing ? '同步中...' : '立即同步'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Realtime Progress Bar */}
                  {stravaSyncProgress && (
                    <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 space-y-1.5 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>{stravaSyncProgress.message}</span>
                        </span>
                        <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                          {stravaSyncProgress.current}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300 rounded-full"
                          style={{ width: `${stravaSyncProgress.current}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Stats Tiles */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-black/[0.04] dark:border-white/[0.06] text-center">
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03]">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">已同步活动</span>
                      <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                        {stravaActivities.length}
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03]">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Strava FTP</span>
                      <span className="text-sm font-bold font-mono text-ios-blue">
                        {athlete?.ftp || '--'} <span className="text-[11px] font-normal">W</span>
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03]">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">车手自重</span>
                      <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                        {athlete?.weight ? `${athlete.weight}` : '--'} <span className="text-[11px] font-normal">kg</span>
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03]">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">关联战车</span>
                      <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                        {athlete?.bikes?.length || 0} <span className="text-[11px] font-normal">台</span>
                      </span>
                    </div>
                  </div>

                  {stravaLastSyncTime && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1">
                      <span>上次同步时间:</span>
                      <span className="font-mono">{new Date(stravaLastSyncTime * 1000).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Auto-Sync Preferences Card */}
                <div className="p-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.05] dark:border-white/[0.08] shadow-xs space-y-3">
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-ios-blue" />
                    自动化协同偏好设置
                  </h4>

                  <div className="space-y-2.5 text-xs divide-y divide-black/[0.04] dark:divide-white/[0.06]">
                    <label className="flex items-center justify-between pt-1 cursor-pointer">
                      <div>
                        <span className="text-slate-800 dark:text-slate-200 block font-medium">自动同步单车行驶里程到战车库</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">战车里程达标时联动提醒链条拉伸与外胎磨损</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={stravaSyncSettings.autoSyncBikes}
                        onChange={(e) => updateStravaSettings({ autoSyncBikes: e.target.checked })}
                        className="w-4 h-4 rounded accent-[#FC4C02] cursor-pointer"
                      />
                    </label>

                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <span className="text-slate-800 dark:text-slate-200 block font-medium">历史骑行活动同步范围</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">为 PMC 长期体能负荷分析拉取历史天数</span>
                      </div>
                      <div className="shrink-0 self-end sm:self-auto">
                        <IOSSegmentedControl
                          options={[
                            { value: '30', label: '30天' },
                            { value: '90', label: '90天' },
                            { value: '365', label: '1年' },
                            { value: '3650', label: '全部' },
                          ]}
                          value={String(stravaSyncSettings.syncDays || 365)}
                          onChange={(val) => {
                            const days = Number(val);
                            updateStravaSettings({ syncDays: days });
                            syncStravaActivities(true);
                          }}
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activities Preview */}
                {stravaActivities.length > 0 && (
                  <div className="p-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.05] dark:border-white/[0.08] shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        最近同步骑行 ({Math.min(3, stravaActivities.length)})
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        全量数据已存入本地 IndexedDB
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {stravaActivities.slice(0, 3).map((act) => (
                        <div
                          key={act.id}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.03] dark:border-white/[0.05] flex items-center justify-between text-xs"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <span className="font-semibold text-slate-900 dark:text-white block truncate">
                              {act.name}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              {new Date(act.start_date_local || act.start_date).toLocaleDateString()} • {(act.distance / 1000).toFixed(1)} km • 爬升 {act.total_elevation_gain}m
                            </span>
                          </div>

                          <div className="text-right shrink-0 font-mono">
                            <span className="px-2 py-0.5 rounded-md bg-[#FC4C02]/10 text-[#FC4C02] font-bold text-[11px]">
                              {act.tss || 0} TSS
                            </span>
                            {act.weighted_average_watts ? (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                                NP: {act.weighted_average_watts}W
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* Offline Cache & Storage Health Card - ALWAYS VISIBLE */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-black/[0.05] dark:border-white/[0.08] shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-ios-blue/10 flex items-center justify-center text-ios-blue shrink-0">
                    <Database className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {language === 'zh-TW' ? '存儲與健康度' : '存储与健康度'}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>{language === 'zh-TW' ? '離線就緒' : '离线就绪'}</span>
                </span>
              </div>

              {/* 3 Metric Tiles with concise names */}
              <div className="grid grid-cols-3 gap-2">
                {/* Tile 1: Saved Rides */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06] text-center space-y-0.5">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block truncate">
                    {language === 'zh-TW' ? '已存騎行' : '已存骑行'}
                  </span>
                  <span className="text-sm font-bold font-mono text-slate-900 dark:text-white block tabular-nums">
                    {storageInfo?.activityCount ?? stravaActivities.length}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono block truncate">
                    {storageInfo && storageInfo.streamCount > 0 ? `${storageInfo.streamCount} 流` : (language === 'zh-TW' ? '斷網可用' : '断网可用')}
                  </span>
                </div>

                {/* Tile 2: Local Storage */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06] text-center space-y-0.5">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block truncate">
                    {language === 'zh-TW' ? '本地占用' : '本地占用'}
                  </span>
                  <span className="text-sm font-bold font-mono text-ios-blue block tabular-nums">
                    {storageInfo
                      ? storageInfo.approxDbSizeBytes < 1024 * 1024
                        ? `${Math.round(storageInfo.approxDbSizeBytes / 1024)} KB`
                        : `${(storageInfo.approxDbSizeBytes / (1024 * 1024)).toFixed(1)} MB`
                      : `${(stravaActivities.length * 2.5).toFixed(0)} KB`}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono block truncate">
                    IndexedDB
                  </span>
                </div>

                {/* Tile 3: Free Quota */}
                <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06] text-center space-y-0.5">
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block truncate">
                    {language === 'zh-TW' ? '可用配額' : '可用配额'}
                  </span>
                  <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400 block tabular-nums">
                    {storageInfo && storageInfo.browserQuotaBytes > 0
                      ? `>${Math.round(storageInfo.browserQuotaBytes / (1024 * 1024 * 1024))}G`
                      : '>10G'}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono block truncate">
                    {language === 'zh-TW' ? '極度充裕' : '极度充裕'}
                  </span>
                </div>
              </div>

              {/* Micro Storage Bar */}
              <div className="space-y-1 pt-0.5">
                <div className="h-1.5 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden flex">
                  <div className="h-full bg-ios-blue rounded-full w-[2%] min-w-[6px]" />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>{language === 'zh-TW' ? '存儲餘量充足 · 支援全量離線' : '存储余量充足 · 支持全量离线'}</span>
                  <span className="font-mono text-ios-blue tabular-nums">&lt;0.01%</span>
                </div>
              </div>

              {/* Action Buttons with Concise Names */}
              <div className={`grid ${isStravaConnected ? 'grid-cols-3' : 'grid-cols-2'} gap-2 pt-1 border-t border-black/[0.04] dark:border-white/[0.06]`}>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="apple-touch flex items-center justify-center gap-1 h-9 px-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold transition shrink-0"
                  title={language === 'zh-TW' ? '匯出 JSON 備份' : '导出 JSON 备份'}
                >
                  <Download className="w-3.5 h-3.5 text-ios-blue shrink-0" />
                  <span className="truncate">{language === 'zh-TW' ? '匯出備份' : '导出备份'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearCacheWithRefresh}
                  className="apple-touch flex items-center justify-center gap-1 h-9 px-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold transition shrink-0"
                  title={language === 'zh-TW' ? '清空本地離線快取' : '清空本地离线缓存'}
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate">{language === 'zh-TW' ? '清空快取' : '清空缓存'}</span>
                </button>
                {isStravaConnected && (
                  <button
                    type="button"
                    onClick={disconnectStrava}
                    className="apple-touch flex items-center justify-center gap-1 h-9 px-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 text-rose-500 text-xs font-semibold transition shrink-0"
                    title={language === 'zh-TW' ? '解除綁定 Strava 帳戶' : '解除绑定 Strava 账户'}
                  >
                    <LogOut className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{language === 'zh-TW' ? '解除綁定' : '解除绑定'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Brand Compliance Footer */}
            <div className="pt-2 flex flex-col items-center justify-center gap-1 text-center">
              <PoweredByStravaBadge />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                本应用遵循 Strava API 开发者准则与品牌官方规范。
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: SYSTEM PREFERENCES & NAVIGATION CUSTOMIZER */}
        {modalTab === 'system' && (
          <div className="space-y-4">
            {/* Preferences Group */}
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] divide-y divide-black/[0.04] dark:divide-white/[0.06] overflow-hidden shadow-xs">
              {/* Language Selector */}
              <div className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-lg bg-ios-blue/10 flex items-center justify-center text-ios-blue dark:text-ios-blue-dark shrink-0">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">
                      {language === 'zh-TW' ? '語言' : '语言'}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                      {language === 'zh-TW' ? '繁體中文' : '简体中文'}
                    </span>
                  </div>
                </div>
                <IOSSegmentedControl
                  options={[
                    { value: 'zh', label: '简体' },
                    { value: 'zh-TW', label: '繁體' },
                  ]}
                  value={language}
                  onChange={(val) => setLanguage(val as 'zh' | 'zh-TW')}
                  size="sm"
                  mobileFullWidth={false}
                  className="shrink-0"
                />
              </div>

              {/* Unit System */}
              <div className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-lg bg-ios-green/10 flex items-center justify-center text-ios-green dark:text-ios-green-dark shrink-0">
                    <Gauge className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">
                      {language === 'zh-TW' ? '單位' : '单位'}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                      {isImperial ? '英制 (lbs, mi)' : '公制 (kg, km)'}
                    </span>
                  </div>
                </div>
                <IOSSegmentedControl
                  options={[
                    { value: 'metric', label: '公制' },
                    { value: 'imperial', label: '英制' },
                  ]}
                  value={unitSystem}
                  onChange={(val) => setUnitSystem(val as 'metric' | 'imperial')}
                  size="sm"
                  mobileFullWidth={false}
                  className="shrink-0"
                />
              </div>

              {/* Appearance Mode */}
              {themeMode && setThemeMode && (
                <div className="p-3 sm:p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg bg-ios-orange/10 flex items-center justify-center text-ios-orange dark:text-ios-orange-dark shrink-0">
                      {themeMode === 'system' ? (
                        <Smartphone className="w-4 h-4" />
                      ) : themeMode === 'dark' ? (
                        <Moon className="w-4 h-4" />
                      ) : (
                        <Sun className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-slate-900 dark:text-white block truncate">
                        {language === 'zh-TW' ? '外觀' : '外观'}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                        {themeMode === 'system' ? (language === 'zh-TW' ? '跟隨系統' : '跟随系统') : themeMode === 'dark' ? (language === 'zh-TW' ? '深色模式' : '深色模式') : (language === 'zh-TW' ? '淺色模式' : '浅色模式')}
                      </span>
                    </div>
                  </div>
                  <IOSSegmentedControl
                    options={[
                      { value: 'system', label: '自动' },
                      { value: 'light', label: '浅色' },
                      { value: 'dark', label: '深色' },
                    ]}
                    value={themeMode}
                    onChange={(val) => setThemeMode(val as 'system' | 'light' | 'dark')}
                    size="sm"
                    mobileFullWidth={false}
                    className="shrink-0"
                  />
                </div>
              )}
            </div>

            {/* Mobile Bottom Navigation Customizer */}
            <div className="bg-white dark:bg-[#1C1C1E] p-4 sm:p-4.5 rounded-2xl border border-black/[0.05] dark:border-white/[0.08] space-y-3 shadow-xs">
              <div className="flex items-center justify-between pb-1 border-b border-black/[0.04] dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-ios-blue dark:text-ios-blue-dark" />
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    {language === 'zh-TW' ? '移動端底部導航欄自訂' : '移动端底部导航栏自选'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">4 个快捷槽位</span>
              </div>

              {/* Recommended Presets */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>{language === 'zh-TW' ? '官方推薦組合:' : '官方推荐组合:'}</span>
                  <button
                    type="button"
                    onClick={() => {
                      resetNavShortcuts();
                      showToast(
                        language === 'zh-TW' ? '底部導航已恢復預設' : '底部导航已恢复默认',
                        'info'
                      );
                    }}
                    className="text-[11px] text-ios-blue hover:underline font-medium"
                  >
                    {language === 'zh-TW' ? '恢復默認' : '恢复默认'}
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {NAV_PRESETS.map((preset) => {
                    const isSelected =
                      navShortcuts.length === 4 &&
                      preset.tools.every((tid, idx) => navShortcuts[idx] === tid);

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setAllNavShortcuts(preset.tools);
                          showToast(
                            language === 'zh-TW'
                              ? `已套用【${preset.nameTw}】組合`
                              : `已套用【${preset.name}】组合`,
                            'success'
                          );
                        }}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-medium border transition apple-touch ${
                          isSelected
                            ? 'bg-ios-blue text-white border-ios-blue font-bold shadow-xs ring-1.5 ring-ios-blue/30 scale-[1.01]'
                            : 'bg-slate-50 dark:bg-white/[0.04] border-black/[0.05] dark:border-white/[0.06] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08]'
                        }`}
                      >
                        {preset.id === 'default' && <Sparkles className="w-3.5 h-3.5 shrink-0" />}
                        {preset.id === 'racing' && <Zap className="w-3.5 h-3.5 shrink-0" />}
                        {preset.id === 'touring' && <MapPin className="w-3.5 h-3.5 shrink-0" />}
                        {preset.id === 'mechanic' && <Wrench className="w-3.5 h-3.5 shrink-0" />}
                        <span className="truncate">{language === 'zh-TW' ? preset.nameTw : preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slots Preview */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {language === 'zh-TW' ? '導航欄即時佈局 · 點擊快捷位自選替換' : '导航栏即时布局 · 点击快捷位自选替换'}
                </div>

                <div className="grid grid-cols-5 gap-1 sm:gap-1.5 p-2 rounded-2xl bg-slate-100/80 dark:bg-[#121214] border border-black/[0.04] dark:border-white/[0.06]">
                  {/* Home Slot (Locked) */}
                  <div className="flex flex-col items-center justify-center py-2 px-1 rounded-xl bg-white/70 dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.06] opacity-75 select-none">
                    <div className="p-1 rounded-lg text-slate-500 dark:text-slate-400 relative">
                      <Home className="w-4 h-4" />
                      <Lock className="w-2.5 h-2.5 text-slate-500 dark:text-slate-400 absolute -bottom-0.5 -right-0.5" />
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 select-none">
                      {language === 'zh-TW' ? '首頁' : '首页'}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {language === 'zh-TW' ? '固定' : '固定'}
                    </span>
                  </div>

                  {/* 4 Customizable Slots */}
                  {navShortcuts.map((toolId, slotIdx) => {
                    const tool = getNavToolById(toolId);
                    const IconComponent = tool?.icon || Activity;
                    const isEditing = editingSlot === slotIdx;

                    const colorClass =
                      tool?.categoryColor === 'ios-purple'
                        ? 'text-ios-purple'
                        : tool?.categoryColor === 'ios-mint'
                        ? 'text-ios-mint'
                        : 'text-ios-blue';

                    return (
                      <button
                        key={slotIdx}
                        type="button"
                        onClick={() => setEditingSlot(slotIdx)}
                        className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition apple-touch relative ${
                          isEditing
                            ? 'bg-ios-blue text-white shadow-xs'
                            : 'bg-white dark:bg-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.12] border border-black/[0.05] dark:border-white/[0.08] text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <div className={`p-1 rounded-lg ${isEditing ? 'text-white' : colorClass}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <span
                          className={`text-[11px] font-semibold mt-1 truncate max-w-full select-none ${
                            isEditing ? 'text-white' : ''
                          }`}
                        >
                          {tool
                            ? language === 'zh-TW'
                              ? tool.shortTitleTw
                              : tool.shortTitle
                            : '未配置'}
                        </span>
                        <span
                          className={`text-[11px] font-mono mt-0.5 ${
                            isEditing ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {language === 'zh-TW' ? `位 ${slotIdx + 1}` : `槽 ${slotIdx + 1}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sync Info Banner (iOS Notice Callout) */}
        <div className="p-3 rounded-2xl bg-ios-blue/10 dark:bg-ios-blue/15 border border-ios-blue/20 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
          <ShieldCheck className="w-4 h-4 text-ios-blue dark:text-ios-blue-dark shrink-0 mt-0.5" />
          <span className="leading-relaxed text-[11px]">
            {language === 'zh-TW'
              ? '設定持久化於本地。全站 20 款工具（功率、胎壓、Fitting、爬坡分段、山地避震、數據羅盤等）均已主動監聽並即時響應聯動。'
              : '设置持久化于本地。全站 20 款工具（功率、胎压、Fitting、爬坡分段、山地避震、数据罗盘等）均已主动监听并即时响应联动。'}
          </span>
        </div>

        {/* Action Buttons: Reset and Done */}
        <div className="pt-2 flex items-center justify-between gap-3 border-t border-black/[0.05] dark:border-white/[0.08]">
          <button
            onClick={handleReset}
            className="apple-touch h-9 px-3.5 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{language === 'zh-TW' ? '恢復標準預設' : '恢复标准默认'}</span>
          </button>

          <button
            onClick={onClose}
            className="apple-touch h-9 px-5 rounded-xl text-xs font-semibold bg-ios-blue hover:bg-ios-blue/90 active:scale-95 text-white transition shadow-ios-sm flex items-center gap-1.5"
          >
            <span>{language === 'zh-TW' ? '完成並儲存' : '完成并保存'}</span>
          </button>
        </div>

        {/* Slot Tool Picker Modal */}
        {editingSlot !== null && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 dark:bg-black/75 backdrop-blur-2xl animate-in fade-in duration-200">
            <div className="relative w-full max-w-md max-h-[85vh] flex flex-col bg-white dark:bg-[#1C1C1E] rounded-t-[28px] sm:rounded-2xl border-t sm:border border-black/[0.06] dark:border-white/[0.08] shadow-ios-popover overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0">
              {/* iOS Presentation Detent Drag Indicator (Mobile only) */}
              <div className="sm:hidden w-10 h-1.5 rounded-full bg-black/15 dark:bg-white/20 mx-auto mt-2 mb-1 shrink-0" />

              {/* Header */}
              <div className="p-4 border-b border-black/[0.05] dark:border-white/[0.08] flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {language === 'zh-TW'
                      ? `選擇槽位 ${editingSlot + 1} 的快捷工具`
                      : `选择快捷位 ${editingSlot + 1} 的工具`}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {language === 'zh-TW'
                      ? '同一個工具不可在底部導航重複出現'
                      : '同一个工具不可在底部导航重复出现'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingSlot(null)}
                  className="w-7 h-7 rounded-full bg-slate-100 dark:bg-[#2C2C2E] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Tools List by Category */}
              <div className="overflow-y-auto p-3 sm:p-4 space-y-4 flex-1">
                {(['dynamics', 'fitting', 'route', 'health'] as const).map((cat) => {
                  const catTools = ALL_NAV_TOOLS.filter((t) => t.category === cat);
                  if (!catTools.length) return null;

                  const catLabel =
                    language === 'zh-TW'
                      ? catTools[0].categoryLabelTw
                      : catTools[0].categoryLabel;

                  return (
                    <div key={cat} className="space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
                        {catLabel}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {catTools.map((tool) => {
                          const IconComp = tool.icon;
                          const isCurrent = navShortcuts[editingSlot] === tool.id;
                          const isUsedInOtherSlot =
                            navShortcuts.includes(tool.id) && !isCurrent;

                          return (
                            <button
                              key={tool.id}
                              type="button"
                              disabled={isUsedInOtherSlot}
                              onClick={() => {
                                if (isUsedInOtherSlot) return;
                                const success = setNavShortcut(editingSlot, tool.id);
                                if (success) {
                                  showToast(
                                    language === 'zh-TW'
                                      ? `快捷位 ${editingSlot + 1} 已設為【${tool.shortTitleTw}】`
                                      : `快捷位 ${editingSlot + 1} 已设为【${tool.shortTitle}】`,
                                    'success'
                                  );
                                  setEditingSlot(null);
                                }
                              }}
                              className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition apple-touch ${
                                isCurrent
                                  ? 'bg-ios-blue/15 border-ios-blue text-ios-blue dark:text-white dark:bg-ios-blue/30 font-bold ring-2 ring-ios-blue/30 shadow-xs'
                                  : isUsedInOtherSlot
                                  ? 'bg-slate-100/50 dark:bg-white/[0.02] border-transparent opacity-40 cursor-not-allowed'
                                  : 'bg-slate-50 dark:bg-white/[0.04] border-black/[0.04] dark:border-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                    isCurrent
                                      ? 'bg-ios-blue text-white'
                                      : isUsedInOtherSlot
                                      ? 'bg-slate-200 dark:bg-white/10 text-slate-400'
                                      : 'bg-white dark:bg-white/10 text-slate-700 dark:text-slate-300 shadow-2xs'
                                  }`}
                                >
                                  <IconComp className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold truncate">
                                    {language === 'zh-TW' ? tool.titleTw : tool.title}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                    {language === 'zh-TW'
                                      ? `標籤: ${tool.shortTitleTw}`
                                      : `标签: ${tool.shortTitle}`}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
