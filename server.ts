import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper function to safely instantiate and return the Gemini API client
function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY no está configurada. Por favor, configúrala en el panel de Secrets de AI Studio.");
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// 1. Endpoint: Healthcheck
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY",
    timestamp: new Date().toISOString()
  });
});

// 2. Endpoint: Analizar pronunciación de voz
// Compara lo que el usuario pronunció (mediante reconocimiento de voz de navegador) con la frase objetivo.
app.post("/api/pronunciation/analyze", async (req, res) => {
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
      - 'warning': pronunciada de forma entendible pero con acento muy marcado o pequeños fallos (por ejemplo, pronunciar la 'd' de 'sounded' como 'ed' literal).
      - 'error': omitida por completo o pronunciada de forma incorrecta/irreconocible.

      Proporciona también consejos prácticos de articulación (dónde poner la lengua, los labios, o cómo soplar) para las palabras con warning o error, y un consejo general ('tip') animador en español.

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
            score: {
              type: Type.INTEGER,
              description: "Puntuación de pronunciación general del 0 al 100."
            },
            accuracy: {
              type: Type.INTEGER,
              description: "Puntuación de precisión léxica (palabras correctas vs incorrectas) del 0 al 100."
            },
            fluency: {
              type: Type.INTEGER,
              description: "Puntuación de fluidez (ritmo, omisiones o interrupciones detectadas) del 0 al 100."
            },
            words: {
              type: Type.ARRAY,
              description: "Cada palabra de la frase objetivo original (targetPhrase) analizada individualmente en orden.",
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING, description: "La palabra original de la frase objetivo." },
                  status: { type: Type.STRING, description: "Clasificación de calidad: 'correct', 'warning' o 'error'." },
                  phoneticTip: { type: Type.STRING, description: "Un consejo ultra-breve en español sobre cómo pronunciar este sonido específico (ej: 'Muerde ligeramente tu labio inferior para la v'). Dejar vacío o null si es correcto." },
                  phonemeTag: { type: Type.STRING, description: "Código corto del sonido específico que falló (ej: 'th', 'r', 'v-b', 'iː-ɪ', 'h', 'vowel-length', 'ed-ending'). Dejar vacío o null si status es 'correct'." }
                },
                required: ["word", "status"]
              }
            },
            tip: {
              type: Type.STRING,
              description: "Un consejo general o feedback constructivo en español para el estudiante enfocado en mejorar su articulación."
            }
          },
          required: ["score", "accuracy", "fluency", "words", "tip"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No se recibió respuesta del modelo de análisis.");
    }

    const data = JSON.parse(resultText.trim());
    res.json(data);
  } catch (error: any) {
    console.error("Error en analyze-pronunciation:", error);
    res.status(500).json({ error: error.message || "Error al analizar la pronunciación." });
  }
});

