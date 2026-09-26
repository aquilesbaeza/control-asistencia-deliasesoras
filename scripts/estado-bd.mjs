import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

for (const tabla of ["asesoras", "marcas", "dias_especiales", "feriados", "feriados_confirmados", "comentarios"]) {
  const { error } = await supabase.from(tabla).select("*").limit(1);
  console.log(`tabla ${tabla}:`, error ? `FALTA (${error.message})` : "ok");
}
const { error: eCol } = await supabase.from("asesoras").select("hora_entrada").limit(1);
console.log("columna asesoras.hora_entrada:", eCol ? "FALTA" : "ok");
const { error: eComp } = await supabase.from("dias_especiales").select("comprobante_url").limit(1);
console.log("columna dias_especiales.comprobante_url:", eComp ? "FALTA" : "ok");
