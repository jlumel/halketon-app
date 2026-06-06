"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react";
import { getPrograma } from "@/lib/programas";
import type { ProgramaId } from "@/lib/types";

function calcularEsMenor(fechaNac: string): boolean | null {
  if (!fechaNac) return null;
  const nac = new Date(fechaNac);
  if (Number.isNaN(nac.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad < 18;
}

export default function RegistroPage() {
  const router = useRouter();
  const [programaId, setProgramaId] = useState<ProgramaId | null>(null);

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [dni, setDni] = useState("");
  const [fechaNac, setFechaNac] = useState("");
  const [metricas, setMetricas] = useState<Record<string, string>>({});

  useEffect(() => {
    const p = sessionStorage.getItem("programa") as ProgramaId | null;
    if (!p) {
      router.replace("/programa");
      return;
    }
    setProgramaId(p);
  }, [router]);

  const programa = useMemo(() => getPrograma(programaId), [programaId]);
  const esMenor = useMemo(() => calcularEsMenor(fechaNac), [fechaNac]);

  const completo =
    nombre.trim() && apellido.trim() && dni.trim() && fechaNac.trim();

  function continuar() {
    if (!completo || !programaId) return;
    const beneficiario = {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      dni: dni.trim(),
      fecha_nacimiento: fechaNac,
      es_menor: esMenor,
      metricas,
    };
    sessionStorage.setItem("beneficiario", JSON.stringify(beneficiario));
    router.push("/grabar");
  }

  if (!programa) return null;

  return (
    <main className="mx-auto flex min-h-screen max-w-[420px] flex-col px-6 py-8">
      <header className="mb-5 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full text-stone-500 transition active:bg-stone-200"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span
          className="rounded-full px-3 py-1 text-sm font-semibold text-white"
          style={{ backgroundColor: programa.color }}
        >
          {programa.label}
        </span>
      </header>

      <h1 className="mb-1 text-xl font-bold text-stone-900">
        Datos del beneficiario
      </h1>
      <p className="mb-5 text-sm text-stone-500">
        Los campos obligatorios no pueden faltar.
      </p>

      <div className="flex flex-col gap-4">
        <Campo label="Nombre" obligatorio value={nombre} onChange={setNombre} />
        <Campo
          label="Apellido"
          obligatorio
          value={apellido}
          onChange={setApellido}
        />
        <Campo
          label="DNI"
          obligatorio
          value={dni}
          onChange={setDni}
          inputMode="numeric"
        />

        <label className="flex flex-col gap-1.5">
          <span className="text-base font-semibold text-stone-700">
            Fecha de nacimiento <span className="text-red-500">*</span>
          </span>
          <input
            type="date"
            value={fechaNac}
            onChange={(e) => setFechaNac(e.target.value)}
            className="min-h-[56px] rounded-2xl border-2 border-stone-200 bg-white px-4 text-lg text-stone-900 outline-none transition focus:border-emerald-500"
          />
        </label>

        {esMenor !== null && (
          <div className="flex items-center justify-between">
            <span
              className={`rounded-full px-3 py-1 text-sm font-bold ${
                esMenor
                  ? "bg-amber-100 text-amber-800"
                  : "bg-stone-200 text-stone-700"
              }`}
            >
              {esMenor ? "Menor de edad" : "Mayor de edad"}
            </span>
          </div>
        )}

        {esMenor && (
          <div className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Registro de menor — datos sensibles.</span>
          </div>
        )}

        <div className="mt-2 border-t border-stone-200 pt-4">
          <h2 className="mb-1 text-base font-bold text-stone-900">
            Datos de {programa.label}
          </h2>
          <p className="mb-3 text-xs text-stone-500">
            Opcionales — también pueden surgir del audio.
          </p>
          <div className="flex flex-col gap-4">
            {programa.metricas.map((m) => (
              <Campo
                key={m.key}
                label={m.unidad ? `${m.label} (${m.unidad})` : m.label}
                value={metricas[m.key] ?? ""}
                onChange={(v) =>
                  setMetricas((prev) => ({ ...prev, [m.key]: v }))
                }
                inputMode={m.type === "number" ? "decimal" : undefined}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 mt-6 -mx-6 bg-gradient-to-t from-stone-100 via-stone-100 px-6 pb-2 pt-4">
        <button
          onClick={continuar}
          disabled={!completo}
          className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-lg font-bold text-white transition active:scale-[0.98] disabled:opacity-40"
        >
          Continuar a grabación <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </main>
  );
}

function Campo({
  label,
  value,
  onChange,
  obligatorio,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  obligatorio?: boolean;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-base font-semibold text-stone-700">
        {label} {obligatorio && <span className="text-red-500">*</span>}
      </span>
      <input
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[56px] rounded-2xl border-2 border-stone-200 bg-white px-4 text-lg text-stone-900 outline-none transition focus:border-emerald-500"
      />
    </label>
  );
}
