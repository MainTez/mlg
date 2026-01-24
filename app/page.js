"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import { getSupabaseClient } from "../lib/supabaseClient";

const REGIONS = [
  { id: "na1", label: "NA" },
  { id: "euw1", label: "EUW" },
  { id: "eun1", label: "EUNE" },
  { id: "kr", label: "KR" },
  { id: "br1", label: "BR" },
  { id: "la1", label: "LAN" },
  { id: "la2", label: "LAS" },
  { id: "oc1", label: "OCE" },
  { id: "tr1", label: "TR" },
  { id: "ru", label: "RU" }
];

const QUEUE_LABELS = {
  RANKED_SOLO_5x5: "Ranked Solo/Duo",
  RANKED_FLEX_SR: "Ranked Flex"
};
const RANKED_QUEUE_IDS = new Set([420, 440]);
const ANNOUNCEMENT_WINDOW_MS = 6 * 60 * 60 * 1000;
const ALLOWED_EMAILS = new Set([
  "danilebnen@gmail.com",
  "hadilebnen@gmail.com",
  "1nd.brahimi09@gmail.com",
  "felx.trad@gmail.com",
  "johanziolkowski@gmail.com",
  "johanziokowski@gmail.com",
  "epicman11235@gmail.com"
]);

const SECTION_KEYS = new Set([
  "dashboard",
  "tracker",
  "intel",
  "prep",
  "drafts",
  "opponents",
  "schedule",
  "history",
  "tournaments",
  "news",
  "settings",
  "download"
]);

const TIER_ORDER = {
  IRON: 1,
  BRONZE: 2,
  SILVER: 3,
  GOLD: 4,
  PLATINUM: 5,
  EMERALD: 6,
  DIAMOND: 7,
  MASTER: 8,
  GRANDMASTER: 9,
  CHALLENGER: 10
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const percentile = (value, values) => {
  if (!values.length) {
    return 0.5;
  }
  const sorted = [...values].sort((a, b) => a - b);
  let below = 0;
  let equal = 0;
  sorted.forEach((entry) => {
    if (entry < value) {
      below += 1;
    } else if (entry === value) {
      equal += 1;
    }
  });
  return (below + equal * 0.5) / sorted.length;
};

const buildMatchScores = (match) => {
  if (!match?.info?.participants?.length) {
    return new Map();
  }
  const minutes = Math.max(1, (match.info.gameDuration || 0) / 60);
  const stats = match.info.participants.map((player) => ({
    puuid: player.puuid,
    kda: (player.kills + player.assists) / Math.max(1, player.deaths),
    dpm: player.totalDamageDealtToChampions / minutes,
    gpm: player.goldEarned / minutes,
    vpm: player.visionScore / minutes,
    cspm:
      (player.totalMinionsKilled + player.neutralMinionsKilled) / minutes
  }));

  const kdaValues = stats.map((entry) => entry.kda);
  const dpmValues = stats.map((entry) => entry.dpm);
  const gpmValues = stats.map((entry) => entry.gpm);
  const vpmValues = stats.map((entry) => entry.vpm);
  const cspmValues = stats.map((entry) => entry.cspm);

  const scoreMap = new Map();
  stats.forEach((entry) => {
    const score =
      0.3 * percentile(entry.kda, kdaValues) +
      0.2 * percentile(entry.dpm, dpmValues) +
      0.2 * percentile(entry.gpm, gpmValues) +
      0.15 * percentile(entry.cspm, cspmValues) +
      0.15 * percentile(entry.vpm, vpmValues);
    scoreMap.set(entry.puuid, clamp(Math.round(1 + 99 * score), 1, 100));
  });
  return scoreMap;
};

const formatPercent = (value) => `${Math.round(value * 100)}%`;
const formatDuration = (seconds) => {
  if (!seconds) {
    return "0m";
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
};
const formatTimeAgo = (timestamp) => {
  if (!timestamp) {
    return "";
  }
  const diffMs = Date.now() - timestamp;
  if (diffMs < 60 * 1000) {
    return "Just now";
  }
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  const remainderHours = diffHours % 24;
  return remainderHours
    ? `${diffDays}d ${remainderHours}h ago`
    : `${diffDays}d ago`;
};

const formatLogDate = (log) => {
  if (log?.played_at) {
    const time = new Date(log.played_at).getTime();
    return formatTimeAgo(time);
  }
  return log?.date || "—";
};

const formatDateLabel = (value) => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
};

const normalizeLink = (value) => {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const formatCountdown = (targetMs, nowMs) => {
  if (!targetMs || !Number.isFinite(targetMs)) {
    return "";
  }
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  const diffMs = targetMs - now;
  if (diffMs <= 0) {
    return "";
  }
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const mergeAnnouncements = (prev, next) => {
  const merged = [];
  const seen = new Set();

  const addItem = (item) => {
    if (!item) {
      return;
    }
    const id =
      item.id || `${item.message || "announcement"}-${item.createdAt || 0}`;
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    merged.push({ ...item, id });
  };

  next.forEach(addItem);
  prev.forEach(addItem);

  return merged.slice(0, 50);
};

const getRecentWinrate = (summaries) => {
  if (!summaries?.length) {
    return null;
  }
  const rankedOnly = summaries.filter(
    (match) =>
      RANKED_QUEUE_IDS.has(match.queueId) ||
      (match.queueName || "").toLowerCase().includes("ranked")
  );
  const recent = [...rankedOnly].sort(
    (a, b) => (b.gameCreation || 0) - (a.gameCreation || 0)
  );
  const recentWindow = recent.slice(0, 10);
  if (!recentWindow.length) {
    return null;
  }
  const wins = recentWindow.filter((match) => match.win).length;
  return recentWindow.length ? wins / recentWindow.length : null;
};

const getRankedRecord = (ranked) => {
  const primary = pickPrimaryRank(ranked || []);
  if (!primary) {
    return null;
  }
  return {
    wins: primary.wins ?? 0,
    losses: primary.losses ?? 0,
    queue: QUEUE_LABELS[primary.queueType] || "Ranked"
  };
};

const getTierOrder = (tier) => {
  if (!tier) {
    return 0;
  }
  const normalized = tier.toUpperCase().replace(/[^A-Z]/g, "");
  return TIER_ORDER[normalized] || 0;
};


const playChatBeep = (audioContextRef) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return;
    }
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const context = audioContextRef.current;
    if (context.state === "suspended") {
      context.resume();
    }
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.05;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
  } catch (error) {
    return;
  }
};

const playMatchBeep = (audioContextRef, type) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return;
    }
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const context = audioContextRef.current;
    if (context.state === "suspended") {
      context.resume();
    }
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = type === "win" ? 980 : 320;
    gain.gain.value = 0.06;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
  } catch (error) {
    return;
  }
};

const playSkinGoalChime = (audioContextRef) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return;
    }
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const context = audioContextRef.current;
    if (context.state === "suspended") {
      context.resume();
    }
    const gain = context.createGain();
    gain.gain.value = 0.05;
    gain.connect(context.destination);
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      const startAt = context.currentTime + index * 0.12;
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.18);
    });
  } catch (error) {
    return;
  }
};

const getLastPlayedTimestamp = (status, matchSummaries) => {
  const statusTime = status?.lastPlayedAt || 0;
  const summaryTime = matchSummaries?.[0]?.gameCreation || 0;
  return Math.max(statusTime, summaryTime);
};

const formatStatusLabel = (status, activeGame, matchSummaries, nowMs) => {
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  if (status?.inGame || activeGame) {
    const queueLabel = activeGame?.queueName || activeGame?.gameMode;
    const startTime = activeGame?.gameStartTime || null;
    const elapsed =
      startTime && Number.isFinite(startTime)
        ? formatDuration(Math.floor((now - startTime) / 1000))
        : null;
    if (queueLabel && elapsed) {
      return `In game · ${queueLabel} · ${elapsed}`;
    }
    if (queueLabel) {
      return `In game · ${queueLabel}`;
    }
    return elapsed ? `In game · ${elapsed}` : "In game";
  }
  const lastPlayed = getLastPlayedTimestamp(status, matchSummaries);
  if (lastPlayed) {
    return `Last played ${formatTimeAgo(lastPlayed)}`;
  }
  return "Offline";
};

const formatRankLabel = (entry) => {
  if (!entry) {
    return "Unranked";
  }
  const masterTiers = ["MASTER", "GRANDMASTER", "CHALLENGER"];
  if (masterTiers.includes(entry.tier)) {
    return `${entry.tier} · ${entry.leaguePoints} LP`;
  }
  return `${entry.tier} ${entry.rank} · ${entry.leaguePoints} LP`;
};

