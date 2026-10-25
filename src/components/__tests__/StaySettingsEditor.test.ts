import {
  EMPTY_STAY_SETTINGS,
  halfDayCostsAsMuchAsADay,
  isStayPricingValid,
  stayPricesByVehicleTypeToForm,
  stayPricesByVehicleTypeToNumbers,
  StaySettingsFormValue,
} from '@/src/components/StaySettingsEditor';

jest.mock('@/src/store/useCommissionStore', () => ({ useCommissionStore: jest.fn() }));

const STAY: StaySettingsFormValue = {
  ...EMPTY_STAY_SETTINGS,
  stayEnabled: true,
  pricePerDay: '9000',
  pricePerWeek: '50000',
  pricePerMonth: '150000',
  maxStayDays: '30',
};

describe('media estadía in the stay form', () => {
  it('starts off', () => {
    expect(EMPTY_STAY_SETTINGS.halfDayEnabled).toBe(false);
    expect(EMPTY_STAY_SETTINGS.pricePerHalfDay).toBe('');
  });

  it('needs its price once it is on, and not before', () => {
    expect(isStayPricingValid(STAY, ['car'])).toBe(true);
    expect(isStayPricingValid({ ...STAY, halfDayEnabled: true }, ['car'])).toBe(false);
    expect(isStayPricingValid({ ...STAY, halfDayEnabled: true, pricePerHalfDay: '5000' }, ['car'])).toBe(true);
  });

  it('priced per vehicle, needs one for every vehicle the spot takes', () => {
    const byVehicle: StaySettingsFormValue = {
      ...STAY,
      pricePerVehicleType: true,
      halfDayEnabled: true,
      pricesByVehicleType: {
        car: { day: '9000', week: '50000', month: '150000', halfDay: '5000' },
        suv: { day: '12000', week: '60000', month: '180000', halfDay: '' },
      },
    };
    expect(isStayPricingValid(byVehicle, ['car', 'suv'])).toBe(false);
    byVehicle.pricesByVehicleType.suv!.halfDay = '7000';
    expect(isStayPricingValid(byVehicle, ['car', 'suv'])).toBe(true);
    expect(stayPricesByVehicleTypeToNumbers(byVehicle, ['car', 'suv'])).toEqual({
      car: { day: 9000, week: 50000, month: 150000, halfDay: 5000 },
      suv: { day: 12000, week: 60000, month: 180000, halfDay: 7000 },
    });
  });

  it("doesn't send a 12-hour price per vehicle while it's off", () => {
    const off: StaySettingsFormValue = {
      ...STAY,
      pricePerVehicleType: true,
      pricesByVehicleType: { car: { day: '9000', week: '50000', month: '150000', halfDay: '5000' } },
    };
    expect(stayPricesByVehicleTypeToNumbers(off, ['car'])).toEqual({ car: { day: 9000, week: 50000, month: 150000 } });
  });

  it('loads a saved 12-hour price back into the form', () => {
    expect(stayPricesByVehicleTypeToForm({ car: { day: 9000, week: 50000, month: 150000, halfDay: 5000 } })).toEqual({
      car: { day: '9000', week: '50000', month: '150000', halfDay: '5000' },
    });
    expect(stayPricesByVehicleTypeToForm({ car: { day: 9000, week: 50000, month: 150000 } }).car?.halfDay).toBe('');
  });

  it('warns when 12 hours cost as much as the whole day', () => {
    expect(halfDayCostsAsMuchAsADay({ ...STAY, halfDayEnabled: true, pricePerHalfDay: '5000' }, ['car'])).toBe(false);
    expect(halfDayCostsAsMuchAsADay({ ...STAY, halfDayEnabled: true, pricePerHalfDay: '9000' }, ['car'])).toBe(true);
    expect(halfDayCostsAsMuchAsADay({ ...STAY, halfDayEnabled: false, pricePerHalfDay: '9000' }, ['car'])).toBe(false);
  });
});
