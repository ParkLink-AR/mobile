import { PaymentMethod } from '@/src/types';
import { t } from '@/src/i18n';

export function getMockPaymentMethods(): PaymentMethod[] {
  return [
    {
      id: 'pm-1',
      type: 'card',
      brand: 'Visa',
      last4: '4523',
      label: t('payment.method.visa', { last4: '4523' }),
    },
    {
      id: 'pm-2',
      type: 'card',
      brand: 'Mastercard',
      last4: '8891',
      label: t('payment.method.mastercard', { last4: '8891' }),
    },
    {
      id: 'pm-3',
      type: 'cash',
      label: t('payment.method.cash'),
    },
  ];
}

/** @deprecated use getMockPaymentMethods() so labels are translated */
export const mockPaymentMethods: PaymentMethod[] = getMockPaymentMethods();
