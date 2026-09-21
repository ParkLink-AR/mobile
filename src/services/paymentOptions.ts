import { t } from '@/src/i18n';
import { PaymentMethod } from '@/src/types';

export const MERCADOPAGO_METHOD_ID = 'mercadopago';
export const CASH_METHOD_ID = 'cash';

/** The two real ways to pay for a booking today. "Mercado Pago" isn't
 * translated -- it's a brand name, shown the same in every locale. Called as
 * a function (not a module-level constant) so the labels re-evaluate on
 * every render, same as every other t()-driven list in the app. */
export function getPaymentOptions(): PaymentMethod[] {
  return [
    { id: MERCADOPAGO_METHOD_ID, type: 'card', label: 'Mercado Pago' },
    { id: CASH_METHOD_ID, type: 'cash', label: t('payment.method.cash') },
  ];
}
