export type ProgramaId = "nutricion" | "salud" | "educacion" | "trabajo";

export type EstadoSesion =
  | "en_cola"
  | "procesando"
  | "no_verificado"
  | "verificado"
  | "rechazado"
  | "error_pipeline"
  | "error_cola";

export interface Beneficiario {
  nombre: string | null;
  apellido: string | null;
  dni: string | null;
  fecha_nacimiento: string | null; // YYYY-MM-DD
  es_menor: boolean | null;
}

/** Datos que el promotor manda junto con el audio. */
export interface BeneficiarioInput extends Beneficiario {
  metricas?: Record<string, string | number | null>;
}

/** JSON estructurado que devuelve el LLM. */
export interface InformeEstructurado {
  beneficiario: Beneficiario;
  sesion: {
    fecha: string | null;
    lugar: string | null;
    tipo_actividad: string | null;
    promotor: string | null;
  };
  metricas: Record<string, string | number | null>;
  observacion_cualitativa: string | null;
  campos_faltantes: string[];
  flags_riesgo: string[];
  error_parseo?: boolean;
  raw?: string;
}

/** Fila resumida para la cola del admin. */
export interface SesionResumen {
  id: string;
  nombre: string | null;
  apellido: string | null;
  programa: ProgramaId;
  lugar: string | null;
  fecha: string | null;
  creado_en: string;
  estado: EstadoSesion;
  flags_riesgo: string[];
  campos_faltantes: string[];
  es_menor: boolean;
}

/** Detalle completo para la vista de revisión. */
export interface SesionDetalle extends SesionResumen {
  beneficiario_id: string;
  dni: string | null;
  fecha_nacimiento: string | null;
  promotor: string | null;
  tipo_actividad: string | null;
  metricas: Record<string, string | number | null>;
  observacion: string | null;
  audio_path: string | null;
  transcripcion: string | null;
  json_crudo: InformeEstructurado | null;
  comentario_revision: string | null;
  revisado_por: string | null;
  revisado_en: string | null;
}
