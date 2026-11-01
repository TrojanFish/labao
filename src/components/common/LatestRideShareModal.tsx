import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  Sparkles,
  Image as ImageIcon,
  FileText,
  Zap,
  Mountain,
  Gauge,
  Sun
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';
import {
  LatestRidePosterData,
  LatestRidePosterTheme,
  generateLatestRideSocialPoster
} from '../../utils/shareCardGenerators';

interface LatestRideShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  posterUrl?: string | null;
  data: LatestRidePosterData | null;
  initialTheme?: LatestRidePosterTheme;
}

export const LatestRideShareModal: React.FC<LatestRideShareModalProps> = ({
  isOpen,
  onClose,
  posterUrl: initialPosterUrl,
  data,
  initialTheme = 'conqueror'
}) => {
  const { showToast } = useToast();
  const { language } = useLanguageAndUnit();

  // Active Poster Theme: 3 Distinct Styles
  const [selectedTheme, setSelectedTheme] = useState<LatestRidePosterTheme>(initialTheme);
  const [themePosters, setThemePosters] = useState<Partial<Record<LatestRidePosterTheme, string>>>({});
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const [hasCopiedImage, setHasCopiedImage] = useState(false);
  const [hasCopiedText, setHasCopiedText] = useState(false);
  const [selectedCopyTab, setSelectedCopyTab] = useState<'conquer' | 'lifestyle' | 'geek'>('conquer');

  // Initialize or update poster cache when modal opens
  useEffect(() => {
    if (isOpen && data) {
      if (initialPosterUrl && !themePosters[initialTheme]) {
        setThemePosters(prev => ({ ...prev, [initialTheme]: initialPosterUrl }));
      }
    }
  }, [isOpen, initialPosterUrl, initialTheme, data, themePosters]);

  // Handle theme switching with real-time generation & automatic copywriting linkage
  const handleThemeChange = async (theme: LatestRidePosterTheme) => {
    setSelectedTheme(theme);

    // Social Copywriting Linkage (文案自动联动)
    if (theme === 'conqueror') {
      setSelectedCopyTab('conquer');
    } else if (theme === 'neon-dawn') {
      setSelectedCopyTab('lifestyle');
    } else if (theme === 'racing') {
      setSelectedCopyTab('geek');
    }

    if (!data) return;

    // Check cache
    if (!themePosters[theme]) {
      setIsGenerating(true);
      try {
        const url = await generateLatestRideSocialPoster(data, theme);
        setThemePosters(prev => ({ ...prev, [theme]: url }));
      } catch {
        showToast(language === 'zh-TW' ? '海報渲染失敗' : '海报渲染失败', 'error');
      } finally {
        setIsGenerating(false);
      }
    }
  };

  // Current active poster image
  const currentPosterUrl = themePosters[selectedTheme] || initialPosterUrl;

  // iOS Pull-Down to Dismiss Gesture State
  const [dragY, setDragY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const touchStartY = useRef<number>(0);
  const currentDragY = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaY = e.touches[0].clientY - touchStartY.current;
    if (deltaY > 0) {
      currentDragY.current = deltaY;
      setDragY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (currentDragY.current > 75) {
      onClose();
    }
    setDragY(0);
    currentDragY.current = 0;
  };

  // Generate 3 sets of social bragging copy tailored to data
  const socialCopies = useMemo(() => {
    if (!data) return { conquer: '', lifestyle: '', geek: '' };

    const wKgStr = data.wKg ? ` (${data.wKg} W/kg)` : '';
    const hrStr = data.avgHr ? ` | 均心率 ${data.avgHr} bpm` : '';
    const eiffelStr = (data.eleM / 300).toFixed(1);

    if (language === 'zh-TW') {
      return {
        conquer: `${data.title} | ${data.distKm} km | 累計爬升 +${data.eleM} m · 直拔 ${eiffelStr} 座艾菲爾鐵塔 | NP ${data.np} W${wKgStr} | IF ${data.ifVal} | TSS ${data.tss}。山就在那裡，雙腿是丈量大地的唯一標尺。征服收官。`,
        lifestyle: `清晨 05:30 的晨風與破曉日出，是對抗平庸生活的最好解藥。${data.distKm} km 晨風刷街完畢，均速 ${data.avgSpeed} km/h，爬升 +${data.eleM}m，滿電開啟搬磚模式！清晨的風，是世界給自律者最好的紅包。`,
        geek: `本想晨騎排個酸，不小心均速幹到了 ${data.avgSpeed} km/h。NP ${data.np}W${wKgStr} 穩態巡航 ${data.distKm} 公里，VI ${data.vi} 平穩如水，IF ${data.ifVal}，TSS ${data.tss}${hrStr}。今天這風阻很禮貌。`
      };
    }

    return {
      conquer: `${data.title} | ${data.distKm} km | 累计爬升 +${data.eleM} m · 直拔 ${eiffelStr} 座埃菲尔铁塔 | NP ${data.np} W${wKgStr} | IF ${data.ifVal} | TSS ${data.tss}。山就在那里，双腿是丈量大地的唯一标尺。征服收官。`,
      lifestyle: `清晨 05:30 的晨风与破晓日出，是对抗平庸生活的最好解药。${data.distKm} km 晨风刷街完毕，均速 ${data.avgSpeed} km/h，爬升 +${data.eleM}m，满电开启搬砖模式！清晨的风，是世界给自律者最好的红包。`,
      geek: `本想晨骑排个酸，不小心均速干到了 ${data.avgSpeed} km/h。NP ${data.np}W${wKgStr} 稳态巡航 ${data.distKm} 公里，VI ${data.vi} 平稳如水，IF ${data.ifVal}，TSS ${data.tss}${hrStr}。今天这风阻很礼貌。`
    };
  }, [data, language]);

  if (!isOpen || !data) return null;

  const currentCopyText = socialCopies[selectedCopyTab];

  const handleDownload = () => {
    if (!currentPosterUrl) return;
    try {
      const a = document.createElement('a');
      a.href = currentPosterUrl;
      const cleanDate = data.dateStr.replace(/[^0-9]/g, '');
      a.download = `YoloCycling_${selectedTheme}_3x4_${cleanDate}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(language === 'zh-TW' ? '海報圖片已開始下載！' : '海报图片已开始下载！', 'success');
    } catch {
      showToast(language === 'zh-TW' ? '下載海報失敗，請長按圖片直接儲存' : '下载海报失败，请长按图片直接保存', 'error');
    }
  };

  const handleCopyImage = async () => {
    if (!currentPosterUrl) return;
    try {
      if (navigator.clipboard && (window as unknown as { ClipboardItem: unknown }).ClipboardItem) {
        const res = await fetch(currentPosterUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new (window as unknown as { ClipboardItem: new (items: Record<string, Blob>) => ClipboardItem }).ClipboardItem({ [blob.type]: blob })
        ]);
        setHasCopiedImage(true);
        setTimeout(() => setHasCopiedImage(false), 2500);
        showToast(language === 'zh-TW' ? '海報已複製到剪貼板，可直接粘貼分享！' : '海报已复制到剪贴板，可直接粘贴分享！', 'success');
        return;
      }
      throw new Error('ClipboardItem not supported');
    } catch {
      handleDownload();
      showToast(language === 'zh-TW' ? '已為您直接下載圖片（手機端長按亦可直接存圖）' : '已为您直接下载图片（手机端长按亦可直接存图）', 'info');
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(currentCopyText);
      setHasCopiedText(true);
      setTimeout(() => setHasCopiedText(false), 2500);
      showToast(language === 'zh-TW' ? '文案已複製到剪貼板！' : '文案已复制到剪贴板！', 'success');
    } catch {
      showToast(language === 'zh-TW' ? '複製失敗，請手動長按文本複製' : '复制失败，请手动长按文本复制', 'error');
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 dark:bg-black/80 backdrop-blur-2xl animate-in fade-in duration-200"
    >
      <div
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)'
        }}
        className="relative w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col bg-white dark:bg-[#1C1C1E] border-t sm:border border-slate-200/80 dark:border-white/10 rounded-t-[28px] sm:rounded-2xl shadow-ios-popover overflow-hidden text-slate-900 dark:text-white isolate animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0"
      >
        {/* iOS Presentation Detent Drag Indicator (Mobile only) */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="sm:hidden w-full pt-2.5 pb-2 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing select-none"
        >
          <div className="w-10 h-1.5 rounded-full bg-black/20 dark:bg-white/30" />
        </div>

        {/* Ambient Top Glow */}
        <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-44 bg-ios-blue/15 dark:bg-ios-blue/25 blur-3xl rounded-full" />

        {/* Modal Header */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative z-10 flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#1C1C1E]/90 backdrop-blur-md select-none touch-none sm:touch-auto"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-ios-blue/10 dark:bg-ios-blue/15 border border-ios-blue/20 dark:border-ios-blue/30 text-ios-blue flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-ios-blue" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  {language === 'zh-TW' ? '3:4 騎行社交戰報' : '3:4 骑行社交战报'}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-ios-blue/10 text-ios-blue font-mono font-bold text-[11px]">
                  3:4 HD
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {language === 'zh-TW' ? '1080×1440 視網膜超清 · 離線即時渲染' : '1080×1440 视网膜超清 · 离线即时渲染'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white flex items-center justify-center transition apple-touch"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Theme Selector + Poster Preview + Social Copy Generator */}
        <div className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4 bg-slate-100/80 dark:bg-black/40">
          {/* Top Style Selector Bar (3 Distinct Visual Themes) */}
          <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-1.5 rounded-2xl bg-white dark:bg-[#252528] border border-slate-200/80 dark:border-white/10 shadow-ios-card">
            <div className="flex items-center gap-2 px-2 py-1">
              <Sparkles className="w-4 h-4 text-ios-blue shrink-0" />
              <span className="text-xs font-bold text-slate-800 dark:text-white">
                {language === 'zh-TW' ? '海報視覺風格:' : '海报视觉风格:'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 flex-1 sm:max-w-md">
              <button
                type="button"
                onClick={() => handleThemeChange('conqueror')}
                className={`apple-touch flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-semibold transition ${
                  selectedTheme === 'conqueror'
                    ? 'bg-ios-green/15 text-ios-green border border-ios-green/30 shadow-2xs font-bold'
                    : 'bg-black/[0.03] dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Mountain className="w-3.5 h-3.5 shrink-0" />
                <span>{language === 'zh-TW' ? '征服者手稿' : '征服者手稿'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleThemeChange('neon-dawn')}
                className={`apple-touch flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-semibold transition ${
                  selectedTheme === 'neon-dawn'
                    ? 'bg-ios-pink/15 text-ios-pink border border-ios-pink/30 shadow-2xs font-bold'
                    : 'bg-black/[0.03] dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5 shrink-0" />
                <span>{language === 'zh-TW' ? '霓虹破曉' : '霓虹破晓'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleThemeChange('racing')}
                className={`apple-touch flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-semibold transition ${
                  selectedTheme === 'racing'
                    ? 'bg-ios-blue/15 text-ios-blue border border-ios-blue/30 shadow-2xs font-bold'
                    : 'bg-black/[0.03] dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Gauge className="w-3.5 h-3.5 shrink-0" />
                <span>{language === 'zh-TW' ? '競速儀表盤' : '竞速仪表盘'}</span>
              </button>
            </div>
          </div>

          {/* Center Main: Poster Preview (Left) + Linked Social Copy (Right) */}
          <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-4 flex-1">
            {/* Left: 3:4 Poster Image Container */}
            <div className="flex flex-col items-center justify-center flex-1 max-w-full">
              <div className="relative rounded-2xl overflow-hidden shadow-ios-popover border border-slate-200/80 dark:border-white/10 bg-[#1C1C1E]">
                {currentPosterUrl ? (
                  <img
                    src={currentPosterUrl}
                    alt={data.title}
                    className="max-h-[44vh] sm:max-h-[50vh] w-auto aspect-[3/4] object-contain block select-none pointer-events-auto"
                  />
                ) : (
                  <div className="w-64 aspect-[3/4] flex items-center justify-center text-xs text-slate-400">
                    {language === 'zh-TW' ? '正在加載海報...' : '正在加载海报...'}
                  </div>
                )}

                {/* Loading Generation Spinner Overlay */}
                {isGenerating && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-20">
                    <Sparkles className="w-7 h-7 text-ios-blue animate-spin" />
                    <span className="text-xs font-bold text-white tracking-wide">
                      {language === 'zh-TW' ? '正在重繪 3:4 視覺海報...' : '正在重绘 3:4 视觉海报...'}
                    </span>
                  </div>
                )}
              </div>

              {/* Mobile Long Press Hint */}
              <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 dark:bg-white/10 border border-slate-200/80 dark:border-white/10 text-[11px] text-slate-600 dark:text-slate-400 shadow-xs">
                <ImageIcon className="w-3.5 h-3.5 text-ios-blue shrink-0" />
                <span>{language === 'zh-TW' ? '手機端可長按海報直接儲存到系統相冊' : '手机端可长按海报直接保存到系统相册'}</span>
              </div>
            </div>

            {/* Right: Social Copywriting Section (Linked with Selected Theme) */}
            <div className="w-full sm:w-80 flex flex-col justify-between p-3.5 rounded-2xl bg-white dark:bg-[#252528] border border-slate-200/80 dark:border-white/10 shadow-ios-card">
              <div className="space-y-3">
                {/* Copy Section Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
                    <FileText className="w-3.5 h-3.5 text-ios-blue" />
                    <span>{language === 'zh-TW' ? '社交分享文案' : '社交分享文案'}</span>
                  </div>
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-ios-blue/10 text-ios-blue font-semibold">
                    {language === 'zh-TW' ? '智能聯動' : '智能联动'}
                  </span>
                </div>

                {/* Persona Style Selector Pills */}
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-black/20 text-center">
                  <button
                    type="button"
                    onClick={() => setSelectedCopyTab('conquer')}
                    className={`apple-touch py-1.5 px-1 rounded-lg text-[11px] font-semibold transition ${
                      selectedCopyTab === 'conquer'
                        ? 'bg-white dark:bg-white/20 text-ios-green shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {language === 'zh-TW' ? '征服流' : '征服流'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCopyTab('lifestyle')}
                    className={`apple-touch py-1.5 px-1 rounded-lg text-[11px] font-semibold transition ${
                      selectedCopyTab === 'lifestyle'
                        ? 'bg-white dark:bg-white/20 text-ios-pink shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {language === 'zh-TW' ? '生活美學' : '生活美学'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCopyTab('geek')}
                    className={`apple-touch py-1.5 px-1 rounded-lg text-[11px] font-semibold transition ${
                      selectedCopyTab === 'geek'
                        ? 'bg-white dark:bg-white/20 text-ios-blue shadow-2xs font-bold'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {language === 'zh-TW' ? '極客技術' : '极客技术'}
                  </button>
                </div>

                {/* Selected Copy Content Box */}
                <div className="relative p-3 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-200/70 dark:border-white/5 min-h-[120px] flex items-center">
                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-sans select-all">
                    {currentCopyText}
                  </p>
                </div>
              </div>

              {/* Copy Text Action Button */}
              <button
                type="button"
                onClick={handleCopyText}
                className="apple-touch mt-3 w-full h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200/80 dark:border-white/10 transition active:scale-95 flex items-center justify-center gap-1.5"
              >
                {hasCopiedText ? (
                  <>
                    <Check className="w-4 h-4 text-ios-green" />
                    <span className="text-ios-green font-bold">
                      {language === 'zh-TW' ? '文案已複製到剪貼板' : '文案已复制到剪贴板'}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-ios-blue" />
                    <span>{language === 'zh-TW' ? '複製此風格文案' : '复制此风格文案'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions (Strict Apple HIG Hierarchy: Max 1 Prominent Accent Button) */}
        <div className="relative z-10 p-4 border-t border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#1C1C1E]/95 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleCopyImage}
            className="apple-touch flex-1 sm:flex-initial h-9 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200/80 dark:border-white/10 transition active:scale-95 flex items-center justify-center gap-1.5"
          >
            {hasCopiedImage ? (
              <>
                <Check className="w-4 h-4 text-ios-green" />
                <span className="text-ios-green font-bold">
                  {language === 'zh-TW' ? '已複製海報' : '已复制海报'}
                </span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-ios-blue" />
                <span>{language === 'zh-TW' ? '複製海報' : '复制海报'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="apple-touch flex-1 sm:flex-initial h-9 px-5 rounded-xl bg-ios-blue hover:bg-ios-blue/90 text-white font-semibold text-xs shadow-ios-sm transition active:scale-95 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>{language === 'zh-TW' ? '保存海報 (3:4)' : '保存海报 (3:4)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
