import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from "recharts";
import {
  Moon, Wallet, Sparkles, Brain, Repeat, Dumbbell, Trophy,
  Users, CircleEllipsis, Plus, Trash2, Calendar, TrendingUp,
  Clock, ChevronLeft, ChevronRight, Bell,
} from "lucide-react";

/* ---------------------------------------------------------
   Token di design
--------------------------------------------------------- */
const INK = "#EDE9DE";
const PAPER = "#15161B";
const PAPER_RAISED = "#1D1F26";
const PAPER_LINE = "#2A2C35";
const MUTED = "#8C8E9B";
const MINUTES_PER_DAY = 24 * 60;

const CATEGORIES = [
  { id: "sonno", label: "Sonno", color: "#7C8BD9", Icon: Moon },
  { id: "money", label: "Money", color: "#4FA37B", Icon: Wallet },
  { id: "god", label: "God", color: "#D4AF37", Icon: Sparkles },
  { id: "mente", label: "Mente", color: "#9B84E0", Icon: Brain },
  { id: "routine", label: "Routine", color: "#4CB0A6", Icon: Repeat },
  { id: "gym", label: "Gym", color: "#D46A5C", Icon: Dumbbell },
  { id: "sport", label: "Sport", color: "#E0954E", Icon: Trophy },
  { id: "social", label: "Social", color: "#D67AA8", Icon: Users },
  { id: "altro", label: "Altro", color: "#6B6E78", Icon: CircleEllipsis },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

const STORAGE_KEY = "day-tracker-v1";
const localDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const todayStr = () => localDateStr(new Date());
const fmtDateLabel = (d) => {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
};
const minsToHM = (mins) => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};
const timeToMins = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { entries: {}, reminders: [] };
    const parsed = JSON.parse(raw);
    return { entries: {}, reminders: [], ...parsed };
  } catch {
    return { entries: {}, reminders: [] };
  }
}
function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage non disponibile: si continua solo in memoria
  }
}

