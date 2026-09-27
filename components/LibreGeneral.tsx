"use client";

import { useState } from "react";
import type { Asesora, DiaEspecial } from "@/lib/tipos";

const SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function diasEnMes(mes: string): number {
  const [anio, m] = mes.split("-").map(Number);
  return new Date(anio, m, 0).getDate();
}

// Lunes = 0 ... domingo = 6.
function diaSemana(iso: string): number {
  return (new Date(`${iso}T12:00:00`).getDay() + 6) % 7;
}

function corto(iso: string): string {
  return `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;
}

/**
 * Libre del mes, de forma general: por defecto, un dia de la semana (martes) para todas las
 * marcadas. Si una semana en particular necesita cambiarse (una cita, por ejemplo), se define
 * la fecha que se quita y la fecha que la reemplaza, y se marca a quien aplicarselo.
 */
export default function LibreGeneral({
  asesoras,
  diasEspeciales,
  mes,
  onCambio,
}: {
  asesoras: Asesora[];
  diasEspeciales: DiaEspecial[]; // del mes que se esta viendo
  mes: string; // YYYY-MM
  onCambio: () => void;
}) {
  const [diaGeneral, setDiaGeneral] = useState(1); // martes
  const [quitarFecha, setQuitarFecha] = useState("");
  const [ponerFecha, setPonerFecha] = useState("");
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

  function especialDe(asesoraId: string, fecha: string) {
    return diasEspeciales.find((d) => d.asesora_id === asesoraId && d.fecha === fecha);
  }

  async function generar() {
    if (marcadas.size === 0) {
      setError("Marca al menos una asesora, por favor.");
      return;
    }
    setError(null);
    setMensaje(null);
    setGuardando(true);
    try {
      const totalDias = diasEnMes(mes);
      let creados = 0;
      let saltados = 0;
      for (const id of marcadas) {
        const asesora = activas.find((a) => a.id === id);
        for (let d = 1; d <= totalDias; d++) {
          const fecha = `${mes}-${String(d).padStart(2, "0")}`;
          if (diaSemana(fecha) !== diaGeneral) continue;
          if (asesora?.fecha_ingreso && fecha < asesora.fecha_ingreso) continue;
          if (asesora?.fecha_baja && fecha > asesora.fecha_baja) continue;
          const existente = especialDe(id, fecha);
          // Una incapacidad o vacaciones ya registrada no se pisa con el libre general.
          if (existente && existente.tipo !== "libre") {
            saltados++;
            continue;
          }
          await fetch("/api/dias-especiales", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ asesora_id: id, tipo: "libre", fecha_desde: fecha, fecha_hasta: fecha }),
          });
          creados++;
        }
      }
      setMensaje(`Listo: ${creados} día(s) libre generado(s)${saltados > 0 ? ` · ${saltados} día(s) ya tenían vacaciones o incapacidad y no se tocaron` : ""}.`);
      onCambio();
    } catch {
      setError("No se pudo generar. Intenta de nuevo, por favor.");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarPuntual() {
    if (!quitarFecha || !ponerFecha) {
      setError("Elige la fecha que se quita y la que la reemplaza, por favor.");
      return;
    }
    if (marcadas.size === 0) {
      setError("Marca al menos una asesora, por favor.");
      return;
    }
    setError(null);
    setMensaje(null);
    setGuardando(true);
    try {
      let cambiadas = 0;
      let sinLibreAhi = 0;
      for (const id of marcadas) {
        const actual = especialDe(id, quitarFecha);
        if (!actual || actual.tipo !== "libre") {
          sinLibreAhi++;
          continue;
        }
        await fetch(`/api/dias-especiales?asesora_id=${id}&fecha=${quitarFecha}`, { method: "DELETE" });
        await fetch("/api/dias-especiales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asesora_id: id, tipo: "libre", fecha_desde: ponerFecha, fecha_hasta: ponerFecha }),
        });
        cambiadas++;
      }
      setMensaje(
        `Listo: se cambió el libre del ${corto(quitarFecha)} al ${corto(ponerFecha)} en ${cambiadas} asesora(s)` +
          (sinLibreAhi > 0 ? ` · ${sinLibreAhi} no tenían libre el ${corto(quitarFecha)} y se dejaron igual` : "") +
          "."
      );
      setMarcadas(new Set());
      onCambio();
    } catch {
      setError("No se pudo cambiar. Intenta de nuevo, por favor.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-[12px] font-bold text-[#0B5F6C]">Libre del mes</div>

      <div className="space-y-2">
        <p className="text-[11px] text-[#6B6D6E] leading-snug">
          Por defecto, el día libre de todas es el martes. Elige el día y marca a quiénes generárselo este mes.
        </p>
        <div className="grid grid-cols-4 gap-1">
          {SEMANA.map((n, i) => (
            <button
              key={n}
              onClick={() => setDiaGeneral(i)}
              className={`rounded-lg py-1.5 text-[11px] font-bold ${diaGeneral === i ? "bg-[#0B5F6C] text-white" : "bg-[#E4F7F9] text-[#0B5F6C]"}`}
            >
              {n.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

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
          </label>
        ))}
      </div>

      {mensaje && <p className="text-[12px] text-[#1E8A5F] font-semibold">{mensaje}</p>}
      {error && <p className="text-[12px] text-[#B23A3A] font-semibold">{error}</p>}

      <button
        onClick={generar}
        disabled={guardando}
        className="w-full rounded-xl py-2.5 font-bold text-white text-[13px] disabled:opacity-50"
        style={{ background: "linear-gradient(150deg, #0B5F6C, #1EA6B8)" }}
      >
        {guardando ? "Generando…" : `Generar los ${SEMANA[diaGeneral].toLowerCase()}s de ${mes.slice(5)}/${mes.slice(0, 4)} para las marcadas`}
      </button>

      <div className="border-t border-[#DDE7E8] pt-3 space-y-2">
        <div className="text-[12px] font-bold text-[#0B5F6C]">Cambiar un libre puntual</div>
        <p className="text-[11px] text-[#6B6D6E] leading-snug">
          Para cuando alguien debe mover su libre esa semana (por ejemplo, una cita médica). Se aplica a quien esté marcada arriba.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">
            Quitar libre de
            <input
              type="date"
              value={quitarFecha}
              min={`${mes}-01`}
              onChange={(e) => setQuitarFecha(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#DDE7E8] p-2 text-[12.5px] normal-case font-normal text-[#14181A]"
            />
          </label>
          <label className="text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">
            Poner libre en
            <input
              type="date"
              value={ponerFecha}
              min={`${mes}-01`}
              onChange={(e) => setPonerFecha(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#DDE7E8] p-2 text-[12.5px] normal-case font-normal text-[#14181A]"
            />
          </label>
        </div>
        <button
          onClick={cambiarPuntual}
          disabled={guardando}
          className="w-full rounded-lg border-2 border-[#1EA6B8] text-[#0B5F6C] py-2 text-[12.5px] font-bold disabled:opacity-50"
        >
          Cambiar en las marcadas
        </button>
      </div>
    </div>
  );
}
