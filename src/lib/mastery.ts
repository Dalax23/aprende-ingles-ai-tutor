// Modelo de progreso unificado: en vez de solo XP genérico, medimos "dominio" (mastery, 0-100%)
// por palabra de vocabulario, por sonido fonético practicado y por escenario de conversación
// completado, y de ahí derivamos un nivel CEFR estimado (A1-C2). El XP sigue existiendo para
// gamificación (ver App.tsx), pero el nivel CEFR refleja aprendizaje real, no actividad.

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface PhonemeMastery {
  [phoneme: string]: { attempts: number; successRate: number }; // successRate 0-1
}

export interface ScenarioMastery {
  [scenarioId: string]: { completions: number; grammarErrorRate: number }; // errorRate 0-1
}

export interface MasterySnapshot {
  date: string; // YYYY-MM-DD
  vocabMasteryAvg: number; // 0-100
  pronunciationMasteryAvg: number; // 0-100
  conversationMasteryAvg: number; // 0-100
  overallScore: number; // 0-100, promedio ponderado
  cefrLevel: CefrLevel;
}

const CEFR_THRESHOLDS: { level: CefrLevel; minScore: number }[] = [
  { level: "C2", minScore: 90 },
  { level: "C1", minScore: 75 },
  { level: "B2", minScore: 58 },
  { level: "B1", minScore: 40 },
  { level: "A2", minScore: 20 },
  { level: "A1", minScore: 0 },
];

export function scoreToCefr(overallScore: number): CefrLevel {
  for (const t of CEFR_THRESHOLDS) {
    if (overallScore >= t.minScore) return t.level;
  }
  return "A1";
}

export function cefrLabel(level: CefrLevel): string {
  const labels: Record<CefrLevel, string> = {
    A1: "A1 — Principiante",
    A2: "A2 — Básico",
    B1: "B1 — Intermedio",
    B2: "B2 — Intermedio Alto",
    C1: "C1 — Avanzado",
    C2: "C2 — Dominio Total",
  };
  return labels[level];
}

// Calcula el dominio agregado combinando vocabulario (FSRS), pronunciación (por fonema)
// y conversación (por escenario, penalizado por tasa de errores gramaticales).
export function computeOverallMastery(
  vocabMasteryValues: number[], // cardMasteryPercent() de cada tarjeta de vocabulario
  phonemeMastery: PhonemeMastery,
  scenarioMastery: ScenarioMastery
): { vocabAvg: number; pronunciationAvg: number; conversationAvg: number; overallScore: number; cefrLevel: CefrLevel } {
  const vocabAvg = vocabMasteryValues.length
    ? Math.round(vocabMasteryValues.reduce((a, b) => a + b, 0) / vocabMasteryValues.length)
    : 0;

  const phonemeEntries = Object.values(phonemeMastery);
  const pronunciationAvg = phonemeEntries.length
    ? Math.round(
        (phonemeEntries.reduce((sum, p) => sum + p.successRate * Math.min(1, p.attempts / 5), 0) /
          phonemeEntries.length) *
          100
      )
    : 0;

  const scenarioEntries = Object.values(scenarioMastery);
  const conversationAvg = scenarioEntries.length
    ? Math.round(
        (scenarioEntries.reduce(
          (sum, s) => sum + Math.min(1, s.completions / 3) * (1 - s.grammarErrorRate),
          0
        ) /
          scenarioEntries.length) *
          100
      )
    : 0;

  // Ponderación: vocabulario 35%, pronunciación 30%, conversación 35% (conversación integra
  // gramática y vocabulario en uso real, por lo que pesa tanto como vocabulario aislado).
  const overallScore = Math.round(vocabAvg * 0.35 + pronunciationAvg * 0.3 + conversationAvg * 0.35);
  const cefrLevel = scoreToCefr(overallScore);

  return { vocabAvg, pronunciationAvg, conversationAvg, overallScore, cefrLevel };
}

const HISTORY_KEY = "apex_english_ai_mastery_history";
const MAX_HISTORY_DAYS = 60;

export function recordDailySnapshot(snapshot: MasterySnapshot): void {
  const history = loadMasteryHistory();
  const todayIndex = history.findIndex((h) => h.date === snapshot.date);
  if (todayIndex >= 0) {
    history[todayIndex] = snapshot;
  } else {
    history.push(snapshot);
  }
  const trimmed = history.slice(-MAX_HISTORY_DAYS);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

export function loadMasteryHistory(): MasterySnapshot[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
