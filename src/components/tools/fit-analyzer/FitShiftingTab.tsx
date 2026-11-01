import React from 'react';
import { Layers } from 'lucide-react';
import { ElectronicShiftingEvent } from '../../../utils/activityParser';

interface FitShiftingTabProps {
  shiftingEvents: ElectronicShiftingEvent[];
  totalDistanceKm: number;
  movingTimeSec: number;
  language: string;
}

export const FitShiftingTab: React.FC<FitShiftingTabProps> = React.memo(({
  shiftingEvents,
  totalDistanceKm,
  movingTimeSec,
  language
}) => {
  return (
    <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="text-xs font-bold text-slate-850 dark:text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-ios-purple" />
          <span>{language === 'zh-TW' ? '電子變速換擋深度解析' : '电子变速换挡深度解析'}</span>
        </div>
        <div className="text-xs text-slate-500">
          {language === 'zh-TW' ? '全程累計換擋' : '全程累计换挡'}: <strong className="text-slate-900 dark:text-white tabular-nums">{shiftingEvents.length}</strong> {language === 'zh-TW' ? '次' : '次'}
        </div>
      </div>

      {/* Shifting Metric Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/10">
          <div className="text-[11px] text-slate-500">{language === 'zh-TW' ? '總換擋次數' : '总换挡次数'}</div>
          <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
            {shiftingEvents.length} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{language === 'zh-TW' ? '次' : '次'}</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {totalDistanceKm > 0 ? `${(shiftingEvents.length / (totalDistanceKm / 10)).toFixed(1)} 次 / 10km` : '--'}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/10">
          <div className="text-[11px] text-slate-500">{language === 'zh-TW' ? '前撥換檔' : '前拨换挡'}</div>
          <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
            {shiftingEvents.filter(e => e.frontGearNum !== undefined).length} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{language === 'zh-TW' ? '次' : '次'}</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {language === 'zh-TW' ? '牙盤切換' : '牙盘切换'}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/10">
          <div className="text-[11px] text-slate-500">{language === 'zh-TW' ? '後撥換擋' : '后拨换挡'}</div>
          <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
            {shiftingEvents.filter(e => e.rearGearNum !== undefined).length} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{language === 'zh-TW' ? '次' : '次'}</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {language === 'zh-TW' ? '飛輪微調' : '飞轮微调'}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/10">
          <div className="text-[11px] text-slate-500">{language === 'zh-TW' ? '換擋頻率' : '换挡频率'}</div>
          <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
            {movingTimeSec > 0 ? (shiftingEvents.length / (movingTimeSec / 3600)).toFixed(1) : '0'} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{language === 'zh-TW' ? '次/小時' : '次/小时'}</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {language === 'zh-TW' ? '平均節奏調頻' : '平均节奏调频'}
          </div>
        </div>
      </div>

      {/* Rear Gear Distribution Bar */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {language === 'zh-TW' ? '後撥檔位切換使用次數分佈 (Gear Index 1~12)' : '后拨档位切换使用次数分布 (Gear Index 1~12)'}
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
          {Array.from({ length: 12 }, (_, i) => i + 1).map(gNum => {
            const count = shiftingEvents.filter(e => e.rearGearNum === gNum).length;
            const maxCount = Math.max(1, ...Array.from({ length: 12 }, (_, j) => shiftingEvents.filter(e => e.rearGearNum === j + 1).length));
            const pct = Math.round((count / maxCount) * 100);
            return (
              <div key={gNum} className="p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/10 text-center flex flex-col justify-between">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">{gNum}档</span>
                <div className="h-10 w-full bg-slate-100 dark:bg-white/5 rounded-md flex items-end justify-center my-1 overflow-hidden">
                  <div
                    style={{ height: `${pct}%` }}
                    className={`w-full transition-all duration-300 ${count > 0 ? 'bg-ios-purple' : 'bg-transparent'}`}
                  />
                </div>
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 tabular-nums">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

FitShiftingTab.displayName = 'FitShiftingTab';
