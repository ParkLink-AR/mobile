import { getStayAvailability, StayDayAvailability } from '@/src/api/parking';
import { addDaysISO, addOneDayISO } from '@/src/services/dateUtils';

/** How far ahead to look for a free stay (parking-service's calendar takes up to 93 days). */
const STAY_SEARCH_DAYS = 90;

/**
 * The first day from `fromISO` on where a one-night stay fits: that day and the next are
 * both free in the calendar (the shortest stay runs from check-in one day to the same hour
 * the next). Null if there's none.
 */
export function firstFreeStayStart(days: StayDayAvailability[], fromISO: string): string | null {
  const free = new Set(days.filter((day) => day.status === 'available').map((day) => day.date));
  const candidates = [...free].filter((date) => date >= fromISO).sort();
  return candidates.find((date) => free.has(addOneDayISO(date))) ?? null;
}

/** firstFreeStayStart over the spot's stay calendar from `fromISO`, STAY_SEARCH_DAYS ahead. */
export async function findFirstFreeStayStart(parkingSpotId: string, fromISO: string): Promise<string | null> {
  const { days } = await getStayAvailability(parkingSpotId, fromISO, addDaysISO(fromISO, STAY_SEARCH_DAYS));
  return firstFreeStayStart(days, fromISO);
}
