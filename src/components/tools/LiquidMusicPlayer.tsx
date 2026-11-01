import React, { useState, useEffect, useRef } from 'react';
import { Music, Play, Pause, SkipForward, SkipBack, Volume2, ListMusic, Plus, Trash2, X, Move, ChevronUp, ChevronDown } from 'lucide-react';
import { IOSCard } from '../common/IOSCard';
import { IOSToolHeader } from '../common/IOSToolHeader';

interface Track {
  id: string;
  name: string;
  artist: string;
  bpm?: number;
  url: string;
}

const DEFAULT_PLAYLIST: Track[] = [
  {
    id: '1',
    name: 'Cadence 90 RPM Techno Drive',
    artist: 'Cycling Beats',
    bpm: 90,
    url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=electronic-future-beats-117997.mp3'
  },
  {
    id: '2',
    name: 'Sweetspot Threshold Pulse 95 BPM',
    artist: 'Aero Tempo',
    bpm: 95,
    url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=tomp-10874.mp3'
  },
  {
    id: '3',
    name: 'Endurance Zone 2 Chill Ride',
    artist: 'Lo-Fi Wheels',
    bpm: 85,
    url: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_7315124ec6.mp3?filename=lofi-study-112191.mp3'
  }
];

export const LiquidMusicPlayer: React.FC<{ isStandalonePage?: boolean }> = ({ isStandalonePage = false }) => {
  const [playlist, setPlaylist] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem('yolo_cycling_playlist');
      return saved ? JSON.parse(saved) : DEFAULT_PLAYLIST;
    } catch {
      return DEFAULT_PLAYLIST;
    }
  });

  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const [showPlaylistDrawer, setShowPlaylistDrawer] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  // New Song Form
  const [newSongName, setNewSongName] = useState<string>('');
  const [newSongUrl, setNewSongUrl] = useState<string>('');

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Save playlist
  useEffect(() => {
    try {
      localStorage.setItem('yolo_cycling_playlist', JSON.stringify(playlist));
    } catch {
      // LocalStorage quota or access exception
    }
  }, [playlist]);

  // Audio setup
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handleEnded = () => handleNext();

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Update audio source when track changes
  useEffect(() => {
    if (!audioRef.current || playlist.length === 0) return;
    const track = playlist[currentTrackIndex] || playlist[0];
    if (track) {
      audioRef.current.src = track.url;
      if (isPlaying) {
        audioRef.current.play().catch(() => {
          // Autoplay blocked by browser policy without user gesture
        });
      }
    }
  }, [currentTrackIndex]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {
        setIsPlaying(false);
      });
    }
  };

  const handleNext = () => {
    if (playlist.length === 0) return;
    setCurrentTrackIndex((prev) => (prev + 1) % playlist.length);
  };

  const handlePrev = () => {
    if (playlist.length === 0) return;
    setCurrentTrackIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setVolume(v);
    if (audioRef.current) {
      audioRef.current.volume = v;
    }
  };

  const addCustomTrack = () => {
    if (!newSongUrl) return;
    const newTrack: Track = {
      id: Date.now().toString(),
      name: newSongName || '自定义骑行音频',
      artist: 'Custom User Track',
      url: newSongUrl
    };
    setPlaylist(prev => [...prev, newTrack]);
    setNewSongName('');
    setNewSongUrl('');
  };

  const removeTrack = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPlaylist(prev => prev.filter(t => t.id !== id));
  };

  const formatTime = (sec: number) => {
    if (isNaN(sec) || sec <= 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const currentTrack = playlist[currentTrackIndex] || playlist[0];

  // If standalone full page
  if (isStandalonePage) {
    return (
      <div className="space-y-4 sm:space-y-5">
        {/* Standard Apple HIG Tool Header */}
        <IOSToolHeader
          category="踏频节奏电台"
          categoryIcon={Music}
          title="踏频节奏电台"
          description="匹配 85~105 BPM 黄金踏频节奏曲目，支持在训练与巡航中保持专注力。"
          tint="red"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
          {/* Main Big Player Card */}
          <div className="lg:col-span-6 space-y-4">
            <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card text-center space-y-4">
              <div className="w-36 h-36 sm:w-40 sm:h-40 mx-auto rounded-2xl bg-gradient-to-br from-ios-blue/15 to-ios-purple/15 border border-slate-200/80 dark:border-white/10 flex items-center justify-center relative shadow-ios-sm group">
                <Music className={`w-12 h-12 text-ios-blue ${isPlaying ? 'animate-pulse' : ''}`} />
                {currentTrack?.bpm && (
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-[11px] font-mono text-white font-bold tabular-nums">
                    {currentTrack.bpm} BPM
                  </span>
                )}
              </div>

              <div>
                <h2 className="text-base sm:text-lg font-bold font-display text-slate-900 dark:text-white">{currentTrack?.name || '未播放'}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{currentTrack?.artist || 'YoloCycling Audio Station'}</p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-ios-blue"
                />
                <div className="flex justify-between text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4 pt-1">
                <button
                  onClick={handlePrev}
                  className="w-9 h-9 rounded-full bg-slate-100/80 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 flex items-center justify-center apple-touch transition shadow-xs"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={togglePlay}
                  className="w-12 h-12 rounded-full bg-ios-blue hover:bg-ios-blue/90 text-white flex items-center justify-center shadow-ios-sm apple-touch transition"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                </button>
                <button
                  onClick={handleNext}
                  className="w-9 h-9 rounded-full bg-slate-100/80 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 flex items-center justify-center apple-touch transition shadow-xs"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>

              {/* Volume */}
              <div className="flex items-center justify-center gap-2.5 pt-1 max-w-xs mx-auto text-xs text-slate-500 dark:text-slate-400">
                <Volume2 className="w-3.5 h-3.5 shrink-0" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-full h-1 bg-slate-200 dark:bg-white/10 rounded appearance-none cursor-pointer accent-ios-blue"
                />
              </div>
            </div>
          </div>

          {/* Playlist & Add Song */}
          <div className="lg:col-span-6 space-y-4">
            <div className="ios-card p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-ios-card space-y-4">
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-ios-blue" />
                骑行播放列表 ({playlist.length} 首)
              </h3>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {playlist.map((t, idx) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setCurrentTrackIndex(idx);
                      setIsPlaying(true);
                    }}
                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer apple-touch transition ${
                      currentTrackIndex === idx
                        ? 'bg-ios-blue/10 border-ios-blue text-ios-blue font-semibold shadow-xs'
                        : 'bg-white/70 dark:bg-white/5 border-slate-200/70 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-mono text-slate-400 dark:text-slate-500 w-4 tabular-nums">{idx + 1}</span>
                      <div>
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">{t.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{t.artist}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {t.bpm && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-white/10 text-ios-blue font-mono tabular-nums">{t.bpm} BPM</span>}
                      {playlist.length > 1 && (
                        <button
                          onClick={(e) => removeTrack(t.id, e)}
                          className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-white/15 text-slate-400 hover:text-ios-red transition apple-touch"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Custom URL */}
              <div className="pt-3 border-t border-slate-200/80 dark:border-white/10 space-y-2.5">
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">添加自定义骑行音频链接</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="曲目名称 · 可选"
                    value={newSongName}
                    onChange={(e) => setNewSongName(e.target.value)}
                    className="bg-white/90 dark:bg-black/40 border border-slate-200/80 dark:border-white/15 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-ios-blue"
                  />
                  <input
                    type="url"
                    placeholder="直接音频链接 · MP3 / WAV / OGG"
                    value={newSongUrl}
                    onChange={(e) => setNewSongUrl(e.target.value)}
                    className="bg-white/90 dark:bg-black/40 border border-slate-200/80 dark:border-white/15 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-ios-blue"
                  />
                </div>
                <button
                  onClick={addCustomTrack}
                  disabled={!newSongUrl}
                  className="w-full h-9 bg-ios-blue hover:bg-ios-blue/90 text-white font-semibold disabled:opacity-40 rounded-xl text-xs transition shadow-ios-sm apple-touch flex items-center justify-center"
                >
                  添加到当前歌单
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Floating Widget Mode
  return (
    <div className="fixed bottom-20 sm:bottom-5 right-4 sm:right-5 z-50">
      <div className="ios-card p-3.5 rounded-2xl border border-black/[0.08] dark:border-white/15 shadow-ios-popover bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl w-80 max-w-[calc(100vw-2rem)] space-y-2.5">
        {/* Widget Top Bar */}
        <div className="flex items-center justify-between border-b border-black/[0.05] dark:border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-ios-blue/15 text-ios-blue flex items-center justify-center">
              <Music className={`w-3.5 h-3.5 ${isPlaying ? 'animate-pulse' : ''}`} />
            </div>
            <div className="truncate max-w-[140px]">
              <span className="text-xs font-semibold text-slate-800 dark:text-white block truncate">{currentTrack?.name || '骑行音乐'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <button
              onClick={() => setShowPlaylistDrawer(!showPlaylistDrawer)}
              className={`p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition apple-touch ${showPlaylistDrawer ? 'text-ios-blue' : ''}`}
            >
              <ListMusic className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition apple-touch"
            >
              {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Progress */}
            <div className="space-y-1">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-slate-200 dark:bg-white/10 rounded appearance-none cursor-pointer accent-ios-blue"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between pt-1">
              <button onClick={handlePrev} className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition apple-touch">
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={togglePlay}
                className="w-9 h-9 rounded-full bg-ios-blue hover:bg-ios-blue/90 text-white flex items-center justify-center shadow-ios-sm font-bold transition apple-touch"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>
              <button onClick={handleNext} className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition apple-touch">
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {/* Playlist Drawer */}
            {showPlaylistDrawer && (
              <div className="pt-2 border-t border-slate-200/80 dark:border-white/10 space-y-1.5 max-h-40 overflow-y-auto">
                {playlist.map((t, idx) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setCurrentTrackIndex(idx);
                      setIsPlaying(true);
                    }}
                    className={`p-2 rounded-xl text-xs flex justify-between items-center cursor-pointer apple-touch transition ${
                      currentTrackIndex === idx
                        ? 'bg-ios-blue text-white font-bold shadow-xs'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                    }`}
                  >
                    <span className="truncate">{t.name}</span>
                    {t.bpm && (
                      <span className={`text-[11px] font-mono ${currentTrackIndex === idx ? 'text-white/80' : 'text-slate-500'}`}>
                        {t.bpm} BPM
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
