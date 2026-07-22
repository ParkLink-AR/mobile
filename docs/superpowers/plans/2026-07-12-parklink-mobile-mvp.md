# ParkLink Mobile MVP (Mockeado) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable Expo/React Native app (TypeScript, Expo Router) that lets a user navigate the entire ParkLink flow — conductor and propietario — using mocked data, with zero real network calls.

**Architecture:** Expo managed workflow. File-based routing via Expo Router, split into a pre-auth stack and two role-scoped stacks-with-tabs `(driver)` and `(owner)`. A single Zustand store holds the active mock session (user + role). A `src/services/` layer exposes async functions shaped exactly like the real backend endpoints already designed (see `docs/superpowers/specs/2026-07-12-parklink-mobile-design.md`), backed by hardcoded fixtures in `src/mocks/` with an artificial delay — swapping to real HTTP later means only rewriting the inside of these functions.

**Tech Stack:** Expo (managed) + TypeScript, Expo Router, Zustand, Jest for the service/store layer.

## Global Constraints

- No real network calls anywhere — every `src/services/*` function reads from `src/mocks/*` with a simulated delay.
- Palette: Deep Navy `#042347` (headers, tab bar active state, primary text), Modern Teal `#168B8D` (CTAs, interactive accents), White `#FFFFFF` (backgrounds), semantic green `#16A34A` / amber `#D97706` for status badges (not part of the official brand guide, added for functional necessity).
- TypeScript strict mode on.
- Package manager: npm.
- Every screen task's manual verification step must be run with the app already up via `npx expo start` (or a running simulator) — don't skip it because "it's just UI".
- Follow the types defined in Task 3 exactly in every later task — don't redefine equivalent shapes.

---

## File Structure

```
mobile/
  app/
    _layout.tsx
    index.tsx
    mode-select.tsx
    (auth)/
      _layout.tsx
      login.tsx
      register.tsx
      forgot-password.tsx
    (driver)/
      _layout.tsx
      profile-edit.tsx
      (tabs)/
        _layout.tsx
        index.tsx
        bookings.tsx
        profile.tsx
      spot/[id].tsx
      booking/confirm.tsx
      booking/success.tsx
      bookings/[id].tsx
      review/[bookingId].tsx
    (owner)/
      _layout.tsx
      profile-edit.tsx
      (tabs)/
        _layout.tsx
        index.tsx
        spots.tsx
        bookings.tsx
        profile.tsx
      spots/new.tsx
      spots/[id]/edit.tsx
      spots/[id]/availability.tsx
      settlements/index.tsx
      settlements/[id].tsx
      review/[bookingId].tsx
  src/
    theme/
      colors.ts
      typography.ts
    types/
      index.ts
    mocks/
      users.ts
      parkingSpots.ts
      bookings.ts
      settlements.ts
      reviews.ts
    services/
      utils.ts
      authService.ts
      parkingService.ts
      bookingService.ts
      paymentService.ts
      __tests__/
        parkingService.test.ts
        bookingService.test.ts
    store/
      useSessionStore.ts
      __tests__/
        useSessionStore.test.ts
    components/
      Button.tsx
      Chip.tsx
      Card.tsx
      StatusBadge.tsx
      RatingStars.tsx
```

---

### Task 1: Scaffold the Expo project

**Files:**
- Create: entire `mobile/` Expo project (via CLI, not hand-written)
- Modify: `mobile/tsconfig.json` (verify `@/*` path alias)

**Interfaces:**
- Produces: a working `npx expo start` command any later task can run to verify its screen.

- [ ] **Step 1: Generate the project**

Run from the parent of the existing empty `~/mobile` git repo (the CLI needs to create the folder itself, so generate into a temp name and merge):

```bash
cd ~
npx create-expo-app@latest parklink-mobile-tmp --template blank-typescript
```

- [ ] **Step 2: Merge the generated project into the existing `~/mobile` repo**

```bash
cd ~
rsync -a --exclude='.git' parklink-mobile-tmp/ mobile/
rm -rf parklink-mobile-tmp
cd ~/mobile
ls
```

Expected: `app.json`, `package.json`, `tsconfig.json`, `App.tsx` or `app/` present alongside the already-committed `docs/` folder.

- [ ] **Step 3: Add Expo Router and Zustand**

```bash
cd ~/mobile
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
npm install zustand
```

- [ ] **Step 4: Point the app entry at Expo Router**

Open `package.json`, set:

```json
{
  "main": "expo-router/entry"
}
```

- [ ] **Step 5: Delete the default `App.tsx`** (Expo Router replaces it with `app/_layout.tsx`, added in Task 8)

```bash
rm -f ~/mobile/App.tsx
```

- [ ] **Step 6: Verify `tsconfig.json` has the `@/*` alias**

Open `~/mobile/tsconfig.json`. It must contain:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

If `paths` is missing, add it.

- [ ] **Step 7: Verify the app boots (empty state is fine for now)**

```bash
cd ~/mobile
npx expo start
```

