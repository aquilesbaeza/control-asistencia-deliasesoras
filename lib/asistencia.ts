import type { Anomalia, Asesora, Marca } from "./tipos";

/** Rango [desde, hasta) para filtrar por mes sin asumir que todos tienen 31 dias. */
export function rangoMes(mes: string): { desde: string; hasta: string } {
  const [anio, m] = mes.split("-").map(Number);
  const siguiente = new Date(anio, m, 1); // dia 1 del mes siguiente
  const hasta = siguiente.toISOString().slice(0, 10);
  return { desde: `${mes}-01`, hasta };
}

export type ResumenDia = {
  fecha: string;
  entrada: Marca | null;
  salida: Marca | null;
  horasEfectivas: number | null;
};

function horaANumero(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h + m / 60;
}

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
    if (marca.tipo === "entrada") actual.entrada = marca;
    else actual.salida = marca;
    porDia.set(marca.fecha, actual);
  }

  for (const resumen of porDia.values()) {
    if (resumen.entrada && resumen.salida) {
      const minutosAlmuerzo = 60;
      const bruto = horaANumero(resumen.salida.hora) - horaANumero(resumen.entrada.hora);
      resumen.horasEfectivas = Math.max(0, bruto - minutosAlmuerzo / 60);
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
        mensaje: "No ha marcado salida",
      });
    } else if (resumen.salida && !resumen.entrada) {
      anomalias.push({
        asesora_id: asesora.id,
        nombre: asesora.nombre,
        punto: asesora.punto,
        fecha: resumen.fecha,
        tipo: "falta_entrada",
        mensaje: "No ha marcado entrada",
      });
    } else if (resumen.horasEfectivas !== null && resumen.horasEfectivas < HORAS_JORNADA) {
      anomalias.push({
        asesora_id: asesora.id,
        nombre: asesora.nombre,
        punto: asesora.punto,
        fecha: resumen.fecha,
        tipo: "horas_insuficientes",
        mensaje: `Solo ${resumen.horasEfectivas.toFixed(1)}h efectivas (esperado ${HORAS_JORNADA}h)`,
      });
    }
  }

  return anomalias.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/**
 * Estatus automatico de un dia sin gestion manual (sin dia_especial):
 * - "asistencia" si hay entrada y salida ese dia.
 * - "ausencia" si no hay marcas, el dia ya paso, y NO es feriado.
 * - null si es un dia futuro, o un feriado sin marcas (se trabaja opcional,
 *   no cuenta como ausencia), o si el asesora esta activa desde despues de esa fecha.
 */
export function estatusAutomatico(
  fecha: string,
  tieneAsistenciaCompleta: boolean,
  esFeriado: boolean,
  hoyISO: string
): "asistencia" | "ausencia" | null {
  if (tieneAsistenciaCompleta) return "asistencia";
  if (fecha > hoyISO) return null;
  if (esFeriado) return null;
  return "ausencia";
}

/** Comentario de una marca puntual recién guardada, para el pop-up inmediato dirigido a Nuria. */
export function detectarAnomaliaInmediata(
  marcasDelDia: Marca[],
  nombreAsesora: string
): { tipo: "falta_entrada" | "falta_salida"; mensaje: string } | null {
  const tieneEntrada = marcasDelDia.some((m) => m.tipo === "entrada");
  const tieneSalida = marcasDelDia.some((m) => m.tipo === "salida");

  if (tieneEntrada && !tieneSalida) {
    return {
      tipo: "falta_salida",
      mensaje: `${nombreAsesora} registró su entrada pero aún no tiene marca de salida hoy. ¿Le recordamos que la registre?`,
    };
  }
  if (tieneSalida && !tieneEntrada) {
    return {
      tipo: "falta_entrada",
      mensaje: `${nombreAsesora} registró su salida pero no tiene marca de entrada hoy. ¿Falta esa foto por cargar?`,
    };
  }
  return null;
}