// 3. Endpoint: Chat con Tutora Emily (Conversación guiada)
app.post("/api/tutor/chat", async (req, res) => {
  try {
    const { messages, scenarioContext, userEnglishLevel } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Falta el array de mensajes 'messages'." });
    }

    const ai = getAiClient();

    // Armamos un prompt de sistema robusto para Emily
    const systemInstruction = `
      Eres Emily, una tutora virtual de inglés experta, empática y sumamente profesional. Tu objetivo es ayudar al usuario a practicar conversación de manera inmersiva.

      Nivel de inglés del estudiante: ${userEnglishLevel || "Intermediate"}. Adapta tu vocabulario, gramática y velocidad a este nivel.
      Contexto o escenario de la conversación: ${scenarioContext || "Conversación libre amigable"}.

      Reglas de comportamiento de Emily:
      1. Responde SIEMPRE en inglés de forma amigable, conversacional y natural. No hables demasiado, mantén tus respuestas de 2 o 3 oraciones para dar oportunidad al usuario de responder.
      2. En tus respuestas en inglés, sé alentadora, haz preguntas abiertas para mantener fluida la charla.
      3. Analiza el último mensaje del usuario: si detectas algún error de gramática, vocabulario o estructura natural, prepárate para corregirlo de manera super constructiva y amable en la sección de feedback del JSON (no lo regañes, explícale en español el por qué de manera breve). Si no hay errores, pon 'grammarFeedback' como null.
      4. Ofrece siempre una traducción al español de tu respuesta para que si el usuario se pierde, pueda consultarla.
      5. Sugiere 2 opciones sencillas y naturales de respuestas que el usuario podría dar para continuar el diálogo (esto ayuda muchísimo a personas tímidas o que están aprendiendo rápido).

      Debes responder estrictamente con la estructura JSON solicitada.
    `;

    // Convertimos los mensajes previos al formato que espera Gemini
    // Nota: El último mensaje debe ser del usuario.
    const lastUserMessage = messages[messages.length - 1]?.content || "";

    const prompt = `
      Sigue la conversación. El usuario acaba de decir: "${lastUserMessage}"

      Por favor, genera la respuesta de Emily. Devuelve un objeto JSON según el esquema de abajo.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description: "La respuesta de Emily en inglés para continuar la conversación (2-3 oraciones claras)."
            },
            translation: {
              type: Type.STRING,
              description: "La traducción al español exacta y natural de la respuesta de Emily."
            },
            grammarFeedback: {
              type: Type.OBJECT,
              description: "Feedback sobre el último mensaje escrito por el usuario. Null si no hay errores significativos.",
              properties: {
                original: { type: Type.STRING, description: "La frase con error escrita por el usuario." },
                corrected: { type: Type.STRING, description: "La versión corregida y más natural en inglés." },
                explanation: { type: Type.STRING, description: "Breve explicación didáctica en español de por qué es mejor así." }
              },
              required: ["original", "corrected", "explanation"]
            },
            suggestions: {
              type: Type.ARRAY,
              description: "Dos sugerencias cortas y naturales de lo que el usuario podría responder en inglés para seguir la conversación.",
              items: { type: Type.STRING }
            }
          },
          required: ["reply", "translation", "suggestions"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No se recibió respuesta del tutor de conversación.");
    }

    const data = JSON.parse(resultText.trim());
    res.json(data);
  } catch (error: any) {
    console.error("Error en tutor-chat:", error);
    res.status(500).json({ error: error.message || "Error al conversar con el tutor." });
  }
});

// 4. Endpoint: Generar Vocabulario y Tarjetas de Memoria Inteligentes
app.post("/api/vocab/generate", async (req, res) => {
  try {
    const { topic, level } = req.body;
    if (!topic || !level) {
      return res.status(400).json({ error: "Faltan los parámetros de tema (topic) o nivel (level)." });
    }

    const ai = getAiClient();
    const prompt = `
      Genera 5 tarjetas de vocabulario interactivo en inglés sobre el tema "${topic}" adaptadas para un nivel de inglés "${level}".
      Cada tarjeta de vocabulario debe ser extremadamente práctica y útil para la vida diaria o el trabajo (similar al enfoque dinámico de Falou).

      Para cada tarjeta, incluye:
      1. El término, palabra o frase idiomática útil en inglés ('word').
      2. Una transcripción de pronunciación figurada amigable para hispanohablantes ('phonetic'), por ejemplo, para 'thought' puedes sugerir 'zot' o para 'schedule' puedes sugerir 'es-ked-iul'.
      3. La traducción directa al español de la palabra ('translation').
      4. Una frase de ejemplo natural en inglés donde se use la palabra ('example').
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
              phonetic: { type: Type.STRING, description: "Escritura de pronunciación figurada fonética en español." },
              translation: { type: Type.STRING, description: "Traducción al español de la palabra o frase." },
              example: { type: Type.STRING, description: "Una frase de ejemplo real y útil en inglés." },
              exampleTranslation: { type: Type.STRING, description: "Traducción de la frase de ejemplo al español." }
            },
            required: ["word", "phonetic", "translation", "example", "exampleTranslation"]
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No se recibió respuesta del generador de vocabulario.");
    }

    const data = JSON.parse(resultText.trim());
    res.json(data);
  } catch (error: any) {
    console.error("Error en vocab-generate:", error);
    res.status(500).json({ error: error.message || "Error al generar vocabulario." });
  }
});

// 5. Endpoint: Text-to-Speech (TTS) nativo de Gemini
// Permite escuchar cualquier palabra, frase o respuesta de Emily con voz realista.
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voiceName } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Falta el texto a sintetizar." });
    }

    const ai = getAiClient();
    // Voces disponibles: 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr' (Zephyr y Kore son excelentes voces fluidas de tutor/tutora)
    const voice = voiceName || "Kore";

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No se pudo extraer la data de audio de la respuesta de Gemini TTS.");
    }

    res.json({ audioBase64: base64Audio });
  } catch (error: any) {
    console.error("Error en TTS:", error);
    res.status(500).json({ error: error.message || "Error en síntesis de voz." });
  }
});

// Integración de Vite Middleware para Desarrollo o Servidor Estático para Producción
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
