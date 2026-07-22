import { PaymentMethod } from '@/src/types';

export const mockPaymentMethods: PaymentMethod[] = [
  {
    id: 'pm-1',
    type: 'card',
    brand: 'Visa',
    last4: '4523',
    label: 'MercadoPago · Visa terminada en 4523',
  },
  {
    id: 'pm-2',
    type: 'card',
    brand: 'Mastercard',
    last4: '8891',
    label: 'MercadoPago · Mastercard terminada en 8891',
  },
  {
    id: 'pm-3',
    type: 'cash',
    label: 'Efectivo',
  },
];
