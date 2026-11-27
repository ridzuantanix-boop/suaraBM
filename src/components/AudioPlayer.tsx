import { useEffect, useRef, useState } from "react";
import { Download, Pause, Play } from "lucide-react";
import type { GeneratedClip } from "../types/voiceover.ts";
import { formatBytes, formatTime, triggerWavDownload } from "../utils/audio.ts";

interface AudioPlayerProps {
  clip: GeneratedClip;
  autoPlayTrigger?: number;
}

const RATES = [1, 1.25, 1.5] as const;

export function AudioPlayer({ clip, autoPlayTrigger }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(clip.durationSec);
  const [rateIndex, setRateIndex] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentTime(0);
    setDuration(clip.durationSec);
    setIsPlaying(false);
    audio.playbackRate = RATES[rateIndex];

    if (autoPlayTrigger && autoPlayTrigger > 0) {
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.catch(() => {
          setIsPlaying(false);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.id, clip.durationSec, autoPlayTrigger]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = RATES[rateIndex];
    }
  }, [rateIndex]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    const value = Number(e.target.value);
    setCurrentTime(value);
    if (audio) {
      audio.currentTime = value;
    }
  };

  const cycleRate = () => {
    const next = (rateIndex + 1) % RATES.length;
    setRateIndex(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = RATES[next];
    }
  };

  const maxDuration = duration > 0 ? duration : Math.max(clip.durationSec, 0.1);
  const progressPercent = Math.min(100, (currentTime / maxDuration) * 100);

  return (
    <div
      className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-5"
      data-testid="audio-output-panel"
    >
      <audio
        ref={audioRef}
        src={clip.audioUrl}
        data-testid="audio-element"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          if (Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0) {
            setDuration(e.currentTarget.duration);
          }
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-zinc-100">
        <div className="flex items-center gap-2 text-xs text-zinc-500 min-w-0">
          <span className="font-medium text-zinc-900">Audio Sedia</span>
          <span aria-hidden="true">·</span>
          <span>{clip.voice}</span>
          <span aria-hidden="true">·</span>
          <span className="capitalize">{clip.style}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{formatBytes(clip.sizeBytes)}</span>
        </div>

        <button
          type="button"
          onClick={() => triggerWavDownload(clip.audioUrl, clip.voice, clip.id)}
          data-testid="download-wav-btn"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          <Download className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Muat Turun WAV</span>
        </button>
      </div>

      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={togglePlay}
          data-testid="play-pause-btn"
          aria-label={isPlaying ? "Jeda audio" : "Mainkan audio"}
          className="w-10 h-10 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white flex items-center justify-center shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" aria-hidden="true" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="relative flex items-center h-5">
            <div className="w-full h-1.5 bg-zinc-200 rounded-full overflow-hidden pointer-events-none">
              <div
                className="h-full bg-emerald-600 transition-[width] duration-75"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={maxDuration}
              step={0.05}
              value={Math.min(currentTime, maxDuration)}
              onChange={handleSeek}
              aria-label="Kedudukan audio"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between text-xs font-mono tabular-nums text-zinc-500 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(maxDuration)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={cycleRate}
          aria-label="Tukar kelajuan main balik"
          className="px-2.5 py-1.5 text-xs font-mono tabular-nums text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          {RATES[rateIndex]}x
        </button>
      </div>
    </div>
  );
}
