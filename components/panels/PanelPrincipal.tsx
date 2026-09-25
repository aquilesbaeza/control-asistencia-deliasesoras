"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import PlanificarMes from "@/components/PlanificarMes";
import PreguntaFeriados from "@/components/PreguntaFeriados";
import ComentariosAsesora from "@/components/ComentariosAsesora";
import CorregirHoras from "@/components/CorregirHoras";
import { AsesorasQuitadas, FormMoverAsesora, NuevaAsesora, quitarAsesora } from "@/components/AsesoraAcciones";
import {
  calcularMesAsesora,
  rangoConsecutivo,
  resumirMes,
  type DiaCalculado,
  type EstatusDia,
  type ResumenMes,
} from "@/lib/asistencia";
import { ahoraCR, aSetiembre } from "@/lib/tiempo";
import type { Asesora, Comentario, DiaEspecial, Feriado, Marca } from "@/lib/tipos";

const ESTILO: Record<EstatusDia, { etiqueta: string; letra: string; fondo: string; texto: string }> = {
  asistencia: { etiqueta: "Asistencia", letra: "A", fondo: "#1EA6B8", texto: "#FFFFFF" },
  ausencia: { etiqueta: "Ausencia", letra: "X", fondo: "#FBE4E4", texto: "#B23A3A" },
  incapacidad: { etiqueta: "Incapacidad", letra: "I", fondo: "#CFF0F3", texto: "#0B5F6C" },
  libre: { etiqueta: "Libre", letra: "L", fondo: "#E4F7F9", texto: "#0F7A8A" },
  vacaciones: { etiqueta: "Vacaciones", letra: "V", fondo: "#0B5F6C", texto: "#FFFFFF" },
  parcial: { etiqueta: "Falta una marca", letra: "!", fondo: "#35DCEC", texto: "#0B3A41" },
  enJornada: { etiqueta: "En jornada", letra: "J", fondo: "#E4F7F9", texto: "#0B5F6C" },
  feriado: { etiqueta: "Feriado", letra: "F", fondo: "#DDE7E8", texto: "#3A3B3C" },
  pendiente: { etiqueta: "Sin datos aún", letra: "·", fondo: "#F2F8F9", texto: "#6B6D6E" },
  fuera: { etiqueta: "Aún no laboraba / ya no labora", letra: "–", fondo: "#FFFFFF", texto: "#9AA3A4" },
};

// Un color por situacion (dentro de la paleta TRIXO): punto en el calendario y resaltado al elegir un indicador.
const COLOR: Record<string, { punto: string; texto: string }> = {
  asistencia: { punto: "#1EA6B8", texto: "#FFFFFF" },
  ausencia: { punto: "#E5484D", texto: "#FFFFFF" },
  libre: { punto: "#8E9A9C", texto: "#FFFFFF" },
  vacaciones: { punto: "#0B5F6C", texto: "#FFFFFF" },
  incapacidad: { punto: "#7B61D6", texto: "#FFFFFF" },
  faltaMarca: { punto: "#F5B700", texto: "#3A2F00" },
  jornadaIncompleta: { punto: "#F0742A", texto: "#FFFFFF" },
  enJornada: { punto: "#35DCEC", texto: "#0B3A41" },
  feriado: { punto: "#57585A", texto: "#FFFFFF" },
};

/** Color del punto de un dia en el calendario (null = sin punto). */
function colorDelDia(d: DiaCalculado): { punto: string; texto: string } | null {
  switch (d.estatus) {
    case "asistencia":
      return d.horas !== null && d.horas < 8 ? COLOR.jornadaIncompleta : COLOR.asistencia;
    case "parcial":
      return COLOR.faltaMarca;
    case "pendiente":
    case "fuera":
      return null;
    default:
      return COLOR[d.estatus];
  }
}

const LEYENDA: [string, string][] = [
  ["asistencia", "Asistencia"],
  ["ausencia", "Ausencia"],
  ["libre", "Libre"],
  ["vacaciones", "Vacaciones"],
  ["incapacidad", "Incapacidad"],
  ["faltaMarca", "Falta marca"],
  ["jornadaIncompleta", "Jornada incompleta"],
  ["enJornada", "En jornada"],
  ["feriado", "Feriado"],
];

type Periodo = "dia" | "semana" | "mes";
type Kpi = "ausencia" | "faltaMarca" | "jornadaIncompleta" | "incapacidad" | "vacaciones" | "libre";
type Tono = "ok" | "warn" | "info";

const KPIS: { id: Kpi; etiqueta: string; fondo: string; texto: string; borde?: string }[] = [
  { id: "ausencia", etiqueta: "Ausencia", fondo: ESTILO.ausencia.fondo, texto: ESTILO.ausencia.texto },
  { id: "faltaMarca", etiqueta: "Falta marca", fondo: "#35DCEC", texto: "#0B3A41" },
  { id: "jornadaIncompleta", etiqueta: "Jornada incompleta", fondo: "#FFFFFF", texto: "#0B3A41", borde: "#35DCEC" },
  { id: "incapacidad", etiqueta: "Incapacidad", fondo: ESTILO.incapacidad.fondo, texto: ESTILO.incapacidad.texto },
  { id: "vacaciones", etiqueta: "Vacaciones", fondo: ESTILO.vacaciones.fondo, texto: ESTILO.vacaciones.texto },
  { id: "libre", etiqueta: "Libre", fondo: ESTILO.libre.fondo, texto: ESTILO.libre.texto },
];

