import React, { useState, useMemo, useEffect } from 'react';
import { AudioProvider } from './context/AudioContext';
import { ToastProvider } from './context/ToastContext';
import { RiderProfileProvider } from './context/RiderProfileContext';
import { StravaProvider } from './context/StravaContext';
import { LanguageAndUnitProvider, useLanguageAndUnit } from './context/LanguageAndUnitContext';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { Footer } from './components/Footer';
import { BackToTop } from './components/common/BackToTop';
import { IOSToolSkeleton } from './components/common/IOSToolSkeleton';

// Lazy-loaded Tool Components with zero-jank chunking
const CyclePowerCalculator = React.lazy(() => import('./components/tools/CyclePowerCalculator').then(m => ({ default: m.CyclePowerCalculator })));
const RoadBikeFitter = React.lazy(() => import('./components/tools/RoadBikeFitter').then(m => ({ default: m.RoadBikeFitter })));
const TirePressureCalculator = React.lazy(() => import('./components/tools/TirePressureCalculator').then(m => ({ default: m.TirePressureCalculator })));
const GearSpeedCadenceCalculator = React.lazy(() => import('./components/tools/GearSpeedCadenceCalculator').then(m => ({ default: m.GearSpeedCadenceCalculator })));
const ChainLengthCalculator = React.lazy(() => import('./components/tools/ChainLengthCalculator').then(m => ({ default: m.ChainLengthCalculator })));
const ClimbPacingPlanner = React.lazy(() => import('./components/tools/ClimbPacingPlanner').then(m => ({ default: m.ClimbPacingPlanner })));
const UpgradeRoiCalculator = React.lazy(() => import('./components/tools/UpgradeRoiCalculator').then(m => ({ default: m.UpgradeRoiCalculator })));
const PowerProfileRadar = React.lazy(() => import('./components/tools/PowerProfileRadar').then(m => ({ default: m.PowerProfileRadar })));
const RoadBikePainChecker = React.lazy(() => import('./components/tools/RoadBikePainChecker').then(m => ({ default: m.RoadBikePainChecker })));
const RoadbookLibrary = React.lazy(() => import('./components/tools/RoadbookLibrary').then(m => ({ default: m.RoadbookLibrary })));
const GpxRouteCreator = React.lazy(() => import('./components/tools/GpxRouteCreator').then(m => ({ default: m.GpxRouteCreator })));
const GroupRideSimulator = React.lazy(() => import('./components/tools/GroupRideSimulator').then(m => ({ default: m.GroupRideSimulator })));
const CyclingWeatherAdvisor = React.lazy(() => import('./components/tools/CyclingWeatherAdvisor').then(m => ({ default: m.CyclingWeatherAdvisor })));
const HealthCalculator = React.lazy(() => import('./components/tools/HealthCalculator').then(m => ({ default: m.HealthCalculator })));
const FitActivityAnalyzer = React.lazy(() => import('./components/tools/FitActivityAnalyzer').then(m => ({ default: m.FitActivityAnalyzer })));
const TubelessSealantCalculator = React.lazy(() => import('./components/tools/TubelessSealantCalculator').then(m => ({ default: m.TubelessSealantCalculator })));
const SpokeLengthCalculator = React.lazy(() => import('./components/tools/SpokeLengthCalculator').then(m => ({ default: m.SpokeLengthCalculator })));
const MtbSuspensionTuner = React.lazy(() => import('./components/tools/MtbSuspensionTuner').then(m => ({ default: m.MtbSuspensionTuner })));
const WorkoutBuilder = React.lazy(() => import('./components/tools/WorkoutBuilder').then(m => ({ default: m.WorkoutBuilder })));
const StravaDataCockpit = React.lazy(() => import('./components/tools/StravaDataCockpit').then(m => ({ default: m.StravaDataCockpit })));
const TrainingPlanCalendar = React.lazy(() => import('./components/tools/TrainingPlanCalendar').then(m => ({ default: m.TrainingPlanCalendar })));
import { PwaInstallPrompt } from './components/common/PwaInstallPrompt';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { MacosSidebar } from './components/common/MacosSidebar';
import { CommandPaletteModal } from './components/common/CommandPaletteModal';
import { OfflineStatusPill } from './components/common/OfflineStatusPill';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { TOOLS_LIST } from './data/toolsList';
import { smoothScrollToTop } from './utils/toolNavHelper';
import { parseToolIdFromHash, syncHashToBrowser } from './utils/hashRouter';

