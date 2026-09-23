import Link from "next/link";

const ACCESOS = [
  {
    href: "/capturar",
    titulo: "Capturar marca",
    descripcion: "Sube la foto del gafete + reloj y confirma la marca de entrada o salida.",
  },
  {
    href: "/calendario",
    titulo: "Calendario del mes",
    descripcion: "Marca Ausencia, Incapacidad, Libre o Vacaciones y exporta el Excel de asistencia.",
  },
  {
    href: "/bitacora",
    titulo: "Bitacora y anomalias",
    descripcion: "Revisa marcas, horas efectivas y exporta el Excel de bitacora.",
  },
  {
    href: "/asesoras",
    titulo: "Asesoras",
    descripcion: "Agrega, reubica de punto o da de baja a una deliasesora.",
  },
];

export default function Home() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Control de Asistencia</h1>
      <p className="text-sm text-neutral-600">
        Todo lo que captures o edites aqui queda guardado de inmediato; nada se pierde entre dias.
      </p>
      <div className="grid gap-3">
        {ACCESOS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="block rounded-lg border border-neutral-200 bg-white p-4 shadow-sm active:bg-neutral-50"
          >
            <div className="font-medium text-[#196B24]">{a.titulo}</div>
            <div className="text-sm text-neutral-600 mt-1">{a.descripcion}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
