import {
  defaultEnd,
  defaultStart,
  endBounds,
  endDateOf,
  barDomain,
  barFractionToMs,
  barSpan,
  barTicks,
  endRangeOnDate,
  firstFreeStart,
  formatArtTime,
  formatRanges,
  freeRangesIn,
  freeRangesOnDay,
  gapAt,
  isInRanges,
  mergeFreeWindows,
  parseTimeDigits,
  pickStartFromTap,
  resolveEndInput,
  resolveStartInput,
  startDateOf,
  timeToDigits,
  toArtISO,
  validStartRanges,
} from '@/src/services/bookingRange';
import type { DayAvailability } from '@/src/api/parking';

// ms de una hora de Buenos Aires (UTC-3) de un día concreto de octubre de 2026.
const art = (day: number, hour: number, minute = 0) => Date.UTC(2026, 9, day, hour + 3, minute);
const iso = (day: number, hour: number, minute = 0) =>
  `2026-10-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-03:00`;

function day(date: string, windows: Array<[string, string]>): DayAvailability {
  return { date, status: windows.length ? 'available' : 'closed', free_windows: windows.map(([start, end]) => ({ start, end })) };
}

const LONG_AGO = art(1, 0);

describe('mergeFreeWindows', () => {
  it('joins windows that touch at midnight into one block', () => {
    const merged = mergeFreeWindows([
      day('2026-10-14', [[iso(14, 0), iso(15, 0)]]),
      day('2026-10-15', [[iso(15, 0), iso(16, 0)]]),
    ]);
    expect(merged).toEqual([{ startMs: art(14, 0), endMs: art(16, 0) }]);
  });

  it('keeps windows separated by a booking apart', () => {
    const merged = mergeFreeWindows([day('2026-10-14', [[iso(14, 8), iso(14, 10)], [iso(14, 12), iso(14, 18)]])]);
    expect(merged).toHaveLength(2);
  });

  it('sorts unordered input and ignores empty days', () => {
    const merged = mergeFreeWindows([
      day('2026-10-15', [[iso(15, 8), iso(15, 9)]]),
      day('2026-10-14', []),
      day('2026-10-14', [[iso(14, 8), iso(14, 9)]]),
    ]);
    expect(merged.map((m) => m.startMs)).toEqual([art(14, 8), art(15, 8)]);
  });
});

describe('typed times', () => {
  it('parses four digits into a real clock time', () => {
    expect(parseTimeDigits('1917')).toEqual({ hours: 19, minutes: 17 });
    expect(parseTimeDigits('0000')).toEqual({ hours: 0, minutes: 0 });
    expect(parseTimeDigits('2400')).toEqual({ hours: 24, minutes: 0 });
  });

  it('rejects times that do not exist', () => {
    expect(parseTimeDigits('2401')).toBeNull();
    expect(parseTimeDigits('2560')).toBeNull();
    expect(parseTimeDigits('1960')).toBeNull();
    expect(parseTimeDigits('191')).toBeNull();
    expect(parseTimeDigits('19a7')).toBeNull();
  });

  it('turns a time back into digits, with 24:00 for the end of the day', () => {
    expect(timeToDigits(art(14, 19, 17))).toBe('1917');
    expect(timeToDigits(art(15, 0), true)).toBe('2400');
  });
});