function diasEnMes(mes: string): number {
  const [anio, m] = mes.split("-").map(Number);
  return new Date(anio, m, 0).getDate();
}

function sumarDias(iso: string, n: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

function lunesDe(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return sumarDias(iso, dow === 0 ? -6 : 1 - dow);
}

function tituloDia(iso: string): string {
  const t = aSetiembre(new Date(`${iso}T12:00:00`).toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "long" }));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function diaCorto(iso: string): string {
  return aSetiembre(new Date(`${iso}T12:00:00`).toLocaleDateString("es-CR", { weekday: "short", day: "numeric", month: "short" }));
}

function diaMes(iso: string): string {
  return `${Number(iso.split("-")[2])}/${Number(iso.split("-")[1])}`;
}

function rangoDePeriodo(periodo: Periodo, ref: string, mes: string, totalDias: number): { desde: string; hasta: string } {
  const primero = `${mes}-01`;
  const ultimo = `${mes}-${String(totalDias).padStart(2, "0")}`;
  if (periodo === "dia") return { desde: ref, hasta: ref };
  if (periodo === "mes") return { desde: primero, hasta: ultimo };
  const lunes = lunesDe(ref);
  const domingo = sumarDias(lunes, 6);
  return { desde: lunes < primero ? primero : lunes, hasta: domingo > ultimo ? ultimo : domingo };
}

function cumple(kpi: Kpi, d: DiaCalculado, hoy: string): boolean {
  switch (kpi) {
    case "ausencia":
      return d.estatus === "ausencia";
    case "faltaMarca":
      // Falta una de las dos marcas; hoy, ademas, quien aun no marca su entrada (unico aviso durante el dia).
      return d.estatus === "parcial" || (d.estatus === "pendiente" && d.fecha === hoy && !d.entrada && !d.salida && !d.manual);
    case "jornadaIncompleta":
      return d.estatus === "asistencia" && d.horas !== null && d.horas < 8;
    case "incapacidad":
    case "vacaciones":
    case "libre":
      return d.estatus === kpi;
  }
}

type FilaAsesora = { asesora: Asesora; dias: DiaCalculado[]; resumen: ResumenMes };
type Seleccion = { asesoraId: string; dia: number } | null;

function describirDia(d: DiaCalculado): string {
  const partes: string[] = [];
  if (d.estatus === "asistencia") {
    partes.push(`Entrada ${d.entrada} · Salida ${d.salida}`);
    if (d.horas !== null) partes.push(`${d.horas.toFixed(1)} h efectivas${d.horas < 8 ? " (jornada incompleta)" : ""}`);
    if (d.minutosTarde !== null) partes.push(`llegó ${d.minutosTarde} min tarde`);
  } else if (d.estatus === "parcial") {
    partes.push(d.entrada ? `Pendiente la marca de salida (entrada ${d.entrada})` : `Pendiente la marca de entrada (salida ${d.salida})`);
    partes.push("Puedes corregir las horas aquí mismo");
  } else if (d.estatus === "enJornada") {
    partes.push(`Ya marcó entrada (${d.entrada}); su jornada aún no termina`);
  } else if (d.estatus === "ausencia") {
    partes.push(d.manual ? "Ausencia registrada por Nuria" : "Sin marcas ese día");
  } else if (d.estatus === "feriado") {
    partes.push("Feriado sin marcas (se trabaja de forma opcional)");
  } else if (d.estatus === "pendiente") {
    partes.push("Pendiente la marca de entrada, o todavía sin información");
  } else if (d.estatus === "fuera") {
    partes.push("La asesora aún no había ingresado o ya no laboraba este día");
  } else {
    partes.push(d.manual ? "Registrado por Nuria" : "");
  }
  if (d.entradaOriginal || d.salidaOriginal) {
    partes.push(
      `Horas ajustadas por Nuria (foto: entrada ${d.entradaOriginal ?? d.entrada ?? "—"}, salida ${d.salidaOriginal ?? d.salida ?? "—"})${d.motivoCorreccion ? ` · ${d.motivoCorreccion}` : ""}`
    );
  }
  if (d.marcasEnPermiso) {
    partes.push(`Ojo: tiene marcas ese día (entrada ${d.entrada ?? "—"}, salida ${d.salida ?? "—"}); ¿trabajó pese al permiso?`);
  }
  if (d.nota) partes.push(`Nota: ${d.nota}`);
  return partes.filter(Boolean).join(" · ");
}

function DetalleDia({
  fila,
  dia,
  detallePermiso,
  onCorregido,
  onCerrar,
}: {
  fila: FilaAsesora;
  dia: DiaCalculado;
  detallePermiso: string;
  onCorregido: () => void;
  onCerrar: () => void;
}) {
  const estilo = ESTILO[dia.estatus];
  const [corrigiendo, setCorrigiendo] = useState(false);
  return (
    <div className="rounded-xl border-2 border-[#1EA6B8] bg-white p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold">{fila.asesora.nombre}</div>
          <div className="text-[11.5px] text-[#6B6D6E]">{tituloDia(dia.fecha)}</div>
        </div>
        <button onClick={onCerrar} className="text-[12px] text-[#6B6D6E] font-semibold px-1">
          Cerrar
        </button>
      </div>
      <div className="flex items-start gap-2">
        <span className="flex-none rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: estilo.fondo, color: estilo.texto }}>
          {estilo.etiqueta}
        </span>
        <span className="text-[12px] leading-snug">{[detallePermiso, describirDia(dia)].filter(Boolean).join(" · ")}</span>
      </div>
      {corrigiendo ? (
        <CorregirHoras
          asesoraId={fila.asesora.id}
          nombre={fila.asesora.nombre}
          fecha={dia.fecha}
          entrada={dia.entrada}
          salida={dia.salida}
          entradaOriginal={dia.entradaOriginal}
          salidaOriginal={dia.salidaOriginal}
          motivoPrevio={dia.motivoCorreccion}
          onGuardado={() => {
            setCorrigiendo(false);
            onCorregido();
          }}
          onCerrar={() => setCorrigiendo(false)}
        />
      ) : (
        <button
          onClick={() => setCorrigiendo(true)}
          className="w-full rounded-lg bg-[#0B5F6C] text-white py-2.5 text-[12.5px] font-semibold"
        >
          Corregir horas de entrada y salida
        </button>
      )}
    </div>
  );
}

