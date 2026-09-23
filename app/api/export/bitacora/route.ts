import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generarExcelBitacora } from "@/lib/excelBitacora";
import type { Asesora, Marca } from "@/lib/tipos";

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes");
  if (!mes) return NextResponse.json({ error: "Falta parametro mes=YYYY-MM" }, { status: 400 });

  const supabase = supabaseAdmin();

  const [{ data: asesoras, error: errAsesoras }, { data: marcas, error: errMarcas }] = await Promise.all([
    supabase.from("asesoras").select("*").order("punto").order("nombre"),
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

  const buffer = await generarExcelBitacora((asesoras ?? []) as Asesora[], marcasPorAsesora);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Bitacora ${mes}.xlsx"`,
    },
  });
}
