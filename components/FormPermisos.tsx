"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Asesora, DiaEspecial } from "@/lib/tipos";
import { ahoraCR } from "@/lib/tiempo";

type TipoPermiso = "libre" | "vacaciones" | "incapacidad";

const TIPOS: { id: TipoPermiso; etiqueta: string }[] = [
  { id: "libre", etiqueta: "Libre" },
  { id: "vacaciones", etiqueta: "Vacaciones" },
  { id: "incapacidad", etiqueta: "Incapacidad" },
];

type Rango = {
  asesora_id: string;
  tipo: TipoPermiso;
  nota: string | null;
  desde: string;
  hasta: string;
};

function diaSiguiente(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

function restarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d - dias)).toISOString().slice(0, 10);
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / 86400000) + 1;
}

function formatoCorto(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-CR", { day: "numeric", month: "short" });
}

// Junta dias consecutivos de la misma asesora/tipo/nota en un solo rango.
function agruparRangos(dias: DiaEspecial[]): Rango[] {
  const ordenados = [...dias]
    .filter((d) => d.tipo !== "ausencia")
    .sort((a, b) => a.asesora_id.localeCompare(b.asesora_id) || a.tipo.localeCompare(b.tipo) || a.fecha.localeCompare(b.fecha));

  const rangos: Rango[] = [];
  for (const d of ordenados) {
    const ultimo = rangos[rangos.length - 1];
    if (
      ultimo &&
      ultimo.asesora_id === d.asesora_id &&
      ultimo.tipo === d.tipo &&
      ultimo.nota === d.nota &&
      diaSiguiente(ultimo.hasta) === d.fecha
    ) {
      ultimo.hasta = d.fecha;
    } else {
      rangos.push({ asesora_id: d.asesora_id, tipo: d.tipo as TipoPermiso, nota: d.nota, desde: d.fecha, hasta: d.fecha });
    }
  }
  return rangos.sort((a, b) => a.desde.localeCompare(b.desde));
}

export default function FormPermisos({
  colapsable = false,
  onCambio,
}: {
  colapsable?: boolean;
  onCambio?: () => void;
}) {
  const [abierto, setAbierto] = useState(!colapsable);
  const [asesoras, setAsesoras] = useState<Asesora[]>([]);
  const [dias, setDias] = useState<DiaEspecial[]>([]);
  const [asesoraId, setAsesoraId] = useState("");
  const [tipo, setTipo] = useState<TipoPermiso>("vacaciones");
  const hoy = ahoraCR().fecha;
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const [rA, rD] = await Promise.all([
      fetch("/api/asesoras").then((r) => r.json()),
      fetch(`/api/dias-especiales?desde=${restarDias(ahoraCR().fecha, 35)}`).then((r) => r.json()),
    ]);
    setAsesoras((rA.asesoras ?? []).filter((a: Asesora) => a.activo));
    setDias(rD.dias ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
  }, [cargar]);

  const nombrePorId = useMemo(() => new Map(asesoras.map((a) => [a.id, a])), [asesoras]);
  const rangos = useMemo(() => agruparRangos(dias), [dias]);

  async function guardar() {
    setError(null);
    setOkMsg(null);
    if (!asesoraId) {
      setError("Elige la asesora.");
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
      setOkMsg(`Guardado: ${data.dias?.length ?? 0} día(s).`);

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
      await cargar();
      onCambio?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(r: Rango) {
    await fetch(`/api/dias-especiales?asesora_id=${r.asesora_id}&desde=${r.desde}&hasta=${r.hasta}`, {
      method: "DELETE",
    });
    await cargar();
    onCambio?.();
  }

  return (
    <div className="rounded-xl border border-[#DDE7E8] bg-white p-3">
      <button
        type="button"
        onClick={() => colapsable && setAbierto((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="text-[12.5px] font-bold text-[#0B5F6C]">Libres, vacaciones e incapacidades</span>
        {colapsable && <span className="text-[#0F7A8A] text-sm font-bold">{abierto ? "−" : "+"}</span>}
      </button>

      {abierto && (
        <div className="mt-2 space-y-2.5">
          <p className="text-[11px] text-[#6B6D6E] leading-snug">
            Nuria: regístralos aquí, incluso con anticipación. Lo que anotes tiene prioridad: el sistema no lo
            marcará como ausencia ni como falta de marca.
          </p>

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

          {rangos.length > 0 && (
            <div className="pt-2 border-t border-[#DDE7E8] space-y-1.5">
              <div className="text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">
                Registrados (último mes y próximos)
              </div>
              {rangos.map((r) => (
                <div
                  key={`${r.asesora_id}-${r.tipo}-${r.desde}`}
                  className="flex items-center gap-2 bg-[#F2F8F9] rounded-lg px-2.5 py-2 text-[12px]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{nombrePorId.get(r.asesora_id)?.nombre ?? "—"}</div>
                    <div className="text-[11px] text-[#6B6D6E]">
                      {TIPOS.find((t) => t.id === r.tipo)?.etiqueta} ·{" "}
                      {r.desde === r.hasta ? formatoCorto(r.desde) : `${formatoCorto(r.desde)} – ${formatoCorto(r.hasta)}`}
                      {` (${diasEntre(r.desde, r.hasta)} ${diasEntre(r.desde, r.hasta) === 1 ? "día" : "días"})`}
                      {r.nota ? ` · ${r.nota}` : ""}
                    </div>
                  </div>
                  <button type="button" onClick={() => quitar(r)} className="text-[#B23A3A] text-[11px] font-semibold px-1">
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
