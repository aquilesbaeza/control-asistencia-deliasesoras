"use client";

import { useEffect, useState } from "react";
import type { Asesora } from "@/lib/tipos";

export default function PanelAsesoras() {
  const [asesoras, setAsesoras] = useState<Asesora[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [puntoNuevo, setPuntoNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [puntoEdicion, setPuntoEdicion] = useState("");

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

  async function agregar() {
    if (!nombreNuevo.trim() || !puntoNuevo.trim()) {
      setError("Nombre y punto son obligatorios");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const resp = await fetch("/api/asesoras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreNuevo, punto: puntoNuevo }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setNombreNuevo("");
      setPuntoNuevo("");
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarReubicacion(id: string) {
    if (!puntoEdicion.trim()) return;
    await fetch(`/api/asesoras/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ punto: puntoEdicion }),
    });
    setEditandoId(null);
    await cargar();
  }

  async function alternarActivo(a: Asesora) {
    await fetch(`/api/asesoras/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !a.activo }),
    });
    await cargar();
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar esta asesora por completo? Solo es posible si no tiene marcas registradas.")) {
      return;
    }
    const resp = await fetch(`/api/asesoras/${id}`, { method: "DELETE" });
    const data = await resp.json();
    if (!resp.ok) {
      alert(data.error);
      return;
    }
    await cargar();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#DDE7E8] bg-white p-3 space-y-2">
        <h2 className="font-bold text-[12px] text-[#0B5F6C]">Agregar nueva</h2>
        <input
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
          placeholder="Nombre completo"
          className="block w-full rounded-lg border border-[#DDE7E8] p-2 text-[12px]"
        />
        <input
          value={puntoNuevo}
          onChange={(e) => setPuntoNuevo(e.target.value)}
          placeholder="Punto de venta"
          className="block w-full rounded-lg border border-[#DDE7E8] p-2 text-[12px]"
        />
        {error && <p className="text-xs text-[#B23A3A]">{error}</p>}
        <button
          onClick={agregar}
          disabled={guardando}
          className="w-full rounded-lg text-white py-2 text-[12px] font-bold disabled:opacity-50"
          style={{ background: "linear-gradient(150deg, #0B5F6C, #1EA6B8)" }}
        >
          Agregar
        </button>
      </div>

      {cargando ? (
        <p className="text-sm text-[#6B6D6E]">Cargando…</p>
      ) : (
        <div className="space-y-2">
          {asesoras.map((a) => (
            <div
              key={a.id}
              className={`rounded-xl border p-3 bg-white ${a.activo ? "border-[#DDE7E8]" : "border-[#DDE7E8] opacity-60"}`}
            >
              <div className="font-bold text-[12.5px]">{a.nombre}</div>
              {editandoId === a.id ? (
                <div className="flex gap-2 mt-1">
                  <input
                    value={puntoEdicion}
                    onChange={(e) => setPuntoEdicion(e.target.value)}
                    className="flex-1 rounded border border-[#DDE7E8] p-1 text-[11.5px]"
                  />
                  <button
                    onClick={() => guardarReubicacion(a.id)}
                    className="text-[11px] bg-[#0B5F6C] text-white px-3 rounded font-semibold"
                  >
                    Guardar
                  </button>
                </div>
              ) : (
                <div className="text-[11.5px] text-[#6B6D6E]">{a.punto}</div>
              )}

              <div className="flex gap-3 mt-2 text-[11px] font-semibold">
                <button
                  onClick={() => {
                    setEditandoId(a.id);
                    setPuntoEdicion(a.punto);
                  }}
                  className="text-[#0F7A8A]"
                >
                  Reubicar de punto
                </button>
                <button onClick={() => alternarActivo(a)} className="text-[#0B5F6C]">
                  {a.activo ? "Dar de baja" : "Reactivar"}
                </button>
                <button onClick={() => eliminar(a.id)} className="text-[#B23A3A]">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
