"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "../../lib/supabaseClient";

const toJson = (response) => response.json();
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
const ALLOWED_EMAILS = new Set([
  "danilebnen@gmail.com",
  "hadilebnen@gmail.com",
  "1nd.brahimi09@gmail.com",
  "felx.trad@gmail.com",
  "johanziolkowski@gmail.com"
]);

export default function AdminPage() {
  const [data, setData] = useState({
    roster: [],
    comps: [],
    logs: [],
    notes: [],
    tournaments: [],
    schedule: [],
    drafts: [],
    opponents: [],
    skinGoals: [],
    practiceGoals: [],
    metaWatchlist: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authUser, setAuthUser] = useState(null);
  const [authToken, setAuthToken] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");

  const [compForm, setCompForm] = useState({
    label: "",
    situation: "",
    core: "",
    notes: ""
  });
  const [logForm, setLogForm] = useState({
    opponent: "",
    result: "Win",
    score: "",
    played_at: ""
  });
  const [noteForm, setNoteForm] = useState({
    opponent: "",
    patch: "",
    side: "",
    notes: ""
  });
  const [tournamentForm, setTournamentForm] = useState({
    name: "",
    status: "Upcoming",
    starts_at: "",
    location: "",
    notes: ""
  });
  const [scheduleForm, setScheduleForm] = useState({
    title: "",
    type: "Scrim",
    opponent: "",
    starts_at: "",
    location: "",
    notes: ""
  });
  const [draftForm, setDraftForm] = useState({
    label: "",
    blue_bans: "",
    blue_picks: "",
    red_bans: "",
    red_picks: "",
    notes: ""
  });
  const [opponentForm, setOpponentForm] = useState({
    opponent: "",
    tendencies: "",
    win_conditions: "",
    draft_notes: "",
    pocket_picks: ""
  });
  const [skinGoalForm, setSkinGoalForm] = useState({
    player_name: "",
    tagline: "",
    target_rank: "",
    skin: "",
    notes: ""
  });
  const [practiceGoalForm, setPracticeGoalForm] = useState({
    player_name: "",
    tagline: "",
    goal: "",
    timeframe: "",
    status: "Active",
    notes: ""
  });
  const [metaWatchForm, setMetaWatchForm] = useState({
    champion: "",
    role: "",
    priority: "Medium",
    reason: "",
    notes: ""
  });
  const [editingCompId, setEditingCompId] = useState(null);
  const [editingLogId, setEditingLogId] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingTournamentId, setEditingTournamentId] = useState(null);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [editingDraftId, setEditingDraftId] = useState(null);
  const [editingOpponentId, setEditingOpponentId] = useState(null);
  const [editingSkinGoalId, setEditingSkinGoalId] = useState(null);
  const [editingPracticeGoalId, setEditingPracticeGoalId] = useState(null);
  const [editingMetaWatchId, setEditingMetaWatchId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      if (!authToken) {
        setLoading(false);
        return;
      }
      const response = await fetch("/api/dashboard/overview", {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const payload = await toJson(response);
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to load dashboard data.");
      }
      setData(payload);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setAuthError("Missing Supabase config.");
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user ?? null;
      if (user?.email && !ALLOWED_EMAILS.has(user.email.toLowerCase())) {
        supabase.auth.signOut();
        setAuthError("Access denied.");
        setAuthUser(null);
        setAuthToken("");
        setAuthLoading(false);
        return;
      }
      setAuthUser(user);
      setAuthToken(data.session?.access_token ?? "");
      setAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      if (user?.email && !ALLOWED_EMAILS.has(user.email.toLowerCase())) {
        supabase.auth.signOut();
        setAuthError("Access denied.");
        setAuthUser(null);
        setAuthToken("");
        return;
      }
      setAuthUser(user);
      setAuthToken(session?.access_token ?? "");
    });

    return () => {
      data?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    loadData();
  }, [authToken]);

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

  const submitComp = async (event) => {
    event.preventDefault();
    await fetch("/api/dashboard/comps", {
      method: editingCompId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ id: editingCompId, ...compForm })
    });
    setCompForm({ label: "", situation: "", core: "", notes: "" });
    setEditingCompId(null);
    loadData();
  };

  const submitLog = async (event) => {
    event.preventDefault();
    await fetch("/api/dashboard/logs", {
      method: editingLogId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ id: editingLogId, ...logForm })
    });
    setLogForm({ opponent: "", result: "Win", score: "", played_at: "" });
    setEditingLogId(null);
    loadData();
  };

  const submitNote = async (event) => {
    event.preventDefault();
    await fetch("/api/dashboard/notes", {
      method: editingNoteId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ id: editingNoteId, ...noteForm })
    });
    setNoteForm({ opponent: "", patch: "", side: "", notes: "" });
    setEditingNoteId(null);
    loadData();
  };

  const submitTournament = async (event) => {
    event.preventDefault();
    await fetch("/api/dashboard/tournaments", {
      method: editingTournamentId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ id: editingTournamentId, ...tournamentForm })
    });
    setTournamentForm({
      name: "",
      status: "Upcoming",
      starts_at: "",
      location: "",
      notes: ""
    });
    setEditingTournamentId(null);
    loadData();
  };

  const deleteRow = async (endpoint, id) => {
    await fetch(endpoint, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ id })
    });
    loadData();
  };

  const startCompEdit = (entry) => {
    setEditingCompId(entry.id);
    setCompForm({
      label: entry.label || "",
      situation: entry.situation || "",
      core: (entry.core || []).join(", "),
      notes: entry.notes || ""
    });
  };

  const startLogEdit = (entry) => {
    setEditingLogId(entry.id);
    setLogForm({
      opponent: entry.opponent || "",
      result: entry.result || "Win",
      score: entry.score || "",
      played_at: entry.played_at ? entry.played_at.split("T")[0] : ""
    });
  };

  const startNoteEdit = (entry) => {
    setEditingNoteId(entry.id);
    setNoteForm({
      opponent: entry.opponent || "",
      patch: entry.patch || "",
      side: entry.side || "",
      notes: entry.notes || ""
    });
  };

  const startTournamentEdit = (entry) => {
    setEditingTournamentId(entry.id);
    setTournamentForm({
      name: entry.name || "",
      status: entry.status || "Upcoming",
      starts_at: entry.starts_at ? entry.starts_at.split("T")[0] : "",
      location: entry.location || "",
      notes: entry.notes || ""
    });
  };

  const submitSchedule = async (event) => {
    event.preventDefault();
    await fetch("/api/dashboard/schedule", {
      method: editingScheduleId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ id: editingScheduleId, ...scheduleForm })
    });
    setScheduleForm({
      title: "",
      type: "Scrim",
      opponent: "",
      starts_at: "",
      location: "",
      notes: ""
    });
    setEditingScheduleId(null);
    loadData();
  };

  const submitDraft = async (event) => {
    event.preventDefault();
    await fetch("/api/dashboard/draft-boards", {
      method: editingDraftId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ id: editingDraftId, ...draftForm })
    });
    setDraftForm({
      label: "",
      blue_bans: "",
      blue_picks: "",
      red_bans: "",
      red_picks: "",
      notes: ""
    });
    setEditingDraftId(null);
    loadData();
  };

  const submitOpponent = async (event) => {
    event.preventDefault();
    await fetch("/api/dashboard/opponents", {
      method: editingOpponentId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ id: editingOpponentId, ...opponentForm })
    });
    setOpponentForm({
      opponent: "",
      tendencies: "",
      win_conditions: "",
      draft_notes: "",
      pocket_picks: ""
    });
    setEditingOpponentId(null);
    loadData();
  };

  const submitSkinGoal = async (event) => {
    event.preventDefault();
    await fetch("/api/dashboard/skin-goals", {
      method: editingSkinGoalId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ id: editingSkinGoalId, ...skinGoalForm })
    });
    setSkinGoalForm({
      player_name: "",
      tagline: "",
      target_rank: "",
      skin: "",
      notes: ""
    });
    setEditingSkinGoalId(null);
    loadData();
  };

  const submitPracticeGoal = async (event) => {
    event.preventDefault();
    await fetch("/api/dashboard/practice-goals", {
      method: editingPracticeGoalId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ id: editingPracticeGoalId, ...practiceGoalForm })
    });
    setPracticeGoalForm({
      player_name: "",
      tagline: "",
      goal: "",
      timeframe: "",
      status: "Active",
      notes: ""
    });
    setEditingPracticeGoalId(null);
    loadData();
  };

  const submitMetaWatch = async (event) => {
    event.preventDefault();
    await fetch("/api/dashboard/meta-watchlist", {
      method: editingMetaWatchId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ id: editingMetaWatchId, ...metaWatchForm })
    });
    setMetaWatchForm({
      champion: "",
      role: "",
      priority: "Medium",
      reason: "",
      notes: ""
    });
    setEditingMetaWatchId(null);
    loadData();
  };

  const startScheduleEdit = (entry) => {
    setEditingScheduleId(entry.id);
    setScheduleForm({
      title: entry.title || "",
      type: entry.type || "Scrim",
      opponent: entry.opponent || "",
      starts_at: entry.starts_at ? entry.starts_at.split("T")[0] : "",
      location: entry.location || "",
      notes: entry.notes || ""
    });
  };

  const startDraftEdit = (entry) => {
    setEditingDraftId(entry.id);
    setDraftForm({
      label: entry.label || "",
      blue_bans: (entry.blue_bans || []).join(", "),
      blue_picks: (entry.blue_picks || []).join(", "),
      red_bans: (entry.red_bans || []).join(", "),
      red_picks: (entry.red_picks || []).join(", "),
      notes: entry.notes || ""
    });
  };

  const startOpponentEdit = (entry) => {
    setEditingOpponentId(entry.id);
    setOpponentForm({
      opponent: entry.opponent || "",
      tendencies: entry.tendencies || "",
      win_conditions: entry.win_conditions || "",
      draft_notes: entry.draft_notes || "",
      pocket_picks: entry.pocket_picks || ""
    });
  };

  const startSkinGoalEdit = (entry) => {
    setEditingSkinGoalId(entry.id);
    setSkinGoalForm({
      player_name: entry.player_name || "",
      tagline: entry.tagline || "",
      target_rank: entry.target_rank || "",
      skin: entry.skin || "",
      notes: entry.notes || ""
    });
  };

  const startPracticeGoalEdit = (entry) => {
    setEditingPracticeGoalId(entry.id);
    setPracticeGoalForm({
      player_name: entry.player_name || "",
      tagline: entry.tagline || "",
      goal: entry.goal || "",
      timeframe: entry.timeframe || "",
      status: entry.status || "Active",
      notes: entry.notes || ""
    });
  };

  const startMetaWatchEdit = (entry) => {
    setEditingMetaWatchId(entry.id);
    setMetaWatchForm({
      champion: entry.champion || "",
      role: entry.role || "",
      priority: entry.priority || "Medium",
      reason: entry.reason || "",
      notes: entry.notes || ""
    });
  };

  if (authLoading) {
    return (
      <main>
        <section className="hero">
          <h1>Admin Hub</h1>
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
          <h1>Admin Login</h1>
          <div className="accent-line" />
          <p>Sign in to manage team data.</p>
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
            onSubmit={
              authMode === "login"
                ? handleLogin
                : (event) => {
                    event.preventDefault();
                    handleSignup();
                  }
            }
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
        <h1>Admin Hub</h1>
        <div className="hero-actions">
          <span className="tagline">{authUser.email}</span>
          <a className="pill pill-soft" href="/">
            Back to dashboard
          </a>
          <button type="button" onClick={handleLogout}>
            Log out
          </button>
        </div>
        <div className="accent-line" />
        <p>Manage comps, logs, and opponent notes in one place.</p>
      </section>

      {error ? <p className="error">{error}</p> : null}

      <section className="card card-strong fade-in">
        <h2 className="section-title">Team comps</h2>
        <form className="form" onSubmit={submitComp}>
          <input
            placeholder="Label"
            value={compForm.label}
            onChange={(event) =>
              setCompForm({ ...compForm, label: event.target.value })
            }
          />
          <input
            placeholder="Situation"
            value={compForm.situation}
            onChange={(event) =>
              setCompForm({ ...compForm, situation: event.target.value })
            }
          />
          <input
            placeholder="Core champs (comma separated)"
            value={compForm.core}
            onChange={(event) =>
              setCompForm({ ...compForm, core: event.target.value })
            }
          />
          <input
            placeholder="Notes"
            value={compForm.notes}
            onChange={(event) =>
              setCompForm({ ...compForm, notes: event.target.value })
            }
          />
          <button type="submit">
            {editingCompId ? "Save comp" : "Add comp"}
          </button>
          {editingCompId ? (
            <button
              type="button"
              onClick={() => {
                setEditingCompId(null);
                setCompForm({ label: "", situation: "", core: "", notes: "" });
              }}
            >
              Cancel
            </button>
          ) : null}
        </form>
        <div className="log-list">
          {data.comps.map((entry) => (
            <div key={entry.id} className="log-row">
              <div>
                <strong>{entry.label}</strong>
                <div className="match-meta">
                  {entry.situation} · {(entry.core || []).join(", ")}
                </div>
                {entry.notes ? (
                  <div className="match-meta">{entry.notes}</div>
                ) : null}
              </div>
              <div className="inline-row">
                <button type="button" onClick={() => startCompEdit(entry)}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteRow("/api/dashboard/comps", entry.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card card-strong fade-in">
        <h2 className="section-title">Scrim logs</h2>
        <form className="form" onSubmit={submitLog}>
          <input
            placeholder="Opponent"
            value={logForm.opponent}
            onChange={(event) =>
              setLogForm({ ...logForm, opponent: event.target.value })
            }
          />
          <select
            value={logForm.result}
            onChange={(event) =>
              setLogForm({ ...logForm, result: event.target.value })
            }
          >
            <option value="Win">Win</option>
            <option value="Loss">Loss</option>
          </select>
          <input
            placeholder="Score (e.g. 2-1)"
            value={logForm.score}
            onChange={(event) =>
              setLogForm({ ...logForm, score: event.target.value })
            }
          />
          <input
            type="date"
            value={logForm.played_at}
            onChange={(event) =>
              setLogForm({ ...logForm, played_at: event.target.value })
            }
          />
          <button type="submit">
            {editingLogId ? "Save log" : "Add log"}
          </button>
          {editingLogId ? (
            <button
              type="button"
              onClick={() => {
                setEditingLogId(null);
                setLogForm({
                  opponent: "",
                  result: "Win",
                  score: "",
                  played_at: ""
                });
              }}
            >
              Cancel
            </button>
          ) : null}
        </form>
        <div className="log-list">
          {data.logs.map((entry) => (
            <div key={entry.id} className="log-row">
              <div>
                <strong>{entry.opponent}</strong>
                <div className="match-meta">
                  {entry.result} {entry.score}
                </div>
              </div>
              <div className="inline-row">
                <button type="button" onClick={() => startLogEdit(entry)}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteRow("/api/dashboard/logs", entry.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card card-strong fade-in">
        <h2 className="section-title">Opponent notes</h2>
        <form className="form" onSubmit={submitNote}>
          <input
            placeholder="Opponent"
            value={noteForm.opponent}
            onChange={(event) =>
              setNoteForm({ ...noteForm, opponent: event.target.value })
            }
          />
          <input
            placeholder="Patch (e.g. 14.14)"
            value={noteForm.patch}
            onChange={(event) =>
              setNoteForm({ ...noteForm, patch: event.target.value })
            }
          />
          <input
            placeholder="Side (Blue/Red)"
            value={noteForm.side}
            onChange={(event) =>
              setNoteForm({ ...noteForm, side: event.target.value })
            }
          />
          <input
            placeholder="Notes"
            value={noteForm.notes}
            onChange={(event) =>
              setNoteForm({ ...noteForm, notes: event.target.value })
            }
          />
          <button type="submit">
            {editingNoteId ? "Save note" : "Add note"}
          </button>
          {editingNoteId ? (
            <button
              type="button"
              onClick={() => {
                setEditingNoteId(null);
                setNoteForm({ opponent: "", patch: "", side: "", notes: "" });
              }}
            >
              Cancel
            </button>
          ) : null}
        </form>
        <div className="log-list">
          {data.notes.map((entry) => (
            <div key={entry.id} className="log-row">
              <div>
                <strong>{entry.opponent}</strong>
                <div className="match-meta">
                  {entry.patch ? `Patch ${entry.patch}` : "Any patch"} ·{" "}
                  {entry.side || "Any side"}
                </div>
                <div className="match-meta">{entry.notes}</div>
              </div>
              <div className="inline-row">
                <button type="button" onClick={() => startNoteEdit(entry)}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteRow("/api/dashboard/notes", entry.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card card-strong fade-in">
        <h2 className="section-title">Tournaments</h2>
        <form className="form" onSubmit={submitTournament}>
          <input
            placeholder="Tournament name"
            value={tournamentForm.name}
            onChange={(event) =>
              setTournamentForm({ ...tournamentForm, name: event.target.value })
            }
          />
          <select
            value={tournamentForm.status}
            onChange={(event) =>
              setTournamentForm({ ...tournamentForm, status: event.target.value })
            }
          >
            <option value="Upcoming">Upcoming</option>
            <option value="Ongoing">Ongoing</option>
            <option value="Completed">Completed</option>
          </select>
          <input
            type="date"
            value={tournamentForm.starts_at}
            onChange={(event) =>
              setTournamentForm({
                ...tournamentForm,
                starts_at: event.target.value
              })
            }
          />
          <input
            placeholder="Location"
            value={tournamentForm.location}
            onChange={(event) =>
              setTournamentForm({
                ...tournamentForm,
                location: event.target.value
              })
            }
          />
          <input
            placeholder="Notes"
            value={tournamentForm.notes}
            onChange={(event) =>
              setTournamentForm({ ...tournamentForm, notes: event.target.value })
            }
          />
          <button type="submit">
            {editingTournamentId ? "Save tournament" : "Add tournament"}
          </button>
          {editingTournamentId ? (
            <button
              type="button"
              onClick={() => {
                setEditingTournamentId(null);
                setTournamentForm({
                  name: "",
                  status: "Upcoming",
                  starts_at: "",
                  location: "",
                  notes: ""
                });
              }}
            >
              Cancel
            </button>
          ) : null}
        </form>
        <div className="log-list">
          {data.tournaments?.map((entry) => (
            <div key={entry.id} className="log-row">
              <div>
                <strong>{entry.name}</strong>
                <div className="match-meta">
                  {entry.status} ·{" "}
                  {entry.starts_at
                    ? entry.starts_at.split("T")[0]
                    : "TBD"}
                </div>
                {entry.location ? (
                  <div className="match-meta">{entry.location}</div>
                ) : null}
              </div>
              <div className="inline-row">
                <button type="button" onClick={() => startTournamentEdit(entry)}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() =>
                    deleteRow("/api/dashboard/tournaments", entry.id)
                  }
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card card-strong fade-in">
        <h2 className="section-title">Schedule</h2>
        <form className="form" onSubmit={submitSchedule}>
          <input
            placeholder="Title"
            value={scheduleForm.title}
            onChange={(event) =>
              setScheduleForm({ ...scheduleForm, title: event.target.value })
            }
          />
          <select
            value={scheduleForm.type}
            onChange={(event) =>
              setScheduleForm({ ...scheduleForm, type: event.target.value })
            }
          >
            <option value="Scrim">Scrim</option>
            <option value="Review">Review</option>
            <option value="Tournament">Tournament</option>
            <option value="Meeting">Meeting</option>
          </select>
          <input
            placeholder="Opponent"
            value={scheduleForm.opponent}
            onChange={(event) =>
              setScheduleForm({ ...scheduleForm, opponent: event.target.value })
            }
          />
          <input
            type="date"
            value={scheduleForm.starts_at}
            onChange={(event) =>
              setScheduleForm({ ...scheduleForm, starts_at: event.target.value })
            }
          />
          <input
            placeholder="Location"
            value={scheduleForm.location}
            onChange={(event) =>
              setScheduleForm({ ...scheduleForm, location: event.target.value })
            }
          />
          <input
            placeholder="Notes"
            value={scheduleForm.notes}
            onChange={(event) =>
              setScheduleForm({ ...scheduleForm, notes: event.target.value })
            }
          />
          <button type="submit">
            {editingScheduleId ? "Save event" : "Add event"}
          </button>
          {editingScheduleId ? (
            <button
              type="button"
              onClick={() => {
                setEditingScheduleId(null);
                setScheduleForm({
                  title: "",
                  type: "Scrim",
                  opponent: "",
                  starts_at: "",
                  location: "",
                  notes: ""
                });
              }}
            >
              Cancel
            </button>
          ) : null}
        </form>
        <div className="log-list">
          {data.schedule?.map((entry) => (
            <div key={entry.id} className="log-row">
              <div>
                <strong>{entry.title}</strong>
                <div className="match-meta">
                  {entry.type} ·{" "}
                  {entry.starts_at ? entry.starts_at.split("T")[0] : "TBD"}
                </div>
                {entry.opponent ? (
                  <div className="match-meta">{entry.opponent}</div>
                ) : null}
              </div>
              <div className="inline-row">
                <button type="button" onClick={() => startScheduleEdit(entry)}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteRow("/api/dashboard/schedule", entry.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card card-strong fade-in">
        <h2 className="section-title">Draft boards</h2>
        <form className="form" onSubmit={submitDraft}>
          <input
            placeholder="Label"
            value={draftForm.label}
            onChange={(event) =>
              setDraftForm({ ...draftForm, label: event.target.value })
            }
          />
          <input
            placeholder="Blue bans (comma separated)"
            value={draftForm.blue_bans}
            onChange={(event) =>
              setDraftForm({ ...draftForm, blue_bans: event.target.value })
            }
          />
          <input
            placeholder="Blue picks (comma separated)"
            value={draftForm.blue_picks}
            onChange={(event) =>
              setDraftForm({ ...draftForm, blue_picks: event.target.value })
            }
          />
          <input
            placeholder="Red bans (comma separated)"
            value={draftForm.red_bans}
            onChange={(event) =>
              setDraftForm({ ...draftForm, red_bans: event.target.value })
            }
          />
          <input
            placeholder="Red picks (comma separated)"
            value={draftForm.red_picks}
            onChange={(event) =>
              setDraftForm({ ...draftForm, red_picks: event.target.value })
            }
          />
          <input
            placeholder="Notes"
            value={draftForm.notes}
            onChange={(event) =>
              setDraftForm({ ...draftForm, notes: event.target.value })
            }
          />
          <button type="submit">
            {editingDraftId ? "Save draft" : "Add draft"}
          </button>
          {editingDraftId ? (
            <button
              type="button"
              onClick={() => {
                setEditingDraftId(null);
                setDraftForm({
                  label: "",
                  blue_bans: "",
                  blue_picks: "",
                  red_bans: "",
                  red_picks: "",
                  notes: ""
                });
              }}
            >
              Cancel
            </button>
          ) : null}
        </form>
        <div className="log-list">
          {data.drafts?.map((entry) => (
            <div key={entry.id} className="log-row">
              <div>
                <strong>{entry.label}</strong>
                <div className="match-meta">
                  Blue picks: {(entry.blue_picks || []).join(", ")}
                </div>
                <div className="match-meta">
                  Red picks: {(entry.red_picks || []).join(", ")}
                </div>
              </div>
              <div className="inline-row">
                <button type="button" onClick={() => startDraftEdit(entry)}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() =>
                    deleteRow("/api/dashboard/draft-boards", entry.id)
                  }
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card card-strong fade-in">
        <h2 className="section-title">Opponent profiles</h2>
        <form className="form" onSubmit={submitOpponent}>
          <input
            placeholder="Opponent"
            value={opponentForm.opponent}
            onChange={(event) =>
              setOpponentForm({ ...opponentForm, opponent: event.target.value })
            }
          />
          <input
            placeholder="Tendencies"
            value={opponentForm.tendencies}
            onChange={(event) =>
              setOpponentForm({ ...opponentForm, tendencies: event.target.value })
            }
          />
          <input
            placeholder="Win conditions"
            value={opponentForm.win_conditions}
            onChange={(event) =>
              setOpponentForm({
                ...opponentForm,
                win_conditions: event.target.value
              })
            }
          />
          <input
            placeholder="Draft notes"
            value={opponentForm.draft_notes}
            onChange={(event) =>
              setOpponentForm({
                ...opponentForm,
                draft_notes: event.target.value
              })
            }
          />
          <input
            placeholder="Pocket picks"
            value={opponentForm.pocket_picks}
            onChange={(event) =>
              setOpponentForm({
                ...opponentForm,
                pocket_picks: event.target.value
              })
            }
          />
          <button type="submit">
            {editingOpponentId ? "Save opponent" : "Add opponent"}
          </button>
          {editingOpponentId ? (
            <button
              type="button"
              onClick={() => {
                setEditingOpponentId(null);
                setOpponentForm({
                  opponent: "",
                  tendencies: "",
                  win_conditions: "",
                  draft_notes: "",
                  pocket_picks: ""
                });
              }}
            >
              Cancel
            </button>
          ) : null}
        </form>
        <div className="log-list">
          {data.opponents?.map((entry) => (
            <div key={entry.id} className="log-row">
              <div>
                <strong>{entry.opponent}</strong>
                {entry.tendencies ? (
                  <div className="match-meta">{entry.tendencies}</div>
                ) : null}
              </div>
              <div className="inline-row">
                <button type="button" onClick={() => startOpponentEdit(entry)}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteRow("/api/dashboard/opponents", entry.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card card-strong fade-in">
        <h2 className="section-title">Skin goals</h2>
        <form className="form" onSubmit={submitSkinGoal}>
          <input
            placeholder="Player name"
            value={skinGoalForm.player_name}
            onChange={(event) =>
              setSkinGoalForm({
                ...skinGoalForm,
                player_name: event.target.value
              })
            }
          />
          <input
            placeholder="Tagline"
            value={skinGoalForm.tagline}
            onChange={(event) =>
              setSkinGoalForm({ ...skinGoalForm, tagline: event.target.value })
            }
          />
          <input
            placeholder="Target rank (e.g. Master)"
            value={skinGoalForm.target_rank}
            onChange={(event) =>
              setSkinGoalForm({
                ...skinGoalForm,
                target_rank: event.target.value
              })
            }
          />
          <input
            placeholder="Skin reward"
            value={skinGoalForm.skin}
            onChange={(event) =>
              setSkinGoalForm({ ...skinGoalForm, skin: event.target.value })
            }
          />
          <input
            placeholder="Notes"
            value={skinGoalForm.notes}
            onChange={(event) =>
              setSkinGoalForm({ ...skinGoalForm, notes: event.target.value })
            }
          />
          <button type="submit">
            {editingSkinGoalId ? "Save goal" : "Add goal"}
          </button>
          {editingSkinGoalId ? (
            <button
              type="button"
              onClick={() => {
                setEditingSkinGoalId(null);
                setSkinGoalForm({
                  player_name: "",
                  tagline: "",
                  target_rank: "",
                  skin: "",
                  notes: ""
                });
              }}
            >
              Cancel
            </button>
          ) : null}
        </form>
        <div className="log-list">
          {data.skinGoals?.map((entry) => (
            <div key={entry.id} className="log-row">
              <div>
                <div className="inline-row">
                  <strong>
                    {entry.player_name}#{entry.tagline}
                  </strong>
                  {entry.completed_at ? (
                    <span className="pill pill-win">Completed ✓</span>
                  ) : null}
                </div>
                <div className="match-meta">
                  Target: {entry.target_rank} · Reward: {entry.skin}
                </div>
                <div className="match-meta">
                  Set at: {formatDateLabel(entry.created_at)}
                  {entry.completed_at
                    ? ` · Completed at: ${formatDateLabel(entry.completed_at)}`
                    : ""}
                </div>
                {entry.notes ? (
                  <div className="match-meta">{entry.notes}</div>
                ) : null}
              </div>
              <div className="inline-row">
                <button type="button" onClick={() => startSkinGoalEdit(entry)}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteRow("/api/dashboard/skin-goals", entry.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card card-strong fade-in">
        <h2 className="section-title">Practice goals</h2>
        <form className="form" onSubmit={submitPracticeGoal}>
          <input
            placeholder="Player name"
            value={practiceGoalForm.player_name}
            onChange={(event) =>
              setPracticeGoalForm({
                ...practiceGoalForm,
                player_name: event.target.value
              })
            }
          />
          <input
            placeholder="Tagline"
            value={practiceGoalForm.tagline}
            onChange={(event) =>
              setPracticeGoalForm({
                ...practiceGoalForm,
                tagline: event.target.value
              })
            }
          />
          <input
            placeholder="Goal"
            value={practiceGoalForm.goal}
            onChange={(event) =>
              setPracticeGoalForm({
                ...practiceGoalForm,
                goal: event.target.value
              })
            }
          />
          <input
            placeholder="Timeframe (e.g. This week)"
            value={practiceGoalForm.timeframe}
            onChange={(event) =>
              setPracticeGoalForm({
                ...practiceGoalForm,
                timeframe: event.target.value
              })
            }
          />
          <input
            placeholder="Status (Active/Done)"
            value={practiceGoalForm.status}
            onChange={(event) =>
              setPracticeGoalForm({
                ...practiceGoalForm,
                status: event.target.value
              })
            }
          />
          <input
            placeholder="Notes"
            value={practiceGoalForm.notes}
            onChange={(event) =>
              setPracticeGoalForm({
                ...practiceGoalForm,
                notes: event.target.value
              })
            }
          />
          <button type="submit">
            {editingPracticeGoalId ? "Save goal" : "Add goal"}
          </button>
          {editingPracticeGoalId ? (
            <button
              type="button"
              onClick={() => {
                setEditingPracticeGoalId(null);
                setPracticeGoalForm({
                  player_name: "",
                  tagline: "",
                  goal: "",
                  timeframe: "",
                  status: "Active",
                  notes: ""
                });
              }}
            >
              Cancel
            </button>
          ) : null}
        </form>
        <div className="log-list">
          {data.practiceGoals?.map((entry) => (
            <div key={entry.id} className="log-row">
              <div>
                <strong>
                  {entry.player_name}#{entry.tagline}
                </strong>
                <div className="match-meta">
                  Goal: {entry.goal} · {entry.status || "Active"}
                </div>
                {entry.timeframe ? (
                  <div className="match-meta">{entry.timeframe}</div>
                ) : null}
                {entry.notes ? (
                  <div className="match-meta">{entry.notes}</div>
                ) : null}
              </div>
              <div className="inline-row">
                <button type="button" onClick={() => startPracticeGoalEdit(entry)}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() =>
                    deleteRow("/api/dashboard/practice-goals", entry.id)
                  }
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card card-strong fade-in">
        <h2 className="section-title">Meta watchlist</h2>
        <form className="form" onSubmit={submitMetaWatch}>
          <input
            placeholder="Champion"
            value={metaWatchForm.champion}
            onChange={(event) =>
              setMetaWatchForm({
                ...metaWatchForm,
                champion: event.target.value
              })
            }
          />
          <input
            placeholder="Role"
            value={metaWatchForm.role}
            onChange={(event) =>
              setMetaWatchForm({
                ...metaWatchForm,
                role: event.target.value
              })
            }
          />
          <input
            placeholder="Priority (High/Medium/Low)"
            value={metaWatchForm.priority}
            onChange={(event) =>
              setMetaWatchForm({
                ...metaWatchForm,
                priority: event.target.value
              })
            }
          />
          <input
            placeholder="Reason"
            value={metaWatchForm.reason}
            onChange={(event) =>
              setMetaWatchForm({
                ...metaWatchForm,
                reason: event.target.value
              })
            }
          />
          <input
            placeholder="Notes"
            value={metaWatchForm.notes}
            onChange={(event) =>
              setMetaWatchForm({
                ...metaWatchForm,
                notes: event.target.value
              })
            }
          />
          <button type="submit">
            {editingMetaWatchId ? "Save entry" : "Add entry"}
          </button>
          {editingMetaWatchId ? (
            <button
              type="button"
              onClick={() => {
                setEditingMetaWatchId(null);
                setMetaWatchForm({
                  champion: "",
                  role: "",
                  priority: "Medium",
                  reason: "",
                  notes: ""
                });
              }}
            >
              Cancel
            </button>
          ) : null}
        </form>
        <div className="log-list">
          {data.metaWatchlist?.map((entry) => (
            <div key={entry.id} className="log-row">
              <div>
                <strong>{entry.champion}</strong>
                <div className="match-meta">
                  {entry.role ? `${entry.role} · ` : ""}
                  {entry.priority || "Medium"} priority
                </div>
                {entry.reason ? (
                  <div className="match-meta">Reason: {entry.reason}</div>
                ) : null}
                {entry.notes ? (
                  <div className="match-meta">{entry.notes}</div>
                ) : null}
              </div>
              <div className="inline-row">
                <button type="button" onClick={() => startMetaWatchEdit(entry)}>
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() =>
                    deleteRow("/api/dashboard/meta-watchlist", entry.id)
                  }
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {loading ? <p className="match-meta">Loading...</p> : null}
    </main>
  );
}
