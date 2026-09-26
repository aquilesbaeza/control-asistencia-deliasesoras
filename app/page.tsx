"use client";

import { useState } from "react";
import { ahoraCR } from "@/lib/tiempo";
import Encabezado from "@/components/Encabezado";
import PanelPrincipal from "@/components/panels/PanelPrincipal";
import PanelCapturar from "@/components/panels/PanelCapturar";

export default function Home() {
  // Al guardar marcas capturadas, el panel de asistencia se refresca solo.
  const [version, setVersion] = useState(0);
  // Mes que se está viendo: los iconos de exportar del encabezado bajan el Excel de ese mes.
  const [mes, setMes] = useState(() => ahoraCR().fecha.slice(0, 7));

  return (
    <div className="flex flex-col min-h-full">
      <Encabezado mes={mes} />
      <main className="flex-1 w-full max-w-3xl mx-auto p-3">
        <PanelPrincipal
          recargar={version}
          onMes={setMes}
          arriba={<PanelCapturar onGuardado={() => setVersion((v) => v + 1)} />}
        />
      </main>
    </div>
  );
}
