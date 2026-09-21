import { t, useLanguage } from '@/src/i18n';
import { createElement, useEffect, useState } from 'react';
import {
  Text,
  TextInput,
  Image,
  StyleSheet,
  ActivityIndicator,
  View,
  Modal,
  FlatList,
  TouchableOpacity,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { StatusIcon } from '@/src/components/StatusIcon';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import {
  requestEmailRegistration,
  confirmEmailRegistration,
  requestPhoneRegistration,
  confirmPhoneRegistration,
  register,
  login,
} from '@/src/api/auth';
import { useSessionStore } from '@/src/store/useSessionStore';
import { ApiError } from '@/src/api/client';
import { COUNTRIES, DEFAULT_COUNTRY, Country } from '@/src/data/countries';

type Step = 'email' | 'email-code' | 'phone' | 'phone-code' | 'personal';
// El backend puede no tener Twilio configurado (ver mobile/.env) -- en ese
// caso el código de SMS nunca llega, así que el wizard salta directo de
// 'phone' a 'personal' sin pasar por 'phone-code'.
const SKIP_PHONE_VERIFICATION = process.env.EXPO_PUBLIC_SKIP_PHONE_VERIFICATION === 'true';
const STEP_ORDER: Step[] = SKIP_PHONE_VERIFICATION
  ? ['email', 'email-code', 'phone', 'personal']
  : ['email', 'email-code', 'phone', 'phone-code', 'personal'];
const RESEND_COOLDOWN_SECONDS = 60;

function formatDate(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function Register() {
  useLanguage();
  const colors = useThemeColors();
  const typography = useTypography();
  const setSession = useSessionStore((s) => s.setSession);

  const [step, setStep] = useState<Step>('email');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailCooldown, setEmailCooldown] = useState(0);

  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCooldown, setPhoneCooldown] = useState(0);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dni, setDni] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [password, setPassword] = useState('');

  const fullPhone = `${country.dialCode}${phoneNumber.replace(/[^0-9]/g, '')}`;

  useEffect(() => {
    if (emailCooldown <= 0) return;
    const id = setInterval(() => setEmailCooldown((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(id);
  }, [emailCooldown]);

  useEffect(() => {
    if (phoneCooldown <= 0) return;
    const id = setInterval(() => setPhoneCooldown((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(id);
  }, [phoneCooldown]);

  function handleApiError(err: unknown, fallback: string) {
    setError(err instanceof ApiError ? err.detail : fallback);
  }

  function goBack() {
    setError(null);
    const index = STEP_ORDER.indexOf(step);
    if (index > 0) setStep(STEP_ORDER[index - 1]);
  }

  function flashSuccessThenGo(message: string, nextStep: Step) {
    setSuccessMessage(message);
    setTimeout(() => {
      setSuccessMessage(null);
      setStep(nextStep);
    }, 1100);
  }

  async function handleSendEmailCode() {
    setError(null);
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError(t('auth.error.emailRequired'));
      return;
    }
    setLoading(true);
    try {
      await requestEmailRegistration(normalized);
      setEmail(normalized);
      setStep('email-code');
      setEmailCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      handleApiError(err, t('auth.error.sendCode'));
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmEmailCode() {
    setError(null);
    if (emailCode.length !== 6) {
      setError(t('auth.error.codeLength'));
      return;
    }
    setLoading(true);
    try {
      await confirmEmailRegistration(email, emailCode);
      flashSuccessThenGo(t('auth.register.emailCode.success'), 'phone');
    } catch (err) {
      handleApiError(err, t('auth.error.confirmCode'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendEmailCode() {
    if (emailCooldown > 0) return;
    setError(null);
    try {
      await requestEmailRegistration(email);
      setEmailCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      handleApiError(err, t('auth.error.resendCode'));
    }
  }

  async function handleSendPhoneCode() {
    setError(null);
    if (!phoneNumber.trim()) {
      setError(t('auth.register.phone.error.required'));
      return;
    }
    if (SKIP_PHONE_VERIFICATION) {
      setStep('personal');
      return;
    }
    setLoading(true);
    try {
      await requestPhoneRegistration(fullPhone);
      setStep('phone-code');
      setPhoneCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      handleApiError(err, t('auth.error.sendCode'));
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmPhoneCode() {
    setError(null);
    if (phoneCode.length !== 6) {
      setError(t('auth.error.codeLength'));
      return;
    }
    setLoading(true);
    try {
      await confirmPhoneRegistration(fullPhone, phoneCode);
      flashSuccessThenGo(t('auth.register.phoneCode.success'), 'personal');
    } catch (err) {
      handleApiError(err, t('auth.error.confirmCode'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendPhoneCode() {
    if (phoneCooldown > 0) return;
    setError(null);
    try {
      await requestPhoneRegistration(fullPhone);
      setPhoneCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      handleApiError(err, t('auth.error.resendCode'));
    }
  }

  async function handleFinishRegistration() {
    setError(null);
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedDni = dni.trim();
    if (!trimmedFirstName || !trimmedLastName || !trimmedDni || !birthDate || !password) {
      setError(t('auth.register.personal.error.required'));
      return;
    }
    setLoading(true);
    try {
      await register({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        dni: trimmedDni,
        email,
        phone: fullPhone,
        birthDate: birthDate.toISOString().slice(0, 10),
        password,
      });
      const { user: newUser, tokens } = await login({ email, password });
      setSession(newUser, tokens);
      router.replace('/(auth)/account-type' as never);
    } catch (err) {
      handleApiError(err, t('auth.register.personal.error.submit'));
    } finally {
      setLoading(false);
    }
  }

  const styles = StyleSheet.create({
    container: { backgroundColor: colors.surface, padding: 24, gap: 12 },
    logo: { width: 120, height: 90, alignSelf: 'center', marginBottom: 4 },
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
    error: { color: '#C62828', fontSize: 13 },
    link: { color: colors.teal, textAlign: 'center', marginTop: 4 },
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
    successWrap: { alignItems: 'center', gap: 12, paddingVertical: 40 },
    successText: { fontSize: 16, fontWeight: '600', color: colors.text },
    successButton: { alignSelf: 'stretch', marginTop: 12 },
    successCenteredText: { textAlign: 'center' },
    dateButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
    },
    dateButtonText: { fontSize: 15, color: birthDate ? colors.text : colors.textSecondary },
  });

  if (successMessage) {
    return (
      <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
        <View style={styles.successWrap}>
          <StatusIcon variant="success" />
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      <Image
        source={require('@/assets/logo-parklink.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {step === 'email' && (
        <>
          <Text style={typography.h1}>{t('auth.register.email.title')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('auth.emailPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          {loading ? (
            <ActivityIndicator color={colors.teal} />
          ) : (
            <Button title={t('auth.sendCodeButton')} onPress={handleSendEmailCode} />
          )}
        </>
      )}

      {step === 'email-code' && (
        <>
          <Text style={typography.h1}>{t('auth.register.emailCode.title')}</Text>
          <Text style={typography.body}>{t('auth.register.emailCode.helper', { email })}</Text>
          <TextInput
            style={styles.codeInput}
            placeholder="000000"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            maxLength={6}
            value={emailCode}
            onChangeText={(v) => setEmailCode(v.replace(/[^0-9]/g, ''))}
          />
          {loading ? (
            <ActivityIndicator color={colors.teal} />
          ) : (
            <Button title={t('common.confirm')} onPress={handleConfirmEmailCode} />
          )}
          <Text
            style={[styles.link, emailCooldown > 0 && styles.linkDisabled]}
            onPress={handleResendEmailCode}
          >
            {emailCooldown > 0 ? t('auth.resendCodeCooldown', { seconds: String(emailCooldown) }) : t('auth.resendCode')}
          </Text>
          <Text style={styles.link} onPress={goBack}>
            {t('common.back')}
          </Text>
        </>
      )}

      {step === 'phone' && (
        <>
          <Text style={typography.h1}>{t('auth.register.phone.title')}</Text>
          <View style={styles.phoneRow}>
            <TouchableOpacity style={styles.countryButton} onPress={() => setCountryPickerOpen(true)}>
              <Text style={styles.countryButtonText}>
                {country.flag} {country.dialCode}
              </Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.input, styles.phoneInput]}
              placeholder={t('auth.register.phone.placeholder')}
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
            />
          </View>
          {loading ? (
            <ActivityIndicator color={colors.teal} />
          ) : (
            <Button
              title={SKIP_PHONE_VERIFICATION ? t('common.continue') : t('auth.sendCodeButton')}
              onPress={handleSendPhoneCode}
            />
          )}
          <Text style={styles.link} onPress={goBack}>
            {t('common.back')}
          </Text>

          <Modal
            visible={countryPickerOpen}
            animationType="slide"
            transparent
            onRequestClose={() => setCountryPickerOpen(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={typography.h2}>{t('auth.register.phone.countryPicker.title')}</Text>
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
        </>
      )}

      {step === 'phone-code' && (
        <>
          <Text style={typography.h1}>{t('auth.register.phoneCode.title')}</Text>
          <Text style={typography.body}>{t('auth.register.phoneCode.helper', { phone: fullPhone })}</Text>
          <TextInput
            style={styles.codeInput}
            placeholder="000000"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            maxLength={6}
            value={phoneCode}
            onChangeText={(v) => setPhoneCode(v.replace(/[^0-9]/g, ''))}
          />
          {loading ? (
            <ActivityIndicator color={colors.teal} />
          ) : (
            <Button title={t('common.confirm')} onPress={handleConfirmPhoneCode} />
          )}
          <Text
            style={[styles.link, phoneCooldown > 0 && styles.linkDisabled]}
            onPress={handleResendPhoneCode}
          >
            {phoneCooldown > 0 ? t('auth.resendCodeCooldown', { seconds: String(phoneCooldown) }) : t('auth.resendCode')}
          </Text>
          <Text style={styles.link} onPress={goBack}>
            {t('common.back')}
          </Text>
        </>
      )}

      {step === 'personal' && (
        <>
          <Text style={typography.h1}>{t('auth.register.personal.title')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('auth.register.personal.firstName')}
            placeholderTextColor={colors.textSecondary}
            value={firstName}
            onChangeText={setFirstName}
          />
          <TextInput
            style={styles.input}
            placeholder={t('auth.register.personal.lastName')}
            placeholderTextColor={colors.textSecondary}
            value={lastName}
            onChangeText={setLastName}
          />
          <TextInput
            style={styles.input}
            placeholder={t('auth.register.personal.dni')}
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            value={dni}
            onChangeText={(v) => setDni(v.replace(/[^0-9]/g, ''))}
          />
          {Platform.OS === 'web' ? (
            // @react-native-community/datetimepicker doesn't support web at
            // all (silently no-ops) -- fall back to the browser's native
            // date input there.
            createElement('input', {
              type: 'date',
              value: birthDate ? birthDate.toISOString().slice(0, 10) : '',
              max: new Date().toISOString().slice(0, 10),
              onChange: (e: { target: { value: string } }) =>
                setBirthDate(e.target.value ? new Date(`${e.target.value}T00:00:00`) : null),
              style: {
                ...styles.dateButton,
                fontSize: 15,
                color: colors.text,
                fontFamily: 'inherit',
              },
            })
          ) : (
            <>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateButtonText}>
                  {birthDate ? formatDate(birthDate) : t('auth.register.personal.birthDate')}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={birthDate ?? new Date(2000, 0, 1)}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(_, date) => {
                    setShowDatePicker(false);
                    if (date) setBirthDate(date);
                  }}
                />
              )}
            </>
          )}
          <TextInput
            style={styles.input}
            placeholder={t('auth.login.placeholder.password')}
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Text style={typography.caption}>
            {t('auth.register.personal.passwordHint')}
          </Text>
          {loading ? (
            <ActivityIndicator color={colors.teal} />
          ) : (
            <Button title={t('auth.register.button')} onPress={handleFinishRegistration} />
          )}
          <Text style={styles.link} onPress={goBack}>
            {t('common.back')}
          </Text>
        </>
      )}
    </Screen>
  );
}
