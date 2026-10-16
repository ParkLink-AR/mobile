import { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { t } from '@/src/i18n';
import { useFocusEffect } from 'expo-router';
import { getMyDebtsApi, type DebtApiResponse } from '@/src/api/booking';
import { formatShortDateFromISO } from '@/src/services/bookingDates';

/**
 * What the driver owes for staying past the end of a booking: charged on their next reservation,
 * never blocking it. The app tells them before they get to the payment, and itemises it on the
 * confirmation -- see DebtBreakdown.
 */
export interface Debt {
  id: string;
  status: 'PENDING' | 'RESERVED' | 'PAID';
  /** Pesos. */
  amount: number;
  /** How long past the end they stayed (all of it was charged). */
  minutes: number;
  /** The booking that was overstayed, and where. */
  bookingId: string;
  bookingStart: string;
  spotTitle: string;
  /** The booking whose payment includes it, once one does. */
  chargedBookingId?: string;
  paidAt?: string;
}

export function toDebt(api: DebtApiResponse): Debt {
  return {
    id: api.id,
    status: api.status,
    amount: api.amount / 100,
    minutes: api.minutes,
    bookingId: api.booking_id,
    bookingStart: api.booking_start,
    spotTitle: api.parking_spot_title,
    chargedBookingId: api.charged_booking_id,
    paidAt: api.paid_at,
  };
}

/** What a new booking would add to its price: the debts nobody has asked for yet. */
export function pendingTotal(debts: Debt[]): number {
  return debts.filter((debt) => debt.status === 'PENDING').reduce((total, debt) => total + debt.amount, 0);
}

/** "12/10/2026": the day of the booking a debt comes from. */
export function debtBookingDay(debt: Debt): string {
  return formatShortDateFromISO(debt.bookingStart);
}

export interface MyDebts {
  loading: boolean;
  /** Every debt, newest first. */
  debts: Debt[];
  /** Pesos -- what the next booking carries. */
  pending: number;
  /** The pending ones, the lines of the confirmation's breakdown. */
  pendingDebts: Debt[];
  reload: () => void;
}

/**
 * The caller's debts, reloaded every time the screen is shown. A failed load reads as "owes
 * nothing" here: the server charges what is owed either way, so this only decides whether the
 * heads-up is shown.
 */
export function useMyDebts(): MyDebts {
  const [loading, setLoading] = useState(true);
  const [debts, setDebts] = useState<Debt[]>([]);

  const reload = useCallback(() => {
    getMyDebtsApi()
      .then((response) => setDebts((response?.debts ?? []).map(toDebt)))
      .catch(() => setDebts([]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const pendingDebts = debts.filter((debt) => debt.status === 'PENDING');
  return { loading, debts, pending: pendingTotal(debts), pendingDebts, reload };
}

/** "$640" or "$533,33": whole pesos without decimals, otherwise with two -- a balance can have centavos. */
export function formatDebtPesos(pesos: number): string {
  const whole = Math.abs(pesos - Math.round(pesos)) < 0.005;
  return `$${pesos.toLocaleString('es-AR', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })}`;
}

/**
 * The balance the booking took on when it was created can differ from the one the confirmation
 * showed (it was paid, or released, or a new one appeared in between). The driver is told the new
 * total before the checkout opens and can back out; the held slot simply expires. Resolves true
 * to go on to the checkout. Where Alert has no buttons (web) it just goes on: the checkout itself
 * itemises the amount.
 */
export function confirmChangedTotal(newTotalPesos: number): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(true);
  return new Promise((resolve) => {
    Alert.alert(
      t('debts.alert.changedTitle'),
      t('debts.alert.changedBody', { total: formatDebtPesos(newTotalPesos) }),
      [
        { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('debts.alert.continue'), onPress: () => resolve(true) },
      ],
      { cancelable: false },
    );
  });
}

/** Whether the debt a created booking took on (centavos) is not what the confirmation showed (pesos). */
export function debtChanged(shownPesos: number, chargedCentavos: number | undefined): boolean {
  return Math.abs((chargedCentavos ?? 0) / 100 - shownPesos) >= 0.005;
}
