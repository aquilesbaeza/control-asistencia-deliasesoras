"use client";

import { useState } from "react";
import type { Asesora } from "@/lib/tipos";
import { mensajeAmable } from "@/lib/mensajes";
import { horaAmPm } from "@/lib/tiempo";
import SelectorHora from "@/components/SelectorHora";

/**
 * Quita a una asesora: si no tiene historial se borra; si ya tiene marcas se oculta y
 * conserva sus reportes anteriores. Devuelve un mensaje de error, o null si salio bien.
 */
export async function quitarAsesora(
  asesora: Asesora,
  onAviso: (mensaje: string) => void
): Promise<string | null> {
  if (
    !confirm(
      `¿Quitar a ${asesora.nombre}?\n\nDejará de aparecer en la lista diaria y en los meses nuevos. Si ya tiene marcas, sus reportes anteriores se conservan.`
    )
  ) {
    return "cancelado";
  }
  const resp = await fetch(`/api/asesoras/${asesora.id}`, { method: "DELETE" });
  const data = await resp.json();
  if (!resp.ok) return data.error ?? "No se pudo quitar";
  onAviso(
    data.conservaHistorial
      ? `${asesora.nombre} se quitó de la lista. Sus reportes anteriores se conservan (búscala en "Asesoras quitadas" si necesitas reactivarla).`
      : `${asesora.nombre} se eliminó por completo (no tenía historial).`
  );
  return null;
}

