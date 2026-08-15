import React, { useState, useEffect } from "react";
import { VocabDeckEntry, PracticePhrase, MinimalPair, PronunciationResult } from "../types";
import { DEFAULT_PHRASES, MINIMAL_PAIRS } from "../data";
import { loadDeck, getDueCards, rateCard } from "../lib/vocabDeck";
import { Rating } from "../lib/fsrs";
import { Layers, Volume2, RefreshCw, Mic, MicOff, Check, ArrowRight, PartyPopper, Ear } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface MixedSessionProps {
  onAddXp: (xp: number) => void;
  onIncrementVocab: () => void;
  onIncrementPronunciations: () => void;
  onPhonemeResult: (phonemeTag: string, success: boolean) => void;
  onCheckBadges: () => void;
  onFinish: () => void;
}

const RATING_BUTTONS: { rating: Rating; label: string; className: string }[] = [
  { rating: "again", label: "Otra vez", className: "bg-white/5 hover:bg-white/10 text-white/70 border border-white/10" },
  { rating: "hard", label: "Difícil", className: "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20" },
  { rating: "good", label: "Bien", className: "bg-indigo-600 hover:bg-indigo-500 text-white" },
  { rating: "easy", label: "Fácil", className: "bg-emerald-600 hover:bg-emerald-500 text-white" },
];

