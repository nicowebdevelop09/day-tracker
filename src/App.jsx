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
    // eventuali categorie personalizzate salvate prima dell'introduzione di categoryOrder: le aggiungo in coda
    merged.customCategories.forEach((c) => { if (!merged.categoryOrder.includes(c.id)) merged.categoryOrder.push(c.id); });
    return merged;
  } catch {
    return { entries: {}, reminders: [], hiddenBase: [], customCategories: [], water: {}, waterGoal: 2000, allowOnetime: true, waterUnit: "ml", profile: DEFAULT_PROFILE, onboarded: false, tasks: DEFAULT_TASKS, taskCompletions: {}, categoryOrder: DEFAULT_CATEGORY_ORDER, policyAccepted: false };
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
  const all = [...base, ...custom];
  const order = data.categoryOrder || [];
  return all.sort((a, b) => {
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}

// Sposta un elemento su/giù all'interno del sottoinsieme "attivo" di un
// array di id, mantenendo la posizione relativa di quelli non attivi.
function moveInOrder(orderArr, activeIds, id, direction) {
  const activeOrder = orderArr.filter((i) => activeIds.has(i));
  const idx = activeOrder.indexOf(id);
  const swapIdx = idx + direction;
  if (idx === -1 || swapIdx < 0 || swapIdx >= activeOrder.length) return orderArr;
  [activeOrder[idx], activeOrder[swapIdx]] = [activeOrder[swapIdx], activeOrder[idx]];
  let ai = 0;
  return orderArr.map((i) => (activeIds.has(i) ? activeOrder[ai++] : i));
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
    position: relative;
  }
  .dt-swatch.active { border-color: ${INK}; }
  .dt-swatch-custom { border: 2px dashed ${PAPER_LINE}; background: ${PAPER}; cursor: pointer; }
  .dt-swatch-custom.active { border-style: solid; border-color: ${INK}; }

  .dt-hs-slider {
    -webkit-appearance: none; appearance: none;
    width: 100%; height: 14px; border-radius: 999px; outline: none; cursor: pointer;
    border: 1px solid ${PAPER_LINE};
  }
  .dt-hs-slider::-webkit-slider-thumb {
    -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%;
    background: #fff; border: 3px solid ${PAPER}; box-shadow: 0 0 0 1px ${PAPER_LINE}, 0 2px 4px rgba(0,0,0,0.4);
  }
  .dt-hs-slider::-moz-range-thumb {
    width: 24px; height: 24px; border-radius: 50%;
    background: #fff; border: 3px solid ${PAPER}; box-shadow: 0 0 0 1px ${PAPER_LINE}, 0 2px 4px rgba(0,0,0,0.4);
  }

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

  .dt-task-check {
    width: 24px; height: 24px; border-radius: 50%; border: 2px solid ${PAPER_LINE};
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: transparent;
  }

  .dt-calendar { margin-bottom: 20px; }
  .dt-calendar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .dt-calendar-header button { background: transparent; border: none; color: ${INK}; padding: 6px; }
  .dt-calendar-header span { color: ${INK}; font-size: 14px; text-transform: capitalize; font-weight: 500; }
  .dt-calendar-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; margin-bottom: 4px; }
  .dt-calendar-weekdays span { color: ${MUTED}; font-size: 10px; text-transform: uppercase; }
  .dt-calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); row-gap: 4px; }
  .dt-cal-day {
    aspect-ratio: 1; border-radius: 50%; border: none; background: transparent; color: ${INK};
    font-size: 13px; display: flex; align-items: center; justify-content: center; position: relative;
  }
  .dt-cal-day:disabled { color: ${PAPER_LINE}; }
  .dt-cal-day.has-data::after {
    content: ""; position: absolute; bottom: 3px; width: 4px; height: 4px; border-radius: 50%; background: ${WATER};
  }
  .dt-cal-day.selected { background: ${INK}; color: ${PAPER}; font-weight: 600; }
  .dt-cal-day.selected::after { background: ${PAPER}; }

  .dt-accordion { margin-bottom: 16px; }
  .dt-accordion-header {
    width: 100%; display: flex; align-items: center; justify-content: space-between;
    background: ${PAPER_RAISED}; border: 1px solid ${PAPER_LINE}; border-radius: 14px; padding: 12px 16px;
  }
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

