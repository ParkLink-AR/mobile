// Armado del rango de una reserva por hora (día + hora de inicio y de fin, al minuto):
// todo lo que sale de las ventanas libres que devuelve parking-service. Funciones puras --
// la pantalla (spot/[id].tsx) sólo decide qué mostrar con lo que devuelven.

import type { DayAvailability } from '@/src/api/parking';
import { addDaysISO, artDateFromISO, artMidnightForDate } from '@/src/services/dateUtils';

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

/** Duración mínima de una reserva por hora. */
export const MIN_BOOKING_MINUTES = 30;
/** Hasta cuánto pasado del inicio se sigue ofreciendo un horario de hoy (ej. 13:05 → todavía se puede reservar 13:00). */
const PAST_TOLERANCE_MINUTES = 10;
/** El inicio sugerido se redondea hacia arriba a múltiplos de esto (son sólo una sugerencia: se puede escribir cualquier minuto). */
const SUGGESTED_START_STEP_MINUTES = 15;

const MIN_BOOKING_MS = MIN_BOOKING_MINUTES * MINUTE_MS;

/** Intervalo [startMs, endMs] en epoch-ms, con ambos extremos alineados a minuto. */
export interface Interval {
  startMs: number;
  endMs: number;
}

const ceilTo = (ms: number, stepMs: number) => Math.ceil(ms / stepMs) * stepMs;

/**
 * Junta las ventanas libres de varios días en intervalos continuos: una cochera abierta las 24 h
 * devuelve una ventana por día (00:00→24:00), pero para el conductor es un solo bloque que cruza la medianoche.
 */
