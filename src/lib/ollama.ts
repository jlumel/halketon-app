import { PROGRAMAS, getPrograma } from "./programas";
import type { InformeEstructurado } from "./types";

const OLLAMA_URL =
  process.env.OLLAMA_URL ?? "http://localhost:11434/api/chat";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:8b";

function metricasHint(programa: string): string {
  const def = getPrograma(programa);
  if (!def) return "";
  const keys = def.metricas.map((m) => `"${m.key}" (${m.label})`).join(", ");
  return `\nPara el programa de ${def.label}, las métricas esperadas son: ${keys}.`;
}

export async function estructurar(
  transcripcion: string,
  programa: string,
): Promise<InformeEstructurado> {
  const programaLabel = getPrograma(programa)?.label ?? programa;

  const systemPrompt = `Sos un asistente que estructura registros de intervenciones sociales.
A partir de la transcripción de un audio post-sesión de un programa de ${programaLabel}, extraé la información
y respondé ÚNICAMENTE con JSON válido, sin explicaciones, sin markdown, sin texto adicional.

ESTRUCTURA REQUERIDA:
{
  "beneficiario": { "nombre": string|null, "apellido": string|null, "dni": string|null, "fecha_nacimiento": "YYYY-MM-DD"|null, "es_menor": boolean|null },
  "sesion": { "fecha": "YYYY-MM-DD"|null, "lugar": string|null, "tipo_actividad": string|null, "promotor": string|null },
  "metricas": { /* según programa: peso, talla, diagnóstico, avance, asistencia, ingresos, etc. */ },
  "observacion_cualitativa": string|null,
  "campos_faltantes": [string],
  "flags_riesgo": [string]
}

REGLAS:
- Si no hay info para un campo, usá null. NO inventes datos.
- campos_faltantes y flags_riesgo son obligatorios aunque vayan vacíos.
- Si detectás violencia intrafamiliar, urgencia médica o riesgo, agregalo a flags_riesgo.
- Si el beneficiario parece menor de edad, marcá es_menor: true.
- Para ${programaLabel}, prestá especial atención a las métricas propias de ese programa.${metricasHint(programa)}`;

  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      think: false, // CRÍTICO: apaga el thinking de Qwen 3
      format: "json", // fuerza salida JSON
      stream: false,
      options: { temperature: 0.1 },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcripcion },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama respondió ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { message?: { content?: string } };
  const rawContent = data.message?.content ?? "";

  // Wrapper defensivo: si igual viniera con <think>, limpialo antes de parsear.
  const content = rawContent.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  try {
    const parsed = JSON.parse(content) as Partial<InformeEstructurado>;
    return normalizar(parsed);
  } catch {
    return {
      beneficiario: emptyBeneficiario(),
      sesion: { fecha: null, lugar: null, tipo_actividad: null, promotor: null },
      metricas: {},
      observacion_cualitativa: null,
      campos_faltantes: [],
      flags_riesgo: [],
      error_parseo: true,
      raw: content,
    };
  }
}

function emptyBeneficiario() {
  return {
    nombre: null,
    apellido: null,
    dni: null,
    fecha_nacimiento: null,
    es_menor: null,
  };
}

/** Garantiza que el objeto tenga la forma completa esperada. */
function normalizar(p: Partial<InformeEstructurado>): InformeEstructurado {
  void PROGRAMAS;
  return {
    beneficiario: { ...emptyBeneficiario(), ...(p.beneficiario ?? {}) },
    sesion: {
      fecha: p.sesion?.fecha ?? null,
      lugar: p.sesion?.lugar ?? null,
      tipo_actividad: p.sesion?.tipo_actividad ?? null,
      promotor: p.sesion?.promotor ?? null,
    },
    metricas: p.metricas ?? {},
    observacion_cualitativa: p.observacion_cualitativa ?? null,
    campos_faltantes: Array.isArray(p.campos_faltantes) ? p.campos_faltantes : [],
    flags_riesgo: Array.isArray(p.flags_riesgo) ? p.flags_riesgo : [],
  };
}
