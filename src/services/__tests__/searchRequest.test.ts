import { isSearchRequestComplete, requestToFilters, SearchRequest } from '@/src/services/searchRequest';

const base: SearchRequest = {
  place: { label: 'Juncal 1980, CABA', lat: -34.59, lng: -58.39 }, mode: 'hourly', date: '2026-12-01', fromHour: 8, toHour: 10,
  stayFrom: '', stayTo: '', stayHour: 8, vehicleType: 'car', vehicleId: null,
};

describe('search request', () => {
  it('needs a vehicle and a valid time range', () => {
    expect(isSearchRequestComplete(base)).toBe(true);
    expect(isSearchRequestComplete({ ...base, vehicleType: null })).toBe(false);
    expect(isSearchRequestComplete({ ...base, place: null })).toBe(false);
    expect(isSearchRequestComplete({ ...base, toHour: 8 })).toBe(false);
    expect(isSearchRequestComplete({ ...base, mode: 'stay' })).toBe(false);
    expect(isSearchRequestComplete({ ...base, mode: 'stay', stayFrom: '2026-12-01', stayTo: '2026-12-03' })).toBe(true);
  });

  it('turns into the search filters', () => {
    expect(requestToFilters(base)).toMatchObject({ hourlyOnly: true, date: '2026-12-01', fromHour: 8, toHour: 10, vehicleType: 'car' });
    expect(requestToFilters({ ...base, mode: 'stay', stayFrom: '2026-12-01', stayTo: '2026-12-03' }))
      .toMatchObject({ stayOnly: true, stayFrom: '2026-12-01', stayTo: '2026-12-03' });
  });
});
