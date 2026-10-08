/**
 * The only boundary that knows about AI providers. Product logic depends on
 * these interfaces; nutrition, rules and progress never come from AI output.
 */

export interface RecognizedItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  confidence: number;
}

export interface MealRecognizer {
  fromText(text: string): Promise<RecognizedItem[]>;
  fromImage(image: { base64: string; mimeType: string }): Promise<RecognizedItem[]>;
}

export interface ExtractedMarker {
  markerName: string;
  value: number;
  unit: string;
}

export interface ExtractedReport {
  markers: ExtractedMarker[];
  reportDate: string | null;
}

export interface ReportExtractor {
  extract(file: { base64: string; mimeType: string }): Promise<ExtractedReport>;
}

export interface CoachReply {
  text: string;
  points: string[];
  mood: string;
}

/** Answers free-form questions using only the facts Kimbo hands it. */
export interface Coach {
  reply(input: { question: string; facts: string; history: { role: "user" | "kimbo"; text: string }[] }): Promise<CoachReply>;
}

/** Kimbo's voice: speech out and in. Optional, so the app works without it. */
export interface Voice {
  speak(text: string): Promise<Buffer>;
  transcribe(audio: { base64: string; mimeType: string }): Promise<string>;
}

/** Thrown by adapters when the provider fails; surfaced to clients as a retryable error. */
export class AiUnavailableError extends Error {
  constructor(message = "Kimbo couldn't reach its analysis service", options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiUnavailableError";
  }
}
