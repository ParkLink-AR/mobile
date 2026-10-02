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
import {
  getTicketApi, getTicketMessagesApi, addTicketMessageApi,
  TicketApiResponse, TicketMessageApiResponse, TicketStatus,
} from '@/src/api/booking';
import { ApiError } from '@/src/api/client';

// Same reasoning as the booking chat screen: no websocket, so a short poll is
// what makes the thread feel live while it's open (the ticket creator gets a
// push when staff reply, see support.ticket_replied in notifications-service).
const POLL_INTERVAL_MS = 4000;

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'ABIERTO',
  IN_PROGRESS: 'EN CURSO',
  RESOLVED: 'RESUELTO',
  CLOSED: 'CERRADO',
};

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function TicketThread() {
  useLanguage();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
  const userId = useSessionStore((s) => s.user?.id);
  const [ticket, setTicket] = useState<TicketApiResponse | null>(null);
  const [messages, setMessages] = useState<TicketMessageApiResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback((withSpinner: boolean) => {
    if (!ticketId) return;
    if (withSpinner) setLoading(true);
    Promise.all([getTicketApi(ticketId), getTicketMessagesApi(ticketId)])
      .then(([t, msgs]) => {
        setTicket(t);
        setMessages(msgs);
        setLoadError(false);
      })
      .catch((err) => {
        console.warn('[TicketThread] fetch error:', err);
        if (withSpinner) setLoadError(true);
      })
      .finally(() => {
        if (withSpinner) setLoading(false);
      });
  }, [ticketId]);

  useFocusEffect(
    useCallback(() => {
      load(true);
      const interval = setInterval(() => load(false), POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }, [load]),
  );

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || !ticketId || sending) return;
    setSending(true);
    setDraft('');
    try {
      const created = await addTicketMessageApi(ticketId, body);
      setMessages((prev) => [...prev, created]);
    } catch (err) {
      setDraft(body);
      const msg = err instanceof ApiError ? err.detail : t('driver.booking.tickets.errorSend');
      console.warn('[TicketThread] send error:', msg);
    } finally {
      setSending(false);
    }
  }

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
    errorText: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
    header: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
    },
    headerSubject: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
    badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
    badgeText: { color: colors.white, fontSize: 10.5, fontWeight: '700' },
    list: { padding: 16, gap: 8, flexGrow: 1 },
    bubbleRow: { flexDirection: 'row' },
    bubbleRowMine: { justifyContent: 'flex-end' },
    bubbleRowTheirs: { justifyContent: 'flex-start' },
    bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
    bubbleMine: { backgroundColor: colors.teal, borderBottomRightRadius: 4 },
    bubbleTheirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
    bubbleSender: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
    bubbleSenderTheirs: { color: colors.teal },
    bubbleText: { fontSize: 14.5, lineHeight: 20 },
    bubbleTextMine: { color: colors.white },
    bubbleTextTheirs: { color: colors.text },
    bubbleTime: { fontSize: 10.5, marginTop: 4 },
    bubbleTimeMine: { color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
    bubbleTimeTheirs: { color: colors.textSecondary },
    inputRow: {
      flexDirection: 'row', alignItems: 'flex-end', gap: 8,
      padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
    },
    input: {
      flex: 1, maxHeight: 100, borderWidth: 1, borderColor: colors.border, borderRadius: 20,
      paddingHorizontal: 16, paddingVertical: 10, fontSize: 14.5, color: colors.text,
    },
    sendBtn: {
      width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.teal,
    },
    sendBtnDisabled: { opacity: 0.5 },
  });

  const STATUS_COLORS: Record<TicketStatus, string> = {
    OPEN: colors.warning,
    IN_PROGRESS: colors.teal,
    RESOLVED: colors.success,
    CLOSED: colors.textSecondary,
  };

  if (loadError) {
    return (
      <Screen style={styles.screen} edges={['left', 'right', 'bottom']}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.textSecondary} />
          <Text style={styles.errorText}>{t('driver.booking.tickets.error')}</Text>
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
          <>
            {ticket && (
              <View style={styles.header}>
                <Text style={styles.headerSubject} numberOfLines={1}>{ticket.subject}</Text>
                <View style={[styles.badge, { backgroundColor: STATUS_COLORS[ticket.status] }]}>
                  <Text style={styles.badgeText}>{STATUS_LABELS[ticket.status]}</Text>
                </View>
              </View>
            )}
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item }) => {
                const mine = item.sender_id === userId;
                return (
                  <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                      {!mine && item.is_admin && (
                        <Text style={[styles.bubbleSender, styles.bubbleSenderTheirs]}>
                          {t('driver.booking.tickets.supportLabel')}
                        </Text>
                      )}
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
          </>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder={t('driver.booking.tickets.messagePlaceholder')}
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
              <Ionicons name="send" size={17} color={colors.white} />
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
