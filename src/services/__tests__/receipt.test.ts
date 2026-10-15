jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

import { buildReceiptHtml, ReceiptData } from '../receipt';

const receipt: ReceiptData = {
  bookingId: '952c099a-3bb8-486b-a0c1-c74352bdcb22',
  spotTitle: 'Cochera Palermo Soho',
  spotAddress: 'Honduras 4800, Palermo, CABA',
  driverName: 'Lucas Gomez',
  ownerName: 'Camila Fernandez',
  when: '6 de octubre de 2026, 08:00 a 12:00',
  duration: '4 hs',
  vehicle: 'Toyota · Corolla · AE123BC',
  total: 35700,
  paidAt: '5 de octubre de 2026, 08:00',
  paymentRef: 'demo-balance-1006',
  status: 'Finalizada',
  issuedAt: '15 de octubre de 2026, 11:20',
};

describe('buildReceiptHtml', () => {
  it('has the booking, who, when and what was paid', () => {
    const html = buildReceiptHtml(receipt);

    for (const value of [receipt.bookingId, receipt.spotTitle, receipt.driverName, receipt.when, receipt.paymentRef!]) {
      expect(html).toContain(value);
    }
    expect(html).toContain('$35.700,00');
    expect(html).not.toContain('Reembolsado');
  });

  it('shows what went back on a cancelled booking', () => {
    expect(buildReceiptHtml({ ...receipt, refunded: 17850 })).toContain('−$17.850,00');
  });

  it("escapes what users wrote, so a spot's title can't inject markup", () => {
    const html = buildReceiptHtml({ ...receipt, spotTitle: '<img src=x onerror=alert(1)>' });

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});
