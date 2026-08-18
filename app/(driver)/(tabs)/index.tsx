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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
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
      label: `${filters.startHour}-${filters.endHour} hs`,
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

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16, gap: 12 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerLogo: { width: 36, height: 27 },
    headerGreeting: { flex: 1 },
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
    searchBar: { flexDirection: 'row', gap: 8 },
    searchInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      backgroundColor: colors.surface,
      color: colors.text,
    },
    searchButton: {
      backgroundColor: colors.teal,
      borderRadius: 8,
      paddingHorizontal: 16,
      justifyContent: 'center',
    },
    searchButtonText: { color: colors.white, fontWeight: '600' },
    mapWrapper: { flex: 1, gap: 10 },
    mapBackground: {
      flex: 1,
      backgroundColor: mode === 'dark' ? '#16233A' : '#D6E8F5',
      borderRadius: 12,
      overflow: 'hidden',
    },
    gridLineH: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 1,
      backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(4, 35, 71, 0.08)',
    },
    gridLineV: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(4, 35, 71, 0.08)',
    },
    pin: {
      position: 'absolute',
      backgroundColor: colors.deepNavy,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    pinSelected: {
      backgroundColor: colors.warning,
    },
    pinText: { color: colors.white, fontSize: 12, fontWeight: '700' },
    pinTextSelected: { color: colors.white },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(4, 35, 71, 0.4)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 20,
      maxHeight: '85%',
    },
    sectionTitle: { marginTop: 12, marginBottom: 4 },
    timeButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
    timeButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    timeValue: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 2 },
    timeEditor: { alignItems: 'center', gap: 12, paddingVertical: 12 },
    row: { flexDirection: 'row', gap: 8 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      color: colors.text,
    },
    halfInput: { flex: 1 },
    applyButton: { marginTop: 16 },
    clearLink: { color: colors.teal, textAlign: 'center', marginTop: 12 },
  });

  return (
    <Screen style={styles.container}>
      <View style={styles.headerRow}>
        <Image
          source={require('@/assets/logo-parklink.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <Text style={[typography.h1, styles.headerGreeting]}>{t('search.greeting', { name: user?.name ?? '' })}</Text>
        <AccountMenu role="driver" />
      </View>

      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('search.placeholder')}
          placeholderTextColor={colors.textSecondary}
          value={addressInput}
          onChangeText={setAddressInput}
          onSubmitEditing={handleSearchAddress}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearchAddress}>
          <Text style={styles.searchButtonText}>{t('search.button')}</Text>
        </TouchableOpacity>
      </View>
      {searchAddress && (
        <View style={styles.filterRow}>
          <Chip label={t('search.nearBy', { address: searchAddress ?? '' })} onRemove={clearSearchAddress} />
        </View>
      )}

      <View style={styles.filterRow}>
        <Chip label={t('search.filters')} selected={activeChips.length > 0} onPress={openFilters} />
        {activeChips.map((chip) => (
          <Chip key={chip.label} label={chip.label} onRemove={chip.onRemove} />
        ))}
      </View>

      <View style={styles.filterRow}>
        <Chip label={t('search.viewList')} selected={viewMode === 'list'} onPress={() => setViewMode('list')} />
        <Chip label={t('search.viewMap')} selected={viewMode === 'map'} onPress={() => setViewMode('map')} />
      </View>

      {viewMode === 'list' ? (
        <FlatList
          data={spots}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 10 }}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push({
              pathname: `/(driver)/spot/${item.id}`,
              params: {
                startHour: filters.startHour?.toString() ?? '8',
                endHour: filters.endHour?.toString() ?? '9',
              },
            })}>
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
                  <Text style={[styles.pinText, isSelected && styles.pinTextSelected]}>
                    ${getDriverVisiblePrice(spot.pricePerHour)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedSpot && (
            <TouchableOpacity onPress={() => router.push({
              pathname: `/(driver)/spot/${selectedSpot.id}`,
              params: {
                startHour: filters.startHour?.toString() ?? '8',
                endHour: filters.endHour?.toString() ?? '9',
              },
            })}>
              <ParkingSpotCard spot={selectedSpot} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => (editingTime ? setEditingTime(null) : setModalVisible(false))}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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
                <Text style={typography.h1}>{t('search.filters.title')}</Text>

                <Text style={[typography.caption, styles.sectionTitle]}>{t('search.filters.pricePerHour')}</Text>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder={t('search.filters.minPrice')}
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    value={minPriceInput}
                    onChangeText={setMinPriceInput}
                  />
                  <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder={t('search.filters.maxPrice')}
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    value={maxPriceInput}
                    onChangeText={setMaxPriceInput}
                  />
                </View>

                <Text style={[typography.caption, styles.sectionTitle]}>{t('search.filters.schedule')}</Text>
                <Chip
                  label={scheduleEnabled ? t('search.filters.scheduleEnabled') : t('search.filters.scheduleFilter')}
                  selected={scheduleEnabled}
                  onPress={() => setScheduleEnabled((v) => !v)}
                />
                {scheduleEnabled && (
                  <View style={styles.timeButtonsRow}>
                    <TouchableOpacity style={styles.timeButton} onPress={() => setEditingTime('start')}>
                      <Text style={typography.caption}>{t('search.filters.from')}</Text>
                      <Text style={styles.timeValue}>{formatTime(startTime)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.timeButton} onPress={() => setEditingTime('end')}>
                      <Text style={typography.caption}>{t('search.filters.until')}</Text>
                      <Text style={styles.timeValue}>{formatTime(endTime)}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={[typography.caption, styles.sectionTitle]}>{t('search.filters.distance')}</Text>
                <View style={styles.filterRow}>
                  {DISTANCE_OPTIONS.map((option) => (
                    <Chip
                      key={option.value}
                      label={option.label}
                      selected={distanceInput === option.value}
                      onPress={() =>
                        setDistanceInput((current) => (current === option.value ? undefined : option.value))
                      }
                    />
                  ))}
                </View>

                <Button title={t('search.filters.apply')} onPress={applyFilters} style={styles.applyButton} />
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