Expected: Metro bundler starts without errors (there's no `app/index.tsx` yet, so it'll show a "missing default export" screen in the simulator — that's expected at this point, not a failure). Stop it with `Ctrl+C`.

- [ ] **Step 8: Commit**

```bash
cd ~/mobile
git add -A
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "Scaffold Expo + TypeScript + Expo Router project"
```

---

### Task 2: Theme (colors, typography)

**Files:**
- Create: `src/theme/colors.ts`
- Create: `src/theme/typography.ts`

**Interfaces:**
- Produces: `colors.deepNavy`, `colors.teal`, `colors.white`, `colors.success`, `colors.warning`, `colors.textSecondary`, `colors.border`, `colors.background`; `typography.h1`, `typography.h2`, `typography.body`, `typography.caption` (each a `TextStyle` object).

- [ ] **Step 1: Write `src/theme/colors.ts`**

```typescript
export const colors = {
  deepNavy: '#042347',
  teal: '#168B8D',
  white: '#FFFFFF',
  success: '#16A34A',
  warning: '#D97706',
  background: '#F5F7FA',
  border: '#E2E8F0',
  textSecondary: '#64748B',
};
```

- [ ] **Step 2: Write `src/theme/typography.ts`**

```typescript
import { TextStyle } from 'react-native';
import { colors } from './colors';

export const typography: Record<'h1' | 'h2' | 'body' | 'caption', TextStyle> = {
  h1: { fontSize: 22, fontWeight: '700', color: colors.deepNavy },
  h2: { fontSize: 17, fontWeight: '600', color: colors.deepNavy },
  body: { fontSize: 15, fontWeight: '400', color: colors.deepNavy },
  caption: { fontSize: 13, fontWeight: '400', color: colors.textSecondary },
};
```

- [ ] **Step 3: Commit**

```bash
cd ~/mobile
git add src/theme
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "Add theme: colors and typography"
```

---

### Task 3: Shared types

**Files:**
- Create: `src/types/index.ts`

**Interfaces:**
- Produces: `UserRole`, `User`, `ParkingSpot`, `BookingStatus`, `Booking`, `Review`, `Settlement` — every later task imports from `@/src/types`.

- [ ] **Step 1: Write `src/types/index.ts`**

```typescript
export type UserRole = 'driver' | 'owner';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarInitials: string;
}

export interface ParkingSpot {
  id: string;
  ownerId: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  pricePerHour: number;
  photoUrl: string;
  covered: boolean;
  rating: number;
  reviewCount: number;
  tags: string[];
  schedule: string;
  description: string;
  active: boolean;
}

export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface Booking {
  id: string;
  parkingSpotId: string;
  parkingSpotTitle: string;
  driverId: string;
  driverName: string;
  ownerId: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  subtotal: number;
  serviceCharge: number;
  total: number;
  status: BookingStatus;
}

export interface Review {
  id: string;
  bookingId: string;
  fromUserId: string;
  toUserId: string;
  stars: number;
  comment: string;
}

export interface Settlement {
  id: string;
  ownerId: string;
  period: string;
  totalAmount: number;
  commissionRetained: number;
  bookingIds: string[];
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/mobile
git add src/types
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "Add shared TypeScript types"
```

---

### Task 4: Mock fixtures

**Files:**
- Create: `src/mocks/users.ts`
- Create: `src/mocks/parkingSpots.ts`
- Create: `src/mocks/bookings.ts`
- Create: `src/mocks/settlements.ts`
- Create: `src/mocks/reviews.ts`

**Interfaces:**
- Consumes: types from `@/src/types` (Task 3).
- Produces: `mockDriver`, `mockOwner`, `mockParkingSpots: ParkingSpot[]`, `mockBookingsForDriver: Booking[]`, `mockBookingsForOwner: Booking[]`, `mockSettlements: Settlement[]`, `mockReviews: Review[]`.

- [ ] **Step 1: Write `src/mocks/users.ts`**

```typescript
import { User } from '@/src/types';

export const mockDriver: User = {
  id: 'user-martin',
  name: 'Martín',
  email: 'martin@example.com',
  role: 'driver',
  avatarInitials: 'MG',
};

export const mockOwner: User = {
  id: 'user-maria',
  name: 'María',
  email: 'maria@example.com',
  role: 'owner',
  avatarInitials: 'MR',
};
```

- [ ] **Step 2: Write `src/mocks/parkingSpots.ts`**

```typescript
import { ParkingSpot } from '@/src/types';
import { mockOwner } from './users';

export const mockParkingSpots: ParkingSpot[] = [
  {
    id: 'spot-1',
    ownerId: mockOwner.id,
    title: 'Cochera Palermo',
    address: 'Av. Santa Fe 3245, Palermo, CABA',
    lat: -34.588,
    lng: -58.42,
    pricePerHour: 1200,
    photoUrl: 'https://picsum.photos/seed/spot1/400/300',
    covered: true,
    rating: 4.8,
    reviewCount: 123,
    tags: ['Cubierta', 'Acceso 24/7', 'Segura'],
    schedule: 'Lun a Vie, 8:00 a 22:00 hs',
    description: 'Cochera amplia para auto mediano. Acceso por portón eléctrico.',
    active: true,
  },
  {
    id: 'spot-2',
    ownerId: mockOwner.id,
    title: 'Cochera Recoleta',
    address: 'Av. Callao 1500, Recoleta, CABA',
    lat: -34.5936,
    lng: -58.393,
    pricePerHour: 950,
    photoUrl: 'https://picsum.photos/seed/spot2/400/300',
    covered: false,
    rating: 4.5,
    reviewCount: 58,
    tags: ['Descubierta', 'Segura'],
    schedule: 'Todos los días, 7:00 a 23:00 hs',
    description: 'Espacio descubierto detrás de un edificio residencial.',
    active: true,
  },
  {
    id: 'spot-3',
    ownerId: mockOwner.id,
    title: 'Cochera Belgrano',
    address: 'Av. Cabildo 2100, Belgrano, CABA',
    lat: -34.5623,
    lng: -58.4563,
    pricePerHour: 800,
    photoUrl: 'https://picsum.photos/seed/spot3/400/300',
    covered: true,
    rating: 4.6,
    reviewCount: 34,
    tags: ['Cubierta'],
    schedule: 'Lun a Sáb, 8:00 a 20:00 hs',
    description: 'Garage privado, ingreso desde la calle lateral.',
    active: true,
  },
];
```

- [ ] **Step 3: Write `src/mocks/bookings.ts`**

```typescript
import { Booking } from '@/src/types';
import { mockDriver, mockOwner } from './users';
import { mockParkingSpots } from './parkingSpots';

export const mockBookingsForDriver: Booking[] = [
  {
    id: 'booking-1',
    parkingSpotId: mockParkingSpots[0].id,
    parkingSpotTitle: mockParkingSpots[0].title,
    driverId: mockDriver.id,
    driverName: mockDriver.name,
    ownerId: mockOwner.id,
    date: 'Hoy',
    startTime: '14:00',
    endTime: '17:00',
    hours: 3,
    subtotal: 3600,
    serviceCharge: 180,
    total: 3780,
    status: 'CONFIRMED',
  },
  {
    id: 'booking-2',
    parkingSpotId: mockParkingSpots[1].id,
    parkingSpotTitle: mockParkingSpots[1].title,
    driverId: mockDriver.id,
    driverName: mockDriver.name,
    ownerId: mockOwner.id,
    date: '2026-06-30',
    startTime: '9:00',
    endTime: '13:00',
    hours: 4,
    subtotal: 3800,
    serviceCharge: 190,
    total: 3990,
    status: 'COMPLETED',
  },
];

export const mockBookingsForOwner: Booking[] = [
  {
    id: 'booking-3',
    parkingSpotId: mockParkingSpots[0].id,
    parkingSpotTitle: mockParkingSpots[0].title,
    driverId: 'user-martin-g',
    driverName: 'Martín G.',
    ownerId: mockOwner.id,
    date: 'Hoy',
    startTime: '14:00',
    endTime: '17:00',
    hours: 3,
    subtotal: 3600,
    serviceCharge: 180,
    total: 3600,
    status: 'CONFIRMED',
  },
  {
    id: 'booking-4',
    parkingSpotId: mockParkingSpots[0].id,
    parkingSpotTitle: mockParkingSpots[0].title,
    driverId: 'user-carla-p',
    driverName: 'Carla P.',
    ownerId: mockOwner.id,
    date: 'Mañana',
    startTime: '9:00',
    endTime: '13:00',
    hours: 4,
    subtotal: 4800,
    serviceCharge: 240,
    total: 4800,
    status: 'CONFIRMED',
  },
  {
    id: 'booking-5',
    parkingSpotId: mockParkingSpots[2].id,
    parkingSpotTitle: mockParkingSpots[2].title,
    driverId: 'user-julian-t',
    driverName: 'Julián T.',
    ownerId: mockOwner.id,
    date: 'Vie',
    startTime: '18:00',
    endTime: '20:00',
    hours: 2,
    subtotal: 2400,
    serviceCharge: 120,
    total: 2400,
    status: 'PENDING_PAYMENT',
  },
];
```

- [ ] **Step 4: Write `src/mocks/settlements.ts`**

```typescript
import { Settlement } from '@/src/types';
import { mockOwner } from './users';
import { mockBookingsForOwner } from './bookings';

export const mockSettlements: Settlement[] = [
  {
    id: 'settlement-1',
    ownerId: mockOwner.id,
    period: 'Junio 2026',
    totalAmount: 45300,
    commissionRetained: 4530,
    bookingIds: mockBookingsForOwner.map((b) => b.id),
  },
  {
    id: 'settlement-2',
    ownerId: mockOwner.id,
    period: 'Mayo 2026',
    totalAmount: 38900,
    commissionRetained: 3890,
    bookingIds: [],
  },
];
```

- [ ] **Step 5: Write `src/mocks/reviews.ts`**

```typescript
import { Review } from '@/src/types';
import { mockDriver, mockOwner } from './users';
import { mockParkingSpots } from './parkingSpots';

export const mockReviews: Review[] = [
  {
    id: 'review-1',
    bookingId: 'booking-2',
    fromUserId: mockDriver.id,
    toUserId: mockOwner.id,
    stars: 5,
    comment: 'Excelente cochera, fácil acceso.',
  },
];

export const mockReviewsBySpot: Record<string, Review[]> = {
  [mockParkingSpots[0].id]: mockReviews,
};
```

- [ ] **Step 6: Commit**

```bash
cd ~/mobile
git add src/mocks
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "Add mock fixtures"
```

---

### Task 5: Mock services layer (with tests)

**Files:**
- Create: `src/services/utils.ts`
- Create: `src/services/authService.ts`
- Create: `src/services/parkingService.ts`
- Create: `src/services/bookingService.ts`
- Create: `src/services/paymentService.ts`
- Test: `src/services/__tests__/parkingService.test.ts`
- Test: `src/services/__tests__/bookingService.test.ts`

**Interfaces:**
- Consumes: types (Task 3), mocks (Task 4).
- Produces: `login(email, password): Promise<User>`, `searchParkingSpots(filters?): Promise<ParkingSpot[]>`, `getParkingSpotDetail(id): Promise<ParkingSpot | undefined>`, `getBookingsForUser(userId, role): Promise<Booking[]>`, `getBookingById(id): Promise<Booking | undefined>`, `createBooking(input): Promise<Booking>`, `cancelBooking(id): Promise<Booking>`, `payBooking(bookingId): Promise<Booking>`, `getSettlementsForOwner(ownerId): Promise<Settlement[]>`.

- [ ] **Step 1: Write `src/services/utils.ts`**

```typescript
export function delay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
```

- [ ] **Step 2: Install Jest for Expo**

```bash
cd ~/mobile
npx expo install jest-expo jest @types/jest
```

Add to `package.json`:

```json
{
  "scripts": {
    "test": "jest"
  },
  "jest": {
    "preset": "jest-expo"
  }
}
```

- [ ] **Step 3: Write the failing test for `parkingService`**

```typescript
// src/services/__tests__/parkingService.test.ts
import { searchParkingSpots, getParkingSpotDetail } from '@/src/services/parkingService';

describe('parkingService', () => {
  it('returns all active spots when no filters are given', async () => {
    const spots = await searchParkingSpots();
    expect(spots.length).toBeGreaterThan(0);
    expect(spots.every((s) => s.active)).toBe(true);
  });

  it('filters spots by max price', async () => {
    const spots = await searchParkingSpots({ maxPrice: 900 });
    expect(spots.every((s) => s.pricePerHour <= 900)).toBe(true);
  });

  it('returns a single spot by id', async () => {
    const spots = await searchParkingSpots();
    const spot = await getParkingSpotDetail(spots[0].id);
    expect(spot?.id).toBe(spots[0].id);
  });

  it('returns undefined for an unknown id', async () => {
    const spot = await getParkingSpotDetail('does-not-exist');
    expect(spot).toBeUndefined();
  });
});
```

- [ ] **Step 4: Run it to confirm it fails**

```bash
cd ~/mobile
npm test -- parkingService
```

Expected: FAIL — `Cannot find module '@/src/services/parkingService'`.

- [ ] **Step 5: Write `src/services/parkingService.ts`**

```typescript
import { ParkingSpot } from '@/src/types';
import { mockParkingSpots } from '@/src/mocks/parkingSpots';
import { delay } from './utils';

export interface SearchParkingSpotsFilters {
  maxPrice?: number;
  covered?: boolean;
}

export async function searchParkingSpots(
  filters: SearchParkingSpotsFilters = {}
): Promise<ParkingSpot[]> {
  let results = mockParkingSpots.filter((s) => s.active);
  if (filters.maxPrice !== undefined) {
    results = results.filter((s) => s.pricePerHour <= filters.maxPrice!);
  }
  if (filters.covered !== undefined) {
    results = results.filter((s) => s.covered === filters.covered);
  }
  return delay(results);
}

export async function getParkingSpotDetail(
  id: string
): Promise<ParkingSpot | undefined> {
  return delay(mockParkingSpots.find((s) => s.id === id));
}
```

- [ ] **Step 6: Run the test again to confirm it passes**

```bash
cd ~/mobile
npm test -- parkingService
```

Expected: PASS (4 tests).

- [ ] **Step 7: Write the failing test for `bookingService`**

```typescript
// src/services/__tests__/bookingService.test.ts
import {
  createBooking,
  cancelBooking,
  getBookingById,
} from '@/src/services/bookingService';
import { mockParkingSpots } from '@/src/mocks/parkingSpots';
import { mockDriver } from '@/src/mocks/users';

describe('bookingService', () => {
  it('creates a booking in PENDING_PAYMENT with the service charge applied', async () => {
    const spot = mockParkingSpots[0];
    const booking = await createBooking({
      parkingSpot: spot,
      driverId: mockDriver.id,
      driverName: mockDriver.name,
      date: 'Hoy',
      startTime: '10:00',
      endTime: '12:00',
      hours: 2,
    });
    expect(booking.status).toBe('PENDING_PAYMENT');
    expect(booking.subtotal).toBe(spot.pricePerHour * 2);
    expect(booking.serviceCharge).toBe(Math.round(booking.subtotal * 0.05));
    expect(booking.total).toBe(booking.subtotal + booking.serviceCharge);
  });

  it('cancels a booking by id', async () => {
    const spot = mockParkingSpots[0];
    const booking = await createBooking({
      parkingSpot: spot,
      driverId: mockDriver.id,
      driverName: mockDriver.name,
      date: 'Hoy',
      startTime: '10:00',
      endTime: '12:00',
      hours: 2,
    });
    const cancelled = await cancelBooking(booking.id);
    expect(cancelled.status).toBe('CANCELLED');
    const fetched = await getBookingById(booking.id);
    expect(fetched?.status).toBe('CANCELLED');
  });
});
```

- [ ] **Step 8: Run it to confirm it fails**

```bash
cd ~/mobile
npm test -- bookingService
```

Expected: FAIL — module not found.

- [ ] **Step 9: Write `src/services/bookingService.ts`**

```typescript
import { Booking, ParkingSpot } from '@/src/types';
import { mockBookingsForDriver, mockBookingsForOwner } from '@/src/mocks/bookings';
import { delay } from './utils';

const allBookings: Booking[] = [...mockBookingsForDriver, ...mockBookingsForOwner];
let nextId = allBookings.length + 1;

export async function getBookingsForUser(
  userId: string,
  role: 'driver' | 'owner'
): Promise<Booking[]> {
  const list =
    role === 'driver'
      ? allBookings.filter((b) => b.driverId === userId)
      : allBookings.filter((b) => b.ownerId === userId);
  return delay(list);
}

export async function getBookingById(id: string): Promise<Booking | undefined> {
  return delay(allBookings.find((b) => b.id === id));
}

export interface CreateBookingInput {
  parkingSpot: ParkingSpot;
  driverId: string;
  driverName: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const subtotal = input.parkingSpot.pricePerHour * input.hours;
  const serviceCharge = Math.round(subtotal * 0.05);
  const booking: Booking = {
    id: `booking-${nextId++}`,
    parkingSpotId: input.parkingSpot.id,
    parkingSpotTitle: input.parkingSpot.title,
    driverId: input.driverId,
    driverName: input.driverName,
    ownerId: input.parkingSpot.ownerId,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    hours: input.hours,
    subtotal,
    serviceCharge,
    total: subtotal + serviceCharge,
    status: 'PENDING_PAYMENT',
  };
  allBookings.push(booking);
  return delay(booking);
}

export async function cancelBooking(id: string): Promise<Booking> {
  const booking = allBookings.find((b) => b.id === id);
  if (!booking) {
    throw new Error(`Booking ${id} not found`);
  }
  booking.status = 'CANCELLED';
  return delay(booking);
}
```

- [ ] **Step 10: Run the tests again to confirm they pass**

```bash
cd ~/mobile
npm test -- bookingService
```

Expected: PASS (2 tests).

- [ ] **Step 11: Write `src/services/authService.ts`**

```typescript
import { User } from '@/src/types';
import { mockDriver, mockOwner } from '@/src/mocks/users';
import { delay } from './utils';

export async function loginAsDriver(): Promise<User> {
  return delay(mockDriver);
}

export async function loginAsOwner(): Promise<User> {
  return delay(mockOwner);
}

export async function updateProfile(user: User, changes: Partial<User>): Promise<User> {
  return delay({ ...user, ...changes });
}
```

- [ ] **Step 12: Write `src/services/paymentService.ts`**

```typescript
import { Booking } from '@/src/types';
import { delay } from './utils';
import { cancelBooking, getBookingById } from './bookingService';

export async function payBooking(bookingId: string): Promise<Booking> {
  const booking = await getBookingById(bookingId);
  if (!booking) {
    throw new Error(`Booking ${bookingId} not found`);
  }
  booking.status = 'CONFIRMED';
  return delay(booking, 800);
}

export { cancelBooking };
```

- [ ] **Step 13: Run the full test suite**

```bash
cd ~/mobile
npm test
```

Expected: all tests PASS.

- [ ] **Step 14: Commit**

```bash
cd ~/mobile
git add src/services package.json
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "Add mock services layer with tests"
```

---

### Task 6: Zustand session store

**Files:**
- Create: `src/store/useSessionStore.ts`
- Test: `src/store/__tests__/useSessionStore.test.ts`

**Interfaces:**
- Consumes: `User` type (Task 3).
- Produces: `useSessionStore` hook exposing `{ user: User | null, login(user: User): void, logout(): void }`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/store/__tests__/useSessionStore.test.ts
import { useSessionStore } from '@/src/store/useSessionStore';
import { mockDriver } from '@/src/mocks/users';

describe('useSessionStore', () => {
  it('starts with no user', () => {
    expect(useSessionStore.getState().user).toBeNull();
  });

  it('sets the user on login and clears it on logout', () => {
    useSessionStore.getState().login(mockDriver);
    expect(useSessionStore.getState().user).toEqual(mockDriver);
    useSessionStore.getState().logout();
    expect(useSessionStore.getState().user).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
cd ~/mobile
npm test -- useSessionStore
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/store/useSessionStore.ts`**

```typescript
import { create } from 'zustand';
import { User } from '@/src/types';

interface SessionState {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  login: (user) => set({ user }),
  logout: () => set({ user: null }),
}));
```

- [ ] **Step 4: Run the test again to confirm it passes**

```bash
cd ~/mobile
npm test -- useSessionStore
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd ~/mobile
git add src/store
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "Add Zustand session store"
```

---

### Task 7: Shared UI components

**Files:**
- Create: `src/components/Button.tsx`
- Create: `src/components/Chip.tsx`
- Create: `src/components/Card.tsx`
- Create: `src/components/StatusBadge.tsx`
- Create: `src/components/RatingStars.tsx`

**Interfaces:**
- Consumes: `colors`, `typography` (Task 2).
- Produces: `<Button title onPress disabled? />`, `<Chip label onRemove? selected? />`, `<Card style? children />`, `<StatusBadge status: 'CONFIRMADA' | 'PENDIENTE' | 'COMPLETADA' | 'CANCELADA' />`, `<RatingStars rating count? />`.

- [ ] **Step 1: Write `src/components/Button.tsx`**

```tsx
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '@/src/theme/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ title, onPress, disabled, style }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, disabled && styles.disabled, style]}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.teal,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
```

- [ ] **Step 2: Write `src/components/Chip.tsx`**

```tsx
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';

interface ChipProps {
  label: string;
  onRemove?: () => void;
  selected?: boolean;
}

export function Chip({ label, onRemove, selected }: ChipProps) {
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onRemove}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>
        {label}
        {onRemove ? ' ✕' : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  text: {
    fontSize: 13,
    color: colors.deepNavy,
  },
  textSelected: {
    color: colors.white,
  },
});
```

- [ ] **Step 3: Write `src/components/Card.tsx`**

```tsx
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '@/src/theme/colors';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
```

- [ ] **Step 4: Write `src/components/StatusBadge.tsx`**

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';
import { BookingStatus } from '@/src/types';

const LABELS: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'PENDIENTE',
  CONFIRMED: 'CONFIRMADA',
  COMPLETED: 'COMPLETADA',
  CANCELLED: 'CANCELADA',
  EXPIRED: 'EXPIRADA',
};

const COLORS: Record<BookingStatus, string> = {
  PENDING_PAYMENT: colors.warning,
  CONFIRMED: colors.success,
  COMPLETED: colors.success,
  CANCELLED: colors.textSecondary,
  EXPIRED: colors.textSecondary,
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <View style={[styles.badge, { backgroundColor: COLORS[status] }]}>
      <Text style={styles.text}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
});
```

- [ ] **Step 5: Write `src/components/RatingStars.tsx`**

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/src/theme/colors';

export function RatingStars({ rating, count }: { rating: number; count?: number }) {
  return (
    <View style={styles.row}>
      <Text style={styles.stars}>{'★'.repeat(Math.round(rating))}</Text>
      <Text style={styles.value}>
        {rating.toFixed(1)}
        {count !== undefined ? ` · ${count} reseñas` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stars: { color: colors.warning, fontSize: 14 },
  value: { color: colors.textSecondary, fontSize: 13 },
});
```

- [ ] **Step 6: Commit**

```bash
cd ~/mobile
git add src/components
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "Add shared UI components"
```

---

### Task 8: Root navigation shell — mode-select + route groups

**Files:**
- Create: `app/_layout.tsx`
- Create: `app/index.tsx`
- Create: `app/mode-select.tsx`

**Interfaces:**
- Consumes: `useSessionStore` (Task 6), `Button` (Task 7), `colors`/`typography` (Task 2), `loginAsDriver`/`loginAsOwner` (Task 5).
- Produces: the routes `/mode-select`, plus the `Stack.Screen` declarations that the `(auth)`, `(driver)`, `(owner)` groups (Tasks 9+) will render into.

- [ ] **Step 1: Write `app/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="mode-select" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(driver)" />
      <Stack.Screen name="(owner)" />
    </Stack>
  );
}
```

- [ ] **Step 2: Write `app/index.tsx`**

```tsx
import { Redirect } from 'expo-router';
import { useSessionStore } from '@/src/store/useSessionStore';

export default function Index() {
  const user = useSessionStore((s) => s.user);
  if (!user) return <Redirect href="/mode-select" />;
  return <Redirect href={user.role === 'driver' ? '/(driver)/(tabs)' : '/(owner)/(tabs)'} />;
}
```

- [ ] **Step 3: Write `app/mode-select.tsx`**

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { loginAsDriver, loginAsOwner } from '@/src/services/authService';

export default function ModeSelect() {
  const login = useSessionStore((s) => s.login);

  async function enterAsDriver() {
    const user = await loginAsDriver();
    login(user);
    router.replace('/(driver)/(tabs)');
  }

  async function enterAsOwner() {
    const user = await loginAsOwner();
    login(user);
    router.replace('/(owner)/(tabs)');
  }

  return (
    <View style={styles.container}>
      <Text style={typography.h1}>ParkLink</Text>
      <Text style={[typography.caption, styles.subtitle]}>
        Modo demo — elegí con qué rol entrar
      </Text>
      <Button title="Entrar como Conductor" onPress={enterAsDriver} style={styles.button} />
      <Button title="Entrar como Propietario" onPress={enterAsOwner} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  subtitle: { marginBottom: 24 },
  button: { marginTop: 8 },
});
```

- [ ] **Step 4: Manual verification**

```bash
cd ~/mobile
npx expo start
```

Open in the iOS Simulator (press `i`) or Android emulator (press `a`). Expected: the app opens directly on the "ParkLink" mode-select screen with both buttons. Tapping either button should navigate away (the target tab screens don't exist yet, so Expo Router will show a "Unmatched Route" screen — that's expected until Task 9/10 land).

- [ ] **Step 5: Commit**

```bash
cd ~/mobile
git add app
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "Add root layout, index redirect, and mode-select screen"
```

---

### Task 9: Auth screens (login, register, forgot password, profile-edit)

These screens are **not wired into the mode-select flow** (the demo enters directly via mode-select, matching the design doc), but they must exist and render standalone so the "cuenta" use cases are demonstrable during the walkthrough.

**Files:**
- Create: `app/(auth)/_layout.tsx`
- Create: `app/(auth)/login.tsx`
- Create: `app/(auth)/register.tsx`
- Create: `app/(auth)/forgot-password.tsx`
- Create: `app/(driver)/profile-edit.tsx`
- Create: `app/(owner)/profile-edit.tsx`

**Interfaces:**
- Consumes: `Button`, `Card` (Task 7), `colors`/`typography` (Task 2), `useSessionStore` (Task 6), `updateProfile` (Task 5).

- [ ] **Step 1: Write `app/(auth)/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';
import { colors } from '@/src/theme/colors';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.deepNavy },
        headerTintColor: colors.white,
      }}
    >
      <Stack.Screen name="login" options={{ title: 'Iniciar sesión' }} />
      <Stack.Screen name="register" options={{ title: 'Registro' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Recuperar contraseña' }} />
    </Stack>
  );
}
```

- [ ] **Step 2: Write `app/(auth)/login.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <View style={styles.container}>
      <Text style={typography.h1}>Bienvenido de nuevo</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button title="Ingresar" onPress={() => router.replace('/mode-select')} />
      <Text style={styles.link} onPress={() => router.push('/(auth)/register')}>
        ¿No tenés cuenta? Registrate
      </Text>
      <Text style={styles.link} onPress={() => router.push('/(auth)/forgot-password')}>
        Olvidé mi contraseña
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: 24, gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  link: { color: colors.teal, textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 3: Write `app/(auth)/register.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <View style={styles.container}>
      <Text style={typography.h1}>Creá tu cuenta</Text>
      <TextInput style={styles.input} placeholder="Nombre" value={name} onChangeText={setName} />
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button title="Crear cuenta" onPress={() => router.replace('/mode-select')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: 24, gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
});
```

- [ ] **Step 4: Write `app/(auth)/forgot-password.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={typography.h1}>Recuperar contraseña</Text>
      {sent ? (
        <Text style={typography.body}>
          Si el email existe, vas a recibir un link para restablecer tu contraseña.
        </Text>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <Button title="Enviar link" onPress={() => setSent(true)} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: 24, gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
});
```

- [ ] **Step 5: Write `app/(driver)/profile-edit.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { updateProfile } from '@/src/services/authService';

