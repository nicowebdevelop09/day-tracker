import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, ReferenceLine,
} from "recharts";
import {
  Moon, Wallet, Sparkles, Brain, Repeat, Dumbbell, Trophy,
  Users, CircleEllipsis, Plus, Trash2, Calendar, TrendingUp,
  Clock, ChevronLeft, ChevronRight, Bell, Tag, EyeOff, Eye, Check,
  Droplet, Pencil, X, SlidersHorizontal,
} from "lucide-react";

/* ---------------------------------------------------------
   Token di design
--------------------------------------------------------- */
const INK = "#EDE9DE";
const PAPER = "#15161B";
const PAPER_RAISED = "#1D1F26";
const PAPER_LINE = "#2A2C35";
const MUTED = "#8C8E9B";
const WATER = "#5FA8D3";
const MINUTES_PER_DAY = 24 * 60;

const BASE_CATEGORIES = [
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
const BASE_MAP = Object.fromEntries(BASE_CATEGORIES.map((c) => [c.id, c]));

const PALETTE = [
  "#7C8BD9", "#4FA37B", "#D4AF37", "#9B84E0", "#4CB0A6", "#D46A5C",
  "#E0954E", "#D67AA8", "#6FA8DC", "#B5C34C", "#C97064", "#5FA8A0",
];

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
    if (!raw) return { entries: {}, reminders: [], hiddenBase: [], customCategories: [], water: {}, waterGoal: 2000, allowOnetime: true, waterUnit: "ml" };
    const parsed = JSON.parse(raw);
    return { entries: {}, reminders: [], hiddenBase: [], customCategories: [], water: {}, waterGoal: 2000, allowOnetime: true, waterUnit: "ml", ...parsed };
  } catch {
    return { entries: {}, reminders: [], hiddenBase: [], customCategories: [], water: {}, waterGoal: 2000, allowOnetime: true, waterUnit: "ml" };
  }
}
function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage non disponibile: si continua solo in memoria
  }
}

// Categorie selezionabili per registrare tempo: base non nascoste + personalizzate.
// "Altro" non è mai qui dentro: è solo il residuo automatico della ruota.
function getActiveCategories(data) {
  const base = BASE_CATEGORIES.filter((c) => c.id !== "altro" && !data.hiddenBase.includes(c.id));
  const custom = data.customCategories.map((c) => ({ ...c, Icon: Tag, custom: true }));
  return [...base, ...custom];
}

// Risolve etichetta/colore di una voce registrata: usa i dati "cotti" dentro
// la voce stessa se presenti (nuovo formato), altrimenti ripiega sulla
// categoria base corrispondente (compatibilità con dati salvati prima).
function resolveEntry(e) {
  if (e.label && e.color) return { label: e.label, color: e.color };
  const c = BASE_MAP[e.category];
  if (c) return { label: c.label, color: c.color };
  return { label: e.category || "Sconosciuto", color: MUTED };
}

const formatWater = (ml) => (ml >= 1000 ? `${(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 1)}L` : `${ml}ml`);
const waterTotal = (list) => (list || []).reduce((s, e) => s + e.ml, 0);

