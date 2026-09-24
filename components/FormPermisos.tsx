"use client";

import { useEffect, useState } from "react";
import type { Asesora } from "@/lib/tipos";
import { ahoraCR } from "@/lib/tiempo";

type TipoPermiso = "libre" | "vacaciones" | "incapacidad";

const TIPOS: { id: TipoPermiso; etiqueta: string }[] = [
  { id: "libre", etiqueta: "Libre" },
  { id: "vacaciones", etiqueta: "Vacaciones" },
  { id: "incapacidad", etiqueta: "Incapacidad" },
];

function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000) + 1;
}

function formatoCorto(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-CR", { day: "numeric", month: "short" });
}

/** Registro manual de libres, vacaciones e incapacidades (con inicio y fin). */
export default function FormPermisos({
  colapsable = false,
  abiertoInicial,
  asesoraInicial,
  tipoInicial,
  ocultarTipo = false,
  sinTitulo = false,
  onCambio,
}: {
  colapsable?: boolean;
  abiertoInicial?: boolean;
  asesoraInicial?: string; // asesora ya elegida (cuando se abre desde su tarjeta)
  tipoInicial?: TipoPermiso;
  ocultarTipo?: boolean; // el tipo ya viene elegido desde afuera
  sinTitulo?: boolean;
  onCambio?: () => void;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial ?? !colapsable);
  const [asesoras, setAsesoras] = useState<Asesora[]>([]);
  const [asesoraId, setAsesoraId] = useState(asesoraInicial ?? "");
  const [tipo, setTipo] = useState<TipoPermiso>(tipoInicial ?? "vacaciones");
  const hoy = ahoraCR().fecha;
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/asesoras")
      .then((r) => r.json())
      .then((d) => setAsesoras((d.asesoras ?? []).filter((a: Asesora) => a.activo)));
  }, []);

  async function guardar() {
    setError(null);
    setOkMsg(null);
    if (!asesoraId) {
      setError("Elige la asesora, por favor.");
      return;
    }
    setGuardando(true);
    try {
      const resp = await fetch("/api/dias-especiales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asesora_id: asesoraId, tipo, fecha_desde: desde, fecha_hasta: hasta, nota }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setOkMsg(`Listo, guardado: ${data.dias?.length ?? 0} día(s).`);

      // Deja el registro en Comentarios con estructura: asunto + asesora + situacion.
      const rangoTexto = desde === hasta ? formatoCorto(desde) : `del ${formatoCorto(desde)} al ${formatoCorto(hasta)}`;
      await fetch("/api/comentarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: desde,
          asunto: TIPOS.find((t) => t.id === tipo)?.etiqueta ?? "Otro",
          asesora_id: asesoraId,
          situacion: `${rangoTexto}${nota.trim() ? ` · ${nota.trim()}` : ""}`,
        }),
      }).catch(() => {});

      setNota("");
      onCambio?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#DDE7E8] bg-white p-3">
      {!sinTitulo && (
        <button
          type="button"
          onClick={() => colapsable && setAbierto((v) => !v)}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="text-[12.5px] font-bold text-[#0B5F6C]">Libres, vacaciones e incapacidades</span>
          {colapsable && <span className="text-[#0F7A8A] text-sm font-bold">{abierto ? "−" : "+"}</span>}
        </button>
      )}

      {abierto && (
        <div className={`${sinTitulo ? "" : "mt-2 "}space-y-2.5`}>
          {!sinTitulo && (
            <p className="text-[11px] text-[#6B6D6E] leading-snug">
              Nuria: regístralos aquí, incluso con anticipación. Lo que anotes tiene prioridad: el sistema no lo
              marcará como ausencia ni como falta de marca.
            </p>
          )}

          <select
            value={asesoraId}
            onChange={(e) => setAsesoraId(e.target.value)}
            className="w-full rounded-lg border border-[#DDE7E8] p-2.5 text-[13px]"
          >
            <option value="">-- Elige la asesora --</option>
            {asesoras.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre} ({a.punto})
              </option>
            ))}
          </select>

          {!ocultarTipo && (
            <div className="flex gap-1.5">
              {TIPOS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTipo(t.id)}
                  className={`flex-1 rounded-lg py-2.5 text-[12.5px] font-semibold ${
                    tipo === t.id ? "bg-[#0B5F6C] text-white" : "bg-[#E4F7F9] text-[#0B5F6C]"
                  }`}
                >
                  {t.etiqueta}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">
              Desde
              <input
                type="date"
                value={desde}
                onChange={(e) => {
                  setDesde(e.target.value);
                  if (hasta < e.target.value) setHasta(e.target.value);
                }}
                className="mt-1 w-full rounded-lg border border-[#DDE7E8] p-2 text-[13px] normal-case font-normal text-[#14181A]"
              />
            </label>
            <label className="text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">
              Hasta
              <input
                type="date"
                value={hasta}
                min={desde}
                onChange={(e) => setHasta(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#DDE7E8] p-2 text-[13px] normal-case font-normal text-[#14181A]"
              />
            </label>
          </div>
          <p className="text-[12px] font-semibold text-[#0B5F6C]">
            {desde && hasta && hasta >= desde
              ? `Serán ${diasEntre(desde, hasta)} ${diasEntre(desde, hasta) === 1 ? "día" : "días"} (del ${formatoCorto(desde)} al ${formatoCorto(hasta)})`
              : "Revisa las fechas, por favor."}
          </p>

          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Nota (opcional)"
            className="w-full rounded-lg border border-[#DDE7E8] p-2.5 text-[13px]"
          />

          {error && <p className="text-[12px] text-[#B23A3A]">{error}</p>}
          {okMsg && <p className="text-[12px] text-[#1E8A5F] font-semibold">{okMsg}</p>}

          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="w-full rounded-xl py-3 font-bold text-white text-sm disabled:opacity-50"
            style={{ background: "linear-gradient(150deg, #0B5F6C, #1EA6B8)" }}
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      )}
    </div>
  );
}
