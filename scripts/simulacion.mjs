// Simulacion de un mes FICTICIO completo (setiembre 2026, el mes actual) con las asesoras reales,
// para evaluar Hoy, Calendario y los dos Excel con escenarios variados.
//   node scripts/simulacion.mjs sembrar   -> carga los datos ficticios (y anota los ids en simulacion/ids.json)
//   node scripts/simulacion.mjs limpiar   -> borra SOLO lo que sembro (no toca datos reales agregados despues)
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const MES = "2026-09";
const DIAS = 30;
const RUTA_IDS = "simulacion/ids.json";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Fecha y hora "hoy" en Costa Rica.
const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
const HOY = `${partes.find((p) => p.type === "year").value}-${partes.find((p) => p.type === "month").value}-${partes.find((p) => p.type === "day").value}`;
const DIA_HOY = HOY.startsWith(MES) ? Number(HOY.slice(8)) : DIAS + 1;

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

async function insertar(tabla, filas, ids) {
  for (let i = 0; i < filas.length; i += 400) {
    const { data, error } = await supabase.from(tabla).insert(filas.slice(i, i + 400)).select("id");
    if (error && error.message.includes("schema cache")) {
      console.log(`AVISO: la tabla ${tabla} aun no existe en Supabase (falta correr el SQL de migracion); se omite.`);
      return;
    }
    if (error) throw new Error(`${tabla}: ${error.message}`);
    (ids[tabla] ??= []).push(...data.map((d) => d.id));
  }
}

async function limpiar() {
  if (!existsSync(RUTA_IDS)) { console.log("No hay simulacion sembrada (falta simulacion/ids.json)."); return; }
  const ids = JSON.parse(readFileSync(RUTA_IDS, "utf8"));
  for (const [tabla, lista] of Object.entries(ids)) {
    for (let i = 0; i < lista.length; i += 150) {
      const { error } = await supabase.from(tabla).delete().in("id", lista.slice(i, i + 150));
      if (error && !error.message.includes("schema cache")) throw new Error(`${tabla}: ${error.message}`);
    }
    console.log(`  ${tabla}: ${lista.length} filas borradas`);
  }
  rmSync(RUTA_IDS);
  console.log("Simulación eliminada. Los datos reales no se tocaron.");
}

