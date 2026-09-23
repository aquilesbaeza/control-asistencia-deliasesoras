import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { agruparPorDia, estatusAutomatico, rangoMes } from "@/lib/asistencia";
import { CODIGO_ESTATUS, generarExcelCalendario, nombreHojaMes } from "@/lib/excelCalendario";
import type { Asesora, DiaEspecial, Feriado, Marca } from "@/lib/tipos";

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes"); // YYYY-MM
  if (!mes) return NextResponse.json({ error: "Falta parametro mes=YYYY-MM" }, { status: 400 });

  const [anioStr, mesStr] = mes.split("-");
  const anio = Number(anioStr);
  const mesIndex0 = Number(mesStr) - 1;

  const supabase = supabaseAdmin();

  const { desde, hasta } = rangoMes(mes);
  const [{ data: asesoras, error: errAsesoras }, { data: marcas, error: errMarcas }, { data: diasEspeciales, error: errDias }, { data: feriados, error: errFeriados }] =
    await Promise.all([
      supabase.from("asesoras").select("*").eq("activo", true),
      supabase.from("marcas").select("*").gte("fecha", desde).lt("fecha", hasta),
      supabase.from("dias_especiales").select("*").gte("fecha", desde).lt("fecha", hasta),
      supabase.from("feriados").select("*").gte("fecha", desde).lt("fecha", hasta),
    ]);

  if (errAsesoras || errMarcas || errDias || errFeriados) {
    return NextResponse.json(
      { error: (errAsesoras || errMarcas || errDias || errFeriados)?.message },
      { status: 500 }
    );
  }

  const fechasFeriado = new Set(((feriados ?? []) as Feriado[]).map((f) => f.fecha));
  const hoyISO = new Date().toISOString().slice(0, 10);
  const totalDiasMes = new Date(anio, mesIndex0 + 1, 0).getDate();

  const marcasPorAsesora = new Map<string, Marca[]>();
  for (const marca of (marcas ?? []) as Marca[]) {
    const lista = marcasPorAsesora.get(marca.asesora_id) ?? [];
    lista.push(marca);
    marcasPorAsesora.set(marca.asesora_id, lista);
  }

  const especialesPorAsesora = new Map<string, DiaEspecial[]>();
  for (const dia of (diasEspeciales ?? []) as DiaEspecial[]) {
    const lista = especialesPorAsesora.get(dia.asesora_id) ?? [];
    lista.push(dia);
    especialesPorAsesora.set(dia.asesora_id, lista);
  }

  const filas = ((asesoras ?? []) as Asesora[]).map((asesora) => {
    const dias: Record<number, number | undefined> = {};
    const porDia = agruparPorDia(marcasPorAsesora.get(asesora.id) ?? []);

    // 1) Asistencia/Ausencia automaticas segun las marcas (o falta de ellas).
    for (let dia = 1; dia <= totalDiasMes; dia++) {
      const fechaDia = `${mes}-${String(dia).padStart(2, "0")}`;
      const resumen = porDia.get(fechaDia);
      const estado = estatusAutomatico(
        fechaDia,
        !!(resumen?.entrada && resumen?.salida),
        fechasFeriado.has(fechaDia),
        hoyISO
      );
      if (estado) dias[dia] = CODIGO_ESTATUS[estado];
    }

    // 2) Lo que Nuria gestiona a mano (Incapacidad/Vacaciones/Libre/Ausencia manual) pisa lo automatico.
    for (const especial of especialesPorAsesora.get(asesora.id) ?? []) {
      const diaNum = Number(especial.fecha.split("-")[2]);
      dias[diaNum] = CODIGO_ESTATUS[especial.tipo];
    }

    return { punto: asesora.punto, nombre: asesora.nombre, dias };
  });

  const buffer = await generarExcelCalendario(anio, mesIndex0, filas);
  const nombreArchivo = `Asistencia ${nombreHojaMes(anio, mesIndex0)}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
