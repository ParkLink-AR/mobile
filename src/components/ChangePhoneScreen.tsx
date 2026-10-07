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
  Keyboard,
} from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography, useScale } from '@/src/theme/typography';
import { useSessionStore } from '@/src/store/useSessionStore';
import { requestPhoneChange, confirmPhoneChange } from '@/src/api/auth';
import { ApiError } from '@/src/api/client';
import { CodeInput, CurrentValue, FormError, FormIntro, useAccountFormStyles } from '@/src/components/AccountForm';
import { COUNTRIES, DEFAULT_COUNTRY, Country } from '@/src/data/countries';

const RESEND_COOLDOWN_SECONDS = 60;

export default function ChangePhoneScreen() {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
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

  const form = useAccountFormStyles();
  const styles = StyleSheet.create({
    phoneRow: { flexDirection: 'row', gap: 8 },
    countryButton: { ...form.input, justifyContent: 'center', minWidth: sc(100) },
    countryButtonText: { fontSize: sc(15), color: colors.text, fontWeight: '600' },
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
    countryRowFlag: { fontSize: sc(22) },
    countryRowName: { flex: 1, fontSize: sc(15), color: colors.text },
    countryRowDial: { fontSize: sc(14), color: colors.textSecondary },
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
      <Screen form style={form.container} edges={['left', 'right', 'bottom']}>
        <FormIntro
          icon="chatbubble-ellipses-outline"
          title={t('changePhone.code.title')}
          text={t('changePhone.code.helper', { phone: fullPhone })}
        />
        <FormError message={error} />
        <CodeInput value={code} onChange={setCode} autoFocus />
        {loading ? (
          <ActivityIndicator color={colors.teal} />
        ) : (
          <Button title={t('changePhone.code.button')} onPress={handleConfirm} />
        )}
        <Text style={[form.link, cooldown > 0 && form.linkDisabled]} onPress={handleResend}>
          {cooldown > 0 ? t('auth.resendCodeCooldown', { seconds: String(cooldown) }) : t('auth.resendCode')}
        </Text>
      </Screen>
    );
  }

  return (
    <Screen form style={form.container} edges={['left', 'right', 'bottom']}>
      <CurrentValue icon="call-outline" label={t('changePhone.current')} value={user.phone} />
      <FormError message={error} />
      <View style={form.field}>
        <Text style={form.label}>{t('changePhone.newPhone.label')}</Text>
        <View style={styles.phoneRow}>
          <TouchableOpacity style={styles.countryButton} onPress={() => {
            Keyboard.dismiss();
            setCountryPickerOpen(true);
          }}>
            <Text style={styles.countryButtonText}>
              {country.flag} {country.dialCode}
            </Text>
          </TouchableOpacity>
          <TextInput
            style={[form.input, styles.phoneInput]}
            placeholder="11 2345 6789"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
          />
        </View>
        <Text style={form.helper}>{t('changePhone.newPhone.helper')}</Text>
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
