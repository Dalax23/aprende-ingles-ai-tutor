import { Type } from "@google/genai";
import { getAiClient } from "../../lib/geminiClient";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { targetPhrase, spokenText } = req.body;
    if (!targetPhrase || !spokenText) {
      return res.status(400).json({ error: "Faltan los parámetros targetPhrase o spokenText." });
    }

    const ai = getAiClient();
    const prompt = `
      Eres un experto lingüista y tutor de inglés para hispanohablantes. Tu tarea es analizar la pronunciación de un estudiante.
      El estudiante intentó decir la frase: "${targetPhrase}"
      El sistema de reconocimiento de voz transcribió que dijo: "${spokenText}"

      Compara detalladamente ambas frases. Evalúa si hay errores de pronunciación, omisiones, o sustituciones.
      Devuelve un JSON estrictamente estructurado según el esquema solicitado.
      La explicación y los consejos fonéticos individuales ('phoneticTip') deben estar en ESPAÑOL, claros y amigables.
      Clasifica cada palabra de la frase objetivo original (targetPhrase) en una de estas categorías de estado:
      - 'correct': pronunciada perfectamente o muy cercana.
      - 'warning': pronunciada de forma entendible pero con acento muy marcado o pequeños fallos.
      - 'error': omitida por completo o pronunciada de forma incorrecta/irreconocible.

      Proporciona también consejos prácticos de articulación para las palabras con warning o error, y un consejo general ('tip') animador en español.

      Además, para cada palabra con warning o error, identifica el 'phonemeTag': el sonido específico
      en inglés que causó el problema, usando un código corto y consistente (ej: "th" para /θ/ o /ð/,
      "r" para la r inglesa, "v-b" para confundir v con b, "iː-ɪ" para confundir "sheep" con "ship",
      "h" para la h aspirada, "vowel-length" para vocales largas/cortas, "ed-ending" para terminaciones
      -ed). Esto es clave porque los sonidos que MÁS confunden a hispanohablantes son consistentes
      (th, r, v/b, h aspirada, vocales largas vs cortas) y detectarlos permite enfocar la práctica.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER, description: "Puntuación de pronunciación general del 0 al 100." },
            accuracy: { type: Type.INTEGER, description: "Puntuación de precisión léxica del 0 al 100." },
            fluency: { type: Type.INTEGER, description: "Puntuación de fluidez del 0 al 100." },
            words: {
              type: Type.ARRAY,
              description: "Cada palabra de la frase objetivo original analizada individualmente en orden.",
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING, description: "La palabra original de la frase objetivo." },
                  status: { type: Type.STRING, description: "Clasificación: 'correct', 'warning' o 'error'." },
                  phoneticTip: { type: Type.STRING, description: "Consejo ultra-breve en español. Vacío si es correcto." },
                  phonemeTag: { type: Type.STRING, description: "Código corto del sonido que falló. Vacío si status es 'correct'." }
                },
                required: ["word", "status"]
              }
            },
            tip: { type: Type.STRING, description: "Consejo general en español." }
          },
          required: ["score", "accuracy", "fluency", "words", "tip"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("No se recibió respuesta del modelo de análisis.");

    res.status(200).json(JSON.parse(resultText.trim()));
  } catch (error: any) {
    console.error("Error en pronunciation/analyze:", error);
    res.status(500).json({ error: error.message || "Error al analizar la pronunciación." });
  }
}
