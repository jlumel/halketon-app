import fs from "fs";
import path from "path";

const WHISPER_URL =
  process.env.WHISPER_URL ?? "http://localhost:5001/transcribe";

/**
 * Envía el audio guardado en disco al servicio Flask de Faster-Whisper
 * y devuelve la transcripción. Todo local, sin servicios externos.
 */
export async function transcribe(audioPath: string): Promise<string> {
  const absPath = path.isAbsolute(audioPath)
    ? audioPath
    : path.join(process.cwd(), audioPath);

  const buffer = fs.readFileSync(absPath);
  const form = new FormData();
  form.append(
    "audio",
    new Blob([new Uint8Array(buffer)], { type: "audio/webm" }),
    "audio.webm",
  );

  const res = await fetch(WHISPER_URL, { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(`Whisper respondió ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { transcription?: string };
  return data.transcription ?? "";
}
