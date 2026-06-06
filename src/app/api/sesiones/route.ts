import { listarSesiones } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado") ?? "no_verificado";
  const data = listarSesiones(estado);
  return Response.json(data);
}
