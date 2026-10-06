import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, TextInput, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { ModalKeyboardAvoider } from '@/src/components/ModalKeyboardAvoider';
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
      paddingVertical: 11, borderRadius: 10, backgroundColor: colors.teal,
    },
    buttonDisabled: { backgroundColor: colors.border },
    buttonText: { color: colors.white, fontWeight: '700' },
    buttonTextDisabled: { color: colors.textSecondary },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(4, 35, 71, 0.3)',
      justifyContent: 'center',
      padding: 32,
    },
    modalCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 20, gap: 14 },
    modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    modalSubtitle: { fontSize: 13, color: colors.textSecondary },
    codeInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 12,
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: 8,
      textAlign: 'center',
      color: colors.text,
    },
    errorText: { fontSize: 13, color: '#C62828', textAlign: 'center' },
    modalActionsRow: { flexDirection: 'row', gap: 8 },
    modalCancelBtn: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border,
    },
    modalCancelBtnText: { color: colors.textSecondary, fontWeight: '700' },
    modalConfirmBtn: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingVertical: 10, borderRadius: 10, backgroundColor: colors.teal,
    },
    modalConfirmBtnText: { color: colors.white, fontWeight: '700' },
  });

  if (windowState === 'closed') return null;

  if (windowState === 'not_open_yet') {
    return (
      <View style={[styles.button, styles.buttonDisabled]}>
        <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
        <Text style={styles.buttonTextDisabled}>{verificationAvailableFromLabel(startAt, now)}</Text>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity style={styles.button} onPress={openModal} activeOpacity={0.8}>
        <Ionicons name="keypad-outline" size={16} color={colors.white} />
        <Text style={styles.buttonText}>{t('owner.spot.requests.verifyCode')}</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <ModalKeyboardAvoider>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.overlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>{t('owner.spot.requests.verifyCodeModalTitle')}</Text>
                <Text style={styles.modalSubtitle}>{t('owner.spot.requests.verifyCodeModalSubtitle')}</Text>
                <TextInput
                  style={styles.codeInput}
                  value={code}
                  onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="0000"
                  placeholderTextColor={colors.textSecondary}
                  autoFocus
                />
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
