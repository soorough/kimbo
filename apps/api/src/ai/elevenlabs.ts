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
