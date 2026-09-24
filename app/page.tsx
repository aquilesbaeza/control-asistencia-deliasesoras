"use client";

import { useState } from "react";
import TabBar, { type TabId } from "@/components/TabBar";
import PanelHoy from "@/components/panels/PanelHoy";
import PanelCapturar from "@/components/panels/PanelCapturar";
import PanelCalendario from "@/components/panels/PanelCalendario";
import PanelAsesoras from "@/components/panels/PanelAsesoras";

export default function Home() {
  const [tab, setTab] = useState<TabId>("hoy");
  const [fechaSalto, setFechaSalto] = useState<string | null>(null);

  function cambiarTab(nueva: TabId) {
    if (nueva === "hoy") setFechaSalto(null); // al tocar "Hoy" se vuelve al dia actual
    setTab(nueva);
  }

  return (
    <div className="flex flex-col min-h-full">
      <TabBar activa={tab} onCambiar={cambiarTab} />
      <main className="flex-1 w-full max-w-3xl mx-auto p-3">
        {tab === "hoy" && <PanelHoy key={fechaSalto ?? "actual"} fechaInicial={fechaSalto ?? undefined} />}
        {tab === "capturar" && <PanelCapturar />}
        {tab === "calendario" && (
          <PanelCalendario
            onVerDia={(fecha) => {
              setFechaSalto(fecha);
              setTab("hoy");
            }}
          />
        )}
        {tab === "asesoras" && <PanelAsesoras />}
      </main>
    </div>
  );
}
