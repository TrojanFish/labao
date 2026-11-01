import React, { useState, useMemo, useEffect } from 'react';
import { Cog, Gauge, Info, Zap, AlertTriangle, ArrowUpDown, Layers, Share2, BarChart2, Bike, Check } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { Tooltip } from '../common/Tooltip';
import { NumberStepper } from '../common/NumberStepper';
import { IOSSegmentedControl } from '../common/IOSSegmentedControl';
import { IOSCard, IOSCardHeader, IOSMetricTile } from '../common/IOSCard';
import { IOSGarageSyncFooter } from '../common/IOSGarageSyncFooter';
import { IOSToolHeader } from '../common/IOSToolHeader';
import { ShareCardModal } from '../common/ShareCardModal';
import { generateGearSpeedPoster } from '../../utils/shareCardGenerators';
import { useToast } from '../../context/ToastContext';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';
import { useRiderProfile } from '../../context/RiderProfileContext';

export const GearSpeedCadenceCalculator: React.FC = () => {
  const { showToast } = useToast();
  const { activeBike, updateActiveBikeDrivetrain } = useRiderProfile();
  const { unitSystem, language } = useLanguageAndUnit();
  const isImperial = unitSystem === 'imperial';

  const [chainringType, setChainringType] = useState<'double' | 'single'>(
    activeBike?.drivetrain?.chainringType || 'double'
  );
  const [bigRing, setBigRing] = useState<number>(activeBike?.drivetrain?.bigRing || 50);
  const [smallRing, setSmallRing] = useState<number>(activeBike?.drivetrain?.smallRing || 34);
  const [cogsStr, setCogsStr] = useState<string>(
    activeBike?.drivetrain?.cassette?.join(', ') || '11, 12, 13, 14, 15, 17, 19, 21, 24, 27, 30, 34'
  );
  const [cadenceRpm, setCadenceRpm] = useState<number>(90);
  const [tireCircumferenceMm, setTireCircumferenceMm] = useState<number>(2136); // 700x28c
  const [activeTab, setActiveTab] = useState<'matrix' | 'cadence_table' | 'chart'>('matrix');

  // Share Poster State
  const [sharePosterUrl, setSharePosterUrl] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  // Sync with active bike from Virtual Garage
  useEffect(() => {
    if (activeBike?.drivetrain) {
      setChainringType(activeBike.drivetrain.chainringType);
      setBigRing(activeBike.drivetrain.bigRing);
      if (activeBike.drivetrain.smallRing) setSmallRing(activeBike.drivetrain.smallRing);
      if (activeBike.drivetrain.cassette && activeBike.drivetrain.cassette.length > 0) {
        setCogsStr(activeBike.drivetrain.cassette.join(', '));
      }
    }
  }, [activeBike]);

  // Tire circumference presets
  const TIRE_PRESETS = [
    { label: '700x23c (2096mm)', value: 2096 },
    { label: '700x25c (2105mm)', value: 2105 },
    { label: '700x28c (2136mm)', value: 2136 },
    { label: '700x30c (2146mm)', value: 2146 },
    { label: '700x32c (2155mm)', value: 2155 },
    { label: '700x38c Gravel (2180mm)', value: 2180 },
    { label: '700x40c Gravel (2200mm)', value: 2200 },
    { label: '29x2.2 MTB (2288mm)', value: 2288 },
  ];

  // Parse cogs
  const cogsList = useMemo(() => {
    const parsed = cogsStr
      .split(/[,，\s]+/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n > 0)
      .sort((a, b) => a - b);
    return parsed.length > 0 ? parsed : [11, 12, 13, 14, 15, 17, 19, 21, 24, 27, 30, 34];
  }, [cogsStr]);

  // Gear Step % differences
  const gearSteps = useMemo(() => {
    const steps: { cog: number; nextCog?: number; jumpPct?: number }[] = [];
    for (let i = 0; i < cogsList.length; i++) {
      const current = cogsList[i];
      const next = cogsList[i + 1];
      if (next) {
        const jump = parseFloat((((next - current) / current) * 100).toFixed(1));
        steps.push({ cog: current, nextCog: next, jumpPct: jump });
      } else {
        steps.push({ cog: current });
      }
    }
    return steps;
  }, [cogsList]);

  const [activeGruppo, setActiveGruppo] = useState<string>('compact');

  // Preset Gruppos
  const loadPresetGruppo = (key: string) => {
    setActiveGruppo(key);
    if (key === 'compact') {
      setChainringType('double');
      setBigRing(50);
      setSmallRing(34);
      setCogsStr('11, 12, 13, 14, 15, 17, 19, 21, 24, 27, 30, 34');
    } else if (key === 'semi_compact') {
      setChainringType('double');
      setBigRing(52);
      setSmallRing(36);
      setCogsStr('11, 12, 13, 14, 15, 16, 17, 19, 21, 24, 27, 30');
    } else if (key === 'pro_racing') {
      setChainringType('double');
      setBigRing(54);
      setSmallRing(40);
      setCogsStr('11, 12, 13, 14, 15, 16, 17, 19, 21, 24, 28, 30');
    } else if (key === 'sram_axs') {
      setChainringType('double');
      setBigRing(48);
      setSmallRing(35);
      setCogsStr('10, 11, 12, 13, 14, 15, 17, 19, 21, 24, 28, 33');
    } else if (key === 'gravel_1x') {
      setChainringType('single');
      setBigRing(40);
      setCogsStr('10, 11, 13, 15, 17, 19, 21, 24, 28, 32, 38, 44');
    }
  };

  // Speed matrix at current cadence
  const speedMatrix = useMemo(() => {
    const rings = chainringType === 'double' ? [bigRing, smallRing] : [bigRing];
    return rings.map(ring => {
      const row = cogsList.map((cog, index) => {
        const ratio = ring / cog;
        const speedKmh = (ratio * cadenceRpm * tireCircumferenceMm * 60) / 1000000;
        const devMeters = (ratio * tireCircumferenceMm) / 1000;
        const gearInches = ratio * (tireCircumferenceMm / (Math.PI * 25.4));

        const isBigBig = chainringType === 'double' && ring === bigRing && index >= cogsList.length - 2;
        const isSmallSmall = chainringType === 'double' && ring === smallRing && index <= 1;

        return {
          cog,
          ratio: parseFloat(ratio.toFixed(2)),
          speedKmh: parseFloat(speedKmh.toFixed(1)),
          devMeters: parseFloat(devMeters.toFixed(2)),
          gearInches: parseFloat(gearInches.toFixed(1)),
          isCrossChained: isBigBig || isSmallSmall,
          crossType: isBigBig ? '大盘对大飞' : isSmallSmall ? '小盘对小飞' : null
        };
      });
      return { ring, row };
    });
  }, [chainringType, bigRing, smallRing, cogsList, cadenceRpm, tireCircumferenceMm]);

  // Multi-cadence sweep table (70, 80, 90, 100, 110 RPM)
  const multiCadenceData = useMemo(() => {
    const cadences = [70, 80, 90, 100, 110];
    const ring = bigRing;
    return cogsList.map(cog => {
      const ratio = ring / cog;
      const speeds = cadences.map(cad => {
        const kmh = (ratio * cad * tireCircumferenceMm * 60) / 1000000;
        return parseFloat((isImperial ? kmh * 0.621371 : kmh).toFixed(1));
      });
      return { cog, ratio: ratio.toFixed(2), speeds };
    });
  }, [bigRing, cogsList, tireCircumferenceMm, isImperial]);

  // Chart data for Speed vs Cadence
  const chartData = useMemo(() => {
    const cadences = [60, 70, 80, 90, 100, 110, 120];
    const fastestCog = cogsList[0] || 11;
    const midCog = cogsList[Math.floor(cogsList.length / 2)] || 17;
    const climbingCog = cogsList[cogsList.length - 1] || 34;

    const calcSpeed = (ring: number, cog: number, cad: number) => {
      const kmh = (ring / cog * cad * tireCircumferenceMm * 60) / 1000000;
      return parseFloat((isImperial ? kmh * 0.621371 : kmh).toFixed(1));
    };

    return {
      labels: cadences.map(c => `${c} RPM`),
      datasets: [
        {
          label: `大盘高速档 (${bigRing}x${fastestCog}T)`,
          data: cadences.map(c => calcSpeed(bigRing, fastestCog, c)),
          borderColor: '#00AFFF',
          backgroundColor: 'rgba(0, 175, 255, 0.1)',
          tension: 0.3
        },
        {
          label: `中盘巡航档 (${bigRing}x${midCog}T)`,
          data: cadences.map(c => calcSpeed(bigRing, midCog, c)),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.3
        },
        {
          label: `爬坡极限档 (${chainringType === 'double' ? smallRing : bigRing}x${climbingCog}T)`,
          data: cadences.map(c => calcSpeed(chainringType === 'double' ? smallRing : bigRing, climbingCog, c)),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.3
        }
      ]
    };
  }, [bigRing, smallRing, chainringType, cogsList, tireCircumferenceMm, isImperial]);

  const unitStr = isImperial ? 'mph' : 'km/h';
  const maxKmh = speedMatrix[0]?.row[0]?.speedKmh || 0;
  const maxSpd = isImperial ? (maxKmh * 0.621371).toFixed(1) : maxKmh;
  const minKmh = speedMatrix[speedMatrix.length - 1]?.row[cogsList.length - 1]?.speedKmh || 0;
  const minSpd = isImperial ? (minKmh * 0.621371).toFixed(1) : minKmh;
  const maxRatio = (speedMatrix[0]?.row[0]?.ratio || 0).toFixed(2);
  const minRatio = (speedMatrix[speedMatrix.length - 1]?.row[cogsList.length - 1]?.ratio || 0).toFixed(2);

  const handleGeneratePoster = () => {
    const url = generateGearSpeedPoster({
      chainringStr: chainringType === 'double' ? `${bigRing}/${smallRing}T` : `${bigRing}T`,
      cogsStr,
      cadenceRpm,
      maxSpeed: maxSpd,
      maxRatio: speedMatrix[0]?.row[0]?.ratio || 0,
      minSpeed: minSpd,
      minRatio: speedMatrix[speedMatrix.length - 1]?.row[cogsList.length - 1]?.ratio || 0,
      unitStr
    });
    setSharePosterUrl(url);
    setIsShareModalOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Unified Tool Header */}
      <IOSToolHeader
        category={language === 'zh-TW' ? '動力與傳動' : '动力与传动'}
        categoryIcon={Cog}
        title={language === 'zh-TW' ? '齒比與踏頻' : '齿比与踏频'}
        description="全档位齿比矩阵、多踏频速度分布、相邻跳齿百分比（Step %）与极限斜链位智能预警。"
        tint="blue"
        onShare={handleGeneratePoster}
        shareTitle="生成齿比与踏频速度海报"
        actions={
          <IOSSegmentedControl
            options={[
              { id: 'matrix', label: '档位矩阵' },
              { id: 'cadence_table', label: '踏频对照' },
              { id: 'chart', label: '速度曲线' },
            ]}
            value={activeTab}
            onChange={(val) => setActiveTab(val as any)}
            size="md"
          />
        }
      />

      {/* Inputs & Presets */}
      <IOSCard variant="default" className="space-y-4">
        {/* Gruppo Presets */}
        <div>
          <div className="w-full">
            <IOSSegmentedControl
              options={[
                {
                  value: 'compact',
                  label: (
                    <>
                      <span className="sm:hidden">50/34T</span>
                      <span className="hidden sm:inline">公路 50/34T</span>
                    </>
                  )
                },
                {
                  value: 'semi_compact',
                  label: (
                    <>
                      <span className="sm:hidden">52/36T</span>
                      <span className="hidden sm:inline">公路 52/36T</span>
                    </>
                  )
                },
                {
                  value: 'pro_racing',
                  label: (
                    <>
                      <span className="sm:hidden">54/40T</span>
                      <span className="hidden sm:inline">竞速 54/40T</span>
                    </>
                  )
                },
                {
                  value: 'sram_axs',
                  label: (
                    <>
                      <span className="sm:hidden">48/35T</span>
                      <span className="hidden sm:inline">AXS 48/35T</span>
                    </>
                  )
                },
                {
                  value: 'gravel_1x',
                  label: (
                    <>
                      <span className="sm:hidden">40T</span>
                      <span className="hidden sm:inline">Gravel 40T</span>
                    </>
                  )
                },
              ]}
              value={activeGruppo}
              onChange={(val) => loadPresetGruppo(val)}
              size="sm"
            />
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">牙盘制式</label>
            <IOSSegmentedControl
              options={[
                { id: 'double', label: '双盘' },
                { id: 'single', label: '单盘' },
              ]}
              value={chainringType}
              onChange={(val) => setChainringType(val as any)}
              size="sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
              {chainringType === 'double' ? '大盘 / 小盘齿数' : '单盘齿数'}
            </label>
            {chainringType === 'double' ? (
              <div className="grid grid-cols-2 gap-2">
                <NumberStepper value={bigRing} onChange={setBigRing} min={38} max={62} unit="T" />
                <NumberStepper value={smallRing} onChange={setSmallRing} min={28} max={46} unit="T" />
              </div>
            ) : (
              <NumberStepper value={bigRing} onChange={setBigRing} min={30} max={56} unit="T" />
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">飞轮齿数片组合</label>
            <input
              type="text"
              value={cogsStr}
              onChange={(e) => setCogsStr(e.target.value)}
              className="w-full bg-slate-100/80 dark:bg-white/5 border border-black/[0.05] dark:border-white/[0.08] rounded-xl px-3 py-2 text-xs text-ios-blue font-mono focus:outline-none focus:ring-1 focus:ring-ios-blue"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">目标基准踏频 (RPM)</label>
            <NumberStepper
              value={cadenceRpm}
              onChange={setCadenceRpm}
              step={5}
              min={40}
              max={150}
              unit="RPM"
            />
          </div>
        </div>

        {/* Tire preset picker */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-black/[0.05] dark:border-white/[0.08]">
          <span className="text-xs text-slate-500 dark:text-slate-400">外胎周长规格:</span>
          {TIRE_PRESETS.map((p) => {
            const isSelected = tireCircumferenceMm === p.value;
            return (
              <button
                key={p.value}
                onClick={() => setTireCircumferenceMm(p.value)}
                className={`px-2.5 py-1 rounded-xl text-xs font-mono transition apple-touch ${
                  isSelected
                    ? 'bg-ios-blue text-white border-ios-blue font-bold shadow-xs ring-1.5 ring-ios-blue/30 scale-[1.01]'
                    : 'bg-black/[0.02] dark:bg-white/[0.04] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-black/[0.05] dark:border-white/[0.08]'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Quick Sync to Active Bike Footer */}
        {activeBike && (
          <IOSGarageSyncFooter
            bikeName={activeBike.name}
            badgeText="传动联动"
            detailText={`${chainringType === 'single' ? `${bigRing}T` : `${bigRing}/${smallRing}T`} · ${cogsList[0] || 11}-${cogsList[cogsList.length - 1] || 34}T`}
            buttonText="保存齿比至战车"
            onSave={() => {
              updateActiveBikeDrivetrain({
                chainringType,
                bigRing,
                smallRing: chainringType === 'double' ? smallRing : bigRing,
                cassette: cogsList,
              });
              showToast(
                `已将当前齿比 (${chainringType === 'single' ? `${bigRing}T` : `${bigRing}/${smallRing}T`} · ${cogsList[0]}-${cogsList[cogsList.length - 1]}T) 保存至战车【${activeBike.name.split('/')[0]}】`,
                'success'
              );
            }}
          />
        )}
      </IOSCard>

      {/* Step % Difference Analysis */}
      <IOSCard variant="inset" className="p-4 space-y-2">
        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block flex items-center gap-1.5">
          <ArrowUpDown className="w-3.5 h-3.5 text-ios-blue" />
          相邻档位齿比变动阶梯 (Gear Step % Jump)
        </span>
        <div className="flex flex-wrap gap-2 text-xs font-mono">
          {gearSteps.map((s, idx) => (
            <div key={idx} className="p-2 rounded-xl bg-white dark:bg-[#2C2C2E] border border-black/[0.05] dark:border-white/[0.08] flex items-center gap-1.5">
              <span className="font-bold text-slate-800 dark:text-slate-200">{s.cog}T</span>
              {s.nextCog && (
                <>
                  <span className="text-slate-400 dark:text-slate-500">→</span>
                  <span className="text-ios-blue font-semibold">+{s.jumpPct}%</span>
                </>
              )}
            </div>
          ))}
        </div>
      </IOSCard>

      {/* TAB 1: Speed & Gear Ratio Matrix */}
      {activeTab === 'matrix' && (
        <IOSCard variant="default" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-200">
              在 {cadenceRpm} RPM 踏频下的全档位速度 ({isImperial ? 'mph' : 'km/h'}) 与前进距离 ({isImperial ? 'gear in' : 'm'}) 矩阵
            </span>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-ios-blue sm:hidden font-medium">↔ 可横向滑动查看</span>
              <span className="text-slate-500">
                *黄色标记为极限斜链位 (Crossed-Chaining)
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-center border-collapse">
              <thead>
                <tr className="border-b border-black/[0.05] dark:border-white/[0.08] text-slate-500 dark:text-slate-400 font-mono">
                  <th className="p-2.5 text-left font-sans">牙盘</th>
                  {cogsList.map(c => (
                    <th key={c} className="p-2.5 font-bold text-slate-700 dark:text-slate-300">{c}T</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.08] font-mono">
                {speedMatrix.map((item, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition">
                    <td className="p-2.5 text-left font-bold text-ios-blue font-sans">
                      {item.ring}T
                    </td>
                    {item.row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className={`p-2.5 transition ${
                          cell.isCrossChained
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/30 font-bold'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                        title={cell.crossType || `齿比 ${cell.ratio} | 前进 ${isImperial ? `${cell.gearInches}"` : `${cell.devMeters}m`}`}
                      >
                        <div className="text-sm font-bold tabular-nums tracking-tight">
                          {isImperial ? (cell.speedKmh * 0.621371).toFixed(1) : cell.speedKmh}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400/80 tabular-nums">
                          {cell.ratio} / {isImperial ? `${cell.gearInches}"` : `${cell.devMeters}m`}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </IOSCard>
      )}

      {/* TAB 2: Multi-Cadence Sweep Table */}
      {activeTab === 'cadence_table' && (
        <IOSCard variant="default" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-200 block">
              大盘 {bigRing}T 在不同踏频 (70 ~ 110 RPM) 下的速度对照 ({isImperial ? 'mph' : 'km/h'})
            </span>
            <span className="text-[11px] text-ios-blue sm:hidden font-medium">↔ 可横向滑动查看</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-center border-collapse">
              <thead>
                <tr className="border-b border-black/[0.05] dark:border-white/[0.08] text-slate-500 dark:text-slate-400 font-mono">
                  <th className="p-2.5 text-left font-sans">飞轮齿片</th>
                  <th className="p-2.5">传动比</th>
                  <th className="p-2.5">70 RPM</th>
                  <th className="p-2.5">80 RPM</th>
                  <th className="p-2.5 font-bold text-ios-blue">90 RPM</th>
                  <th className="p-2.5">100 RPM</th>
                  <th className="p-2.5">110 RPM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.08] font-mono">
                {multiCadenceData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition">
                    <td className="p-2.5 text-left font-bold text-slate-800 dark:text-slate-200 font-sans">{bigRing}x{row.cog}T</td>
                    <td className="p-2.5 text-slate-500 dark:text-slate-400">{row.ratio}</td>
                    <td className="p-2.5 text-slate-800 dark:text-slate-200">{row.speeds[0]}</td>
                    <td className="p-2.5 text-slate-800 dark:text-slate-200">{row.speeds[1]}</td>
                    <td className="p-2.5 font-bold text-ios-blue bg-ios-blue/5">{row.speeds[2]}</td>
                    <td className="p-2.5 text-slate-800 dark:text-slate-200">{row.speeds[3]}</td>
                    <td className="p-2.5 text-emerald-600 dark:text-emerald-400 font-semibold">{row.speeds[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </IOSCard>
      )}

      {/* TAB 3: Speed vs Cadence Visual Chart */}
      {activeTab === 'chart' && (
        <IOSCard variant="default" className="space-y-4">
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-200 block">
            高速档、中盘巡航与爬坡极限档 踏频-车速线性曲线
          </span>
          <div className="h-64">
            <Line
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { labels: { color: '#94a3b8' } },
                  tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#38bdf8',
                    bodyColor: '#f8fafc',
                    padding: 8
                  }
                },
                scales: {
                  x: { grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                  y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, title: { display: true, text: `速度 (${isImperial ? 'mph' : 'km/h'})` } }
                }
              }}
            />
          </div>
        </IOSCard>
      )}

      {/* Social Share Poster Modal */}
      <ShareCardModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        imageUrl={sharePosterUrl}
        title="传动齿比与极速战报"
        downloadFileName={`YoloCycling_齿比极速_${chainringType === 'double' ? `${bigRing}-${smallRing}T` : `${bigRing}T`}.png`}
      />
    </div>
  );
};
