import {
  addressInProvince, isSearchRequestComplete, requestToFilters, SearchRequest,
} from '@/src/services/searchRequest';

const base: SearchRequest = {
  provinceId: 'caba', mode: 'hourly', date: '2026-12-01', fromHour: 8, toHour: 10,
  stayFrom: '', stayTo: '', stayHour: 8, vehicleType: 'car', vehicleId: null,
};

describe('addressInProvince', () => {
  it('matches CABA addresses, and not Buenos Aires province', () => {
    const address = 'Av. Cabildo 2980, Belgrano, CABA';
    expect(addressInProvince(address, 'caba')).toBe(true);
    expect(addressInProvince(address, 'buenos-aires')).toBe(false);
  });

  it('matches Nominatim-style addresses by province', () => {
    expect(addressInProvince('Juncal 1980, Buenos Aires, Ciudad Autónoma de Buenos Aires, 1113, Argentina', 'caba')).toBe(true);
    expect(addressInProvince('San Martín 500, La Plata, Buenos Aires, 1900, Argentina', 'buenos-aires')).toBe(true);
    expect(addressInProvince('San Martín 500, Córdoba, Córdoba, 5000, Argentina', 'cordoba')).toBe(true);
    expect(addressInProvince('San Martín 500, Córdoba, Córdoba, 5000, Argentina', 'caba')).toBe(false);
  });

  it('does not take the street name for the province', () => {
    expect(addressInProvince('Córdoba 1500, Rosario, Santa Fe, Argentina', 'cordoba')).toBe(false);
  });
});

describe('search request', () => {
  it('needs a vehicle and a valid time range', () => {
    expect(isSearchRequestComplete(base)).toBe(true);
    expect(isSearchRequestComplete({ ...base, vehicleType: null })).toBe(false);
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
