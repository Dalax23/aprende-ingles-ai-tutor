import { Type } from "@google/genai";
import { getAiClient } from "../../lib/geminiClient";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { messages, scenarioContext, userEnglishLevel } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Falta el array de mensajes 'messages'." });
    }

    const ai = getAiClient();

    const systemInstruction = `
      Eres Emily, una tutora virtual de inglés experta, empática y sumamente profesional. Tu objetivo es ayudar al usuario a practicar conversación de manera inmersiva.

      Nivel de inglés del estudiante: ${userEnglishLevel || "Intermediate"}. Adapta tu vocabulario, gramática y velocidad a este nivel.
      Contexto o escenario de la conversación: ${scenarioContext || "Conversación libre amigable"}.

      Reglas de comportamiento de Emily:
      1. Responde SIEMPRE en inglés de forma amigable, conversacional y natural. Mantén tus respuestas de 2 o 3 oraciones.
      2. Sé alentadora, haz preguntas abiertas para mantener fluida la charla.
      3. Analiza el último mensaje del usuario: si detectas algún error de gramática, vocabulario o estructura natural, corrígelo de manera constructiva y amable en la sección de feedback del JSON. Si no hay errores, pon 'grammarFeedback' como null.
      4. Ofrece siempre una traducción al español de tu respuesta.
      5. Sugiere 2 opciones sencillas y naturales de respuestas que el usuario podría dar para continuar el diálogo.

      Debes responder estrictamente con la estructura JSON solicitada.
    `;

    const lastUserMessage = messages[messages.length - 1]?.content || "";

    const prompt = `
      Sigue la conversación. El usuario acaba de decir: "${lastUserMessage}"
      Por favor, genera la respuesta de Emily. Devuelve un objeto JSON según el esquema de abajo.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING, description: "La respuesta de Emily en inglés (2-3 oraciones)." },
            translation: { type: Type.STRING, description: "Traducción al español de la respuesta de Emily." },
            grammarFeedback: {
              type: Type.OBJECT,
              description: "Feedback sobre el último mensaje del usuario. Null si no hay errores.",
              properties: {
                original: { type: Type.STRING, description: "La frase con error escrita por el usuario." },
                corrected: { type: Type.STRING, description: "La versión corregida y más natural en inglés." },
                explanation: { type: Type.STRING, description: "Breve explicación didáctica en español." }
              },
              required: ["original", "corrected", "explanation"]
            },
            suggestions: {
              type: Type.ARRAY,
              description: "Dos sugerencias cortas de respuesta en inglés.",
              items: { type: Type.STRING }
            }
          },
          required: ["reply", "translation", "suggestions"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) throw new Error("No se recibió respuesta del tutor de conversación.");

    res.status(200).json(JSON.parse(resultText.trim()));
  } catch (error: any) {
    console.error("Error en tutor/chat:", error);
    res.status(500).json({ error: error.message || "Error al conversar con el tutor." });
  }
}
