import { Scenario, Badge, PracticePhrase, MinimalPair } from "./types";

// Pares mínimos curados a mano (no generados por IA — deben ser lingüísticamente exactos)
// enfocados en los contrastes que MÁS le cuestan a hispanohablantes, según fonética contrastiva
// español-inglés: /iː/ vs /ɪ/, /v/ vs /b/, /θ/ vs /s/ o /t/, la r inglesa, y la h aspirada
// (el español no aspira la h, por eso "hat" suena como "at" para muchos estudiantes).
export const MINIMAL_PAIRS: MinimalPair[] = [
  {
    id: "mp1",
    phonemeTag: "iː-ɪ",
    wordA: "sheep",
    wordB: "ship",
    hintA: "\"sheep\" (oveja): vocal LARGA, estira la sonrisa y alarga el sonido \"ii\".",
    hintB: "\"ship\" (barco): vocal CORTA y relajada, casi como una \"i\" española rápida."
  },
  {
    id: "mp2",
    phonemeTag: "iː-ɪ",
    wordA: "seat",
    wordB: "sit",
    hintA: "\"seat\" (asiento): alarga la vocal, labios estirados.",
    hintB: "\"sit\" (sentarse): vocal corta y suelta, no la alargues."
  },
  {
    id: "mp3",
    phonemeTag: "v-b",
    wordA: "very",
    wordB: "berry",
    hintA: "\"very\": muerde LIGERAMENTE tu labio inferior con los dientes de arriba (como en español \"f\" pero vibrando).",
    hintB: "\"berry\": labios juntos y sueltos, como la \"b\" española normal."
  },
  {
    id: "mp4",
    phonemeTag: "v-b",
    wordA: "vote",
    wordB: "boat",
    hintA: "\"vote\": dientes sobre el labio inferior, deja salir el aire vibrando.",
    hintB: "\"boat\": labios cerrados y se abren de golpe, sin fricción."
  },
  {
    id: "mp5",
    phonemeTag: "th-s",
    wordA: "think",
    wordB: "sink",
    hintA: "\"think\": pon la punta de la lengua ENTRE los dientes y sopla suave (no es una \"s\" ni una \"f\").",
    hintB: "\"sink\": lengua detrás de los dientes de arriba, como la \"s\" española."
  },
  {
    id: "mp6",
    phonemeTag: "th-d",
    wordA: "then",
    wordB: "den",
    hintA: "\"then\": lengua entre los dientes, vibra suavemente (th sonora, no es \"d\").",
    hintB: "\"den\": la lengua toca detrás de los dientes de arriba, como la \"d\" española."
  },
  {
    id: "mp7",
    phonemeTag: "r",
    wordA: "right",
    wordB: "light",
    hintA: "\"right\": la lengua NO toca el paladar, se curva hacia atrás sin tocar nada — es un sonido \"rugido\" suave.",
    hintB: "\"light\": la punta de la lengua SÍ toca justo detrás de los dientes de arriba."
  },
  {
    id: "mp8",
    phonemeTag: "h",
    wordA: "hat",
    wordB: "at",
    hintA: "\"hat\": expulsa aire con fuerza desde la garganta ANTES de la vocal — el español no aspira la h, pero aquí es obligatorio.",
    hintB: "\"at\": empieza directo con la vocal, sin ningún soplido previo."
  },
  {
    id: "mp9",
    phonemeTag: "vowel-length",
    wordA: "full",
    wordB: "fool",
    hintA: "\"full\" (lleno): vocal corta y relajada.",
    hintB: "\"fool\" (tonto): vocal larga, redondea más los labios y alarga el sonido \"uu\"."
  },
  {
    id: "mp10",
    phonemeTag: "ed-ending",
    wordA: "landed",
    wordB: "land",
    hintA: "\"landed\": la terminación -ed después de \"d\" o \"t\" se pronuncia como una sílaba extra \"-id\" (land- id).",
    hintB: "\"land\": sin terminación, la palabra se corta seca en la \"d\"."
  }
];

