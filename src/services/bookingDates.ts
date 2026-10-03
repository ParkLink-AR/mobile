import { artDateFromISO } from './dateUtils';
import { VehicleSnapshot } from '@/src/types';

// Rango de fecha/hora de una reserva, derivado de sus timestamps `start`/`end`
// crudos -- misma lógica para las 4 pantallas que mapean BookingApiResponse a
// Booking (lista y detalle del conductor, lista del propietario, solicitudes).
// Antes cada una calculaba esto por su cuenta con `new Date(iso).toLocaleTimeString(...)`
// y sólo mostraba `date`/`startTime`/`endTime` -- para una reserva de estadía
// (check-out al mismo horario que el check-in, ver stays.service.ts en
// parking-service, no medianoche) eso rendía "14:00 → 14:00" sin indicar que
// son días distintos. `endDate` expone el día de checkout para que la UI
// pueda mostrar el rango completo cuando no coincide con `date`.
export interface BookingDateRange {
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  hours: number;
}

export function mapBookingDateRange(start: string, end: string): BookingDateRange {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const hours = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 3_600_000));
  const startTime = startDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const endTime = endDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

  return {
    date: artDateFromISO(start),
    endDate: artDateFromISO(end),
    startTime,
    endTime,
    hours,
  };
}

/** Same shared-mapping reasoning as mapBookingDateRange above, for
 * BookingApiResponse.vehicle -- auth-service only ever hands out a country from its own
 * fixed allowlist, so the cast is safe (never arbitrary user input). */
export function toVehicleSnapshot(
  v?: { plate: string; brand: string; model: string; country: string }
): VehicleSnapshot | undefined {
  if (!v) return undefined;
  return { plate: v.plate, brand: v.brand, model: v.model, country: v.country as VehicleSnapshot['country'] };
}

/** "10/09" -- mismo formato corto usado en el resto de la app para fechas. */
export function formatShortDate(dateISO: string): string {
  return new Date(`${dateISO}T12:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

/** "10/09/2026" -- igual que formatShortDate pero con el año, para pantallas de
 * detalle (check-in/check-out) donde ambigüedad de año importa más que en una lista. */
export function formatFullDate(dateISO: string): string {
  return new Date(`${dateISO}T12:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Línea "cuándo" de una reserva para listas/detalle. Cuando `date` y
 * `endDate` coinciden (HOURLY, o una estadía de un solo día) muestra la
 * fecha una sola vez -- "2026-09-10 · 14:00 a 16:00", igual que siempre. Si
 * difieren (estadía multi-día, check-out al mismo horario que el check-in,
 * no medianoche) son días distintos, así que se etiquetan como check-in/
 * check-out en vez del ambiguo "14:00 a 14:00" -- "Check-in 10/09 · 14:00 —
 * Check-out 14/09 · 14:00".
 */
/**
 * "10/09/2026" from a full ISO timestamp (e.g. a Settlement's `paidAt`).
 * Unlike formatFullDate, this doesn't need the T12:00:00 noon hack -- that one
 * exists only because its input is a bare YYYY-MM-DD with no real time of its
 * own; a timestamp like paidAt already carries one.
 */
export function formatFullDateFromISO(dateTimeISO: string): string {
  return new Date(dateTimeISO).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * "10/09/2026 · 14:30" -- same date format as formatFullDateFromISO, plus the
 * time, same pattern bookings/[id].tsx already uses inline for a booking's
 * paidAt.
 */
export function formatFullDateTime(dateTimeISO: string): string {
  const time = new Date(dateTimeISO).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return `${formatFullDateFromISO(dateTimeISO)} · ${time}`;
}

export function formatBookingWhen(
  item: { date: string; endDate: string; startTime: string; endTime: string },
  timeToLabel: string,
  checkInLabel: string,
  checkOutLabel: string,
): string {
  if (item.date === item.endDate) {
    return `${item.date} · ${item.startTime} ${timeToLabel} ${item.endTime}`;
  }
  return `${checkInLabel} ${formatShortDate(item.date)} · ${item.startTime} — ${checkOutLabel} ${formatShortDate(item.endDate)} · ${item.endTime}`;
}