const formatChatTimestamp = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const THEME_OPTIONS = [
  {
    id: "cosmos",
    name: "Cosmos",
    description: "Deep space blues with neon glow."
  },
  {
    id: "tundra",
    name: "Tundra",
    description: "Frosted slate and glacial highlights."
  },
  {
    id: "forge",
    name: "Forge",
    description: "Warm embers with molten accents."
  },
  {
    id: "tide",
    name: "Tide",
    description: "Oceanic teals with calm contrast."
  },
  {
    id: "solstice",
    name: "Solstice",
    description: "Golden hour tones with soft gradients."
  },
  {
    id: "citrus",
    name: "Citrus",
    description: "Bright citrus accents with crisp contrast."
  },
  {
    id: "royal",
    name: "Royal",
    description: "Royal blues with polished gold highlights."
  },
  {
    id: "sage",
    name: "Sage",
    description: "Muted greens with clean neutral balance."
  },
  {
    id: "rosewood",
    name: "Rosewood",
    description: "Dark wine reds with satin highlights."
  },
  {
    id: "ember",
    name: "Ember",
    description: "Charcoal base with amber sparks."
  },
  {
    id: "onyxgold",
    name: "Onyx Gold",
    description: "Black base with molten gold accents."
  },
  {
    id: "ivorygold",
    name: "Ivory Gold",
    description: "Warm whites with polished gold trim."
  },
  {
    id: "obsidian",
    name: "Obsidian",
    description: "Deep charcoal with electric teal edges."
  },
  {
    id: "gilded",
    name: "Gilded",
    description: "Satin black with royal gold accents."
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Cool indigo with neon aurora highlights."
  },
  {
    id: "monarch",
    name: "Monarch",
    description: "Navy base with crimson and gold trim."
  },
  {
    id: "saffron",
    name: "Saffron",
    description: "Warm clay with saffron highlights."
  },
  {
    id: "velvet",
    name: "Velvet",
    description: "Plum night with soft pink glow."
  },
  {
    id: "slate",
    name: "Slate",
    description: "Steel blues with crisp cyan accents."
  },
  {
    id: "nimbus",
    name: "Nimbus",
    description: "Stormy grays with icy neon pop."
  },
  {
    id: "verdant",
    name: "Verdant",
    description: "Forest greens with lime sparks."
  },
  {
    id: "noir",
    name: "Noir",
    description: "Ink black with silver highlights."
  }
];

const TEAM_ROSTER = [
  { role: "Top", name: "Ashmumu", tagline: "MLG", status: "" },
  { role: "Jungle", name: "TUNGTUNGKIRK", tagline: "PHONK", status: "" },
  { role: "Mid", name: "Ind", tagline: "MLG", status: "" },
  { role: "Bot", name: "MainTez", tagline: "MLG", status: "" },
  { role: "Support", name: "Johan jojo", tagline: "MLG", status: "" }
];

const TEAM_COMPS = [
  {
    label: "Front-to-back",
    situation: "Standard 5v5",
    core: ["Ornn", "Sejuani", "Orianna", "Jinx", "Lulu"]
  },
  {
    label: "Pick & burst",
    situation: "Snowball mid",
    core: ["Camille", "Lee Sin", "Ahri", "Kai'Sa", "Nautilus"]
  },
  {
    label: "Dive",
    situation: "Side lane pressure",
    core: ["Renekton", "Viego", "Sylas", "Xayah", "Rakan"]
  }
];

const MATCH_LOGS = [
  { opponent: "Team Rift", result: "Win", score: "2-1", date: "2d ago" },
  { opponent: "Arcane Five", result: "Loss", score: "1-2", date: "5d ago" },
  { opponent: "Dragon Forge", result: "Win", score: "2-0", date: "1w ago" }
];

const buildRosterKey = (player) => `${player.name}#${player.tagline}`;

const pickPrimaryRank = (entries = []) => {
  if (!entries.length) {
    return null;
  }
  const solo = entries.find((entry) => entry.queueType === "RANKED_SOLO_5x5");
  const flex = entries.find((entry) => entry.queueType === "RANKED_FLEX_SR");
  return solo || flex || entries[0];
};

