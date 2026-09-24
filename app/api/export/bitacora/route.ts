import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generarExcelBitacora } from "@/lib/excelBitacora";
import { rangoMes } from "@/lib/asistencia";
import { paginar } from "@/lib/paginar";
import type { Asesora, Comentario, Marca } from "@/lib/tipos";

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes");
  if (!mes) return NextResponse.json({ error: "Falta parametro mes=YYYY-MM" }, { status: 400 });

  const supabase = supabaseAdmin();
  const { desde, hasta } = rangoMes(mes);

  const [{ data: asesoras, error: errAsesoras }, { data: marcas, error: errMarcas }, { data: comentarios }] = await Promise.all([
    supabase.from("asesoras").select("*").order("punto").order("nombre"),
    paginar<Marca>((d, h) =>
      supabase.from("marcas").select("*").gte("fecha", desde).lt("fecha", hasta).order("fecha").order("hora").order("id").range(d, h)
    ).then((r) => ({ data: r.data, error: r.error ? { message: r.error } : null })),
    supabase
      .from("comentarios")
      .select("*, asesoras(nombre, punto)")
      .gte("fecha", desde)
      .lt("fecha", hasta)
      .order("fecha")
      .order("creado_en"),
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

  const buffer = await generarExcelBitacora(
    (asesoras ?? []) as Asesora[],
    marcasPorAsesora,
    (comentarios ?? []) as Comentario[]
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Bitacora ${mes}.xlsx"`,
    },
  });
}
