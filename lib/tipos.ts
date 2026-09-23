export type Asesora = {
  id: string;
  nombre: string;
  punto: string;
  activo: boolean;
  creado_en: string;
};

export type TipoMarca = "entrada" | "salida";

export type Marca = {
  id: string;
  asesora_id: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM:SS
  tipo: TipoMarca;
  foto_url: string | null;
  origen: "ocr" | "manual";
  creado_en: string;
};

export type TipoDiaEspecial = "ausencia" | "incapacidad" | "libre" | "vacaciones";

export type DiaEspecial = {
  id: string;
  asesora_id: string;
  fecha: string;
  tipo: TipoDiaEspecial;
  nota: string | null;
  creado_en: string;
};

// Codigo numerico que usa el Excel original (formato condicional 1-5).
export const CODIGO_ESTATUS: Record<"asistencia" | TipoDiaEspecial, number> = {
  asistencia: 1,
  ausencia: 2,
  incapacidad: 3,
  libre: 4,
  vacaciones: 5,
};

export const ETIQUETA_ESTATUS: Record<number, string> = {
  1: "Asistencia",
  2: "Ausencia",
  3: "Incapacidad",
  4: "Libre",
  5: "Vacaciones",
};

export type Feriado = {
  id: string;
  fecha: string;
  descripcion: string | null;
  creado_en: string;
};

export type Anomalia = {
  asesora_id: string;
  nombre: string;
  punto: string;
  fecha: string;
  tipo: "falta_entrada" | "falta_salida" | "horas_insuficientes";
  mensaje: string;
};
