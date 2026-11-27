import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import {
  STYLE_PRESETS,
  VALID_VOICE_IDS,
  VOICE_OPTIONS,
  buildSpeechStyle,
} from "./src/shared/voices.ts";
import type { VoiceId } from "./src/shared/voices.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const TTS_MODEL = "gemini-3.8-flash-lite-tts";
const MAX_TEXT_LENGTH = 4000;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY tidak ditetapkan pada pelayan.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function estimateWavDurationSec(wavBuffer: Buffer): number {
  if (wavBuffer.length > 44 && wavBuffer.subarray(0, 4).toString("ascii") === "RIFF") {
    const byteRate = wavBuffer.readUInt32LE(28);
    const dataSize = wavBuffer.length - 44;
    if (byteRate > 0) {
      return Number((dataSize / byteRate).toFixed(2));
    }
  }
  // Fallback for 24kHz mono 16-bit PCM (48000 bytes/sec)
  return Number((Math.max(0, wavBuffer.length - 44) / 48000).toFixed(2));
}

function extractErrorStatus(err: unknown): number {
  if (err && typeof err === "object") {
    const record = err as Record<string, unknown>;
    if (typeof record.status === "number") return record.status;
    if (typeof record.code === "number") return record.code;
  }
  return 500;
}

function formatFriendlyError(err: unknown): { status: number; message: string } {
  const status = extractErrorStatus(err);
  const rawMessage = err instanceof Error ? err.message : String(err);

  if (rawMessage.includes("GEMINI_API_KEY")) {
    return {
      status: 500,
      message: "Kunci API Gemini tidak dijumpai. Sila semak tetapan Settings > Secrets.",
    };
  }
  if (status === 403 || status === 400 && rawMessage.includes("API_KEY_INVALID")) {
    return {
      status,
      message: "Akses API ditolak atau kunci API tidak sah. Sila semak Settings > Secrets.",
    };
  }
  if (status === 429 || rawMessage.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      message: "Had kuota API telah dicapai buat sementara waktu. Sila cuba lagi sebentar nanti.",
    };
  }
  return {
    status: status >= 400 && status < 600 ? status : 500,
    message: rawMessage || "Gagal menjana audio voiceover.",
  };
}

async function generateTtsWithRetry(
  ai: GoogleGenAI,
  text: string,
  voiceName: VoiceId,
  styleInstruction: string
): Promise<string> {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: TTS_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                text,
                speechMetadata: {
                  style: styleInstruction,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        throw new Error("Model tidak memulangkan data audio. Sila semak skrip anda dan cuba lagi.");
      }

      return base64Audio;
    } catch (err) {
      lastError = err;
      const status = extractErrorStatus(err);
      const isRetryable = status === 429 || status >= 500;
      if (!isRetryable || attempt === maxAttempts) {
        break;
      }
      const delayMs = 600 * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // Health check for AI agents & uptime checks
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true, model: TTS_MODEL });
  });

  // Discoverable voice & style options for AI agents
  app.get("/api/voices", (_req: Request, res: Response) => {
    res.json({
      defaultVoice: "Kore",
      defaultStyle: "santai",
      voices: VOICE_OPTIONS,
      styles: STYLE_PRESETS.map(({ id, label, shortDesc }) => ({
        id,
        label,
        description: shortDesc,
      })),
    });
  });

  // Main TTS endpoint (supports JSON response or raw audio/wav binary)
  app.post("/api/tts", async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as {
        text?: unknown;
        voice?: unknown;
        style?: unknown;
        customStyle?: unknown;
        format?: unknown;
      };

      const rawText = typeof body.text === "string" ? body.text.trim() : "";
      if (!rawText) {
        res.status(400).json({
          error: "Medan 'text' wajib diisi dengan skrip Bahasa Melayu.",
        });
        return;
      }

      if (rawText.length > MAX_TEXT_LENGTH) {
        res.status(400).json({
          error: `Skrip melebihi had maksimum ${MAX_TEXT_LENGTH} aksara.`,
        });
        return;
      }

      const requestedVoice =
        typeof body.voice === "string" && body.voice.trim()
          ? body.voice.trim()
          : "Kore";

      if (!VALID_VOICE_IDS.includes(requestedVoice as VoiceId)) {
        res.status(400).json({
          error: `Suara '${requestedVoice}' tidak sah. Pilihan sah: ${VALID_VOICE_IDS.join(", ")}.`,
        });
        return;
      }

      const voice = requestedVoice as VoiceId;
      const stylePreset =
        typeof body.style === "string" ? body.style.trim() : "santai";
      const customStyle =
        typeof body.customStyle === "string" ? body.customStyle.trim() : "";

      const styleInstruction = buildSpeechStyle(stylePreset, customStyle);
      const ai = getAiClient();
      const base64Audio = await generateTtsWithRetry(
        ai,
        rawText,
        voice,
        styleInstruction
      );

      const wavBuffer = Buffer.from(base64Audio, "base64");
      const durationSec = estimateWavDurationSec(wavBuffer);

      const wantsBinary =
        req.query.format === "wav" ||
        body.format === "wav" ||
        req.headers.accept === "audio/wav";

      if (wantsBinary) {
        res.setHeader("Content-Type", "audio/wav");
        res.setHeader("Content-Length", String(wavBuffer.length));
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="voiceover-${voice.toLowerCase()}.wav"`
        );
        res.setHeader("X-Audio-Duration", String(durationSec));
        res.send(wavBuffer);
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType: "audio/wav",
        voice,
        style: stylePreset,
        durationSec,
        sizeBytes: wavBuffer.length,
      });
    } catch (err) {
      const { status, message } = formatFriendlyError(err);
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV === "production") {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SuaraBM server running on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error("Failed to start SuaraBM server:", err);
  process.exit(1);
});
