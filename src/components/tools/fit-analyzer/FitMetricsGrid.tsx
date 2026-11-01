import React from 'react';
import {
  Zap,
  Flame,
  Award,
  TrendingUp,
  Timer,
  Mountain,
  Heart,
  Activity,
  Sliders,
  Gauge
} from 'lucide-react';
import { IOSMetricTile } from '../../common/IOSCard';
import { ActivityAnalysis } from '../../../utils/activityParser';

interface FitMetricsGridProps {
  analysis: ActivityAnalysis;
  weightKg: number;
  language: string;
  formatDuration: (sec: number) => string;
}

export const FitMetricsGrid: React.FC<FitMetricsGridProps> = React.memo(({
  analysis,
  weightKg,
  language,
  formatDuration
}) => {
  return (
    <div className="space-y-3 sm:space-y-3.5">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5">
        <IOSMetricTile
          label="NP"
          value={analysis.normalizedPower}
          unit="W"
          subtext={`标准化功率 · ${(analysis.normalizedPower / (weightKg || 68)).toFixed(2)} W/kg${analysis.isEstimatedPower ? ' · 物理估算' : ''}`}
          theme={analysis.isEstimatedPower ? 'amber' : 'blue'}
          icon={<Zap className={`w-4 h-4 ${analysis.isEstimatedPower ? 'text-ios-amber' : 'text-ios-blue'}`} />}
        />
        <IOSMetricTile
          label="强度系数"
          value={analysis.intensityFactor}
          subtext={`${Math.round(analysis.intensityFactor * 100)}% FTP负荷${analysis.isEstimatedPower ? ' · 估算' : ''}`}
          theme="amber"
          icon={<Flame className="w-4 h-4 text-ios-orange" />}
        />
        <IOSMetricTile
          label="训练压力"
          value={analysis.tss}
          subtext={analysis.tss < 150 ? '低度疲劳' : analysis.tss < 300 ? '中度疲劳' : '重度负荷'}
          theme="purple"
          icon={<Award className="w-4 h-4 text-ios-purple" />}
        />
        <IOSMetricTile
          label="变化指数"
          value={analysis.variabilityIndex}
          subtext={analysis.variabilityIndex <= 1.05 ? '平稳巡航' : analysis.variabilityIndex <= 1.15 ? '起伏路段' : '高频突围'}
          theme="blue"
          icon={<TrendingUp className="w-4 h-4 text-ios-blue" />}
        />
        <IOSMetricTile
          label="里程与净骑行"
          value={analysis.totalDistanceKm}
          unit="km"
          subtext={`${formatDuration(analysis.movingTimeSec)} (${analysis.avgSpeedKmh} km/h)`}
          theme="green"
          icon={<Timer className="w-4 h-4 text-ios-green" />}
        />
        <IOSMetricTile
          label="累计爬升与做功"
          value={`+${analysis.elevationGainM}`}
          unit="m"
          subtext={`${analysis.workKj} kJ (${analysis.caloriesKcal} kcal${analysis.workKj === 0 && analysis.recordedCalories ? ' · 码表测算' : ''})`}
          theme="mint"
          icon={<Mountain className="w-4 h-4 text-ios-mint" />}
        />
      </div>

      {/* Secondary Biological & Efficiency Strip */}
      <div className="ios-card px-4 py-2.5 rounded-xl border border-slate-200/80 dark:border-white/10 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4 text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-ios-red" />
            <span>{'平均心率'}: <strong className="text-slate-900 dark:text-white tabular-nums">{analysis.avgHeartRate ?? '--'} bpm</strong></span>
            <span className="text-slate-400 text-[11px]">({'最高'} <span className="tabular-nums">{analysis.maxHeartRate ?? '--'}</span>)</span>
          </span>

          <span className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-ios-orange" />
            <span>{'平均踏频'}: <strong className="text-slate-900 dark:text-white tabular-nums">{analysis.avgCadence ?? '--'} rpm</strong></span>
            <span className="text-slate-400 text-[11px]">
              ({'踩踏'} <span className="tabular-nums">{analysis.pedalingPercent ?? 100}%</span> · {'滑行'} <span className="tabular-nums">{100 - (analysis.pedalingPercent ?? 100)}%</span>)
            </span>
          </span>

          {analysis.leftRightBalance && (
            <span className="inline-flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-ios-teal" />
              <span>{language === 'zh-TW' ? '雙邊平衡' : '双边平衡'}: <strong className="text-slate-900 dark:text-white tabular-nums">{analysis.leftRightBalance.leftPercent}% L / {analysis.leftRightBalance.rightPercent}% R</strong></span>
              {Math.abs(analysis.leftRightBalance.leftPercent - 50) > 3 ? (
                <span className="text-ios-amber text-[11px] font-medium">({language === 'zh-TW' ? '偏重' : '偏重'} {analysis.leftRightBalance.leftPercent > 50 ? '左' : '右'})</span>
              ) : (
                <span className="text-ios-green text-[11px] font-medium">({language === 'zh-TW' ? '均衡' : '均衡'})</span>
              )}
            </span>
          )}

          {analysis.efficiencyFactor && (
            <span className="hidden sm:inline-flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-ios-blue" />
              <span>{'效率因子'}: <strong className="text-ios-blue tabular-nums">{analysis.efficiencyFactor} W/bpm</strong></span>
            </span>
          )}

          {analysis.aerobicDecoupling !== undefined && (
            <span className="hidden sm:inline-flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-ios-purple" />
              <span>{'有氧解耦率 (Pw:HR)'}: <strong className={`tabular-nums ${analysis.aerobicDecoupling > 5 ? 'text-ios-orange' : 'text-ios-green'}`}>{analysis.aerobicDecoupling}%</strong></span>
            </span>
          )}
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400">
          {'总历时'}: <span className="tabular-nums">{formatDuration(analysis.totalDurationSec)}</span> · <span className="tabular-nums">{analysis.points.length}</span> {'个秒级采样点'}
        </div>
      </div>
    </div>
  );
});

FitMetricsGrid.displayName = 'FitMetricsGrid';
