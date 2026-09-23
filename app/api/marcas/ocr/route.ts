import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { emparejarNombre, leerFotoMarca } from "@/lib/ocrMarca";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { imagenBase64, mediaType } = body as { imagenBase64?: string; mediaType?: string };

  if (!imagenBase64 || !mediaType) {
    return NextResponse.json({ error: "Falta la imagen" }, { status: 400 });
  }

  try {
    const lectura = await leerFotoMarca(imagenBase64, mediaType);

    const supabase = supabaseAdmin();
    const { data: asesoras, error } = await supabase
      .from("asesoras")
      .select("id, nombre, punto")
      .eq("activo", true);
    if (error) throw error;

    const candidatos = emparejarNombre(lectura.nombre_detectado, asesoras ?? []);

    const ahora = new Date();
    return NextResponse.json({
      lectura,
      candidatos,
      sugerencia_fecha: lectura.fecha_detectada ?? ahora.toISOString().slice(0, 10),
      sugerencia_hora: lectura.hora_detectada ?? ahora.toTimeString().slice(0, 5),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error leyendo la foto" },
      { status: 500 }
    );
  }
}