/* ---------------------------------------------------------
   Foglio di stile globale
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
    padding: 8px 4px calc(env(safe-area-inset-bottom, 0px) + 8px) 4px;
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
    padding: 6px 8px;
    border-radius: 12px;
    background: transparent;
    border: none;
    color: ${MUTED};
  }
  .dt-nav-btn.active { color: ${INK}; }
  .dt-nav-btn span { font-size: 9.5px; }

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

  .dt-cat-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 4px;
    border-bottom: 1px solid ${PAPER_LINE};
  }
  .dt-cat-row:last-child { border-bottom: none; }
  .dt-cat-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .dt-cat-label { color: ${INK}; font-size: 14px; flex: 1; }
  .dt-cat-label.hidden-cat { color: ${MUTED}; text-decoration: line-through; }
  .dt-icon-btn {
    background: transparent;
    border: none;
    color: ${MUTED};
    padding: 6px;
    flex-shrink: 0;
  }

  .dt-swatch-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .dt-swatch {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .dt-swatch.active { border-color: ${INK}; }

  .dt-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .dt-toggle-row .desc { color: ${MUTED}; font-size: 12px; margin-top: 2px; }
  .dt-switch {
    width: 42px; height: 24px; border-radius: 999px; border: none; flex-shrink: 0;
    background: ${PAPER_LINE}; position: relative;
  }
  .dt-switch.on { background: ${WATER}; }
  .dt-switch .knob {
    position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%;
    background: ${INK}; transition: transform .15s;
  }
  .dt-switch.on .knob { transform: translateX(18px); }

  .dt-today-row { display: flex; gap: 16px; align-items: flex-start; }
  .dt-today-row > .dt-wheel-col { flex: 1; min-width: 0; }
  .dt-water-col {
    width: 96px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .dt-water-ring-btn { background: transparent; border: none; padding: 0; }
  .dt-water-label { color: ${MUTED}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
  .dt-water-panel { margin-top: 16px; }
  .dt-water-panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .dt-water-goal-edit { display: flex; gap: 8px; align-items: center; }
  .dt-link-btn { background: transparent; border: none; color: ${MUTED}; font-size: 12px; display: flex; align-items: center; gap: 4px; padding: 4px; }

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

function Switch({ on, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`dt-switch ${on ? "on" : ""}`}>
      <span className="knob" />
    </button>
  );
}

function SwatchPicker({ value, onChange }) {
  return (
    <div className="dt-swatch-row">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          className={`dt-swatch ${value === c ? "active" : ""}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
        >
          {value === c && <Check size={14} color="#fff" />}
        </button>
      ))}
    </div>
  );
}

function WaterRing({ totalMl, goalMl, size = 64, onClick }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, goalMl > 0 ? totalMl / goalMl : 0));
  const Tag_ = onClick ? "button" : "div";
  return (
    <Tag_ onClick={onClick} className={onClick ? "dt-water-ring-btn" : undefined} style={{ position: "relative", width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", width: size, height: size }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={PAPER_LINE} strokeWidth="6" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={WATER} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <b style={{ fontSize: size > 56 ? 13 : 11, color: INK }}>{Math.round(pct * 100)}%</b>
        <span style={{ fontSize: 8, color: MUTED }}>{formatWater(totalMl)}</span>
      </div>
    </Tag_>
  );
}

/* --------------------------- Day Wheel (pie) --------------------------- */

function groupEntries(entries) {
  const groups = {};
  entries.forEach((e) => {
    const key = e.category || `onetime:${e.id}`;
    const disp = resolveEntry(e);
    if (!groups[key]) groups[key] = { id: key, name: disp.label, color: disp.color, value: 0 };
    groups[key].value += e.duration;
  });
  return Object.values(groups);
}

