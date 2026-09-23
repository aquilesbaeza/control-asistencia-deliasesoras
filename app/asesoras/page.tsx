"use client";

import { useEffect, useState } from "react";
import type { Asesora } from "@/lib/tipos";

export default function AsesorasPage() {
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
      <h1 className="text-xl font-semibold">Asesoras</h1>

      <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-2">
        <h2 className="font-medium text-sm text-neutral-700">Agregar nueva</h2>
        <input
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
          placeholder="Nombre completo"
          className="block w-full rounded border border-neutral-300 p-2 text-sm"
        />
        <input
          value={puntoNuevo}
          onChange={(e) => setPuntoNuevo(e.target.value)}
          placeholder="Punto de venta"
          className="block w-full rounded border border-neutral-300 p-2 text-sm"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          onClick={agregar}
          disabled={guardando}
          className="w-full rounded-md bg-[#196B24] text-white py-2 text-sm font-medium disabled:opacity-50"
        >
          Agregar
        </button>
      </div>

      {cargando ? (
        <p className="text-sm text-neutral-500">Cargando…</p>
      ) : (
        <div className="space-y-2">
          {asesoras.map((a) => (
            <div
              key={a.id}
              className={`rounded-lg border p-3 bg-white ${a.activo ? "border-neutral-200" : "border-neutral-200 opacity-50"}`}
            >
              <div className="font-medium">{a.nombre}</div>
              {editandoId === a.id ? (
                <div className="flex gap-2 mt-1">
                  <input
                    value={puntoEdicion}
                    onChange={(e) => setPuntoEdicion(e.target.value)}
                    className="flex-1 rounded border border-neutral-300 p-1 text-sm"
                  />
                  <button
                    onClick={() => guardarReubicacion(a.id)}
                    className="text-sm bg-[#196B24] text-white px-3 rounded"
                  >
                    Guardar
                  </button>
                </div>
              ) : (
                <div className="text-sm text-neutral-600">{a.punto}</div>
              )}

              <div className="flex gap-3 mt-2 text-xs">
                <button
                  onClick={() => {
                    setEditandoId(a.id);
                    setPuntoEdicion(a.punto);
                  }}
                  className="text-blue-700 underline"
                >
                  Reubicar de punto
                </button>
                <button onClick={() => alternarActivo(a)} className="text-amber-700 underline">
                  {a.activo ? "Dar de baja" : "Reactivar"}
                </button>
                <button onClick={() => eliminar(a.id)} className="text-red-700 underline">
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
