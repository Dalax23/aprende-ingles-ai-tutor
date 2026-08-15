import { GoogleGenAI, Type } from "@google/genai";

// Inline a propósito (ver nota en los demás archivos de /api): un import a un archivo
// fuera de /api no se empaqueta correctamente en las funciones de Vercel.
function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY no está configurada. Agrégala en Vercel → Settings → Environment Variables.");
  }
  return new GoogleGenAI({ apiKey });
}

const LEVEL_SPEC: Record<string, { sentences: string; vocab: string }> = {
  Beginner: {
    sentences: "4 a 5 oraciones cortas y simples (sujeto-verbo-objeto), presente simple",
    vocab: "vocabulario muy básico y de altísima frecuencia (top 500 palabras en inglés)",
  },
  Intermediate: {
    sentences: "6 a 8 oraciones de longitud media, mezclando presente, pasado y futuro, con alguna conjunción",
    vocab: "vocabulario cotidiano de frecuencia media, con 1 o 2 phrasal verbs comunes",
  },
  Advanced: {
    sentences: "8 a 10 oraciones más largas, con cláusulas subordinadas y conectores variados",
    vocab: "vocabulario más rico, modismos naturales y estructuras gramaticales complejas",
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { topic, level } = req.body;
    if (!topic || !level) {
      return res.status(400).json({ error: "Faltan los parámetros de tema (topic) o nivel (level)." });
    }

    const spec = LEVEL_SPEC[level] || LEVEL_SPEC.Beginner;
    const ai = getAiClient();
    const prompt = `
      Escribe una lectura corta en inglés sobre el tema "${topic}", pensada para un estudiante
      hispanohablante de nivel "${level}". La lectura debe tener ${spec.sentences}, usando
      ${spec.vocab}. El texto debe ser natural, coherente entre oración y oración (como una
      mini-historia o mini-artículo, no oraciones sueltas sin relación).

      Para CADA oración de la lectura, entrega:
      1. La oración exacta en inglés ('text').
      2. Una pronunciación figurada de TODA la oración, amigable para hispanohablantes, imitando
         cómo sonaría fonéticamente leída por un hablante nativo de forma natural y conectada
         (ej. para "What is your name?" algo como "uáts-yor-néim", uniendo palabras como se
         enlazan al hablar inglés real) ('phonetic').
      3. La traducción natural al español de esa oración ('translation').

      También da un título corto y atractivo para la lectura ('title').

      Responde únicamente en formato JSON según el esquema especificado.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Título corto y atractivo de la lectura." },
            sentences: {
              type: Type.ARRAY,
              description: "Las oraciones de la lectura en orden.",
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING, description: "La oración en inglés." },
                  phonetic: { type: Type.STRING, description: "Pronunciación figurada completa de la oración, enlazada de forma natural." },
                  translation: { type: Type.STRING, description: "Traducción al español de la oración." },
                },
                required: ["text", "phonetic", "translation"],
              },
            },
          },
          required: ["title", "sentences"],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) throw new Error("No se recibió respuesta del generador de lecturas.");

    const data = JSON.parse(resultText.trim());
    res.status(200).json({ title: data.title, level, topic, sentences: data.sentences });
  } catch (error: any) {
    console.error("Error en reading/generate:", error);
    res.status(500).json({ error: error.message || "Error al generar la lectura." });
  }
}
