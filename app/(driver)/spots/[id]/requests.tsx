import { t, useLanguage } from '@/src/i18n';
import { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect, useSegments } from 'expo-router';
import { Card } from '@/src/components/Card';
import { StatusBadge } from '@/src/components/StatusBadge';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import {
  getBookingsForSpotApi,
  approveBookingApi,
  rejectBookingApi,
  verifyBookingCodeApi,
  BookingApiResponse,
} from '@/src/api/booking';
import { getPublicProfileApi } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';
import { mapBookingDateRange, formatBookingWhen } from '@/src/services/bookingDates';
import { Booking } from '@/src/types';

function mapApiBooking(b: BookingApiResponse): Booking {
  const amount = typeof b.amount === 'number' ? b.amount / 100 : 0;

  return {
    id: b.id,
    parkingSpotId: b.parking_spot_id,
    parkingSpotTitle: '',
    driverId: b.user_id,
    driverName: '',
    ownerId: '',
    kind: b.kind,
    ...mapBookingDateRange(b.start, b.end),
    subtotal: amount,
    serviceCharge: 0,
    total: amount,
    status: b.status as Booking['status'],
  };
}

export default function SpotBookingRequests() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const typography = useTypography();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [codeModalBookingId, setCodeModalBookingId] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');

  const load = useCallback(() => {
    if (!id) return;
    getBookingsForSpotApi(id)
      .then((list) => {
        const mapped = list.map(mapApiBooking);
        setBookings(mapped);

        const driverIds = [...new Set(mapped.map((b) => b.driverId))];
        Promise.allSettled(
          driverIds.map((driverId) =>
            getPublicProfileApi(driverId).then((profile) => {
              setDriverNames((prev) => ({ ...prev, [driverId]: profile.name }));
            }),
          ),
        );
      })
      .catch((err) => console.warn('[SpotBookingRequests] fetch error:', err));
  }, [id]);

  useFocusEffect(load);

  async function handleApprove(bookingId: string) {
    setBusyId(bookingId);
    try {
      await approveBookingApi(bookingId);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : t('owner.spot.requests.errorApprove'));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(bookingId: string) {
    setBusyId(bookingId);
    try {
      await rejectBookingApi(bookingId);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : t('owner.spot.requests.errorReject'));
    } finally {
      setBusyId(null);
    }
  }

  function openCodeModal(bookingId: string) {
    setCodeInput('');
    setCodeModalBookingId(bookingId);
  }

  async function handleVerifyCode() {
    if (!codeModalBookingId) return;
    const bookingId = codeModalBookingId;
    setBusyId(bookingId);
    try {
      await verifyBookingCodeApi(bookingId, codeInput);
      setCodeModalBookingId(null);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : t('owner.spot.requests.errorVerifyCode'));
    } finally {
      setBusyId(null);
    }
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    driverRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
    driverRowText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    total: { color: colors.ownerAccent, fontWeight: '700', marginTop: 4 },
    actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
    actionBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 9, borderRadius: 10,
    },
    approveBtn: { backgroundColor: colors.ownerAccent },
    rejectBtn: { borderWidth: 1.5, borderColor: '#C62828' },
    approveBtnText: { color: colors.deepNavy, fontWeight: '700' },
    rejectBtnText: { color: '#C62828', fontWeight: '700' },
    verifyBtn: { backgroundColor: colors.ownerAccent },
    verifyBtnText: { color: colors.deepNavy, fontWeight: '700' },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    emptyText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(4, 35, 71, 0.3)',
      justifyContent: 'center',
      padding: 32,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 20,
      gap: 14,
    },
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
    modalActionsRow: { flexDirection: 'row', gap: 8 },
    modalCancelBtn: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border,
    },
    modalCancelBtnText: { color: colors.textSecondary, fontWeight: '700' },
    modalConfirmBtn: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingVertical: 10, borderRadius: 10, backgroundColor: colors.ownerAccent,
    },
    modalConfirmBtnText: { color: colors.deepNavy, fontWeight: '700' },
  });

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      <Text style={typography.h1}>{t('owner.spot.requests.title')}</Text>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={40} color={colors.textSecondary} />
            <Text style={styles.emptyText}>{t('owner.spot.requests.empty')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`${group}/bookings/${item.id}`)} activeOpacity={0.7}>
            <Card>
              <TouchableOpacity
                style={styles.driverRow}
                onPress={() => router.push(`${group}/profile/${item.driverId}?as=driver`)}
                disabled={!driverNames[item.driverId]}
              >
                <Ionicons name="person-circle-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.driverRowText}>{driverNames[item.driverId] ?? item.driverId}</Text>
                {!!driverNames[item.driverId] && <Ionicons name="chevron-forward" size={13} color={colors.textSecondary} />}
              </TouchableOpacity>
              <View style={styles.row}>
                <Text style={typography.body}>
                  {formatBookingWhen(item, t('driver.booking.timeTo'))}
                </Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.total}>${item.total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>

              {item.status === 'PENDING_OWNER_APPROVAL' && (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => handleReject(item.id)}
                    disabled={busyId === item.id}
                  >
                    {busyId === item.id ? (
                      <ActivityIndicator color="#C62828" size="small" />
                    ) : (
                      <>
                        <Ionicons name="close" size={16} color="#C62828" />
                        <Text style={styles.rejectBtnText}>{t('owner.spot.requests.reject')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => handleApprove(item.id)}
                    disabled={busyId === item.id}
                  >
                    {busyId === item.id ? (
                      <ActivityIndicator color={colors.deepNavy} size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={16} color={colors.deepNavy} />
                        <Text style={styles.approveBtnText}>{t('owner.spot.requests.approve')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {item.status === 'CONFIRMED' && (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.verifyBtn]}
                    onPress={() => openCodeModal(item.id)}
                    disabled={busyId === item.id}
                  >
                    {busyId === item.id ? (
                      <ActivityIndicator color={colors.deepNavy} size="small" />
                    ) : (
                      <>
                        <Ionicons name="keypad-outline" size={16} color={colors.deepNavy} />
                        <Text style={styles.verifyBtnText}>{t('owner.spot.requests.verifyCode')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          </TouchableOpacity>
        )}
      />

      <Modal visible={codeModalBookingId !== null} transparent animationType="fade" onRequestClose={() => setCodeModalBookingId(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('owner.spot.requests.verifyCodeModalTitle')}</Text>
            <Text style={styles.modalSubtitle}>{t('owner.spot.requests.verifyCodeModalSubtitle')}</Text>
            <TextInput
              style={styles.codeInput}
              value={codeInput}
              onChangeText={(text) => setCodeInput(text.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="0000"
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setCodeModalBookingId(null)}>
                <Text style={styles.modalCancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleVerifyCode}
                disabled={codeInput.length !== 4 || busyId === codeModalBookingId}
              >
                {busyId === codeModalBookingId ? (
                  <ActivityIndicator color={colors.deepNavy} size="small" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>{t('owner.spot.requests.verifyCodeConfirm')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
