"use client";

import { useEffect, useRef, useState } from "react";
import PopupAnomalia from "@/components/PopupAnomalia";

type Candidato = { id: string; nombre: string; punto: string; score: number };

type ItemCola = {
  archivoNombre: string;
  previewUrl: string;
  base64: string;
  mediaType: string;
  estado: "leyendo" | "listo" | "error";
  asesora_id: string;
  candidatos: Candidato[];
  fecha: string;
  hora: string;
  tipo: "entrada" | "salida";
};

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

export default function PanelCapturar() {
  const [cola, setCola] = useState<ItemCola[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [colaAnomalias, setColaAnomalias] = useState<string[]>([]);
  const [mensajeOk, setMensajeOk] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);

  async function procesarArchivos(files: FileList | File[]) {
    const lista = Array.from(files);
    setMensajeOk(null);

    const nuevos: ItemCola[] = lista.map((f) => ({
      archivoNombre: f.name,
      previewUrl: URL.createObjectURL(f),
      base64: "",
      mediaType: "",
      estado: "leyendo",
      asesora_id: "",
      candidatos: [],
      fecha: new Date().toISOString().slice(0, 10),
      hora: new Date().toTimeString().slice(0, 5),
      tipo: "entrada",
    }));
    setCola((prev) => [...prev, ...nuevos]);
    setProcesando(true);

    for (let i = 0; i < lista.length; i++) {
      const file = lista[i];
      const { base64, mediaType } = await fileToBase64(file);
      try {
        const resp = await fetch("/api/marcas/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagenBase64: base64, mediaType }),
        });
        const data = await resp.json();
        setCola((prev) =>
          prev.map((item) =>
            item.archivoNombre === file.name && item.estado === "leyendo"
              ? {
                  ...item,
                  base64,
                  mediaType,
                  estado: "listo",
                  asesora_id: data.candidatos?.[0]?.id ?? "",
                  candidatos: data.candidatos ?? [],
                  fecha: data.sugerencia_fecha ?? item.fecha,
                  hora: data.sugerencia_hora ?? item.hora,
                  tipo: data.lectura?.tipo_sugerido ?? "entrada",
                }
              : item
          )
        );
      } catch {
        setCola((prev) =>
          prev.map((item) =>
            item.archivoNombre === file.name && item.estado === "leyendo" ? { ...item, estado: "error" } : item
          )
        );
      }
    }
    setProcesando(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setArrastrando(false);
    if (e.dataTransfer.files?.length) procesarArchivos(e.dataTransfer.files);
  }

  function actualizarItem(idx: number, cambios: Partial<ItemCola>) {
    setCola((prev) => prev.map((it, i) => (i === idx ? { ...it, ...cambios } : it)));
  }

  function quitarItem(idx: number) {
    setCola((prev) => prev.filter((_, i) => i !== idx));
  }

  async function confirmarLote() {
    const listos = cola.filter((it) => it.estado === "listo" && it.asesora_id);
    if (listos.length === 0) return;

    setGuardando(true);
    try {
      const resp = await fetch("/api/marcas/lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: listos.map((it) => ({
            asesora_id: it.asesora_id,
            fecha: it.fecha,
            hora: it.hora,
            tipo: it.tipo,
            foto_base64: it.base64,
          })),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);

      setMensajeOk(`${data.guardadas} marcas guardadas correctamente.`);
      setColaAnomalias((data.anomalias ?? []).map((a: { mensaje: string }) => a.mensaje));
      setCola([]);
    } catch {
      // noop, error visible por falta de mensajeOk
    } finally {
      setGuardando(false);
    }
  }

  const [catalogo, setCatalogo] = useState<Candidato[]>([]);
  useEffect(() => {
    fetch("/api/asesoras")
      .then((r) => r.json())
      .then((d) => setCatalogo((d.asesoras ?? []).filter((a: { activo: boolean }) => a.activo)));
  }, []);

  const listos = cola.filter((it) => it.estado === "listo").length;

  const [manualAbierto, setManualAbierto] = useState(false);
  const [manualAsesora, setManualAsesora] = useState("");
  const [manualFecha, setManualFecha] = useState(new Date().toISOString().slice(0, 10));
  const [manualHora, setManualHora] = useState(new Date().toTimeString().slice(0, 5));
  const [manualTipo, setManualTipo] = useState<"entrada" | "salida">("entrada");
  const [manualGuardando, setManualGuardando] = useState(false);

  async function guardarManual() {
    if (!manualAsesora) return;
    setManualGuardando(true);
    try {
      const resp = await fetch("/api/marcas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asesora_id: manualAsesora,
          fecha: manualFecha,
          hora: manualHora,
          tipo: manualTipo,
          origen: "manual",
        }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setMensajeOk("Marca manual guardada.");
        if (data.anomalia) setColaAnomalias((prev) => [...prev, data.anomalia.mensaje]);
        setManualAbierto(false);
        setManualAsesora("");
      }
    } finally {
      setManualGuardando(false);
    }
  }

  return (
    <div className="space-y-3">
      <span className="block text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide">Fotos de hoy</span>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed p-6 text-center text-[13px] font-bold text-[#0B5F6C] cursor-pointer ${
          arrastrando ? "bg-[#CFF0F3] border-[#0F7A8A]" : "bg-[#E4F7F9] border-[#1EA6B8]"
        }`}
      >
        📥 Arrastra o toca para elegir TODAS las fotos guardadas del WhatsApp
        <div className="mt-1 text-[11px] font-normal text-[#6B6D6E]">
          Se procesan en lote: entradas y salidas de una sola vez
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && procesarArchivos(e.target.files)}
        />
      </div>

      {mensajeOk && <p className="text-sm text-[#1E8A5F] font-semibold">{mensajeOk}</p>}

      {cola.length > 0 && (
        <div className="space-y-2">
          {cola.map((item, idx) => (
            <div key={item.archivoNombre + idx} className="rounded-xl border border-[#DDE7E8] bg-white p-2.5">
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.previewUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-none" />
                <div className="flex-1 text-[11px] text-[#6B6D6E] truncate">{item.archivoNombre}</div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    item.estado === "listo"
                      ? "bg-[#E7F5EE] text-[#1E8A5F]"
                      : item.estado === "error"
                      ? "bg-[#FBEAEA] text-[#B23A3A]"
                      : "bg-[#CFF0F3] text-[#0B5F6C]"
                  }`}
                >
                  {item.estado === "listo" ? "Listo" : item.estado === "error" ? "Error" : "Leyendo…"}
                </span>
                <button onClick={() => quitarItem(idx)} className="text-[#6B6D6E] text-xs px-1">
                  ✕
                </button>
              </div>

              {item.estado === "listo" && (
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                  <select
                    value={item.asesora_id}
                    onChange={(e) => actualizarItem(idx, { asesora_id: e.target.value })}
                    className="col-span-2 rounded border border-[#DDE7E8] p-1.5"
                  >
                    <option value="">-- Asesora --</option>
                    {(item.candidatos.length ? item.candidatos : catalogo).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} ({c.punto})
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={item.fecha}
                    onChange={(e) => actualizarItem(idx, { fecha: e.target.value })}
                    className="rounded border border-[#DDE7E8] p-1.5"
                  />
                  <input
                    type="time"
                    value={item.hora}
                    onChange={(e) => actualizarItem(idx, { hora: e.target.value })}
                    className="rounded border border-[#DDE7E8] p-1.5"
                  />
                  <div className="col-span-2 flex gap-1.5">
                    {(["entrada", "salida"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => actualizarItem(idx, { tipo: t })}
                        className={`flex-1 rounded py-1.5 text-[11px] font-semibold ${
                          item.tipo === t ? "bg-[#3A3B3C] text-white" : "bg-[#F2F8F9] text-[#6B6D6E]"
                        }`}
                      >
                        {t === "entrada" ? "Entrada" : "Salida"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {cola.length > 0 && (
        <div className="rounded-xl bg-[#E4F7F9] border border-[#CFF0F3] p-2.5 text-[12px] text-[#0B5F6C] font-semibold">
          {cola.length} fotos cargadas → {listos} listas para confirmar.
        </div>
      )}

      <button
        onClick={confirmarLote}
        disabled={guardando || listos === 0 || procesando}
        className="w-full rounded-xl py-3 font-bold text-white text-sm disabled:opacity-50"
        style={{ background: "linear-gradient(150deg, #0B5F6C, #1EA6B8)" }}
      >
        {guardando ? "Guardando…" : `Confirmar y guardar ${listos || ""} marcas`.trim()}
      </button>

      <div className="pt-2 border-t border-[#DDE7E8]">
        <button
          onClick={() => setManualAbierto((v) => !v)}
          className="text-[12px] font-bold text-[#0F7A8A] border border-dashed border-[#0F7A8A] rounded-lg px-3 py-2 w-full"
        >
          {manualAbierto ? "Cancelar" : "+ Agregar marca manual (sin foto)"}
        </button>
        {manualAbierto && (
          <div className="mt-2 rounded-xl border border-[#DDE7E8] bg-white p-2.5 space-y-2">
            <select
              value={manualAsesora}
              onChange={(e) => setManualAsesora(e.target.value)}
              className="w-full rounded border border-[#DDE7E8] p-1.5 text-[11.5px]"
            >
              <option value="">-- Asesora --</option>
              {catalogo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.punto})
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={manualFecha} onChange={(e) => setManualFecha(e.target.value)} className="rounded border border-[#DDE7E8] p-1.5 text-[11.5px]" />
              <input type="time" value={manualHora} onChange={(e) => setManualHora(e.target.value)} className="rounded border border-[#DDE7E8] p-1.5 text-[11.5px]" />
            </div>
            <div className="flex gap-1.5">
              {(["entrada", "salida"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setManualTipo(t)}
                  className={`flex-1 rounded py-1.5 text-[11px] font-semibold ${
                    manualTipo === t ? "bg-[#3A3B3C] text-white" : "bg-[#F2F8F9] text-[#6B6D6E]"
                  }`}
                >
                  {t === "entrada" ? "Entrada" : "Salida"}
                </button>
              ))}
            </div>
            <button
              onClick={guardarManual}
              disabled={manualGuardando || !manualAsesora}
              className="w-full rounded-lg py-2 text-[12px] font-bold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(150deg, #0B5F6C, #1EA6B8)" }}
            >
              Guardar marca manual
            </button>
          </div>
        )}
      </div>

      {colaAnomalias.length > 0 && (
        <PopupAnomalia
          mensaje={colaAnomalias[0]}
          onCerrar={() => setColaAnomalias((prev) => prev.slice(1))}
        />
      )}
    </div>
  );
}
