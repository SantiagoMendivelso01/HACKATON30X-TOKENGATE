// Hora de Colombia (UTC−5, sin horario de verano) y festivos (Ley 51 de 1983, "Ley Emiliani").

const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

export interface BogotaParts {
  year: number;
  month: number; // 1–12
  day: number;
  weekday: number; // 0 = domingo
  hour: number;
  minute: number;
  /** YYYY-MM-DD */
  date: string;
}

export function bogotaParts(d: Date): BogotaParts {
  const b = new Date(d.getTime() + BOGOTA_OFFSET_MS);
  const year = b.getUTCFullYear();
  const month = b.getUTCMonth() + 1;
  const day = b.getUTCDate();
  return {
    year,
    month,
    day,
    weekday: b.getUTCDay(),
    hour: b.getUTCHours(),
    minute: b.getUTCMinutes(),
    date: ymd(year, month, day),
  };
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Domingo de Pascua (algoritmo anónimo gregoriano). */
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

function nextMonday(d: Date): Date {
  const wd = d.getUTCDay();
  return wd === 1 ? d : addDays(d, (8 - wd) % 7);
}

function iso(d: Date): string {
  return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

const cache = new Map<number, Set<string>>();

export function colombianHolidays(year: number): Set<string> {
  const hit = cache.get(year);
  if (hit) return hit;
  const fixed = [
    [1, 1],
    [5, 1],
    [7, 20],
    [8, 7],
    [12, 8],
    [12, 25],
  ];
  const movable = [
    [1, 6],
    [3, 19],
    [6, 29],
    [8, 15],
    [10, 12],
    [11, 1],
    [11, 11],
  ];
  const e = easter(year);
  const days = [
    ...fixed.map(([m, d]) => new Date(Date.UTC(year, m - 1, d))),
    ...movable.map(([m, d]) => nextMonday(new Date(Date.UTC(year, m - 1, d)))),
    addDays(e, -3), // Jueves Santo
    addDays(e, -2), // Viernes Santo
    nextMonday(addDays(e, 39)), // Ascensión
    nextMonday(addDays(e, 60)), // Corpus Christi
    nextMonday(addDays(e, 68)), // Sagrado Corazón
  ];
  const set = new Set(days.map(iso));
  cache.set(year, set);
  return set;
}

export function isColombianHoliday(d: Date): boolean {
  const p = bogotaParts(d);
  return colombianHolidays(p.year).has(p.date);
}