export function mergeFreeWindows(days: DayAvailability[]): Interval[] {
  const intervals = days
    .flatMap((day) => day.free_windows)
    .map((window) => ({ startMs: new Date(window.start).getTime(), endMs: new Date(window.end).getTime() }))
    .filter((interval) => interval.endMs > interval.startMs)
    .sort((a, b) => a.startMs - b.startMs);

  const merged: Interval[] = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (last && interval.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, interval.endMs);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

/** Día (YYYY-MM-DD, calendario de Buenos Aires) al que pertenece un horario de INICIO. */
export function startDateOf(ms: number): string {
  return artDateFromISO(new Date(ms).toISOString());
}

/**
 * Día al que pertenece un horario de FIN. Terminar a las 00:00 es terminar "a las 24:00" del día anterior
 * (como reservar 23→24), no empezar el día siguiente.
 */
export function endDateOf(ms: number): string {
  return artDateFromISO(new Date(ms - 1).toISOString());
}

/** "HH:MM" en Buenos Aires. Con isEnd, la medianoche se muestra como "24:00". */
export function formatArtTime(ms: number, isEnd = false): string {
  const date = new Date(ms - 3 * HOUR_MS);
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  if (isEnd && hours === 0 && minutes === 0) return '24:00';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Horas de duración entre dos horarios, con fracción (1,5 h). */
export function durationHours(startMs: number, endMs: number): number {
  return (endMs - startMs) / HOUR_MS;
}

/** RFC3339 con offset de Buenos Aires, el formato que espera booking-service. */
export function toArtISO(ms: number): string {
  const date = new Date(ms - 3 * HOUR_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:00-03:00`
  );
}

/**
 * "00:00–14:45 · 15:17–24:00" -- las franjas tal cual las ve el conductor. Si se pasa `now`, una franja que ya
 * empezó se muestra como "{nowLabel}–…" en vez de con la hora (rara) del recorte por tolerancia.
 */
export function formatRanges(ranges: Interval[], now?: { ms: number; label: string }): string {
  return ranges
    .map((range) => {
      const from = now && range.startMs <= now.ms ? now.label : formatArtTime(range.startMs);
      return `${from}–${formatArtTime(range.endMs, true)}`;
    })
    .join(' · ');
}

// ── Hora tipeada ("1917") ────────────────────────────────────────────────────

/** "1917" → { hours: 19, minutes: 17 }; null si no son 4 dígitos o la hora no existe. 24:00 vale (fin del día). */
export function parseTimeDigits(digits: string): { hours: number; minutes: number } | null {
  if (!/^\d{4}$/.test(digits)) return null;
  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2));
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes !== 0)) return null;
  return { hours, minutes };
}

/** Los dígitos de un "HH:MM" ("24:00" también), para precargar el campo. */
export function timeToDigits(ms: number, isEnd = false): string {
  return formatArtTime(ms, isEnd).replace(':', '');
}

// ── Inicio ───────────────────────────────────────────────────────────────────

/** Lo libre de `dateISO` (con al menos MIN_BOOKING_MINUTES), sin lo que ya pasó: es lo que se le muestra al conductor. */
export function freeRangesOnDay(windows: Interval[], dateISO: string, nowMs: number): Interval[] {
  const dayStart = artMidnightForDate(dateISO);
  const dayEnd = dayStart + 24 * HOUR_MS;
  const earliest = ceilTo(nowMs - PAST_TOLERANCE_MINUTES * MINUTE_MS, MINUTE_MS);

  return windows
    .map((window) => ({
      startMs: Math.max(window.startMs, dayStart, earliest),
      endMs: Math.min(window.endMs, dayEnd),
    }))
    .filter((range) => range.endMs - range.startMs >= MIN_BOOKING_MS);
}

/**
 * Minutos en los que se puede empezar a reservar `dateISO`: los de las franjas libres que dejan al menos
 * MIN_BOOKING_MINUTES por delante, y siempre dentro de ese mismo día (a lo sumo 23:59).
 */
export function validStartRanges(windows: Interval[], dateISO: string, nowMs: number): Interval[] {
  const dayStart = artMidnightForDate(dateISO);
  const lastMinuteOfDay = dayStart + 24 * HOUR_MS - MINUTE_MS;
  const earliest = ceilTo(nowMs - PAST_TOLERANCE_MINUTES * MINUTE_MS, MINUTE_MS);

  return windows
    .map((window) => ({
      startMs: Math.max(window.startMs, dayStart, earliest),
      endMs: Math.min(window.endMs - MIN_BOOKING_MS, lastMinuteOfDay),
    }))
    .filter((range) => range.startMs <= range.endMs);
}

export function isInRanges(ranges: Interval[], ms: number): boolean {
  return ranges.some((range) => range.startMs <= ms && ms <= range.endMs);
}

/** Inicio sugerido: ahora redondeado a 15 min hacia arriba (o el comienzo de la primera franja libre, si es después). */
export function defaultStart(ranges: Interval[], nowMs: number): number | null {
  const suggested = ceilTo(nowMs, SUGGESTED_START_STEP_MINUTES * MINUTE_MS);
  for (const range of ranges) {
    const candidate = Math.max(range.startMs, suggested);
    if (candidate <= range.endMs) return candidate;
  }
  return ranges[0]?.startMs ?? null;
}

/** Resuelve lo tipeado para el inicio: el instante, o por qué no sirve. */
export function resolveStartInput(
  ranges: Interval[],
  dateISO: string,
  hours: number,
  minutes: number,
): { ms: number } | { error: 'invalid' | 'unavailable' } {
  if (hours >= 24) return { error: 'invalid' };
  const ms = artMidnightForDate(dateISO) + (hours * 60 + minutes) * MINUTE_MS;
  return isInRanges(ranges, ms) ? { ms } : { error: 'unavailable' };
}

// ── Fin ──────────────────────────────────────────────────────────────────────

/** Entre cuándo puede terminar una reserva que arranca en `startMs`: de MIN_BOOKING_MINUTES después hasta donde acaba su ventana libre. */
export function endBounds(windows: Interval[], startMs: number): Interval | null {
  const window = windows.find((w) => w.startMs <= startMs && startMs + MIN_BOOKING_MS <= w.endMs);
  return window ? { startMs: startMs + MIN_BOOKING_MS, endMs: window.endMs } : null;
}

/** Fin sugerido: una hora después del inicio, o hasta donde alcance. */
export function defaultEnd(bounds: Interval | null, startMs: number): number | null {
  return bounds ? Math.min(startMs + HOUR_MS, bounds.endMs) : null;
}

/** Instante de un horario de fin tipeado sobre `dateISO`: 00:00 y 24:00 son la medianoche con la que termina ese día. */
export function endOnDate(dateISO: string, hours: number, minutes: number): number {
  const totalMinutes = hours === 0 && minutes === 0 ? 24 * 60 : hours * 60 + minutes;
  return artMidnightForDate(dateISO) + totalMinutes * MINUTE_MS;
}

/**
 * Resuelve lo tipeado para el fin, sobre el día de fin elegido. Si ahí no entra pero sí al día siguiente
 * (23:00 → 01:00), se toma el día siguiente, como en una alarma.
 */
export function resolveEndInput(
  bounds: Interval,
  dateISO: string,
  hours: number,
  minutes: number,
): { ms: number } | { error: 'invalid' | 'tooShort' | 'unavailable' } {
  const sameDay = endOnDate(dateISO, hours, minutes);
  if (isInRanges([bounds], sameDay)) return { ms: sameDay };
  const nextDay = endOnDate(addDaysISO(dateISO, 1), hours, minutes);
  if (isInRanges([bounds], nextDay)) return { ms: nextDay };
  const startMs = bounds.startMs - MIN_BOOKING_MS;
  return { error: sameDay > startMs && sameDay < bounds.startMs ? 'tooShort' : 'unavailable' };
}

/** Los fines posibles dentro de `dateISO` (de 00:01 a 24:00), o null si ese día no se alcanza. */
export function endRangeOnDate(bounds: Interval, dateISO: string): Interval | null {
  const dayStart = artMidnightForDate(dateISO);
  const range = {
    startMs: Math.max(bounds.startMs, dayStart + MINUTE_MS),
    endMs: Math.min(bounds.endMs, dayStart + 24 * HOUR_MS),
  };
  return range.startMs <= range.endMs ? range : null;
}

// ── Barra de disponibilidad ──────────────────────────────────────────────────

const DAY_MS = 24 * HOUR_MS;
const BAR_TAP_STEP_MINUTES = 15;
/** Una marca de hora no se dibuja si queda a menos de esta fracción del borde izquierdo (se pisaría con "Ahora"). */
const BAR_TICK_MIN_FRACTION = 0.12;

/** Tramo de la barra, en fracciones (0–1) del ancho. */
export interface BarSpan {
  from: number;
  to: number;
}

/**
 * Lo que dibuja la barra principal: de ahora a 24 h más (cruza la medianoche) mientras lo elegido caiga ahí; si no, el
 * día de inicio entero. Así lo ya pasado nunca ocupa lugar y, hoy, se ve también la madrugada de mañana.
 */
export function barDomain(dateISO: string, startMs: number | null, nowMs: number): Interval {
  const rollingStart = Math.floor(nowMs / MINUTE_MS) * MINUTE_MS;
  const inRollingWindow =
    dateISO === startDateOf(nowMs) || (startMs !== null && startMs >= rollingStart && startMs < rollingStart + DAY_MS);
  if (inRollingWindow) return { startMs: rollingStart, endMs: rollingStart + DAY_MS };
  const dayStart = artMidnightForDate(dateISO);
  return { startMs: dayStart, endMs: dayStart + DAY_MS };
}

/** Lo libre dentro de `domain` (las franjas de al menos MIN_BOOKING_MINUTES), recortado a él. */
export function freeRangesIn(windows: Interval[], domain: Interval): Interval[] {
  return windows
    .map((window) => ({ startMs: Math.max(window.startMs, domain.startMs), endMs: Math.min(window.endMs, domain.endMs) }))
    .filter((range) => range.endMs - range.startMs >= MIN_BOOKING_MS);
}

/** Dónde cae `interval` dentro de `domain`, recortado a él; null si no lo toca. */
export function barSpan(interval: Interval, domain: Interval): BarSpan | null {
  const width = domain.endMs - domain.startMs;
  const from = Math.max(interval.startMs, domain.startMs);
  const to = Math.min(interval.endMs, domain.endMs);
  return to > from ? { from: (from - domain.startMs) / width, to: (to - domain.startMs) / width } : null;
}

/** Instante que corresponde a una fracción (0–1) del ancho de la barra. */
export function barFractionToMs(domain: Interval, fraction: number): number {
  return domain.startMs + Math.round(Math.min(Math.max(fraction, 0), 1) * (domain.endMs - domain.startMs));
}

/** Una marca de hora de la barra. En la medianoche que abre un día nuevo trae ese día (para rotularla con él). */
export interface BarTick {
  fraction: number;
  hour: number;
  midnightDateISO: string | null;
}

/**
 * Marcas de hora de la barra: cada 6 h si se ve un día entero, más seguido cuanto menos se ve. Las horas son del
 * calendario de Buenos Aires (0–24).
 */
export function barTicks(domain: Interval): BarTick[] {
  const span = domain.endMs - domain.startMs;
  const step = span >= 18 * HOUR_MS ? 6 : span >= 9 * HOUR_MS ? 3 : span >= 4 * HOUR_MS ? 2 : 1;

  const ticks: BarTick[] = [];
  for (let ms = Math.ceil(domain.startMs / HOUR_MS) * HOUR_MS; ms <= domain.endMs; ms += HOUR_MS) {
    const hourOfDay = new Date(ms - 3 * HOUR_MS).getUTCHours();
    if (hourOfDay % step !== 0) continue;
    const fraction = (ms - domain.startMs) / span;
    if (fraction !== 0 && fraction < BAR_TICK_MIN_FRACTION) continue;
    const isMidnight = hourOfDay === 0;
    ticks.push({
      fraction,
      hour: isMidnight && fraction === 1 ? 24 : hourOfDay,
      midnightDateISO: isMidnight && fraction > 0 && fraction < 1 ? startDateOf(ms) : null,
    });
  }
  return ticks;
}

/** El tramo no disponible (visto dentro de `domain`) que contiene `atMs`; null si ahí hay lugar. `free` va ordenado. */
export function gapAt(free: Interval[], domain: Interval, atMs: number): Interval | null {
  if (free.some((range) => range.startMs <= atMs && atMs <= range.endMs)) return null;
  const startMs = free.reduce((latest, range) => (range.endMs <= atMs ? Math.max(latest, range.endMs) : latest), domain.startMs);
  const next = free.find((range) => range.startMs >= atMs);
  return { startMs, endMs: next ? next.startMs : domain.endMs };
}

/**
 * Inicio que corresponde a un toque en la barra: el toque se redondea a 15 minutos y se lleva al borde de la
 * franja si se pasa (nunca antes de que abra ni a menos de 30 minutos del final). null si cae en lo no
 * disponible.
 */
export function pickStartFromTap(startRanges: Interval[], tapMs: number): number | null {
  const range = startRanges.find(
    (r) => tapMs >= r.startMs - MINUTE_MS && tapMs <= r.endMs + MIN_BOOKING_MS,
  );
  if (!range) return null;
  const snapped = Math.round(tapMs / (BAR_TAP_STEP_MINUTES * MINUTE_MS)) * BAR_TAP_STEP_MINUTES * MINUTE_MS;
  return Math.min(Math.max(snapped, range.startMs), range.endMs);
}
