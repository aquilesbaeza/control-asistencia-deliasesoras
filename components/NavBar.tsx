"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ENLACES = [
  { href: "/", label: "Inicio" },
  { href: "/capturar", label: "Capturar" },
  { href: "/calendario", label: "Calendario" },
  { href: "/bitacora", label: "Bitacora" },
  { href: "/asesoras", label: "Asesoras" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-10 bg-[#196B24] text-white shadow">
      <div className="max-w-3xl mx-auto flex overflow-x-auto">
        {ENLACES.map((enlace) => {
          const activo = pathname === enlace.href;
          return (
            <Link
              key={enlace.href}
              href={enlace.href}
              className={`px-4 py-3 text-sm whitespace-nowrap ${
                activo ? "bg-[#0e4a17] font-semibold" : "hover:bg-[#155a1e]"
              }`}
            >
              {enlace.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
