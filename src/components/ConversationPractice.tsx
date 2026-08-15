import React, { useState, useEffect, useRef } from "react";
import { DEFAULT_SCENARIOS } from "../data";
import { Scenario, ChatMessage } from "../types";
import { Send, Volume2, Mic, MicOff, RefreshCw, MessageCircle, AlertCircle, Eye, EyeOff, Check, Sparkles, BookOpen, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";

interface ConversationPracticeProps {
  onAddXp: (xp: number) => void;
  onIncrementConversations: () => void;
  onCheckBadges: () => void;
  onScenarioResult: (scenarioId: string, hadGrammarError: boolean) => void;
}

const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;

export default function ConversationPractice({ onAddXp, onIncrementConversations, onCheckBadges, onScenarioResult }: ConversationPracticeProps) {
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [level, setLevel] = useState<"Beginner" | "Intermediate" | "Advanced">("Intermediate");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");

  // Dificultad adaptativa (input comprensible, i+1 de Krashen): en vez de un nivel fijo
  // elegido una vez, seguimos la tasa de error gramatical de los últimos intercambios y
  // subimos/bajamos el nivel de Emily automáticamente para mantenerte en la "zona 80-90%
  // comprensible" — ni tan fácil que aburra, ni tan difícil que frustre.
  const [autoLevel, setAutoLevel] = useState(true);
  const [errorHistory, setErrorHistory] = useState<boolean[]>([]);
  const [levelChangeNotice, setLevelChangeNotice] = useState<string | null>(null);

  // Audio state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [ttsLoading, setTtsLoading] = useState<string | null>(null);

  // Speech input state
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [isMicSupported, setIsMicSupported] = useState(true);

  // General States
  const [chatLoading, setChatLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showTranslations, setShowTranslations] = useState<{ [id: string]: boolean }>({});

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize Speech Recognition
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
    };

    rec.onerror = (event: any) => {
      console.error("Mic error:", event.error);
      setIsRecording(false);
      setErrorMsg("Error de micrófono. Por favor comprueba los permisos del navegador.");
    };

    rec.onend = () => {
      setIsRecording(false);
    };

    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
    };

    setRecognition(rec);
  }, []);

  // Scroll to bottom of chat automatically
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  // Auto-descarta el aviso de cambio de nivel después de unos segundos
  useEffect(() => {
    if (!levelChangeNotice) return;
    const timer = setTimeout(() => setLevelChangeNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [levelChangeNotice]);

  // Start Scenario and boot Emily's first message
  const startScenario = async (scenario: Scenario) => {
    setSelectedScenario(scenario);
    setMessages([]);
    setErrorMsg("");
    setChatLoading(true);

    try {
      // Establish initial welcoming message based on the scenario
      const initialMessageText = `Hi! I am Emily, your tutor. Let's start our simulation: ${scenario.title}. I am ready. What would you like to say or order first?`;

      const firstEmilyMessage: ChatMessage = {
        id: "emily_init_" + Date.now(),
        role: "model",
        content: initialMessageText,
        translation: `¡Hola! Soy Emily, tu tutora. Comencemos nuestra simulación: ${scenario.title}. Estoy lista. ¿Qué te gustaría decir o pedir primero?`,
        suggestions: [
          scenario.id === "coffeeshop" ? "Hello! I'd like to order a large latte, please." :
          scenario.id === "hotelcheckin" ? "Hi there, I have a room reservation under the name Lopez." :
          scenario.id === "jobinterview" ? "Hello! Thank you for having me. I am very excited for this interview." :
          "Hello! Let's practice.",
          scenario.id === "coffeeshop" ? "Hi, what are your specials today?" : "Excuse me, could you help me, please?"
        ],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages([firstEmilyMessage]);
      onIncrementConversations();
      onCheckBadges();
    } catch (err: any) {
      setErrorMsg("Error al iniciar el escenario.");
    } finally {
      setChatLoading(false);
    }
  };

  // Speak message via Gemini TTS
  const playMessageAudio = async (messageId: string, textToSpeak: string) => {
    if (ttsLoading || playingId) return;
    setTtsLoading(messageId);
    setErrorMsg("");

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSpeak, voiceName: "Kore" }), // tutoring female voice
      });

      if (!res.ok) {
        throw new Error("No se pudo sintetizar la voz.");
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

      setPlayingId(messageId);
      source.start(0);
      source.onended = () => {
        setPlayingId(null);
      };
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Error de voz: " + err.message);
    } finally {
      setTtsLoading(null);
    }
  };

  // Toggle record User voice
  const toggleRecording = () => {
    if (isRecording) {
      recognition?.stop();
    } else {
      setErrorMsg("");
      try {
        recognition?.start();
      } catch (err) {
        console.error("Mic start failed", err);
      }
    }
  };

  // Submit User Message to backend for Emily response + Grammar feedback
  const sendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || chatLoading) return;

    const userMessage: ChatMessage = {
      id: "user_" + Date.now(),
      role: "user",
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputText("");
    setChatLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/tutor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          scenarioContext: selectedScenario?.context,
          userEnglishLevel: level
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Emily no pudo responder.");
      }

      const data = await res.json();

      const emilyMessage: ChatMessage = {
        id: "emily_" + Date.now(),
        role: "model",
        content: data.reply,
        translation: data.translation,
        feedback: data.grammarFeedback,
        suggestions: data.suggestions,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, emilyMessage]);
      if (selectedScenario) {
        onScenarioResult(selectedScenario.id, !!data.grammarFeedback);
      }

      // Dificultad adaptativa: evalúa los últimos 5 intercambios. Pocos errores → sube el
      // nivel (más reto); muchos errores → baja el nivel (más comprensible). Ventana corta
      // a propósito para reaccionar rápido dentro de una misma conversación.
      if (autoLevel) {
        const updatedHistory = [...errorHistory, !!data.grammarFeedback].slice(-5);
        setErrorHistory(updatedHistory);

        if (updatedHistory.length >= 3) {
          const errorRate = updatedHistory.filter(Boolean).length / updatedHistory.length;
          const currentIdx = LEVELS.indexOf(level);

          if (errorRate <= 0.2 && currentIdx < LEVELS.length - 1) {
            const nextLevel = LEVELS[currentIdx + 1];
            setLevel(nextLevel);
            setErrorHistory([]);
            setLevelChangeNotice(`⬆️ Nivel subido a ${nextLevel === "Intermediate" ? "Medio" : "Avanzado"} — vas muy bien.`);
          } else if (errorRate >= 0.6 && currentIdx > 0) {
            const nextLevel = LEVELS[currentIdx - 1];
            setLevel(nextLevel);
            setErrorHistory([]);
            setLevelChangeNotice(`⬇️ Nivel bajado a ${nextLevel === "Beginner" ? "Básico" : "Medio"} — para que sigas entendiendo sin frustrarte.`);
          }
        }
      }

      onAddXp(20); // Reward active dialogue practice!
      onIncrementConversations();
      onCheckBadges();

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error al conectar con Emily. Comprueba los secretos de API.");
    } finally {
      setChatLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  const toggleTranslation = (id: string) => {
    setShowTranslations(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="conversation-practice">

      {/* Scenario Picker Screen */}
      {!selectedScenario ? (
        <div className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h1 className="text-2xl md:text-3xl font-serif italic text-white flex items-center justify-center gap-2">
              <MessageCircle className="w-8 h-8 text-indigo-400" /> Conversaciones con Emily
            </h1>
            <p className="text-sm text-white/60">
              Escoge un escenario de juego de rol y conversa por chat dictando con tu voz o escribiendo. ¡La IA corregirá tus errores gramaticales en el camino!
            </p>
          </div>

          {/* Level settings */}
          <div className="bg-[#0E0E11] border border-white/10 rounded-3xl p-5 max-w-lg mx-auto space-y-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                <BookOpen className="w-4.5 h-4.5 text-indigo-400" /> Nivel de inglés de Emily:
              </span>
              <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1 w-full max-w-xs">
                {(["Beginner", "Intermediate", "Advanced"] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => {
                      setLevel(lvl);
                      setAutoLevel(false);
                    }}
                    disabled={autoLevel}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
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
            <button
              onClick={() => setAutoLevel(!autoLevel)}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                autoLevel
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
                  : "bg-white/5 border border-white/10 text-white/40 hover:text-white/70"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Dificultad Adaptativa {autoLevel ? "ACTIVADA (recomendado)" : "desactivada"}
            </button>
            {autoLevel && (
              <p className="text-[10px] text-white/30 text-center leading-relaxed">
                Emily ajustará su nivel sola según qué tan bien te va, para mantenerte siempre en el punto justo de reto.
              </p>
            )}
          </div>

          {/* Scenarios List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto" id="scenarios-grid">
            {DEFAULT_SCENARIOS.map((scenario) => (
              <div
                key={scenario.id}
                className="bg-[#0E0E11] border border-white/10 hover:border-white/20 hover:shadow-lg hover:shadow-indigo-500/5 transition duration-300 rounded-3xl p-6 flex flex-col justify-between space-y-4 text-left"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-3xl p-2.5 bg-white/5 rounded-2xl block">{scenario.emoji}</span>
                    <span className="text-[10px] font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                      {scenario.level}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mt-2">{scenario.title}</h3>
                  <p className="text-xs text-white/60 leading-relaxed">{scenario.description}</p>
                </div>

                <button
                  onClick={() => startScenario(scenario)}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-1 shadow-md shadow-indigo-600/15 cursor-pointer"
                >
                  Iniciar Simulación <Sparkles className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Conversation Simulator Workspace */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch" id="chat-workspace">

          {/* Side panel with scenario details & Emily details */}
          <div className="lg:col-span-1 bg-[#0E0E11] border border-white/10 rounded-3xl p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              <button
                onClick={() => setSelectedScenario(null)}
                className="text-xs text-indigo-300 font-bold hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Cambiar escenario
              </button>

              <div className="border-b border-white/5 pb-5 space-y-2">
                <span className="text-3xl p-2 bg-white/5 rounded-xl inline-block">{selectedScenario.emoji}</span>
                <h3 className="font-bold text-white text-base">{selectedScenario.title}</h3>
                <p className="text-xs text-white/60 leading-relaxed">{selectedScenario.description}</p>
              </div>

              {/* Emily profile */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider">Tu tutora virtual:</h4>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white font-bold text-lg border-2 border-[#0E0E11] shadow-md">
                      👩‍🏫
                    </div>
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#0E0E11] rounded-full"></span>
                  </div>
                  <div>
                    <h5 className="font-bold text-sm text-white">Emily (IA Coach)</h5>
                    <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">En Línea</span>
                  </div>
                </div>
                <p className="text-[11px] text-white/60 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
                  Emily habla solo inglés para forzar tu inmersión. Puedes hacer clic en sus globos para ver la traducción al español.
                </p>
              </div>
            </div>

            {/* General help tip */}
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 text-[11px] text-indigo-200 shadow-xs">
              <p className="font-bold mb-1 flex items-center gap-1 text-indigo-300">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin-slow" /> ¿Sin ideas para responder?
              </p>
              Utiliza los globos de sugerencia rápidos al pie del chat para ayudarte a formular respuestas gramaticalmente correctas en un clic.
            </div>
          </div>

          {/* Chat Pane */}
          <div className="lg:col-span-3 bg-[#0E0E11] border border-white/10 rounded-3xl flex flex-col h-[600px] overflow-hidden shadow-lg shadow-black/20">

            {/* Top Bar inside Chat */}
            <div className="bg-white/5 border-b border-white/10 px-6 py-3 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
                <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Sesión de Conversación Real</span>
              </div>
              <span className="text-xs font-bold text-white/40 flex items-center gap-1.5">
                Nivel Emily: {level === "Beginner" ? "Básico" : level === "Intermediate" ? "Medio" : "Avanzado"}
                {autoLevel && <Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
              </span>
            </div>

            {/* Notificación de ajuste automático de nivel */}
            {levelChangeNotice && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-200 text-xs px-6 py-2.5 font-semibold shrink-0"
              >
                {levelChangeNotice}
              </motion.div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="bg-rose-500/10 border-b border-rose-500/20 text-rose-200 text-xs p-3 flex gap-2 font-medium shrink-0">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6" id="chat-messages-area">
              {messages.map((msg) => {
                const isUser = msg.role === "user";
                const showTranslate = showTranslations[msg.id];

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-2`}
                  >
                    <div className={`flex items-start gap-2.5 max-w-[80%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                      {/* Avatar inside bubble */}
                      <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-sm shadow-xs ${
                        isUser ? "bg-indigo-600 text-white" : "bg-white/10 text-white border border-white/10"
                      }`}>
                        {isUser ? "👨‍🎓" : "Emily"}
                      </div>

                      {/* Main Message Bubble */}
                      <div className="space-y-1.5">
                        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed relative ${
                          isUser
                            ? "bg-indigo-600 text-white shadow-lg rounded-tr-none shadow-indigo-600/30"
                            : "bg-white/5 text-white border border-white/10 rounded-tl-none shadow-xs"
                        }`}>

                          <p className="font-medium whitespace-pre-line">{msg.content}</p>

                          {/* Translated text overlay */}
                          {showTranslate && msg.translation && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              className="mt-2.5 pt-2.5 border-t border-white/10 text-xs text-indigo-300 italic font-medium"
                            >
                              {msg.translation}
                            </motion.div>
                          )}

                          {/* Message Footer Actions */}
                          {!isUser && (
                            <div className="mt-2.5 flex items-center gap-3 border-t border-white/10 pt-2 shrink-0">
                              <button
                                onClick={() => playMessageAudio(msg.id, msg.content)}
                                disabled={ttsLoading === msg.id}
                                className={`text-[10px] font-bold flex items-center gap-1 px-1.5 py-0.5 rounded transition cursor-pointer ${
                                  playingId === msg.id
                                    ? "bg-indigo-500/20 text-indigo-300 font-bold"
                                    : "text-white/40 hover:text-white hover:bg-white/5"
                                }`}
                              >
                                {ttsLoading === msg.id ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Volume2 className="w-3 h-3" />
                                )}
                                {playingId === msg.id ? "Hablando..." : "Escuchar"}
                              </button>

                              {msg.translation && (
                                <button
                                  onClick={() => toggleTranslation(msg.id)}
                                  className="text-[10px] text-white/40 hover:text-white hover:bg-white/5 font-bold flex items-center gap-1 px-1.5 py-0.5 rounded cursor-pointer"
                                >
                                  {showTranslate ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  {showTranslate ? "Ocultar" : "Traducir"}
                                </button>
                              )}
                            </div>
                          )}

                        </div>

                        {/* Grammar feedback inside model response */}
                        {!isUser && msg.feedback && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-xs space-y-2 text-amber-200 shadow-md max-w-md"
                          >
                            <span className="inline-flex items-center gap-1 font-bold text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Emily Corrigió Tu Gramática:
                            </span>
                            <div className="space-y-1">
                              <p className="line-through text-white/40">Tú dijiste: "{msg.feedback.original}"</p>
                              <p className="font-bold text-emerald-400">Forma correcta: "{msg.feedback.corrected}"</p>
                              <p className="text-white/70 mt-1.5 leading-relaxed">{msg.feedback.explanation}</p>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Chat loading state */}
              {chatLoading && (
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm border border-white/10 text-white">
                    👩‍🏫
                  </div>
                  <div className="bg-white/5 border border-white/10 text-white/60 rounded-2xl rounded-tl-none px-4 py-3 text-xs font-medium flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" /> Emily está pensando su respuesta...
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Floating Suggestions area */}
            {messages.length > 0 && messages[messages.length - 1]?.role === "model" && messages[messages.length - 1]?.suggestions && (
              <div className="bg-[#0E0E11] border-t border-white/10 px-6 py-3 flex flex-col gap-2 shrink-0">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Sugerencias Rápidas para responder:</span>
                <div className="flex flex-wrap gap-2">
                  {messages[messages.length - 1].suggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(sug)}
                      className="px-3 py-1.5 rounded-xl border border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/20 hover:border-indigo-500/30 text-xs font-semibold text-indigo-200 transition text-left cursor-pointer"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat Input Bar */}
            <div className="bg-[#0E0E11] border-t border-white/10 p-4 flex gap-3 items-center shrink-0">

              {/* Mic dictation */}
              {isMicSupported && (
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`p-3.5 rounded-full transition duration-300 relative cursor-pointer ${
                    isRecording
                      ? "bg-rose-500 text-white ring-4 ring-rose-200 animate-pulse"
                      : "bg-white/5 hover:bg-white/10 text-white/60 border border-white/10"
                  }`}
                  title={isRecording ? "Detener grabación" : "Grabar voz en inglés"}
                >
                  {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
              )}

              {/* Text Input */}
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage(inputText);
                }}
                disabled={chatLoading}
                placeholder={isRecording ? "Escuchando... ¡Habla ahora en inglés!" : "Escribe tu respuesta en inglés aquí..."}
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-white placeholder-white/30 disabled:opacity-50"
              />

              {/* Submit Button */}
              <button
                type="button"
                onClick={() => sendMessage(inputText)}
                disabled={chatLoading || !inputText.trim()}
                className="p-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white rounded-full transition shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                <Send className="w-5 h-5" />
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
