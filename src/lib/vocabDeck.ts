// Mazo de vocabulario persistente: a diferencia del sistema anterior (tarjetas efímeras que
// se perdían al generar un nuevo set), esto acumula todas las tarjetas del usuario entre
// sesiones en localStorage, cada una con su propio estado FSRS (ver fsrs.ts).
import { VocabDeckEntry, VocabCardContent } from "../types";
import { createNewCardState, isDue, cardMasteryPercent, Rating, reviewCard } from "./fsrs";

const DECK_KEY = "apex_english_ai_vocab_deck_v1";

export function loadDeck(): VocabDeckEntry[] {
  try {
    const raw = localStorage.getItem(DECK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDeck(deck: VocabDeckEntry[]): void {
  localStorage.setItem(DECK_KEY, JSON.stringify(deck));
}

// Agrega tarjetas nuevas al mazo, evitando duplicados por palabra+tema.
export function addCardsToDeck(
  contents: VocabCardContent[],
  topic: string,
  level: "Beginner" | "Intermediate" | "Advanced"
): VocabDeckEntry[] {
  const deck = loadDeck();
  const existingIds = new Set(deck.map((d) => d.id));

  for (const content of contents) {
    const id = `${topic}:${content.word.toLowerCase()}`;
    if (existingIds.has(id)) continue;
    deck.push({
      id,
      topic,
      level,
      content,
      fsrs: createNewCardState(),
    });
  }

  saveDeck(deck);
  return deck;
}

// Tarjetas cuya fecha de repaso ya venció, ordenadas por más urgente primero.
export function getDueCards(deck: VocabDeckEntry[]): VocabDeckEntry[] {
  return deck
    .filter((entry) => isDue(entry.fsrs))
    .sort((a, b) => new Date(a.fsrs.nextReviewDate).getTime() - new Date(b.fsrs.nextReviewDate).getTime());
}

export function getNextDueDate(deck: VocabDeckEntry[]): string | null {
  const upcoming = deck
    .filter((entry) => !isDue(entry.fsrs))
    .sort((a, b) => new Date(a.fsrs.nextReviewDate).getTime() - new Date(b.fsrs.nextReviewDate).getTime());
  return upcoming[0]?.fsrs.nextReviewDate ?? null;
}

export function rateCard(deck: VocabDeckEntry[], cardId: string, rating: Rating): VocabDeckEntry[] {
  const updated = deck.map((entry) =>
    entry.id === cardId ? { ...entry, fsrs: reviewCard(entry.fsrs, rating) } : entry
  );
  saveDeck(updated);
  return updated;
}

export function deckMasteryValues(deck: VocabDeckEntry[]): number[] {
  return deck.map((entry) => cardMasteryPercent(entry.fsrs));
}
