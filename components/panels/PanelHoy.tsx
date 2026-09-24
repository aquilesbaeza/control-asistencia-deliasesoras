"use client";

import { useEffect, useMemo, useState } from "react";
import FormPermisos from "@/components/FormPermisos";
import PreguntaFeriados from "@/components/PreguntaFeriados";
import Comentarios from "@/components/Comentarios";
import CorregirHoras from "@/components/CorregirHoras";
import { ahoraCR } from "@/lib/tiempo";

type FilaDia = {
  asesora_id: string;
  nombre: string;
  punto: string;
  entrada: string | null;
  salida: string | null;
  horasEfectivas: number | null;
  comentario: string;
  estado: "ok" | "warn" | "info";
  especial: boolean;
  esperada: string | null;
  minutosTarde: number | null;
  corregida: boolean;
  entradaOriginal: string | null;
  salidaOriginal: string | null;
  motivoCorreccion: string | null;
};

type Filtro = "todas" | "sin_entrada" | "tarde" | "anomalias";

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function formatearFecha(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function sumarDias(iso: string, delta: number) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + delta)).toISOString().slice(0, 10);
}

export default function PanelHoy({ fechaInicial }: { fechaInicial?: string }) {
  const [fecha, setFecha] = useState(() => fechaInicial ?? ahoraCR().fecha);
  const [filas, setFilas] = useState<FilaDia[]>([]);
  const [esFeriado, setEsFeriado] = useState(false);
  const [descFeriado, setDescFeriado] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mostrarSelector, setMostrarSelector] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    fetch(`/api/reportes/dia?fecha=${fecha}`)
      .then((r) => r.json())
      .then((data) => {
        setFilas(data.filas ?? []);
        setEsFeriado(!!data.esFeriado);
        setDescFeriado(data.feriadoDescripcion ?? null);
      })
      .finally(() => setCargando(false));
  }, [fecha, version]);

  const recargar = () => setVersion((v) => v + 1);

  const [corrigiendoId, setCorrigiendoId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [punto, setPunto] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const completas = filas.filter((f) => f.estado === "ok").length;
  const anomalias = filas.filter((f) => f.estado === "warn").length;

  const puntos = useMemo(() => [...new Set(filas.map((f) => f.punto))].sort((a, b) => a.localeCompare(b, "es")), [filas]);

  const conteo = {
    sin_entrada: filas.filter((f) => !f.entrada && !f.especial).length,
    tarde: filas.filter((f) => f.minutosTarde !== null).length,
    anomalias,
  };

  const filasVisibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return filas.filter((f) => {
      if (q && !normalizar(f.nombre).includes(q) && !normalizar(f.punto).includes(q)) return false;
      if (punto && f.punto !== punto) return false;
      if (filtro === "sin_entrada") return !f.entrada && !f.especial;
      if (filtro === "tarde") return f.minutosTarde !== null;
      if (filtro === "anomalias") return f.estado === "warn";
      return true;
    });
  }, [filas, busqueda, punto, filtro]);

  const hayFiltros = busqueda !== "" || punto !== "" || filtro !== "todas";

  return (
    <div className="space-y-3">
      <PreguntaFeriados key={fecha.slice(0, 7)} mes={fecha.slice(0, 7)} onCambio={recargar} />

      <div className="flex items-center gap-2">
        <button
          onClick={() => setFecha((f) => sumarDias(f, -1))}
          className="w-9 h-9 rounded-lg border border-[#DDE7E8] bg-white text-[#0B5F6C] font-bold"
        >
          ‹
        </button>
        <div className="flex-1 text-center font-extrabold text-sm capitalize">{formatearFecha(fecha)}</div>
        <button
          onClick={() => setFecha((f) => sumarDias(f, 1))}
          className="w-9 h-9 rounded-lg border border-[#DDE7E8] bg-white text-[#0B5F6C] font-bold"
        >
          ›
        </button>
        <button
          onClick={() => setMostrarSelector((v) => !v)}
          className="text-[11px] text-[#0F7A8A] border border-dashed border-[#0F7A8A] rounded-lg px-2 py-2 font-semibold whitespace-nowrap"
        >
          📅 Otro día
        </button>
      </div>

      {mostrarSelector && (
        <input
          type="date"
          value={fecha}
          onChange={(e) => {
            if (e.target.value) setFecha(e.target.value);
            setMostrarSelector(false);
          }}
          className="w-full rounded-lg border border-[#DDE7E8] p-2 text-sm"
        />
      )}

      {esFeriado && (
        <div className="rounded-xl bg-[#E4F7F9] border border-[#CFF0F3] p-3 text-sm text-[#0B5F6C] font-semibold">
          Feriado{descFeriado ? ` — ${descFeriado}` : ""}. Solo se listan quienes lo trabajaron.
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex-1 rounded-xl bg-[#E4F7F9] p-2.5 text-center">
          <div className="font-extrabold text-lg text-[#0B5F6C]">{completas}</div>
          <div className="text-[9px] uppercase tracking-wide text-[#6B6D6E]">Completas</div>
        </div>
        <div className="flex-1 rounded-xl bg-[#35DCEC] p-2.5 text-center">
          <div className="font-extrabold text-lg text-[#0B3A41]">{anomalias}</div>
          <div className="text-[9px] uppercase tracking-wide text-[#0B3A41]">Por revisar</div>
        </div>
        <div className="flex-1 rounded-xl bg-[#E4F7F9] p-2.5 text-center">
          <div className="font-extrabold text-lg text-[#0B5F6C]">{filas.length}</div>
          <div className="text-[9px] uppercase tracking-wide text-[#6B6D6E]">{esFeriado ? "Trabajaron" : "Asesoras"}</div>
        </div>
      </div>

      <FormPermisos colapsable onCambio={recargar} />

      {filas.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar asesora o punto"
              className="rounded-lg border border-[#DDE7E8] bg-white p-2.5 text-[13px]"
            />
            <select
              value={punto}
              onChange={(e) => setPunto(e.target.value)}
              className="rounded-lg border border-[#DDE7E8] bg-white p-2.5 text-[13px]"
            >
              <option value="">Todos los puntos</option>
              {puntos.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {(
              [
                ["todas", "Todas", filas.length],
                ["sin_entrada", "Sin entrada", conteo.sin_entrada],
                ...(filas.some((x) => x.esperada) ? [["tarde", "Tarde", conteo.tarde] as [Filtro, string, number]] : []),
                ["anomalias", "Por revisar", conteo.anomalias],
              ] as [Filtro, string, number][]
            ).map(([id, etiqueta, n]) => (
              <button
                key={id}
                onClick={() => setFiltro(id)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  filtro === id ? "bg-[#0B5F6C] text-white" : "bg-[#E4F7F9] text-[#0B5F6C]"
                }`}
              >
                {etiqueta} · {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {cargando ? (
        <p className="text-sm text-[#6B6D6E]">Cargando…</p>
      ) : filas.length === 0 ? (
        <p className="text-sm text-[#6B6D6E]">
          {esFeriado ? "Nadie ha marcado este feriado todavía." : "Sin datos para este día."}
        </p>
      ) : filasVisibles.length === 0 ? (
        <div className="text-sm text-[#6B6D6E]">
          No encontré asesoras con ese filtro.{" "}
          {hayFiltros && (
            <button
              onClick={() => {
                setBusqueda("");
                setPunto("");
                setFiltro("todas");
              }}
              className="text-[#0F7A8A] font-semibold underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-[#DDE7E8] bg-white divide-y divide-[#DDE7E8]">
          {filasVisibles.map((f) => (
            <div key={f.asesora_id} className="p-3">
              <div className="font-bold text-[13px]">{f.nombre}</div>
              <div className="text-[11px] text-[#6B6D6E]">{f.punto}</div>
              <div className="flex gap-4 mt-1.5 text-[11px] tabular-nums">
                {f.esperada && (
                  <span>
                    <b className="block text-[9px] text-[#6B6D6E] uppercase font-semibold">Horario</b>
                    {f.esperada}
                  </span>
                )}
                <span>
                  <b className="block text-[9px] text-[#6B6D6E] uppercase font-semibold">Entrada</b>
                  {f.entrada ?? "—"}
                  {f.minutosTarde !== null && (
                    <i className="ml-1 not-italic rounded-full bg-[#35DCEC] text-[#0B3A41] px-1.5 py-0.5 text-[9.5px] font-bold">
                      +{f.minutosTarde} min
                    </i>
                  )}
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

              {corrigiendoId === f.asesora_id ? (
                <div className="mt-2">
                  <CorregirHoras
                    asesoraId={f.asesora_id}
                    nombre={f.nombre}
                    fecha={fecha}
                    entrada={f.entrada}
                    salida={f.salida}
                    entradaOriginal={f.entradaOriginal}
                    salidaOriginal={f.salidaOriginal}
                    motivoPrevio={f.motivoCorreccion}
                    onGuardado={() => {
                      setCorrigiendoId(null);
                      recargar();
                    }}
                    onCerrar={() => setCorrigiendoId(null)}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setCorrigiendoId(f.asesora_id)}
                  className={`mt-2 rounded-lg px-3 py-1.5 text-[12px] font-semibold ${
                    f.estado === "warn" ? "bg-[#0B5F6C] text-white" : "bg-[#E4F7F9] text-[#0B5F6C]"
                  }`}
                >
                  {f.estado === "warn" ? "Corregir horas" : "Editar horas"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Comentarios fecha={fecha} refresco={version} />
    </div>
  );
}
