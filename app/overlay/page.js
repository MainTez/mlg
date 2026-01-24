"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "../../lib/supabaseClient";

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

export default function OverlayPage() {
  const [theme, setTheme] = useState("cosmos");
  const [overlayShortcut, setOverlayShortcut] = useState("Ctrl + O");
  const [gameName, setGameName] = useState("");
  const [tagLine, setTagLine] = useState("");
  const [region, setRegion] = useState("euw1");
  const [intel, setIntel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [spellTimers, setSpellTimers] = useState(() => {
    if (typeof window === "undefined") {
      return {};
    }
    try {
      return JSON.parse(
        window.localStorage.getItem("mlg.overlaySpellTimers") || "{}"
      );
    } catch (err) {
      return {};
    }
  });
  const [now, setNow] = useState(() => Date.now());
  const [authToken, setAuthToken] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const savedTheme = window.localStorage.getItem("teamTheme") || "cosmos";
    setTheme(savedTheme);
    const savedShortcut = window.localStorage.getItem("mlg.overlayShortcut") || "Ctrl+O";
    setOverlayShortcut(savedShortcut.replace(/\+/g, " + "));
    const savedTarget = window.localStorage.getItem("mlg.overlayTarget");
    const savedRegion =
      window.localStorage.getItem("mlg.overlayRegion") || "euw1";
    if (savedTarget) {
      const [name, tag] = savedTarget.split("#");
      if (name && tag) {
        setGameName(name);
        setTagLine(tag);
      }
    }
    setRegion(savedRegion);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const getShortcut = window?.electronApp?.getOverlayShortcut;
    if (!getShortcut) {
      return;
    }
    getShortcut()
      .then((shortcut) => {
        if (!shortcut) {
          return;
        }
        const formatted = shortcut
          .replace(/CommandOrControl/gi, "Ctrl")
          .replace(/\+/g, " + ");
        setOverlayShortcut(formatted);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setAuthToken(data.session?.access_token || "");
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthToken(session?.access_token || "");
    });
    return () => {
      data?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      "mlg.overlaySpellTimers",
      JSON.stringify(spellTimers)
    );
  }, [spellTimers]);

  const loadIntel = async () => {
    if (!gameName.trim() || !tagLine.trim()) {
      setError("Enter a game name and tagline.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/live-intel?gameName=${encodeURIComponent(
          gameName.trim()
        )}&tagLine=${encodeURIComponent(
          tagLine.trim()
        )}&region=${region}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load live intel.");
      }
      setIntel(data);
      window.localStorage.setItem(
        "mlg.overlayTarget",
        `${gameName.trim()}#${tagLine.trim()}`
      );
      window.localStorage.setItem("mlg.overlayRegion", region);
    } catch (err) {
      setError(err.message);
      setIntel(null);
    } finally {
      setLoading(false);
    }
  };

  const getSpellKey = (player, spellId, gameId) =>
    `${gameId}:${player.puuid}:${spellId}`;

  const startSpellTimer = async (player, spell) => {
    if (!spell?.cooldown) {
      return;
    }
    const gameId = intel?.activeGame?.gameId;
    if (!gameId) {
      return;
    }
    const endAt = Date.now() + spell.cooldown * 1000;
    const key = getSpellKey(player, spell.id, gameId);
    setSpellTimers((prev) => ({ ...prev, [key]: endAt }));
    if (!authToken) {
      return;
    }
    await fetch("/api/overlay/timers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        game_id: gameId,
        puuid: player.puuid,
        spell_id: spell.id,
        ends_at: new Date(endAt).toISOString()
      })
    }).catch(() => {});
  };

  const getRemaining = (player, spell) => {
    const gameId = intel?.activeGame?.gameId;
    if (!gameId) {
      return null;
    }
    const key = getSpellKey(player, spell.id, gameId);
    const endAt = spellTimers[key] || 0;
    const remaining = endAt - now;
    if (remaining <= 0) {
      return null;
    }
    const seconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!intel?.activeGame?.gameId || !authToken) {
      return;
    }
    let active = true;
    const gameId = intel.activeGame.gameId;
    const loadTimers = async () => {
      try {
        const response = await fetch(
          `/api/overlay/timers?gameId=${encodeURIComponent(gameId)}`,
          {
            headers: { Authorization: `Bearer ${authToken}` }
          }
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load timers.");
        }
        if (!active) {
          return;
        }
        const next = {};
        (data.timers || []).forEach((timer) => {
          const key = getSpellKey({ puuid: timer.puuid }, timer.spell_id, gameId);
          next[key] = new Date(timer.ends_at).getTime();
        });
        setSpellTimers((prev) => ({ ...prev, ...next }));
      } catch (err) {
        return;
      }
    };
    loadTimers();
    const interval = setInterval(loadTimers, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [intel?.activeGame?.gameId, authToken]);

  return (
    <main className="overlay-shell" data-theme={theme}>
      <section className="card card-strong fade-in overlay-panel overlay-scan">
        <div className="section-head">
          <div>
            <p className="eyebrow">Overlay</p>
            <h2>Live Intel</h2>
          </div>
          <span className="pill">{overlayShortcut}</span>
        </div>
        <div className="form form-inline overlay-form">
          <input
            placeholder="Game name"
            value={gameName}
            onChange={(event) => setGameName(event.target.value)}
          />
          <input
            placeholder="Tagline"
            value={tagLine}
            onChange={(event) => setTagLine(event.target.value)}
          />
          <select value={region} onChange={(event) => setRegion(event.target.value)}>
            {REGIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={loadIntel}>
            Scan match
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
        {loading ? <p className="match-meta">Scanning live match...</p> : null}
        {intel && !intel.activeGame ? (
          <p className="match-meta">No active game found.</p>
        ) : null}
      </section>

      {intel?.participants?.length ? (
        <section className="card card-strong fade-in overlay-panel overlay-enemy-panel">
          {[100, 200]
            .filter((teamId) => teamId !== intel.friendlyTeamId)
            .map((teamId) => {
              const teamPlayers = intel.participants.filter(
                (player) => player.teamId === teamId
              );
              return (
                <div key={teamId} className="overlay-enemy-wrap">
                  <div className="overlay-panel-head">
                    <span className="overlay-title">Opponents</span>
                    <span className="pill">{teamPlayers.length}</span>
                  </div>
                  <div className="overlay-enemy-list">
                    {teamPlayers.map((player) => (
                      <div key={player.puuid} className="overlay-enemy-row">
                        <div className="overlay-champ">
                          {player.championImage ? (
                            <img
                              src={`https://ddragon.leagueoflegends.com/cdn/${intel.ddVersion}/img/champion/${player.championImage}`}
                              alt={player.championName || "Champion"}
                              className="overlay-champ-icon"
                            />
                          ) : (
                            <div className="overlay-champ-fallback">?</div>
                          )}
                        </div>
                        <div className="overlay-spells">
                          {(player.spells || []).map((spell) => {
                            const remaining = getRemaining(player, spell);
                            return (
                              <button
                                key={`${player.puuid}-${spell.id}`}
                                type="button"
                                className={`overlay-spell ${remaining ? "cooldown" : "ready"}`}
                                onClick={() => startSpellTimer(player, spell)}
                                title={`${spell.name} · ${spell.cooldown || "?"}s`}
                              >
                                {spell.image ? (
                                  <img
                                    src={`https://ddragon.leagueoflegends.com/cdn/${intel.ddVersion}/img/spell/${spell.image}`}
                                    alt={spell.name}
                                    className="overlay-spell-icon"
                                  />
                                ) : null}
                                {remaining ? (
                                  <span className="overlay-spell-timer">
                                    {remaining}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </section>
      ) : null}
    </main>
  );
}
