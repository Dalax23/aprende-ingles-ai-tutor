import React, { useState, useEffect } from "react";
import { UserStats, Badge } from "./types";
import { DEFAULT_BADGES } from "./data";
import Dashboard from "./components/Dashboard";
import PronunciationPractice from "./components/PronunciationPractice";
import ConversationPractice from "./components/ConversationPractice";
import VocabularyFlashcards from "./components/VocabularyFlashcards";
import { Flame, Award, BookOpen, Mic, MessageCircle, Sparkles, AlertCircle, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const LOCAL_STORAGE_KEY = "apex_english_ai_user_stats";
const MISSIONS_KEY = "apex_english_ai_claimed_missions";

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "speak" | "chat" | "vocab">("dashboard");
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(true);

  // Core Gamification State
  const [stats, setStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved stats", e);
      }
    }
    return {
      xp: 0,
      level: 1,
      streak: 1,
      dailyGoalXp: 50,
      todayXp: 0,
      lastActiveDate: new Date().toISOString().split("T")[0],
      badges: [],
      completedPronunciations: 0,
      completedConversations: 0,
      masteredWordsCount: 0
    };
  });

  const [claimedMissions, setClaimedMissions] = useState<string[]>(() => {
    const saved = localStorage.getItem(MISSIONS_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // Check health and API Key setup on backend
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        setHasApiKey(data.hasApiKey);
      } catch (err) {
        console.error("Error checking backend health:", err);
        setHasApiKey(false);
      } finally {
        setCheckingHealth(false);
      }
    };
    checkBackend();
  }, []);

  // Sync state to localstorage
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem(MISSIONS_KEY, JSON.stringify(claimedMissions));
  }, [claimedMissions]);

  // Streak verification on load
  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    if (stats.lastActiveDate !== todayStr) {
      // Check if active yesterday to maintain streak
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      setStats((prev) => {
        let newStreak = prev.streak;
        if (prev.lastActiveDate === yesterdayStr) {
          // Keep streak going
        } else if (prev.lastActiveDate !== todayStr) {
          // Streak broke, reset to 1
          newStreak = 1;
        }

        return {
          ...prev,
          lastActiveDate: todayStr,
          streak: newStreak,
          todayXp: 0 // Reset daily XP quota on new calendar day
        };
      });

      // Clear claimed daily missions on a new day
      setClaimedMissions([]);
    }
  }, []);

  // Registra el resultado de un sonido específico practicado (pronunciación de frases o pares
  // mínimos) para el modelo de dominio por fonema — ver lib/mastery.ts y Dashboard.
  const recordPhonemeResult = (phonemeTag: string, success: boolean) => {
    setStats((prev) => {
      const current = prev.phonemeMastery?.[phonemeTag] ?? { attempts: 0, successRate: 0 };
      const newAttempts = current.attempts + 1;
      // Media móvil ponderada: los intentos recientes pesan un poco más que el historial,
      // así el dominio refleja mejora reciente, no solo el promedio histórico total.
      const newSuccessRate =
        current.attempts === 0
          ? success
            ? 1
            : 0
          : current.successRate * 0.8 + (success ? 1 : 0) * 0.2;

      return {
        ...prev,
        phonemeMastery: {
          ...(prev.phonemeMastery ?? {}),
          [phonemeTag]: { attempts: newAttempts, successRate: newSuccessRate },
        },
      };
    });
  };

  // Registra si un mensaje de Emily durante un escenario incluyó corrección gramatical,
  // para el mastery por escenario de conversación (ver lib/mastery.ts).
  const recordScenarioResult = (scenarioId: string, hadGrammarError: boolean) => {
    setStats((prev) => {
      const current = prev.scenarioMastery?.[scenarioId] ?? { completions: 0, grammarErrorRate: 0 };
      const newCompletions = current.completions + 1;
      const newErrorRate =
        current.completions === 0
          ? hadGrammarError
            ? 1
            : 0
          : current.grammarErrorRate * 0.8 + (hadGrammarError ? 1 : 0) * 0.2;

      return {
        ...prev,
        scenarioMastery: {
          ...(prev.scenarioMastery ?? {}),
          [scenarioId]: { completions: newCompletions, grammarErrorRate: newErrorRate },
        },
      };
    });
  };

  // Helper to add XP and handle level-ups
  const addXp = (amount: number) => {
    setStats((prev) => {
      const updatedXp = prev.xp + amount;
      const updatedTodayXp = prev.todayXp + amount;

      // Level-up requirement formula: level * 100 XP
      const xpNeededForNext = prev.level * 100;
      let currentLevel = prev.level;
      let finalXp = updatedXp;

      if (finalXp >= xpNeededForNext) {
        currentLevel += 1;
        // Keep the level up but adjust XP
        // Or simply let them keep growing level. Let's increment level.
      }

      return {
        ...prev,
        xp: finalXp,
        level: currentLevel,
        todayXp: updatedTodayXp
      };
    });
  };

  // Autonomía (Teoría de la Autodeterminación): el usuario elige su propia meta diaria en vez
  // de que el sistema la imponga. Sentirse en control del ritmo propio sube la retención
  // (mismo mecanismo que usa Duolingo con su "meta diaria" ajustable).
  const setDailyGoalXp = (xp: number) => {
    setStats((prev) => ({ ...prev, dailyGoalXp: xp }));
  };

  // Stats increment helpers
  const incrementPronunciations = () => {
    setStats(prev => ({ ...prev, completedPronunciations: prev.completedPronunciations + 1 }));
  };

  const incrementConversations = () => {
    setStats(prev => ({ ...prev, completedConversations: prev.completedConversations + 1 }));
  };

  const incrementVocab = () => {
    setStats(prev => ({ ...prev, masteredWordsCount: prev.masteredWordsCount + 1 }));
  };

  // Badge validation logic
  const checkAndUnlockBadges = () => {
    setStats((prev) => {
      const unlockedBadges = [...prev.badges];
      let updated = false;

      // 1. First steps badge
      if (prev.completedPronunciations >= 1 && !unlockedBadges.some(b => b.id === "first_steps")) {
        const b = DEFAULT_BADGES.find(x => x.id === "first_steps");
        if (b) {
          unlockedBadges.push({ ...b, unlockedAt: new Date().toISOString() });
          updated = true;
        }
      }

      // 2. Conversationalist
      if (prev.completedConversations >= 3 && !unlockedBadges.some(b => b.id === "conversationalist")) {
        const b = DEFAULT_BADGES.find(x => x.id === "conversationalist");
        if (b) {
          unlockedBadges.push({ ...b, unlockedAt: new Date().toISOString() });
          updated = true;
        }
      }

      // 3. Vocab Master
      if (prev.masteredWordsCount >= 5 && !unlockedBadges.some(b => b.id === "vocab_master")) {
        const b = DEFAULT_BADGES.find(x => x.id === "vocab_master");
        if (b) {
          unlockedBadges.push({ ...b, unlockedAt: new Date().toISOString() });
          updated = true;
        }
      }

      // 4. Streak 3 days
      if (prev.streak >= 3 && !unlockedBadges.some(b => b.id === "streak_3")) {
        const b = DEFAULT_BADGES.find(x => x.id === "streak_3");
        if (b) {
          unlockedBadges.push({ ...b, unlockedAt: new Date().toISOString() });
          updated = true;
        }
      }

      if (updated) {
        return {
          ...prev,
          badges: unlockedBadges
        };
      }
      return prev;
    });
  };

  // Claim XP from Daily Missions panel
  const claimDailyMissionXp = (xp: number, missionId: string) => {
    if (claimedMissions.includes(missionId)) return;
    addXp(xp);
    setClaimedMissions(prev => [...prev, missionId]);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white flex flex-col font-sans selection:bg-indigo-500 selection:text-white antialiased" id="root-app">

      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-[#0E0E11]/95 backdrop-blur-md border-b border-white/10 shadow-lg shadow-black/20 px-4 md:px-8 py-3.5 flex items-center justify-between gap-4">

        {/* Brand Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab("dashboard")}>
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-xl text-white shadow-md shadow-indigo-600/20">A</div>
          <span className="text-xl font-semibold tracking-tight font-serif italic text-white">Apex English <span className="text-indigo-400 not-italic font-light">Pro</span></span>
        </div>

        {/* Global Progress Indicators */}
        <div className="flex items-center gap-3">
          {/* Level Tracker */}
          <div className="hidden sm:flex items-center gap-1 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-xs font-bold text-indigo-300">
            <Award className="w-4 h-4 text-indigo-400" /> Nivel {stats.level}
          </div>

          {/* Streak Indicator */}
          <div className="flex items-center gap-1 bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 rounded-full text-xs font-bold text-orange-400">
            <Flame className="w-4 h-4 animate-bounce-subtle" /> {stats.streak} {stats.streak === 1 ? "Día" : "Días"}
          </div>

          {/* XP Badge */}
          <div className="bg-indigo-600 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg shadow-indigo-600/30">
            {stats.xp} XP
          </div>
        </div>

      </header>

      {/* Main Body Layout */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6">

        {/* API Key Missing Alert Banner */}
        {!checkingHealth && hasApiKey === false && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-200 rounded-3xl p-6 text-left flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg shadow-rose-500/5 animate-pulse">
            <div className="flex items-start gap-4">
              <span className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl block shrink-0 mt-0.5">
                <AlertCircle className="w-6 h-6" />
              </span>
              <div className="space-y-1">
                <h4 className="font-bold text-sm md:text-base text-white">Se requiere configurar la clave API de Gemini</h4>
                <p className="text-xs text-rose-300/80 max-w-2xl leading-relaxed">
                  Para habilitar la inteligencia artificial de pronunciación, la tutora de inglés Emily, y la generación de vocabulario interactivo, necesitas agregar tu clave API como <code>GEMINI_API_KEY</code> en las variables de entorno.
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <span className="px-3.5 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold inline-block">
                Configuración Requerida
              </span>
            </div>
          </div>
        )}

        {/* API Connected Success Badge (Discrete footer note) */}
        {!checkingHealth && hasApiKey === true && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-[10px] font-bold text-emerald-400 flex items-center gap-1.5 self-start shadow-xs">
            <ShieldCheck className="w-4.5 h-4.5 text-emerald-400" /> Servidor conectado de forma segura con Gemini 3.5 &amp; 3.1 TTS
          </div>
        )}

        {/* Navigation Tabs Bar */}
        <div className="flex bg-[#0E0E11] border border-white/10 rounded-2xl p-1 gap-1 shrink-0" id="tabs-navigation">
          {[
            { id: "dashboard", label: "Mi Progreso", icon: <Award className="w-4 h-4" /> },
            { id: "speak", label: "Pronunciación", icon: <Mic className="w-4 h-4" /> },
            { id: "chat", label: "Tutor Emily", icon: <MessageCircle className="w-4 h-4" /> },
            { id: "vocab", label: "Vocabulario", icon: <BookOpen className="w-4 h-4" /> }
          ].map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-3 px-2 rounded-xl text-xs md:text-sm font-bold flex items-center justify-center gap-1.5 transition duration-150 ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab.icon} <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Active Tab Component Container */}
        <div className="flex-1 flex flex-col justify-stretch">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col justify-stretch"
            >
              {activeTab === "dashboard" && (
                <Dashboard
                  stats={stats}
                  onNavigate={setActiveTab}
                  onClaimDailyXp={claimDailyMissionXp}
                  claimedMissions={claimedMissions}
                  onSetDailyGoal={setDailyGoalXp}
                />
              )}
              {activeTab === "speak" && (
                <PronunciationPractice
                  onAddXp={addXp}
                  onIncrementPronunciations={incrementPronunciations}
                  onCheckBadges={checkAndUnlockBadges}
                  onPhonemeResult={recordPhonemeResult}
                />
              )}
              {activeTab === "chat" && (
                <ConversationPractice
                  onAddXp={addXp}
                  onIncrementConversations={incrementConversations}
                  onCheckBadges={checkAndUnlockBadges}
                  onScenarioResult={recordScenarioResult}
                />
              )}
              {activeTab === "vocab" && (
                <VocabularyFlashcards
                  onAddXp={addXp}
                  onIncrementVocab={incrementVocab}
                  onCheckBadges={checkAndUnlockBadges}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>

      {/* Modern Footer */}
      <footer className="bg-[#0E0E11] border-t border-white/10 py-6 px-4 md:px-8 mt-12 shrink-0 text-center space-y-2 text-white/40 text-xs">
        <p className="font-semibold text-white/60">Apex English AI — Diseñado para una inmersión completa y efectiva</p>
        <p>Integrando Speech Recognition local con el modelo Gemini 3.5 Flash para correcciones y Gemini 3.1 TTS para síntesis de voz natural.</p>
        <p>© 2026 Apex Language AI Labs. Todos los derechos reservados.</p>
      </footer>

    </div>
  );
}
