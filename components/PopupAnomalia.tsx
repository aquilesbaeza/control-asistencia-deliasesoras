"use client";

export default function PopupAnomalia({
  mensaje,
  onCerrar,
}: {
  mensaje: string;
  onCerrar: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B4A54]/45 p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-5 space-y-3">
        <div className="w-11 h-11 rounded-xl bg-[#35DCEC] grid place-items-center text-xl">🕒</div>
        <h2 className="font-bold text-base text-[#14181A]">Falta una marca</h2>
        <p className="text-sm text-[#14181A] leading-relaxed">
          Hola Nuria, {mensaje}
        </p>
        <button
          onClick={onCerrar}
          className="w-full rounded-lg py-2.5 font-semibold text-white text-sm"
          style={{ background: "linear-gradient(150deg, #0B5F6C, #1EA6B8)" }}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
