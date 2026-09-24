"use client";

import { useState } from "react";
import { MOTIVOS_CORRECCION } from "@/lib/tipos";
import { horaAMinutos, MINUTOS_JORNADA_TOTAL } from "@/lib/tiempo";
import { mensajeAmable } from "@/lib/mensajes";

function aHHMM(min: number): string {
  return `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/**
 * Nuria corrige la hora de entrada y/o salida de una asesora en un dia (por ejemplo, para
 * completar la jornada de quien se fue antes por una cita medica). Se guarda la hora original
 * de la foto y el motivo como constancia.
 */
export default function CorregirHoras({
  asesoraId,
  nombre,
  fecha,
  entrada,
  salida,
  entradaOriginal,
  salidaOriginal,
  motivoPrevio,
  onGuardado,
  onCerrar,
}: {
  asesoraId: string;
  nombre: string;
  fecha: string;
  entrada: string | null;
  salida: string | null;
  entradaOriginal?: string | null;
  salidaOriginal?: string | null;
  motivoPrevio?: string | null;
  onGuardado: () => void;
  onCerrar: () => void;
}) {
  const [nuevaEntrada, setNuevaEntrada] = useState(entrada ?? "");
  const [nuevaSalida, setNuevaSalida] = useState(salida ?? "");
  const [motivo, setMotivo] = useState<string>(MOTIVOS_CORRECCION[0]);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const huboCambio = (nuevaEntrada || null) !== (entrada ?? null) || (nuevaSalida || null) !== (salida ?? null);
  const salidaSugerida = nuevaEntrada ? aHHMM(horaAMinutos(nuevaEntrada) + MINUTOS_JORNADA_TOTAL) : null;

  async function guardar() {
    setError(null);
    if (nuevaEntrada && nuevaSalida && nuevaSalida <= nuevaEntrada) {
      setError("La salida debe ser posterior a la entrada, por favor.");
      return;
    }
    if (!huboCambio) {
      setError("Todavía no cambiaste ninguna hora.");
      return;
    }
    const motivoFinal = motivo === "Otro" ? nota.trim() || "Otro" : nota.trim() ? `${motivo} · ${nota.trim()}` : motivo;
    setGuardando(true);
    try {
      const cuerpo: Record<string, unknown> = { asesora_id: asesoraId, fecha, motivo: motivoFinal };
      if ((nuevaEntrada || null) !== (entrada ?? null)) cuerpo.entrada = nuevaEntrada || null;
      if ((nuevaSalida || null) !== (salida ?? null)) cuerpo.salida = nuevaSalida || null;

      const resp = await fetch("/api/marcas/corregir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      onGuardado();
    } catch (err) {
      setError(mensajeAmable(err instanceof Error ? err.message : undefined, "No se pudo guardar la corrección."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-[#1EA6B8] bg-[#F8FBFB] p-3 space-y-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-bold text-[#0B5F6C]">Corregir horas</div>
          <div className="text-[11.5px] text-[#6B6D6E] truncate">{nombre}</div>
        </div>
        <button onClick={onCerrar} className="text-[12px] text-[#6B6D6E] font-semibold px-1">
          Cerrar
        </button>
      </div>

      {(entradaOriginal || salidaOriginal) && (
        <p className="text-[11.5px] text-[#0B5F6C] bg-[#E4F7F9] rounded-lg px-2.5 py-1.5 leading-snug">
          Ya se había corregido antes. Según la foto: entrada {entradaOriginal ?? entrada ?? "—"}, salida{" "}
          {salidaOriginal ?? salida ?? "—"}
          {motivoPrevio ? ` · ${motivoPrevio}` : ""}.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">
          Entrada
          <input
            type="time"
            value={nuevaEntrada}
            onChange={(e) => setNuevaEntrada(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#DDE7E8] bg-white p-2.5 text-[16px] font-bold text-[#14181A]"
          />
        </label>
        <label className="text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">
          Salida
          <input
            type="time"
            value={nuevaSalida}
            onChange={(e) => setNuevaSalida(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#DDE7E8] bg-white p-2.5 text-[16px] font-bold text-[#14181A]"
          />
        </label>
      </div>

      {salidaSugerida && (
        <button
          onClick={() => setNuevaSalida(salidaSugerida)}
          className="w-full rounded-lg bg-[#E4F7F9] text-[#0B5F6C] py-2 text-[12.5px] font-semibold"
        >
          Completar la jornada (salida {salidaSugerida}, 9 h después de la entrada)
        </button>
      )}

      <label className="block text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">
        Motivo del permiso
        <select
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[#DDE7E8] bg-white p-2.5 text-[13px] normal-case font-normal text-[#14181A]"
        >
          {MOTIVOS_CORRECCION.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>

      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Detalle (opcional)"
        className="w-full rounded-lg border border-[#DDE7E8] bg-white p-2.5 text-[13px]"
      />

      <p className="text-[11px] text-[#6B6D6E] leading-snug">
        Se guarda la hora original de la foto y el motivo como constancia. Dejar una hora vacía quita esa marca.
      </p>

      {error && <p className="text-[12px] text-[#B23A3A] font-semibold">{error}</p>}

      <button
        onClick={guardar}
        disabled={guardando}
        className="w-full rounded-xl py-2.5 font-bold text-white text-[13px] disabled:opacity-50"
        style={{ background: "linear-gradient(150deg, #0B5F6C, #1EA6B8)" }}
      >
        {guardando ? "Guardando…" : "Guardar corrección"}
      </button>
    </div>
  );
}
