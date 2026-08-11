import React, { useState, useEffect, useRef } from "react";
import { DEFAULT_PHRASES } from "../data";
import { PracticePhrase, PronunciationResult } from "../types";
import { Play, Volume2, Mic, MicOff, RefreshCw, Check, AlertCircle, HelpCircle, Sparkles, Plus, Award, Ear, Repeat } from "lucide-react";
import { motion } from "motion/react";
import MinimalPairsDrill from "./MinimalPairsDrill";

interface PronunciationPracticeProps {
  onAddXp: (xp: number) => void;
  onIncrementPronunciations: () => void;
  onCheckBadges: () => void;
  onPhonemeResult: (phonemeTag: string, success: boolean) => void;
}

export default function PronunciationPractice({ onAddXp, onIncrementPronunciations, onCheckBadges, onPhonemeResult }: PronunciationPracticeProps) {
  const [mode, setMode] = useState<"phrases" | "minimalPairs">("phrases");
  // Modo Shadowing: en vez de escuchar y luego decidir cuándo grabar, al tocar el micrófono
  // primero se reproduce el audio nativo y automáticamente empieza la grabación justo después,
  // forzando repetición casi simultánea (shadowing) en lugar de traducir/pensar primero.
  const [shadowingMode, setShadowingMode] = useState(false);
  const [phrases, setPhrases] = useState<PracticePhrase[]>(DEFAULT_PHRASES);
  const [selectedPhrase, setSelectedPhrase] = useState<PracticePhrase>(DEFAULT_PHRASES[0]);
  const [customText, setCustomText] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  // TTS State
  const [isPlayingTts, setIsPlayingTts] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [isMicSupported, setIsMicSupported] = useState(true);
  const [recognition, setRecognition] = useState<any>(null);

  // Analysis State
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [selectedWordTip, setSelectedWordTip] = useState<{ word: string; tip: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsMicSupported(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.lang = "en-US";
    rec.interimResults = false;

    rec.onstart = () => {
      setIsRecording(true);
      setErrorMsg("");
      setSpokenText("Escuchando... ¡Habla ahora en inglés!");
    };

    rec.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
      if (event.error === "not-allowed") {
        setErrorMsg("Permiso de micrófono denegado. Por favor, habilítalo en la barra de direcciones.");
      } else {
        setErrorMsg(`Error de reconocimiento: ${event.error}. Intenta de nuevo.`);
      }
      setSpokenText("");
    };

    rec.onend = () => {
      setIsRecording(false);
    };

    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSpokenText(transcript);
    };

    setRecognition(rec);
  }, []);

  // Handle Play TTS. Devuelve una Promise que resuelve cuando termina de reproducirse,
  // para poder encadenar "reproducir y luego grabar" en el modo Shadowing.
  const playPhraseAudio = async (textToSpeak: string): Promise<void> => {
    if (ttsLoading || isPlayingTts) return;
    setTtsLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSpeak, voiceName: "Kore" }), // standard female voice
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "No se pudo sintetizar la voz.");
      }

      const data = await res.json();
      const audioBytes = atob(data.audioBase64);
      const arrayBuffer = new ArrayBuffer(audioBytes.length);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < audioBytes.length; i++) {
        view[i] = audioBytes.charCodeAt(i);
      }

      const blob = new Blob([arrayBuffer], { type: "audio/pcm" });

      // Since it is 24kHz raw PCM, we play it beautifully using AudioContext
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buffer = audioCtx.createBuffer(1, view.length / 2, 24000);
      const channelData = buffer.getChannelData(0);

      // Convert 16-bit PCM bytes to Float32 AudioBuffer
      const dataView = new DataView(arrayBuffer);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = dataView.getInt16(i * 2, true) / 32768.0;
      }

      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);

      setIsPlayingTts(true);
      source.start(0);
      await new Promise<void>((resolve) => {
        source.onended = () => {
          setIsPlayingTts(false);
          resolve();
        };
      });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error al reproducir audio de IA.");
    } finally {
      setTtsLoading(false);
    }
  };

  // Start / Stop voice recording
  const toggleRecording = () => {
    if (isRecording) {
      recognition?.stop();
    } else {
      setSelectedWordTip(null);
      setSpokenText("");
      setResult(null);
      setErrorMsg("");
      try {
        recognition?.start();
      } catch (err) {
        console.error("No se pudo iniciar grabación:", err);
      }
    }
  };

  // Flujo de Shadowing: reproduce la frase nativa y, apenas termina, empieza a grabar
  // automáticamente — fuerza repetir casi de inmediato en vez de traducir mentalmente primero,
  // que es el mecanismo por el que el shadowing mejora fluidez y prosodia (revisión sistemática
  // 2025 sobre shadowing en pronunciación L2).
  const startShadowingFlow = async () => {
    setSelectedWordTip(null);
    setSpokenText("");
    setResult(null);
    setErrorMsg("");
    await playPhraseAudio(selectedPhrase.phrase);
    try {
      recognition?.start();
    } catch (err) {
      console.error("No se pudo iniciar grabación tras shadowing:", err);
    }
  };

  // Analyze Speech via Gemini
  const analyzeSpeech = async () => {
    if (!spokenText || spokenText.startsWith("Escuchando") || analyzing) return;
    setAnalyzing(true);
    setErrorMsg("");
    setSelectedWordTip(null);

    const textToMatch = showCustomInput ? customText : selectedPhrase.phrase;

    try {
      const res = await fetch("/api/pronunciation/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetPhrase: textToMatch,
          spokenText: spokenText
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al analizar la pronunciación.");
      }

      const data: PronunciationResult = await res.json();
      setResult(data);

      // Alimenta el modelo de dominio por fonema (ver lib/mastery.ts) con cada palabra que
      // tuvo un sonido identificado, sea correcto o no.
      data.words.forEach((w) => {
        if (w.phonemeTag) {
          onPhonemeResult(w.phonemeTag, w.status === "correct");
        }
      });

      // Reward XP based on score!
      const xpReward = Math.max(10, Math.round(data.score / 5)); // e.g. 95 score = 19 XP
      onAddXp(xpReward);
      onIncrementPronunciations();
      onCheckBadges();

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error de comunicación con el analizador de voz.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Switch phrases
  const selectPhraseItem = (phrase: PracticePhrase) => {
    setSelectedPhrase(phrase);
    setSpokenText("");
    setResult(null);
    setSelectedWordTip(null);
    setErrorMsg("");
  };

  // Handle custom phrase additions
  const handleAddCustomPhrase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim()) return;

    const newPhrase: PracticePhrase = {
      id: "custom_" + Date.now(),
      phrase: customText.trim(),
      translation: "Frase personalizada cargada por ti",
      topic: "Personalizado ✨",
      difficulty: "Intermediate"
    };

    setPhrases([newPhrase, ...phrases]);
    setSelectedPhrase(newPhrase);
    setShowCustomInput(false);
    setSpokenText("");
    setResult(null);
    setErrorMsg("");
  };

  return (
    <div className="space-y-8" id="pronunciation-page">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif italic text-white/95 flex items-center gap-2">
            <Mic className="w-7 h-7 text-indigo-400" /> Laboratorio de Pronunciación
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Escucha nativos de IA, graba tu voz y recibe corrección fonética en tiempo real.
          </p>
        </div>
        {mode === "phrases" && (
          <button
            onClick={() => setShowCustomInput(!showCustomInput)}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition self-start md:self-auto cursor-pointer"
          >
            <Plus className="w-4 h-4" /> {showCustomInput ? "Ver predefinidos" : "Crear frase personalizada"}
          </button>
        )}
      </div>

      {/* Mode switcher: frases guiadas (habla) vs pares mínimos (oído) */}
      <div className="flex bg-[#0E0E11] border border-white/10 rounded-2xl p-1 gap-1 max-w-md mx-auto">
        <button
          onClick={() => setMode("phrases")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            mode === "phrases" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-white/60 hover:bg-white/5"
          }`}
        >
          <Mic className="w-4 h-4" /> Frases y Shadowing
        </button>
        <button
          onClick={() => setMode("minimalPairs")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            mode === "minimalPairs" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-white/60 hover:bg-white/5"
          }`}
        >
          <Ear className="w-4 h-4" /> Pares Mínimos (Oído)
        </button>
      </div>

      {mode === "minimalPairs" && (
        <MinimalPairsDrill onAddXp={onAddXp} onPhonemeResult={onPhonemeResult} />
      )}

      {mode === "phrases" && (
        <>
      {/* Custom Phrase Form */}
      {showCustomInput && (
        <motion.form
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleAddCustomPhrase}
          className="bg-[#0E0E11] border border-white/10 rounded-2xl p-4 flex gap-3"
        >
          <input
            type="text"
            required
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Escribe cualquier frase en inglés que quieras practicar (ej. 'An apple a day keeps the doctor away.')"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-white/30 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
          >
            Listo <Check className="w-3.5 h-3.5" />
          </button>
        </motion.form>
      )}

      {/* Main Grid: Selector vs Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left: Interactive Phrase Selector */}
        <div className="space-y-4">
          <h3 className="font-serif italic text-white/40 text-sm uppercase tracking-wider">Frases para practicar</h3>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2" id="phrase-list">
            {phrases.map((p) => {
              const isSelected = selectedPhrase.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => selectPhraseItem(p)}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition duration-200 ${
                    isSelected
                      ? "bg-indigo-500/10 border-indigo-500/30 ring-1 ring-indigo-500/20"
                      : "bg-[#0E0E11]/50 border-white/5 hover:border-white/10 text-white/80"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-md">
                      {p.topic}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase ${
                      p.difficulty === "Beginner" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                      p.difficulty === "Intermediate" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                    }`}>
                      {p.difficulty === "Beginner" ? "Fácil" : p.difficulty === "Intermediate" ? "Intermedio" : "Avanzado"}
                    </span>
                  </div>
                  <p className="font-semibold text-white text-sm mt-2 line-clamp-2">
                    {p.phrase}
                  </p>
                  <p className="text-xs text-white/40 mt-1 line-clamp-1 italic">
                    {p.translation}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Speaking Studio */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#0E0E11] border border-white/10 rounded-3xl p-6 md:p-8 shadow-lg shadow-black/30 space-y-6">

            {/* Target Card */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-6 text-center space-y-4 relative overflow-hidden">
              <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-3 py-1 rounded-full uppercase tracking-wider">
                Frase Objetivo (Escucha y Repite)
              </span>
              <h2 className="text-xl md:text-2xl font-serif italic text-white tracking-tight leading-relaxed select-all">
                "{selectedPhrase.phrase}"
              </h2>
              <p className="text-sm text-white/60 italic">
                {selectedPhrase.translation}
              </p>

              {/* TTS Action */}
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => playPhraseAudio(selectedPhrase.phrase)}
                  disabled={ttsLoading}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    isPlayingTts
                      ? "bg-indigo-500/20 text-indigo-300 ring-2 ring-indigo-500/30"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                  }`}
                >
                  {ttsLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Sintetizando...
                    </>
                  ) : isPlayingTts ? (
                    <>
                      <Volume2 className="w-4 h-4 animate-bounce" /> Reproduciendo voz de IA
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" /> Escuchar Pronunciación
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-200 rounded-xl p-4 flex gap-2.5 text-xs font-medium">
                <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0 mt-0.5" />
                <p>{errorMsg}</p>
              </div>
            )}

            {/* Mic Recording Panel */}
            <div className="space-y-4 text-center">
              {isMicSupported && (
                <button
                  onClick={() => setShadowingMode(!shadowingMode)}
                  className={`mx-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${
                    shadowingMode
                      ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                      : "bg-white/5 border border-white/10 text-white/40 hover:text-white/70"
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" /> Modo Shadowing {shadowingMode ? "ACTIVADO" : "desactivado"}
                </button>
              )}
              {shadowingMode && (
                <p className="text-[11px] text-emerald-200/70 max-w-xs mx-auto leading-relaxed">
                  Al tocar el micrófono, primero escucharás la frase nativa y la grabación empezará
                  automáticamente al terminar — repite de inmediato, sin pensar la traducción.
                </p>
              )}
              {!isMicSupported ? (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-200 flex flex-col items-center gap-2">
                  <p className="font-semibold text-white">Reconocimiento de voz no soportado directamente en este navegador.</p>
                  <p className="text-white/60">Por favor, escribe lo que pronunciaste abajo para simular y analizar mediante Gemini, o utiliza un navegador moderno como Google Chrome o Apple Safari.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={shadowingMode && !isRecording ? startShadowingFlow : toggleRecording}
                    className={`p-6 rounded-full shadow-xl transition duration-300 relative cursor-pointer ${
                      isRecording
                        ? "bg-rose-500 text-white ring-4 ring-rose-500/20 animate-pulse"
                        : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30"
                    }`}
                  >
                    {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                    {isRecording && (
                      <span className="absolute inset-0 rounded-full border-4 border-rose-500 animate-ping opacity-75"></span>
                    )}
                  </motion.button>
                  <span className="text-xs font-bold text-white/50 uppercase tracking-wide">
                    {isRecording ? "¡Habla Ahora!" : "Haz clic para grabar tu voz"}
                  </span>
                </div>
              )}

              {/* Transcription Area */}
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-bold text-white/40 uppercase tracking-wider block">Tu transcripción de voz:</label>
                <div className="relative">
                  <textarea
                    rows={2}
                    value={spokenText}
                    onChange={(e) => setSpokenText(e.target.value)}
                    placeholder={isMicSupported ? "Tu pronunciación aparecerá aquí cuando hables..." : "Escribe aquí la frase que pronunciaste en inglés..."}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-white"
                  />
                  {spokenText && !isRecording && (
                    <button
                      onClick={() => setSpokenText("")}
                      className="absolute right-3 top-3 text-[10px] bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-white/70 font-semibold"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>

              {/* Analyze Trigger */}
              {spokenText && !isRecording && !spokenText.startsWith("Escuchando") && (
                <button
                  onClick={analyzeSpeech}
                  disabled={analyzing}
                  className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  {analyzing ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" /> Analizando tu fonética con Inteligencia Artificial...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" /> Evaluar Mi Pronunciación de Verdad
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Analysis Results Display */}
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="pt-6 border-t border-white/10 space-y-6"
                id="analysis-results"
              >
                {/* Visual score circles */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Total score */}
                  <div className="bg-indigo-500/10 rounded-2xl p-4 text-center border border-indigo-500/20">
                    <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">Pronunciación</span>
                    <h3 className={`text-3xl font-extrabold mt-1.5 ${
                      result.score >= 90 ? "text-emerald-400" : result.score >= 75 ? "text-amber-400" : "text-rose-400"
                    }`}>{result.score}%</h3>
                    <span className="text-[9px] text-white/40 font-medium">Nota General</span>
                  </div>

                  {/* Accuracy */}
                  <div className="bg-emerald-500/10 rounded-2xl p-4 text-center border border-emerald-500/20">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Precisión</span>
                    <h3 className="text-3xl font-extrabold text-emerald-400 mt-1.5">{result.accuracy}%</h3>
                    <span className="text-[9px] text-white/40 font-medium">Léxico Correcto</span>
                  </div>

                  {/* Fluency */}
                  <div className="bg-purple-500/10 rounded-2xl p-4 text-center border border-purple-500/20">
                    <span className="text-[10px] uppercase font-bold text-purple-300 tracking-wider">Fluidez</span>
                    <h3 className="text-3xl font-extrabold text-purple-400 mt-1.5">{result.fluency}%</h3>
                    <span className="text-[9px] text-white/40 font-medium">Ritmo y Enlace</span>
                  </div>
                </div>

                {/* Interactive Word Highlighting */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-white/40 uppercase tracking-wider block mb-1">
                      Análisis de Palabras (Toca una palabra pintada para ver consejos fonéticos):
                    </label>
                    <div className="flex flex-wrap gap-2 p-4 bg-white/5 border border-white/5 rounded-2xl leading-loose">
                      {result.words.map((w, idx) => {
                        let colorClass = "bg-emerald-500/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30";
                        if (w.status === "warning") {
                          colorClass = "bg-amber-500/20 border-amber-500/30 text-amber-300 hover:bg-amber-500/30";
                        } else if (w.status === "error") {
                          colorClass = "bg-rose-500/20 border-rose-500/30 text-rose-300 hover:bg-rose-500/30";
                        }

                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              if (w.phoneticTip) {
                                setSelectedWordTip({ word: w.word, tip: w.phoneticTip });
                              } else {
                                setSelectedWordTip({ word: w.word, tip: "¡Excelente pronunciación! Sigue así." });
                              }
                            }}
                            className={`px-2.5 py-1 rounded-md text-sm font-bold border transition cursor-pointer flex items-center gap-1 ${colorClass}`}
                          >
                            {w.word}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Phonetic Tip Popover block */}
                  {selectedWordTip && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex gap-3 text-xs text-indigo-200 shadow-sm"
                    >
                      <HelpCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-sm text-indigo-300 mb-0.5">Consejo para "{selectedWordTip.word}":</p>
                        <p className="leading-relaxed text-indigo-200/80">{selectedWordTip.tip}</p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* General coaching tip */}
                <div className="p-5 bg-gradient-to-r from-indigo-950 to-slate-900 border border-white/10 text-white rounded-2xl flex gap-4 items-start shadow-xl shadow-indigo-500/5">
                  <div className="p-2.5 bg-indigo-500/20 border border-indigo-500/30 rounded-xl">
                    <Award className="w-6 h-6 text-indigo-300" />
                  </div>
                  <div>
                    <h4 className="font-serif italic text-base text-indigo-200">Feedback de Emily (IA Tutor):</h4>
                    <p className="text-xs text-white/80 leading-relaxed mt-1">{result.tip}</p>
                    <div className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 rounded-md text-indigo-300">
                      <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-spin-slow" /> ¡Has ganado XP por practicar hoy!
                    </div>
                  </div>
                </div>

              </motion.div>
            )}

          </div>
        </div>

      </div>
      </>
      )}
    </div>
  );
}
