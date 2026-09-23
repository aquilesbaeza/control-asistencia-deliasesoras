// Importa el catalogo de PUNTO + NOMBRE desde el Excel original a Supabase.
// Se corre UNA SOLA VEZ (o cuando se quiera resembrar) con: npm run importar-catalogo
import { config } from "dotenv";
config({ path: ".env.local" });
import ExcelJS from "exceljs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local antes de correr este script."
    );
  }
  const supabase = createClient(url, key);

  const archivo = path.join(process.cwd(), "data", "plantilla-asistencia.xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(archivo);

  const vistos = new Map<string, { nombre: string; punto: string }>();

  for (const hoja of workbook.worksheets) {
    if (hoja.getCell("B2").value !== "PUNTO") continue;

    for (let r = 4; r <= hoja.rowCount; r++) {
      const fila = hoja.getRow(r);
      const punto = String(fila.getCell(2).value ?? "").trim();
      const nombre = String(fila.getCell(3).value ?? "").trim();
      if (!nombre || !punto) continue;

      const clave = nombre.toLowerCase();
      if (!vistos.has(clave)) {
        vistos.set(clave, { nombre, punto });
      }
    }
  }

  const registros = [...vistos.values()];
  console.log(`Encontradas ${registros.length} asesoras unicas en el Excel.`);

  const { data: existentes } = await supabase.from("asesoras").select("nombre");
  const nombresExistentes = new Set((existentes ?? []).map((a) => a.nombre.toLowerCase()));

  const nuevas = registros.filter((r) => !nombresExistentes.has(r.nombre.toLowerCase()));

  if (nuevas.length === 0) {
    console.log("No hay asesoras nuevas por insertar (el catalogo ya estaba cargado).");
    return;
  }

  const { error } = await supabase.from("asesoras").insert(nuevas);
  if (error) throw error;

  console.log(`Insertadas ${nuevas.length} asesoras nuevas.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
