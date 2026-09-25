"use client";

import { useMemo, useRef, useState } from "react";
import type { DiaEspecial } from "@/lib/tipos";

type Tipo = "libre" | "vacaciones" | "incapacidad";

const TIPOS: { id: Tipo; etiqueta: string; letra: string; fondo: string; texto: string }[] = [
  { id: "libre", etiqueta: "Libre", letra: "L", fondo: "#8E9A9C", texto: "#FFFFFF" },
  { id: "vacaciones", etiqueta: "Vacaciones", letra: "V", fondo: "#0B5F6C", texto: "#FFFFFF" },
  { id: "incapacidad", etiqueta: "Incapacidad", letra: "I", fondo: "#7B61D6", texto: "#FFFFFF" },
];

const SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function sumar(iso: string, n: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

// Lunes = 0 ... domingo = 6.
function diaSemana(iso: string): number {
  return (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;
}

function corto(iso: string): string {
  return `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;
}

/** Agrupa fechas en tramos de dias consecutivos. */
function tramos(fechas: string[]): [string, string][] {
  const orden = [...fechas].sort();
  const r: [string, string][] = [];
  for (const f of orden) {
    const ultimo = r[r.length - 1];
    if (ultimo && sumar(ultimo[1], 1) === f) ultimo[1] = f;
    else r.push([f, f]);
  }
  return r;
}

/** Reduce la foto (los celulares dan fotos enormes) antes de mandarla a leer. */
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

/**
 * Libres, vacaciones e incapacidades de UNA asesora, sobre su calendario del mes.
 * Se marcan dias sueltos o "todos los martes"; la incapacidad se puede leer de la foto del comprobante.
 */
export default function PlanificarMes({
  asesoraId,
  nombre,
  mes,
  especiales,
  hoy,
  onCambio,
  onCerrar,
}: {
  asesoraId: string;
  nombre: string;
  mes: string; // YYYY-MM
  especiales: DiaEspecial[]; // los de esta asesora en el mes
  hoy: string;
  onCambio: () => void;
  onCerrar: () => void;
}) {
  const totalDias = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate();
  const fechasMes = useMemo(() => Array.from({ length: totalDias }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`), [mes, totalDias]);

  const inicial = useMemo(() => {
    const m: Record<string, Tipo> = {};
    for (const e of especiales) if (e.tipo === "libre" || e.tipo === "vacaciones" || e.tipo === "incapacidad") m[e.fecha] = e.tipo;
    return m;
  }, [especiales]);
  const ausenciasManuales = useMemo(() => new Set(especiales.filter((e) => e.tipo === "ausencia").map((e) => e.fecha)), [especiales]);
  const notaExistente = useMemo(() => especiales.find((e) => e.tipo === "incapacidad" && e.nota)?.nota ?? null, [especiales]);

  const [activo, setActivo] = useState<Tipo>("libre");
  const [sel, setSel] = useState<Record<string, Tipo | null>>(() => ({ ...inicial }));
  const [nota, setNota] = useState("");
  const [codigo, setCodigo] = useState("");
  const [rangoFoto, setRangoFoto] = useState<{ desde: string; hasta: string } | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputFoto = useRef<HTMLInputElement>(null);

  const cambios = fechasMes.filter((f) => (sel[f] ?? null) !== (inicial[f] ?? null));
  const info = TIPOS.find((t) => t.id === activo)!;
  const primerDia = diaSemana(`${mes}-01`);

  function alternarDia(f: string) {
    if (ausenciasManuales.has(f)) return;
    setSel((s) => ({ ...s, [f]: s[f] === activo ? null : activo }));
  }

  function alternarSemana(dow: number) {
    const fechas = fechasMes.filter((f) => diaSemana(f) === dow && !ausenciasManuales.has(f));
    const todosActivos = fechas.every((f) => sel[f] === activo);
    setSel((s) => {
      const n = { ...s };
      for (const f of fechas) n[f] = todosActivos ? null : activo;
      return n;
    });
  }

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
        setError("No pude leer el comprobante. Puedes marcar los días en el calendario y escribir el código a mano.");
        return;
      }
      setActivo("incapacidad");
      if (l.codigo) setCodigo(l.codigo);
      if (l.desde && l.hasta) {
        setRangoFoto({ desde: l.desde, hasta: l.hasta });
        setSel((s) => {
          const n = { ...s };
          for (let f = l.desde as string; f <= (l.hasta as string); f = sumar(f, 1)) if (fechasMes.includes(f)) n[f] = "incapacidad";
          return n;
        });
      }
      const partes = [l.codigo ? `código ${l.codigo}` : null, l.desde && l.hasta ? `del ${corto(l.desde)} al ${corto(l.hasta)}` : null, l.nombre_detectado ? `a nombre de ${l.nombre_detectado}` : null];
      setMensaje(`Leí: ${partes.filter(Boolean).join(" · ")}. Revísalo y corrige lo que haga falta antes de guardar.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer el comprobante");
    } finally {
      setLeyendo(false);
    }
  }

  async function guardar() {
    setError(null);
    setMensaje(null);
    setGuardando(true);
    try {
      const quitar = cambios.filter((f) => !sel[f]);
      const poner = (t: Tipo) => cambios.filter((f) => sel[f] === t);
      const post = async (t: Tipo, d: string, h: string, textoNota: string | null) => {
        const r = await fetch("/api/dias-especiales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asesora_id: asesoraId, tipo: t, fecha_desde: d, fecha_hasta: h, nota: textoNota }),
        });
        if (!r.ok) throw new Error((await r.json()).error ?? "No se pudo guardar");
      };

      for (const [d, h] of tramos(quitar)) {
        await fetch(`/api/dias-especiales?asesora_id=${asesoraId}&desde=${d}&hasta=${h}`, { method: "DELETE" });
      }
      for (const t of TIPOS) {
        const textoNota =
          t.id === "incapacidad"
            ? [codigo.trim() ? `Comprobante ${codigo.trim()}` : null, nota.trim() || null].filter(Boolean).join(" · ") || null
            : nota.trim() || null;
        const lista = poner(t.id);
        // Un comprobante que empieza o termina en otro mes se guarda completo, no solo la parte visible.
        if (t.id === "incapacidad" && rangoFoto && lista.length > 0) {
          for (let f = rangoFoto.desde; f <= rangoFoto.hasta; f = sumar(f, 1)) if (!fechasMes.includes(f)) lista.push(f);
        }
        for (const [d, h] of tramos(lista)) {
          await post(t.id, d, h, textoNota);
          if (t.id !== "libre") {
            await fetch("/api/comentarios", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fecha: d,
                asunto: t.etiqueta,
                asesora_id: asesoraId,
                situacion: `${d === h ? corto(d) : `del ${corto(d)} al ${corto(h)}`}${textoNota ? ` · ${textoNota}` : ""}`,
              }),
            }).catch(() => {});
          }
        }
      }
      setNota("");
      setRangoFoto(null);
      onCambio();
      onCerrar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  const conteo = (t: Tipo) => fechasMes.filter((f) => sel[f] === t).length;

  return (
    <div className="rounded-xl border-2 border-[#1EA6B8] bg-white p-3 space-y-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-extrabold text-[#0B5F6C]">✏️ Editando el calendario</div>
          <div className="text-[11.5px] text-[#6B6D6E]">Elige libre, vacaciones o incapacidad y toca los días de {nombre.split(" ")[0]}</div>
        </div>
        <button onClick={onCerrar} className="text-[12px] text-[#6B6D6E] font-semibold px-1">
          Cancelar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {TIPOS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActivo(t.id)}
            className={`rounded-lg py-2.5 text-[12px] font-bold ${activo === t.id ? "bg-[#0B5F6C] text-white" : "bg-[#E4F7F9] text-[#0B5F6C]"}`}
          >
            {t.etiqueta}
            <span className="block text-[10px] font-semibold opacity-80">{conteo(t.id)} día(s)</span>
          </button>
        ))}
      </div>

      <div>
        <div className="text-[10.5px] font-bold text-[#6B6D6E] uppercase tracking-wide mb-1">
          Marcar como {info.etiqueta.toLowerCase()} todos los…
        </div>
        <div className="grid grid-cols-7 gap-1">
          {SEMANA.map((n, dow) => {
            const fechas = fechasMes.filter((f) => diaSemana(f) === dow && !ausenciasManuales.has(f));
            const todos = fechas.length > 0 && fechas.every((f) => sel[f] === activo);
            return (
              <button
                key={n}
                onClick={() => alternarSemana(dow)}
                className={`rounded-lg py-2 text-[11px] font-bold border ${todos ? "bg-[#0B5F6C] text-white border-[#0B5F6C]" : "bg-white text-[#0B5F6C] border-[#1EA6B8]"}`}
                aria-pressed={todos}
              >
                {todos ? "✓ " : ""}
                {n}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {SEMANA.map((n) => (
          <div key={n} className="text-center text-[10px] font-bold text-[#6B6D6E]">
            {n === "Mié" ? "X" : n[0]}
          </div>
        ))}
        {Array.from({ length: primerDia }).map((_, i) => (
          <div key={`v${i}`} />
        ))}
        {fechasMes.map((f) => {
          const t = TIPOS.find((x) => x.id === sel[f]);
          const bloqueado = ausenciasManuales.has(f);
          const cambiado = (sel[f] ?? null) !== (inicial[f] ?? null);
          return (
            <button
              key={f}
              onClick={() => alternarDia(f)}
              disabled={bloqueado}
              className="disabled:opacity-40"
              aria-label={`Día ${Number(f.slice(8))}: ${t?.etiqueta ?? "sin registro"}`}
            >
              <span
                className="grid place-items-center w-full h-11 rounded-[10px] text-[13px]"
                style={{
                  background: t?.fondo ?? "#F2F8F9",
                  color: t?.texto ?? (bloqueado ? "#E5484D" : "#6B6D6E"),
                  fontWeight: t || f === hoy ? 800 : 500,
                  boxShadow: cambiado ? "0 0 0 2px #FFFFFF, 0 0 0 4px #35DCEC" : f === hoy ? "inset 0 0 0 2.5px #0B3A41" : "none",
                }}
              >
                {Number(f.slice(8))}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[10.5px] text-[#6B6D6E] leading-snug">
        Toca un día para marcarlo o quitarlo. Los días con borde celeste son cambios que aún no guardas.
      </p>

      {activo === "incapacidad" && (
        <div className="rounded-lg bg-[#F2F8F9] p-2.5 space-y-2">
          <button
            onClick={() => inputFoto.current?.click()}
            disabled={leyendo}
            className="w-full rounded-lg border-2 border-dashed border-[#1EA6B8] bg-white py-2.5 text-[12.5px] font-bold text-[#0B5F6C] disabled:opacity-60"
          >
            {leyendo ? "Leyendo el comprobante…" : "📄 Subir foto del comprobante"}
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
            placeholder={notaExistente ? `Código del comprobante (${notaExistente})` : "Código del comprobante (se llena solo con la foto)"}
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

      <button
        onClick={guardar}
        disabled={guardando || cambios.length === 0}
        className="w-full rounded-xl py-3 font-bold text-white text-sm disabled:opacity-50"
        style={{ background: "linear-gradient(150deg, #0B5F6C, #1EA6B8)" }}
      >
        {guardando ? "Guardando…" : cambios.length === 0 ? "Sin cambios por guardar" : `Guardar ${cambios.length} cambio(s)`}
      </button>
    </div>
  );
}
