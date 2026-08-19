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
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { updateUserProfile, uploadAvatar, AvatarAsset } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function DriverProfileEdit() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
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

    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    if (!ALLOWED_AVATAR_TYPES.includes(mimeType)) {
      Alert.alert('Formato no permitido', 'Usá una imagen JPEG, PNG o WEBP.');
      return;
    }
    if (asset.fileSize && asset.fileSize > MAX_AVATAR_SIZE_BYTES) {
      Alert.alert('Imagen muy grande', 'El tamaño máximo es 5 MB.');
      return;
    }

    setAvatarUri(asset.uri);
    setAvatarAsset({
      uri: asset.uri,
      name: asset.fileName ?? `avatar.${mimeType.split('/')[1]}`,
      type: mimeType,
    });
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

    avatarSection: { alignItems: 'center', gap: 10 },
    avatarWrapper: {
      width: 96, height: 96, borderRadius: 48,
      backgroundColor: colors.teal,
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: { width: 96, height: 96, borderRadius: 48 },
    avatarText: { color: colors.white, fontSize: 32, fontWeight: '700' },
    changePhotoBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
      borderWidth: 1.5, borderColor: colors.teal,
    },
    changePhotoBtnText: { fontSize: 13, fontWeight: '600', color: colors.teal },

    fieldGroup: { gap: 4 },
    label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textSecondary },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      padding: 13, fontSize: 15, color: colors.text, backgroundColor: colors.background,
    },
    row: { flexDirection: 'row', gap: 12 },
    rowItem: { flex: 1 },
    error: { color: '#C62828', fontSize: 13 },

    readOnlyRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      padding: 13, backgroundColor: colors.background, gap: 10,
    },
    readOnlyInfo: { flex: 1, gap: 2 },
    readOnlyValue: { fontSize: 15, color: colors.text },
    verifiedText: { fontSize: 11, fontWeight: '700', color: colors.success },
    changeLink: { fontSize: 13, fontWeight: '600', color: colors.teal },
  });

  return (
    <Screen style={styles.outer}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={typography.h1}>{t('profile.edit.title')}</Text>
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
              <Ionicons name="camera-outline" size={15} color={colors.teal} />
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
              <View style={styles.readOnlyInfo}>
                <Text style={styles.readOnlyValue}>{user.email}</Text>
                {user.emailVerified && <Text style={styles.verifiedText}>{t('profile.edit.verified')}</Text>}
              </View>
              <Text style={styles.changeLink} onPress={() => router.push('/(driver)/change-email')}>
                {t('profile.edit.changeEmail')}
              </Text>
            </View>
          </View>

          {/* Phone -- same reasoning, verified via SMS in its own screen. */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('profile.edit.phone')}</Text>
            <View style={styles.readOnlyRow}>
              <View style={styles.readOnlyInfo}>
                <Text style={styles.readOnlyValue}>{user.phone || '—'}</Text>
                {user.phoneVerified && <Text style={styles.verifiedText}>{t('profile.edit.verified')}</Text>}
              </View>
              <Text style={styles.changeLink} onPress={() => router.push('/(driver)/change-phone')}>
                {t('profile.edit.changePhone')}
              </Text>
            </View>
          </View>

          {saving ? (
            <ActivityIndicator color={colors.teal} />
          ) : (
            <Button title={t('common.save')} onPress={save} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
