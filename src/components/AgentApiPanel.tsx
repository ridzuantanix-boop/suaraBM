import { useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2, Play } from "lucide-react";
import { STYLE_PRESETS, VOICE_OPTIONS } from "../shared/voices.ts";
import type { TtsApiResponse } from "../types/voiceover.ts";
import { base64ToWavBlobUrl } from "../utils/audio.ts";

type SnippetTab = "curl" | "javascript" | "python";

export function AgentApiPanel() {
  const [activeTab, setActiveTab] = useState<SnippetTab>("curl");
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: "ok" | "error";
    message: string;
    audioUrl?: string;
  } | null>(null);
  const testAudioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (testAudioUrlRef.current) {
        URL.revokeObjectURL(testAudioUrlRef.current);
      }
    };
  }, []);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  const snippets: Record<SnippetTab, string> = {
    curl: `# Pulangkan fail audio .wav secara terus (sesuai untuk Agent AI / n8n)
curl -X POST "${origin}/api/tts?format=wav" \\
  -H "Content-Type: application/json" \\
  -d '{
    "text": "Hai semua, ini contoh voiceover Bahasa Melayu.",
    "voice": "Kore",
    "style": "santai"
  }' \\
  --output voiceover.wav`,
    javascript: `const res = await fetch("${origin}/api/tts", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    text: "Hai semua, ini contoh voiceover Bahasa Melayu.",
    voice: "Kore",
    style: "santai",
    customStyle: ""
  }),
});

const data = await res.json();
// data.audioBase64 -> base64 WAV (audio/wav, 24kHz mono)
// data.durationSec -> tempoh audio dalam saat`,
    python: `import requests

response = requests.post(
    "${origin}/api/tts?format=wav",
    json={
        "text": "Hai semua, ini contoh voiceover Bahasa Melayu.",
        "voice": "Kore",
        "style": "santai",
    },
    timeout=60,
)
response.raise_for_status()

with open("voiceover.wav", "wb") as f:
    f.write(response.content)`,
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippets[activeTab]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored silently
    }
  };

  const handleLiveTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Ujian sambungan berjaya. Sistem suara Bahasa Melayu sedia digunakan.",
          voice: "Kore",
          style: "santai",
        }),
      });
      const data = (await response.json()) as TtsApiResponse;
      if (!response.ok || !data.audioBase64) {
        throw new Error(data.error || "Gagal menghubungi endpoint /api/tts.");
      }
      const audioUrl = base64ToWavBlobUrl(data.audioBase64);
      if (testAudioUrlRef.current) {
        URL.revokeObjectURL(testAudioUrlRef.current);
      }
      testAudioUrlRef.current = audioUrl;
      setTestResult({
        status: "ok",
        message: `200 OK · ${data.durationSec}s · ${Math.round(data.sizeBytes / 1024)} KB · audio/wav`,
        audioUrl,
      });
    } catch (err) {
      setTestResult({
        status: "error",
        message: err instanceof Error ? err.message : "Ralat tidak dijangka.",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 text-balance">
          Endpoint API untuk Agent AI
        </h1>
        <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
          Panggil endpoint ini terus daripada Agent AI, skrip automasi, atau aliran kerja kandungan untuk menghasilkan fail WAV Bahasa Melayu tanpa perlu melalui antaramuka.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white border border-zinc-200 rounded-xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-100">
            <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg">
              {(["curl", "javascript", "python"] as SnippetTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === tab
                      ? "bg-white text-zinc-900 shadow-xs"
                      : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {tab === "curl" ? "cURL" : tab === "javascript" ? "JavaScript" : "Python"}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                  <span>Disalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Salin Kod</span>
                </>
              )}
            </button>
          </div>

          <pre className="mt-4 p-4 bg-zinc-950 text-zinc-100 rounded-lg text-xs font-mono leading-relaxed overflow-x-auto">
            <code>{snippets[activeTab]}</code>
          </pre>

          <div className="mt-5 pt-4 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleLiveTest}
              disabled={testing}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {testing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              )}
              <span>{testing ? "Menguji Endpoint..." : "Uji Endpoint /api/tts"}</span>
            </button>

            {testResult && (
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`text-xs font-mono tabular-nums ${
                    testResult.status === "ok" ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {testResult.message}
                </span>
                {testResult.audioUrl && (
                  <audio
                    controls
                    src={testResult.audioUrl}
                    className="h-8 max-w-[180px]"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl p-5 sm:p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Rujukan Ringkas</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Format respons boleh dipilih antara JSON (<code className="font-mono text-zinc-800">audioBase64</code>) atau fail binari terus (<code className="font-mono text-zinc-800">?format=wav</code>).
            </p>
          </div>

          <div className="space-y-3 text-xs border-t border-zinc-100 pt-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-mono text-zinc-900 font-medium">POST /api/tts</span>
              <span className="text-zinc-500">Jana audio WAV</span>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-mono text-zinc-900 font-medium">GET /api/voices</span>
              <span className="text-zinc-500">Senarai suara & gaya</span>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-mono text-zinc-900 font-medium">GET /api/health</span>
              <span className="text-zinc-500">Semak status pelayan</span>
            </div>
          </div>

          <div className="space-y-2.5 border-t border-zinc-100 pt-4">
            <h3 className="text-xs font-semibold text-zinc-900">Nilai Parameter Sah</h3>
            <div className="text-xs text-zinc-600 space-y-1.5">
              <p>
                <span className="font-mono text-zinc-900">voice</span>:{" "}
                {VOICE_OPTIONS.map((v) => v.id).join(", ")}
              </p>
              <p>
                <span className="font-mono text-zinc-900">style</span>:{" "}
                {STYLE_PRESETS.map((s) => s.id).join(", ")}
              </p>
              <p>
                <span className="font-mono text-zinc-900">customStyle</span>: Arahan tambahan bebas (pilihan)
              </p>
              <p>
                <span className="font-mono text-zinc-900">format</span>: <code className="font-mono text-zinc-800">json</code> (lalai) atau <code className="font-mono text-zinc-800">wav</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
