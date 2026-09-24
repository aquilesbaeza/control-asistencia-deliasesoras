"use client";

import Image from "next/image";

export default function Encabezado() {
  return (
    <header className="sticky top-0 z-30">
      <div
        className="flex items-center gap-3 px-4 py-3 text-white"
        style={{ background: "linear-gradient(150deg, #0B5F6C, #1EA6B8)" }}
      >
        <div className="w-9 h-9 rounded-lg overflow-hidden flex-none shadow ring-2 ring-white/40 bg-[#57585A]">
          <Image src="/icon-192.png" alt="Control" width={36} height={36} className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0">
          <div className="font-extrabold text-base leading-tight">Bienvenida, Nuria</div>
          <div className="text-[11px] text-teal-50/90">Control · TRIXO Deliasesoras</div>
        </div>
      </div>
    </header>
  );
}
