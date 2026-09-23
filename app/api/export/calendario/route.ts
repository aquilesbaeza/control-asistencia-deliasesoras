import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { agruparPorDia } from "@/lib/asistencia";
import { CODIGO_ESTATUS, generarExcelCalendario, nombreHojaMes } from "@/lib/excelCalendario";
import type { Asesora, DiaEspecial, Marca } from "@/lib/tipos";

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes"); // YYYY-MM
  if (!mes) return NextResponse.json({ error: "Falta parametro mes=YYYY-MM" }, { status: 400 });

  const [anioStr, mesStr] = mes.split("-");
  const anio = Number(anioStr);
  const mesIndex0 = Number(mesStr) - 1;

  const supabase = supabaseAdmin();

  const [{ data: asesoras, error: errAsesoras }, { data: marcas, error: errMarcas }, { data: diasEspeciales, error: errDias }] =
    await Promise.all([
      supabase.from("asesoras").select("*").eq("activo", true),
      supabase.from("marcas").select("*").gte("fecha", `${mes}-01`).lte("fecha", `${mes}-31`),
      supabase.from("dias_especiales").select("*").gte("fecha", `${mes}-01`).lte("fecha", `${mes}-31`),
    ]);

  if (errAsesoras || errMarcas || errDias) {
    return NextResponse.json(
      { error: (errAsesoras || errMarcas || errDias)?.message },
      { status: 500 }
    );
  }

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
    for (const resumen of porDia.values()) {
      if (resumen.entrada && resumen.salida) {
        const diaNum = Number(resumen.fecha.split("-")[2]);
        dias[diaNum] = CODIGO_ESTATUS.asistencia;
      }
    }

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
