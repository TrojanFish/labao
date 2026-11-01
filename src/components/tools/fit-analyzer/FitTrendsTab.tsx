import React from 'react';
import { Zap, Heart, Mountain, Gauge, RotateCcw } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { ActivityPoint } from '../../../utils/activityParser';
import { triggerHaptic } from '../../../utils/haptics';
import type { ChartData, ChartOptions } from 'chart.js';

interface FitTrendsTabProps {
  language: string;
  currentScrubbedPoint: ActivityPoint | null;
  totalDurationSec: number;
  avgPower: number;
  avgHeartRate?: number;
  elevationGainM: number;
  avgSpeedKmh: number;
  avgCadence?: number;
  showPower: boolean;
  setShowPower: (v: boolean) => void;
  showHeartRate: boolean;
  setShowHeartRate: (v: boolean) => void;
  showElevation: boolean;
  setShowElevation: (v: boolean) => void;
  showSpeed: boolean;
  setShowSpeed: (v: boolean) => void;
  showCadence: boolean;
  setShowCadence: (v: boolean) => void;
  onSetPresetChannels: (preset: 'physiology' | 'transmission' | 'all') => void;
  isPhysiologyPreset: boolean;
  isTransmissionPreset: boolean;
  isAllPreset: boolean;
  trendChartData: ChartData<'line'>;
  trendChartOptions: ChartOptions<'line'>;
  setHoveredPointIndex: (idx: number | null) => void;
  formatDuration: (sec: number) => string;
}

