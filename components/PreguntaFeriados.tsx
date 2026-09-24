"use client";

import { useCallback, useEffect, useState } from "react";
import type { Feriado } from "@/lib/tipos";
import { mensajeAmable } from "@/lib/mensajes";

const NOMBRE_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Pregunta a Nuria cuales dias del mes son feriado. Mientras no responda, la app
 * no reporta ausencias de ese mes (casi todas se toman el feriado; solo se
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
  const [fecha, setFecha] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

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

  async function agregar() {
    if (!fecha) return;
    setTrabajando(true);
    setError(null);
    await fetch("/api/feriados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha, descripcion: descripcion || null }),
    });
    setFecha("");
    setDescripcion("");
    await cargar();
    onCambio?.();
    setTrabajando(false);
  }

  async function quitar(f: string) {
    await fetch(`/api/feriados?fecha=${f}`, { method: "DELETE" });
    await cargar();
    onCambio?.();
  }

  async function sinFeriados() {
    setTrabajando(true);
    setError(null);
    const resp = await fetch("/api/feriados/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mes }),
    });
    if (!resp.ok) {
      const data = await resp.json();
      setError(mensajeAmable(data.error, "No se pudo guardar."));
    } else {
      setVisible(false);
      onCambio?.();
    }
    setTrabajando(false);
  }

  if (!visible) return null;

  const nombreMes = NOMBRE_MES[Number(mes.split("-")[1]) - 1];

  return (
    <div className="rounded-xl bg-[#35DCEC] p-3.5 space-y-2.5 text-[#0B3A41]">
      <div className="font-extrabold text-[13.5px]">Nuria, antes de revisar {nombreMes}: ¿hay feriados?</div>
      <p className="text-[12px] leading-snug">
        ¿Me ayudas indicando cuáles días fueron feriado, por favor? Así reporto solo a quienes
        trabajaron. Mientras tanto, no marcaré ausencias de este mes.
      </p>

      {feriados.length > 0 && (
        <div className="space-y-1">
          {feriados.map((f) => (
            <div key={f.id} className="flex items-center justify-between bg-white/70 rounded-lg px-2.5 py-1.5 text-[12px]">
              <span>
                {Number(f.fecha.split("-")[2])} de {nombreMes}
                {f.descripcion ? ` — ${f.descripcion}` : ""}
              </span>
              <button onClick={() => quitar(f.fecha)} className="text-[#B23A3A] font-semibold text-[11px]">
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={fecha}
          min={`${mes}-01`}
          max={`${mes}-31`}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded-lg border border-white/60 bg-white p-2 text-[13px] text-[#14181A]"
        />
        <input
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Nombre (opcional)"
          className="rounded-lg border border-white/60 bg-white p-2 text-[13px] text-[#14181A]"
        />
      </div>

      {error && <p className="text-[12px] text-[#8A1F1F] font-semibold">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={agregar}
          disabled={!fecha || trabajando}
          className="flex-1 rounded-lg bg-[#0B5F6C] text-white py-2.5 text-[12.5px] font-bold disabled:opacity-50"
        >
          Agregar feriado
        </button>
        <button
          onClick={feriados.length > 0 ? () => { setVisible(false); onCambio?.(); } : sinFeriados}
          disabled={trabajando}
          className="flex-1 rounded-lg bg-white text-[#0B5F6C] py-2.5 text-[12.5px] font-bold disabled:opacity-50"
        >
          {feriados.length > 0 ? "Listo, esos son todos" : "No hay feriados"}
        </button>
      </div>
    </div>
  );
}
