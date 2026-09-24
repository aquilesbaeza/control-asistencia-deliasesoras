"use client";

import { useEffect, useMemo, useState } from "react";
import FormPermisos from "@/components/FormPermisos";
import PreguntaFeriados from "@/components/PreguntaFeriados";
import Comentarios from "@/components/Comentarios";
import CorregirHoras from "@/components/CorregirHoras";
import {
  calcularMesAsesora,
  resumirMes,
  type DiaCalculado,
  type EstatusDia,
  type ResumenMes,
} from "@/lib/asistencia";
import { ahoraCR } from "@/lib/tiempo";
import type { Asesora, DiaEspecial, Feriado, Marca } from "@/lib/tipos";

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

const LEYENDA: EstatusDia[] = ["asistencia", "ausencia", "libre", "vacaciones", "incapacidad", "parcial", "enJornada", "feriado"];
const MANUALES: EstatusDia[] = ["libre", "vacaciones", "incapacidad", "ausencia"];

type Periodo = "dia" | "semana" | "mes";
type Kpi = "ausencia" | "vacaciones" | "libre" | "incapacidad" | "faltaMarca" | "jornadaIncompleta";

const KPIS: { id: Kpi; etiqueta: string; fondo: string; texto: string; borde?: string }[] = [
  { id: "ausencia", etiqueta: "Ausencia", fondo: ESTILO.ausencia.fondo, texto: ESTILO.ausencia.texto },
  { id: "vacaciones", etiqueta: "Vacaciones", fondo: ESTILO.vacaciones.fondo, texto: ESTILO.vacaciones.texto },
  { id: "libre", etiqueta: "Libre", fondo: ESTILO.libre.fondo, texto: ESTILO.libre.texto },
  { id: "incapacidad", etiqueta: "Incapacidad", fondo: ESTILO.incapacidad.fondo, texto: ESTILO.incapacidad.texto },
  { id: "faltaMarca", etiqueta: "Falta marca (entrada o salida)", fondo: "#35DCEC", texto: "#0B3A41" },
  { id: "jornadaIncompleta", etiqueta: "Jornada incompleta", fondo: "#FFFFFF", texto: "#0B3A41", borde: "#35DCEC" },
];

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

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
  const t = new Date(`${iso}T12:00:00`).toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function diaCorto(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-CR", { weekday: "short", day: "numeric", month: "short" });
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
    case "vacaciones":
    case "libre":
    case "incapacidad":
      return d.estatus === kpi;
    case "faltaMarca":
      // Falta una de las dos marcas; hoy, ademas, quien aun no marca su entrada (unico aviso durante el dia).
      return d.estatus === "parcial" || (d.estatus === "pendiente" && d.fecha === hoy && !d.entrada && !d.salida && !d.manual);
    case "jornadaIncompleta":
      return d.estatus === "asistencia" && d.horas !== null && d.horas < 8;
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
  onElegir,
  onCorregido,
  onCerrar,
}: {
  fila: FilaAsesora;
  dia: DiaCalculado;
  onElegir: (tipo: EstatusDia | "auto") => void;
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
        <span className="text-[12px] leading-snug">{describirDia(dia)}</span>
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
      <div className="grid grid-cols-2 gap-1.5">
        {MANUALES.map((t) => (
          <button
            key={t}
            onClick={() => onElegir(t)}
            className={`rounded-lg py-2.5 text-[12.5px] font-semibold ${
              dia.manual && dia.estatus === t ? "bg-[#0B5F6C] text-white" : "bg-[#E4F7F9] text-[#0B5F6C]"
            }`}
          >
            {ESTILO[t].etiqueta}
          </button>
        ))}
      </div>
      {dia.manual && (
        <button
          onClick={() => onElegir("auto")}
          className="w-full rounded-lg border border-[#DDE7E8] py-2 text-[12px] font-semibold text-[#B23A3A]"
        >
          Quitar lo registrado y dejar que el sistema decida
        </button>
      )}
    </div>
  );
}

