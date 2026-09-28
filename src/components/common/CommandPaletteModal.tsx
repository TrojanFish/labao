import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  CornerDownLeft,
  Zap,
  Gauge,
  Cog,
  Link as LinkIcon,
  Mountain,
  Scale,
  Droplets,
  Disc,
  Sliders,
  Ruler,
  Activity,
  Flame,
  ShieldCheck,
  FileText,
  Compass,
  Map,
  Wind,
  LineChart,
  Users,
  BarChart2,
  Calendar,
  Command
} from 'lucide-react';
import { TOOLS_LIST } from '../../data/toolsList';
import { ToolMetadata } from '../../types';
import { useLanguageAndUnit } from '../../context/LanguageAndUnitContext';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTool: (id: string) => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Zap,
  Gauge,
  Cog,
  Link: LinkIcon,
  Mountain,
  Scale,
  Droplets,
  Disc,
  Sliders,
  Ruler,
  Activity,
  Flame,
  ShieldCheck,
  FileText,
  Compass,
  Map,
  Wind,
  LineChart,
  Users,
  BarChart2,
  Calendar
};

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onSelectTool
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguageAndUnit();

  // Focus input upon opening & reset query
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Filter tools
  const filteredTools = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOOLS_LIST;

    return TOOLS_LIST.filter(tool => {
      const matchTitle =
        tool.title.toLowerCase().includes(q) ||
        (tool.titleTw && tool.titleTw.toLowerCase().includes(q)) ||
        (tool.titleEn && tool.titleEn.toLowerCase().includes(q));

      const matchSubtitle =
        tool.subtitle.toLowerCase().includes(q) ||
        (tool.subtitleTw && tool.subtitleTw.toLowerCase().includes(q)) ||
        (tool.subtitleEn && tool.subtitleEn.toLowerCase().includes(q));

      const matchDesc =
        tool.description.toLowerCase().includes(q) ||
        (tool.descriptionTw && tool.descriptionTw.toLowerCase().includes(q));

      const matchTags =
        tool.tags.some(t => t.toLowerCase().includes(q)) ||
        (tool.tagsTw && tool.tagsTw.some(t => t.toLowerCase().includes(q))) ||
        (tool.tagsEn && tool.tagsEn.some(t => t.toLowerCase().includes(q)));

      const matchCat =
        tool.categoryLabel.toLowerCase().includes(q) ||
        (tool.categoryLabelTw && tool.categoryLabelTw.toLowerCase().includes(q));

      return matchTitle || matchSubtitle || matchDesc || matchTags || matchCat;
    });
  }, [query]);

  // Keep selected index in bound
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredTools.length]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < filteredTools.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredTools.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredTools[selectedIndex]) {
        onSelectTool(filteredTools[selectedIndex].id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Modal Container: iOS Bottom Sheet (<640px) vs macOS Centered Panel (>=640px) */}
      <div
        className="w-full sm:max-w-xl max-h-[85vh] sm:max-h-[600px] flex flex-col bg-white/95 dark:bg-[#1C1C1E]/95 border-t sm:border border-black/[0.08] dark:border-white/[0.12] rounded-t-[28px] sm:rounded-2xl shadow-ios-popover backdrop-blur-2xl overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS Drag Handle (Mobile only) */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-black/20 dark:bg-white/20" />
        </div>

        {/* Search Header - Apple HIG Spotlight Capsule */}
        <div className="p-3 sm:p-3.5 pb-2 border-b border-black/[0.04] dark:border-white/[0.06]">
          <div className="relative flex items-center h-10 px-3.5 bg-black/[0.04] dark:bg-white/[0.08] border border-black/[0.05] dark:border-white/[0.08] rounded-xl focus-within:ring-2 focus-within:ring-ios-blue/40 focus-within:bg-white dark:focus-within:bg-[#2C2C2E] transition-all">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 mr-2.5 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={language === 'zh-TW' ? '搜尋 21 款單車科學工具、名山路書或標籤...' : '搜索 21 款单车科学工具、名山路书或标签...'}
              className="flex-1 bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            />
            {query ? (
              <button
                onClick={() => setQuery('')}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 apple-touch"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-400 dark:text-slate-400 bg-white dark:bg-[#3A3A3C] border border-black/[0.06] dark:border-white/[0.08] rounded-md shadow-xs select-none pointer-events-none">
                ESC
              </kbd>
            )}
          </div>
        </div>

        {/* Tool Results List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 sm:p-2.5 space-y-1 overscroll-contain"
        >
          {filteredTools.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
              {language === 'zh-TW' ? '未找到相應的單車計算工具' : '未找到相应的单车计算工具'}
            </div>
          ) : (
            filteredTools.map((tool, index) => {
              const isSelected = index === selectedIndex;
              const IconComp = ICON_MAP[tool.icon] || Zap;
              const displayTitle = language === 'zh-TW' && tool.titleTw ? tool.titleTw : tool.title;
              const displayCat = language === 'zh-TW' && tool.categoryLabelTw ? tool.categoryLabelTw : tool.categoryLabel;
              const displaySub = language === 'zh-TW' && tool.subtitleTw ? tool.subtitleTw : tool.subtitle;

              return (
                <button
                  key={tool.id}
                  data-index={index}
                  onClick={() => {
                    onSelectTool(tool.id);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition apple-touch ${
                    isSelected
                      ? 'bg-ios-blue text-white shadow-ios-sm'
                      : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.05] text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-black/[0.04] dark:bg-white/[0.08] text-ios-blue dark:text-ios-blue-dark'
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
                          {displayTitle}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                            isSelected
                              ? 'bg-white/25 text-white'
                              : 'bg-black/[0.04] dark:bg-white/[0.08] text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {displayCat}
                        </span>
                      </div>
                      <p
                        className={`text-[11px] truncate mt-0.5 ${
                          isSelected ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {displaySub}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {isSelected && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-white/80 shrink-0" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="hidden sm:flex items-center justify-between px-4 py-2 border-t border-black/[0.05] dark:border-white/[0.06] text-[11px] text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-black/20">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-black/[0.05] dark:bg-white/[0.08] font-mono font-medium">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-black/[0.05] dark:bg-white/[0.08] font-mono font-medium">↓</kbd>
              <span>{language === 'zh-TW' ? '導航選取' : '导航选取'}</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-black/[0.05] dark:bg-white/[0.08] font-mono font-medium">↵</kbd>
              <span>{language === 'zh-TW' ? '直達工具' : '直达工具'}</span>
            </span>
          </div>
          <span className="text-[10px] opacity-75">
            LaBao 21 Tools
          </span>
        </div>
      </div>
    </div>
  );
};
