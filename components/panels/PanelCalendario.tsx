"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SelectorMes, { mesActual } from "@/components/SelectorMes";
import FormPermisos from "@/components/FormPermisos";
import PreguntaFeriados from "@/components/PreguntaFeriados";
import Comentarios from "@/components/Comentarios";
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
  feriado: { etiqueta: "Feriado", letra: "F", fondo: "#DDE7E8", texto: "#3A3B3C" },
  pendiente: { etiqueta: "Sin datos aún", letra: "·", fondo: "#F2F8F9", texto: "#6B6D6E" },
  fuera: { etiqueta: "Aún no laboraba / ya no labora", letra: "–", fondo: "#FFFFFF", texto: "#9AA3A4" },
};

const LEYENDA: EstatusDia[] = ["asistencia", "ausencia", "libre", "vacaciones", "incapacidad", "parcial", "feriado"];
const MANUALES: EstatusDia[] = ["libre", "vacaciones", "incapacidad", "ausencia"];

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function diasEnMes(mes: string): number {
  const [anio, m] = mes.split("-").map(Number);
  return new Date(anio, m, 0).getDate();
}

function tituloDia(iso: string): string {
  const t = new Date(`${iso}T12:00:00`).toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

type FilaAsesora = { asesora: Asesora; dias: DiaCalculado[]; resumen: ResumenMes };
type Seleccion = { asesoraId: string; dia: number } | null;

function describirDia(d: DiaCalculado): string {
  const partes: string[] = [];
  if (d.estatus === "asistencia") {
    partes.push(`Entrada ${d.entrada} · Salida ${d.salida}`);
    if (d.horas !== null) partes.push(`${d.horas.toFixed(1)} h efectivas`);
    if (d.minutosTarde !== null) partes.push(`llegó ${d.minutosTarde} min tarde`);
  } else if (d.estatus === "parcial") {
    partes.push(d.entrada ? `Solo hay entrada (${d.entrada}); falta la salida` : `Solo hay salida (${d.salida}); falta la entrada`);
    partes.push("Puedes completarla en Capturar → marca manual");
  } else if (d.estatus === "ausencia") {
    partes.push(d.manual ? "Ausencia registrada por Nuria" : "Sin marcas ese día");
  } else if (d.estatus === "feriado") {
    partes.push("Feriado sin marcas (se trabaja de forma opcional)");
  } else if (d.estatus === "pendiente") {
    partes.push("Todavía no hay información para este día");
  } else if (d.estatus === "fuera") {
    partes.push("La asesora aún no había ingresado o ya no laboraba este día");
  } else {
    partes.push(d.manual ? "Registrado por Nuria" : "");
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
  onCerrar,
}: {
  fila: FilaAsesora;
  dia: DiaCalculado;
  onElegir: (tipo: EstatusDia | "auto") => void;
  onCerrar: () => void;
}) {
  const estilo = ESTILO[dia.estatus];
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
        <span
          className="flex-none rounded-full px-2.5 py-1 text-[11.5px] font-bold"
          style={{ background: estilo.fondo, color: estilo.texto }}
        >
          {estilo.etiqueta}
        </span>
        <span className="text-[12px] leading-snug">{describirDia(dia)}</span>
      </div>
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

export default function PanelCalendario() {
  const [mes, setMes] = useState(mesActual());
  const [asesoras, setAsesoras] = useState<Asesora[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [diasEspeciales, setDiasEspeciales] = useState<DiaEspecial[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [feriadosConfirmados, setFeriadosConfirmados] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<"asesora" | "cuadricula">("asesora");
  const [busqueda, setBusqueda] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [refresco, setRefresco] = useState(0);
  const [nuevoFeriadoFecha, setNuevoFeriadoFecha] = useState("");
  const [nuevoFeriadoDesc, setNuevoFeriadoDesc] = useState("");
  const contenedorRef = useRef<HTMLDivElement>(null);
  const hoyRef = useRef<HTMLTableCellElement>(null);

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
  const hoy = ahoraCR().fecha;
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
          fechaIngreso: asesora.fecha_ingreso,
          fechaBaja: asesora.fecha_baja,
        });
        return { asesora, dias, resumen: resumirMes(dias) };
      });
  }, [asesoras, marcas, diasEspeciales, mes, totalDias, fechasFeriado, feriadosConfirmados, hoy]);

  const totales = useMemo(() => {
    const t = { asistencia: 0, ausencia: 0, libre: 0, vacaciones: 0, incapacidad: 0, parcial: 0 };
    for (const f of filas) {
      t.asistencia += f.resumen.asistencia;
      t.ausencia += f.resumen.ausencia;
      t.libre += f.resumen.libre;
      t.vacaciones += f.resumen.vacaciones;
      t.incapacidad += f.resumen.incapacidad;
      t.parcial += f.resumen.parcial;
    }
    return t;
  }, [filas]);

  const filasVisibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return filas;
    return filas.filter((f) => normalizar(f.asesora.nombre).includes(q) || normalizar(f.asesora.punto).includes(q));
  }, [filas, busqueda]);

  // En la cuadricula, centra el dia de hoy para que se vea de inmediato.
  useEffect(() => {
    if (vista !== "cuadricula" || cargando) return;
    const cont = contenedorRef.current;
    const th = hoyRef.current;
    if (cont && th) cont.scrollLeft = Math.max(0, th.offsetLeft - cont.clientWidth / 2 + th.clientWidth / 2);
  }, [vista, cargando, mes]);

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

  const panelDetalle =
    filaSel && diaSel ? (
      <DetalleDia
        fila={filaSel}
        dia={diaSel}
        onElegir={(t) => void elegir(filaSel, diaSel, t)}
        onCerrar={() => setSeleccion(null)}
      />
    ) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">Mes</span>
        <SelectorMes mes={mes} onCambiar={(m) => { setMes(m); setSeleccion(null); setAbierta(null); }} />
      </div>

      <PreguntaFeriados key={mes} mes={mes} onCambio={() => void cargar()} />

      {cargando ? (
        <p className="text-sm text-[#6B6D6E]">Cargando…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["asistencia", totales.asistencia],
                ["ausencia", totales.ausencia],
                ["libre", totales.libre],
                ["vacaciones", totales.vacaciones],
                ["incapacidad", totales.incapacidad],
                ["parcial", totales.parcial],
              ] as [EstatusDia, number][]
            ).map(([k, n]) => (
              <div key={k} className="rounded-xl p-2.5 text-center" style={{ background: ESTILO[k].fondo, color: ESTILO[k].texto }}>
                <div className="font-extrabold text-lg leading-none">{n}</div>
                <div className="text-[9.5px] uppercase tracking-wide mt-1">{k === "parcial" ? "Por completar" : ESTILO[k].etiqueta}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#6B6D6E] -mt-1">
            Suma de días de todas las asesoras en el mes. Toca una asesora (o un día) para ver el detalle.
          </p>

          <div className="flex gap-1.5">
            {(
              [
                ["asesora", "Por asesora"],
                ["cuadricula", "Cuadrícula del mes"],
              ] as ["asesora" | "cuadricula", string][]
            ).map(([id, etiqueta]) => (
              <button
                key={id}
                onClick={() => setVista(id)}
                className={`flex-1 rounded-lg py-2.5 text-[12.5px] font-semibold ${
                  vista === id ? "bg-[#0B5F6C] text-white" : "bg-[#E4F7F9] text-[#0B5F6C]"
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-[#3A3B3C]">
            {LEYENDA.map((k) => (
              <span key={k} className="flex items-center gap-1">
                <span
                  className="inline-grid place-items-center w-4 h-4 rounded text-[9px] font-bold"
                  style={{ background: ESTILO[k].fondo, color: ESTILO[k].texto }}
                >
                  {ESTILO[k].letra}
                </span>
                {ESTILO[k].etiqueta}
              </span>
            ))}
          </div>

          {vista === "asesora" && (
            <div className="space-y-2">
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar asesora o punto"
                className="w-full rounded-lg border border-[#DDE7E8] bg-white p-2.5 text-[13px]"
              />
              {filasVisibles.map((f) => {
                const r = f.resumen;
                const expandida = abierta === f.asesora.id;
                return (
                  <div key={f.asesora.id} className="rounded-xl border border-[#DDE7E8] bg-white overflow-hidden">
                    <button
                      onClick={() => {
                        setAbierta(expandida ? null : f.asesora.id);
                        setSeleccion(null);
                      }}
                      className="w-full text-left p-3"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-bold truncate">
                            {f.asesora.nombre}
                            {!f.asesora.activo && <span className="ml-1.5 text-[10px] text-[#6B6D6E] font-semibold">(quitada)</span>}
                          </div>
                          <div className="text-[11px] text-[#6B6D6E] truncate">{f.asesora.punto}</div>
                        </div>
                        <span className="text-[#0F7A8A] font-bold">{expandida ? "−" : "+"}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2 text-[11px] font-semibold">
                        <span className="rounded-full px-2 py-0.5" style={{ background: ESTILO.asistencia.fondo, color: "#fff" }}>
                          {r.asistencia} asistencias
                        </span>
                        {r.ausencia > 0 && (
                          <span className="rounded-full px-2 py-0.5" style={{ background: ESTILO.ausencia.fondo, color: ESTILO.ausencia.texto }}>
                            {r.ausencia} ausencias
                          </span>
                        )}
                        {r.libre > 0 && <span className="rounded-full px-2 py-0.5 bg-[#E4F7F9] text-[#0F7A8A]">{r.libre} libres</span>}
                        {r.vacaciones > 0 && <span className="rounded-full px-2 py-0.5 bg-[#0B5F6C] text-white">{r.vacaciones} vacaciones</span>}
                        {r.incapacidad > 0 && <span className="rounded-full px-2 py-0.5 bg-[#CFF0F3] text-[#0B5F6C]">{r.incapacidad} incapacidad</span>}
                        {r.parcial > 0 && <span className="rounded-full px-2 py-0.5 bg-[#35DCEC] text-[#0B3A41]">{r.parcial} por completar</span>}
                        {r.tardes > 0 && <span className="rounded-full px-2 py-0.5 bg-[#F2F8F9] text-[#3A3B3C]">{r.tardes} tardes</span>}
                        {r.asistencia > 0 && (
                          <span className="rounded-full px-2 py-0.5 bg-[#F2F8F9] text-[#3A3B3C]">{r.horasEfectivas.toFixed(0)} h efectivas</span>
                        )}
                      </div>
                    </button>

                    {expandida && (
                      <div className="border-t border-[#DDE7E8] p-3 space-y-2.5 bg-[#F8FBFB]">
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
                        {panelDetalle && seleccion?.asesoraId === f.asesora.id && panelDetalle}
                      </div>
                    )}
                  </div>
                );
              })}
              {filasVisibles.length === 0 && <p className="text-sm text-[#6B6D6E]">No encontré asesoras con esa búsqueda.</p>}
            </div>
          )}

          {vista === "cuadricula" && (
            <div className="space-y-2">
              <div ref={contenedorRef} className="overflow-x-auto rounded-xl border border-[#DDE7E8] bg-white">
                <table className="border-separate border-spacing-0 text-[11px]">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-20 bg-white border-b border-r border-[#DDE7E8] p-2 text-left min-w-[150px] max-w-[150px]">
                        Asesora
                      </th>
                      {Array.from({ length: totalDias }, (_, i) => i + 1).map((d) => {
                        const fecha = `${mes}-${String(d).padStart(2, "0")}`;
                        const esHoy = fecha === hoy;
                        return (
                          <th
                            key={d}
                            ref={esHoy ? hoyRef : undefined}
                            className={`border-b border-[#DDE7E8] px-0.5 py-1.5 w-8 min-w-8 text-center ${
                              esHoy ? "bg-[#35DCEC] text-[#0B3A41]" : fechasFeriado.has(fecha) ? "bg-[#DDE7E8]" : ""
                            }`}
                          >
                            {d}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f) => (
                      <tr key={f.asesora.id}>
                        <td className="sticky left-0 z-10 bg-white border-b border-r border-[#DDE7E8] p-2 min-w-[150px] max-w-[150px]">
                          <div className="font-semibold truncate">{f.asesora.nombre}</div>
                          <div className="text-[9.5px] text-[#6B6D6E] truncate">{f.asesora.punto}</div>
                        </td>
                        {f.dias.map((d) => {
                          const e = ESTILO[d.estatus];
                          const sel = seleccion?.asesoraId === f.asesora.id && seleccion.dia === d.dia;
                          return (
                            <td key={d.dia} className="border-b border-[#DDE7E8] p-0.5 text-center">
                              <button
                                onClick={() => setSeleccion(sel ? null : { asesoraId: f.asesora.id, dia: d.dia })}
                                className="w-7 h-7 rounded font-bold text-[10px]"
                                style={{
                                  background: e.fondo,
                                  color: e.texto,
                                  outline: sel ? "2px solid #0B5F6C" : "none",
                                }}
                                aria-label={`${f.asesora.nombre}, día ${d.dia}: ${e.etiqueta}`}
                              >
                                {e.letra}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {panelDetalle}
              {!panelDetalle && <p className="text-[11.5px] text-[#6B6D6E]">Toca cualquier casilla para ver el detalle de ese día.</p>}
            </div>
          )}
        </>
      )}

      <FormPermisos colapsable onCambio={() => { void cargar(); setRefresco((v) => v + 1); }} />

      <div className="rounded-xl border border-[#DDE7E8] bg-white p-3 space-y-2">
        <div className="text-[12.5px] font-bold text-[#0B5F6C]">Feriados de este mes</div>
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