const MainAppContent: React.FC = () => {
  const [currentToolId, setCurrentToolId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return parseToolIdFromHash(window.location.hash);
    }
    return null;
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('solorider_sidebar_open');
        if (saved !== null) return saved === 'true';
      } catch {
        return true;
      }
    }
    return true;
  });

  const handleToggleSidebar = () => {
    setIsSidebarOpen(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('solorider_sidebar_open', String(next));
        } catch {
          // Gracefully ignore storage quota / privacy mode errors
        }
      }
      return next;
    });
  };
  
  // Theme Mode: 'system' | 'dark' | 'light'
  // Auto-detect phone OS prefers-color-scheme, plus persistent manual toggle
  const [themeMode, setThemeMode] = useState<'system' | 'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('solorider_theme_mode');
        if (saved === 'system' || saved === 'dark' || saved === 'light') {
          return saved;
        }
      } catch {
        return 'system';
      }
    }
    return 'system'; // Default to automatic phone system detection
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  // Listen for mobile phone OS dark mode changes reactively
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Compute active effective dark state
  const isDark = themeMode === 'system' ? systemPrefersDark : themeMode === 'dark';

  const handleSetThemeMode = (mode: 'system' | 'dark' | 'light') => {
    setThemeMode(mode);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('solorider_theme_mode', mode);
      } catch {
        // Gracefully ignore storage quota / privacy mode errors
      }
    }
  };

  // Synchronize documentElement class for HTML and root CSS
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [isDark]);

  const [profileModalOpen, setProfileModalOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const { language } = useLanguageAndUnit();

  // Global keyboard shortcut: Cmd+K / Ctrl+K opens Command Palette
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Filter tools by category & search term
  const filteredTools = useMemo(() => {
    return TOOLS_LIST.filter(tool => {
      const matchCat = selectedCategory === 'all' || tool.category === selectedCategory;
      const q = searchTerm.trim().toLowerCase();
      if (!q) return matchCat;

      const matchSearch =
        tool.title.toLowerCase().includes(q) ||
        (tool.titleTw && tool.titleTw.toLowerCase().includes(q)) ||
        tool.subtitle.toLowerCase().includes(q) ||
        (tool.subtitleTw && tool.subtitleTw.toLowerCase().includes(q)) ||
        tool.description.toLowerCase().includes(q) ||
        (tool.descriptionTw && tool.descriptionTw.toLowerCase().includes(q)) ||
        tool.tags.some(tag => tag.toLowerCase().includes(q)) ||
        (tool.tagsTw && tool.tagsTw.some(tag => tag.toLowerCase().includes(q)));

      return matchSearch;
    });
  }, [selectedCategory, searchTerm]);

  // Unified tool navigation with browser URL hash sync
  const handleSelectTool = (id: string | null) => {
    setCurrentToolId(id);
    syncHashToBrowser(id);
    smoothScrollToTop();
  };

  // Bidirectional synchronization with browser URL hash and back/forward history
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUrlChange = () => {
      const toolFromHash = parseToolIdFromHash(window.location.hash);
      setCurrentToolId(toolFromHash);
      smoothScrollToTop();
    };

    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);

    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  return (
    <div className={`min-h-screen lg:h-screen lg:overflow-hidden flex flex-col justify-between ${isDark ? 'dark bg-[#000000] text-slate-100' : 'light bg-[#F2F2F7] text-slate-900'}`}>
      {/* Top Header (Fixed at top: 0 with built-in height spacer) */}
      <Header
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          isDark={isDark}
          setIsDark={(dark) => handleSetThemeMode(dark ? 'dark' : 'light')}
          themeMode={themeMode}
          setThemeMode={handleSetThemeMode}
          onNavigateHome={() => {
            handleSelectTool(null);
            setSelectedCategory('all');
          }}
          currentToolId={currentToolId}
          onSelectTool={(id) => {
            handleSelectTool(id);
          }}
          profileModalOpen={profileModalOpen}
          setProfileModalOpen={setProfileModalOpen}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={handleToggleSidebar}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        />

        {/* PWA Installation Prompt Bar (Mobile & Desktop, positioned below header) */}
        <PwaInstallPrompt />

        {/* Dual-Personality Split-View Container: macOS Sidebar on Desktop, Inset Grouped on Mobile */}
        <div className="w-full max-w-[1920px] mx-auto flex flex-1 min-h-0 lg:overflow-hidden">
          {/* macOS Studio Sidebar (Desktop only) */}
          <div className="hidden lg:flex shrink-0 h-full">
            <MacosSidebar
              currentToolId={currentToolId}
              onSelectTool={(id) => {
                handleSelectTool(id);
              }}
              onOpenProfile={() => setProfileModalOpen(true)}
              isCollapsed={!isSidebarOpen}
            />
          </div>

          {/* Main Content Workspace */}
          <div
            id="main-content-scroll"
            className="flex-1 min-w-0 lg:h-full lg:overflow-y-auto lg:overscroll-contain flex flex-col justify-between"
          >
            <div className="p-4 sm:p-5 pb-24 lg:pb-8">
              <main className="max-w-7xl mx-auto space-y-4 sm:space-y-5">
                {/* Render Active View */}
                {currentToolId === null && (
              <Dashboard
                onSelectTool={(id) => {
                  handleSelectTool(id);
                }}
                filteredTools={filteredTools}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
              />
            )}

            <ErrorBoundary
              fallbackTitle={language === 'zh-TW' ? '此工具載入或運行發生異常' : '该工具加载或运行发生异常'}
              onReset={() => {
                handleSelectTool(null);
                setSelectedCategory('all');
              }}
            >
              <React.Suspense fallback={<IOSToolSkeleton />}>
                {currentToolId === 'power-calc' && <CyclePowerCalculator />}
                {currentToolId === 'tire-pressure' && <TirePressureCalculator />}
                {currentToolId === 'gear-calculator' && <GearSpeedCadenceCalculator />}
                {currentToolId === 'chain-calculator' && <ChainLengthCalculator />}
                {currentToolId === 'climb-pacing' && <ClimbPacingPlanner onNavigateTool={(id) => handleSelectTool(id)} />}
                {currentToolId === 'upgrade-roi' && <UpgradeRoiCalculator />}
                {currentToolId === 'bike-fitter' && <RoadBikeFitter />}
                {currentToolId === 'pain-checker' && <RoadBikePainChecker />}
                {currentToolId === 'roadbook-library' && <RoadbookLibrary onNavigateTool={(id) => handleSelectTool(id)} />}
                {currentToolId === 'gpx-creator' && <GpxRouteCreator />}
                {currentToolId === 'group-ride' && <GroupRideSimulator />}
                {currentToolId === 'weather-advisor' && <CyclingWeatherAdvisor />}
                {currentToolId === 'power-radar' && <PowerProfileRadar onNavigateTool={(id) => handleSelectTool(id)} />}
                {currentToolId === 'health-calculator' && <HealthCalculator />}
                {currentToolId === 'activity-analyzer' && <FitActivityAnalyzer onNavigateTool={(id) => handleSelectTool(id)} />}
                {currentToolId === 'workout-builder' && <WorkoutBuilder onNavigateTool={(id) => handleSelectTool(id)} />}
                {currentToolId === 'tubeless-sealant' && <TubelessSealantCalculator onNavigateTool={(id) => handleSelectTool(id)} />}
                {currentToolId === 'spoke-calculator' && <SpokeLengthCalculator />}
                {currentToolId === 'mtb-suspension' && <MtbSuspensionTuner />}
                {currentToolId === 'strava-cockpit' && <StravaDataCockpit onNavigateTool={(id) => handleSelectTool(id)} />}
                {currentToolId === 'training-calendar' && <TrainingPlanCalendar onNavigateTool={(id) => handleSelectTool(id)} />}
              </React.Suspense>
            </ErrorBoundary>
          </main>
        </div>

        {/* Desktop Footer: Inside right scroll pane at bottom */}
        <div className="hidden lg:block">
          <Footer
            onNavigateHome={() => {
              handleSelectTool(null);
              setSelectedCategory('all');
            }}
          />
        </div>
      </div>
    </div>

    {/* Mobile Footer: Below content in normal document flow */}
    <div className="lg:hidden">
      <Footer
        onNavigateHome={() => {
          handleSelectTool(null);
          setSelectedCategory('all');
        }}
      />
    </div>

    {/* Mobile Bottom Dock Navigation */}
    <MobileBottomNav
      currentToolId={currentToolId}
      onNavigateHome={() => {
        handleSelectTool(null);
        setSelectedCategory('all');
      }}
      onSelectTool={(id) => {
        handleSelectTool(id);
      }}
      onOpenProfile={() => setProfileModalOpen(true)}
    />

    {/* Global ⌘K Command Palette */}
    <CommandPaletteModal
      isOpen={isCommandPaletteOpen}
      onClose={() => setIsCommandPaletteOpen(false)}
      onSelectTool={(id) => handleSelectTool(id)}
    />

    {/* Apple HIG Offline Perception Pill */}
    <OfflineStatusPill />

    <BackToTop />
  </div>
  );
};

export const App: React.FC = () => {
  return (
    <LanguageAndUnitProvider>
      <ToastProvider>
        <RiderProfileProvider>
          <StravaProvider>
            <AudioProvider>
              <MainAppContent />
            </AudioProvider>
          </StravaProvider>
        </RiderProfileProvider>
      </ToastProvider>
    </LanguageAndUnitProvider>
  );
};