/* ---------------------------------------------------------
   Foglio di stile globale — CSS puro, nessuna dipendenza da
   Tailwind: funziona identico in qualunque build/APK.
--------------------------------------------------------- */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap');

  * { box-sizing: border-box; }
  html, body, #root { height: 100%; margin: 0; }
  body { background: ${PAPER}; }

  .dt-app {
    background: ${PAPER};
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    justify-content: center;
    font-family: 'Inter', sans-serif;
    color: ${INK};
  }
  .dt-shell {
    width: 100%;
    max-width: 480px;
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .dt-header {
    padding: calc(env(safe-area-inset-top, 0px) + 24px) 20px 12px 20px;
    flex-shrink: 0;
  }
  .dt-header-date {
    color: ${MUTED};
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    margin-bottom: 4px;
  }
  .dt-header-title {
    font-family: 'Fraunces', serif;
    color: ${INK};
    font-size: 26px;
    font-weight: 500;
    margin: 0;
  }
  .dt-main {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 0 20px 24px 20px;
    -webkit-overflow-scrolling: touch;
  }
  .dt-nav {
    background: ${PAPER_RAISED};
    border-top: 1px solid ${PAPER_LINE};
    padding: 8px 8px calc(env(safe-area-inset-bottom, 0px) + 8px) 8px;
    display: flex;
    justify-content: space-around;
    flex-shrink: 0;
    position: sticky;
    bottom: 0;
  }
  .dt-nav-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px 14px;
    border-radius: 12px;
    background: transparent;
    border: none;
    color: ${MUTED};
  }
  .dt-nav-btn.active { color: ${INK}; }
  .dt-nav-btn span { font-size: 10px; }

  .dt-section-label {
    color: ${MUTED};
    letter-spacing: 0.14em;
    text-transform: uppercase;
    font-size: 11px;
    font-weight: 500;
    margin-bottom: 8px;
  }

  .dt-pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .dt-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 999px;
    border: 1px solid ${PAPER_LINE};
    background: transparent;
    color: ${MUTED};
    font-size: 14px;
    padding: 7px 14px;
    white-space: nowrap;
  }

  .dt-card {
    background: ${PAPER_RAISED};
    border: 1px solid ${PAPER_LINE};
    border-radius: 18px;
    padding: 16px;
  }

  .dt-field { flex: 1; display: flex; flex-direction: column; }
  .dt-field label {
    color: ${MUTED};
    font-size: 12px;
    margin-bottom: 4px;
  }
  .dt-field input {
    background: ${PAPER};
    border: 1px solid ${PAPER_LINE};
    color: ${INK};
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 15px;
    font-family: inherit;
    width: 100%;
  }
  .dt-field input::-webkit-calendar-picker-indicator { filter: invert(0.7); }

  .dt-btn-primary {
    width: 100%;
    background: ${INK};
    color: ${PAPER};
    border: none;
    border-radius: 12px;
    padding: 13px;
    font-size: 15px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .dt-btn-outline {
    width: 100%;
    background: ${PAPER_RAISED};
    color: ${INK};
    border: 1px solid ${PAPER_LINE};
    border-radius: 12px;
    padding: 12px;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .dt-error { color: #D46A5C; font-size: 13px; margin: 0; }

  .dt-entry-row {
    display: flex;
    align-items: center;
    gap: 12px;
    background: ${PAPER_RAISED};
    border: 1px solid ${PAPER_LINE};
    border-radius: 14px;
    padding: 12px;
  }
  .dt-entry-bar { width: 5px; height: 34px; border-radius: 4px; flex-shrink: 0; }
  .dt-entry-title { color: ${INK}; font-size: 15px; font-weight: 500; }
  .dt-entry-sub { color: ${INK}; opacity: 0.75; font-size: 12px; margin-top: 2px; }
  .dt-entry-delete {
    background: transparent;
    border: none;
    color: ${MUTED};
    padding: 6px;
    flex-shrink: 0;
  }

  .dt-legend-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 12px;
    margin-top: 16px;
  }
  .dt-legend-row { display: flex; align-items: center; gap: 8px; font-size: 14px; min-width: 0; }
  .dt-legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .dt-legend-name { color: ${INK}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dt-legend-stat { color: ${MUTED}; margin-left: auto; font-size: 12px; white-space: nowrap; }

  .dt-wheel-center-value { font-family: 'Fraunces', serif; color: ${INK}; font-size: 24px; font-weight: 500; }
  .dt-wheel-center-label { color: ${MUTED}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 2px; }

  .dt-history-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .dt-history-nav button { background: transparent; border: none; padding: 8px; color: ${INK}; }
  .dt-history-nav button:disabled { color: ${PAPER_LINE}; }
  .dt-history-date { font-family: 'Fraunces', serif; color: ${INK}; font-size: 18px; text-transform: capitalize; }

  .dt-list-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: transparent;
    border: 1px solid ${PAPER_LINE};
    border-radius: 10px;
    padding: 10px 12px;
    color: ${INK};
    font-size: 14px;
    text-align: left;
    margin-bottom: 6px;
  }
  .dt-list-btn.active { background: ${PAPER_RAISED}; }
  .dt-list-btn .stat { color: ${MUTED}; font-size: 12px; }

  .dt-empty { display: flex; flex-direction: column; align-items: center; padding: 70px 0; text-align: center; color: ${MUTED}; }
  .dt-empty p { font-size: 14px; margin-top: 12px; }

  .dt-reminder-note { color: ${MUTED}; font-size: 12px; line-height: 1.6; margin-bottom: 16px; }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: ${PAPER_LINE}; border-radius: 4px; }
`;

/* --------------------------- UI atoms --------------------------- */

function Pill({ active, color, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="dt-pill"
      style={{
        borderColor: active ? color : PAPER_LINE,
        background: active ? `${color}26` : "transparent",
        color: active ? INK : MUTED,
      }}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }) {
  return <div className="dt-section-label">{children}</div>;
}

/* --------------------------- Day Wheel (pie) --------------------------- */

function DayWheel({ entries }) {
  const totals = useMemo(() => {
    const m = {};
    entries.forEach((e) => {
      if (e.category === "altro") return;
      m[e.category] = (m[e.category] || 0) + e.duration;
    });
    const tracked = Object.values(m).reduce((s, v) => s + v, 0);
    const rest = Math.max(MINUTES_PER_DAY - tracked, 0);
    const slices = CATEGORIES.filter((c) => c.id !== "altro" && m[c.id] > 0).map((c) => ({
      id: c.id, name: c.label, value: m[c.id], color: c.color,
    }));
    if (rest > 0) {
      const altro = CAT_MAP.altro;
      slices.push({ id: "altro", name: altro.label, value: rest, color: altro.color });
    }
    return slices;
  }, [entries]);

  const trackedTotal = totals.filter((d) => d.id !== "altro").reduce((s, d) => s + d.value, 0);

  return (
    <div style={{ position: "relative" }}>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={totals} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={2} stroke="none">
            {totals.map((d) => (
              <Cell key={d.id} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: PAPER_RAISED, border: `1px solid ${PAPER_LINE}`, borderRadius: 10, color: INK }}
            formatter={(v, n) => [minsToHM(v), n]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
        <span className="dt-wheel-center-value">{minsToHM(trackedTotal)}</span>
        <span className="dt-wheel-center-label">tracciato</span>
      </div>
    </div>
  );
}

function Legend2({ entries }) {
  // Le percentuali sono sempre calcolate sulle 24 ore totali, non sulla sola somma
  // delle attività inserite — e "Altro" resta visibile come tempo non tracciato/perso.
  const rows = useMemo(() => {
    const m = {};
    entries.forEach((e) => {
      if (e.category === "altro") return;
      m[e.category] = (m[e.category] || 0) + e.duration;
    });
    const tracked = Object.values(m).reduce((s, v) => s + v, 0);
    const rest = Math.max(MINUTES_PER_DAY - tracked, 0);
    const list = CATEGORIES.filter((c) => c.id !== "altro" && m[c.id] > 0).map((c) => ({
      ...c, mins: m[c.id], pct: Math.round((m[c.id] / MINUTES_PER_DAY) * 100),
    }));
    if (rest > 0) {
      list.push({ ...CAT_MAP.altro, mins: rest, pct: Math.round((rest / MINUTES_PER_DAY) * 100) });
    }
    return list;
  }, [entries]);

  if (rows.length === 0) return null;

  return (
    <div className="dt-legend-grid">
      {rows.map((c) => (
        <div key={c.id} className="dt-legend-row">
          <span className="dt-legend-dot" style={{ background: c.color }} />
          <span className="dt-legend-name">{c.label}</span>
          <span className="dt-legend-stat">{minsToHM(c.mins)} · {c.pct}%</span>
        </div>
      ))}
    </div>
  );
}

/* --------------------------- Today Tab --------------------------- */

function TodayTab({ data, setData }) {
  const [date, setDate] = useState(todayStr());
  useEffect(() => {
    const id = setInterval(() => {
      const now = todayStr();
      setDate((prev) => (prev !== now ? now : prev));
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const entries = data.entries[date] || [];
  const [form, setForm] = useState({ category: CATEGORIES[0].id, start: "", end: "" });
  const [error, setError] = useState("");

  const addEntry = () => {
    setError("");
    if (!form.start || !form.end) {
      setError("Inserisci orario di inizio e fine");
      return;
    }
    const dur = timeToMins(form.end) - timeToMins(form.start);
    if (dur <= 0) {
      setError("L'orario di fine deve essere dopo l'inizio");
      return;
    }
    const entry = { id: crypto.randomUUID(), category: form.category, start: form.start, end: form.end, duration: dur };
    setData((d) => ({
      ...d,
      entries: { ...d.entries, [date]: [...(d.entries[date] || []), entry].sort((a, b) => a.start.localeCompare(b.start)) },
    }));
    setForm((f) => ({ ...f, start: "", end: "" }));
  };

  const removeEntry = (id) => {
    setData((d) => ({ ...d, entries: { ...d.entries, [date]: (d.entries[date] || []).filter((e) => e.id !== id) } }));
  };

  return (
    <div>
      <DayWheel entries={entries} />
      <Legend2 entries={entries} />

      <div style={{ marginTop: 32 }}>
        <SectionLabel>Registra tempo</SectionLabel>
        <div className="dt-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="dt-pill-row">
            {CATEGORIES.filter((c) => c.id !== "altro").map((c) => (
              <Pill key={c.id} active={form.category === c.id} color={c.color} onClick={() => setForm((f) => ({ ...f, category: c.id }))}>
                <c.Icon size={13} /> {c.label}
              </Pill>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="dt-field">
              <label>Inizio</label>
              <input type="time" value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))} />
            </div>
            <div className="dt-field">
              <label>Fine</label>
              <input type="time" value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))} />
            </div>
          </div>
          {error && <p className="dt-error">{error}</p>}
          <button onClick={addEntry} className="dt-btn-primary">
            <Plus size={16} /> Aggiungi attività
          </button>
        </div>
      </div>

      {entries.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <SectionLabel>Attività di oggi</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {entries.map((e) => {
              const cat = CAT_MAP[e.category];
              return (
                <div key={e.id} className="dt-entry-row">
                  <span className="dt-entry-bar" style={{ background: cat.color }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="dt-entry-title">{cat.label}</div>
                    <div className="dt-entry-sub">{e.start} – {e.end} · {minsToHM(e.duration)}</div>
                  </div>
                  <button onClick={() => removeEntry(e.id)} className="dt-entry-delete">
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------- History Tab --------------------------- */

function HistoryTab({ data }) {
  const dates = useMemo(
    () => Object.keys(data.entries).filter((d) => (data.entries[d] || []).length > 0).sort().reverse(),
    [data.entries]
  );
  const [selected, setSelected] = useState(dates[0] || null);

  useEffect(() => {
    if (!selected && dates.length) setSelected(dates[0]);
  }, [dates, selected]);

  const entries = selected ? data.entries[selected] || [] : [];
  const idx = dates.indexOf(selected);

  if (dates.length === 0) {
    return (
      <div className="dt-empty">
        <Calendar size={28} style={{ color: MUTED }} />
        <p>Ancora nessuno storico. Le giornate tracciate compariranno qui.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="dt-history-nav">
        <button disabled={idx >= dates.length - 1} onClick={() => setSelected(dates[idx + 1])}>
          <ChevronLeft size={18} />
        </button>
        <div className="dt-history-date">{fmtDateLabel(selected)}</div>
        <button disabled={idx <= 0} onClick={() => setSelected(dates[idx - 1])}>
          <ChevronRight size={18} />
        </button>
      </div>

      <DayWheel entries={entries} />
      <Legend2 entries={entries} />

      <div style={{ marginTop: 32 }}>
        <SectionLabel>Tutte le giornate</SectionLabel>
        <div style={{ maxHeight: 256, overflowY: "auto" }}>
          {dates.map((d) => {
            const total = (data.entries[d] || []).reduce((s, e) => s + e.duration, 0);
            return (
              <button key={d} onClick={() => setSelected(d)} className={`dt-list-btn ${d === selected ? "active" : ""}`}>
                <span style={{ textTransform: "capitalize" }}>{fmtDateLabel(d)}</span>
                <span className="stat">{minsToHM(total)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Trends Tab --------------------------- */

function aggregateByPeriod(entries, dateList) {
  return dateList.map((period) => {
    const row = { name: period.label };
    CATEGORIES.forEach((c) => (row[c.id] = 0));
    period.dates.forEach((d) => {
      (entries[d] || []).forEach((e) => {
        row[e.category] = (row[e.category] || 0) + e.duration / 60;
      });
    });
    return row;
  });
}

function lastNWeeks(n) {
  const weeks = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const end = new Date(now);
    end.setDate(now.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    const dates = [];
    for (let j = 0; j < 7; j++) {
      const d = new Date(start);
      d.setDate(start.getDate() + j);
      dates.push(localDateStr(d));
    }
    weeks.push({ key: i, label: `${start.getDate()}/${start.getMonth() + 1}`, dates });
  }
  return weeks;
}

function lastNMonths(n) {
  const months = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const dates = [];
    for (let day = 1; day <= nextD.getDate(); day++) {
      dates.push(localDateStr(new Date(d.getFullYear(), d.getMonth(), day)));
    }
    months.push({ key: i, label: d.toLocaleDateString("it-IT", { month: "short" }), dates });
  }
  return months;
}

function TrendsTab({ data }) {
  const [range, setRange] = useState("week");
  const [catFilter, setCatFilter] = useState(null);

  const periods = range === "week" ? lastNWeeks(8) : lastNMonths(6);
  const chartData = useMemo(() => aggregateByPeriod(data.entries, periods), [data.entries, range]);
  const activeCats = catFilter ? CATEGORIES.filter((c) => c.id === catFilter) : CATEGORIES.filter((c) => c.id !== "altro");

  const dailyTrend = useMemo(() => {
    if (!catFilter) return [];
    const days = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const ds = localDateStr(d);
      const mins = (data.entries[ds] || []).filter((e) => e.category === catFilter).reduce((s, e) => s + e.duration, 0);
      days.push({ name: `${d.getDate()}/${d.getMonth() + 1}`, minuti: mins });
    }
    return days;
  }, [data.entries, catFilter]);

  return (
    <div>
      <SectionLabel>Filtra per attività</SectionLabel>
      <div className="dt-pill-row" style={{ marginBottom: 24 }}>
        <Pill active={!catFilter} color={INK} onClick={() => setCatFilter(null)}>Tutte</Pill>
        {CATEGORIES.filter((c) => c.id !== "altro").map((c) => (
          <Pill key={c.id} active={catFilter === c.id} color={c.color} onClick={() => setCatFilter(catFilter === c.id ? null : c.id)}>
            <c.Icon size={13} /> {c.label}
          </Pill>
        ))}
      </div>

      {catFilter && (
        <div style={{ marginBottom: 32 }}>
          <SectionLabel>Andamento ultimi 30 giorni — {CAT_MAP[catFilter].label}</SectionLabel>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={dailyTrend}>
              <CartesianGrid stroke={PAPER_LINE} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: MUTED }} interval={4} axisLine={{ stroke: PAPER_LINE }} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: MUTED }} axisLine={false} tickLine={false} width={30} />
              <Tooltip
                contentStyle={{ background: PAPER_RAISED, border: `1px solid ${PAPER_LINE}`, borderRadius: 10, color: INK }}
                formatter={(v) => [minsToHM(v), "durata"]}
              />
              <Line type="monotone" dataKey="minuti" stroke={CAT_MAP[catFilter].color} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <SectionLabel>Aggregato {range === "week" ? "settimanale" : "mensile"}</SectionLabel>
      </div>
      <div className="dt-pill-row" style={{ marginBottom: 12 }}>
        <Pill active={range === "week"} color={INK} onClick={() => setRange("week")}>Settimane</Pill>
        <Pill active={range === "month"} color={INK} onClick={() => setRange("month")}>Mesi</Pill>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData}>
          <CartesianGrid stroke={PAPER_LINE} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: MUTED }} axisLine={{ stroke: PAPER_LINE }} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} width={28} unit="h" />
          <Tooltip
            contentStyle={{ background: PAPER_RAISED, border: `1px solid ${PAPER_LINE}`, borderRadius: 10, color: INK }}
            formatter={(v, n) => [`${v.toFixed(1)}h`, CAT_MAP[n]?.label || n]}
          />
          {activeCats.map((c) => (
            <Bar key={c.id} dataKey={c.id} stackId="a" fill={c.color} radius={activeCats.length === 1 ? [4, 4, 0, 0] : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* --------------------------- Reminders Tab --------------------------- */

const isNative = Capacitor.isNativePlatform();
// id numerico stabile per ogni promemoria, richiesto dal plugin nativo
const reminderNumId = (id) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 2147483647;
};

function RemindersTab({ data, setData }) {
  const [time, setTime] = useState("09:00");
  const [label, setLabel] = useState("");
  const [permission, setPermission] = useState(
    isNative ? "unknown" : (typeof Notification !== "undefined" ? Notification.permission : "unsupported")
  );

  useEffect(() => {
    if (isNative) {
      LocalNotifications.checkPermissions().then((p) => setPermission(p.display));
    }
  }, []);

  // Ripianifica tutte le notifiche ogni volta che cambia la lista promemoria
  useEffect(() => {
    if (isNative) {
      (async () => {
        try {
          const pending = await LocalNotifications.getPending();
          if (pending.notifications.length) {
            await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
          }
          if (data.reminders.length === 0) return;
          await LocalNotifications.schedule({
            notifications: data.reminders.map((r) => {
              const [h, m] = r.time.split(":").map(Number);
              return {
                id: reminderNumId(r.id),
                title: "Promemoria attività",
                body: r.label || "Cosa hai fatto? Registra il tempo.",
                schedule: { on: { hour: h, minute: m }, allowWhileIdle: true },
              };
            }),
          });
        } catch {
          // permessi non ancora concessi: verranno ripianificate dopo requestPerm
        }
      })();
      return;
    }
    // fallback browser: timer valido solo mentre la pagina resta aperta
    if (typeof Notification === "undefined") return;
    const timers = [];
    data.reminders.forEach((r) => {
      const [h, m] = r.time.split(":").map(Number);
      const now = new Date();
      const target = new Date();
      target.setHours(h, m, 0, 0);
      if (target < now) target.setDate(target.getDate() + 1);
      const ms = target - now;
      const id = setTimeout(() => {
        if (Notification.permission === "granted") {
          new Notification("Promemoria attività", { body: r.label || "Cosa hai fatto? Registra il tempo." });
        }
      }, ms);
      timers.push(id);
    });
    return () => timers.forEach(clearTimeout);
  }, [data.reminders]);

  const requestPerm = async () => {
    if (isNative) {
      const p = await LocalNotifications.requestPermissions();
      setPermission(p.display);
      return;
    }
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPermission(p);
  };

  const addReminder = () => {
    const r = { id: crypto.randomUUID(), time, label };
    setData((d) => ({ ...d, reminders: [...d.reminders, r].sort((a, b) => a.time.localeCompare(b.time)) }));
    setLabel("");
  };
  const removeReminder = (id) => {
    setData((d) => ({ ...d, reminders: d.reminders.filter((r) => r.id !== id) }));
  };

  return (
    <div>
      <SectionLabel>Promemoria</SectionLabel>
      <p className="dt-reminder-note">
        {isNative
          ? "Le sveglie funzionano anche a telefono bloccato o con l'app chiusa, grazie alle notifiche di sistema."
          : "I promemoria funzionano solo mentre questa pagina resta aperta nel browser: per sveglie reali che arrivano anche a telefono bloccato serve l'app installata come APK nativo."}
      </p>

      {permission !== "granted" && permission !== "unsupported" && (
        <button onClick={requestPerm} className="dt-btn-outline" style={{ marginBottom: 16 }}>
          <Bell size={15} /> Attiva le notifiche
        </button>
      )}

      <div className="dt-card" style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div className="dt-field">
            <label>Orario</label>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="dt-field" style={{ flex: 2 }}>
            <label>Nota (opzionale)</label>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="es. Registra la palestra" />
          </div>
        </div>
        <button onClick={addReminder} className="dt-btn-primary">
          <Plus size={16} /> Aggiungi promemoria
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.reminders.map((r) => (
          <div key={r.id} className="dt-entry-row">
            <Clock size={15} style={{ color: MUTED }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="dt-entry-title">{r.time}</div>
              {r.label && <div className="dt-entry-sub">{r.label}</div>}
            </div>
            <button onClick={() => removeReminder(r.id)} className="dt-entry-delete">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------- App shell --------------------------- */

const TABS = [
  { id: "today", label: "Oggi", Icon: Clock },
  { id: "history", label: "Storico", Icon: Calendar },
  { id: "trends", label: "Trend", Icon: TrendingUp },
  { id: "reminders", label: "Sveglie", Icon: Bell },
];

export default function App() {
  const [data, setDataRaw] = useState(loadData);
  const [tab, setTab] = useState("today");
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const setData = useCallback((updater) => {
    setDataRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveData(next);
      return next;
    });
  }, []);

  const titles = {
    today: "Il tuo giorno",
    history: "Storico",
    trends: "Grafici e trend",
    reminders: "Sveglie e promemoria",
  };

  return (
    <div className="dt-app">
      <style>{GLOBAL_CSS}</style>
      <div className="dt-shell">
        <header className="dt-header">
          <div className="dt-header-date">
            {now.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <h1 className="dt-header-title">{titles[tab]}</h1>
        </header>

        <main className="dt-main">
          {tab === "today" && <TodayTab data={data} setData={setData} />}
          {tab === "history" && <HistoryTab data={data} />}
          {tab === "trends" && <TrendsTab data={data} />}
          {tab === "reminders" && <RemindersTab data={data} setData={setData} />}
        </main>

        <nav className="dt-nav">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`dt-nav-btn ${tab === t.id ? "active" : ""}`}>
              <t.Icon size={19} strokeWidth={tab === t.id ? 2.4 : 1.8} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
