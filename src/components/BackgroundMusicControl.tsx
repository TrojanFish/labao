import React, { useState, useEffect, useRef } from 'react';
import { useAudio } from '../context/AudioContext';
import { Music, Play, Pause, SkipForward, Volume2, VolumeX, Upload, ListMusic } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export const BackgroundMusicControl: React.FC = () => {
  const {
    isPlaying,
    toggleBgm,
    nextTrack,
    currentTrack,
    currentTrackIndex,
    playlist,
    volume,
    setVolume,
    selectTrack,
    addLocalAudioFile
  } = useAudio();

  const { showToast } = useToast();
  const [isOpenPopover, setIsOpenPopover] = useState<boolean>(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpenPopover(false);
      }
    };

    if (isOpenPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpenPopover]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      addLocalAudioFile(file);
      showToast('本地音频已加载播放', 'success', file.name);
    }
  };

  return (
    <div className="relative shrink-0" ref={popoverRef}>
      {/* Streamlined Minimalist Music Button (Exact match with Header icon buttons) */}
      <div className="flex items-center">
        <button
          onClick={() => setIsOpenPopover(!isOpenPopover)}
          className={`w-9 h-9 flex items-center justify-center rounded-xl border transition select-none active:scale-95 relative shrink-0 apple-touch ${
            isPlaying
              ? 'bg-ios-blue text-white border-ios-blue shadow-ios-sm'
              : 'bg-slate-100 dark:bg-[#1C1C1E] border border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20'
          }`}
          title={isPlaying ? `正在播放: ${currentTrack?.name}` : '骑行音乐'}
          aria-label="骑行音乐"
        >
          <Music className={`w-4 h-4 ${isPlaying ? 'text-white animate-pulse' : ''}`} />
          {isPlaying && (
            <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ios-blue opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-ios-blue"></span>
            </span>
          )}
        </button>
      </div>

      {/* macOS Control Center Style Frosted Popover */}
      {isOpenPopover && (
        <div className="absolute right-0 top-11 w-76 max-w-[calc(100vw-24px)] p-3.5 rounded-2xl border border-black/[0.08] dark:border-white/[0.12] shadow-ios-popover bg-white/85 dark:bg-[#252528]/85 backdrop-blur-3xl saturate-180 z-50 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150 select-none">
          {/* Header indicator */}
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-0.5">
            <span>Now Playing · 骑行电台</span>
            {currentTrack?.bpm && <span className="font-mono text-ios-blue">{currentTrack.bpm} RPM</span>}
          </div>

          {/* Current Track & Direct Play/Pause */}
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.04] dark:border-white/[0.06]">
            <div className="truncate max-w-[170px]">
              <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">{currentTrack?.name || '骑行踏频电台'}</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block">
                {currentTrack?.artist || 'YoloCycling Studio'}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={toggleBgm}
                className="w-8 h-8 rounded-full bg-ios-blue hover:bg-ios-blue/90 text-white flex items-center justify-center font-bold shadow-xs transition active:scale-95 apple-touch"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>
              <button
                onClick={nextTrack}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition apple-touch"
                title="下一首"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Volume Slider */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <div className="flex items-center gap-2">
              {volume === 0 ? <VolumeX className="w-3.5 h-3.5 text-slate-400" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span className="text-[11px]">音量</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-32 h-1 bg-slate-200 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-ios-blue"
            />
          </div>

          {/* Track Selection List */}
          <div className="pt-2 border-t border-black/[0.05] dark:border-white/[0.08] space-y-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">
                曲目切换:
              </span>
              <label className="flex items-center gap-1 text-[11px] text-ios-blue hover:opacity-80 cursor-pointer font-medium">
                <Upload className="w-3 h-3" />
                本地音乐
                <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
              {playlist.map((t, idx) => (
                <div
                  key={t.id}
                  onClick={() => selectTrack(idx)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs flex justify-between items-center cursor-pointer transition ${
                    currentTrackIndex === idx
                      ? 'bg-ios-blue text-white font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <span className="truncate max-w-[170px]">{t.name}</span>
                  {t.bpm && <span className={`text-[11px] font-mono ${currentTrackIndex === idx ? 'text-white/80' : 'text-slate-400'}`}>{t.bpm} BPM</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
