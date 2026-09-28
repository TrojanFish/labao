import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Settings, PanelLeft, Heart } from 'lucide-react';
import { LaBaoLogo } from './common/LaBaoLogo';
import { BackgroundMusicControl } from './BackgroundMusicControl';
import { RiderProfileModal } from './common/RiderProfileModal';
import { useRiderProfile } from '../context/RiderProfileContext';
import { useLanguageAndUnit } from '../context/LanguageAndUnitContext';

interface HeaderProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isDark: boolean;
  setIsDark: (dark: boolean) => void;
  themeMode?: 'system' | 'dark' | 'light';
  setThemeMode?: (mode: 'system' | 'dark' | 'light') => void;
  onNavigateHome: () => void;
  currentToolId: string | null;
  onSelectTool: (id: string) => void;
  profileModalOpen?: boolean;
  setProfileModalOpen?: (open: boolean) => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onOpenCommandPalette?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchTerm,
  setSearchTerm,
  isDark,
  setIsDark,
  themeMode,
  setThemeMode,
  onNavigateHome,
  profileModalOpen,
  setProfileModalOpen,
  isSidebarOpen = true,
  onToggleSidebar,
  onOpenCommandPalette
}) => {
  const [internalProfileOpen, setInternalProfileOpen] = useState<boolean>(false);
  const isProfileOpen = profileModalOpen !== undefined ? profileModalOpen : internalProfileOpen;
  const setProfileOpen = setProfileModalOpen || setInternalProfileOpen;
  const [profileModalTab, setProfileModalTab] = useState<'profile' | 'roster' | 'garage' | 'strava' | 'system'>('profile');
  const [mobileSearchOpen, setMobileSearchOpen] = useState<boolean>(false);
  const [sponsorOpen, setSponsorOpen] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const { profile, activeBike } = useRiderProfile();
  const { language, t, convertWeight } = useLanguageAndUnit();

  // iOS Pull-Down to Dismiss Gesture State for Sponsor Modal
  const [sponsorDragY, setSponsorDragY] = useState<number>(0);
  const [isSponsorDragging, setIsSponsorDragging] = useState<boolean>(false);
  const sponsorTouchStartY = useRef<number>(0);
  const sponsorCurrentDragY = useRef<number>(0);

  const handleSponsorTouchStart = (e: React.TouchEvent) => {
    sponsorTouchStartY.current = e.touches[0].clientY;
    setIsSponsorDragging(true);
  };

  const handleSponsorTouchMove = (e: React.TouchEvent) => {
    const deltaY = e.touches[0].clientY - sponsorTouchStartY.current;
    if (deltaY > 0) {
      sponsorCurrentDragY.current = deltaY;
      setSponsorDragY(deltaY);
    }
  };

  const handleSponsorTouchEnd = () => {
    setIsSponsorDragging(false);
    if (sponsorCurrentDragY.current > 75) {
      setSponsorOpen(false);
    }
    setSponsorDragY(0);
    sponsorCurrentDragY.current = 0;
  };

  // Keyboard shortcut listener: '/' to focus search, 'Escape' to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        setMobileSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === 'Escape') {
        setProfileOpen(false);
        setMobileSearchOpen(false);
        setSponsorOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setProfileOpen]);

  const formattedWeight = convertWeight(profile.weightKg || 68);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 w-full border-b border-black/[0.05] dark:border-white/[0.08] backdrop-blur-2xl saturate-180 bg-white/75 dark:bg-[#1C1C1E]/80 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-5 lg:px-6 h-[52px] sm:h-14 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Sidebar Toggle + Clean Brand Logo with Bike Icon */}
          <div className="flex items-center gap-2 sm:gap-3">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="hidden lg:flex items-center justify-center w-9 h-9 rounded-xl bg-black/[0.04] dark:bg-white/[0.08] border border-black/[0.04] dark:border-white/[0.06] text-slate-600 dark:text-slate-300 hover:text-ios-blue hover:bg-black/[0.08] dark:hover:bg-white/[0.12] transition-all apple-touch shrink-0"
                title={isSidebarOpen ? (language === 'zh-TW' ? '收起側邊欄' : '收起侧边栏') : (language === 'zh-TW' ? '展開側邊欄' : '展开侧边栏')}
                aria-label="Toggle Sidebar"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}

            <div className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none shrink-0 group apple-touch" onClick={onNavigateHome}>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-ios-red to-ios-orange flex items-center justify-center text-white shadow-sm shadow-ios-red/30 group-hover:scale-105 transition-transform duration-200 shrink-0">
                <LaBaoLogo className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1 sm:gap-1.5 font-sans">
                  <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white">{t('brandName')}</span>
                  <span className="text-xs font-bold text-ios-red dark:text-ios-orange tracking-tight">{t('brandSuffix')}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-ios-red/10 dark:bg-ios-red/20 text-ios-red dark:text-ios-orange font-mono font-bold tracking-tight">{t('brandPro')}</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 tracking-normal hidden xl:block">
                  {t('slogan')}
                </div>
              </div>
            </div>
          </div>

          {/* Center Search Input (Desktop) - iOS Spotlight style */}
          <div className="hidden sm:flex items-center flex-1 max-w-md mx-4 lg:mx-6">
            <div
              className="relative w-full cursor-pointer"
              onClick={() => (onOpenCommandPalette ? onOpenCommandPalette() : searchInputRef.current?.focus())}
            >
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => {
                  if (onOpenCommandPalette) {
                    e.preventDefault();
                    onOpenCommandPalette();
                  }
                }}
                onFocus={(e) => {
                  if (onOpenCommandPalette) {
                    e.target.blur();
                    onOpenCommandPalette();
                  }
                }}
                placeholder={t('searchPlaceholder')}
                className="w-full h-9 bg-slate-200/50 dark:bg-[#2C2C2E]/80 border border-black/[0.04] dark:border-white/[0.08] rounded-xl pl-9 pr-14 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-ios-blue/40 focus:bg-white dark:focus:bg-[#2C2C2E] transition-all cursor-pointer"
              />
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-400 dark:text-slate-400 bg-white dark:bg-[#3A3A3C] border border-black/[0.06] dark:border-white/[0.08] rounded-md shadow-xs select-none pointer-events-none">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* Right Actions: Search + Rider Settings + BGM + Theme Switch */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Mobile Search Button - Uniform Apple HIG 36px button */}
            <button
              onClick={() => {
                if (onOpenCommandPalette) {
                  onOpenCommandPalette();
                } else {
                  setMobileSearchOpen(!mobileSearchOpen);
                }
              }}
              className="sm:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100/90 dark:bg-[#2C2C2E]/80 border border-black/[0.05] dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white apple-touch transition shrink-0"
              title="Search Tools"
              aria-label="Search Tools"
            >
              {mobileSearchOpen ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            </button>

            {/* Sponsor / Appreciation Button */}
            <button
              onClick={() => setSponsorOpen(true)}
              className="apple-touch h-9 px-2.5 sm:px-3 flex items-center justify-center rounded-xl bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold gap-1.5 transition active:scale-95 shrink-0"
              title={language === 'zh-TW' ? '贊助支持作者' : '赞助支持作者'}
              aria-label="Sponsor"
            >
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500/20" />
              <span className="hidden sm:inline">{language === 'zh-TW' ? '贊助' : '赞助'}</span>
            </button>

            {/* Unified Rider & Bike Profile Button - Apple HIG 36px control */}
            <button
              onClick={() => {
                setProfileModalTab('profile');
                setProfileOpen(true);
              }}
              className="h-9 px-2.5 sm:px-3 flex items-center justify-center rounded-xl bg-slate-100/90 dark:bg-[#2C2C2E]/80 border border-black/[0.05] dark:border-white/[0.08] hover:bg-slate-200/80 dark:hover:bg-[#3A3A3C] text-slate-700 dark:text-slate-200 hover:text-ios-blue dark:hover:text-ios-blue-dark apple-touch transition gap-1.5 group shrink-0 shadow-xs"
              title={language === 'zh-TW' ? '車手檔案、戰車車庫與系統設定' : '车手档案、战车车库与系统设置'}
              aria-label="Settings & Rider Profile"
            >
              <Settings className="w-4 h-4 text-ios-blue dark:text-ios-blue-dark group-hover:rotate-45 transition-transform duration-300 shrink-0" />
              <span className="hidden sm:inline text-xs font-semibold max-w-[110px] lg:max-w-[140px] truncate">
                {activeBike?.name ? activeBike.name.split('/')[0].trim() : (language === 'zh-TW' ? '車手檔案' : '车手档案')}
              </span>
              <span className="hidden lg:inline text-slate-300 dark:text-neutral-700 font-light">•</span>
              <span className="hidden lg:inline text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                {profile.heightCm}cm / {formattedWeight.formatted}
              </span>
            </button>

            {/* Streamlined Background Music Switch */}
            <BackgroundMusicControl />
          </div>
        </div>

        {/* Mobile Search Expand Drawer */}
        {mobileSearchOpen && (
          <div className="sm:hidden px-4 pb-3 pt-1 border-t border-slate-200/80 dark:border-white/10 animate-in fade-in slide-in-from-top-1">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t('searchPrompt')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                className="w-full h-9 bg-slate-100 dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/10 rounded-xl pl-9 pr-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-ios-blue"
              />
            </div>
          </div>
        )}
      </header>

      {/* Header spacer to prevent content underlap when fixed at top */}
      <div className="h-[calc(52px+env(safe-area-inset-top,0px))] sm:h-[calc(56px+env(safe-area-inset-top,0px))] w-full shrink-0" aria-hidden="true" />


      {/* Global Rider Profile Modal */}
      <RiderProfileModal
        isOpen={isProfileOpen}
        onClose={() => setProfileOpen(false)}
        themeMode={themeMode}
        setThemeMode={setThemeMode}
        initialTab={profileModalTab}
      />

      {/* Global Sponsor Appreciation Modal */}
      {sponsorOpen && typeof document !== 'undefined' && createPortal(
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSponsorOpen(false);
          }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 dark:bg-black/75 backdrop-blur-2xl animate-in fade-in duration-200"
        >
          <div
            style={{
              transform: sponsorDragY > 0 ? `translateY(${sponsorDragY}px)` : undefined,
              transition: isSponsorDragging ? 'none' : 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
            }}
            className="relative w-full max-w-sm sm:max-w-md max-h-[92vh] sm:max-h-[90vh] flex flex-col bg-white dark:bg-[#1C1C1E] border-t sm:border border-slate-200/80 dark:border-white/10 rounded-t-[28px] sm:rounded-2xl shadow-ios-popover overflow-hidden text-slate-900 dark:text-white isolate animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0 text-left"
          >
            {/* iOS Presentation Detent Drag Indicator (Mobile only) */}
            <div
              onTouchStart={handleSponsorTouchStart}
              onTouchMove={handleSponsorTouchMove}
              onTouchEnd={handleSponsorTouchEnd}
              className="sm:hidden w-full pt-2.5 pb-2 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing select-none"
            >
              <div className="w-10 h-1.5 rounded-full bg-black/20 dark:bg-white/30" />
            </div>

            {/* Ambient Top Glow */}
            <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-40 bg-rose-500/15 dark:bg-rose-500/25 blur-3xl rounded-full" />

            {/* Modal Header */}
            <div
              onTouchStart={handleSponsorTouchStart}
              onTouchMove={handleSponsorTouchMove}
              onTouchEnd={handleSponsorTouchEnd}
              className="relative z-10 flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#1C1C1E]/90 backdrop-blur-md select-none touch-none sm:touch-auto"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 text-rose-500 flex items-center justify-center">
                  <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    {language === 'zh-TW' ? '贊助支持作者' : '赞助支持作者'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {language === 'zh-TW' ? '感謝對單車工坊的認可與喜愛' : '感谢对单车工坊的认可与喜爱'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSponsorOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white flex items-center justify-center transition apple-touch"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* QR Code Body */}
            <div className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col items-center justify-center bg-slate-100/80 dark:bg-black/40">
              <div className="relative rounded-2xl overflow-hidden shadow-ios-popover border border-slate-200/80 dark:border-white/10 bg-white p-4 flex flex-col items-center max-w-[260px] w-full">
                <img
                  src="/sponsor-qrcode.jpg"
                  alt="微信赞赏码"
                  className="w-48 h-48 sm:w-52 sm:h-52 object-contain rounded-xl block select-none"
                />
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                  <span>微信扫一扫 · 给 Keiyee 赞赏</span>
                </div>
              </div>

              <div className="mt-3.5 text-center space-y-1 max-w-xs px-2">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {language === 'zh-TW'
                    ? '如果單車工坊對您的騎行有所幫助，歡迎請作者喝杯咖啡 ☕'
                    : '如果单车工坊对您的骑行有所帮助，欢迎请作者喝杯咖啡 ☕'}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {language === 'zh-TW'
                    ? '開源不易，您的每一份善意都是持續打磨的最大動力！'
                    : '开源不易，您的每一份善意都是持续打磨的最大动力！'}
                </p>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="relative z-10 p-4 border-t border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#1C1C1E]/95 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSponsorOpen(false)}
                className="apple-touch w-full sm:w-auto h-9 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold transition active:scale-95 flex items-center justify-center"
              >
                {language === 'zh-TW' ? '關閉' : '关闭'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
