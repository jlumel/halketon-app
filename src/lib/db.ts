import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import type {
  EstadoSesion,
  InformeEstructurado,
  SesionDetalle,
  SesionResumen,
} from "./types";

let db: Database.Database | null = null;

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "registro.db");

function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function getDb(): Database.Database {
  if (db) return db;

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS beneficiarios (
      id TEXT PRIMARY KEY,
      nombre TEXT,
      apellido TEXT,
      dni TEXT UNIQUE,
      fecha_nacimiento DATE,
      es_menor BOOLEAN,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sesiones (
      id TEXT PRIMARY KEY,
      beneficiario_id TEXT,
      promotor TEXT,
      programa TEXT,
      fecha DATE,
      lugar TEXT,
      tipo_actividad TEXT,
      metricas JSON,
      observacion TEXT,
      audio_path TEXT,
      transcripcion TEXT,
      json_crudo JSON,
      campos_faltantes JSON,
      flags_riesgo JSON,
      estado TEXT DEFAULT 'procesando',
      comentario_revision TEXT,
      revisado_por TEXT,
      revisado_en DATETIME,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (beneficiario_id) REFERENCES beneficiarios(id)
    );
  `);

  return db;
}

// ---------- Beneficiarios ----------

export function upsertBeneficiario(b: {
  nombre: string | null;
  apellido: string | null;
  dni: string | null;
  fecha_nacimiento: string | null;
  es_menor: boolean | null;
}): string {
  const database = getDb();

  if (b.dni) {
    const existing = database
      .prepare("SELECT id FROM beneficiarios WHERE dni = ?")
      .get(b.dni) as { id: string } | undefined;
    if (existing) return existing.id;
  }

  const id = crypto.randomUUID();
  database
    .prepare(
      `INSERT INTO beneficiarios (id, nombre, apellido, dni, fecha_nacimiento, es_menor)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      b.nombre,
      b.apellido,
      b.dni,
      b.fecha_nacimiento,
      b.es_menor ? 1 : 0,
    );
  return id;
}

// ---------- Sesiones ----------

export function crearSesion(args: {
  id: string;
  beneficiario_id: string;
  promotor: string;
  programa: string;
  audio_path: string;
  metricas?: Record<string, unknown>;
  estado: EstadoSesion;
}) {
  getDb()
    .prepare(
      `INSERT INTO sesiones
        (id, beneficiario_id, promotor, programa, fecha, audio_path, metricas, estado)
       VALUES (?, ?, ?, ?, date('now'), ?, ?, ?)`,
    )
    .run(
      args.id,
      args.beneficiario_id,
      args.promotor,
      args.programa,
      args.audio_path,
      JSON.stringify(args.metricas ?? {}),
      args.estado,
    );
}

export function setEstado(id: string, estado: EstadoSesion) {
  getDb().prepare("UPDATE sesiones SET estado = ? WHERE id = ?").run(estado, id);
}

export function guardarResultadoPipeline(
  id: string,
  structured: InformeEstructurado,
  transcripcion: string,
) {
  getDb()
    .prepare(
      `UPDATE sesiones SET
        transcripcion = ?,
        json_crudo = ?,
        lugar = COALESCE(?, lugar),
        tipo_actividad = COALESCE(?, tipo_actividad),
        metricas = ?,
        observacion = ?,
        campos_faltantes = ?,
        flags_riesgo = ?,
        estado = 'no_verificado'
       WHERE id = ?`,
    )
    .run(
      transcripcion,
      JSON.stringify(structured),
      structured.sesion?.lugar ?? null,
      structured.sesion?.tipo_actividad ?? null,
      JSON.stringify(structured.metricas ?? {}),
      structured.observacion_cualitativa ?? "",
      JSON.stringify(structured.campos_faltantes ?? []),
      JSON.stringify(structured.flags_riesgo ?? []),
      id,
    );
}

type SesionRow = {
  id: string;
  beneficiario_id: string;
  nombre: string | null;
  apellido: string | null;
  dni: string | null;
  fecha_nacimiento: string | null;
  es_menor: number | null;
  programa: string;
  promotor: string | null;
  lugar: string | null;
  fecha: string | null;
  tipo_actividad: string | null;
  metricas: string | null;
  observacion: string | null;
  audio_path: string | null;
  transcripcion: string | null;
  json_crudo: string | null;
  campos_faltantes: string | null;
  flags_riesgo: string | null;
  estado: EstadoSesion;
  comentario_revision: string | null;
  revisado_por: string | null;
  revisado_en: string | null;
  creado_en: string;
};

const SELECT_JOIN = `
  SELECT s.*, b.nombre, b.apellido, b.dni, b.fecha_nacimiento, b.es_menor
  FROM sesiones s
  LEFT JOIN beneficiarios b ON b.id = s.beneficiario_id
`;

