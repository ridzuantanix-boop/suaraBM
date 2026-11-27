export type VoiceId = "Kore" | "Zephyr" | "Puck" | "Charon" | "Fenrir";

export type StylePresetId = "santai" | "bertenaga" | "profesional" | "bercerita";

export interface VoiceOption {
  id: VoiceId;
  label: string;
  gender: "Wanita" | "Lelaki";
  character: string;
}

export interface StylePreset {
  id: StylePresetId;
  label: string;
  shortDesc: string;
  instruction: string;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: "Kore",
    label: "Kore",
    gender: "Wanita",
    character: "Jelas & seimbang",
  },
  {
    id: "Zephyr",
    label: "Zephyr",
    gender: "Wanita",
    character: "Lembut & mesra",
  },
  {
    id: "Puck",
    label: "Puck",
    gender: "Lelaki",
    character: "Ceria & bertenaga",
  },
  {
    id: "Charon",
    label: "Charon",
    gender: "Lelaki",
    character: "Tenang & berwibawa",
  },
  {
    id: "Fenrir",
    label: "Fenrir",
    gender: "Lelaki",
    character: "Dalam & tegas",
  },
];

export const VALID_VOICE_IDS: readonly VoiceId[] = VOICE_OPTIONS.map((v) => v.id);

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "santai",
    label: "Santai",
    shortDesc: "Reels, TikTok & harian",
    instruction:
      "Natural Malaysian Malay (Bahasa Melayu Malaysia) content creator, warm, conversational, clear standard Malaysian pronunciation, natural rhythm",
  },
  {
    id: "bertenaga",
    label: "Bertenaga",
    shortDesc: "Hook iklan & promo",
    instruction:
      "Energetic Malaysian Malay (Bahasa Melayu Malaysia) short-form video narrator, upbeat, punchy, enthusiastic, crisp diction",
  },
  {
    id: "profesional",
    label: "Profesional",
    shortDesc: "Explainer & korporat",
    instruction:
      "Clear, articulate Malaysian Malay (Bahasa Melayu Malaysia) broadcast presenter, calm, confident, steady well-paced delivery",
  },
  {
    id: "bercerita",
    label: "Bercerita",
    shortDesc: "Kisah, ulasan & podcast",
    instruction:
      "Expressive Malaysian Malay (Bahasa Melayu Malaysia) storyteller, warm, engaging, natural pauses and subtle vocal warmth",
  },
];

export const SAMPLE_SCRIPTS: { label: string; text: string; style: StylePresetId }[] = [
  {
    label: "Hook TikTok",
    style: "bertenaga",
    text: "Tahu tak, ramai orang masih buat satu kesilapan besar bila susun konten setiap minggu? Hari ini saya kongsikan cara paling ringkas untuk jimat masa dan kekal konsisten.",
  },
  {
    label: "Santai Produk",
    style: "santai",
    text: "Kalau korang selalu sibuk waktu pagi tapi tetap nak kopi yang sedap dan cepat siap, cuba cara ni. Dua minit je dah siap, rasa pun memang padu.",
  },
  {
    label: "Explainer",
    style: "profesional",
    text: "Selamat datang. Dalam video ringkas ini, kita akan melihat bagaimana automasi aliran kerja membantu pasukan kreatif menghasilkan lebih banyak kandungan berkualiti dalam masa yang singkat.",
  },
];

export function buildSpeechStyle(
  presetId?: string,
  customStyle?: string
): string {
  const preset =
    STYLE_PRESETS.find((p) => p.id === presetId) ?? STYLE_PRESETS[0];
  const trimmedCustom = (customStyle ?? "").trim();

  if (!trimmedCustom) {
    return preset.instruction;
  }

  return `${preset.instruction}. Additional direction: ${trimmedCustom}`;
}