export default function DriverProfileEdit() {
  const user = useSessionStore((s) => s.user)!;
  const login = useSessionStore((s) => s.login);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);

  async function save() {
    const updated = await updateProfile(user, { name, email });
    login(updated);
    router.back();
  }

  return (
    <View style={styles.container}>
      <Text style={typography.h1}>Editar perfil</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />
      <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" />
      <Button title="Guardar" onPress={save} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: 24, gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
});
```

- [ ] **Step 6: Write `app/(owner)/profile-edit.tsx`** (identical structure to Step 5, owner side)

```tsx
import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { updateProfile } from '@/src/services/authService';

export default function OwnerProfileEdit() {
  const user = useSessionStore((s) => s.user)!;
  const login = useSessionStore((s) => s.login);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);

  async function save() {
    const updated = await updateProfile(user, { name, email });
    login(updated);
    router.back();
  }

  return (
    <View style={styles.container}>
      <Text style={typography.h1}>Editar perfil</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />
      <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" />
      <Button title="Guardar" onPress={save} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: 24, gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
});
```

- [ ] **Step 7: Manual verification**

```bash
cd ~/mobile
npx expo start
```

Navigate manually to `/(auth)/login` by editing the URL bar in the web preview, or temporarily add a link from `mode-select.tsx` — confirm login/register/forgot-password render without crashing and the text inputs accept typing.

- [ ] **Step 8: Commit**

```bash
cd ~/mobile
git add app
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "Add auth screens and profile-edit screens"
```

---

### Task 10: Driver tabs shell + search screen (Fig 1)

**Files:**
- Create: `app/(driver)/_layout.tsx`
- Create: `app/(driver)/(tabs)/_layout.tsx`
- Create: `app/(driver)/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `useSessionStore`, `searchParkingSpots`, `Chip`, `Card`, `RatingStars`, `colors`, `typography`.
- Produces: the `/(driver)/(tabs)` route target used by `app/index.tsx` and `mode-select.tsx`.

