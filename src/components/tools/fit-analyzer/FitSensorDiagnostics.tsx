import React from 'react';
import { Cpu, Heart, Layers, Zap, RotateCcw, Info } from 'lucide-react';
import { ActivityAnalysis } from '../../../utils/activityParser';

interface FitSensorDiagnosticsProps {
  sensorDiagnostics: NonNullable<ActivityAnalysis['sensorDiagnostics']>;
  isEstimatedPower?: boolean;
  avgHeartRate?: number;
  avgPower: number;
  normalizedPower: number;
  avgCadence?: number;
  shiftCount?: number;
  language: string;
  onToggleEstimatedPower: () => void;
}

export const FitSensorDiagnostics: React.FC<FitSensorDiagnosticsProps> = React.memo(({
  sensorDiagnostics,
  isEstimatedPower,
  avgHeartRate,
  avgPower,
  normalizedPower,
  avgCadence,
  shiftCount,
  language,
  onToggleEstimatedPower
}) => {
  return (
    <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-ios-blue/10 text-ios-blue flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{language === 'zh-TW' ? '碼表傳感器接入與數據流診斷' : '码表传感器接入与数据流诊断'}</span>
              {isEstimatedPower && (
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-ios-amber/15 text-ios-amber border border-ios-amber/30">
                  {language === 'zh-TW' ? '⚡ 物理動力學仿真估算中' : '⚡ 物理动力学仿真估算中'}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {language === 'zh-TW'
                ? '深度解析 FIT 底層硬件通道配對與秒級採樣信號流'
                : '深度解析 FIT 底层硬件通道配对与秒级采样信号流'}
            </div>
          </div>
        </div>

        {/* Power Reconstruction Action Button when hardware power is absent */}
        {!sensorDiagnostics.hasHardwarePower && (
          <button
            onClick={onToggleEstimatedPower}
            className={`apple-touch h-9 px-3.5 rounded-xl font-semibold text-xs transition flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-ios-sm ${
              isEstimatedPower
                ? 'bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10'
                : 'bg-ios-blue hover:bg-ios-blue/90 text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>
              {isEstimatedPower
                ? (language === 'zh-TW' ? '切換回硬件原始無功率數據' : '切换回硬件原始无功率数据')
                : (language === 'zh-TW' ? '開啟物理動力學仿真估算功率' : '开启物理动力学仿真估算功率')}
            </span>
          </button>
        )}
      </div>

      {/* 4-Channel Status Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Heart Rate Channel */}
        <div className={`p-2.5 sm:p-3 rounded-xl border flex flex-col justify-between ${
          sensorDiagnostics.hasHeartRate
            ? 'bg-ios-green/5 border-ios-green/20'
            : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200/60 dark:border-white/10'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-ios-red" />
              {language === 'zh-TW' ? '心率通道' : '心率通道'}
            </span>
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
              sensorDiagnostics.hasHeartRate
                ? 'bg-ios-green/15 text-ios-green'
                : 'bg-slate-200 dark:bg-white/10 text-slate-500'
            }`}>
              {sensorDiagnostics.hasHeartRate ? (language === 'zh-TW' ? '已記錄' : '已记录') : (language === 'zh-TW' ? '無信號' : '无信号')}
            </span>
          </div>
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
            {avgHeartRate ? `${avgHeartRate} bpm` : (language === 'zh-TW' ? '未連接心率帶' : '未连接心率带')}
          </div>
        </div>

        {/* Shifting Channel */}
        <div className={`p-2.5 sm:p-3 rounded-xl border flex flex-col justify-between ${
          sensorDiagnostics.hasShifting
            ? 'bg-ios-purple/5 border-ios-purple/20'
            : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200/60 dark:border-white/10'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-ios-purple" />
              {language === 'zh-TW' ? '電子變速' : '电子变速'}
            </span>
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
              sensorDiagnostics.hasShifting
                ? 'bg-ios-purple/15 text-ios-purple'
                : 'bg-slate-200 dark:bg-white/10 text-slate-500'
            }`}>
              {sensorDiagnostics.hasShifting ? (language === 'zh-TW' ? '已連接' : '已连接') : (language === 'zh-TW' ? '未連接' : '未连接')}
            </span>
          </div>
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
            {shiftCount ? `${shiftCount} ${language === 'zh-TW' ? '次換擋' : '次换挡'}` : (language === 'zh-TW' ? '無變速數據' : '无变速数据')}
          </div>
        </div>

        {/* Power Channel */}
        <div className={`p-2.5 sm:p-3 rounded-xl border flex flex-col justify-between ${
          sensorDiagnostics.hasHardwarePower
            ? 'bg-ios-blue/5 border-ios-blue/20'
            : isEstimatedPower
            ? 'bg-ios-amber/5 border-ios-amber/20'
            : 'bg-ios-orange/5 border-ios-orange/20'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-ios-blue" />
              {language === 'zh-TW' ? '功率計通道' : '功率计通道'}
            </span>
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
              sensorDiagnostics.hasHardwarePower
                ? 'bg-ios-green/15 text-ios-green'
                : isEstimatedPower
                ? 'bg-ios-amber/15 text-ios-amber'
                : 'bg-ios-orange/15 text-ios-orange'
            }`}>
              {sensorDiagnostics.hasHardwarePower
                ? (language === 'zh-TW' ? '硬件採集' : '硬件采集')
                : isEstimatedPower
                ? (language === 'zh-TW' ? '物理估算' : '物理估算')
                : (language === 'zh-TW' ? '無硬件數據' : '无硬件数据')}
            </span>
          </div>
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
            {sensorDiagnostics.hasHardwarePower
              ? `${avgPower}W · NP ${normalizedPower}W`
              : isEstimatedPower
              ? `${avgPower}W · 估算 NP ${normalizedPower}W`
              : (language === 'zh-TW' ? '硬件功率計離線' : '硬件功率计离线')}
          </div>
        </div>

        {/* Cadence Channel */}
        <div className={`p-2.5 sm:p-3 rounded-xl border flex flex-col justify-between ${
          sensorDiagnostics.hasHardwareCadence
            ? 'bg-ios-green/5 border-ios-green/20'
            : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200/60 dark:border-white/10'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <RotateCcw className="w-3.5 h-3.5 text-ios-orange" />
              {language === 'zh-TW' ? '踏頻傳感器' : '踏频传感器'}
            </span>
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
              sensorDiagnostics.hasHardwareCadence
                ? 'bg-ios-green/15 text-ios-green'
                : 'bg-slate-200 dark:bg-white/10 text-slate-500'
            }`}>
              {sensorDiagnostics.hasHardwareCadence
                ? (language === 'zh-TW' ? '已記錄' : '已记录')
                : (language === 'zh-TW' ? '無硬件數據' : '无硬件数据')}
            </span>
          </div>
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
            {avgCadence ? `${avgCadence} rpm` : (language === 'zh-TW' ? '踏頻計離線' : '踏频计离线')}
          </div>
        </div>
      </div>

      {/* Detailed Diagnostic Notes */}
      {sensorDiagnostics.detectedNotes.length > 0 && (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/10 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
          {sensorDiagnostics.detectedNotes.map((note, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-ios-blue shrink-0 mt-0.5" />
              <span>{note}</span>
            </div>
          ))}
          {!sensorDiagnostics.hasHardwarePower && !isEstimatedPower && (
            <div className="pt-1 text-[11px] text-ios-blue font-medium flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-ios-amber" />
              <span>
                {language === 'zh-TW'
                  ? '提示：您可以點擊右上角「開啟物理動力學仿真估算功率」按鈕，基於速度、坡度與質量模型還原騎行做功、NP 與 TSS。'
                  : '提示：您可以点击右上角「开启物理动力学仿真估算功率」按钮，基于速度、坡度与质量模型还原骑行做功、NP 与 TSS。'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

FitSensorDiagnostics.displayName = 'FitSensorDiagnostics';
