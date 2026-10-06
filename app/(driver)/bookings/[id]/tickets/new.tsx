import { t, useLanguage } from '@/src/i18n';
import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router, useLocalSearchParams, useSegments } from 'expo-router';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { createTicketApi } from '@/src/api/booking';
import { ApiError } from '@/src/api/client';
import { useScale } from '@/src/theme/typography';

export default function NewTicket() {
  useLanguage();
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const group = `/${useSegments()[0]}`;
  const { id } = useLocalSearchParams<{ id: string }>();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = subject.trim().length > 0 && body.trim().length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !id) return;
    setSubmitting(true);
    setError('');
    try {
      const ticket = await createTicketApi(id, subject.trim(), body.trim());
      router.replace(`${group}/bookings/${id}/tickets/${ticket.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : t('driver.booking.tickets.errorCreate'));
      setSubmitting(false);
    }
  }

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, gap: 16 },
    label: { fontSize: sc(13), fontWeight: '600', color: colors.textSecondary },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 12,
      paddingHorizontal: 14, paddingVertical: 12, fontSize: sc(15), color: colors.text,
      backgroundColor: colors.surface,
    },
    bodyInput: { minHeight: 120, textAlignVertical: 'top' },
    errorText: { fontSize: sc(13.5), color: '#C62828' },
    submitBtn: {
      backgroundColor: colors.teal, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { color: colors.white, fontSize: sc(15), fontWeight: '700' },
  });

  return (
    <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>{t('driver.booking.tickets.subjectLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('driver.booking.tickets.subjectPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={subject}
              onChangeText={setSubject}
              maxLength={200}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>{t('driver.booking.tickets.bodyLabel')}</Text>
            <TextInput
              style={[styles.input, styles.bodyInput]}
              placeholder={t('driver.booking.tickets.bodyPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={body}
              onChangeText={setBody}
              multiline
            />
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.submitBtnText}>{t('driver.booking.tickets.submit')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
