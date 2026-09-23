"use client";

import { useState } from "react";
import TabBar, { type TabId } from "@/components/TabBar";
import PanelHoy from "@/components/panels/PanelHoy";
import PanelCapturar from "@/components/panels/PanelCapturar";
import PanelCalendario from "@/components/panels/PanelCalendario";
import PanelAsesoras from "@/components/panels/PanelAsesoras";

export default function Home() {
  const [tab, setTab] = useState<TabId>("hoy");

  return (
    <div className="flex flex-col min-h-full">
      <TabBar activa={tab} onCambiar={setTab} />
      <main className="flex-1 w-full max-w-3xl mx-auto p-3">
        {tab === "hoy" && <PanelHoy />}
        {tab === "capturar" && <PanelCapturar />}
        {tab === "calendario" && <PanelCalendario />}
        {tab === "asesoras" && <PanelAsesoras />}
      </main>
    </div>
  );
}