export const FitTrendsTab: React.FC<FitTrendsTabProps> = React.memo(({
  language,
  currentScrubbedPoint,
  totalDurationSec,
  avgPower,
  avgHeartRate,
  elevationGainM,
  avgSpeedKmh,
  avgCadence,
  showPower,
  setShowPower,
  showHeartRate,
  setShowHeartRate,
  showElevation,
  setShowElevation,
  showSpeed,
  setShowSpeed,
  showCadence,
  setShowCadence,
  onSetPresetChannels,
  isPhysiologyPreset,
  isTransmissionPreset,
  isAllPreset,
  trendChartData,
  trendChartOptions,
  setHoveredPointIndex,
  formatDuration
}) => {
  return (
    <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-3.5 select-none">
      {/* Header Bar with Scrubbed Time & Presets */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-black/[0.05] dark:border-white/[0.06] pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-2 h-2 rounded-full bg-ios-blue animate-pulse shrink-0" />
          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
            {language === 'zh-TW' ? '多軌時序遙測曲線' : '多轨时序遥测曲线'}
          </span>
          {currentScrubbedPoint ? (
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-ios-blue/15 text-ios-blue border border-ios-blue/30 tabular-nums">
              ⏱️ {formatDuration(currentScrubbedPoint.time)}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 font-mono tabular-nums">
              0:00 ~ {formatDuration(totalDurationSec)}
            </span>
          )}
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            {language === 'zh-TW' ? '推薦組合:' : '推荐组合:'}
          </span>
          <button
            type="button"
            onClick={() => onSetPresetChannels('physiology')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold apple-touch transition ${
              isPhysiologyPreset
                ? 'bg-ios-blue text-white shadow-ios-sm'
                : 'bg-black/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-black/[0.08]'
            }`}
          >
            {language === 'zh-TW' ? '生理動力' : '生理动力'}
          </button>
          <button
            type="button"
            onClick={() => onSetPresetChannels('transmission')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold apple-touch transition ${
              isTransmissionPreset
                ? 'bg-ios-blue text-white shadow-ios-sm'
                : 'bg-black/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-black/[0.08]'
            }`}
          >
            {language === 'zh-TW' ? '巡航表現' : '巡航表现'}
          </button>
          <button
            type="button"
            onClick={() => onSetPresetChannels('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold apple-touch transition ${
              isAllPreset
                ? 'bg-ios-blue text-white shadow-ios-sm'
                : 'bg-black/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-black/[0.08]'
            }`}
          >
            {language === 'zh-TW' ? '全開' : '全开'}
          </button>
        </div>
      </div>

      {/* 5-Channel Unified HUD & Toggle Controls */}
      <div className="grid grid-cols-5 gap-1 sm:gap-2 text-xs">
        {/* 1. Power */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            setShowPower(!showPower);
          }}
          className={`apple-touch transition-all duration-150 rounded-xl px-1 sm:px-3 py-1.5 sm:py-2 flex flex-col items-center justify-center min-w-0 ${
            showPower
              ? 'bg-cyan-500 text-white shadow-ios-sm ring-1 ring-cyan-400/40'
              : 'bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-slate-500 opacity-60 hover:opacity-80'
          }`}
          title={language === 'zh-TW' ? '功率通道開關' : '功率通道开关'}
        >
          <div className="flex items-center gap-1 text-[11px] font-semibold leading-none truncate max-w-full">
            <Zap className="w-3 h-3 shrink-0" />
            <span className="truncate">{language === 'zh-TW' ? '功率' : '功率'}</span>
          </div>
          <div className="text-[10px] sm:text-xs font-bold tabular-nums mt-1 leading-tight truncate max-w-full">
            {currentScrubbedPoint ? (
              currentScrubbedPoint.power !== undefined ? `${currentScrubbedPoint.power}W` : '--'
            ) : (
              <>
                <span>{avgPower}W</span>
                <span className="text-[9px] opacity-75 ml-0.5 hidden sm:inline">均</span>
              </>
            )}
          </div>
        </button>

        {/* 2. Heart Rate */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            setShowHeartRate(!showHeartRate);
          }}
          className={`apple-touch transition-all duration-150 rounded-xl px-1 sm:px-3 py-1.5 sm:py-2 flex flex-col items-center justify-center min-w-0 ${
            showHeartRate
              ? 'bg-rose-500 text-white shadow-ios-sm ring-1 ring-rose-400/40'
              : 'bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-slate-500 opacity-60 hover:opacity-80'
          }`}
          title={language === 'zh-TW' ? '心率通道開關' : '心率通道开关'}
        >
          <div className="flex items-center gap-1 text-[11px] font-semibold leading-none truncate max-w-full">
            <Heart className="w-3 h-3 shrink-0" />
            <span className="truncate">{language === 'zh-TW' ? '心率' : '心率'}</span>
          </div>
          <div className="text-[10px] sm:text-xs font-bold tabular-nums mt-1 leading-tight truncate max-w-full">
            {currentScrubbedPoint ? (
              currentScrubbedPoint.heartRate ? `${currentScrubbedPoint.heartRate}` : '--'
            ) : (
              <>
                <span>{avgHeartRate ?? '--'}</span>
                <span className="text-[9px] opacity-75 ml-0.5 hidden sm:inline">均</span>
              </>
            )}
          </div>
        </button>

        {/* 3. Elevation */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            setShowElevation(!showElevation);
          }}
          className={`apple-touch transition-all duration-150 rounded-xl px-1 sm:px-3 py-1.5 sm:py-2 flex flex-col items-center justify-center min-w-0 ${
            showElevation
              ? 'bg-emerald-500 text-white shadow-ios-sm ring-1 ring-emerald-400/40'
              : 'bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-slate-500 opacity-60 hover:opacity-80'
          }`}
          title={language === 'zh-TW' ? '海拔通道開關' : '海拔通道开关'}
        >
          <div className="flex items-center gap-1 text-[11px] font-semibold leading-none truncate max-w-full">
            <Mountain className="w-3 h-3 shrink-0" />
            <span className="truncate">{language === 'zh-TW' ? '海拔' : '海拔'}</span>
          </div>
          <div className="text-[10px] sm:text-xs font-bold tabular-nums mt-1 leading-tight truncate max-w-full">
            {currentScrubbedPoint ? (
              currentScrubbedPoint.altitude !== undefined ? `${Math.round(currentScrubbedPoint.altitude)}m` : '--'
            ) : (
              <span>+{elevationGainM}m</span>
            )}
          </div>
        </button>

        {/* 4. Speed */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            setShowSpeed(!showSpeed);
          }}
          className={`apple-touch transition-all duration-150 rounded-xl px-1 sm:px-3 py-1.5 sm:py-2 flex flex-col items-center justify-center min-w-0 ${
            showSpeed
              ? 'bg-blue-500 text-white shadow-ios-sm ring-1 ring-blue-400/40'
              : 'bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-slate-500 opacity-60 hover:opacity-80'
          }`}
          title={language === 'zh-TW' ? '速度通道開關' : '速度通道开关'}
        >
          <div className="flex items-center gap-1 text-[11px] font-semibold leading-none truncate max-w-full">
            <Gauge className="w-3 h-3 shrink-0" />
            <span className="truncate">{language === 'zh-TW' ? '速度' : '速度'}</span>
          </div>
          <div className="text-[10px] sm:text-xs font-bold tabular-nums mt-1 leading-tight truncate max-w-full">
            {currentScrubbedPoint ? (
              currentScrubbedPoint.speed !== undefined ? `${currentScrubbedPoint.speed.toFixed(1)}` : '--'
            ) : (
              <>
                <span>{avgSpeedKmh}</span>
                <span className="text-[9px] opacity-75 ml-0.5 hidden sm:inline">均</span>
              </>
            )}
          </div>
        </button>

        {/* 5. Cadence */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('selection');
            setShowCadence(!showCadence);
          }}
          className={`apple-touch transition-all duration-150 rounded-xl px-1 sm:px-3 py-1.5 sm:py-2 flex flex-col items-center justify-center min-w-0 ${
            showCadence
              ? 'bg-amber-500 text-white shadow-ios-sm ring-1 ring-amber-400/40'
              : 'bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-slate-500 opacity-60 hover:opacity-80'
          }`}
          title={language === 'zh-TW' ? '踏頻通道開關' : '踏频通道开关'}
        >
          <div className="flex items-center gap-1 text-[11px] font-semibold leading-none truncate max-w-full">
            <RotateCcw className="w-3 h-3 shrink-0" />
            <span className="truncate">{language === 'zh-TW' ? '踏頻' : '踏频'}</span>
          </div>
          <div className="text-[10px] sm:text-xs font-bold tabular-nums mt-1 leading-tight truncate max-w-full">
            {currentScrubbedPoint ? (
              currentScrubbedPoint.cadence !== undefined ? `${currentScrubbedPoint.cadence}` : '--'
            ) : (
              <>
                <span>{avgCadence ?? '--'}</span>
                <span className="text-[9px] opacity-75 ml-0.5 hidden sm:inline">均</span>
              </>
            )}
          </div>
        </button>
      </div>

      {/* Chart Canvas with Scrubbing Touch Handlers */}
      <div
        className="h-72 sm:h-96 w-full touch-none select-none relative"
        onMouseLeave={() => setHoveredPointIndex(null)}
        onTouchEnd={() => setHoveredPointIndex(null)}
      >
        <Line data={trendChartData} options={trendChartOptions} />
      </div>
    </div>
  );
});

FitTrendsTab.displayName = 'FitTrendsTab';
