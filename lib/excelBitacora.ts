import ExcelJS from "exceljs";
import { agruparPorDia, HORA_ENTRADA_POR_DEFECTO, TOLERANCIA_TARDE_MIN } from "./asistencia";
import { horaAMinutos } from "./tiempo";
import type { Asesora, Comentario, Marca } from "./tipos";

export async function generarExcelBitacora(
  asesoras: Asesora[],
  marcasPorAsesora: Map<string, Marca[]>,
  comentariosMes: Comentario[] = []
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
      if (dia.entrada) {
        const esperada = (asesora.hora_entrada ?? HORA_ENTRADA_POR_DEFECTO).slice(0, 5);
        const tarde = horaAMinutos(dia.entrada.hora) - horaAMinutos(esperada);
        if (tarde > TOLERANCIA_TARDE_MIN) comentarios.push(`Llegada tardía (+${tarde} min)`);
      }
      if (dia.entrada && !dia.salida) comentarios.push("Pendiente la marca de salida");
      if (dia.salida && !dia.entrada) comentarios.push("Pendiente la marca de entrada");
      if (dia.horasEfectivas !== null && dia.horasEfectivas < HORAS_JORNADA) {
        comentarios.push(
          `Jornada de ${dia.horasEfectivas.toFixed(1)} h efectivas (menos de las ${HORAS_JORNADA} h esperadas)`
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

  // Segunda hoja: comentarios estructurados (fecha, asunto, asesora, situacion).
  const hojaComentarios = workbook.addWorksheet("Comentarios");
  hojaComentarios.columns = [
    { header: "Fecha", key: "fecha", width: 14 },
    { header: "Asunto", key: "asunto", width: 20 },
    { header: "Asesora", key: "nombre", width: 36 },
    { header: "Punto", key: "punto", width: 28 },
    { header: "Situación", key: "situacion", width: 60 },
  ];
  const encabezadoComentarios = hojaComentarios.getRow(1);
  encabezadoComentarios.font = { bold: true, color: { argb: "FFFFFFFF" } };
  encabezadoComentarios.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF196B24" } };
  for (const c of comentariosMes) {
    hojaComentarios.addRow({
      fecha: c.fecha,
      asunto: c.asunto,
      nombre: c.asesoras?.nombre ?? "General",
      punto: c.asesoras?.punto ?? "",
      situacion: c.situacion,
    });
  }
  hojaComentarios.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