/** Selector de punto: lista los puntos existentes (para elegir uno ya usado) y permite escribir uno nuevo. */
function CampoPunto({ puntos, valor, onCambio }: { puntos: string[]; valor: string; onCambio: (v: string) => void }) {
  const [otro, setOtro] = useState(!!valor && !puntos.includes(valor));
  if (otro) {
    return (
      <div className="flex gap-1.5 mt-0.5">
        <input
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          placeholder="Nombre del punto"
          className="flex-1 min-w-0 rounded border border-[#DDE7E8] p-2 text-[13px] normal-case font-normal text-[#14181A]"
        />
        {puntos.length > 0 && (
          <button type="button" onClick={() => setOtro(false)} className="flex-none rounded border border-[#DDE7E8] px-2 text-[11.5px] text-[#0B5F6C] font-semibold">
            Elegir de la lista
          </button>
        )}
      </div>
    );
  }
  return (
    <select
      value={valor}
      onChange={(e) => {
        if (e.target.value === "__otro__") setOtro(true);
        else onCambio(e.target.value);
      }}
      className="mt-0.5 w-full rounded border border-[#DDE7E8] p-2 text-[13px] normal-case font-normal text-[#14181A]"
    >
      {!valor && <option value="">-- Elige el punto --</option>}
      {!puntos.includes(valor) && valor && <option value={valor}>{valor}</option>}
      {puntos.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
      <option value="__otro__">+ Otro punto (escribir)</option>
    </select>
  );
}

/** Formulario para mover a una asesora de punto (por ejemplo, ante una eventualidad). */
export function FormMoverAsesora({
  asesora,
  puntos,
  onCambio,
  onAviso,
  onCerrar,
}: {
  asesora: Asesora;
  puntos: string[];
  onCambio: () => void;
  onAviso: (mensaje: string) => void;
  onCerrar: () => void;
}) {
  const [punto, setPunto] = useState(asesora.punto);
  const [hora, setHora] = useState(asesora.hora_entrada?.slice(0, 5) ?? "");
  const [mostrarHora, setMostrarHora] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (!punto.trim()) return;
    setError(null);
    const cambios: Record<string, string | null> = {};
    if (punto.trim() !== asesora.punto) cambios.punto = punto.trim();
    if ((hora || null) !== (asesora.hora_entrada?.slice(0, 5) ?? null)) cambios.hora_entrada = hora || null;
    if (Object.keys(cambios).length === 0) {
      onCerrar();
      return;
    }
    const resp = await fetch(`/api/asesoras/${asesora.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    });
    if (!resp.ok) {
      const data = await resp.json();
      setError(mensajeAmable(data.error, "No se pudo guardar."));
      return;
    }
    onAviso(cambios.punto ? `${asesora.nombre} ahora está en ${punto.trim()}.` : "Horario actualizado.");
    onCambio();
    onCerrar();
  }

  return (
    <div className="rounded-xl border-2 border-[#1EA6B8] bg-white p-3 space-y-2">
      <div className="text-[12px] font-bold text-[#0B5F6C]">Mover a {asesora.nombre.split(" ")[0]} o definir su horario</div>
      <label className="block text-[10px] font-bold text-[#6B6D6E] uppercase tracking-wide">
        Punto
        <CampoPunto puntos={puntos} valor={punto} onCambio={setPunto} />
      </label>
      <div>
        <div className="text-[10px] font-bold text-[#6B6D6E] uppercase tracking-wide mb-1">Hora de entrada esperada (para avisar tardías)</div>
        <button
          type="button"
          onClick={() => setMostrarHora((v) => !v)}
          className="w-full rounded border border-[#DDE7E8] p-2 text-[13px] text-left"
        >
          {hora ? horaAmPm(hora) : "Sin horario fijo (toca para definirlo)"}
        </button>
        {mostrarHora && (
          <div className="mt-2 rounded-lg bg-[#F2F8F9] p-2.5 space-y-2">
            <div className="flex justify-center">
              <SelectorHora valor={hora || "08:00"} onCambio={setHora} />
            </div>
            {hora && (
              <button type="button" onClick={() => setHora("")} className="w-full text-[11.5px] text-[#B23A3A] font-semibold">
                Quitar horario fijo
              </button>
            )}
          </div>
        )}
      </div>
      {error && <p className="text-[12px] text-[#B23A3A] font-semibold">{error}</p>}
      <div className="flex gap-2">
        <button onClick={guardar} className="flex-1 text-[12.5px] bg-[#0B5F6C] text-white py-2.5 rounded-lg font-semibold">
          Guardar
        </button>
        <button onClick={onCerrar} className="flex-1 text-[12.5px] bg-[#E4F7F9] text-[#0B5F6C] py-2.5 rounded-lg font-semibold">
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Formulario para agregar una asesora nueva. */
export function NuevaAsesora({
  puntos,
  onCambio,
  onCerrar,
  onAviso,
}: {
  puntos: string[];
  onCambio: () => void;
  onCerrar: () => void;
  onAviso: (m: string) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [punto, setPunto] = useState("");
  const [hora, setHora] = useState("");
  const [mostrarHora, setMostrarHora] = useState(false);
  const [ingreso, setIngreso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function agregar() {
    if (!nombre.trim() || !punto.trim()) {
      setError("Escribe el nombre completo y el punto, por favor.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const resp = await fetch("/api/asesoras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim().toUpperCase(), punto: punto.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      if (hora || ingreso) {
        await fetch(`/api/asesoras/${data.asesora.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hora_entrada: hora || null, fecha_ingreso: ingreso || null }),
        });
      }
      onAviso(`${nombre.trim().toUpperCase()} se agregó a ${punto.trim()}.`);
      onCambio();
      onCerrar();
    } catch (err) {
      setError(mensajeAmable(err instanceof Error ? err.message : undefined, "No se pudo agregar."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#DDE7E8] bg-white p-3 space-y-2">
      <div className="text-[12.5px] font-bold text-[#0B5F6C]">Agregar asesora</div>
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre completo"
        className="block w-full rounded-lg border border-[#DDE7E8] p-2.5 text-[13px]"
      />
      <div>
        <CampoPunto puntos={puntos} valor={punto} onCambio={setPunto} />
      </div>
      <label className="block text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">
        Fecha de ingreso
        <input
          type="date"
          value={ingreso}
          onChange={(e) => setIngreso(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-[#DDE7E8] p-2.5 text-[13px] font-normal text-[#14181A]"
        />
      </label>
      <div>
        <div className="text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide mb-1">Hora de entrada (si es fija)</div>
        <button
          type="button"
          onClick={() => setMostrarHora((v) => !v)}
          className="w-full rounded-lg border border-[#DDE7E8] p-2.5 text-[13px] text-left"
        >
          {hora ? horaAmPm(hora) : "Sin hora fija (toca para elegir)"}
        </button>
        {mostrarHora && (
          <div className="mt-2 rounded-lg bg-[#F2F8F9] p-2.5 space-y-2">
            <div className="flex justify-center">
              <SelectorHora valor={hora || "08:00"} onCambio={setHora} />
            </div>
            {hora && (
              <button type="button" onClick={() => setHora("")} className="w-full text-[11.5px] text-[#B23A3A] font-semibold">
                Quitar hora fija
              </button>
            )}
          </div>
        )}
      </div>
      {error && <p className="text-[12px] text-[#B23A3A] font-semibold">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={agregar}
          disabled={guardando}
          className="flex-1 rounded-lg text-white py-2.5 text-[13px] font-bold disabled:opacity-50"
          style={{ background: "linear-gradient(150deg, #0B5F6C, #1EA6B8)" }}
        >
          Agregar
        </button>
        <button onClick={onCerrar} className="flex-1 rounded-lg bg-[#E4F7F9] text-[#0B5F6C] py-2.5 text-[13px] font-semibold">
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Lista de asesoras quitadas, con opcion de reactivarlas. */
export function AsesorasQuitadas({
  quitadas,
  onCambio,
  onAviso,
}: {
  quitadas: Asesora[];
  onCambio: () => void;
  onAviso: (m: string) => void;
}) {
  if (quitadas.length === 0) return null;

  async function reactivar(a: Asesora) {
    await fetch(`/api/asesoras/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: true }),
    });
    onAviso(`${a.nombre} volvió a la lista.`);
    onCambio();
  }

  return (
    <details className="rounded-xl border border-[#DDE7E8] bg-white p-3">
      <summary className="text-[12.5px] font-semibold text-[#0B5F6C] cursor-pointer">Asesoras quitadas ({quitadas.length})</summary>
      <div className="mt-2 space-y-2">
        {quitadas.map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-[12px]">
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{a.nombre}</div>
              <div className="text-[11px] text-[#6B6D6E] truncate">{a.punto}</div>
            </div>
            <button onClick={() => reactivar(a)} className="rounded-lg bg-[#E4F7F9] text-[#0B5F6C] px-3 py-1.5 text-[11.5px] font-semibold">
              Reactivar
            </button>
          </div>
        ))}
      </div>
    </details>
  );
}
