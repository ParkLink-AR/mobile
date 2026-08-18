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
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { updateProfile } from '@/src/services/authService';

export default function DriverProfileEdit() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
  const user = useSessionStore((s) => s.user)!;
  const login = useSessionStore((s) => s.login);

  const [name, setName] = useState(user.name);
  const [lastName, setLastName] = useState(user.lastName ?? '');
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [avatarUri, setAvatarUri] = useState<string | undefined>(user.avatarUrl);

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
    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  async function save() {
    const updated = await updateProfile(user, {
      name: name.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      avatarUrl: avatarUri,
    });
    login(updated);
    router.back();
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
  });

  return (
    <Screen style={styles.outer}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={typography.h1}>{t('profile.edit.title')}</Text>

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

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('profile.edit.email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder={t('profile.edit.email')}
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {/* Phone */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('profile.edit.phone')}</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+54 9 11 0000-0000"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <Button title={t('common.save')} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
