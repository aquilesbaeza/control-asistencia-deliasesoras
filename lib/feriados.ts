import type { SupabaseClient } from "@supabase/supabase-js";
import { rangoMes } from "./asistencia";

/**
 * Un mes esta "confirmado" cuando Nuria ya indico sus feriados: ya sea que
 * agrego al menos uno, o que marco explicitamente que no hay ninguno.
 * Mientras no lo confirme, no se reportan ausencias de ese mes.
 */
export async function mesConfirmado(supabase: SupabaseClient, mes: string): Promise<boolean> {
  const { desde, hasta } = rangoMes(mes);
  const { count } = await supabase
    .from("feriados")
    .select("id", { count: "exact", head: true })
    .gte("fecha", desde)
    .lt("fecha", hasta);
  if (count && count > 0) return true;

  const { data, error } = await supabase.from("feriados_confirmados").select("mes").eq("mes", mes).maybeSingle();
  if (error) return false; // tabla aun sin crear: se trata como no confirmado
  return !!data;
}

/** Devuelve el mensaje de error si no se pudo guardar (ej. tabla sin crear), o null si salio bien. */
export async function confirmarMes(supabase: SupabaseClient, mes: string): Promise<string | null> {
  const { error } = await supabase.from("feriados_confirmados").upsert({ mes }, { onConflict: "mes" });
  return error?.message ?? null;
}
