import { getLanguage } from '@/src/i18n';
import { artDateFromISO } from './dateUtils';
import { VehicleSnapshot } from '@/src/types';
import type { BookingVehicleApiResponse } from '@/src/api/booking';
import { isVehicleType } from '@/src/constants/vehicleTypes';

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
  // Los timestamps crudos, para lo que necesita comparar contra "ahora" (p. ej. la
  // ventana en la que el propietario puede verificar el código de llegada).
  startAt: string;
  endAt: string;
}

export function mapBookingDateRange(start: string, end: string): BookingDateRange {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const hours = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 3_600_000));
  const startTime = formatTime(start);
  const endTime = formatTime(end);

  return {
    date: artDateFromISO(start),
    endDate: artDateFromISO(end),
    startTime,
    endTime,
    hours,
    startAt: start,
    endAt: end,
  };
}

/** Same shared-mapping reasoning as mapBookingDateRange above, for
 * BookingApiResponse.vehicle -- auth-service only ever hands out a country from its own
 * fixed allowlist, so the cast is safe (never arbitrary user input). */
export function toVehicleSnapshot(v?: BookingVehicleApiResponse): VehicleSnapshot | undefined {
  if (!v) return undefined;
  return {
    type: isVehicleType(v.type) ? v.type : null,
    plate: v.plate ?? null,
    brand: v.brand ?? null,
    model: v.model ?? null,
    country: (v.country ?? 'AR') as VehicleSnapshot['country'],
  };
}

// Every date the app shows goes through the helpers below, in one of two formats:
//   long  -- "14 de septiembre de 2026" / "14 de septiembre de 2026, 14:30"
//   short -- "14/09/2026" / "14/09/2026 14:30", where space is tight (lists, cards)
// Always on the Buenos Aires calendar and clock (ART, UTC-3, no DST), like the rest of
// the platform, whatever the phone's own time zone. The long format follows the app's
// language; the short one is the same everywhere.

const MONTHS: Record<string, string[]> = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

function ymd(dateISO: string): [number, number, number] {
  const [year, month, day] = dateISO.slice(0, 10).split('-').map(Number);
  return [year, month, day];
}

/** "14:30" -- the ART time of a timestamp. */
export function formatTime(dateTimeISO: string): string {
  const art = new Date(new Date(dateTimeISO).getTime() - 3 * 3600_000);
  return `${String(art.getUTCHours()).padStart(2, '0')}:${String(art.getUTCMinutes()).padStart(2, '0')}`;
}

/** "14/09/2026" from a YYYY-MM-DD. */
export function formatShortDate(dateISO: string): string {
  const [year, month, day] = ymd(dateISO);
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

/** "14 de septiembre de 2026" from a YYYY-MM-DD. */
export function formatLongDate(dateISO: string): string {
  const [year, month, day] = ymd(dateISO);
  const lang = getLanguage();
  if (lang === 'ja') return `${year}年${month}月${day}日`;
  if (lang === 'en') return `${MONTHS.en[month - 1]} ${day}, ${year}`;
  return `${day} de ${MONTHS.es[month - 1]} de ${year}`;
}

/** "14/09/2026" from a full timestamp (e.g. a Settlement's paidAt). */
export function formatShortDateFromISO(dateTimeISO: string): string {
  return formatShortDate(artDateFromISO(dateTimeISO));
}

/** "14 de septiembre de 2026" from a full timestamp. */
export function formatLongDateFromISO(dateTimeISO: string): string {
  return formatLongDate(artDateFromISO(dateTimeISO));
}

/** "14/09/2026 14:30" */
export function formatShortDateTime(dateTimeISO: string): string {
  return `${formatShortDateFromISO(dateTimeISO)} ${formatTime(dateTimeISO)}`;
}

/** "14 de septiembre de 2026, 14:30" */
export function formatLongDateTime(dateTimeISO: string): string {
  const separator = getLanguage() === 'ja' ? ' ' : ', ';
  return `${formatLongDateFromISO(dateTimeISO)}${separator}${formatTime(dateTimeISO)}`;
}

/**
 * Línea "cuándo" de una reserva. Cuando `date` y `endDate` coinciden (HOURLY, o una
 * estadía de un solo día) muestra la fecha una sola vez -- "14/09/2026 14:00 a 16:00"
 * (short, para listas) o "14 de septiembre de 2026, 14:00 a 16:00" (long). Si difieren
 * (estadía multi-día, check-out al mismo horario que el check-in) son días distintos,
 * así que se etiquetan en vez del ambiguo "14:00 a 14:00" -- "Check-in 14/09/2026 14:00
 * — Check-out 16/09/2026 14:00".
 */
export function formatBookingWhen(
  item: { date: string; endDate: string; startTime: string; endTime: string },
  timeToLabel: string,
  checkInLabel: string,
  checkOutLabel: string,
  style: 'short' | 'long' = 'short',
): string {
  if (!item.date) return '';
  const format = style === 'long' ? formatLongDate : formatShortDate;
  const separator = style === 'long' && getLanguage() !== 'ja' ? ', ' : ' ';
  if (item.date === item.endDate) {
    return `${format(item.date)}${separator}${item.startTime} ${timeToLabel} ${item.endTime}`;
  }
  return `${checkInLabel} ${format(item.date)}${separator}${item.startTime} — ${checkOutLabel} ${format(item.endDate)}${separator}${item.endTime}`;
}

/** What the owner earns from a booking, in pesos: owner_amount when the API sent it, else
 * `amount` -- a booking from before owner_amount existed stored the owner's own price
 * there. Only meaningful for responses sent to the owner. */
export function ownerEarningsFrom(b: { amount?: number; owner_amount?: number }): number {
  const centavos = typeof b.owner_amount === 'number' ? b.owner_amount : typeof b.amount === 'number' ? b.amount : 0;
  return centavos / 100;
}
