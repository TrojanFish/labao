import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  ShieldAlert,
  CheckCircle2,
  Wrench,
  Heart,
  CheckSquare,
  Square,
  Search,
  RotateCcw,
  Sparkles,
  PersonStanding,
  Shield,
  Hand,
  Disc,
  Footprints,
  ArrowRight,
  ArrowLeft,
  Clock,
  Dumbbell,
  BookOpen,
  Check
} from 'lucide-react';
import {
  PAIN_AREAS,
  GENERAL_RECOVERY_TIPS,
  TIMING_SCENARIOS,
  getPainPrescription,
  PainTimingScenario
} from '../../data/painCheckerData';
import { BodyPainDiagram } from '../common/BodyPainDiagram';
import { IOSCard, IOSCardHeader } from '../common/IOSCard';
import { IOSToolHeader } from '../common/IOSToolHeader';
import { IOSSegmentedControl } from '../common/IOSSegmentedControl';
import { ShareCardModal } from '../common/ShareCardModal';
import { generatePainCheckPoster } from '../../utils/shareCardGenerators';
import { useToast } from '../../context/ToastContext';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';

const areaIconMap: Record<string, React.FC<{ className?: string }>> = {
  knee: Activity,
  lower_back: PersonStanding,
  neck_shoulder: Shield,
  wrist_hand: Hand,
  buttock: Disc,
  foot: Footprints,
};

