"use client";

import { useState } from "react";
import type { Feriado } from "@/lib/tipos";

const SEMANA = ["LU", "MA", "MI", "JU", "VI", "SA", "DO"];

function diasEnMes(mes: string): number {
  const [anio, m] = mes.split("-").map(Number);
  return new Date(anio, m, 0).getDate();
}

function mesAnterior(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a, m - 2, 1)).toISOString().slice(0, 7);
}

// Lunes = 0 ... domingo = 6.
function primerDiaSemana(mes: string): number {
  return (new Date(`${mes}-01T12:00:00`).getDay() + 6) % 7;
}

/**
 * Calendario para tocar los feriados del mes: mismo estilo que el calendario de cada asesora
 * (encabezado con el mes y flechas, dias de los meses vecinos en gris), para un solo lenguaje
 * visual en toda la app. Incluye un nombre opcional para el proximo feriado que se toque.
 */
export default function CalendarioFeriados({
  mes,
  etiquetaMes,
  onMoverMes,
  feriados,
  onCambio,
}: {
  mes: string; // YYYY-MM
  etiquetaMes: string; // "setiembre de 2026"
  onMoverMes?: (delta: 1 | -1) => void; // si no se pasa, el mes no se puede cambiar desde aqui
  feriados: Feriado[];
  onCambio: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [trabajando, setTrabajando] = useState<string | null>(null);

  async function alternar(fecha: string, yaEsFeriado: boolean) {
    setTrabajando(fecha);
    if (yaEsFeriado) {
      await fetch(`/api/feriados?fecha=${fecha}`, { method: "DELETE" });
    } else {
      await fetch("/api/feriados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha, descripcion: nombre.trim() || null }),
      });
    }
    onCambio();
    setTrabajando(null);
  }

  const totalDias = diasEnMes(mes);
  const feriadosPorFecha = new Map(feriados.map((f) => [f.fecha, f]));
  const primerDia = primerDiaSemana(mes);

  return (
    <div className="space-y-2">
      <div className="w-[228px] rounded-2xl overflow-hidden border border-[#E5E5EA] bg-white">
        <div className="flex items-center justify-between px-2.5 py-2 border-b border-[#E5E5EA]">
          <span className="text-[13px] font-semibold text-[#1C1C1E] capitalize">{etiquetaMes}</span>
          {onMoverMes && (
            <div className="flex flex-col -gap-1 leading-none">
              <button onClick={() => onMoverMes(-1)} className="text-[11px] text-[#0F7A8A] px-1" aria-label="Mes anterior">
                ▲
              </button>
              <button onClick={() => onMoverMes(1)} className="text-[11px] text-[#0F7A8A] px-1" aria-label="Mes siguiente">
                ▼
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-7 text-center">
          {SEMANA.map((l) => (
            <div key={l} className="py-1.5 text-[9px] font-bold text-[#8E8E93]">
              {l}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: primerDia }).map((_, i) => (
            <div key={`v${i}`} className="aspect-square grid place-items-center text-[11px] text-[#C7C7CC]">
              {diasEnMes(mesAnterior(mes)) - primerDia + i + 1}
            </div>
          ))}
          {Array.from({ length: totalDias }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`).map((fecha) => {
            const f = feriadosPorFecha.get(fecha);
            const dia = Number(fecha.slice(8));
            return (
              <button
                key={fecha}
                onClick={() => alternar(fecha, !!f)}
                disabled={trabajando === fecha}
                className="aspect-square relative grid place-items-center disabled:opacity-50"
                aria-label={`Día ${dia}${f ? " (feriado)" : ""}`}
                title={f?.descripcion ?? undefined}
              >
                <span
                  className="w-[26px] h-[26px] grid place-items-center rounded-md text-[12.5px]"
                  style={{ background: f ? "#0B5F6C" : "transparent", color: f ? "#FFFFFF" : "#1C1C1E", fontWeight: f ? 700 : 500 }}
                >
                  {dia}
                </span>
              </button>
            );
          })}
          {Array.from({ length: (7 - ((primerDia + totalDias) % 7)) % 7 }).map((_, i) => (
            <div key={`f${i}`} className="aspect-square grid place-items-center text-[11px] text-[#C7C7CC]">
              {i + 1}
            </div>
          ))}
        </div>
      </div>
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre del feriado (opcional, para el próximo que toques)"
        className="w-full rounded-lg border border-[#DDE7E8] p-2 text-[12.5px]"
      />
    </div>
  );
}