describe('free ranges and starts', () => {
  // Una reserva ocupa 14:45–15:02 + gracia: libre hasta 14:45 y desde 15:17.
  const windows = [
    { startMs: art(14, 0), endMs: art(14, 14, 45) },
    { startMs: art(14, 15, 17), endMs: art(15, 0) },
  ];

  it('lists what is free on the day, with minute precision', () => {
    expect(formatRanges(freeRangesOnDay(windows, '2026-10-14', LONG_AGO))).toBe('00:00–14:45 · 15:17–24:00');
  });

  it('lets you start at any minute inside a free range, and at the exact edge of one', () => {
    const ranges = validStartRanges(windows, '2026-10-14', LONG_AGO);
    expect(isInRanges(ranges, art(14, 19, 17))).toBe(true);
    expect(isInRanges(ranges, art(14, 15, 17))).toBe(true);
    expect(isInRanges(ranges, art(14, 15, 16))).toBe(false);
    expect(isInRanges(ranges, art(14, 15, 0))).toBe(false);
  });

  it('needs 30 minutes ahead, and never starts on the next day', () => {
    const ranges = validStartRanges(windows, '2026-10-14', LONG_AGO);
    expect(isInRanges(ranges, art(14, 14, 15))).toBe(true);
    expect(isInRanges(ranges, art(14, 14, 16))).toBe(false);
    expect(isInRanges(ranges, art(14, 23, 30))).toBe(true);
    expect(isInRanges(ranges, art(14, 23, 31))).toBe(false);
  });

  it('only offers a start for the requested day', () => {
    const overnight = [{ startMs: art(14, 22), endMs: art(15, 3) }];
    expect(formatRanges(validStartRanges(overnight, '2026-10-14', LONG_AGO))).toBe('22:00–23:59');
    expect(formatRanges(validStartRanges(overnight, '2026-10-15', LONG_AGO))).toBe('00:00–02:30');
  });

  it('drops what is already past, with a 10 minute tolerance', () => {
    const open = [{ startMs: art(14, 8), endMs: art(14, 20) }];
    expect(formatArtTime(validStartRanges(open, '2026-10-14', art(14, 13, 5))[0].startMs)).toBe('12:55');
    expect(formatArtTime(validStartRanges(open, '2026-10-14', art(14, 13, 20))[0].startMs)).toBe('13:10');
  });

  it('resolves a typed start', () => {
    const ranges = validStartRanges(windows, '2026-10-14', LONG_AGO);
    expect(resolveStartInput(ranges, '2026-10-14', 19, 17)).toEqual({ ms: art(14, 19, 17) });
    expect(resolveStartInput(ranges, '2026-10-14', 15, 0)).toEqual({ error: 'unavailable' });
    expect(resolveStartInput(ranges, '2026-10-14', 24, 0)).toEqual({ error: 'invalid' });
  });
});

describe('defaultStart', () => {
  const ranges = [{ startMs: art(14, 8), endMs: art(14, 20) }];

  it('suggests now rounded up to 15 minutes', () => {
    expect(defaultStart(ranges, art(14, 13, 5))).toBe(art(14, 13, 15));
  });

  it('starts at the beginning of the range for a future day', () => {
    expect(defaultStart(ranges, art(10, 9))).toBe(art(14, 8));
  });

  it('is null when there is nothing free', () => {
    expect(defaultStart([], art(14, 9))).toBeNull();
  });
});

describe('ends', () => {
  const windows = [{ startMs: art(14, 8), endMs: art(15, 2) }];

  it('runs from 30 minutes after the start to where the free window ends, across midnight', () => {
    expect(endBounds(windows, art(14, 23))).toEqual({ startMs: art(14, 23, 30), endMs: art(15, 2) });
  });

  it('is null when the start does not fit', () => {
    expect(endBounds([{ startMs: art(14, 8), endMs: art(14, 9) }], art(14, 8, 45))).toBeNull();
  });

  it('suggests one hour, or as far as it goes', () => {
    expect(defaultEnd(endBounds(windows, art(14, 23)), art(14, 23))).toBe(art(15, 0));
    expect(defaultEnd(endBounds(windows, art(15, 1)), art(15, 1))).toBe(art(15, 2));
    expect(defaultEnd(null, art(14, 23))).toBeNull();
  });

  it('takes a typed end on the same day when it fits', () => {
    const bounds = endBounds(windows, art(14, 19, 17))!;
    expect(resolveEndInput(bounds, '2026-10-14', 21, 3)).toEqual({ ms: art(14, 21, 3) });
  });

  it('rolls over to the next day when the time only fits there (23:00 → 01:00)', () => {
    const bounds = endBounds(windows, art(14, 23))!;
    expect(resolveEndInput(bounds, '2026-10-14', 1, 0)).toEqual({ ms: art(15, 1) });
  });

  it('reads 00:00 and 24:00 as the midnight that ends the day', () => {
    const bounds = endBounds(windows, art(14, 23))!;
    expect(resolveEndInput(bounds, '2026-10-14', 0, 0)).toEqual({ ms: art(15, 0) });
    expect(resolveEndInput(bounds, '2026-10-14', 24, 0)).toEqual({ ms: art(15, 0) });
  });

  it('explains why an end does not fit', () => {
    const bounds = endBounds(windows, art(14, 23))!;
    expect(resolveEndInput(bounds, '2026-10-14', 23, 10)).toEqual({ error: 'tooShort' });
    expect(resolveEndInput(bounds, '2026-10-14', 3, 0)).toEqual({ error: 'unavailable' });
  });

  it('limits the end to the chosen day', () => {
    const bounds = endBounds(windows, art(14, 23))!;
    expect(endRangeOnDate(bounds, '2026-10-14')).toEqual({ startMs: art(14, 23, 30), endMs: art(15, 0) });
    expect(endRangeOnDate(bounds, '2026-10-15')).toEqual({ startMs: art(15, 0, 1), endMs: art(15, 2) });
    expect(endRangeOnDate(bounds, '2026-10-16')).toBeNull();
  });
});

