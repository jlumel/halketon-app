import fs from "fs";
import path from "path";
import { obtenerSesion } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sesion = obtenerSesion(id);
  if (!sesion?.audio_path) {
    return new Response("No encontrado", { status: 404 });
  }

  // audio_path es relativo y siempre empieza con "storage/…"
  // Anclarlo explícitamente evita que Turbopack trace todo el proyecto.
  const absPath = path.isAbsolute(sesion.audio_path)
    ? sesion.audio_path
    : path.join(process.cwd(), "storage", path.basename(sesion.audio_path));

  if (!fs.existsSync(absPath)) {
    return new Response("Archivo no disponible", { status: 404 });
  }

  const file = fs.readFileSync(absPath);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "audio/webm",
      "Content-Length": String(file.length),
      "Cache-Control": "no-store",
    },
  });
}
