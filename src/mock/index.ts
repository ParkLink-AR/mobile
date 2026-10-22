import { useSessionStore } from '@/src/store/useSessionStore';
import { CAR, DAY_MS, DRIVERS, ago, at, fallbackFetch, iso, profile, reviewsOf, settlements, uid } from './fixtures';

export { mocksEnabled } from './flag';

// Datos de ejemplo para demos y capturas. Con `mocksEnabled` la app sigue hablando con el
// backend de verdad, y esta capa le suma encima lo que una app con mucho uso mostraría:
//   - cocheras con pocas o ninguna reseña reciben un puntaje y una cantidad de reseñas creíbles,
//     y una descripción si les falta (el "perfil" se elige según el id de la cochera, así que
//     una misma cochera siempre muestra lo mismo);
//   - cada cochera del propietario recibe reservas pasadas, de hoy (todas confirmadas, todavía
//     sin empezar) y futuras: llenan "Hoy" y el calendario. Nunca hay solicitudes pendientes;
//   - el conductor suma un historial con una reserva confirmada y su código de llegada;
//   - la bandeja de notificaciones y las liquidaciones se completan si están vacías;
//   - los nombres de cochera se muestran sin tildes ni caracteres rotos.
// Lo real nunca se pisa: los datos del backend van primero y lo inventado se agrega. Si el
// backend no responde, contesta `fallbackFetch` (usuario y cocheras de ejemplo fijos).

// ── Azar estable ─────────────────────────────────────────────────────────────

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngFrom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Perfiles de cochera ──────────────────────────────────────────────────────

interface Profile {
  rating: [number, number];
  reviews: [number, number];
  // Cuántas reservas tiene hoy (de 6 posibles).
  todaySlots: number;
}

const PROFILES: Profile[] = [
  { rating: [4.7, 4.9], reviews: [220, 420], todaySlots: 6 }, // muy popular
  { rating: [4.5, 4.7], reviews: [80, 150], todaySlots: 4 }, // sólida
  { rating: [4.8, 5.0], reviews: [35, 70], todaySlots: 3 }, // nueva pero muy bien puntuada
  { rating: [4.4, 4.6], reviews: [110, 200], todaySlots: 5 }, // económica y concurrida
];

const DESCRIPTIONS = [
  'Cochera segura con acceso fácil, ideal para estacionar durante el día.',
  'Lugar cómodo y bien ubicado, a pocas cuadras del subte.',
  'Cochera techada con buena iluminación y vigilancia.',
  'Entrada sencilla y espacio amplio. El dueño responde rápido.',
];

// Con menos reseñas reales que esto, se completa con las de ejemplo.
const MIN_REAL_REVIEWS = 5;

const profileOf = (id: string) => PROFILES[hash(id) % PROFILES.length];

function statsOf(id: string) {
  const p = profileOf(id);
  const next = rngFrom(hash(id) ^ 0x9e3779b9);
  return {
    rating: Math.min(5, Math.round((p.rating[0] + next() * (p.rating[1] - p.rating[0])) * 10) / 10),
    reviewCount: Math.round(p.reviews[0] + next() * (p.reviews[1] - p.reviews[0])),
  };
}

