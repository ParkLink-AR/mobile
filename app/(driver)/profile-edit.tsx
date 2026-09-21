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
import { router, useSegments, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useSessionStore } from '@/src/store/useSessionStore';
import { updateUserProfile, uploadAvatar, AvatarAsset } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function DriverProfileEdit() {
  useLanguage();
  const group = `/${useSegments()[0]}`;
  const colors = useThemeColors();
  const user = useSessionStore((s) => s.user)!;
  const setUser = useSessionStore((s) => s.setUser);
  const [name, setName] = useState(user.name);
  const [lastName, setLastName] = useState(user.lastName ?? '');
  const [nameEditable, setNameEditable] = useState(false);
  const [lastNameEditable, setLastNameEditable] = useState(false);
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

    avatarSection: { alignItems: 'center', gap: 16 },
    avatarWrapper: {
      width: 160, height: 160, borderRadius: 80,
      backgroundColor: colors.teal,
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: { width: 160, height: 160, borderRadius: 80 },
    avatarText: { color: colors.white, fontSize: 56, fontWeight: '700' },
    changePhotoBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 16,
      paddingHorizontal: 44, paddingVertical: 24, borderRadius: 56,
      borderWidth: 2, borderColor: colors.teal,
    },
    changePhotoBtnText: { fontSize: 36, fontWeight: '600', color: colors.teal },

    fieldGroup: { gap: 6 },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    label: { fontSize: 28, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textSecondary },
    labelVerified: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    labelVerifiedText: { fontSize: 28, fontWeight: '700', color: colors.success },
    inputRow: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      backgroundColor: colors.background,
    },
    input: {
      flex: 1,
      padding: 18, fontSize: 28, color: colors.text,
    },
    inputDisabled: { color: colors.textSecondary },
    editIcon: {
      marginRight: 12,
      width: 40, height: 40, borderRadius: 20,
      borderWidth: 2, borderColor: colors.teal,
      alignItems: 'center', justifyContent: 'center',
    },
    row: { flexDirection: 'column', gap: 20 },
    rowItem: {},
    error: { color: '#C62828', fontSize: 20 },

    readOnlyRow: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      padding: 18, backgroundColor: colors.background, gap: 12,
    },
    emailLines: { flex: 1, alignItems: 'center' },
    emailLine: { fontSize: 28, color: colors.textSecondary, textAlign: 'center' },
    readOnlyContent: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
    readOnlyInfo: { gap: 8 },
    readOnlyValue: { fontSize: 28, color: colors.text, flexShrink: 1 },
    verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    verifiedText: { fontSize: 22, fontWeight: '700', color: colors.success },
  });

  return (
    <>
      <Stack.Screen
        options={{
          headerTitleStyle: { fontSize: 34, fontWeight: '700' },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              {/* El header del Stack padre siempre es deepNavy (fijo, no cambia con el
                  tema) -- colors.white matchea su headerTintColor, no colors.text, que
                  en modo claro es el mismo #042347 que el fondo (invisible). */}
              <Ionicons name="arrow-back" size={34} color={colors.white} />
            </Pressable>
          ),
        }}
      />
    <Screen style={styles.outer} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
              <Ionicons name="camera-outline" size={44} color={colors.teal} />
              <Text style={styles.changePhotoBtnText}>
                {avatarUri ? t('profile.edit.changePhoto') : t('profile.edit.addPhoto')}
              </Text>
            </Pressable>
          </View>

          {/* Name row */}
          <View style={styles.row}>
            <View style={[styles.fieldGroup, styles.rowItem]}>
              <Text style={styles.label}>{t('profile.edit.firstName')}</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, !nameEditable && styles.inputDisabled]}
                  value={name}
                  onChangeText={setName}
                  editable={nameEditable}
                  placeholder={t('profile.edit.firstName')}
                  placeholderTextColor={colors.textSecondary}
                  autoFocus={nameEditable}
                />
                <Pressable onPress={() => setNameEditable((v) => !v)} style={styles.editIcon} hitSlop={8}>
                  <Ionicons name={nameEditable ? 'checkmark' : 'pencil'} size={22} color={colors.teal} />
                </Pressable>
              </View>
            </View>
            <View style={[styles.fieldGroup, styles.rowItem]}>
              <Text style={styles.label}>{t('profile.edit.lastName')}</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, !lastNameEditable && styles.inputDisabled]}
                  value={lastName}
                  onChangeText={setLastName}
                  editable={lastNameEditable}
                  placeholder={t('profile.edit.lastName')}
                  placeholderTextColor={colors.textSecondary}
                  autoFocus={lastNameEditable}
                />
                <Pressable onPress={() => setLastNameEditable((v) => !v)} style={styles.editIcon} hitSlop={8}>
                  <Ionicons name={lastNameEditable ? 'checkmark' : 'pencil'} size={22} color={colors.teal} />
                </Pressable>
              </View>
            </View>
          </View>

          {/* Email -- changing it requires verifying the new address, so it
              lives in its own screen instead of this combined form. */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{t('profile.edit.email')}</Text>
              {user.emailVerified && (
                <View style={styles.labelVerified}>
                  <Ionicons name="checkmark-circle" size={36} color={colors.success} />
                  <Text style={styles.labelVerifiedText}>{t('profile.edit.verified')}</Text>
                </View>
              )}
            </View>
            <View style={styles.readOnlyRow}>
              <View style={styles.emailLines}>
                <Text style={styles.emailLine}>{user.email.split('@')[0]}</Text>
                <Text style={styles.emailLine}>@{user.email.split('@')[1]}</Text>
              </View>
              <Pressable onPress={() => router.push(`${group}/change-email`)} style={styles.editIcon} hitSlop={8}>
                <Ionicons name="pencil" size={18} color={colors.teal} />
              </Pressable>
            </View>
          </View>

          {/* Phone -- same reasoning, verified via SMS in its own screen. */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{t('profile.edit.phone')}</Text>
              {user.phoneVerified && (
                <View style={styles.labelVerified}>
                  <Ionicons name="checkmark-circle" size={36} color={colors.success} />
                  <Text style={styles.labelVerifiedText}>{t('profile.edit.verified')}</Text>
                </View>
              )}
            </View>
            <View style={styles.readOnlyRow}>
              <Text style={[styles.readOnlyValue, { flex: 1 }]}>{user.phone || '—'}</Text>
              <Pressable onPress={() => router.push(`${group}/change-phone`)} style={styles.editIcon} hitSlop={8}>
                <Ionicons name="pencil" size={18} color={colors.teal} />
              </Pressable>
            </View>
          </View>

          {saving ? (
            <ActivityIndicator color={colors.teal} />
          ) : (
            <Button title={t('common.save')} onPress={save} textStyle={{ fontSize: 48, fontWeight: '700' }} style={{ paddingVertical: 20 }} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
    </>
  );
}
