import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Sube la foto del comprobante de incapacidad a Supabase Storage, para poder consultarla despues.
export async function POST(req: NextRequest) {
  const { imagenBase64, mediaType, asesoraId, fecha } = (await req.json()) as {
    imagenBase64?: string;
    mediaType?: string;
    asesoraId?: string;
    fecha?: string;
  };
  if (!imagenBase64 || !mediaType || !asesoraId || !fecha) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const ext = mediaType.includes("png") ? "png" : "jpg";
  const ruta = `${asesoraId}/${fecha}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(imagenBase64, "base64");

  const { error } = await supabase.storage.from("comprobantes").upload(ruta, buffer, { contentType: mediaType, upsert: true });
  if (error) {
    if (error.message.includes("Bucket not found")) {
      return NextResponse.json({ error: "Falta crear el bucket 'comprobantes' en Supabase (correr lib/migracion-v5.sql)." }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = supabase.storage.from("comprobantes").getPublicUrl(ruta);
  return NextResponse.json({ url: data.publicUrl });
}
