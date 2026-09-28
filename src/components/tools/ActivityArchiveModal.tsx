import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  FolderArchive,
  Search,
  Calendar,
  Zap,
  Timer,
  Mountain,
  Flame,
  Trash2,
  Download,
  Upload,
  Sparkles,
  ArrowRight,
  X,
  CheckCircle2,
  Cloud,
  Loader2,
  Activity
} from 'lucide-react';
import {
  LocalActivityRecord,
  deleteLocalActivity,
  clearAllLocalActivities,
  exportActivitiesBackup,
  importActivitiesBackup,
  seedDemoSeasonActivities,
  saveActivityToDb
} from '../../utils/localActivityDb';
import {
  getAllActivitiesFromDb,
  getStreamFromDb,
  saveStreamToDb,
  seedDemoStravaActivitiesToDb,
  StravaActivityRecord
} from '../../utils/indexedDb';
import {
  convertStravaToLocalRecord,
  generateSimulatedStravaStream
} from '../../utils/stravaStreamAdapter';
import { IOSSegmentedControl } from '../common/IOSSegmentedControl';
import { useToast } from '../../context/ToastContext';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';

interface ActivityArchiveModalProps {
  isOpen: boolean;
  activities: LocalActivityRecord[];
  activeActivityId?: string;
  ftpWatts: number;
  weightKg: number;
  maxHr: number;
  onClose: () => void;
  onLoadActivity: (activity: LocalActivityRecord) => void;
  onRefreshList: () => Promise<void>;
}