export const DEFAULT_SCENARIOS: Scenario[] = [
  {
    id: "coffeeshop",
    title: "At the Coffee Shop",
    description: "Pide tu bebida favorita, añade extras y maneja el pago con el barista.",
    emoji: "☕",
    context: "You are at a local coffee shop. The user wants to order a coffee, customize it (e.g., oat milk, extra espresso shot), and pay. Be friendly and helpful.",
    level: "Beginner"
  },
  {
    id: "hotelcheckin",
    title: "Hotel Check-in",
    description: "Registra tu llegada, pregunta por el desayuno y pide una habitación tranquila.",
    emoji: "🏨",
    context: "You are the receptionist at 'The Plaza Hotel'. A guest arrives to check in. They have a reservation under the name 'Lopez'. Hand them the room key, explain check-out time and breakfast service, and ask if they need assistance with luggage.",
    level: "Beginner"
  },
  {
    id: "jobinterview",
    title: "The Job Interview",
    description: "Presenta tus fortalezas, responde preguntas difíciles y pregunta sobre el equipo.",
    emoji: "💼",
    context: "You are the hiring manager at a top tech startup interviewing the candidate for a junior developer position. Ask them about their coding background, why they want this job, and how they handle team collaboration.",
    level: "Intermediate"
  },
  {
    id: "askingdirections",
    title: "Lost in London",
    description: "Pide ayuda para llegar al Big Ben y la estación de metro más cercana.",
    emoji: "🗺️",
    context: "You are a helpful local resident in central London. The user is lost and will ask you for directions to Big Ben, Westminster Abbey, or the nearest Tube station. Give natural, brief directions.",
    level: "Intermediate"
  },
  {
    id: "negotiation",
    title: "Salary & Benefits Review",
    description: "Negocia un aumento de salario o mejores beneficios de manera profesional.",
    emoji: "📈",
    context: "You are the HR Director. The employee (the user) has had a highly successful year and is requesting a salary adjustment and remote work flexibility. Be firm but open-minded and professional.",
    level: "Advanced"
  }
];

export const DEFAULT_PHRASES: PracticePhrase[] = [
  // Beginner
  {
    id: "p1",
    phrase: "Could I have a cup of black coffee, please?",
    translation: "¿Podría darme una taza de café solo, por favor?",
    topic: "Cafetería ☕",
    difficulty: "Beginner"
  },
  {
    id: "p2",
    phrase: "Excuse me, where is the nearest train station?",
    translation: "Disculpe, ¿dónde está la estación de tren más cercana?",
    topic: "Viajes ✈️",
    difficulty: "Beginner"
  },
  {
    id: "p3",
    phrase: "It is nice to meet you. What is your name?",
    translation: "Es un placer conocerte. ¿Cuál es tu nombre?",
    topic: "Social 🤝",
    difficulty: "Beginner"
  },
  {
    id: "p4",
    phrase: "I would like to check in for my reservation.",
    translation: "Me gustaría registrar mi llegada para mi reserva.",
    topic: "Hotel 🏨",
    difficulty: "Beginner"
  },
  // Intermediate
  {
    id: "p5",
    phrase: "I am looking forward to working with your creative team.",
    translation: "Tengo muchas ganas de trabajar con su equipo creativo.",
    topic: "Trabajo 💼",
    difficulty: "Intermediate"
  },
  {
    id: "p6",
    phrase: "Could you recommend some local sightseeing spots around here?",
    translation: "¿Podría recomendarme algunos lugares turísticos locales por aquí?",
    topic: "Viajes ✈️",
    difficulty: "Intermediate"
  },
  {
    id: "p7",
    phrase: "I totally agree with your point of view regarding this project.",
    translation: "Estoy totalmente de acuerdo con tu punto de vista respecto a este proyecto.",
    topic: "Social 🤝",
    difficulty: "Intermediate"
  },
  {
    id: "p8",
    phrase: "Would it be possible to reschedule our meeting for tomorrow morning?",
    translation: "¿Sería posible reprogramar nuestra reunión para mañana por la mañana?",
    topic: "Trabajo 💼",
    difficulty: "Intermediate"
  },
  // Advanced
  {
    id: "p9",
    phrase: "We need to thoroughly evaluate the environmental impact of this initiative.",
    translation: "Necesitamos evaluar minuciosamente el impacto ambiental de esta iniciativa.",
    topic: "Negocios 📈",
    difficulty: "Advanced"
  },
  {
    id: "p10",
    phrase: "That sounds like an incredibly lucrative opportunity with minimal risk involved.",
    translation: "Eso suena como una oportunidad increíblemente lucrativa con un riesgo mínimo involucrado.",
    topic: "Negocios 📈",
    difficulty: "Advanced"
  },
  {
    id: "p11",
    phrase: "I would like to negotiate the terms of our contract regarding remote work flexibility.",
    translation: "Me gustaría negociar los términos de nuestro contrato con respecto a la flexibilidad del trabajo remoto.",
    topic: "Trabajo 💼",
    difficulty: "Advanced"
  }
];

export const DEFAULT_BADGES: Badge[] = [
  {
    id: "first_steps",
    title: "Primeros Pasos",
    description: "Completa tu primer análisis de pronunciación.",
    icon: "🚀"
  },
  {
    id: "conversationalist",
    title: "Charlista Nato",
    description: "Envía 5 mensajes en una conversación fluida con Emily.",
    icon: "🗣️"
  },
  {
    id: "vocab_master",
    title: "Coleccionista de Palabras",
    description: "Estudia o domina tus primeras 5 tarjetas de vocabulario.",
    icon: "📚"
  },
  {
    id: "perfect_score",
    title: "Pronunciación Perfecta",
    description: "Logra un puntaje de pronunciación de 95% o superior.",
    icon: "🌟"
  },
  {
    id: "streak_3",
    title: "Hábito Imparable",
    description: "Mantén una racha de práctica de 3 días seguidos.",
    icon: "🔥"
  }
];
