import { useCallback, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { getParkingSpotDetail } from '@/src/services/parkingService';
import { uploadParkingSpotVerificationPhotos, ParkingSpotPhotoAsset } from '@/src/api/parking';
import { useSpotsStore } from '@/src/store/useSpotsStore';
import { ParkingSpot } from '@/src/types';
import { t, useLanguage } from '@/src/i18n';

const MAX_VERIFICATION_PHOTOS = 5;
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function SpotDocumentation() {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const markUpdated = useSpotsStore((s) => s.markUpdated);

  const [spot, setSpot] = useState<ParkingSpot | null>(null);
  const [newPhotos, setNewPhotos] = useState<ParkingSpotPhotoAsset[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getParkingSpotDetail(id).then((s) => setSpot(s ?? null));
    }, [id]),
  );

  const existingCount = spot?.verificationPhotos.length ?? 0;
  const remainingSlots = MAX_VERIFICATION_PHOTOS - existingCount - newPhotos.length;

  async function pickPhotos() {
    if (remainingSlots <= 0) {
      alert(t('owner.spot.documentation.maxPhotos'));
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert(t('owner.spot.documentation.photoPermissionError'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      quality: 0.7,
      base64: false,
    });
    if (result.canceled) return;

    const picked: ParkingSpotPhotoAsset[] = [];
    for (const asset of result.assets) {
      const mimeType = asset.mimeType ?? 'image/jpeg';
      if (!ALLOWED_PHOTO_TYPES.includes(mimeType)) continue;
      if (asset.fileSize && asset.fileSize > MAX_PHOTO_SIZE_BYTES) continue;
      picked.push({
        uri: asset.uri,
        name: asset.fileName ?? `photo.${mimeType.split('/')[1]}`,
        type: mimeType,
      });
    }
    setNewPhotos((prev) => [...prev, ...picked].slice(0, MAX_VERIFICATION_PHOTOS - existingCount));
  }

  function removeNewPhoto(index: number) {
    setNewPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    if (newPhotos.length === 0) {
      alert(t('owner.spot.documentation.requiredPhoto'));
      return;
    }
    try {
      setSubmitting(true);
      await uploadParkingSpotVerificationPhotos(id, newPhotos);
      markUpdated();
      alert(t('owner.spot.documentation.success'));
      router.back();
    } catch {
      alert(t('owner.spot.documentation.errorUpload'));
      setSubmitting(false);
    }
  }

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    body: { padding: 16, gap: 14 },
    intro: { fontSize: sc(14), color: colors.textSecondary, lineHeight: sc(20) },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14, borderWidth: 1, borderColor: colors.border,
      padding: 16, gap: 10,
    },
    sectionLabel: { fontSize: sc(13), fontWeight: '600', color: colors.text },
    photosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    photoThumbWrapper: { position: 'relative' },
    photoThumb: { width: 84, height: 84, borderRadius: 8 },
    removePhotoBtn: {
      position: 'absolute', top: -6, right: -6,
      width: 20, height: 20, borderRadius: 10,
      backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center',
    },
    addPhotoThumb: {
      width: 84, height: 84, borderRadius: 8,
      borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
    noticeBanner: {
      backgroundColor: colors.warning + '14', borderColor: colors.warning, borderWidth: 1,
      borderRadius: 12, padding: 12,
    },
    noticeText: { fontSize: sc(13), color: colors.text },
    rejectedBanner: {
      backgroundColor: '#C6282814', borderColor: '#C62828', borderWidth: 1,
      borderRadius: 12, padding: 12, gap: 4,
    },
    rejectedTitle: { fontSize: sc(14), fontWeight: '700', color: '#C62828' },
    rejectedReason: { fontSize: sc(13), color: colors.text },
    laterLink: { alignSelf: 'center', marginTop: 4 },
    laterLinkText: { fontSize: sc(13), color: colors.textSecondary, fontWeight: '600' },
    submitBtn: { marginTop: 4 },
  });

  if (!spot) return null;

  return (
    <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.body}>
          {spot.status === 'active' && (
            <View style={styles.noticeBanner}>
              <Text style={styles.noticeText}>{t('owner.spot.documentation.alreadyActive')}</Text>
            </View>
          )}

          {spot.status === 'rejected' && (
            <View style={styles.rejectedBanner}>
              <Text style={styles.rejectedTitle}>{t('owner.spot.documentation.rejectedTitle')}</Text>
              <Text style={styles.rejectedReason}>
                {spot.reviewNotes
                  ? t('owner.spot.documentation.rejectedReason', { notes: spot.reviewNotes })
                  : t('owner.spot.documentation.rejectedNoReason')}
              </Text>
            </View>
          )}

          {spot.status === 'pending_review' && (
            <>
              <Text style={styles.intro}>{t('owner.spot.documentation.intro')}</Text>
              {existingCount > 0 && (
                <View style={styles.noticeBanner}>
                  <Text style={styles.noticeText}>{t('owner.spot.documentation.pendingNotice')}</Text>
                </View>
              )}
            </>
          )}

          {spot.status === 'pending_review' && (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>{t('owner.spot.documentation.photos')}</Text>
              <View style={styles.photosRow}>
                {(spot.verificationPhotos ?? []).map((url) => (
                  <View key={url} style={styles.photoThumbWrapper}>
                    <Image source={{ uri: url }} style={styles.photoThumb} />
                  </View>
                ))}
                {newPhotos.map((photo, index) => (
                  <View key={photo.uri} style={styles.photoThumbWrapper}>
                    <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                    <TouchableOpacity style={styles.removePhotoBtn} onPress={() => removeNewPhoto(index)}>
                      <Ionicons name="close" size={sc(13)} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
                {remainingSlots > 0 && (
                  <TouchableOpacity style={styles.addPhotoThumb} onPress={pickPhotos}>
                    <Ionicons name="add" size={sc(22)} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              <Button
                title={submitting ? t('owner.spot.documentation.submitting') : t('owner.spot.documentation.submit')}
                onPress={submit}
                disabled={submitting || newPhotos.length === 0}
                style={styles.submitBtn}
              />
            </View>
          )}

          <TouchableOpacity style={styles.laterLink} onPress={() => router.back()}>
            <Text style={styles.laterLinkText}>{t('owner.spot.documentation.later')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Screen>
  );
}