/** Nombre de cochera sin tildes ni caracteres rotos ("Integraci�n" -> "Integracion"). */
export function cleanTitle(title: string): string {
  return String(title ?? '')
    .replace(/�/g, 'o')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// ── Cocheras ─────────────────────────────────────────────────────────────────

// Lo que se sabe de cada cochera que pasó por la app: sus reservas de ejemplo usan su precio y dueño.
const spotCache = new Map<string, { price: number; ownerId: string; title: string }>();
let commissionRate = 0.08;

function enrichSpot(spot: any): any {
  if (!spot || typeof spot !== 'object' || !spot.id) return spot;
  const byVehicle = spot.pricePerHourByVehicleType ? Object.values(spot.pricePerHourByVehicleType)[0] : null;
  const title = cleanTitle(spot.title ?? 'Cochera');
  spotCache.set(spot.id, {
    price: Number(spot.pricePerHour ?? byVehicle ?? 5000),
    ownerId: spot.ownerId,
    title,
  });
  const out = { ...spot, title };
  if ((spot.reviewCount ?? 0) < MIN_REAL_REVIEWS) {
    const stats = statsOf(spot.id);
    out.rating = stats.rating;
    out.reviewCount = stats.reviewCount;
  }
  if (!spot.description || String(spot.description).trim().length < 10) {
    out.description = DESCRIPTIONS[hash(spot.id) % DESCRIPTIONS.length];
  }
  return out;
}

function overlayReviews(real: any, id: string, type: 'spot' | 'owner' | 'driver') {
  if (!real || typeof real.count !== 'number' || real.count >= MIN_REAL_REVIEWS) return real;
  const stats = statsOf(id);
  const fake = reviewsOf(type, id, stats.rating, stats.reviewCount);
  return {
    average_rating: stats.rating,
    count: stats.reviewCount,
    reviews: [...(real.reviews ?? []), ...fake.reviews],
  };
}

// ── Reservas de ejemplo ──────────────────────────────────────────────────────

// Los ids inventados tienen esta forma (ver `uid`); los de verdad son UUID al azar.
const isMockId = (id: string) => /^[0-9a-z]{2}000000-0000-4000-8000-\d{12}$/.test(id);

interface Draft {
  id: string;
  spotId: string;
  price: number;
  user: string;
  start: Date;
  end: Date;
  status: string;
  vehicle: boolean;
  forDriver: boolean;
  code?: string;
}

const registry = new Map<string, Draft>();

function bookingBody(d: Draft) {
  const hours = Math.max(1, Math.round((d.end.getTime() - d.start.getTime()) / 3600000));
  const ownerAmount = Math.round(d.price * hours * 100);
  // El conductor paga el precio del dueño más la comisión de ParkLink.
  const amount = Math.round(ownerAmount * (1 + commissionRate));
  return {
    id: d.id,
    parking_spot_id: d.spotId,
    user_id: d.user,
    start: iso(d.start),
    end: iso(d.end),
    status: d.status,
    amount,
    ...(d.forDriver ? {} : { owner_amount: ownerAmount }),
    payment_id: `mp-${hash(d.id)}`,
    paid_at: ago(DAY_MS),
    kind: 'HOURLY',
    ...(d.forDriver && d.code ? { verification_code: d.code } : {}),
    ...(d.status === 'COMPLETED' ? { verified_at: iso(d.start) } : {}),
    updated_at: ago(3600000),
    ...(d.vehicle ? { vehicle: CAR } : {}),
  };
}

const TODAY_SLOTS: [number, number][] = [[8, 10], [10, 11], [11, 13], [14, 16], [17, 18], [19, 21]];
const OTHER_DAY_SLOTS: [number, number][][] = [
  [[9, 11], [12, 14], [16, 19]],
  [[8, 12], [14, 16], [18, 20]],
  [[10, 13], [15, 17], [19, 22]],
];

/**
 * Reservas de ejemplo en una cochera del propietario: 12 días atrás (finalizadas), hoy y 10 días
 * adelante (confirmadas). Las de hoy son siempre "Confirmada": se muestran como lo que todavía
 * tiene que pasar en el día, nunca como finalizadas.
 */
function ownerBookingsFor(spotId: string): any[] {
  const price = spotCache.get(spotId)?.price ?? 5000;
  const key = hash(spotId) % 1000;
  const out: any[] = [];
  let n = 0;
  for (let day = -12; day <= 10; day++) {
    const slots = day === 0 ? TODAY_SLOTS.slice(0, profileOf(spotId).todaySlots) : OTHER_DAY_SLOTS[(key + Math.abs(day)) % 3];
    for (const [from, to] of slots) {
      n += 1;
      const id = uid('b2', key * 1000 + n);
      const draft: Draft = {
        id,
        spotId,
        price,
        user: DRIVERS[(key + n) % DRIVERS.length],
        start: at(day, from),
        end: at(day, to),
        status: day < 0 ? 'COMPLETED' : 'CONFIRMED',
        vehicle: n % 4 !== 0,
        forDriver: false,
      };
      registry.set(id, draft);
      out.push(bookingBody(draft));
    }
  }
  return out;
}

/** Historial de ejemplo del conductor: una reserva confirmada para mañana (con código) y tres ya hechas. */
function driverBookingsFor(userId: string): any[] {
  const all = [...spotCache.entries()];
  const others = all.filter(([, spot]) => spot.ownerId !== userId);
  const pool = others.length > 0 ? others : all;
  if (pool.length === 0) return [];
  const key = hash(userId) % 1000;
  const plan = [
    { day: 1, from: 9, to: 11, status: 'CONFIRMED', code: '4827' },
    { day: -2, from: 14, to: 18, status: 'COMPLETED' },
    { day: -6, from: 9, to: 13, status: 'COMPLETED' },
    { day: -10, from: 18, to: 21, status: 'COMPLETED' },
  ];
  return plan.map((p, i) => {
    const [spotId, spot] = pool[(key + i) % pool.length];
    const id = uid('b3', key * 10 + i);
    const draft: Draft = {
      id,
      spotId,
      price: spot.price,
      user: userId,
      start: at(p.day, p.from),
      end: at(p.day, p.to),
      status: p.status,
      vehicle: true,
      forDriver: true,
      code: p.code,
    };
    registry.set(id, draft);
    return bookingBody(draft);
  });
}

function mockNotifications(userId: string): any[] {
  const items: any[] = [];
  const first = [...spotCache.entries()].find(([, spot]) => spot.ownerId === userId);
  if (first) {
    const [spotId, spot] = first;
    const done = ownerBookingsFor(spotId).filter((b) => b.status === 'COMPLETED').pop();
    if (done) {
      items.push({
        id: uid('d2', hash(spotId) % 1000),
        kind: 'review_received',
        role: 'owner',
        title: 'Recibiste una reseña',
        body: '',
        data: {
          booking_id: done.id,
          parking_spot_id: spotId,
          spot_title: spot.title,
          start: done.start,
          end: done.end,
          amount: done.amount,
          rating: 5,
        },
        created_at: ago(5 * 3600000),
        read_at: null,
        resolved_at: null,
      });
    }
  }
  const upcoming = driverBookingsFor(userId)[0];
  if (upcoming) {
    items.push({
      id: uid('d3', hash(userId) % 1000),
      kind: 'driver_confirmed',
      role: 'driver',
      title: 'Reserva confirmada',
      body: '',
      data: {
        booking_id: upcoming.id,
        parking_spot_id: upcoming.parking_spot_id,
        spot_title: spotCache.get(upcoming.parking_spot_id)?.title ?? 'Cochera',
        start: upcoming.start,
        end: upcoming.end,
        amount: upcoming.amount,
      },
      created_at: ago(2 * 3600000),
      read_at: null,
      resolved_at: null,
    });
  }
  return items;
}

// ── Respuestas ───────────────────────────────────────────────────────────────

const jsonResponse = (body: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Lo que tiene un id inventado nunca existe en el backend: se resuelve acá. */
async function serveMockEntity(path: string, pathname: string, options: RequestInit, method: string) {
  const booking = pathname.match(/^\/bookings\/([^/]+)(\/.*)?$/);
  if (booking && isMockId(booking[1])) {
    const draft = registry.get(booking[1]);
    if (!booking[2] && method === 'GET') {
      // Nunca devolver otra reserva en su lugar: si no se generó todavía, es un 404 y listo.
      return draft ? jsonResponse(bookingBody(draft)) : jsonResponse({ error: 'Reserva de ejemplo no disponible' }, 404);
    }
    return fallbackFetch(path, options);
  }
  const person = pathname.match(/^\/users\/([^/]+)\/public-profile$/);
  if (person && isMockId(person[1])) return jsonResponse(profile(person[1]));
  const other = pathname.match(/^\/(?:settlements|payments\/refund-status)\/([^/]+)$/);
  if (other && isMockId(other[1])) return fallbackFetch(path, options);
  return null;
}

function enrich(pathname: string, query: URLSearchParams, data: any): any {
  const list = (fn: (row: any) => any) => (Array.isArray(data) ? data.map(fn) : data);
  if (/^\/parking-spots\/search$/.test(pathname) || /^\/parking-spots$/.test(pathname)) return list(enrichSpot);
  if (/^\/users\/[^/]+\/parking-spots$/.test(pathname) || /^\/favorites$/.test(pathname)) return list(enrichSpot);

  let m = pathname.match(/^\/parking-spots\/([^/]+)$/);
  if (m) return enrichSpot(data);
  m = pathname.match(/^\/parking-spots\/([^/]+)\/reviews$/);
  if (m) return overlayReviews(data, m[1], 'spot');
  m = pathname.match(/^\/users\/([^/]+)\/reviews$/);
  if (m) return overlayReviews(data, m[1], query.get('as') === 'driver' ? 'driver' : 'owner');
  m = pathname.match(/^\/parking-spots\/([^/]+)\/bookings\/detailed$/);
  if (m && Array.isArray(data)) return [...data, ...ownerBookingsFor(m[1])];
  m = pathname.match(/^\/users\/([^/]+)\/bookings\/history$/);
  if (m && Array.isArray(data)) {
    return [...data, ...driverBookingsFor(m[1])].sort((a, b) => String(b.start).localeCompare(String(a.start)));
  }
  if (/^\/notifications$/.test(pathname) && !query.get('before') && data && Array.isArray(data.items)) {
    const userId = useSessionStore.getState().user?.id;
    const extra = userId ? mockNotifications(userId) : [];
    // Los avisos reales también muestran el nombre de la cochera sin tildes ni caracteres rotos.
    const real = data.items.map((item: any) =>
      item?.data?.spot_title ? { ...item, data: { ...item.data, spot_title: cleanTitle(item.data.spot_title) } } : item,
    );
    const items = [...extra, ...real].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const unread = extra.filter((item) => !item.read_at).length;
    return { ...data, items, unread_count: (data.unread_count ?? 0) + unread };
  }
  if (/^\/users\/[^/]+\/settlements$/.test(pathname) && Array.isArray(data) && data.length === 0) return settlements();
  if (/^\/settings\/commission$/.test(pathname) && typeof data?.commission_rate_percent === 'number') {
    commissionRate = data.commission_rate_percent / 100;
  }
  return data;
}

/**
 * Envuelve cada llamada al backend cuando `mocksEnabled` está activo: primero lo real, después
 * lo inventado encima. Si el backend falla (sin red o error de servidor), responde el respaldo fijo.
 */
export async function withMocks(
  path: string,
  options: RequestInit,
  real: () => Promise<Response>,
): Promise<Response> {
  const [pathname, search = ''] = path.split('?');
  const method = (options.method ?? 'GET').toUpperCase();

  const served = await serveMockEntity(path, pathname, options, method);
  if (served) return served;

  let response: Response;
  try {
    response = await real();
  } catch {
    return fallbackFetch(path, options);
  }
  if (response.status >= 500) return fallbackFetch(path, options);
  if (!response.ok || method !== 'GET') return response;

  try {
    const data = await response.clone().json();
    const enriched = enrich(pathname, new URLSearchParams(search), data);
    return enriched === data ? response : jsonResponse(enriched, response.status);
  } catch {
    return response;
  }
}