// Sesión mixta: 3 pasos que alternan tipo de práctica en la misma ronda (vocabulario →
// pronunciación → percepción de pares mínimos). El interleaving (alternar tipos en vez de
// practicar en bloque) sube ~30% el rendimiento de retención vs. bloques repetitivos de un
// solo tipo (investigación cognitiva sobre retrieval practice + interleaving).
export default function MixedSession({
  onAddXp,
  onIncrementVocab,
  onIncrementPronunciations,
  onPhonemeResult,
  onCheckBadges,
  onFinish,
}: MixedSessionProps) {
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  // Step 1: vocab
  const [vocabEntry, setVocabEntry] = useState<VocabDeckEntry | null>(null);
  const [vocabFlipped, setVocabFlipped] = useState(false);
  const [hasVocabDeck, setHasVocabDeck] = useState(true);

  // Step 2: pronunciation
  const [phrase] = useState<PracticePhrase>(() => DEFAULT_PHRASES[Math.floor(Math.random() * DEFAULT_PHRASES.length)]);
  const [isPlayingTts, setIsPlayingTts] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [recognition, setRecognition] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [pronResult, setPronResult] = useState<PronunciationResult | null>(null);

  // Step 3: minimal pair
  const [pair] = useState<MinimalPair>(() => MINIMAL_PAIRS[Math.floor(Math.random() * MINIMAL_PAIRS.length)]);
  const [targetIsA] = useState(() => Math.random() < 0.5);
  const [pairPlayed, setPairPlayed] = useState(false);
  const [pairTtsLoading, setPairTtsLoading] = useState(false);
  const [pairFeedback, setPairFeedback] = useState<"correct" | "wrong" | null>(null);

  useEffect(() => {
    const deck = loadDeck();
    const due = getDueCards(deck);
    const chosen = due[0] || deck[0] || null;
    setVocabEntry(chosen);
    setHasVocabDeck(deck.length > 0);
  }, []);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onstart = () => setIsRecording(true);
    rec.onend = () => setIsRecording(false);
    rec.onerror = () => setIsRecording(false);
    rec.onresult = (event: any) => setSpokenText(event.results[0][0].transcript);
    setRecognition(rec);
  }, []);

  const playPcmAudio = async (text: string, onStart: () => void, onEnd: () => void) => {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceName: "Kore" }),
    });
    if (!res.ok) throw new Error("Audio error");
    const data = await res.json();
    const audioBytes = atob(data.audioBase64);
    const arrayBuffer = new ArrayBuffer(audioBytes.length);
    const view = new Uint8Array(arrayBuffer);
    for (let i = 0; i < audioBytes.length; i++) view[i] = audioBytes.charCodeAt(i);
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const buffer = audioCtx.createBuffer(1, view.length / 2, 24000);
    const channelData = buffer.getChannelData(0);
    const dataView = new DataView(arrayBuffer);
    for (let i = 0; i < channelData.length; i++) channelData[i] = dataView.getInt16(i * 2, true) / 32768.0;
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    onStart();
    source.start(0);
    source.onended = onEnd;
  };

  // --- Step 1 handlers ---
  const rateVocab = (rating: Rating) => {
    if (!vocabEntry) return;
    const deck = loadDeck();
    rateCard(deck, vocabEntry.id, rating);
    if (rating !== "again") onIncrementVocab();
    onAddXp(rating === "easy" ? 12 : rating === "good" ? 8 : rating === "hard" ? 4 : 1);
    onCheckBadges();
    setStep(2);
  };

  // --- Step 2 handlers ---
  const playPhraseAudio = () => {
    if (ttsLoading || isPlayingTts) return;
    setTtsLoading(true);
    playPcmAudio(
      phrase.phrase,
      () => setIsPlayingTts(true),
      () => {
        setIsPlayingTts(false);
        setTtsLoading(false);
      }
    ).catch(() => setTtsLoading(false));
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognition?.stop();
    } else {
      setSpokenText("");
      setPronResult(null);
      try {
        recognition?.start();
      } catch {}
    }
  };

  const analyzePronunciation = async () => {
    if (!spokenText || analyzing) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/pronunciation/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPhrase: phrase.phrase, spokenText }),
      });
      const data: PronunciationResult = await res.json();
      setPronResult(data);
      data.words.forEach((w) => {
        if (w.phonemeTag) onPhonemeResult(w.phonemeTag, w.status === "correct");
      });
      onAddXp(Math.max(10, Math.round(data.score / 5)));
      onIncrementPronunciations();
      onCheckBadges();
    } catch {
      // keep session moving even if analysis fails
    } finally {
      setAnalyzing(false);
    }
  };

  // --- Step 3 handlers ---
  const playPairAudio = () => {
    if (pairTtsLoading) return;
    setPairTtsLoading(true);
    const word = targetIsA ? pair.wordA : pair.wordB;
    playPcmAudio(
      word,
      () => {},
      () => setPairTtsLoading(false)
    ).catch(() => setPairTtsLoading(false));
    setPairPlayed(true);
  };

  const guessPair = (guessedA: boolean) => {
    if (!pairPlayed || pairFeedback) return;
    const correct = guessedA === targetIsA;
    setPairFeedback(correct ? "correct" : "wrong");
    onPhonemeResult(pair.phonemeTag, correct);
    if (correct) onAddXp(8);
  };

  const finishSession = () => {
    onAddXp(30); // bono por completar la sesión mixta completa
    onCheckBadges();
    onFinish();
  };

  return (
    <div className="max-w-lg mx-auto space-y-6" id="mixed-session">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-serif italic text-white flex items-center justify-center gap-2">
          <Layers className="w-7 h-7 text-indigo-400" /> Sesión Mixta de Hoy
        </h1>
        <p className="text-xs text-white/50">Paso {step} de {totalSteps} — alternar tipos de práctica mejora la retención.</p>
        <div className="flex justify-center gap-2 pt-1">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1.5 rounded-full transition-all ${s <= step ? "w-8 bg-indigo-500" : "w-4 bg-white/10"}`} />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1: Vocabulary */}
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full uppercase tracking-wider inline-block">1. Vocabulario</span>

            {!hasVocabDeck || !vocabEntry ? (
              <div className="bg-[#0E0E11] border border-white/10 rounded-3xl p-8 text-center space-y-3">
                <p className="text-sm text-white/60">Aún no tienes tarjetas de vocabulario. Genera algunas en la pestaña Vocabulario.</p>
                <button onClick={() => setStep(2)} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer">
                  Saltar a Pronunciación <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => setVocabFlipped(!vocabFlipped)}
                className="bg-[#0E0E11] border border-white/10 rounded-3xl p-8 text-center space-y-4 cursor-pointer min-h-[220px] flex flex-col justify-center"
              >
                {!vocabFlipped ? (
                  <>
                    <h2 className="text-3xl font-serif italic text-white">{vocabEntry.content.word}</h2>
                    <p className="text-xs text-white/40 uppercase font-bold tracking-wider">Toca para revelar</p>
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-serif italic text-white">{vocabEntry.content.translation}</h3>
                    <p className="text-yellow-400 font-mono text-xs">/{vocabEntry.content.phonetic}/</p>
                    <p className="text-white/50 text-xs italic">"{vocabEntry.content.example}"</p>
                  </>
                )}
              </div>
            )}

            {vocabFlipped && vocabEntry && (
              <div className="grid grid-cols-4 gap-2">
                {RATING_BUTTONS.map((btn) => (
                  <button key={btn.rating} onClick={() => rateVocab(btn.rating)} className={`py-2.5 rounded-xl text-[10px] font-bold cursor-pointer ${btn.className}`}>
                    {btn.label}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* STEP 2: Pronunciation */}
        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full uppercase tracking-wider inline-block">2. Pronunciación</span>

            <div className="bg-[#0E0E11] border border-white/10 rounded-3xl p-6 space-y-4 text-center">
              <p className="text-lg font-serif italic text-white">"{phrase.phrase}"</p>
              <p className="text-xs text-white/40 italic">{phrase.translation}</p>

              <button onClick={playPhraseAudio} disabled={ttsLoading} className="mx-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer">
                {ttsLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />} Escuchar
              </button>

              {recognition && (
                <button
                  onClick={toggleRecording}
                  className={`mx-auto flex items-center justify-center w-16 h-16 rounded-full cursor-pointer transition ${
                    isRecording ? "bg-rose-500 ring-4 ring-rose-500/20 animate-pulse" : "bg-indigo-600 hover:bg-indigo-500"
                  }`}
                >
                  {isRecording ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
                </button>
              )}

              {spokenText && !isRecording && !pronResult && (
                <button onClick={analyzePronunciation} disabled={analyzing} className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer">
                  {analyzing ? "Analizando..." : "Evaluar Pronunciación"}
                </button>
              )}

              {pronResult && (
                <div className="bg-white/5 rounded-xl p-4 text-sm font-bold text-emerald-400">Puntaje: {pronResult.score}%</div>
              )}
            </div>

            <button
              onClick={() => setStep(3)}
              className="w-full py-3 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
            >
              Continuar a Pares Mínimos <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}

        {/* STEP 3: Minimal pair */}
        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <span className="text-[10px] font-bold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full uppercase tracking-wider inline-block flex items-center gap-1 w-fit">
              <Ear className="w-3.5 h-3.5" /> 3. Oído (Pares Mínimos)
            </span>

            <div className="bg-[#0E0E11] border border-white/10 rounded-3xl p-6 space-y-4 text-center">
              <button onClick={playPairAudio} disabled={pairTtsLoading} className="mx-auto flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer">
                {pairTtsLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />} {pairPlayed ? "Escuchar de nuevo" : "Reproducir palabra"}
              </button>

              <div className="grid grid-cols-2 gap-3">
                {[{ isA: true, word: pair.wordA }, { isA: false, word: pair.wordB }].map((opt) => {
                  const isAnswer = opt.isA === targetIsA;
                  const show = pairFeedback !== null;
                  return (
                    <button
                      key={opt.word}
                      onClick={() => guessPair(opt.isA)}
                      disabled={!pairPlayed || !!pairFeedback}
                      className={`p-4 rounded-2xl border text-center cursor-pointer transition ${
                        show && isAnswer ? "bg-emerald-500/15 border-emerald-500/40" : show ? "opacity-40 border-white/10" : "bg-white/5 border-white/10 hover:border-indigo-500/30"
                      }`}
                    >
                      <span className="font-bold text-white">{opt.word}</span>
                      {show && isAnswer && <Check className="w-4 h-4 text-emerald-400 inline ml-1.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={finishSession}
              disabled={!pairFeedback}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-bold cursor-pointer flex items-center justify-center gap-2"
            >
              <PartyPopper className="w-4 h-4" /> Terminar Sesión (+30 XP bono)
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
