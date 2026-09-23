import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calcularAnomalias } from "@/lib/asistencia";
import type { Asesora, Marca } from "@/lib/tipos";

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes");
  if (!mes) return NextResponse.json({ error: "Falta parametro mes=YYYY-MM" }, { status: 400 });

  const supabase = supabaseAdmin();

  const [{ data: asesoras, error: errAsesoras }, { data: marcas, error: errMarcas }] = await Promise.all([
    supabase.from("asesoras").select("*").eq("activo", true),
    supabase.from("marcas").select("*").gte("fecha", `${mes}-01`).lte("fecha", `${mes}-31`),
  ]);

  if (errAsesoras || errMarcas) {
    return NextResponse.json({ error: (errAsesoras || errMarcas)?.message }, { status: 500 });
  }

  const marcasPorAsesora = new Map<string, Marca[]>();
  for (const marca of (marcas ?? []) as Marca[]) {
    const lista = marcasPorAsesora.get(marca.asesora_id) ?? [];
    lista.push(marca);
    marcasPorAsesora.set(marca.asesora_id, lista);
  }

  const anomalias = ((asesoras ?? []) as Asesora[]).flatMap((asesora) =>
    calcularAnomalias(asesora, marcasPorAsesora.get(asesora.id) ?? [])
  );

  anomalias.sort((a, b) => a.fecha.localeCompare(b.fecha));

  return NextResponse.json({ anomalias });
}