export default function PanelPrincipal({ recargar = 0, arriba, onMes }: { recargar?: number; arriba?: ReactNode; onMes?: (mes: string) => void }) {
  const [referencia, setReferencia] = useState(() => ahoraCR().fecha);
  // Solo se ve el mes: los indicadores cuentan todo el mes y cada asesora muestra su estado de hoy.
  const periodo = "mes" as Periodo;
  const [kpiActivo, setKpiActivo] = useState<Kpi | null>(null);
  const [asesoras, setAsesoras] = useState<Asesora[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [diasEspeciales, setDiasEspeciales] = useState<DiaEspecial[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [feriadosConfirmados, setFeriadosConfirmados] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [moviendoId, setMoviendoId] = useState<string | null>(null);
  const [permisoAbiertoId, setPermisoAbiertoId] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [nuevoFeriadoFecha, setNuevoFeriadoFecha] = useState("");
  const [nuevoFeriadoDesc, setNuevoFeriadoDesc] = useState("");
  const inicioRef = useRef<HTMLDivElement>(null);

  const mes = referencia.slice(0, 7);

  useEffect(() => {
    onMes?.(mes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);

  async function cargar() {
    const [rAsesoras, rMarcas, rDias, rFeriados, rComentarios] = await Promise.all([
      fetch("/api/asesoras").then((r) => r.json()),
      fetch(`/api/marcas?mes=${mes}`).then((r) => r.json()),
      fetch(`/api/dias-especiales?mes=${mes}`).then((r) => r.json()),
      fetch(`/api/feriados?mes=${mes}`).then((r) => r.json()),
      fetch(`/api/comentarios?mes=${mes}`).then((r) => r.json()),
    ]);
    setComentarios(rComentarios.comentarios ?? []);
    setAsesoras(rAsesoras.asesoras ?? []);
    setMarcas(rMarcas.marcas ?? []);
    setDiasEspeciales(rDias.dias ?? []);
    setFeriados(rFeriados.feriados ?? []);
    setFeriadosConfirmados(!!rFeriados.confirmado);
    setCargando(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, recargar]);

  const totalDias = diasEnMes(mes);
  const ahora = ahoraCR();
  const hoy = ahora.fecha;
  const fechasFeriado = useMemo(() => new Set(feriados.map((f) => f.fecha)), [feriados]);
  const puntos = useMemo(() => [...new Set(asesoras.map((a) => a.punto))].sort((a, b) => a.localeCompare(b, "es")), [asesoras]);
  const quitadas = useMemo(() => asesoras.filter((a) => !a.activo), [asesoras]);

  // Fechas de cada permiso por asesora y tipo, para mostrar "del 10 al 16 (dia 3 de 7)".
  const fechasPermiso = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const d of diasEspeciales) {
      const k = `${d.asesora_id}|${d.tipo}`;
      m.set(k, [...(m.get(k) ?? []), d.fecha]);
    }
    return m;
  }, [diasEspeciales]);

  const filas: FilaAsesora[] = useMemo(() => {
    const marcasPor = new Map<string, Marca[]>();
    for (const m of marcas) marcasPor.set(m.asesora_id, [...(marcasPor.get(m.asesora_id) ?? []), m]);
    const especialesPor = new Map<string, DiaEspecial[]>();
    for (const d of diasEspeciales) especialesPor.set(d.asesora_id, [...(especialesPor.get(d.asesora_id) ?? []), d]);

    return asesoras
      // Las quitadas solo aparecen en los meses donde tienen historial.
      .filter((a) => a.activo || marcasPor.has(a.id) || especialesPor.has(a.id))
      .sort((a, b) => a.punto.localeCompare(b.punto, "es") || a.nombre.localeCompare(b.nombre, "es"))
      .map((asesora) => {
        const dias = calcularMesAsesora({
          mes,
          totalDias,
          horaEntradaEsperada: asesora.hora_entrada,
          marcas: marcasPor.get(asesora.id) ?? [],
          especiales: especialesPor.get(asesora.id) ?? [],
          fechasFeriado,
          feriadosConfirmados,
          hoy,
          ahoraMinutos: ahora.minutos,
          fechaIngreso: asesora.fecha_ingreso,
          fechaBaja: asesora.fecha_baja,
        });
        return { asesora, dias, resumen: resumirMes(dias) };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asesoras, marcas, diasEspeciales, mes, totalDias, fechasFeriado, feriadosConfirmados, hoy]);

  const rango = useMemo(() => rangoDePeriodo(periodo, referencia, mes, totalDias), [periodo, referencia, mes, totalDias]);

  // Dias de cada asesora dentro del periodo elegido que cumplen cada condicion.
  const coincidencias = useMemo(() => {
    const porAsesora = new Map<string, Record<Kpi, DiaCalculado[]>>();
    const vacio = (): Record<Kpi, DiaCalculado[]> => ({
      ausencia: [], faltaMarca: [], jornadaIncompleta: [], incapacidad: [], vacaciones: [], libre: [],
    });
    for (const f of filas) {
      const r = vacio();
      for (const d of f.dias) {
        if (d.fecha < rango.desde || d.fecha > rango.hasta) continue;
        for (const k of KPIS) if (cumple(k.id, d, hoy)) r[k.id].push(d);
      }
      porAsesora.set(f.asesora.id, r);
    }
    return porAsesora;
  }, [filas, rango, hoy]);

  const totales = useMemo(() => {
    const t = {} as Record<Kpi, { personas: number; dias: number }>;
    for (const k of KPIS) {
      let personas = 0;
      let dias = 0;
      for (const f of filas) {
        const n = coincidencias.get(f.asesora.id)?.[k.id].length ?? 0;
        if (n > 0) personas++;
        dias += n;
      }
      t[k.id] = { personas, dias };
    }
    return t;
  }, [filas, coincidencias]);

  const esFeriadoRef = false;
  const feriadoRef = feriados.find((f) => f.fecha === referencia);
  const idxDia = mes === hoy.slice(0, 7) ? Number(hoy.slice(8)) - 1 : 0; // dia que se muestra en cada tarjeta

  const filasVisibles = useMemo(() => {
    let lista = filas;
    if (periodo === "dia") {
      // Como en la vista diaria: no se lista a quien aun no ingresaba, ni (en feriado) a quien no lo trabajo.
      lista = lista.filter((f) => {
        const d = f.dias[idxDia];
        if (!d || d.estatus === "fuera") return false;
        if (esFeriadoRef && !d.entrada && !d.salida) return false;
        return true;
      });
    }
    if (kpiActivo) {
      lista = lista.filter((f) => (coincidencias.get(f.asesora.id)?.[kpiActivo].length ?? 0) > 0);
      lista = [...lista].sort(
        (a, b) => (coincidencias.get(b.asesora.id)?.[kpiActivo].length ?? 0) - (coincidencias.get(a.asesora.id)?.[kpiActivo].length ?? 0)
      );
    }
    return lista;
  }, [filas, kpiActivo, coincidencias, periodo, idxDia, esFeriadoRef]);

  // Texto corto y tono del dia elegido (vista diaria).
  function textoDia(f: FilaAsesora, d: DiaCalculado): { texto: string; tono: Tono } {
    const conCorreccion = d.entradaOriginal || d.salidaOriginal ? ` · Horas ajustadas por Nuria${d.motivoCorreccion ? ` (${d.motivoCorreccion})` : ""}` : "";
    switch (d.estatus) {
      case "asistencia":
        return d.horas !== null && d.horas < 8
          ? { texto: `Jornada de ${d.horas.toFixed(1)} h (menos de las 8 h efectivas)${conCorreccion}`, tono: "warn" }
          : { texto: `Jornada completa · ${(d.horas ?? 0).toFixed(1)} h${conCorreccion}`, tono: "ok" };
      case "parcial":
        return { texto: d.entrada ? "Pendiente la marca de salida" : "Pendiente la marca de entrada", tono: "warn" };
      case "enJornada":
        return { texto: "En jornada", tono: "info" };
      case "ausencia":
        return { texto: d.manual ? "Ausencia registrada por Nuria" : "No registra marcas este día (ausencia)", tono: "warn" };
      case "feriado":
        return { texto: "Feriado", tono: "info" };
      case "pendiente":
        if (d.fecha === hoy) return { texto: "Pendiente la marca de entrada", tono: "warn" };
        if (d.fecha > hoy) return { texto: "", tono: "info" };
        return { texto: "Pendiente confirmar los feriados del mes", tono: "info" };
      case "fuera":
        return { texto: "", tono: "info" };
      default: {
        // libre, vacaciones, incapacidad
        let texto = ESTILO[d.estatus].etiqueta;
        const r = rangoConsecutivo(fechasPermiso.get(`${f.asesora.id}|${d.estatus}`) ?? [d.fecha], d.fecha);
        if (r.total > 1) texto += ` · del ${diaMes(r.inicio)} al ${diaMes(r.fin)} (día ${r.posicion} de ${r.total})`;
        if (d.nota) texto += ` · ${d.nota}`;
        if (d.estatus === "vacaciones" || d.estatus === "incapacidad") texto += ` · regresa el ${diaMes(sumarDias(r.fin, 1))}`;
        if (d.marcasEnPermiso) return { texto: `${texto} · Tiene marcas este día: ¿trabajó pese al permiso?`, tono: "warn" };
        return { texto, tono: "info" };
      }
    }
  }

  // "del 10/9 al 16/9 (día 3 de 7) · regresa el 17/9" para libre, vacaciones e incapacidad.
  function detallePermiso(f: FilaAsesora, d: DiaCalculado): string {
    if (d.estatus !== "libre" && d.estatus !== "vacaciones" && d.estatus !== "incapacidad") return "";
    const r = rangoConsecutivo(fechasPermiso.get(`${f.asesora.id}|${d.estatus}`) ?? [d.fecha], d.fecha);
    if (r.total <= 1) return "";
    const regreso = d.estatus === "libre" ? "" : ` · regresa el ${diaMes(sumarDias(r.fin, 1))}`;
    return `del ${diaMes(r.inicio)} al ${diaMes(r.fin)} (día ${r.posicion} de ${r.total})${regreso}`;
  }

  async function agregarFeriado() {
    if (!nuevoFeriadoFecha) return;
    await fetch("/api/feriados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha: nuevoFeriadoFecha, descripcion: nuevoFeriadoDesc || null }),
    });
    setNuevoFeriadoFecha("");
    setNuevoFeriadoDesc("");
    await cargar();
  }

  async function quitarFeriado(fecha: string) {
    await fetch(`/api/feriados?fecha=${fecha}`, { method: "DELETE" });
    await cargar();
  }

  function recargarTodo() {
    void cargar();
  }

  function mover(delta: 1 | -1) {
    setSeleccion(null);
    setAbierta(null);
    setMoviendoId(null);
    {
      const [a, m] = mes.split("-").map(Number);
      const nuevo = new Date(Date.UTC(a, m - 1 + delta, 1)).toISOString().slice(0, 7);
      setReferencia(nuevo === hoy.slice(0, 7) ? hoy : `${nuevo}-01`);
    }
  }

  // Al abrir la tarjeta se ve su calendario con el dia elegido (hoy por defecto) ya seleccionado, listo para editar horas.
  function alternarTarjeta(f: FilaAsesora, expandida: boolean) {
    setAbierta(expandida ? null : f.asesora.id);
    setSeleccion(expandida ? null : { asesoraId: f.asesora.id, dia: idxDia + 1 });
    setPermisoAbiertoId(null);
    setMoviendoId(null);
  }

  function verDiaEnCalendario(f: FilaAsesora, dia: number) {
    setAbierta(f.asesora.id);
    setSeleccion({ asesoraId: f.asesora.id, dia });
    setPermisoAbiertoId(null);
    setMoviendoId(null);
  }

  const filaSel = seleccion ? filas.find((f) => f.asesora.id === seleccion.asesoraId) : undefined;
  const diaSel = filaSel && seleccion ? filaSel.dias[seleccion.dia - 1] : undefined;
  const primerDiaSemana = (new Date(`${mes}-01T12:00:00`).getDay() + 6) % 7; // lunes = 0

  const etiquetaPeriodo =
    periodo === "dia"
      ? tituloDia(referencia)
      : periodo === "semana"
      ? `Semana del ${Number(rango.desde.split("-")[2])} al ${Number(rango.hasta.split("-")[2])} de ${aSetiembre(new Date(`${rango.hasta}T12:00:00`).toLocaleDateString("es-CR", { month: "long" }))}`
      : aSetiembre(new Date(`${mes}-01T12:00:00`).toLocaleDateString("es-CR", { month: "long", year: "numeric" }));

  const esHoyElPeriodo = hoy >= rango.desde && hoy <= rango.hasta;

  return (
    <div className="space-y-3">
      <datalist id="lista-puntos">
        {puntos.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      <div ref={inicioRef} className="scroll-mt-20" />

      {/* Carga del lote de fotos */}
      {arriba}

      <PreguntaFeriados key={`feriados-${mes}`} mes={mes} onCambio={() => void cargar()} />

      {/* Mes que se esta viendo */}
      <div className="flex items-center gap-2">
        <button onClick={() => mover(-1)} className="w-9 h-9 rounded-lg border border-[#DDE7E8] bg-white text-[#0B5F6C] font-bold" aria-label="Mes anterior">
          ‹
        </button>
        <div className="flex-1 min-w-0 text-center">
          <div className="text-[13px] font-extrabold text-[#0B5F6C] leading-tight capitalize">{etiquetaPeriodo}</div>
          {esHoyElPeriodo && (
            <span className="inline-block mt-0.5 rounded-full bg-[#35DCEC] text-[#0B3A41] px-2 py-0.5 text-[10px] font-bold">Mes actual</span>
          )}
        </div>
        <button onClick={() => mover(1)} className="w-9 h-9 rounded-lg border border-[#DDE7E8] bg-white text-[#0B5F6C] font-bold" aria-label="Mes siguiente">
          ›
        </button>
        {!esHoyElPeriodo && (
          <button onClick={() => setReferencia(hoy)} className="rounded-lg bg-[#E4F7F9] text-[#0B5F6C] px-3 py-2 text-[12.5px] font-semibold">
            Ir a hoy
          </button>
        )}
      </div>

      {esFeriadoRef && (
        <div className="rounded-xl bg-[#E4F7F9] border border-[#CFF0F3] p-3 text-[12.5px] text-[#0B5F6C] font-semibold">
          Feriado{feriadoRef?.descripcion ? ` — ${feriadoRef.descripcion}` : ""}. Solo se lista a quienes lo trabajaron.
        </div>
      )}

      {cargando ? (
        <p className="text-sm text-[#6B6D6E]">Cargando…</p>
      ) : (
        <>
          {/* Indicadores: tocar uno resalta a las asesoras que cumplen la condicion */}
          <div className="grid grid-cols-3 gap-2">
            {KPIS.map((k) => {
              const activo = kpiActivo === k.id;
              const { personas, dias } = totales[k.id];
              return (
                <button
                  key={k.id}
                  onClick={() => setKpiActivo(activo ? null : k.id)}
                  className="rounded-xl p-2.5 text-left"
                  style={{
                    background: k.fondo,
                    color: k.texto,
                    border: `2px solid ${activo ? "#0B5F6C" : k.borde ?? "transparent"}`,
                    boxShadow: activo ? "0 0 0 3px #35DCEC" : "none",
                  }}
                >
                  <div className="font-extrabold text-2xl leading-none">{personas}</div>
                  <div className="text-[10.5px] font-bold uppercase tracking-wide mt-1 leading-tight">
                    <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ background: COLOR[k.id].punto, boxShadow: "0 0 0 1.5px #FFFFFF" }} />
                    {k.etiqueta}
                  </div>
                  <div className="text-[10.5px] opacity-80 mt-0.5">
                    {personas === 1 ? "persona" : "personas"}
                    {periodo !== "dia" ? ` · ${dias} ${dias === 1 ? "día" : "días"}` : ""}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[#6B6D6E] -mt-1 leading-snug">
            {kpiActivo
              ? "Mostrando solo a quienes cumplen esa condición. Toca de nuevo el indicador para ver a todas."
              : "Toca un indicador para ver y resaltar a las asesoras que cumplen esa condición."}
          </p>

          {/* Feriados del mes: son de todas, no de una asesora */}
          <details className="rounded-xl border border-[#DDE7E8] bg-white px-3 py-2.5">
            <summary className="text-[12.5px] font-bold text-[#0B5F6C] cursor-pointer">
              Feriados de este mes{feriados.length > 0 ? ` (${feriados.length})` : ""}
            </summary>
            <div className="mt-2 space-y-2">
              <p className="text-[11px] text-[#6B6D6E] leading-snug">
                Se trabajan de forma opcional: ese día solo se lista a quienes marcaron, y nadie cuenta como ausente. Los libres, vacaciones e
                incapacidades se anotan en cada asesora (ícono 🗓️).
              </p>
              {feriados.length === 0 && <p className="text-[11.5px] text-[#6B6D6E]">Sin feriados definidos este mes.</p>}
              {feriados.map((fe) => (
                <div key={fe.id} className="flex items-center justify-between text-[12px] bg-[#F2F8F9] rounded-lg px-2.5 py-2">
                  <span>
                    {Number(fe.fecha.split("-")[2])} — {fe.descripcion || "Feriado"}
                  </span>
                  <button onClick={() => quitarFeriado(fe.fecha)} className="text-[#B23A3A] text-[11.5px] font-semibold">
                    Quitar
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="date"
                  value={nuevoFeriadoFecha}
                  onChange={(e) => setNuevoFeriadoFecha(e.target.value)}
                  className="rounded-lg border border-[#DDE7E8] p-2 text-[12px] flex-1"
                />
                <input
                  placeholder="Nombre (opcional)"
                  value={nuevoFeriadoDesc}
                  onChange={(e) => setNuevoFeriadoDesc(e.target.value)}
                  className="rounded-lg border border-[#DDE7E8] p-2 text-[12px] flex-1"
                />
                <button onClick={agregarFeriado} className="rounded-lg bg-[#0B5F6C] text-white px-3.5 text-sm font-bold">
                  +
                </button>
              </div>
            </div>
          </details>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-[#3A3B3C]">
            {LEYENDA.map(([k, etiqueta]) => (
              <span key={k} className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: COLOR[k].punto }} />
                {etiqueta}
              </span>
            ))}
          </div>

          {/* Asesoras: busqueda, filtro por punto y alta */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">
                {kpiActivo ? `${filasVisibles.length} asesora(s) · ${KPIS.find((k) => k.id === kpiActivo)?.etiqueta}` : `${filasVisibles.length} asesoras`}
              </div>
              <button
                onClick={() => setMostrarNueva((v) => !v)}
                className="rounded-lg bg-[#0B5F6C] text-white px-3 py-1.5 text-[12px] font-bold"
              >
                {mostrarNueva ? "Cerrar" : "+ Nueva asesora"}
              </button>
            </div>

            {aviso && <p className="text-[12.5px] text-[#1E8A5F] font-semibold">{aviso}</p>}

            {mostrarNueva && <NuevaAsesora onCambio={recargarTodo} onCerrar={() => setMostrarNueva(false)} onAviso={setAviso} />}

            {filasVisibles.map((f) => {
              const r = f.resumen;
              const expandida = abierta === f.asesora.id;
              const coincide = kpiActivo ? coincidencias.get(f.asesora.id)?.[kpiActivo] ?? [] : [];
              const dDia = mes === hoy.slice(0, 7) ? f.dias[idxDia] : undefined;
              const info = dDia ? textoDia(f, dDia) : null;
              return (
                <div
                  key={f.asesora.id}
                  className="rounded-xl overflow-hidden"
                  style={{
                    border: kpiActivo ? "2px solid #35DCEC" : "1px solid #DDE7E8",
                    background: kpiActivo ? "#F3FDFE" : "#FFFFFF",
                  }}
                >
                  <div className="flex items-start gap-1.5 p-3 pb-2">
                    <button onClick={() => alternarTarjeta(f, expandida)} className="flex-1 min-w-0 text-left">
                      <div className="text-[13px] font-bold leading-snug break-words">
                        {f.asesora.nombre}
                        {!f.asesora.activo && <span className="ml-1.5 text-[10px] text-[#6B6D6E] font-semibold">(quitada)</span>}
                        {comentarios.some((c) => c.asesora_id === f.asesora.id) && (
                          <span className="ml-1.5 text-[10px] text-[#0F7A8A] font-bold" title="Tiene comentarios este mes">
                            💬 {comentarios.filter((c) => c.asesora_id === f.asesora.id).length}
                          </span>
                        )}
                      </div>
                      {dDia && (dDia.entrada || dDia.salida) && (
                        <div className="text-[11.5px] tabular-nums text-[#3A3B3C] mt-0.5">
                          Entrada {dDia.entrada ?? "—"} · Salida {dDia.salida ?? "—"}
                        </div>
                      )}
                      {info && info.texto && (
                        <span
                          className={`inline-block mt-1.5 text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                            info.tono === "ok"
                              ? "bg-[#E7F5EE] text-[#1E8A5F]"
                              : info.tono === "warn"
                              ? "bg-[#35DCEC] text-[#0B3A41]"
                              : "bg-[#E4F7F9] text-[#0B5F6C]"
                          }`}
                        >
                          {info.texto}
                        </span>
                      )}
                    </button>
                    {f.asesora.activo && (
                      <>
                        <button
                          onClick={() => setMoviendoId(moviendoId === f.asesora.id ? null : f.asesora.id)}
                          className="flex-none rounded-lg border border-[#DDE7E8] bg-white text-[#0B5F6C] px-2.5 py-1.5 text-[11px] font-semibold"
                        >
                          Mover
                        </button>
                        <button
                          onClick={async () => {
                            const error = await quitarAsesora(f.asesora, setAviso);
                            if (error === null) recargarTodo();
                            else if (error !== "cancelado") setAviso(error);
                          }}
                          className="flex-none rounded-lg border border-[#DDE7E8] bg-white text-[#B23A3A] px-2.5 py-1.5 text-[11px] font-semibold"
                        >
                          Quitar
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => alternarTarjeta(f, expandida)}
                      className="flex-none w-8 h-8 rounded-lg bg-[#E4F7F9] text-[#0B5F6C] font-bold"
                      aria-label={expandida ? "Cerrar el calendario" : "Abrir el calendario"}
                    >
                      {expandida ? "−" : "+"}
                    </button>
                  </div>

                  {moviendoId === f.asesora.id && (
                    <div className="px-3 pb-3">
                      <FormMoverAsesora asesora={f.asesora} onCambio={recargarTodo} onAviso={setAviso} onCerrar={() => setMoviendoId(null)} />
                    </div>
                  )}
                  <div className="pb-1" />

                  {/* Semana o mes: detalle de lo que cumple el indicador elegido */}
                  {kpiActivo && coincide.length > 0 && (
                    <div className="px-3 pb-3 space-y-1.5">
                      {coincide.slice(0, 5).map((d) => (
                        <div key={d.fecha} className="flex items-center gap-2 rounded-lg bg-white border border-[#CFF0F3] px-2.5 py-1.5">
                          <div className="flex-1 min-w-0 text-[11.5px] leading-snug">
                            <b>{diaCorto(d.fecha)}</b> · {describirDia(d) || ESTILO[d.estatus].etiqueta}
                          </div>
                          <button
                            onClick={() => verDiaEnCalendario(f, d.dia)}
                            className="flex-none rounded-lg bg-[#0B5F6C] text-white px-2.5 py-1 text-[11px] font-semibold"
                          >
                            Ver en el calendario
                          </button>
                        </div>
                      ))}
                      {coincide.length > 5 && <div className="text-[11px] text-[#6B6D6E]">y {coincide.length - 5} día(s) más — abre la tarjeta para verlos.</div>}
                    </div>
                  )}

                  {expandida && (
                    <div className="border-t border-[#DDE7E8] p-3 space-y-2.5 bg-[#F8FBFB]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0 text-[11.5px] text-[#6B6D6E]">{f.asesora.punto}</div>
                        {f.asesora.activo && permisoAbiertoId !== f.asesora.id && (
                          <button
                            onClick={() => {
                              setPermisoAbiertoId(f.asesora.id);
                              setSeleccion(null);
                              setMoviendoId(null);
                            }}
                            className="flex-none flex items-center gap-1 rounded-lg border border-[#1EA6B8] bg-white text-[#0B5F6C] px-2.5 py-1.5 text-[11.5px] font-bold"
                            aria-label={`Editar libres, vacaciones e incapacidades de ${f.asesora.nombre} en el calendario`}
                          >
                            <span aria-hidden>✏️</span> Editar calendario
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                        <span className="text-[10px] text-[#6B6D6E] self-center">En el mes:</span>
                        <span className="rounded-full px-2 py-0.5" style={{ background: ESTILO.asistencia.fondo, color: "#fff" }}>
                          {r.asistencia + r.parcial + r.enJornada} asistencias
                        </span>
                        {r.ausencia > 0 && (
                          <span className="rounded-full px-2 py-0.5" style={{ background: ESTILO.ausencia.fondo, color: ESTILO.ausencia.texto }}>
                            {r.ausencia} ausencias
                          </span>
                        )}
                        {r.libre > 0 && <span className="rounded-full px-2 py-0.5 bg-[#E4F7F9] text-[#0F7A8A]">{r.libre} libres</span>}
                        {r.vacaciones > 0 && <span className="rounded-full px-2 py-0.5 bg-[#0B5F6C] text-white">{r.vacaciones} vacaciones</span>}
                        {r.incapacidad > 0 && <span className="rounded-full px-2 py-0.5 bg-[#CFF0F3] text-[#0B5F6C]">{r.incapacidad} incapacidad</span>}
                        {r.parcial > 0 && <span className="rounded-full px-2 py-0.5 bg-[#35DCEC] text-[#0B3A41]">{r.parcial} falta(n) marca</span>}
                        {r.jornadasIncompletas > 0 && (
                          <span className="rounded-full px-2 py-0.5 bg-[#35DCEC] text-[#0B3A41]">{r.jornadasIncompletas} jornada(s) incompleta(s)</span>
                        )}
                      </div>

                      {permisoAbiertoId === f.asesora.id ? (
                        <PlanificarMes
                          key={`${f.asesora.id}-${mes}`}
                          asesoraId={f.asesora.id}
                          nombre={f.asesora.nombre}
                          mes={mes}
                          especiales={diasEspeciales.filter((d) => d.asesora_id === f.asesora.id)}
                          hoy={hoy}
                          onCambio={recargarTodo}
                          onCerrar={() => setPermisoAbiertoId(null)}
                        />
                      ) : (
                        <>
                      <div className="grid grid-cols-7 text-center text-[10px] font-bold text-[#6B6D6E]">
                        {["L", "M", "X", "J", "V", "S", "D"].map((l, i) => (
                          <div key={i}>{l}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-y-0.5">
                        {Array.from({ length: primerDiaSemana }).map((_, i) => (
                          <div key={`v${i}`} />
                        ))}
                        {f.dias.map((d) => {
                          const c = colorDelDia(d);
                          const sel = seleccion?.asesoraId === f.asesora.id && seleccion.dia === d.dia;
                          const esHoy = d.fecha === hoy;
                          // Con un indicador elegido, sus dias se resaltan; sin indicador se ve solo el punto.
                          const resaltado = !!kpiActivo && cumple(kpiActivo, d, hoy);
                          const colorResalte = kpiActivo ? COLOR[kpiActivo] : null;
                          const atenuado = !!kpiActivo && !resaltado;
                          return (
                            <button
                              key={d.dia}
                              onClick={() => setSeleccion(sel ? null : { asesoraId: f.asesora.id, dia: d.dia })}
                              className="flex flex-col items-center py-0.5"
                              style={{ opacity: atenuado ? 0.4 : 1 }}
                              aria-label={`Día ${d.dia}${esHoy ? " (hoy)" : ""}: ${ESTILO[d.estatus].etiqueta}`}
                            >
                              <span
                                className="grid place-items-center w-8 h-8 rounded-full text-[13px] font-semibold"
                                style={{
                                  background: resaltado && colorResalte ? colorResalte.punto : esHoy ? "#1EA6B8" : "transparent",
                                  color: resaltado && colorResalte ? colorResalte.texto : esHoy ? "#FFFFFF" : "#14181A",
                                  fontWeight: resaltado || esHoy ? 800 : 500,
                                  boxShadow: sel ? "0 0 0 2px #0B5F6C" : resaltado && esHoy ? "0 0 0 2px #FFFFFF, 0 0 0 4px #1EA6B8" : "none",
                                }}
                              >
                                {d.dia}
                              </span>
                              <span className="h-1.5 mt-0.5 flex items-center">
                                {c && !resaltado && <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.punto }} />}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {filaSel && diaSel && seleccion?.asesoraId === f.asesora.id && (
                        <DetalleDia
                          fila={filaSel}
                          dia={diaSel}
                          detallePermiso={detallePermiso(filaSel, diaSel)}
                          onCorregido={recargarTodo}
                          onCerrar={() => setSeleccion(null)}
                        />
                      )}
                        </>
                      )}

                      <ComentariosAsesora
                        asesoraId={f.asesora.id}
                        mes={mes}
                        fechaInicial={mes === hoy.slice(0, 7) ? hoy : `${mes}-01`}
                        comentarios={comentarios.filter((c) => c.asesora_id === f.asesora.id)}
                        onCambio={recargarTodo}
                      />

                    </div>
                  )}
                </div>
              );
            })}
            {filasVisibles.length === 0 && (
              <p className="text-sm text-[#6B6D6E]">
                {kpiActivo ? "Ninguna asesora cumple esa condición en este período." : "No encontré asesoras con ese filtro."}
              </p>
            )}
          </div>

          <AsesorasQuitadas quitadas={quitadas} onCambio={recargarTodo} onAviso={setAviso} />
        </>
      )}

      {comentarios.some((c) => !c.asesora_id) && (
        <div className="rounded-xl border border-[#DDE7E8] bg-white p-3 space-y-1.5">
          <div className="text-[12px] font-bold text-[#0B5F6C]">Notas generales del mes (sin asesora)</div>
          {comentarios
            .filter((c) => !c.asesora_id)
            .map((c) => (
              <div key={c.id} className="flex items-start gap-2 rounded-lg bg-[#F2F8F9] px-2.5 py-1.5 text-[12px] leading-snug">
                <span className="flex-1 min-w-0">
                  <b className="text-[#0F7A8A]">{diaMes(c.fecha)}</b> · {c.asunto} — {c.situacion}
                </span>
                <button
                  onClick={async () => {
                    await fetch(`/api/comentarios?id=${c.id}`, { method: "DELETE" });
                    await cargar();
                  }}
                  className="text-[#B23A3A] text-[11px] font-semibold flex-none"
                >
                  Quitar
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