async function sembrar() {
  if (existsSync(RUTA_IDS)) { console.log("Ya habia una simulacion sembrada; se limpia primero."); await limpiar(); }

  const { data: asesoras, error } = await supabase
    .from("asesoras").select("id,nombre,punto").eq("activo", true).order("punto").order("nombre");
  if (error) throw error;

  const azar = rng(2026);
  const marcas = [], especiales = [], comentarios = [];
  const esperado = {}; // nombre -> { dia: codigo | null }
  const c = { completos: 0, tardes: 0, cortas: 0, sinSalida: 0, sinEntrada: 0, ausencias: 0, libres: 0, vacaciones: 0, incapacidades: 0, feriadoTrabajado: 0, marcasEnLibre: 0, entradaDoble: 0, antesDeIngreso: 0 };

  const FERIADO = 15;
  const trabajanFeriado = new Set([1, 6, 13, 22]);
  const idxDe = (texto) => asesoras.findIndex((a) => a.nombre.includes(texto));
  const nuevos = { [idxDe("EVANY MICHELLE")]: 16, [idxDe("MARIA FERNANDA CAMPOS")]: 11 }; // ingresos reales del mes
  const vacaciones = { 2: [7, 13], 9: [1, 6], 15: [16, 27] };
  const incapacidades = { 4: [[3, 5]], 11: [[14, 14], [21, 23]], 20: [[9, 10]], 7: [[24, 30]] };
  for (const i of Object.keys(nuevos)) { delete vacaciones[i]; delete incapacidades[i]; }
  const forzados = { 0: { 2: "sinSalida", 3: "sinEntrada", 4: "corta", 8: "tarde", 9: "ausencia" } };
  const idxMarcaEnLibre = 5;

  asesoras.forEach((a, i) => {
    esperado[a.nombre] = {};
    const libreDow = i % 7;
    const ingreso = nuevos[i] ?? 1;
    let primeraLibre = null;

    for (let dia = 1; dia <= DIAS; dia++) {
      const fecha = fechaDe(dia);
      const enVac = vacaciones[i] && dia >= vacaciones[i][0] && dia <= vacaciones[i][1];
      const enInc = (incapacidades[i] ?? []).some(([d1, d2]) => dia >= d1 && dia <= d2);
      const esLibre = !enVac && !enInc && dow(dia) === libreDow && dia >= ingreso;

      if (dia < ingreso) { esperado[a.nombre][dia] = null; c.antesDeIngreso++; continue; }
      if (enVac) { especiales.push({ asesora_id: a.id, fecha, tipo: "vacaciones", nota: "vacaciones programadas (simulacion)" }); esperado[a.nombre][dia] = 5; c.vacaciones++; continue; }
      if (enInc) { especiales.push({ asesora_id: a.id, fecha, tipo: "incapacidad", nota: "incapacidad de la CCSS (simulacion)" }); esperado[a.nombre][dia] = 3; c.incapacidades++; continue; }
      if (esLibre) {
        especiales.push({ asesora_id: a.id, fecha, tipo: "libre", nota: null });
        esperado[a.nombre][dia] = 4; c.libres++;
        if (i === idxMarcaEnLibre && primeraLibre === null && dia < DIA_HOY) { // marco pese a estar libre
          primeraLibre = dia;
          marcas.push({ asesora_id: a.id, fecha, hora: hhmm(485), tipo: "entrada", origen: "ocr" });
          marcas.push({ asesora_id: a.id, fecha, hora: hhmm(1025), tipo: "salida", origen: "ocr" });
          c.marcasEnLibre++;
        }
        continue;
      }

      if (dia > DIA_HOY) { esperado[a.nombre][dia] = null; continue; } // dias futuros: sin datos

      if (dia === FERIADO) {
        if (trabajanFeriado.has(i)) {
          marcas.push({ asesora_id: a.id, fecha, hora: hhmm(480), tipo: "entrada", origen: "ocr" });
          marcas.push({ asesora_id: a.id, fecha, hora: hhmm(1020), tipo: "salida", origen: "ocr" });
          esperado[a.nombre][dia] = 1; c.feriadoTrabajado++;
        } else esperado[a.nombre][dia] = null;
        continue;
      }

      let escenario = forzados[i]?.[dia];
      if (!escenario) {
        const r = azar();
        escenario = r < 0.03 ? "ausencia" : r < 0.05 ? "sinEntrada" : r < 0.08 ? "sinSalida" : r < 0.13 ? "corta" : r < 0.21 ? "tarde" : "normal";
      }
      const entradaMin = escenario === "tarde" ? 495 + Math.floor(azar() * 40) : 472 + Math.floor(azar() * 14);
      let salidaMin = entradaMin + 540 + Math.floor(azar() * 12);
      if (escenario === "corta") salidaMin = entradaMin + 450;

      if (escenario === "ausencia") { esperado[a.nombre][dia] = dia >= DIA_HOY ? null : 2; if (dia < DIA_HOY) c.ausencias++; continue; }
      if (escenario === "sinSalida") { marcas.push({ asesora_id: a.id, fecha, hora: hhmm(entradaMin), tipo: "entrada", origen: "ocr" }); esperado[a.nombre][dia] = 1; c.sinSalida++; continue; }
      if (escenario === "sinEntrada") { marcas.push({ asesora_id: a.id, fecha, hora: hhmm(salidaMin), tipo: "salida", origen: "ocr" }); esperado[a.nombre][dia] = 1; c.sinEntrada++; continue; }

      marcas.push({ asesora_id: a.id, fecha, hora: hhmm(entradaMin), tipo: "entrada", origen: "ocr" });
      marcas.push({ asesora_id: a.id, fecha, hora: hhmm(salidaMin), tipo: "salida", origen: "ocr" });
      if (i === 3 && dia === 10) { marcas.push({ asesora_id: a.id, fecha, hora: hhmm(entradaMin + 4), tipo: "entrada", origen: "ocr" }); c.entradaDoble++; }
      esperado[a.nombre][dia] = 1;
      if (escenario === "tarde") c.tardes++; else if (escenario === "corta") c.cortas++; else c.completos++;
    }
  });

  // Permisos con dias posteriores a hoy: en el Excel salen igual (Nuria los anticipa).
  const idDe = (i) => asesoras[i]?.id ?? null;
  comentarios.push(
    { fecha: fechaDe(1), asunto: "Vacaciones", asesora_id: idDe(9), situacion: "del 1 al 6 (simulacion)" },
    { fecha: fechaDe(3), asunto: "Incapacidad", asesora_id: idDe(4), situacion: "del 3 al 5 · cita médica (simulacion)" },
    { fecha: fechaDe(7), asunto: "Vacaciones", asesora_id: idDe(2), situacion: "del 7 al 13 (simulacion)" },
    { fecha: fechaDe(9), asunto: "Incapacidad", asesora_id: idDe(20), situacion: "del 9 al 10 (simulacion)" },
    { fecha: fechaDe(11), asunto: "Nuevo ingreso", asesora_id: idxDe("MARIA FERNANDA CAMPOS") >= 0 ? idDe(idxDe("MARIA FERNANDA CAMPOS")) : null, situacion: "primer día de trabajo" },
    { fecha: fechaDe(14), asunto: "Incapacidad", asesora_id: idDe(11), situacion: "1 día (simulacion)" },
    ...[1, 6, 13, 22].map((i) => ({ fecha: fechaDe(15), asunto: "Feriado trabajado", asesora_id: idDe(i), situacion: "paga doble (simulacion)" })),
    { fecha: fechaDe(16), asunto: "Nuevo ingreso", asesora_id: idxDe("EVANY MICHELLE") >= 0 ? idDe(idxDe("EVANY MICHELLE")) : null, situacion: "primer día de trabajo" },
    { fecha: fechaDe(16), asunto: "Vacaciones", asesora_id: idDe(15), situacion: "del 16 al 27 (simulacion)" },
    { fecha: fechaDe(21), asunto: "Incapacidad", asesora_id: idDe(11), situacion: "del 21 al 23 (simulacion)" },
    { fecha: fechaDe(Math.min(22, DIA_HOY)), asunto: "Otro", asesora_id: null, situacion: "Visita de supervisión a varios puntos (simulacion)" },
  );

  mkdirSync("simulacion", { recursive: true });
  const ids = {};
  await insertar("marcas", marcas, ids);
  await insertar("dias_especiales", especiales, ids);
  await insertar("comentarios", comentarios, ids);
  // Feriado real de Costa Rica (15 de setiembre): solo se agrega si no existia.
  const { data: yaFeriado } = await supabase.from("feriados").select("id").eq("fecha", fechaDe(FERIADO)).maybeSingle();
  if (!yaFeriado) await insertar("feriados", [{ fecha: fechaDe(FERIADO), descripcion: "Día de la Independencia (simulacion)" }], ids);
  writeFileSync(RUTA_IDS, JSON.stringify(ids));
  writeFileSync("simulacion/esperado.json", JSON.stringify({ hoy: HOY, esperado }));

  console.log(`Sembrado ${MES} (hoy = ${HOY}): ${asesoras.length} asesoras, ${marcas.length} marcas, ${especiales.length} permisos, ${comentarios.length} comentarios.`);
  console.log("Escenarios:", JSON.stringify(c));
}

const accion = process.argv[2];
if (accion === "sembrar") await sembrar();
else if (accion === "limpiar") await limpiar();
else console.log("Uso: node scripts/simulacion.mjs sembrar | limpiar");
