import { Image } from 'react-native';
import { withReadState } from './seen';

// Datos de ejemplo fijos (usuario "Facundo Luzzi", 6 cocheras, sus reservas, reseñas y plata,
// todo coherente entre pantallas y con fechas relativas a "hoy"). Se usan de respaldo cuando
// el backend no responde, y sus piezas (personas, comentarios, liquidaciones) las reutiliza la
// capa de src/mock/index.ts. No se activan solos: ver `mocksEnabled`.

export const uid = (kind: string, n: number) => `${kind}000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// ── Tiempo (hora de Buenos Aires) ────────────────────────────────────────────

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Un instante: `days` días desde hoy, a las `hour`:`minute` de Buenos Aires. */
export function at(days: number, hour: number, minute = 0): Date {
  const baNow = new Date(Date.now() - 3 * 3600 * 1000);
  return new Date(Date.UTC(baNow.getUTCFullYear(), baNow.getUTCMonth(), baNow.getUTCDate() + days, hour + 3, minute));
}

export function iso(date: Date): string {
  return new Date(date.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 19) + '-03:00';
}

const dateOnly = (date: Date) => iso(date).slice(0, 10);
export const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

// ── Personas ─────────────────────────────────────────────────────────────────

const ME = uid('01', 1);

const PEOPLE: Record<string, { first: string; last: string; email: string }> = {
  [ME]: { first: 'Facundo', last: 'Luzzi', email: 'facu.luzzi@gmail.com' },
  [uid('02', 1)]: { first: 'Mariana', last: 'Ferreyra', email: 'mariana.ferreyra@gmail.com' },
  [uid('02', 2)]: { first: 'Diego', last: 'Ledesma', email: 'diego.ledesma@gmail.com' },
  [uid('02', 3)]: { first: 'Carolina', last: 'Páez', email: 'caro.paez@gmail.com' },
  [uid('03', 1)]: { first: 'Camila', last: 'Torres', email: 'camila.torres@gmail.com' },
  [uid('03', 2)]: { first: 'Lucas', last: 'Fernández', email: 'lucas.fernandez@gmail.com' },
  [uid('03', 3)]: { first: 'Valentina', last: 'Acosta', email: 'vale.acosta@gmail.com' },
  [uid('03', 4)]: { first: 'Mateo', last: 'Sosa', email: 'mateo.sosa@gmail.com' },
  [uid('03', 5)]: { first: 'Julieta', last: 'Romero', email: 'juli.romero@gmail.com' },
  [uid('03', 6)]: { first: 'Nicolás', last: 'Benítez', email: 'nico.benitez@gmail.com' },
  [uid('03', 7)]: { first: 'Martina', last: 'Ríos', email: 'martina.rios@gmail.com' },
  [uid('03', 8)]: { first: 'Tomás', last: 'Aguirre', email: 'tomas.aguirre@gmail.com' },
  [uid('03', 9)]: { first: 'Agustina', last: 'Molina', email: 'agus.molina@gmail.com' },
  [uid('03', 10)]: { first: 'Bruno', last: 'Castro', email: 'bruno.castro@gmail.com' },
  [uid('03', 11)]: { first: 'Sofía', last: 'Domínguez', email: 'sofi.dominguez@gmail.com' },
  [uid('03', 12)]: { first: 'Joaquín', last: 'Herrera', email: 'joaquin.herrera@gmail.com' },
};

const MARIANA = uid('02', 1);
const DIEGO = uid('02', 2);
const CAROLINA = uid('02', 3);
export const DRIVERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => uid('03', n));

const mockUser = {
  id: ME,
  email: PEOPLE[ME].email,
  phone: '+54 9 11 5832 4410',
  first_name: PEOPLE[ME].first,
  last_name: PEOPLE[ME].last,
  dni: '40123456',
  avatar_url: null,
  email_verified: true,
  phone_verified: true,
  account_type: 'BOTH',
  status: 'ACTIVE',
  deletion_scheduled_at: null,
};

export const profile = (id: string) => {
  const p = PEOPLE[id] ?? { first: 'Usuario', last: 'ParkLink' };
  return { id, name: `${p.first} ${p.last}`, avatar_url: null, created_at: iso(at(-300, 10)) };
};

// ── Cocheras ─────────────────────────────────────────────────────────────────

// On the phone a bundled image is resolved to its URI; on the web there's no resolveAssetSource
// (react-native-web) and the import already is the URL (or carries it).
const photo = (module: number | string | { uri?: string }): string => {
  if (typeof Image.resolveAssetSource === 'function') return Image.resolveAssetSource(module as number)?.uri ?? '';
  if (typeof module === 'string') return module;
  return typeof module === 'object' && module ? module.uri ?? '' : '';
};
const PHOTO_RECONQUISTA = photo(require('../../assets/mock/cochera-reconquista.webp'));
const PHOTO_MOTO = photo(require('../../assets/mock/cochera-moto.webp'));
const PHOTO_CASA = photo(require('../../assets/mock/cochera-casa.webp'));
const PHOTO_PLAYA = photo(require('../../assets/mock/cochera-playa.webp'));

const SPOT_A = uid('a0', 1);
const SPOT_B = uid('a0', 2);
const SPOT_C = uid('a0', 3);
const SPOT_D = uid('a0', 4);
const SPOT_E = uid('a0', 5);
const SPOT_F = uid('a0', 6);

const WEEK = [0, 1, 2, 3, 4, 5, 6];
const scheduleOf = (startHour: number, endHour: number) =>
  WEEK.map((dayOfWeek) => ({ dayOfWeek, startHour, endHour }));

interface SpotSeed {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  price: number;
  covered: boolean;
  vehicleTypes: string[];
  capacity: number;
  photos: string[];
  rating: number;
  reviewCount: number;
  stay?: { day: number; week: number; month: number };
  hours: [number, number];
}

const SEEDS: SpotSeed[] = [
  {
    id: SPOT_A,
    ownerId: ME,
    title: 'Cochera cubierta en Microcentro',
    description:
      'Cochera cubierta con portón automático, a dos cuadras de Plaza de Mayo. Entra un auto mediano. Acceso las 24 hs.',
    address: 'Reconquista 450, Microcentro, CABA',
    lat: -34.6045,
    lng: -58.3736,
    price: 7500,
    covered: true,
    vehicleTypes: ['car'],
    capacity: 1,
    photos: [PHOTO_RECONQUISTA],
    rating: 4.8,
    reviewCount: 214,
    hours: [0, 24],
  },
  {
    id: SPOT_B,
    ownerId: ME,
    title: 'Cochera para moto en Microcentro',
    description: 'Lugar techado para moto en cochera de edificio, con vigilancia. Ideal para quienes trabajan en el centro.',
    address: 'Sarmiento 650, Microcentro, CABA',
    lat: -34.6036,
    lng: -58.3752,
    price: 3500,
    covered: true,
    vehicleTypes: ['motorcycle'],
    capacity: 1,
    photos: [PHOTO_MOTO],
    rating: 4.7,
    reviewCount: 96,
    hours: [6, 23],
  },
  {
    id: SPOT_C,
    ownerId: ME,
    title: 'Cochera con techo en Caballito',
    description: 'Cochera individual en casa particular, con techo y portón. A cinco cuadras del subte A.',
    address: 'Doblas 380, Caballito, CABA',
    lat: -34.6155,
    lng: -58.438,
    price: 5000,
    covered: true,
    vehicleTypes: ['car'],
    capacity: 1,
    photos: [PHOTO_CASA],
    rating: 4.9,
    reviewCount: 142,
    stay: { day: 24000, week: 120000, month: 320000 },
    hours: [6, 23],
  },
  {
    id: SPOT_D,
    ownerId: MARIANA,
    title: 'Playa subterránea Congreso',
    description: 'Playa subterránea con rampa, 10 lugares y cámaras de seguridad. A pasos del Congreso.',
    address: 'Av. Callao 290, Balvanera, CABA',
    lat: -34.609,
    lng: -58.3925,
    price: 6000,
    covered: true,
    vehicleTypes: ['car', 'suv', 'pickup'],
    capacity: 10,
    photos: [PHOTO_PLAYA],
    rating: 4.6,
    reviewCount: 387,
    stay: { day: 28000, week: 140000, month: 350000 },
    hours: [0, 24],
  },
  {
    id: SPOT_E,
    ownerId: DIEGO,
    title: 'Garage Paseo Colón',
    description: 'Garage cubierto a tres cuadras de la Facultad de Ingeniería. Portón con control remoto.',
    address: 'Paseo Colón 820, San Telmo, CABA',
    lat: -34.6178,
    lng: -58.3689,
    price: 7000,
    covered: true,
    vehicleTypes: ['car', 'suv'],
    capacity: 1,
    photos: [PHOTO_RECONQUISTA],
    rating: 4.7,
    reviewCount: 118,
    hours: [6, 23],
  },
  {
    id: SPOT_F,
    ownerId: CAROLINA,
    title: 'Cochera en San Telmo',
    description: 'Cochera techada en casa antigua, a una cuadra de Plaza Dorrego.',
    address: 'Defensa 1100, San Telmo, CABA',
    lat: -34.6205,
    lng: -58.3715,
    price: 5500,
    covered: true,
    vehicleTypes: ['car'],
    capacity: 1,
    photos: [PHOTO_CASA],
    rating: 4.5,
    reviewCount: 73,
    hours: [7, 22],
  },
];

function spotResponse(seed: SpotSeed, extra: Record<string, unknown> = {}) {
  return {
    id: seed.id,
    ownerId: seed.ownerId,
    title: seed.title,
    description: seed.description,
    address: seed.address,
    lat: seed.lat,
    lng: seed.lng,
    hourlyEnabled: true,
    pricePerHour: seed.price,
    pricePerHourByVehicleType: null,
    stayEnabled: !!seed.stay,
    pricePerDay: seed.stay?.day ?? null,
    pricePerWeek: seed.stay?.week ?? null,
    pricePerMonth: seed.stay?.month ?? null,
    stayAvailableFrom: null,
    stayAvailableUntil: null,
    maxStayDays: seed.stay ? 90 : null,
    stayPricesByVehicleType: null,
    requireVehicle: false,
    covered: seed.covered,
    vehicleTypes: seed.vehicleTypes,
    capacity: seed.capacity,
    schedule: scheduleOf(seed.hours[0], seed.hours[1]),
    photos: seed.photos,
    verificationPhotos: [],
    reviewNotes: null,
    suspendedByAdmin: false,
    blockedDates: [],
    moderationNote: null,
    rules: ['Respetar el lugar asignado', 'No dejar objetos de valor a la vista'],
    status: 'active',
    createdAt: iso(at(-200, 10)),
    updatedAt: iso(at(-3, 10)),
    rating: seed.rating,
    reviewCount: seed.reviewCount,
    ...extra,
  };
}

const MY_SPOTS = SEEDS.filter((s) => s.ownerId === ME);
const SEARCHABLE = [SPOT_A, SPOT_B, SPOT_C, SPOT_D];
const seedOf = (id: string) => SEEDS.find((s) => s.id === id);
const createdSpots: any[] = [];

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ── Reservas ─────────────────────────────────────────────────────────────────

export const CAR = { type: 'car', plate: 'AB 123 CD', brand: 'Toyota', model: 'Corolla', country: 'AR' };

interface BookingSeed {
  n: number;
  spot: string;
  user: string;
  start: Date;
  end: Date;
  status: string;
  code?: string;
  vehicle?: boolean;
}

function bookingResponse(b: BookingSeed, forDriver: boolean) {
  const seed = seedOf(b.spot)!;
  const hours = Math.round((b.end.getTime() - b.start.getTime()) / 3600000);
  const ownerAmount = seed.price * hours * 100;
  // El conductor paga el precio del dueño más la comisión de ParkLink (8%, solo al conductor).
  const amount = Math.round(ownerAmount * 1.08);
  const paid = !['PENDING_PAYMENT', 'EXPIRED'].includes(b.status);
  return {
    id: uid('b0', b.n),
    parking_spot_id: b.spot,
    user_id: b.user,
    start: iso(b.start),
    end: iso(b.end),
    status: b.status,
    amount,
    ...(forDriver ? {} : { owner_amount: ownerAmount }),
    ...(paid ? { payment_id: `mp-${100000 + b.n}`, paid_at: ago(DAY_MS) } : {}),
    ...(b.status === 'PENDING_OWNER_APPROVAL'
      ? { owner_response_deadline: iso(new Date(Date.now() + (2 + (b.n % 3) * 2) * 3600000)) }
      : {}),
    ...(b.status === 'CANCELLED' ? { cancellation_reason: 'DRIVER_CANCELLED', refunded_amount: amount } : {}),
    kind: 'HOURLY',
    ...(forDriver && b.code ? { verification_code: b.code } : {}),
    ...(b.status === 'COMPLETED' ? { verified_at: iso(b.start) } : {}),
    updated_at: ago(3600000),
    ...(b.vehicle ? { vehicle: CAR } : {}),
  };
}

// Lo que reservo yo como conductor (la próxima, confirmada, con su código de llegada).
const DRIVER_BOOKINGS: BookingSeed[] = [
  { n: 1, spot: SPOT_D, user: ME, start: at(1, 9), end: at(1, 11), status: 'CONFIRMED', code: '4827', vehicle: true },
  { n: 2, spot: SPOT_E, user: ME, start: at(-2, 14), end: at(-2, 18), status: 'COMPLETED', vehicle: true },
  { n: 3, spot: SPOT_D, user: ME, start: at(-6, 9), end: at(-6, 13), status: 'COMPLETED', vehicle: true },
  { n: 4, spot: SPOT_F, user: ME, start: at(-10, 18), end: at(-10, 21), status: 'COMPLETED', vehicle: true },
  { n: 5, spot: SPOT_E, user: ME, start: at(-14, 8), end: at(-14, 10), status: 'CANCELLED' },
];

// Lo que reservan otros en mis cocheras: llena "Hoy" y el calendario del propietario.
// Hoy es un día movido (varias reservas en cada cochera, según la hora: ya terminadas, en curso
// y por venir); los demás días tienen menos.
const MY_SPOT_IDS = [SPOT_A, SPOT_B, SPOT_C];

const TODAY_SLOTS: Record<string, [number, number][]> = {
  [SPOT_A]: [[8, 10], [10, 11], [11, 13], [14, 16], [17, 18], [19, 21]],
  [SPOT_B]: [[7, 10], [10, 13], [14, 17], [18, 21]],
  [SPOT_C]: [[8, 10], [10, 12], [13, 15], [16, 18]],
};

const OTHER_DAY_SLOTS: Record<string, [number, number][][]> = {
  [SPOT_A]: [[[9, 11], [12, 14], [16, 19]], [[8, 12], [14, 16], [18, 20]], [[10, 13], [15, 17], [19, 22]]],
  [SPOT_B]: [[[8, 12], [14, 18]], [[7, 11], [12, 16], [17, 21]], [[9, 13], [15, 19]]],
  [SPOT_C]: [[[8, 12], [14, 18]], [[9, 13]], [[8, 10], [11, 15], [16, 20]]],
};

function generatedOwnerBookings(): BookingSeed[] {
  const list: BookingSeed[] = [];
  let n = 100;
  for (let day = -12; day <= 10; day++) {
    for (const spot of MY_SPOT_IDS) {
      const slots = day === 0 ? TODAY_SLOTS[spot] : OTHER_DAY_SLOTS[spot][Math.abs(day) % 3];
      for (const [from, to] of slots) {
        n += 1;
        // Las de hoy todavia no empezaron: siempre confirmadas.
        const status = day < 0 ? 'COMPLETED' : 'CONFIRMED';
        list.push({
          n,
          spot,
          user: DRIVERS[n % DRIVERS.length],
          start: at(day, from),
          end: at(day, to),
          status,
          vehicle: spot !== SPOT_B,
        });
      }
    }
  }
  return list;
}

const OWNER_BOOKINGS: BookingSeed[] = generatedOwnerBookings();

const allBookings = (): any[] => [
  ...DRIVER_BOOKINGS.map((b) => bookingResponse(b, true)),
  ...OWNER_BOOKINGS.map((b) => bookingResponse(b, false)),
];

// ── Opiniones ────────────────────────────────────────────────────────────────

export const COMMENTS = [
  'Muy fácil de encontrar y el portón funcionó perfecto. Volvería a reservar.',
  'Lugar limpio y seguro. El dueño respondió rápido.',
  'Cómodo para ir al trabajo. Buen precio para la zona.',
  'Entré sin problemas, las indicaciones eran claras.',
  'Excelente atención, todo tal cual las fotos.',
  'Lo uso todas las semanas para ir a la facultad. Nunca tuve un problema.',
  'Estacioné cerca del evento y salí sin dar vueltas. Súper recomendable.',
  'Buena ubicación y entra bien aun con el auto grande.',
  'Acceso rápido y muy bien iluminado.',
  'Me avisaron antes de llegar, muy atentos.',
  'Precio justo comparado con las playas de la zona.',
  'Impecable. Ya lo tengo en favoritos.',
];
export const RATINGS = [5, 5, 4, 5, 5, 5, 4, 5, 5, 5, 4, 5];

export function reviewsOf(targetType: 'spot' | 'owner' | 'driver', targetId: string, average: number, count: number) {
  return {
    average_rating: average,
    count,
    reviews: DRIVERS.map((reviewer, i) => ({
      id: uid('c0', i + 1),
      booking_id: uid('b0', 101 + i),
      reviewer_id: reviewer,
      target_type: targetType,
      target_id: targetId,
      rating: RATINGS[i],
      comment: COMMENTS[i],
      created_at: ago((i + 1) * 1.5 * DAY_MS),
    })),
  };
}

// ── Notificaciones ───────────────────────────────────────────────────────────

function notificationsPage() {
  // La última reserva ya terminada en la cochera A (para el aviso de "calificá a tu conductor").
  const lastDone = [...OWNER_BOOKINGS].reverse().find((b) => b.spot === SPOT_A && b.status === 'COMPLETED')!;
  const spotData = (spot: string, b: BookingSeed) => ({
    booking_id: uid('b0', b.n),
    parking_spot_id: spot,
    spot_title: seedOf(spot)!.title,
    start: iso(b.start),
    end: iso(b.end),
    amount: seedOf(spot)!.price * 2 * 100,
  });
  const items = [
    {
      id: uid('d0', 2),
      kind: 'driver_confirmed',
      role: 'driver',
      title: 'Reserva confirmada',
      body: '',
      data: spotData(SPOT_D, DRIVER_BOOKINGS[0]),
      created_at: ago(2 * 3600000),
      read_at: null,
      resolved_at: null,
    },
    {
      id: uid('d0', 3),
      kind: 'owner_settlement_paid',
      role: 'owner',
      title: 'Te depositamos tu liquidación',
      body: '',
      data: { settlement_id: uid('e0', 1), net_amount: 59825000 },
      created_at: ago(4 * DAY_MS),
      read_at: ago(3 * DAY_MS),
      resolved_at: null,
    },
    {
      id: uid('d0', 4),
      kind: 'owner_review_prompt',
      role: 'owner',
      title: 'Calificá a tu conductor',
      body: '',
      data: { ...spotData(SPOT_A, lastDone), driver_user_id: lastDone.user },
      created_at: ago(DAY_MS),
      read_at: ago(DAY_MS / 2),
      resolved_at: null,
    },
    {
      id: uid('d0', 7),
      kind: 'review_received',
      role: 'owner',
      title: 'Recibiste una reseña',
      body: '',
      data: { ...spotData(SPOT_A, lastDone), rating: 5 },
      created_at: ago(5 * 3600000),
      read_at: null,
      resolved_at: null,
    },
  ];
  // The ones the user already read stay read (see seen.ts).
  const page = items.map(withReadState);
  return { items: page, unread_count: page.filter((i) => !i.read_at).length, next_before: null };
}

// ── Liquidaciones ────────────────────────────────────────────────────────────

export function settlements() {
  const mk = (n: number, monthsAgo: number, netPesos: number, status: 'PAID' | 'PENDING') => ({
    id: uid('e0', n),
    owner_id: ME,
    gross_amount: Math.round((netPesos * 100) / 0.95),
    commission_amount: Math.round((netPesos * 100) / 0.95) - netPesos * 100,
    net_amount: netPesos * 100,
    status,
    proof_url: null,
    paid_at: status === 'PAID' ? ago((monthsAgo * 30 - 1) * DAY_MS) : null,
    paid_by_admin_id: status === 'PAID' ? uid('f0', 1) : null,
    created_by_admin_id: uid('f0', 1),
    created_at: ago(monthsAgo * 30 * DAY_MS),
  });
  return [
    mk(1, 1, 598250, 'PAID'),
    mk(2, 2, 531400, 'PAID'),
    mk(3, 3, 412800, 'PAID'),
  ];
}

// ── Router ───────────────────────────────────────────────────────────────────

interface Ctx {
  query: URLSearchParams;
  body: any;
}
type Handler = (match: RegExpMatchArray, ctx: Ctx) => unknown;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const findSpot = (id: string) => {
  const seed = seedOf(id);
  if (seed) return spotResponse(seed);
  return createdSpots.find((s) => s.id === id) ?? spotResponse(SEEDS[0]);
};

function availability(id: string, from: string, to: string) {
  const seed = seedOf(id) ?? SEEDS[0];
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  const days: unknown[] = [];
  for (let d = start; d < end; d = new Date(d.getTime() + DAY_MS)) {
    const date = d.toISOString().slice(0, 10);
    const open = new Date(`${date}T00:00:00-03:00`).getTime() + seed.hours[0] * 3600000;
    const close = new Date(`${date}T00:00:00-03:00`).getTime() + seed.hours[1] * 3600000;
    days.push({
      date,
      status: 'available',
      free_windows: [{ start: iso(new Date(open)), end: iso(new Date(close)) }],
    });
  }
  return { days };
}

const ROUTES: [string, RegExp, Handler][] = [
  // Sesión y usuarios
  ['GET', /^\/users\/([^/]+)$/, (m) => (m[1] === ME ? mockUser : { ...mockUser, id: m[1] })],
  ['GET', /^\/users\/([^/]+)\/public-profile$/, (m) => profile(m[1])],
  ['GET', /^\/users\/[^/]+\/vehicles$/, () => [
    { id: uid('v0', 1), type: 'car', plate: 'AB 123 CD', brand: 'Toyota', model: 'Corolla', country: 'AR', created_at: iso(at(-120, 10)) },
    { id: uid('v0', 2), type: 'motorcycle', plate: '123 ABC', brand: 'Honda', model: 'Wave 110', country: 'AR', created_at: iso(at(-90, 10)) },
  ]],
  ['GET', /^\/users\/[^/]+\/payout-info$/, () => ({
    cbu: '0170099220000067890123', payout_titular: 'Facundo Luzzi', cuil: '20-40123456-7', has_payout_info: true,
  })],
  ['PUT', /^\/users\/[^/]+\/payout-info$/, (_m, c) => ({ cbu: c.body.cbu, payout_titular: c.body.payout_titular, cuil: c.body.cuil, has_payout_info: true })],
  ['GET', /^\/users\/[^/]+\/tickets$/, () => []],
  ['GET', /^\/users\/([^/]+)\/reviews$/, (m, c) => {
    const asRole = c.query.get('as') === 'driver' ? 'driver' : 'owner';
    return reviewsOf(asRole, m[1], 4.8, 312);
  }],

  // Cocheras
  ['GET', /^\/parking-spots\/search$/, (_m, c) => {
    const lat = Number(c.query.get('lat'));
    const lng = Number(c.query.get('lng'));
    const rows = SEARCHABLE.map((id) => {
      const seed = seedOf(id)!;
      return spotResponse(seed, { distanceMeters: distanceMeters(lat, lng, seed.lat, seed.lng) });
    });
    const sort = c.query.get('sort');
    if (sort === 'price') rows.sort((a, b) => (a.pricePerHour ?? 0) - (b.pricePerHour ?? 0));
    else if (sort === 'rating') rows.sort((a, b) => b.rating - a.rating);
    else rows.sort((a: any, b: any) => a.distanceMeters - b.distanceMeters);
    return rows;
  }],
  ['GET', /^\/parking-spots$/, (_m, c) =>
    (c.query.get('ids') ?? '').split(',').filter(Boolean).map((id) => findSpot(id))],
  ['GET', /^\/users\/[^/]+\/parking-spots$/, () => [...MY_SPOTS.map((s) => spotResponse(s)), ...createdSpots]],
  ['POST', /^\/parking-spots$/, (_m, c) => {
    const created = {
      ...spotResponse(SEEDS[0]),
      ...c.body,
      id: uid('a1', createdSpots.length + 1),
      ownerId: ME,
      photos: [],
      status: 'pending_review',
    };
    createdSpots.push(created);
    return created;
  }],
  ['GET', /^\/parking-spots\/([^/]+)$/, (m) => findSpot(m[1])],
  ['PUT', /^\/parking-spots\/([^/]+)$/, (m, c) => ({ ...findSpot(m[1]), ...c.body })],
  ['PATCH', /^\/parking-spots\/([^/]+)\/status$/, (m, c) => ({ ...findSpot(m[1]), status: c.body.status })],
  ['DELETE', /^\/parking-spots\/[^/]+$/, () => undefined],
  ['GET', /^\/parking-spots\/([^/]+)\/availability$/, (m, c) => availability(m[1], c.query.get('from')!, c.query.get('to')!)],
  ['GET', /^\/parking-spots\/([^/]+)\/reviews$/, (m) => {
    const seed = seedOf(m[1]) ?? SEEDS[0];
    return reviewsOf('spot', seed.id, seed.rating, seed.reviewCount);
  }],
  ['GET', /^\/parking-spots\/([^/]+)\/bookings\/detailed$/, (m) =>
    OWNER_BOOKINGS.filter((b) => b.spot === m[1]).map((b) => bookingResponse(b, false))],
  ['GET', /^\/parking-spots\/[^/]+\/access$/, () => ({ accessInstructions: 'Tocá el timbre de la cochera y te abrimos. Llegado el horario, el portón queda habilitado.' })],
  ['GET', /^\/parking-spots\/[^/]+\/stays\/availability$/, (_m, c) => {
    const from = new Date(`${c.query.get('from')}T12:00:00Z`);
    const to = new Date(`${c.query.get('to')}T12:00:00Z`);
    const days: unknown[] = [];
    for (let d = from; d < to; d = new Date(d.getTime() + DAY_MS)) {
      days.push({ date: d.toISOString().slice(0, 10), status: 'available' });
    }
    return { days };
  }],
  ['GET', /^\/parking-spots\/([^/]+)\/stays\/quote$/, (m, c) => {
    const seed = seedOf(m[1]) ?? SEEDS[2];
    const startDate = c.query.get('startDate')!;
    const endDate = c.query.get('endDate')!;
    const startHour = Number(c.query.get('startHour') ?? 9);
    const totalDays = Math.max(1, Math.round((Date.parse(endDate) - Date.parse(startDate)) / DAY_MS));
    const weeks = Math.floor(totalDays / 7);
    const days = totalDays % 7;
    const rates = seed.stay ?? { day: seed.price * 8, week: seed.price * 40, month: seed.price * 140 };
    const hh = String(startHour).padStart(2, '0');
    return {
      startDate,
      endDate,
      startDateTime: `${startDate}T${hh}:00:00-03:00`,
      endDateTime: `${endDate}T${hh}:00:00-03:00`,
      totalDays,
      breakdown: { months: 0, weeks, days },
      amount: (weeks * rates.week + days * rates.day) * 100,
    };
  }],
  ['POST', /^\/parking-spots\/([^/]+)\/(photos|verification-photos)$/, (m) => findSpot(m[1])],

  // Favoritas
  ['GET', /^\/favorites\/ids$/, () => [SPOT_C, SPOT_D]],
  ['GET', /^\/favorites$/, () => [SPOT_C, SPOT_D].map((id) => findSpot(id))],
  ['POST', /^\/favorites$/, () => undefined],
  ['DELETE', /^\/favorites\/[^/]+$/, () => undefined],

  // Reservas y pagos
  ['GET', /^\/users\/[^/]+\/bookings\/history$/, () => DRIVER_BOOKINGS.map((b) => bookingResponse(b, true))],
  ['GET', /^\/debts$/, () => ({ pending_amount: 0, debts: [] })],
  ['GET', /^\/settings\/commission$/, () => ({ commission_rate_bp: 800, commission_rate_percent: 8 })],
  ['GET', /^\/payments\/refund-status\/[^/]+$/, () => ({ status: 'none' })],
  ['POST', /^\/bookings$/, (_m, c) => ({
    id: uid('b0', 90),
    parking_spot_id: c.body.parking_spot?.id ?? SPOT_D,
    user_id: ME,
    start: c.body.start,
    end: c.body.end,
    status: 'PENDING_PAYMENT',
    hold_expires_at: new Date(Date.now() + 5 * 60000).toISOString(),
    amount: c.body.amount,
    kind: c.body.kind ?? 'HOURLY',
    updated_at: new Date().toISOString(),
  })],
  ['POST', /^\/payments\/create-preference$/, (_m, c) => ({
    preferenceId: 'mock-preference',
    checkoutUrl: 'https://www.mercadopago.com.ar/',
    externalReference: c.body.externalReference,
  })],
  ['GET', /^\/bookings\/([^/]+)$/, (m) => allBookings().find((b) => b.id === m[1]) ?? allBookings()[0]],
  ['POST', /^\/bookings\/([^/]+)\/(approve|reject|cancel|owner-cancel)$/, (m) => {
    const found = allBookings().find((b) => b.id === m[1]) ?? allBookings()[0];
    return { ...found, status: m[2] === 'approve' ? 'CONFIRMED' : 'CANCELLED' };
  }],
  ['GET', /^\/bookings\/[^/]+\/access$/, () => ({ access_instructions: 'Tocá el timbre de la cochera y te abrimos.' })],
  ['GET', /^\/bookings\/[^/]+\/extension-options$/, () => []],
  ['GET', /^\/bookings\/([^/]+)\/messages$/, (m) => [
    { id: uid('m0', 1), booking_id: m[1], sender_id: ME, body: '¡Hola! Llego a las 9, ¿hay lugar cerca de la salida?', created_at: ago(3 * 3600000) },
    { id: uid('m0', 2), booking_id: m[1], sender_id: MARIANA, body: '¡Hola Facundo! Sí, te dejo el lugar 7, justo al lado de la salida.', created_at: ago(2 * 3600000) },
  ]],
  ['GET', /^\/bookings\/[^/]+\/reviews$/, () => []],
  ['GET', /^\/bookings\/[^/]+\/tickets$/, () => []],
  ['GET', /^\/bookings\/[^/]+\/exit$/, () => ({ awaiting: true, overstay_minutes: 0, charged_minutes: 0 })],

  // Liquidaciones y notificaciones
  ['GET', /^\/users\/[^/]+\/settlements$/, () => settlements()],
  ['GET', /^\/settlements\/([^/]+)$/, (m) => {
    const found = settlements().find((s) => s.id === m[1]) ?? settlements()[0];
    return {
      ...found,
      payouts: OWNER_BOOKINGS.filter((b) => b.status === 'COMPLETED').slice(0, 5).map((b, i) => {
        const gross = seedOf(b.spot)!.price * 2 * 100;
        return { id: uid('g0', i + 1), booking_id: uid('b0', b.n), gross_amount: gross, commission_amount: 0, net_amount: gross, kind: 'BOOKING' };
      }),
    };
  }],
  ['GET', /^\/notifications$/, () => notificationsPage()],
  ['POST', /^\/notifications\/read$/, () => ({ unread_count: 0 })],
  ['POST', /^\/notifications\/tokens$/, () => undefined],
  ['DELETE', /^\/notifications\/tokens\/.+$/, () => undefined],

  // Direcciones (autocompletar al publicar una cochera)
  ['GET', /^\/geocode$/, (_m, c) => {
    const q = (c.query.get('q') ?? '').trim() || 'Reconquista 450';
    return [
      { lat: -34.6045, lng: -58.3736, displayName: `${q}, Microcentro, Ciudad Autónoma de Buenos Aires`, city: 'Buenos Aires', postcode: 'C1003' },
      { lat: -34.6155, lng: -58.438, displayName: `${q}, Caballito, Ciudad Autónoma de Buenos Aires`, city: 'Buenos Aires', postcode: 'C1424' },
    ];
  }],
  ['GET', /^\/geocode\/reverse$/, (_m, c) => ({
    lat: Number(c.query.get('lat')),
    lng: Number(c.query.get('lng')),
    displayName: 'Reconquista 450, Microcentro, Ciudad Autónoma de Buenos Aires',
  })],
];

export async function fallbackFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const [pathname, search = ''] = path.split('?');
  const method = (options.method ?? 'GET').toUpperCase();
  let body: any = {};
  try {
    body = typeof options.body === 'string' ? JSON.parse(options.body) : {};
  } catch {
    body = {};
  }
  for (const [routeMethod, pattern, handler] of ROUTES) {
    if (routeMethod !== method) continue;
    const match = pathname.match(pattern);
    if (!match) continue;
    const result = handler(match, { query: new URLSearchParams(search), body });
    return result === undefined ? jsonResponse(null, 204) : jsonResponse(result);
  }
  console.warn(`[mock] sin respuesta para ${method} ${pathname}`);
  return jsonResponse({ error: `mock: sin respuesta para ${method} ${pathname}` }, 404);
}