- [ ] **Step 1: Write `app/(driver)/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';
import { colors } from '@/src/theme/colors';

export default function DriverLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.deepNavy },
        headerTintColor: colors.white,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="spot/[id]" options={{ title: 'Detalle' }} />
      <Stack.Screen name="booking/confirm" options={{ title: 'Confirmar reserva' }} />
      <Stack.Screen name="booking/success" options={{ title: '', headerBackVisible: false }} />
      <Stack.Screen name="bookings/[id]" options={{ title: 'Reserva' }} />
      <Stack.Screen name="review/[bookingId]" options={{ title: 'Calificar' }} />
      <Stack.Screen name="profile-edit" options={{ title: 'Editar perfil' }} />
    </Stack>
  );
}
```

- [ ] **Step 2: Write `app/(driver)/(tabs)/_layout.tsx`**

```tsx
import { Tabs } from 'expo-router';
import { colors } from '@/src/theme/colors';

export default function DriverTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.deepNavy,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Buscar' }} />
      <Tabs.Screen name="bookings" options={{ title: 'Reservas' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
```

- [ ] **Step 3: Write `app/(driver)/(tabs)/index.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Chip } from '@/src/components/Chip';
import { Card } from '@/src/components/Card';
import { RatingStars } from '@/src/components/RatingStars';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { searchParkingSpots } from '@/src/services/parkingService';
import { ParkingSpot } from '@/src/types';

export default function Search() {
  const user = useSessionStore((s) => s.user);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [maxPriceFilter, setMaxPriceFilter] = useState<number | undefined>(undefined);

  useEffect(() => {
    searchParkingSpots({ maxPrice: maxPriceFilter }).then(setSpots);
  }, [maxPriceFilter]);

  return (
    <View style={styles.container}>
      <Text style={typography.h1}>Hola, {user?.name}</Text>
      <View style={styles.filterRow}>
        <Chip
          label="$500 – 1.500"
          selected={maxPriceFilter === 1500}
          onRemove={() => setMaxPriceFilter((v) => (v === 1500 ? undefined : 1500))}
        />
        <Chip label="Hoy 14-17 hs" />
        <Chip label="< 500 m" />
      </View>
      <FlatList
        data={spots}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(driver)/spot/${item.id}`)}>
            <Card>
              <Text style={typography.h2}>{item.title}</Text>
              <Text style={typography.caption}>{item.address}</Text>
              <RatingStars rating={item.rating} count={item.reviewCount} />
              <Text style={styles.price}>${item.pricePerHour} por hora</Text>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 },
  filterRow: { flexDirection: 'row' },
  price: { color: colors.teal, fontWeight: '700', marginTop: 4 },
});
```

- [ ] **Step 4: Manual verification**

```bash
cd ~/mobile
npx expo start
```

Tap "Entrar como Conductor" on mode-select. Expected: lands on the "Buscar" tab, greeting shows "Hola, Martín", the three parking spots render as cards with rating and price, and the three-tab bar (Buscar/Reservas/Perfil) is visible at the bottom (the other two tabs will 404 until Task 14/9 wire them — that's expected for now, fix in later tasks).

- [ ] **Step 5: Commit**

```bash
cd ~/mobile
git add app
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "Add driver tabs shell and search screen"
```

---

### Task 11: Driver — cochera detail screen (Fig 2)

**Files:**
- Create: `app/(driver)/spot/[id].tsx`

**Interfaces:**
- Consumes: `getParkingSpotDetail` (Task 5), `Chip`, `Card`, `RatingStars`, `Button` (Task 7).
- Produces: navigates to `/(driver)/booking/confirm` (Task 12) with `spotId` + selected hours as route params.

- [ ] **Step 1: Write `app/(driver)/spot/[id].tsx`**

```tsx
import { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Chip } from '@/src/components/Chip';
import { RatingStars } from '@/src/components/RatingStars';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { getParkingSpotDetail } from '@/src/services/parkingService';
import { ParkingSpot } from '@/src/types';

