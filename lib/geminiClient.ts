// Helper compartido por las funciones serverless de /api en Vercel.
// Vivimos fuera de /api a propósito: Vercel solo convierte en función cada archivo
// DENTRO de /api, así que este helper puede importarse sin volverse una ruta pública.
import { GoogleGenAI } from "@google/genai";

export function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("GEMINI_API_KEY no está configurada. Agrégala en Vercel → Settings → Environment Variables.");
  }
  return new GoogleGenAI({ apiKey });
}

export function sendJson(res: any, status: number, body: unknown) {
  res.status(status).json(body);
}
