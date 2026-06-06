import type { ProgramaId } from "./types";

export interface CampoMetrica {
  key: string;
  label: string;
  type: "text" | "number";
  unidad?: string;
}

export interface ProgramaDef {
  id: ProgramaId;
  label: string;
  color: string;
  /** Color de fondo suave para badges/cards. */
  bg: string;
  icon: string; // nombre de ícono lucide-react
  /** Campos que se piden en el registro y se estructuran en el informe. */
  metricas: CampoMetrica[];
}

export const PROGRAMAS: Record<ProgramaId, ProgramaDef> = {
  nutricion: {
    id: "nutricion",
    label: "Nutrición",
    color: "#16a34a",
    bg: "#dcfce7",
    icon: "Apple",
    metricas: [
      { key: "peso_kg", label: "Peso", type: "number", unidad: "kg" },
      { key: "talla_cm", label: "Talla", type: "number", unidad: "cm" },
      { key: "diagnostico_nutricional", label: "Diagnóstico nutricional", type: "text" },
    ],
  },
  salud: {
    id: "salud",
    label: "Salud",
    color: "#2563eb",
    bg: "#dbeafe",
    icon: "HeartPulse",
    metricas: [
      { key: "tipo_consulta", label: "Tipo de consulta", type: "text" },
      { key: "diagnostico", label: "Diagnóstico", type: "text" },
      { key: "medicacion", label: "Medicación", type: "text" },
    ],
  },
  educacion: {
    id: "educacion",
    label: "Educación",
    color: "#ea580c",
    bg: "#ffedd5",
    icon: "GraduationCap",
    metricas: [
      { key: "nivel_curso", label: "Nivel / curso", type: "text" },
      { key: "asistencia", label: "Asistencia", type: "text" },
      { key: "avance", label: "Avance", type: "text" },
    ],
  },
  trabajo: {
    id: "trabajo",
    label: "Trabajo",
    color: "#7c3aed",
    bg: "#ede9fe",
    icon: "Briefcase",
    metricas: [
      { key: "tipo_actividad", label: "Tipo de actividad", type: "text" },
      { key: "estado_insercion", label: "Estado de inserción", type: "text" },
      { key: "ingresos", label: "Ingresos", type: "text" },
      { key: "compromisos", label: "Compromisos", type: "text" },
    ],
  },
};

export const PROGRAMAS_LISTA = Object.values(PROGRAMAS);

export function getPrograma(id: string | null | undefined): ProgramaDef | null {
  if (!id) return null;
  return PROGRAMAS[id as ProgramaId] ?? null;
}
