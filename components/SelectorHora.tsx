"use client";

import { useRef, useState } from "react";

const TAMANO = 216;
const CENTRO = TAMANO / 2;
const R_HORA = 82;
const R_MIN = 82;

function posicion(radio: number, fraccion: number): { x: number; y: number } {
  const angulo = fraccion * 2 * Math.PI - Math.PI / 2;
  return { x: CENTRO + radio * Math.cos(angulo), y: CENTRO + radio * Math.sin(angulo) };
}

/** Minuto (0-59) mas cercano al angulo del puntero sobre el circulo de minutos. */
function minutoDesdeToque(cx: number, cy: number, elemento: SVGSVGElement): number {
  const rect = elemento.getBoundingClientRect();
  const escala = TAMANO / rect.width;
  const x = (cx - rect.left) * escala - CENTRO;
  const y = (cy - rect.top) * escala - CENTRO;
  let angulo = Math.atan2(y, x) + Math.PI / 2;
  if (angulo < 0) angulo += 2 * Math.PI;
  return Math.round((angulo / (2 * Math.PI)) * 60) % 60;
}

/**
 * Selector de hora circular en formato 12 h (como un reloj comun, con AM/PM), aunque por dentro
 * el valor se guarda siempre en 24 h (HH:MM). Primero la hora, luego el minuto, tocando el numero
 * o arrastrando el dedo. Pensado para las marcas manuales y para corregir horas.
 */
export default function SelectorHora({ valor, onCambio }: { valor: string; onCambio: (hhmm: string) => void }) {
  const [horaStr, minutoStr] = valor.split(":");
  const hora24 = Number(horaStr || 0);
  const minuto = Number(minutoStr ?? 0);
  const esPM = hora24 >= 12;
  const hora12 = hora24 % 12 === 0 ? 12 : hora24 % 12;
  const [paso, setPaso] = useState<"hora" | "minuto">("hora");
  const arrastrando = useRef(false);

  function fijarHora24(nuevaHora24: number) {
    onCambio(`${String(nuevaHora24).padStart(2, "0")}:${minutoStr ?? "00"}`);
  }

  function elegirHora12(h12: number) {
    const h24 = esPM ? (h12 === 12 ? 12 : h12 + 12) : h12 === 12 ? 0 : h12;
    fijarHora24(h24);
    setPaso("minuto");
  }

  function elegirAmPm(pm: boolean) {
    if (pm === esPM) return;
    fijarHora24(pm ? (hora12 === 12 ? 12 : hora12 + 12) : hora12 === 12 ? 0 : hora12);
  }

  function elegirMinuto(m: number) {
    onCambio(`${horaStr}:${String(m).padStart(2, "0")}`);
  }

  function alMover(e: React.PointerEvent<SVGSVGElement>) {
    if (!arrastrando.current || paso !== "minuto") return;
    elegirMinuto(minutoDesdeToque(e.clientX, e.clientY, e.currentTarget));
  }

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1 text-[28px] font-extrabold text-[#0B5F6C] tabular-nums">
          <button onClick={() => setPaso("hora")} className={`px-2 py-0.5 rounded-lg ${paso === "hora" ? "bg-[#E4F7F9]" : ""}`}>
            {horaStr ? hora12 : "--"}
          </button>
          <span>:</span>
          <button onClick={() => setPaso("minuto")} className={`px-2 py-0.5 rounded-lg ${paso === "minuto" ? "bg-[#E4F7F9]" : ""}`}>
            {minutoStr ?? "--"}
          </button>
        </div>
        <div className="flex flex-col gap-0.5">
          {(["AM", "PM"] as const).map((p) => (
            <button
              key={p}
              onClick={() => elegirAmPm(p === "PM")}
              className={`w-9 py-1 rounded-md text-[11px] font-bold ${
                (p === "PM") === esPM ? "bg-[#0B5F6C] text-white" : "bg-[#E4F7F9] text-[#0B5F6C]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <svg
        width={TAMANO}
        height={TAMANO}
        viewBox={`0 0 ${TAMANO} ${TAMANO}`}
        className="touch-none"
        onPointerDown={(e) => {
          if (paso !== "minuto") return;
          arrastrando.current = true;
          elegirMinuto(minutoDesdeToque(e.clientX, e.clientY, e.currentTarget));
        }}
        onPointerMove={alMover}
        onPointerUp={() => (arrastrando.current = false)}
        onPointerLeave={() => (arrastrando.current = false)}
      >
        <circle cx={CENTRO} cy={CENTRO} r={CENTRO - 2} fill="#F2F8F9" />
        <circle cx={CENTRO} cy={CENTRO} r={3} fill="#0B5F6C" />

        {paso === "hora" ? (
          <>
            {horaStr !== "" && (() => {
              const p = posicion(R_HORA, hora12 / 12);
              return <line x1={CENTRO} y1={CENTRO} x2={p.x} y2={p.y} stroke="#1EA6B8" strokeWidth={2} />;
            })()}
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => {
              const p = posicion(R_HORA, h / 12);
              const activo = horaStr !== "" && hora12 === h;
              return (
                <g key={h} onClick={() => elegirHora12(h)} className="cursor-pointer">
                  <circle cx={p.x} cy={p.y} r={16} fill={activo ? "#0B5F6C" : "transparent"} />
                  <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize={15} fontWeight={700} fill={activo ? "#FFFFFF" : "#0B5F6C"}>
                    {h}
                  </text>
                </g>
              );
            })}
          </>
        ) : (
          <>
            <line x1={CENTRO} y1={CENTRO} x2={posicion(R_MIN, minuto / 60).x} y2={posicion(R_MIN, minuto / 60).y} stroke="#1EA6B8" strokeWidth={2} />
            {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => {
              const p = posicion(R_MIN, m / 60);
              const activo = minuto === m;
              return (
                <g key={m} onClick={() => elegirMinuto(m)} className="cursor-pointer">
                  <circle cx={p.x} cy={p.y} r={15} fill={activo ? "#0B5F6C" : "transparent"} />
                  <text x={p.x} y={p.y + 4.5} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={activo ? "#FFFFFF" : "#0B5F6C"}>
                    {String(m).padStart(2, "0")}
                  </text>
                </g>
              );
            })}
            {/* El punto de la manecilla, para elegir un minuto exacto arrastrando entre los numeros */}
            <circle cx={posicion(R_MIN, minuto / 60).x} cy={posicion(R_MIN, minuto / 60).y} r={5} fill="#0B5F6C" />
          </>
        )}
      </svg>

      <div className="flex gap-3 text-[11.5px] font-semibold text-[#6B6D6E]">
        <button onClick={() => setPaso("hora")} className={paso === "hora" ? "text-[#0B5F6C]" : ""}>
          1. Hora
        </button>
        <button onClick={() => setPaso("minuto")} className={paso === "minuto" ? "text-[#0B5F6C]" : ""}>
          2. Minuto
        </button>
      </div>
    </div>
  );
}
