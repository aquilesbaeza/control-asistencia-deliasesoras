import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { agruparPorDia, jornadaTerminada } from "@/lib/asistencia";
import { ahoraCR, horaAMinutos } from "@/lib/tiempo";
import { mesConfirmado } from "@/lib/feriados";
import { ETIQUETA_ESTATUS, CODIGO_ESTATUS } from "@/lib/tipos";
import type { Asesora, DiaEspecial, Marca } from "@/lib/tipos";

const HORAS_JORNADA = 8;
const HORA_ENTRADA_POR_DEFECTO = "08:00";
const TOLERANCIA_ENTRADA_MIN = 30;
const TOLERANCIA_TARDE_MIN = 10;

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
  const ahora = ahoraCR();
  const feriadosConfirmados = await mesConfirmado(supabase, fecha.slice(0, 7));

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

    // Feriado: solo se listan quienes lo trabajaron (se trabaja de forma opcional).
    if (esFeriado && !tieneMarcas) continue;

    const esperada = (asesora.hora_entrada ?? HORA_ENTRADA_POR_DEFECTO).slice(0, 5);
    let minutosTarde: number | null = null;
    if (resumen?.entrada) {
      const diferencia = horaAMinutos(resumen.entrada.hora) - horaAMinutos(esperada);
      if (diferencia > TOLERANCIA_TARDE_MIN) minutosTarde = diferencia;
    }

    let comentario = "";
    let estado: "ok" | "warn" | "info" = "info";

    if (especial) {
      // Lo que Nuria registra a mano manda: nunca se reporta como ausencia ni falta de marca.
      comentario = ETIQUETA_ESTATUS[CODIGO_ESTATUS[especial.tipo]];
      estado = "info";
    } else if (resumen?.entrada && resumen?.salida) {
      const horas = resumen.horasEfectivas ?? 0;
      if (horas < HORAS_JORNADA) {
        comentario = `Jornada de ${horas.toFixed(1)} h (menos de las 8 h efectivas)`;
        estado = "warn";
      } else {
        comentario = `Jornada completa · ${horas.toFixed(1)}h`;
        estado = "ok";
      }
    } else if (resumen?.entrada) {
      if (jornadaTerminada(fecha, resumen.entrada.hora, ahora)) {
        comentario = "Pendiente la marca de salida";
        estado = "warn";
      } else {
        comentario = "En jornada";
        estado = "info";
      }
    } else if (resumen?.salida) {
      comentario = "Pendiente la marca de entrada";
      estado = "warn";
    } else if (fecha < ahora.fecha) {
      if (esFeriado) {
        comentario = "Feriado, no trabajó";
      } else if (!feriadosConfirmados) {
        comentario = "Pendiente confirmar los feriados del mes";
      } else {
        comentario = "No registra marcas este día (ausencia)";
        estado = "warn";
      }
    } else if (fecha === ahora.fecha) {
      if (ahora.minutos > horaAMinutos(esperada) + TOLERANCIA_ENTRADA_MIN) {
        comentario = "Aún no registra su entrada";
        estado = "warn";
      }
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
      especial: !!especial,
      esperada,
      minutosTarde,
    });
  }

  return NextResponse.json({
    fecha,
    esFeriado,
    feriadoDescripcion: feriado?.descripcion ?? null,
    feriadosConfirmados,
    filas,
  });
}
