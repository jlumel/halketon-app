"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Inbox, RefreshCw } from "lucide-react";
import { getPrograma } from "@/lib/programas";
import type { SesionResumen } from "@/lib/types";

type Filtro = "no_verificado" | "verificado" | "rechazado";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "no_verificado", label: "No verificados" },
  { id: "verificado", label: "Verificados" },
  { id: "rechazado", label: "Rechazados" },
];

function relativo(fecha: Date): string {
  const segs = Math.floor((Date.now() - fecha.getTime()) / 1000);
  if (segs < 10) return "recién";
  if (segs < 60) return `hace ${segs}s`;
  const min = Math.floor(segs / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h} h`;
}

export default function AdminPage() {
  const [filtro, setFiltro] = useState<Filtro>("no_verificado");
  const [sesiones, setSesiones] = useState<SesionResumen[]>([]);
  const [errores, setErrores] = useState<SesionResumen[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [polling, setPolling] = useState(false);

  const fetchSesiones = useCallback(async () => {
    setPolling(true);
    try {
      const [res, resErr] = await Promise.all([
        fetch(`/api/sesiones?estado=${filtro}`),
        fetch(`/api/sesiones?estado=errores`),
      ]);
      setSesiones(await res.json());
      setErrores(await resErr.json());
      setLastUpdate(new Date());
    } catch {
      // mantener datos previos
    } finally {
      setPolling(false);
    }
  }, [filtro]);

  useEffect(() => {
    fetchSesiones();
    const interval = setInterval(fetchSesiones, 20_000);
    return () => clearInterval(interval);
  }, [fetchSesiones]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6 flex items-end justify-between border-b border-stone-200 pb-4">
        <div>
          <p className="text-sm font-medium text-stone-500">Pequeños Pasos</p>
          <h1 className="text-2xl font-bold text-stone-900">
            {filtro === "no_verificado"
              ? `${sesiones.length} ${
                  sesiones.length === 1 ? "informe" : "informes"
                } por revisar`
              : FILTROS.find((f) => f.id === filtro)?.label}
          </h1>
        </div>
        <button
          onClick={fetchSesiones}
          className="flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-stone-800"
        >
          <RefreshCw className={`h-4 w-4 ${polling ? "animate-spin" : ""}`} />
          {polling ? "Actualizando…" : `Actualizado ${relativo(lastUpdate)}`}
        </button>
      </header>

      <div className="mb-6 flex gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              filtro === f.id
                ? "bg-stone-900 text-white"
                : "bg-white text-stone-600 hover:bg-stone-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {sesiones.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-white py-16 text-stone-400">
          <Inbox className="h-12 w-12" />
          <p className="text-sm">No hay informes en esta vista.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {sesiones.map((s) => (
            <CardSesion key={s.id} s={s} />
          ))}
        </ul>
      )}

      {errores.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-red-700">
            Errores ({errores.length})
          </h2>
          <ul className="flex flex-col gap-3">
            {errores.map((s) => (
              <CardSesion key={s.id} s={s} esError />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function CardSesion({ s, esError }: { s: SesionResumen; esError?: boolean }) {
  const programa = getPrograma(s.programa);
  const tieneRiesgo = s.flags_riesgo.length > 0;

  return (
    <li>
      <Link
        href={`/admin/sesiones/${s.id}`}
        className={`flex items-center gap-4 rounded-2xl border bg-white p-4 transition hover:shadow-md ${
          tieneRiesgo ? "border-red-300 ring-1 ring-red-200" : "border-stone-200"
        }`}
      >
        <span
          className="h-12 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: programa?.color ?? "#a8a29e" }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-bold text-stone-900">
              {s.apellido || "—"}, {s.nombre || "—"}
            </p>
            {s.es_menor && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                Menor
              </span>
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-stone-500">
            <span
              className="font-semibold"
              style={{ color: programa?.color ?? "#57534e" }}
            >
              {programa?.label ?? s.programa}
            </span>
            <span>·</span>
            <span>{s.lugar || "sin lugar"}</span>
            <span>·</span>
            <span>{s.fecha || s.creado_en?.slice(0, 10)}</span>
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {esError && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                Procesamiento fallido — requiere atención manual
              </span>
            )}
            {tieneRiesgo && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                <AlertTriangle className="h-3 w-3" /> RIESGO: {s.flags_riesgo[0]}
              </span>
            )}
            {s.campos_faltantes.length > 0 && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
                Faltan: {s.campos_faltantes.slice(0, 3).join(", ")}
                {s.campos_faltantes.length > 3 ? "…" : ""}
              </span>
            )}
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-stone-500">
          Revisar <ChevronRight className="h-4 w-4" />
        </span>
      </Link>
    </li>
  );
}
