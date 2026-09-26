"use client";

import { useRef, useState } from "react";

const TAMANO = 216;
const CENTRO = TAMANO / 2;
const R_HORA_EXT = 82;
const R_HORA_INT = 54;
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
 * Selector de hora circular (al estilo del reloj de un dial): primero la hora (1-24, en dos
 * anillos como en los relojes con formato 24 h) y luego el minuto (00-59), arrastrando o
 * tocando el número. Pensado para las marcas manuales, donde conviene ver la hora como un reloj.
 */
export default function SelectorHora({ valor, onCambio }: { valor: string; onCambio: (hhmm: string) => void }) {
  const [hora, minutoStr] = valor.split(":");
  const minuto = Number(minutoStr ?? 0);
  const [paso, setPaso] = useState<"hora" | "minuto">("hora");
  const arrastrando = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  function elegirHora(h: number) {
    onCambio(`${String(h).padStart(2, "0")}:${minutoStr ?? "00"}`);
    setPaso("minuto");
  }

  function elegirMinuto(m: number) {
    onCambio(`${hora}:${String(m).padStart(2, "0")}`);
  }

  function alMover(e: React.PointerEvent<SVGSVGElement>) {
    if (!arrastrando.current || paso !== "minuto") return;
    elegirMinuto(minutoDesdeToque(e.clientX, e.clientY, e.currentTarget));
  }

  const horaNum = Number(hora || 0);

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div className="flex items-center gap-1 text-[28px] font-extrabold text-[#0B5F6C] tabular-nums">
        <button
          onClick={() => setPaso("hora")}
          className={`px-2 py-0.5 rounded-lg ${paso === "hora" ? "bg-[#E4F7F9]" : ""}`}
        >
          {hora || "--"}
        </button>
        <span>:</span>
        <button
          onClick={() => setPaso("minuto")}
          className={`px-2 py-0.5 rounded-lg ${paso === "minuto" ? "bg-[#E4F7F9]" : ""}`}
        >
          {minutoStr ?? "--"}
        </button>
      </div>

      <svg
        ref={svgRef}
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
            {/* Manecilla hacia la hora elegida (anillo exterior 1-12, interior 13-24/00) */}
            {hora !== "" && (() => {
              const enAnilloInterior = horaNum > 12 || horaNum === 0;
              const p = posicion(enAnilloInterior ? R_HORA_INT : R_HORA_EXT, ((horaNum % 12) || 12) / 12);
              return <line x1={CENTRO} y1={CENTRO} x2={p.x} y2={p.y} stroke="#1EA6B8" strokeWidth={2} />;
            })()}
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => {
              const p = posicion(R_HORA_EXT, h / 12);
              const activo = horaNum === h;
              return (
                <g key={`ext${h}`} onClick={() => elegirHora(h)} className="cursor-pointer">
                  <circle cx={p.x} cy={p.y} r={15} fill={activo ? "#0B5F6C" : "transparent"} />
                  <text x={p.x} y={p.y + 4.5} textAnchor="middle" fontSize={13} fontWeight={700} fill={activo ? "#FFFFFF" : "#0B5F6C"}>
                    {h}
                  </text>
                </g>
              );
            })}
            {[13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0].map((h) => {
              const p = posicion(R_HORA_INT, (h === 0 ? 12 : h - 12) / 12);
              const activo = horaNum === h;
              return (
                <g key={`int${h}`} onClick={() => elegirHora(h)} className="cursor-pointer">
                  <circle cx={p.x} cy={p.y} r={12.5} fill={activo ? "#0B5F6C" : "transparent"} />
                  <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize={10.5} fontWeight={700} fill={activo ? "#FFFFFF" : "#6B6D6E"}>
                    {String(h).padStart(2, "0")}
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
