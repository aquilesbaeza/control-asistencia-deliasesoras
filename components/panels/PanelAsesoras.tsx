"use client";

import { useEffect, useMemo, useState } from "react";
import type { Asesora } from "@/lib/tipos";
import { mensajeAmable } from "@/lib/mensajes";

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default function PanelAsesoras() {
  const [asesoras, setAsesoras] = useState<Asesora[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [puntoNuevo, setPuntoNuevo] = useState("");
  const [horaNueva, setHoraNueva] = useState("");
  const [agregarAbierto, setAgregarAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [puntoEdicion, setPuntoEdicion] = useState("");
  const [horaEdicion, setHoraEdicion] = useState("");

  async function cargar() {
    const resp = await fetch("/api/asesoras");
    const data = await resp.json();
    setAsesoras(data.asesoras ?? []);
    setCargando(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, []);

  const activas = useMemo(() => asesoras.filter((a) => a.activo), [asesoras]);
  const quitadas = useMemo(() => asesoras.filter((a) => !a.activo), [asesoras]);
  const puntos = useMemo(
    () => [...new Set(asesoras.map((a) => a.punto))].sort((a, b) => a.localeCompare(b, "es")),
    [asesoras]
  );

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    if (!q) return activas;
    return activas.filter((a) => normalizar(a.nombre).includes(q) || normalizar(a.punto).includes(q));
  }, [activas, busqueda]);

  async function agregar() {
    if (!nombreNuevo.trim() || !puntoNuevo.trim()) {
      setError("Escribe el nombre completo y el punto.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const resp = await fetch("/api/asesoras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreNuevo.trim().toUpperCase(), punto: puntoNuevo.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      if (horaNueva) {
        await fetch(`/api/asesoras/${data.asesora.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hora_entrada: horaNueva }),
        });
      }
      setNombreNuevo("");
      setPuntoNuevo("");
      setHoraNueva("");
      setAgregarAbierto(false);
      setAviso("Asesora agregada.");
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarEdicion(id: string) {
    if (!puntoEdicion.trim()) return;
    const resp = await fetch(`/api/asesoras/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ punto: puntoEdicion, hora_entrada: horaEdicion || null }),
    });
    if (!resp.ok) {
      const data = await resp.json();
      setError(mensajeAmable(data.error, "No se pudo guardar."));
      return;
    }
    setEditandoId(null);
    setAviso("Cambios guardados.");
    await cargar();
  }

  async function quitar(a: Asesora) {
    if (
      !confirm(
        `¿Quitar a ${a.nombre}?\n\nDejará de aparecer en la lista diaria y en los meses nuevos. Si ya tiene marcas, sus reportes anteriores se conservan.`
      )
    ) {
      return;
    }
    const resp = await fetch(`/api/asesoras/${a.id}`, { method: "DELETE" });
    const data = await resp.json();
    if (!resp.ok) {
      setError(data.error ?? "No se pudo quitar");
      return;
    }
    setAviso(
      data.conservaHistorial
        ? `${a.nombre} se quitó de la lista. Sus reportes anteriores se conservan (búscala en "Quitadas" si necesitas reactivarla).`
        : `${a.nombre} se eliminó por completo (no tenía historial).`
    );
    await cargar();
  }

  async function reactivar(a: Asesora) {
    await fetch(`/api/asesoras/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: true }),
    });
    setAviso(`${a.nombre} volvió a la lista.`);
    await cargar();
  }

  return (
    <div className="space-y-3">
      <datalist id="lista-puntos">
        {puntos.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>

      <div className="flex gap-2">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar asesora o punto"
          className="flex-1 rounded-lg border border-[#DDE7E8] bg-white p-2.5 text-[13px]"
        />
        <button
          onClick={() => setAgregarAbierto((v) => !v)}
          className="rounded-lg bg-[#0B5F6C] text-white px-3.5 text-[13px] font-bold"
        >
          {agregarAbierto ? "Cerrar" : "+ Nueva"}
        </button>
      </div>

      {aviso && <p className="text-[12.5px] text-[#1E8A5F] font-semibold">{aviso}</p>}
      {error && <p className="text-[12.5px] text-[#B23A3A] font-semibold">{error}</p>}

      {agregarAbierto && (
        <div className="rounded-xl border border-[#DDE7E8] bg-white p-3 space-y-2">
          <input
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            placeholder="Nombre completo"
            className="block w-full rounded-lg border border-[#DDE7E8] p-2.5 text-[13px]"
          />
          <input
            list="lista-puntos"
            value={puntoNuevo}
            onChange={(e) => setPuntoNuevo(e.target.value)}
            placeholder="Punto de venta"
            className="block w-full rounded-lg border border-[#DDE7E8] p-2.5 text-[13px]"
          />
          <label className="block text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">
            Hora de entrada (opcional)
            <input
              type="time"
              value={horaNueva}
              onChange={(e) => setHoraNueva(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-[#DDE7E8] p-2.5 text-[13px] font-normal text-[#14181A]"
            />
          </label>
          <button
            onClick={agregar}
            disabled={guardando}
            className="w-full rounded-lg text-white py-2.5 text-[13px] font-bold disabled:opacity-50"
            style={{ background: "linear-gradient(150deg, #0B5F6C, #1EA6B8)" }}
          >
            Agregar asesora
          </button>
        </div>
      )}

      {cargando ? (
        <p className="text-sm text-[#6B6D6E]">Cargando…</p>
      ) : (
        <>
          <div className="text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">
            {activas.length} activas
          </div>
          <div className="space-y-2">
            {visibles.map((a) => (
              <div key={a.id} className="rounded-xl border border-[#DDE7E8] bg-white p-3">
                <div className="font-bold text-[13px]">{a.nombre}</div>
                {editandoId === a.id ? (
                  <div className="mt-1.5 space-y-1.5">
                    <label className="block text-[10px] font-bold text-[#6B6D6E] uppercase tracking-wide">
                      Punto
                      <input
                        list="lista-puntos"
                        value={puntoEdicion}
                        onChange={(e) => setPuntoEdicion(e.target.value)}
                        className="mt-0.5 w-full rounded border border-[#DDE7E8] p-2 text-[13px] normal-case font-normal text-[#14181A]"
                      />
                    </label>
                    <label className="block text-[10px] font-bold text-[#6B6D6E] uppercase tracking-wide">
                      Hora de entrada (horario)
                      <input
                        type="time"
                        value={horaEdicion}
                        onChange={(e) => setHoraEdicion(e.target.value)}
                        className="mt-0.5 w-full rounded border border-[#DDE7E8] p-2 text-[13px] font-normal text-[#14181A]"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => guardarEdicion(a.id)}
                        className="flex-1 text-[12.5px] bg-[#0B5F6C] text-white py-2.5 rounded-lg font-semibold"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditandoId(null)}
                        className="flex-1 text-[12.5px] bg-[#E4F7F9] text-[#0B5F6C] py-2.5 rounded-lg font-semibold"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-[11.5px] text-[#6B6D6E]">
                      {a.punto}
                      {a.hora_entrada ? ` · Entrada ${a.hora_entrada.slice(0, 5)}` : ""}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => {
                          setEditandoId(a.id);
                          setPuntoEdicion(a.punto);
                          setHoraEdicion(a.hora_entrada?.slice(0, 5) ?? "");
                          setError(null);
                          setAviso(null);
                        }}
                        className="flex-1 rounded-lg bg-[#E4F7F9] text-[#0B5F6C] py-2 text-[12px] font-semibold"
                      >
                        Mover de punto / horario
                      </button>
                      <button
                        onClick={() => quitar(a)}
                        className="rounded-lg border border-[#DDE7E8] text-[#B23A3A] px-3.5 py-2 text-[12px] font-semibold"
                      >
                        Quitar
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {visibles.length === 0 && <p className="text-sm text-[#6B6D6E]">Ninguna asesora coincide con la búsqueda.</p>}
          </div>

          {quitadas.length > 0 && (
            <details className="rounded-xl border border-[#DDE7E8] bg-white p-3">
              <summary className="text-[12.5px] font-semibold text-[#0B5F6C] cursor-pointer">
                Quitadas ({quitadas.length})
              </summary>
              <div className="mt-2 space-y-2">
                {quitadas.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-[12px]">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{a.nombre}</div>
                      <div className="text-[11px] text-[#6B6D6E] truncate">{a.punto}</div>
                    </div>
                    <button
                      onClick={() => reactivar(a)}
                      className="rounded-lg bg-[#E4F7F9] text-[#0B5F6C] px-3 py-1.5 text-[11.5px] font-semibold"
                    >
                      Reactivar
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
