// Simulacion de un mes FICTICIO completo (noviembre 2025) para evaluar el calendario
// y los Excel con escenarios variados.
//   node scripts/simulacion.mjs sembrar   -> carga los datos ficticios en la base
//   node scripts/simulacion.mjs limpiar   -> borra TODO lo de ese mes (marcas, permisos, feriados, comentarios)
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";

const MES = "2025-11";
const DIAS = 30;
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function rng(semilla) {
  let a = semilla;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const fechaDe = (dia) => `${MES}-${String(dia).padStart(2, "0")}`;
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}:00`;
const dow = (dia) => new Date(`${fechaDe(dia)}T12:00:00`).getDay(); // 0 = domingo

async function borrarMes() {
  const desde = `${MES}-01`;
  const hasta = "2025-12-01";
  for (const tabla of ["marcas", "dias_especiales", "feriados", "comentarios"]) {
    const { error } = await supabase.from(tabla).delete().gte("fecha", desde).lt("fecha", hasta);
    if (error && !error.message.includes("schema cache")) throw new Error(`${tabla}: ${error.message}`);
  }
  const { error } = await supabase.from("feriados_confirmados").delete().eq("mes", MES);
  if (error && !error.message.includes("schema cache")) throw new Error(`feriados_confirmados: ${error.message}`);
}

async function insertarPorLotes(tabla, filas) {
  for (let i = 0; i < filas.length; i += 400) {
    const { error } = await supabase.from(tabla).insert(filas.slice(i, i + 400));
    if (error && error.message.includes("schema cache")) {
      console.log(`AVISO: la tabla ${tabla} aun no existe en Supabase (falta la migracion v3); se omite.`);
      return;
    }
    if (error) throw new Error(`${tabla}: ${error.message}`);
  }
}

async function sembrar() {
  const { data: asesoras, error } = await supabase
    .from("asesoras").select("id,nombre,punto").eq("activo", true).order("punto").order("nombre");
  if (error) throw error;

  await borrarMes();
  const azar = rng(2025);
  const marcas = [];
  const especiales = [];
  const comentarios = [];
  const esperado = {}; // nombre -> { dia: codigo }
  const conteo = { completos: 0, tardes: 0, cortas: 0, sinSalida: 0, sinEntrada: 0, ausencias: 0, libres: 0, vacaciones: 0, incapacidades: 0, feriadoTrabajado: 0, feriadoLibre: 0, entradaDoble: 0 };

  const FERIADO = 20;
  const trabajanFeriado = new Set([1, 6, 13, 22]);
  const vacaciones = { 2: [10, 16], 9: [3, 9], 15: [24, 30] };
  const incapacidades = { 4: [5, 7], 11: [18, 19], 20: [12, 12] };
  const forzados = { // escenarios garantizados para la asesora 0
    0: { 3: "sinSalida", 4: "sinEntrada", 5: "corta", 6: "tarde", 7: "ausencia" },
  };

  asesoras.forEach((a, i) => {
    esperado[a.nombre] = {};
    const libreDow = i % 7;
    for (let dia = 1; dia <= DIAS; dia++) {
      const fecha = fechaDe(dia);
      const enVac = vacaciones[i] && dia >= vacaciones[i][0] && dia <= vacaciones[i][1];
      const enInc = incapacidades[i] && dia >= incapacidades[i][0] && dia <= incapacidades[i][1];

      if (enVac) { especiales.push({ asesora_id: a.id, fecha, tipo: "vacaciones", nota: "simulacion" }); esperado[a.nombre][dia] = 5; conteo.vacaciones++; continue; }
      if (enInc) { especiales.push({ asesora_id: a.id, fecha, tipo: "incapacidad", nota: "simulacion" }); esperado[a.nombre][dia] = 3; conteo.incapacidades++; continue; }
      if (dow(dia) === libreDow) { especiales.push({ asesora_id: a.id, fecha, tipo: "libre", nota: null }); esperado[a.nombre][dia] = 4; conteo.libres++; continue; }

      if (dia === FERIADO) {
        if (trabajanFeriado.has(i)) {
          marcas.push({ asesora_id: a.id, fecha, hora: hhmm(480), tipo: "entrada", origen: "ocr" });
          marcas.push({ asesora_id: a.id, fecha, hora: hhmm(1020), tipo: "salida", origen: "ocr" });
          esperado[a.nombre][dia] = 1; conteo.feriadoTrabajado++;
        } else { conteo.feriadoLibre++; }
        continue; // sin marcas en feriado: queda en blanco (opcional)
      }

      let escenario = forzados[i]?.[dia];
      if (!escenario) {
        const r = azar();
        escenario = r < 0.04 ? "ausencia" : r < 0.06 ? "sinEntrada" : r < 0.09 ? "sinSalida" : r < 0.14 ? "corta" : r < 0.22 ? "tarde" : "normal";
      }

      const entradaMin = escenario === "tarde" ? 495 + Math.floor(azar() * 40) : 472 + Math.floor(azar() * 14); // 07:52-08:05 normal
      let salidaMin = entradaMin + 540 + Math.floor(azar() * 12);
      if (escenario === "corta") salidaMin = entradaMin + 450;

      if (escenario === "ausencia") { esperado[a.nombre][dia] = 2; conteo.ausencias++; continue; }
      if (escenario === "sinSalida") { marcas.push({ asesora_id: a.id, fecha, hora: hhmm(entradaMin), tipo: "entrada", origen: "ocr" }); conteo.sinSalida++; continue; }
      if (escenario === "sinEntrada") { marcas.push({ asesora_id: a.id, fecha, hora: hhmm(salidaMin), tipo: "salida", origen: "ocr" }); conteo.sinEntrada++; continue; }

      marcas.push({ asesora_id: a.id, fecha, hora: hhmm(entradaMin), tipo: "entrada", origen: "ocr" });
      marcas.push({ asesora_id: a.id, fecha, hora: hhmm(salidaMin), tipo: "salida", origen: "ocr" });
      if (i === 3 && dia === 11) { // dos fotos de entrada el mismo dia: vale la mas temprana
        marcas.push({ asesora_id: a.id, fecha, hora: hhmm(entradaMin + 4), tipo: "entrada", origen: "ocr" });
        conteo.entradaDoble++;
      }
      esperado[a.nombre][dia] = 1;
      if (escenario === "tarde") conteo.tardes++;
      else if (escenario === "corta") conteo.cortas++;
      else conteo.completos++;
    }
  });

  const idDe = (i) => asesoras[i]?.id ?? null;
  comentarios.push(
    { fecha: fechaDe(3), asunto: "Vacaciones", asesora_id: idDe(9), situacion: "del 3 al 9 · simulacion" },
    { fecha: fechaDe(5), asunto: "Incapacidad", asesora_id: idDe(4), situacion: "del 5 al 7 · cita médica (simulacion)" },
    { fecha: fechaDe(8), asunto: "Otro", asesora_id: null, situacion: "Visita de supervisión a varios puntos (simulacion)" },
    { fecha: fechaDe(10), asunto: "Vacaciones", asesora_id: idDe(2), situacion: "del 10 al 16 · simulacion" },
    { fecha: fechaDe(12), asunto: "Incapacidad", asesora_id: idDe(20), situacion: "1 día · simulacion" },
    { fecha: fechaDe(18), asunto: "Incapacidad", asesora_id: idDe(11), situacion: "del 18 al 19 · simulacion" },
    ...[1, 6, 13, 22].map((i) => ({ fecha: fechaDe(20), asunto: "Feriado trabajado", asesora_id: idDe(i), situacion: "paga doble (simulacion)" })),
    { fecha: fechaDe(24), asunto: "Vacaciones", asesora_id: idDe(15), situacion: "del 24 al 30 · simulacion" },
  );

  await insertarPorLotes("marcas", marcas);
  await insertarPorLotes("dias_especiales", especiales);
  await insertarPorLotes("comentarios", comentarios.filter((c) => c.asesora_id !== undefined));
  await insertarPorLotes("feriados", [{ fecha: fechaDe(FERIADO), descripcion: "Feriado de prueba (simulacion)" }]);
  await insertarPorLotes("feriados_confirmados", [{ mes: MES }]);

  mkdirSync("simulacion", { recursive: true });
  writeFileSync("simulacion/esperado.json", JSON.stringify(esperado));
  console.log(`Sembrado ${MES}: ${asesoras.length} asesoras, ${marcas.length} marcas, ${especiales.length} permisos, ${comentarios.length} comentarios.`);
  console.log("Escenarios:", JSON.stringify(conteo));
}

const accion = process.argv[2];
if (accion === "sembrar") await sembrar();
else if (accion === "limpiar") { await borrarMes(); console.log(`Simulación ${MES} eliminada por completo.`); }
else console.log("Uso: node scripts/simulacion.mjs sembrar | limpiar");