export default function PanelCalendario({ onVerDia }: { onVerDia?: (fecha: string) => void }) {
  const [referencia, setReferencia] = useState(() => ahoraCR().fecha);
  const [periodo, setPeriodo] = useState<Periodo>("dia");
  const [kpiActivo, setKpiActivo] = useState<Kpi | null>(null);
  const [asesoras, setAsesoras] = useState<Asesora[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [diasEspeciales, setDiasEspeciales] = useState<DiaEspecial[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [feriadosConfirmados, setFeriadosConfirmados] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [permisoAbiertoId, setPermisoAbiertoId] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [refresco, setRefresco] = useState(0);
  const [mostrarPermisos, setMostrarPermisos] = useState(false);
  const [mostrarFeriados, setMostrarFeriados] = useState(false);
  const [nuevoFeriadoFecha, setNuevoFeriadoFecha] = useState("");
  const [nuevoFeriadoDesc, setNuevoFeriadoDesc] = useState("");

  const mes = referencia.slice(0, 7);

  async function cargar() {
    const [rAsesoras, rMarcas, rDias, rFeriados] = await Promise.all([
      fetch("/api/asesoras").then((r) => r.json()),
      fetch(`/api/marcas?mes=${mes}`).then((r) => r.json()),
      fetch(`/api/dias-especiales?mes=${mes}`).then((r) => r.json()),
      fetch(`/api/feriados?mes=${mes}`).then((r) => r.json()),
    ]);
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
  }, [mes]);

  const totalDias = diasEnMes(mes);
  const ahora = ahoraCR();
  const hoy = ahora.fecha;
  const fechasFeriado = useMemo(() => new Set(feriados.map((f) => f.fecha)), [feriados]);

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
      ausencia: [], vacaciones: [], libre: [], incapacidad: [], faltaMarca: [], jornadaIncompleta: [],
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

  const filasVisibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    let lista = filas.filter((f) => !q || normalizar(f.asesora.nombre).includes(q) || normalizar(f.asesora.punto).includes(q));
    if (kpiActivo) {
      lista = lista.filter((f) => (coincidencias.get(f.asesora.id)?.[kpiActivo].length ?? 0) > 0);
      lista = [...lista].sort(
        (a, b) => (coincidencias.get(b.asesora.id)?.[kpiActivo].length ?? 0) - (coincidencias.get(a.asesora.id)?.[kpiActivo].length ?? 0)
      );
    }
    return lista;
  }, [filas, busqueda, kpiActivo, coincidencias]);

  async function elegir(f: FilaAsesora, d: DiaCalculado, tipo: EstatusDia | "auto") {
    if (tipo === "auto") {
      await fetch(`/api/dias-especiales?asesora_id=${f.asesora.id}&fecha=${d.fecha}`, { method: "DELETE" });
    } else {
      await fetch("/api/dias-especiales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asesora_id: f.asesora.id, fecha: d.fecha, tipo }),
      });
    }
    await cargar();
    setRefresco((v) => v + 1);
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

  const filaSel = seleccion ? filas.find((f) => f.asesora.id === seleccion.asesoraId) : undefined;
  const diaSel = filaSel && seleccion ? filaSel.dias[seleccion.dia - 1] : undefined;
  const primerDiaSemana = (new Date(`${mes}-01T12:00:00`).getDay() + 6) % 7; // lunes = 0

  const etiquetaPeriodo =
    periodo === "dia"
      ? tituloDia(referencia)
      : periodo === "semana"
      ? `Semana del ${Number(rango.desde.split("-")[2])} al ${Number(rango.hasta.split("-")[2])} de ${new Date(`${rango.hasta}T12:00:00`).toLocaleDateString("es-CR", { month: "long" })}`
      : new Date(`${mes}-01T12:00:00`).toLocaleDateString("es-CR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-3">
      <PreguntaFeriados key={mes} mes={mes} onCambio={() => void cargar()} />

      {/* Periodo de los indicadores */}
      <div className="space-y-2">
        <div className="flex gap-1.5">
          {(
            [
              ["dia", "Día"],
              ["semana", "Semana"],
              ["mes", "Mes"],
            ] as [Periodo, string][]
          ).map(([id, etiqueta]) => (
            <button
              key={id}
              onClick={() => setPeriodo(id)}
              className={`flex-1 rounded-lg py-2.5 text-[13px] font-semibold ${
                periodo === id ? "bg-[#0B5F6C] text-white" : "bg-[#E4F7F9] text-[#0B5F6C]"
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 text-[12.5px] font-bold text-[#0B5F6C] capitalize">{etiquetaPeriodo}</div>
          <input
            type="date"
            value={referencia}
            onChange={(e) => {
              if (e.target.value) {
                setReferencia(e.target.value);
                setSeleccion(null);
                setAbierta(null);
              }
            }}
            className="rounded-lg border border-[#DDE7E8] bg-white p-2 text-[12.5px]"
          />
          {referencia !== hoy && (
            <button onClick={() => setReferencia(hoy)} className="rounded-lg bg-[#E4F7F9] text-[#0B5F6C] px-2.5 py-2 text-[12px] font-semibold">
              Hoy
            </button>
          )}
        </div>
      </div>

      {cargando ? (
        <p className="text-sm text-[#6B6D6E]">Cargando…</p>
      ) : (
        <>
          {/* Indicadores: tocar uno resalta a las asesoras que cumplen la condicion */}
          <div className="grid grid-cols-2 gap-2">
            {KPIS.map((k) => {
              const activo = kpiActivo === k.id;
              const { personas, dias } = totales[k.id];
              return (
                <button
                  key={k.id}
                  onClick={() => setKpiActivo(activo ? null : k.id)}
                  className="rounded-xl p-3 text-left"
                  style={{
                    background: k.fondo,
                    color: k.texto,
                    border: `2px solid ${activo ? "#0B5F6C" : k.borde ?? "transparent"}`,
                    boxShadow: activo ? "0 0 0 3px #35DCEC" : "none",
                  }}
                >
                  <div className="font-extrabold text-2xl leading-none">{personas}</div>
                  <div className="text-[10.5px] font-bold uppercase tracking-wide mt-1 leading-tight">{k.etiqueta}</div>
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

          {/* Registro de permisos y feriados: a la vista */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMostrarPermisos((v) => !v)}
              className={`rounded-xl py-3 text-[12.5px] font-bold ${mostrarPermisos ? "bg-[#0B5F6C] text-white" : "bg-[#E4F7F9] text-[#0B5F6C]"}`}
            >
              + Libre, vacaciones o incapacidad
            </button>
            <button
              onClick={() => setMostrarFeriados((v) => !v)}
              className={`rounded-xl py-3 text-[12.5px] font-bold ${mostrarFeriados ? "bg-[#0B5F6C] text-white" : "bg-[#E4F7F9] text-[#0B5F6C]"}`}
            >
              + Feriados del mes
            </button>
          </div>

          {mostrarPermisos && (
            <FormPermisos
              abiertoInicial
              onCambio={() => {
                void cargar();
                setRefresco((v) => v + 1);
              }}
            />
          )}

          {mostrarFeriados && (
            <div className="rounded-xl border border-[#DDE7E8] bg-white p-3 space-y-2">
              <div className="text-[12.5px] font-bold text-[#0B5F6C]">Feriados de este mes</div>
              <p className="text-[11px] text-[#6B6D6E] leading-snug">
                Se trabajan de forma opcional: ese día solo se lista a quienes marcaron, y nadie cuenta como ausente.
              </p>
              {feriados.length === 0 && <p className="text-[11.5px] text-[#6B6D6E]">Sin feriados definidos este mes.</p>}
              {feriados.map((f) => (
                <div key={f.id} className="flex items-center justify-between text-[12px] bg-[#F2F8F9] rounded-lg px-2.5 py-2">
                  <span>
                    {Number(f.fecha.split("-")[2])} — {f.descripcion || "Feriado"}
                  </span>
                  <button onClick={() => quitarFeriado(f.fecha)} className="text-[#B23A3A] text-[11.5px] font-semibold">
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
          )}

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-[#3A3B3C]">
            {LEYENDA.map((k) => (
              <span key={k} className="flex items-center gap-1">
                <span
                  className="inline-grid place-items-center w-4 h-4 rounded text-[9px] font-bold"
                  style={{ background: ESTILO[k].fondo, color: ESTILO[k].texto, border: "1px solid #DDE7E8" }}
                >
                  {ESTILO[k].letra}
                </span>
                {ESTILO[k].etiqueta}
              </span>
            ))}
          </div>

          {/* Asesoras */}
          <div className="space-y-2">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar asesora o punto"
              className="w-full rounded-lg border border-[#DDE7E8] bg-white p-2.5 text-[13px]"
            />
            <div className="text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">
              {kpiActivo ? `${filasVisibles.length} asesora(s) · ${KPIS.find((k) => k.id === kpiActivo)?.etiqueta}` : `${filasVisibles.length} asesoras`}
            </div>

            {filasVisibles.map((f) => {
              const r = f.resumen;
              const expandida = abierta === f.asesora.id;
              const coincide = kpiActivo ? coincidencias.get(f.asesora.id)?.[kpiActivo] ?? [] : [];
              return (
                <div
                  key={f.asesora.id}
                  className="rounded-xl overflow-hidden"
                  style={{
                    border: kpiActivo ? "2px solid #35DCEC" : "1px solid #DDE7E8",
                    background: kpiActivo ? "#F3FDFE" : "#FFFFFF",
                  }}
                >
                  <button
                    onClick={() => {
                      setAbierta(expandida ? null : f.asesora.id);
                      setSeleccion(null);
                      setPermisoAbiertoId(null);
                    }}
                    className="w-full text-left p-3"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold truncate">
                          {f.asesora.nombre}
                          {!f.asesora.activo && <span className="ml-1.5 text-[10px] text-[#6B6D6E] font-semibold">(quitada)</span>}
                        </div>
                      </div>
                      <span className="text-[#0F7A8A] font-bold">{expandida ? "−" : "+"}</span>
                    </div>
                  </button>

                  {/* Detalle de lo que cumple el indicador elegido */}
                  {kpiActivo && coincide.length > 0 && (
                    <div className="px-3 pb-3 space-y-1.5">
                      {coincide.slice(0, 5).map((d) => (
                        <div key={d.fecha} className="flex items-center gap-2 rounded-lg bg-white border border-[#CFF0F3] px-2.5 py-1.5">
                          <div className="flex-1 min-w-0 text-[11.5px] leading-snug">
                            <b>{diaCorto(d.fecha)}</b> · {describirDia(d) || ESTILO[d.estatus].etiqueta}
                          </div>
                          {onVerDia && (
                            <button
                              onClick={() => onVerDia(d.fecha)}
                              className="flex-none rounded-lg bg-[#0B5F6C] text-white px-2.5 py-1 text-[11px] font-semibold"
                            >
                              Ver el día
                            </button>
                          )}
                        </div>
                      ))}
                      {coincide.length > 5 && <div className="text-[11px] text-[#6B6D6E]">y {coincide.length - 5} día(s) más — abre la tarjeta para verlos.</div>}
                    </div>
                  )}

                  {expandida && (
                    <div className="border-t border-[#DDE7E8] p-3 space-y-2.5 bg-[#F8FBFB]">
                      <div className="text-[11.5px] text-[#6B6D6E]">{f.asesora.punto}</div>
                      <div className="flex flex-wrap gap-1.5 mt-2 text-[11px] font-semibold">
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
                      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[#6B6D6E]">
                        {["L", "M", "K", "J", "V", "S", "D"].map((l, i) => (
                          <div key={i}>{l}</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: primerDiaSemana }).map((_, i) => (
                          <div key={`v${i}`} />
                        ))}
                        {f.dias.map((d) => {
                          const e = ESTILO[d.estatus];
                          const sel = seleccion?.asesoraId === f.asesora.id && seleccion.dia === d.dia;
                          return (
                            <button
                              key={d.dia}
                              onClick={() => setSeleccion(sel ? null : { asesoraId: f.asesora.id, dia: d.dia })}
                              className="rounded-lg py-1.5 leading-tight"
                              style={{
                                background: e.fondo,
                                color: e.texto,
                                outline: sel ? "2px solid #0B5F6C" : d.fecha === hoy ? "2px solid #35DCEC" : "none",
                                outlineOffset: 1,
                              }}
                            >
                              <div className="text-[12px] font-bold">{d.dia}</div>
                              <div className="text-[9px] font-bold opacity-80">{e.letra}</div>
                            </button>
                          );
                        })}
                      </div>

                      {filaSel && diaSel && seleccion?.asesoraId === f.asesora.id && (
                        <DetalleDia
                          fila={filaSel}
                          dia={diaSel}
                          onElegir={(t) => void elegir(filaSel, diaSel, t)}
                          onCorregido={() => {
                            void cargar();
                            setRefresco((v) => v + 1);
                          }}
                          onCerrar={() => setSeleccion(null)}
                        />
                      )}

                      {permisoAbiertoId === f.asesora.id ? (
                        <FormPermisos
                          abiertoInicial
                          asesoraInicial={f.asesora.id}
                          onCambio={() => {
                            void cargar();
                            setRefresco((v) => v + 1);
                          }}
                        />
                      ) : (
                        <button
                          onClick={() => setPermisoAbiertoId(f.asesora.id)}
                          className="w-full rounded-lg bg-[#E4F7F9] text-[#0B5F6C] py-2.5 text-[12.5px] font-bold"
                        >
                          + Registrar libre, vacaciones o incapacidad para {f.asesora.nombre.split(" ")[0]}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {filasVisibles.length === 0 && (
              <p className="text-sm text-[#6B6D6E]">
                {kpiActivo ? "Ninguna asesora cumple esa condición en este período." : "No encontré asesoras con esa búsqueda."}
              </p>
            )}
          </div>
        </>
      )}

      <Comentarios mes={mes} refresco={refresco} />

      <div className="space-y-2">
        <a
          href={`/api/export/bitacora?mes=${mes}`}
          className="block text-center text-[12.5px] font-bold rounded-xl border-2 border-[#1EA6B8] text-[#0B5F6C] py-3"
        >
          ⬇ Descargar Excel de Marcas (bitácora)
        </a>
        <a
          href={`/api/export/calendario?mes=${mes}`}
          className="block text-center text-[12.5px] font-bold rounded-xl border-2 border-[#1EA6B8] text-[#0B5F6C] py-3"
        >
          ⬇ Descargar Excel de Asistencia
        </a>
      </div>
    </div>
  );
}
