import { createClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient> | null = null;

// Cliente de navegador: solo usa la anon key (lectura publica limitada por RLS).
export function supabaseBrowser() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltan variables de entorno de Supabase (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)."
    );
  }

  client = createClient(url, key);
  return client;
}
