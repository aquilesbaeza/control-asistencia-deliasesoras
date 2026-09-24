import type { Anomalia, Asesora, Marca } from "./tipos";
import { ahoraCR, horaAMinutos, MINUTOS_JORNADA_TOTAL } from "./tiempo";

/** Rango [desde, hasta) para filtrar por mes sin asumir que todos tienen 31 dias. */
export function rangoMes(mes: string): { desde: string; hasta: string } {
  const [anio, m] = mes.split("-").map(Number);
  const siguiente = new Date(Date.UTC(anio, m, 1)); // dia 1 del mes siguiente
  const hasta = siguiente.toISOString().slice(0, 10);
  return { desde: `${mes}-01`, hasta };
}

/** Clave que identifica una marca repetida: misma asesora, dia, tipo y hora (HH:MM). */
export function claveMarca(m: { asesora_id: string; fecha: string; tipo: string; hora: string }): string {
  return `${m.asesora_id}|${m.fecha}|${m.tipo}|${m.hora.slice(0, 5)}`;
}

export type ResumenDia = {
  fecha: string;
  entrada: Marca | null;
  salida: Marca | null;
  horasEfectivas: number | null;
};

/** Agrupa las marcas de una asesora por fecha (YYYY-MM-DD). */
export function agruparPorDia(marcas: Marca[]): Map<string, ResumenDia> {
  const porDia = new Map<string, ResumenDia>();

  for (const marca of marcas) {
    const actual = porDia.get(marca.fecha) ?? {
      fecha: marca.fecha,
      entrada: null,
      salida: null,
      horasEfectivas: null,
    };
    // Con varias fotos del mismo tipo, la entrada valida es la mas temprana y la salida la mas tardia.
    if (marca.tipo === "entrada") {
      if (!actual.entrada || marca.hora < actual.entrada.hora) actual.entrada = marca;
    } else if (!actual.salida || marca.hora > actual.salida.hora) {
      actual.salida = marca;
    }
    porDia.set(marca.fecha, actual);
  }

  for (const resumen of porDia.values()) {
    if (resumen.entrada && resumen.salida) {
      // Minutos enteros: con decimales, 9 h exactas daban 7.9999 y se marcaban como jornada corta.
      const MINUTOS_ALMUERZO = 60;
      const efectivos = horaAMinutos(resumen.salida.hora) - horaAMinutos(resumen.entrada.hora) - MINUTOS_ALMUERZO;
      resumen.horasEfectivas = Math.max(0, efectivos) / 60;
    }
  }

  return porDia;
}

const HORAS_JORNADA = 8;

