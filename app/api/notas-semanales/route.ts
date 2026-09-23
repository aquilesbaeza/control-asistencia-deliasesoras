import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rangoMes } from "@/lib/asistencia";

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes"); // YYYY-MM
  const supabase = supabaseAdmin();

  let query = supabase.from("notas_semanales").select("*").order("fecha_inicio");
  if (mes) {
    // trae semanas que puedan iniciar hasta 6 dias antes del mes (semana a caballo)
    const { hasta } = rangoMes(mes);
    const inicio = new Date(`${mes}-01T00:00:00`);
    inicio.setDate(inicio.getDate() - 6);
    query = query.gte("fecha_inicio", inicio.toISOString().slice(0, 10)).lt("fecha_inicio", hasta);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notas: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { fecha_inicio, texto } = body as { fecha_inicio?: string; texto?: string };
  if (!fecha_inicio) return NextResponse.json({ error: "Falta fecha_inicio" }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("notas_semanales")
    .upsert({ fecha_inicio, texto: texto ?? "" }, { onConflict: "fecha_inicio" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ nota: data });
}
