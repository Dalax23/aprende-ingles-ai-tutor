import React, { useState, useEffect } from "react";
import { VocabDeckEntry } from "../types";
import { loadDeck, addCardsToDeck, getDueCards, getNextDueDate, rateCard } from "../lib/vocabDeck";
import { Rating } from "../lib/fsrs";
import { RefreshCw, Volume2, BookOpen, Sparkles, ChevronRight, GraduationCap, Clock } from "lucide-react";
import { motion } from "motion/react";

interface VocabularyFlashcardsProps {
  onAddXp: (xp: number) => void;
  onIncrementVocab: () => void;
  onCheckBadges: () => void;
}

const TOPICS = [
  { id: "Travel", label: "Viajes ✈️" },
  { id: "Business", label: "Negocios y Trabajo 💼" },
  { id: "Social", label: "Conversación Social 🍻" },
  { id: "Shopping", label: "Compras 🛍️" },
  { id: "Slang", label: "Slang Americano 🗽" }
];

// Botones de calificación FSRS: reemplazan el "Estudiar Luego / Me lo sé" binario anterior.
// Cada calificación alimenta el modelo de memoria (stability/difficulty) — ver lib/fsrs.ts.
const RATING_BUTTONS: { rating: Rating; label: string; xp: number; className: string }[] = [
  { rating: "again", label: "Otra vez 🔄", xp: 1, className: "bg-white/5 hover:bg-white/10 text-white/70 border border-white/10" },
  { rating: "hard", label: "Difícil 😓", xp: 4, className: "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20" },
  { rating: "good", label: "Bien 🙂", xp: 8, className: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20" },
  { rating: "easy", label: "Fácil 😎", xp: 12, className: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20" },
];

export default function VocabularyFlashcards({ onAddXp, onIncrementVocab, onCheckBadges }: VocabularyFlashcardsProps) {
  const [level, setLevel] = useState<"Beginner" | "Intermediate" | "Advanced">("Intermediate");
  const [selectedTopic, setSelectedTopic] = useState<string>("Travel");
  const [deck, setDeck] = useState<VocabDeckEntry[]>([]);
  const [isFlipped, setIsFlipped] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [sessionReviewed, setSessionReviewed] = useState(0);

  // Audio state
  const [ttsLoading, setTtsLoading] = useState<string | null>(null);
  const [playingWord, setPlayingWord] = useState<string | null>(null);

  useEffect(() => {
    setDeck(loadDeck());
  }, []);

  const dueCards = getDueCards(deck);
  const activeEntry = dueCards[0];
  const nextDueDate = getNextDueDate(deck);

  // Generate NEW cards via Gemini and add them to the persistent deck (no borra las existentes).
  const fetchVocabulary = async (topicId: string) => {
    setGenerating(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/vocab/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topicId, level: level })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al generar tarjetas.");
      }

      const contents = await res.json();
      const updatedDeck = addCardsToDeck(contents, topicId, level);
      setDeck(updatedDeck);
      setIsFlipped(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "No se pudo generar el vocabulario de IA.");
    } finally {
      setGenerating(false);
    }
  };

  // Play audio via Gemini TTS
  const playWordAudio = async (text: string) => {
    if (ttsLoading || playingWord) return;
    setTtsLoading(text);
    setErrorMsg("");

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text, voiceName: "Kore" }),
      });

      if (!res.ok) {
        throw new Error("No se pudo sintetizar el audio.");
      }

      const data = await res.json();
      const audioBytes = atob(data.audioBase64);
      const arrayBuffer = new ArrayBuffer(audioBytes.length);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < audioBytes.length; i++) {
        view[i] = audioBytes.charCodeAt(i);
      }

      // Play PCM 24kHz
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buffer = audioCtx.createBuffer(1, view.length / 2, 24000);
      const channelData = buffer.getChannelData(0);
      const dataView = new DataView(arrayBuffer);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = dataView.getInt16(i * 2, true) / 32768.0;
      }

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);

      setPlayingWord(text);
      source.start(0);
      source.onended = () => {
        setPlayingWord(null);
      };
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Error de voz: " + err.message);
    } finally {
      setTtsLoading(null);
    }
  };

  // Calificar la tarjeta actual con FSRS: recalcula cuándo debe volver a aparecer.
  const handleRate = (rating: Rating) => {
    if (!activeEntry) return;
    const updatedDeck = rateCard(deck, activeEntry.id, rating);
    setDeck(updatedDeck);
    setIsFlipped(false);
    setSessionReviewed((n) => n + 1);

    const ratingConfig = RATING_BUTTONS.find((r) => r.rating === rating)!;
    onAddXp(ratingConfig.xp);
    if (rating !== "again") {
      onIncrementVocab();
    }
    onCheckBadges();
  };

  const minutesUntil = nextDueDate
    ? Math.max(1, Math.round((new Date(nextDueDate).getTime() - Date.now()) / 60000))
    : null;
  const dueLabel = minutesUntil
    ? minutesUntil < 60
      ? `${minutesUntil} min`
      : minutesUntil < 1440
        ? `${Math.round(minutesUntil / 60)} h`
        : `${Math.round(minutesUntil / 1440)} d`
    : null;

  return (
    <div className="space-y-8 animate-fadeIn" id="vocabulary-practice">

      {/* Header */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <h1 className="text-2xl md:text-3xl font-serif italic text-white flex items-center justify-center gap-2">
          <BookOpen className="w-8 h-8 text-indigo-400" /> Memorización Inteligente (Repetición Espaciada)
        </h1>
        <p className="text-sm text-white/60">
          Tu mazo recuerda cada palabra y te la muestra justo antes de que la olvides (algoritmo FSRS),
          en vez de repasar todo al azar.
        </p>
        {deck.length > 0 && (
          <div className="flex items-center justify-center gap-4 text-xs font-bold pt-1">
            <span className="text-indigo-300">{deck.length} tarjetas en tu mazo</span>
            <span className={dueCards.length > 0 ? "text-emerald-400" : "text-white/40"}>
              {dueCards.length} pendientes de repaso hoy
            </span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-200 rounded-xl p-4 text-xs font-medium max-w-xl mx-auto text-left">
          {errorMsg}
        </div>
      )}

      {/* Review flow: due cards first, always */}
      {activeEntry && (
        <div className="max-w-md mx-auto space-y-6">

          <div className="flex justify-between items-center text-xs font-bold text-white/40 uppercase tracking-wider px-2">
            <span>Repasadas hoy: {sessionReviewed}</span>
            <span className="text-emerald-400">{dueCards.length} pendientes</span>
          </div>

          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="perspective-1000 h-80 w-full cursor-pointer"
          >
            <div className={`relative w-full h-full duration-500 transform-style-3d ${isFlipped ? "rotate-y-180" : ""}`}>

              {/* Front side card */}
              <div className="absolute inset-0 backface-hidden w-full h-full bg-[#0E0E11] border border-white/10 rounded-3xl p-8 flex flex-col justify-between shadow-xl shadow-black/40 items-center text-center">
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-300">
                  <GraduationCap className="w-5 h-5" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-3xl font-serif italic text-white tracking-tight leading-normal">
                    {activeEntry.content.word}
                  </h2>
                  <p className="text-xs text-white/40 font-semibold uppercase tracking-wider">
                    Haz clic para revelar significado y fonética
                  </p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    playWordAudio(activeEntry.content.word);
                  }}
                  disabled={ttsLoading === activeEntry.content.word}
                  className="p-4 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition shrink-0 cursor-pointer"
                >
                  {playingWord === activeEntry.content.word ? (
                    <Volume2 className="w-5 h-5 animate-bounce" />
                  ) : ttsLoading === activeEntry.content.word ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
              </div>

              {/* Back side card */}
              <div className="absolute inset-0 backface-hidden w-full h-full bg-[#0E0E11] border border-white/10 rounded-3xl p-8 flex flex-col justify-between shadow-xl shadow-black/40 text-white rotate-y-180">
                <div className="flex justify-between items-center w-full">
                  <span className="text-[10px] font-bold text-indigo-300 uppercase bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                    Traducción y Uso
                  </span>
                  <span className="text-xs font-bold text-white/40">Cómo suena: <span className="text-yellow-400 font-mono font-medium">/{activeEntry.content.phonetic}/</span></span>
                </div>

                <div className="space-y-4 text-left my-auto w-full">
                  <div>
                    <span className="text-xs text-indigo-300 block font-semibold">Significado:</span>
                    <h3 className="text-xl font-serif italic text-white mt-0.5">{activeEntry.content.translation}</h3>
                  </div>

                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                    <span className="text-[10px] text-indigo-300 block font-semibold">Frase de Ejemplo:</span>
                    <p className="text-xs text-white mt-1 font-medium italic leading-relaxed">"{activeEntry.content.example}"</p>
                    <p className="text-[10px] text-white/50 mt-1">{activeEntry.content.exampleTranslation}</p>
                  </div>
                </div>

                <div className="w-full flex justify-between items-center text-[10px] text-white/40">
                  <span>Toca para voltear</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playWordAudio(activeEntry.content.example);
                    }}
                    className="flex items-center gap-1 hover:text-white font-bold bg-white/5 border border-white/10 px-2 py-1 rounded-md transition cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> Escuchar ejemplo
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Rating buttons — piden qué tan fácil fue recordar, alimentan el modelo FSRS */}
          {isFlipped && (
            <div className="space-y-2">
              <p className="text-[10px] text-white/40 text-center uppercase font-bold tracking-wider">¿Qué tan fácil te fue recordarla?</p>
              <div className="grid grid-cols-4 gap-2">
                {RATING_BUTTONS.map((btn) => (
                  <button
                    key={btn.rating}
                    onClick={() => handleRate(btn.rating)}
                    className={`py-3 rounded-2xl text-[11px] font-bold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${btn.className}`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* No due cards but deck has content */}
      {!activeEntry && deck.length > 0 && (
        <div className="max-w-md mx-auto bg-[#0E0E11] border border-white/10 rounded-3xl p-8 text-center space-y-4 shadow-lg">
          <Clock className="w-10 h-10 text-emerald-400 mx-auto" />
          <div className="space-y-1">
            <h4 className="font-bold text-white text-sm">¡Ya repasaste todo lo pendiente!</h4>
            <p className="text-xs text-white/40">
              {dueLabel
                ? `Tu próxima tarjeta vence en aproximadamente ${dueLabel}. Volver antes no ayuda — el algoritmo la agenda justo cuando estás a punto de olvidarla.`
                : "Genera nuevas tarjetas abajo para seguir ampliando tu vocabulario."}
            </p>
          </div>
        </div>
      )}

      {/* Generate more cards panel */}
      <div className="bg-[#0E0E11] border border-white/10 rounded-3xl p-6 max-w-2xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 items-center shadow-lg">
        <div className="space-y-1.5 text-left">
          <span className="text-xs font-bold text-white/40 uppercase tracking-wider block">Nivel para nuevas tarjetas:</span>
          <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1 w-full">
            {(["Beginner", "Intermediate", "Advanced"] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevel(lvl)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  level === lvl
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                {lvl === "Beginner" ? "Básico" : lvl === "Intermediate" ? "Medio" : "Avanzado"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 text-left">
          <span className="text-xs font-bold text-white/40 uppercase tracking-wider block">Tema para nuevas tarjetas:</span>
          <select
            value={selectedTopic}
            onChange={(e) => setSelectedTopic(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500 text-white/90 focus:outline-hidden"
          >
            {TOPICS.map((topic) => (
              <option key={topic.id} value={topic.id} className="bg-[#0E0E11] text-white">
                {topic.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2 pt-2">
          <button
            onClick={() => fetchVocabulary(selectedTopic)}
            disabled={generating}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Generando Vocabulario Contextual...
              </>
            ) : (
              <>
                Agregar 5 Tarjetas Nuevas a Mi Mazo <Sparkles className="w-4 h-4 animate-bounce-subtle" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Intro empty state when no cards generated */}
      {deck.length === 0 && !generating && (
        <div className="max-w-md mx-auto border border-dashed border-white/10 rounded-3xl p-10 text-center space-y-4 bg-[#0E0E11]">
          <BookOpen className="w-12 h-12 text-white/20 mx-auto" />
          <div className="space-y-1">
            <h4 className="font-bold text-white text-sm">Tu mazo de estudio está vacío</h4>
            <p className="text-xs text-white/40">Escoge un tema arriba y genera tus primeras 5 tarjetas — a partir de ahí, el sistema te las mostrará justo cuando estés a punto de olvidarlas.</p>
          </div>
        </div>
      )}

    </div>
  );
}
