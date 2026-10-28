jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native/Libraries/Image/resolveAssetSource', () => () => ({ uri: 'mock://photo' }));
jest.mock('../../../assets/mock/cochera-reconquista.webp', () => 1, { virtual: true });
jest.mock('../../../assets/mock/cochera-moto.webp', () => 1, { virtual: true });
jest.mock('../../../assets/mock/cochera-casa.webp', () => 1, { virtual: true });
jest.mock('../../../assets/mock/cochera-playa.webp', () => 1, { virtual: true });
jest.mock('@/src/store/useSessionStore', () => ({
  useSessionStore: { getState: () => ({ user: { id: 'owner-1' } }) },
}));

import { cleanTitle, withMocks } from '../index';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const spot = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  ownerId: 'owner-1',
  title: `Cochera ${id}`,
  description: null,
  pricePerHour: 6000,
  rating: 0,
  reviewCount: 0,
  ...extra,
});

async function get(path: string, body: unknown) {
  const response = await withMocks(path, {}, async () => json(body));
  return response.json();
}

const todayPrefix = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

describe('src/mock overlay', () => {
  it('le pone puntaje, cantidad de reseñas y descripción a una cochera sin reseñas', async () => {
    const [result] = await get('/parking-spots/search?lat=1&lng=1', [spot('abc')]);
    expect(result.reviewCount).toBeGreaterThanOrEqual(35);
    expect(result.rating).toBeGreaterThanOrEqual(4.4);
    expect(result.rating).toBeLessThanOrEqual(5);
    expect(result.description.length).toBeGreaterThan(10);
  });

  it('muestra siempre lo mismo para la misma cochera', async () => {
    const [first] = await get('/parking-spots/search', [spot('abc')]);
    const [second] = await get('/parking-spots/search', [spot('abc')]);
    expect(second.rating).toBe(first.rating);
    expect(second.reviewCount).toBe(first.reviewCount);
  });

  it('no pisa una cochera con reseñas reales ni su descripción', async () => {
    const [result] = await get('/parking-spots/search', [
      spot('real', { rating: 3.9, reviewCount: 12, description: 'Cochera techada en Palermo con portón.' }),
    ]);
    expect(result.rating).toBe(3.9);
    expect(result.reviewCount).toBe(12);
    expect(result.description).toBe('Cochera techada en Palermo con portón.');
  });

  it('muestra el nombre de la cochera sin tildes ni caracteres rotos', async () => {
    expect(cleanTitle('Cochera Integraci�n Final')).toBe('Cochera Integracion Final');
    expect(cleanTitle('Playa Subterránea Congreso')).toBe('Playa Subterranea Congreso');
    const [result] = await get('/users/owner-1/parking-spots', [spot('t', { title: 'Cochera Integraci�n Final' })]);
    expect(result.title).toBe('Cochera Integracion Final');
  });

  it('completa las reseñas de una cochera sin reseñas y deja primero las reales', async () => {
    const real = { id: 'r1', rating: 5, comment: 'real' };
    const result = await get('/parking-spots/abc/reviews', { average_rating: 5, count: 1, reviews: [real] });
    expect(result.count).toBeGreaterThan(30);
    expect(result.reviews.length).toBeGreaterThan(5);
    expect(result.reviews[0]).toEqual(real);
  });

  it('suma varias reservas de hoy a las cocheras del propietario, todas confirmadas', async () => {
    await get('/users/owner-1/parking-spots', [spot('abc')]);
    const bookings = await get('/parking-spots/abc/bookings/detailed', []);
    const today = bookings.filter((b: any) => b.start.startsWith(todayPrefix()));
    expect(today.length).toBeGreaterThanOrEqual(3);
    expect(today.every((b: any) => b.status === 'CONFIRMED')).toBe(true);
    expect(bookings.every((b: any) => typeof b.owner_amount === 'number')).toBe(true);
  });

  it('no inventa solicitudes pendientes de aprobación ni avisos de solicitudes', async () => {
    await get('/users/owner-1/parking-spots', [spot('abc')]);
    const bookings = await get('/parking-spots/abc/bookings/detailed', []);
    expect(bookings.some((b: any) => b.status === 'PENDING_OWNER_APPROVAL')).toBe(false);
    const inbox = await get('/notifications', { items: [], unread_count: 0, next_before: null });
    expect(inbox.items.some((i: any) => i.kind === 'owner_request')).toBe(false);
  });

  it('solo las reservas de días anteriores figuran como finalizadas', async () => {
    await get('/users/owner-1/parking-spots', [spot('abc')]);
    const bookings = await get('/parking-spots/abc/bookings/detailed', []);
    const finished = bookings.filter((b: any) => b.status === 'COMPLETED');
    expect(finished.length).toBeGreaterThan(0);
    expect(finished.every((b: any) => b.start.slice(0, 10) < todayPrefix())).toBe(true);
  });

  it('inventa el perfil de los conductores de ejemplo y deja pasar a los reales', async () => {
    const bookings = await get('/parking-spots/abc/bookings/detailed', []);
    const profile = await (await withMocks(`/users/${bookings[0].user_id}/public-profile`, {}, async () => json({}))).json();
    expect(profile.name).toMatch(/\w+ \w+/);

    const realProfile = await get('/users/9f1c2b3a-1111-4222-8333-444455556666/public-profile', { id: 'x', name: 'Persona Real' });
    expect(realProfile.name).toBe('Persona Real');
  });

  it('responde con el respaldo si el backend no contesta', async () => {
    const down = await withMocks('/favorites/ids', {}, async () => {
      throw new Error('Network request failed');
    });
    expect(down.ok).toBe(true);
    expect(Array.isArray(await down.json())).toBe(true);

    const broken = await withMocks('/debts', {}, async () => json({ error: 'boom' }, 500));
    expect(broken.ok).toBe(true);
  });

  it('el respaldo tampoco trae solicitudes pendientes ni reservas de hoy finalizadas', async () => {
    const response = await withMocks('/parking-spots/a0000000-0000-4000-8000-000000000001/bookings/detailed', {}, async () => {
      throw new Error('Network request failed');
    });
    const bookings = await response.json();
    expect(bookings.some((b: any) => b.status === 'PENDING_OWNER_APPROVAL')).toBe(false);
    const today = bookings.filter((b: any) => b.start.startsWith(todayPrefix()));
    expect(today.length).toBeGreaterThan(0);
    expect(today.every((b: any) => b.status === 'CONFIRMED')).toBe(true);
  });

  it('deja pasar intacto el flujo real de reservar y pagar (crear reserva, preferencia de pago, reserva real)', async () => {
    const realId = '9f1c2b3a-1111-4222-8333-444455556666';
    const create = jest.fn(async () => json({ id: realId, status: 'PENDING_PAYMENT', amount: 540000 }, 201));
    const created = await withMocks('/bookings', { method: 'POST', body: '{}' }, create);
    expect(create).toHaveBeenCalledTimes(1);
    expect(created.status).toBe(201);
    expect((await created.json()).id).toBe(realId);

    const pay = jest.fn(async () => json({ preferenceId: 'p', checkoutUrl: 'https://mp', externalReference: realId }));
    const preference = await withMocks('/payments/create-preference', { method: 'POST', body: '{}' }, pay);
    expect(pay).toHaveBeenCalledTimes(1);
    expect((await preference.json()).externalReference).toBe(realId);

    const detail = jest.fn(async () => json({ id: realId, status: 'CONFIRMED', amount: 540000 }));
    const booking = await withMocks(`/bookings/${realId}`, {}, detail);
    expect(detail).toHaveBeenCalledTimes(1);
    expect(await booking.json()).toEqual({ id: realId, status: 'CONFIRMED', amount: 540000 });
  });

  it('las reservas reales siguen primero en el historial y las de ejemplo se suman sin mezclarse con ellas', async () => {
    await get('/parking-spots/search', [spot('abc', { ownerId: 'otro' })]);
    const realBooking = { id: '9f1c2b3a-1111-4222-8333-444455556666', start: '2099-01-01T10:00:00-03:00', status: 'CONFIRMED' };
    const history = await get('/users/driver-1/bookings/history', [realBooking]);
    expect(history.find((b: any) => b.id === realBooking.id)).toEqual(realBooking);
    expect(history.length).toBeGreaterThan(1);
    expect(history.filter((b: any) => b.id !== realBooking.id).every((b: any) => /^[0-9a-z]{2}000000-/.test(b.id))).toBe(true);
  });

  it('con sort=upcoming, las activas que no terminaron van primero, la más próxima arriba', async () => {
    await get('/parking-spots/search', [spot('abc', { ownerId: 'otro' })]);
    const hours = (n: number) => new Date(Date.now() + n * 3600 * 1000).toISOString();
    const real = [
      { id: 'pasada', start: hours(-30), end: hours(-28), status: 'COMPLETED' },
      { id: 'manana', start: hours(24), end: hours(26), status: 'CONFIRMED' },
      { id: 'cancelada', start: hours(3), end: hours(5), status: 'CANCELLED' },
      { id: 'en-una-hora', start: hours(1), end: hours(3), status: 'CONFIRMED' },
    ];
    const history = await get('/users/driver-1/bookings/history?sort=upcoming', real);
    const ids = history.map((b: any) => b.id).filter((id: string) => real.some((r) => r.id === id));
    expect(ids).toEqual(['en-una-hora', 'manana', 'cancelada', 'pasada']);
  });

  it('con status=..., las reservas de ejemplo que se suman son solo de ese estado', async () => {
    await get('/parking-spots/search', [spot('abc', { ownerId: 'otro' })]);
    const all = await get('/users/driver-1/bookings/history', []);
    const target = all[0].status;
    const filtered = await get(`/users/driver-1/bookings/history?status=${target}`, []);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((b: any) => b.status === target)).toBe(true);
  });

  it('una reserva de ejemplo que no existe da 404 y no devuelve otra en su lugar', async () => {
    const missing = await withMocks('/bookings/b2000000-0000-4000-8000-999999999999', {}, async () => json({}));
    expect(missing.status).toBe(404);
  });

  it('no toca los errores del cliente (4xx) ni los pedidos que no son GET', async () => {
    const notFound = await withMocks('/parking-spots/zzz', {}, async () => json({ message: 'no existe' }, 404));
    expect(notFound.status).toBe(404);

    const created = await withMocks('/parking-spots', { method: 'POST' }, async () => json(spot('nueva'), 201));
    expect((await created.json()).rating).toBe(0);
  });
});
