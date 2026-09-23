import { GoogleGenerativeAI } from "@google/generative-ai";

export type LecturaFoto = {
  nombre_detectado: string | null;
  fecha_detectada: string | null; // YYYY-MM-DD
  hora_detectada: string | null; // HH:MM (24h)
  tipo_sugerido: "entrada" | "salida" | null;
  confianza: "alta" | "media" | "baja";
};

const PROMPT = `Esta es una foto que una asesora envia como comprobante de marca de asistencia.
La foto normalmente muestra: (1) un gafete/carnet con su nombre completo impreso, y
(2) la pantalla de un reloj biometrico de fondo que muestra la hora actual (HH:MM AM/PM)
y la fecha (dia, mes, anio). A veces la pantalla del reloj tambien muestra un boton
resaltado o texto "Entrada" o "Salida".

Lee la imagen y devuelve UNICAMENTE un JSON (sin texto adicional, sin markdown) con esta forma exacta:
{
  "nombre_detectado": string | null,   // nombre completo tal como aparece en el gafete
  "fecha_detectada": string | null,    // SIEMPRE en formato numerico YYYY-MM-DD, ej: "2026-09-22" (convierte el mes en texto y el orden dia/mes/anio que veas en la pantalla a este formato exacto, nunca dejes el mes en palabras ni cambies el orden)
  "hora_detectada": string | null,     // SIEMPRE en formato 24 horas HH:MM, ej: "17:23" (convierte AM/PM: si dice PM suma 12 a la hora salvo que sea 12 PM; si es 12 AM usa 00)
  "tipo_sugerido": "entrada" | "salida" | null, // si el reloj no lo indica, usa null
  "confianza": "alta" | "media" | "baja"
}

Ejemplo: si la pantalla muestra "05:23 PM" y "Martes, Septiembre 22, 2026", debes
devolver "hora_detectada": "17:23" y "fecha_detectada": "2026-09-22".

Si algun dato no es legible, usa null en ese campo en vez de inventarlo. No devuelvas
la fecha ni la hora en el formato de texto original de la pantalla, siempre convierte.`;

export async function leerFotoMarca(imagenBase64: string, mediaType: string): Promise<LecturaFoto> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Falta GEMINI_API_KEY en las variables de entorno.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash",
    generationConfig: { responseMimeType: "application/json" },
  });

  const contenido = [
    { inlineData: { mimeType: mediaType, data: imagenBase64 } },
    { text: PROMPT },
  ];

  let resultado;
  let ultimoError: unknown;
  for (let intento = 0; intento < 3; intento++) {
    try {
      resultado = await model.generateContent(contenido);
      break;
    } catch (err) {
      ultimoError = err;
      const esSaturacion = err instanceof Error && /503|overloaded|high demand/i.test(err.message);
      if (!esSaturacion || intento === 2) throw err;
      await new Promise((r) => setTimeout(r, 1500 * (intento + 1)));
    }
  }
  if (!resultado) throw ultimoError;

  const texto = resultado.response.text();
  const json = texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1);

  try {
    return JSON.parse(json) as LecturaFoto;
  } catch {
    return {
      nombre_detectado: null,
      fecha_detectada: null,
      hora_detectada: null,
      tipo_sugerido: null,
      confianza: "baja",
    };
  }
}

/** Compara el nombre leido contra el catalogo y regresa los mejores candidatos. */
export function emparejarNombre(
  nombreLeido: string | null,
  catalogo: { id: string; nombre: string; punto: string }[]
): { id: string; nombre: string; punto: string; score: number }[] {
  if (!nombreLeido) return [];

  const normalizar = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z\s]/g, "")
      .split(/\s+/)
      .filter(Boolean);

  const palabrasLeidas = new Set(normalizar(nombreLeido));

  return catalogo
    .map((a) => {
      const palabrasCatalogo = normalizar(a.nombre);
      const coincidencias = palabrasCatalogo.filter((p) => palabrasLeidas.has(p)).length;
      const score = coincidencias / Math.max(palabrasCatalogo.length, palabrasLeidas.size);
      return { ...a, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
