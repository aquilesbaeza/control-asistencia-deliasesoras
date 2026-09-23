"use client";

export default function SelectorMes({
  mes,
  onCambiar,
}: {
  mes: string;
  onCambiar: (mes: string) => void;
}) {
  return (
    <input
      type="month"
      value={mes}
      onChange={(e) => onCambiar(e.target.value)}
      className="rounded border border-neutral-300 p-2 text-sm"
    />
  );
}

export function mesActual(): string {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;
}
