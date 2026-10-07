import { t, useLanguage } from '@/src/i18n';
import { useCallback, useState } from 'react';
import { Text, View, FlatList, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { router, useFocusEffect, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Region, PROVIDER_DEFAULT } from 'react-native-maps';
import { Screen } from '@/src/components/Screen';
import { ParkingSpotCard } from '@/src/components/ParkingSpotCard';
import { RoleBadge } from '@/src/components/RoleBadge';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography, useScale } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getParkingSpotsForOwner } from '@/src/services/parkingService';
import { MAP_STYLE } from '@/src/theme/mapStyle';
import { ParkingSpot } from '@/src/types';

// Default center: Buenos Aires -- mismo fallback que la búsqueda del
// conductor (app/(driver)/(tabs)/index.tsx), para cuando todavía no hay
// cocheras con coordenadas que encuadrar.
const DEFAULT_REGION: Region = {
  latitude: -34.6037,
  longitude: -58.3816,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

/** Región que encuadra todas las cocheras del propietario (o DEFAULT_REGION si no hay ninguna). */
function regionForSpots(spots: ParkingSpot[]): Region {
  if (spots.length === 0) return DEFAULT_REGION;
  const lats = spots.map((s) => s.lat);
  const lngs = spots.map((s) => s.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    // Math.max con un piso evita un zoom absurdo cuando todas las cocheras
    // están en el mismo punto (o hay una sola) -- delta 0 dejaría el mapa
    // pegado al límite de zoom del proveedor.
    latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.6),
    longitudeDelta: Math.max(0.02, (maxLng - minLng) * 1.6),
  };
}

export default function OwnerSpots() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const typography = useTypography();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const user = useSessionStore((s) => s.user);
  const [spots, setSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      setLoading(true);
      getParkingSpotsForOwner(user.id)
        .then(setSpots)
        .finally(() => setLoading(false));
    }, [user?.id])
  );

  if (!user) return null;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 16, paddingBottom: 8,
    },
    // "Añadir cochera" on the left, list/map switch on the right.
    toggleRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      paddingHorizontal: 16, paddingBottom: 8,
    },
    // Outlined button sized like the list/map switch next to it: same 1.5 border, and its
    // padding (8) is the switch's own padding (2) plus a segment's (6).
    addButton: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
      borderWidth: 1.5, borderColor: colors.teal, backgroundColor: colors.surface,
    },
    addButtonText: { fontSize: sc(13), fontWeight: '600', color: colors.teal },
    segmentedControl: {
      flexDirection: 'row', backgroundColor: colors.background,
      borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, padding: 2,
    },
    segmentButton: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    },
    segmentActive: { backgroundColor: colors.teal },
    segmentText: { fontSize: sc(13), fontWeight: '600', color: colors.textSecondary },
    segmentTextActive: { color: colors.white },
    body: { flex: 1 },
    list: { padding: 16, paddingTop: 8, gap: 12 },
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
    emptyText: { fontSize: sc(15), color: colors.textSecondary, textAlign: 'center', lineHeight: sc(22) },
    mapWrapper: { flex: 1 },
    map: { flex: 1 },
    // Mismo estilo de pin "bubble" que search (app/(driver)/(tabs)/index.tsx),
    // acá con el título de la cochera en vez de precio.
    pin: {
      backgroundColor: colors.deepNavy,
      borderRadius: 20,
      paddingHorizontal: 10, paddingVertical: 5,
      borderWidth: 2, borderColor: colors.white,
      maxWidth: 160,
      ...Platform.select({
        ios: {
          shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25, shadowRadius: 4,
        },
        android: { elevation: 4 },
      }),
    },
    pinText: { color: colors.white, fontSize: sc(12), fontWeight: '700' },
  });

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Text style={typography.h1}>{t('tabs.owner.spots')}</Text>
        <RoleBadge />
      </View>

      <View style={styles.toggleRow}>
        <Pressable style={styles.addButton} onPress={() => router.push(`${group}/spots/new`)}>
          <Ionicons name="add" size={sc(14)} color={colors.teal} />
          <Text style={styles.addButtonText}>{t('profile.mySpots.add')}</Text>
        </Pressable>
        {spots.length > 0 && (
          <View style={styles.segmentedControl}>
            <Pressable
              style={[styles.segmentButton, viewMode === 'list' && styles.segmentActive]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons name="list-outline" size={sc(14)} color={viewMode === 'list' ? colors.white : colors.textSecondary} />
              <Text style={[styles.segmentText, viewMode === 'list' && styles.segmentTextActive]}>
                {t('search.viewList')}
              </Text>
            </Pressable>
            {/* react-native-maps no tiene build para web -- metro.config.js lo
                resuelve a un stub vacío ahí, así que no se ofrece la opción
                de mapa en esa plataforma (mismo criterio que search). */}
            {Platform.OS !== 'web' && (
              <Pressable
                style={[styles.segmentButton, viewMode === 'map' && styles.segmentActive]}
                onPress={() => setViewMode('map')}
              >
                <Ionicons name="map-outline" size={sc(14)} color={viewMode === 'map' ? colors.white : colors.textSecondary} />
                <Text style={[styles.segmentText, viewMode === 'map' && styles.segmentTextActive]}>
                  {t('search.viewMap')}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      <View style={styles.body}>
        {loading ? (
          <ActivityIndicator color={colors.teal} style={{ marginTop: 40 }} />
        ) : spots.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="home-outline" size={sc(48)} color={colors.textSecondary} />
            <Text style={styles.emptyText}>{t('profile.mySpots.empty')}</Text>
          </View>
        ) : viewMode === 'list' || Platform.OS === 'web' ? (
          <FlatList
            data={spots}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable onPress={() => router.push(`${group}/spots/${item.id}`)}>
                <ParkingSpotCard spot={item} />
              </Pressable>
            )}
          />
        ) : (
          <View style={styles.mapWrapper}>
            <MapView
              style={styles.map}
              provider={PROVIDER_DEFAULT}
              initialRegion={regionForSpots(spots)}
              customMapStyle={MAP_STYLE}
              showsPointsOfInterests={false}
            >
              {spots.map((spot) => (
                <Marker
                  key={spot.id}
                  coordinate={{ latitude: spot.lat, longitude: spot.lng }}
                  onPress={() => router.push(`${group}/spots/${spot.id}`)}
                >
                  <View style={styles.pin}>
                    <Text style={styles.pinText} numberOfLines={1}>{spot.title}</Text>
                  </View>
                </Marker>
              ))}
            </MapView>
          </View>
        )}
      </View>
    </Screen>
  );
}
