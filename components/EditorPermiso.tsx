"use client";

import { useRef, useState } from "react";
import { IconoDocumento } from "@/components/Iconos";

export type TipoPermiso = "libre" | "vacaciones" | "incapacidad";

const TIPOS: { id: TipoPermiso; etiqueta: string; fondo: string; texto: string }[] = [
  { id: "libre", etiqueta: "Libre", fondo: "#14C4B8", texto: "#FFFFFF" },
  { id: "vacaciones", etiqueta: "Vacaciones", fondo: "#4FB8E8", texto: "#0B3A41" },
  { id: "incapacidad", etiqueta: "Incapacidad", fondo: "#8E9A9C", texto: "#FFFFFF" },
];

/** Reduce la foto del comprobante (las de celular son enormes) antes de mandarla a leer. */
function fotoReducida(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, 1800 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({ base64: canvas.toDataURL("image/jpeg", 0.85).split(",")[1], mediaType: "image/jpeg" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No pude abrir esa imagen"));
    };
    img.src = url;
  });
}

function corto(iso: string): string {
  return `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;
}

/**
 * Crea, corrige o elimina un libre/vacaciones/incapacidad de UNA asesora, con su rango de
 * fechas (desde/hasta), nota, y para incapacidad el comprobante (foto + codigo). Se abre desde
 * el detalle de un dia o desde la hora de hoy; el rango deja elegir varios dias, no solo ese.
 */
export default function EditorPermiso({
  asesoraId,
  nombre,
  fecha,
  tipoInicial,
  desdeInicial,
  hastaInicial,
  notaInicial,
  existente,
  onGuardado,
  onCerrar,
}: {
  asesoraId: string;
  nombre: string;
  fecha: string; // dia por defecto si no hay uno ya registrado
  tipoInicial?: TipoPermiso;
  desdeInicial?: string;
  hastaInicial?: string;
  notaInicial?: string;
  existente: boolean; // ya hay un permiso registrado ahi (se puede eliminar)
  onGuardado: () => void;
  onCerrar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoPermiso>(tipoInicial ?? "libre");
  const [desde, setDesde] = useState(desdeInicial ?? fecha);
  const [hasta, setHasta] = useState(hastaInicial ?? fecha);
  const [nota, setNota] = useState(notaInicial ?? "");
  const [codigo, setCodigo] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  async function leerComprobante(file: File) {
    setError(null);
    setMensaje(null);
    setLeyendo(true);
    try {
      const { base64, mediaType } = await fotoReducida(file);
      const resp = await fetch("/api/incapacidad/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagenBase64: base64, mediaType }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      const l = data.lectura as { codigo: string | null; desde: string | null; hasta: string | null; nombre_detectado: string | null };
      if (!l.desde && !l.codigo) {
        setError("No pude leer el comprobante. Escribe las fechas y el código a mano, por favor.");
        return;
      }
      if (l.codigo) setCodigo(l.codigo);
      if (l.desde) setDesde(l.desde);
      if (l.hasta) setHasta(l.hasta);
      const partes = [
        l.codigo ? `código ${l.codigo}` : null,
        l.desde && l.hasta ? `del ${corto(l.desde)} al ${corto(l.hasta)}` : null,
        l.nombre_detectado ? `a nombre de ${l.nombre_detectado}` : null,
      ];
      setMensaje(`Leí: ${partes.filter(Boolean).join(" · ")}. Revísalo antes de guardar.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer el comprobante");
    } finally {
      setLeyendo(false);
    }
  }

  async function guardar() {
    setError(null);
    setMensaje(null);
    if (hasta < desde) {
      setError("La fecha final no puede ser anterior a la inicial, por favor.");
      return;
    }
    setGuardando(true);
    try {
      const textoNota =
        tipo === "incapacidad"
          ? [codigo.trim() ? `Comprobante ${codigo.trim()}` : null, nota.trim() || null].filter(Boolean).join(" · ") || null
          : nota.trim() || null;
      const r = await fetch("/api/dias-especiales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asesora_id: asesoraId, tipo, fecha_desde: desde, fecha_hasta: hasta, nota: textoNota }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "No se pudo guardar");
      if (tipo !== "libre") {
        await fetch("/api/comentarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fecha: desde,
            asunto: tipo === "vacaciones" ? "Vacaciones" : "Incapacidad",
            asesora_id: asesoraId,
            situacion: `${desde === hasta ? corto(desde) : `del ${corto(desde)} al ${corto(hasta)}`}${textoNota ? ` · ${textoNota}` : ""}`,
          }),
        }).catch(() => {});
      }
      onGuardado();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function quitar() {
    setGuardando(true);
    try {
      await fetch(`/api/dias-especiales?asesora_id=${asesoraId}&desde=${desdeInicial ?? fecha}&hasta=${hastaInicial ?? fecha}`, { method: "DELETE" });
      onGuardado();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-xl border-2 border-[#1EA6B8] bg-white p-3 space-y-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 text-[12.5px] font-bold text-[#0B5F6C]">
          {existente ? "Editar" : "Marcar"} libre, vacaciones o incapacidad
        </div>
        <button onClick={onCerrar} className="text-[12px] text-[#6B6D6E] font-semibold px-1">
          Cerrar
        </button>
      </div>
      <div className="text-[11.5px] text-[#6B6D6E] -mt-1.5">{nombre}</div>

      <div className="grid grid-cols-3 gap-1.5">
        {TIPOS.map((t) => {
          const activo = tipo === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTipo(t.id)}
              className="rounded-lg py-2 text-[12px] font-bold"
              style={{ background: activo ? t.fondo : "#F2F8F9", color: activo ? t.texto : "#3A3B3C" }}
            >
              {t.etiqueta}
            </button>
          );
        })}
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
      <p className="text-[11.5px] font-semibold text-[#0B5F6C]">
        {desde === hasta ? `Un día: ${corto(desde)}` : `Del ${corto(desde)} al ${corto(hasta)}`}
      </p>

      {tipo === "incapacidad" && (
        <div className="rounded-lg bg-[#F2F8F9] p-2.5 space-y-2">
          <button
            onClick={() => inputFoto.current?.click()}
            disabled={leyendo}
            className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#1EA6B8] bg-white py-2.5 text-[12.5px] font-bold text-[#0B5F6C] disabled:opacity-60"
          >
            {leyendo ? "Leyendo el comprobante…" : (<><IconoDocumento size={17} /> Subir foto del comprobante</>)}
          </button>
          <input
            ref={inputFoto}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void leerComprobante(file);
              e.target.value = "";
            }}
          />
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Código del comprobante"
            className="w-full rounded-lg border border-[#DDE7E8] bg-white p-2.5 text-[13px]"
          />
        </div>
      )}

      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Nota (opcional)"
        className="w-full rounded-lg border border-[#DDE7E8] p-2.5 text-[13px]"
      />

      {mensaje && <p className="text-[12px] text-[#1E8A5F] font-semibold leading-snug">{mensaje}</p>}
      {error && <p className="text-[12px] text-[#B23A3A] font-semibold leading-snug">{error}</p>}

      <div className="flex gap-2">
        {existente && (
          <button
            onClick={quitar}
            disabled={guardando}
            className="flex-1 rounded-lg border border-[#DDE7E8] text-[#B23A3A] py-2.5 text-[12.5px] font-bold disabled:opacity-50"
          >
            Eliminar
          </button>
        )}
        <button
          onClick={guardar}
          disabled={guardando}
          className="flex-1 rounded-xl py-2.5 font-bold text-white text-[13px] disabled:opacity-50"
          style={{ background: "linear-gradient(150deg, #0B5F6C, #1EA6B8)" }}
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