export default function HomePage() {
  const [gameName, setGameName] = useState("");
  const [tagLine, setTagLine] = useState("");
  const [region, setRegion] = useState("euw1");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [authUser, setAuthUser] = useState(null);
  const [authToken, setAuthToken] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [teamStats, setTeamStats] = useState({});
  const [teamLoading, setTeamLoading] = useState(true);
  const lastTeamRegionRef = useRef(null);
  const resultRef = useRef(null);
  const [activeSection, setActiveSection] = useState(() => {
    if (typeof window === "undefined") {
      return "dashboard";
    }
    const savedSection = window.localStorage.getItem("mlg.activeSection");
    return savedSection && SECTION_KEYS.has(savedSection)
      ? savedSection
      : "dashboard";
  });
  const [isDesktopApp, setIsDesktopApp] = useState(false);
  const [overlayShortcutInput, setOverlayShortcutInput] = useState(() => {
    if (typeof window === "undefined") {
      return "Ctrl+O";
    }
    return window.localStorage.getItem("mlg.overlayShortcut") || "Ctrl+O";
  });
  const [overlayShortcutActive, setOverlayShortcutActive] = useState("");
  const [overlayShortcutStatus, setOverlayShortcutStatus] = useState("");

  useEffect(() => {
    window.localStorage.setItem("mlg.activeSection", activeSection);
  }, [activeSection]);
  useEffect(() => {
    const inDesktopApp = Boolean(window?.electronApp?.platform);
    setIsDesktopApp(inDesktopApp);
    if (inDesktopApp && activeSection === "download") {
      setActiveSection("dashboard");
    }
  }, [activeSection]);
  useEffect(() => {
    if (!isDesktopApp) {
      return;
    }
    const currentShortcut = window?.electronApp?.getOverlayShortcut;
    if (!currentShortcut) {
      return;
    }
    currentShortcut()
      .then((shortcut) => {
        if (shortcut) {
          setOverlayShortcutActive(shortcut);
        }
      })
      .catch(() => {});
  }, [isDesktopApp]);
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem("mlg.overlayShortcut", overlayShortcutInput);
  }, [overlayShortcutInput]);
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") {
      return "cosmos";
    }
    return window.localStorage.getItem("teamTheme") || "cosmos";
  });
  const [settingsMessage, setSettingsMessage] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatMessage, setChatMessage] = useState("");
  const [chatError, setChatError] = useState("");
  const chatEndRef = useRef(null);
  const [chatUnread, setChatUnread] = useState(0);
  const lastChatIdRef = useRef(null);
  const lastSeenAtRef = useRef(null);
  const audioContextRef = useRef(null);
  const [newsItems, setNewsItems] = useState([]);
  const [newsError, setNewsError] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [announcements, setAnnouncements] = useState(() => {
    if (typeof window === "undefined") {
      return [];
    }
    try {
      const stored = JSON.parse(
        window.localStorage.getItem("mlg.announcements") || "[]"
      );
      return stored.filter(
        (item) =>
          !item.queueId ||
          RANKED_QUEUE_IDS.has(item.queueId) ||
          (item.queueName || "").toLowerCase().includes("ranked")
      );
    } catch (error) {
      return [];
    }
  });
  const [skinGoalPopup, setSkinGoalPopup] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState("");
  const [appVersion, setAppVersion] = useState(() => {
    if (typeof window === "undefined") {
      return "0.0.0";
    }
    return window.localStorage.getItem("mlg.lastSeenVersion") || "0.0.0";
  });
  const [statusNow, setStatusNow] = useState(() => Date.now());
  const [liveIntelTarget, setLiveIntelTarget] = useState(null);
  const [liveIntelData, setLiveIntelData] = useState(null);
  const [liveIntelLoading, setLiveIntelLoading] = useState(false);
  const [liveIntelError, setLiveIntelError] = useState("");
  const normalizeOverlayShortcut = (value) => {
    if (!value) {
      return "";
    }
    let normalized = value.trim().replace(/\s+/g, "");
    normalized = normalized.replace(/Ctrl/gi, "CommandOrControl");
    normalized = normalized.replace(/Cmd/gi, "CommandOrControl");
    return normalized;
  };
  const formatOverlayShortcut = (value) =>
    value ? value.replace(/CommandOrControl/gi, "Ctrl") : "";
  const handleOverlayToggle = async () => {
    if (!window?.electronApp?.toggleOverlay) {
      setOverlayShortcutStatus("Open the desktop app to toggle the overlay.");
      return;
    }
    setOverlayShortcutStatus("");
    await window.electronApp.toggleOverlay();
  };
  const handleOverlayShortcutSave = async () => {
    if (!window?.electronApp?.setOverlayShortcut) {
      setOverlayShortcutStatus("Open the desktop app to save hotkeys.");
      return;
    }
    const normalized = normalizeOverlayShortcut(overlayShortcutInput);
    if (!normalized) {
      setOverlayShortcutStatus("Enter a shortcut like Ctrl+O.");
      return;
    }
    const result = await window.electronApp.setOverlayShortcut(normalized);
    if (!result?.ok) {
      setOverlayShortcutStatus(result?.error || "Shortcut unavailable.");
      return;
    }
    setOverlayShortcutActive(result.shortcut);
    setOverlayShortcutStatus("Saved.");
  };
  const getFreshToken = async () => {
    if (authToken) {
      return authToken;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      return "";
    }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || "";
    if (token && token !== authToken) {
      setAuthToken(token);
    }
    return token;
  };

  const selectedMatch = useMemo(() => {
    if (!selectedMatchId || !result?.matches?.length) {
      return null;
    }
    return (
      result.matches.find((match) => match.metadata.matchId === selectedMatchId) ||
      null
    );
  }, [result, selectedMatchId]);

  const selectedMatchScores = useMemo(
    () => buildMatchScores(selectedMatch),
    [selectedMatch]
  );

  const runSearch = async (nameValue, tagValue) => {
    setError("");
    setResult(null);

    if (!nameValue.trim() || !tagValue.trim()) {
      setError("Enter a game name and tagline.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `/api/summoner?gameName=${encodeURIComponent(
          nameValue.trim()
        )}&tagLine=${encodeURIComponent(tagValue.trim())}&region=${region}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load summoner.");
      }

      setResult(data);
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthError("");
    const supabase = getSupabaseClient();
    if (!supabase) {
      setAuthError("Missing Supabase config.");
      return;
    }
    if (!ALLOWED_EMAILS.has(authEmail.trim().toLowerCase())) {
      setAuthError("Access denied.");
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword
    });
    if (signInError) {
      setAuthError(signInError.message);
    }
  };

  const handleSignup = async () => {
    setAuthError("");
    if (!authUsername.trim()) {
      setAuthError("Enter a username.");
      return;
    }
    if (!ALLOWED_EMAILS.has(authEmail.trim().toLowerCase())) {
      setAuthError("Access denied.");
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      setAuthError("Missing Supabase config.");
      return;
    }
    const { error: signUpError } = await supabase.auth.signUp({
      email: authEmail.trim(),
      password: authPassword,
      options: {
        data: {
          display_name: authUsername.trim()
        }
      }
    });
    if (signUpError) {
      setAuthError(signUpError.message);
    } else {
      setAuthError("Account created. Check your email to confirm.");
    }
  };

  const handleLogout = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }
    await supabase.auth.signOut();
  };

  const handleUpdateProfile = async () => {
    setSettingsMessage("");
    if (!authUsername.trim()) {
      setSettingsMessage("Enter a username to save.");
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      setSettingsMessage("Missing Supabase config.");
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({
      data: { display_name: authUsername.trim() }
    });
    if (updateError) {
      setSettingsMessage(updateError.message);
      return;
    }
    setSettingsMessage("Profile updated.");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    runSearch(gameName, tagLine);
  };

  const handleRosterSelect = (player) => {
    setGameName(player.name);
    setTagLine(player.tagline);
    setActiveSection("tracker");
    runSearch(player.name, player.tagline);
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!chatMessage.trim()) {
      setChatError("Enter a message.");
      return;
    }
    const token = await getFreshToken();
    if (!token) {
      setChatError("Please log in to chat.");
      return;
    }

    const displayName =
      authUser?.user_metadata?.display_name ||
      authUser?.email?.split("@")[0] ||
      "Member";

    setChatError("");
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      name: displayName,
      message: chatMessage.trim(),
      created_at: new Date().toISOString()
    };
    setChatMessages((prev) => [...prev, optimisticMessage]);
    const response = await fetch("/api/chat/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        name: displayName,
        message: chatMessage.trim()
      })
    });
    const data = await response.json();

    if (!response.ok) {
      setChatError(data?.error || "Failed to send message.");
      setChatMessages((prev) => prev.filter((entry) => entry.id !== tempId));
      return;
    }

    if (data?.message) {
      setChatMessages((prev) => [
        ...prev.filter((entry) => entry.id !== tempId),
        data.message
      ]);
      lastChatIdRef.current = data.message.id;
    }
    setChatMessage("");
  };

  const loadLiveIntel = async () => {
    if (!liveIntelTarget) {
      return;
    }
    setLiveIntelLoading(true);
    setLiveIntelError("");
    try {
      const response = await fetch(
        `/api/live-intel?gameName=${encodeURIComponent(
          liveIntelTarget.name
        )}&tagLine=${encodeURIComponent(
          liveIntelTarget.tagline
        )}&region=${region}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load live intel.");
      }
      setLiveIntelData(data);
    } catch (error) {
      setLiveIntelError(error.message);
      setLiveIntelData(null);
    } finally {
      setLiveIntelLoading(false);
    }
  };

  const rankedEntries = result?.ranked || [];
  const masteryTop = result?.masteryTop || [];
  const challenges = result?.challenges;
  const activeGame = result?.activeGame;
  const insights = result?.insights;
  const matchSummaries = result?.matchSummaries || [];
  const ddVersion = result?.ddVersion;
  const roster = dashboardData?.roster?.length ? dashboardData.roster : TEAM_ROSTER;
  const comps = dashboardData?.comps?.length ? dashboardData.comps : TEAM_COMPS;
  const logs = dashboardData?.logs?.length ? dashboardData.logs : MATCH_LOGS;
  const notes = dashboardData?.notes?.length ? dashboardData.notes : [];
  const tournaments = dashboardData?.tournaments?.length
    ? dashboardData.tournaments
    : [];
  const schedule = dashboardData?.schedule?.length ? dashboardData.schedule : [];
  const drafts = dashboardData?.drafts?.length ? dashboardData.drafts : [];
  const opponents = dashboardData?.opponents?.length
    ? dashboardData.opponents
    : [];
  const skinGoals = dashboardData?.skinGoals?.length
    ? dashboardData.skinGoals
    : [];
  const practiceGoals = dashboardData?.practiceGoals?.length
    ? dashboardData.practiceGoals
    : [];
  const metaWatchlist = dashboardData?.metaWatchlist?.length
    ? dashboardData.metaWatchlist
    : [];
  const rosterKey = roster.map(buildRosterKey).join("|");
  const skinGoalsKey = skinGoals
    .map((goal) => `${goal.player_name}#${goal.tagline}:${goal.target_rank}`)
    .join("|");
  const announcementList = useMemo(() => {
    if (!announcements.length) {
      return [];
    }
    const isResult = (item) => item.emoji === "🥳" || item.emoji === "🥀";
    const isRankedMatch = (item) =>
      !isResult(item) ||
      (item.queueId &&
        RANKED_QUEUE_IDS.has(item.queueId)) ||
      (item.queueName || "").toLowerCase().includes("ranked");
    const filtered = announcements.filter((item) => {
      const isClassicMessage =
        (item.message || "").toLowerCase().includes("classic") && isResult(item);
      return isRankedMatch(item) && !isClassicMessage;
    });
    const results = filtered.filter(isResult);
    const others = filtered.filter((item) => !isResult(item));
    return [...results, ...others];
  }, [announcements]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setAuthError("Missing Supabase config.");
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user ?? null;
      if (user?.email && !ALLOWED_EMAILS.has(user.email.toLowerCase())) {
        await supabase.auth.signOut();
        setAuthError("Access denied.");
        setAuthUser(null);
        setAuthToken("");
        setAuthLoading(false);
        return;
      }
      setAuthUser(user);
      setAuthToken(data.session?.access_token ?? "");
      setAuthLoading(false);
      if (user?.user_metadata?.display_name) {
        setAuthUsername(user.user_metadata.display_name);
      }
    });

    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      if (user?.email && !ALLOWED_EMAILS.has(user.email.toLowerCase())) {
        await supabase.auth.signOut();
        setAuthError("Access denied.");
        setAuthUser(null);
        setAuthToken("");
        return;
      }
      setAuthUser(user);
      setAuthToken(session?.access_token ?? "");
      if (user?.user_metadata?.display_name) {
        setAuthUsername(user.user_metadata.display_name);
      }
    });

    return () => {
      data?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!theme) {
      return;
    }
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("teamTheme", theme);
  }, [theme]);

  useEffect(() => {
    if (!liveIntelTarget && roster.length) {
      setLiveIntelTarget(roster[0]);
    }
  }, [liveIntelTarget, roster]);


  useEffect(() => {
    const loadDashboard = async () => {
      setDashboardLoading(true);
      setDashboardError("");
      try {
        const token = await getFreshToken();
        if (!token) {
          setDashboardLoading(false);
          return;
        }
        const response = await fetch("/api/dashboard/overview", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load dashboard.");
        }
        setDashboardData(data);
      } catch (loadError) {
        setDashboardError(loadError.message);
      } finally {
        setDashboardLoading(false);
      }
    };

    loadDashboard();
  }, [authToken]);

  useEffect(() => {
    let active = true;
    const loadMessages = async () => {
      try {
        const token = await getFreshToken();
        if (!token) {
          return;
        }
        const response = await fetch("/api/chat/messages", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load chat.");
        }

        if (!active) {
          return;
        }

        const messages = data.messages || [];
        setChatMessages(messages);

        const latestId = messages.length ? messages[messages.length - 1].id : null;
        if (latestId && lastChatIdRef.current && latestId !== lastChatIdRef.current) {
          const lastIndex = messages.findIndex(
            (entry) => entry.id === lastChatIdRef.current
          );
          const newCount = lastIndex >= 0 ? messages.length - lastIndex - 1 : messages.length;
          if (!chatOpen && newCount > 0) {
            setChatUnread((prev) => prev + newCount);
            playChatBeep(audioContextRef);
          }
        }

        if (!lastChatIdRef.current && latestId) {
          lastChatIdRef.current = latestId;
        } else if (latestId) {
          lastChatIdRef.current = latestId;
        }

        if (chatOpen) {
          requestAnimationFrame(() => {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
          });
        }
      } catch (loadError) {
        if (active) {
          setChatError(loadError.message);
        }
      }
    };

    loadMessages();
    const interval = setInterval(loadMessages, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [authToken, chatOpen]);

  useEffect(() => {
    const loadNews = async () => {
      try {
        const response = await fetch("/api/news");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load news.");
        }
        setNewsItems(data.items || []);
        setNewsError("");
      } catch (loadError) {
        setNewsError(loadError.message);
      }
    };

    loadNews();
  }, []);

  useEffect(() => {
    if (activeSection !== "news") {
      return;
    }
    const timer = setTimeout(() => {
      window.twttr?.widgets?.load();
    }, 0);
    return () => clearTimeout(timer);
  }, [activeSection, newsItems]);

  useEffect(() => {
    const timer = setInterval(() => {
      setStatusNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "mlg.announcements",
      JSON.stringify(announcements)
    );
  }, [announcements]);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const response = await fetch("/api/version");
        const data = await response.json();
        if (!response.ok) {
          return;
        }
        const storedVersion =
          window.localStorage.getItem("mlg.lastSeenVersion") || "0.0.0";
        if (data?.version) {
          setAppVersion(data.version);
          if (!storedVersion || storedVersion === "0.0.0") {
            window.localStorage.setItem("mlg.lastSeenVersion", data.version);
            setUpdateAvailable(false);
            return;
          }
          if (data.version !== storedVersion) {
            setLatestVersion(data.version);
            setUpdateAvailable(true);
          } else {
            setUpdateAvailable(false);
            window.localStorage.setItem("mlg.lastSeenVersion", data.version);
          }
        }
      } catch (error) {
        return;
      }
    };

    checkVersion();
    const timer = setInterval(checkVersion, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (chatOpen) {
      setChatUnread(0);
      const latest = chatMessages.length
        ? chatMessages[chatMessages.length - 1].created_at
        : null;
      if (latest) {
        lastSeenAtRef.current = latest;
      }
    }
  }, [chatOpen, chatMessages]);

  useEffect(() => {
    lastTeamRegionRef.current = region;

    const loadTeamStats = async () => {
      const cachedPayload = JSON.parse(
        window.localStorage.getItem("mlg.teamStatsCache") || "{}"
      );
      const cachedStats = cachedPayload?.data || {};
      const cachedAt = cachedPayload?.timestamp || 0;
      const cacheFresh =
        Date.now() - cachedAt < 30 * 1000 && !cachedPayload?.hasErrors;
      if (Object.keys(cachedStats).length) {
        setTeamStats(cachedStats);
      }
      if (cacheFresh) {
        setTeamLoading(false);
        return;
      }
      setTeamLoading(true);

      const responses = await Promise.all(
        roster.map(async (player) => {
          const response = await fetch(
            `/api/summoner?gameName=${encodeURIComponent(
              player.name
            )}&tagLine=${encodeURIComponent(
              player.tagline
            )}&region=${region}&status=1&summary=1`
          );
          const data = await response.json();
          if (!response.ok) {
            return { key: buildRosterKey(player), error: data?.error };
          }
          return { key: buildRosterKey(player), data };
        })
      );

      const nextStats = {};
      let hasErrors = false;
      const nextAnnouncements = [];
      const tierCache = JSON.parse(
        window.localStorage.getItem("mlg.tierCache") || "{}"
      );
      const goalCache = JSON.parse(
        window.localStorage.getItem("mlg.skinGoalCache") || "{}"
      );
      const announcedCache = JSON.parse(
        window.localStorage.getItem("mlg.announcedMatchCache") || "{}"
      );
      const goalMap = new Map(
        skinGoals.map((goal) => [
          `${goal.player_name}#${goal.tagline}`.toLowerCase(),
          goal
        ])
      );
      let matchBeepType = null;

      responses.forEach((entry) => {
        const cachedEntry = cachedStats[entry.key];
        let resolvedEntry =
          entry?.data || !cachedEntry ? entry : { ...cachedEntry, stale: true };

        if (entry?.error) {
          hasErrors = true;
        }

        if (cachedEntry?.data && entry?.data) {
          const cachedLast = getLastPlayedTimestamp(
            cachedEntry.data.status,
            cachedEntry.data.matchSummaries
          );
          const incomingLast = getLastPlayedTimestamp(
            entry.data.status,
            entry.data.matchSummaries
          );
          const shouldKeepCached =
            !incomingLast || (cachedLast && incomingLast < cachedLast);

          const incomingInGame = entry.data.status?.inGame === true;
          const mergedStatus = shouldKeepCached
            ? cachedEntry.data.status
            : entry.data.status;
          const mergedData = {
            ...entry.data,
            ranked:
              entry.data.ranked?.length || !cachedEntry.data.ranked?.length
                ? entry.data.ranked
                : cachedEntry.data.ranked,
            matchSummaries:
              entry.data.matchSummaries?.length ||
              !cachedEntry.data.matchSummaries?.length
                ? entry.data.matchSummaries
                : cachedEntry.data.matchSummaries,
            status: mergedStatus,
            activeGame: incomingInGame ? entry.data.activeGame : null
          };

          resolvedEntry = {
            ...entry,
            data: mergedData
          };
        }

        nextStats[entry.key] = resolvedEntry;

        const rankedEntry = pickPrimaryRank(resolvedEntry?.data?.ranked);
        const currentTier = rankedEntry?.tier || null;
        if (!currentTier) {
          return;
        }
        const cacheKey = entry.key.toLowerCase();
        const previousTier = tierCache[cacheKey] || null;
        if (previousTier && previousTier !== currentTier) {
          const delta =
            getTierOrder(currentTier) - getTierOrder(previousTier);
          if (delta !== 0) {
            const tierAnnouncementId = `tier:${cacheKey}:${currentTier}`;
            nextAnnouncements.push({
              id: tierAnnouncementId,
              emoji: delta > 0 ? "🥳" : "🥀",
              message: `${entry.key} ${
                delta > 0 ? "promoted" : "demoted"
              } from ${previousTier} to ${currentTier}.`,
              createdAt: Date.now()
            });
          }
        }
        tierCache[cacheKey] = currentTier;

        const goal = goalMap.get(cacheKey);
        if (goal) {
          const targetTierOrder = getTierOrder(goal.target_rank);
          const currentTierOrder = getTierOrder(currentTier);
          if (targetTierOrder && currentTierOrder >= targetTierOrder) {
            const rewardKey = `${cacheKey}-${goal.target_rank}`.toLowerCase();
            if (!goalCache[rewardKey]) {
              const goalMessage = `${entry.key} hit ${goal.target_rank} and earned ${goal.skin}.`;
              nextAnnouncements.push({
                id: `goal:${rewardKey}`,
                emoji: "🥳",
                message: goalMessage,
                createdAt: Date.now()
              });
              setSkinGoalPopup({
                id: `goal:${rewardKey}`,
                message: goalMessage,
                emoji: "🥳"
              });
              playSkinGoalChime(audioContextRef);
              if (authToken && !goal.completed_at) {
                fetch("/api/dashboard/skin-goals", {
                  method: "PATCH",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authToken}`
                  },
                  body: JSON.stringify({
                    id: goal.id,
                    player_name: goal.player_name,
                    tagline: goal.tagline,
                    target_rank: goal.target_rank,
                    skin: goal.skin,
                    notes: goal.notes || "",
                    completed_at: new Date().toISOString()
                  })
                }).catch(() => {});
              }
              goalCache[rewardKey] = true;
            }
          }
        }

        const lastMatch = resolvedEntry?.data?.matchSummaries?.[0];
        if (lastMatch?.matchId) {
          const lastMatchKey = `${cacheKey}`;
          const previousMatchId = announcedCache[lastMatchKey];
          const cachedLast = cachedEntry?.data
            ? getLastPlayedTimestamp(
                cachedEntry.data.status,
                cachedEntry.data.matchSummaries
              )
            : 0;
          const incomingLast = getLastPlayedTimestamp(
            resolvedEntry?.data?.status,
            resolvedEntry?.data?.matchSummaries
          );
          const isInGame = resolvedEntry?.data?.status?.inGame === true;
          const isNewerMatch =
            incomingLast && cachedLast ? incomingLast > cachedLast : Boolean(incomingLast);
          const matchEndTime =
            (lastMatch.gameCreation || 0) + (lastMatch.gameDuration || 0) * 1000;
          const justFinished =
            matchEndTime > 0 &&
            Date.now() - matchEndTime < ANNOUNCEMENT_WINDOW_MS;
          const shouldAnnounce = previousMatchId
            ? previousMatchId !== lastMatch.matchId &&
              isNewerMatch &&
              justFinished &&
              !isInGame
            : isNewerMatch && justFinished && !isInGame;

          if (shouldAnnounce) {
            const resultEmoji = lastMatch.win ? "🥳" : "🥀";
            const resultLabel = lastMatch.win ? "won" : "lost";
            const queueLabel = lastMatch.queueName || lastMatch.gameMode || "game";
            const kdaDeaths = Number.isFinite(lastMatch.deaths)
              ? lastMatch.deaths
              : 0;
            const kdaTotal = (lastMatch.kills || 0) + (lastMatch.assists || 0);
            const kdaRatio = kdaTotal / Math.max(1, kdaDeaths);
            const ranItDown = !lastMatch.win && kdaRatio < 1;
            const carriedGame =
              lastMatch.win && kdaRatio >= 3 && kdaTotal >= 10;
            const resultMessage = ranItDown
              ? `${entry.key} JUST RAN DOWN THEIR GAME.`
              : carriedGame
                ? `${entry.key} JUST CARRIED THEIR GAME!`
                : `${entry.key} ${resultLabel} a ${queueLabel} match.`;
            if (
              RANKED_QUEUE_IDS.has(lastMatch.queueId) ||
              (lastMatch.queueName || "").toLowerCase().includes("ranked")
            ) {
              nextAnnouncements.push({
                id: `match:${cacheKey}:${lastMatch.matchId}`,
                emoji: resultEmoji,
                message: resultMessage,
                createdAt: matchEndTime || Date.now(),
                queueId: lastMatch.queueId || null,
                queueName: lastMatch.queueName || null
              });
            }
            matchBeepType = lastMatch.win ? "win" : "loss";
          }
          if (lastMatch.matchId) {
            announcedCache[lastMatchKey] = lastMatch.matchId;
          }
        }
      });

      setTeamStats(nextStats);
      if (nextAnnouncements.length) {
        setAnnouncements((prev) => mergeAnnouncements(prev, nextAnnouncements));
      }
      window.localStorage.setItem("mlg.tierCache", JSON.stringify(tierCache));
      window.localStorage.setItem(
        "mlg.teamStatsCache",
        JSON.stringify({
          timestamp: hasErrors ? cachedAt || 0 : Date.now(),
          data: nextStats,
          hasErrors
        })
      );
      window.localStorage.setItem(
        "mlg.skinGoalCache",
        JSON.stringify(goalCache)
      );
      window.localStorage.setItem(
        "mlg.announcedMatchCache",
        JSON.stringify(announcedCache)
      );
      if (matchBeepType) {
        playMatchBeep(audioContextRef, matchBeepType);
      }
      setTeamLoading(false);
    };

    loadTeamStats();
    const interval = setInterval(loadTeamStats, 30000);
    return () => clearInterval(interval);
  }, [region, rosterKey, skinGoalsKey]);

 

  if (authLoading) {
    return (
      <main>
        <section className="hero">
          <h1>LoL Tracker</h1>
          <div className="accent-line" />
          <p>Loading...</p>
        </section>
      </main>
    );
  }

  if (!authUser) {
    return (
      <main>
        <section className="hero">
          <h1>Team Login</h1>
          <div className="accent-line" />
          <p>Sign in to access the team dashboard.</p>
        </section>
        <section className="card card-strong fade-in">
          {authError ? <p className="error">{authError}</p> : null}
          <div className="auth-toggle">
            <button
              type="button"
              className={authMode === "login" ? "pill pill-soft" : "pill"}
              onClick={() => setAuthMode("login")}
            >
              Log in
            </button>
            <button
              type="button"
              className={authMode === "signup" ? "pill pill-soft" : "pill"}
              onClick={() => setAuthMode("signup")}
            >
              Create account
            </button>
          </div>
          <form
            className="form"
            onSubmit={authMode === "login" ? handleLogin : (event) => {
              event.preventDefault();
              handleSignup();
            }}
          >
            <input
              placeholder="Email"
              type="email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
            />
            {authMode === "signup" ? (
              <input
                placeholder="Username"
                value={authUsername}
                onChange={(event) => setAuthUsername(event.target.value)}
              />
            ) : null}
            <input
              placeholder="Password"
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
            />
            <button type="submit">
              {authMode === "login" ? "Log in" : "Create account"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="hero">
        <h1>Molgarian Hub</h1>
        <div className="hero-actions">
          <span className="tagline">{authUser.email}</span>
          <button type="button" onClick={handleLogout}>
            Log out
          </button>
        </div>
        <div className="accent-line" />
        <p>
          Team dashboard, tracker, and match insights in one focused workspace.
        </p>
      </section>

      <div className="app-shell">
        <aside className="app-nav">
          <button
            type="button"
            className={activeSection === "dashboard" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveSection("dashboard")}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={activeSection === "tracker" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveSection("tracker")}
          >
            Player tracker
          </button>
          <button
            type="button"
            className={activeSection === "intel" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveSection("intel")}
          >
            Live intel
          </button>
          <button
            type="button"
            className={activeSection === "prep" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveSection("prep")}
          >
            Prep library
          </button>
          <button
            type="button"
            className={activeSection === "drafts" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveSection("drafts")}
          >
            Draft board
          </button>
          <button
            type="button"
            className={activeSection === "opponents" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveSection("opponents")}
          >
            Opponents
          </button>
          <button
            type="button"
            className={activeSection === "schedule" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveSection("schedule")}
          >
            Schedule
          </button>
          <button
            type="button"
            className={activeSection === "history" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveSection("history")}
          >
            Match log
          </button>
          <button
            type="button"
            className={activeSection === "tournaments" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveSection("tournaments")}
          >
            Tournaments
          </button>
          <button
            type="button"
            className={activeSection === "news" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveSection("news")}
          >
            Live news
          </button>
          <button
            type="button"
            className={activeSection === "settings" ? "nav-item active" : "nav-item"}
            onClick={() => setActiveSection("settings")}
          >
            Settings
          </button>
          {!isDesktopApp ? (
            <button
              type="button"
              className={activeSection === "download" ? "nav-item active" : "nav-item"}
              onClick={() => setActiveSection("download")}
            >
              Download app
            </button>
          ) : null}
          <a className="nav-item" href="/admin">
            Admin
          </a>
        </aside>

        <section className="app-main">
          {activeSection === "dashboard" ? (
            <section className="card card-strong fade-in">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Team dashboard</p>
                  <h2>Molgarian Team Hub</h2>
                </div>
                <span className="pill">Live season</span>
              </div>
              <div className="announcement-panel">
                <div className="announcement-head">
                  <strong>Rank updates</strong>
                </div>
                {announcementList.length ? (
                  <div className="announcement-list">
                    {announcementList.map((item) => (
                      <div key={item.id} className="announcement-row">
                        <span className="announcement-emoji">
                          {item.emoji}
                        </span>
                        <div>
                          {item.message}
                          <div className="match-meta">
                            {item.createdAt
                              ? formatTimeAgo(item.createdAt)
                              : "Just now"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="match-meta">No updates yet.</p>
                )}
              </div>
              {dashboardError ? (
                <p className="error">{dashboardError}</p>
              ) : null}
              {dashboardLoading ? (
                <p className="match-meta">Loading dashboard data...</p>
              ) : null}
              <div className="grid grid-2">
                <div className="stat-card">
                  <div className="stat-title">Record</div>
                  <div className="stat-value">12W - 5L</div>
                  <div className="match-meta">+7 map differential</div>
                </div>
                <div className="stat-card">
                  <div className="stat-title">Scrim score</div>
                  <div className="stat-value">68%</div>
                  <div className="match-meta">Last 20 games</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-title">Player cards</div>
                <div className="player-grid">
                  {roster.map((player) => {
                    const key = buildRosterKey(player);
                    const entry = teamStats[key];
                    const rankEntry = pickPrimaryRank(entry?.data?.ranked);
                    const rankLabel = formatRankLabel(rankEntry);
                    const statusLabel = entry?.data
                      ? formatStatusLabel(
                          entry.data.status,
                          entry.data.activeGame,
                          entry.data.matchSummaries,
                          statusNow
                        )
                      : "Offline";
                    const rankedRecord = getRankedRecord(entry?.data?.ranked);
                    return (
                      <div key={key} className="player-card">
                        <div>
                          <strong>{player.role}</strong>
                          <div className="match-meta">
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => handleRosterSelect(player)}
                            >
                              {player.name}#{player.tagline}
                            </button>
                          </div>
                        </div>
                        <div className="match-meta">{rankLabel}</div>
                        <div className="match-meta">{statusLabel}</div>
                        <div className="match-meta">
                          {rankedRecord
                            ? `W-L: ${rankedRecord.wins}-${rankedRecord.losses} ${rankedRecord.queue.replace(
                                "Ranked ",
                                ""
                              )}`
                            : "Ranked record: —"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-title">Skin goals</div>
                {skinGoals.length ? (
                  <div className="log-list">
                    {skinGoals.map((goal) => (
                      <div key={goal.id} className="log-row">
                        <div>
                          <div className="inline-row">
                            <strong>
                              {goal.player_name}#{goal.tagline}
                            </strong>
                            {goal.completed_at ? (
                              <span className="pill pill-win">Completed ✓</span>
                            ) : null}
                          </div>
                          <div className="match-meta">
                            Target: {goal.target_rank} · Reward: {goal.skin}
                          </div>
                          <div className="match-meta">
                            Set at: {formatDateLabel(goal.created_at)}
                            {goal.completed_at
                              ? ` · Completed at: ${formatDateLabel(
                                  goal.completed_at
                                )}`
                              : ""}
                          </div>
                          {goal.notes ? (
                            <div className="match-meta">{goal.notes}</div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="match-meta">No skin goals yet.</p>
                )}
              </div>
              <div className="stat-card">
                <div className="stat-title">Practice goals</div>
                {practiceGoals.length ? (
                  <div className="log-list">
                    {practiceGoals.map((goal) => (
                      <div key={goal.id} className="log-row">
                        <div>
                          <strong>
                            {goal.player_name}#{goal.tagline}
                          </strong>
                          <div className="match-meta">
                            {goal.goal} · {goal.status || "Active"}
                          </div>
                          {goal.timeframe ? (
                            <div className="match-meta">{goal.timeframe}</div>
                          ) : null}
                          {goal.notes ? (
                            <div className="match-meta">{goal.notes}</div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="match-meta">No practice goals yet.</p>
                )}
              </div>
              <div className="stat-card">
                <div className="stat-title">Meta watchlist</div>
                {metaWatchlist.length ? (
                  <div className="log-list">
                    {metaWatchlist.map((entry) => (
                      <div key={entry.id} className="log-row">
                        <div>
                          <strong>{entry.champion}</strong>
                          <div className="match-meta">
                            {entry.role ? `${entry.role} · ` : ""}
                            {entry.priority || "Medium"} priority
                          </div>
                          {entry.reason ? (
                            <div className="match-meta">
                              Reason: {entry.reason}
                            </div>
                          ) : null}
                          {entry.notes ? (
                            <div className="match-meta">{entry.notes}</div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="match-meta">No meta watchlist yet.</p>
                )}
              </div>
            </section>
          ) : null}

          {activeSection === "prep" ? (
            <section className="card card-strong fade-in">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Prep library</p>
                  <h2>Team compositions</h2>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-title">Situational comps</div>
                <div className="comp-list">
                  {comps.map((comp) => (
                    <div key={comp.id ?? comp.label} className="comp-row">
                      <div>
                        <strong>{comp.label}</strong>
                        <div className="match-meta">{comp.situation}</div>
                        {comp.notes ? (
                          <div className="match-meta">{comp.notes}</div>
                        ) : null}
                      </div>
                      <div className="comp-champs">
                        {(comp.core || []).map((champion) => (
                          <span key={champion} className="pill pill-soft">
                            {champion}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === "opponents" ? (
            <section className="card card-strong fade-in">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Opponents</p>
                  <h2>Scouting notes</h2>
                </div>
              </div>
              {opponents.length ? (
                <div className="grid grid-2">
                  {opponents.map((entry) => (
                    <div key={entry.id} className="stat-card">
                      <div className="stat-title">{entry.opponent}</div>
                      {entry.tendencies ? (
                        <p className="match-meta">{entry.tendencies}</p>
                      ) : null}
                      {entry.win_conditions ? (
                        <p className="match-meta">
                          Win conditions: {entry.win_conditions}
                        </p>
                      ) : null}
                      {entry.draft_notes ? (
                        <p className="match-meta">
                          Draft: {entry.draft_notes}
                        </p>
                      ) : null}
                      {entry.pocket_picks ? (
                        <p className="match-meta">
                          Pocket picks: {entry.pocket_picks}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="match-meta">No opponent profiles yet.</p>
              )}
            </section>
          ) : null}

          {activeSection === "schedule" ? (
            <section className="card card-strong fade-in">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Schedule</p>
                  <h2>Upcoming sessions</h2>
                </div>
              </div>
              {schedule.length ? (
                <div className="log-list">
                  {schedule.map((entry) => (
                    <div key={entry.id} className="log-row">
                      <div>
                        <strong>{entry.title}</strong>
                        <div className="match-meta">
                          {entry.type} ·{" "}
                          {entry.starts_at
                            ? entry.starts_at.split("T")[0]
                            : "TBD"}
                        </div>
                        {entry.opponent ? (
                          <div className="match-meta">{entry.opponent}</div>
                        ) : null}
                        {entry.notes ? (
                          <div className="match-meta">{entry.notes}</div>
                        ) : null}
                      </div>
                      <span className="pill">{entry.type}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="match-meta">No events scheduled yet.</p>
              )}
            </section>
          ) : null}

          {activeSection === "drafts" ? (
            <section className="card card-strong fade-in">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Draft board</p>
                  <h2>Plan your picks</h2>
                </div>
              </div>
              {drafts.length ? (
                <div className="grid grid-2">
                  {drafts.map((entry) => (
                    <div key={entry.id} className="stat-card">
                      <div className="stat-title">{entry.label}</div>
                      <p className="match-meta">
                        Blue bans: {(entry.blue_bans || []).join(", ") || "—"}
                      </p>
                      <p className="match-meta">
                        Blue picks: {(entry.blue_picks || []).join(", ") || "—"}
                      </p>
                      <p className="match-meta">
                        Red bans: {(entry.red_bans || []).join(", ") || "—"}
                      </p>
                      <p className="match-meta">
                        Red picks: {(entry.red_picks || []).join(", ") || "—"}
                      </p>
                      {entry.notes ? (
                        <p className="match-meta">{entry.notes}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="match-meta">No draft boards yet.</p>
              )}
            </section>
          ) : null}

          {activeSection === "tournaments" ? (
            <section className="card card-strong fade-in">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Tournaments</p>
                  <h2>Upcoming & ongoing</h2>
                </div>
              </div>
              <div className="log-list">
                {tournaments.length ? (
                  tournaments.map((entry) => (
                    <div key={entry.id} className="log-row">
                      <div>
                        <strong>{entry.name}</strong>
                        <div className="match-meta">
                          {entry.status} ·{" "}
                          {entry.starts_at
                            ? entry.starts_at.split("T")[0]
                            : "TBD"}
                        </div>
                        {entry.starts_at ? (() => {
                          const countdown = formatCountdown(
                            new Date(entry.starts_at).getTime(),
                            statusNow
                          );
                          return countdown ? (
                            <div className="match-meta">
                              Starts in {countdown}
                            </div>
                          ) : null;
                        })() : null}
                        {entry.link ? (
                          <div className="match-meta">
                            <a
                              href={normalizeLink(entry.link)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {entry.link}
                            </a>
                          </div>
                        ) : null}
                        {entry.location ? (
                          <div className="match-meta">{entry.location}</div>
                        ) : null}
                        {entry.notes ? (
                          <div className="match-meta">{entry.notes}</div>
                        ) : null}
                      </div>
                      <span className="pill">{entry.status}</span>
                    </div>
                  ))
                ) : (
                  <p className="match-meta">No tournaments yet.</p>
                )}
              </div>
            </section>
          ) : null}

          {activeSection === "intel" ? (
            <section className="card card-strong fade-in">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Live intel</p>
                  <h2>Opponent scouting</h2>
                </div>
                <span className="pill">Ranked only</span>
              </div>
              <div className="form form-inline">
                <select
                  value={
                    liveIntelTarget
                      ? `${liveIntelTarget.name}#${liveIntelTarget.tagline}`
                      : ""
                  }
                  onChange={(event) => {
                    const [name, tagline] = event.target.value.split("#");
                    const next = roster.find(
                      (entry) => entry.name === name && entry.tagline === tagline
                    );
                    setLiveIntelTarget(next || null);
                  }}
                >
                  {roster.map((player) => (
                    <option
                      key={`${player.name}#${player.tagline}`}
                      value={`${player.name}#${player.tagline}`}
                    >
                      {player.name}#{player.tagline}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={loadLiveIntel}>
                  Load live intel
                </button>
              </div>
              {liveIntelError ? <p className="error">{liveIntelError}</p> : null}
              {liveIntelLoading ? (
                <p className="match-meta">Scanning live match...</p>
              ) : null}
              {liveIntelData && !liveIntelData.activeGame ? (
                <p className="match-meta">
                  No active game found for this player.
                </p>
              ) : null}
              {liveIntelData?.participants?.length ? (
                <div className="intel-grid">
                  {[100, 200].map((teamId) => {
                    const teamPlayers = liveIntelData.participants.filter(
                      (player) => player.teamId === teamId
                    );
                    const isFriendly = liveIntelData.friendlyTeamId === teamId;
                    return (
                      <div
                        key={teamId}
                        className={`intel-team ${isFriendly ? "friendly" : "enemy"}`}
                      >
                        <div className="intel-team-head">
                          <strong>{isFriendly ? "Your team" : "Opponents"}</strong>
                          <span className="match-meta">
                            {teamPlayers.length} players
                          </span>
                        </div>
                        {teamPlayers.map((player) => (
                          <div key={player.puuid} className="intel-card">
                            <div className="intel-main">
                              <div>
                                <strong>{player.riotId}</strong>
                                <div className="match-meta">
                                  {player.championName || "Unknown"} ·{" "}
                                  {player.mainRole || "Role unknown"}
                                </div>
                                {player.stats ? (
                                  <div className="match-meta">
                                    Avg K/D/A: {player.stats.avgKills}/
                                    {player.stats.avgDeaths}/
                                    {player.stats.avgAssists} · KDA{" "}
                                    {player.stats.kdaRatio.toFixed(2)}
                                  </div>
                                ) : null}
                              </div>
                              {player.championImage ? (
                                <img
                                  src={`https://ddragon.leagueoflegends.com/cdn/${liveIntelData.ddVersion}/img/champion/${player.championImage}`}
                                  alt={player.championName || "Champion"}
                                  className="intel-champ"
                                />
                              ) : null}
                            </div>
                            {player.traits?.length ? (
                              <div className="intel-traits">
                                {player.traits.map((trait) => (
                                  <span key={trait} className="pill">
                                    {trait}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="match-meta">No traits yet.</div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          ) : null}

          {activeSection === "news" ? (
            <section className="card card-strong fade-in">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Live news</p>
                  <h2>League feed</h2>
                </div>
              </div>
              <Script
                src="https://platform.twitter.com/widgets.js"
                strategy="afterInteractive"
                onLoad={() => window.twttr?.widgets?.load()}
              />
              {newsError ? <p className="error">{newsError}</p> : null}
              {newsItems.length ? (
                <div className="news-list">
                  {newsItems.map((item) => (
                    <div
                      key={item.link || item.title}
                      className={`news-row${item.image ? " with-image" : ""}`}
                    >
                      {item.image ? (
                        <img
                          className="news-thumb"
                          src={item.image}
                          alt=""
                          loading="lazy"
                        />
                      ) : null}
                      <div className="news-content">
                        {item.link ? (
                          <a
                            className="link-button"
                            href={item.link}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {item.title}
                          </a>
                        ) : (
                          <p>{item.title}</p>
                        )}
                        <span className="tagline">
                          {item.published
                            ? (() => {
                                const parsedTime = new Date(item.published).getTime();
                                return Number.isFinite(parsedTime)
                                  ? formatTimeAgo(parsedTime)
                                  : "Just now";
                              })()
                            : "Just now"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="match-meta">No feed items yet.</p>
              )}
            </section>
          ) : null}

          {activeSection === "settings" ? (
            <section className="card card-strong fade-in">
              <div className="section-head">
                <div>
                  <p className="eyebrow">User settings</p>
                  <h2>Profile & theme</h2>
                </div>
              </div>
              {settingsMessage ? (
                <p className="match-meta">{settingsMessage}</p>
              ) : null}
              <div className="grid grid-2">
                <div className="stat-card">
                  <div className="stat-title">Profile</div>
                  <div className="form">
                    <input
                      value={authUsername}
                      onChange={(event) => setAuthUsername(event.target.value)}
                      placeholder="Username"
                    />
                    <button type="button" onClick={handleUpdateProfile}>
                      Save profile
                    </button>
                  </div>
                  <p className="match-meta">
                    Signed in as {authUser.email}
                  </p>
                </div>
                <div className="stat-card">
                  <div className="stat-title">Theme</div>
                  <div className="theme-grid">
                    {THEME_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={
                          theme === option.id
                            ? "theme-card active"
                            : "theme-card"
                        }
                        onClick={() => setTheme(option.id)}
                      >
                        <div className={`theme-swatch ${option.id}`} />
                        <div>
                          <strong>{option.name}</strong>
                          <div className="match-meta">{option.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-title">Overlay</div>
                  {!isDesktopApp ? (
                    <p className="match-meta">
                      Overlay controls are available in the desktop app.
                    </p>
                  ) : (
                    <div className="form">
                      <button type="button" onClick={handleOverlayToggle}>
                        Toggle overlay
                      </button>
                      <input
                        value={overlayShortcutInput}
                        onChange={(event) =>
                          setOverlayShortcutInput(event.target.value)
                        }
                        placeholder="Ctrl+O"
                      />
                      <button type="button" onClick={handleOverlayShortcutSave}>
                        Save hotkey
                      </button>
                    </div>
                  )}
                  <p className="match-meta">
                    Active hotkey:{" "}
                    {overlayShortcutActive
                      ? formatOverlayShortcut(overlayShortcutActive)
                      : "Not set"}
                  </p>
                  {overlayShortcutStatus ? (
                    <p className="match-meta">{overlayShortcutStatus}</p>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === "download" && !isDesktopApp ? (
            <section className="card card-strong fade-in">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Download</p>
                  <h2>Get the desktop app</h2>
                </div>
              </div>
              <p className="match-meta">
                Install the latest Windows build from GitHub Releases. Updates
                will download automatically when you reopen the app.
              </p>
              <a
                className="download-button"
                href="https://github.com/MainTez/mlg/releases/latest"
                target="_blank"
                rel="noreferrer"
              >
                Download installer
              </a>
              <p className="match-meta">
                If Windows warns about the installer, click "More info" → "Run
                anyway".
              </p>
            </section>
          ) : null}

          {activeSection === "history" ? (
            <section className="card card-strong fade-in">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Match log</p>
                  <h2>Scrim history</h2>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-title">Latest scrim log</div>
                <div className="log-list">
                  {logs.map((log) => (
                    <div key={log.id ?? log.opponent} className="log-row">
                      <div>
                        <strong>{log.opponent}</strong>
                        <div className="match-meta">{formatLogDate(log)}</div>
                      </div>
                      <div
                        className={`pill ${
                          log.result === "Win" ? "pill-win" : "pill-loss"
                        }`}
                      >
                        {log.result} {log.score}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {activeSection === "tracker" ? (
            <section className="card card-strong fade-in">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Player tracker</p>
                  <h2>Summoner lookup</h2>
                </div>
              </div>
              <form className="form" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="gameName">Game name</label>
                  <input
                    id="gameName"
                    value={gameName}
                    onChange={(event) => setGameName(event.target.value)}
                    placeholder="e.g. MainTez"
                  />
                </div>
                <div>
                  <label htmlFor="tagLine">Tagline</label>
                  <input
                    id="tagLine"
                    value={tagLine}
                    onChange={(event) => setTagLine(event.target.value)}
                    placeholder="e.g. MLG"
                  />
                </div>

                <div>
                  <label htmlFor="region">Region</label>
                  <select
                    id="region"
                    value={region}
                    onChange={(event) => setRegion(event.target.value)}
                  >
                    {REGIONS.map((regionOption) => (
                      <option key={regionOption.id} value={regionOption.id}>
                        {regionOption.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button type="submit" disabled={loading}>
                  {loading ? "Checking..." : "Find summoner"}
                </button>
              </form>

              {error ? <p className="error">{error}</p> : null}

              {result ? (
                <div className="result fade-in" ref={resultRef}>
                  <h2>
                    {result.riotId?.gameName}#{result.riotId?.tagLine}
                  </h2>
                  <p>
                    Summoner: {result.name} · Level {result.summonerLevel} · Profile
                    icon {result.profileIconId}
                  </p>
                  <p>PUUID: {result.puuid}</p>
                  <div className="grid grid-2">
                    <div className="stat-card">
                      <div className="stat-title">Match winrate</div>
                      <div className="stat-value">
                        {insights?.summary?.games
                          ? formatPercent(insights.summary.winrate)
                          : "—"}
                      </div>
                      <div className="match-meta">
                        {insights?.summary?.wins ?? 0} wins ·{" "}
                        {insights?.summary?.games ?? 0} games
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-title">Most played champ</div>
                      <div className="inline-row">
                        {insights?.mostPlayedChampion?.championImage && ddVersion ? (
                          <img
                            className="icon icon-sm"
                            src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${insights.mostPlayedChampion.championImage}`}
                            alt={insights.mostPlayedChampion.championName}
                          />
                        ) : null}
                        <div className="stat-value">
                          {insights?.mostPlayedChampion?.championName || "—"}
                        </div>
                      </div>
                      <div className="match-meta">
                        {insights?.mostPlayedChampion?.games ?? 0} games
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-title">Highest winrate champ</div>
                      <div className="inline-row">
                        {insights?.highestWinrateChampion?.championImage && ddVersion ? (
                          <img
                            className="icon icon-sm"
                            src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${insights.highestWinrateChampion.championImage}`}
                            alt={insights.highestWinrateChampion.championName}
                          />
                        ) : null}
                        <div className="stat-value">
                          {insights?.highestWinrateChampion?.championName || "—"}
                        </div>
                      </div>
                      <div className="match-meta">
                        {insights?.highestWinrateChampion?.games ?? 0} games ·{" "}
                        {insights?.highestWinrateChampion
                          ? formatPercent(insights.highestWinrateChampion.winrate)
                          : "—"}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-title">Lowest winrate champ</div>
                      <div className="inline-row">
                        {insights?.lowestWinrateChampion?.championImage && ddVersion ? (
                          <img
                            className="icon icon-sm"
                            src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${insights.lowestWinrateChampion.championImage}`}
                            alt={insights.lowestWinrateChampion.championName}
                          />
                        ) : null}
                        <div className="stat-value">
                          {insights?.lowestWinrateChampion?.championName || "—"}
                        </div>
                      </div>
                      <div className="match-meta">
                        {insights?.lowestWinrateChampion?.games ?? 0} games ·{" "}
                        {insights?.lowestWinrateChampion
                          ? formatPercent(insights.lowestWinrateChampion.winrate)
                          : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-2">
                    <div className="stat-card">
                      <div className="stat-title">Most played with</div>
                      {insights?.mostPlayedWith?.length ? (
                        insights.mostPlayedWith.map((player) => (
                          <p key={player.name} className="match-meta">
                            {player.name} · {player.games} games
                          </p>
                        ))
                      ) : (
                        <p className="match-meta">No recent duo data.</p>
                      )}
                    </div>
                    <div className="stat-card">
                      <div className="stat-title">Active game</div>
                      {activeGame ? (
                        <p className="match-meta">
                          {activeGame.queueName || activeGame.gameMode} ·{" "}
                          {Math.floor(activeGame.gameLength / 60)}m ·{" "}
                          {activeGame.gameType}
                        </p>
                      ) : (
                        <p className="match-meta">Not in an active game.</p>
                      )}
                    </div>
                  </div>

                  <h3 className="section-title">Ranked</h3>
                  {rankedEntries.length === 0 ? (
                    <p>No ranked data yet.</p>
                  ) : (
                    <div className="grid grid-2">
                      {rankedEntries.map((entry) => (
                        <div key={entry.queueType} className="stat-card">
                          <div className="stat-title">
                            {QUEUE_LABELS[entry.queueType] || entry.queueType}
                          </div>
                          <div className="stat-value">
                            {formatRankLabel(entry)}
                          </div>
                          <div className="match-meta">
                            {entry.wins}W/{entry.losses}L
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <h3 className="section-title">Champion mastery</h3>
                  {masteryTop.length ? (
                    <div className="grid grid-2">
                      {masteryTop.map((entry) => (
                        <div key={entry.championId} className="stat-card">
                          <div className="inline-row">
                            {entry.championImage && ddVersion ? (
                              <img
                                className="icon"
                                src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${entry.championImage}`}
                                alt={entry.championName || "Champion icon"}
                              />
                            ) : null}
                            <div>
                              <div className="stat-title">
                                {entry.championName || `Champion ${entry.championId}`}
                              </div>
                              <div className="stat-value">
                                Level {entry.championLevel}
                              </div>
                            </div>
                          </div>
                          <div className="match-meta">
                            {entry.championPoints.toLocaleString()} points
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No mastery data yet.</p>
                  )}

                  <h3 className="section-title">Challenges</h3>
                  {challenges ? (
                    <div className="grid grid-2">
                      <div className="stat-card">
                        <div className="stat-title">Total points</div>
                        <div className="stat-value">
                          {challenges.totalPoints?.points ?? 0}
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-title">Challenges tracked</div>
                        <div className="stat-value">
                          {challenges.challenges?.length ?? 0}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p>No challenge data yet.</p>
                  )}

                  <h3 className="section-title">Recent matches</h3>
                  {matchSummaries.length ? (
                    <div className="grid">
                      {matchSummaries.map((match) => (
                        <div key={match.matchId} className="match-card">
                          <div className="match-header">
                            <strong>{match.win ? "Win" : "Loss"}</strong>
                            <span className="pill">
                              {match.queueName || match.gameMode}
                            </span>
                          </div>
                          <div className="inline-row">
                            {match.championImage && ddVersion ? (
                              <img
                                className="icon"
                                src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${match.championImage}`}
                                alt={match.championName}
                              />
                            ) : null}
                            <div>
                              <div className="stat-value">{match.championName}</div>
                              <div className="match-meta">
                                {match.kills}/{match.deaths}/{match.assists} ·{" "}
                                {match.cs} CS
                              </div>
                            </div>
                          </div>
                          <div className="match-meta">
                            {formatTimeAgo(match.gameCreation)} ·{" "}
                            {formatDuration(match.gameDuration)} · {match.gameType}
                          </div>
                          {match.items.length ? (
                            <div className="item-row">
                              {match.items
                                .filter((item) => item.image && ddVersion)
                                .map((item) => (
                                  <img
                                    key={`${match.matchId}-${item.id}`}
                                    className="icon icon-sm"
                                    src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/item/${item.image}`}
                                    alt={item.name}
                                    title={
                                      item.buildFrom?.length
                                        ? `${item.name} (builds from: ${item.buildFrom.join(
                                            ", "
                                          )})`
                                        : item.name
                                    }
                                  />
                                ))}
                            </div>
                          ) : null}
                          <button
                            type="button"
                            className="link-button match-detail-button"
                            onClick={() => setSelectedMatchId(match.matchId)}
                          >
                            View match
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p>No matches found.</p>
                  )}

                  {selectedMatch ? (
                    <div className="match-modal">
                      <button
                        type="button"
                        className="match-modal-backdrop"
                        onClick={() => setSelectedMatchId(null)}
                        aria-label="Close match details"
                      />
                      <div className="match-modal-card">
                        <div className="match-modal-header">
                          <div>
                            <h3>Match details</h3>
                            <p className="match-meta">
                              {selectedMatch.info?.gameMode} ·{" "}
                              {formatDuration(selectedMatch.info?.gameDuration)} ·{" "}
                              {selectedMatch.info?.gameCreation
                                ? formatTimeAgo(selectedMatch.info.gameCreation)
                                : "Just now"}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="pill pill-soft"
                            onClick={() => setSelectedMatchId(null)}
                          >
                            Close
                          </button>
                        </div>
                        <div className="match-team-grid">
                          {[100, 200].map((teamId) => {
                            const team = selectedMatch.info?.teams?.find(
                              (entry) => entry.teamId === teamId
                            );
                            const teamParticipants =
                              selectedMatch.info?.participants?.filter(
                                (player) => player.teamId === teamId
                              ) || [];
                            return (
                              <div
                                key={teamId}
                                className={`match-team ${
                                  teamId === 100 ? "team-blue" : "team-red"
                                }`}
                              >
                                <div className="match-team-header">
                                  <span className="pill">
                                    {teamId === 100 ? "Blue side" : "Red side"}
                                  </span>
                                  <span className="match-meta">
                                    {team?.win ? "Victory" : "Defeat"}
                                  </span>
                                </div>
                                <div className="match-player-list">
                                  {teamParticipants.map((player) => {
                                    const items = [
                                      player.item0,
                                      player.item1,
                                      player.item2,
                                      player.item3,
                                      player.item4,
                                      player.item5,
                                      player.item6
                                    ].filter((itemId) => itemId && itemId !== 0);
                                    const displayName = player.riotIdGameName
                                      ? `${player.riotIdGameName}#${player.riotIdTagline}`
                                      : player.summonerName;
                                    const score = selectedMatchScores.get(
                                      player.puuid
                                    );
                                    return (
                                      <div
                                        key={player.puuid}
                                        className="match-player-row"
                                      >
                                        <div className="match-player-main">
                                          {player.championName && ddVersion ? (
                                            <img
                                              className="icon"
                                              src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${player.championName}.png`}
                                              alt={player.championName}
                                            />
                                          ) : null}
                                          <div>
                                            <div className="stat-value">
                                              {displayName}
                                            </div>
                                            <div className="match-meta">
                                              {player.championName} ·{" "}
                                              {player.kills}/{player.deaths}/
                                              {player.assists} ·{" "}
                                              {player.totalMinionsKilled +
                                                player.neutralMinionsKilled}{" "}
                                              CS
                                            </div>
                                          </div>
                                        </div>
                                        <div className="match-player-stats">
                                          <span className="pill pill-soft">
                                            Score {score ?? 50}
                                          </span>
                                          <span className="match-meta">
                                            {Math.round(
                                              player.totalDamageDealtToChampions
                                            ).toLocaleString()}{" "}
                                            dmg ·{" "}
                                            {Math.round(player.goldEarned)}g ·{" "}
                                            {player.visionScore} vision
                                          </span>
                                          {items.length && ddVersion ? (
                                            <div className="item-row">
                                              {items.map((itemId) => (
                                                <img
                                                  key={`${player.puuid}-${itemId}`}
                                                  className="icon icon-sm"
                                                  src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/item/${itemId}.png`}
                                                  alt={`Item ${itemId}`}
                                                />
                                              ))}
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {result.warnings?.length ? (
                    <div className="result">
                      <h3 className="section-title">Warnings</h3>
                      {result.warnings.map((warning) => (
                        <p key={warning} className="error">
                          {warning}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}
        </section>
      </div>

      <button
        className="chat-toggle"
        type="button"
        onClick={() => {
          if (audioContextRef.current?.state === "suspended") {
            audioContextRef.current.resume();
          }
          setChatOpen((open) => !open);
        }}
      >
        <span>{chatOpen ? "Chat ◂" : "Chat ▸"}</span>
        {chatUnread ? <span className="chat-badge">{chatUnread}</span> : null}
      </button>
      {updateAvailable ? (
        <button
          className="update-toast"
          type="button"
          onClick={() => {
            if (latestVersion) {
              window.localStorage.setItem(
                "mlg.lastSeenVersion",
                latestVersion
              );
            }
            window.location.reload();
          }}
        >
          Update available{latestVersion ? ` · v${latestVersion}` : ""} → Reload
        </button>
      ) : null}
      <div className="version-badge">v{appVersion}</div>
      {skinGoalPopup ? (
        <div className="skin-goal-overlay">
          <div className="skin-goal-modal">
            <div className="skin-goal-emoji">{skinGoalPopup.emoji || "🥳"}</div>
            <div>
              <strong>Skin goal achieved!</strong>
              <p>{skinGoalPopup.message}</p>
            </div>
            <button
              type="button"
              className="skin-goal-close"
              onClick={() => setSkinGoalPopup(null)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
      <aside className={`chat-panel ${chatOpen ? "open" : ""}`}>
        <div className="chat-header">
          <strong>Team chat</strong>
          <span className="tagline">Live</span>
        </div>
        {chatError ? <p className="error">{chatError}</p> : null}
        {!authUser ? (
          <p className="match-meta">Log in to view team chat.</p>
        ) : (
          <>
            <div className="chat-body">
              {chatMessages.length ? (
                chatMessages.map((entry, index) => {
                  const seenMarker =
                    lastSeenAtRef.current &&
                    index > 0 &&
                    chatMessages[index - 1]?.created_at <=
                      lastSeenAtRef.current &&
                    entry.created_at > lastSeenAtRef.current;
                  return (
                    <div key={entry.id}>
                      {seenMarker ? (
                        <div className="chat-seen">Seen</div>
                      ) : null}
                      <div className="chat-message">
                        <div className="chat-meta">
                          <span className="chat-name">{entry.name}</span>
                          <span className="chat-time">
                            {formatChatTimestamp(entry.created_at)}
                          </span>
                        </div>
                        <span className="chat-text">{entry.message}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="match-meta">No messages yet.</p>
              )}
              <div ref={chatEndRef} />
            </div>
            <form className="chat-form" onSubmit={handleSendMessage}>
              <input
                value={chatMessage}
                onChange={(event) => setChatMessage(event.target.value)}
                placeholder={`Message as ${
                  authUser?.user_metadata?.display_name ||
                  authUser?.email?.split("@")[0] ||
                  "Member"
                }`}
              />
              <button type="submit">Send</button>
            </form>
          </>
        )}
      </aside>
    </main>
  );
}
