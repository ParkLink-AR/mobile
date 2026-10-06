import { VehicleType } from '@/src/constants/vehicleTypes';

// El backend no tiene un rol fijo por usuario: cualquiera puede operar como
// conductor o propietario. `ActiveMode` (useSessionStore) es el modo in-app
// que decide qué stack se muestra, no un campo del usuario.
export type UserRole = 'driver' | 'owner';

export type AccountType = 'driver' | 'owner' | 'both';

export interface User {
  id: string;
  name: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  role: UserRole;
  avatarInitials: string;
}

// Perfil real que devuelve auth-service (GET /users/{id}), usado por el
// flujo de autenticación real. `User` (arriba) sigue siendo el shape que
// consumen las pantallas ya construidas sobre datos mockeados (bookings,
// reviews, settlements).
export interface AuthUser {
  id: string;
  name: string;
  lastName: string;
  email: string;
  phone: string;
  dni?: string;
  avatarUrl?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  accountType: AccountType;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Una franja horaria publicada. dayOfWeek: 0=Lunes … 6=Domingo (mismo índice
// que AvailabilityPicker.DaySchedule.dayIndex). Puede haber más de una
// entrada para el mismo día (turno partido) -- parking-service ya lo valida
// y lo persiste así.
export interface ScheduleEntry {
  dayOfWeek: number;
  startHour: number;
  endHour: number;
}

export interface ParkingSpot {
  id: string;
  ownerId: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  // null cuando hourlyEnabled es false (una cochera "solo estadía" no
  // publica precio ni horario por hora).
  hourlyEnabled: boolean;
  pricePerHour: number | null;
  // No-null implica que pricePerHour no aplica -- el precio real depende de
  // qué tipo de vehículo elija el conductor (ver getVehiclePricePerHour en
  // parkingService.ts).
  pricePerHourByVehicleType: Partial<Record<VehicleType, number>> | null;
  photoUrl: string;
  photos: string[];
  covered: boolean;
  vehicleTypes: VehicleType[];
  // Lugares idénticos que se alquilan contra este id (playa). 1 = cochera común.
  capacity: number;
  // "Estadía": alquiler por día/semana/mes en vez de por hora. Los tres
  // precios y maxStayDays vienen en null cuando stayEnabled es false.
  stayEnabled: boolean;
  pricePerDay: number | null;
  pricePerWeek: number | null;
  pricePerMonth: number | null;
  stayAvailableFrom: string | null; // YYYY-MM-DD
  // Ventana acotada de estadía (p.ej. "solo este fin de semana") -- null =
  // sin fecha límite.
  stayAvailableUntil: string | null; // YYYY-MM-DD
  maxStayDays: number | null;
  rating: number;
  reviewCount: number;
  tags: string[];
  schedule: ScheduleEntry[];
  distanceMeters: number;
  description: string;
  descriptionKey?: string;
  active: boolean;
  status: 'pending_review' | 'active' | 'paused' | 'rejected' | 'deleted';
  // Fotos de respaldo para que un admin revise la cochera -- nunca se
  // muestran al conductor. reviewNotes es el motivo si status es 'rejected'.
  verificationPhotos: string[];
  reviewNotes: string | null;
}

export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'PENDING_OWNER_APPROVAL'
  // Reached from CONFIRMED once the owner enters the driver's in-person
  // verification code correctly. Converges into COMPLETED the same way CONFIRMED
  // does once the booking's time window ends -- see booking-service's
  // ExpireCompletedBookings.
  | 'IN_PROGRESS';

export interface Booking {
  id: string;
  parkingSpotId: string;
  parkingSpotTitle: string;
  driverId: string;
  driverName: string;
  ownerId: string;
  kind: 'HOURLY' | 'STAY';
  date: string;
  // Fecha de checkout, ART (YYYY-MM-DD) -- igual a `date` para HOURLY; en
  // STAY cae en un día posterior (el checkout es a la misma hora que el
  // check-in, ver stays.service.ts en parking-service, no medianoche).
  endDate: string;
  startTime: string;
  endTime: string;
  hours: number;
  // Timestamps ISO crudos del inicio/fin (ver BookingDateRange en bookingDates.ts).
  startAt?: string;
  endAt?: string;
  subtotal: number;
  // What the spot's owner earns from this booking, in pesos -- only known on the owner's
  // side. `total` is always what the driver was charged.
  ownerEarnings?: number;
  // PENDING_OWNER_APPROVAL only: when it's auto-cancelled (and refunded) if the owner
  // hasn't approved or rejected it yet.
  ownerResponseDeadline?: string;
  serviceCharge: number;
  total: number;
  status: BookingStatus;
  paymentId?: string;
  // Set once, the moment Mercado Pago's payment was actually confirmed -- absent means
  // never paid, regardless of status (e.g. EXPIRED, or CANCELLED before ever reaching
  // PENDING_OWNER_APPROVAL). Not the same as "safe to show as paid" -- see how
  // bookings/[id].tsx gates the payment card on both this AND status.
  paidAt?: string;
  // Why a CANCELLED booking got there: 'DRIVER_CANCELLED', 'OWNER_REJECTED' or
  // 'OWNER_EXPIRED' (the owner never answered in time).
  cancellationReason?: string;
  // Only ever populated for the booking's own driver (booking-service omits it for
  // everyone else) -- the 4-digit code the driver reads aloud to the spot's owner
  // in person. Present once status is CONFIRMED; absent before or once verified
  // (server clears attempts tracking but keeps the code, we just stop needing it).
  verificationCode?: string;
  verifiedAt?: string;
  // The vehicle the driver picked (optionally) from their own saved list when booking --
  // a snapshot taken at creation time, not a live reference (see VehiclePlate.tsx for how
  // it's rendered). No `id`, unlike Vehicle below: it's a copy, not a pointer to a row that
  // might since have been edited or deleted. Absent if the driver didn't pick one.
  vehicle?: VehicleSnapshot;
}

// ISO 3166-1 alpha-2 -- drives which country name/flag VehiclePlate.tsx renders on the
// plate graphic. Kept to the handful of countries the picker actually offers (see
// VEHICLE_COUNTRIES in auth-service's schemas.py), not every country in the world.
export type VehicleCountry = 'AR' | 'BR' | 'UY' | 'PY' | 'CL' | 'BO';

export interface VehicleSnapshot {
  plate: string;
  brand: string;
  model: string;
  country: VehicleCountry;
}

export interface Vehicle extends VehicleSnapshot {
  id: string;
}

export interface Review {
  id: string;
  bookingId: string;
  fromUserId: string;
  reviewerName: string;
  toUserId: string;
  stars: number;
  comment: string;
}

export type SettlementStatus = 'PENDING' | 'PAID';

export interface SettlementPayout {
  id: string;
  bookingId: string;
  grossAmount: number; // centavos
  commissionAmount: number; // centavos
  netAmount: number; // centavos
}

// Un lote de pago del propietario: un admin agrupa todo su saldo pendiente
// (uno o más payouts de bookings ya completados+pagados+24h) en una única
// transferencia. No hay concepto de "período" -- ocurre cuando un admin lo
// arma, no en un calendario fijo. El propietario ve tanto un draft PENDING
// ("en preparación", recién armado por un admin) como uno ya PAID
// ("liquidado") -- ver getUserSettlementsApi.
export interface Settlement {
  id: string;
  ownerId: string;
  grossAmount: number; // centavos
  commissionAmount: number; // centavos
  netAmount: number; // centavos
  status: SettlementStatus;
  proofUrl: string | null;
  paidAt: string | null;
  paidByAdminId: string | null;
  createdByAdminId: string;
  createdAt: string;
  payouts?: SettlementPayout[]; // sólo presente en el fetch de detalle
}

