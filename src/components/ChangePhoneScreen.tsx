import { t, useLanguage } from '@/src/i18n';
import { useEffect, useState } from 'react';
import {
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  View,
  Modal,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { requestPhoneChange, confirmPhoneChange } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';
import { COUNTRIES, DEFAULT_COUNTRY, Country } from '@/src/data/countries';

const RESEND_COOLDOWN_SECONDS = 60;

export default function ChangePhoneScreen() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
  const user = useSessionStore((s) => s.user)!;
  const setUser = useSessionStore((s) => s.setUser);

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const fullPhone = `${country.dialCode}${phoneNumber.replace(/[^0-9]/g, '')}`;

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, padding: 24, gap: 12, justifyContent: 'center' },
    current: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      color: colors.text,
    },
    codeInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 24,
      letterSpacing: 8,
      textAlign: 'center',
      color: colors.text,
    },
    error: { color: '#C62828', fontSize: 13, textAlign: 'center' },
    link: { color: colors.teal, textAlign: 'center', marginTop: 8 },
    linkDisabled: { color: colors.textSecondary },
    phoneRow: { flexDirection: 'row', gap: 8 },
    countryButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      justifyContent: 'center',
      minWidth: 100,
    },
    countryButtonText: { fontSize: 15, color: colors.text },
    phoneInput: { flex: 1 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(4, 35, 71, 0.4)', justifyContent: 'flex-end' },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: '70%',
      padding: 16,
    },
    countryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
    countryRowFlag: { fontSize: 22 },
    countryRowName: { flex: 1, fontSize: 15, color: colors.text },
    countryRowDial: { fontSize: 14, color: colors.textSecondary },
  });

  async function handleSendCode() {
    setError(null);
    if (!phoneNumber.trim()) {
      setError('Ingresá tu número.');
      return;
    }
    setLoading(true);
    try {
      await requestPhoneChange(user.id, fullPhone);
      setStep('code');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo enviar el código.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError(null);
    try {
      await requestPhoneChange(user.id, fullPhone);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo reenviar el código.');
    }
  }

  async function handleConfirm() {
    setError(null);
    if (code.length !== 6) {
      setError('Ingresá el código de 6 dígitos.');
      return;
    }
    setLoading(true);
    try {
      const updated = await confirmPhoneChange(user.id, code);
      setUser({ ...updated, avatarUrl: user.avatarUrl });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'No se pudo confirmar el código.');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'code') {
    return (
      <Screen style={styles.container}>
        <Text style={typography.h1}>{t('changePhone.code.title')}</Text>
        <Text style={typography.body}>{t('changePhone.code.helper', { phone: fullPhone })}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TextInput
          style={styles.codeInput}
          placeholder="000000"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={(v) => setCode(v.replace(/[^0-9]/g, ''))}
        />
        {loading ? (
          <ActivityIndicator color={colors.teal} />
        ) : (
          <Button title={t('changePhone.code.button')} onPress={handleConfirm} />
        )}
        <Text style={[styles.link, cooldown > 0 && styles.linkDisabled]} onPress={handleResend}>
          {cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'}
        </Text>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <Text style={typography.h1}>{t('changePhone.title')}</Text>
      <View>
        <Text style={styles.current}>{user.phone}</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.phoneRow}>
        <TouchableOpacity style={styles.countryButton} onPress={() => setCountryPickerOpen(true)}>
          <Text style={styles.countryButtonText}>
            {country.flag} {country.dialCode}
          </Text>
        </TouchableOpacity>
        <TextInput
          style={[styles.input, styles.phoneInput]}
          placeholder="11 2345 6789"
          placeholderTextColor={colors.textSecondary}
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
        />
      </View>
      {loading ? (
        <ActivityIndicator color={colors.teal} />
      ) : (
        <Button title={t('changePhone.newPhone.button')} onPress={handleSendCode} />
      )}

      <Modal
        visible={countryPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCountryPickerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={typography.h2}>Elegí tu país</Text>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(item) => item.iso2}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.countryRow}
                  onPress={() => {
                    setCountry(item);
                    setCountryPickerOpen(false);
                  }}
                >
                  <Text style={styles.countryRowFlag}>{item.flag}</Text>
                  <Text style={styles.countryRowName}>{item.name}</Text>
                  <Text style={styles.countryRowDial}>{item.dialCode}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
