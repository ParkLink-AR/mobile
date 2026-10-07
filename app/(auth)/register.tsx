import { t, useLanguage } from '@/src/i18n';
import { createElement, useEffect, useState } from 'react';
import {
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  View,
  Modal,
  FlatList,
  TouchableOpacity,
  Platform,
  Keyboard,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Screen } from '@/src/components/Screen';
import { CodeInput, ConfirmedRow, FormError, FormIntro, useAccountFormStyles } from '@/src/components/AccountForm';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography, useScale } from '@/src/theme/typography';
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

// The progress bar groups the steps in three stages: email, phone, personal data.
const STAGE_COUNT = 3;
const STAGE_OF_STEP: Record<Step, number> = {
  email: 1,
  'email-code': 1,
  phone: 2,
  'phone-code': 2,
  personal: 3,
};
// El backend puede no tener Twilio configurado (ver mobile/.env) -- en ese
// caso el código de SMS nunca llega, así que el wizard salta directo de
// 'phone' a 'personal' sin pasar por 'phone-code'.
const SKIP_PHONE_VERIFICATION = process.env.EXPO_PUBLIC_SKIP_PHONE_VERIFICATION === 'true';
const RESEND_COOLDOWN_SECONDS = 60;

function formatDate(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function Register() {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const typography = useTypography();
  const setSession = useSessionStore((s) => s.setSession);

  const [step, setStep] = useState<Step>('email');
  // Which code was just accepted: its boxes turn green with a tick for a moment, then
  // the wizard moves on (see confirmThenGo).
  const [confirmedCode, setConfirmedCode] = useState<'email' | 'phone' | null>(null);
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

  // No generic "back" in this wizard: from a code step, the only way back is to fix the
  // email/phone it was sent to (what's typed is kept) and ask for a new code. Starting over
  // is the header's back arrow, to the login.
  function editEmail() {
    setError(null);
    setEmailCode('');
    setStep('email');
  }

  function editPhone() {
    setError(null);
    setPhoneCode('');
    setStep('phone');
  }

  // How long the accepted code stays on screen (green, with its tick) before moving on.
  const CONFIRMED_PAUSE_MS = 900;

  function confirmThenGo(which: 'email' | 'phone', nextStep: Step) {
    setConfirmedCode(which);
    setTimeout(() => {
      setConfirmedCode(null);
      setStep(nextStep);
    }, CONFIRMED_PAUSE_MS);
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
      const alreadyVerified = await requestEmailRegistration(normalized);
      setEmail(normalized);
      if (alreadyVerified) {
        // Verified a moment ago (coming back to an unfinished signup): no new code -- the
        // same green "verified" moment as after entering it, right on this step.
        confirmThenGo('email', 'phone');
        return;
      }
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
      confirmThenGo('email', 'phone');
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
      if (await requestPhoneRegistration(fullPhone)) {
        confirmThenGo('phone', 'personal');
        return;
      }
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
      confirmThenGo('phone', 'personal');
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

  const form = useAccountFormStyles();
  const styles = StyleSheet.create({
    progress: { gap: 8 },
    progressText: { fontSize: sc(12), fontWeight: '700', color: colors.teal, textTransform: 'uppercase', letterSpacing: 0.6 },
    progressBar: { flexDirection: 'row', gap: 6 },
    progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
    progressSegmentDone: { backgroundColor: colors.teal },
    footer: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 4 },
    footerText: { fontSize: sc(14), color: colors.textSecondary },
    nameRow: { flexDirection: 'row', gap: 10 },
    nameCol: { flex: 1 },
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
    dateButton: { ...form.input, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dateButtonText: { fontSize: sc(15), color: birthDate ? colors.text : colors.textSecondary },
  });


  const stage = STAGE_OF_STEP[step];

  return (
    <Screen form style={form.container} edges={['left', 'right', 'bottom']}>
      <View style={styles.progress}>
        <Text style={styles.progressText}>
          {t('auth.register.progress', { current: stage, total: STAGE_COUNT })}
        </Text>
        <View style={styles.progressBar}>
          {Array.from({ length: STAGE_COUNT }, (_, index) => (
            <View key={index} style={[styles.progressSegment, index < stage && styles.progressSegmentDone]} />
          ))}
        </View>
      </View>


      {step === 'email' && (
        <>
          <FormIntro icon="mail-outline" title={t('auth.register.email.title')} text={t('auth.register.email.subtitle')} />
          <FormError message={error} />
          <View style={form.field}>
            <Text style={form.label}>{t('auth.login.emailPlaceholder')}</Text>
            <TextInput
              style={form.input}
              placeholder={t('auth.login.emailExample')}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          {confirmedCode === 'email' ? (
            <ConfirmedRow text={t('auth.register.verified.email')} />
          ) : loading ? (
            <ActivityIndicator color={colors.teal} />
          ) : (
            <Button title={t('auth.sendCodeButton')} onPress={handleSendEmailCode} />
          )}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.register.haveAccount')}</Text>
            <Text style={form.link} onPress={() => router.back()}>
              {t('auth.register.login')}
            </Text>
          </View>
        </>
      )}

      {step === 'email-code' && (
        <>
          <FormIntro
            icon="mail-unread-outline"
            title={t('auth.register.emailCode.title')}
            text={t('auth.register.emailCode.helper', { email })}
          />
          <FormError message={error} />
          <CodeInput value={emailCode} onChange={setEmailCode} autoFocus confirmed={confirmedCode === 'email'} />
          {confirmedCode === 'email' ? (
            <ConfirmedRow text={t('auth.register.verified.email')} />
          ) : loading ? (
            <ActivityIndicator color={colors.teal} />
          ) : (
            <Button title={t('common.confirm')} onPress={handleConfirmEmailCode} />
          )}
          {confirmedCode !== 'email' ? (
            <>
              <Text style={[form.link, emailCooldown > 0 && form.linkDisabled]} onPress={handleResendEmailCode}>
                {emailCooldown > 0 ? t('auth.resendCodeCooldown', { seconds: String(emailCooldown) }) : t('auth.resendCode')}
              </Text>
              <SecondaryLink icon="create-outline" label={t('auth.register.changeEmail')} onPress={editEmail} />
            </>
          ) : null}
        </>
      )}

      {step === 'phone' && (
        <>
          <FormIntro icon="call-outline" title={t('auth.register.phone.title')} text={t('auth.register.phone.subtitle')} />
          <FormError message={error} />
          <View style={form.field}>
            <Text style={form.label}>{t('auth.register.phone.label')}</Text>
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
                placeholder={t('auth.register.phone.placeholder')}
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
              />
            </View>
          </View>
          {confirmedCode === 'phone' ? (
            <ConfirmedRow text={t('auth.register.verified.phone')} />
          ) : loading ? (
            <ActivityIndicator color={colors.teal} />
          ) : (
            <Button
              title={SKIP_PHONE_VERIFICATION ? t('common.continue') : t('auth.sendCodeButton')}
              onPress={handleSendPhoneCode}
            />
          )}

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
          <FormIntro
            icon="chatbubble-ellipses-outline"
            title={t('auth.register.phoneCode.title')}
            text={t('auth.register.phoneCode.helper', { phone: fullPhone })}
          />
          <FormError message={error} />
          <CodeInput value={phoneCode} onChange={setPhoneCode} autoFocus confirmed={confirmedCode === 'phone'} />
          {confirmedCode === 'phone' ? (
            <ConfirmedRow text={t('auth.register.verified.phone')} />
          ) : loading ? (
            <ActivityIndicator color={colors.teal} />
          ) : (
            <Button title={t('common.confirm')} onPress={handleConfirmPhoneCode} />
          )}
          {confirmedCode !== 'phone' ? (
            <>
              <Text style={[form.link, phoneCooldown > 0 && form.linkDisabled]} onPress={handleResendPhoneCode}>
                {phoneCooldown > 0 ? t('auth.resendCodeCooldown', { seconds: String(phoneCooldown) }) : t('auth.resendCode')}
              </Text>
              <SecondaryLink icon="create-outline" label={t('auth.register.changePhone')} onPress={editPhone} />
            </>
          ) : null}
        </>
      )}

      {step === 'personal' && (
        <>
          <FormIntro icon="person-outline" title={t('auth.register.personal.title')} text={t('auth.register.personal.subtitle')} />
          <FormError message={error} />
          <View style={styles.nameRow}>
            <View style={[form.field, styles.nameCol]}>
              <Text style={form.label}>{t('auth.register.personal.firstName')}</Text>
              <TextInput
                style={form.input}
                placeholderTextColor={colors.textSecondary}
                autoComplete="given-name"
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View style={[form.field, styles.nameCol]}>
              <Text style={form.label}>{t('auth.register.personal.lastName')}</Text>
              <TextInput
                style={form.input}
                placeholderTextColor={colors.textSecondary}
                autoComplete="family-name"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>
          <View style={form.field}>
            <Text style={form.label}>{t('auth.register.personal.dni')}</Text>
            <TextInput
              style={form.input}
              placeholder="30123456"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              value={dni}
              onChangeText={(v) => setDni(v.replace(/[^0-9]/g, ''))}
            />
          </View>
          <View style={form.field}>
            <Text style={form.label}>{t('auth.register.personal.birthDate')}</Text>
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
                // Plain CSS: a DOM input doesn't understand RN's style shorthands.
                style: {
                  border: `1.5px solid ${colors.border}`,
                  borderRadius: 12,
                  padding: `${sc(13)}px 14px`,
                  backgroundColor: colors.background,
                  fontSize: sc(15),
                  color: colors.text,
                  fontFamily: 'inherit',
                  width: '100%',
                  boxSizing: 'border-box',
                },
              })
            ) : (
              <>
                <TouchableOpacity style={styles.dateButton} onPress={() => {
                    // Close the DNI keyboard first, or it stays on top of the date picker.
                    Keyboard.dismiss();
                    setShowDatePicker(true);
                  }}>
                  <Text style={styles.dateButtonText}>
                    {birthDate ? formatDate(birthDate) : t('auth.register.personal.birthDatePlaceholder')}
                  </Text>
                  <Ionicons name="calendar-outline" size={sc(18)} color={colors.textSecondary} />
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
          </View>
          <View style={form.field}>
            <Text style={form.label}>{t('auth.login.placeholder.password')}</Text>
            <TextInput
              style={form.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoComplete="new-password"
              value={password}
              onChangeText={setPassword}
            />
            <Text style={form.helper}>{t('auth.register.personal.passwordHint')}</Text>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.teal} />
          ) : (
            <Button title={t('auth.register.button')} onPress={handleFinishRegistration} />
          )}
        </>
      )}
    </Screen>
  );
}

function SecondaryLink({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={sc(16)} color={colors.textSecondary} />
      <Text style={{ fontSize: sc(14), fontWeight: '600', color: colors.textSecondary }}>{label}</Text>
    </Pressable>
  );
}
