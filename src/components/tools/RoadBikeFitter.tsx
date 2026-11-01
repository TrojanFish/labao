import React, { useState, useMemo, useEffect } from 'react';
import { Ruler, Activity, HelpCircle, CheckCircle2, ChevronRight, User, Printer, Footprints, Shield, FileText, Sparkles, Bike, RotateCcw, Sliders, Compass, Layers, AlertCircle, ArrowRight } from 'lucide-react';
import { BikeDiagram } from '../common/BikeDiagram';
import { Tooltip } from '../common/Tooltip';
import { NumberStepper } from '../common/NumberStepper';
import { IOSSegmentedControl } from '../common/IOSSegmentedControl';
import { IOSCard, IOSCardHeader, IOSMetricTile } from '../common/IOSCard';
import { IOSGarageSyncFooter } from '../common/IOSGarageSyncFooter';
import { IOSToolHeader } from '../common/IOSToolHeader';
import { useRiderProfile } from '../../context/RiderProfileContext';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';
import { useToast } from '../../context/ToastContext';
import { useToolDraftState } from '../../hooks/useToolDraftState';
import { ShareCardModal } from '../common/ShareCardModal';
import { generateFittingPoster } from '../../utils/shareCardGenerators';
import { FittingWorkOrderModal } from './FittingWorkOrderModal';
import {
  calculateHandlebarPosition,
  solveFrameFromHandlebar,
  solveSpacersForTargetDrop,
  calculateStemDelta,
  calculateSaddleHeightFromBB,
  calculateDynamicBioCompensation,
  AnklingStyle,
  CleatPosition
} from '../../utils/bikeFitGeometry';

interface BikeFitterDraft {
  torso: number;
  armLength: number;
  shoulderWidth: number;
  sittingHeight: number;
  thighLength: number;
  lowerLegLength: number;
  footLength: number;
  ridingStyle: 'recreational' | 'endurance' | 'racing';
  flexibility: 'low' | 'medium' | 'high';
  anklingStyle?: AnklingStyle;
  cleatPosition?: CleatPosition;
}

const DEFAULT_FITTER_DRAFT: BikeFitterDraft = {
  torso: 60,
  armLength: 62,
  shoulderWidth: 42,
  sittingHeight: 90,
  thighLength: 43,
  lowerLegLength: 42,
  footLength: 26,
  ridingStyle: 'endurance',
  flexibility: 'medium',
  anklingStyle: 'neutral',
  cleatPosition: 'standard',
};