describe('dates and ISO', () => {
  it('treats an end at midnight as 24:00 of the previous day', () => {
    expect(endDateOf(art(15, 0))).toBe('2026-10-14');
    expect(formatArtTime(art(15, 0), true)).toBe('24:00');
    expect(startDateOf(art(15, 0))).toBe('2026-10-15');
    expect(formatArtTime(art(15, 0))).toBe('00:00');
  });

  it('renders Buenos Aires wall time with its offset', () => {
    expect(toArtISO(art(14, 19, 17))).toBe('2026-10-14T19:17:00-03:00');
    expect(toArtISO(art(15, 0))).toBe('2026-10-15T00:00:00-03:00');
  });
});

describe('formatRanges with "now"', () => {
  it('shows the label instead of the clipped start of a range that already began', () => {
    const ranges = [{ startMs: art(14, 16, 7), endMs: art(15, 0) }];
    expect(formatRanges(ranges, { ms: art(14, 16, 17), label: 'Ahora' })).toBe('Ahora–24:00');
    expect(formatRanges(ranges)).toBe('16:07–24:00');
  });

  it('keeps real hours for ranges still to come', () => {
    const ranges = [{ startMs: art(14, 18, 15), endMs: art(14, 20) }];
    expect(formatRanges(ranges, { ms: art(14, 16, 17), label: 'Ahora' })).toBe('18:15–20:00');
  });
});