// Conversione Tonalità/Saturazione -> hex, con Valore sempre fisso al 100%
// (altrimenti i colori scuri diventerebbero illeggibili nell'app).
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
        <button
          type="button" onClick={openPicker}
          style={{ width: 44, height: 44, borderRadius: "50%", background: value, border: `2px solid ${PAPER_LINE}`, flexShrink: 0, padding: 0 }}
        />
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
            <button
              type="button"
              onClick={() => { onChange(previewHex); setOpen(false); }}
              className="dt-btn-primary" style={{ width: "auto", padding: "10px 18px" }}
            >
              Conferma
            </button>
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

function TasksSection({ data, setData, date }) {
  const completed = data.taskCompletions[date] || [];

  const toggleTask = (id) => {
    setData((d) => {
      const list = d.taskCompletions[date] || [];
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      return { ...d, taskCompletions: { ...d.taskCompletions, [date]: next } };
    });
  };

  if (data.tasks.length === 0) {
    return <div style={{ color: MUTED, fontSize: 13 }}>Nessun task. Aggiungine uno da Personalizza → Attività.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.tasks.map((t) => {
        const done = completed.includes(t.id);
        return (
          <div key={t.id} className="dt-entry-row" style={{ opacity: done ? 0.6 : 1 }}>
            <button onClick={() => toggleTask(t.id)} className="dt-task-check" style={{ borderColor: t.color, background: done ? t.color : "transparent" }}>
              {done && <Check size={13} color="#fff" />}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="dt-entry-title" style={{ textDecoration: done ? "line-through" : "none" }}>{t.label}</div>
            </div>
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
    if (!newLabel.trim()) {
      setError("Inserisci un nome per il task");
      return;
    }
    const task = { id: crypto.randomUUID(), label: newLabel.trim(), color: newColor };
    setData((d) => ({ ...d, tasks: [...d.tasks, task] }));
    setNewLabel("");
    setNewColor(PURE_RED);
  };

  const removeTask = (id) => {
    setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
  };

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
              <button onClick={() => removeTask(t.id)} className="dt-icon-btn">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="dt-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="dt-field">
          <label>Nuovo task</label>
          <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="es. Meditazione, Leggere..." />
        </div>
        <SwatchPicker value={newColor} onChange={setNewColor} />
        {error && <p className="dt-error">{error}</p>}
        <button onClick={addTask} className="dt-btn-primary">
          <Plus size={16} /> Aggiungi task
        </button>
      </div>
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
    onetimeColor: PURE_RED,
    start: "",
    end: "",
  });
  const [error, setError] = useState("");
  const [tasksOpen, setTasksOpen] = useState(true);
  const [activitiesOpen, setActivitiesOpen] = useState(true);

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
    setForm((f) => ({ ...f, start: "", end: "", onetimeLabel: "", onetimeColor: PURE_RED }));
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
        <AccordionRow title="Task" icon={ListChecks} open={tasksOpen} onToggle={() => setTasksOpen((o) => !o)}>
          <TasksSection data={data} setData={setData} date={date} />
        </AccordionRow>

        <AccordionRow title="Attività" icon={Clock} open={activitiesOpen} onToggle={() => setActivitiesOpen((o) => !o)}>
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
        </AccordionRow>
      </div>
    </div>
  );
}

/* --------------------------- Categories Tab --------------------------- */

