// Fecha/hora en huso horario de Buenos Aires (ART = UTC-3, sin horario de
// verano). El backend devuelve todo en ISO (offset-aware o UTC); estos
// helpers son la única fuente de verdad para convertir eso a "qué día es en
// Argentina", usada tanto por el detalle de una cochera (spot/[id].tsx) como
// por las pantallas de Hoy/Calendario del propietario.

/** UTC epoch-ms de la medianoche de Buenos Aires (00:00 ART = 03:00 UTC) para un YYYY-MM-DD. */
export function artMidnightForDate(dateISO: string): number {
  const [year, month, day] = dateISO.split('-').map(Number);
  return Date.UTC(year, month - 1, day, 3, 0, 0, 0);
}

/** Devuelve el YYYY-MM-DD (calendario ART) de un timestamp ISO cualquiera. */
export function artDateFromISO(iso: string): string {
  const date = new Date(iso);
  const art = new Date(date.getTime() - 3 * 3600_000);
  const y = art.getUTCFullYear();
  const m = String(art.getUTCMonth() + 1).padStart(2, '0');
  const d = String(art.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD de "hoy" en ART. */
export function todayArtDateISO(): string {
  return artDateFromISO(new Date().toISOString());
}