describe('availability bar', () => {
  const fullDay = { startMs: art(14, 0), endMs: art(15, 0) };

  it('draws the next 24 h from now while the pick falls inside them', () => {
    const now = art(14, 18, 42);
    const rolling = { startMs: now, endMs: now + 24 * 3_600_000 };
    expect(barDomain('2026-10-14', null, now)).toEqual(rolling);
    expect(barDomain('2026-10-15', art(15, 4), now)).toEqual(rolling);
  });

  it('draws the whole start day for anything outside the next 24 h', () => {
    const now = art(14, 18, 42);
    expect(barDomain('2026-10-20', art(20, 10), now)).toEqual({ startMs: art(20, 0), endMs: art(21, 0) });
    expect(barDomain('2026-10-20', null, now)).toEqual({ startMs: art(20, 0), endMs: art(21, 0) });
  });

  it('keeps only the free stretches that fit a booking, clipped to the domain', () => {
    const windows = [
      { startMs: art(14, 8), endMs: art(14, 8, 20) },
      { startMs: art(14, 10), endMs: art(14, 23) },
      { startMs: art(15, 2), endMs: art(15, 12) },
    ];
    expect(formatRanges(freeRangesIn(windows, { startMs: art(14, 12), endMs: art(15, 6) }))).toBe('12:00–23:00 · 02:00–06:00');
  });

  it('places an interval as fractions of the domain', () => {
    expect(barSpan({ startMs: art(14, 6), endMs: art(14, 12) }, fullDay)).toEqual({ from: 0.25, to: 0.5 });
    const fromNoon = { startMs: art(14, 12), endMs: art(15, 0) };
    expect(barSpan({ startMs: art(14, 18), endMs: art(14, 24) }, fromNoon)).toEqual({ from: 0.5, to: 1 });
  });

  it('clips what spills over the domain and ignores what does not touch it', () => {
    expect(barSpan({ startMs: art(14, 22), endMs: art(15, 3) }, fullDay)).toEqual({ from: 22 / 24, to: 1 });
    expect(barSpan({ startMs: art(14, 10), endMs: art(14, 14) }, { startMs: art(14, 12), endMs: art(15, 0) })).toEqual({
      from: 0,
      to: 2 / 12,
    });
    expect(barSpan({ startMs: art(14, 1), endMs: art(14, 5) }, { startMs: art(14, 12), endMs: art(15, 0) })).toBeNull();
  });

  it('maps a bar fraction back to an instant', () => {
    expect(barFractionToMs(fullDay, 0.5)).toBe(art(14, 12));
    expect(barFractionToMs(fullDay, 2)).toBe(art(15, 0));
    expect(barFractionToMs({ startMs: art(14, 12), endMs: art(15, 0) }, 0.5)).toBe(art(14, 18));
  });

  it('puts an hour mark every 6 h on a whole day', () => {
    expect(barTicks(fullDay).map((tick) => tick.hour)).toEqual([0, 6, 12, 18, 24]);
  });

  it('marks the midnight inside a window that crosses it with the new day', () => {
    const now = art(14, 18, 42);
    const ticks = barTicks({ startMs: now, endMs: now + 24 * 3_600_000 });
    expect(ticks.map((tick) => tick.hour)).toEqual([0, 6, 12, 18]);
    expect(ticks.map((tick) => tick.midnightDateISO)).toEqual(['2026-10-15', null, null, null]);
  });

  it('puts marks closer together when less is shown, skipping the one next to the left edge', () => {
    expect(barTicks({ startMs: art(14, 8, 10), endMs: art(15, 0) }).map((tick) => tick.hour)).toEqual([12, 15, 18, 21, 24]);
    expect(barTicks({ startMs: art(14, 17, 50), endMs: art(15, 0) }).map((tick) => tick.hour)).toEqual([20, 22, 24]);
  });

  it('finds the unavailable stretch under a tap', () => {
    const free = [
      { startMs: art(14, 8), endMs: art(14, 10) },
      { startMs: art(14, 13), endMs: art(14, 20) },
    ];
    const domain = { startMs: art(14, 6), endMs: art(15, 0) };
    expect(gapAt(free, domain, art(14, 11))).toEqual({ startMs: art(14, 10), endMs: art(14, 13) });
    expect(gapAt(free, domain, art(14, 7))).toEqual({ startMs: art(14, 6), endMs: art(14, 8) });
    expect(gapAt(free, domain, art(14, 22))).toEqual({ startMs: art(14, 20), endMs: art(15, 0) });
    expect(gapAt(free, domain, art(14, 9))).toBeNull();
  });

  const startRanges = [
    { startMs: art(14, 0), endMs: art(14, 8, 45) },
    { startMs: art(14, 12, 15), endMs: art(14, 17, 45) },
  ];

  it('turns a tap inside a free range into a start rounded to 15 minutes', () => {
    expect(pickStartFromTap(startRanges, art(14, 14, 8))).toBe(art(14, 14, 15));
    expect(pickStartFromTap(startRanges, art(14, 14, 6))).toBe(art(14, 14, 0));
  });

  it('pulls a tap near the edges of a range to the closest valid start', () => {
    expect(pickStartFromTap(startRanges, art(14, 12, 16))).toBe(art(14, 12, 15));
    expect(pickStartFromTap(startRanges, art(14, 12, 15))).toBe(art(14, 12, 15));
    expect(pickStartFromTap(startRanges, art(14, 12, 10))).toBeNull();
    expect(pickStartFromTap(startRanges, art(14, 17, 59))).toBe(art(14, 17, 45));
  });

  it('ignores a tap on something unavailable', () => {
    expect(pickStartFromTap(startRanges, art(14, 10, 0))).toBeNull();
  });
});

describe('firstFreeStart', () => {
  it('skips a day with nothing free and lands on the next free window', () => {
    // Hoy (12) a las 20:00 no queda nada; mañana abre a las 8.
    const windows = [{ startMs: art(13, 8), endMs: art(13, 18) }];
    expect(firstFreeStart(windows, art(12, 20))).toBe(art(13, 8));
  });

  it('starts a window already open at now, rounded up to 15 minutes', () => {
    const windows = [{ startMs: art(12, 8), endMs: art(12, 22) }];
    expect(firstFreeStart(windows, art(12, 10, 7))).toBe(art(12, 10, 15));
  });

  it('skips what is left of a window too short to book', () => {
    const windows = [
      { startMs: art(12, 8), endMs: art(12, 10, 20) },
      { startMs: art(14, 9), endMs: art(14, 12) },
    ];
    expect(firstFreeStart(windows, art(12, 10, 5))).toBe(art(14, 9));
  });

  it('is null when nothing is free', () => {
    expect(firstFreeStart([], art(12, 10))).toBeNull();
  });
});
