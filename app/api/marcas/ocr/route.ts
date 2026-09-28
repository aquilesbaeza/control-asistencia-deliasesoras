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

    // La fecha y la hora SOLO pueden venir de lo leido en la foto: nunca se rellenan con la
    // hora del servidor al subirla, porque eso inventaria un dato falso si la foto no sirve.
    // Si no se leyo NADA (ni nombre, ni fecha, ni hora), la foto no muestra gafete ni reloj: se rebota.
    const rechazada = !lectura.nombre_detectado && !lectura.fecha_detectada && !lectura.hora_detectada;

    return NextResponse.json({
      lectura,
      candidatos,
      sugerencia_fecha: lectura.fecha_detectada,
      sugerencia_hora: lectura.hora_detectada,
      fecha_leida: !!lectura.fecha_detectada,
      hora_leida: !!lectura.hora_detectada,
      rechazada,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error leyendo la foto" },
      { status: 500 }
    );
  }
}
