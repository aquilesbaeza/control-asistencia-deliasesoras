"use client";

import { IconoReloj } from "@/components/Iconos";

export default function PopupAnomalia({
  mensaje,
  pendientes = 0,
  onCerrar,
}: {
  mensaje: string;
  pendientes?: number; // cuantos avisos mas siguen despues de este
  onCerrar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0B4A54]/45 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-5 space-y-3">
        <div className="w-11 h-11 rounded-xl bg-[#35DCEC] grid place-items-center text-[#0B3A41]"><IconoReloj size={24} /></div>
        <h2 className="font-bold text-base text-[#14181A]">Un detalle para tu revisión</h2>
        <p className="text-sm text-[#14181A] leading-relaxed">
          Hola, Nuria. Con mucho gusto te aviso: {mensaje}
        </p>
        <p className="text-[12px] text-[#6B6D6E]">
          Gracias por tu atención{pendientes > 0 ? ` · ${pendientes} aviso(s) más por revisar` : ""}.
        </p>
        <button
          onClick={onCerrar}
          className="w-full rounded-lg py-2.5 font-semibold text-white text-sm"
          style={{ background: "linear-gradient(150deg, #0B5F6C, #1EA6B8)" }}
        >
          {pendientes > 0 ? "Gracias, ver el siguiente" : "Gracias, lo reviso"}
        </button>
      </div>
    </div>
  );
}
