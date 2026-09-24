"use client";

import { useState } from "react";
import Encabezado from "@/components/Encabezado";
import PanelPrincipal from "@/components/panels/PanelPrincipal";
import PanelCapturar from "@/components/panels/PanelCapturar";

export default function Home() {
  // Al guardar marcas capturadas, el panel de asistencia se refresca solo.
  const [version, setVersion] = useState(0);

  return (
    <div className="flex flex-col min-h-full">
      <Encabezado />
      <main className="flex-1 w-full max-w-3xl mx-auto p-3">
        <PanelPrincipal
          recargar={version}
          arriba={
            <div className="rounded-xl border-2 border-[#1EA6B8] bg-white p-3 space-y-2.5">
              <div>
                <div className="text-[13px] font-extrabold text-[#0B5F6C]">Cargar fotos de marcas</div>
                <p className="text-[11.5px] text-[#6B6D6E] leading-snug">
                  Sube las fotos del WhatsApp: se leen en lote y lo que guardes se refleja abajo.
                </p>
              </div>
              <PanelCapturar onGuardado={() => setVersion((v) => v + 1)} />
            </div>
          }
        />
      </main>
    </div>
  );
}
