import React, { useState, useRef } from "react";
import { ReadingPassage } from "../types";
import { BookOpenText, RefreshCw, Sparkles, Volume2, Gauge } from "lucide-react";
import { motion } from "motion/react";

interface GradedReadingsProps {
  onAddXp: (xp: number) => void;
  onIncrementReadings: () => void;
}

const TOPICS = [
  { id: "Daily Routine", label: "Rutina Diaria 🌅" },
  { id: "A Trip Abroad", label: "Un Viaje al Extranjero ✈️" },
  { id: "Technology", label: "Tecnología 💻" },
  { id: "Food and Cooking", label: "Comida y Cocina 🍳" },
  { id: "Work Life", label: "Vida Laboral 💼" },
];

const SPEEDS = [
  { value: 0.7, label: "Lento" },
  { value: 1, label: "Normal" },
  { value: 1.25, label: "Rápido" },
];

// Lecturas graduadas: la longitud y complejidad crecen con el nivel (input comprensible,
// Krashen i+1). Combinan lectura + audio simultáneos ("reading while listening"), con
// velocidad ajustable — reproducimos el MISMO audio generado por Gemini TTS a distinta
// velocidad de reproducción (Web Audio playbackRate) en vez de pedir 3 audios distintos.
export default function GradedReadings({ onAddXp, onIncrementReadings }: GradedReadingsProps) {
  const [level, setLevel] = useState<"Beginner" | "Intermediate" | "Advanced">("Beginner");
  const [topic, setTopic] = useState<string>(TOPICS[0].id);
  const [passage, setPassage] = useState<ReadingPassage | null>(null);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [speed, setSpeed] = useState<number>(1);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [loadingAudioIndex, setLoadingAudioIndex] = useState<number | null>(null);
  const [xpAwarded, setXpAwarded] = useState(false);

  const audioBuffersRef = useRef<Map<number, AudioBuffer>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return audioCtxRef.current;
  };

  const fetchPassage = async () => {
    setGenerating(true);
    setErrorMsg("");
    setPassage(null);
    setXpAwarded(false);
    audioBuffersRef.current.clear();

    try {
      const res = await fetch("/api/reading/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, level }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al generar la lectura.");
      }
      const data: ReadingPassage = await res.json();
      setPassage(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "No se pudo generar la lectura.");
    } finally {
      setGenerating(false);
    }
  };

  const decodeBase64Pcm = (base64: string): AudioBuffer => {
    const audioCtx = getAudioCtx();
    const audioBytes = atob(base64);
    const arrayBuffer = new ArrayBuffer(audioBytes.length);
    const view = new Uint8Array(arrayBuffer);
    for (let i = 0; i < audioBytes.length; i++) view[i] = audioBytes.charCodeAt(i);

    const buffer = audioCtx.createBuffer(1, view.length / 2, 24000);
    const channelData = buffer.getChannelData(0);
    const dataView = new DataView(arrayBuffer);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = dataView.getInt16(i * 2, true) / 32768.0;
    }
    return buffer;
  };

  const playSentence = async (index: number, text: string) => {
    if (playingIndex !== null || loadingAudioIndex !== null) return;

    try {
      let buffer = audioBuffersRef.current.get(index);
      if (!buffer) {
        setLoadingAudioIndex(index);
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voiceName: "Kore" }),
        });
        if (!res.ok) throw new Error("No se pudo sintetizar el audio.");
        const data = await res.json();
        buffer = decodeBase64Pcm(data.audioBase64);
        audioBuffersRef.current.set(index, buffer);
        setLoadingAudioIndex(null);
      }

      const audioCtx = getAudioCtx();
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = speed;
      source.connect(audioCtx.destination);

      setPlayingIndex(index);
      source.start(0);
      source.onended = () => setPlayingIndex(null);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error al reproducir el audio.");
      setLoadingAudioIndex(null);
      setPlayingIndex(null);
    }
  };

  const markAsRead = () => {
    if (xpAwarded) return;
    onAddXp(20);
    onIncrementReadings();
    setXpAwarded(true);
  };

  return (
    <div className="space-y-8 animate-fadeIn" id="graded-readings">
      <div className="text-center max-w-xl mx-auto space-y-2">
        <h1 className="text-2xl md:text-3xl font-serif italic text-white flex items-center justify-center gap-2">
          <BookOpenText className="w-8 h-8 text-indigo-400" /> Lecturas Graduadas
        </h1>
        <p className="text-sm text-white/60">
          Lee mientras escuchas cómo suena cada oración — la longitud y complejidad crecen con tu
          nivel. Ajusta la velocidad del audio para entrenar tu oído poco a poco.
        </p>
      </div>

      {/* Settings */}
      <div className="bg-[#0E0E11] border border-white/10 rounded-3xl p-6 max-w-2xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 items-center shadow-lg">
        <div className="space-y-1.5 text-left">
          <span className="text-xs font-bold text-white/40 uppercase tracking-wider block">Nivel de la lectura:</span>
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
          <span className="text-xs font-bold text-white/40 uppercase tracking-wider block">Tema:</span>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500 text-white/90 focus:outline-hidden"
          >
            {TOPICS.map((t) => (
              <option key={t.id} value={t.id} className="bg-[#0E0E11] text-white">
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2 pt-2">
          <button
            onClick={fetchPassage}
            disabled={generating}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            {generating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Generando lectura...
              </>
            ) : (
              <>
                Generar Nueva Lectura <Sparkles className="w-4 h-4 animate-bounce-subtle" />
              </>
            )}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-200 rounded-xl p-4 text-xs font-medium max-w-xl mx-auto text-left">
          {errorMsg}
        </div>
      )}

      {/* Passage */}
      {passage && (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Speed control */}
          <div className="flex items-center justify-center gap-2 bg-[#0E0E11] border border-white/10 rounded-2xl p-2 max-w-xs mx-auto">
            <Gauge className="w-4 h-4 text-white/40 ml-2" />
            {SPEEDS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSpeed(s.value)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  speed === s.value
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-white/50 hover:bg-white/5"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0E0E11] border border-white/10 rounded-3xl p-6 md:p-8 shadow-lg shadow-black/30 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-serif italic text-white">{passage.title}</h2>
              <span className="text-[10px] font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-md uppercase tracking-wider shrink-0 ml-3">
                {passage.level === "Beginner" ? "Básico" : passage.level === "Intermediate" ? "Medio" : "Avanzado"}
              </span>
            </div>

            <div className="space-y-4">
              {passage.sentences.map((s, idx) => (
                <div
                  key={idx}
                  className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-start gap-3 hover:border-indigo-500/20 transition"
                >
                  <button
                    onClick={() => playSentence(idx, s.text)}
                    disabled={playingIndex !== null || loadingAudioIndex !== null}
                    className={`p-2.5 rounded-full shrink-0 transition cursor-pointer ${
                      playingIndex === idx
                        ? "bg-indigo-500/20 text-indigo-300 ring-2 ring-indigo-500/30"
                        : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20"
                    }`}
                  >
                    {loadingAudioIndex === idx ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : playingIndex === idx ? (
                      <Volume2 className="w-4 h-4 animate-bounce" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>

                  <div className="space-y-1 flex-1">
                    <p className="text-white font-medium text-sm leading-relaxed">{s.text}</p>
                    <p className="text-yellow-400 font-mono text-xs">/{s.phonetic}/</p>
                    <p className="text-white/40 text-xs italic">{s.translation}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={markAsRead}
              disabled={xpAwarded}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs transition shadow-md shadow-emerald-600/15 cursor-pointer"
            >
              {xpAwarded ? "✓ Lectura Completada (+20 XP otorgados)" : "Marcar como Leída (+20 XP)"}
            </button>
          </motion.div>
        </div>
      )}

      {!passage && !generating && (
        <div className="max-w-md mx-auto border border-dashed border-white/10 rounded-3xl p-10 text-center space-y-4 bg-[#0E0E11]">
          <BookOpenText className="w-12 h-12 text-white/20 mx-auto" />
          <div className="space-y-1">
            <h4 className="font-bold text-white text-sm">Aún no has generado ninguna lectura</h4>
            <p className="text-xs text-white/40">Escoge nivel y tema arriba, y genera tu primera lectura graduada.</p>
          </div>
        </div>
      )}
    </div>
  );
}
