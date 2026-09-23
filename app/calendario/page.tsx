"use client";

import { useEffect, useMemo, useState } from "react";
import SelectorMes, { mesActual } from "@/components/SelectorMes";
import type { Asesora, DiaEspecial, Marca, TipoDiaEspecial } from "@/lib/tipos";
import { agruparPorDia } from "@/lib/asistencia";

const OPCIONES: { tipo: TipoDiaEspecial; etiqueta: string; color: string }[] = [
  { tipo: "ausencia", etiqueta: "Ausencia", color: "#E97132" },
  { tipo: "incapacidad", etiqueta: "Incapacidad", color: "#0F9ED5" },
  { tipo: "libre", etiqueta: "Libre", color: "#BFBFBF" },
  { tipo: "vacaciones", etiqueta: "Vacaciones", color: "#A02B93" },
];

function diasEnMes(mes: string): number {
  const [anio, m] = mes.split("-").map(Number);
  return new Date(anio, m, 0).getDate();
}

export default function CalendarioPage() {
  const [mes, setMes] = useState(mesActual());
  const [asesoras, setAsesoras] = useState<Asesora[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [diasEspeciales, setDiasEspeciales] = useState<DiaEspecial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [celdaActiva, setCeldaActiva] = useState<{ asesoraId: string; fecha: string } | null>(null);

  async function cargar() {
    const [rAsesoras, rMarcas, rDias] = await Promise.all([
      fetch("/api/asesoras").then((r) => r.json()),
      fetch(`/api/marcas?mes=${mes}`).then((r) => r.json()),
      fetch(`/api/dias-especiales?mes=${mes}`).then((r) => r.json()),
    ]);
    setAsesoras((rAsesoras.asesoras ?? []).filter((a: Asesora) => a.activo));
    setMarcas(rMarcas.marcas ?? []);
    setDiasEspeciales(rDias.dias ?? []);
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

  const totalDias = diasEnMes(mes);

  function estatusCelda(asesoraId: string, dia: number) {
    const fecha = `${mes}-${String(dia).padStart(2, "0")}`;
    const especial = especialesPorAsesoraFecha.get(`${asesoraId}|${fecha}`);
    if (especial) return OPCIONES.find((o) => o.tipo === especial.tipo);

    const porDia = agruparPorDia(marcasPorAsesora.get(asesoraId) ?? []);
    const resumen = porDia.get(fecha);
    if (resumen?.entrada && resumen?.salida) return { tipo: "asistencia", etiqueta: "Asistencia", color: "#4EA72E" };
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Calendario</h1>
        <SelectorMes mes={mes} onCambiar={setMes} />
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded" style={{ background: "#4EA72E" }} /> Asistencia
        </span>
        {OPCIONES.map((o) => (
          <span key={o.tipo} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ background: o.color }} /> {o.etiqueta}
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <a
          href={`/api/export/calendario?mes=${mes}`}
          className="text-sm rounded bg-[#196B24] text-white px-3 py-2"
        >
          Descargar Excel Asistencia
        </a>
      </div>

      {cargando ? (
        <p className="text-sm text-neutral-500">Cargando…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="text-xs border-collapse min-w-max">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white p-2 text-left border-b">Nombre</th>
                <th className="p-2 text-left border-b">Punto</th>
                {Array.from({ length: totalDias }, (_, i) => i + 1).map((d) => (
                  <th key={d} className="p-1 border-b w-7 text-center">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {asesoras.map((a) => (
                <tr key={a.id}>
                  <td className="sticky left-0 bg-white p-2 border-b whitespace-nowrap">{a.nombre}</td>
                  <td className="p-2 border-b whitespace-nowrap text-neutral-500">{a.punto}</td>
                  {Array.from({ length: totalDias }, (_, i) => i + 1).map((dia) => {
                    const fecha = `${mes}-${String(dia).padStart(2, "0")}`;
                    const estatus = estatusCelda(a.id, dia);
                    const activa = celdaActiva?.asesoraId === a.id && celdaActiva?.fecha === fecha;
                    return (
                      <td key={dia} className="border-b p-0 relative text-center">
                        <button
                          onClick={() => setCeldaActiva(activa ? null : { asesoraId: a.id, fecha })}
                          className="w-7 h-7"
                          style={{ background: estatus?.color ?? "transparent" }}
                          title={estatus?.etiqueta}
                        />
                        {activa && (
                          <div className="absolute z-20 top-8 left-0 bg-white border border-neutral-300 rounded shadow-lg text-left w-40">
                            {OPCIONES.map((o) => (
                              <button
                                key={o.tipo}
                                onClick={() => elegirEstatus(a.id, fecha, o.tipo)}
                                className="block w-full text-left px-3 py-1.5 hover:bg-neutral-100"
                              >
                                {o.etiqueta}
                              </button>
                            ))}
                            <button
                              onClick={() => elegirEstatus(a.id, fecha, "quitar")}
                              className="block w-full text-left px-3 py-1.5 hover:bg-neutral-100 text-red-600"
                            >
                              Quitar
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
    </div>
  );
}
