import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Editar nombre, reubicar de punto, o activar/desactivar (baja logica).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const cambios: Record<string, unknown> = {};

  if (typeof body.nombre === "string") cambios.nombre = body.nombre.trim();
  if (typeof body.punto === "string") cambios.punto = body.punto.trim();
  if (typeof body.activo === "boolean") cambios.activo = body.activo;

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("asesoras")
    .update(cambios)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asesora: data });
}

// Eliminar por completo (solo si no tiene marcas asociadas; si las tiene, usar PATCH activo:false).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseAdmin();

  const { count } = await supabase
    .from("marcas")
    .select("id", { count: "exact", head: true })
    .eq("asesora_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: "Esta asesora ya tiene marcas registradas. Desactivala en vez de eliminarla." },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("asesoras").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
