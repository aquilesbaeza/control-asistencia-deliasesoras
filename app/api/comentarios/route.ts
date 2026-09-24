import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rangoMes } from "@/lib/asistencia";
import { ASUNTOS_COMENTARIO } from "@/lib/tipos";

// Comentarios de un dia (?fecha=YYYY-MM-DD) o de un mes (?mes=YYYY-MM), en orden cronologico.
export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes");
  const fecha = req.nextUrl.searchParams.get("fecha");
  const supabase = supabaseAdmin();

  let query = supabase
    .from("comentarios")
    .select("*, asesoras(nombre, punto)")
    .order("fecha", { ascending: true })
    .order("creado_en", { ascending: true });

  if (fecha) {
    query = query.eq("fecha", fecha);
  } else if (mes) {
    const { desde, hasta } = rangoMes(mes);
    query = query.gte("fecha", desde).lt("fecha", hasta);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comentarios: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { fecha, asunto, asesora_id, situacion } = body as {
    fecha?: string;
    asunto?: string;
    asesora_id?: string | null;
    situacion?: string;
  };

  if (!fecha || !asunto || !(ASUNTOS_COMENTARIO as readonly string[]).includes(asunto)) {
    return NextResponse.json({ error: "Faltan la fecha o el asunto" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("comentarios")
    .insert({ fecha, asunto, asesora_id: asesora_id || null, situacion: (situacion ?? "").trim() })
    .select("*, asesoras(nombre, punto)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comentario: data });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("comentarios").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
