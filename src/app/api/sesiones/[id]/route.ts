import { actualizarRevision, obtenerSesion } from "@/lib/db";
import type { EstadoSesion } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sesion = obtenerSesion(id);
  if (!sesion) {
    return Response.json({ error: "No encontrada" }, { status: 404 });
  }
  return Response.json(sesion);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as {
    estado: EstadoSesion;
    datos_corregidos?: Parameters<typeof actualizarRevision>[1]["datos_corregidos"];
    comentario?: string;
    revisado_por?: string;
  };

  const updated = actualizarRevision(id, {
    estado: body.estado,
    datos_corregidos: body.datos_corregidos,
    comentario: body.comentario,
    revisado_por: body.revisado_por,
  });

  if (!updated) {
    return Response.json({ error: "No encontrada" }, { status: 404 });
  }
  return Response.json(updated);
}
