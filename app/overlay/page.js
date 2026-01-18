"use client";

import { useEffect, useState } from "react";

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

const formatNumber = (value) =>
  Number.isFinite(value) ? value.toFixed(1) : "0.0";

export default function OverlayPage() {
  const [theme, setTheme] = useState("cosmos");
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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const savedTheme = window.localStorage.getItem("teamTheme") || "cosmos";
    setTheme(savedTheme);
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

  const getSpellKey = (player, spellId) => {
    const gameId = intel?.activeGame?.gameId || "game";
    return `${gameId}:${player.puuid}:${spellId}`;
  };

  const startSpellTimer = (player, spell) => {
    if (!spell?.cooldown) {
      return;
    }
    const key = getSpellKey(player, spell.id);
    setSpellTimers((prev) => ({
      ...prev,
      [key]: Date.now() + spell.cooldown * 1000
    }));
  };

  const getRemaining = (player, spell) => {
    const key = getSpellKey(player, spell.id);
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

  return (
    <main className="overlay-shell" data-theme={theme}>
      <section className="card card-strong fade-in">
        <div className="section-head">
          <div>
            <p className="eyebrow">Overlay</p>
            <h2>Live Intel</h2>
          </div>
          <span className="pill">Ctrl + Shift + O</span>
        </div>
        <div className="form form-inline">
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
        <section className="card card-strong fade-in">
          <div className="intel-grid">
            {[100, 200].map((teamId) => {
              const teamPlayers = intel.participants.filter(
                (player) => player.teamId === teamId
              );
              const isFriendly = intel.friendlyTeamId === teamId;
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
                              Avg K/D/A: {formatNumber(player.stats.avgKills)}/
                              {formatNumber(player.stats.avgDeaths)}/
                              {formatNumber(player.stats.avgAssists)} · KDA{" "}
                              {player.stats.kdaRatio.toFixed(2)}
                            </div>
                          ) : null}
                        </div>
                        {player.championImage ? (
                          <img
                            src={`https://ddragon.leagueoflegends.com/cdn/${intel.ddVersion}/img/champion/${player.championImage}`}
                            alt={player.championName || "Champion"}
                            className="intel-champ"
                          />
                        ) : null}
                      </div>
                      {player.spells?.length ? (
                        <div className="spell-row">
                          {player.spells.map((spell) => {
                            const remaining = getRemaining(player, spell);
                            return (
                              <button
                                key={`${player.puuid}-${spell.id}`}
                                type="button"
                                className={`spell-chip ${remaining ? "cooldown" : "ready"}`}
                                onClick={() => startSpellTimer(player, spell)}
                                title={`${spell.name} · ${spell.cooldown || "?"}s`}
                              >
                                {spell.image ? (
                                  <img
                                    src={`https://ddragon.leagueoflegends.com/cdn/${intel.ddVersion}/img/spell/${spell.image}`}
                                    alt={spell.name}
                                    className="spell-icon"
                                  />
                                ) : null}
                                <span className="spell-timer">
                                  {remaining || "Ready"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
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
                      {player.roleShare ? (
                        <div className="match-meta">
                          Main role share: {(player.roleShare * 100).toFixed(0)}%
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}
