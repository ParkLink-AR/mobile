import { Platform } from 'react-native';
import { t } from '@/src/i18n';

// The wordmark the transactional emails use too (served by the landing page).
const LOGO_URL = 'https://www.parklink.com.ar/assets/logos/logo-letras.png';
const NAVY = '#042347';
const TEAL = '#168B8D';
const MUTED = '#64778A';
const BORDER = '#DDE3EC';
// A4 (210 × 297 mm) in PDF points (1/72 in) -- what printToFileAsync takes as the page size.
const A4_WIDTH_PT = 595;
const A4_HEIGHT_PT = 842;

export interface ReceiptData {
  bookingId: string;
  spotTitle: string;
  spotAddress?: string;
  driverName: string;
  ownerName?: string;
  /** "15 de octubre de 2026, 15:00 a 17:00", or the stay's check-in and check-out. */
  when: string;
  duration: string;
  vehicle?: string;
  /** Pesos. */
  total: number;
  paidAt?: string;
  paymentRef?: string;
  status: string;
  /** Pesos that went back to the driver, if any. */
  refunded?: number;
  issuedAt: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pesos(amount: number): string {
  return `$${amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function row(label: string, value: string | undefined): string {
  if (!value) return '';
  return `<tr><td class="label">${escapeHtml(label)}</td><td class="value">${escapeHtml(value)}</td></tr>`;
}

/** The receipt as a self-contained HTML page, A4-sized, in the app's language. */
export function buildReceiptHtml(data: ReceiptData): string {
  const rows = [
    row(t('receipt.number'), data.bookingId),
    row(t('receipt.status'), data.status),
    row(t('receipt.spot'), data.spotTitle),
    row(t('receipt.address'), data.spotAddress),
    row(t('receipt.owner'), data.ownerName),
    row(t('receipt.driver'), data.driverName),
    row(t('receipt.when'), data.when),
    row(t('receipt.duration'), data.duration),
    row(t('receipt.vehicle'), data.vehicle),
    row(t('receipt.paidAt'), data.paidAt),
    row(t('receipt.paymentMethod'), 'Mercado Pago'),
    row(t('receipt.paymentRef'), data.paymentRef),
  ].join('');
  const refund = data.refunded && data.refunded > 0
    ? `<tr><td class="label">${escapeHtml(t('receipt.refunded'))}</td><td class="value refund">−${pesos(data.refunded)}</td></tr>`
    : '';

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(t('receipt.title'))}</title>
<style>
  /* The margin goes on the body, not @page: the PDF printer on phones ignores @page margins
     and would lay the content right at the paper's edge. */
  @page { size: A4; margin: 0; }
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: ${NAVY}; margin: 0; padding: 56px 60px; }
  .head { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid ${TEAL}; padding-bottom: 14px; }
  .head img { width: 150px; }
  .head .doc { text-align: right; }
  .head h1 { font-size: 20px; margin: 0; }
  .head .issued { font-size: 12px; color: ${MUTED}; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 22px; font-size: 13px; }
  td { padding: 9px 0; border-bottom: 1px solid ${BORDER}; vertical-align: top; }
  td.label { color: ${MUTED}; width: 38%; }
  td.value { font-weight: 600; text-align: right; word-break: break-word; }
  td.refund { color: #C62828; }
  .total { display: flex; justify-content: space-between; align-items: baseline; margin-top: 18px; padding: 14px 16px; background: #F7F8FA; border-radius: 10px; }
  .total span { font-size: 15px; font-weight: 600; }
  .total strong { font-size: 22px; color: ${NAVY}; }
  .note { margin-top: 26px; font-size: 11px; color: ${MUTED}; line-height: 1.5; }
</style></head>
<body>
  <div class="head">
    <img src="${LOGO_URL}" alt="ParkLink">
    <div class="doc"><h1>${escapeHtml(t('receipt.title'))}</h1><div class="issued">${escapeHtml(t('receipt.issued', { date: data.issuedAt }))}</div></div>
  </div>
  <table>${rows}${refund}</table>
  <div class="total"><span>${escapeHtml(t('receipt.total'))}</span><strong>${pesos(data.total)}</strong></div>
  <p class="note">${escapeHtml(t('receipt.note'))}</p>
</body></html>`;
}

/**
 * Turns the receipt into a PDF and opens the share sheet (save to files, WhatsApp, mail...).
 * On the web there's no file to share: the browser's print dialog opens instead, where it
 * can be saved as PDF.
 */
export async function shareReceipt(data: ReceiptData): Promise<void> {
  const html = buildReceiptHtml(data);
  if (Platform.OS === 'web') {
    const page = window.open('', '_blank');
    if (!page) throw new Error('popup blocked');
    page.document.write(html);
    page.document.close();
    page.onload = () => page.print();
    return;
  }
  // Loaded only here: they're native modules, and an app build made before they were added
  // would otherwise fail on startup just for importing them.
  const Print = await import('expo-print');
  const Sharing = await import('expo-sharing');
  const { uri } = await Print.printToFileAsync({ html, width: A4_WIDTH_PT, height: A4_HEIGHT_PT });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: t('receipt.title'),
    });
  }
}
