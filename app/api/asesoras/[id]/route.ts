import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ahoraCR } from "@/lib/tiempo";

// Editar nombre, mover de punto, cambiar horario de entrada o reactivar.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const cambios: Record<string, unknown> = {};

  if (typeof body.nombre === "string") cambios.nombre = body.nombre.trim();
  if (typeof body.punto === "string") cambios.punto = body.punto.trim();
  if (typeof body.activo === "boolean") cambios.activo = body.activo;
  if (body.hora_entrada === null || typeof body.hora_entrada === "string") {
    cambios.hora_entrada = body.hora_entrada || null;
  }
  if (body.fecha_ingreso === null || typeof body.fecha_ingreso === "string") {
    cambios.fecha_ingreso = body.fecha_ingreso || null;
  }
  // Reactivar a alguien limpia su fecha de baja.
  if (body.activo === true) cambios.fecha_baja = null;

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  let { data, error } = await supabase.from("asesoras").update(cambios).eq("id", id).select().single();

  // Si aun falta la columna de fechas en la base, reintenta sin ellas (solo cuando el cambio no las necesita).
  if (error && error.message.includes("fecha_") && body.fecha_ingreso === undefined) {
    const { fecha_baja: _b, ...sinFechas } = cambios;
    void _b;
    if (Object.keys(sinFechas).length > 0) {
      ({ data, error } = await supabase.from("asesoras").update(sinFechas).eq("id", id).select().single());
    }
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asesora: data });
}

// "Quitar": si no tiene historial se borra; si ya tiene marcas o dias registrados
// se oculta (activo=false) para conservar los reportes de meses anteriores.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = supabaseAdmin();

  const [{ count: marcas }, { count: dias }] = await Promise.all([
    supabase.from("marcas").select("id", { count: "exact", head: true }).eq("asesora_id", id),
    supabase.from("dias_especiales").select("id", { count: "exact", head: true }).eq("asesora_id", id),
  ]);

  if ((marcas ?? 0) > 0 || (dias ?? 0) > 0) {
    // Se conserva el historial y se anota el ultimo dia laborado para que los dias siguientes no cuenten como ausencia.
    let { error } = await supabase.from("asesoras").update({ activo: false, fecha_baja: ahoraCR().fecha }).eq("id", id);
    if (error && error.message.includes("fecha_baja")) {
      ({ error } = await supabase.from("asesoras").update({ activo: false }).eq("id", id));
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, conservaHistorial: true });
  }

  const { error } = await supabase.from("asesoras").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, conservaHistorial: false });
}
