import { t, useLanguage } from '@/src/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/src/components/Screen';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useSessionStore } from '@/src/store/useSessionStore';
import { getMessagesApi, sendMessageApi, MessageApiResponse } from '@/src/api/booking';
import { ApiError } from '@/src/api/client';
import { useScale } from '@/src/theme/typography';

// Polling interval while this screen is focused -- there's no websocket/push-driven
// live update on this screen itself (the OTHER party gets a push notification when a
// message arrives, see booking.message_sent in notifications-service), so a short
// poll is what makes an open conversation feel live for whoever's looking at it.
const POLL_INTERVAL_MS = 4000;

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function BookingMessages() {
  useLanguage();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useSessionStore((s) => s.user?.id);
  const [messages, setMessages] = useState<MessageApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback((withSpinner: boolean) => {
    if (!id) return;
    if (withSpinner) setLoading(true);
    getMessagesApi(id)
      .then((list) => {
        setMessages(list);
        setLoadError(false);
      })
      .catch((err) => {
        console.warn('[BookingMessages] fetch error:', err);
        if (withSpinner) setLoadError(true);
      })
      .finally(() => {
        if (withSpinner) setLoading(false);
      });
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load(true);
      const interval = setInterval(() => load(false), POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }, [load]),
  );

  useEffect(() => {
    if (messages.length > 0) {
      // New messages append at the end (oldest-first, same order the API returns) --
      // scroll down so the latest one is always in view, like any chat.
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || !id || sending) return;
    setSending(true);
    setDraft('');
    try {
      const created = await sendMessageApi(id, body);
      setMessages((prev) => [...prev, created]);
    } catch (err) {
      setDraft(body);
      const msg = err instanceof ApiError ? err.detail : t('driver.booking.messages.errorSend');
      console.warn('[BookingMessages] send error:', msg);
    } finally {
      setSending(false);
    }
  }

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    errorText: { fontSize: sc(15), color: colors.textSecondary, textAlign: 'center', lineHeight: sc(22) },
    list: { padding: 16, gap: 8, flexGrow: 1 },
    bubbleRow: { flexDirection: 'row' },
    bubbleRowMine: { justifyContent: 'flex-end' },
    bubbleRowTheirs: { justifyContent: 'flex-start' },
    bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
    bubbleMine: { backgroundColor: colors.teal, borderBottomRightRadius: 4 },
    bubbleTheirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
    bubbleText: { fontSize: sc(14.5), lineHeight: sc(20) },
    bubbleTextMine: { color: colors.white },
    bubbleTextTheirs: { color: colors.text },
    bubbleTime: { fontSize: sc(10.5), marginTop: 4 },
    bubbleTimeMine: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
    bubbleTimeTheirs: { color: colors.textSecondary },
    inputRow: {
      flexDirection: 'row', alignItems: 'flex-end', gap: 8,
      padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
    },
    input: {
      flex: 1, maxHeight: 100, borderWidth: 1, borderColor: colors.border, borderRadius: 20,
      paddingHorizontal: 16, paddingVertical: 10, fontSize: sc(14.5), color: colors.text,
    },
    sendBtn: {
      width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.teal,
    },
    sendBtnDisabled: { opacity: 0.5 },
  });

  if (loadError) {
    return (
      <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={sc(40)} color={colors.textSecondary} />
          <Text style={styles.errorText}>{t('driver.booking.messages.error')}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen} edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.teal} />
        ) : (
          <FlatList
            ref={listRef}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Ionicons name="chatbubbles-outline" size={sc(40)} color={colors.textSecondary} />
                <Text style={styles.errorText}>{t('driver.booking.messages.empty')}</Text>
              </View>
            }
            renderItem={({ item }) => {
              const mine = item.sender_id === userId;
              return (
                <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
                      {item.body}
                    </Text>
                    <Text style={[styles.bubbleTime, mine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
                      {formatMessageTime(item.created_at)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder={t('driver.booking.messages.placeholder')}
            placeholderTextColor={colors.textSecondary}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <Pressable
            style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!draft.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Ionicons name="send" size={sc(17)} color={colors.white} />
            )}
          </Pressable>
        </View>
        {/* El inset de abajo (home indicator) usa el fondo gris de la pantalla --
            esto lo pinta blanco para que combine con la barra de mensaje. */}
        <View style={{ height: insets.bottom, backgroundColor: colors.surface }} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
