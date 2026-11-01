import React from 'react';
import { Zap, Heart } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { PowerZoneDistribution, HrZoneDistribution } from '../../../utils/activityParser';
import type { ChartData } from 'chart.js';

interface FitZonesTabProps {
  timeInPowerZones: PowerZoneDistribution[];
  timeInHrZones: HrZoneDistribution[];
  powerZoneBarData: ChartData<'bar', number[], string>;
  hrZoneBarData: ChartData<'bar', number[], string>;
  ftpWatts: number;
  maxHr: number;
  formatDuration: (sec: number) => string;
}

export const FitZonesTab: React.FC<FitZonesTabProps> = React.memo(({
  timeInPowerZones,
  timeInHrZones,
  powerZoneBarData,
  hrZoneBarData,
  ftpWatts,
  maxHr,
  formatDuration
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
      {/* Coggan 7-Zone Power Distribution */}
      <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-ios-blue" />
            {'Coggan 功率 7 区分布'}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">FTP: {ftpWatts}W</span>
        </div>

        <div className="h-56">
          <Bar
            data={powerZoneBarData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: { ticks: { font: { size: 9 }, color: '#AEAEB2' } },
                y: { ticks: { font: { size: 10 }, color: '#8E8E93' } }
              }
            }}
          />
        </div>

        <div className="space-y-2">
          {timeInPowerZones.map((z) => (
            <div key={z.zone} className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: z.color }}></span>
                <strong className="text-slate-800 dark:text-white">{z.zone} {z.label}</strong>
                <span className="text-slate-400 text-[11px] tabular-nums">({z.range})</span>
              </div>
              <div className="font-mono flex items-center gap-3">
                <span className="text-slate-500 tabular-nums">{formatDuration(z.seconds)}</span>
                <span className="font-bold text-slate-900 dark:text-white min-w-[40px] text-right tabular-nums">{z.percent}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Heart Rate 5-Zone Distribution */}
      <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Heart className="w-4 h-4 text-ios-red" />
            {'心率 5 区分布'}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{'最大心率'}: {maxHr}bpm</span>
        </div>

        <div className="h-56">
          <Bar
            data={hrZoneBarData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                x: { ticks: { font: { size: 9 }, color: '#AEAEB2' } },
                y: { ticks: { font: { size: 10 }, color: '#8E8E93' } }
              }
            }}
          />
        </div>

        <div className="space-y-2">
          {timeInHrZones.map((z) => (
            <div key={z.zone} className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200/50 dark:border-white/5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: z.color }}></span>
                <strong className="text-slate-800 dark:text-white">{z.zone} {z.label}</strong>
                <span className="text-slate-400 text-[11px] tabular-nums">({z.range})</span>
              </div>
              <div className="font-mono flex items-center gap-3">
                <span className="text-slate-500 tabular-nums">{formatDuration(z.seconds)}</span>
                <span className="font-bold text-slate-900 dark:text-white min-w-[40px] text-right tabular-nums">{z.percent}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

FitZonesTab.displayName = 'FitZonesTab';
