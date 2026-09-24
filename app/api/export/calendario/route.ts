import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calcularMesAsesora, rangoMes } from "@/lib/asistencia";
import { ahoraCR } from "@/lib/tiempo";
import { mesConfirmado } from "@/lib/feriados";
import { paginar } from "@/lib/paginar";
import { CODIGO_ESTATUS, generarExcelCalendario, nombreHojaMes } from "@/lib/excelCalendario";
import type { Asesora, Comentario, DiaEspecial, Feriado, Marca } from "@/lib/tipos";

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes"); // YYYY-MM
  if (!mes) return NextResponse.json({ error: "Falta parametro mes=YYYY-MM" }, { status: 400 });

  const [anioStr, mesStr] = mes.split("-");
  const anio = Number(anioStr);
  const mesIndex0 = Number(mesStr) - 1;

  const supabase = supabaseAdmin();

  const { desde, hasta } = rangoMes(mes);
  const [{ data: asesoras, error: errAsesoras }, { data: marcas, error: errMarcasMsg }, { data: diasEspeciales, error: errDiasMsg }, { data: feriados, error: errFeriados }, { data: comentarios }] =
    await Promise.all([
      supabase.from("asesoras").select("*"),
      paginar<Marca>((d, h) =>
        supabase.from("marcas").select("*").gte("fecha", desde).lt("fecha", hasta).order("fecha").order("hora").order("id").range(d, h)
      ),
      paginar<DiaEspecial>((d, h) =>
        supabase.from("dias_especiales").select("*").gte("fecha", desde).lt("fecha", hasta).order("fecha").order("id").range(d, h)
      ),
      supabase.from("feriados").select("*").gte("fecha", desde).lt("fecha", hasta),
      supabase
        .from("comentarios")
        .select("*, asesoras(nombre, punto)")
        .gte("fecha", desde)
        .lt("fecha", hasta)
        .order("fecha")
        .order("creado_en"),
    ]);

  if (errAsesoras || errMarcasMsg || errDiasMsg || errFeriados) {
    return NextResponse.json(
      { error: errAsesoras?.message ?? errMarcasMsg ?? errDiasMsg ?? errFeriados?.message },
      { status: 500 }
    );
  }

  const fechasFeriado = new Set(((feriados ?? []) as Feriado[]).map((f) => f.fecha));
  const feriadosConfirmados = await mesConfirmado(supabase, mes);
  const hoy = ahoraCR().fecha;
  const totalDias = new Date(anio, mesIndex0 + 1, 0).getDate();

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

  // El sistema completa Asistencia y Ausencia; Libre, Vacaciones e Incapacidad vienen de lo que Nuria registro.
  // Una marca incompleta cuenta como Asistencia (si estuvo); el error queda reportado en la bitacora.
  const CODIGOS: Record<string, number | undefined> = {
    asistencia: CODIGO_ESTATUS.asistencia,
    parcial: CODIGO_ESTATUS.asistencia,
    enJornada: CODIGO_ESTATUS.asistencia,
    ausencia: CODIGO_ESTATUS.ausencia,
    incapacidad: CODIGO_ESTATUS.incapacidad,
    libre: CODIGO_ESTATUS.libre,
    vacaciones: CODIGO_ESTATUS.vacaciones,
  };

  // Las asesoras quitadas solo aparecen en los meses donde tienen historial.
  const filas = ((asesoras ?? []) as Asesora[])
    .filter((a) => a.activo || marcasPorAsesora.has(a.id) || especialesPorAsesora.has(a.id))
    .map((asesora) => {
    const calculados = calcularMesAsesora({
      mes,
      totalDias,
      horaEntradaEsperada: asesora.hora_entrada,
      marcas: marcasPorAsesora.get(asesora.id) ?? [],
      especiales: especialesPorAsesora.get(asesora.id) ?? [],
      fechasFeriado,
      feriadosConfirmados,
      hoy,
      ahoraMinutos: ahoraCR().minutos,
      fechaIngreso: asesora.fecha_ingreso,
      fechaBaja: asesora.fecha_baja,
    });

    const dias: Record<number, number | undefined> = {};
    for (const d of calculados) {
      const codigo = CODIGOS[d.estatus];
      if (codigo) dias[d.dia] = codigo;
    }
    return { punto: asesora.punto, nombre: asesora.nombre, dias };
  });

  const lineasComentarios = ((comentarios ?? []) as Comentario[]).map((c) => {
    const [, m, d] = c.fecha.split("-");
    const quien = c.asesoras?.nombre ? ` · ${c.asesoras.nombre}` : "";
    const situacion = c.situacion ? ` — ${c.situacion}` : "";
    return `${Number(d)}/${Number(m)} · ${c.asunto.toUpperCase()}${quien}${situacion}`;
  });

  const buffer = await generarExcelCalendario(anio, mesIndex0, filas, lineasComentarios);
  const nombreArchivo = `Asistencia ${nombreHojaMes(anio, mesIndex0)}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}
