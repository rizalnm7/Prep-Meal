// ============================================================
// utils.js — helper kecil yang dipakai di seluruh modul
// ============================================================

const MEAL_TYPES = [
  { value: "sarapan", label: "Sarapan" },
  { value: "makan_siang", label: "Makan Siang" },
  { value: "makan_malam", label: "Makan Malam" },
  { value: "camilan", label: "Camilan" },
];

const UNIT_OPTIONS = ["gram", "kg", "ml", "liter", "pcs", "sdm", "sdt", "siung", "ikat", "butir"];

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISODate(isoStr) {
  const [y, m, d] = isoStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateLabel(date, withDayName = true) {
  const dayName = DAY_NAMES[date.getDay()];
  const str = `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
  return withDayName ? `${dayName}, ${str}` : str;
}

function mealTypeLabel(value) {
  return MEAL_TYPES.find(m => m.value === value)?.label || value;
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // make Monday the start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function showToast(message, duration = 2200) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.hidden = false;
  toast.style.opacity = "1";
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => { toast.hidden = true; }, 200);
  }, duration);
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatQty(qty, unit) {
  const n = Number(qty);
  const rounded = Math.round(n * 100) / 100;
  return `${rounded} ${unit || ""}`.trim();
}

function uuid() {
  return crypto.randomUUID();
}