const DEFAULT_HOURS = 3;

export default function SpotDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [spot, setSpot] = useState<ParkingSpot | null>(null);

  useEffect(() => {
    getParkingSpotDetail(id).then((s) => setSpot(s ?? null));
  }, [id]);

  if (!spot) return null;

  const total = spot.pricePerHour * DEFAULT_HOURS;

  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: spot.photoUrl }} style={styles.photo} />
      <View style={styles.body}>
        <Text style={typography.h1}>{spot.title}</Text>
        <RatingStars rating={spot.rating} count={spot.reviewCount} />
        <View style={styles.tagRow}>
          {spot.tags.map((tag) => (
            <Chip key={tag} label={tag} />
          ))}
        </View>
        <Row label="Dirección" value={spot.address} />
        <Row label="Disponible" value={spot.schedule} />
        <Row label="Precio" value={`$${spot.pricePerHour} por hora`} />
        <Text style={styles.total}>Total ({DEFAULT_HOURS} hs): ${total}</Text>
        <Button
          title="Reservar ahora"
          onPress={() =>
            router.push({
              pathname: '/(driver)/booking/confirm',
              params: { spotId: spot.id, hours: String(DEFAULT_HOURS) },
            })
          }
        />
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={typography.caption}>{label}</Text>
      <Text style={typography.body}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  photo: { width: '100%', height: 200 },
  body: { padding: 16, gap: 10 },
  tagRow: { flexDirection: 'row', marginVertical: 4 },
  row: { marginTop: 6 },
  total: { ...typography.h2, color: colors.teal, marginVertical: 10 },
});
```

- [ ] **Step 2: Manual verification**

```bash
cd ~/mobile
npx expo start
```

From the search screen, tap "Cochera Palermo". Expected: photo, rating, tags (Cubierta/Acceso 24/7/Segura), address/schedule/price rows, computed total for 3 hours, and a working "Reservar ahora" button (target route doesn't exist until Task 12 — expected 404 for now).

- [ ] **Step 3: Commit**

```bash
cd ~/mobile
git add app/\(driver\)/spot
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "Add driver spot detail screen"
```

---

### Task 12: Driver — confirm booking + payment screen (Fig 3)

**Files:**
- Create: `app/(driver)/booking/confirm.tsx`

**Interfaces:**
- Consumes: `getParkingSpotDetail`, `createBooking` (Task 5), `payBooking` (Task 5), `useSessionStore` (Task 6), `Button`, `Card` (Task 7).
- Produces: navigates to `/(driver)/booking/success` (Task 13) with `bookingId` as a route param.

- [ ] **Step 1: Write `app/(driver)/booking/confirm.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getParkingSpotDetail } from '@/src/services/parkingService';
import { createBooking } from '@/src/services/bookingService';
import { payBooking } from '@/src/services/paymentService';
import { Booking, ParkingSpot } from '@/src/types';

export default function ConfirmBooking() {
  const { spotId, hours } = useLocalSearchParams<{ spotId: string; hours: string }>();
  const user = useSessionStore((s) => s.user)!;
  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    getParkingSpotDetail(spotId).then(async (s) => {
      if (!s) return;
      setSpot(s);
      const created = await createBooking({
        parkingSpot: s,
        driverId: user.id,
        driverName: user.name,
        date: 'Hoy',
        startTime: '14:00',
        endTime: '17:00',
        hours: Number(hours),
      });
      setBooking(created);
    });
  }, [spotId, hours]);

  async function confirmAndPay() {
    if (!booking) return;
    setPaying(true);
    await payBooking(booking.id);
    router.replace({ pathname: '/(driver)/booking/success', params: { bookingId: booking.id } });
  }

  if (!spot || !booking) return <ActivityIndicator style={{ marginTop: 40 }} />;

  return (
    <View style={styles.container}>
      <Card>
        <Text style={typography.h2}>{spot.title}</Text>
        <Text style={typography.caption}>{spot.address}</Text>
      </Card>
      <Text style={[typography.caption, styles.sectionTitle]}>RESUMEN</Text>
      <Row label="Fecha" value={booking.date} />
      <Row label="Horario" value={`${booking.startTime} a ${booking.endTime}`} />
      <Row label="Duración" value={`${booking.hours} hs`} />
      <Row label="Subtotal" value={`$${booking.subtotal}`} />
      <Row label="Cargo de servicio (5%)" value={`$${booking.serviceCharge}`} />
      <Row label="Total" value={`$${booking.total}`} bold />
      <Text style={[typography.caption, styles.sectionTitle]}>MÉTODO DE PAGO</Text>
      <Card>
        <Text style={typography.body}>MercadoPago — Visa terminada en 4523</Text>
      </Card>
      <Button
        title={paying ? 'Procesando...' : `Pagar y confirmar · $${booking.total}`}
        onPress={confirmAndPay}
        disabled={paying}
        style={styles.button}
      />
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={typography.body}>{label}</Text>
      <Text style={[typography.body, bold && { fontWeight: '700', color: colors.teal }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: 16, gap: 8 },
  sectionTitle: { marginTop: 10, marginBottom: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  button: { marginTop: 16 },
});
```

- [ ] **Step 2: Manual verification**

```bash
cd ~/mobile
npx expo start
```

From the spot detail screen, tap "Reservar ahora". Expected: summary matches the mockup (Fecha/Horario/Duración/Subtotal/5% cargo/Total), MercadoPago card, and "Pagar y confirmar · $total" button that navigates onward (expected 404 until Task 13 lands).

- [ ] **Step 3: Commit**

```bash
cd ~/mobile
git add app/\(driver\)/booking/confirm.tsx
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "Add driver booking confirmation and payment screen"
```

---

### Task 13: Driver — booking success screen

**Files:**
- Create: `app/(driver)/booking/success.tsx`

**Interfaces:**
- Consumes: `getBookingById` (Task 5), `Button`, `Card` (Task 7).

- [ ] **Step 1: Write `app/(driver)/booking/success.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { getBookingById } from '@/src/services/bookingService';
import { Booking } from '@/src/types';

export default function BookingSuccess() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    getBookingById(bookingId).then((b) => setBooking(b ?? null));
  }, [bookingId]);

  if (!booking) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.check}>✓</Text>
      <Text style={typography.h1}>¡Reserva confirmada!</Text>
      <Card style={styles.card}>
        <Text style={typography.h2}>{booking.parkingSpotTitle}</Text>
        <Text style={typography.body}>
          {booking.date} · {booking.startTime} a {booking.endTime}
        </Text>
        <Text style={typography.body}>Total pagado: ${booking.total}</Text>
      </Card>
      <Button
        title="Ver mis reservas"
        onPress={() => router.replace('/(driver)/(tabs)/bookings')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: 24, alignItems: 'center', gap: 16 },
  check: { fontSize: 56, color: colors.success },
  card: { width: '100%', marginVertical: 12 },
});
```

- [ ] **Step 2: Manual verification**

```bash
cd ~/mobile
npx expo start
```

Complete a full booking from search → detail → confirm → pay. Expected: success screen with a checkmark, spot name, time, total paid, and a button back to the bookings tab.

- [ ] **Step 3: Commit**

```bash
cd ~/mobile
git add app/\(driver\)/booking/success.tsx
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "Add driver booking success screen"
```

---

### Task 14: Driver — bookings history (list + detail) and review screen

**Files:**
- Create: `app/(driver)/(tabs)/bookings.tsx`
- Create: `app/(driver)/bookings/[id].tsx`
- Create: `app/(driver)/review/[bookingId].tsx`

**Interfaces:**
- Consumes: `getBookingsForUser`, `getBookingById`, `cancelBooking` (Task 5), `StatusBadge`, `Card`, `Button`, `RatingStars` (Task 7), `useSessionStore` (Task 6).

- [ ] **Step 1: Write `app/(driver)/(tabs)/bookings.tsx`**

```tsx
import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Card } from '@/src/components/Card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getBookingsForUser } from '@/src/services/bookingService';
import { Booking } from '@/src/types';

