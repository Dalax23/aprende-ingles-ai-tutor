import { GoogleGenAI, Type } from "@google/genai";

// Inline a propósito: un import relativo a un archivo fuera de /api no se estaba
// empaquetando en la función de Vercel (ERR_MODULE_NOT_FOUND en producción).
function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY no está configurada. Agrégala en Vercel → Settings → Environment Variables.");
  }
  return new GoogleGenAI({ apiKey });
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { topic, level } = req.body;
    if (!topic || !level) {
      return res.status(400).json({ error: "Faltan los parámetros de tema (topic) o nivel (level)." });
    }

    const ai = getAiClient();
    const prompt = `
      Genera 5 tarjetas de vocabulario interactivo en inglés sobre el tema "${topic}" adaptadas para un nivel de inglés "${level}".
      Cada tarjeta debe ser extremadamente práctica y útil para la vida diaria o el trabajo.

      Para cada tarjeta, incluye:
      1. El término o frase útil en inglés ('word').
      2. Pronunciación figurada amigable para hispanohablantes ('phonetic').
      3. La traducción directa al español ('translation').
      4. Una frase de ejemplo natural en inglés ('example').
      5. La traducción al español de la frase de ejemplo ('exampleTranslation').
      6. Un 'mnemonic' usando el MÉTODO DE PALABRA CLAVE: busca una palabra o sonido en ESPAÑOL
         que suene PARECIDO a como se pronuncia la palabra en inglés, y crea una imagen mental
         breve, vívida y hasta absurda que conecte ese sonido parecido con el SIGNIFICADO real
         de la palabra. Ejemplo real: para "carpet" (alfombra), el gancho sería algo como
         "Suena como 'carpeta' — imagina una carpeta gigante tirada como alfombra en el piso."
         Para "beach" (playa), suena como "bich" — imagina una playa llena de perritos (bichis)
         tomando el sol. Debe ser corto (1-2 oraciones), en español, memorable y algo gracioso
         o exagerado a propósito (las imágenes absurdas se recuerdan mejor).

      Responde únicamente en formato JSON según el esquema especificado.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "Lista de 5 tarjetas de vocabulario interactivo.",
          items: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING, description: "El vocablo o frase en inglés." },
              phonetic: { type: Type.STRING, description: "Pronunciación figurada en español." },
              translation: { type: Type.STRING, description: "Traducción al español." },
              example: { type: Type.STRING, description: "Frase de ejemplo en inglés." },
              exampleTranslation: { type: Type.STRING, description: "Traducción de la frase de ejemplo." },
              mnemonic: { type: Type.STRING, description: "Gancho mental con el método de palabra clave (sonido parecido en español + imagen mental vívida) en español." }
            },
            required: ["word", "phonetic", "translation", "example", "exampleTranslation", "mnemonic"]
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("No se recibió respuesta del generador de vocabulario.");

    res.status(200).json(JSON.parse(resultText.trim()));
  } catch (error: any) {
    console.error("Error en vocab/generate:", error);
    res.status(500).json({ error: error.message || "Error al generar vocabulario." });
  }
}
