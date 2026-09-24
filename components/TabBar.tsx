"use client";

import Image from "next/image";

export type TabId = "hoy" | "capturar" | "calendario" | "asesoras";

const TABS: { id: TabId; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "capturar", label: "Capturar" },
  { id: "calendario", label: "Calendario" },
  { id: "asesoras", label: "Asesoras" },
];

export default function TabBar({
  activa,
  onCambiar,
}: {
  activa: TabId;
  onCambiar: (t: TabId) => void;
}) {
  return (
    <div className="sticky top-0 z-10">
      <div
        className="flex items-center gap-3 px-4 py-3 text-white"
        style={{ background: "linear-gradient(150deg, #0B5F6C, #1EA6B8)" }}
      >
        <div className="w-9 h-9 rounded-lg overflow-hidden flex-none shadow ring-2 ring-white/40 bg-[#3A3B3C]">
          <Image src="/icon-192.png" alt="Control" width={36} height={36} className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0">
          <div className="font-extrabold text-base leading-tight">Bienvenida, Nuria</div>
          <div className="text-[11px] text-teal-50/90">Control · TRIXO Deliasesoras</div>
        </div>
      </div>
      <div className="flex gap-1.5 px-2.5 py-2 bg-[#E4F7F9] border-b border-[#CFF0F3] overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onCambiar(t.id)}
            className={`flex-1 whitespace-nowrap text-center text-[13px] font-semibold px-3 py-2 rounded-lg ${
              activa === t.id ? "bg-[#1EA6B8] text-white shadow" : "text-[#0B5F6C]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
