import { GoogleGenerativeAI } from "@google/generative-ai";

export type LecturaFoto = {
  nombre_detectado: string | null;
  fecha_detectada: string | null; // YYYY-MM-DD
  hora_detectada: string | null; // HH:MM (24h)
  tipo_sugerido: "entrada" | "salida" | null;
  confianza: "alta" | "media" | "baja";
};

const PROMPT = `Esta es una foto que una asesora envia como comprobante de marca de asistencia.
La foto normalmente muestra: (1) un gafete/carnet con su nombre completo impreso, junto a
(2) la pantalla de un reloj biometrico que muestra la hora actual (HH:MM AM/PM) y la fecha
(dia, mes, anio), en el MISMO momento en que se tomo la foto. A veces la pantalla del reloj
tambien muestra un boton resaltado o texto "Entrada" o "Salida".

A veces un dedo tapa parte del nombre en el gafete (normalmente el nombre de pila). Si eso
pasa, igual lee y devuelve los apellidos u otra parte del nombre que SI se alcance a leer,
en vez de devolver null: con los apellidos alcanza para identificar a la asesora despues.
Solo usa null en nombre_detectado si NO hay ningun gafete o texto de nombre legible en la foto.

Lee la imagen y devuelve UNICAMENTE un JSON (sin texto adicional, sin markdown) con esta forma exacta:
{
  "nombre_detectado": string | null,   // el nombre (completo o parcial, ej. solo apellidos) tal como aparece en el gafete
  "fecha_detectada": string | null,    // SIEMPRE en formato numerico YYYY-MM-DD, ej: "2026-09-22" (convierte el mes en texto y el orden dia/mes/anio que veas en la pantalla a este formato exacto, nunca dejes el mes en palabras ni cambies el orden)
  "hora_detectada": string | null,     // SIEMPRE en formato 24 horas HH:MM, ej: "17:23" (convierte AM/PM: si dice PM suma 12 a la hora salvo que sea 12 PM; si es 12 AM usa 00)
  "tipo_sugerido": "entrada" | "salida" | null, // regla fija: si la hora es a.m. pon "entrada"; si es p.m. pon "salida"; usa null solo si no hay hora_detectada
  "confianza": "alta" | "media" | "baja"
}

Ejemplo: si la pantalla muestra "05:23 PM" y "Martes, Septiembre 22, 2026", debes
devolver "hora_detectada": "17:23" y "fecha_detectada": "2026-09-22".

MUY IMPORTANTE: la fecha y la hora SOLO pueden salir de lo que se lea literalmente en la
pantalla del reloj de la foto. Nunca inventes ni supongas la fecha/hora actual, ni la
completes con la fecha de hoy: si la pantalla del reloj no aparece o no se alcanza a leer
con claridad, esos dos campos van en null. Lo mismo aplica al nombre: si la foto no muestra
ningun gafete o reloj biometrico (por ejemplo, es una foto de otra cosa), devuelve los tres
campos en null en vez de adivinar.`;

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
