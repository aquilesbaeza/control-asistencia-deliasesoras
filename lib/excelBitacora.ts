import ExcelJS from "exceljs";
import { agruparPorDia } from "./asistencia";
import type { Asesora, Marca } from "./tipos";

export async function generarExcelBitacora(
  asesoras: Asesora[],
  marcasPorAsesora: Map<string, Marca[]>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet("Bitacora de marcas");

  hoja.columns = [
    { header: "Punto", key: "punto", width: 32 },
    { header: "Nombre", key: "nombre", width: 32 },
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "Hora Entrada", key: "entrada", width: 14 },
    { header: "Hora Salida", key: "salida", width: 14 },
    { header: "Horas Efectivas", key: "horas", width: 16 },
    { header: "Comentario", key: "comentario", width: 45 },
  ];

  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true, color: { argb: "FFFFFFFF" } };
  encabezado.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF196B24" },
  };
  encabezado.alignment = { vertical: "middle", horizontal: "center" };

  const HORAS_JORNADA = 8;

  for (const asesora of asesoras) {
    const marcas = marcasPorAsesora.get(asesora.id) ?? [];
    const porDia = agruparPorDia(marcas);
    const dias = [...porDia.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));

    for (const dia of dias) {
      const comentarios: string[] = [];
      if (dia.entrada && !dia.salida) comentarios.push("Falta marca de salida");
      if (dia.salida && !dia.entrada) comentarios.push("Falta marca de entrada");
      if (dia.horasEfectivas !== null && dia.horasEfectivas < HORAS_JORNADA) {
        comentarios.push(
          `Menos de ${HORAS_JORNADA}h efectivas (${dia.horasEfectivas.toFixed(1)}h)`
        );
      }

      const fila = hoja.addRow({
        punto: asesora.punto,
        nombre: asesora.nombre,
        fecha: dia.fecha,
        entrada: dia.entrada?.hora?.slice(0, 5) ?? "",
        salida: dia.salida?.hora?.slice(0, 5) ?? "",
        horas: dia.horasEfectivas !== null ? Number(dia.horasEfectivas.toFixed(2)) : "",
        comentario: comentarios.join(" / "),
      });

      if (comentarios.length > 0) {
        fila.getCell("comentario").font = { color: { argb: "FFC00000" }, bold: true };
      }
    }
  }

  hoja.views = [{ state: "frozen", ySplit: 1 }];
  hoja.autoFilter = { from: "A1", to: "G1" };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
