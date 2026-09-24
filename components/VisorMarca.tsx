"use client";

import { useState } from "react";

export type ItemCaptura = {
  id: number;
  hash: string;
  previewUrl: string;
  estado: "leyendo" | "listo" | "error";
  asesora_id: string;
  candidatos: { id: string; nombre: string; punto: string; score: number }[];
  fecha: string;
  hora: string;
  tipo: "entrada" | "salida";
  base64: string;
  confianza: string | null;
  horaLeida: boolean;
  fechaLeida: boolean;
  confirmado: boolean; // Nuria ya reviso esta foto
};

const ZOOMS = [1, 1.75, 2.5, 4];

/**
 * Visor a pantalla completa de una foto del lote: zoom para verificar la hora
 * del reloj y correccion de asesora, fecha, hora y tipo en el mismo lugar.
 */
export default function VisorMarca({
  item,
  posicion,
  total,
  razones,
  opciones,
  onCambio,
  onAnterior,
  onSiguiente,
  onCerrar,
}: {
  item: ItemCaptura;
  posicion: number;
  total: number;
  razones: string[];
  opciones: { id: string; nombre: string; punto: string }[];
  onCambio: (cambios: Partial<ItemCaptura>) => void;
  onAnterior?: () => void;
  onSiguiente?: () => void;
  onCerrar: () => void;
}) {
  const [zoomIdx, setZoomIdx] = useState(0);
  const zoom = ZOOMS[zoomIdx];

  function alternarZoom() {
    setZoomIdx((i) => (i === 0 ? 2 : 0));
  }

  function estaBien() {
    onCambio({ confirmado: true });
    if (onSiguiente) onSiguiente();
    else onCerrar();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0B5F6C] text-white">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex-1 text-[13px] font-bold">
          Foto {posicion} de {total}
        </div>
        <button
          onClick={onCerrar}
          className="rounded-lg bg-white/15 px-3.5 py-1.5 text-[13px] font-semibold"
        >
          Cerrar
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto bg-[#094A55]" style={{ touchAction: "pan-x pan-y" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.previewUrl}
          alt="Foto de la marca"
          onDoubleClick={alternarZoom}
          style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
          className="block"
        />
      </div>

      <div className="flex items-center justify-center gap-2 px-3 py-2">
        <button
          onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
          disabled={zoomIdx === 0}
          className="w-10 h-10 rounded-lg bg-white/15 text-lg font-bold disabled:opacity-40"
          aria-label="Alejar"
        >
          −
        </button>
        <button onClick={() => setZoomIdx(0)} className="min-w-16 text-[12px] font-semibold">
          {Math.round(zoom * 100)}%
        </button>
        <button
          onClick={() => setZoomIdx((i) => Math.min(ZOOMS.length - 1, i + 1))}
          disabled={zoomIdx === ZOOMS.length - 1}
          className="w-10 h-10 rounded-lg bg-white/15 text-lg font-bold disabled:opacity-40"
          aria-label="Acercar"
        >
          +
        </button>
        <span className="text-[11px] text-white/70 ml-1">Toca 2 veces para acercar</span>
      </div>

      <div className="bg-white text-[#14181A] rounded-t-2xl p-3 space-y-2.5 max-h-[52%] overflow-auto">
        {razones.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {razones.map((r) => (
              <span key={r} className="rounded-full bg-[#35DCEC] text-[#0B3A41] px-2.5 py-1 text-[11px] font-bold">
                {r}
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">
            Hora
            <input
              type="time"
              value={item.hora}
              onChange={(e) => onCambio({ hora: e.target.value, confirmado: true })}
              className="mt-1 w-full rounded-lg border-2 border-[#1EA6B8] p-2.5 text-[18px] font-bold text-[#14181A]"
            />
          </label>
          <label className="text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">
            Fecha
            <input
              type="date"
              value={item.fecha}
              onChange={(e) => onCambio({ fecha: e.target.value, confirmado: true })}
              className="mt-1 w-full rounded-lg border border-[#DDE7E8] p-2.5 text-[14px] font-normal text-[#14181A]"
            />
          </label>
        </div>

        <label className="block text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">
          Asesora
          <select
            value={item.asesora_id}
            onChange={(e) => onCambio({ asesora_id: e.target.value, estado: "listo" })}
            className="mt-1 w-full rounded-lg border border-[#DDE7E8] p-2.5 text-[14px] font-normal normal-case text-[#14181A]"
          >
            <option value="">-- Elige la asesora --</option>
            {opciones.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre} ({a.punto})
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-1.5">
          {(["entrada", "salida"] as const).map((t) => (
            <button
              key={t}
              onClick={() => onCambio({ tipo: t, confirmado: true })}
              className={`flex-1 rounded-lg py-2.5 text-[13px] font-semibold ${
                item.tipo === t ? "bg-[#0B5F6C] text-white" : "bg-[#E4F7F9] text-[#0B5F6C]"
              }`}
            >
              {t === "entrada" ? "Entrada" : "Salida"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={onAnterior}
            disabled={!onAnterior}
            className="rounded-lg bg-[#E4F7F9] text-[#0B5F6C] py-2.5 text-[13px] font-semibold disabled:opacity-40"
          >
            ‹ Anterior
          </button>
          <button
            onClick={estaBien}
            className="rounded-lg text-white py-2.5 text-[13px] font-bold"
            style={{ background: "linear-gradient(150deg, #0B5F6C, #1EA6B8)" }}
          >
            Está bien ✓
          </button>
          <button
            onClick={onSiguiente}
            disabled={!onSiguiente}
            className="rounded-lg bg-[#E4F7F9] text-[#0B5F6C] py-2.5 text-[13px] font-semibold disabled:opacity-40"
          >
            Siguiente ›
          </button>
        </div>
      </div>
    </div>
  );
}
