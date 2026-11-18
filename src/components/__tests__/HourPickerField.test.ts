import { formatHour } from '@/src/components/HourPickerField';

describe('HourPickerField formatHour', () => {
  it('formats standard 24h hours with leading zeros and minutes', () => {
    expect(formatHour(0)).toBe('00:00');
    expect(formatHour(8)).toBe('08:00');
    expect(formatHour(14)).toBe('14:00');
    expect(formatHour(23)).toBe('23:00');
  });

  it('formats hour 24 as 24:00 (end of day)', () => {
    expect(formatHour(24)).toBe('24:00');
  });
});
