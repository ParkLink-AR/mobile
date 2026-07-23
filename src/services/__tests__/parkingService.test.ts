import { searchParkingSpots, getParkingSpotDetail } from '@/src/services/parkingService';
import { getDriverVisiblePrice } from '@/src/services/utils';

describe('parkingService', () => {
  it('returns all active spots when no filters are given', async () => {
    const spots = await searchParkingSpots();
    expect(spots.length).toBeGreaterThan(0);
    expect(spots.every((s) => s.active)).toBe(true);
  });

  it('filters spots by max price', async () => {
    const spots = await searchParkingSpots({ maxPrice: 900 });
    expect(spots.every((s) => getDriverVisiblePrice(s.pricePerHour) <= 900)).toBe(true);
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
