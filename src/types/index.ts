// El backend no tiene un rol fijo por usuario: cualquiera puede operar como
// conductor o propietario. `ActiveMode` (useSessionStore) es el modo in-app
// que decide qué stack se muestra, no un campo del usuario.
export type UserRole = 'driver' | 'owner';

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
  pricePerHour: number;
  photoUrl: string;
  photos: string[];
  covered: boolean;
  // Lugares idénticos que se alquilan contra este id (playa). 1 = cochera común.
  capacity: number;
  rating: number;
  reviewCount: number;
  tags: string[];
  schedule: ScheduleEntry[];
  distanceMeters: number;
  description: string;
  descriptionKey?: string;
  active: boolean;
  instantBooking: boolean;
}

export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'PENDING_OWNER_APPROVAL';

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
  paymentId?: string;
  confirmedAt?: string;
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
