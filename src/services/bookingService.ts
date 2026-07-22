import { Booking, ParkingSpot, Review } from '@/src/types';
import { mockBookingsForDriver, mockBookingsForOwner } from '@/src/mocks/bookings';
import { mockReviewsBySpot } from '@/src/mocks/reviews';
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

export async function getReviewsForSpot(parkingSpotId: string): Promise<Review[]> {
  return delay(mockReviewsBySpot[parkingSpotId] ?? []);
}