export const ActivityArchiveModal: React.FC<ActivityArchiveModalProps> = ({
  isOpen,
  activities,
  activeActivityId,
  ftpWatts,
  weightKg,
  maxHr,
  onClose,
  onLoadActivity,
  onRefreshList
}) => {
  const { showToast } = useToast();
  const { language, unitSystem } = useLanguageAndUnit();
  const isImperial = unitSystem === 'imperial';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'local' | 'strava'>('local');
  const [stravaActivities, setStravaActivities] = useState<StravaActivityRecord[]>([]);
  const [loadingStravaId, setLoadingStravaId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'tss_desc' | 'dist_desc' | 'np_desc'>('date_desc');
  const [filterType, setFilterType] = useState<string>('all');
  const [isSeeding, setIsSeeding] = useState(false);

  // Load cached Strava activities from solorider_strava_db when modal opens
  useEffect(() => {
    if (isOpen) {
      getAllActivitiesFromDb()
        .then(list => setStravaActivities(list || []))
        .catch(() => setStravaActivities([]));
    }
  }, [isOpen]);

  // Filter & Sort Local Activities
  const filteredActivities = useMemo(() => {
    let result = activities.filter(act => {
      if (filterType !== 'all' && act.fileType !== filterType) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        act.name.toLowerCase().includes(q) ||
        (act.fileName && act.fileName.toLowerCase().includes(q))
      );
    });

    result = [...result].sort((a, b) => {
      if (sortBy === 'date_desc') return b.startTime - a.startTime;
      if (sortBy === 'date_asc') return a.startTime - b.startTime;
      if (sortBy === 'tss_desc') return b.tss - a.tss;
      if (sortBy === 'dist_desc') return b.distanceKm - a.distanceKm;
      if (sortBy === 'np_desc') return b.normalizedPower - a.normalizedPower;
      return 0;
    });

    return result;
  }, [activities, searchQuery, sortBy, filterType]);

  // Filter & Sort Strava Activities
  const filteredStravaActivities = useMemo(() => {
    let result = stravaActivities.filter(act => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return act.name.toLowerCase().includes(q);
    });

    result = [...result].sort((a, b) => {
      const timeA = new Date(a.start_date).getTime();
      const timeB = new Date(b.start_date).getTime();
      if (sortBy === 'date_desc') return timeB - timeA;
      if (sortBy === 'date_asc') return timeA - timeB;
      if (sortBy === 'dist_desc') return b.distance - a.distance;
      if (sortBy === 'np_desc') return (b.weighted_average_watts || b.average_watts || 0) - (a.weighted_average_watts || a.average_watts || 0);
      return 0;
    });

    return result;
  }, [stravaActivities, searchQuery, sortBy]);

  const handleLoadStravaActivity = async (act: StravaActivityRecord) => {
    setLoadingStravaId(act.id);
    try {
      showToast(language === 'zh-TW' ? `正在從本地調取「${act.name}」秒級數據...` : `正在从本地调取「${act.name}」秒级数据...`, 'info');
      let stream = await getStreamFromDb(act.id);
      if (!stream || !stream.time || stream.time.length === 0) {
        stream = generateSimulatedStravaStream(act);
        await saveStreamToDb(stream).catch(() => {});
      }
      const { record, points } = convertStravaToLocalRecord(act, stream, ftpWatts, weightKg, maxHr);
      await saveActivityToDb(record, points);
      await onRefreshList();
      onLoadActivity(record);
      showToast(language === 'zh-TW' ? `已成功載入 Strava 騎行「${act.name}」！` : `已成功载入 Strava 骑行「${act.name}」！`, 'success');
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      showToast(`载入失败: ${message}`, 'error');
    } finally {
      setLoadingStravaId(null);
    }
  };

  const handleSeedDemoStrava = async () => {
    setIsSeeding(true);
    try {
      const seeded = await seedDemoStravaActivitiesToDb();
      setStravaActivities(seeded);
      showToast(language === 'zh-TW' ? `已成功寫入 ${seeded.length} 場 Strava 擬真拉練與秒級數據！` : `已成功写入 ${seeded.length} 场 Strava 拟真拉练与秒级数据！`, 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      showToast(`初始化仿真数据失败: ${message}`, 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    if (!window.confirm(`确定要删除「${name}」的记录与详细时序流吗？`)) return;

    try {
      await deleteLocalActivity(id);
      showToast(`已删除活动「${name}」`, 'info');
      await onRefreshList();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      showToast(`删除失败: ${message}`, 'error');
    }
  };

  const handleClearAll = async () => {
    if (activities.length === 0) return;
    if (!window.confirm(`确定要清空全部 ${activities.length} 场本地骑行记录吗？此操作无法撤销！`)) return;

    try {
      await clearAllLocalActivities();
      showToast('已清空本地活动数据库', 'info');
      await onRefreshList();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      showToast(`清空失败: ${message}`, 'error');
    }
  };

  const handleExportBackup = async () => {
    if (activities.length === 0) {
      showToast('当前没有可导出的活动记录', 'warning');
      return;
    }
    try {
      const json = await exportActivitiesBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `labao_activities_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`已导出 ${activities.length} 场活动备份文件！`, 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      showToast(`导出失败: ${message}`, 'error');
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const count = await importActivitiesBackup(text);
      showToast(`成功恢复 ${count} 场活动记录！`, 'success');
      await onRefreshList();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '格式无效';
      showToast(`恢复失败: ${message}`, 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSeedDemoSeason = async () => {
    setIsSeeding(true);
    try {
      const seeded = await seedDemoSeasonActivities(ftpWatts, weightKg, maxHr);
      showToast(`已成功写入 ${seeded.length} 场拟真赛季经典拉练数据！`, 'success');
      await onRefreshList();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      showToast(`初始化演示数据失败: ${message}`, 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full sm:max-w-3xl bg-white dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/10 rounded-t-[28px] sm:rounded-2xl shadow-ios-popover overflow-hidden flex flex-col max-h-[90vh] animate-spring-up"
        role="dialog"
        aria-modal="true"
      >
        {/* iOS Drag Handle on Mobile */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Modal Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-ios-blue/10 text-ios-blue flex items-center justify-center font-bold">
              <FolderArchive className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {language === 'zh-TW' ? '本地活動檔案庫' : '本地活动档案库'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-ios-blue/10 text-ios-blue border border-ios-blue/20 tabular-nums">
                  {activeTab === 'local' ? `${activities.length} 场骑行` : `${stravaActivities.length} 场同步`}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {language === 'zh-TW' ? '離線安全存儲 · 時序與 MMP 功率矩陣本地持久化' : '离线安全存储 · 时序与 MMP 功率矩阵本地持久化'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="apple-touch w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-500 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Source Switcher: Local Archives vs Strava Local Cache */}
        <div className="px-4 sm:px-5 pt-3 pb-2.5 bg-slate-50/50 dark:bg-white/5 border-b border-slate-100 dark:border-white/10">
          <IOSSegmentedControl
            options={[
              { id: 'local', label: language === 'zh-TW' ? `本地已載入檔案 (${activities.length})` : `本地已载入档案 (${activities.length})` },
              { id: 'strava', label: language === 'zh-TW' ? `Strava 本地同步庫 (${stravaActivities.length})` : `Strava 本地同步库 (${stravaActivities.length})` }
            ]}
            value={activeTab}
            onChange={(val) => setActiveTab(val as 'local' | 'strava')}
            size="sm"
            fullWidth
          />
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 space-y-2.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'local' ? '搜索活动名称或文件名...' : '搜索 Strava 骑行活动...'}
                className="h-9 w-full pl-9 pr-3 rounded-xl bg-white dark:bg-[#2C2C2E] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-ios-blue"
              />
            </div>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-9 bg-white dark:bg-[#2C2C2E] border border-slate-200 dark:border-white/10 rounded-xl px-3 text-xs text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:border-ios-blue"
            >
              <option value="date_desc">按时间 · 最新优先</option>
              <option value="date_asc">按时间 · 最早优先</option>
              {activeTab === 'local' && <option value="tss_desc">按 TSS 训练负荷</option>}
              <option value="dist_desc">按骑行总里程</option>
              <option value="np_desc">按 NP 标准化功率</option>
            </select>

            {/* Filter by Format (Local Tab only) */}
            {activeTab === 'local' && (
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-9 bg-white dark:bg-[#2C2C2E] border border-slate-200 dark:border-white/10 rounded-xl px-3 text-xs text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:border-ios-blue"
              >
                <option value="all">所有格式 ({activities.length})</option>
                <option value="fit">FIT 原生码表</option>
                <option value="gpx">GPX 轨迹</option>
                <option value="tcx">TCX 训练</option>
                <option value="strava">Strava 同步</option>
                <option value="demo">拟真示范数据</option>
              </select>
            )}
          </div>
        </div>

        {/* Activity List Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          {activeTab === 'local' ? (
            /* TAB 1: Local Loaded Activities */
            filteredActivities.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-400 flex items-center justify-center mx-auto">
                  <FolderArchive className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {searchQuery ? '未找到符合条件的活动记录' : '本地档案库暂无活动'}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {searchQuery
                      ? '请尝试更换搜索关键字或清除格式筛选条件。'
                      : '你可以拖拽或批量上传 .fit/.gpx/.tcx 码表文件，或切换至「Strava 本地同步库」直接选取骑行记录。'}
                  </p>
                </div>

                {!searchQuery && (
                  <button
                    type="button"
                    onClick={handleSeedDemoSeason}
                    disabled={isSeeding}
                    className="apple-touch h-9 px-4 rounded-xl bg-ios-blue text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-ios-sm hover:bg-ios-blue/90 transition"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{isSeeding ? '正在写入...' : '一键载入 15 场拟真赛季拉练数据'}</span>
                  </button>
                )}
              </div>
            ) : (
              filteredActivities.map((act) => {
                const isSelected = act.id === activeActivityId;
                const dateStr = new Date(act.startDate || act.startTime).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                });

                return (
                  <div
                    key={act.id}
                    onClick={() => onLoadActivity(act)}
                    className={`p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-ios-blue/10 border-ios-blue/30 shadow-ios-sm ring-1 ring-ios-blue/40'
                        : 'bg-white dark:bg-[#2C2C2E]/60 border-slate-200/80 dark:border-white/10 hover:border-ios-blue/30 hover:bg-slate-50/80 dark:hover:bg-[#2C2C2E]'
                    }`}
                  >
                    {/* Activity Meta */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {act.name}
                        </span>

                        {/* Format Tag */}
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase ${
                            act.fileType === 'fit'
                              ? 'bg-ios-blue/10 text-ios-blue border border-ios-blue/20'
                              : act.fileType === 'gpx'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : act.fileType === 'strava'
                              ? 'bg-[#FC4C02]/10 text-[#FC4C02] border border-[#FC4C02]/20'
                              : act.fileType === 'tcx'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-ios-purple/10 text-ios-purple border border-ios-purple/20'
                          }`}
                        >
                          {act.fileType}
                        </span>

                        {isSelected && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ios-blue">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>当前正在查看</span>
                          </span>
                        )}
                      </div>

                      {/* Primary Metrics Row */}
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap tabular-nums">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{dateStr}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Timer className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDuration(act.movingTimeSec || act.totalDurationSec)}</span>
                        </div>
                        <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                          <span>{isImperial ? `${(act.distanceKm * 0.621371).toFixed(1)} mi` : `${act.distanceKm} km`}</span>
                        </div>
                        {act.elevationGainM > 0 && (
                          <div className="flex items-center gap-1">
                            <Mountain className="w-3.5 h-3.5 text-ios-orange" />
                            <span>+{isImperial ? `${Math.round(act.elevationGainM * 3.28084)}ft` : `${act.elevationGainM}m`}</span>
                          </div>
                        )}
                        {act.normalizedPower > 0 && (
                          <div className="flex items-center gap-1 font-semibold text-ios-blue">
                            <Zap className="w-3.5 h-3.5" />
                            <span>{act.normalizedPower}W NP</span>
                          </div>
                        )}
                        {act.tss > 0 && (
                          <div className="flex items-center gap-1 text-ios-purple font-medium">
                            <Flame className="w-3.5 h-3.5" />
                            <span>{act.tss} TSS</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions on Desktop / Mobile */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, act.id, act.name)}
                        className="apple-touch w-8 h-8 rounded-xl text-slate-400 hover:text-ios-red hover:bg-ios-red/10 flex items-center justify-center transition"
                        title="删除该记录"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onLoadActivity(act)}
                        className={`apple-touch h-8 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                          isSelected
                            ? 'bg-ios-blue text-white shadow-ios-sm'
                            : 'bg-slate-100 hover:bg-ios-blue hover:text-white dark:bg-white/10 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <span>{isSelected ? '重载' : '载入'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            /* TAB 2: Strava Local Synchronized Activities */
            filteredStravaActivities.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mx-auto">
                  <Cloud className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {searchQuery ? '未找到符合条件的 Strava 骑行记录' : '本地暂未检测到 Strava 骑行记录'}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {searchQuery
                      ? '请尝试更换搜索关键字。'
                      : '可前往「Strava 数据罗盘」同步历史骑行，或一键载入本地拟真拉练数据进行跨工具联动测试！'}
                  </p>
                </div>
                {!searchQuery && (
                  <div className="pt-2 flex justify-center">
                    <button
                      type="button"
                      onClick={handleSeedDemoStrava}
                      disabled={isSeeding}
                      className="apple-touch h-9 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition inline-flex items-center gap-2 shadow-ios-sm disabled:opacity-50"
                    >
                      {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      <span>一键载入 Strava 仿真拉练数据</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              filteredStravaActivities.map((act) => {
                const distKm = (act.distance / 1000).toFixed(1);
                const eleM = Math.round(act.total_elevation_gain || 0);
                const durSec = act.moving_time || act.elapsed_time || 0;
                const dateStr = act.start_date.split('T')[0];
                const np = act.weighted_average_watts || act.average_watts || 0;
                const isLoadingThis = loadingStravaId === act.id;

                return (
                  <div
                    key={act.id}
                    onClick={() => !isLoadingThis && handleLoadStravaActivity(act)}
                    className="p-3 sm:p-3.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#2C2C2E]/60 hover:border-orange-500/40 hover:bg-orange-500/[0.02] transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {act.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#FC4C02]/10 text-[#FC4C02] border border-[#FC4C02]/20 flex items-center gap-1">
                          <Cloud className="w-2.5 h-2.5" />
                          <span>Strava</span>
                        </span>
                        {act.sport_type && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                            {act.sport_type}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap tabular-nums">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{dateStr}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Timer className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDuration(durSec)}</span>
                        </div>
                        <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                          <span>{isImperial ? `${(parseFloat(distKm) * 0.621371).toFixed(1)} mi` : `${distKm} km`}</span>
                        </div>
                        {eleM > 0 && (
                          <div className="flex items-center gap-1 text-ios-orange">
                            <Mountain className="w-3.5 h-3.5" />
                            <span>+{isImperial ? `${Math.round(eleM * 3.28084)}ft` : `${eleM}m`}</span>
                          </div>
                        )}
                        {np > 0 && (
                          <div className="flex items-center gap-1 font-semibold text-ios-blue">
                            <Zap className="w-3.5 h-3.5" />
                            <span>{np}W NP</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLoadStravaActivity(act);
                        }}
                        disabled={isLoadingThis}
                        className="apple-touch h-8 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition flex items-center gap-1 disabled:opacity-50 shadow-ios-sm shadow-orange-500/20"
                      >
                        {isLoadingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Activity className="w-3.5 h-3.5" />
                        )}
                        <span>{isLoadingThis ? '载入中...' : '载入分析'}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>

        {/* Modal Footer / Maintenance Hub */}
        <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-[#1C1C1E] flex flex-wrap items-center justify-between gap-2">
          {/* Left: Backup & Demo seed */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleExportBackup}
              className="apple-touch h-9 px-3 rounded-xl bg-white dark:bg-white/10 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出备份</span>
            </button>

            <label className="apple-touch h-9 px-3 rounded-xl bg-white dark:bg-white/10 border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 transition flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>恢复备份</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={handleSeedDemoSeason}
              disabled={isSeeding}
              className="apple-touch h-9 px-3 rounded-xl bg-white dark:bg-white/10 border border-slate-200/80 dark:border-white/10 text-ios-blue font-semibold hover:bg-ios-blue/5 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isSeeding ? '写入中...' : '载入拟真赛季(15场)'}</span>
            </button>
          </div>

          {/* Right: Clear All & Close */}
          <div className="flex items-center gap-2">
            {activeTab === 'local' && activities.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="apple-touch h-9 px-3 rounded-xl text-xs text-ios-red hover:bg-ios-red/10 font-semibold transition"
              >
                清空档案库
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="apple-touch h-9 px-4 rounded-xl bg-slate-200 dark:bg-white/20 text-slate-800 dark:text-white font-bold text-xs hover:bg-slate-300 dark:hover:bg-white/30 transition"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
