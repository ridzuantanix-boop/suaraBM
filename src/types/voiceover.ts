import type { StylePresetId, VoiceId } from "../shared/voices.ts";

export interface GeneratedClip {
  id: string;
  text: string;
  voice: VoiceId;
  style: StylePresetId;
  customStyle: string;
  audioUrl: string;
  audioBase64: string;
  durationSec: number;
  sizeBytes: number;
  createdAt: number;
}

export interface TtsApiResponse {
  audioBase64: string;
  mimeType: string;
  voice: VoiceId;
  style: StylePresetId;
  durationSec: number;
  sizeBytes: number;
  error?: string;
}
