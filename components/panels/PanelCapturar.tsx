"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PopupAnomalia from "@/components/PopupAnomalia";
import VisorMarca, { type ItemCaptura } from "@/components/VisorMarca";
import { claveMarca } from "@/lib/asistencia";
import { ahoraCR } from "@/lib/tiempo";

type Asesora = { id: string; nombre: string; punto: string };
type Candidato = Asesora & { score: number };

const UMBRAL_AUTOSELECCION = 0.5;

function horaActualCR(): string {
  const { minutos } = ahoraCR();
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

function diaMes(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

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

async function hashArchivo(file: File): Promise<string> {
  try {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return `${file.name}|${file.size}|${file.lastModified}`;
  }
}

export default function PanelCapturar({ onGuardado }: { onGuardado?: () => void }) {
  const [cola, setCola] = useState<ItemCaptura[]>([]);
  const [catalogo, setCatalogo] = useState<Asesora[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [colaAnomalias, setColaAnomalias] = useState<string[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [soloRevisar, setSoloRevisar] = useState(false);
  const [visorId, setVisorId] = useState<number | null>(null);
  const [listaVisor, setListaVisor] = useState<number[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const colaRef = useRef<ItemCaptura[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    colaRef.current = cola;
  }, [cola]);

  useEffect(() => {
    fetch("/api/asesoras")
      .then((r) => r.json())
      .then((d) => setCatalogo((d.asesoras ?? []).filter((a: { activo: boolean }) => a.activo)));
  }, []);

  const asesoraPorId = useMemo(() => new Map(catalogo.map((a) => [a.id, a])), [catalogo]);

  // Marcas repetidas dentro del lote (misma asesora, dia, tipo y hora): solo cuenta la primera.
  const duplicadas = useMemo(() => {
    const vistas = new Set<string>();
    const dup = new Set<number>();
    for (const it of cola) {
      if (it.estado !== "listo" || !it.asesora_id) continue;
      const clave = claveMarca({ asesora_id: it.asesora_id, fecha: it.fecha, tipo: it.tipo, hora: it.hora });
      if (vistas.has(clave)) dup.add(it.id);
      else vistas.add(clave);
    }
    return dup;
  }, [cola]);

  const fechaFrecuente = useMemo(() => {
    const conteo = new Map<string, number>();
    for (const it of cola) if (it.estado === "listo") conteo.set(it.fecha, (conteo.get(it.fecha) ?? 0) + 1);
    let mejor = "";
    let max = 0;
    for (const [f, n] of conteo) if (n > max) [mejor, max] = [f, n];
    return mejor;
  }, [cola]);

  // Por que conviene revisar cada foto (vacio = todo en orden).
  const razones = useMemo(() => {
    const mapa = new Map<number, string[]>();
    for (const it of cola) {
      const r: string[] = [];
      if (it.estado === "error") r.push("No se pudo leer la foto: puedes completarla a mano");
      if (it.estado !== "leyendo" && !it.asesora_id) r.push("Falta identificar a la asesora");
      if (it.estado === "listo" && !it.confirmado) {
        if (!it.horaLeida) r.push("Conviene revisar la hora (no se leyó con claridad)");
        if (!it.fechaLeida) r.push("Conviene revisar la fecha");
        if (it.confianza && it.confianza !== "alta") r.push("Lectura poco segura");
        if (it.hora < "05:00" || it.hora > "23:00") r.push("Hora poco habitual");
        if (fechaFrecuente && it.fecha !== fechaFrecuente) r.push("Fecha distinta a la del resto del lote");
      }
      mapa.set(it.id, r);
    }
    return mapa;
  }, [cola, fechaFrecuente]);

  const porRevisar = cola.filter((it) => (razones.get(it.id)?.length ?? 0) > 0 && !duplicadas.has(it.id));
  const visibles = soloRevisar ? porRevisar : cola;
  const aGuardar = cola.filter((it) => it.estado === "listo" && it.asesora_id && !duplicadas.has(it.id));

  async function procesarArchivos(files: FileList | File[]) {
    setMensaje(null);
    setError(null);

    const hashesConocidos = new Set(colaRef.current.map((i) => i.hash));
    const nuevos: { item: ItemCaptura; file: File }[] = [];
    let omitidasArchivo = 0;

    for (const file of Array.from(files)) {
      const hash = await hashArchivo(file);
      if (hashesConocidos.has(hash)) {
        omitidasArchivo++;
        continue;
      }
      hashesConocidos.add(hash);
      idRef.current += 1;
      nuevos.push({
        file,
        item: {
          id: idRef.current,
          hash,
          previewUrl: URL.createObjectURL(file),
          estado: "leyendo",
          asesora_id: "",
          candidatos: [],
          fecha: ahoraCR().fecha,
          hora: horaActualCR(),
          tipo: "entrada",
          base64: "",
          confianza: null,
          horaLeida: false,
          fechaLeida: false,
          confirmado: false,
        },
      });
    }

    if (omitidasArchivo > 0) setMensaje(`${omitidasArchivo} foto(s) repetida(s) omitida(s).`);
    if (nuevos.length === 0) return;

    setCola((prev) => [...prev, ...nuevos.map((n) => n.item)]);
    setProcesando(true);

    for (const { file, item } of nuevos) {
      try {
        const { base64, mediaType } = await fileToBase64(file);
        const resp = await fetch("/api/marcas/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagenBase64: base64, mediaType }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error);

        const candidatos: Candidato[] = data.candidatos ?? [];
        const mejor = candidatos[0];
        setCola((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  base64,
                  estado: "listo",
                  candidatos,
                  asesora_id: mejor && mejor.score >= UMBRAL_AUTOSELECCION ? mejor.id : "",
                  fecha: data.sugerencia_fecha ?? it.fecha,
                  hora: data.sugerencia_hora ?? it.hora,
                  tipo: data.lectura?.tipo_sugerido ?? "entrada",
                  confianza: data.lectura?.confianza ?? null,
                  horaLeida: !!data.hora_leida,
                  fechaLeida: !!data.fecha_leida,
                }
              : it
          )
        );
      } catch {
        setCola((prev) => prev.map((it) => (it.id === item.id ? { ...it, estado: "error" } : it)));
      }
    }
    setProcesando(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setArrastrando(false);
    if (e.dataTransfer.files?.length) void procesarArchivos(e.dataTransfer.files);
  }

  function actualizar(id: number, cambios: Partial<ItemCaptura>) {
    setCola((prev) => prev.map((it) => (it.id === id ? { ...it, ...cambios } : it)));
  }

  function quitar(id: number) {
    setCola((prev) => prev.filter((it) => it.id !== id));
  }

  // Sugeridas primero, luego el resto del catalogo: siempre con el nombre oficial.
  function opcionesPara(item: ItemCaptura): Asesora[] {
    const sugeridas = item.candidatos.map((c) => asesoraPorId.get(c.id) ?? c);
    const idsSugeridas = new Set(sugeridas.map((s) => s.id));
    return [...sugeridas, ...catalogo.filter((a) => !idsSugeridas.has(a.id))];
  }

  async function confirmarLote() {
    if (aGuardar.length === 0) return;
    if (
      porRevisar.length > 0 &&
      !confirm(`Aún quedan ${porRevisar.length} foto(s) por revisar. ¿Deseas guardar de todos modos?`)
    ) {
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const resp = await fetch("/api/marcas/lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: aGuardar.map((it) => ({
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

      const omitidas = (data.omitidas ?? 0) + duplicadas.size;
      const sinGuardar = cola.length - aGuardar.length - duplicadas.size;
      setMensaje(
        `Listo: ${data.guardadas} marca(s) guardada(s)` +
          (omitidas > 0 ? ` · ${omitidas} repetida(s) omitida(s)` : "") +
          (sinGuardar > 0 ? ` · ${sinGuardar} sin guardar por falta de datos` : "") +
          "."
      );
      setColaAnomalias((data.anomalias ?? []).map((a: { mensaje: string }) => a.mensaje));
      setCola([]);
      setSoloRevisar(false);
      onGuardado?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el lote. Intenta de nuevo, por favor.");
    } finally {
      setGuardando(false);
    }
  }

  // ---- visor con zoom ----
  // La lista de navegacion queda fija mientras el visor esta abierto, aunque una foto deje de estar marcada.
  const idsExistentes = new Set(cola.map((it) => it.id));
  const navegables = listaVisor.filter((id) => idsExistentes.has(id));
  const itemVisor = visorId === null ? undefined : cola.find((it) => it.id === visorId);
  const posVisor = itemVisor ? navegables.indexOf(itemVisor.id) : -1;
  const idAnterior = posVisor > 0 ? navegables[posVisor - 1] : null;
  const idSiguiente = posVisor >= 0 && posVisor < navegables.length - 1 ? navegables[posVisor + 1] : null;

  function abrirVisor(id: number) {
    setListaVisor(visibles.map((it) => it.id));
    setVisorId(id);
  }

  function revisarUnaPorUna() {
    if (porRevisar.length === 0) return;
    setListaVisor(porRevisar.map((it) => it.id));
    setVisorId(porRevisar[0].id);
  }

  // ---- marca manual (sin foto) ----
  const [manualAbierto, setManualAbierto] = useState(false);
  const [manualAsesora, setManualAsesora] = useState("");
  const [manualFecha, setManualFecha] = useState(() => ahoraCR().fecha);
  const [manualHora, setManualHora] = useState(() => horaActualCR());
  const [manualTipo, setManualTipo] = useState<"entrada" | "salida">("entrada");
  const [manualGuardando, setManualGuardando] = useState(false);

  async function guardarManual() {
    if (!manualAsesora) return;
    setManualGuardando(true);
    setError(null);
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
      if (!resp.ok) throw new Error(data.error);
      setMensaje(data.omitida ? "Esa marca ya estaba registrada." : "Marca manual guardada.");
      if (data.anomalia) setColaAnomalias((prev) => [...prev, data.anomalia.mensaje]);
      setManualAbierto(false);
      setManualAsesora("");
      onGuardado?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la marca");
    } finally {
      setManualGuardando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-stretch">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex-1 min-w-0 rounded-2xl border-2 border-dashed px-3 py-4 flex items-center justify-center gap-2 text-[13px] font-bold text-[#0B5F6C] cursor-pointer ${
            arrastrando ? "bg-[#CFF0F3] border-[#0F7A8A]" : "bg-[#E4F7F9] border-[#1EA6B8]"
          }`}
        >
          <span aria-hidden className="text-lg leading-none">📷</span>
          Subir fotos de marcas
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void procesarArchivos(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        <button
          onClick={() => setManualAbierto((v) => !v)}
          aria-label={manualAbierto ? "Cerrar marca manual" : "Agregar una marca manual"}
          title="Marca manual (sin foto)"
          className={`flex-none w-14 rounded-2xl border-2 text-xl ${
            manualAbierto ? "bg-[#0B5F6C] border-[#0B5F6C] text-white" : "bg-white border-[#1EA6B8] text-[#0B5F6C]"
          }`}
        >
          ✏️
        </button>
      </div>

      {mensaje && <p className="text-sm text-[#1E8A5F] font-semibold">{mensaje}</p>}
      {error && <p className="text-sm text-[#B23A3A] font-semibold">{error}</p>}

      {cola.length > 0 && (
        <div className="space-y-2">
          <div className="rounded-xl bg-[#E4F7F9] border border-[#CFF0F3] p-3 space-y-2">
            <div className="text-[12.5px] text-[#0B5F6C] font-semibold">
              {cola.length} foto(s) cargada(s)
              {procesando ? " · leyendo…" : ""}
              {porRevisar.length > 0
                ? ` · ${porRevisar.length} conviene(n) revisar, Nuria`
                : cola.length > 0 && !procesando
                ? " · todo se ve en orden"
                : ""}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setSoloRevisar(false)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  !soloRevisar ? "bg-[#0B5F6C] text-white" : "bg-white text-[#0B5F6C]"
                }`}
              >
                Todas · {cola.length}
              </button>
              <button
                onClick={() => setSoloRevisar(true)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  soloRevisar ? "bg-[#0B5F6C] text-white" : "bg-white text-[#0B5F6C]"
                }`}
              >
                Por revisar · {porRevisar.length}
              </button>
              {porRevisar.length > 0 && (
                <button
                  onClick={revisarUnaPorUna}
                  className="rounded-full px-3 py-1.5 text-[12px] font-bold bg-[#35DCEC] text-[#0B3A41]"
                >
                  Revisar una por una →
                </button>
              )}
            </div>
          </div>

          {visibles.length === 0 && soloRevisar && (
            <p className="text-[12.5px] text-[#1E8A5F] font-semibold">
              ¡Gracias! No quedan fotos por revisar.
            </p>
          )}

          {visibles.map((item) => {
            const asesora = item.asesora_id ? asesoraPorId.get(item.asesora_id) : undefined;
            const repetida = duplicadas.has(item.id);
            const rz = razones.get(item.id) ?? [];
            return (
              <div
                key={item.id}
                className={`flex items-center gap-2.5 rounded-xl border bg-white p-2.5 ${
                  rz.length > 0 && !repetida ? "border-[#35DCEC] border-2" : "border-[#DDE7E8]"
                } ${repetida ? "opacity-60" : ""}`}
              >
                <button
                  onClick={() => abrirVisor(item.id)}
                  className="relative flex-none"
                  aria-label="Ver la foto en grande"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.previewUrl} alt="" className="w-14 h-14 rounded-lg object-cover" />
                  <span className="absolute bottom-0.5 right-0.5 rounded bg-[#0B5F6C]/85 text-white text-[10px] px-1">
                    🔍
                  </span>
                </button>

                <button onClick={() => abrirVisor(item.id)} className="flex-1 min-w-0 text-left">
                  <div className="text-[12.5px] font-bold truncate">
                    {item.estado === "leyendo"
                      ? "Leyendo la foto…"
                      : asesora
                      ? asesora.nombre
                      : "Falta identificar a la asesora"}
                  </div>
                  {item.estado !== "leyendo" && (
                    <div className="text-[11.5px] text-[#6B6D6E] tabular-nums truncate">
                      {item.tipo === "entrada" ? "Entrada" : "Salida"} · {item.hora} · {diaMes(item.fecha)}
                      {asesora ? ` · ${asesora.punto}` : ""}
                    </div>
                  )}
                  {rz.length > 0 && !repetida && (
                    <div className="text-[11px] text-[#0B5F6C] font-semibold truncate">{rz[0]}</div>
                  )}
                </button>

                <div className="flex flex-col items-end gap-1 flex-none">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      repetida
                        ? "bg-[#DDE7E8] text-[#3A3B3C]"
                        : item.estado === "leyendo"
                        ? "bg-[#CFF0F3] text-[#0B5F6C]"
                        : rz.length > 0
                        ? "bg-[#35DCEC] text-[#0B3A41]"
                        : "bg-[#E7F5EE] text-[#1E8A5F]"
                    }`}
                  >
                    {repetida ? "Repetida" : item.estado === "leyendo" ? "…" : rz.length > 0 ? "Revisar" : "Listo"}
                  </span>
                  <button onClick={() => quitar(item.id)} className="text-[#6B6D6E] text-[11px]" aria-label="Quitar">
                    Quitar
                  </button>
                </div>
              </div>
            );
          })}

          <div className="rounded-xl bg-[#E4F7F9] border border-[#CFF0F3] p-2.5 text-[12px] text-[#0B5F6C] font-semibold">
            {aGuardar.length} marca(s) lista(s) para guardar
            {duplicadas.size > 0 ? ` · ${duplicadas.size} repetida(s) se omitirán` : ""}
          </div>
        </div>
      )}

      {cola.length > 0 && (
        <button
          onClick={confirmarLote}
          disabled={guardando || procesando || aGuardar.length === 0}
          className="w-full rounded-xl py-3 font-bold text-white text-sm disabled:opacity-50"
          style={{ background: "linear-gradient(150deg, #0B5F6C, #1EA6B8)" }}
        >
          {guardando ? "Guardando…" : `Guardar ${aGuardar.length || ""} marca(s)`.replace("  ", " ")}
        </button>
      )}

      <div className="pt-2 border-t border-[#DDE7E8]">
        {manualAbierto && (
          <div className="mt-2 rounded-xl border border-[#DDE7E8] bg-white p-2.5 space-y-2">
            <select
              value={manualAsesora}
              onChange={(e) => setManualAsesora(e.target.value)}
              className="w-full rounded border border-[#DDE7E8] p-2 text-[12px]"
            >
              <option value="">-- Asesora --</option>
              {catalogo.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} ({a.punto})
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={manualFecha} onChange={(e) => setManualFecha(e.target.value)} className="rounded border border-[#DDE7E8] p-2 text-[12px]" />
              <input type="time" value={manualHora} onChange={(e) => setManualHora(e.target.value)} className="rounded border border-[#DDE7E8] p-2 text-[12px]" />
            </div>
            <div className="flex gap-1.5">
              {(["entrada", "salida"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setManualTipo(t)}
                  className={`flex-1 rounded py-2 text-[12px] font-semibold ${
                    manualTipo === t ? "bg-[#0B5F6C] text-white" : "bg-[#E4F7F9] text-[#0B5F6C]"
                  }`}
                >
                  {t === "entrada" ? "Entrada" : "Salida"}
                </button>
              ))}
            </div>
            <button
              onClick={guardarManual}
              disabled={manualGuardando || !manualAsesora}
              className="w-full rounded-lg py-2.5 text-[12.5px] font-bold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(150deg, #0B5F6C, #1EA6B8)" }}
            >
              Guardar marca manual
            </button>
          </div>
        )}
      </div>

      {itemVisor && (
        <VisorMarca
          key={itemVisor.id}
          item={itemVisor}
          posicion={Math.max(posVisor, 0) + 1}
          total={navegables.length || 1}
          razones={razones.get(itemVisor.id) ?? []}
          opciones={opcionesPara(itemVisor)}
          onCambio={(c) => actualizar(itemVisor.id, c)}
          onAnterior={idAnterior !== null ? () => setVisorId(idAnterior) : undefined}
          onSiguiente={idSiguiente !== null ? () => setVisorId(idSiguiente) : undefined}
          onCerrar={() => setVisorId(null)}
        />
      )}

      {colaAnomalias.length > 0 && (
        <PopupAnomalia
          mensaje={colaAnomalias[0]}
          pendientes={colaAnomalias.length - 1}
          onCerrar={() => setColaAnomalias((prev) => prev.slice(1))}
        />
      )}
    </div>
  );
}
