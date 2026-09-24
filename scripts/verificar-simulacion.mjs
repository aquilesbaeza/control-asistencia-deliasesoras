// Compara los Excel generados de la simulacion contra lo que DEBIA salir segun los escenarios sembrados.
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";

const { hoy, esperado } = JSON.parse(readFileSync("simulacion/esperado.json", "utf8"));
console.log("Simulacion sembrada con hoy =", hoy);

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile("simulacion/Asistencia Setiembre 2026.xlsx");
const hoja = wb.getWorksheet("Setiembre 2026");
if (!hoja) throw new Error("No existe la hoja Setiembre 2026");

console.log("== EXCEL DE ASISTENCIA ==");
const letras = [];
for (let d = 1; d <= 31; d++) letras.push(String(hoja.getRow(3).getCell(3 + d).value ?? "-"));
console.log("Fila de letras de dias (1..31):", letras.join(""), "(el 1/sep/2026 es martes -> debe empezar con K)");
console.log("Dia 31 (no existe en setiembre) vacio:", hoja.getRow(2).getCell(34).value === null);

let filas = 0, celdas = 0, difs = 0;
const ultimaFilaDatos = hoja.rowCount;
const cuenta = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, vacio: 0 };
const ejemplos = [];
for (let r = 4; r <= ultimaFilaDatos; r++) {
  const nombre = hoja.getRow(r).getCell(3).value;
  if (!nombre) continue;
  filas++;
  const esp = esperado[nombre];
  if (!esp) { console.log("Fila sin escenario:", nombre); continue; }
  for (let dia = 1; dia <= 30; dia++) {
    const v = hoja.getRow(r).getCell(3 + dia).value;
    const real = v === null || v === undefined || v === "" ? null : Number(v);
    const debia = esp[dia] ?? null;
    celdas++;
    cuenta[real ?? "vacio"]++;
    if (real !== debia) { difs++; if (ejemplos.length < 8) ejemplos.push(`${nombre} dia ${dia}: salio ${real} y debia ${debia}`); }
  }
}
console.log(`Asesoras en el Excel: ${filas} | celdas comparadas: ${celdas} | diferencias: ${difs}`);
console.log("Codigos en el Excel -> 1 Asistencia:", cuenta[1], "| 2 Ausencia:", cuenta[2], "| 3 Incapacidad:", cuenta[3], "| 4 Libre:", cuenta[4], "| 5 Vacaciones:", cuenta[5], "| en blanco:", cuenta.vacio);
ejemplos.forEach((e) => console.log("  DIF:", e));

let comentarios = 0;
const ultimaFila = hoja.rowCount; // se fija antes: getRow() crea filas y haria crecer el limite
for (let r = 3; r <= ultimaFila; r++) if (hoja.getRow(r).getCell(41).value) comentarios++;
console.log("Comentarios escritos fuera de la cuadricula (col AO):", comentarios);

console.log("\n== EXCEL DE BITACORA ==");
const wb2 = new ExcelJS.Workbook();
await wb2.xlsx.readFile("simulacion/Bitacora 2026-09.xlsx");
console.log("Hojas:", wb2.worksheets.map((w) => w.name).join(", "));
const b = wb2.worksheets[0];
let dias = 0, conComentario = 0;
const tipos = {};
for (let r = 2; r <= b.rowCount; r++) {
  if (!b.getRow(r).getCell(1).value) continue;
  dias++;
  const c = String(b.getRow(r).getCell(7).value ?? "");
  if (c) { conComentario++; for (const parte of c.split(" / ")) { const k = parte.replace(/\(.*\)/, "").replace(/\d+/g, "N").trim(); tipos[k] = (tipos[k] ?? 0) + 1; } }
}
console.log(`Filas (dia con marcas): ${dias} | con comentario: ${conComentario}`);
console.log("Tipos de comentario:", JSON.stringify(tipos));
const muestra = [];
for (let r = 2; r <= b.rowCount && muestra.length < 4; r++) if (b.getRow(r).getCell(7).value) muestra.push(["punto", "nombre", "fecha", "entrada", "salida", "horas", "comentario"].map((_, i) => b.getRow(r).getCell(i + 1).value).join(" | "));
muestra.forEach((m) => console.log("  ", m));
const hc = wb2.getWorksheet("Comentarios");
console.log("Filas en hoja Comentarios:", hc ? hc.rowCount - 1 : "no existe");
