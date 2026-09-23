import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rangoMes } from "@/lib/asistencia";

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes"); // YYYY-MM
  const supabase = supabaseAdmin();

  let query = supabase.from("feriados").select("*").order("fecha");
  if (mes) {
    const { desde, hasta } = rangoMes(mes);
    query = query.gte("fecha", desde).lt("fecha", hasta);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feriados: data });
}

// Nuria define los feriados del mes de antemano (se trabajan de forma opcional).
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { fecha, descripcion } = body as { fecha?: string; descripcion?: string };
  if (!fecha) return NextResponse.json({ error: "Falta la fecha" }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("feriados")
    .upsert({ fecha, descripcion: descripcion ?? null }, { onConflict: "fecha" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feriado: data });
}

export async function DELETE(req: NextRequest) {
  const fecha = req.nextUrl.searchParams.get("fecha");
  if (!fecha) return NextResponse.json({ error: "Falta la fecha" }, { status: 400 });

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("feriados").delete().eq("fecha", fecha);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
