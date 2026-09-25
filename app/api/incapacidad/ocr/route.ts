import { NextRequest, NextResponse } from "next/server";
import { leerIncapacidad } from "@/lib/ocrIncapacidad";

// Lee la foto de un comprobante de incapacidad: codigo y dias incapacitada.
export async function POST(req: NextRequest) {
  const { imagenBase64, mediaType } = (await req.json()) as { imagenBase64?: string; mediaType?: string };
  if (!imagenBase64 || !mediaType) return NextResponse.json({ error: "Falta la imagen" }, { status: 400 });
  try {
    return NextResponse.json({ lectura: await leerIncapacidad(imagenBase64, mediaType) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error leyendo el comprobante" }, { status: 500 });
  }
}