/** Calcula anomalias (marca faltante u horas insuficientes) para una asesora en un mes. */
export function calcularAnomalias(asesora: Asesora, marcas: Marca[]): Anomalia[] {
  const anomalias: Anomalia[] = [];
  const porDia = agruparPorDia(marcas);

  for (const resumen of porDia.values()) {
    if (resumen.entrada && !resumen.salida) {
      anomalias.push({
        asesora_id: asesora.id,
        nombre: asesora.nombre,
        punto: asesora.punto,
        fecha: resumen.fecha,
        tipo: "falta_salida",
        mensaje: "Pendiente la marca de salida",
      });
    } else if (resumen.salida && !resumen.entrada) {
      anomalias.push({
        asesora_id: asesora.id,
        nombre: asesora.nombre,
        punto: asesora.punto,
        fecha: resumen.fecha,
        tipo: "falta_entrada",
        mensaje: "Pendiente la marca de entrada",
      });
    } else if (resumen.horasEfectivas !== null && resumen.horasEfectivas < HORAS_JORNADA) {
      anomalias.push({
        asesora_id: asesora.id,
        nombre: asesora.nombre,
        punto: asesora.punto,
        fecha: resumen.fecha,
        tipo: "horas_insuficientes",
        mensaje: `Jornada de ${resumen.horasEfectivas.toFixed(1)} h efectivas (se esperan ${HORAS_JORNADA} h)`,
      });
    }
  }

  return anomalias.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Una jornada se da por terminada cuando el dia ya paso, o cuando hoy ya
 * transcurrieron 9 horas (8 efectivas + 1 de almuerzo) desde la entrada.
 * Sin entrada marcada hoy no se puede saber, asi que no esta terminada.
 */
export function jornadaTerminada(
  fecha: string,
  horaEntrada: string | null,
  ahora: { fecha: string; minutos: number }
): boolean {
  if (fecha < ahora.fecha) return true;
  if (fecha > ahora.fecha) return false;
  if (!horaEntrada) return false;
  return ahora.minutos >= horaAMinutos(horaEntrada) + MINUTOS_JORNADA_TOTAL;
}

/**
 * Estatus automatico de un dia sin gestion manual (sin dia_especial):
 * - "asistencia" si hay entrada y salida ese dia.
 * - "ausencia" solo si el dia YA PASO, no hay ninguna marca y no es feriado.
 * - null si es hoy o futuro, si es feriado sin marcas (se trabaja opcional),
 *   o si hay una marca suelta (la marca faltante la completa Nuria, no es ausencia).
 */
export function estatusAutomatico(
  fecha: string,
  tieneAsistenciaCompleta: boolean,
  tieneAlgunaMarca: boolean,
  esFeriado: boolean,
  hoyISO: string
): "asistencia" | "ausencia" | null {
  if (tieneAsistenciaCompleta) return "asistencia";
  if (tieneAlgunaMarca) return null;
  if (fecha >= hoyISO) return null;
  if (esFeriado) return null;
  return "ausencia";
}

/**
 * Aviso inmediato tras guardar marcas. Una entrada sin salida solo se avisa
 * cuando la jornada ya termino; una salida sin entrada siempre es anomalia.
 */
export function detectarAnomaliaInmediata(
  marcasDelDia: Marca[],
  nombreAsesora: string,
  fecha: string,
  ahora: { fecha: string; minutos: number } = ahoraCR()
): { tipo: "falta_entrada" | "falta_salida"; mensaje: string } | null {
  const entrada = marcasDelDia.find((m) => m.tipo === "entrada");
  const tieneSalida = marcasDelDia.some((m) => m.tipo === "salida");

  if (entrada && !tieneSalida && jornadaTerminada(fecha, entrada.hora, ahora)) {
    return {
      tipo: "falta_salida",
      mensaje: `${nombreAsesora} ya completó su jornada, pero todavía no aparece su marca de salida. Cuando puedas, ¿podrías revisar si falta cargar esa foto, por favor?`,
    };
  }
  if (tieneSalida && !entrada) {
    return {
      tipo: "falta_entrada",
      mensaje: `${nombreAsesora} tiene registrada su salida, pero no encuentro su marca de entrada. Si tienes esa foto a mano, ¿podrías cargarla, por favor?`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Calculo unico del mes por asesora: lo usan el calendario en pantalla y el
// Excel de asistencia, para que nunca se contradigan.
// ---------------------------------------------------------------------------

export const HORA_ENTRADA_POR_DEFECTO = "08:00";
export const TOLERANCIA_TARDE_MIN = 10;
export const HORAS_JORNADA_EFECTIVA = 8;

export type EstatusDia =
  | "asistencia"
  | "ausencia"
  | "incapacidad"
  | "libre"
  | "vacaciones"
  | "parcial" // hay una sola marca: falta la otra
  | "feriado" // feriado sin marcas: opcional, no cuenta como ausencia
  | "pendiente"; // hoy o futuro sin datos, o feriados del mes sin confirmar

export type DiaCalculado = {
  dia: number;
  fecha: string;
  estatus: EstatusDia;
  manual: boolean; // lo registro Nuria a mano (libre/vacaciones/incapacidad/ausencia)
  nota: string | null;
  entrada: string | null; // HH:MM
  salida: string | null; // HH:MM
  horas: number | null;
  minutosTarde: number | null;
};

export function calcularMesAsesora(p: {
  mes: string; // YYYY-MM
  totalDias: number;
  horaEntradaEsperada?: string | null;
  marcas: Marca[];
  especiales: { fecha: string; tipo: string; nota: string | null }[];
  fechasFeriado: Set<string>;
  feriadosConfirmados: boolean;
  hoy: string; // YYYY-MM-DD en hora de Costa Rica
}): DiaCalculado[] {
  const porDia = agruparPorDia(p.marcas);
  const especialPorFecha = new Map(p.especiales.map((e) => [e.fecha, e]));
  const esperada = (p.horaEntradaEsperada ?? HORA_ENTRADA_POR_DEFECTO).slice(0, 5);
  const resultado: DiaCalculado[] = [];

  for (let dia = 1; dia <= p.totalDias; dia++) {
    const fecha = `${p.mes}-${String(dia).padStart(2, "0")}`;
    const resumen = porDia.get(fecha);
    const especial = especialPorFecha.get(fecha);
    const entrada = resumen?.entrada?.hora.slice(0, 5) ?? null;
    const salida = resumen?.salida?.hora.slice(0, 5) ?? null;

    let minutosTarde: number | null = null;
    if (entrada) {
      const diferencia = horaAMinutos(entrada) - horaAMinutos(esperada);
      if (diferencia > TOLERANCIA_TARDE_MIN) minutosTarde = diferencia;
    }

    let estatus: EstatusDia;
    if (especial) estatus = especial.tipo as EstatusDia;
    else if (entrada && salida) estatus = "asistencia";
    else if (entrada || salida) estatus = "parcial";
    else if (p.fechasFeriado.has(fecha)) estatus = "feriado";
    else if (fecha >= p.hoy) estatus = "pendiente";
    else if (!p.feriadosConfirmados) estatus = "pendiente";
    else estatus = "ausencia";

    resultado.push({
      dia,
      fecha,
      estatus,
      manual: !!especial,
      nota: especial?.nota ?? null,
      entrada,
      salida,
      horas: resumen?.horasEfectivas ?? null,
      minutosTarde,
    });
  }
  return resultado;
}

export type ResumenMes = Record<EstatusDia, number> & {
  tardes: number;
  jornadasIncompletas: number; // con ambas marcas pero menos de 8 h efectivas
  horasEfectivas: number;
};

export function resumirMes(dias: DiaCalculado[]): ResumenMes {
  const r: ResumenMes = {
    asistencia: 0, ausencia: 0, incapacidad: 0, libre: 0, vacaciones: 0,
    parcial: 0, feriado: 0, pendiente: 0,
    tardes: 0, jornadasIncompletas: 0, horasEfectivas: 0,
  };
  for (const d of dias) {
    r[d.estatus]++;
    if (d.minutosTarde !== null) r.tardes++;
    if (d.horas !== null) {
      r.horasEfectivas += d.horas;
      if (d.horas < HORAS_JORNADA_EFECTIVA) r.jornadasIncompletas++;
    }
  }
  return r;
}
