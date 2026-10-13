import { t, useLanguage } from '@/src/i18n';
import { useState } from 'react';
import {
  Text,
  TextInput,
  StyleSheet,
  View,
  Image,
  Pressable,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router, useSegments } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { AVATAR_UPLOAD_MAX, shrinkForUpload } from '@/src/services/imageUpload';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { updateUserProfile, uploadAvatar, AvatarAsset } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';


export default function DriverProfileEdit() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const user = useSessionStore((s) => s.user)!;
  const setUser = useSessionStore((s) => s.setUser);
  const [name, setName] = useState(user.name);
  const [lastName, setLastName] = useState(user.lastName ?? '');
  const [avatarUri, setAvatarUri] = useState<string | undefined>(user.avatarUrl);
  const [avatarAsset, setAvatarAsset] = useState<AvatarAsset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Se necesita acceso a la galería para cambiar la foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: false,
    });
    if (result.canceled || !result.assets[0]?.uri) return;

    // Shrunk on the phone first: much faster to upload (see shrinkForUpload).
    const shrunk = await shrinkForUpload(result.assets[0], AVATAR_UPLOAD_MAX, 'avatar');
    if (!shrunk) {
      Alert.alert('Formato no permitido', 'Usá una imagen JPEG, PNG o WEBP.');
      return;
    }
    setAvatarUri(shrunk.uri);
    setAvatarAsset(shrunk);
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      let updated = await updateUserProfile(user.id, {
        firstName: name.trim(),
        lastName: lastName.trim(),
      });
      if (avatarAsset) {
        updated = await uploadAvatar(user.id, avatarAsset);
      }
      setUser(updated);
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  const initials = [name.trim()[0], lastName.trim()[0]]
    .filter(Boolean)
    .map((c) => c.toUpperCase())
    .join('');

  const styles = StyleSheet.create({
    outer: { flex: 1, backgroundColor: colors.surface },
    scroll: { padding: 24, gap: 20, paddingBottom: 40 },

    avatarSection: { alignItems: 'center', gap: sc(10) },
    avatarWrapper: {
      width: sc(96), height: sc(96), borderRadius: sc(48),
      backgroundColor: colors.teal,
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: { width: sc(96), height: sc(96), borderRadius: sc(48) },
    avatarText: { color: colors.white, fontSize: sc(32), fontWeight: '700' },
    changePhotoBtn: {
      flexDirection: 'row', alignItems: 'center', gap: sc(6),
      paddingHorizontal: sc(14), paddingVertical: sc(7), borderRadius: 20,
      borderWidth: 1.5, borderColor: colors.teal,
    },
    changePhotoBtnText: { fontSize: sc(13), fontWeight: '600', color: colors.teal },

    fieldGroup: { gap: sc(4) },
    label: { fontSize: sc(11), fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textSecondary },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      padding: sc(13), fontSize: sc(15), color: colors.text, backgroundColor: colors.background,
    },
    row: { flexDirection: 'row', gap: 12 },
    rowItem: { flex: 1 },
    error: { color: '#C62828', fontSize: sc(13) },

    readOnlyRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      padding: sc(13), backgroundColor: colors.background, gap: 10,
    },
    readOnlyInfo: { flex: 1, gap: sc(2) },
    readOnlyValue: { fontSize: sc(15), color: colors.text },
    verifiedRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: sc(6) },
    readOnlyValueInline: { fontSize: sc(15), color: colors.text, flexShrink: 1 },
    changeLink: { fontSize: sc(13), fontWeight: '600', color: colors.teal },
    deleteAccountLink: { alignSelf: 'center', marginTop: sc(8), padding: 8 },
    deleteAccountLinkText: { fontSize: sc(13), fontWeight: '600', color: '#C62828' },
  });

  return (
    <Screen style={styles.outer} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <Pressable style={styles.avatarWrapper} onPress={pickImage}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{initials || '?'}</Text>
              )}
            </Pressable>
            <Pressable style={styles.changePhotoBtn} onPress={pickImage}>
              <Ionicons name="camera-outline" size={sc(15)} color={colors.teal} />
              <Text style={styles.changePhotoBtnText}>
                {avatarUri ? t('profile.edit.changePhoto') : t('profile.edit.addPhoto')}
              </Text>
            </Pressable>
          </View>

          {/* Name row */}
          <View style={styles.row}>
            <View style={[styles.fieldGroup, styles.rowItem]}>
              <Text style={styles.label}>{t('profile.edit.firstName')}</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={t('profile.edit.firstName')}
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={[styles.fieldGroup, styles.rowItem]}>
              <Text style={styles.label}>{t('profile.edit.lastName')}</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder={t('profile.edit.lastName')}
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>

          {/* Email -- changing it requires verifying the new address, so it
              lives in its own screen instead of this combined form. */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('profile.edit.email')}</Text>
            <View style={styles.readOnlyRow}>
              <View style={styles.verifiedRow}>
                <Text style={styles.readOnlyValueInline} numberOfLines={1}>{user.email}</Text>
                {user.emailVerified && (
                  <Ionicons
                    name="checkmark-circle"
                    size={sc(16)}
                    color={colors.teal}
                    accessibilityLabel={t('profile.edit.verified')}
                  />
                )}
              </View>
              <Text style={styles.changeLink} onPress={() => router.push(`${group}/change-email`)}>
                {t('profile.edit.changeEmail')}
              </Text>
            </View>
          </View>

          {/* Phone -- same reasoning, verified via SMS in its own screen. */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('profile.edit.phone')}</Text>
            <View style={styles.readOnlyRow}>
              <View style={styles.verifiedRow}>
                <Text style={styles.readOnlyValueInline} numberOfLines={1}>{user.phone || '—'}</Text>
                {user.phoneVerified && (
                  <Ionicons
                    name="checkmark-circle"
                    size={sc(16)}
                    color={colors.teal}
                    accessibilityLabel={t('profile.edit.verified')}
                  />
                )}
              </View>
              <Text style={styles.changeLink} onPress={() => router.push(`${group}/change-phone`)}>
                {t('profile.edit.changePhone')}
              </Text>
            </View>
          </View>

          {/* Password -- same reasoning, changing it requires re-entering the
              current one first, so it lives in its own screen. */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('profile.edit.password')}</Text>
            <View style={styles.readOnlyRow}>
              <View style={styles.readOnlyInfo}>
                <Text style={styles.readOnlyValue}>••••••••</Text>
              </View>
              <Text style={styles.changeLink} onPress={() => router.push(`${group}/change-password`)}>
                {t('profile.edit.changePassword')}
              </Text>
            </View>
          </View>

          {saving ? (
            <ActivityIndicator color={colors.teal} />
          ) : (
            <Button title={t('common.save')} onPress={save} />
          )}

          {/* Last, set apart and low-key: what it does is explained on its own screen
              before anything happens. */}
          <Pressable
            style={({ pressed }) => [styles.deleteAccountLink, { opacity: pressed ? 0.6 : 1 }]}
            onPress={() => router.push(`${group}/account-deletion`)}
          >
            <Text style={styles.deleteAccountLinkText}>{t('account.deletion.link')}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
