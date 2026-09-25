import { GoogleGenerativeAI } from "@google/generative-ai";

export type LecturaIncapacidad = {
  codigo: string | null; // numero/codigo del comprobante, ej: "A29484848323"
  desde: string | null; // YYYY-MM-DD
  hasta: string | null; // YYYY-MM-DD
  nombre_detectado: string | null;
};

const PROMPT = `Esta es la imagen de un comprobante de incapacidad medica (por ejemplo de la CCSS de Costa Rica).
Lee la imagen y devuelve UNICAMENTE un JSON (sin texto adicional, sin markdown) con esta forma exacta:
{
  "codigo": string | null,            // numero o codigo de la incapacidad / boleta, tal cual aparece (letras y numeros, sin espacios), ej: "A29484848323"
  "desde": string | null,             // primer dia incapacitada, SIEMPRE en formato YYYY-MM-DD
  "hasta": string | null,             // ultimo dia incapacitada (inclusive), SIEMPRE en formato YYYY-MM-DD
  "nombre_detectado": string | null   // nombre completo de la persona incapacitada
}
Si el comprobante indica fecha de inicio y una cantidad de dias, calcula "hasta" (inicio + dias - 1).
Convierte cualquier fecha escrita en texto o como dia/mes/anio al formato YYYY-MM-DD.
Si algun dato no es legible, usa null en vez de inventarlo.`;

export async function leerIncapacidad(imagenBase64: string, mediaType: string): Promise<LecturaIncapacidad> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY en las variables de entorno.");

  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: "gemini-3.6-flash",
    generationConfig: { responseMimeType: "application/json" },
  });
  const contenido = [{ inlineData: { mimeType: mediaType, data: imagenBase64 } }, { text: PROMPT }];

  let resultado;
  for (let intento = 0; intento < 3; intento++) {
    try {
      resultado = await model.generateContent(contenido);
      break;
    } catch (err) {
      const esSaturacion = err instanceof Error && /503|overloaded|high demand/i.test(err.message);
      if (!esSaturacion || intento === 2) throw err;
      await new Promise((r) => setTimeout(r, 1500 * (intento + 1)));
    }
  }
  const vacio = { codigo: null, desde: null, hasta: null, nombre_detectado: null };
  if (!resultado) return vacio;

  const texto = resultado.response.text();
  try {
    const l = JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1)) as LecturaIncapacidad;
    const fecha = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    const desde = fecha(l.desde);
    const hasta = fecha(l.hasta);
    return {
      codigo: typeof l.codigo === "string" ? l.codigo.replace(/\s+/g, "") || null : null,
      desde,
      hasta: desde && hasta && hasta < desde ? desde : hasta ?? desde,
      nombre_detectado: typeof l.nombre_detectado === "string" ? l.nombre_detectado : null,
    };
  } catch {
    return vacio;
  }
}
