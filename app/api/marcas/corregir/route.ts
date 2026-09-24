import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { detectarAnomaliaInmediata } from "@/lib/asistencia";
import type { Marca } from "@/lib/tipos";

type Cambio = string | null | undefined; // "HH:MM" = fijar, null = quitar, undefined = no tocar

/**
 * Nuria corrige la hora de entrada y/o salida de cualquier asesora en un dia
 * (por ejemplo, completar la jornada de quien se fue por una cita medica).
 * Se conserva la hora original de la foto y el motivo como constancia.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { asesora_id, fecha, entrada, salida, motivo } = body as {
    asesora_id?: string;
    fecha?: string;
    entrada?: Cambio;
    salida?: Cambio;
    motivo?: string;
  };

  if (!asesora_id || !fecha) {
    return NextResponse.json({ error: "Faltan la asesora o la fecha" }, { status: 400 });
  }
  const valida = (h: Cambio) => h === undefined || h === null || /^\d{2}:\d{2}$/.test(h);
  if (!valida(entrada) || !valida(salida)) {
    return NextResponse.json({ error: "La hora debe tener formato HH:MM" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: existentes, error: errLeer } = await supabase
    .from("marcas")
    .select("*")
    .eq("asesora_id", asesora_id)
    .eq("fecha", fecha);
  if (errLeer) return NextResponse.json({ error: errLeer.message }, { status: 500 });

  const marcasDia = (existentes ?? []) as Marca[];

  for (const [tipo, nueva] of [["entrada", entrada], ["salida", salida]] as [Marca["tipo"], Cambio][]) {
    if (nueva === undefined) continue;
    const delTipo = marcasDia.filter((m) => m.tipo === tipo);
    // La marca "valida" es la entrada mas temprana / la salida mas tardia.
    const vigente = delTipo.length
      ? delTipo.reduce((a, b) => (tipo === "entrada" ? (b.hora < a.hora ? b : a) : b.hora > a.hora ? b : a))
      : null;

    if (nueva === null) {
      if (delTipo.length) {
        const { error } = await supabase.from("marcas").delete().in("id", delTipo.map((m) => m.id));
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      continue;
    }

    // Si no cambio la hora, no se registra correccion.
    if (vigente && vigente.hora.slice(0, 5) === nueva && delTipo.length === 1) continue;

    const horaOriginal = vigente?.hora_original ?? vigente?.hora ?? null;
    // Primero se inserta la marca corregida y solo si sale bien se borran las anteriores (nunca se pierde una marca).
    const { error } = await supabase.from("marcas").insert({
      asesora_id,
      fecha,
      hora: nueva,
      tipo,
      origen: "manual",
      foto_url: vigente?.foto_url ?? null,
      hora_original: horaOriginal,
      motivo_correccion: (motivo ?? "").trim() || null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (delTipo.length) {
      const { error: errBorrar } = await supabase.from("marcas").delete().in("id", delTipo.map((m) => m.id));
      if (errBorrar) return NextResponse.json({ error: errBorrar.message }, { status: 500 });
    }
  }

  const [{ data: marcasFinal }, { data: asesora }] = await Promise.all([
    supabase.from("marcas").select("*").eq("asesora_id", asesora_id).eq("fecha", fecha),
    supabase.from("asesoras").select("nombre").eq("id", asesora_id).single(),
  ]);
  const anomalia = detectarAnomaliaInmediata((marcasFinal ?? []) as Marca[], asesora?.nombre ?? "La asesora", fecha);
  return NextResponse.json({ ok: true, anomalia });
}