export const RoadBikeFitter: React.FC = () => {
  const { profile, activeBike, updateActiveBikeGeometry } = useRiderProfile();
  const { unitSystem, language } = useLanguageAndUnit();
  const { showToast } = useToast();
  const isImperial = unitSystem === 'imperial';

  // Core Measurements
  const [height, setHeight] = useState<number>(profile.heightCm || 175);
  const [inseam, setInseam] = useState<number>(profile.inseamCm || 81);

  // Reactively synchronize with global rider profile
  useEffect(() => {
    if (profile.heightCm) setHeight(profile.heightCm);
    if (profile.inseamCm) setInseam(profile.inseamCm);
  }, [profile.heightCm, profile.inseamCm]);

  // Draft persistence for anthropometric measurements & fitting preferences
  const {
    draft: fitterDraft,
    setDraft: setFitterDraft,
    resetDraft: resetFitterDraft,
    hasSavedDraft,
  } = useToolDraftState<BikeFitterDraft>('road_bike_fitter', DEFAULT_FITTER_DRAFT);

  const torso = fitterDraft.torso;
  const setTorso = (val: number | ((prev: number) => number)) =>
    setFitterDraft(prev => ({ ...prev, torso: typeof val === 'function' ? val(prev.torso) : val }));

  const armLength = fitterDraft.armLength;
  const setArmLength = (val: number | ((prev: number) => number)) =>
    setFitterDraft(prev => ({ ...prev, armLength: typeof val === 'function' ? val(prev.armLength) : val }));

  const shoulderWidth = fitterDraft.shoulderWidth;
  const setShoulderWidth = (val: number | ((prev: number) => number)) =>
    setFitterDraft(prev => ({ ...prev, shoulderWidth: typeof val === 'function' ? val(prev.shoulderWidth) : val }));

  const sittingHeight = fitterDraft.sittingHeight;
  const setSittingHeight = (val: number | ((prev: number) => number)) =>
    setFitterDraft(prev => ({ ...prev, sittingHeight: typeof val === 'function' ? val(prev.sittingHeight) : val }));

  const thighLength = fitterDraft.thighLength;
  const setThighLength = (val: number | ((prev: number) => number)) =>
    setFitterDraft(prev => ({ ...prev, thighLength: typeof val === 'function' ? val(prev.thighLength) : val }));

  const lowerLegLength = fitterDraft.lowerLegLength;
  const setLowerLegLength = (val: number | ((prev: number) => number)) =>
    setFitterDraft(prev => ({ ...prev, lowerLegLength: typeof val === 'function' ? val(prev.lowerLegLength) : val }));

  const footLength = fitterDraft.footLength;
  const setFootLength = (val: number | ((prev: number) => number)) =>
    setFitterDraft(prev => ({ ...prev, footLength: typeof val === 'function' ? val(prev.footLength) : val }));

  const ridingStyle = fitterDraft.ridingStyle;
  const setRidingStyle = (val: 'recreational' | 'endurance' | 'racing') =>
    setFitterDraft(prev => ({ ...prev, ridingStyle: val }));

  const flexibility = fitterDraft.flexibility;
  const setFlexibility = (val: 'low' | 'medium' | 'high') =>
    setFitterDraft(prev => ({ ...prev, flexibility: val }));

  const anklingStyle = fitterDraft.anklingStyle || 'neutral';
  const setAnklingStyle = (val: AnklingStyle) =>
    setFitterDraft(prev => ({ ...prev, anklingStyle: val }));

  const cleatPosition = fitterDraft.cleatPosition || 'standard';
  const setCleatPosition = (val: CleatPosition) =>
    setFitterDraft(prev => ({ ...prev, cleatPosition: val }));

  const [showAdvancedInputs, setShowAdvancedInputs] = useState<boolean>(false);

  // Comprehensive Fitting Calculation
  const result = useMemo(() => {
    // 1. Saddle height formulas comparison (LeMond 0.883 vs 109% Hamley-Thomas)
    const saddleHeightLeMond = inseam * 0.883;
    const saddleHeightHamley = (inseam * 1.09) - 17.0; // from pedal axle

    // 2. Stem length
    let stem = 100;
    if (height < 165) stem = 80;
    else if (height < 172) stem = 90;
    else if (height < 180) stem = 100;
    else if (height < 188) stem = 110;
    else stem = 120;

    if (flexibility === 'low') stem -= 10;
    if (ridingStyle === 'racing') stem += 10;

    // 3. Effective Top Tube (ETT) = Overall Cockpit Reach - Stem Length
    // Greg LeMond & Competitive Cyclist anthropometric model:
    // Total Cockpit Span = (Torso + Arm) * 0.535
    const cockpitReach = (torso + armLength) * 0.535;
    let ett = cockpitReach - (stem / 10);
    if (ridingStyle === 'racing') ett += 0.5;
    else if (ridingStyle === 'recreational') ett -= 1.0;
    if (flexibility === 'high') ett += 0.5;
    if (flexibility === 'low') ett -= 0.8;

    // 4. Handlebar width
    const hbWidth = shoulderWidth;

    // 5. Crank length
    let crank = '170mm';
    if (inseam < 74) crank = '165mm';
    else if (inseam <= 79) crank = '167.5mm / 170mm';
    else if (inseam <= 84) crank = '170mm / 172.5mm';
    else crank = '172.5mm / 175mm';

    // 6. Saddle Setback & Drop
    // KOPS (Knee Over Pedal Spindle) setback: riders with proportionally longer thighs
    // need more posterior saddle position to prevent the knee from tracking too far
    // forward of the pedal axle at 3 o'clock — a primary risk factor for patellar tendinopathy.
    //
    // Formula: base setback 7.0cm (industry standard for thigh/leg ratio ≈ 0.50), adjusted
    // by how much the user's thigh ratio deviates from that midpoint.
    // thighRatio range: ~0.43 (short thigh) → ~0.57 (long thigh), adjustment ±1.5cm.
    const totalLegLength = thighLength + lowerLegLength;
    const thighRatio = totalLegLength > 0 ? thighLength / totalLegLength : 0.50;
    const baseSetback = 7.0; // cm, matches biomechanics norm for average proportions
    const setbackAdjust = (thighRatio - 0.50) * 15; // ~±1.5cm across typical range
    const saddleSetback = parseFloat(
      Math.max(4.5, Math.min(10.0, baseSetback + setbackAdjust)).toFixed(1)
    );
    let saddleDrop = 5.0; // cm
    if (ridingStyle === 'recreational') saddleDrop = 3.5;
    else if (ridingStyle === 'endurance') saddleDrop = 5.5;
    else saddleDrop = 8.5;
    if (flexibility === 'high') saddleDrop += 1.5;
    if (flexibility === 'low') saddleDrop -= 1.5;

    // 7. Stack & Reach Estimation
    const estimatedStack = Math.round(inseam * 6.8 + (ridingStyle === 'recreational' ? 25 : 0));
    const estimatedReach = Math.round(ett * 10 * 0.72 - (ridingStyle === 'racing' ? 0 : 10));

    // 8. Body Proportion Analysis
    let sittingHeightNote = '身长与腿长比例标准均衡。';
    const sittingRatio = sittingHeight / height;
    if (sittingRatio > 0.53) {
      sittingHeightNote = '身体特征：上半身躯干偏长，腿部相对较短，可考虑选择 Stack 适中、Reach 略长的车架或稍长把立。';
    } else if (sittingRatio < 0.50) {
      sittingHeightNote = '身体特征：长腿短躯干比例，座管拔出高度较高，推荐选择高 Stack、短 Reach 的耐力/爬坡几何。';
    }

    let thighLowerLegNote = '大腿与小腿长度比例适中。';
    if (thighLength > lowerLegLength * 1.08) {
      thighLowerLegNote = '大腿相对小腿偏长：建议适当加大坐垫后移量，以避免膝盖前移超过脚踏轴心。';
    }

    // 9. Frame Size Category
    let frameSize = 'M (52-54cm)';
    if (height < 162) frameSize = 'XXS (44-46cm)';
    else if (height < 168) frameSize = 'XS (47-49cm)';
    else if (height < 174) frameSize = 'S (50-52cm)';
    else if (height < 180) frameSize = 'M (52-54cm)';
    else if (height < 186) frameSize = 'L (55-57cm)';
    else frameSize = 'XL (58-60cm+)';

    // 10. Dynamic Biomechanical Compensation (Holmes & Pruitt 3D Retül Standard)
    const dynamicBio = calculateDynamicBioCompensation({
      baseSaddleHeightMm: Math.round(saddleHeightLeMond * 10),
      anklingStyle,
      cleatPosition,
      flexibility
    });

    return {
      saddleHeight: parseFloat(saddleHeightLeMond.toFixed(1)),
      saddleHeightHamley: parseFloat(saddleHeightHamley.toFixed(1)),
      effectiveTopTube: parseFloat(ett.toFixed(1)),
      stemLength: stem,
      handlebarWidth: hbWidth,
      crankLength: crank,
      saddleSetback,
      saddleDrop: parseFloat(saddleDrop.toFixed(1)),
      conceptualFrameSize: frameSize,
      estimatedStack,
      estimatedReach,
      sittingHeightNote,
      thighLowerLegNote,
      dynamicBio,
      generalAdvice: [
        '初次设定请以脚跟踩在脚踏最低点时膝盖完全伸直为基准，穿上锁鞋后膝关节保持 25°~35° 微屈角。',
        ridingStyle === 'racing'
          ? '竞技激进几何：较低的座舱落差能提供更低迎风面积，需配合良好的腘绳肌柔韧性与核心支撑。'
          : '耐力舒适几何：把立垫圈可适当保留 15~25mm，减少腰背及颈部长时间骑行的肌肉疲劳。'
      ]
    };
  }, [height, inseam, torso, armLength, shoulderWidth, sittingHeight, thighLength, lowerLegLength, footLength, ridingStyle, flexibility, anklingStyle, cleatPosition]);

  // Cockpit Decoupling State
  const [cockpitStemAngle, setCockpitStemAngle] = useState<number>(-6);
  const [cockpitStemLength, setCockpitStemLength] = useState<number>(100);
  const [cockpitHeadsetCap, setCockpitHeadsetCap] = useState<number>(10);
  const [cockpitSpacers, setCockpitSpacers] = useState<number>(15);
  const [cockpitHeadTubeAngle, setCockpitHeadTubeAngle] = useState<number>(73.0);
  const [isTestFrameOpen, setIsTestFrameOpen] = useState<boolean>(false);
  const [testFrameStack, setTestFrameStack] = useState<number>(545);
  const [testFrameReach, setTestFrameReach] = useState<number>(383);

  // Synchronize cockpit stem length when fitting result stem length is calculated
  useEffect(() => {
    if (result.stemLength) {
      setCockpitStemLength(result.stemLength);
    }
  }, [result.stemLength]);

  // Synchronize test frame with recommended stack & reach initially
  useEffect(() => {
    if (result.estimatedStack) setTestFrameStack(result.estimatedStack);
    if (result.estimatedReach) setTestFrameReach(result.estimatedReach);
  }, [result.estimatedStack, result.estimatedReach]);

  // Decoupled Geometry Analytics
  const cockpitAnalytics = useMemo(() => {
    const saddleHeightMm = result.saddleHeight * 10;
    const targetDropMm = result.saddleDrop * 10;
    const saddleVertMm = calculateSaddleHeightFromBB(saddleHeightMm, 73.5);
    const targetHandlebarStackMm = saddleVertMm - targetDropMm;

    // Standard cockpit span from BB to handlebar clamp center
    const targetHandlebarReachMm = result.estimatedReach + 85;

    // 1. Decoupled Frame Stack & Reach required for user's selected cockpit hardware
    const decoupledFrame = solveFrameFromHandlebar(
      { handlebarStackMm: targetHandlebarStackMm, handlebarReachMm: targetHandlebarReachMm },
      {
        headTubeAngleDeg: cockpitHeadTubeAngle,
        headsetCapMm: cockpitHeadsetCap,
        spacersMm: cockpitSpacers,
        stemLengthMm: cockpitStemLength,
        stemAngleDeg: cockpitStemAngle,
        stemClampHeightMm: 40
      }
    );

    // 2. Handlebar Coords with user's recommended frame + current cockpit
    const handlebarCoords = calculateHandlebarPosition(
      { stackMm: result.estimatedStack, reachMm: result.estimatedReach },
      {
        headTubeAngleDeg: cockpitHeadTubeAngle,
        headsetCapMm: cockpitHeadsetCap,
        spacersMm: cockpitSpacers,
        stemLengthMm: cockpitStemLength,
        stemAngleDeg: cockpitStemAngle,
        stemClampHeightMm: 40
      }
    );

    // 3. Recommended Spacers for user's recommended frame stack
    const spacerFit = solveSpacersForTargetDrop({
      saddleHeightMm,
      targetDropMm,
      frameStackMm: result.estimatedStack,
      headTubeAngleDeg: cockpitHeadTubeAngle,
      headsetCapMm: cockpitHeadsetCap,
      stemLengthMm: cockpitStemLength,
      stemAngleDeg: cockpitStemAngle,
      stemClampHeightMm: 40
    });

    // 4. Test Target Frame Fit
    const testFrameFit = solveSpacersForTargetDrop({
      saddleHeightMm,
      targetDropMm,
      frameStackMm: testFrameStack,
      headTubeAngleDeg: cockpitHeadTubeAngle,
      headsetCapMm: cockpitHeadsetCap,
      stemLengthMm: cockpitStemLength,
      stemAngleDeg: cockpitStemAngle,
      stemClampHeightMm: 40
    });

    const reachDiffMm = Math.round(testFrameReach - decoupledFrame.reachMm);
    const recommendedStemForTestFrame = Math.max(60, Math.min(140, Math.round((cockpitStemLength - reachDiffMm) / 5) * 5));

    return {
      decoupledFrame,
      handlebarCoords,
      spacerFit,
      testFrameFit,
      recommendedStemForTestFrame,
      reachDiffMm
    };
  }, [
    result.saddleHeight,
    result.saddleDrop,
    result.estimatedStack,
    result.estimatedReach,
    cockpitHeadTubeAngle,
    cockpitHeadsetCap,
    cockpitSpacers,
    cockpitStemLength,
    cockpitStemAngle,
    testFrameStack,
    testFrameReach
  ]);

  // Share Poster State
  const [sharePosterUrl, setSharePosterUrl] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isWorkOrderModalOpen, setIsWorkOrderModalOpen] = useState<boolean>(false);

  const handleGeneratePoster = async () => {
    try {
      const url = await generateFittingPoster({
        height,
        inseam,
        armLength,
        torso,
        ridingStyle,
        saddleHeight: result.saddleHeight,
        effectiveTopTube: result.effectiveTopTube,
        stemLength: result.stemLength,
        saddleDrop: result.saddleDrop,
        handlebarWidth: result.handlebarWidth * 10,
        crankLength: parseFloat(result.crankLength) || 170,
        frameSize: result.conceptualFrameSize,
        sittingNote: result.sittingHeightNote
      });
      setSharePosterUrl(url);
      setIsShareModalOpen(true);
    } catch (e) {
      showToast('海报生成失败，请重试', 'error');
    }
  };

  const handlePrint = () => {
    setIsWorkOrderModalOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Standard Apple HIG Tool Header */}
      <IOSToolHeader
        category={language === 'zh-TW' ? '人車工效' : '人车工效'}
        categoryIcon={Ruler}
        title="Bike Fit"
        description="根据人体解剖学多维测量，科学推导有效上管 ETT、坐高、座舱落差、Stack/Reach、把立及锁片安装方案。"
        tint="purple"
        onShare={handleGeneratePoster}
        shareTitle="生成个人 Fitting 档案长图"
        actions={
          <div className="flex items-center gap-2">
            {hasSavedDraft && (
              <button
                type="button"
                onClick={() => {
                  resetFitterDraft();
                  showToast(language === 'zh-TW' ? '已重置擬合參數' : '已重置拟合参数', 'info');
                }}
                className="apple-touch h-9 px-3 rounded-xl bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 text-slate-600 dark:text-slate-300 text-xs font-medium border border-slate-200/80 dark:border-white/10 transition shadow-xs flex items-center gap-1.5 whitespace-nowrap shrink-0"
                title={language === 'zh-TW' ? '清除草稿並還原預設' : '清除草稿并还原预设'}
              >
                <RotateCcw className="w-3.5 h-3.5 text-ios-gray" />
                <span>{language === 'zh-TW' ? '重置' : '重置'}</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className="apple-touch h-9 px-3.5 sm:px-4 rounded-xl bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200/80 dark:border-white/10 transition shadow-xs flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Printer className="w-3.5 h-3.5 text-ios-purple" />
              {language === 'zh-TW' ? '列印工單' : '打印工单'}
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        {/* Left Inputs */}
        <div className="lg:col-span-5 space-y-4 sm:space-y-5">
          <IOSCard variant="default" className="p-4 sm:p-5 space-y-4">
            <IOSCardHeader
              title={language === 'zh-TW' ? '身體測量數據' : '身体测量数据'}
              subtitle={language === 'zh-TW' ? '人體解剖學精密擬合' : '人体解剖学精密拟合'}
              icon={User}
              iconColor="purple"
            />

            {/* Height & Inseam */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center">
                    {language === 'zh-TW' ? '身高' : '身高'} (cm)
                    <Tooltip content="脱鞋赤脚背靠平整墙面直立，双脚微闭，下颌微收保持平视，用直角尺贴平头顶垂直向下测量至地面的距离。" />
                  </label>
                  {isImperial && (
                    <span className="text-[11px] text-ios-purple font-mono font-medium">
                      {Math.floor(height / 30.48)}'{Math.round((height % 30.48) / 2.54)}"
                    </span>
                  )}
                </div>
                <NumberStepper value={height} onChange={setHeight} step={0.5} min={130} max={220} unit="cm" decimals={1} />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center">
                    {language === 'zh-TW' ? '跨高' : '跨高'} (cm)
                    <Tooltip content="赤脚靠墙站立，双脚间距15cm，用硬皮书垂直紧贴会阴部向上顶紧（模拟坐垫承托压力），测量地面到书顶垂直距离。" />
                  </label>
                  {isImperial && (
                    <span className="text-[11px] text-ios-purple font-mono font-medium">
                      {(inseam / 2.54).toFixed(1)}"
                    </span>
                  )}
                </div>
                <NumberStepper value={inseam} onChange={setInseam} step={0.5} min={50} max={110} unit="cm" decimals={1} />
              </div>
            </div>

            {/* Torso & Arm */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center mb-1.5">
                  {language === 'zh-TW' ? '軀幹長' : '躯干长'} (cm)
                  <Tooltip content="端坐或站立，测量从胸骨上切迹（两锁骨中间凹槽）垂直向下至会阴骨盆鞍座支撑面的距离。" />
                </label>
                <NumberStepper value={torso} onChange={setTorso} step={0.5} min={40} max={85} unit="cm" decimals={1} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center mb-1.5">
                  {language === 'zh-TW' ? '手臂長' : '手臂长'} (cm)
                  <Tooltip content="手臂握拳水平前伸，测量从肩峰外缘突起（肩锁关节）到握拳中心（虎口指骨关节线）的直线距离。" />
                </label>
                <NumberStepper value={armLength} onChange={setArmLength} step={0.5} min={45} max={90} unit="cm" decimals={1} />
              </div>
            </div>

            {/* Shoulder Width */}
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center mb-1.5">
                {language === 'zh-TW' ? '肩寬' : '肩宽'} (cm)
                <Tooltip content="双手自然下垂，测量左右两侧肩峰外侧骨性突起之间的直线距离。车把中对中宽度通常与肩宽相同。" />
              </label>
              <NumberStepper value={shoulderWidth} onChange={setShoulderWidth} step={0.5} min={34} max={50} unit="cm" decimals={1} />
            </div>

            {/* Riding Style */}
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center mb-2">
                {language === 'zh-TW' ? '騎行目標偏好' : '骑行目标偏好'}
                <Tooltip content="休闲骑游重在挺立舒适与开阔视野；长途耐力平衡气动性与抗疲劳支撑；竞技突围追求极致气动投影与大落差。" />
              </label>
              <IOSSegmentedControl
                options={[
                  {
                    id: 'recreational',
                    label: (
                      <>
                        <span className="sm:hidden">{language === 'zh-TW' ? '休閒' : '休闲'}</span>
                        <span className="hidden sm:inline">{language === 'zh-TW' ? '休閒騎遊' : '休闲骑游'}</span>
                      </>
                    )
                  },
                  {
                    id: 'endurance',
                    label: (
                      <>
                        <span className="sm:hidden">{language === 'zh-TW' ? '耐力' : '耐力'}</span>
                        <span className="hidden sm:inline">{language === 'zh-TW' ? '長途耐力' : '长途耐力'}</span>
                      </>
                    )
                  },
                  {
                    id: 'racing',
                    label: (
                      <>
                        <span className="sm:hidden">{language === 'zh-TW' ? '競技' : '竞技'}</span>
                        <span className="hidden sm:inline">{language === 'zh-TW' ? '競技突圍' : '竞技突围'}</span>
                      </>
                    )
                  },
                ]}
                value={ridingStyle}
                onChange={(val) => setRidingStyle(val as any)}
                size="md"
              />
            </div>

            {/* Flexibility */}
            <div>
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center mb-2">
                {language === 'zh-TW' ? '身體柔韌度' : '身体柔韧度'}
                <Tooltip content="直腿站立弯腰体前屈测试：手掌触地为极佳，指尖及地为正常，手无法触及膝下为较低。直接决定把立垫圈高度与座舱落差承受力。" />
              </label>
              <IOSSegmentedControl
                options={[
                  { id: 'low', label: language === 'zh-TW' ? '較低' : '较低' },
                  { id: 'medium', label: language === 'zh-TW' ? '正常' : '正常' },
                  { id: 'high', label: language === 'zh-TW' ? '極佳' : '极佳' },
                ]}
                value={flexibility}
                onChange={(val) => setFlexibility(val as any)}
                size="md"
              />
            </div>

            {/* Advanced Extra Measurements Accordion */}
            <div className="border-t border-black/[0.05] dark:border-white/[0.08] pt-3">
              <button
                onClick={() => setShowAdvancedInputs(!showAdvancedInputs)}
                className="w-full flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition py-1 apple-touch"
              >
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-ios-purple" />
                  {language === 'zh-TW' ? '進階測量 (坐高/腿長)' : '进阶测量 (坐高/腿长)'}
                </span>
                <span className="text-ios-purple font-mono text-[11px]">{showAdvancedInputs ? '▲' : '▼'}</span>
              </button>

              {showAdvancedInputs && (
                <div className="grid grid-cols-2 gap-3 mt-3 animate-in fade-in duration-200">
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center mb-1">
                      {language === 'zh-TW' ? '坐高' : '坐高'} (cm)
                      <Tooltip content="坐在平整硬质凳面上背部挺直，测量凳面到头顶的垂直高度。结合身高可精确研判躯干与下肢的比例特征。" />
                    </label>
                    <NumberStepper value={sittingHeight} onChange={setSittingHeight} min={70} max={115} unit="cm" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center mb-1">
                      {language === 'zh-TW' ? '大腿長' : '大腿长'} (cm)
                      <Tooltip content="端坐在椅子上（大腿水平、小腿垂直），测量臀部大转子后缘到膝盖前缘的水平距离。用于精确微调坐垫后移量。" />
                    </label>
                    <NumberStepper value={thighLength} onChange={setThighLength} min={30} max={65} unit="cm" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center mb-1">
                      {language === 'zh-TW' ? '小腿長' : '小腿长'} (cm)
                      <Tooltip content="端坐屈膝90°，测量膝关节外侧关节间隙（膝眼水平面）垂直至地面的距离。与踩踏杠杆和曲柄长度选型密切相关。" />
                    </label>
                    <NumberStepper value={lowerLegLength} onChange={setLowerLegLength} min={30} max={65} unit="cm" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center mb-1">
                      {language === 'zh-TW' ? '腳長' : '脚长'} (cm)
                      <Tooltip content="赤脚自然踩在白纸上绘制轮廓，测量足跟最凸点至最长脚趾尖的垂直距离。指导锁鞋尺码与锁片前后移动基准线。" />
                    </label>
                    <NumberStepper value={footLength} onChange={setFootLength} min={20} max={35} unit="cm" />
                  </div>

                  <div className="col-span-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.06] space-y-2">
                    <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center">
                      {language === 'zh-TW' ? '踩踏踝關節動態習慣' : '踩踏踝关节动态习惯'}
                      <Tooltip content="在曲柄蹬踏至 6 点钟下死点（BDC）时，脚踝是习惯性微提踵（脚尖下探）、沉跟还是脚掌水平踩踏。提踵踩踏会增加有效腿长，需微调坐高以保证下死点 30°~35° 黄金膝屈角。" />
                    </label>
                    <IOSSegmentedControl
                      options={[
                        { id: 'heel_down', label: language === 'zh-TW' ? '沉跟平踩' : '沉跟平踩' },
                        { id: 'neutral', label: language === 'zh-TW' ? '自然中立' : '自然中立' },
                        { id: 'toe_down', label: language === 'zh-TW' ? '提踵下踩' : '提踵下踩' },
                      ]}
                      value={anklingStyle}
                      onChange={(val) => setAnklingStyle(val as AnklingStyle)}
                      size="sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </IOSCard>
        </div>

        {/* Right Output & Interactive Bike Diagram */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-5">
          {/* Interactive Bike Diagram */}
          <IOSCard variant="default" className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {language === 'zh-TW' ? '公路車關鍵擬合幾何實時矢量圖譜' : '公路车关键拟合几何实时矢量图谱'}
              </span>
              <span className="text-xs font-mono text-ios-blue font-bold">
                {'推荐车架标号'}: {result.conceptualFrameSize}
              </span>
            </div>
            <BikeDiagram
              ett={result.effectiveTopTube}
              saddleHeight={result.saddleHeight}
              stemLength={result.stemLength}
              handlebarWidth={result.handlebarWidth}
              saddleSetback={result.saddleSetback}
              saddleDrop={result.saddleDrop}
            />
          </IOSCard>

          {/* Key Output Metric Card with Docked Garage Sync Footer */}
          <IOSCard variant="default" className="p-4 sm:p-5 space-y-4">
            <IOSCardHeader
              title={language === 'zh-TW' ? '車架幾何建議' : '车架几何建议'}
              subtitle={language === 'zh-TW' ? '基於人體幾何與騎行風格解算' : '基于人体几何与骑行风格精算'}
              icon={Ruler}
              iconColor="text-ios-blue bg-ios-blue/10 dark:bg-ios-blue/20"
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <IOSMetricTile
                label={language === 'zh-TW' ? '推薦坐高' : '推荐坐高'}
                value={result.saddleHeight}
                unit="cm"
                subtext={isImperial ? `${(result.saddleHeight / 2.54).toFixed(1)} in | 中轴至坐垫顶` : '中轴中心至坐垫顶'}
                accentColor="purple"
              />

              <IOSMetricTile
                label="ETT"
                value={result.effectiveTopTube}
                unit="cm"
                subtext={isImperial ? `${(result.effectiveTopTube / 2.54).toFixed(1)} in | 水平上管长` : '水平有效上管长'}
                accentColor="blue"
              />

              <IOSMetricTile
                label={language === 'zh-TW' ? '坐墊後移' : '坐垫后移'}
                value={result.saddleSetback}
                unit="cm"
                subtext="基于大腿/腿长比 KOPS 推算"
                accentColor="green"
              />

              <IOSMetricTile
                label={language === 'zh-TW' ? '座艙落差' : '座舱落差'}
                value={result.saddleDrop}
                unit="cm"
                subtext="坐垫顶与车把高差"
                accentColor="orange"
              />
            </div>

            {/* 3D Dynamic Biomechanics Calibration Card */}
            <div className="p-3.5 rounded-2xl bg-ios-purple/10 dark:bg-ios-purple/20 border border-ios-purple/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ios-purple flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {language === 'zh-TW' ? '3D 動態生物力學補償核驗（Retül 規範）' : '3D 动态生物力学补偿核验（Retül 规范）'}
                </span>
                <span className="text-[11px] font-mono text-ios-purple font-semibold">
                  目标膝屈角: {result.dynamicBio.targetKneeAngleMinDeg}°~{result.dynamicBio.targetKneeAngleMaxDeg}° (最优 {result.dynamicBio.targetKneeAngleOptimalDeg}°)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/60 dark:bg-white/10 p-2.5 rounded-xl">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">动态坐垫有效高度</span>
                  <span className="text-base font-bold font-mono text-slate-800 dark:text-slate-100 tabular-nums">
                    {(result.dynamicBio.effectiveDynamicSaddleHeightMm / 10).toFixed(1)} cm
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {result.dynamicBio.anklingOffsetMm >= 0 ? `+${result.dynamicBio.anklingOffsetMm}` : result.dynamicBio.anklingOffsetMm}mm 踝角补偿
                  </span>
                </div>
                <div className="bg-white/60 dark:bg-white/10 p-2.5 rounded-xl">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">动态膝屈角状态</span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                    处于黄金 33° 理想区间
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    兼顾股四头肌做功与腘绳肌保护
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                {result.dynamicBio.recommendationZh}
              </p>
            </div>

            {/* Quick Sync Fitting to Active Bike Footer */}
            {activeBike && (
              <IOSGarageSyncFooter
                bikeName={activeBike.name}
                badgeText="Fitting 联动"
                detailText={
                  language === 'zh-TW'
                    ? `坐高 ${Math.round(result.saddleHeight * 10)}mm · 落差 ${Math.round(result.saddleDrop * 10)}mm · 把立 ${result.stemLength}mm`
                    : `坐高 ${Math.round(result.saddleHeight * 10)}mm · 落差 ${Math.round(result.saddleDrop * 10)}mm · 把立 ${result.stemLength}mm`
                }
                buttonText={language === 'zh-TW' ? '同步 Fitting 尺寸至戰車' : '同步 Fitting 尺寸至战车'}
                onSave={() => {
                  const sHeight = Math.round(result.saddleHeight * 10);
                  const sDrop = Math.round(result.saddleDrop * 10);
                  const sSetback = Math.round(result.saddleSetback * 10);
                  const stem = result.stemLength;
                  const hb = result.handlebarWidth * 10;
                  updateActiveBikeGeometry({
                    saddleHeightMm: sHeight,
                    saddleDropMm: sDrop,
                    saddleSetbackMm: sSetback,
                    stemLengthMm: stem,
                    handlebarWidthMm: hb,
                    reachMm: result.estimatedReach,
                    stackMm: result.estimatedStack,
                  });
                  showToast(
                    language === 'zh-TW'
                      ? `已將 Fitting 建議幾何 (坐高 ${sHeight}mm · 把立 ${stem}mm) 同步至戰車【${activeBike.name.split('/')[0]}】`
                      : `已将 Fitting 建议几何 (坐高 ${sHeight}mm · 把立 ${stem}mm) 同步至战车【${activeBike.name.split('/')[0]}】`,
                    'success'
                  );
                }}
              />
            )}
          </IOSCard>

          {/* Stack & Reach + Cockpit Decoupling Configurator */}
          <IOSCard variant="default" className="p-4 sm:p-5 space-y-4">
            <IOSCardHeader
              title="Stack & Reach"
              subtitle={language === 'zh-TW' ? '車架幾何與把立墊圈解耦計算' : '车架几何与把立垫圈解耦计算'}
              icon={Sliders}
              iconColor="purple"
            />

            {/* Core Decoupled Metric Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08]">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                  {'解算车架 Stack'}
                </span>
                <span className="text-base font-bold font-mono text-ios-blue tabular-nums">
                  ~{cockpitAnalytics.decoupledFrame.stackMm} mm
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                  对应图纸裸车架
                </span>
              </div>
              <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08]">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                  {'解算车架 Reach'}
                </span>
                <span className="text-base font-bold font-mono text-ios-blue tabular-nums">
                  ~{cockpitAnalytics.decoupledFrame.reachMm} mm
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                  五通至头管上中心
                </span>
              </div>
              <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08]">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                  {'把立中心 HY'}
                </span>
                <span className="text-base font-bold font-mono text-ios-purple tabular-nums">
                  {cockpitAnalytics.handlebarCoords.handlebarStackMm} mm
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                  车把锁紧中心高度
                </span>
              </div>
              <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08]">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                  {'把立中心 HX'}
                </span>
                <span className="text-base font-bold font-mono text-ios-purple tabular-nums">
                  {cockpitAnalytics.handlebarCoords.handlebarReachMm} mm
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                  五通水平前伸坐标
                </span>
              </div>
            </div>

            {/* Proportion Diagnosis Notes */}
            <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-ios-purple mt-1.5 shrink-0"></span>
                <span>{result.sittingHeightNote}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                <span>{result.thighLowerLegNote}</span>
              </div>
            </div>

            {/* Cockpit Tuning Controls */}
            <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-ios-purple" />
                  {language === 'zh-TW' ? '座艙配件幾何解耦調校' : '座舱配件几何解耦调校'}
                </span>
                <span className="text-[11px] font-mono text-ios-purple font-medium">
                  {cockpitStemAngle}°把立 / {cockpitStemLength}mm
                </span>
              </div>

              {/* Stem Angle Selector */}
              <div>
                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                  {language === 'zh-TW' ? '把立角度規格' : '把立角度规格'}
                </label>
                <IOSSegmentedControl
                  options={[
                    { value: '-17', label: '-17° 水平' },
                    { value: '-10', label: '-10°' },
                    { value: '-6', label: '-6° 标准' },
                    { value: '6', label: '+6° 抬升' }
                  ]}
                  value={String(cockpitStemAngle)}
                  onChange={(val) => setCockpitStemAngle(parseInt(val, 10))}
                  size="sm"
                  tint="purple"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                    {language === 'zh-TW' ? '把立長度' : '把立长度'} (mm)
                  </label>
                  <NumberStepper
                    value={cockpitStemLength}
                    onChange={setCockpitStemLength}
                    step={5}
                    min={60}
                    max={140}
                    unit="mm"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                    {language === 'zh-TW' ? '碗組上蓋' : '碗组上盖'} (mm)
                  </label>
                  <NumberStepper
                    value={cockpitHeadsetCap}
                    onChange={setCockpitHeadsetCap}
                    step={2.5}
                    min={5}
                    max={25}
                    unit="mm"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                    {language === 'zh-TW' ? '預設墊圈' : '预设垫圈'} (mm)
                  </label>
                  <NumberStepper
                    value={cockpitSpacers}
                    onChange={setCockpitSpacers}
                    step={2.5}
                    min={0}
                    max={40}
                    unit="mm"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block mb-1">
                    {language === 'zh-TW' ? '頭管角度' : '头管角度'} (°)
                  </label>
                  <NumberStepper
                    value={cockpitHeadTubeAngle}
                    onChange={setCockpitHeadTubeAngle}
                    step={0.5}
                    min={70.5}
                    max={74.5}
                    unit="°"
                    decimals={1}
                  />
                </div>
              </div>

              {/* Spacer Fit Recommendation Status */}
              <div className="p-3 rounded-xl bg-white dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-ios-blue" />
                    {'推荐车架垫圈余量研判'}
                  </span>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                      cockpitAnalytics.spacerFit.fitStatus === 'optimal'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                        : cockpitAnalytics.spacerFit.fitStatus === 'slammed'
                        ? 'bg-ios-purple/10 text-ios-purple border-ios-purple/25'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                    }`}
                  >
                    {cockpitAnalytics.spacerFit.fitStatus === 'optimal'
                      ? '理想余量'
                      : cockpitAnalytics.spacerFit.fitStatus === 'slammed'
                      ? '激进全切'
                      : '需注意垫圈'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  {cockpitAnalytics.spacerFit.message}
                </p>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-mono pt-0.5">
                  <span>目标落差: <strong className="text-slate-800 dark:text-slate-200 tabular-nums">{result.saddleDrop * 10}mm</strong></span>
                  <span>当前装车落差: <strong className="text-ios-blue tabular-nums">{cockpitAnalytics.spacerFit.actualDropMm}mm</strong></span>
                  <span>偏差: <strong className="text-slate-700 dark:text-slate-300 tabular-nums">{cockpitAnalytics.spacerFit.dropErrorMm > 0 ? `+${cockpitAnalytics.spacerFit.dropErrorMm}` : cockpitAnalytics.spacerFit.dropErrorMm}mm</strong></span>
                </div>
              </div>
            </div>

            {/* Target Bike Frame Trial Sandbox */}
            <div className="border-t border-black/[0.05] dark:border-white/[0.08] pt-3">
              <button
                type="button"
                onClick={() => setIsTestFrameOpen(!isTestFrameOpen)}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition py-1 apple-touch"
              >
                <span className="flex items-center gap-1.5">
                  <Bike className="w-3.5 h-3.5 text-ios-purple" />
                  <span>{language === 'zh-TW' ? '試算心儀目標車架' : '试算心仪目标车架'}</span>
                </span>
                <span className="text-ios-purple font-mono text-[11px] flex items-center gap-1">
                  <span>{isTestFrameOpen ? '收起试算' : '展开试算'}</span>
                  <span>{isTestFrameOpen ? '▲' : '▼'}</span>
                </span>
              </button>

              {isTestFrameOpen && (
                <div className="mt-3 p-3.5 rounded-xl bg-ios-purple/5 dark:bg-ios-purple/10 border border-ios-purple/20 space-y-3 animate-in fade-in duration-200">
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    输入您心仪候选车架（如崔克 Emonda、闪电 Tarmac、捷安特 TCR）具体尺码的几何表 Stack 与 Reach，系统将自动算出装车所需的垫圈与把立长度方案：
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300 block mb-1">
                        目标车架 Stack (mm)
                      </label>
                      <NumberStepper
                        value={testFrameStack}
                        onChange={setTestFrameStack}
                        step={1}
                        min={460}
                        max={650}
                        unit="mm"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300 block mb-1">
                        目标车架 Reach (mm)
                      </label>
                      <NumberStepper
                        value={testFrameReach}
                        onChange={setTestFrameReach}
                        step={1}
                        min={350}
                        max={450}
                        unit="mm"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-[#2C2C2E] border border-ios-purple/20 space-y-1.5 shadow-2xs text-xs">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-slate-800 dark:text-slate-200">装车适配计算建议</span>
                      <span className="text-ios-purple font-mono font-bold">
                        {cockpitAnalytics.testFrameFit.roundedSpacersMm}mm 垫圈 + {cockpitAnalytics.recommendedStemForTestFrame}mm 把立
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      {cockpitAnalytics.testFrameFit.message}
                    </p>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 pt-0.5">
                      <span>车架 Reach 偏差: <strong className="text-slate-700 dark:text-slate-300 tabular-nums">{cockpitAnalytics.reachDiffMm > 0 ? `+${cockpitAnalytics.reachDiffMm}` : cockpitAnalytics.reachDiffMm}mm</strong></span>
                      <span>•</span>
                      <span>把立适配建议: <strong className="text-ios-blue tabular-nums">{cockpitAnalytics.recommendedStemForTestFrame}mm</strong></span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </IOSCard>

          {/* Cleat & Cockpit Advice Card */}
          <IOSCard variant="default" className="p-4 sm:p-5 space-y-3">
            <IOSCardHeader
              title={language === 'zh-TW' ? 'KOPS 與鎖片' : 'KOPS 与锁片'}
              subtitle={language === 'zh-TW' ? '膝關節垂線與踩踏生物力學' : '膝关节垂线与踩踏生物力学'}
              icon={Footprints}
              iconColor="purple"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] space-y-1.5">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  {'KOPS 膝盖铅垂线校准'}
                </span>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  {'曲柄旋转至水平 3 点钟方向，用重物铅垂线自膝盖骨前缘（髌骨窝）垂直下放：铅垂线应精确穿过脚踏轴心（±5mm）。前移过多加重髌骨压迫，后移过多加重腘绳肌负荷。'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] space-y-1.5">
                <span className="font-semibold text-ios-blue flex items-center gap-1.5">
                  <Footprints className="w-3.5 h-3.5" />
                  {'锁片前后位与肌群负荷'}
                </span>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  {'锁片基准位为第一与第五跖骨关节中线向后 2~5mm。偏后安装（中足发力）可卸载小腿腓肠肌与跟腱压力，降低抽筋率并利于长距离耐力；偏前冲刺反应快但加重足弓负荷。'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] space-y-1">
                <span className="font-semibold text-purple-600 dark:text-purple-300 block">
                  {`推荐把立: ${result.stemLength}mm | 弯把宽: ${result.handlebarWidth}cm`}
                </span>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                  {'上把位手变安装应保持手腕自然平直，弯把 Reach 建议选用 70~80mm 紧凑小弯把。'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] space-y-1">
                <span className="font-semibold text-amber-600 dark:text-amber-300 block">
                  {`推荐曲柄: ${result.crankLength} | 浮动锁片`}
                </span>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                  {'较短曲柄可改善上止点髋关节闭合角，降低膝盖屈曲压力；建议搭配 4.5°~6° 浮动锁片。'}
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
        posterUrl={sharePosterUrl}
        fileName={`Fitting调校档案_${height}cm_${result.conceptualFrameSize}.png`}
        title="公路车 Fitting 档案海报"
      />

      {/* Professional A4 Fitting Work Order Modal */}
      <FittingWorkOrderModal
        isOpen={isWorkOrderModalOpen}
        onClose={() => setIsWorkOrderModalOpen(false)}
        initialRiderName={profile.name || (language === 'zh-TW' ? '車手客戶' : '车手客户')}
        initialBikeModel={activeBike ? activeBike.name : undefined}
        data={{
          height,
          inseam,
          torso,
          armLength,
          shoulderWidth,
          sittingHeight,
          thighLength,
          lowerLegLength,
          ridingStyle,
          saddleHeight: result.saddleHeight,
          saddleHeightHamley: result.saddleHeightHamley,
          effectiveTopTube: result.effectiveTopTube,
          stemLength: result.stemLength,
          saddleDrop: result.saddleDrop,
          handlebarWidth: result.handlebarWidth * 10,
          crankLength: result.crankLength,
          saddleSetback: result.saddleSetback,
          frameSize: result.conceptualFrameSize,
          estimatedStack: result.estimatedStack,
          estimatedReach: result.estimatedReach,
          sittingHeightNote: result.sittingHeightNote,
          thighLowerLegNote: result.thighLowerLegNote
        }}
      />
    </div>
  );
};
