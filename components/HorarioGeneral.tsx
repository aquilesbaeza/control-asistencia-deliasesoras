"use client";

import { useState } from "react";
import type { Asesora, DiaEspecial } from "@/lib/tipos";
import { horaAmPm } from "@/lib/tiempo";
import SelectorHora from "@/components/SelectorHora";

const SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

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
 * Define, para una sola lista de asesoras marcadas, su horario (entrada y salida) y su día libre
 * por defecto del mes. A quien no se marque aquí se le define lo suyo una por una, con "Mover" en
 * su tarjeta o tocando el calendario. Abajo, un cambio puntual del libre (de una fecha a otra) para
 * cuando alguien lo mueve por una cita.
 */
export default function HorarioGeneral({
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
  const [entrada, setEntrada] = useState("10:00");
  const [salida, setSalida] = useState("19:00");
  const [editando, setEditando] = useState<"entrada" | "salida" | null>(null);
  const [aplicarHorario, setAplicarHorario] = useState(true);
  const [aplicarLibre, setAplicarLibre] = useState(true);
  const [diaLibre, setDiaLibre] = useState(1); // martes
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [quitarFecha, setQuitarFecha] = useState("");
  const [ponerFecha, setPonerFecha] = useState("");
  const [guardandoCambio, setGuardandoCambio] = useState(false);
  const [mensajeCambio, setMensajeCambio] = useState<string | null>(null);
  const [errorCambio, setErrorCambio] = useState<string | null>(null);

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

  async function aplicar() {
    if (marcadas.size === 0) {
      setError("Marca al menos una asesora, por favor.");
      return;
    }
    if (!aplicarHorario && !aplicarLibre) {
      setError("Elige si aplicar el horario, el libre, o ambos.");
      return;
    }
    setError(null);
    setMensaje(null);
    setGuardando(true);
    try {
      let libresCreados = 0;
      let libresSaltados = 0;
      for (const id of marcadas) {
        if (aplicarHorario) {
          await fetch(`/api/asesoras/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hora_entrada: entrada, hora_salida: salida }),
          });
        }
        if (aplicarLibre) {
          const asesora = activas.find((a) => a.id === id);
          const totalDias = diasEnMes(mes);
          for (let d = 1; d <= totalDias; d++) {
            const fecha = `${mes}-${String(d).padStart(2, "0")}`;
            if (diaSemana(fecha) !== diaLibre) continue;
            if (asesora?.fecha_ingreso && fecha < asesora.fecha_ingreso) continue;
            if (asesora?.fecha_baja && fecha > asesora.fecha_baja) continue;
            const existente = especialDe(id, fecha);
            // Una incapacidad o vacaciones ya registrada no se pisa con el libre general.
            if (existente && existente.tipo !== "libre") {
              libresSaltados++;
              continue;
            }
            await fetch("/api/dias-especiales", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ asesora_id: id, tipo: "libre", fecha_desde: fecha, fecha_hasta: fecha }),
            });
            libresCreados++;
          }
        }
      }
      const partes: string[] = [];
      if (aplicarHorario) partes.push(`horario en ${marcadas.size} asesora(s)`);
      if (aplicarLibre) partes.push(`${libresCreados} día(s) libre generado(s)${libresSaltados > 0 ? ` (${libresSaltados} ya tenían vacaciones o incapacidad y se dejaron así)` : ""}`);
      setMensaje(`Listo: ${partes.join(" · ")}.`);
      onCambio();
    } catch {
      setError("No se pudo aplicar. Intenta de nuevo, por favor.");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarPuntual() {
    if (!quitarFecha || !ponerFecha) {
      setErrorCambio("Elige la fecha que se quita y la que la reemplaza, por favor.");
      return;
    }
    if (marcadas.size === 0) {
      setErrorCambio("Marca al menos una asesora, por favor.");
      return;
    }
    setErrorCambio(null);
    setMensajeCambio(null);
    setGuardandoCambio(true);
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
      setMensajeCambio(
        `Listo: se cambió el libre del ${corto(quitarFecha)} al ${corto(ponerFecha)} en ${cambiadas} asesora(s)` +
          (sinLibreAhi > 0 ? ` · ${sinLibreAhi} no tenían libre el ${corto(quitarFecha)} y se dejaron igual` : "") +
          "."
      );
      onCambio();
    } catch {
      setErrorCambio("No se pudo cambiar. Intenta de nuevo, por favor.");
    } finally {
      setGuardandoCambio(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="text-[12px] font-bold text-[#0B5F6C]">Horario y libre general</div>
      <p className="text-[11px] text-[#6B6D6E] leading-snug">
        Define aquí lo que usa la mayoría y marca a quiénes aplicárselo de una vez. A quien tenga algo especial, no la
        marques: defínele lo suyo una por una, con «Mover» o tocando su calendario.
      </p>

      <label className="flex items-center gap-2 text-[11.5px] font-semibold text-[#0B5F6C]">
        <input type="checkbox" checked={aplicarHorario} onChange={(e) => setAplicarHorario(e.target.checked)} className="w-4 h-4" />
        Horario (entrada y salida)
      </label>
      {aplicarHorario && (
        <>
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
        </>
      )}

      <label className="flex items-center gap-2 text-[11.5px] font-semibold text-[#0B5F6C]">
        <input type="checkbox" checked={aplicarLibre} onChange={(e) => setAplicarLibre(e.target.checked)} className="w-4 h-4" />
        Día libre del mes
      </label>
      {aplicarLibre && (
        <div className="grid grid-cols-7 gap-1">
          {SEMANA.map((n, i) => (
            <button
              key={n}
              onClick={() => setDiaLibre(i)}
              className={`rounded-lg py-1.5 text-[10.5px] font-bold ${diaLibre === i ? "bg-[#0B5F6C] text-white" : "bg-[#E4F7F9] text-[#0B5F6C]"}`}
            >
              {n}
            </button>
          ))}
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

      <div className="border-t border-[#DDE7E8] pt-3 space-y-2">
        <div className="text-[12px] font-bold text-[#0B5F6C]">Cambiar un libre puntual</div>
        <p className="text-[11px] text-[#6B6D6E] leading-snug">
          Para cuando alguien mueve su libre esa semana (por ejemplo, una cita médica). Se aplica a quien esté marcada arriba.
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
        {mensajeCambio && <p className="text-[12px] text-[#1E8A5F] font-semibold">{mensajeCambio}</p>}
        {errorCambio && <p className="text-[12px] text-[#B23A3A] font-semibold">{errorCambio}</p>}
        <button
          onClick={cambiarPuntual}
          disabled={guardandoCambio}
          className="w-full rounded-lg border-2 border-[#1EA6B8] text-[#0B5F6C] py-2 text-[12.5px] font-bold disabled:opacity-50"
        >
          {guardandoCambio ? "Cambiando…" : "Cambiar en las marcadas"}
        </button>
      </div>
    </div>
  );
}
