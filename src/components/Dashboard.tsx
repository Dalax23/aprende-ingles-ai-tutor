import React, { useMemo, useState } from "react";
import { UserStats, Badge } from "../types";
import { DEFAULT_BADGES } from "../data";
import { Award, Flame, TrendingUp, CheckCircle, ArrowRight, Sparkles, BookOpen, Mic, MessageSquare, GraduationCap, Settings2 } from "lucide-react";
import { motion } from "motion/react";
import { loadDeck, deckMasteryValues } from "../lib/vocabDeck";
import { computeOverallMastery, cefrLabel, recordDailySnapshot } from "../lib/mastery";

interface DashboardProps {
  stats: UserStats;
  onNavigate: (view: "dashboard" | "speak" | "chat" | "vocab") => void;
  onClaimDailyXp: (xp: number, missionId: string) => void;
  claimedMissions: string[];
  onSetDailyGoal: (xp: number) => void;
}

export default function Dashboard({ stats, onNavigate, onClaimDailyXp, claimedMissions, onSetDailyGoal }: DashboardProps) {
  const nextLevelXp = stats.level * 100;
  const progressPercent = Math.min(100, Math.round((stats.todayXp / stats.dailyGoalXp) * 100));
  const levelProgressPercent = Math.min(100, Math.round((stats.xp % nextLevelXp) / nextLevelXp * 100));
  const [editingGoal, setEditingGoal] = useState(false);

  // Modelo de dominio unificado (vocabulario FSRS + pronunciación por fonema + conversación):
  // deriva un nivel CEFR estimado real, en vez de solo mostrar XP acumulado. Se recalcula
  // cada vez que se entra al Dashboard y se guarda un snapshot diario para graficar progreso.
  const mastery = useMemo(() => {
    const deck = loadDeck();
    const vocabValues = deckMasteryValues(deck);
    const result = computeOverallMastery(vocabValues, stats.phonemeMastery ?? {}, stats.scenarioMastery ?? {});
    recordDailySnapshot({
      date: new Date().toISOString().split("T")[0],
      vocabMasteryAvg: result.vocabAvg,
      pronunciationMasteryAvg: result.pronunciationAvg,
      conversationMasteryAvg: result.conversationAvg,
      overallScore: result.overallScore,
      cefrLevel: result.cefrLevel,
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.phonemeMastery, stats.scenarioMastery, stats.masteredWordsCount]);

  const missions = [
    {
      id: "speak_mission",
      title: "Practica tu Pronunciación",
      description: "Graba e inspecciona tu voz con al menos una frase.",
      xp: 15,
      icon: <Mic className="w-5 h-5 text-indigo-500" />,
      action: () => onNavigate("speak"),
      btnText: "Ir a Practicar",
      completed: stats.completedPronunciations > 0
    },
    {
      id: "chat_mission",
      title: "Conversación con Emily",
      description: "Envía al menos un mensaje en una sesión de chat interactiva.",
      xp: 25,
      icon: <MessageSquare className="w-5 h-5 text-emerald-500" />,
      action: () => onNavigate("chat"),
      btnText: "Iniciar Charla",
      completed: stats.completedConversations > 0
    },
    {
      id: "vocab_mission",
      title: "Repaso de Vocabulario",
      description: "Estudia o genera un set de 5 tarjetas de memoria.",
      xp: 15,
      icon: <BookOpen className="w-5 h-5 text-amber-500" />,
      action: () => onNavigate("vocab"),
      btnText: "Estudiar Tarjetas",
      completed: stats.masteredWordsCount > 0
    }
  ];

  // Leaderboard mockup with the user embedded inside
  const leaderboard = [
    { name: "Sophia Miller", xp: 480, level: 5, avatar: "👩‍💼", isUser: false },
    { name: "Alexander Smith", xp: 390, level: 4, avatar: "👨‍💻", isUser: false },
    { name: "Tú (Estudiante)", xp: stats.xp, level: stats.level, avatar: "⚡", isUser: true },
    { name: "Elena Rostova", xp: 120, level: 2, avatar: "👩‍🎨", isUser: false },
    { name: "Yuki Tanaka", xp: 80, level: 1, avatar: "👨‍🚀", isUser: false },
  ].sort((a, b) => b.xp - a.xp);

  return (
    <div className="space-y-8" id="dashboard-container">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0E0E11] via-[#120E1C] to-[#0E0E11] border border-white/10 p-8 text-white shadow-2xl shadow-indigo-500/5">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"></div>

        {/* Floating pulse wave backdrop */}
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <div className="w-[400px] h-[400px] border border-indigo-500 rounded-full animate-ping shadow-[0_0_80px_rgba(99,102,241,0.5)]"></div>
        </div>

        <div className="relative z-10 md:flex md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider border border-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5" /> Nivel {stats.level} Tutor de IA
            </div>
            <h1 className="text-3xl md:text-4xl font-serif italic leading-tight text-white/90">
              Aprende Inglés de Verdad
            </h1>
            <p className="text-white/60 max-w-xl text-sm leading-relaxed">
              Practica pronunciación con feedback instantáneo y entabla conversaciones naturales con Emily, tu tutora de IA experta.
            </p>
          </div>
          <div className="mt-6 md:mt-0 flex gap-4">
            <button
              onClick={() => onNavigate("speak")}
              className="px-6 py-3 rounded-xl bg-white text-slate-950 hover:bg-slate-100 transition duration-300 text-sm font-semibold shadow-md flex items-center gap-2"
              id="btn-quick-speak"
            >
              <Mic className="w-4 h-4" /> Practicar Voz
            </button>
            <button
              onClick={() => onNavigate("chat")}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition duration-300 text-sm font-semibold shadow-md flex items-center gap-2"
              id="btn-quick-chat"
            >
              <MessageSquare className="w-4 h-4" /> Hablar con Emily
            </button>
          </div>
        </div>
      </div>

      {/* Bento Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6" id="stats-grid">
        {/* CEFR Mastery Card — nivel real estimado, no solo actividad/XP */}
        <div className="bg-[#0E0E11] border border-white/10 rounded-3xl p-6 shadow-lg shadow-black/20 flex items-center gap-5 relative overflow-hidden">
          <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
            <GraduationCap className="w-8 h-8 text-purple-300" />
          </div>
          <div>
            <span className="text-xs text-white/40 uppercase font-semibold tracking-wider">Nivel Estimado</span>
            <h3 className="text-2xl font-bold text-white mt-1">{mastery.cefrLevel}</h3>
            <p className="text-xs text-white/30 mt-0.5">{cefrLabel(mastery.cefrLevel).split("—")[1]?.trim()}</p>
          </div>
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full -mr-6 -mb-6"></div>
        </div>

        {/* Streak card */}
        <div className="bg-[#0E0E11] border border-white/10 rounded-3xl p-6 shadow-lg shadow-black/20 flex items-center gap-5 relative overflow-hidden">
          <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
            <Flame className="w-8 h-8 text-orange-400 animate-pulse" />
          </div>
          <div>
            <span className="text-xs text-white/40 uppercase font-semibold tracking-wider">Racha Activa</span>
            <h3 className="text-2xl font-bold text-white mt-1">{stats.streak} {stats.streak === 1 ? "Día" : "Días"}</h3>
            <p className="text-xs text-white/30 mt-0.5">¡No dejes apagar tu racha!</p>
          </div>
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full -mr-6 -mb-6"></div>
        </div>

        {/* Level XP Progress Card */}
        <div className="bg-[#0E0E11] border border-white/10 rounded-3xl p-6 shadow-lg shadow-black/20 space-y-3 relative overflow-hidden">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-xs text-white/40 uppercase font-semibold tracking-wider">Progreso de Nivel</span>
              <h3 className="text-2xl font-bold text-white mt-1">Nivel {stats.level}</h3>
            </div>
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-300 font-bold text-xs">
              {stats.xp} XP
            </div>
          </div>
          <div className="space-y-1">
            <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${levelProgressPercent}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[11px] text-white/40">
              <span>{stats.xp % nextLevelXp} XP</span>
              <span>{nextLevelXp} XP para Nivel {stats.level + 1}</span>
            </div>
          </div>
        </div>

        {/* Daily Goal Card — ajustable por el usuario (autonomía, Teoría de la Autodeterminación) */}
        <div className="bg-[#0E0E11] border border-white/10 rounded-3xl p-6 shadow-lg shadow-black/20 space-y-3 relative overflow-hidden">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-xs text-white/40 uppercase font-semibold tracking-wider">Meta Diaria</span>
              <h3 className="text-2xl font-bold text-white mt-1">{progressPercent}%</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 font-bold text-xs flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> {stats.todayXp}/{stats.dailyGoalXp} XP
              </div>
              <button
                onClick={() => setEditingGoal(!editingGoal)}
                className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white transition cursor-pointer"
                title="Ajustar mi meta diaria"
              >
                <Settings2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {editingGoal ? (
            <div className="flex items-center gap-2">
              {[30, 50, 80, 120].map((goal) => (
                <button
                  key={goal}
                  onClick={() => {
                    onSetDailyGoal(goal);
                    setEditingGoal(false);
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    stats.dailyGoalXp === goal
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  {goal} XP
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="w-full bg-white/5 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[11px] text-white/40">
                <span>Hoy</span>
                <span>{progressPercent >= 100 ? "¡Meta completada! 🎉" : `${stats.dailyGoalXp - stats.todayXp} XP restantes`}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mastery Breakdown — desglose de dominio real por área, base del nivel CEFR */}
      <div className="bg-[#0E0E11] border border-white/10 rounded-3xl p-6 shadow-lg space-y-4">
        <h3 className="text-sm font-bold text-white/80 flex items-center gap-2">
          <GraduationCap className="w-4.5 h-4.5 text-purple-300" /> Desglose de Dominio Real (no solo actividad)
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Vocabulario", value: mastery.vocabAvg, color: "bg-indigo-500" },
            { label: "Pronunciación", value: mastery.pronunciationAvg, color: "bg-emerald-500" },
            { label: "Conversación", value: mastery.conversationAvg, color: "bg-amber-500" },
          ].map((m) => (
            <div key={m.label} className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-semibold">
                <span className="text-white/50">{m.label}</span>
                <span className="text-white/80">{m.value}%</span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div className={`${m.color} h-full rounded-full transition-all duration-500`} style={{ width: `${m.value}%` }}></div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-white/30 leading-relaxed">
          Tu nivel {mastery.cefrLevel} se calcula combinando estos tres promedios reales, no la cantidad
          de XP acumulado — puedes tener mucho XP por practicar seguido y aun así estar en un nivel más
          bajo si el dominio real todavía no sube.
        </p>
      </div>

      {/* Main Grid: Missions vs Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Daily Missions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-serif italic text-white/90 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-indigo-400" /> Misiones de Hoy
            </h2>
            <span className="text-xs text-white/40 font-medium">Reinicio diario a medianoche</span>
          </div>

          <div className="space-y-4">
            {missions.map((m) => {
              const claimed = claimedMissions.includes(m.id);
              return (
                <div
                  key={m.id}
                  className={`bg-[#0E0E11] border rounded-2xl p-5 flex items-center justify-between gap-4 transition duration-300 shadow-md ${
                    m.completed ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-white/5 rounded-xl mt-0.5">
                      {m.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white text-sm md:text-base">{m.title}</h4>
                        {m.completed && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                            Hecho
                          </span>
                        )}
                      </div>
                      <p className="text-xs md:text-sm text-white/60 mt-1">{m.description}</p>
                      <span className="inline-block mt-2 text-xs font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                        +{m.xp} XP
                      </span>
                    </div>
                  </div>

                  <div>
                    {claimed ? (
                      <span className="text-xs text-white/30 font-medium px-4 py-2 bg-white/5 rounded-xl inline-block">
                        Reclamado
                      </span>
                    ) : m.completed ? (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onClaimDailyXp(m.xp, m.id)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition text-xs font-bold shadow-md shadow-emerald-600/20"
                      >
                        Reclamar XP
                      </motion.button>
                    ) : (
                      <button
                        onClick={m.action}
                        className="px-4 py-2 rounded-xl border border-white/10 text-white/80 hover:bg-white/5 hover:text-white transition text-xs font-semibold flex items-center gap-1 whitespace-nowrap"
                      >
                        Comenzar <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gamified Leaderboard */}
        <div className="space-y-6">
          <h2 className="text-xl md:text-2xl font-serif italic text-white/90 flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-400" /> Liga de Campeones
          </h2>

          <div className="bg-[#0E0E11] border border-white/10 rounded-3xl p-5 shadow-lg space-y-4">
            <div className="text-xs font-semibold text-white/40 flex justify-between uppercase tracking-wider px-2">
              <span>Estudiante</span>
              <span>XP Total</span>
            </div>

            <div className="space-y-3">
              {leaderboard.map((user, idx) => (
                <div
                  key={user.name}
                  className={`flex items-center justify-between p-3 rounded-2xl transition duration-300 ${
                    user.isUser ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" : "hover:bg-white/5 text-white/80"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 text-center text-xs font-bold ${user.isUser ? "text-indigo-200" : "text-white/40"}`}>
                      {idx + 1}
                    </span>
                    <span className="text-xl">{user.avatar}</span>
                    <div>
                      <span className="font-semibold text-sm block">
                        {user.name} {user.isUser && "⭐"}
                      </span>
                      <span className={`text-[10px] ${user.isUser ? "text-indigo-200" : "text-white/40"}`}>
                        Nivel {user.level}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-md bg-opacity-10 bg-black/10">
                    {user.xp} XP
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-white/40 text-center">
              La liga finaliza el domingo. ¡Sigue practicando para subir puestos!
            </p>
          </div>
        </div>
      </div>

      {/* Badges and Achievements */}
      <div className="space-y-6">
        <h2 className="text-xl md:text-2xl font-serif italic text-white/90 flex items-center gap-2">
          <Award className="w-5 h-5 text-indigo-400" /> Tus Logros Obtenidos ({stats.badges.length}/{DEFAULT_BADGES.length})
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {DEFAULT_BADGES.map((badge) => {
            const isUnlocked = stats.badges.some((b) => b.id === badge.id);
            return (
              <div
                key={badge.id}
                className={`border rounded-2xl p-5 text-center transition duration-300 flex flex-col items-center justify-center space-y-3 ${
                  isUnlocked
                    ? "bg-[#0E0E11] border-white/10 shadow-md shadow-black/30"
                    : "bg-white/5 border-white/5 opacity-40"
                }`}
              >
                <span className={`text-4xl ${isUnlocked ? "scale-110 drop-shadow-md animate-bounce-subtle" : "grayscale"}`}>
                  {badge.icon}
                </span>
                <div className="space-y-1">
                  <h4 className="font-bold text-xs text-white">{badge.title}</h4>
                  <p className="text-[10px] text-white/50 leading-tight">{badge.description}</p>
                </div>
                {isUnlocked ? (
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Desbloqueado
                  </span>
                ) : (
                  <span className="text-[9px] font-bold text-white/30 bg-white/5 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Bloqueado
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
