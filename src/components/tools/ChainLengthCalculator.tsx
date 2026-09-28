import React, { useState, useMemo, useEffect } from 'react';
import { Link, CheckCircle2, AlertTriangle, Info, Share2, Settings, ArrowRight, ShieldCheck, Zap, Lightbulb } from 'lucide-react';
import { Tooltip } from '../common/Tooltip';
import { NumberStepper } from '../common/NumberStepper';
import { IOSSegmentedControl } from '../common/IOSSegmentedControl';
import { IOSCard, IOSCardHeader, IOSMetricTile } from '../common/IOSCard';
import { IOSToolHeader } from '../common/IOSToolHeader';
import { ShareCardModal } from '../common/ShareCardModal';
import { generateChainLengthPoster } from '../../utils/shareCardGenerators';
import { useToast } from '../../context/ToastContext';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';
import { useRiderProfile } from '../../context/RiderProfileContext';

export const ChainLengthCalculator: React.FC = () => {
  const { showToast } = useToast();
  const { language, unitSystem } = useLanguageAndUnit();
  const isImperial = unitSystem === 'imperial';
  const { activeBike } = useRiderProfile();

  // Share Poster State
  const [sharePosterUrl, setSharePosterUrl] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  const [chainstayLengthMm, setChainstayLengthMm] = useState<number>(activeBike?.drivetrain?.chainstayLengthMm || 410);
  const [bigRing, setBigRing] = useState<number>(activeBike?.drivetrain?.bigRing || 50);
  const [smallRing, setSmallRing] = useState<number>(activeBike?.drivetrain?.smallRing || 34);
  const [isSingleRing, setIsSingleRing] = useState<boolean>(activeBike?.drivetrain?.chainringType === 'single');
  const [bigCog, setBigCog] = useState<number>(
    activeBike?.drivetrain?.cassette ? activeBike.drivetrain.cassette[activeBike.drivetrain.cassette.length - 1] : 34
  );
  const [smallCog, setSmallCog] = useState<number>(
    activeBike?.drivetrain?.cassette ? activeBike.drivetrain.cassette[0] : 11
  );
  const [pulleyTeeth, setPulleyTeeth] = useState<number>(11); // 11T standard or 12/14T oversized
  const [isFullSuspension, setIsFullSuspension] = useState<boolean>(activeBike?.type === 'mtb_xc');
  const [chainstayGrowthMm, setChainstayGrowthMm] = useState<number>(20);

  // Sync with active bike
  useEffect(() => {
    if (activeBike?.drivetrain) {
      setBigRing(activeBike.drivetrain.bigRing);
      if (activeBike.drivetrain.smallRing) setSmallRing(activeBike.drivetrain.smallRing);
      setIsSingleRing(activeBike.drivetrain.chainringType === 'single');
      if (activeBike.drivetrain.chainstayLengthMm) setChainstayLengthMm(activeBike.drivetrain.chainstayLengthMm);
      if (activeBike.drivetrain.cassette && activeBike.drivetrain.cassette.length > 0) {
        setSmallCog(activeBike.drivetrain.cassette[0]);
        setBigCog(activeBike.drivetrain.cassette[activeBike.drivetrain.cassette.length - 1]);
      }
    }
    if (activeBike?.type === 'mtb_xc') {
      setIsFullSuspension(true);
    }
  }, [activeBike]);

  const [activePreset, setActivePreset] = useState<string | null>('compact_34');

  // Preset Configurations
  const loadPreset = (type: string) => {
    setActivePreset(type);
    if (type === 'compact_34') {
      setIsSingleRing(false);
      setBigRing(50);
      setSmallRing(34);
      setBigCog(34);
      setSmallCog(11);
      setChainstayLengthMm(410);
      setPulleyTeeth(11);
      showToast('已加载压缩盘 50/34T + 11-34T 预设', 'info');
    } else if (type === 'semi_30') {
      setIsSingleRing(false);
      setBigRing(52);
      setSmallRing(36);
      setBigCog(30);
      setSmallCog(11);
      setChainstayLengthMm(410);
      setPulleyTeeth(11);
      showToast('已加载半压缩 52/36T + 11-30T 预设', 'info');
    } else if (type === 'sram_axs') {
      setIsSingleRing(false);
      setBigRing(48);
      setSmallRing(35);
      setBigCog(33);
      setSmallCog(10);
      setChainstayLengthMm(410);
      setPulleyTeeth(12);
      showToast('已加载 SRAM AXS 48/35T + 10-33T 预设', 'info');
    } else if (type === 'gravel_1x') {
      setIsSingleRing(true);
      setBigRing(40);
      setSmallRing(40);
      setBigCog(44);
      setSmallCog(10);
      setChainstayLengthMm(425);
      setPulleyTeeth(12);
      showToast('已加载 Gravel 单盘 40T + 10-44T 预设', 'info');
    }
  };

  // Comprehensive Calculation
  const result = useMemo(() => {
    // 1. Effective Chainstay (accounting for full-suspension bottom-out stretch)
    const effectiveChainstayMm = isFullSuspension ? chainstayLengthMm + chainstayGrowthMm : chainstayLengthMm;
    const cInches = effectiveChainstayMm / 25.4;
    // Classic Rigby Formula calculates chain loop length IN INCHES: L_inches = 2 * C + F/4 + R/4 + 1
    // Each bicycle chain link (inner or outer half-link) is 1/2 inch (0.5 inch pitch).
    // Therefore, Link Count = L_inches / 0.5 = L_inches * 2 = 4 * C + F/2 + R/2 + 2!
    const pulleyExtraInches = pulleyTeeth > 11 ? (pulleyTeeth - 11) * 0.15 : 0;
    const rawLengthInches = 2 * cInches + bigRing / 4 + bigCog / 4 + 1 + pulleyExtraInches;
    const finalRawLinks = rawLengthInches * 2;

    // Must be an even integer for standard inner-outer link pairs
    const recommendedLinksEven = Math.ceil(finalRawLinks / 2) * 2;
    const chainLengthInches = (recommendedLinksEven * 0.5).toFixed(1); // Standard 1/2" pitch

    // 2. Shimano / SRAM Direct Method (Large-Large without derailleur + 2 links with quick link)
    const shimanoMethodLinks = Math.ceil((4 * cInches + (bigRing + bigCog) / 2 + (isSingleRing ? 4 : 2)) / 2) * 2;

    // 3. Drivetrain Capacity Check (后拨齿容量校核)
    const frontDifference = isSingleRing ? 0 : Math.max(0, bigRing - smallRing);
    const rearDifference = Math.max(0, bigCog - smallCog);
    const requiredCapacity = frontDifference + rearDifference;
    const isRingInverted = !isSingleRing && smallRing >= bigRing;
    const isCogInverted = smallCog >= bigCog;

    let rearDerailleurRecommendation = '短腿 SS（≤30T）或中腿 GS';
    let isCapacityWarning = false;

    if (requiredCapacity > 41) {
      rearDerailleurRecommendation = '超长腿 SGS（≥43T）';
    } else if (requiredCapacity > 34) {
      rearDerailleurRecommendation = '中腿 GS（35~41T）';
    } else {
      rearDerailleurRecommendation = '短腿 SS（28~34T）或中腿 GS';
    }

    if (bigCog > 34 && requiredCapacity > 39) {
      isCapacityWarning = true;
    }

    return {
      recommendedLinks: recommendedLinksEven,
      chainLengthInches,
      shimanoMethodLinks,
      requiredCapacity,
      rearDerailleurRecommendation,
      isCapacityWarning,
      isRingInverted,
      isCogInverted,
      rawFloat: finalRawLinks.toFixed(2)
    };
  }, [chainstayLengthMm, chainstayGrowthMm, isFullSuspension, bigRing, smallRing, isSingleRing, bigCog, smallCog, pulleyTeeth]);

  const handleGeneratePoster = () => {
    const url = generateChainLengthPoster({
      chainstayMm: chainstayLengthMm,
      frontRings: isSingleRing ? `${bigRing}T 单盘` : `${bigRing}/${smallRing}T 双盘`,
      rearCogs: `${smallCog}-${bigCog}T`,
      recommendedLinks: result.recommendedLinks,
      chainLengthInches: parseFloat(result.chainLengthInches) || 0,
      requiredCapacity: result.requiredCapacity,
      derailleurRecommendation: result.rearDerailleurRecommendation,
      isFullSuspension
    });
    setSharePosterUrl(url);
    setIsShareModalOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Unified Tool Header */}
      <IOSToolHeader
        category={language === 'zh-TW' ? '動力與傳動' : '动力与传动'}
        categoryIcon={Link}
        title={language === 'zh-TW' ? '鏈條長度' : '链条长度'}
        description={
          language === 'zh-TW'
            ? '換大飛輪或大盤必備！根據後下叉 RC 長度、齒數與大導輪補償，精準計算最佳截鏈節數，並校驗後撥總齒容量。'
            : '换大飞轮或大盘必备！根据后下叉 RC 长度、齿数与大导轮补偿，精准计算最佳截链节数，并校验后拨总齿容量。'
        }
        tint="blue"
        onShare={handleGeneratePoster}
        shareTitle={language === 'zh-TW' ? '生成截鏈規範海報' : '生成截链规范海报'}
        actions={
          <IOSSegmentedControl
            options={[
              {
                value: 'compact_34',
                label: (
                  <>
                    <span className="sm:hidden">50/34T</span>
                    <span className="hidden sm:inline">公路 50/34T</span>
                  </>
                )
              },
              {
                value: 'semi_30',
                label: (
                  <>
                    <span className="sm:hidden">52/36T</span>
                    <span className="hidden sm:inline">公路 52/36T</span>
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
                    <span className="sm:hidden">单盘 40T</span>
                    <span className="hidden sm:inline">Gravel 40T</span>
                  </>
                )
              },
            ]}
            value={activePreset || ''}
            onChange={(val) => loadPreset(val)}
            size="md"
          />
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Left Inputs (macOS Inspector) */}
        <div className="lg:col-span-5 space-y-4 sm:space-y-5">
          <IOSCard variant="default" className="space-y-4">
            <IOSCardHeader
              title={language === 'zh-TW' ? '車架幾何與齒盤參數' : '车架几何与齿盘参数'}
              subtitle={language === 'zh-TW' ? '後下叉長度與大中小盤組合' : '后下叉长度与大中小盘组合'}
              icon={Settings}
              iconColor="text-ios-blue bg-ios-blue/10 dark:bg-ios-blue/20"
            />

            {/* Chainstay Length */}
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center">
                后下叉长度 Chainstay RC (mm){isImperial ? ` (${(chainstayLengthMm / 25.4).toFixed(1)}")` : ''}
                <Tooltip content="五通中轴中心至后轮快拆/桶轴中心的直线距离，绝大多数公路车为 405~415mm，Gravel/耐力车为 420~435mm。" />
              </label>
              <NumberStepper
                value={chainstayLengthMm}
                onChange={setChainstayLengthMm}
                step={1}
                min={390}
                max={460}
                unit="mm"
              />
            </div>

            {/* Frame Suspension Type */}
            <div className="p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.06] space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white block">全避震软尾补偿</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">后避震压缩触底时后下叉转点拉伸拉长</span>
                </div>
                <input
                  type="checkbox"
                  checked={isFullSuspension}
                  onChange={(e) => setIsFullSuspension(e.target.checked)}
                  className="w-4 h-4 rounded accent-ios-blue cursor-pointer"
                />
              </div>

              {isFullSuspension && (
                <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.06] space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">压缩触底拉伸量</span>
                    <span className="font-mono text-ios-blue font-bold">+{chainstayGrowthMm} mm</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={35}
                    step={1}
                    value={chainstayGrowthMm}
                    onChange={(e) => setChainstayGrowthMm(Number(e.target.value))}
                    className="w-full accent-ios-blue cursor-pointer h-1.5 bg-black/[0.06] dark:bg-white/[0.1] rounded"
                  />
                  <span className="text-[11px] text-ios-orange flex items-start gap-1 pt-0.5">
                    <Lightbulb className="w-3.5 h-3.5 text-ios-orange shrink-0 mt-0.5" />
                    <span>{language === 'zh-TW' ? `已自動在有效後下叉中計入 ${chainstayGrowthMm}mm 拉伸並增加安全鏈節，杜絕大飛大盤衝擊觸底拉爆後撥！` : `已自动在有效后下叉中计入 ${chainstayGrowthMm}mm 拉伸并增加安全链节，杜绝大飞大盘冲击触底拉爆后拨！`}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Drivetrain 1x or 2x */}
            <div className="pt-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">齿盘系统</label>
              <IOSSegmentedControl
                options={[
                  { id: '2x', label: '双盘' },
                  { id: '1x', label: '单盘' },
                ]}
                value={isSingleRing ? '1x' : '2x'}
                onChange={(val) => setIsSingleRing(val === '1x')}
                size="sm"
              />
            </div>

            {/* Chainrings */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
                  {isSingleRing ? '单盘齿数' : '最大大盘齿数'}
                </label>
                <NumberStepper value={bigRing} onChange={setBigRing} min={30} max={60} unit="T" />
              </div>
              {!isSingleRing && (
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">最小小盘齿数</label>
                  <NumberStepper value={smallRing} onChange={setSmallRing} min={28} max={46} unit="T" />
                </div>
              )}
            </div>

            {/* Cassette */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">飞轮最大片齿数</label>
                <NumberStepper value={bigCog} onChange={setBigCog} min={25} max={52} unit="T" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5">飞轮最小片齿数</label>
                <NumberStepper value={smallCog} onChange={setSmallCog} min={9} max={14} unit="T" />
              </div>
            </div>

            {/* Pulley Teeth */}
            <div className="pt-2 border-t border-black/[0.05] dark:border-white/[0.08]">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center">
                后拨导轮规格
                <Tooltip content="标准原厂导轮一般为 11T/12T；若改装超大导轮系统（如 14T/16T/18T 大鸡腿），需相应补偿链节。" />
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { teeth: 11, label: '标准原厂 11T' },
                  { teeth: 12, label: '新型导轮 12T' },
                  { teeth: 14, label: '改装导轮 14T+' }
                ].map((p) => {
                  const isSelected = pulleyTeeth === p.teeth;
                  return (
                    <button
                      key={p.teeth}
                      onClick={() => setPulleyTeeth(p.teeth)}
                      className={`py-2 px-1 rounded-xl border text-center transition apple-touch ${
                        isSelected
                          ? 'bg-ios-blue text-white border-ios-blue font-bold shadow-xs ring-1.5 ring-ios-blue/30 scale-[1.01]'
                          : 'bg-black/[0.02] dark:bg-white/[0.04] border-black/[0.05] dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20'
                      }`}
                    >
                      <span className={isSelected ? 'font-bold text-white' : ''}>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </IOSCard>
        </div>

        {/* Right Outputs & Visualization (macOS Sticky Canvas) */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-5 lg:sticky lg:top-20 self-start">
          {(result.isRingInverted || result.isCogInverted) && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-700 dark:text-amber-400 text-xs shadow-ios-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
              <div>
                <span className="font-bold block text-sm mb-0.5">齿盘参数设置异常提醒</span>
                <span>
                  {result.isRingInverted && '小盘齿数不能大于或等于大盘齿数；'}
                  {result.isCogInverted && '飞轮最小片齿数不能大于或等于最大片齿数；'}
                  系统已做安全回退保护，请修正齿数输入以获得最精准的截链建议。
                </span>
              </div>
            </div>
          )}

          {/* Main Key Link Metric Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
            <IOSMetricTile
              label="标准截链推荐"
              value={result.recommendedLinks}
              unit="Links"
              subtext="含 1 节魔术扣"
              accentColor="blue"
              icon={Link}
            />

            <IOSMetricTile
              label="链条理论总长度"
              value={result.chainLengthInches}
              unit="英寸"
              subtext={`约 ${(parseFloat(result.chainLengthInches) * 25.4).toFixed(0)} mm`}
              accentColor="green"
              icon={Zap}
            />

            <IOSMetricTile
              label="后拨总齿容量需求"
              value={result.requiredCapacity}
              unit="T"
              subtext={result.rearDerailleurRecommendation}
              accentColor={result.isCapacityWarning ? 'orange' : 'blue'}
              icon={Settings}
            />
          </div>

          {/* Drivetrain Visual SVG Schematic */}
          <IOSCard variant="default" className="space-y-4">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-ios-blue" />
                传动链条闭环受力几何示意
              </span>
              <span className="font-mono text-ios-blue font-bold">RC: {chainstayLengthMm}mm{isImperial ? ` (${(chainstayLengthMm / 25.4).toFixed(1)}")` : ''}</span>
            </div>

            <div className="flex justify-center bg-black/[0.02] dark:bg-white/[0.03] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08] transition-colors">
              <svg viewBox="0 0 360 140" className="w-full max-w-md h-auto select-none">
                {/* Chainstay line */}
                <line x1="80" y1="70" x2="280" y2="70" stroke="#AEAEB2" strokeWidth="2.5" strokeDasharray="4 4" className="dark:stroke-[#3A3A3C]" />
                <text x="180" y="62" fontSize="9" fill="#8E8E93" textAnchor="middle" fontFamily="monospace">
                  RC = {chainstayLengthMm} mm{isImperial ? ` (${(chainstayLengthMm / 25.4).toFixed(1)}")` : ''}
                </text>

                {/* Chain Loop (upper & lower runs) */}
                <path
                  d="M 80 40 L 280 25 A 45 45 0 0 1 280 115 L 110 110 L 80 95 A 25 25 0 0 1 80 40"
                  fill="none"
                  stroke="#007AFF"
                  strokeWidth="3"
                  strokeDasharray="6 2"
                  opacity="0.85"
                  className="dark:stroke-[#0A84FF]"
                />

                {/* Front Chainring */}
                <circle cx="280" cy="70" r="45" fill="#F2F2F7" stroke="#007AFF" strokeWidth="2.5" className="dark:fill-[#2C2C2E] dark:stroke-[#0A84FF]" />
                <circle cx="280" cy="70" r="10" fill="#E5E5EA" stroke="#8E8E93" strokeWidth="2" className="dark:fill-[#1C1C1E] dark:stroke-[#3A3A3C]" />
                <text x="280" y="74" fontSize="12" fontWeight="bold" fill="#007AFF" textAnchor="middle" fontFamily="monospace" className="dark:fill-[#0A84FF]">
                  {bigRing}T
                </text>
                <text x="280" y="128" fontSize="9" fill="#8E8E93" textAnchor="middle" className="dark:fill-[#8E8E93]">
                  牙盘
                </text>

                {/* Rear Cassette */}
                <circle cx="80" cy="70" r="28" fill="#F2F2F7" stroke="#34C759" strokeWidth="2.5" className="dark:fill-[#2C2C2E] dark:stroke-[#30D158]" />
                <circle cx="80" cy="70" r="8" fill="#E5E5EA" stroke="#8E8E93" strokeWidth="2" className="dark:fill-[#1C1C1E] dark:stroke-[#3A3A3C]" />
                <text x="80" y="74" fontSize="11" fontWeight="bold" fill="#34C759" textAnchor="middle" fontFamily="monospace" className="dark:fill-[#30D158]">
                  {bigCog}T
                </text>
                <text x="80" y="128" fontSize="9" fill="#8E8E93" textAnchor="middle" className="dark:fill-[#8E8E93]">
                  飞轮
                </text>

                {/* Derailleur Pulley Cage */}
                <circle cx="105" cy="108" r="9" fill="#F2F2F7" stroke="#FF9500" strokeWidth="2" className="dark:fill-[#1C1C1E] dark:stroke-[#FF9F0A]" />
                <text x="105" y="111" fontSize="7" fontWeight="bold" fill="#FF9500" textAnchor="middle" className="dark:fill-[#FF9F0A]">
                  {pulleyTeeth}T
                </text>
              </svg>
            </div>
          </IOSCard>

          {/* Installation Best Practices Card */}
          <IOSCard variant="default" className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              官方装配与物理测量截链法则
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08] space-y-1.5">
                <span className="font-semibold text-ios-blue block">Shimano 经典大对大法</span>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  链条不经过后拨导轮，直接绕过最大大盘与最大飞轮拉紧，在两端闭合重合处额外加 <strong>2 节（含魔术扣）</strong> 即为标准长度。
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08] space-y-1.5">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 block">小盘小飞下垂校验</span>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  截链装好后切换至小盘最小飞轮，确认后拨导板仍保有微小张力且链条不会刮蹭后拨上导轮下沿。
                </p>
              </div>
            </div>
          </IOSCard>
        </div>
      </div>

      {/* Social Share Poster Modal */}
      <ShareCardModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        imageUrl={sharePosterUrl}
        title="技师截链规范卡"
        downloadFileName={`LaBao_截链规范_${result.recommendedLinks}节.png`}
      />
    </div>
  );
};
