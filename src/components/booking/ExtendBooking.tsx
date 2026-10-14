import { t, useLanguage } from '@/src/i18n';
import { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TouchableWithoutFeedback, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { extendBookingApi, getExtensionOptionsApi, ExtensionOptionApiResponse } from '@/src/api/booking';
import { ApiError } from '@/src/api/client';

function formatPesos(centavos: number): string {
  return `$${(centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// "15:00" -- the end comes with the Buenos Aires offset, so its own clock time is the local one.
function clockTime(iso: string): string {
  return iso.slice(11, 16);
}

/**
 * "Extender": the driver of an accepted hourly booking picks until when to stay (an hour at
 * a time, as far as the spot is free and open) and goes on to pay just that part. The
 * extension is its own booking, confirmed as soon as it's paid -- `onExtended` gets its id.
 */
export function ExtendBooking({ bookingId, onExtended }: { bookingId: string; onExtended: (extensionId: string) => void }) {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ExtensionOptionApiResponse[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function show() {
    setOpen(true);
    setOptions(null);
    setChosen(null);
    setError(null);
    try {
      const loaded = await getExtensionOptionsApi(bookingId);
      setOptions(loaded);
      setChosen(loaded[0]?.end ?? null);
    } catch (err) {
      setOptions([]);
      setError(err instanceof ApiError ? err.detail : t('booking.extend.loadError'));
    }
  }

  async function confirm() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const extension = await extendBookingApi(bookingId, chosen);
      setOpen(false);
      onExtended(extension.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : t('booking.extend.error'));
    } finally {
      setBusy(false);
    }
  }

  const price = options?.find((option) => option.end === chosen)?.amount;

  const styles = StyleSheet.create({
    button: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      borderRadius: 12, borderWidth: 1.5, borderColor: colors.teal, paddingVertical: 13,
    },
    buttonText: { fontSize: sc(15), fontWeight: '700', color: colors.teal },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
    sheet: { backgroundColor: colors.surface, borderRadius: 20, padding: 22, gap: 12, maxHeight: '85%' },
    title: { fontSize: sc(17), fontWeight: '700', color: colors.text },
    subtitle: { fontSize: sc(13), color: colors.textSecondary, lineHeight: sc(18) },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      minWidth: sc(76), alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12,
      borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, gap: 2,
    },
    chipActive: { borderColor: colors.teal, backgroundColor: colors.teal + '14' },
    chipTime: { fontSize: sc(15), fontWeight: '700', color: colors.text },
    chipHours: { fontSize: sc(11), color: colors.textSecondary },
    empty: { fontSize: sc(14), color: colors.textSecondary, lineHeight: sc(20) },
    error: { fontSize: sc(13), color: '#C62828' },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    totalLabel: { fontSize: sc(14), color: colors.text, fontWeight: '600' },
    totalValue: { fontSize: sc(18), color: colors.teal, fontWeight: '700' },
    actions: { flexDirection: 'row', gap: 10 },
    cancelBtn: {
      flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border,
    },
    cancelText: { fontSize: sc(15), fontWeight: '600', color: colors.text },
    confirmBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.teal },
    confirmBtnDisabled: { backgroundColor: colors.border },
    confirmText: { fontSize: sc(15), fontWeight: '700', color: colors.white },
  });

  return (
    <>
      <Pressable style={styles.button} onPress={show}>
        <Ionicons name="add-circle-outline" size={sc(18)} color={colors.teal} />
        <Text style={styles.buttonText}>{t('booking.extend.button')}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <View style={styles.sheet}>
                <Text style={styles.title}>{t('booking.extend.title')}</Text>
                <Text style={styles.subtitle}>{t('booking.extend.subtitle')}</Text>
                {options === null ? (
                  <ActivityIndicator color={colors.teal} />
                ) : options.length === 0 ? (
                  !error && <Text style={styles.empty}>{t('booking.extend.none')}</Text>
                ) : (
                  <ScrollView contentContainerStyle={styles.chips}>
                    {options.map((option, index) => {
                      const active = option.end === chosen;
                      return (
                        <Pressable key={option.end} style={[styles.chip, active && styles.chipActive]} onPress={() => setChosen(option.end)}>
                          <Text style={styles.chipTime}>{clockTime(option.end)}</Text>
                          <Text style={styles.chipHours}>
                            {index === 0 ? t('booking.extend.oneHour') : t('booking.extend.hours', { hours: String(index + 1) })}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
                {price !== undefined && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>{t('booking.extend.total')}</Text>
                    <Text style={styles.totalValue}>{formatPesos(price)}</Text>
                  </View>
                )}
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <View style={styles.actions}>
                  <Pressable style={styles.cancelBtn} onPress={() => setOpen(false)}>
                    <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.confirmBtn, (!chosen || busy) && styles.confirmBtnDisabled]}
                    onPress={confirm}
                    disabled={!chosen || busy}
                  >
                    {busy ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.confirmText}>{t('booking.extend.continue')}</Text>}
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
