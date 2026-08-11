// Motor de repetición espaciada simplificado basado en FSRS (Free Spaced Repetition Scheduler).
// En vez de intervalos fijos (Leitner: caja 1/2/3...), modela la curva de olvido de CADA tarjeta
// individualmente con dos variables: stability (cuántos días tarda en caer al 90% de probabilidad
// de recuerdo) y difficulty (qué tan rápido decae esa estabilidad tras un fallo).
// Referencia: FSRS-6 (open-spaced-repetition/fsrs4anki), simplificado para no requerir
// el dataset de 700M de repasos del algoritmo original — usamos sus mismas curvas paramétricas.

export type Rating = "again" | "hard" | "good" | "easy";

export interface FsrsCardState {
  stability: number; // en días
  difficulty: number; // 1 (fácil) a 10 (difícil)
  reviewCount: number;
  lastReviewDate: string; // ISO
  nextReviewDate: string; // ISO
}

const REQUEST_RETENTION = 0.9; // agendamos el repaso para cuando la retrievability caiga a 90%
const DECAY = -0.5; // exponente de la curva de olvido de FSRS

// retrievability(t) = (1 + DECAY_FACTOR * t / stability) ^ DECAY
const DECAY_FACTOR = Math.pow(0.9, 1 / DECAY) - 1;

export function retrievability(daysSinceReview: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + (DECAY_FACTOR * daysSinceReview) / stability, DECAY);
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function createNewCardState(): FsrsCardState {
  const now = new Date().toISOString();
  return {
    stability: 0,
    difficulty: 5,
    reviewCount: 0,
    lastReviewDate: now,
    nextReviewDate: now,
  };
}

// Recalcula stability y difficulty tras una calificación, siguiendo las fórmulas
// paramétricas estándar de FSRS (versión simplificada con pesos por defecto de fsrs4anki).
export function reviewCard(state: FsrsCardState, rating: Rating): FsrsCardState {
  const now = new Date();
  const isNewCard = state.reviewCount === 0;

  let newDifficulty: number;
  let newStability: number;

  if (isNewCard) {
    // Estabilidad inicial según la primera calificación (días hasta caer a 90%).
    const initialStability = { again: 0.4, hard: 1.0, good: 3.0, easy: 7.0 }[rating];
    newStability = initialStability;
    newDifficulty = { again: 8, hard: 6.5, good: 5, easy: 3 }[rating];
  } else {
    const elapsedDays = daysBetween(new Date(state.lastReviewDate), now);
    const r = retrievability(elapsedDays, state.stability);

    // Ajuste de dificultad: falla sube dificultad, acierta la baja levemente hacia el centro.
    const difficultyDelta = { again: 1.4, hard: 0.4, good: -0.1, easy: -0.6 }[rating];
    newDifficulty = Math.min(10, Math.max(1, state.difficulty + difficultyDelta));

    if (rating === "again") {
      // Fallo: la estabilidad colapsa (se "olvidó"), pero no vuelve a cero — hay memoria residual.
      newStability = Math.max(0.4, state.stability * 0.35 * (1 - r) + 0.2);
    } else {
      // Éxito: la estabilidad crece más cuanto más difícil era recordarla en ese momento (r bajo)
      // y menos cuanto más "fácil" es intrínsecamente la tarjeta (difficulty baja) — fórmula
      // inspirada en el término de estabilización de FSRS.
      const difficultyFactor = (11 - newDifficulty) / 10;
      const retrievabilityFactor = Math.exp((1 - r) * 1.2) - 1;
      const ratingBonus = { hard: 0.7, good: 1.3, easy: 2.2 }[rating as "hard" | "good" | "easy"];
      newStability = state.stability * (1 + difficultyFactor * retrievabilityFactor * ratingBonus);
      newStability = Math.max(state.stability, newStability); // nunca baja al acertar
    }
  }

  // Próximo repaso: el día en que retrievability(t) = REQUEST_RETENTION
  // Despejando t de la fórmula de retrievability:
  const daysUntilDue = (newStability / DECAY_FACTOR) * (Math.pow(REQUEST_RETENTION, 1 / DECAY) - 1);
  const nextReview = new Date(now.getTime() + Math.max(0.02, daysUntilDue) * 24 * 60 * 60 * 1000);

  return {
    stability: newStability,
    difficulty: newDifficulty,
    reviewCount: state.reviewCount + 1,
    lastReviewDate: now.toISOString(),
    nextReviewDate: nextReview.toISOString(),
  };
}

export function isDue(state: FsrsCardState): boolean {
  return new Date(state.nextReviewDate).getTime() <= Date.now();
}

export function currentRetrievability(state: FsrsCardState): number {
  if (state.reviewCount === 0) return 0;
  const elapsedDays = daysBetween(new Date(state.lastReviewDate), new Date());
  return retrievability(elapsedDays, state.stability);
}

// Dominio (mastery %) de una tarjeta: combina qué tan estable es la memoria con cuántas veces
// se ha repasado con éxito. Una tarjeta nueva es 0%; una con stability alta y varios aciertos
// se acerca a 100%. Se usa para el modelo de progreso CEFR (ver mastery.ts).
export function cardMasteryPercent(state: FsrsCardState): number {
  if (state.reviewCount === 0) return 0;
  // Stability de 21+ días con al menos 3 repasos exitosos = dominio "completo" para efectos prácticos.
  const stabilityScore = Math.min(1, state.stability / 21);
  const repetitionScore = Math.min(1, state.reviewCount / 4);
  return Math.round((stabilityScore * 0.7 + repetitionScore * 0.3) * 100);
}
