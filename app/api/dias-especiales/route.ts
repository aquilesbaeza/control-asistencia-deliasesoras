import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rangoMes } from "@/lib/asistencia";
import { paginar } from "@/lib/paginar";
import type { DiaEspecial } from "@/lib/tipos";

const TIPOS = ["ausencia", "incapacidad", "libre", "vacaciones"];
const MAX_DIAS_RANGO = 62;

function fechasEntre(desde: string, hasta: string): string[] {
  const fechas: string[] = [];
  const [a, m, d] = desde.split("-").map(Number);
  let cursor = new Date(Date.UTC(a, m - 1, d));
  const fin = new Date(`${hasta}T00:00:00Z`);
  while (cursor <= fin && fechas.length <= MAX_DIAS_RANGO) {
    fechas.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return fechas;
}

// Lista por mes (?mes=YYYY-MM) o desde una fecha en adelante (?desde=YYYY-MM-DD).
export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes");
  const desdeParam = req.nextUrl.searchParams.get("desde");
  const supabase = supabaseAdmin();

  const rango = mes ? rangoMes(mes) : null;
  const { data, error } = await paginar<DiaEspecial>((desde, hasta) => {
    let query = supabase.from("dias_especiales").select("*").order("fecha").order("id");
    if (rango) query = query.gte("fecha", rango.desde).lt("fecha", rango.hasta);
    else if (desdeParam) query = query.gte("fecha", desdeParam);
    return query.range(desde, hasta);
  });
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ dias: data });
}

// Crea o reemplaza el estatus manual de un dia, o de un rango (fecha_desde..fecha_hasta).
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { asesora_id, fecha, fecha_desde, fecha_hasta, tipo, nota, comprobante_url } = body as {
    asesora_id?: string;
    fecha?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
    tipo?: string;
    nota?: string;
    comprobante_url?: string;
  };

  const desde = fecha_desde ?? fecha;
  const hasta = fecha_hasta ?? desde;

  if (!asesora_id || !desde || !hasta || !tipo || !TIPOS.includes(tipo)) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }
  if (hasta < desde) {
    return NextResponse.json({ error: "La fecha final no puede ser anterior a la inicial" }, { status: 400 });
  }

  const fechas = fechasEntre(desde, hasta);
  if (fechas.length > MAX_DIAS_RANGO) {
    return NextResponse.json({ error: `El rango no puede pasar de ${MAX_DIAS_RANGO} días` }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  // Regla de Nuria: las vacaciones nunca quitan un libre ya establecido (ese dia se queda libre,
  // las vacaciones simplemente lo saltan); una incapacidad si gana sobre el libre, porque no se elige.
  let fechasAGuardar = fechas;
  if (tipo === "vacaciones") {
    const { data: existentes, error: errLibres } = await supabase
      .from("dias_especiales")
      .select("fecha")
      .eq("asesora_id", asesora_id)
      .eq("tipo", "libre")
      .in("fecha", fechas);
    if (errLibres) return NextResponse.json({ error: errLibres.message }, { status: 500 });
    const libres = new Set((existentes ?? []).map((d) => d.fecha));
    fechasAGuardar = fechas.filter((f) => !libres.has(f));
  }

  if (fechasAGuardar.length === 0) {
    return NextResponse.json({ dias: [], aviso: "Esos días ya eran libres de esta asesora; las vacaciones no se los quitan." });
  }

  const { data, error } = await supabase
    .from("dias_especiales")
    .upsert(
      fechasAGuardar.map((f) => ({ asesora_id, fecha: f, tipo, nota: nota || null, comprobante_url: comprobante_url || null })),
      { onConflict: "asesora_id,fecha" }
    )
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const salto = fechas.length - fechasAGuardar.length;
  return NextResponse.json({
    dias: data,
    aviso: salto > 0 ? `${salto} día(s) ya eran libres de esta asesora y se dejaron así; las vacaciones los saltan.` : null,
  });
}

// Quita un dia (?fecha=) o un rango (?desde=&hasta=) de una asesora.
export async function DELETE(req: NextRequest) {
  const asesora_id = req.nextUrl.searchParams.get("asesora_id");
  const fecha = req.nextUrl.searchParams.get("fecha");
  const desde = req.nextUrl.searchParams.get("desde") ?? fecha;
  const hasta = req.nextUrl.searchParams.get("hasta") ?? fecha;
  if (!asesora_id || !desde || !hasta) {
    return NextResponse.json({ error: "Faltan parametros" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("dias_especiales")
    .delete()
    .eq("asesora_id", asesora_id)
    .gte("fecha", desde)
    .lte("fecha", hasta);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
