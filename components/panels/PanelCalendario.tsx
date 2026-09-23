"use client";

import { useEffect, useMemo, useState } from "react";
import SelectorMes, { mesActual } from "@/components/SelectorMes";
import type { Asesora, DiaEspecial, Feriado, Marca, TipoDiaEspecial } from "@/lib/tipos";
import { agruparPorDia } from "@/lib/asistencia";

const OPCIONES: { tipo: TipoDiaEspecial; etiqueta: string; color: string; texto: string }[] = [
  { tipo: "ausencia", etiqueta: "Ausencia", color: "#DDE7E8", texto: "#3A3B3C" },
  { tipo: "incapacidad", etiqueta: "Incapacidad", color: "#CFF0F3", texto: "#0B5F6C" },
  { tipo: "libre", etiqueta: "Libre", color: "#E4F7F9", texto: "#0B5F6C" },
  { tipo: "vacaciones", etiqueta: "Vacaciones", color: "#0B5F6C", texto: "#FFFFFF" },
];

function diasEnMes(mes: string): number {
  const [anio, m] = mes.split("-").map(Number);
  return new Date(anio, m, 0).getDate();
}

function lunesDeLaSemana(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const fecha = new Date(a, m - 1, d);
  const dow = fecha.getDay(); // 0=domingo
  const diff = dow === 0 ? -6 : 1 - dow;
  fecha.setDate(fecha.getDate() + diff);
  return fecha.toISOString().slice(0, 10);
}

function formatoCorto(iso: string) {
  const [, , d] = iso.split("-");
  return Number(d);
}

