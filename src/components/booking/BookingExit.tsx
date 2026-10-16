import { t, useLanguage } from '@/src/i18n';
import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { ModalKeyboardAvoider } from '@/src/components/ModalKeyboardAvoider';
import { CodeInput } from '@/src/components/AccountForm';
import { getBookingExitApi, verifyBookingExitApi, type BookingExitApiResponse } from '@/src/api/booking';
import { ApiError } from '@/src/api/client';
import { formatLongDateTime } from '@/src/services/bookingDates';

type Role = 'driver' | 'owner';

function formatPesos(centavos: number): string {
  return `$${(centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * How a verified hourly booking ends. The driver sees their exit code to give the owner as they
 * take their vehicle out; the owner enters it ("Registrar salida"), which records when the vehicle
 * left and completes the booking. Afterwards both see when it left and, if it stayed past the end,
 * how long and what that comes to -- nothing within the grace period, everything past it. If the
 * code never gets entered the booking stays in progress and the owner is pointed at support.
 *
 * `endAt` is when the booking's time is over: after it, the owner is told what to do if the driver
 * left without handing over the code, and the driver is reminded the extra time is charged.
 */
export function BookingExit({
  bookingId, role, endAt, onChanged,
}: {
  bookingId: string;
  role: Role;
  endAt: string;
  /** Called once the owner recorded the departure -- the booking is now COMPLETED. */
  onChanged: () => void;
}) {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const [now] = useState(() => Date.now());
  const ended = new Date(endAt).getTime() <= now;
  const [exit, setExit] = useState<BookingExitApiResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getBookingExitApi(bookingId)
      .then((loaded) => {
        setExit(loaded);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  function openModal() {
    setCode('');
    setError(null);
    setModalVisible(true);
  }

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const closed = await verifyBookingExitApi(bookingId, code);
      setExit(closed);
      setModalVisible(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : t('booking.exit.verifyError'));
    } finally {
      setBusy(false);
    }
  }

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
      padding: 16, gap: 8,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: sc(14), fontWeight: '700', color: colors.text },
    hint: { fontSize: sc(13), color: colors.textSecondary, lineHeight: sc(18) },
    codeValue: { fontSize: sc(38), fontWeight: '800', letterSpacing: 8, color: colors.teal, textAlign: 'center', paddingVertical: 4 },
    fact: { fontSize: sc(14), color: colors.text, lineHeight: sc(20) },
    factStrong: { fontWeight: '700' },
    warn: { fontSize: sc(13), color: colors.warning, lineHeight: sc(18) },
    button: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: sc(11), paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.teal,
    },
    buttonText: { fontSize: sc(14), color: colors.white, fontWeight: '700' },
    overlay: { flex: 1, backgroundColor: 'rgba(4, 35, 71, 0.3)', justifyContent: 'center', padding: 32 },
    modalCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 20, gap: 14 },
    modalTitle: { fontSize: sc(16), fontWeight: '700', color: colors.text },
    modalSubtitle: { fontSize: sc(13), color: colors.textSecondary },
    errorText: { fontSize: sc(13), color: '#C62828', textAlign: 'center' },
    modalActionsRow: { flexDirection: 'row', gap: 8 },
    modalCancelBtn: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border,
    },
    modalCancelBtnText: { fontSize: sc(14), color: colors.textSecondary, fontWeight: '700' },
    modalConfirmBtn: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingVertical: 10, borderRadius: 10, backgroundColor: colors.teal,
    },
    modalConfirmBtnText: { fontSize: sc(14), color: colors.white, fontWeight: '700' },
  });

  // Nothing to show until it loads, and nothing worth a retry button if it can't: the rest of the
  // booking screen is still usable.
  if (!exit || failed) return null;

  // The vehicle already left: when, and what staying past the end amounts to.
  if (exit.exited_at) {
    const charged = exit.charged_minutes > 0;
    const amount = role === 'driver' ? exit.overstay_amount : exit.overstay_owner_amount;
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="log-out-outline" size={sc(18)} color={colors.teal} />
          <Text style={styles.title}>{t('booking.exit.doneTitle')}</Text>
        </View>
        <Text style={styles.fact}>
          {t('booking.exit.leftAt', { when: formatLongDateTime(exit.exited_at) })}
          {exit.closed_by === 'SUPPORT' ? ` ${t('booking.exit.bySupport')}` : ''}
        </Text>
        {charged ? (
          <Text style={[styles.fact, styles.factStrong]}>
            {t(role === 'driver' ? 'booking.exit.overstayDriver' : 'booking.exit.overstayOwner', {
              minutes: String(exit.charged_minutes),
              amount: formatPesos(amount ?? 0),
            })}
          </Text>
        ) : exit.overstay_minutes > 0 ? (
          <Text style={styles.hint}>{t('booking.exit.withinGrace', { minutes: String(exit.overstay_minutes) })}</Text>
        ) : (
          <Text style={styles.hint}>{t('booking.exit.onTime')}</Text>
        )}
      </View>
    );
  }

  if (!exit.awaiting) return null;

  if (role === 'driver') {
    if (!exit.exit_code) return null;
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="log-out-outline" size={sc(18)} color={colors.teal} />
          <Text style={styles.title}>{t('booking.exit.codeTitle')}</Text>
        </View>
        <Text style={styles.codeValue}>{exit.exit_code}</Text>
        <Text style={styles.hint}>{t('booking.exit.codeHint')}</Text>
        {ended && <Text style={styles.warn}>{t('booking.exit.endedWarning')}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="log-out-outline" size={sc(18)} color={colors.teal} />
        <Text style={styles.title}>{t('booking.exit.ownerTitle')}</Text>
      </View>
      <Text style={styles.hint}>{t(ended ? 'booking.exit.ownerHintEnded' : 'booking.exit.ownerHint')}</Text>
      <TouchableOpacity style={styles.button} onPress={openModal} activeOpacity={0.8}>
        <Ionicons name="keypad-outline" size={sc(16)} color={colors.white} />
        <Text style={styles.buttonText}>{t('booking.exit.ownerButton')}</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <ModalKeyboardAvoider>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.overlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>{t('booking.exit.modalTitle')}</Text>
                <Text style={styles.modalSubtitle}>{t('booking.exit.modalSubtitle')}</Text>
                <CodeInput value={code} onChange={setCode} length={4} autoFocus />
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <View style={styles.modalActionsRow}>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                    <Text style={styles.modalCancelBtnText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleConfirm} disabled={code.length !== 4 || busy}>
                    {busy ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <Text style={styles.modalConfirmBtnText}>{t('booking.exit.modalConfirm')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </ModalKeyboardAvoider>
      </Modal>
    </View>
  );
}
