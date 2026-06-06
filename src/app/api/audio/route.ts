import fs from "fs";
import path from "path";
import { crearSesion, getDb, setEstado, upsertBeneficiario } from "@/lib/db";
import type { BeneficiarioInput } from "@/lib/types";

export const runtime = "nodejs";

// CORS: el promotor usa la PWA desde Vercel y necesita postear al PC local.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": process.env.CORS_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

const N8N_WEBHOOK =
  process.env.N8N_WEBHOOK_URL ??
  "http://localhost:5678/webhook/procesar-audio";

const STORAGE_DIR = path.join(process.cwd(), "storage");

export async function POST(request: Request) {
  const formData = await request.formData();
  const audio = formData.get("audio") as File | null;
  const promotor = (formData.get("promotor") as string) ?? "";
  const programa = (formData.get("programa") as string) ?? "";
  const beneficiarioRaw = (formData.get("beneficiario") as string) ?? "{}";

  if (!audio) {
    return Response.json({ error: "Falta el audio" }, { status: 400 });
  }

  let beneficiario: BeneficiarioInput;
  try {
    beneficiario = JSON.parse(beneficiarioRaw);
  } catch {
    return Response.json({ error: "beneficiario inválido" }, { status: 400 });
  }

  // 1. Guardar audio en ./storage/
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
  const timestamp = Date.now();
  const audioPath = path.join(STORAGE_DIR, `${timestamp}.webm`);
  const buffer = Buffer.from(await audio.arrayBuffer());
  fs.writeFileSync(audioPath, buffer);
  const relativeAudioPath = path.relative(process.cwd(), audioPath);

  // 2. Crear beneficiario si no existe (por DNI)
  getDb();
  const beneficiarioId = upsertBeneficiario({
    nombre: beneficiario.nombre,
    apellido: beneficiario.apellido,
    dni: beneficiario.dni,
    fecha_nacimiento: beneficiario.fecha_nacimiento,
    es_menor: beneficiario.es_menor,
  });

  // 3. Crear sesión con estado 'en_cola'
  const sessionId = crypto.randomUUID();
  crearSesion({
    id: sessionId,
    beneficiario_id: beneficiarioId,
    promotor,
    programa,
    audio_path: relativeAudioPath,
    metricas: beneficiario.metricas ?? {},
    estado: "en_cola",
  });

  // 4. Encolar en n8n (fire and forget). Fallback: procesar inline.
  try {
    const res = await fetch(N8N_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        audio_path: relativeAudioPath,
        programa,
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`n8n ${res.status}`);
  } catch {
    // n8n no disponible: fallback que mantiene la demo funcionando.
    // Disparamos el pipeline interno sin bloquear la respuesta.
    setEstado(sessionId, "error_cola");
    dispararFallback(sessionId, relativeAudioPath, programa);
  }

  return Response.json({ session_id: sessionId, status: "en_cola" }, { headers: CORS_HEADERS });
}

/**
 * Si n8n no está disponible, llamamos al endpoint interno directamente.
 * No esperamos la respuesta (la demo sigue funcionando, solo se pierde la
 * visibilidad de la cola visual de n8n).
 */
function dispararFallback(
  sessionId: string,
  audioPath: string,
  programa: string,
) {
  const base = process.env.SELF_URL ?? "http://localhost:3000";
  fetch(`${base}/api/internal/transcribir`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      audio_path: audioPath,
      programa,
    }),
  }).catch(() => {
    setEstado(sessionId, "error_pipeline");
  });
}
