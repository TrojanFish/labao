import React, { useState } from 'react';
import { Shield, Lock, X, CheckCircle2, FileText } from 'lucide-react';
import { YoloCyclingLogo } from './common/YoloCyclingLogo';
import { useLanguageAndUnit } from '../context/LanguageAndUnitContext';
import { IOSSegmentedControl } from './common/IOSSegmentedControl';

interface FooterProps {
  onNavigateHome: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigateHome }) => {
  const { language, t } = useLanguageAndUnit();
  const [activeModalTab, setActiveModalTab] = useState<'disclaimer' | 'privacy' | null>(null);

  return (
    <footer className="mt-8 sm:mt-12 border-t border-black/[0.05] dark:border-white/[0.08] bg-white/70 dark:bg-black/50 backdrop-blur-xl no-print transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3.5 sm:gap-4">
          {/* Brand & Slogan */}
          <div
            className="flex items-center gap-3 cursor-pointer group select-none"
            onClick={onNavigateHome}
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-ios-red to-ios-orange text-white flex items-center justify-center font-bold shadow-ios-sm group-hover:scale-105 transition shrink-0">
              <YoloCyclingLogo className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
              <div className="flex items-center gap-1.5 font-mono">
                <span className="font-bold text-sm tracking-tight text-slate-900 dark:text-slate-100">{t('brandName')}</span>
                {t('brandSuffix') && (
                  <span className="text-xs font-bold text-ios-red dark:text-ios-orange">{t('brandSuffix')}</span>
                )}
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ios-red/10 border border-ios-red/20 text-ios-red font-mono font-semibold">{t('brandPro')}</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">· {t('slogan')}</span>
            </div>
          </div>

          {/* Quick Keyboard Shortcuts Capsule */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] text-[11px]">
              <span>{t('footerSearch')}</span>
              <kbd className="px-1.5 py-0.5 text-[11px] font-mono font-semibold text-ios-blue bg-white dark:bg-[#2C2C2E] rounded border border-black/[0.08] dark:border-white/10 shadow-2xs">/</kbd>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] text-[11px]">
              <span>{t('footerClose')}</span>
              <kbd className="px-1.5 py-0.5 text-[11px] font-mono font-semibold text-ios-blue bg-white dark:bg-[#2C2C2E] rounded border border-black/[0.08] dark:border-white/10 shadow-2xs">ESC</kbd>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/[0.02] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08] text-[11px]">
              <span>{t('footerPrint')}</span>
              <kbd className="px-1.5 py-0.5 text-[11px] font-mono font-semibold text-ios-blue bg-white dark:bg-[#2C2C2E] rounded border border-black/[0.08] dark:border-white/10 shadow-2xs">Ctrl+P</kbd>
            </div>
          </div>

          {/* Legal Modal Triggers & Copyright */}
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            <button
              type="button"
              onClick={() => setActiveModalTab('disclaimer')}
              className="apple-touch hover:text-ios-blue dark:hover:text-ios-blue transition inline-flex items-center gap-1 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-ios-blue" />
              <span>{language === 'zh-TW' ? '免責聲明' : '免责声明'}</span>
            </button>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <button
              type="button"
              onClick={() => setActiveModalTab('privacy')}
              className="apple-touch hover:text-emerald-500 dark:hover:text-emerald-400 transition inline-flex items-center gap-1 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-emerald-500" />
              <span>{language === 'zh-TW' ? '隱私承諾' : '隐私承诺'}</span>
            </button>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              <span>© {new Date().getFullYear()} YoloCycling</span>
            </div>
          </div>
        </div>
      </div>

      {/* Apple HIG Legal & Privacy Modal Sheet */}
      {activeModalTab && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModalTab(null);
          }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 dark:bg-black/75 backdrop-blur-2xl animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-lg flex flex-col bg-white dark:bg-[#1C1C1E] border-t sm:border border-slate-200/80 dark:border-white/10 rounded-t-[28px] sm:rounded-2xl shadow-ios-popover overflow-hidden text-slate-900 dark:text-white isolate animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-5">
            {/* iOS Presentation Detent Drag Indicator (Mobile only) */}
            <div
              onClick={() => setActiveModalTab(null)}
              className="sm:hidden w-full pt-2.5 pb-1 flex items-center justify-center cursor-pointer"
            >
              <div className="w-10 h-1.5 rounded-full bg-black/20 dark:bg-white/30" />
            </div>

            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 border-b border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#1C1C1E]/90 backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-ios-blue/10 dark:bg-ios-blue/15 border border-ios-blue/20 dark:border-ios-blue/30 text-ios-blue flex items-center justify-center">
                  <FileText className="w-4 h-4 text-ios-blue" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    {language === 'zh-TW' ? '法律合規與隱私承諾' : '法律合规与隐私承诺'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {language === 'zh-TW' ? 'YoloCycling 運動科學規範' : 'YoloCycling 运动科学规范'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalTab(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white flex items-center justify-center transition apple-touch"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Segmented Switcher */}
            <div className="px-4 sm:px-5 pt-3">
              <IOSSegmentedControl
                options={[
                  { id: 'disclaimer', label: language === 'zh-TW' ? '免責聲明' : '免责声明', icon: Shield },
                  { id: 'privacy', label: language === 'zh-TW' ? '隱私保護' : '隐私保护', icon: Lock },
                ]}
                value={activeModalTab}
                onChange={(val) => setActiveModalTab(val as any)}
                size="md"
              />
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-3.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-h-[50vh] overflow-y-auto">
              {activeModalTab === 'disclaimer' ? (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-ios-blue/5 border border-ios-blue/15 flex items-start gap-2.5">
                    <Shield className="w-4 h-4 text-ios-blue shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white mb-1">
                        {t('footerDisclaimerTitle')}
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        {t('footerDisclaimerText')}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2 text-[11px] text-slate-500 dark:text-slate-400 pl-1">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-ios-blue shrink-0" />
                      <span>力学建模基于标准 ISA 国际大气物理方程与刚体动力学。</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-ios-blue shrink-0" />
                      <span>户外骑行请务必遵守当地道路交通法规，量力而行，安全第一。</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15 flex items-start gap-2.5">
                    <Lock className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white mb-1">
                        {t('footerPrivacyTitle')}
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        {t('footerPrivacyText')}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2 text-[11px] text-slate-500 dark:text-slate-400 pl-1">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>所有 FIT/GPX 文件均在浏览器前端离线解析，绝不上载至外部云端服务器。</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>车手生理参数仅持久化在您本机的 localStorage，随时可清空抹除。</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Action Button */}
            <div className="px-4 sm:px-5 pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModalTab(null)}
                className="apple-touch h-9 px-5 rounded-xl bg-ios-blue hover:bg-ios-blue/90 text-white font-semibold text-xs shadow-ios-sm transition w-full sm:w-auto cursor-pointer"
              >
                {language === 'zh-TW' ? '我已瞭解' : '我知道了'}
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};
