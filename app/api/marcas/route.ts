import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { detectarAnomaliaInmediata, rangoMes } from "@/lib/asistencia";
import type { Marca } from "@/lib/tipos";

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes"); // YYYY-MM
  const supabase = supabaseAdmin();

  let query = supabase.from("marcas").select("*").order("fecha").order("hora");
  if (mes) {
    const { desde, hasta } = rangoMes(mes);
    query = query.gte("fecha", desde).lt("fecha", hasta);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ marcas: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { asesora_id, fecha, hora, tipo, foto_base64, origen } = body as {
    asesora_id?: string;
    fecha?: string;
    hora?: string;
    tipo?: "entrada" | "salida";
    foto_base64?: string;
    origen?: "ocr" | "manual";
  };

  if (!asesora_id || !fecha || !hora || !tipo) {
    return NextResponse.json({ error: "Faltan datos de la marca" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  let foto_url: string | null = null;

  if (foto_base64) {
    const nombreArchivo = `${asesora_id}/${fecha}-${hora.replace(/:/g, "")}-${tipo}.jpg`;
    const { data: subida, error: errorSubida } = await supabase.storage
      .from("marcas-fotos")
      .upload(nombreArchivo, Buffer.from(foto_base64, "base64"), {
        contentType: "image/jpeg",
        upsert: true,
      });
    if (!errorSubida && subida) {
      foto_url = supabase.storage.from("marcas-fotos").getPublicUrl(subida.path).data.publicUrl;
    }
  }

  const { data: marca, error } = await supabase
    .from("marcas")
    .insert({
      asesora_id,
      fecha,
      hora,
      tipo,
      foto_url,
      origen: origen ?? "ocr",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const [{ data: marcasDelDia }, { data: asesora }] = await Promise.all([
    supabase.from("marcas").select("*").eq("asesora_id", asesora_id).eq("fecha", fecha),
    supabase.from("asesoras").select("nombre").eq("id", asesora_id).single(),
  ]);

  const anomalia = detectarAnomaliaInmediata(
    (marcasDelDia ?? []) as Marca[],
    asesora?.nombre ?? "La asesora"
  );

  return NextResponse.json({ marca, anomalia });
}
