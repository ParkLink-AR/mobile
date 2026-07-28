import { t } from '@/src/i18n';
import { Review } from '@/src/types';
import { mockOwner } from './users';
import { mockParkingSpots } from './parkingSpots';

export const mockReviewsBySpot: Record<string, Review[]> = {
  [mockParkingSpots[0].id]: [
    {
      id: 'review-1-1',
      bookingId: 'booking-2',
      fromUserId: 'user-sofia-r',
      reviewerName: 'Sofía R.',
      toUserId: mockOwner.id,
      stars: 5,
      comment: 'Excelente ubicación, muy fácil de encontrar.',
    },
    {
      id: 'review-1-2',
      bookingId: 'booking-6',
      fromUserId: 'user-lucas-m',
      reviewerName: 'Lucas M.',
      toUserId: mockOwner.id,
      stars: 5,
      comment: 'Todo perfecto, el dueño fue muy amable.',
    },
    {
      id: 'review-1-3',
      bookingId: 'booking-13',
      fromUserId: 'user-valentina-g',
      reviewerName: 'Valentina G.',
      toUserId: mockOwner.id,
      stars: 4,
      comment: 'Buena cochera, un poco justa de espacio para autos grandes.',
    },
  ],
  [mockParkingSpots[1].id]: [
    {
      id: 'review-2-1',
      bookingId: 'booking-7',
      fromUserId: 'user-nicolas-f',
      reviewerName: 'Nicolás F.',
      toUserId: mockOwner.id,
      stars: 5,
      comment: 'Cómoda y segura, la recomiendo.',
    },
    {
      id: 'review-2-2',
      bookingId: 'booking-14',
      fromUserId: 'user-camila-s',
      reviewerName: 'Camila S.',
      toUserId: mockOwner.id,
      stars: 4,
      comment: 'Bien ubicada pero un poco cara para lo que ofrece.',
    },
  ],
  [mockParkingSpots[2].id]: [
    {
      id: 'review-3-1',
      bookingId: 'booking-8',
      fromUserId: 'user-tomas-d',
      reviewerName: 'Tomás D.',
      toUserId: mockOwner.id,
      stars: 5,
      comment: t('mocks.reviews.comment.example'),
    },
    {
      id: 'review-3-2',
      bookingId: 'booking-15',
      fromUserId: 'user-agustina-p',
      reviewerName: 'Agustina P.',
      toUserId: mockOwner.id,
      stars: 4,
      comment: 'Buen trato del propietario.',
    },
  ],
  [mockParkingSpots[3].id]: [
    {
      id: 'review-4-1',
      bookingId: 'booking-9',
      fromUserId: 'user-martin-g',
      reviewerName: 'Martín G.',
      toUserId: mockOwner.id,
      stars: 4,
      comment: 'Cochera subterránea con buena vigilancia.',
    },
    {
      id: 'review-4-2',
      bookingId: 'booking-9',
      fromUserId: 'user-carla-p',
      reviewerName: 'Carla P.',
      toUserId: mockOwner.id,
      stars: 4,
      comment: 'Un poco difícil de encontrar la entrada la primera vez.',
    },
  ],
  [mockParkingSpots[4].id]: [
    {
      id: 'review-5-1',
      bookingId: 'booking-10',
      fromUserId: 'user-julian-t',
      reviewerName: 'Julián T.',
      toUserId: mockOwner.id,
      stars: 4,
      comment: 'Cumple lo que promete, nada más que agregar.',
    },
  ],
  [mockParkingSpots[5].id]: [
    {
      id: 'review-6-1',
      bookingId: 'booking-11',
      fromUserId: 'user-sofia-r',
      reviewerName: 'Sofía R.',
      toUserId: mockOwner.id,
      stars: 5,
      comment: 'La mejor cochera que usé, impecable.',
    },
    {
      id: 'review-6-2',
      bookingId: 'booking-11',
      fromUserId: 'user-lucas-m',
      reviewerName: 'Lucas M.',
      toUserId: mockOwner.id,
      stars: 5,
      comment: 'Vale cada peso, muy segura.',
    },
  ],
  [mockParkingSpots[6].id]: [
    {
      id: 'review-7-1',
      bookingId: 'booking-12',
      fromUserId: 'user-valentina-g',
      reviewerName: 'Valentina G.',
      toUserId: mockOwner.id,
      stars: 5,
      comment: 'Muy cerca de todo, ideal para salir a comer.',
    },
    {
      id: 'review-7-2',
      bookingId: 'booking-12',
      fromUserId: 'user-nicolas-f',
      reviewerName: 'Nicolás F.',
      toUserId: mockOwner.id,
      stars: 4,
      comment: 'Buena atención del propietario.',
    },
  ],
  [mockParkingSpots[7].id]: [
    {
      id: 'review-8-1',
      bookingId: 'booking-6',
      fromUserId: 'user-camila-s',
      reviewerName: 'Camila S.',
      toUserId: mockOwner.id,
      stars: 4,
      comment: 'Cumple para uso diario de oficina.',
    },
    {
      id: 'review-8-2',
      bookingId: 'booking-6',
      fromUserId: 'user-tomas-d',
      reviewerName: 'Tomás D.',
      toUserId: mockOwner.id,
      stars: 4,
      comment: 'Nada especial pero funciona bien.',
    },
  ],
};

export const mockReviews: Review[] = Object.values(mockReviewsBySpot).flat();
