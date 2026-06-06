import { getDb, guardarResultadoPipeline, setEstado } from "@/lib/db";
import { estructurar } from "@/lib/ollama";
import { transcribe } from "@/lib/whisper";

export const runtime = "nodejs";

// Este endpoint NO es para el frontend. Solo lo llama n8n (o el fallback inline).
export async function POST(request: Request) {
  const { session_id, audio_path, programa } = (await request.json()) as {
    session_id: string;
    audio_path: string;
    programa: string;
  };

  const db = getDb();

  try {
    db.prepare("UPDATE sesiones SET estado='procesando' WHERE id=?").run(
      session_id,
    );

    // 1. Transcribir (Faster-Whisper local)
    const transcripcion = await transcribe(audio_path);

    // 2. Estructurar con Ollama (qwen3:8b, think:false)
    const structured = await estructurar(transcripcion, programa);

    // 3. Guardar resultado y pasar a 'no_verificado'
    guardarResultadoPipeline(session_id, structured, transcripcion);

    return Response.json({ ok: true, session_id });
  } catch (err) {
    setEstado(session_id, "error_pipeline");
    return Response.json(
      { ok: false, error: String(err) },
      { status: 500 },
    );
  }
}
