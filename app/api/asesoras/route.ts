import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("asesoras")
    .select("*")
    .order("punto")
    .order("nombre");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asesoras: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { nombre, punto } = body as { nombre?: string; punto?: string };

  if (!nombre?.trim() || !punto?.trim()) {
    return NextResponse.json({ error: "nombre y punto son obligatorios" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("asesoras")
    .insert({ nombre: nombre.trim(), punto: punto.trim() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asesora: data });
}