function DayWheel({ entries }) {
  const totals = useMemo(() => {
    const slices = groupEntries(entries);
    const tracked = slices.reduce((s, d) => s + d.value, 0);
    const rest = Math.max(MINUTES_PER_DAY - tracked, 0);
    if (rest > 0) {
      slices.push({ id: "altro", name: BASE_MAP.altro.label, value: rest, color: BASE_MAP.altro.color });
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
  const rows = useMemo(() => {
    const slices = groupEntries(entries);
    const tracked = slices.reduce((s, d) => s + d.value, 0);
    const rest = Math.max(MINUTES_PER_DAY - tracked, 0);
    const list = slices.map((s) => ({ ...s, pct: Math.round((s.value / MINUTES_PER_DAY) * 100) }));
    if (rest > 0) {
      list.push({ id: "altro", name: BASE_MAP.altro.label, color: BASE_MAP.altro.color, value: rest, pct: Math.round((rest / MINUTES_PER_DAY) * 100) });
    }
    return list;
  }, [entries]);

  if (rows.length === 0) return null;

  return (
    <div className="dt-legend-grid">
      {rows.map((c) => (
        <div key={c.id} className="dt-legend-row">
          <span className="dt-legend-dot" style={{ background: c.color }} />
          <span className="dt-legend-name">{c.name}</span>
          <span className="dt-legend-stat">{minsToHM(c.value)} · {c.pct}%</span>
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
  const waterEntries = data.water[date] || [];
  const waterMl = waterTotal(waterEntries);
  const activeCats = useMemo(() => getActiveCategories(data), [data.hiddenBase, data.customCategories]);

  const [waterOpen, setWaterOpen] = useState(false);
  const [waterInput, setWaterInput] = useState("");

  const addWater = () => {
    const raw = parseFloat(waterInput.replace(",", "."));
    if (!raw || raw <= 0) return;
    const ml = data.waterUnit === "L" ? Math.round(raw * 1000) : Math.round(raw);
    const entry = { id: crypto.randomUUID(), ml, time: new Date().toTimeString().slice(0, 5) };
    setData((d) => ({ ...d, water: { ...d.water, [date]: [...(d.water[date] || []), entry] } }));
    setWaterInput("");
  };
  const removeWater = (id) => {
    setData((d) => ({ ...d, water: { ...d.water, [date]: (d.water[date] || []).filter((w) => w.id !== id) } }));
  };

  const [form, setForm] = useState({
    mode: "category",
    categoryId: activeCats[0]?.id || null,
    onetimeLabel: "",
    onetimeColor: PALETTE[0],
    start: "",
    end: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!data.allowOnetime && form.mode === "onetime") {
      setForm((f) => ({ ...f, mode: "category" }));
    }
  }, [data.allowOnetime]);

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
    let entry;
    if (form.mode === "onetime") {
      if (!form.onetimeLabel.trim()) {
        setError("Inserisci un nome per l'attività");
        return;
      }
      entry = {
        id: crypto.randomUUID(), category: null,
        label: form.onetimeLabel.trim(), color: form.onetimeColor,
        start: form.start, end: form.end, duration: dur,
      };
    } else {
      const cat = activeCats.find((c) => c.id === form.categoryId) || activeCats[0];
      if (!cat) {
        setError("Crea prima almeno una categoria");
        return;
      }
      entry = {
        id: crypto.randomUUID(), category: cat.id,
        label: cat.label, color: cat.color,
        start: form.start, end: form.end, duration: dur,
      };
    }
    setData((d) => ({
      ...d,
      entries: { ...d.entries, [date]: [...(d.entries[date] || []), entry].sort((a, b) => a.start.localeCompare(b.start)) },
    }));
    setForm((f) => ({ ...f, start: "", end: "", onetimeLabel: "" }));
  };

  const removeEntry = (id) => {
    setData((d) => ({ ...d, entries: { ...d.entries, [date]: (d.entries[date] || []).filter((e) => e.id !== id) } }));
  };

  return (
    <div>
      <div className="dt-today-row">
        <div className="dt-wheel-col">
          <DayWheel entries={entries} />
        </div>
        <div className="dt-water-col">
          <WaterRing totalMl={waterMl} goalMl={data.waterGoal} onClick={() => setWaterOpen((o) => !o)} />
          <span className="dt-water-label">Acqua</span>
        </div>
      </div>
      <Legend2 entries={entries} />

      {waterOpen && (
        <div className="dt-water-panel">
          <SectionLabel>Acqua</SectionLabel>
          <div className="dt-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ color: MUTED, fontSize: 13 }}>Obiettivo: {formatWater(data.waterGoal)}</div>

            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number" inputMode="decimal" value={waterInput} onChange={(e) => setWaterInput(e.target.value)}
                placeholder={data.waterUnit === "L" ? "litri" : "ml"}
                style={{ flex: 1, minWidth: 0, background: PAPER, border: `1px solid ${PAPER_LINE}`, color: INK, borderRadius: 10, padding: "10px 12px", fontSize: 15 }}
              />
              <button onClick={addWater} className="dt-btn-primary" style={{ width: "auto", flexShrink: 0, padding: "10px 16px", whiteSpace: "nowrap" }}>
                <Plus size={16} /> Aggiungi
              </button>
            </div>

            {waterEntries.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                {waterEntries.map((w) => (
                  <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <Droplet size={13} style={{ color: WATER }} />
                    <span style={{ color: INK }}>{formatWater(w.ml)}</span>
                    <span style={{ color: MUTED }}>· {w.time}</span>
                    <button onClick={() => removeWater(w.id)} className="dt-entry-delete" style={{ marginLeft: "auto" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: 32 }}>
        <SectionLabel>Registra tempo</SectionLabel>
        <div className="dt-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="dt-pill-row">
            {activeCats.map((c) => (
              <Pill
                key={c.id}
                active={form.mode === "category" && form.categoryId === c.id}
                color={c.color}
                onClick={() => setForm((f) => ({ ...f, mode: "category", categoryId: c.id }))}
              >
                <c.Icon size={13} /> {c.label}
              </Pill>
            ))}
            {data.allowOnetime && (
              <Pill active={form.mode === "onetime"} color={INK} onClick={() => setForm((f) => ({ ...f, mode: "onetime" }))}>
                <Plus size={13} /> Una tantum
              </Pill>
            )}
          </div>

          {form.mode === "onetime" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="dt-field">
                <label>Nome attività</label>
                <input
                  type="text"
                  value={form.onetimeLabel}
                  onChange={(e) => setForm((f) => ({ ...f, onetimeLabel: e.target.value }))}
                  placeholder="es. Trasloco, dentista..."
                />
              </div>
              <SwatchPicker value={form.onetimeColor} onChange={(c) => setForm((f) => ({ ...f, onetimeColor: c }))} />
            </div>
          )}

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
              const disp = resolveEntry(e);
              return (
                <div key={e.id} className="dt-entry-row">
                  <span className="dt-entry-bar" style={{ background: disp.color }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="dt-entry-title">{disp.label}</div>
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

/* --------------------------- Categories Tab --------------------------- */

function ActivitiesSection({ data, setData }) {
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [error, setError] = useState("");

  const toggleHidden = (id) => {
    setData((d) => {
      const hidden = d.hiddenBase.includes(id) ? d.hiddenBase.filter((x) => x !== id) : [...d.hiddenBase, id];
      return { ...d, hiddenBase: hidden };
    });
  };

  const addCustom = () => {
    setError("");
    if (!newLabel.trim()) {
      setError("Inserisci un nome per la categoria");
      return;
    }
    const cat = { id: crypto.randomUUID(), label: newLabel.trim(), color: newColor };
    setData((d) => ({ ...d, customCategories: [...d.customCategories, cat] }));
    setNewLabel("");
  };

  const removeCustom = (id) => {
    setData((d) => ({ ...d, customCategories: d.customCategories.filter((c) => c.id !== id) }));
  };

  return (
    <div>
      <div className="dt-card" style={{ marginBottom: 24 }}>
        <div className="dt-toggle-row">
          <div>
            <div style={{ color: INK, fontSize: 14 }}>Categoria "una tantum"</div>
            <div className="desc">Permette di registrare un'attività temporanea non salvata in elenco</div>
          </div>
          <Switch on={data.allowOnetime} onClick={() => setData((d) => ({ ...d, allowOnetime: !d.allowOnetime }))} />
        </div>
      </div>

      <SectionLabel>Categorie base</SectionLabel>
      <div className="dt-card" style={{ marginBottom: 24 }}>
        {BASE_CATEGORIES.filter((c) => c.id !== "altro").map((c) => {
          const hidden = data.hiddenBase.includes(c.id);
          return (
            <div key={c.id} className="dt-cat-row">
              <span className="dt-cat-dot" style={{ background: c.color }} />
              <span className={`dt-cat-label ${hidden ? "hidden-cat" : ""}`}>{c.label}</span>
              <button onClick={() => toggleHidden(c.id)} className="dt-icon-btn">
                {hidden ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
          );
        })}
      </div>

      {data.customCategories.length > 0 && (
        <>
          <SectionLabel>Categorie personalizzate</SectionLabel>
          <div className="dt-card" style={{ marginBottom: 24 }}>
            {data.customCategories.map((c) => (
              <div key={c.id} className="dt-cat-row">
                <span className="dt-cat-dot" style={{ background: c.color }} />
                <span className="dt-cat-label">{c.label}</span>
                <button onClick={() => removeCustom(c.id)} className="dt-icon-btn">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionLabel>Nuova categoria</SectionLabel>
      <div className="dt-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="dt-field">
          <label>Nome</label>
          <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="es. Studio, Casa..." />
        </div>
        <SwatchPicker value={newColor} onChange={setNewColor} />
        {error && <p className="dt-error">{error}</p>}
        <button onClick={addCustom} className="dt-btn-primary">
          <Plus size={16} /> Crea categoria
        </button>
      </div>
    </div>
  );
}

/* --------------------------- Water settings section --------------------------- */

function WaterSection({ data, setData }) {
  const toMlIfNeeded = (val) => (data.waterUnit === "L" ? Math.round(parseFloat(val || "0") * 1000) : parseInt(val || "0", 10));
  const [goalInput, setGoalInput] = useState(
    data.waterUnit === "L" ? String(data.waterGoal / 1000) : String(data.waterGoal)
  );

  const setUnit = (unit) => {
    setData((d) => ({ ...d, waterUnit: unit }));
    setGoalInput(unit === "L" ? String(data.waterGoal / 1000) : String(data.waterGoal));
  };

  const saveGoal = () => {
    const ml = toMlIfNeeded(goalInput);
    if (ml && ml > 0) setData((d) => ({ ...d, waterGoal: ml }));
  };

  return (
    <div>
      <SectionLabel>Unità di misura</SectionLabel>
      <div className="dt-pill-row" style={{ marginBottom: 24 }}>
        <Pill active={data.waterUnit === "ml"} color={WATER} onClick={() => setUnit("ml")}>Millilitri (ml)</Pill>
        <Pill active={data.waterUnit === "L"} color={WATER} onClick={() => setUnit("L")}>Litri (L)</Pill>
      </div>

      <SectionLabel>Obiettivo giornaliero</SectionLabel>
      <div className="dt-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="number" value={goalInput} onChange={(e) => setGoalInput(e.target.value)}
            style={{ flex: 1, minWidth: 0, background: PAPER, border: `1px solid ${PAPER_LINE}`, color: INK, borderRadius: 10, padding: "10px 12px", fontSize: 15 }}
          />
          <span style={{ color: MUTED, fontSize: 13 }}>{data.waterUnit}</span>
        </div>
        <button onClick={saveGoal} className="dt-btn-primary">
          <Check size={16} /> Salva obiettivo
        </button>
        <div style={{ color: MUTED, fontSize: 12 }}>Attuale: {formatWater(data.waterGoal)}</div>
      </div>
    </div>
  );
}

/* --------------------------- Personalization Tab --------------------------- */

function PersonalizationTab({ data, setData }) {
  const [section, setSection] = useState("activities");
  return (
    <div>
      <div className="dt-pill-row" style={{ marginBottom: 24 }}>
        <Pill active={section === "activities"} color={INK} onClick={() => setSection("activities")}>Attività</Pill>
        <Pill active={section === "water"} color={WATER} onClick={() => setSection("water")}>Acqua</Pill>
        <Pill active={section === "reminders"} color={INK} onClick={() => setSection("reminders")}>Sveglie</Pill>
      </div>
      {section === "activities" && <ActivitiesSection data={data} setData={setData} />}
      {section === "water" && <WaterSection data={data} setData={setData} />}
      {section === "reminders" && <RemindersTab data={data} setData={setData} />}
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
  const waterMl = selected ? waterTotal(data.water[selected]) : 0;
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

      <div className="dt-today-row">
        <div className="dt-wheel-col">
          <DayWheel entries={entries} />
        </div>
        <div className="dt-water-col">
          <WaterRing totalMl={waterMl} goalMl={data.waterGoal} />
          <span className="dt-water-label">Acqua</span>
        </div>
      </div>
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

// Aggrega dinamicamente per categoria (base+personalizzate incontrate nei
// dati), raggruppando tutte le voci "una tantum" in un'unica fascia neutra.
function aggregateByPeriod(entriesByDate, dateList) {
  const seriesMap = {};
  const rows = dateList.map((period) => {
    const row = { name: period.label };
    period.dates.forEach((d) => {
      (entriesByDate[d] || []).forEach((e) => {
        const key = e.category || "onetime";
        const disp = key === "onetime" ? { label: "Una tantum", color: MUTED } : resolveEntry(e);
        if (!seriesMap[key]) seriesMap[key] = { id: key, label: disp.label, color: disp.color };
        row[key] = (row[key] || 0) + e.duration / 60;
      });
    });
    return row;
  });
  return { rows, series: Object.values(seriesMap) };
}

function TrendsTab({ data }) {
  const [range, setRange] = useState("week");
  const [catFilter, setCatFilter] = useState(null);
  const activeCats = useMemo(() => getActiveCategories(data), [data.hiddenBase, data.customCategories]);

  const periods = range === "week" ? lastNWeeks(8) : lastNMonths(6);
  const { rows: chartData, series } = useMemo(() => aggregateByPeriod(data.entries, periods), [data.entries, range]);
  const visibleSeries = catFilter ? series.filter((s) => s.id === catFilter) : series;

  const dailyTrend = useMemo(() => {
    if (!catFilter) return [];
    const days = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const ds = localDateStr(d);
      const mins = (data.entries[ds] || []).filter((e) => (e.category || "onetime") === catFilter).reduce((s, e) => s + e.duration, 0);
      days.push({ name: `${d.getDate()}/${d.getMonth() + 1}`, minuti: mins });
    }
    return days;
  }, [data.entries, catFilter]);

  const filterCat = series.find((s) => s.id === catFilter);

  const waterDaily = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const ds = localDateStr(d);
      days.push({ name: `${d.getDate()}/${d.getMonth() + 1}`, ml: waterTotal(data.water[ds]) });
    }
    return days;
  }, [data.water]);

  const waterAggregate = useMemo(
    () => periods.map((p) => ({
      name: p.label,
      ml: Math.round(p.dates.reduce((s, d) => s + waterTotal(data.water[d]), 0) / p.dates.length),
    })),
    [data.water, range]
  );

  return (
    <div>
      <SectionLabel>Filtra per attività</SectionLabel>
      <div className="dt-pill-row" style={{ marginBottom: 24 }}>
        <Pill active={!catFilter} color={INK} onClick={() => setCatFilter(null)}>Tutte</Pill>
        {activeCats.map((c) => (
          <Pill key={c.id} active={catFilter === c.id} color={c.color} onClick={() => setCatFilter(catFilter === c.id ? null : c.id)}>
            <c.Icon size={13} /> {c.label}
          </Pill>
        ))}
      </div>

      {catFilter && filterCat && (
        <div style={{ marginBottom: 32 }}>
          <SectionLabel>Andamento ultimi 30 giorni — {filterCat.label}</SectionLabel>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={dailyTrend}>
              <CartesianGrid stroke={PAPER_LINE} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: MUTED }} interval={4} axisLine={{ stroke: PAPER_LINE }} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: MUTED }} axisLine={false} tickLine={false} width={30} />
              <Tooltip
                contentStyle={{ background: PAPER_RAISED, border: `1px solid ${PAPER_LINE}`, borderRadius: 10, color: INK }}
                formatter={(v) => [minsToHM(v), "durata"]}
              />
              <Line type="monotone" dataKey="minuti" stroke={filterCat.color} strokeWidth={2} dot={false} />
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
            formatter={(v, n) => [`${v.toFixed(1)}h`, series.find((s) => s.id === n)?.label || n]}
          />
          {visibleSeries.map((s) => (
            <Bar key={s.id} dataKey={s.id} stackId="a" fill={s.color} radius={visibleSeries.length === 1 ? [4, 4, 0, 0] : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <div style={{ marginTop: 32 }}>
        <SectionLabel>Acqua — ultimi 30 giorni</SectionLabel>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={waterDaily}>
            <CartesianGrid stroke={PAPER_LINE} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: MUTED }} interval={4} axisLine={{ stroke: PAPER_LINE }} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: MUTED }} axisLine={false} tickLine={false} width={30} />
            <Tooltip
              contentStyle={{ background: PAPER_RAISED, border: `1px solid ${PAPER_LINE}`, borderRadius: 10, color: INK }}
              formatter={(v) => [formatWater(v), "acqua"]}
            />
            <ReferenceLine y={data.waterGoal} stroke={MUTED} strokeDasharray="4 4" />
            <Line type="monotone" dataKey="ml" stroke={WATER} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionLabel>Media acqua {range === "week" ? "settimanale" : "mensile"} (al giorno)</SectionLabel>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={waterAggregate}>
            <CartesianGrid stroke={PAPER_LINE} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: MUTED }} axisLine={{ stroke: PAPER_LINE }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: MUTED }} axisLine={false} tickLine={false} width={30} />
            <Tooltip
              contentStyle={{ background: PAPER_RAISED, border: `1px solid ${PAPER_LINE}`, borderRadius: 10, color: INK }}
              formatter={(v) => [formatWater(v), "media/giorno"]}
            />
            <ReferenceLine y={data.waterGoal} stroke={MUTED} strokeDasharray="4 4" />
            <Bar dataKey="ml" fill={WATER} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* --------------------------- Reminders Tab --------------------------- */

const isNative = Capacitor.isNativePlatform();
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
          // permessi non ancora concessi
        }
      })();
      return;
    }
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
  { id: "settings", label: "Personalizza", Icon: SlidersHorizontal },
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
    settings: "Personalizza",
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
          {tab === "settings" && <PersonalizationTab data={data} setData={setData} />}
        </main>

        <nav className="dt-nav">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`dt-nav-btn ${tab === t.id ? "active" : ""}`}>
              <t.Icon size={18} strokeWidth={tab === t.id ? 2.4 : 1.8} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
