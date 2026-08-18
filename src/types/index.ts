// El backend no tiene un rol fijo por usuario: cualquiera puede operar como
// conductor o propietario. `ActiveMode` (useSessionStore) es el modo in-app
// que decide qué stack se muestra, no un campo del usuario.
export type UserRole = 'driver' | 'owner';

export interface User {
  id: string;
  name: string;
  email: string;
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
  email: string;
  emailVerified: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
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
  scheduleStartHour: number;
  scheduleEndHour: number;
  distanceMeters: number;
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
  reviewerName: string;
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

export type PaymentMethodType = 'card' | 'cash';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  brand?: 'Visa' | 'Mastercard';
  last4?: string;
  label: string;
}
