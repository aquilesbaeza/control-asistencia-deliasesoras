import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { detectarAnomaliaInmediata, rangoMes } from "@/lib/asistencia";
import { paginar } from "@/lib/paginar";
import type { Marca } from "@/lib/tipos";

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get("mes"); // YYYY-MM
  const supabase = supabaseAdmin();

  const rango = mes ? rangoMes(mes) : null;
  const { data, error } = await paginar<Marca>((desde, hasta) => {
    let query = supabase.from("marcas").select("*").order("fecha").order("hora").order("id");
    if (rango) query = query.gte("fecha", rango.desde).lt("fecha", rango.hasta);
    return query.range(desde, hasta);
  });
  if (error) return NextResponse.json({ error }, { status: 500 });
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

  // Si ya existe una marca igual (misma asesora, dia, tipo y hora), no se duplica.
  const { data: existentes } = await supabase
    .from("marcas")
    .select("id, hora")
    .eq("asesora_id", asesora_id)
    .eq("fecha", fecha)
    .eq("tipo", tipo);
  if ((existentes ?? []).some((m) => m.hora.slice(0, 5) === hora.slice(0, 5))) {
    return NextResponse.json({ marca: null, omitida: true, anomalia: null });
  }

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
    asesora?.nombre ?? "La asesora",
    fecha
  );

  return NextResponse.json({ marca, anomalia });
}
