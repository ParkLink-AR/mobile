import { t } from '@/src/i18n';
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
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import {
  requestEmailRegistration,
  confirmEmailRegistration,
  requestPhoneRegistration,
  confirmPhoneRegistration,
  register,
} from '@/src/api/auth';
import { ApiError } from '@/src/api/client';
import { COUNTRIES, DEFAULT_COUNTRY, Country } from '@/src/data/countries';

type Step = 'email' | 'email-code' | 'phone' | 'phone-code' | 'personal';
const STEP_ORDER: Step[] = ['email', 'email-code', 'phone', 'phone-code', 'personal'];
const RESEND_COOLDOWN_SECONDS = 60;

function formatDate(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function Register() {
  const colors = useThemeColors();
  const typography = useTypography();

  const [step, setStep] = useState<Step>('email');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);
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
      setError('Ingresá tu email.');
      return;
    }
    setLoading(true);
    try {
      await requestEmailRegistration(normalized);
      setEmail(normalized);
      setStep('email-code');
      setEmailCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      handleApiError(err, 'No se pudo enviar el código.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmEmailCode() {
    setError(null);
    if (emailCode.length !== 6) {
      setError('Ingresá el código de 6 dígitos.');
      return;
    }
    setLoading(true);
    try {
      await confirmEmailRegistration(email, emailCode);
      flashSuccessThenGo('Email verificado correctamente', 'phone');
    } catch (err) {
      handleApiError(err, 'No se pudo confirmar el código.');
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
      handleApiError(err, 'No se pudo reenviar el código.');
    }
  }

  async function handleSendPhoneCode() {
    setError(null);
    if (!phoneNumber.trim()) {
      setError('Ingresá tu número.');
      return;
    }
    setLoading(true);
    try {
      await requestPhoneRegistration(fullPhone);
      setStep('phone-code');
      setPhoneCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      handleApiError(err, 'No se pudo enviar el código.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmPhoneCode() {
    setError(null);
    if (phoneCode.length !== 6) {
      setError('Ingresá el código de 6 dígitos.');
      return;
    }
    setLoading(true);
    try {
      await confirmPhoneRegistration(fullPhone, phoneCode);
      flashSuccessThenGo('Teléfono verificado correctamente', 'personal');
    } catch (err) {
      handleApiError(err, 'No se pudo confirmar el código.');
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
      handleApiError(err, 'No se pudo reenviar el código.');
    }
  }

  async function handleFinishRegistration() {
    setError(null);
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedDni = dni.trim();
    if (!trimmedFirstName || !trimmedLastName || !trimmedDni || !birthDate || !password) {
      setError('Completá todos los campos.');
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
      setRegistrationComplete(true);
    } catch (err) {
      handleApiError(err, 'No se pudo crear la cuenta.');
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
    successCheck: { fontSize: 48, color: colors.teal },
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

  if (registrationComplete) {
    return (
      <Screen style={styles.container}>
        <View style={styles.successWrap}>
          <Text style={styles.successCheck}>✓</Text>
          <Text style={[typography.h1, styles.successCenteredText]}>{t('register.success.title')}</Text>
          <Text style={[typography.body, styles.successCenteredText]}>{t('register.success.message')}</Text>
          <Button
            title={t('register.success.button')}
            onPress={() => router.replace({ pathname: '/(auth)/login', params: { email } })}
            style={styles.successButton}
          />
        </View>
      </Screen>
    );
  }

  if (successMessage) {
    return (
      <Screen style={styles.container}>
        <View style={styles.successWrap}>
          <Text style={styles.successCheck}>✓</Text>
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
      <Image
        source={require('@/assets/logo-parklink.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {step === 'email' && (
        <>
          <Text style={typography.h1}>¿Cuál es tu email?</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          {loading ? (
            <ActivityIndicator color={colors.teal} />
          ) : (
            <Button title="Enviar código" onPress={handleSendEmailCode} />
          )}
        </>
      )}

      {step === 'email-code' && (
        <>
          <Text style={typography.h1}>Confirmá tu email</Text>
          <Text style={typography.body}>Te mandamos un código de 6 dígitos a {email}.</Text>
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
            <Button title="Confirmar" onPress={handleConfirmEmailCode} />
          )}
          <Text
            style={[styles.link, emailCooldown > 0 && styles.linkDisabled]}
            onPress={handleResendEmailCode}
          >
            {emailCooldown > 0 ? `Reenviar código (${emailCooldown}s)` : 'Reenviar código'}
          </Text>
          <Text style={styles.link} onPress={goBack}>
            Atrás
          </Text>
        </>
      )}

      {step === 'phone' && (
        <>
          <Text style={typography.h1}>¿Cuál es tu teléfono?</Text>
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
            <Button title="Enviar código" onPress={handleSendPhoneCode} />
          )}
          <Text style={styles.link} onPress={goBack}>
            Atrás
          </Text>

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
        </>
      )}

      {step === 'phone-code' && (
        <>
          <Text style={typography.h1}>Confirmá tu teléfono</Text>
          <Text style={typography.body}>Te mandamos un código de 6 dígitos por SMS a {fullPhone}.</Text>
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
            <Button title="Confirmar" onPress={handleConfirmPhoneCode} />
          )}
          <Text
            style={[styles.link, phoneCooldown > 0 && styles.linkDisabled]}
            onPress={handleResendPhoneCode}
          >
            {phoneCooldown > 0 ? `Reenviar código (${phoneCooldown}s)` : 'Reenviar código'}
          </Text>
          <Text style={styles.link} onPress={goBack}>
            Atrás
          </Text>
        </>
      )}

      {step === 'personal' && (
        <>
          <Text style={typography.h1}>Tus datos</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre"
            placeholderTextColor={colors.textSecondary}
            value={firstName}
            onChangeText={setFirstName}
          />
          <TextInput
            style={styles.input}
            placeholder="Apellido"
            placeholderTextColor={colors.textSecondary}
            value={lastName}
            onChangeText={setLastName}
          />
          <TextInput
            style={styles.input}
            placeholder="DNI"
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
                  {birthDate ? formatDate(birthDate) : 'Fecha de nacimiento'}
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
            Mínimo 8 caracteres, con una mayúscula, una minúscula y un número. Tenés que ser
            mayor de 18 años.
          </Text>
          {loading ? (
            <ActivityIndicator color={colors.teal} />
          ) : (
            <Button title="Crear cuenta" onPress={handleFinishRegistration} />
          )}
          <Text style={styles.link} onPress={goBack}>
            Atrás
          </Text>
        </>
      )}
    </Screen>
  );
}
