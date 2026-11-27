import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Download,
  Loader2,
  Play,
  Trash2,
  Volume2,
} from "lucide-react";
import { AudioPlayer } from "./components/AudioPlayer.tsx";
import { AgentApiPanel } from "./components/AgentApiPanel.tsx";
import {
  SAMPLE_SCRIPTS,
  STYLE_PRESETS,
  VOICE_OPTIONS,
} from "./shared/voices.ts";
import type { StylePresetId, VoiceId } from "./shared/voices.ts";
import type { GeneratedClip, TtsApiResponse } from "./types/voiceover.ts";
import {
  base64ToWavBlobUrl,
  estimateReadingSeconds,
  formatTime,
  triggerWavDownload,
} from "./utils/audio.ts";

type ActiveView = "generator" | "api";

const MAX_CHARS = 4000;

export default function App() {
  const [view, setView] = useState<ActiveView>("generator");
  const [script, setScript] = useState("");
  const [voice, setVoice] = useState<VoiceId>("Kore");
  const [style, setStyle] = useState<StylePresetId>("santai");
  const [customStyle, setCustomStyle] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clips, setClips] = useState<GeneratedClip[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [autoPlayTrigger, setAutoPlayTrigger] = useState(0);
  const [sampleIndex, setSampleIndex] = useState(0);

  const clipsRef = useRef<GeneratedClip[]>([]);
  clipsRef.current = clips;

  useEffect(() => {
    return () => {
      for (const clip of clipsRef.current) {
        URL.revokeObjectURL(clip.audioUrl);
      }
    };
  }, []);

  const activeClip = clips.find((c) => c.id === activeClipId) ?? clips[0] ?? null;
  const trimmedLength = script.trim().length;
  const estimatedSec = estimateReadingSeconds(script);

  const handleLoadSample = () => {
    const sample = SAMPLE_SCRIPTS[sampleIndex % SAMPLE_SCRIPTS.length];
    setSampleIndex((i) => i + 1);
    setScript(sample.text);
    setStyle(sample.style);
    setError(null);
    setView("generator");
  };

  const handleGenerate = async () => {
    const cleanText = script.trim();
    if (!cleanText || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: cleanText,
          voice,
          style,
          customStyle: customStyle.trim() || undefined,
        }),
      });

      const data = (await response.json()) as TtsApiResponse;
      if (!response.ok || !data.audioBase64) {
        throw new Error(data.error || "Gagal menjana voiceover. Sila cuba lagi.");
      }

      const audioUrl = base64ToWavBlobUrl(data.audioBase64);
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const newClip: GeneratedClip = {
        id,
        text: cleanText,
        voice: data.voice,
        style,
        customStyle: customStyle.trim(),
        audioUrl,
        audioBase64: data.audioBase64,
        durationSec: data.durationSec,
        sizeBytes: data.sizeBytes,
        createdAt: Date.now(),
      };

      setClips((prev) => [newClip, ...prev].slice(0, 12));
      setActiveClipId(id);
      setAutoPlayTrigger((n) => n + 1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Berlaku ralat semasa menjana audio."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleDeleteClip = (id: string) => {
    setClips((prev) => {
      const target = prev.find((c) => c.id === id);
      if (target) {
        URL.revokeObjectURL(target.audioUrl);
      }
      const next = prev.filter((c) => c.id !== id);
      if (activeClipId === id) {
        setActiveClipId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const handleSelectClip = (id: string) => {
    setActiveClipId(id);
    setAutoPlayTrigger((n) => n + 1);
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900">
      {/* Top Bar: strict 3-zone contract */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setView("generator")}
            className="text-base font-bold tracking-tight text-zinc-900 whitespace-nowrap shrink-0"
          >
            SuaraBM
          </button>

          <nav
            aria-label="Navigasi utama"
            className="flex items-center gap-6 text-sm font-medium"
          >
            <button
              type="button"
              onClick={() => setView("generator")}
              data-testid="nav-generator"
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                view === "generator"
                  ? "text-zinc-900 border-zinc-900"
                  : "text-zinc-500 border-transparent hover:text-zinc-900"
              }`}
            >
              Penjana
            </button>
            <button
              type="button"
              onClick={() => setView("api")}
              data-testid="nav-api"
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                view === "api"
                  ? "text-zinc-900 border-zinc-900"
                  : "text-zinc-500 border-transparent hover:text-zinc-900"
              }`}
            >
              API Agent
            </button>
          </nav>

          <button
            type="button"
            onClick={handleLoadSample}
            data-testid="load-sample-btn"
            className="px-3.5 py-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-300 bg-white rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Contoh Skrip
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-5 sm:px-8 py-8">
        {view === "api" ? (
          <AgentApiPanel />
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Main Script & Output Column */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-white border border-zinc-200 rounded-xl p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <label
                      htmlFor="script-input"
                      className="text-sm font-semibold text-zinc-900"
                    >
                      Skrip Bahasa Melayu
                    </label>
                    <div className="flex items-center gap-2.5 text-xs text-zinc-500">
                      <span className="font-mono tabular-nums">
                        {script.length}/{MAX_CHARS}
                      </span>
                      {estimatedSec > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            ~{estimatedSec}s
                          </span>
                        </>
                      )}
                      {script.length > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <button
                            type="button"
                            onClick={() => {
                              setScript("");
                              setError(null);
                            }}
                            data-testid="clear-script-btn"
                            className="text-zinc-500 hover:text-zinc-900 transition-colors whitespace-nowrap"
                          >
                            Padam
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <textarea
                    id="script-input"
                    name="script"
                    data-testid="script-input"
                    rows={7}
                    maxLength={MAX_CHARS}
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Taip atau tampal skrip voiceover Bahasa Melayu di sini..."
                    className="w-full resize-y min-h-[180px] text-[15px] leading-relaxed text-zinc-900 placeholder:text-zinc-400 bg-zinc-50/70 border border-zinc-200 rounded-lg px-4 py-3 focus:outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                  />

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-zinc-500">
                      Pintasan: <kbd className="font-mono text-zinc-700">Ctrl</kbd> +{" "}
                      <kbd className="font-mono text-zinc-700">Enter</kbd>
                    </span>

                    <button
                      type="button"
                      id="generate-btn"
                      data-testid="generate-btn"
                      onClick={handleGenerate}
                      disabled={isGenerating || trimmedLength === 0}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 disabled:text-zinc-500 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          <span>Menjana Audio...</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-4 h-4" aria-hidden="true" />
                          <span>Jana Voiceover</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    data-testid="error-banner"
                    className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}

                {isGenerating && !activeClip ? (
                  <div className="bg-white border border-zinc-200 rounded-xl p-5 flex items-center gap-3 text-sm text-zinc-600">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" aria-hidden="true" />
                    <span>Sedang memproses suara Bahasa Melayu...</span>
                  </div>
                ) : activeClip ? (
                  <AudioPlayer
                    clip={activeClip}
                    autoPlayTrigger={autoPlayTrigger}
                  />
                ) : (
                  <div className="bg-white border border-zinc-200 rounded-xl p-5 flex items-center justify-between gap-4 text-sm text-zinc-500">
                    <span>Audio WAV yang dijana akan muncul di sini.</span>
                    <span className="text-xs font-mono text-zinc-400 whitespace-nowrap">
                      24kHz · WAV
                    </span>
                  </div>
                )}
              </div>

              {/* Simple Voice & Style Controls Column */}
              <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-zinc-900">
                      Pilih Suara
                    </h2>
                    <span className="text-xs text-zinc-500">{voice}</span>
                  </div>

                  <div
                    role="radiogroup"
                    aria-label="Pilih suara voiceover"
                    className="space-y-1.5"
                  >
                    {VOICE_OPTIONS.map((option) => {
                      const isSelected = voice === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          data-testid={`voice-option-${option.id}`}
                          onClick={() => setVoice(option.id)}
                          className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border text-left transition-colors ${
                            isSelected
                              ? "border-zinc-900 bg-zinc-50 text-zinc-900"
                              : "border-zinc-200/80 hover:border-zinc-300 text-zinc-700"
                          }`}
                        >
                          <div className="flex items-baseline gap-2 min-w-0">
                            <span className="text-sm font-medium text-zinc-900">
                              {option.label}
                            </span>
                            <span className="text-xs text-zinc-500 truncate">
                              {option.gender} · {option.character}
                            </span>
                          </div>
                          {isSelected && (
                            <Check
                              className="w-4 h-4 text-emerald-600 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-5 border-t border-zinc-100">
                  <h2 className="text-sm font-semibold text-zinc-900 mb-3">
                    Gaya Penyampaian
                  </h2>

                  <div
                    role="radiogroup"
                    aria-label="Pilih gaya penyampaian"
                    className="grid grid-cols-2 gap-2"
                  >
                    {STYLE_PRESETS.map((preset) => {
                      const isSelected = style === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          data-testid={`style-option-${preset.id}`}
                          onClick={() => setStyle(preset.id)}
                          className={`px-3 py-2.5 rounded-lg border text-left transition-colors ${
                            isSelected
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : "border-zinc-200 hover:border-zinc-300 bg-white text-zinc-800"
                          }`}
                        >
                          <div className="text-xs font-semibold whitespace-nowrap">
                            {preset.label}
                          </div>
                          <div
                            className={`text-[11px] mt-0.5 truncate ${
                              isSelected ? "text-zinc-300" : "text-zinc-500"
                            }`}
                          >
                            {preset.shortDesc}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4">
                    <label
                      htmlFor="custom-style-input"
                      className="block text-xs font-medium text-zinc-600 mb-1.5"
                    >
                      Arahan tambahan (pilihan)
                    </label>
                    <input
                      id="custom-style-input"
                      name="customStyle"
                      data-testid="custom-style-input"
                      type="text"
                      value={customStyle}
                      onChange={(e) => setCustomStyle(e.target.value)}
                      placeholder="Cth: Cakap sedikit perlahan, nada mesra"
                      className="w-full text-xs text-zinc-900 placeholder:text-zinc-400 bg-zinc-50/70 border border-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Session History (only rendered when clips exist) */}
            {clips.length > 0 && (
              <section
                aria-label="Sejarah janaan sesi ini"
                className="bg-white border border-zinc-200 rounded-xl overflow-hidden"
              >
                <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <h2 className="text-sm font-semibold text-zinc-900">
                      Sejarah Sesi
                    </h2>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {clips.length} klip
                    </span>
                  </div>
                </div>

                <ul className="divide-y divide-zinc-100">
                  {clips.map((clip) => {
                    const isCurrent = activeClip?.id === clip.id;
                    return (
                      <li
                        key={clip.id}
                        className={`px-5 py-3 flex items-center justify-between gap-4 transition-colors ${
                          isCurrent ? "bg-zinc-50/90" : "hover:bg-zinc-50/50"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectClip(clip.id)}
                          className="flex-1 min-w-0 text-left flex items-center gap-3"
                        >
                          <span
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                              isCurrent
                                ? "bg-zinc-900 text-white"
                                : "bg-zinc-100 text-zinc-700"
                            }`}
                          >
                            <Play className="w-3 h-3 fill-current ml-0.5" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-zinc-900 truncate">
                              {clip.text}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                              <span>{clip.voice}</span>
                              <span aria-hidden="true">·</span>
                              <span className="capitalize">{clip.style}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                {formatTime(clip.durationSec)}
                              </span>
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              triggerWavDownload(clip.audioUrl, clip.voice, clip.id)
                            }
                            aria-label="Muat turun klip WAV"
                            className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                          >
                            <Download className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClip(clip.id)}
                            aria-label="Padam klip daripada sejarah"
                            className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
