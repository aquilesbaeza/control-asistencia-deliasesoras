import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { agruparPorDia } from "@/lib/asistencia";
import { ETIQUETA_ESTATUS, CODIGO_ESTATUS } from "@/lib/tipos";
import type { Asesora, DiaEspecial, Marca } from "@/lib/tipos";

const HORAS_JORNADA = 8;

export async function GET(req: NextRequest) {
  const fecha = req.nextUrl.searchParams.get("fecha"); // YYYY-MM-DD
  if (!fecha) return NextResponse.json({ error: "Falta parametro fecha=YYYY-MM-DD" }, { status: 400 });

  const supabase = supabaseAdmin();

  const [{ data: asesoras, error: e1 }, { data: marcas, error: e2 }, { data: especiales, error: e3 }, { data: feriado, error: e4 }] =
    await Promise.all([
      supabase.from("asesoras").select("*").eq("activo", true).order("punto").order("nombre"),
      supabase.from("marcas").select("*").eq("fecha", fecha),
      supabase.from("dias_especiales").select("*").eq("fecha", fecha),
      supabase.from("feriados").select("*").eq("fecha", fecha).maybeSingle(),
    ]);

  if (e1 || e2 || e3 || e4) {
    return NextResponse.json({ error: (e1 || e2 || e3 || e4)?.message }, { status: 500 });
  }

  const esFeriado = !!feriado;
  const hoyISO = new Date().toISOString().slice(0, 10);

  const marcasPorAsesora = new Map<string, Marca[]>();
  for (const m of (marcas ?? []) as Marca[]) {
    const lista = marcasPorAsesora.get(m.asesora_id) ?? [];
    lista.push(m);
    marcasPorAsesora.set(m.asesora_id, lista);
  }
  const especialPorAsesora = new Map<string, DiaEspecial>();
  for (const d of (especiales ?? []) as DiaEspecial[]) especialPorAsesora.set(d.asesora_id, d);

  const filas = [];

  for (const asesora of (asesoras ?? []) as Asesora[]) {
    const marcasDia = marcasPorAsesora.get(asesora.id) ?? [];
    const resumen = agruparPorDia(marcasDia).get(fecha) ?? null;
    const especial = especialPorAsesora.get(asesora.id) ?? null;
    const tieneMarcas = marcasDia.length > 0;

    // Feriado sin marcas: se trabaja de forma opcional, no se lista.
    if (esFeriado && !tieneMarcas && !especial) continue;

    let comentario = "";
    let estado: "ok" | "warn" | "info" = "info";

    if (especial) {
      comentario = ETIQUETA_ESTATUS[CODIGO_ESTATUS[especial.tipo]];
      estado = "info";
    } else if (resumen?.entrada && resumen?.salida) {
      const horas = resumen.horasEfectivas ?? 0;
      if (horas < HORAS_JORNADA) {
        comentario = `No cumple jornada efectiva · ${horas.toFixed(1)}h`;
        estado = "warn";
      } else {
        comentario = `Jornada completa · ${horas.toFixed(1)}h`;
        estado = "ok";
      }
    } else if (resumen?.entrada && !resumen?.salida) {
      comentario = "Falta marca de salida";
      estado = "warn";
    } else if (resumen?.salida && !resumen?.entrada) {
      comentario = "Falta marca de entrada";
      estado = "warn";
    } else if (fecha > hoyISO) {
      comentario = "";
      estado = "info";
    } else if (esFeriado) {
      comentario = "Feriado, no trabajó";
      estado = "info";
    } else {
      comentario = "Ausencia";
      estado = "warn";
    }

    filas.push({
      asesora_id: asesora.id,
      nombre: asesora.nombre,
      punto: asesora.punto,
      entrada: resumen?.entrada?.hora?.slice(0, 5) ?? null,
      salida: resumen?.salida?.hora?.slice(0, 5) ?? null,
      horasEfectivas: resumen?.horasEfectivas ?? null,
      comentario,
      estado,
    });
  }

  return NextResponse.json({ fecha, esFeriado, feriadoDescripcion: feriado?.descripcion ?? null, filas });
}
