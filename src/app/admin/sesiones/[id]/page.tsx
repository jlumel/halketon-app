"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ShieldAlert,
  X,
} from "lucide-react";
import { getPrograma } from "@/lib/programas";
import type { SesionDetalle } from "@/lib/types";

export default function DetalleSesionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [sesion, setSesion] = useState<SesionDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [verTranscripcion, setVerTranscripcion] = useState(false);
  const [modoRechazo, setModoRechazo] = useState(false);
  const [comentario, setComentario] = useState("");

  // Form state
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [dni, setDni] = useState("");
  const [fechaNac, setFechaNac] = useState("");
  const [lugar, setLugar] = useState("");
  const [tipoActividad, setTipoActividad] = useState("");
  const [observacion, setObservacion] = useState("");
  const [metricas, setMetricas] = useState<Record<string, string>>({});

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch(`/api/sesiones/${id}`);
      if (!res.ok) throw new Error();
      const data: SesionDetalle = await res.json();
      setSesion(data);
      setNombre(data.nombre ?? "");
      setApellido(data.apellido ?? "");
      setDni(data.dni ?? "");
      setFechaNac(data.fecha_nacimiento ?? "");
      setLugar(data.lugar ?? "");
      setTipoActividad(data.tipo_actividad ?? "");
      setObservacion(data.observacion ?? "");
      const m: Record<string, string> = {};
      for (const [k, v] of Object.entries(data.metricas ?? {})) {
        m[k] = v == null ? "" : String(v);
      }
      setMetricas(m);
    } catch {
      setSesion(null);
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function patch(estado: "verificado" | "rechazado") {
    if (!sesion) return;
    setGuardando(true);
    const revisadoPor =
      (typeof window !== "undefined" &&
        localStorage.getItem("admin_nombre")) ||
      "Administrativo";
    try {
      const res = await fetch(`/api/sesiones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado,
          comentario: estado === "rechazado" ? comentario : undefined,
          revisado_por: revisadoPor,
          datos_corregidos: {
            beneficiario: {
              nombre,
              apellido,
              dni,
              fecha_nacimiento: fechaNac,
            },
            lugar,
            tipo_actividad: tipoActividad,
            observacion,
            metricas,
          },
        }),
      });
      if (!res.ok) throw new Error();
      router.push("/admin");
    } catch {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20 text-center text-stone-400">
        Cargando…
      </main>
    );
  }

  if (!sesion) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="text-stone-500">No se encontró el informe.</p>
        <button
          onClick={() => router.push("/admin")}
          className="mt-4 text-sm font-semibold text-emerald-700"
        >
          Volver a la cola
        </button>
      </main>
    );
  }

  const programa = getPrograma(sesion.programa);
  const faltantes = new Set(sesion.campos_faltantes);
  const enProceso =
    sesion.estado === "en_cola" || sesion.estado === "procesando";

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 pb-32">
      <header className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.push("/admin")}
          className="flex h-10 w-10 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-stone-900">
            {apellido || "—"}, {nombre || "—"}
          </h1>
          <p className="text-sm" style={{ color: programa?.color }}>
            {programa?.label ?? sesion.programa}
          </p>
        </div>
        <EstadoBadge estado={sesion.estado} />
      </header>

      {/* Flags de riesgo */}
      {sesion.flags_riesgo.length > 0 && (
        <div className="mb-5 rounded-2xl border-2 border-red-300 bg-red-50 p-4">
          <div className="mb-2 flex items-center gap-2 font-bold text-red-800">
            <ShieldAlert className="h-5 w-5" /> Flags de riesgo
          </div>
          <ul className="flex flex-col gap-1.5">
            {sesion.flags_riesgo.map((f, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-red-800"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Banner menor */}
      {sesion.es_menor && (
        <div className="mb-5 flex items-center gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Datos sensibles de un menor. Procesados localmente — no salen del
          servidor.
        </div>
      )}

      {enProceso && (
        <div className="mb-5 rounded-2xl bg-stone-200 p-3 text-sm text-stone-600">
          El pipeline todavía está procesando este audio. Refrescá en unos
          segundos.
        </div>
      )}

      {sesion.json_crudo?.error_parseo && (
        <div className="mb-5 rounded-2xl border border-orange-300 bg-orange-50 p-3 text-sm text-orange-800">
          El modelo no devolvió JSON válido. Revisá la transcripción y completá
          los campos a mano.
        </div>
      )}

      {/* Beneficiario */}
      <Seccion titulo="Beneficiario">
        <CampoEdit
          label="Nombre"
          value={nombre}
          onChange={setNombre}
          falta={faltantes.has("nombre")}
        />
        <CampoEdit
          label="Apellido"
          value={apellido}
          onChange={setApellido}
          falta={faltantes.has("apellido")}
        />
        <CampoEdit
          label="DNI"
          value={dni}
          onChange={setDni}
          falta={faltantes.has("dni")}
        />
        <CampoEdit
          label="Fecha de nacimiento"
          value={fechaNac}
          onChange={setFechaNac}
          type="date"
          falta={faltantes.has("fecha_nacimiento")}
        />
      </Seccion>

      {/* Sesión */}
      <Seccion titulo="Sesión">
        <CampoEdit label="Promotor" value={sesion.promotor ?? ""} readOnly />
        <CampoEdit
          label="Lugar"
          value={lugar}
          onChange={setLugar}
          falta={faltantes.has("lugar")}
        />
        <CampoEdit
          label="Tipo de actividad"
          value={tipoActividad}
          onChange={setTipoActividad}
          falta={faltantes.has("tipo_actividad")}
        />
        <CampoEdit label="Fecha" value={sesion.fecha ?? ""} readOnly />
      </Seccion>

      {/* Métricas del programa */}
      <Seccion titulo={`Métricas de ${programa?.label ?? sesion.programa}`}>
        {(programa?.metricas ?? []).map((m) => (
          <CampoEdit
            key={m.key}
            label={m.unidad ? `${m.label} (${m.unidad})` : m.label}
            value={metricas[m.key] ?? ""}
            onChange={(v) =>
              setMetricas((prev) => ({ ...prev, [m.key]: v }))
            }
            falta={faltantes.has(m.key)}
          />
        ))}
        {/* Métricas extra que el LLM agregó y no están en la definición */}
        {Object.keys(metricas)
          .filter(
            (k) => !(programa?.metricas ?? []).some((m) => m.key === k),
          )
          .map((k) => (
            <CampoEdit
              key={k}
              label={k}
              value={metricas[k] ?? ""}
              onChange={(v) =>
                setMetricas((prev) => ({ ...prev, [k]: v }))
              }
            />
          ))}
      </Seccion>

      {/* Observación cualitativa */}
      <Seccion titulo="Observación cualitativa">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <textarea
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            rows={4}
            className="rounded-xl border-2 border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-emerald-500"
          />
        </label>
      </Seccion>

      {/* Audio original */}
      <Seccion titulo="Audio original">
        <div className="sm:col-span-2">
          <audio
            src={`/api/sesiones/${id}/audio`}
            controls
            className="w-full"
          />
        </div>
      </Seccion>

      {/* Transcripción colapsable */}
      <div className="mt-4">
        <button
          onClick={() => setVerTranscripcion((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-semibold text-stone-600"
        >
          <ChevronDown
            className={`h-4 w-4 transition ${
              verTranscripcion ? "rotate-180" : ""
            }`}
          />
          Ver transcripción
        </button>
        {verTranscripcion && (
          <p className="mt-2 whitespace-pre-wrap rounded-xl bg-stone-200/60 p-3 text-sm text-stone-700">
            {sesion.transcripcion || "Sin transcripción todavía."}
          </p>
        )}
      </div>

      {/* Comentario de rechazo */}
      {modoRechazo && (
        <div className="mt-6">
          <label className="text-sm font-semibold text-stone-700">
            Motivo del rechazo
          </label>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Explicá qué hay que corregir…"
            className="mt-1.5 w-full rounded-xl border-2 border-red-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400"
          />
        </div>
      )}

      {/* Acciones fijas abajo */}
      <div className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-3 px-6 py-4">
          {!modoRechazo ? (
            <>
              <button
                onClick={() => setModoRechazo(true)}
                disabled={guardando}
                className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-stone-300 text-base font-bold text-stone-700 transition active:scale-[0.98] disabled:opacity-50"
              >
                <X className="h-5 w-5" /> Rechazar
              </button>
              <button
                onClick={() => patch("verificado")}
                disabled={guardando}
                className="flex min-h-[52px] flex-[2] items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-base font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
              >
                <Check className="h-5 w-5" /> Aprobar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setModoRechazo(false)}
                disabled={guardando}
                className="flex min-h-[52px] flex-1 items-center justify-center rounded-2xl border-2 border-stone-300 text-base font-bold text-stone-700 transition active:scale-[0.98]"
              >
                Cancelar
              </button>
              <button
                onClick={() => patch("rechazado")}
                disabled={guardando || !comentario.trim()}
                className="flex min-h-[52px] flex-[2] items-center justify-center gap-2 rounded-2xl bg-red-600 text-base font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
              >
                Confirmar rechazo
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-stone-500">
        {titulo}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function CampoEdit({
  label,
  value,
  onChange,
  falta,
  readOnly,
  type = "text",
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  falta?: boolean;
  readOnly?: boolean;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-stone-600">
        {label}
        {falta && (
          <span className="rounded bg-red-100 px-1.5 text-xs font-bold text-red-700">
            falta
          </span>
        )}
      </span>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        className={`min-h-[44px] rounded-xl border-2 px-3 text-base outline-none transition ${
          readOnly
            ? "border-stone-100 bg-stone-100 text-stone-500"
            : falta
              ? "border-red-300 bg-red-50 text-stone-900 focus:border-red-500"
              : "border-stone-200 bg-white text-stone-900 focus:border-emerald-500"
        }`}
      />
    </label>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    en_cola: { label: "En cola", cls: "bg-stone-200 text-stone-700" },
    procesando: { label: "Procesando", cls: "bg-blue-100 text-blue-700" },
    no_verificado: {
      label: "Por revisar",
      cls: "bg-amber-100 text-amber-800",
    },
    verificado: { label: "Verificado", cls: "bg-emerald-100 text-emerald-800" },
    rechazado: { label: "Rechazado", cls: "bg-red-100 text-red-800" },
    error_pipeline: { label: "Error pipeline", cls: "bg-red-100 text-red-800" },
    error_cola: { label: "Error cola", cls: "bg-red-100 text-red-800" },
  };
  const m = map[estado] ?? { label: estado, cls: "bg-stone-200 text-stone-700" };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${m.cls}`}>
      {m.label}
    </span>
  );
}
