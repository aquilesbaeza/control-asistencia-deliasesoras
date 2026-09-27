"use client";

import { useCallback, useEffect, useState } from "react";
import type { Feriado } from "@/lib/tipos";
import CalendarioFeriados from "@/components/CalendarioFeriados";

const NOMBRE_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Pregunta a Nuria cuales dias del mes son feriado, tocandolos en el calendario. Mientras no
 * responda, la app no reporta ausencias de ese mes (casi todas se toman el feriado; solo se
 * reportan las que lo trabajaron, que cobran doble).
 */
export default function PreguntaFeriados({
  mes,
  onCambio,
}: {
  mes: string; // YYYY-MM
  onCambio?: () => void;
}) {
  const [visible, setVisible] = useState<boolean | null>(null);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [confirmando, setConfirmando] = useState(false);

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/feriados?mes=${mes}`).then((x) => x.json());
    setFeriados(r.feriados ?? []);
    // Solo decide al inicio si preguntar; despues se cierra con los botones.
    setVisible((prev) => (prev === null ? !r.confirmado : prev));
  }, [mes]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  async function sinFeriados() {
    setConfirmando(true);
    await fetch("/api/feriados/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mes }),
    });
    setVisible(false);
    onCambio?.();
    setConfirmando(false);
  }

  if (!visible) return null;

  const nombreMes = NOMBRE_MES[Number(mes.split("-")[1]) - 1];

  return (
    <div className="rounded-xl bg-[#35DCEC] p-3.5 space-y-2.5 text-[#0B3A41]">
      <div className="font-extrabold text-[13.5px]">Nuria, antes de revisar {nombreMes}: ¿hay feriados?</div>
      <p className="text-[12px] leading-snug">
        Toca en el calendario los días que fueron feriado, por favor. Así reporto solo a quienes trabajaron. Mientras
        tanto, no marcaré ausencias de este mes.
      </p>

      <CalendarioFeriados
        mes={mes}
        feriados={feriados}
        onCambio={async () => {
          await cargar();
          onCambio?.();
        }}
      />

      {feriados.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {feriados.map((f) => (
            <span key={f.id} className="bg-white/70 rounded-full px-2.5 py-1 text-[11px] font-semibold">
              {Number(f.fecha.split("-")[2])} de {nombreMes}
              {f.descripcion ? ` — ${f.descripcion}` : ""}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={feriados.length > 0 ? () => { setVisible(false); onCambio?.(); } : sinFeriados}
        disabled={confirmando}
        className="w-full rounded-lg bg-[#0B5F6C] text-white py-2.5 text-[12.5px] font-bold disabled:opacity-50"
      >
        {feriados.length > 0 ? "Listo, esos son todos" : "No hay feriados"}
      </button>
    </div>
  );
}
