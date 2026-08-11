import React, { useState } from "react";
import { MINIMAL_PAIRS } from "../data";
import { MinimalPair } from "../types";
import { Volume2, RefreshCw, Ear, Check, X } from "lucide-react";

interface MinimalPairsDrillProps {
  onAddXp: (xp: number) => void;
  onPhonemeResult: (phonemeTag: string, success: boolean) => void;
}

// Entrenamiento de PERCEPCIÓN (no de habla): el estudiante escucha una de las dos palabras
// del par mínimo y debe identificar cuál fue. Es el método exacto del estudio de UBC (2019):
// 14 horas de este tipo de entrenamiento subieron 35% la precisión de percepción de sonidos,
// con ganancias que persisten 6 meses después. Entrenar el oído primero hace que luego sea
// más fácil producir el sonido correctamente al hablar.
export default function MinimalPairsDrill({ onAddXp, onPhonemeResult }: MinimalPairsDrillProps) {
  const [currentPair, setCurrentPair] = useState<MinimalPair>(MINIMAL_PAIRS[0]);
  const [targetIsA, setTargetIsA] = useState(true);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [streak, setStreak] = useState(0);
  const [round, setRound] = useState(1);

  const pickRandomRound = () => {
    const pair = MINIMAL_PAIRS[Math.floor(Math.random() * MINIMAL_PAIRS.length)];
    setCurrentPair(pair);
    setTargetIsA(Math.random() < 0.5);
    setHasPlayed(false);
    setFeedback(null);
  };

  const playTargetAudio = async () => {
    if (ttsLoading) return;
    setTtsLoading(true);
    const wordToPlay = targetIsA ? currentPair.wordA : currentPair.wordB;

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: wordToPlay, voiceName: "Kore" }),
      });
      if (!res.ok) throw new Error("No se pudo reproducir el audio.");

      const data = await res.json();
      const audioBytes = atob(data.audioBase64);
      const arrayBuffer = new ArrayBuffer(audioBytes.length);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < audioBytes.length; i++) view[i] = audioBytes.charCodeAt(i);

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
      source.start(0);
      setHasPlayed(true);
    } catch (err) {
      console.error(err);
    } finally {
      setTtsLoading(false);
    }
  };

  const handleGuess = (guessedA: boolean) => {
    if (!hasPlayed || feedback) return;
    const correct = guessedA === targetIsA;
    setFeedback(correct ? "correct" : "wrong");
    onPhonemeResult(currentPair.phonemeTag, correct);

    if (correct) {
      onAddXp(5);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }

    setTimeout(() => {
      setRound((r) => r + 1);
      pickRandomRound();
    }, 1600);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-serif italic text-white flex items-center justify-center gap-2">
          <Ear className="w-6 h-6 text-indigo-400" /> Entrenamiento de Oído: Pares Mínimos
        </h2>
        <p className="text-xs text-white/50">
          Escucha la palabra y adivina cuál fue. Este ejercicio entrena tu percepción de sonidos que
          confunden a hispanohablantes — la ciencia dice que 14 horas de esto suben tu precisión ~35%.
        </p>
      </div>

      <div className="flex items-center justify-center gap-4 text-xs font-bold">
        <span className="text-white/40">Ronda {round}</span>
        <span className={streak > 0 ? "text-emerald-400" : "text-white/40"}>🔥 Racha: {streak}</span>
      </div>

      <div className="bg-[#0E0E11] border border-white/10 rounded-3xl p-8 space-y-6 shadow-lg">
        <div className="text-center space-y-3">
          <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full uppercase tracking-wider inline-block">
            Sonido: {currentPair.phonemeTag}
          </span>
          <button
            onClick={playTargetAudio}
            disabled={ttsLoading}
            className="mx-auto flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            {ttsLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Volume2 className="w-5 h-5" />}
            {hasPlayed ? "Escuchar de nuevo" : "Reproducir palabra"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { isA: true, word: currentPair.wordA, hint: currentPair.hintA },
            { isA: false, word: currentPair.wordB, hint: currentPair.hintB },
          ].map((opt) => {
            const isTheAnswer = opt.isA === targetIsA;
            const showResult = feedback !== null;
            return (
              <button
                key={opt.word}
                onClick={() => handleGuess(opt.isA)}
                disabled={!hasPlayed || feedback !== null}
                className={`p-5 rounded-2xl border text-center transition disabled:cursor-not-allowed cursor-pointer space-y-2 ${
                  showResult && isTheAnswer
                    ? "bg-emerald-500/15 border-emerald-500/40"
                    : showResult && !isTheAnswer
                      ? "bg-rose-500/10 border-rose-500/20 opacity-50"
                      : "bg-white/5 border-white/10 hover:border-indigo-500/30 hover:bg-white/10"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-lg font-bold text-white">{opt.word}</span>
                  {showResult && isTheAnswer && <Check className="w-4 h-4 text-emerald-400" />}
                  {showResult && !isTheAnswer && feedback === "wrong" && <X className="w-4 h-4 text-rose-400" />}
                </div>
                {showResult && isTheAnswer && (
                  <p className="text-[10px] text-emerald-200/80 leading-relaxed">{opt.hint}</p>
                )}
              </button>
            );
          })}
        </div>

        {!hasPlayed && (
          <p className="text-center text-[11px] text-white/30">Reproduce el audio antes de adivinar.</p>
        )}
      </div>
    </div>
  );
}
