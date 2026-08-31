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
  Droplet, Pencil, X, SlidersHorizontal, Download,
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
    // storage non disponibile
  }
}

function getActiveCategories(data) {
  const base = BASE_CATEGORIES.filter((c) => c.id !== "altro" && !data.hiddenBase.includes(c.id));
  const custom = data.customCategories.map((c) => ({ ...c, Icon: Tag, custom: true }));
  return [...base, ...custom];
}

function resolveEntry(e) {
  if (e.label && e.color) return { label: e.label, color: e.color };
  const c = BASE_MAP[e.category];
  if (c) return { label: c.label, color: c.color };
  return { label: e.category || "Sconosciuto", color: MUTED };
}

const formatWater = (ml) => (ml >= 1000 ? `${(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 1)}L` : `${ml}ml`);
const waterTotal = (list) => (list || []).reduce((s, e) => s + e.ml, 0);

/* ---------------------------------------------------------
   UI Components
--------------------------------------------------------- */
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
      <div className="dt-card" style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
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

      <SectionLabel>Backup dei dati</SectionLabel>
      <div className="dt-card">
        <button
          onClick={() => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
            const downloadAnchor = document.createElement("a");
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `day-tracker-backup-${todayStr()}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
          }}
          className="dt-btn-outline"
        >
          <Download size={16} /> Scarica Backup JSON
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(loadData);

  useEffect(() => {
    saveData(data);
  }, [data]);

  return (
    <div className="dt-app">
      <div className="dt-shell">
        <header className="dt-header">
          <div className="dt-header-date">Versione 1.1 (Test Firma)</div>
          <h1 className="dt-header-title">Day Tracker</h1>
        </header>

        <main className="dt-main">
          <TodayTab data={data} setData={setData} />
          <div style={{ marginTop: 32 }}>
            <WaterSection data={data} setData={setData} />
          </div>
        </main>
      </div>
    </div>
  );
}
