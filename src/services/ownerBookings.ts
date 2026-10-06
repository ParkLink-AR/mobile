import { getBookingsForSpotApi, BookingApiResponse } from '@/src/api/booking';
import { getParkingSpotsForOwner } from './parkingService';
import { mapBookingDateRange, ownerEarningsFrom } from './bookingDates';
import { Booking } from '@/src/types';

// "Reservas reales" para las pantallas Hoy/Calendario del propietario:
// confirmadas, en curso (el conductor ya llegó y se verificó su código),
// pendientes de que el propietario las apruebe, o ya completadas. Se excluyen las que todavía no se pagaron (pueden expirar
// sin confirmarse) y las canceladas/rechazadas.
const RELEVANT_STATUSES = new Set(['CONFIRMED', 'IN_PROGRESS', 'PENDING_OWNER_APPROVAL', 'COMPLETED']);

function mapApiBooking(b: BookingApiResponse, spotTitle: string): Booking {
  const amount = typeof b.amount === 'number' ? b.amount / 100 : 0;

  return {
    id: b.id,
    parkingSpotId: b.parking_spot_id,
    parkingSpotTitle: spotTitle,
    driverId: b.user_id,
    driverName: '',
    ownerId: '',
    kind: b.kind,
    ...mapBookingDateRange(b.start, b.end),
    subtotal: amount,
    serviceCharge: 0,
    total: amount,
    ownerEarnings: ownerEarningsFrom(b),
    status: b.status as Booking['status'],
  };
}

/**
 * Todas las reservas "reales" en las cocheras de un propietario, agregadas
 * across todas sus cocheras. No hay un endpoint en booking-service para esto
 * hoy -- se arma client-side (1 fetch por cochera). Aceptable para la
 * cantidad de cocheras que maneja un propietario en este proyecto; si eso
 * cambia, conviene un endpoint agregado del lado del backend.
 */
export async function getOwnerBookings(ownerId: string): Promise<Booking[]> {
  const spots = await getParkingSpotsForOwner(ownerId);
  const perSpot = await Promise.all(
    spots.map((spot) =>
      getBookingsForSpotApi(spot.id).then((list) =>
        list
          .filter((b) => RELEVANT_STATUSES.has(b.status))
          .map((b) => mapApiBooking(b, spot.title)),
      ),
    ),
  );
  return perSpot.flat();
}
