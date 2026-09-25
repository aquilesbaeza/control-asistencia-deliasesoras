"use client";

import { useState } from "react";
import { ASUNTOS_COMENTARIO, type Comentario } from "@/lib/tipos";
import { aSetiembre } from "@/lib/tiempo";
import { mensajeAmable } from "@/lib/mensajes";

function diaTexto(iso: string): string {
  const t = aSetiembre(new Date(`${iso}T12:00:00`).toLocaleDateString("es-CR", { weekday: "short", day: "numeric", month: "short" }));
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export type FilaDetalle = {
  fecha: string;
  fin: string | null; // ultimo dia si abarca varios (permisos seguidos)
  texto: string;
  color: string;
  estatus: string;
};

/** Detalle del mes de UNA asesora: lo que paso cada dia mas sus comentarios (asunto + dia + situacion), debajo de su calendario. */
export default function ComentariosAsesora({
  asesoraId,
  mes,
  fechaInicial,
  comentarios,
  filas,
  filtrado,
  onCambio,
}: {
  asesoraId: string;
  mes: string; // YYYY-MM
  fechaInicial: string; // dia con que se abre el formulario
  comentarios: Comentario[];
  filas: FilaDetalle[]; // situacion de cada dia
  filtrado: boolean; // con un filtro elegido solo se listan los dias que cumplen
  onCambio: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [asunto, setAsunto] = useState<string>(ASUNTOS_COMENTARIO[1]);
  const [fecha, setFecha] = useState(fechaInicial);
  const [situacion, setSituacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function agregar() {
    setError(null);
    if (!situacion.trim()) {
      setError("Escribe la situación, por favor.");
      return;
    }
    setGuardando(true);
    try {
      const resp = await fetch("/api/comentarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha, asunto, asesora_id: asesoraId, situacion }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setSituacion("");
      setAbierto(false);
      onCambio();
    } catch (err) {
      setError(mensajeAmable(err instanceof Error ? err.message : undefined, "No se pudo guardar el comentario."));
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(id: string) {
    await fetch(`/api/comentarios?id=${id}`, { method: "DELETE" });
    onCambio();
  }

  type Item = { clave: string; fecha: string; fin: string | null; texto: string; color: string | null; comentario?: Comentario };
  const base: Item[] = [
    ...filas.map((r) => ({ clave: `d${r.fecha}`, fecha: r.fecha, fin: r.fin, texto: r.texto, color: r.color })),
    ...(filtrado ? [] : comentarios.map((c) => ({ clave: c.id, fecha: c.fecha, fin: null, texto: c.situacion, color: null, comentario: c }))),
  ];
  const items = [...base].sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.comentario ? 1 : 0) - (b.comentario ? 1 : 0));

  const cuando = (i: Item) => (i.fin && i.fin !== i.fecha ? `${Number(i.fecha.slice(8))}–${Number(i.fin.slice(8))}` : diaTexto(i.fecha));

  return (
    <div className="rounded-xl border border-[#DDE7E8] bg-white p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 text-[12px] font-bold text-[#0B5F6C]">
          Detalle del mes{comentarios.length > 0 && <span className="text-[#6B6D6E] font-semibold"> · {comentarios.length} comentario(s)</span>}
        </div>
        <button onClick={() => setAbierto((v) => !v)} className="rounded-lg bg-[#E4F7F9] text-[#0B5F6C] px-2.5 py-1 text-[11.5px] font-bold">
          {abierto ? "Cerrar" : "+ Comentario"}
        </button>
      </div>

      {abierto && (
        <div className="rounded-lg bg-[#F2F8F9] p-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select value={asunto} onChange={(e) => setAsunto(e.target.value)} className="rounded-lg border border-[#DDE7E8] bg-white p-2 text-[12.5px]">
              {ASUNTOS_COMENTARIO.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={fecha}
              min={`${mes}-01`}
              onChange={(e) => e.target.value && setFecha(e.target.value)}
              className="rounded-lg border border-[#DDE7E8] bg-white p-2 text-[12.5px]"
            />
          </div>
          <input
            value={situacion}
            onChange={(e) => setSituacion(e.target.value)}
            placeholder="Ej: salió una hora antes a la clínica; repone el 28"
            className="w-full rounded-lg border border-[#DDE7E8] bg-white p-2.5 text-[13px]"
          />
          {error && <p className="text-[12px] text-[#B23A3A]">{error}</p>}
          <button
            onClick={agregar}
            disabled={guardando}
            className="w-full rounded-lg py-2 font-bold text-white text-[12.5px] disabled:opacity-50"
            style={{ background: "linear-gradient(150deg, #0B5F6C, #1EA6B8)" }}
          >
            {guardando ? "Guardando…" : "Guardar comentario"}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-[11.5px] text-[#6B6D6E]">{filtrado ? "Ningún día cumple ese filtro." : "Todavía no hay nada que mostrar este mes."}</p>
      ) : (
        <ul className="space-y-1 max-h-72 overflow-y-auto pr-0.5">
          {items.map((i) => (
            <li key={i.clave} className="flex items-start gap-2 rounded-lg bg-[#F2F8F9] px-2.5 py-1.5 text-[12px] leading-snug">
              <span className="flex-none w-[4.5rem] font-bold text-[#0F7A8A] tabular-nums">{cuando(i)}</span>
              <span className="flex-1 min-w-0">
                {i.color && <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-middle" style={{ background: i.color }} />}
                {i.comentario && (
                  <span className="inline-block rounded-full bg-[#CFF0F3] text-[#0B5F6C] px-2 py-0.5 text-[10px] font-bold mr-1">{i.comentario.asunto}</span>
                )}
                {i.texto}
              </span>
              {i.comentario && (
                <button onClick={() => quitar(i.comentario!.id)} className="text-[#B23A3A] text-[11px] font-semibold flex-none">
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
