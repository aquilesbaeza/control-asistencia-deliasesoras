import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { confirmarMes } from "@/lib/feriados";

// Nuria indica que ya definio los feriados del mes (incluido "no hay feriados").
export async function POST(req: NextRequest) {
  const { mes } = (await req.json()) as { mes?: string };
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ error: "Falta mes=YYYY-MM" }, { status: 400 });
  }
  const error = await confirmarMes(supabaseAdmin(), mes);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
