"use client";

import { useEffect, useMemo, useState } from "react";
import SelectorMes, { mesActual } from "@/components/SelectorMes";
import type { Anomalia } from "@/lib/tipos";

export default function BitacoraPage() {
  const [mes, setMes] = useState(mesActual());
  const [anomalias, setAnomalias] = useState<Anomalia[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    fetch(`/api/reportes/anomalias?mes=${mes}`)
      .then((r) => r.json())
      .then((data) => setAnomalias(data.anomalias ?? []))
      .finally(() => setCargando(false));
  }, [mes]);

  const resumen = useMemo(() => {
    const faltas = anomalias.filter((a) => a.tipo !== "horas_insuficientes").length;
    const horas = anomalias.filter((a) => a.tipo === "horas_insuficientes").length;
    return { faltas, horas };
  }, [anomalias]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Bitacora y anomalias</h1>
        <SelectorMes mes={mes} onCambiar={setMes} />
      </div>

      <a
        href={`/api/export/bitacora?mes=${mes}`}
        className="inline-block text-sm rounded bg-[#196B24] text-white px-3 py-2"
      >
        Descargar Excel Bitacora
      </a>

      {!cargando && (
        <p className="text-sm text-neutral-600">
          {anomalias.length === 0
            ? "Sin anomalias registradas este mes."
            : `${resumen.faltas} marca(s) faltante(s), ${resumen.horas} dia(s) con horas insuficientes.`}
        </p>
      )}

      {cargando ? (
        <p className="text-sm text-neutral-500">Cargando…</p>
      ) : (
        <div className="space-y-2">
          {anomalias.map((a, i) => (
            <div key={i} className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <div className="font-medium text-sm">{a.nombre}</div>
              <div className="text-xs text-neutral-600">{a.punto}</div>
              <div className="text-xs text-neutral-500">{a.fecha}</div>
              <div className="text-sm text-amber-800 mt-1">{a.mensaje}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
