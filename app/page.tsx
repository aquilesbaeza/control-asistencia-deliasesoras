"use client";

import { useState } from "react";
import Encabezado from "@/components/Encabezado";
import PanelPrincipal from "@/components/panels/PanelPrincipal";
import PanelCapturar from "@/components/panels/PanelCapturar";

export default function Home() {
  // Al guardar marcas capturadas, el panel de asistencia de arriba se refresca solo.
  const [version, setVersion] = useState(0);

  return (
    <div className="flex flex-col min-h-full">
      <Encabezado />
      <main className="flex-1 w-full max-w-3xl mx-auto p-3 space-y-6">
        <section id="asistencia" className="scroll-mt-28">
          <PanelPrincipal recargar={version} />
        </section>

        <section id="capturar" className="scroll-mt-28 space-y-3">
          <div className="rounded-xl px-3.5 py-3 text-white" style={{ background: "linear-gradient(150deg, #0B5F6C, #1EA6B8)" }}>
            <h2 className="font-extrabold text-[15px]">Capturar marcas</h2>
            <p className="text-[11.5px] text-teal-50/90 leading-snug">
              Sube las fotos del WhatsApp: se leen en lote y lo que guardes se refleja arriba.
            </p>
          </div>
          <PanelCapturar onGuardado={() => setVersion((v) => v + 1)} />
        </section>
      </main>
    </div>
  );
}