export default function PanelCalendario() {
  const [mes, setMes] = useState(mesActual());
  const [asesoras, setAsesoras] = useState<Asesora[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [diasEspeciales, setDiasEspeciales] = useState<DiaEspecial[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [notas, setNotas] = useState<{ fecha_inicio: string; texto: string }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [celdaActiva, setCeldaActiva] = useState<{ asesoraId: string; fecha: string } | null>(null);
  const [nuevoFeriadoFecha, setNuevoFeriadoFecha] = useState("");
  const [nuevoFeriadoDesc, setNuevoFeriadoDesc] = useState("");

  async function cargar() {
    const [rAsesoras, rMarcas, rDias, rFeriados, rNotas] = await Promise.all([
      fetch("/api/asesoras").then((r) => r.json()),
      fetch(`/api/marcas?mes=${mes}`).then((r) => r.json()),
      fetch(`/api/dias-especiales?mes=${mes}`).then((r) => r.json()),
      fetch(`/api/feriados?mes=${mes}`).then((r) => r.json()),
      fetch(`/api/notas-semanales?mes=${mes}`).then((r) => r.json()),
    ]);
    setAsesoras((rAsesoras.asesoras ?? []).filter((a: Asesora) => a.activo));
    setMarcas(rMarcas.marcas ?? []);
    setDiasEspeciales(rDias.dias ?? []);
    setFeriados(rFeriados.feriados ?? []);
    setNotas(rNotas.notas ?? []);
    setCargando(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);

  const marcasPorAsesora = useMemo(() => {
    const mapa = new Map<string, Marca[]>();
    for (const m of marcas) {
      const lista = mapa.get(m.asesora_id) ?? [];
      lista.push(m);
      mapa.set(m.asesora_id, lista);
    }
    return mapa;
  }, [marcas]);

  const especialesPorAsesoraFecha = useMemo(() => {
    const mapa = new Map<string, DiaEspecial>();
    for (const d of diasEspeciales) mapa.set(`${d.asesora_id}|${d.fecha}`, d);
    return mapa;
  }, [diasEspeciales]);

  const fechasFeriado = useMemo(() => new Set(feriados.map((f) => f.fecha)), [feriados]);

  const totalDias = diasEnMes(mes);
  const hoyISO = new Date().toISOString().slice(0, 10);

  function estatusCelda(asesoraId: string, dia: number) {
    const fecha = `${mes}-${String(dia).padStart(2, "0")}`;
    const especial = especialesPorAsesoraFecha.get(`${asesoraId}|${fecha}`);
    if (especial) return OPCIONES.find((o) => o.tipo === especial.tipo);

    const porDia = agruparPorDia(marcasPorAsesora.get(asesoraId) ?? []);
    const resumen = porDia.get(fecha);
    if (resumen?.entrada && resumen?.salida) return { tipo: "asistencia", etiqueta: "Asistencia", color: "#1EA6B8", texto: "#fff" };
    if (fecha <= hoyISO && !fechasFeriado.has(fecha)) return { tipo: "ausencia", etiqueta: "Ausencia (auto)", color: "#F2F8F9", texto: "#B23A3A" };
    return null;
  }

  async function elegirEstatus(asesoraId: string, fecha: string, tipo: TipoDiaEspecial | "quitar") {
    if (tipo === "quitar") {
      await fetch(`/api/dias-especiales?asesora_id=${asesoraId}&fecha=${fecha}`, { method: "DELETE" });
    } else {
      await fetch("/api/dias-especiales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asesora_id: asesoraId, fecha, tipo }),
      });
    }
    setCeldaActiva(null);
    await cargar();
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

  async function guardarNota(fechaInicio: string, texto: string) {
    await fetch("/api/notas-semanales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha_inicio: fechaInicio, texto }),
    });
  }

  const semanas = useMemo(() => {
    const primerLunes = lunesDeLaSemana(`${mes}-01`);
    const lista: string[] = [];
    let cursor = primerLunes;
    while (cursor <= `${mes}-${String(totalDias).padStart(2, "0")}`) {
      lista.push(cursor);
      const [a, m, d] = cursor.split("-").map(Number);
      cursor = new Date(a, m - 1, d + 7).toISOString().slice(0, 10);
    }
    return lista;
  }, [mes, totalDias]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">Mes</span>
        <SelectorMes mes={mes} onCambiar={setMes} />
      </div>

      <div className="flex flex-wrap gap-3 text-[10.5px]">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded" style={{ background: "#1EA6B8" }} /> Asistencia
        </span>
        {OPCIONES.map((o) => (
          <span key={o.tipo} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded" style={{ background: o.color, border: "1px solid #DDE7E8" }} /> {o.etiqueta}
          </span>
        ))}
      </div>

      {cargando ? (
        <p className="text-sm text-[#6B6D6E]">Cargando…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#DDE7E8] bg-white">
          <table className="text-[10.5px] border-collapse min-w-max">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white p-2 text-left border-b border-[#DDE7E8]">Nombre</th>
                <th className="p-2 text-left border-b border-[#DDE7E8]">Punto</th>
                {Array.from({ length: totalDias }, (_, i) => i + 1).map((d) => (
                  <th key={d} className={`p-1 border-b border-[#DDE7E8] w-6 text-center ${fechasFeriado.has(`${mes}-${String(d).padStart(2, "0")}`) ? "bg-[#E4F7F9]" : ""}`}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {asesoras.map((a) => (
                <tr key={a.id}>
                  <td className="sticky left-0 bg-white p-2 border-b border-[#DDE7E8] whitespace-nowrap font-semibold">{a.nombre}</td>
                  <td className="p-2 border-b border-[#DDE7E8] whitespace-nowrap text-[#6B6D6E]">{a.punto}</td>
                  {Array.from({ length: totalDias }, (_, i) => i + 1).map((dia) => {
                    const fecha = `${mes}-${String(dia).padStart(2, "0")}`;
                    const estatus = estatusCelda(a.id, dia);
                    const activa = celdaActiva?.asesoraId === a.id && celdaActiva?.fecha === fecha;
                    return (
                      <td key={dia} className="border-b border-[#DDE7E8] p-0 relative text-center">
                        <button
                          onClick={() => setCeldaActiva(activa ? null : { asesoraId: a.id, fecha })}
                          className="w-6 h-6"
                          style={{ background: estatus?.color ?? "transparent", color: estatus?.texto }}
                          title={estatus?.etiqueta}
                        />
                        {activa && (
                          <div className="absolute z-20 top-7 left-0 bg-white border border-[#DDE7E8] rounded-lg shadow-lg text-left w-40">
                            {OPCIONES.map((o) => (
                              <button
                                key={o.tipo}
                                onClick={() => elegirEstatus(a.id, fecha, o.tipo)}
                                className="block w-full text-left px-3 py-1.5 hover:bg-[#F2F8F9] text-[11px]"
                              >
                                {o.etiqueta}
                              </button>
                            ))}
                            <button
                              onClick={() => elegirEstatus(a.id, fecha, "quitar")}
                              className="block w-full text-left px-3 py-1.5 hover:bg-[#F2F8F9] text-[11px] text-[#B23A3A]"
                            >
                              Quitar / dejar automático
                            </button>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl border border-[#DDE7E8] bg-white p-3">
        <div className="text-[12px] font-bold text-[#0B5F6C] mb-2">Feriados de este mes</div>
        <p className="text-[11px] text-[#6B6D6E] mb-2">
          Nuria: indícame qué días son feriado — se trabajan de forma opcional y no cuentan como ausencia.
        </p>
        <div className="space-y-1.5 mb-2">
          {feriados.map((f) => (
            <div key={f.id} className="flex items-center justify-between text-[11.5px] bg-[#F2F8F9] rounded-lg px-2.5 py-1.5">
              <span>
                {formatoCorto(f.fecha)} de {new Date(mes + "-01").toLocaleDateString("es-CR", { month: "long" })}
                {f.descripcion ? ` — ${f.descripcion}` : ""}
              </span>
              <button onClick={() => quitarFeriado(f.fecha)} className="text-[#B23A3A] text-xs">
                Quitar
              </button>
            </div>
          ))}
          {feriados.length === 0 && <p className="text-[11px] text-[#6B6D6E]">Sin feriados definidos este mes.</p>}
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={nuevoFeriadoFecha}
            onChange={(e) => setNuevoFeriadoFecha(e.target.value)}
            className="rounded-lg border border-[#DDE7E8] p-2 text-[11.5px] flex-1"
          />
          <input
            placeholder="Descripción (opcional)"
            value={nuevoFeriadoDesc}
            onChange={(e) => setNuevoFeriadoDesc(e.target.value)}
            className="rounded-lg border border-[#DDE7E8] p-2 text-[11.5px] flex-1"
          />
          <button onClick={agregarFeriado} className="rounded-lg bg-[#0B5F6C] text-white px-3 text-sm font-bold">
            +
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <a
          href={`/api/export/bitacora?mes=${mes}`}
          className="block text-center text-[12.5px] font-bold rounded-xl border-2 border-[#1EA6B8] text-[#0B5F6C] py-2.5"
        >
          ⬇ Exportar Excel de Marcas (bitácora)
        </a>
        <a
          href={`/api/export/calendario?mes=${mes}`}
          className="block text-center text-[12.5px] font-bold rounded-xl border-2 border-[#1EA6B8] text-[#0B5F6C] py-2.5"
        >
          ⬇ Exportar Excel de Asistencia (original)
        </a>
      </div>

      <div className="space-y-2.5">
        <div className="text-[12px] font-bold text-[#0B5F6C]">Comentarios por semana</div>
        {semanas.map((inicioSemana) => {
          const fin = (() => {
            const [a, m, d] = inicioSemana.split("-").map(Number);
            return new Date(a, m - 1, d + 6).toISOString().slice(0, 10);
          })();
          const notaExistente = notas.find((n) => n.fecha_inicio === inicioSemana)?.texto ?? "";
          return (
            <div key={inicioSemana} className="rounded-xl border-l-4 border-[#1EA6B8] bg-white border border-[#DDE7E8] p-3">
              <div className="text-[11.5px] font-bold text-[#0B5F6C] mb-1.5">
                Semana del {formatoCorto(inicioSemana)} al {formatoCorto(fin)}
              </div>
              <textarea
                defaultValue={notaExistente}
                placeholder="Vacaciones, incapacidades, ausencias, renuncias, nuevo ingreso, feriados trabajados…"
                onBlur={(e) => guardarNota(inicioSemana, e.target.value)}
                className="w-full rounded-lg border border-[#DDE7E8] p-2 text-[11.5px] min-h-16"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
