import { getAiClient } from "../lib/geminiClient";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { text, voiceName } = req.body;
    if (!text) return res.status(400).json({ error: "Falta el texto a sintetizar." });

    const ai = getAiClient();
    const voice = voiceName || "Kore";

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No se pudo extraer la data de audio de la respuesta de Gemini TTS.");

    res.status(200).json({ audioBase64: base64Audio });
  } catch (error: any) {
    console.error("Error en TTS:", error);
    res.status(500).json({ error: error.message || "Error en síntesis de voz." });
  }
}
