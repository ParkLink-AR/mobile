import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { ModalKeyboardAvoider } from '@/src/components/ModalKeyboardAvoider';
import { CodeInput } from '@/src/components/AccountForm';
import { verifyBookingCodeApi } from '@/src/api/booking';
import { ApiError } from '@/src/api/client';
import { verificationWindowState, verificationAvailableFromLabel } from '@/src/services/verificationWindow';

interface VerifyArrivalCodeProps {
  bookingId: string;
  startAt: string;
  endAt: string;
  /** Called once the code was accepted -- the booking is now IN_PROGRESS. */
  onVerified: () => void;
}

// How often the button re-checks whether the verification window has opened, so it
// enables itself while the owner is looking at the screen instead of needing a reload.
const WINDOW_RECHECK_MS = 30 * 1000;

/** The owner's "Verificar código" button for a CONFIRMED booking, plus the modal where they
 * type the 4-digit code the driver reads to them on arrival. Only enabled within the
 * booking's verification window (see verificationWindow.ts); before it opens it shows
 * when it will, and once the booking has ended it renders nothing. */
export function VerifyArrivalCode({ bookingId, startAt, endAt, onVerified }: VerifyArrivalCodeProps) {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const [now, setNow] = useState(() => new Date());
  const [modalVisible, setModalVisible] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), WINDOW_RECHECK_MS);
    return () => clearInterval(interval);
  }, []);

  const windowState = verificationWindowState(startAt, endAt, now);

  function openModal() {
    setCode('');
    setError(null);
    setModalVisible(true);
  }

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await verifyBookingCodeApi(bookingId, code);
      setModalVisible(false);
      onVerified();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : t('owner.spot.requests.errorVerifyCode'));
    } finally {
      setBusy(false);
    }
  }

  const styles = StyleSheet.create({
    button: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: sc(11), paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.teal,
    },
    buttonDisabled: { backgroundColor: colors.border },
    buttonText: { fontSize: sc(14), color: colors.white, fontWeight: '700' },
    buttonTextDisabled: { fontSize: sc(13), color: colors.textSecondary, flexShrink: 1, textAlign: 'center' },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(4, 35, 71, 0.3)',
      justifyContent: 'center',
      padding: 32,
    },
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

  if (windowState === 'closed') return null;

  if (windowState === 'not_open_yet') {
    return (
      <View style={[styles.button, styles.buttonDisabled]}>
        <Ionicons name="time-outline" size={sc(16)} color={colors.textSecondary} />
        <Text style={styles.buttonTextDisabled}>{verificationAvailableFromLabel(startAt, now)}</Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity style={styles.button} onPress={openModal} activeOpacity={0.8}>
        <Ionicons name="keypad-outline" size={sc(16)} color={colors.white} />
        <Text style={styles.buttonText}>{t('owner.spot.requests.verifyCode')}</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <ModalKeyboardAvoider>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.overlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>{t('owner.spot.requests.verifyCodeModalTitle')}</Text>
                <Text style={styles.modalSubtitle}>{t('owner.spot.requests.verifyCodeModalSubtitle')}</Text>
                <CodeInput value={code} onChange={setCode} length={4} autoFocus />
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <View style={styles.modalActionsRow}>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalVisible(false)}>
                    <Text style={styles.modalCancelBtnText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalConfirmBtn}
                    onPress={handleConfirm}
                    disabled={code.length !== 4 || busy}
                  >
                    {busy ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <Text style={styles.modalConfirmBtnText}>{t('owner.spot.requests.verifyCodeConfirm')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </ModalKeyboardAvoider>
      </Modal>
    </>
  );
}
