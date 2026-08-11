# Aprende Inglés - AI Tutor

App de aprendizaje de inglés con IA (Gemini), rediseñada con métodos de aprendizaje respaldados
por evidencia: repetición espaciada FSRS, niveles CEFR reales, shadowing, pares mínimos para el
oído fonético, y gamificación basada en autonomía/competencia/relación.

## Desplegar en Vercel (recomendado)

1. Sube esta carpeta a un repositorio de GitHub (nuevo repo, público o privado).
2. Entra a [vercel.com](https://vercel.com) → "Add New Project" → importa el repositorio.
3. Vercel detecta automáticamente `vercel.json` (build: `vite build`, output: `dist`, y las
   funciones serverless en `/api`). No necesitas configurar nada más.
4. Antes de darle "Deploy", agrega la variable de entorno:
   - `GEMINI_API_KEY` = tu clave de Google AI Studio / Gemini API.
5. Deploy. Listo — tu app queda en una URL `https://tu-proyecto.vercel.app`.

Cada vez que subas cambios al repositorio, Vercel vuelve a desplegar automáticamente.

## Desarrollo local

Necesitas [Node.js](https://nodejs.org) instalado (v18 o más reciente).

```bash
npm install
npm i -g vercel        # solo la primera vez
vercel dev             # sirve el frontend + las funciones /api juntos, como en producción
```

Crea un archivo `.env` (copia `.env.example`) con tu `GEMINI_API_KEY` para que `vercel dev` la lea.

### Alternativa sin Vercel CLI

Si prefieres no usar `vercel dev`, existe un servidor Express de respaldo (`server.ts`, el que
tenía originalmente la app en AI Studio) que sirve todo desde un solo proceso:

```bash
npm run dev:express
```

## Estructura relevante

- `src/lib/fsrs.ts` — motor de repetición espaciada (algoritmo FSRS simplificado).
- `src/lib/vocabDeck.ts` — mazo de vocabulario persistente en localStorage.
- `src/lib/mastery.ts` — modelo de dominio (mastery) y cálculo de nivel CEFR estimado.
- `src/data.ts` — pares mínimos curados a mano para el entrenamiento de oído.
- `api/*.ts` — funciones serverless de Vercel que llaman a Gemini (reemplazan `server.ts` en producción).

## Nota sobre verificación

Este proyecto se preparó y editó sin poder ejecutar `npm install` / `tsc` / `vite build` en esta
máquina (no tiene Node.js instalado). El código se revisó manualmente con cuidado, pero **antes de
confiar en que todo compila perfecto, corre `npm install && npm run lint` una vez tengas Node.js
instalado**, o simplemente despliega en Vercel y revisa los logs de build — si algo falla, el log
te dirá exactamente la línea.