export default function DriverBookings() {
  const user = useSessionStore((s) => s.user)!;
  const [bookings, setBookings] = useState<Booking[]>([]);

  useFocusEffect(
    useCallback(() => {
      getBookingsForUser(user.id, 'driver').then(setBookings);
    }, [user.id])
  );

  return (
    <View style={styles.container}>
      <Text style={typography.h1}>Mis reservas</Text>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(driver)/bookings/${item.id}`)}>
            <Card>
              <View style={styles.row}>
                <Text style={typography.h2}>{item.parkingSpotTitle}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={typography.caption}>
                {item.date} · {item.startTime} a {item.endTime}
              </Text>
              <Text style={styles.total}>${item.total}</Text>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  total: { color: colors.teal, fontWeight: '700', marginTop: 4 },
});
```

- [ ] **Step 2: Write `app/(driver)/bookings/[id].tsx`**

```tsx
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { getBookingById, cancelBooking } from '@/src/services/bookingService';
import { Booking } from '@/src/types';

export default function DriverBookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    getBookingById(id).then((b) => setBooking(b ?? null));
  }, [id]);

  if (!booking) return null;

  async function onCancel() {
    const updated = await cancelBooking(booking!.id);
    setBooking(updated);
  }

  return (
    <View style={styles.container}>
      <Card>
        <View style={styles.row}>
          <Text style={typography.h1}>{booking.parkingSpotTitle}</Text>
          <StatusBadge status={booking.status} />
        </View>
        <Text style={typography.body}>
          {booking.date} · {booking.startTime} a {booking.endTime}
        </Text>
        <Text style={typography.body}>Total: ${booking.total}</Text>
      </Card>
      {booking.status === 'CONFIRMED' && (
        <Button
          title="Cancelar reserva"
          onPress={() =>
            Alert.alert('Cancelar reserva', '¿Confirmás que querés cancelar?', [
              { text: 'No' },
              { text: 'Sí, cancelar', onPress: onCancel },
            ])
          }
        />
      )}
      {booking.status === 'COMPLETED' && (
        <Button
          title="Calificar al propietario"
          onPress={() => router.push(`/(driver)/review/${booking.id}`)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: 16, gap: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
});
```

- [ ] **Step 3: Write `app/(driver)/review/[bookingId].tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';

export default function DriverReview() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');

  function submit() {
    // Mock only — no review persistence service call in this MVP pass.
    router.back();
  }

  return (
    <View style={styles.container}>
      <Text style={typography.h1}>Calificar al propietario</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setStars(n)}>
            <Text style={[styles.star, n <= stars && styles.starActive]}>★</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder="Dejá un comentario (opcional)"
        multiline
        value={comment}
        onChangeText={setComment}
      />
      <Button title="Enviar calificación" onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: 16, gap: 16 },
  starsRow: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 32, color: colors.border },
  starActive: { color: colors.warning },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
```

- [ ] **Step 4: Manual verification**

```bash
cd ~/mobile
npx expo start
```

Go to the "Reservas" tab as the driver — expected two bookings, one CONFIRMADA (booking-1) and one COMPLETADA (booking-2). Tap into the completed one and confirm "Calificar al propietario" opens the star-rating screen. Tap into the confirmed one and confirm "Cancelar reserva" prompts and updates the badge to CANCELADA.

- [ ] **Step 5: Commit**

```bash
cd ~/mobile
git add app/\(driver\)/bookings app/\(driver\)/review "app/(driver)/(tabs)/bookings.tsx"
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "Add driver bookings history, detail, and review screens"
```

---

### Task 15: Driver — profile tab

**Files:**
- Create: `app/(driver)/(tabs)/profile.tsx`

**Interfaces:**
- Consumes: `useSessionStore` (Task 6), `Card`, `Button` (Task 7).

- [ ] **Step 1: Write `app/(driver)/(tabs)/profile.tsx`**

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';

export default function DriverProfile() {
  const user = useSessionStore((s) => s.user)!;
  const logout = useSessionStore((s) => s.logout);

  return (
    <View style={styles.container}>
      <Text style={typography.h1}>Mi perfil</Text>
      <Card>
        <Text style={typography.h2}>{user.name}</Text>
        <Text style={typography.caption}>{user.email}</Text>
      </Card>
      <Button title="Editar perfil" onPress={() => router.push('/(driver)/profile-edit')} />
      <Button
        title="Cerrar sesión"
        onPress={() => {
          logout();
          router.replace('/mode-select');
        }}
        style={styles.logout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 },
  logout: { backgroundColor: colors.textSecondary },
});
```

- [ ] **Step 2: Manual verification**

Go to the "Perfil" tab as the driver. Expected: name/email card, "Editar perfil" opens the edit screen from Task 9, "Cerrar sesión" returns to mode-select.

- [ ] **Step 3: Commit**

```bash
cd ~/mobile
git add "app/(driver)/(tabs)/profile.tsx"
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "Add driver profile tab"
```

---

### Task 16: Owner tabs shell + home panel (Fig 5)

**Files:**
- Create: `app/(owner)/_layout.tsx`
- Create: `app/(owner)/(tabs)/_layout.tsx`
- Create: `app/(owner)/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `useSessionStore` (Task 6), `getBookingsForUser` (Task 5), `getSettlementsForOwner` (added in this task to `paymentService.ts`), `Card`, `StatusBadge` (Task 7).

- [ ] **Step 1: Add `getSettlementsForOwner` to `src/services/paymentService.ts`**

Append to the existing file from Task 5:

```typescript
import { Settlement } from '@/src/types';
import { mockSettlements } from '@/src/mocks/settlements';

export async function getSettlementsForOwner(ownerId: string): Promise<Settlement[]> {
  return delay(mockSettlements.filter((s) => s.ownerId === ownerId));
}

export async function getSettlementById(id: string): Promise<Settlement | undefined> {
  return delay(mockSettlements.find((s) => s.id === id));
}
```

(Add the `Settlement` and `mockSettlements` imports to the top of the existing `paymentService.ts` alongside the ones already there.)

- [ ] **Step 2: Write `app/(owner)/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';
import { colors } from '@/src/theme/colors';

export default function OwnerLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.deepNavy },
        headerTintColor: colors.white,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="spots/new" options={{ title: 'Publicar cochera' }} />
      <Stack.Screen name="spots/[id]/edit" options={{ title: 'Editar cochera' }} />
      <Stack.Screen name="spots/[id]/availability" options={{ title: 'Disponibilidad' }} />
      <Stack.Screen name="settlements/index" options={{ title: 'Liquidaciones' }} />
      <Stack.Screen name="settlements/[id]" options={{ title: 'Detalle de liquidación' }} />
      <Stack.Screen name="review/[bookingId]" options={{ title: 'Calificar' }} />
      <Stack.Screen name="profile-edit" options={{ title: 'Editar perfil' }} />
    </Stack>
  );
}
```

- [ ] **Step 3: Write `app/(owner)/(tabs)/_layout.tsx`**

```tsx
import { Tabs } from 'expo-router';
import { colors } from '@/src/theme/colors';

export default function OwnerTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.deepNavy,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="spots" options={{ title: 'Mis cocheras' }} />
      <Tabs.Screen name="bookings" options={{ title: 'Reservas' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
```

- [ ] **Step 4: Write `app/(owner)/(tabs)/index.tsx`**

```tsx
import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Card } from '@/src/components/Card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getBookingsForUser } from '@/src/services/bookingService';
import { getSettlementsForOwner } from '@/src/services/paymentService';
import { Booking } from '@/src/types';

export default function OwnerHome() {
  const user = useSessionStore((s) => s.user)!;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [monthTotal, setMonthTotal] = useState(0);

  useFocusEffect(
    useCallback(() => {
      getBookingsForUser(user.id, 'owner').then(setBookings);
      getSettlementsForOwner(user.id).then((s) => setMonthTotal(s[0]?.totalAmount ?? 0));
    }, [user.id])
  );

  return (
    <View style={styles.container}>
      <Text style={typography.h1}>Hola, {user.name}</Text>
      <Card style={styles.earnings}>
        <Text style={styles.earningsLabel}>Ganancias de este mes</Text>
        <Text style={styles.earningsValue}>${monthTotal.toLocaleString('es-AR')}</Text>
        <Text style={styles.earningsDelta}>▲ +12% vs. mes anterior</Text>
      </Card>
      <Text style={[typography.caption, styles.sectionTitle]}>PRÓXIMAS RESERVAS</Text>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(owner)/(tabs)/bookings`)}>
            <Card>
              <View style={styles.row}>
                <Text style={typography.h2}>{item.driverName}</Text>
                <StatusBadge status={item.status} />
              </View>
              <View style={styles.row}>
                <Text style={typography.caption}>
                  {item.date} · {item.startTime} a {item.endTime}
                </Text>
                <Text style={styles.total}>${item.total}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 },
  earnings: { backgroundColor: colors.deepNavy },
  earningsLabel: { color: colors.white, opacity: 0.8 },
  earningsValue: { color: colors.white, fontSize: 28, fontWeight: '700', marginTop: 4 },
  earningsDelta: { color: colors.success, marginTop: 4 },
  sectionTitle: { marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { color: colors.teal, fontWeight: '700' },
});
```

- [ ] **Step 5: Manual verification**

```bash
cd ~/mobile
npx expo start
```

Go back to mode-select, tap "Entrar como Propietario". Expected: "Hola, María", a Deep Navy earnings card showing "$45.300" and "+12% vs. mes anterior", and a list of 3 upcoming bookings with driver name, status badge, and amount — matching Fig 5.

- [ ] **Step 6: Commit**

```bash
cd ~/mobile
git add app src/services/paymentService.ts
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "Add owner tabs shell and home panel"
```

---

### Task 17: Owner — publish cochera screen (Fig 4) and my-cocheras list

**Files:**
- Create: `app/(owner)/(tabs)/spots.tsx`
- Create: `app/(owner)/spots/new.tsx`

**Interfaces:**
- Consumes: `searchParkingSpots` filtered by `ownerId` (extend `parkingService.ts` with a `getParkingSpotsForOwner` function), `Chip`, `Card`, `Button` (Task 7), `useSessionStore` (Task 6).

- [ ] **Step 1: Add `getParkingSpotsForOwner` to `src/services/parkingService.ts`**

Append to the existing file:

```typescript
export async function getParkingSpotsForOwner(ownerId: string): Promise<ParkingSpot[]> {
  return delay(mockParkingSpots.filter((s) => s.ownerId === ownerId));
}
```

- [ ] **Step 2: Write `app/(owner)/(tabs)/spots.tsx`**

```tsx
import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getParkingSpotsForOwner } from '@/src/services/parkingService';
import { ParkingSpot } from '@/src/types';

