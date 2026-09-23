import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { detectarAnomaliaInmediata } from "@/lib/asistencia";
import type { Marca } from "@/lib/tipos";

type ItemLote = {
  asesora_id: string;
  fecha: string;
  hora: string;
  tipo: "entrada" | "salida";
  foto_base64?: string;
};

// Guarda muchas marcas de una sola vez (Nuria arrastra todas las fotos del
// WhatsApp del dia y las suelta juntas).
export async function POST(req: NextRequest) {
  const body = await req.json();
  const items = (body?.items ?? []) as ItemLote[];
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "No hay marcas en el lote" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const filas = await Promise.all(
    items.map(async (item) => {
      let foto_url: string | null = null;
      if (item.foto_base64) {
        const nombreArchivo = `${item.asesora_id}/${item.fecha}-${item.hora.replace(/:/g, "")}-${item.tipo}.jpg`;
        const { data: subida } = await supabase.storage
          .from("marcas-fotos")
          .upload(nombreArchivo, Buffer.from(item.foto_base64, "base64"), {
            contentType: "image/jpeg",
            upsert: true,
          });
        if (subida) foto_url = supabase.storage.from("marcas-fotos").getPublicUrl(subida.path).data.publicUrl;
      }
      return {
        asesora_id: item.asesora_id,
        fecha: item.fecha,
        hora: item.hora,
        tipo: item.tipo,
        foto_url,
        origen: "ocr" as const,
      };
    })
  );

  const { data: guardadas, error } = await supabase.from("marcas").insert(filas).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Revisa anomalias inmediatas por cada asesora/fecha unica del lote.
  const claves = new Set(filas.map((f) => `${f.asesora_id}|${f.fecha}`));
  const anomalias: { asesora_id: string; nombre: string; mensaje: string }[] = [];

  for (const clave of claves) {
    const [asesora_id, fecha] = clave.split("|");
    const [{ data: marcasDelDia }, { data: asesora }] = await Promise.all([
      supabase.from("marcas").select("*").eq("asesora_id", asesora_id).eq("fecha", fecha),
      supabase.from("asesoras").select("nombre").eq("id", asesora_id).single(),
    ]);
    const anomalia = detectarAnomaliaInmediata((marcasDelDia ?? []) as Marca[], asesora?.nombre ?? "Una asesora");
    if (anomalia) anomalias.push({ asesora_id, nombre: asesora?.nombre ?? "", mensaje: anomalia.mensaje });
  }

  return NextResponse.json({ guardadas: guardadas?.length ?? 0, anomalias });
}
