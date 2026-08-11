import { Type } from "@google/genai";
import { getAiClient } from "../../lib/geminiClient";

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
              exampleTranslation: { type: Type.STRING, description: "Traducción de la frase de ejemplo." }
            },
            required: ["word", "phonetic", "translation", "example", "exampleTranslation"]
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