export const RoadBikePainChecker: React.FC = () => {
  const { showToast } = useToast();
  const { language } = useLanguageAndUnit();

  // Mode: 3-step guided wizard vs full reference library
  const [activeMode, setActiveMode] = useState<'wizard' | 'overview'>('wizard');

  // Wizard state
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [selectedAreaId, setSelectedAreaId] = useState<string>('knee');
  const [selectedTiming, setSelectedTiming] = useState<PainTimingScenario>('early_ride');

  // Search & checklist state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sharePosterUrl, setSharePosterUrl] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [completedChecks, setCompletedChecks] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('yolo_cycling_pain_checks');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const activeArea = PAIN_AREAS[selectedAreaId] || PAIN_AREAS.knee;
  const prescription = useMemo(
    () => getPainPrescription(selectedAreaId, selectedTiming),
    [selectedAreaId, selectedTiming]
  );

  useEffect(() => {
    try {
      localStorage.setItem('yolo_cycling_pain_checks', JSON.stringify(completedChecks));
    } catch {
      // Storage quota exceeded or disabled; keep in memory
    }
  }, [completedChecks]);

  const toggleCheck = (idxKey: string) => {
    setCompletedChecks(prev => ({
      ...prev,
      [idxKey]: !prev[idxKey]
    }));
  };

  const resetCurrentAreaChecks = () => {
    setCompletedChecks(prev => {
      const copy = { ...prev };
      activeArea.specificSelfCheck.forEach((_, idx) => {
        delete copy[`${selectedAreaId}_${idx}`];
      });
      return copy;
    });
    showToast(language === 'zh-TW' ? '已重設當前部位的所有排查勾選！' : '已重置当前部位的所有排查勾选！', 'info');
  };

  // Search filter across all pain areas
  const matchingAreaIds = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return Object.entries(PAIN_AREAS).filter(([_, item]) => {
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchSymptoms = item.symptoms.some(s => s.toLowerCase().includes(q));
      const matchChecks = item.specificSelfCheck.some(c => c.toLowerCase().includes(q));
      return matchTitle || matchSymptoms || matchChecks;
    }).map(([id]) => id);
  }, [searchQuery]);

  // Check progress
  const checkedCount = activeArea.specificSelfCheck.filter((_, idx) => completedChecks[`${selectedAreaId}_${idx}`]).length;
  const totalChecks = activeArea.specificSelfCheck.length;
  const progressPct = totalChecks > 0 ? Math.round((checkedCount / totalChecks) * 100) : 0;

  const handleGeneratePoster = () => {
    const url = generatePainCheckPoster({
      areaTitle: `${activeArea.title} · ${
        TIMING_SCENARIOS.find(s => s.id === selectedTiming)?.badge || '专属调车处方'
      }`,
      checkedCount,
      totalChecks,
      progressPct,
      causes: [
        { category: '诊断判定与生物力学机理', details: [prescription.diagnosis, prescription.mechanism] },
        ...activeArea.commonCauses
      ],
      checklist: prescription.mechanicalAdjustments
    });
    setSharePosterUrl(url);
    setIsShareModalOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Unified Tool Header */}
      <IOSToolHeader
        category={language === 'zh-TW' ? '人車工效' : '人车工效'}
        categoryIcon={Activity}
        title={language === 'zh-TW' ? '痛點診斷' : '痛点诊断'}
        description="覆盖膝盖、腰背、颈肩、手腕、臀部及足底 6 大核心部位，3步科学排查车辆设定成因并提供调车处方与拉伸方案。"
        tint="purple"
        onShare={handleGeneratePoster}
        shareTitle={language === 'zh-TW' ? '生成調車處方' : '生成调车处方'}
      />

      {/* Mode Switcher */}
      <div className="flex justify-center sm:justify-start">
        <IOSSegmentedControl
          value={activeMode}
          onChange={(m) => setActiveMode(m)}
          options={[
            {
              value: 'wizard',
              label: language === 'zh-TW' ? '3步排查嚮導' : '3步排查向导',
              icon: Sparkles
            },
            {
              value: 'overview',
              label: language === 'zh-TW' ? '部位知識全覽' : '部位知识全览',
              icon: BookOpen
            }
          ]}
          tint="purple"
          mobileFullWidth
        />
      </div>

      {activeMode === 'wizard' ? (
        /* ================= 3-STEP INTERACTIVE WIZARD ================= */
        <div className="space-y-4 sm:space-y-5">
          {/* Step Breadcrumb Progress Strip */}
          <IOSCard variant="default" className="p-3 sm:p-4">
            <div className="flex items-center justify-between max-w-xl mx-auto">
              {/* Step 1 */}
              <button
                onClick={() => setWizardStep(1)}
                className={`apple-touch flex items-center gap-2 text-xs font-semibold transition ${
                  wizardStep === 1
                    ? 'text-ios-purple font-bold'
                    : wizardStep > 1
                    ? 'text-slate-800 dark:text-slate-200'
                    : 'text-slate-400 dark:text-slate-600'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                  wizardStep === 1
                    ? 'bg-ios-purple text-white shadow-ios-sm shadow-ios-purple/30'
                    : wizardStep > 1
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-black/[0.05] dark:bg-white/[0.08] text-slate-400'
                }`}>
                  {wizardStep > 1 ? <Check className="w-3.5 h-3.5" /> : '1'}
                </span>
                <span>{language === 'zh-TW' ? '選擇部位' : '选择部位'}</span>
              </button>

              <div className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${
                wizardStep >= 2 ? 'bg-ios-purple' : 'bg-black/[0.06] dark:bg-white/[0.08]'
              }`} />

              {/* Step 2 */}
              <button
                onClick={() => {
                  if (wizardStep >= 2) setWizardStep(2);
                }}
                className={`apple-touch flex items-center gap-2 text-xs font-semibold transition ${
                  wizardStep === 2
                    ? 'text-ios-purple font-bold'
                    : wizardStep > 2
                    ? 'text-slate-800 dark:text-slate-200'
                    : 'text-slate-400 dark:text-slate-600'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                  wizardStep === 2
                    ? 'bg-ios-purple text-white shadow-ios-sm shadow-ios-purple/30'
                    : wizardStep > 2
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'bg-black/[0.05] dark:bg-white/[0.08] text-slate-400'
                }`}>
                  {wizardStep > 2 ? <Check className="w-3.5 h-3.5" /> : '2'}
                </span>
                <span>{language === 'zh-TW' ? '騎行情境' : '骑行情境'}</span>
              </button>

              <div className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${
                wizardStep >= 3 ? 'bg-ios-purple' : 'bg-black/[0.06] dark:bg-white/[0.08]'
              }`} />

              {/* Step 3 */}
              <button
                onClick={() => {
                  if (wizardStep === 3) setWizardStep(3);
                }}
                className={`apple-touch flex items-center gap-2 text-xs font-semibold transition ${
                  wizardStep === 3
                    ? 'text-ios-purple font-bold'
                    : 'text-slate-400 dark:text-slate-600'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                  wizardStep === 3
                    ? 'bg-ios-purple text-white shadow-ios-sm shadow-ios-purple/30'
                    : 'bg-black/[0.05] dark:bg-white/[0.08] text-slate-400'
                }`}>
                  3
                </span>
                <span>{language === 'zh-TW' ? '調車處方' : '调车处方'}</span>
              </button>
            </div>
          </IOSCard>

          {/* STEP 1: Select Area */}
          {wizardStep === 1 && (
            <IOSCard variant="default" className="p-4 sm:p-5 space-y-4">
              <IOSCardHeader
                title={language === 'zh-TW' ? '第 1 步：請選擇身體不適部位' : '第 1 步：请选择身体不适部位'}
                subtitle={language === 'zh-TW' ? '點擊您在騎行中感到酸痛、麻木或受限的區域' : '点击您在骑行中感到酸痛、麻木或受限的区域'}
                icon={Activity}
                iconColor="purple"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(PAIN_AREAS).map(([key, area]) => {
                  const AreaIcon = areaIconMap[key] || Activity;
                  const isSelected = selectedAreaId === key;

                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedAreaId(key);
                        setWizardStep(2);
                      }}
                      className={`apple-touch p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 group relative ${
                        isSelected
                          ? 'border-ios-purple bg-ios-purple/10 shadow-ios-sm ring-1 ring-ios-purple/40'
                          : 'border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] hover:border-ios-purple/40 hover:bg-black/[0.04]'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-ios-purple text-white shadow-ios-sm'
                              : 'bg-ios-purple/10 text-ios-purple'
                          }`}>
                            <AreaIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              {area.title}
                            </h4>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                              {area.symptoms.length} 项典型表现
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-ios-purple group-hover:translate-x-0.5 transition-all" />
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {area.symptoms[0]}
                      </p>
                    </button>
                  );
                })}
              </div>
            </IOSCard>
          )}

          {/* STEP 2: Select Timing & Riding Context */}
          {wizardStep === 2 && (
            <IOSCard variant="default" className="p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.08] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-ios-purple/10 text-ios-purple flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{language === 'zh-TW' ? '第 2 步：疼痛誘發時機與騎行情境' : '第 2 步：疼痛诱发时机与骑行情境'}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-ios-purple/15 text-ios-purple font-medium">
                        {activeArea.title}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {language === 'zh-TW'
                        ? '疼痛出現的時機直接決定了是「靜態尺寸偏差」還是「核心疲勞代償」'
                        : '疼痛出现的时机直接决定了是「静态尺寸偏差」还是「核心疲劳代偿」'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setWizardStep(1)}
                  className="apple-touch text-xs text-ios-purple hover:underline self-start sm:self-auto flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {language === 'zh-TW' ? '更換部位' : '更换部位'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TIMING_SCENARIOS.map((sc) => {
                  const isSelected = selectedTiming === sc.id;

                  return (
                    <button
                      key={sc.id}
                      onClick={() => {
                        setSelectedTiming(sc.id);
                        setWizardStep(3);
                      }}
                      className={`apple-touch p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2.5 relative group ${
                        isSelected
                          ? 'border-ios-purple bg-ios-purple/10 shadow-ios-sm ring-1 ring-ios-purple/40'
                          : 'border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] hover:border-ios-purple/40 hover:bg-black/[0.04]'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isSelected
                            ? 'bg-ios-purple text-white'
                            : 'bg-black/[0.06] dark:bg-white/[0.1] text-slate-700 dark:text-slate-300'
                        }`}>
                          {sc.badge}
                        </span>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-ios-purple group-hover:translate-x-0.5 transition-all" />
                      </div>

                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                          {sc.title}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {sc.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setWizardStep(1)}
                  className="apple-touch h-9 px-4 rounded-xl border border-black/[0.08] dark:border-white/[0.12] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-black/[0.04] flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {language === 'zh-TW' ? '返回上一步' : '返回上一步'}
                </button>
                <button
                  onClick={() => setWizardStep(3)}
                  className="apple-touch h-9 px-4 rounded-xl bg-ios-purple text-white text-xs font-semibold shadow-ios-sm flex items-center gap-1.5"
                >
                  <span>{language === 'zh-TW' ? '查看調車處方' : '查看调车处方'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </IOSCard>
          )}

          {/* STEP 3: Prescriptions, Adjustments & Rehab Plan */}
          {wizardStep === 3 && (
            <div className="space-y-4 sm:space-y-5">
              {/* Context Summary Bar */}
              <IOSCard variant="default" className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-ios-purple/10 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-ios-purple text-white flex items-center justify-center shrink-0 shadow-ios-sm">
                    {(() => {
                      const AreaIcon = areaIconMap[selectedAreaId] || Activity;
                      return <AreaIcon className="w-5 h-5" />;
                    })()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {activeArea.title}
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-ios-purple/20 text-ios-purple">
                        {TIMING_SCENARIOS.find(s => s.id === selectedTiming)?.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {TIMING_SCENARIOS.find(s => s.id === selectedTiming)?.title}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => setWizardStep(2)}
                    className="apple-touch h-9 px-3 rounded-xl border border-black/[0.08] dark:border-white/[0.12] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-black/[0.04] flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    {language === 'zh-TW' ? '改選時機' : '改选时机'}
                  </button>
                  <button
                    onClick={() => setWizardStep(1)}
                    className="apple-touch h-9 px-3 rounded-xl border border-black/[0.08] dark:border-white/[0.12] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-black/[0.04] flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {language === 'zh-TW' ? '重新排查' : '重新排查'}
                  </button>
                </div>
              </IOSCard>

              {/* Diagnosis & Biomechanics Mechanism */}
              <IOSCard variant="default" className="p-4 sm:p-5 space-y-3">
                <IOSCardHeader
                  title={language === 'zh-TW' ? '診斷結論與力學成因' : '诊断结论与力学成因'}
                  subtitle={language === 'zh-TW' ? '生物力學機理剖析' : '生物力学机理剖析'}
                  icon={ShieldAlert}
                  iconColor="purple"
                />

                <div className="p-3.5 rounded-xl bg-ios-purple/10 border border-ios-purple/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-ios-purple"></span>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      {prescription.diagnosis}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed pl-4">
                    {prescription.mechanism}
                  </p>
                </div>
              </IOSCard>

              {/* Two-Column Grid: Mechanical Adjustments + Riding Posture */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                {/* 1. Mechanical Adjustments */}
                <IOSCard variant="default" className="p-4 sm:p-5 space-y-3">
                  <IOSCardHeader
                    title={language === 'zh-TW' ? '戰車幾何與部件定向微調' : '战车几何与部件定向微调'}
                    subtitle={language === 'zh-TW' ? '具體數值與物理設定建議' : '具体数值与物理设定建议'}
                    icon={Wrench}
                    iconColor="blue"
                  />
                  <div className="space-y-2.5">
                    {prescription.mechanicalAdjustments.map((adj, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] flex items-start gap-2.5 text-xs text-slate-800 dark:text-slate-200"
                      >
                        <span className="w-5 h-5 rounded-lg bg-ios-blue/15 text-ios-blue font-bold flex items-center justify-center shrink-0 text-[11px]">
                          {idx + 1}
                        </span>
                        <p className="leading-relaxed">{adj}</p>
                      </div>
                    ))}
                  </div>
                </IOSCard>

                {/* 2. Riding Habits & Posture */}
                <IOSCard variant="default" className="p-4 sm:p-5 space-y-3">
                  <IOSCardHeader
                    title={language === 'zh-TW' ? '發力習慣與體態校正' : '发力习惯与体态校正'}
                    subtitle={language === 'zh-TW' ? '踩踏動力鏈與肌肉卸力技巧' : '踩踏动力链与肌肉卸力技巧'}
                    icon={Activity}
                    iconColor="green"
                  />
                  <div className="space-y-2.5">
                    {prescription.ridingAdjustments.map((radj, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] flex items-start gap-2.5 text-xs text-slate-800 dark:text-slate-200"
                      >
                        <span className="w-5 h-5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                          ✓
                        </span>
                        <p className="leading-relaxed">{radj}</p>
                      </div>
                    ))}
                  </div>
                </IOSCard>
              </div>

              {/* 3. Targeted Stretch & Rehab Exercises */}
              <IOSCard variant="default" className="p-4 sm:p-5 space-y-3">
                <IOSCardHeader
                  title={language === 'zh-TW' ? '專屬康復與拉伸處方' : '专属康复与拉伸处方'}
                  subtitle={language === 'zh-TW' ? '騎行後肌筋膜放鬆與主動牽引動作' : '骑行后肌筋膜放松与主动牵引动作'}
                  icon={Dumbbell}
                  iconColor="purple"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {prescription.stretchExercises.map((ex, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-ios-purple"></span>
                          {ex.name}
                        </h4>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-ios-purple/15 text-ios-purple font-mono font-bold">
                          {ex.duration}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">目标肌群：</span>
                        {ex.target}
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-black/[0.02] dark:bg-white/[0.02] p-2.5 rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
                        {ex.instructions}
                      </p>
                    </div>
                  ))}
                </div>
              </IOSCard>

              {/* 4. Action Checklist */}
              <IOSCard variant="default" className="p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <IOSCardHeader
                    title={language === 'zh-TW' ? '處方落地自查清單' : '处方落地自查清单'}
                    subtitle={language === 'zh-TW' ? '排查並標記已落實的調教項目' : '排查并标记已落实的调教项目'}
                    icon={CheckCircle2}
                    iconColor="green"
                  />
                  {checkedCount > 0 && (
                    <button
                      onClick={resetCurrentAreaChecks}
                      className="apple-touch flex items-center gap-1 text-[11px] text-slate-500 hover:text-rose-500 transition"
                    >
                      <RotateCcw className="w-3 h-3" />
                      {language === 'zh-TW' ? '重設勾選' : '重置勾选'}
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {prescription.mechanicalAdjustments.map((item, idx) => {
                    const key = `${selectedAreaId}_wiz_${idx}`;
                    const isChecked = !!completedChecks[key];

                    return (
                      <div
                        key={idx}
                        onClick={() => toggleCheck(key)}
                        className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition apple-touch ${
                          isChecked
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-slate-500 line-through'
                            : 'bg-black/[0.02] dark:bg-white/[0.04] border-black/[0.05] dark:border-white/[0.08] text-slate-800 dark:text-slate-200 hover:border-black/10 dark:hover:border-white/15'
                        }`}
                      >
                        <span className="mt-0.5 text-emerald-500 dark:text-emerald-400 shrink-0">
                          {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-400 dark:text-slate-600" />}
                        </span>
                        <p className={`text-xs leading-relaxed ${isChecked ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
                          {item}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </IOSCard>

              {/* Bottom Floating/Action Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => setWizardStep(2)}
                  className="apple-touch h-9 w-full sm:w-auto px-4 rounded-xl border border-black/[0.08] dark:border-white/[0.12] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-black/[0.04] flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {language === 'zh-TW' ? '返回修改時機' : '返回修改时机'}
                </button>

                <button
                  onClick={handleGeneratePoster}
                  className="apple-touch h-9 w-full sm:w-auto px-5 rounded-xl bg-ios-purple text-white text-xs font-semibold shadow-ios-sm shadow-ios-purple/30 flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {language === 'zh-TW' ? '生成專屬調車處方卡' : '生成专属调车处方卡'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ================= FULL OVERVIEW REFERENCE MODE ================= */
        <div className="space-y-4 sm:space-y-5">
          {/* Search & Area Selection Card */}
          <IOSCard variant="default" className="space-y-3.5">
            {/* Apple Spotlight Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={language === 'zh-TW' ? '搜尋不適部位或症狀 (如髕骨、手麻)...' : '搜索不适部位或症状 (如髌骨、手麻)...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 bg-black/[0.04] dark:bg-white/[0.07] border border-black/[0.05] dark:border-white/[0.08] rounded-xl pl-8.5 pr-4 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-ios-purple transition"
              />
              {searchQuery && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ios-purple font-mono">
                  匹配到 {matchingAreaIds.length} 个部位
                </span>
              )}
            </div>

            {/* Body Area Navigation Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-0.5">
              {Object.entries(PAIN_AREAS).map(([key, item]) => {
                const isMatch = matchingAreaIds.includes(key);
                const isSelected = selectedAreaId === key;

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedAreaId(key)}
                    className={`apple-touch p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 relative active:scale-95 ${
                      isSelected
                        ? 'bg-ios-red text-white border-ios-red shadow-ios-sm shadow-ios-red/25 ring-2 ring-ios-red/30 font-bold scale-[1.02] z-10'
                        : isMatch
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-300 font-semibold ring-1 ring-amber-500/30'
                        : 'bg-black/[0.03] dark:bg-white/[0.06] border-black/[0.05] dark:border-white/[0.06] text-slate-700 dark:text-slate-300 hover:bg-black/[0.06] dark:hover:bg-white/[0.1]'
                    }`}
                  >
                    {isMatch && !isSelected && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white dark:ring-[#1C1C1E]" />
                    )}
                    {(() => {
                      const AreaIcon = areaIconMap[key] || Activity;
                      return (
                        <AreaIcon
                          className={`w-4 h-4 transition-colors ${
                            isSelected
                              ? 'text-white'
                              : isMatch
                              ? 'text-amber-500 dark:text-amber-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        />
                      );
                    })()}
                    <span className={`text-xs ${isSelected ? 'text-white font-bold' : ''}`}>{item.title.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </IOSCard>

          {/* Main Analysis Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
            {/* Left Column: Symptoms & Interactive Body Map */}
            <div className="lg:col-span-5 space-y-4 sm:space-y-5">
              {/* Interactive Body Visualizer */}
              <BodyPainDiagram
                selectedAreaId={selectedAreaId}
                onSelectArea={(id) => setSelectedAreaId(id)}
              />

              {/* Symptoms Card */}
              <IOSCard variant="default" className="space-y-4">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  常见不适症状表现 ({activeArea.title.split(' ')[0]})
                </h2>
                <div className="space-y-2.5">
                  {activeArea.symptoms.map((sym, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-slate-700 dark:text-slate-200 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 mt-1.5 shrink-0"></span>
                      <span className="leading-relaxed">{sym}</span>
                    </div>
                  ))}
                </div>
              </IOSCard>
            </div>

            {/* Right Column: Step by Step Action Plan & Checklist */}
            <div className="lg:col-span-7 space-y-4 sm:space-y-5">
              {/* Specific Self-Check Action Items with Checklist */}
              <IOSCard variant="default" className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                    针对性自查与调车清单 ({checkedCount}/{totalChecks} 已排查)
                  </h2>
                  {checkedCount > 0 && (
                    <button
                      onClick={resetCurrentAreaChecks}
                      className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-rose-500 self-start sm:self-auto transition apple-touch"
                    >
                      <RotateCcw className="w-3 h-3" />
                      重置勾选
                    </button>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  ></div>
                </div>

                <div className="space-y-2.5">
                  {activeArea.specificSelfCheck.map((item, idx) => {
                    const key = `${selectedAreaId}_${idx}`;
                    const isChecked = !!completedChecks[key];

                    return (
                      <div
                        key={idx}
                        onClick={() => toggleCheck(key)}
                        className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition apple-touch ${
                          isChecked
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-slate-500 line-through'
                            : 'bg-black/[0.02] dark:bg-white/[0.04] border-black/[0.05] dark:border-white/[0.08] text-slate-800 dark:text-slate-200 hover:border-black/10 dark:hover:border-white/15'
                        }`}
                      >
                        <span className="mt-0.5 text-emerald-500 dark:text-emerald-400 shrink-0">
                          {isChecked ? <CheckSquare className="w-4.5 h-4.5" /> : <Square className="w-4.5 h-4.5 text-slate-400 dark:text-slate-600" />}
                        </span>
                        <p className={`text-xs leading-relaxed ${isChecked ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
                          {item}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </IOSCard>

              {/* Root Causes Accordion / List */}
              <IOSCard variant="default" className="space-y-4">
                <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-ios-blue" />
                  根源成因深度剖析
                </h2>
                <div className="space-y-3">
                  {activeArea.commonCauses.map((cause, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] space-y-2">
                      <h3 className="text-xs font-bold text-ios-blue flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-ios-blue"></span>
                        {cause.category}
                      </h3>
                      <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 pl-3.5 list-disc">
                        {cause.details.map((d, dIdx) => (
                          <li key={dIdx} className="leading-relaxed">{d}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </IOSCard>

              {/* General Rehabilitation & Care Tips */}
              <IOSCard variant="default" className="space-y-4">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                  运动康复与损伤预防通用法则
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {GENERAL_RECOVERY_TIPS.map((tip, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] space-y-1.5">
                      <h4 className="text-xs font-semibold text-rose-500 dark:text-rose-400">{tip.title}</h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">{tip.content}</p>
                    </div>
                  ))}
                </div>
              </IOSCard>
            </div>
          </div>
        </div>
      )}

      {/* Social Share Poster Modal */}
      <ShareCardModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        imageUrl={sharePosterUrl}
        title="骑行疼痛自诊处方卡"
        downloadFileName={`LaBao_疼痛自诊_${activeArea.title.split(' ')[0]}.png`}
      />
    </div>
  );
};
