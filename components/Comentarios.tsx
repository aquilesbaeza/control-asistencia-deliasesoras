"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ASUNTOS_COMENTARIO, type Asesora, type Comentario } from "@/lib/tipos";
import { ahoraCR, aSetiembre } from "@/lib/tiempo";
import { mensajeAmable } from "@/lib/mensajes";

function tituloDia(iso: string): string {
  const texto = aSetiembre(new Date(`${iso}T12:00:00`).toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Comentarios estructurados (asunto + asesora + situacion) que se manejan dia a dia.
 * - `fecha`: muestra y agrega los comentarios de ese dia (pestana Hoy).
 * - `mes`: lista los del mes agrupados por dia (pestana Calendario).
 */
export default function Comentarios({
  fecha,
  mes,
  refresco = 0,
}: {
  fecha?: string; // YYYY-MM-DD
  mes?: string; // YYYY-MM
  refresco?: number;
}) {
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [asesoras, setAsesoras] = useState<Asesora[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [asunto, setAsunto] = useState<string>(ASUNTOS_COMENTARIO[1]);
  const [asesoraId, setAsesoraId] = useState("");
  const [situacion, setSituacion] = useState("");
  const [fechaNueva, setFechaNueva] = useState(() => fecha ?? ahoraCR().fecha);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consulta = fecha ? `fecha=${fecha}` : `mes=${mes}`;

  const cargar = useCallback(async () => {
    const [rC, rA] = await Promise.all([
      fetch(`/api/comentarios?${consulta}`).then((r) => r.json()),
      fetch("/api/asesoras").then((r) => r.json()),
    ]);
    setComentarios(rC.comentarios ?? []);
    setAsesoras((rA.asesoras ?? []).filter((a: Asesora) => a.activo));
    if (rC.error) setError(mensajeAmable(rC.error));
  }, [consulta]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar, refresco]);

  async function agregar() {
    setError(null);
    if (!asesoraId && !situacion.trim()) {
      setError("Elige la asesora o escribe la situación, por favor.");
      return;
    }
    setGuardando(true);
    try {
      const resp = await fetch("/api/comentarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: fecha ?? fechaNueva,
          asunto,
          asesora_id: asesoraId || null,
          situacion,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setSituacion("");
      setAsesoraId("");
      setAbierto(false);
      await cargar();
    } catch (err) {
      setError(mensajeAmable(err instanceof Error ? err.message : undefined, "No se pudo guardar el comentario."));
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(id: string) {
    await fetch(`/api/comentarios?id=${id}`, { method: "DELETE" });
    await cargar();
  }

  const porDia = useMemo(() => {
    const mapa = new Map<string, Comentario[]>();
    for (const c of comentarios) mapa.set(c.fecha, [...(mapa.get(c.fecha) ?? []), c]);
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [comentarios]);

  return (
    <div className="rounded-xl border border-[#DDE7E8] bg-white p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 text-[12.5px] font-bold text-[#0B5F6C]">
          {fecha ? "Comentarios del día" : "Comentarios del mes"}
          {comentarios.length > 0 && <span className="text-[#6B6D6E] font-semibold"> · {comentarios.length}</span>}
        </div>
        <button
          onClick={() => setAbierto((v) => !v)}
          className="rounded-lg bg-[#E4F7F9] text-[#0B5F6C] px-3 py-1.5 text-[12px] font-bold"
        >
          {abierto ? "Cerrar" : "+ Agregar"}
        </button>
      </div>

      {abierto && (
        <div className="rounded-lg bg-[#F2F8F9] p-2.5 space-y-2">
          <div className={fecha ? "" : "grid grid-cols-2 gap-2"}>
            <label className="block text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">
              Asunto
              <select
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#DDE7E8] bg-white p-2.5 text-[13px] normal-case font-normal text-[#14181A]"
              >
                {ASUNTOS_COMENTARIO.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            {!fecha && (
              <label className="block text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">
                Día
                <input
                  type="date"
                  value={fechaNueva}
                  onChange={(e) => setFechaNueva(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#DDE7E8] bg-white p-2.5 text-[13px] normal-case font-normal text-[#14181A]"
                />
              </label>
            )}
          </div>

          <label className="block text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">
            Asesora
            <select
              value={asesoraId}
              onChange={(e) => setAsesoraId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#DDE7E8] bg-white p-2.5 text-[13px] normal-case font-normal text-[#14181A]"
            >
              <option value="">-- Elige la asesora --</option>
              {asesoras.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} ({a.punto})
                </option>
              ))}
            </select>
          </label>

          <label className="block text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">
            Situación
            <input
              value={situacion}
              onChange={(e) => setSituacion(e.target.value)}
              placeholder="Ej: se retiró a las 2 pm por enfermedad"
              className="mt-1 w-full rounded-lg border border-[#DDE7E8] bg-white p-2.5 text-[13px] normal-case font-normal text-[#14181A]"
            />
          </label>

          {error && <p className="text-[12px] text-[#B23A3A]">{error}</p>}

          <button
            onClick={agregar}
            disabled={guardando}
            className="w-full rounded-xl py-2.5 font-bold text-white text-[13px] disabled:opacity-50"
            style={{ background: "linear-gradient(150deg, #0B5F6C, #1EA6B8)" }}
          >
            {guardando ? "Guardando…" : "Guardar comentario"}
          </button>
        </div>
      )}

      {!abierto && error && <p className="text-[12px] text-[#B23A3A]">{error}</p>}

      {porDia.length === 0 ? (
        <p className="text-[12px] text-[#6B6D6E]">
          {fecha ? "Sin comentarios este día." : "Sin comentarios este mes."}
        </p>
      ) : (
        <div className="space-y-2.5">
          {porDia.map(([dia, lista]) => (
            <div key={dia}>
              {!fecha && (
                <div className="text-[11px] font-bold uppercase tracking-wide text-[#0F7A8A] mb-1">{tituloDia(dia)}</div>
              )}
              <ul className="space-y-1.5">
                {lista.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 rounded-lg bg-[#F2F8F9] px-2.5 py-2 text-[12.5px] leading-snug">
                    <span className="flex-1 min-w-0">
                      <span className="inline-block rounded-full bg-[#CFF0F3] text-[#0B5F6C] px-2 py-0.5 text-[10.5px] font-bold mr-1.5">
                        {c.asunto}
                      </span>
                      <b>{c.asesoras?.nombre ?? "General"}</b>
                      {c.situacion ? ` — ${c.situacion}` : ""}
                    </span>
                    <button onClick={() => quitar(c.id)} className="text-[#B23A3A] text-[11px] font-semibold flex-none">
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
