"use client";

import { useState } from "react";
import PopupAnomalia from "@/components/PopupAnomalia";

type Candidato = { id: string; nombre: string; punto: string; score: number };

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const resultado = reader.result as string;
      const [meta, base64] = resultado.split(",");
      const mediaType = meta.match(/data:(.*);base64/)?.[1] ?? file.type;
      resolve({ base64, mediaType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CapturarPage() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [asesoraId, setAsesoraId] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [tipo, setTipo] = useState<"entrada" | "salida">("entrada");
  const [confianza, setConfianza] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensajeAnomalia, setMensajeAnomalia] = useState<string | null>(null);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSeleccionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setGuardadoOk(false);
    setPreviewUrl(URL.createObjectURL(file));

    const { base64, mediaType } = await fileToBase64(file);
    setFotoBase64(base64);

    setAnalizando(true);
    try {
      const resp = await fetch("/api/marcas/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagenBase64: base64, mediaType }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);

      setCandidatos(data.candidatos ?? []);
      setAsesoraId(data.candidatos?.[0]?.id ?? "");
      setFecha(data.sugerencia_fecha ?? "");
      setHora(data.sugerencia_hora ?? "");
      setTipo(data.lectura?.tipo_sugerido ?? "entrada");
      setConfianza(data.lectura?.confianza ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo analizar la foto");
    } finally {
      setAnalizando(false);
    }
  }

  async function guardarMarca() {
    if (!asesoraId || !fecha || !hora) {
      setError("Completa asesora, fecha y hora antes de guardar.");
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const resp = await fetch("/api/marcas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asesora_id: asesoraId,
          fecha,
          hora,
          tipo,
          foto_base64: fotoBase64,
          origen: "ocr",
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);

      setGuardadoOk(true);
      if (data.anomalia) setMensajeAnomalia(data.anomalia.mensaje);

      setPreviewUrl(null);
      setFotoBase64(null);
      setCandidatos([]);
      setAsesoraId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la marca");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Capturar marca</h1>

      <label className="block">
        <span className="text-sm text-neutral-600">Foto del gafete + reloj</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onSeleccionarFoto}
          className="mt-1 block w-full text-sm"
        />
      </label>

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="Foto seleccionada" className="rounded-lg max-h-64 w-auto mx-auto" />
      )}

      {analizando && <p className="text-sm text-neutral-500">Analizando foto…</p>}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {guardadoOk && !mensajeAnomalia && (
        <p className="text-sm text-green-700">Marca guardada correctamente.</p>
      )}

      {!analizando && fotoBase64 && (
        <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
          {confianza && (
            <p className="text-xs text-neutral-500">
              Lectura automatica (confianza {confianza}). Revisa y corrige si es necesario.
            </p>
          )}

          <label className="block">
            <span className="text-sm text-neutral-600">Asesora</span>
            <select
              value={asesoraId}
              onChange={(e) => setAsesoraId(e.target.value)}
              className="mt-1 block w-full rounded border border-neutral-300 p-2"
            >
              <option value="">-- Selecciona --</option>
              {candidatos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.punto})
                </option>
              ))}
            </select>
            {candidatos.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No se encontro coincidencia automatica; selecciona manualmente desde Asesoras si
                hace falta agregarla al catalogo.
              </p>
            )}
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-neutral-600">Fecha</span>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="mt-1 block w-full rounded border border-neutral-300 p-2"
              />
            </label>
            <label className="block">
              <span className="text-sm text-neutral-600">Hora</span>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="mt-1 block w-full rounded border border-neutral-300 p-2"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm text-neutral-600">Tipo de marca</span>
            <div className="mt-1 flex gap-2">
              {(["entrada", "salida"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`flex-1 rounded p-2 text-sm font-medium ${
                    tipo === t ? "bg-[#196B24] text-white" : "bg-neutral-100 text-neutral-700"
                  }`}
                >
                  {t === "entrada" ? "Entrada" : "Salida"}
                </button>
              ))}
            </div>
          </label>

          <button
            onClick={guardarMarca}
            disabled={guardando}
            className="w-full rounded-md bg-[#196B24] text-white py-2 font-medium disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar marca"}
          </button>
        </div>
      )}

      {mensajeAnomalia && (
        <PopupAnomalia mensaje={mensajeAnomalia} onCerrar={() => setMensajeAnomalia(null)} />
      )}
    </div>
  );
}
