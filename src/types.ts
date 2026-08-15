export interface UserStats {
  xp: number;
  level: number;
  streak: number;
  dailyGoalXp: number; // e.g. 50 XP — ajustable por el usuario (autonomía, ver Dashboard)
  todayXp: number;
  lastActiveDate: string; // YYYY-MM-DD
  badges: Badge[];
  completedPronunciations: number;
  completedConversations: number;
  masteredWordsCount: number;
  completedReadings?: number;
  // Modelo de dominio (mastery) por sonido fonético y por escenario de conversación,
  // usado para calcular el nivel CEFR estimado (ver lib/mastery.ts). Opcionales para
  // mantener compatibilidad con datos guardados antes de esta función.
  phonemeMastery?: import("./lib/mastery").PhonemeMastery;
  scenarioMastery?: import("./lib/mastery").ScenarioMastery;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
}

// Contenido generado por IA para una tarjeta (sin estado de repetición).
export interface VocabCardContent {
  word: string;
  phonetic: string;
  translation: string;
  example: string;
  exampleTranslation: string;
}

// Entrada persistida en el mazo del usuario: contenido + estado FSRS (ver lib/fsrs.ts).
// A diferencia del sistema anterior (Leitner efímero, se perdía al cerrar la sesión),
// esto se guarda en localStorage y se acumula entre sesiones.
export interface VocabDeckEntry {
  id: string; // word + topic, para evitar duplicados
  topic: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  content: VocabCardContent;
  fsrs: import("./lib/fsrs").FsrsCardState;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  translation?: string;
  feedback?: {
    original: string;
    corrected: string;
    explanation: string;
  } | null;
  suggestions?: string[];
  timestamp: string;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  emoji: string;
  context: string;
  level: "Beginner" | "Intermediate" | "Advanced";
}

export interface WordAnalysis {
  word: string;
  status: "correct" | "warning" | "error";
  phoneticTip?: string;
  // Sonido específico responsable del error (ej. "th", "r", "v-b", "vowel-length").
  // Null/undefined si status es "correct". Se usa para el mastery por fonema (ver lib/mastery.ts).
  phonemeTag?: string;
}

// Par mínimo: dos palabras que solo difieren en UN sonido (ship/sheep, very/berry...).
// Entrenar con pares mínimos sube ~35% la precisión de percepción en 14h de práctica
// (investigación UBC) — es el método más efectivo y barato de entrenar el oído fonético.
export interface MinimalPair {
  id: string;
  phonemeTag: string; // ej. "iː-ɪ", "v-b", "θ-s"
  wordA: string;
  wordB: string;
  hintA: string; // consejo articulatorio en español
  hintB: string;
}

export interface PronunciationResult {
  score: number;
  accuracy: number;
  fluency: number;
  words: WordAnalysis[];
  tip: string;
}

export interface PracticePhrase {
  id: string;
  phrase: string;
  translation: string;
  topic: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
}

// Lectura graduada: la longitud/complejidad crece con el nivel (CEFR aproximado).
// Combina "input comprensible" (Krashen i+1) con lectura + audio simultáneos —
// la técnica de "reading while listening" mejora tanto fluidez lectora como
// reconocimiento auditivo al conectar la forma escrita con el sonido real.
export interface ReadingSentence {
  text: string; // frase en inglés
  phonetic: string; // pronunciación figurada completa de la frase, para hispanohablantes
  translation: string; // traducción al español
}

export interface ReadingPassage {
  title: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  topic: string;
  sentences: ReadingSentence[];
}
