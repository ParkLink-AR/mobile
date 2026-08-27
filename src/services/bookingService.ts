import { Booking, BookingStatus, ParkingSpot, Review } from '@/src/types';
import { mockBookingsForDriver, mockBookingsForOwner } from '@/src/mocks/bookings';
import { mockReviewsBySpot } from '@/src/mocks/reviews';
import { delay } from './utils';
import { BookingApiResponse, getBookingApi, getBookingHistoryApi } from '@/src/api/booking';
import { ParkingSpotApiResponse, getParkingSpotsByIds } from '@/src/api/parking';

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

// ── Real driver booking history (list + detail only -- see bookingService's
// module doc). Cancel and the owner side still run on the mock data above;
// these are separate, narrower functions instead of changing
// getBookingsForUser/getBookingById so the owner screens (out of scope) keep
// working exactly as before. ──────────────────────────────────────────────

export interface DriverBookingSummary {
  id: string;
  parkingSpotTitle: string;
  status: BookingStatus;
  date: string;
  startTime: string;
  endTime: string;
  total: number;
}

const ISO_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

function splitDateTime(iso: string): { date: string; time: string } {
  const match = ISO_DATE_TIME.exec(iso);
  return match ? { date: match[1], time: match[2] } : { date: iso, time: '' };
}

function toDriverBookingSummary(
  booking: BookingApiResponse,
  spotsById: Map<string, ParkingSpotApiResponse>
): DriverBookingSummary {
  const spot = spotsById.get(booking.parking_spot_id);
  const { date, time: startTime } = splitDateTime(booking.start);
  const { time: endTime } = splitDateTime(booking.end);
  return {
    id: booking.id,
    parkingSpotTitle: spot?.title ?? booking.parking_spot_id,
    status: booking.status as BookingStatus,
    date,
    startTime,
    endTime,
    total: booking.amount / 100, // amount is stored in centavos
  };
}

/**
 * One GET for every booking the user made, one batch GET for the parking
 * spots they reference -- two calls total, regardless of list size.
 */
export async function getDriverBookings(userId: string): Promise<DriverBookingSummary[]> {
  const bookings = await getBookingHistoryApi(userId);
  const spotIds = [...new Set(bookings.map((b) => b.parking_spot_id))];
  const spots = await getParkingSpotsByIds(spotIds);
  const spotsById = new Map(spots.map((spot) => [spot.id, spot]));
  return bookings.map((booking) => toDriverBookingSummary(booking, spotsById));
}

export async function getDriverBookingById(id: string): Promise<DriverBookingSummary> {
  const booking = await getBookingApi(id);
  const spots = await getParkingSpotsByIds([booking.parking_spot_id]);
  const spotsById = new Map(spots.map((spot) => [spot.id, spot]));
  return toDriverBookingSummary(booking, spotsById);
}
