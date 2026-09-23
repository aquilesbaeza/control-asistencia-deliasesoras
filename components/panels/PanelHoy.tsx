"use client";

import { useEffect, useState } from "react";

type FilaDia = {
  asesora_id: string;
  nombre: string;
  punto: string;
  entrada: string | null;
  salida: string | null;
  horasEfectivas: number | null;
  comentario: string;
  estado: "ok" | "warn" | "info";
};

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatearFecha(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  const fecha = new Date(a, m - 1, d);
  return fecha.toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "long" });
}

function sumarDias(iso: string, delta: number) {
  const [a, m, d] = iso.split("-").map(Number);
  const fecha = new Date(a, m - 1, d + delta);
  return fecha.toISOString().slice(0, 10);
}

export default function PanelHoy() {
  const [fecha, setFecha] = useState(hoyISO());
  const [filas, setFilas] = useState<FilaDia[]>([]);
  const [esFeriado, setEsFeriado] = useState(false);
  const [descFeriado, setDescFeriado] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mostrarSelector, setMostrarSelector] = useState(false);

  useEffect(() => {
    fetch(`/api/reportes/dia?fecha=${fecha}`)
      .then((r) => r.json())
      .then((data) => {
        setFilas(data.filas ?? []);
        setEsFeriado(!!data.esFeriado);
        setDescFeriado(data.feriadoDescripcion ?? null);
      })
      .finally(() => setCargando(false));
  }, [fecha]);

  const completas = filas.filter((f) => f.estado === "ok").length;
  const anomalias = filas.filter((f) => f.estado === "warn").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFecha((f) => sumarDias(f, -1))}
          className="w-8 h-8 rounded-lg border border-[#DDE7E8] bg-white text-[#0B5F6C] font-bold"
        >
          ‹
        </button>
        <div className="flex-1 text-center font-extrabold text-sm capitalize">{formatearFecha(fecha)}</div>
        <button
          onClick={() => setFecha((f) => sumarDias(f, 1))}
          className="w-8 h-8 rounded-lg border border-[#DDE7E8] bg-white text-[#0B5F6C] font-bold"
        >
          ›
        </button>
        <button
          onClick={() => setMostrarSelector((v) => !v)}
          className="text-[11px] text-[#0F7A8A] border border-dashed border-[#0F7A8A] rounded-lg px-2 py-1.5 font-semibold whitespace-nowrap"
        >
          📅 Otro día
        </button>
      </div>

      {mostrarSelector && (
        <input
          type="date"
          value={fecha}
          onChange={(e) => {
            setFecha(e.target.value);
            setMostrarSelector(false);
          }}
          className="w-full rounded-lg border border-[#DDE7E8] p-2 text-sm"
        />
      )}

      {esFeriado && (
        <div className="rounded-xl bg-[#E4F7F9] border border-[#CFF0F3] p-3 text-sm text-[#0B5F6C] font-semibold">
          🎉 Feriado{descFeriado ? ` — ${descFeriado}` : ""}. Se trabaja de forma opcional: solo se listan quienes marcaron.
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex-1 rounded-xl bg-[#E4F7F9] p-2.5 text-center">
          <div className="font-extrabold text-lg text-[#0B5F6C]">{completas}</div>
          <div className="text-[9px] uppercase tracking-wide text-[#6B6D6E]">Completas</div>
        </div>
        <div className="flex-1 rounded-xl bg-[#35DCEC] p-2.5 text-center">
          <div className="font-extrabold text-lg text-[#0B3A41]">{anomalias}</div>
          <div className="text-[9px] uppercase tracking-wide text-[#0B3A41]">Anomalías</div>
        </div>
        <div className="flex-1 rounded-xl bg-[#E4F7F9] p-2.5 text-center">
          <div className="font-extrabold text-lg text-[#0B5F6C]">{filas.length}</div>
          <div className="text-[9px] uppercase tracking-wide text-[#6B6D6E]">{esFeriado ? "Trabajaron" : "Esperadas"}</div>
        </div>
      </div>

      {cargando ? (
        <p className="text-sm text-[#6B6D6E]">Cargando…</p>
      ) : filas.length === 0 ? (
        <p className="text-sm text-[#6B6D6E]">
          {esFeriado ? "Nadie ha marcado este feriado todavía." : "Sin datos para este día."}
        </p>
      ) : (
        <div className="rounded-xl border border-[#DDE7E8] bg-white divide-y divide-[#DDE7E8]">
          {filas.map((f) => (
            <div key={f.asesora_id} className="p-3">
              <div className="font-bold text-[13px]">{f.nombre}</div>
              <div className="text-[11px] text-[#6B6D6E]">{f.punto}</div>
              <div className="flex gap-4 mt-1.5 text-[11px] tabular-nums">
                <span>
                  <b className="block text-[9px] text-[#6B6D6E] uppercase font-semibold">Entrada</b>
                  {f.entrada ?? "—"}
                </span>
                <span>
                  <b className="block text-[9px] text-[#6B6D6E] uppercase font-semibold">Salida</b>
                  {f.salida ?? "—"}
                </span>
              </div>
              {f.comentario && (
                <span
                  className={`inline-block mt-1.5 text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                    f.estado === "ok"
                      ? "bg-[#E7F5EE] text-[#1E8A5F]"
                      : f.estado === "warn"
                      ? "bg-[#35DCEC] text-[#0B3A41]"
                      : "bg-[#E4F7F9] text-[#0B5F6C]"
                  }`}
                >
                  {f.comentario}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
