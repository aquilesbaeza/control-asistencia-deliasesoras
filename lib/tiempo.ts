const ZONA = "America/Costa_Rica";

/** Fecha (YYYY-MM-DD) y minutos desde medianoche, en hora de Costa Rica. */
export function ahoraCR(ahora: Date = new Date()): { fecha: string; minutos: number } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(ahora);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "0";
  return {
    fecha: `${valor("year")}-${valor("month")}-${valor("day")}`,
    minutos: Number(valor("hour")) * 60 + Number(valor("minute")),
  };
}

/** En Costa Rica se dice "setiembre" (asi se llama la hoja del Excel); el idioma del sistema dice "septiembre". */
export function aSetiembre(texto: string): string {
  return texto.replace(/septiembre/g, "setiembre").replace(/Septiembre/g, "Setiembre");
}

export function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

/** Jornada completa entre entrada y salida: 8 horas efectivas + 1 de almuerzo. */
export const MINUTOS_JORNADA_TOTAL = 9 * 60;
