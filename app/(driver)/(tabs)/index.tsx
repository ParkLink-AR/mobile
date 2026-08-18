import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Chip } from '@/src/components/Chip';
import { Button } from '@/src/components/Button';
import { ParkingSpotCard } from '@/src/components/ParkingSpotCard';
import { AccountMenu } from '@/src/components/AccountMenu';
import { Screen } from '@/src/components/Screen';
import { getDriverVisiblePrice } from '@/src/services/utils';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { useSessionStore } from '@/src/store/useSessionStore';
import { searchParkingSpots, SearchParkingSpotsFilters } from '@/src/services/parkingService';
import { ParkingSpot } from '@/src/types';
import { t, useLanguage } from '@/src/i18n';

const DISTANCE_OPTIONS = [
  { label: '< 500 m', value: 500 },
  { label: '< 1 km', value: 1000 },
  { label: '< 2 km', value: 2000 },
];

function formatTime(date: Date): string {
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function pinPosition(id: string): { top: `${number}%`; left: `${number}%` } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 1000;
  }
  const top = 10 + (hash % 65);
  const left = 8 + ((hash * 7) % 75);
  return { top: `${top}%`, left: `${left}%` };
}

export default function Search() {
  const colors = useThemeColors();
  const typography = useTypography();
  useLanguage();
  const mode = useSettingsStore((s) => s.mode);
  const user = useSessionStore((s) => s.user);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [filters, setFilters] = useState<SearchParkingSpotsFilters>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);

  const [addressInput, setAddressInput] = useState('');
  const [searchAddress, setSearchAddress] = useState<string | null>(null);

  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [startTime, setStartTime] = useState(new Date(2000, 0, 1, 8, 0));
  const [endTime, setEndTime] = useState(new Date(2000, 0, 1, 20, 0));
  const [editingTime, setEditingTime] = useState<'start' | 'end' | null>(null);
  const [distanceInput, setDistanceInput] = useState<number | undefined>(undefined);

  useEffect(() => {
    searchParkingSpots(filters).then((results) => {
      const ordered = searchAddress
        ? [...results].sort((a, b) => a.distanceMeters - b.distanceMeters)
        : results;
      setSpots(ordered);
      setSelectedSpotId(ordered[0]?.id ?? null);
    });
  }, [filters, searchAddress]);

  function handleSearchAddress() {
    setSearchAddress(addressInput.trim() || null);
  }

  function clearSearchAddress() {
    setAddressInput('');
    setSearchAddress(null);
  }

  function openFilters() {
    setMinPriceInput(filters.minPrice ? String(filters.minPrice) : '');
    setMaxPriceInput(filters.maxPrice ? String(filters.maxPrice) : '');
    const hasSchedule = filters.startHour !== undefined && filters.endHour !== undefined;
    setScheduleEnabled(hasSchedule);
    setStartTime(new Date(2000, 0, 1, filters.startHour ?? 8, 0));
    setEndTime(new Date(2000, 0, 1, filters.endHour ?? 20, 0));
    setDistanceInput(filters.maxDistanceMeters);
    setModalVisible(true);
  }

  function applyFilters() {
    setFilters({
      minPrice: minPriceInput ? Number(minPriceInput) : undefined,
      maxPrice: maxPriceInput ? Number(maxPriceInput) : undefined,
      startHour: scheduleEnabled ? startTime.getHours() : undefined,
      endHour: scheduleEnabled ? endTime.getHours() : undefined,
      maxDistanceMeters: distanceInput,
    });
    setModalVisible(false);
  }

  function clearFilters() {
    setFilters({});
    setModalVisible(false);
  }

  const activeChips: { label: string; onRemove: () => void }[] = [];
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    activeChips.push({
      label: `$${filters.minPrice ?? 0} – ${filters.maxPrice ?? '∞'}`,
      onRemove: () => setFilters((f) => ({ ...f, minPrice: undefined, maxPrice: undefined })),
    });
  }
  if (filters.startHour !== undefined && filters.endHour !== undefined) {
    activeChips.push({
      label: `${filters.startHour}–${filters.endHour} hs`,
      onRemove: () => setFilters((f) => ({ ...f, startHour: undefined, endHour: undefined })),
    });
  }
  if (filters.maxDistanceMeters !== undefined) {
    activeChips.push({
      label: DISTANCE_OPTIONS.find((d) => d.value === filters.maxDistanceMeters)?.label ?? '',
      onRemove: () => setFilters((f) => ({ ...f, maxDistanceMeters: undefined })),
    });
  }

  const selectedSpot = spots.find((s) => s.id === selectedSpotId) ?? null;
  const hasActiveFilters = activeChips.length > 0;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    // ── Header ──────────────────────────────────────────────────────────────
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 14,
      gap: 12,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLogo: { width: 32, height: 24 },
    headerGreetingBlock: { flex: 1 },
    headerGreetingLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '400',
      letterSpacing: 0.2,
    },
    headerGreetingName: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
    },
    // ── Search bar ──────────────────────────────────────────────────────────
    searchSection: {
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 12,
      backgroundColor: colors.surface,
      gap: 12,
    },
    searchBar: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
    },
    searchInputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: 12,
      gap: 8,
      height: 46,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      height: '100%',
    },
    searchButton: {
      backgroundColor: colors.teal,
      borderRadius: 12,
      width: 46,
      height: 46,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // ── Toolbar (filters + view toggle) ─────────────────────────────────────
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 10,
    },
    filterButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1.5,
      borderColor: hasActiveFilters ? colors.teal : colors.border,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 7,
      backgroundColor: hasActiveFilters ? colors.teal + '12' : colors.surface,
    },
    filterButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: hasActiveFilters ? colors.teal : colors.textSecondary,
    },
    filterBadge: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.teal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.white,
    },
    spacer: { flex: 1 },
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: 2,
    },
    segmentButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    segmentActive: {
      backgroundColor: colors.teal,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    segmentTextActive: {
      color: colors.white,
    },
    // ── Active filter chips ──────────────────────────────────────────────────
    activeFiltersRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 4,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    // ── List content ────────────────────────────────────────────────────────
    listContent: {
      padding: 16,
      gap: 12,
      paddingBottom: 120,
    },
    // ── Map view ────────────────────────────────────────────────────────────
    mapWrapper: {
      flex: 1,
      gap: 0,
    },
    mapBackground: {
      flex: 1,
      backgroundColor: mode === 'dark' ? '#16233A' : '#D6E8F5',
      overflow: 'hidden',
    },
    gridLineH: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      backgroundColor:
        mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(4, 35, 71, 0.06)',
    },
    gridLineV: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor:
        mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(4, 35, 71, 0.06)',
    },
    pin: {
      position: 'absolute',
      backgroundColor: colors.deepNavy,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 5,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
        },
        android: { elevation: 3 },
      }),
    },
    pinSelected: { backgroundColor: colors.teal },
    pinText: { color: colors.white, fontSize: 12, fontWeight: '700' },
    mapCardWrapper: {
      padding: 16,
      paddingBottom: 0,
    },
    // ── Filter modal ─────────────────────────────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(4, 35, 71, 0.45)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingTop: 12,
      maxHeight: '88%',
    },
    modalHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.3,
      marginBottom: 4,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginTop: 18,
      marginBottom: 8,
    },
    row: { flexDirection: 'row', gap: 10 },
    input: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.background,
    },
    timeButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    timeButton: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      backgroundColor: colors.background,
    },
    timeLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.4, textTransform: 'uppercase' },
    timeValue: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 3 },
    timeEditor: { alignItems: 'center', gap: 12, paddingVertical: 12 },
    applyButton: { marginTop: 20, marginBottom: 6 },
    clearLink: {
      textAlign: 'center',
      marginTop: 10,
      marginBottom: 4,
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  });

  return (
    <Screen style={styles.container}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Image
          source={require('@/assets/logo-parklink.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={styles.headerGreetingBlock}>
          <Text style={styles.headerGreetingLabel}>{t('search.welcome')}</Text>
          <Text style={styles.headerGreetingName}>{user?.name ?? ''}</Text>
        </View>
        <AccountMenu role="driver" />
      </View>

      {/* ── Search bar ─────────────────────────────────────────────── */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('search.placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={addressInput}
              onChangeText={setAddressInput}
              onSubmitEditing={handleSearchAddress}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity style={styles.searchButton} onPress={handleSearchAddress}>
            <Ionicons name="arrow-forward" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>

        {searchAddress && (
          <View style={styles.chipsWrap}>
            <Chip
              label={t('search.nearBy', { address: searchAddress })}
              onRemove={clearSearchAddress}
            />
          </View>
        )}
      </View>

      {/* ── Toolbar ────────────────────────────────────────────────── */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.filterButton} onPress={openFilters}>
          <Ionicons
            name="options-outline"
            size={15}
            color={hasActiveFilters ? colors.teal : colors.textSecondary}
          />
          <Text style={styles.filterButtonText}>{t('search.filters')}</Text>
          {hasActiveFilters && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeChips.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.spacer} />

        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentButton, viewMode === 'list' && styles.segmentActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons
              name="list-outline"
              size={14}
              color={viewMode === 'list' ? colors.white : colors.textSecondary}
            />
            <Text style={[styles.segmentText, viewMode === 'list' && styles.segmentTextActive]}>
              {t('search.viewList')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, viewMode === 'map' && styles.segmentActive]}
            onPress={() => setViewMode('map')}
          >
            <Ionicons
              name="map-outline"
              size={14}
              color={viewMode === 'map' ? colors.white : colors.textSecondary}
            />
            <Text style={[styles.segmentText, viewMode === 'map' && styles.segmentTextActive]}>
              {t('search.viewMap')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Active filter chips ────────────────────────────────────── */}
      {activeChips.length > 0 && (
        <View style={styles.activeFiltersRow}>
          {activeChips.map((chip) => (
            <Chip key={chip.label} label={chip.label} onRemove={chip.onRemove} />
          ))}
        </View>
      )}

      {/* ── Results ────────────────────────────────────────────────── */}
      {viewMode === 'list' ? (
        <FlatList
          data={spots}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: `/(driver)/spot/${item.id}`,
                  params: {
                    startHour: filters.startHour?.toString() ?? '8',
                    endHour: filters.endHour?.toString() ?? '9',
                  },
                })
              }
            >
              <ParkingSpotCard spot={item} />
            </TouchableOpacity>
          )}
        />
      ) : (
        <View style={styles.mapWrapper}>
          <View style={styles.mapBackground}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View key={`h-${i}`} style={[styles.gridLineH, { top: `${i * 16}%` }]} />
            ))}
            {[1, 2, 3, 4, 5].map((i) => (
              <View key={`v-${i}`} style={[styles.gridLineV, { left: `${i * 16}%` }]} />
            ))}
            {spots.map((spot) => {
              const pos = pinPosition(spot.id);
              const isSelected = spot.id === selectedSpotId;
              return (
                <TouchableOpacity
                  key={spot.id}
                  style={[styles.pin, { top: pos.top, left: pos.left }, isSelected && styles.pinSelected]}
                  onPress={() => setSelectedSpotId(spot.id)}
                >
                  <Text style={styles.pinText}>${getDriverVisiblePrice(spot.pricePerHour)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedSpot && (
            <View style={styles.mapCardWrapper}>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: `/(driver)/spot/${selectedSpot.id}`,
                    params: {
                      startHour: filters.startHour?.toString() ?? '8',
                      endHour: filters.endHour?.toString() ?? '9',
                    },
                  })
                }
              >
                <ParkingSpotCard spot={selectedSpot} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── Filter modal ───────────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => (editingTime ? setEditingTime(null) : setModalVisible(false))}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            {editingTime ? (
              <View style={styles.timeEditor}>
                <Text style={typography.h2}>
                  {editingTime === 'start' ? t('search.filters.fromHour') : t('search.filters.untilHour')}
                </Text>
                <DateTimePicker
                  value={editingTime === 'start' ? startTime : endTime}
                  mode="time"
                  display="spinner"
                  onChange={(_, date) => {
                    if (!date) return;
                    if (editingTime === 'start') setStartTime(date);
                    else setEndTime(date);
                  }}
                />
                <Button title={t('search.filters.done')} onPress={() => setEditingTime(null)} />
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>{t('search.filters.title')}</Text>

                <Text style={styles.sectionLabel}>{t('search.filters.pricePerHour')}</Text>
                <View style={styles.row}>
                  <TextInput
                    style={styles.input}
                    placeholder={t('search.filters.minPrice')}
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    value={minPriceInput}
                    onChangeText={setMinPriceInput}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={t('search.filters.maxPrice')}
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    value={maxPriceInput}
                    onChangeText={setMaxPriceInput}
                  />
                </View>

                <Text style={styles.sectionLabel}>{t('search.filters.schedule')}</Text>
                <View style={styles.chipsWrap}>
                  <Chip
                    label={
                      scheduleEnabled
                        ? t('search.filters.scheduleEnabled')
                        : t('search.filters.scheduleFilter')
                    }
                    selected={scheduleEnabled}
                    onPress={() => setScheduleEnabled((v) => !v)}
                  />
                </View>
                {scheduleEnabled && (
                  <View style={styles.timeButtonsRow}>
                    <TouchableOpacity style={styles.timeButton} onPress={() => setEditingTime('start')}>
                      <Text style={styles.timeLabel}>{t('search.filters.from')}</Text>
                      <Text style={styles.timeValue}>{formatTime(startTime)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.timeButton} onPress={() => setEditingTime('end')}>
                      <Text style={styles.timeLabel}>{t('search.filters.until')}</Text>
                      <Text style={styles.timeValue}>{formatTime(endTime)}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={styles.sectionLabel}>{t('search.filters.distance')}</Text>
                <View style={styles.chipsWrap}>
                  {DISTANCE_OPTIONS.map((option) => (
                    <Chip
                      key={option.value}
                      label={option.label}
                      selected={distanceInput === option.value}
                      onPress={() =>
                        setDistanceInput((current) =>
                          current === option.value ? undefined : option.value
                        )
                      }
                    />
                  ))}
                </View>

                <Button
                  title={t('search.filters.apply')}
                  onPress={applyFilters}
                  style={styles.applyButton}
                />
                <Text style={styles.clearLink} onPress={clearFilters}>
                  {t('search.filters.clear')}
                </Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
