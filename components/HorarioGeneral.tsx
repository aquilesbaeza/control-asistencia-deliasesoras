"use client";

import { useState } from "react";
import type { Asesora } from "@/lib/tipos";
import { horaAmPm } from "@/lib/tiempo";
import SelectorHora from "@/components/SelectorHora";

/**
 * Define un horario (entrada y salida) y lo aplica de una vez a las asesoras que se marquen:
 * para el horario general que usa la mayoria. A quien no se marque aqui se le define su horario
 * especial una por una, con "Mover" en su tarjeta.
 */
export default function HorarioGeneral({ asesoras, onCambio }: { asesoras: Asesora[]; onCambio: () => void }) {
  const [entrada, setEntrada] = useState("10:00");
  const [salida, setSalida] = useState("19:00");
  const [editando, setEditando] = useState<"entrada" | "salida" | null>(null);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activas = asesoras.filter((a) => a.activo).sort((a, b) => a.punto.localeCompare(b.punto, "es") || a.nombre.localeCompare(b.nombre, "es"));

  function alternar(id: string) {
    setMarcadas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function marcarTodas(marcar: boolean) {
    setMarcadas(marcar ? new Set(activas.map((a) => a.id)) : new Set());
  }

  async function aplicar() {
    if (marcadas.size === 0) {
      setError("Marca al menos una asesora, por favor.");
      return;
    }
    setError(null);
    setMensaje(null);
    setGuardando(true);
    try {
      for (const id of marcadas) {
        await fetch(`/api/asesoras/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hora_entrada: entrada, hora_salida: salida }),
        });
      }
      setMensaje(`Horario aplicado a ${marcadas.size} asesora(s).`);
      setMarcadas(new Set());
      onCambio();
    } catch {
      setError("No se pudo aplicar el horario. Intenta de nuevo, por favor.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="text-[12px] font-bold text-[#0B5F6C]">Horario general (entrada y salida)</div>
      <p className="text-[11px] text-[#6B6D6E] leading-snug">
        Define aquí el horario que usa la mayoría y marca a quiénes aplicárselo de una vez. A quien tenga un horario especial por la
        tienda, no la marques: defínele el suyo con «Mover» en su tarjeta.
      </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setEditando(editando === "entrada" ? null : "entrada")}
            className={`rounded-lg py-2 text-[12.5px] font-bold ${editando === "entrada" ? "bg-[#0B5F6C] text-white" : "bg-[#E4F7F9] text-[#0B5F6C]"}`}
          >
            Entrada
            <span className="block text-[13px]">{horaAmPm(entrada)}</span>
          </button>
          <button
            onClick={() => setEditando(editando === "salida" ? null : "salida")}
            className={`rounded-lg py-2 text-[12.5px] font-bold ${editando === "salida" ? "bg-[#0B5F6C] text-white" : "bg-[#E4F7F9] text-[#0B5F6C]"}`}
          >
            Salida
            <span className="block text-[13px]">{horaAmPm(salida)}</span>
          </button>
        </div>

        {editando && (
          <div className="flex justify-center py-1">
            <SelectorHora valor={editando === "entrada" ? entrada : salida} onCambio={editando === "entrada" ? setEntrada : setSalida} />
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">Aplicar a</span>
          <div className="flex gap-2 text-[11px] font-semibold text-[#0F7A8A]">
            <button onClick={() => marcarTodas(true)}>Marcar todas</button>
            <button onClick={() => marcarTodas(false)}>Ninguna</button>
          </div>
        </div>

        <div className="max-h-52 overflow-y-auto space-y-1 rounded-lg border border-[#DDE7E8] p-1.5">
          {activas.map((a) => (
            <label key={a.id} className="flex items-center gap-2 px-1.5 py-1 rounded-lg text-[12px]">
              <input type="checkbox" checked={marcadas.has(a.id)} onChange={() => alternar(a.id)} className="flex-none w-4 h-4" />
              <span className="flex-1 min-w-0 truncate">
                {a.nombre} <span className="text-[#6B6D6E]">· {a.punto}</span>
              </span>
              <span className="flex-none text-[10.5px] text-[#6B6D6E] tabular-nums">
                {a.hora_entrada ? `${horaAmPm(a.hora_entrada)}–${a.hora_salida ? horaAmPm(a.hora_salida) : "?"}` : "sin horario"}
              </span>
            </label>
          ))}
        </div>

        {mensaje && <p className="text-[12px] text-[#1E8A5F] font-semibold">{mensaje}</p>}
        {error && <p className="text-[12px] text-[#B23A3A] font-semibold">{error}</p>}

        <button
          onClick={aplicar}
          disabled={guardando}
          className="w-full rounded-xl py-2.5 font-bold text-white text-[13px] disabled:opacity-50"
          style={{ background: "linear-gradient(150deg, #0B5F6C, #1EA6B8)" }}
        >
          {guardando ? "Aplicando…" : `Aplicar a ${marcadas.size || ""} marcada(s)`.replace("  ", " ")}
        </button>
    </div>
  );
}
