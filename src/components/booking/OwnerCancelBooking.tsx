import { t, useLanguage } from '@/src/i18n';
import { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Modal, Pressable, TouchableWithoutFeedback, Keyboard, ActivityIndicator,
} from 'react-native';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { ModalKeyboardAvoider } from '@/src/components/ModalKeyboardAvoider';
import { ownerCancelBookingApi } from '@/src/api/booking';
import { ApiError } from '@/src/api/client';

const DANGER = '#C62828';
const REASON_MAX = 500;

/**
 * The owner calling off a booking they had already accepted, before it starts: they have to
 * say why (the driver reads it), and the driver gets everything back. ParkLink keeps count
 * of how often an owner does it.
 */
export function OwnerCancelBooking({ bookingId, onCancelled }: { bookingId: string; onCancelled: () => void }) {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function show() {
    setReason('');
    setError(null);
    setOpen(true);
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await ownerCancelBookingApi(bookingId, reason.trim());
      setOpen(false);
      onCancelled();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : t('owner.booking.cancel.error'));
    } finally {
      setBusy(false);
    }
  }

  const ready = reason.trim().length > 0 && !busy;

  const styles = StyleSheet.create({
    button: { borderRadius: 12, borderWidth: 1.5, borderColor: DANGER, paddingVertical: 14, alignItems: 'center' },
    buttonText: { fontSize: sc(15), fontWeight: '600', color: DANGER },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
    sheet: { backgroundColor: colors.surface, borderRadius: 20, padding: 22, gap: 12 },
    title: { fontSize: sc(17), fontWeight: '700', color: colors.text },
    body: { fontSize: sc(13), color: colors.textSecondary, lineHeight: sc(19) },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, minHeight: sc(90),
      fontSize: sc(14), color: colors.text, textAlignVertical: 'top',
    },
    error: { fontSize: sc(13), color: DANGER },
    actions: { flexDirection: 'row', gap: 10 },
    backBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border },
    backText: { fontSize: sc(15), fontWeight: '600', color: colors.text },
    confirmBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: DANGER },
    confirmBtnDisabled: { backgroundColor: colors.border },
    confirmText: { fontSize: sc(15), fontWeight: '700', color: colors.white },
  });

  return (
    <>
      <Pressable style={styles.button} onPress={show}>
        <Text style={styles.buttonText}>{t('owner.booking.cancel.button')}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <ModalKeyboardAvoider>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.overlay}>
              <View style={styles.sheet}>
                <Text style={styles.title}>{t('owner.booking.cancel.title')}</Text>
                <Text style={styles.body}>{t('owner.booking.cancel.body')}</Text>
                <TextInput
                  style={styles.input}
                  value={reason}
                  onChangeText={(value) => setReason(value.slice(0, REASON_MAX))}
                  multiline
                  placeholder={t('owner.booking.cancel.placeholder')}
                  placeholderTextColor={colors.textSecondary}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <View style={styles.actions}>
                  <Pressable style={styles.backBtn} onPress={() => setOpen(false)}>
                    <Text style={styles.backText}>{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable style={[styles.confirmBtn, !ready && styles.confirmBtnDisabled]} onPress={confirm} disabled={!ready}>
                    {busy ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.confirmText}>{t('owner.booking.cancel.confirm')}</Text>}
                  </Pressable>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </ModalKeyboardAvoider>
      </Modal>
    </>
  );
}
