import { AiUnavailableError, type Voice } from "./types.js";

const API = "https://api.elevenlabs.io/v1";

/**
 * Kimbo's voice through ElevenLabs. The key stays on the server: the app sends text or a
 * recording here and gets audio or text back.
 */
export class ElevenLabsVoice implements Voice {
  constructor(
    private apiKey: string,
    /** a warm, clear voice; override with KIMBO_VOICE_ID */
    private voiceId = "hpp4J3VqNfWAUOO0d1Us",
    private model = "eleven_turbo_v2_5",
  ) {}

  async speak(text: string): Promise<Buffer> {
    const res = await this.call(`/text-to-speech/${this.voiceId}?output_format=mp3_22050_32`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: this.model,
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
      }),
    });
    return Buffer.from(await res.arrayBuffer());
  }

  async transcribe(audio: { base64: string; mimeType: string }): Promise<string> {
    const form = new FormData();
    form.append("model_id", "scribe_v1");
    form.append("file", new Blob([Buffer.from(audio.base64, "base64")], { type: audio.mimeType }), "question.m4a");
    const res = await this.call("/speech-to-text", { method: "POST", body: form });
    const json = (await res.json()) as { text?: string };
    return (json.text ?? "").trim();
  }

  private async call(path: string, init: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, {
        ...init,
        headers: { ...(init.headers as Record<string, string>), "xi-api-key": this.apiKey },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      throw new AiUnavailableError("Kimbo's voice isn't available right now", { cause: err });
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new AiUnavailableError("Kimbo's voice isn't available right now", {
        cause: new Error(`ElevenLabs ${res.status}: ${detail.slice(0, 300)}`),
      });
    }
    return res;
  }
}
