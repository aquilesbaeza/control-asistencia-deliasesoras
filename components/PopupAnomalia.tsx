"use client";

export default function PopupAnomalia({
  mensaje,
  onCerrar,
}: {
  mensaje: string;
  onCerrar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-5 space-y-3">
        <div className="text-2xl">⚠️</div>
        <h2 className="font-semibold text-lg text-amber-700">Marca incompleta</h2>
        <p className="text-sm text-neutral-700">{mensaje}</p>
        <button
          onClick={onCerrar}
          className="w-full rounded-md bg-[#196B24] text-white py-2 font-medium"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
