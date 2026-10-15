import { t, useLanguage } from '@/src/i18n';
import { useState } from 'react';
import {
  View, Text, TextInput, Modal, TouchableOpacity, TouchableWithoutFeedback, Keyboard, ActivityIndicator, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ModalKeyboardAvoider } from '@/src/components/ModalKeyboardAvoider';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { createReportApi, ReportTargetType } from '@/src/api/reports';
import { ApiError } from '@/src/api/client';

const DANGER = '#C62828';
const DETAILS_MAX = 1000;

// The reasons offered for each kind of thing. The reason travels in Spanish whatever the
// app's language, since ParkLink staff read it in the admin panel.
type Reason = { key: string; es: string };

const REASONS: Record<Exclude<ReportTargetType, 'booking'>, Reason[]> = {
  spot: [
    { key: 'fake', es: 'La cochera no existe o es falsa' },
    { key: 'misleading', es: 'Fotos o datos engañosos' },
    { key: 'offPlatform', es: 'Me pidieron pagar por fuera de ParkLink' },
    { key: 'unsafe', es: 'Lugar inseguro' },
    { key: 'other', es: 'Otro motivo' },
  ],
  user: [
    { key: 'inappropriate', es: 'Comportamiento inapropiado' },
    { key: 'offPlatform', es: 'Me pidió pagar por fuera de ParkLink' },
    { key: 'fakeProfile', es: 'Perfil falso' },
    { key: 'other', es: 'Otro motivo' },
  ],
  review: [
    { key: 'offensive', es: 'Lenguaje ofensivo' },
    { key: 'falseReview', es: 'Es falsa o no corresponde a una reserva real' },
    { key: 'personalData', es: 'Muestra datos personales' },
    { key: 'other', es: 'Otro motivo' },
  ],
};

// A problem with a booking, as each side lives it.
const BOOKING_REASONS: Record<'owner' | 'driver', Reason[]> = {
  owner: [
    { key: 'noShow', es: 'El conductor no vino' },
    { key: 'overstay', es: 'El conductor se pasó del horario' },
    { key: 'damage', es: 'El conductor causó daños' },
    { key: 'other', es: 'Otro problema' },
  ],
  driver: [
    { key: 'spotTaken', es: 'La cochera estaba ocupada' },
    { key: 'noAccess', es: 'No me dejaron entrar' },
    { key: 'notAsDescribed', es: 'La cochera no era como se describía' },
    { key: 'other', es: 'Otro problema' },
  ],
};

interface ReportButtonProps {
  targetType: ReportTargetType;
  targetId: string;
  /** 'link' (flag + "Denunciar", default) or 'icon' (just the flag, for tight rows). */
  variant?: 'link' | 'icon';
  /** targetType 'booking': which side is reporting -- each one gets its own reasons. */
  bookingSide?: 'owner' | 'driver';
}

/** "Denunciar": a small link that opens a sheet to pick a reason and send it to ParkLink. */
export function ReportButton({ targetType, targetId, variant = 'link', bookingSide = 'driver' }: ReportButtonProps) {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function show() {
    setReason(null);
    setDetails('');
    setSent(false);
    setError(null);
    setOpen(true);
  }

  const reasons = targetType === 'booking' ? BOOKING_REASONS[bookingSide] : REASONS[targetType];
  const reasonKey = (key: string) => (targetType === 'booking' ? `report.bookingReason.${key}` : `report.reason.${key}`);

  async function send() {
    const chosen = reasons.find((r) => r.key === reason);
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      await createReportApi(targetType, targetId, chosen.es, details.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : t('report.error'));
    } finally {
      setBusy(false);
    }
  }

  const styles = StyleSheet.create({
    trigger: { flexDirection: 'row', alignItems: 'center', gap: sc(5), paddingVertical: 4 },
    triggerText: { fontSize: sc(13), color: colors.textSecondary, fontWeight: '600' },
    overlay: { flex: 1, backgroundColor: 'rgba(4, 35, 71, 0.3)', justifyContent: 'center', padding: 24 },
    card: { backgroundColor: colors.surface, borderRadius: 12, padding: 20, gap: 12 },
    title: { fontSize: sc(16), fontWeight: '700', color: colors.text },
    subtitle: { fontSize: sc(13), color: colors.textSecondary, lineHeight: sc(18) },
    option: {
      flexDirection: 'row', alignItems: 'center', gap: sc(10),
      paddingVertical: sc(10), paddingHorizontal: 12, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border,
    },
    optionActive: { borderColor: colors.teal, backgroundColor: colors.teal + '10' },
    optionText: { flex: 1, fontSize: sc(14), color: colors.text },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, minHeight: sc(80),
      fontSize: sc(14), color: colors.text, textAlignVertical: 'top',
    },
    error: { fontSize: sc(13), color: DANGER, textAlign: 'center' },
    actions: { flexDirection: 'row', gap: 8 },
    cancelBtn: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border,
    },
    cancelText: { fontSize: sc(14), color: colors.textSecondary, fontWeight: '700' },
    confirmBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: DANGER },
    confirmBtnDisabled: { backgroundColor: colors.border },
    confirmText: { fontSize: sc(14), color: colors.white, fontWeight: '700' },
    sentBox: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  });

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={show}
        accessibilityLabel={t('report.action')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="flag-outline" size={sc(14)} color={colors.textSecondary} />
        {variant === 'link' ? (
          <Text style={styles.triggerText}>{t(targetType === 'booking' ? 'report.bookingAction' : 'report.action')}</Text>
        ) : null}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <ModalKeyboardAvoider>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.overlay}>
              <View style={styles.card}>
                {sent ? (
                  <View style={styles.sentBox}>
                    <Ionicons name="checkmark-circle" size={sc(40)} color={colors.teal} />
                    <Text style={styles.title}>{t('report.sentTitle')}</Text>
                    <Text style={[styles.subtitle, { textAlign: 'center' }]}>{t('report.sentBody')}</Text>
                    <TouchableOpacity style={[styles.cancelBtn, { alignSelf: 'stretch', flex: 0 }]} onPress={() => setOpen(false)}>
                      <Text style={styles.cancelText}>{t('common.close')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <Text style={styles.title}>{t(`report.title.${targetType}`)}</Text>
                    <Text style={styles.subtitle}>{t('report.subtitle')}</Text>
                    {reasons.map((r) => {
                      const active = r.key === reason;
                      return (
                        <TouchableOpacity key={r.key} style={[styles.option, active && styles.optionActive]} onPress={() => setReason(r.key)}>
                          <Ionicons
                            name={active ? 'radio-button-on' : 'radio-button-off'}
                            size={sc(18)}
                            color={active ? colors.teal : colors.textSecondary}
                          />
                          <Text style={styles.optionText}>{t(reasonKey(r.key))}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TextInput
                      style={styles.input}
                      value={details}
                      onChangeText={(v) => setDetails(v.slice(0, DETAILS_MAX))}
                      multiline
                      placeholder={t('report.detailsPlaceholder')}
                      placeholderTextColor={colors.textSecondary}
                    />
                    {error ? <Text style={styles.error}>{error}</Text> : null}
                    <View style={styles.actions}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={() => setOpen(false)}>
                        <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.confirmBtn, (!reason || busy) && styles.confirmBtnDisabled]}
                        onPress={send}
                        disabled={!reason || busy}
                      >
                        {busy ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.confirmText}>{t('report.send')}</Text>}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </ModalKeyboardAvoider>
      </Modal>
    </>
  );
}