export default function OwnerSpots() {
  const user = useSessionStore((s) => s.user)!;
  const [spots, setSpots] = useState<ParkingSpot[]>([]);

  useFocusEffect(
    useCallback(() => {
      getParkingSpotsForOwner(user.id).then(setSpots);
    }, [user.id])
  );

  return (
    <View style={styles.container}>
      <Text style={typography.h1}>Mis cocheras</Text>
      <Button title="+ Publicar cochera" onPress={() => router.push('/(owner)/spots/new')} />
      <FlatList
        data={spots}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/(owner)/spots/${item.id}/edit`)}
          >
            <Card>
              <Text style={typography.h2}>{item.title}</Text>
              <Text style={typography.caption}>{item.address}</Text>
              <Text style={styles.price}>${item.pricePerHour} por hora</Text>
              <Text
                style={styles.availabilityLink}
                onPress={() => router.push(`/(owner)/spots/${item.id}/availability`)}
              >
                Gestionar disponibilidad
              </Text>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 },
  price: { color: colors.teal, fontWeight: '700', marginTop: 4 },
  availabilityLink: { color: colors.teal, marginTop: 8 },
});
```

- [ ] **Step 3: Write `app/(owner)/spots/new.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';

export default function NewSpot() {
  const [address, setAddress] = useState('');
  const [covered, setCovered] = useState(true);
  const [price, setPrice] = useState('');
  const [schedule, setSchedule] = useState('');
  const [description, setDescription] = useState('');

  function publish() {
    // Mock only — no create-spot service call in this MVP pass.
    router.back();
  }

  return (
    <View style={styles.container}>
      <Text style={typography.caption}>Fotos</Text>
      <Pressable style={styles.photoBox}>
        <Text style={styles.photoPlus}>+</Text>
        <Text style={typography.caption}>Tocá para subir fotos</Text>
      </Pressable>

      <Text style={typography.caption}>Dirección</Text>
      <TextInput style={styles.input} value={address} onChangeText={setAddress} />

      <Text style={typography.caption}>Tipo de cochera</Text>
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggle, covered && styles.toggleActive]}
          onPress={() => setCovered(true)}
        >
          <Text style={covered ? styles.toggleTextActive : styles.toggleText}>Cubierta</Text>
        </Pressable>
        <Pressable
          style={[styles.toggle, !covered && styles.toggleActive]}
          onPress={() => setCovered(false)}
        >
          <Text style={!covered ? styles.toggleTextActive : styles.toggleText}>Descubierta</Text>
        </Pressable>
      </View>

      <Text style={typography.caption}>Precio por hora</Text>
      <TextInput
        style={styles.input}
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
        placeholder="$1.200"
      />

      <Text style={typography.caption}>Disponibilidad</Text>
      <TextInput
        style={styles.input}
        value={schedule}
        onChangeText={setSchedule}
        placeholder="Lun a Vie · 8:00 a 22:00"
      />

      <Text style={typography.caption}>Descripción</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        multiline
        placeholder="Cochera amplia para auto mediano. Acceso por portón eléctrico."
      />

      <Button title="Publicar cochera" onPress={publish} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: 16, gap: 8 },
  photoBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 10,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  photoPlus: { fontSize: 24, color: colors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 4,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  toggle: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  toggleText: { color: colors.deepNavy },
  toggleTextActive: { color: colors.white, fontWeight: '600' },
  button: { marginTop: 16 },
});
```

- [ ] **Step 4: Manual verification**

```bash
cd ~/mobile
npx expo start
```

As the owner, go to "Mis cocheras" — expected 3 spots listed. Tap "+ Publicar cochera" — expected the form matching Fig 4 (photo placeholder, address, Cubierta/Descubierta toggle, price, availability, description, publish button).

- [ ] **Step 5: Commit**

```bash
cd ~/mobile
git add app src/services/parkingService.ts
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "Add owner spots list and publish cochera screen"
```

---

### Task 18: Owner — edit cochera and availability screens

**Files:**
- Create: `app/(owner)/spots/[id]/edit.tsx`
- Create: `app/(owner)/spots/[id]/availability.tsx`

**Interfaces:**
- Consumes: `getParkingSpotDetail` (Task 5), same form fields as Task 17's `new.tsx`.

- [ ] **Step 1: Write `app/(owner)/spots/[id]/edit.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { getParkingSpotDetail } from '@/src/services/parkingService';
import { ParkingSpot } from '@/src/types';

export default function EditSpot() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    getParkingSpotDetail(id).then((s) => {
      if (!s) return;
      setSpot(s);
      setPrice(String(s.pricePerHour));
      setDescription(s.description);
    });
  }, [id]);

  if (!spot) return null;

  function save() {
    // Mock only — no update-spot service call in this MVP pass.
    router.back();
  }

  return (
    <View style={styles.container}>
      <Text style={typography.h1}>{spot.title}</Text>
      <Text style={typography.caption}>Precio por hora</Text>
      <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" />
      <Text style={typography.caption}>Descripción</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <Button title="Guardar cambios" onPress={save} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: 16, gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 4,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
});
```

- [ ] **Step 2: Write `app/(owner)/spots/[id]/availability.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Card } from '@/src/components/Card';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { getParkingSpotDetail } from '@/src/services/parkingService';
import { ParkingSpot } from '@/src/types';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function SpotAvailability() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [spot, setSpot] = useState<ParkingSpot | null>(null);

  useEffect(() => {
    getParkingSpotDetail(id).then((s) => setSpot(s ?? null));
  }, [id]);

  if (!spot) return null;

  return (
    <View style={styles.container}>
      <Text style={typography.h1}>{spot.title}</Text>
      <Text style={typography.caption}>Horario recurrente: {spot.schedule}</Text>
      {DAYS.map((day) => (
        <Card key={day} style={styles.dayRow}>
          <Text style={typography.body}>{day}</Text>
          <Text style={typography.caption}>Disponible</Text>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 8 },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
```

- [ ] **Step 3: Manual verification**

From "Mis cocheras", tap a spot card to open Edit, and tap "Gestionar disponibilidad" to open the availability screen. Expected: edit form pre-filled with the spot's price/description; availability screen lists the 7 days with the spot's recurring schedule at the top.

- [ ] **Step 4: Commit**

```bash
cd ~/mobile
git add app/\(owner\)/spots
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "Add owner edit cochera and availability screens"
```

---

### Task 19: Owner — bookings received and profile tabs

**Files:**
- Create: `app/(owner)/(tabs)/bookings.tsx`
- Create: `app/(owner)/(tabs)/profile.tsx`
- Create: `app/(owner)/review/[bookingId].tsx`

**Interfaces:**
- Consumes: `getBookingsForUser` (Task 5), `StatusBadge`, `Card`, `Button` (Task 7), `useSessionStore` (Task 6).

- [ ] **Step 1: Write `app/(owner)/(tabs)/bookings.tsx`**

```tsx
import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Card } from '@/src/components/Card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getBookingsForUser } from '@/src/services/bookingService';
import { Booking } from '@/src/types';

export default function OwnerBookings() {
  const user = useSessionStore((s) => s.user)!;
  const [bookings, setBookings] = useState<Booking[]>([]);

  useFocusEffect(
    useCallback(() => {
      getBookingsForUser(user.id, 'owner').then(setBookings);
    }, [user.id])
  );

  return (
    <View style={styles.container}>
      <Text style={typography.h1}>Reservas recibidas</Text>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10 }}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <Text style={typography.h2}>{item.driverName}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={typography.caption}>{item.parkingSpotTitle}</Text>
            <View style={styles.row}>
              <Text style={typography.caption}>
                {item.date} · {item.startTime} a {item.endTime}
              </Text>
              <Text style={styles.total}>${item.total}</Text>
            </View>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { color: colors.teal, fontWeight: '700' },
});
```

- [ ] **Step 2: Write `app/(owner)/(tabs)/profile.tsx`**

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';

export default function OwnerProfile() {
  const user = useSessionStore((s) => s.user)!;
  const logout = useSessionStore((s) => s.logout);

  return (
    <View style={styles.container}>
      <Text style={typography.h1}>Mi perfil</Text>
      <Card>
        <Text style={typography.h2}>{user.name}</Text>
        <Text style={typography.caption}>{user.email}</Text>
      </Card>
      <Button title="Editar perfil" onPress={() => router.push('/(owner)/profile-edit')} />
      <Button title="Ver liquidaciones" onPress={() => router.push('/(owner)/settlements')} />
      <Button
        title="Cerrar sesión"
        onPress={() => {
          logout();
          router.replace('/mode-select');
        }}
        style={styles.logout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 },
  logout: { backgroundColor: colors.textSecondary },
});
```

- [ ] **Step 3: Write `app/(owner)/review/[bookingId].tsx`** (mirrors the driver review screen)

```tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';

export default function OwnerReview() {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');

  function submit() {
    // Mock only — no review persistence service call in this MVP pass.
    router.back();
  }

  return (
    <View style={styles.container}>
      <Text style={typography.h1}>Calificar al conductor</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setStars(n)}>
            <Text style={[styles.star, n <= stars && styles.starActive]}>★</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        placeholder="Dejá un comentario (opcional)"
        multiline
        value={comment}
        onChangeText={setComment}
      />
      <Button title="Enviar calificación" onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white, padding: 16, gap: 16 },
  starsRow: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 32, color: colors.border },
  starActive: { color: colors.warning },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
```

- [ ] **Step 4: Manual verification**

As the owner, check "Reservas" tab lists the same 3 bookings as the home panel; check "Perfil" tab shows name/email and the logout/edit/settlements buttons wire correctly (settlements route exists starting Task 20).

- [ ] **Step 5: Commit**

```bash
cd ~/mobile
git add "app/(owner)/(tabs)/bookings.tsx" "app/(owner)/(tabs)/profile.tsx" app/\(owner\)/review
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "Add owner bookings-received, profile tab, and review screen"
```

---

### Task 20: Owner — settlements (list + detail)

**Files:**
- Create: `app/(owner)/settlements/index.tsx`
- Create: `app/(owner)/settlements/[id].tsx`

**Interfaces:**
- Consumes: `getSettlementsForOwner`, `getSettlementById` (Task 16), `getBookingById` (Task 5), `Card` (Task 7).

- [ ] **Step 1: Write `app/(owner)/settlements/index.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/src/components/Card';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getSettlementsForOwner } from '@/src/services/paymentService';
import { Settlement } from '@/src/types';

export default function Settlements() {
  const user = useSessionStore((s) => s.user)!;
  const [settlements, setSettlements] = useState<Settlement[]>([]);

  useEffect(() => {
    getSettlementsForOwner(user.id).then(setSettlements);
  }, [user.id]);

  return (
    <View style={styles.container}>
      <Text style={typography.h1}>Liquidaciones</Text>
      <FlatList
        data={settlements}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(owner)/settlements/${item.id}`)}>
            <Card>
              <Text style={typography.h2}>{item.period}</Text>
              <Text style={styles.amount}>${item.totalAmount.toLocaleString('es-AR')}</Text>
              <Text style={typography.caption}>
                Comisión retenida: ${item.commissionRetained.toLocaleString('es-AR')}
              </Text>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 },
  amount: { color: colors.teal, fontWeight: '700', fontSize: 20, marginTop: 4 },
});
```

- [ ] **Step 2: Write `app/(owner)/settlements/[id].tsx`**

```tsx
import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Card } from '@/src/components/Card';
import { colors } from '@/src/theme/colors';
import { typography } from '@/src/theme/typography';
import { getSettlementById } from '@/src/services/paymentService';
import { getBookingById } from '@/src/services/bookingService';
import { Booking, Settlement } from '@/src/types';

export default function SettlementDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    getSettlementById(id).then(async (s) => {
      if (!s) return;
      setSettlement(s);
      const resolved = await Promise.all(s.bookingIds.map((bid) => getBookingById(bid)));
      setBookings(resolved.filter((b): b is Booking => !!b));
    });
  }, [id]);

  if (!settlement) return null;

  return (
    <View style={styles.container}>
      <Card>
        <Text style={typography.h1}>{settlement.period}</Text>
        <Text style={styles.amount}>${settlement.totalAmount.toLocaleString('es-AR')}</Text>
        <Text style={typography.caption}>
          Comisión retenida: ${settlement.commissionRetained.toLocaleString('es-AR')}
        </Text>
      </Card>
      <Text style={[typography.caption, styles.sectionTitle]}>RESERVAS INCLUIDAS</Text>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item }) => (
          <Card>
            <Text style={typography.body}>{item.driverName}</Text>
            <Text style={typography.caption}>
              {item.date} · {item.startTime} a {item.endTime} · ${item.total}
            </Text>
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 8 },
  amount: { color: colors.teal, fontWeight: '700', fontSize: 24, marginTop: 4 },
  sectionTitle: { marginTop: 8 },
});
```

- [ ] **Step 3: Manual verification**

From the owner profile tab, tap "Ver liquidaciones" — expected two rows (Junio 2026 $45.300, Mayo 2026 $38.900). Tap into Junio 2026 — expected the list of bookings that make up that settlement.

- [ ] **Step 4: Commit**

```bash
cd ~/mobile
git add app/\(owner\)/settlements
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "Add owner settlements list and detail screens"
```

---

### Task 21: Full end-to-end manual verification pass

**Files:** none (verification-only task).

- [ ] **Step 1: Run the automated test suite one final time**

```bash
cd ~/mobile
npm test
```

Expected: all tests PASS (parkingService, bookingService, useSessionStore).

- [ ] **Step 2: Run TypeScript's own compiler check**

```bash
cd ~/mobile
npx tsc --noEmit
```

Expected: no errors. Fix any type mismatches found (most likely: a `Booking`/`ParkingSpot` field typo introduced while copy-pasting between tasks).

- [ ] **Step 3: Full driver walkthrough in the simulator**

```bash
cd ~/mobile
npx expo start
```

Manually verify, in order: mode-select → "Entrar como Conductor" → search screen with 3 spots → tap "Cochera Palermo" → detail screen → "Reservar ahora" → confirm/pay screen shows correct 5% cargo math → "Pagar y confirmar" → success screen → "Ver mis reservas" → bookings tab shows the new CONFIRMADA booking → tap it → detail screen → "Cancelar reserva" → badge changes to CANCELADA → Perfil tab → "Editar perfil" → change name → save → name updates on the profile card → "Cerrar sesión" → back to mode-select.

- [ ] **Step 4: Full owner walkthrough in the simulator**

"Entrar como Propietario" → home panel shows $45.300 earnings and 3 upcoming bookings → "Mis cocheras" tab → 3 spots listed → "+ Publicar cochera" → fill form → "Publicar cochera" → returns to list → tap a spot → edit screen pre-filled → "Gestionar disponibilidad" → 7-day list renders → back → "Reservas" tab → same 3 bookings → "Perfil" tab → "Ver liquidaciones" → 2 settlements → tap one → booking breakdown renders → "Cerrar sesión".

- [ ] **Step 5: Fix anything broken during the walkthrough, then commit**

```bash
cd ~/mobile
git add -A
PRE_COMMIT_ALLOW_NO_CONFIG=1 git commit -m "Fix issues found during end-to-end manual walkthrough"
```

(Only run this commit if Step 3/4 actually required fixes — otherwise there's nothing to commit.)

---

## Self-Review Notes

- **Spec coverage:** every screen in the design doc's inventory (cuenta ×6, conductor ×7, propietario ×9) has a task producing it; system-triggered use cases (jobs 31-34) intentionally have no UI, matching the design doc.
- **Type consistency:** `Booking`, `ParkingSpot`, `Settlement`, `Review`, `User` are defined once in Task 3 and imported everywhere else — no task redefines an equivalent shape.
- **Mock-to-real swap path:** every screen calls a `src/services/*` function, never a mock fixture directly — confirmed by re-reading Tasks 10-20.
- **Scope note:** review submission and spot create/edit are visually complete but don't persist past navigation (`// Mock only` comments mark these) — acceptable for the Thursday demo goal; wiring them to `bookingService`/`parkingService` state is a fast follow-on, not blocking the walkthrough.
