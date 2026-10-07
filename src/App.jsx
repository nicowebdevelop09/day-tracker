import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, ReferenceLine,
} from "recharts";
import {
  Moon, Wallet, Sparkles, Brain, Repeat, Dumbbell, Trophy,
  Users, CircleEllipsis, Plus, Trash2, Calendar, TrendingUp,
  Clock, ChevronLeft, ChevronRight, Bell, Tag, EyeOff, Eye, Check,
  Droplet, Pencil, X, SlidersHorizontal, Palette, ListChecks, RotateCcw, ChevronDown, ArrowUp, ArrowDown,
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

const DEFAULT_PROFILE = { name: "", birthYear: null, heightCm: null, weightKg: null };
const DEFAULT_TASKS = [{ id: "morning-routine", label: "Routine mattutina", color: "#4CB0A6" }];
const DEFAULT_CATEGORY_ORDER = BASE_CATEGORIES.filter((c) => c.id !== "altro").map((c) => c.id);

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { entries: {}, reminders: [], hiddenBase: [], customCategories: [], water: {}, waterGoal: 2000, allowOnetime: true, waterUnit: "ml", profile: DEFAULT_PROFILE, onboarded: false, tasks: DEFAULT_TASKS, taskCompletions: {}, categoryOrder: DEFAULT_CATEGORY_ORDER, policyAccepted: false };
    const parsed = JSON.parse(raw);
    const merged = { entries: {}, reminders: [], hiddenBase: [], customCategories: [], water: {}, waterGoal: 2000, allowOnetime: true, waterUnit: "ml", profile: DEFAULT_PROFILE, onboarded: false, tasks: DEFAULT_TASKS, taskCompletions: {}, categoryOrder: DEFAULT_CATEGORY_ORDER, policyAccepted: false, ...parsed };
    merged.customCategories.forEach((c) => { if (!merged.categoryOrder.includes(c.id)) merged.categoryOrder.push(c.id); });
    return merged;
  } catch {
    return { entries: {}, reminders: [], hiddenBase: [], customCategories: [], water: {}, waterGoal: 2000, allowOnetime: true, waterUnit: "ml", profile: DEFAULT_PROFILE, onboarded: false, tasks: DEFAULT_TASKS, taskCompletions: {}, categoryOrder: DEFAULT_CATEGORY_ORDER, policyAccepted: false };
  }
}
function saveData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function getActiveCategories(data) {
  const base = BASE_CATEGORIES.filter((c) => c.id !== "altro" && !data.hiddenBase.includes(c.id));
  const custom = data.customCategories.map((c) => ({ ...c, Icon: Tag, custom: true }));
  const all = [...base, ...custom];
  const order = data.categoryOrder || [];
  return all.sort((a, b) => {
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

function moveInOrder(orderArr, activeIds, id, direction) {
  const activeOrder = orderArr.filter((i) => activeIds.has(i));
  const idx = activeOrder.indexOf(id);
  const swapIdx = idx + direction;
  if (idx === -1 || swapIdx < 0 || swapIdx >= activeOrder.length) return orderArr;
  [activeOrder[idx], activeOrder[swapIdx]] = [activeOrder[swapIdx], activeOrder[idx]];
  let ai = 0;
  return orderArr.map((i) => (activeIds.has(i) ? activeOrder[ai++] : i));
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
   Foglio di stile globale
--------------------------------------------------------- */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap');
  * { box-sizing: border-box; }
  html, body, #root { height: 100%; margin: 0; }
  body { background: ${PAPER}; }
  .dt-app { background: ${PAPER}; min-height: 100vh; min-height: 100dvh; display: flex; justify-content: center; font-family: 'Inter', sans-serif; color: ${INK}; }
  .dt-shell { width: 100%; max-width: 480px; min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; position: relative; }
  .dt-header { padding: calc(env(safe-area-inset-top, 0px) + 24px) 20px 12px 20px; flex-shrink: 0; }
  .dt-header-date { color: ${MUTED}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; margin-bottom: 4px; }
  .dt-header-title { font-family: 'Fraunces', serif; color: ${INK}; font-size: 26px; font-weight: 500; margin: 0; }
  .dt-main { flex: 1 1 auto; overflow-y: auto; padding: 0 20px 24px 20px; -webkit-overflow-scrolling: touch; }
  .dt-nav { background: ${PAPER_RAISED}; border-top: 1px solid ${PAPER_LINE}; padding: 8px 4px calc(env(safe-area-inset-bottom, 0px) + 8px) 4px; display: flex; justify-content: space-around; flex-shrink: 0; position: sticky; bottom: 0; }
  .dt-nav-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 8px; border-radius: 12px; background: transparent; border: none; color: ${MUTED}; }
  .dt-nav-btn.active { color: ${INK}; }
  .dt-nav-btn span { font-size: 9.5px; }
  .dt-section-label { color: ${MUTED}; letter-spacing: 0.14em; text-transform: uppercase; font-size: 11px; font-weight: 500; margin-bottom: 8px; }
  .dt-pill-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .dt-pill { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; border: 1px solid ${PAPER_LINE}; background: transparent; color: ${MUTED}; font-size: 14px; padding: 7px 14px; white-space: nowrap; }
  .dt-card { background: ${PAPER_RAISED}; border: 1px solid ${PAPER_LINE}; border-radius: 18px; padding: 16px; }
  .dt-field { flex: 1; display: flex; flex-direction: column; }
  .dt-field label { color: ${MUTED}; font-size: 12px; margin-bottom: 4px; }
  .dt-field input { background: ${PAPER}; border: 1px solid ${PAPER_LINE}; color: ${INK}; border-radius: 10px; padding: 10px 12px; font-size: 15px; font-family: inherit; width: 100%; }
  .dt-field input::-webkit-calendar-picker-indicator { filter: invert(0.7); }
  .dt-btn-primary { width: 100%; background: ${INK}; color: ${PAPER}; border: none; border-radius: 12px; padding: 13px; font-size: 15px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 6px; }
  .dt-btn-outline { width: 100%; background: ${PAPER_RAISED}; color: ${INK}; border: 1px solid ${PAPER_LINE}; border-radius: 12px; padding: 12px; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; }
  .dt-error { color: #D46A5C; font-size: 13px; margin: 0; }
  .dt-entry-row { display: flex; align-items: center; gap: 12px; background: ${PAPER_RAISED}; border: 1px solid ${PAPER_LINE}; border-radius: 14px; padding: 12px; }
  .dt-entry-bar { width: 5px; height: 34px; border-radius: 4px; flex-shrink: 0; }
  .dt-entry-title { color: ${INK}; font-size: 15px; font-weight: 500; }
  .dt-entry-sub { color: ${INK}; opacity: 0.75; font-size: 12px; margin-top: 2px; }
  .dt-entry-delete { background: transparent; border: none; color: ${MUTED}; padding: 6px; flex-shrink: 0; }
  .dt-legend-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; margin-top: 16px; }
  .dt-legend-row { display: flex; align-items: center; gap: 8px; font-size: 14px; min-width: 0; }
  .dt-legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .dt-legend-name { color: ${INK}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dt-legend-stat { color: ${MUTED}; margin-left: auto; font-size: 12px; white-space: nowrap; }
  .dt-wheel-center-value { font-family: 'Fraunces', serif; color: ${INK}; font-size: 24px; font-weight: 500; }
  .dt-wheel-center-label { color: ${MUTED}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 2px; }
  .dt-history-date { font-family: 'Fraunces', serif; color: ${INK}; font-size: 18px; text-transform: capitalize; }
  .dt-empty { display: flex; flex-direction: column; align-items: center; padding: 70px 0; text-align: center; color: ${MUTED}; }
  .dt-empty p { font-size: 14px; margin-top: 12px; }
  .dt-reminder-note { color: ${MUTED}; font-size: 12px; line-height: 1.6; margin-bottom: 16px; }
  .dt-cat-row { display: flex; align-items: center; gap: 10px; padding: 10px 4px; border-bottom: 1px solid ${PAPER_LINE}; }
  .dt-cat-row:last-child { border-bottom: none; }
  .dt-cat-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .dt-cat-label { color: ${INK}; font-size: 14px; flex: 1; }
  .dt-cat-label.hidden-cat { color: ${MUTED}; text-decoration: line-through; }
  .dt-icon-btn { background: transparent; border: none; color: ${MUTED}; padding: 6px; flex-shrink: 0; }
  .dt-hs-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 14px; border-radius: 999px; outline: none; cursor: pointer; border: 1px solid ${PAPER_LINE}; }
  .dt-hs-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%; background: #fff; border: 3px solid ${PAPER}; box-shadow: 0 0 0 1px ${PAPER_LINE}, 0 2px 4px rgba(0,0,0,0.4); }
  .dt-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .dt-toggle-row .desc { color: ${MUTED}; font-size: 12px; margin-top: 2px; }
  .dt-switch { width: 42px; height: 24px; border-radius: 999px; border: none; flex-shrink: 0; background: ${PAPER_LINE}; position: relative; }
  .dt-switch.on { background: ${WATER}; }
  .dt-switch .knob { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: ${INK}; transition: transform .15s; }
  .dt-switch.on .knob { transform: translateX(18px); }
  .dt-today-row { display: flex; gap: 22px; align-items: flex-start; }
  .dt-today-row > .dt-wheel-col { flex: 1; min-width: 0; }
  .dt-side-col { width: 128px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 40px; }
  .dt-water-col { width: 96px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .dt-water-ring-btn { background: transparent; border: none; padding: 0; }
  .dt-water-label { color: ${MUTED}; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
  .dt-link-btn { background: transparent; border: none; color: ${MUTED}; font-size: 12px; display: flex; align-items: center; gap: 4px; padding: 4px; }
  .dt-task-grid { width: 112px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .dt-task-square { aspect-ratio: 1; border-radius: 7px; background: ${PAPER_LINE}; border: none; display: flex; align-items: center; justify-content: center; }
  .dt-task-check { width: 24px; height: 24px; border-radius: 50%; border: 2px solid ${PAPER_LINE}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: transparent; }
  .dt-calendar { margin-bottom: 20px; }
  .dt-calendar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .dt-calendar-header button { background: transparent; border: none; color: ${INK}; padding: 6px; }
  .dt-calendar-header span { color: ${INK}; font-size: 14px; text-transform: capitalize; font-weight: 500; }
  .dt-calendar-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; margin-bottom: 4px; }
  .dt-calendar-weekdays span { color: ${MUTED}; font-size: 10px; text-transform: uppercase; }
  .dt-calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); row-gap: 4px; }
  .dt-cal-day { aspect-ratio: 1; border-radius: 50%; border: none; background: transparent; color: ${INK}; font-size: 13px; display: flex; align-items: center; justify-content: center; position: relative; }
  .dt-cal-day:disabled { color: ${PAPER_LINE}; }
  .dt-cal-day.has-data::after { content: ""; position: absolute; bottom: 3px; width: 4px; height: 4px; border-radius: 50%; background: ${WATER}; }
  .dt-cal-day.selected { background: ${INK}; color: ${PAPER}; font-weight: 600; }
  .dt-cal-day.selected::after { background: ${PAPER}; }
  .dt-accordion { margin-bottom: 16px; }
  .dt-accordion-header { width: 100%; display: flex; align-items: center; justify-content: space-between; background: ${PAPER_RAISED}; border: 1px solid ${PAPER_LINE}; border-radius: 14px; padding: 12px 16px; }
  .dt-accordion-header .title { display: flex; align-items: center; gap: 8px; color: ${INK}; font-size: 14px; font-weight: 500; }
  .dt-accordion-header .chev { transition: transform .15s; }
  .dt-accordion-header .chev.open { transform: rotate(180deg); }
  .dt-accordion-body { margin-top: 12px; }
  .dt-order-row { display: flex; align-items: center; gap: 8px; padding: 10px 4px; border-bottom: 1px solid ${PAPER_LINE}; }
  .dt-order-row:last-child { border-bottom: none; }
  .dt-order-arrows { display: flex; flex-direction: column; gap: 0; }
  .dt-order-arrows button { background: transparent; border: none; color: ${MUTED}; padding: 2px; }
  .dt-order-arrows button:disabled { opacity: 0.25; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: ${PAPER_LINE}; border-radius: 4px; }
`;

function Pill({ active, color, onClick, children }) {
  return (
    <button onClick={onClick} className="dt-pill" style={{ borderColor: active ? color : PAPER_LINE, background: active ? `${color}26` : "transparent", color: active ? INK : MUTED }}>
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

function AccordionRow({ title, icon: Icon, open, onToggle, children }) {
  return (
    <div className="dt-accordion">
      <button onClick={onToggle} className="dt-accordion-header">
        <span className="title"><Icon size={16} /> {title}</span>
        <ChevronDown size={16} color={MUTED} className={`chev ${open ? "open" : ""}`} />
      </button>
      {open && <div className="dt-accordion-body">{children}</div>}
    </div>
  );
}

function hsvToHex(h, s) {
  const sf = s / 100;
  const c = sf;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const m = 1 - c;
  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function hexToHueSat(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : (d / max) * 100;
  return { h, s };
}

const PURE_RED = "#FF0000";

function SwatchPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [hue, setHue] = useState(0);
  const [sat, setSat] = useState(100);

  const openPicker = () => {
    const { h, s } = hexToHueSat(value);
    setHue(h);
    setSat(s);
    setOpen(true);
  };

  const previewHex = hsvToHex(hue, sat);
  const hueGradient = "linear-gradient(to right, #FF0000, #FFFF00, #00FF00, #00FFFF, #0000FF, #FF00FF, #FF0000)";
  const satGradient = `linear-gradient(to right, #FFFFFF, ${hsvToHex(hue, 100)})`;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="button" onClick={openPicker} style={{ width: 44, height: 44, borderRadius: "50%", background: value, border: `2px solid ${PAPER_LINE}`, flexShrink: 0, padding: 0 }} />
        <div style={{ color: MUTED, fontSize: 13 }}>Tocca il cerchio per scegliere il colore</div>
      </div>
      {open && (
        <div className="dt-card" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <div className="dt-section-label" style={{ marginBottom: 8 }}>Tonalità</div>
            <input type="range" min="0" max="360" value={hue} onChange={(e) => setHue(Number(e.target.value))} className="dt-hs-slider" style={{ background: hueGradient }} />
          </div>
          <div>
            <div className="dt-section-label" style={{ marginBottom: 8 }}>Saturazione</div>
            <input type="range" min="0" max="100" value={sat} onChange={(e) => setSat(Number(e.target.value))} className="dt-hs-slider" style={{ background: satGradient }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
            <button type="button" onClick={() => setOpen(false)} className="dt-btn-outline" style={{ width: "auto", padding: "10px 18px" }}>Annulla</button>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: previewHex, border: `2px solid ${PAPER_LINE}`, flexShrink: 0 }} />
            <button type="button" onClick={() => { onChange(previewHex); setOpen(false); }} className="dt-btn-primary" style={{ width: "auto", padding: "10px 18px" }}>Conferma</button>
          </div>
        </div>
      )}
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
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={WATER} strokeWidth="6" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} />
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

// ------------------------------------------------------------------
// Nuova implementazione SVG Nativa di DayWheel (senza Recharts)
// ------------------------------------------------------------------
function DayWheel({ entries }) {
  const totals = useMemo(() => {
    const slices = groupEntries(entries);
    const tracked = slices.reduce((s, d) => s + d.value, 0);
    const rest = Math.max(MINUTES_PER_DAY - tracked, 0);
    if (rest > 0) slices.push({ id: "altro", name: BASE_MAP.altro.label, value: rest, color: BASE_MAP.altro.color });
    return slices;
  }, [entries]);

  const trackedTotal = totals.filter((d) => d.id !== "altro").reduce((s, d) => s + d.value, 0);

  const size = 220;
  const strokeWidth = 40;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const totalValue = totals.reduce((sum, d) => sum + d.value, 0);
  let cumulativePercent = 0;

  const getCoordinatesForPercent = (percent) => {
    const x = Math.cos(2 * Math.PI * (percent - 0.25));
    const y = Math.sin(2 * Math.PI * (percent - 0.25));
    return [center + x * radius, center + y * radius];
  };

  return (
    <div style={{ position: "relative", height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {totals.length <= 1 ? (
          <circle cx={center} cy={center} r={radius} fill="none" stroke={totals[0]?.color || BASE_MAP.altro.color} strokeWidth={strokeWidth} />
        ) : (
          totals.map((slice) => {
            if (slice.value === 0) return null;
            const startPercent = cumulativePercent;
            const slicePercent = slice.value / totalValue;
            cumulativePercent += slicePercent;
            const endPercent = cumulativePercent;

            if (slicePercent >= 1) {
              return <circle key={slice.id} cx={center} cy={center} r={radius} fill="none" stroke={slice.color} strokeWidth={strokeWidth} />;
            }

            const [startX, startY] = getCoordinatesForPercent(startPercent);
            // Crea un piccolissimo gap visivo
            const gap = 0.002;
            const [endX, endY] = getCoordinatesForPercent(Math.max(startPercent, endPercent - gap));
            const largeArcFlag = slicePercent > 0.5 ? 1 : 0;

            const pathData = [
              `M ${startX} ${startY}`,
              `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`
            ].join(" ");

            return <path key={slice.id} d={pathData} fill="none" stroke={slice.color} strokeWidth={strokeWidth} />;
          })
        )}
      </svg>
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
    if (rest > 0) list.push({ id: "altro", name: BASE_MAP.altro.label, color: BASE_MAP.altro.color, value: rest, pct: Math.round((rest / MINUTES_PER_DAY) * 100) });
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

function TasksSection({ data, setData, date }) {
  const completed = data.taskCompletions[date] || [];
  const toggleTask = (id) => {
    setData((d) => {
      const list = d.taskCompletions[date] || [];
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      return { ...d, taskCompletions: { ...d.taskCompletions, [date]: next } };
    });
  };

  if (data.tasks.length === 0) return <div style={{ color: MUTED, fontSize: 13 }}>Nessun task. Aggiungine uno da Personalizza → Attività.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.tasks.map((t) => {
        const done = completed.includes(t.id);
        return (
          <div key={t.id} className="dt-entry-row" style={{ opacity: done ? 0.6 : 1 }}>
            <button onClick={() => toggleTask(t.id)} className="dt-task-check" style={{ borderColor: t.color, background: done ? t.color : "transparent" }}>
              {done && <Check size={13} color="#fff" />}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}><div className="dt-entry-title" style={{ textDecoration: done ? "line-through" : "none" }}>{t.label}</div></div>
          </div>
        );
      })}
    </div>
  );
}

function TasksManageSection({ data, setData }) {
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(PURE_RED);
  const [error, setError] = useState("");

  const addTask = () => {
    setError("");
    if (!newLabel.trim()) { setError("Inserisci un nome per il task"); return; }
    const task = { id: crypto.randomUUID(), label: newLabel.trim(), color: newColor };
    setData((d) => ({ ...d, tasks: [...d.tasks, task] }));
    setNewLabel("");
    setNewColor(PURE_RED);
  };

  const removeTask = (id) => { setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) })); };
  const moveTask = (id, dir) => {
    setData((d) => {
      const arr = [...d.tasks];
      const idx = arr.findIndex((t) => t.id === id);
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= arr.length) return d;
      [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
      return { ...d, tasks: arr };
    });
  };

  return (
    <div>
      <SectionLabel>Task</SectionLabel>
      {data.tasks.length > 0 && (
        <div className="dt-card" style={{ marginBottom: 16 }}>
          {data.tasks.map((t, i) => (
            <div key={t.id} className="dt-order-row">
              <div className="dt-order-arrows">
                <button onClick={() => moveTask(t.id, -1)} disabled={i === 0}><ArrowUp size={13} /></button>
                <button onClick={() => moveTask(t.id, 1)} disabled={i === data.tasks.length - 1}><ArrowDown size={13} /></button>
              </div>
              <span className="dt-cat-dot" style={{ background: t.color }} />
              <span className="dt-cat-label">{t.label}</span>
              <button onClick={() => removeTask(t.id)} className="dt-icon-btn"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="dt-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="dt-field"><label>Nuovo task</label><input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="es. Meditazione, Leggere..." /></div>
        <SwatchPicker value={newColor} onChange={setNewColor} />
        {error && <p className="dt-error">{error}</p>}
        <button onClick={addTask} className="dt-btn-primary"><Plus size={16} /> Aggiungi task</button>
      </div>
    </div>
  );
}

function TaskGrid({ data, setData, date }) {
  const completed = data.taskCompletions[date] || [];
  const shown = data.tasks.slice(0, 12);
  const toggleTask = (id) => {
    setData((d) => {
      const list = d.taskCompletions[date] || [];
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      return { ...d, taskCompletions: { ...d.taskCompletions, [date]: next } };
    });
  };

  if (shown.length === 0) return null;

  return (
    <div className="dt-task-grid">
      {shown.map((t) => {
        const done = completed.includes(t.id);
        return (<button key={t.id} onClick={() => toggleTask(t.id)} className="dt-task-square" title={t.label}>{done && <Check size={16} color="#4FA37B" strokeWidth={3} />}</button>);
      })}
    </div>
  );
}

// L'Accordion State viene ora passato da genitore per non perdersi al cambio Tab
function TodayTab({ data, setData, uiState, setUiState }) {
  const [date, setDate] = useState(todayStr());
  useEffect(() => {
    const id = setInterval(() => {
      const now = todayStr();
      setDate((prev) => (prev !== now ? now : prev));
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const yesterdayStr = useMemo(() => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() - 1);
    return localDateStr(d);
  }, [date]);

  const entries = data.entries[date] || [];
  const waterEntries = data.water[date] || [];
  const waterMl = waterTotal(waterEntries);
  const activeCats = useMemo(() => getActiveCategories(data), [data.hiddenBase, data.customCategories]);

  const [waterInput, setWaterInput] = useState("");
  const addWater = () => {
    const raw = parseFloat(waterInput.replace(",", "."));
    if (!raw || raw <= 0) return;
    const ml = data.waterUnit === "L" ? Math.round(raw * 1000) : Math.round(raw);
    const entry = { id: crypto.randomUUID(), ml, time: new Date().toTimeString().slice(0, 5) };
    setData((d) => ({ ...d, water: { ...d.water, [date]: [...(d.water[date] || []), entry] } }));
    setWaterInput("");
  };
  const removeWater = (id) => { setData((d) => ({ ...d, water: { ...d.water, [date]: (d.water[date] || []).filter((w) => w.id !== id) } })); };

  const [form, setForm] = useState({ mode: "category", categoryId: activeCats[0]?.id || null, onetimeLabel: "", onetimeColor: PURE_RED, start: "", end: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!data.allowOnetime && form.mode === "onetime") setForm((f) => ({ ...f, mode: "category" }));
  }, [data.allowOnetime]);

  const addEntry = () => {
    setError("");
    if (!form.start || !form.end) { setError("Inserisci orario di inizio e fine"); return; }
    const startMins = timeToMins(form.start);
    const endMins = timeToMins(form.end);
    const cat = activeCats.find((c) => c.id === form.categoryId) || activeCats[0];
    const isOnetime = form.mode === "onetime";

    if (!isOnetime && !cat) { setError("Crea prima almeno una categoria"); return; }
    if (isOnetime && !form.onetimeLabel.trim()) { setError("Inserisci un nome per l'attività"); return; }

    const label = isOnetime ? form.onetimeLabel.trim() : cat.label;
    const color = isOnetime ? form.onetimeColor : cat.color;
    const categoryId = isOnetime ? null : cat.id;

    if (endMins < startMins) {
      // Split automatico della mezzanotte
      const durYesterday = MINUTES_PER_DAY - startMins;
      const durToday = endMins;
      const entryYesterday = { id: crypto.randomUUID(), category: categoryId, label, color, start: form.start, end: "24:00", duration: durYesterday };
      const entryToday = { id: crypto.randomUUID(), category: categoryId, label, color, start: "00:00", end: form.end, duration: durToday };

      setData((d) => {
        const prevEntries = d.entries || {};
        return {
          ...d,
          entries: {
            ...prevEntries,
            [yesterdayStr]: [...(prevEntries[yesterdayStr] || []), entryYesterday].sort((a, b) => a.start.localeCompare(b.start)),
            [date]: [...(prevEntries[date] || []), entryToday].sort((a, b) => a.start.localeCompare(b.start)),
          },
        };
      });
    } else {
      const dur = endMins - startMins;
      if (dur <= 0) { setError("L'orario di fine deve essere diverso dall'orario di inizio"); return; }
      const entry = { id: crypto.randomUUID(), category: categoryId, label, color, start: form.start, end: form.end, duration: dur };

      setData((d) => {
        const prevEntries = d.entries || {};
        return {
          ...d,
          entries: {
            ...prevEntries,
            [date]: [...(prevEntries[date] || []), entry].sort((a, b) => a.start.localeCompare(b.start)),
          },
        };
      });
    }
    setForm((f) => ({ ...f, start: "", end: "", onetimeLabel: "", onetimeColor: PURE_RED }));
  };

  const removeEntry = (id) => { setData((d) => ({ ...d, entries: { ...d.entries, [date]: (d.entries[date] || []).filter((e) => e.id !== id) } })); };

  return (
    <div>
      <div className="dt-today-row">
        <div className="dt-wheel-col"><DayWheel entries={entries} /></div>
        <div className="dt-side-col">
          <div className="dt-water-col"><WaterRing totalMl={waterMl} goalMl={data.waterGoal} size={88} /><span className="dt-water-label">Acqua</span></div>
          <TaskGrid data={data} setData={setData} date={date} />
        </div>
      </div>
      <Legend2 entries={entries} />
      <div style={{ marginTop: 32 }}>
        <AccordionRow title="Task" icon={ListChecks} open={uiState.tasksOpen} onToggle={() => setUiState((s) => ({ ...s, tasksOpen: !s.tasksOpen }))}>
          <TasksSection data={data} setData={setData} date={date} />
        </AccordionRow>
        
        <AccordionRow title="Attività" icon={Clock} open={uiState.activitiesOpen} onToggle={() => setUiState((s) => ({ ...s, activitiesOpen: !s.activitiesOpen }))}>
          <SectionLabel>Registra tempo</SectionLabel>
          <div className="dt-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="dt-pill-row">
              {activeCats.map((c) => (<Pill key={c.id} active={form.mode === "category" && form.categoryId === c.id} color={c.color} onClick={() => setForm((f) => ({ ...f, mode: "category", categoryId: c.id }))}><c.Icon size={13} /> {c.label}</Pill>))}
              {data.allowOnetime && (<Pill active={form.mode === "onetime"} color={INK} onClick={() => setForm((f) => ({ ...f, mode: "onetime" }))}><Plus size={13} /> Una tantum</Pill>)}
            </div>
            {form.mode === "onetime" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="dt-field"><label>Nome attività</label><input type="text" value={form.onetimeLabel} onChange={(e) => setForm((f) => ({ ...f, onetimeLabel: e.target.value }))} placeholder="es. Trasloco, dentista..." /></div>
                <SwatchPicker value={form.onetimeColor} onChange={(c) => setForm((f) => ({ ...f, onetimeColor: c }))} />
              </div>
            )}
            <div style={{ display: "flex", gap: 12 }}>
              <div className="dt-field"><label>Inizio</label><input type="time" value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))} /></div>
              <div className="dt-field"><label>Fine</label><input type="time" value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))} /></div>
            </div>
            <div style={{ color: MUTED, fontSize: 12, lineHeight: 1.4 }}>Se l'orario di fine supera la mezzanotte (es. 23:00 - 08:00), il tempo verrà diviso e assegnato automaticamente tra ieri e oggi.</div>
            {error && <p className="dt-error">{error}</p>}
            <button onClick={addEntry} className="dt-btn-primary"><Plus size={16} /> Aggiungi attività</button>
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
                      <div style={{ flex: 1, minWidth: 0 }}><div className="dt-entry-title">{disp.label}</div><div className="dt-entry-sub">{e.start} – {e.end} · {minsToHM(e.duration)}</div></div>
                      <button onClick={() => removeEntry(e.id)} className="dt-entry-delete"><Trash2 size={15} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </AccordionRow>
        
        <AccordionRow title="Acqua" icon={Droplet} open={uiState.waterOpen} onToggle={() => setUiState((s) => ({ ...s, waterOpen: !s.waterOpen }))}>
          <div className="dt-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="dt-field"><label>Aggiungi {data.waterUnit === "L" ? "Litri" : "ml"}</label><input type="number" step="0.1" value={waterInput} onChange={(e) => setWaterInput(e.target.value)} placeholder={`es. ${data.waterUnit === "L" ? "0.5" : "500"}`} /></div>
            <button onClick={addWater} className="dt-btn-primary"><Plus size={16} /> Aggiungi {data.waterUnit}</button>
          </div>
          {waterEntries.length > 0 && (
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
              {waterEntries.map((w) => (
                <div key={w.id} className="dt-entry-row" style={{ padding: "8px 12px" }}>
                  <Droplet size={16} color={WATER} />
                  <div style={{ flex: 1, color: INK, fontSize: 14 }}>{formatWater(w.ml)} <span style={{ color: MUTED, fontSize: 12, marginLeft: 6 }}>alle {w.time}</span></div>
                  <button onClick={() => removeWater(w.id)} className="dt-entry-delete" style={{ padding: 4 }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </AccordionRow>
      </div>
    </div>
  );
}

function HistoryTab({ data }) {
  const [date, setDate] = useState(todayStr());
  const entries = data.entries[date] || [];
  const waterEntries = data.water[date] || [];
  const waterMl = waterTotal(waterEntries);

  const prevDate = () => { const d = new Date(date + "T00:00:00"); d.setDate(d.getDate() - 1); setDate(localDateStr(d)); };
  const nextDate = () => { const d = new Date(date + "T00:00:00"); d.setDate(d.getDate() + 1); setDate(localDateStr(d)); };
  const isToday = date === todayStr();

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDay = (y, m) => new Date(y, m, 1).getDay();

  const [calDate, setCalDate] = useState(new Date(date + "T00:00:00"));
  const calY = calDate.getFullYear(), calM = calDate.getMonth();
  const prevMonth = () => setCalDate(new Date(calY, calM - 1, 1));
  const nextMonth = () => setCalDate(new Date(calY, calM + 1, 1));

  const daysInMonth = getDaysInMonth(calY, calM);
  let firstDay = getFirstDay(calY, calM) - 1;
  if (firstDay < 0) firstDay = 6;
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const selectDay = (day) => {
    if (!day) return;
    setDate(localDateStr(new Date(calY, calM, day)));
  };

  const completedTasks = data.taskCompletions[date] || [];

  return (
    <div>
      <div className="dt-calendar">
        <div className="dt-calendar-header">
          <button onClick={prevMonth}><ChevronLeft size={20} /></button>
          <span>{calDate.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}</span>
          <button onClick={nextMonth}><ChevronRight size={20} /></button>
        </div>
        <div className="dt-calendar-weekdays"><span>Lu</span><span>Ma</span><span>Me</span><span>Gi</span><span>Ve</span><span>Sa</span><span>Do</span></div>
        <div className="dt-calendar-grid">
          {days.map((d, i) => {
            if (!d) return <div key={i} />;
            const cellDate = localDateStr(new Date(calY, calM, d));
            const isSel = cellDate === date;
            const hasData = !!data.entries[cellDate] || !!data.water[cellDate] || !!data.taskCompletions[cellDate];
            const isFuture = cellDate > todayStr();
            return (<button key={i} disabled={isFuture} onClick={() => selectDay(d)} className={`dt-cal-day ${isSel ? "selected" : ""} ${hasData ? "has-data" : ""}`}>{d}</button>);
          })}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "32px 0 24px 0" }}>
        <button onClick={prevDate} className="dt-nav-btn"><ChevronLeft size={20} /></button>
        <span className="dt-history-date">{fmtDateLabel(date)}</span>
        <button onClick={nextDate} disabled={isToday} className="dt-nav-btn" style={{ opacity: isToday ? 0.3 : 1 }}><ChevronRight size={20} /></button>
      </div>
      {(entries.length === 0 && waterEntries.length === 0 && completedTasks.length === 0) ? (
        <div className="dt-empty"><Calendar size={48} opacity={0.2} /><p>Nessun dato registrato</p></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div className="dt-today-row">
            <div className="dt-wheel-col"><DayWheel entries={entries} /></div>
            <div className="dt-side-col">
              <div className="dt-water-col"><WaterRing totalMl={waterMl} goalMl={data.waterGoal} size={88} /><span className="dt-water-label">Acqua</span></div>
            </div>
          </div>
          <Legend2 entries={entries} />
          {completedTasks.length > 0 && (
            <div>
              <SectionLabel>Task completati</SectionLabel>
              <div className="dt-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {completedTasks.map((id) => {
                  const t = data.tasks.find((x) => x.id === id);
                  if (!t) return null;
                  return (
                    <div key={id} style={{ display: "flex", alignItems: "center", gap: 8, color: INK, fontSize: 14 }}>
                      <Check size={16} color={t.color} /> {t.label}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {entries.length > 0 && (
            <div>
              <SectionLabel>Timeline attività</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {entries.map((e) => {
                  const disp = resolveEntry(e);
                  return (
                    <div key={e.id} className="dt-entry-row">
                      <span className="dt-entry-bar" style={{ background: disp.color }} />
                      <div style={{ flex: 1, minWidth: 0 }}><div className="dt-entry-title">{disp.label}</div><div className="dt-entry-sub">{e.start} – {e.end} · {minsToHM(e.duration)}</div></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TrendsTab({ data }) {
  const allDates = Object.keys(data.entries).sort();
  const [chartType, setChartType] = useState("bar");
  const [metric, setMetric] = useState("duration");

  const trendData = useMemo(() => {
    if (allDates.length === 0) return [];
    return allDates.map((d) => {
      const g = groupEntries(data.entries[d]);
      const obj = { date: fmtDateLabel(d).replace(/ /g, "\n") };
      g.forEach((cat) => { obj[cat.name] = metric === "hours" ? Number((cat.value / 60).toFixed(1)) : cat.value; });
      return obj;
    });
  }, [allDates, data.entries, metric]);

  const activeNames = useMemo(() => {
    const s = new Set();
    allDates.forEach((d) => groupEntries(data.entries[d]).forEach((c) => s.add(c.name)));
    return Array.from(s);
  }, [allDates, data.entries]);

  const catColor = (name) => {
    const fromBase = BASE_CATEGORIES.find((c) => c.label === name);
    if (fromBase) return fromBase.color;
    const fromCust = data.customCategories.find((c) => c.label === name);
    if (fromCust) return fromCust.color;
    const ot = allDates.flatMap((d) => data.entries[d] || []).find((e) => !e.category && e.label === name);
    if (ot) return ot.color;
    return MUTED;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: PAPER, border: `1px solid ${PAPER_LINE}`, padding: 12, borderRadius: 12, fontSize: 13, color: INK }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: MUTED }}>{label.replace(/\n/g, " ")}</div>
          {payload.slice().sort((a, b) => b.value - a.value).map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
              <span style={{ flex: 1 }}>{p.name}</span>
              <span style={{ fontWeight: 500 }}>{metric === "hours" ? `${p.value}h` : minsToHM(p.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (allDates.length === 0) return <div className="dt-empty"><TrendingUp size={48} opacity={0.2} /><p>Nessun dato per i trend</p></div>;

  return (
    <div>
      <div className="dt-pill-row" style={{ marginBottom: 24 }}>
        <Pill active={chartType === "bar"} color={INK} onClick={() => setChartType("bar")}>A Barre</Pill>
        <Pill active={chartType === "line"} color={INK} onClick={() => setChartType("line")}>A Linee</Pill>
        <Pill active={metric === "duration"} color={INK} onClick={() => setMetric("duration")}>Minuti</Pill>
        <Pill active={metric === "hours"} color={INK} onClick={() => setMetric("hours")}>Ore</Pill>
      </div>
      <div style={{ width: "100%", height: 400 }}>
        <ResponsiveContainer>
          {chartType === "bar" ? (
            <BarChart data={trendData} margin={{ top: 10, right: 0, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={PAPER_LINE} vertical={false} />
              <XAxis dataKey="date" stroke={MUTED} fontSize={10} tickLine={false} axisLine={false} tickMargin={12} />
              <YAxis stroke={MUTED} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => (metric === "hours" ? `${v}h` : v)} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: PAPER_RAISED }} />
              {metric === "hours" && <ReferenceLine y={24} stroke={PAPER_LINE} strokeDasharray="3 3" />}
              {activeNames.map((name) => (<Bar key={name} dataKey={name} stackId="a" fill={catColor(name)} radius={[4, 4, 0, 0]} />))}
            </BarChart>
          ) : (
            <LineChart data={trendData} margin={{ top: 10, right: 0, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={PAPER_LINE} vertical={false} />
              <XAxis dataKey="date" stroke={MUTED} fontSize={10} tickLine={false} axisLine={false} tickMargin={12} />
              <YAxis stroke={MUTED} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => (metric === "hours" ? `${v}h` : v)} />
              <Tooltip content={<CustomTooltip />} />
              {activeNames.map((name) => (<Line key={name} type="monotone" dataKey={name} stroke={catColor(name)} strokeWidth={3} dot={{ r: 4, fill: PAPER, strokeWidth: 2 }} activeDot={{ r: 6 }} />))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CustomCatsSection({ data, setData }) {
  const [showModal, setShowModal] = useState(false);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(PURE_RED);

  const activeIds = new Set([
    ...BASE_CATEGORIES.filter((c) => c.id !== "altro" && !data.hiddenBase.includes(c.id)).map((c) => c.id),
    ...data.customCategories.map((c) => c.id),
  ]);
  const activeList = getActiveCategories(data);

  const toggleBase = (id) => {
    setData((d) => {
      const hidden = d.hiddenBase.includes(id) ? d.hiddenBase.filter((x) => x !== id) : [...d.hiddenBase, id];
      let order = d.categoryOrder;
      if (!d.hiddenBase.includes(id)) { order = order.filter((x) => x !== id); }
      else if (!order.includes(id)) { order = [...order, id]; }
      return { ...d, hiddenBase: hidden, categoryOrder: order };
    });
  };

  const removeCustom = (id) => {
    setData((d) => ({ ...d, customCategories: d.customCategories.filter((c) => c.id !== id), categoryOrder: d.categoryOrder.filter((x) => x !== id) }));
  };

  const addCustom = () => {
    if (!label.trim()) return;
    const newId = crypto.randomUUID();
    const cat = { id: newId, label: label.trim(), color };
    setData((d) => ({ ...d, customCategories: [...d.customCategories, cat], categoryOrder: [...d.categoryOrder, newId] }));
    setLabel("");
    setColor(PURE_RED);
    setShowModal(false);
  };

  const move = (id, dir) => { setData((d) => ({ ...d, categoryOrder: moveInOrder(d.categoryOrder, activeIds, id, dir) })); };

  return (
    <div>
      <SectionLabel>Ordine e Visibilità Attività</SectionLabel>
      <div className="dt-card" style={{ marginBottom: 16 }}>
        {activeList.map((c, i) => (
          <div key={c.id} className="dt-order-row">
            <div className="dt-order-arrows">
              <button onClick={() => move(c.id, -1)} disabled={i === 0}><ArrowUp size={13} /></button>
              <button onClick={() => move(c.id, 1)} disabled={i === activeList.length - 1}><ArrowDown size={13} /></button>
            </div>
            <span className="dt-cat-dot" style={{ background: c.color }} />
            <span className="dt-cat-label">{c.label}</span>
            {c.custom ? (<button onClick={() => removeCustom(c.id)} className="dt-icon-btn"><Trash2 size={16} /></button>) : (<button onClick={() => toggleBase(c.id)} className="dt-icon-btn" style={{ color: INK }}><Eye size={16} /></button>)}
          </div>
        ))}
      </div>
      <SectionLabel>Categorie Base Nascoste</SectionLabel>
      {data.hiddenBase.length === 0 ? (<div style={{ color: MUTED, fontSize: 13, marginBottom: 16 }}>Nessuna</div>) : (
        <div className="dt-card" style={{ marginBottom: 16 }}>
          {BASE_CATEGORIES.filter((c) => c.id !== "altro" && data.hiddenBase.includes(c.id)).map((c) => (
            <div key={c.id} className="dt-cat-row">
              <span className="dt-cat-dot" style={{ background: c.color, opacity: 0.3 }} />
              <span className="dt-cat-label hidden-cat">{c.label}</span>
              <button onClick={() => toggleBase(c.id)} className="dt-icon-btn"><EyeOff size={16} /></button>
            </div>
          ))}
        </div>
      )}
      <button onClick={() => setShowModal(true)} className="dt-btn-outline"><Plus size={16} /> Nuova Categoria Custom</button>
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(21, 22, 27, 0.9)", display: "flex", alignItems: "center", justify-content: "center", zIndex: 100, padding: 20 }}>
          <div className="dt-card" style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ margin: 0, color: INK, fontSize: 18, fontFamily: "'Fraunces', serif" }}>Nuova Categoria</h3>
            <div className="dt-field"><label>Nome categoria</label><input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="es. Studio, Lavoro..." /></div>
            <SwatchPicker value={color} onChange={setColor} />
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button onClick={() => setShowModal(false)} className="dt-btn-outline">Annulla</button>
              <button onClick={addCustom} className="dt-btn-primary">Salva</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RemindersSection({ data, setData }) {
  const [time, setTime] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const isWeb = Capacitor.getPlatform() === "web";

  useEffect(() => {
    if (!isWeb) {
      LocalNotifications.requestPermissions().then((res) => { if (res.display !== "granted") setError("Permessi notifiche negati"); });
    }
  }, [isWeb]);

  const addReminder = async () => {
    setError("");
    if (!time || !label.trim()) { setError("Inserisci orario e testo"); return; }
    const id = Math.floor(Math.random() * 1000000);
    const rem = { id, time, label: label.trim() };
    const [h, m] = time.split(":").map(Number);
    if (!isWeb) {
      try {
        await LocalNotifications.schedule({ notifications: [{ id, title: "Promemoria DayTracker", body: rem.label, schedule: { on: { hour: h, minute: m }, allowWhileIdle: true } }] });
      } catch { setError("Errore di scheduling (dispositivo non supportato?)"); return; }
    }
    setData((d) => ({ ...d, reminders: [...d.reminders, rem].sort((a, b) => a.time.localeCompare(b.time)) }));
    setTime("");
    setLabel("");
  };

  const removeReminder = async (id) => {
    if (!isWeb) { try { await LocalNotifications.cancel({ notifications: [{ id }] }); } catch (e) {} }
    setData((d) => ({ ...d, reminders: d.reminders.filter((r) => r.id !== id) }));
  };

  return (
    <div>
      <SectionLabel>Promemoria</SectionLabel>
      {isWeb && <p className="dt-reminder-note">Sul web i promemoria sono solo visivi (non riceverai notifiche push). Usa l'app nativa per le notifiche.</p>}
      <div className="dt-card" style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div className="dt-field" style={{ flex: "0 0 100px" }}><label>Orario</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          <div className="dt-field"><label>Messaggio</label><input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="es. Bevi acqua!" /></div>
        </div>
        {error && <p className="dt-error">{error}</p>}
        <button onClick={addReminder} className="dt-btn-primary"><Bell size={16} /> Aggiungi promemoria</button>
      </div>
      {data.reminders.length > 0 && (
        <div className="dt-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.reminders.map((r) => (
            <div key={r.id} className="dt-entry-row">
              <Bell size={16} color={MUTED} />
              <div style={{ flex: 1, color: INK, fontSize: 14 }}>{r.time} <span style={{ color: MUTED, fontSize: 13, marginLeft: 8 }}>{r.label}</span></div>
              <button onClick={() => removeReminder(r.id)} className="dt-entry-delete"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsTab({ data, setData, exportData, importData }) {
  const fileInputRef = useRef(null);

  const updateProfile = (k, v) => setData((d) => ({ ...d, profile: { ...d.profile, [k]: v } }));
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => { if (importData(evt.target.result)) alert("Dati importati con successo!"); else alert("Errore file non valido"); };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <div>
        <SectionLabel>Profilo Fisiologico</SectionLabel>
        <div className="dt-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="dt-field"><label>Nome o Nickname</label><input type="text" value={data.profile.name || ""} onChange={(e) => updateProfile("name", e.target.value)} placeholder="es. Mario" /></div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="dt-field"><label>Anno di nascita</label><input type="number" value={data.profile.birthYear || ""} onChange={(e) => updateProfile("birthYear", e.target.value)} placeholder="es. 1990" /></div>
            <div className="dt-field"><label>Altezza (cm)</label><input type="number" value={data.profile.heightCm || ""} onChange={(e) => updateProfile("heightCm", e.target.value)} placeholder="es. 175" /></div>
            <div className="dt-field"><label>Peso (kg)</label><input type="number" value={data.profile.weightKg || ""} onChange={(e) => updateProfile("weightKg", e.target.value)} placeholder="es. 70" /></div>
          </div>
        </div>
      </div>
      <div>
        <SectionLabel>Impostazioni Tracciamento</SectionLabel>
        <div className="dt-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="dt-toggle-row"><div><div style={{ color: INK, fontSize: 15, fontWeight: 500 }}>Attività Una Tantum</div><div className="desc">Permetti inserimento rapido senza categoria</div></div><Switch on={data.allowOnetime} onClick={() => setData((d) => ({ ...d, allowOnetime: !d.allowOnetime }))} /></div>
          <div style={{ height: 1, background: PAPER_LINE }} />
          <div style={{ display: "flex", gap: 12 }}>
            <div className="dt-field"><label>Obiettivo Acqua Giornaliero</label><input type="number" value={data.waterGoal} onChange={(e) => setData((d) => ({ ...d, waterGoal: Number(e.target.value) }))} /></div>
            <div className="dt-field" style={{ flex: "0 0 100px" }}><label>Unità</label>
              <select value={data.waterUnit} onChange={(e) => setData((d) => ({ ...d, waterUnit: e.target.value }))} style={{ background: PAPER, border: `1px solid ${PAPER_LINE}`, color: INK, borderRadius: 10, padding: "10px 12px", fontSize: 15, width: "100%", height: 42 }}>
                <option value="ml">ml</option>
                <option value="L">L</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      <TasksManageSection data={data} setData={setData} />
      <CustomCatsSection data={data} setData={setData} />
      <RemindersSection data={data} setData={setData} />
      <div>
        <SectionLabel>Dati e Privacy</SectionLabel>
        <div className="dt-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button onClick={exportData} className="dt-btn-outline">Esporta Backup (JSON)</button>
          <button onClick={() => fileInputRef.current?.click()} className="dt-btn-outline">Importa Backup</button>
          <input type="file" accept=".json" ref={fileInputRef} onChange={handleImport} style={{ display: "none" }} />
          <button onClick={() => { if (confirm("Sei sicuro? Tutti i dati verranno eliminati.")) setData({ ...data, entries: {}, reminders: [], taskCompletions: {}, water: {} }); }} className="dt-btn-outline" style={{ color: "#D46A5C", borderColor: "#D46A5C26" }}><RotateCcw size={16} /> Resetta Dati</button>
        </div>
      </div>
      <div style={{ textAlign: "center", color: MUTED, fontSize: 11, letterSpacing: 0.5 }}>DAYTRACKER V1.0 · TUTTI I DATI RESTANO SUL DISPOSITIVO</div>
    </div>
  );
}

function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const finish = () => {
    if (!agreed) return;
    onComplete();
  };

  if (step === 1) {
    return (
      <div className="dt-shell" style={{ padding: 24, justifyContent: "center", alignItems: "center", textAlign: "center" }}>
        <Clock size={64} color={INK} style={{ marginBottom: 24 }} />
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 32, margin: "0 0 16px 0" }}>Benvenuto in DayTracker</h1>
        <p style={{ color: MUTED, fontSize: 16, lineHeight: 1.5, marginBottom: 32 }}>Prendi il controllo del tuo tempo. Monitora le tue attività, tieni traccia dei tuoi obiettivi quotidiani (task, acqua) e scopri come investi la tua giornata.</p>
        <button onClick={() => setStep(2)} className="dt-btn-primary">Inizia</button>
      </div>
    );
  }

  return (
    <div className="dt-shell" style={{ padding: 24, justifyContent: "center" }}>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, margin: "0 0 16px 0" }}>Privacy & Dati</h2>
      <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>DayTracker è progettato per la tua privacy totale. <strong>Tutti i tuoi dati rimangono esclusivamente sul tuo dispositivo.</strong> Non ci sono server esterni, nessun account richiesto e nessun dato viene inviato a terzi. Puoi esportare o eliminare i tuoi dati in qualsiasi momento dalle impostazioni.</p>
      <label style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 32, cursor: "pointer" }}>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2, accentColor: INK }} />
        <span style={{ fontSize: 14, color: INK, lineHeight: 1.5 }}>Ho letto e accetto l'Informativa sulla Privacy. Comprendo che i dati sono salvati localmente.</span>
      </label>
      <button onClick={finish} disabled={!agreed} className="dt-btn-primary" style={{ opacity: agreed ? 1 : 0.5 }}>{agreed ? "Inizia a tracciare" : "Accetta per continuare"}</button>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("today");
  
  // Solleviamo lo stato degli Accordion a livello di App, così persistono tra un tab e l'altro
  const [uiState, setUiState] = useState({ tasksOpen: true, activitiesOpen: true, waterOpen: true });

  useEffect(() => {
    if (!document.getElementById("dt-styles")) {
      const style = document.createElement("style");
      style.id = "dt-styles";
      style.innerHTML = GLOBAL_CSS;
      document.head.appendChild(style);
    }
    const loaded = loadData();
    if (!loaded.taskCompletions) loaded.taskCompletions = {};
    setData(loaded);
  }, []);

  useEffect(() => { if (data) saveData(data); }, [data]);

  const exportData = () => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daytracker-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === "object" && parsed.entries) {
        if (!parsed.taskCompletions) parsed.taskCompletions = {};
        setData((d) => ({ ...d, ...parsed }));
        return true;
      }
      return false;
    } catch { return false; }
  };

  if (!data) return null;
  if (!data.onboarded) return <div className="dt-app"><Onboarding onComplete={() => setData((d) => ({ ...d, onboarded: true, policyAccepted: true }))} /></div>;

  return (
    <div className="dt-app">
      <div className="dt-shell">
        <div className="dt-header">
          <div className="dt-header-date">{fmtDateLabel(todayStr())}</div>
          <h1 className="dt-header-title">{tab === "today" ? "Oggi" : tab === "history" ? "Storico" : tab === "trends" ? "Trend" : "Personalizza"}</h1>
        </div>
        <div className="dt-main">
          {tab === "today" && <TodayTab data={data} setData={setData} uiState={uiState} setUiState={setUiState} />}
          {tab === "history" && <HistoryTab data={data} />}
          {tab === "trends" && <TrendsTab data={data} />}
          {tab === "settings" && <SettingsTab data={data} setData={setData} exportData={exportData} importData={importData} />}
        </div>
        <div className="dt-nav">
          <button onClick={() => setTab("today")} className={`dt-nav-btn ${tab === "today" ? "active" : ""}`}><Clock size={22} /><span>Oggi</span></button>
          <button onClick={() => setTab("history")} className={`dt-nav-btn ${tab === "history" ? "active" : ""}`}><Calendar size={22} /><span>Storico</span></button>
          <button onClick={() => setTab("trends")} className={`dt-nav-btn ${tab === "trends" ? "active" : ""}`}><TrendingUp size={22} /><span>Trend</span></button>
          <button onClick={() => setTab("settings")} className={`dt-nav-btn ${tab === "settings" ? "active" : ""}`}><SlidersHorizontal size={22} /><span>App</span></button>
        </div>
      </div>
    </div>
  );
}