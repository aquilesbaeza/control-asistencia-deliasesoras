import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes");
  const supabase = supabaseAdmin();

  let query = supabase.from("dias_especiales").select("*");
  if (mes) query = query.gte("fecha", `${mes}-01`).lte("fecha", `${mes}-31`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ dias: data });
}

// Crea o reemplaza (upsert) el estatus manual de un dia para una asesora.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { asesora_id, fecha, tipo, nota } = body as {
    asesora_id?: string;
    fecha?: string;
    tipo?: string;
    nota?: string;
  };

  if (!asesora_id || !fecha || !tipo) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("dias_especiales")
    .upsert({ asesora_id, fecha, tipo, nota: nota ?? null }, { onConflict: "asesora_id,fecha" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ dia: data });
}

export async function DELETE(req: NextRequest) {
  const asesora_id = req.nextUrl.searchParams.get("asesora_id");
  const fecha = req.nextUrl.searchParams.get("fecha");
  if (!asesora_id || !fecha) {
    return NextResponse.json({ error: "Faltan parametros" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("dias_especiales")
    .delete()
    .eq("asesora_id", asesora_id)
    .eq("fecha", fecha);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