function toResumen(r: SesionRow): SesionResumen {
  return {
    id: r.id,
    nombre: r.nombre,
    apellido: r.apellido,
    programa: r.programa as SesionResumen["programa"],
    lugar: r.lugar,
    fecha: r.fecha,
    creado_en: r.creado_en,
    estado: r.estado,
    flags_riesgo: safeJsonParse<string[]>(r.flags_riesgo, []),
    campos_faltantes: safeJsonParse<string[]>(r.campos_faltantes, []),
    es_menor: r.es_menor === 1,
  };
}

/** Lista para la cola. estado puede ser un estado puntual o "errores". */
export function listarSesiones(estado?: string): SesionResumen[] {
  const database = getDb();
  let rows: SesionRow[];

  if (estado === "errores") {
    rows = database
      .prepare(
        `${SELECT_JOIN} WHERE s.estado IN ('error_pipeline','error_cola') ORDER BY s.creado_en DESC`,
      )
      .all() as SesionRow[];
  } else if (estado) {
    rows = database
      .prepare(`${SELECT_JOIN} WHERE s.estado = ? ORDER BY s.creado_en DESC`)
      .all(estado) as SesionRow[];
  } else {
    rows = database
      .prepare(`${SELECT_JOIN} ORDER BY s.creado_en DESC`)
      .all() as SesionRow[];
  }

  const resumenes = rows.map(toResumen);
  // Las sesiones con flag de riesgo van primero.
  resumenes.sort((a, b) => {
    const ar = a.flags_riesgo.length > 0 ? 1 : 0;
    const br = b.flags_riesgo.length > 0 ? 1 : 0;
    return br - ar;
  });
  return resumenes;
}

export function obtenerSesion(id: string): SesionDetalle | null {
  const r = getDb()
    .prepare(`${SELECT_JOIN} WHERE s.id = ?`)
    .get(id) as SesionRow | undefined;
  if (!r) return null;

  return {
    ...toResumen(r),
    beneficiario_id: r.beneficiario_id,
    dni: r.dni,
    fecha_nacimiento: r.fecha_nacimiento,
    promotor: r.promotor,
    tipo_actividad: r.tipo_actividad,
    metricas: safeJsonParse<Record<string, string | number | null>>(r.metricas, {}),
    observacion: r.observacion,
    audio_path: r.audio_path,
    transcripcion: r.transcripcion,
    json_crudo: safeJsonParse<InformeEstructurado | null>(r.json_crudo, null),
    comentario_revision: r.comentario_revision,
    revisado_por: r.revisado_por,
    revisado_en: r.revisado_en,
  };
}

export function actualizarRevision(
  id: string,
  args: {
    estado: EstadoSesion;
    datos_corregidos?: {
      beneficiario?: Partial<{
        nombre: string;
        apellido: string;
        dni: string;
        fecha_nacimiento: string;
      }>;
      lugar?: string;
      tipo_actividad?: string;
      metricas?: Record<string, string | number | null>;
      observacion?: string;
    };
    comentario?: string;
    revisado_por?: string;
  },
): SesionDetalle | null {
  const database = getDb();
  const sesion = obtenerSesion(id);
  if (!sesion) return null;

  const corr = args.datos_corregidos;

  if (corr?.beneficiario && sesion.beneficiario_id) {
    const b = corr.beneficiario;
    database
      .prepare(
        `UPDATE beneficiarios SET
          nombre = COALESCE(?, nombre),
          apellido = COALESCE(?, apellido),
          dni = COALESCE(?, dni),
          fecha_nacimiento = COALESCE(?, fecha_nacimiento)
         WHERE id = ?`,
      )
      .run(
        b.nombre ?? null,
        b.apellido ?? null,
        b.dni ?? null,
        b.fecha_nacimiento ?? null,
        sesion.beneficiario_id,
      );
  }

  database
    .prepare(
      `UPDATE sesiones SET
        estado = ?,
        lugar = COALESCE(?, lugar),
        tipo_actividad = COALESCE(?, tipo_actividad),
        metricas = COALESCE(?, metricas),
        observacion = COALESCE(?, observacion),
        comentario_revision = COALESCE(?, comentario_revision),
        revisado_por = ?,
        revisado_en = datetime('now')
       WHERE id = ?`,
    )
    .run(
      args.estado,
      corr?.lugar ?? null,
      corr?.tipo_actividad ?? null,
      corr?.metricas ? JSON.stringify(corr.metricas) : null,
      corr?.observacion ?? null,
      args.comentario ?? null,
      args.revisado_por ?? null,
      id,
    );

  return obtenerSesion(id);
}

export function contarPorEstado(): Record<string, number> {
  const rows = getDb()
    .prepare("SELECT estado, COUNT(*) as n FROM sesiones GROUP BY estado")
    .all() as { estado: string; n: number }[];
  const out: Record<string, number> = {};
  for (const r of rows) out[r.estado] = r.n;
  return out;
}