function ActivitiesSection({ data, setData }) {
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(PURE_RED);
  const [error, setError] = useState("");

  const activeCats = useMemo(() => getActiveCategories(data), [data.hiddenBase, data.customCategories, data.categoryOrder]);
  const activeIds = useMemo(() => new Set(activeCats.map((c) => c.id)), [activeCats]);

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
    setData((d) => ({ ...d, customCategories: [...d.customCategories, cat], categoryOrder: [...d.categoryOrder, cat.id] }));
    setNewLabel("");
    setNewColor(PURE_RED);
  };

  const removeCustom = (id) => {
    setData((d) => ({
      ...d,
      customCategories: d.customCategories.filter((c) => c.id !== id),
      categoryOrder: d.categoryOrder.filter((x) => x !== id),
    }));
  };

  const moveCategory = (id, dir) => {
    setData((d) => ({ ...d, categoryOrder: moveInOrder(d.categoryOrder, activeIds, id, dir) }));
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

      <SectionLabel>Ordine attività</SectionLabel>
      <div className="dt-card" style={{ marginBottom: 24 }}>
        {activeCats.map((c, i) => (
          <div key={c.id} className="dt-order-row">
            <div className="dt-order-arrows">
              <button onClick={() => moveCategory(c.id, -1)} disabled={i === 0}><ArrowUp size={13} /></button>
              <button onClick={() => moveCategory(c.id, 1)} disabled={i === activeCats.length - 1}><ArrowDown size={13} /></button>
            </div>
            <span className="dt-cat-dot" style={{ background: c.color }} />
            <span className="dt-cat-label">{c.label}</span>
            <button onClick={() => (c.custom ? removeCustom(c.id) : toggleHidden(c.id))} className="dt-icon-btn">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {activeCats.length === 0 && (
          <div style={{ color: MUTED, fontSize: 13, padding: "8px 4px" }}>Nessuna attività attiva.</div>
        )}
      </div>

      {data.hiddenBase.length > 0 && (
        <>
          <SectionLabel>Categorie base eliminate</SectionLabel>
          <div className="dt-card" style={{ marginBottom: 24 }}>
            {BASE_CATEGORIES.filter((c) => data.hiddenBase.includes(c.id)).map((c) => (
              <div key={c.id} className="dt-cat-row">
                <span className="dt-cat-dot" style={{ background: c.color, opacity: 0.4 }} />
                <span className="dt-cat-label hidden-cat">{c.label}</span>
                <button onClick={() => toggleHidden(c.id)} className="dt-icon-btn">
                  <RotateCcw size={16} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionLabel>Nuova categoria</SectionLabel>
      <div className="dt-card" style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
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

function ProfileSection({ data, setData }) {
  const [name, setName] = useState(data.profile.name || "");
  const [birthYear, setBirthYear] = useState(data.profile.birthYear ? String(data.profile.birthYear) : "");
  const [heightCm, setHeightCm] = useState(data.profile.heightCm ? String(data.profile.heightCm) : "");
  const [weightKg, setWeightKg] = useState(data.profile.weightKg ? String(data.profile.weightKg) : "");
  const [saved, setSaved] = useState(false);

  const save = () => {
    setData((d) => ({
      ...d,
      profile: {
        name: name.trim(),
        birthYear: birthYear ? parseInt(birthYear, 10) : null,
        heightCm: heightCm ? parseInt(heightCm, 10) : null,
        weightKg: weightKg ? parseInt(weightKg, 10) : null,
      },
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div>
      <SectionLabel>Profilo</SectionLabel>
      <div className="dt-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="dt-field">
          <label>Nome</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Il tuo nome" />
        </div>
        <div className="dt-field">
          <label>Anno di nascita</label>
          <input type="number" inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="es. 1994" />
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div className="dt-field">
            <label>Altezza (cm)</label>
            <input type="number" inputMode="numeric" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="es. 175" />
          </div>
          <div className="dt-field">
            <label>Peso (kg)</label>
            <input type="number" inputMode="numeric" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="es. 70" />
          </div>
        </div>
        <button onClick={save} className="dt-btn-primary">
          <Check size={16} /> Salva profilo
        </button>
        {saved && <div style={{ color: MUTED, fontSize: 12, textAlign: "center" }}>Salvato.</div>}
      </div>
    </div>
  );
}

/* --------------------------- Onboarding --------------------------- */

function ProgressDots({ step, total }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      {Array.from({ length: total }, (_, i) => i + 1).map((i) => (
        <span
          key={i}
          style={{
            width: i === step ? 18 : 6, height: 6, borderRadius: 999,
            background: i === step ? INK : PAPER_LINE, transition: "all .2s",
          }}
        />
      ))}
    </div>
  );
}

function Onboarding({ data, setData }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  const goStep2 = () => {
    if (!name.trim()) {
      setError("Inserisci il tuo nome");
      return;
    }
    if (!accepted) {
      setError("Devi accettare l'informativa per continuare");
      return;
    }
    setData((d) => ({
      ...d,
      profile: {
        name: name.trim(),
        birthYear: birthYear ? parseInt(birthYear, 10) : null,
        heightCm: heightCm ? parseInt(heightCm, 10) : null,
        weightKg: weightKg ? parseInt(weightKg, 10) : null,
      },
      policyAccepted: true,
    }));
    setStep(2);
  };

  const finish = () => setData((d) => ({ ...d, onboarded: true }));

  return (
    <div className="dt-app">
      <style>{GLOBAL_CSS}</style>
      <div className="dt-shell" style={{ padding: "40px 20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ width: 46 }} />
          <ProgressDots step={step} total={3} />
          {step > 1 ? (
            <button
              onClick={() => (step < 3 ? setStep(step + 1) : finish())}
              className="dt-link-btn" style={{ color: MUTED, fontSize: 14 }}
            >
              Salta
            </button>
          ) : (
            <div style={{ width: 46 }} />
          )}
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {step === 1 && (
            <>
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <h1 className="dt-header-title" style={{ fontSize: 26 }}>Benvenuto</h1>
                <p style={{ color: MUTED, fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>
                  Qualche informazione per iniziare — puoi modificarle in ogni momento da Personalizza.
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="dt-field">
                  <label>Nome</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Il tuo nome" />
                </div>
                <div className="dt-field">
                  <label>Anno di nascita (opzionale)</label>
                  <input type="number" inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="es. 1994" />
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <div className="dt-field">
                    <label>Altezza cm (opz.)</label>
                    <input type="number" inputMode="numeric" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="175" />
                  </div>
                  <div className="dt-field">
                    <label>Peso kg (opz.)</label>
                    <input type="number" inputMode="numeric" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="70" />
                  </div>
                </div>

                <div className="dt-card" style={{ marginTop: 6 }}>
                  <div style={{ color: INK, fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Privacy e utilizzo dei dati</div>
                  <div style={{ maxHeight: 160, overflowY: "auto", color: MUTED, fontSize: 12, lineHeight: 1.6, paddingRight: 4 }}>
                    <p style={{ margin: "0 0 8px" }}>
                      Day Tracker funziona interamente offline: non esiste nessun server, nessun account e nessuna connessione a internet richiesta per usare l'app.
                    </p>
                    <p style={{ margin: "0 0 8px" }}>
                      <b style={{ color: INK }}>Cosa raccogliamo:</b> nome, anno di nascita, altezza e peso (solo se li inserisci — sono tutti opzionali tranne il nome), le attività e i task che registri, i dati sull'acqua bevuta e le sveglie che imposti.
                    </p>
                    <p style={{ margin: "0 0 8px" }}>
                      <b style={{ color: INK }}>Dove vengono salvati:</b> esclusivamente sulla memoria del tuo telefono (storage locale dell'app). Nessun dato viene mai inviato, sincronizzato o condiviso con server esterni, sviluppatori o terze parti.
                    </p>
                    <p style={{ margin: "0 0 8px" }}>
                      <b style={{ color: INK }}>Cookie e tracciamento:</b> nessuno. L'app non usa cookie, non contiene pubblicità e non effettua alcun tipo di analisi statistica o tracciamento del comportamento.
                    </p>
                    <p style={{ margin: "0 0 8px" }}>
                      <b style={{ color: INK }}>Notifiche:</b> le sveglie che imposti restano sul dispositivo e richiedono il permesso di notifica del sistema operativo, che puoi revocare in qualsiasi momento dalle impostazioni del telefono.
                    </p>
                    <p style={{ margin: 0 }}>
                      <b style={{ color: INK }}>Cancellazione:</b> puoi eliminare tutti i dati in ogni momento disinstallando l'app oppure da Impostazioni Android → App → Day Tracker → Cancella dati.
                    </p>
                  </div>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 12, cursor: "pointer" }}>
                    <input
                      type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)}
                      style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }}
                    />
                    <span style={{ color: INK, fontSize: 13, lineHeight: 1.4 }}>Ho letto e accetto questa informativa</span>
                  </label>
                </div>

                {error && <p className="dt-error">{error}</p>}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ marginBottom: 20 }}>
                <h1 className="dt-header-title" style={{ fontSize: 22 }}>Attività e task</h1>
                <p style={{ color: MUTED, fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
                  Prepara le categorie e i task che userai ogni giorno — puoi sempre cambiarli dopo da Personalizza.
                </p>
              </div>
              <ActivitiesSection data={data} setData={setData} />
              <div style={{ marginTop: 8 }}>
                <TasksManageSection data={data} setData={setData} />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div style={{ marginBottom: 20 }}>
                <h1 className="dt-header-title" style={{ fontSize: 22 }}>Acqua</h1>
                <p style={{ color: MUTED, fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
                  Imposta unità di misura e obiettivo giornaliero — modificabile in ogni momento.
                </p>
              </div>
              <WaterSection data={data} setData={setData} />
            </>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
          {step > 1 ? (
            <button onClick={() => setStep(step - 1)} className="dt-btn-outline" style={{ width: "auto", padding: "12px 22px" }}>
              Indietro
            </button>
          ) : <span />}
          {step === 1 && (
            <button onClick={goStep2} className="dt-btn-primary" style={{ width: "auto", padding: "12px 28px" }}>
              Avanti
            </button>
          )}
          {step === 2 && (
            <button onClick={() => setStep(3)} className="dt-btn-primary" style={{ width: "auto", padding: "12px 28px" }}>
              Avanti
            </button>
          )}
          {step === 3 && (
            <button onClick={finish} className="dt-btn-primary" style={{ width: "auto", padding: "12px 28px" }}>
              Fine
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PersonalizationTab({ data, setData }) {
  const [section, setSection] = useState("activities");
  return (
    <div>
      <div className="dt-pill-row" style={{ marginBottom: 24 }}>
        <Pill active={section === "profile"} color={INK} onClick={() => setSection("profile")}>Profilo</Pill>
        <Pill active={section === "activities"} color={INK} onClick={() => setSection("activities")}>Attività</Pill>
        <Pill active={section === "tasks"} color={INK} onClick={() => setSection("tasks")}>Task</Pill>
        <Pill active={section === "water"} color={WATER} onClick={() => setSection("water")}>Acqua</Pill>
        <Pill active={section === "reminders"} color={INK} onClick={() => setSection("reminders")}>Sveglie</Pill>
      </div>
      {section === "profile" && <ProfileSection data={data} setData={setData} />}
      {section === "activities" && <ActivitiesSection data={data} setData={setData} />}
      {section === "tasks" && <TasksManageSection data={data} setData={setData} />}
      {section === "water" && <WaterSection data={data} setData={setData} />}
      {section === "reminders" && <RemindersTab data={data} setData={setData} />}
    </div>
  );
}

/* --------------------------- History Tab --------------------------- */

function CalendarGrid({ selected, onSelect, hasDataDates }) {
  const [viewDate, setViewDate] = useState(new Date(selected + "T00:00:00"));
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7; // lunedì = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const monthLabel = viewDate.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const todayD = todayStr();

  return (
    <div className="dt-calendar">
      <div className="dt-calendar-header">
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))}><ChevronLeft size={16} /></button>
        <span>{monthLabel}</span>
        <button onClick={() => setViewDate(new Date(year, month + 1, 1))}><ChevronRight size={16} /></button>
      </div>
      <div className="dt-calendar-weekdays">
        {["L", "M", "M", "G", "V", "S", "D"].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="dt-calendar-grid">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const ds = localDateStr(new Date(year, month, d));
          const isFuture = ds > todayD;
          return (
            <button
              key={i} disabled={isFuture} onClick={() => onSelect(ds)}
              className={`dt-cal-day ${ds === selected ? "selected" : ""} ${hasDataDates.has(ds) ? "has-data" : ""}`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HistoryTab({ data }) {
  const dates = useMemo(
    () => Object.keys(data.entries).filter((d) => (data.entries[d] || []).length > 0).sort().reverse(),
    [data.entries]
  );
  const hasDataDates = useMemo(() => {
    const s = new Set();
    Object.keys(data.entries).forEach((d) => { if ((data.entries[d] || []).length > 0) s.add(d); });
    Object.keys(data.water).forEach((d) => { if ((data.water[d] || []).length > 0) s.add(d); });
    Object.keys(data.taskCompletions).forEach((d) => { if ((data.taskCompletions[d] || []).length > 0) s.add(d); });
    return s;
  }, [data.entries, data.water, data.taskCompletions]);

  const [selected, setSelected] = useState(dates[0] || todayStr());

  useEffect(() => {
    if (!selected && dates.length) setSelected(dates[0]);
  }, [dates, selected]);

  const entries = selected ? data.entries[selected] || [] : [];
  const waterMl = selected ? waterTotal(data.water[selected]) : 0;
  const completedTasks = selected ? data.taskCompletions[selected] || [] : [];
  const hasAnyData = hasDataDates.size > 0;

  if (!hasAnyData) {
    return (
      <div className="dt-empty">
        <Calendar size={28} style={{ color: MUTED }} />
        <p>Ancora nessuno storico. Le giornate tracciate compariranno qui.</p>
      </div>
    );
  }

  return (
    <div>
      <CalendarGrid selected={selected} onSelect={setSelected} hasDataDates={hasDataDates} />

      <div className="dt-history-date" style={{ marginBottom: 16 }}>{fmtDateLabel(selected)}</div>

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

      {data.tasks.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <SectionLabel>Task</SectionLabel>
          <div className="dt-card">
            {data.tasks.map((t) => {
              const done = completedTasks.includes(t.id);
              return (
                <div key={t.id} className="dt-cat-row">
                  <span className="dt-cat-dot" style={{ background: t.color }} />
                  <span className="dt-cat-label">{t.label}</span>
                  {done ? <Check size={16} color={WATER} /> : <X size={16} color={MUTED} />}
                </div>
              );
            })}
          </div>
        </div>
      )}
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
    today: data.profile.name ? `Ciao ${data.profile.name}, ecco la tua giornata` : "Il tuo giorno",
    history: "Storico",
    trends: "Grafici e trend",
    settings: "Personalizza",
  };

  if (!data.onboarded) {
    return <Onboarding data={data} setData={setData} />;
  }

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
