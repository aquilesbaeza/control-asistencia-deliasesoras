import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { agruparPorDia, jornadaTerminada, rangoConsecutivo, sumarDiasISO } from "@/lib/asistencia";
import { paginar } from "@/lib/paginar";
import { ahoraCR, horaAMinutos } from "@/lib/tiempo";
import { mesConfirmado } from "@/lib/feriados";
import { ETIQUETA_ESTATUS, CODIGO_ESTATUS } from "@/lib/tipos";
import type { Asesora, DiaEspecial, Marca } from "@/lib/tipos";

const HORAS_JORNADA = 8;
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

  // Para mostrar "del 10 al 16 (dia 3 de 7)" se traen los permisos cercanos de quienes hoy tienen uno.
  const fechasPermisos = new Map<string, string[]>();
  const idsConPermiso = [...especialPorAsesora.keys()];
  if (idsConPermiso.length > 0) {
    const { data: cercanos } = await paginar<DiaEspecial>((d, h) =>
      supabase
        .from("dias_especiales")
        .select("*")
        .in("asesora_id", idsConPermiso)
        .gte("fecha", sumarDiasISO(fecha, -60))
        .lte("fecha", sumarDiasISO(fecha, 60))
        .order("fecha")
        .order("id")
        .range(d, h)
    );
    for (const x of cercanos) {
      const clave = `${x.asesora_id}|${x.tipo}`;
      fechasPermisos.set(clave, [...(fechasPermisos.get(clave) ?? []), x.fecha]);
    }
  }
  const diaMes = (iso: string) => `${Number(iso.split("-")[2])}/${Number(iso.split("-")[1])}`;

  const filas = [];

  for (const asesora of (asesoras ?? []) as Asesora[]) {
    const marcasDia = marcasPorAsesora.get(asesora.id) ?? [];
    const resumen = agruparPorDia(marcasDia).get(fecha) ?? null;
    const especial = especialPorAsesora.get(asesora.id) ?? null;
    const tieneMarcas = marcasDia.length > 0;

    // Feriado: solo se listan quienes lo trabajaron (se trabaja de forma opcional).
    if (esFeriado && !tieneMarcas) continue;
    // Quien aun no habia ingresado (o ya no laboraba) ese dia no se lista.
    const fueraDeContrato = (asesora.fecha_ingreso && fecha < asesora.fecha_ingreso) || (asesora.fecha_baja && fecha > asesora.fecha_baja);
    if (fueraDeContrato && !tieneMarcas) continue;

    // El horario es variable: solo se compara si Nuria definio la hora de entrada de esta asesora.
    const esperada = asesora.hora_entrada ? asesora.hora_entrada.slice(0, 5) : null;
    let minutosTarde: number | null = null;
    if (esperada && resumen?.entrada) {
      const diferencia = horaAMinutos(resumen.entrada.hora) - horaAMinutos(esperada);
      if (diferencia > TOLERANCIA_TARDE_MIN) minutosTarde = diferencia;
    }

    const corregida = !!(resumen?.entrada?.hora_original || resumen?.salida?.hora_original);
    const motivoCorreccion = resumen?.entrada?.motivo_correccion ?? resumen?.salida?.motivo_correccion ?? null;

    let comentario = "";
    let estado: "ok" | "warn" | "info" = "info";

    if (especial) {
      // Lo que Nuria registra a mano manda: nunca se reporta como ausencia ni falta de marca.
      const r = rangoConsecutivo(fechasPermisos.get(`${asesora.id}|${especial.tipo}`) ?? [fecha], fecha);
      comentario = ETIQUETA_ESTATUS[CODIGO_ESTATUS[especial.tipo]];
      if (r.total > 1) comentario += ` · del ${diaMes(r.inicio)} al ${diaMes(r.fin)} (día ${r.posicion} de ${r.total})`;
      if (especial.nota) comentario += ` · ${especial.nota}`;
      estado = "info";
      if (tieneMarcas) {
        comentario += " · Tiene marcas este día: ¿trabajó pese al permiso?";
        estado = "warn";
      }
    } else if (resumen?.entrada && resumen?.salida) {
      const horas = resumen.horasEfectivas ?? 0;
      if (horas < HORAS_JORNADA) {
        comentario = `Jornada de ${horas.toFixed(1)} h (menos de las 8 h efectivas)`;
        estado = "warn";
      } else {
        comentario = `Jornada completa · ${horas.toFixed(1)}h`;
        estado = "ok";
      }
      if (corregida) {
        comentario += ` · Horas ajustadas por Nuria${motivoCorreccion ? ` (${motivoCorreccion})` : ""}`;
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
      if (esperada && ahora.minutos > horaAMinutos(esperada) + TOLERANCIA_ENTRADA_MIN) {
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
      corregida,
      entradaOriginal: resumen?.entrada?.hora_original?.slice(0, 5) ?? null,
      salidaOriginal: resumen?.salida?.hora_original?.slice(0, 5) ?? null,
      motivoCorreccion,
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
