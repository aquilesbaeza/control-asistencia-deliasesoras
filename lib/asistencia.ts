import type { Anomalia, Asesora, Marca } from "./tipos";

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

/** Comentario de una marca puntual recién guardada, para el pop-up inmediato. */
export function detectarAnomaliaInmediata(
  marcasDelDia: Marca[]
): { tipo: "falta_entrada" | "falta_salida"; mensaje: string } | null {
  const tieneEntrada = marcasDelDia.some((m) => m.tipo === "entrada");
  const tieneSalida = marcasDelDia.some((m) => m.tipo === "salida");

  if (tieneEntrada && !tieneSalida) {
    return { tipo: "falta_salida", mensaje: "Aun no se ha registrado la marca de SALIDA de hoy." };
  }
  if (tieneSalida && !tieneEntrada) {
    return { tipo: "falta_entrada", mensaje: "Aun no se ha registrado la marca de ENTRADA de hoy." };
  }
  return null;
}
