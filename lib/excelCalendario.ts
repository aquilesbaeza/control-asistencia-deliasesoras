import ExcelJS from "exceljs";
import path from "path";
import { CODIGO_ESTATUS } from "./tipos";

const PLANTILLA = path.join(process.cwd(), "data", "plantilla-asistencia.xlsx");

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Setiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const LETRA_DIA = ["D", "L", "K", "M", "J", "V", "S"]; // 0=domingo ... 6=sabado, K=miercoles como en el original

export function nombreHojaMes(anio: number, mesIndex0: number): string {
  return `${MESES[mesIndex0]} ${anio}`;
}

function buscarHojaExistente(workbook: ExcelJS.Workbook, anio: number, mesIndex0: number) {
  const objetivo = nombreHojaMes(anio, mesIndex0).toLowerCase();
  return workbook.worksheets.find((ws) => ws.name.trim().toLowerCase() === objetivo);
}

function hojaPlantillaEstilos(workbook: ExcelJS.Workbook) {
  // Cualquier hoja mensual del archivo original sirve de plantilla de estilos
  // (todas comparten el mismo formato condicional de 5 colores).
  const candidata = workbook.worksheets.find(
    (ws) => ws.name !== "Hoja1" && ws.getCell("B2").value === "PUNTO"
  );
  if (!candidata) throw new Error("No se encontro una hoja plantilla en el archivo base.");
  return candidata;
}

function clonarHojaConEstilos(
  workbook: ExcelJS.Workbook,
  origen: ExcelJS.Worksheet,
  nombreNuevo: string
): ExcelJS.Worksheet {
  const nueva = workbook.addWorksheet(nombreNuevo);
  const modeloOrigen = origen.model as unknown as Record<string, unknown>;
  Object.assign(nueva.model as unknown as Record<string, unknown>, modeloOrigen, {
    id: nueva.id,
    name: nombreNuevo,
  });
  return nueva;
}

function diasDelMes(anio: number, mesIndex0: number): number {
  return new Date(anio, mesIndex0 + 1, 0).getDate();
}

export type FilaCalendario = {
  punto: string;
  nombre: string;
  dias: Record<number, number | undefined>; // dia (1-31) -> codigo 1-5
};

/**
 * Genera el Excel de calendario mensual, replicando el formato/estilos del
 * archivo original (data/plantilla-asistencia.xlsx). Si ya existe una hoja
 * para ese mes la reutiliza (mismo mecanismo de formato condicional), si no
 * clona la estructura de una hoja mensual existente.
 */
export async function generarExcelCalendario(
  anio: number,
  mesIndex0: number,
  filas: FilaCalendario[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(PLANTILLA);

  const nombreHoja = nombreHojaMes(anio, mesIndex0);
  let hoja = buscarHojaExistente(workbook, anio, mesIndex0);

  if (!hoja) {
    const plantillaEstilos = hojaPlantillaEstilos(workbook);
    hoja = clonarHojaConEstilos(workbook, plantillaEstilos, nombreHoja);
  }

  const totalDias = diasDelMes(anio, mesIndex0);

  // Fila 2: numero de dia. Fila 3: letra del dia de la semana.
  for (let dia = 1; dia <= 31; dia++) {
    const col = 3 + dia; // D=4
    const celdaNumero = hoja.getRow(2).getCell(col);
    const celdaLetra = hoja.getRow(3).getCell(col);
    if (dia <= totalDias) {
      celdaNumero.value = dia;
      const fecha = new Date(anio, mesIndex0, dia);
      celdaLetra.value = LETRA_DIA[fecha.getDay()];
    } else {
      celdaNumero.value = null;
      celdaLetra.value = null;
    }
  }

  // Limpia filas de datos previas (a partir de la fila 4) y vuelve a escribir.
  const primerFilaDatos = 4;
  const ultimaFilaExistente = Math.max(hoja.rowCount, primerFilaDatos);
  for (let r = primerFilaDatos; r <= ultimaFilaExistente; r++) {
    hoja.getRow(r).eachCell({ includeEmpty: true }, (celda) => {
      celda.value = null;
    });
  }

  const filasOrdenadas = [...filas].sort((a, b) => {
    const porPunto = a.punto.localeCompare(b.punto, "es");
    return porPunto !== 0 ? porPunto : a.nombre.localeCompare(b.nombre, "es");
  });

  const filaEstiloBase = hoja.getRow(primerFilaDatos);

  filasOrdenadas.forEach((datosFila, idx) => {
    const numeroFila = primerFilaDatos + idx;
    const fila = hoja.getRow(numeroFila);

    fila.getCell(2).value = datosFila.punto; // B
    fila.getCell(2).style = { ...filaEstiloBase.getCell(2).style };
    fila.getCell(3).value = datosFila.nombre; // C
    fila.getCell(3).style = { ...filaEstiloBase.getCell(3).style };

    for (let dia = 1; dia <= totalDias; dia++) {
      const col = 3 + dia;
      const celda = fila.getCell(col);
      celda.style = { ...filaEstiloBase.getCell(col).style };
      const codigo = datosFila.dias[dia];
      celda.value = codigo ?? null;
    }
  });

  const ultimaFilaNueva = primerFilaDatos + filasOrdenadas.length - 1;

  // Extiende el formato condicional (colores por codigo 1-5) a todas las filas usadas.
  const cfExistente = (hoja as unknown as { model: { conditionalFormattings?: { ref: string }[] } })
    .model.conditionalFormattings;
  if (cfExistente) {
    for (const cf of cfExistente) {
      cf.ref = `D4:AH${Math.max(ultimaFilaNueva, 31)}`;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** Convierte el codigo de estatus 1-5 a la constante correspondiente (helper de uso externo). */
export { CODIGO_ESTATUS };
