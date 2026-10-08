import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/src/api/client';
import { useSessionStore } from '@/src/store/useSessionStore';
import { useNotificationsStore } from '@/src/store/useNotificationsStore';
import { subscribeForegroundMessages } from '@/src/services/pushNotifications';

// Keeps the notifications inbox (and the tab's badge) current while the app is open:
//  - a WebSocket to the gateway, which says "something changed" the moment a
//    notification is saved for this user -> the inbox is refetched right away;
//  - a refetch whenever the app comes back to the foreground (the socket is closed while
//    it's in the background), and when a push arrives with the app open;
//  - a slow fallback refetch, in case the socket is silently down.
// The socket never carries the notifications themselves: the inbox on the server is the
// source of truth, so a missed hint only delays the badge until the next refetch.

const LIVE_URL = `${API_URL.replace(/^http/, 'ws')}/notifications/live`;
// Under Cloudflare's ~100s idle cutoff for WebSockets.
const PING_INTERVAL_MS = 25_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const FALLBACK_REFRESH_MS = 5 * 60_000;
// The badge used to be computed on the device from this persisted list; it's unused now.
const LEGACY_STORAGE_KEY = 'notifications-storage';

/** Mounted once, by the root layout, for the signed-in user. */
export function useNotificationsSync(userId: string | null) {
  useEffect(() => {
    const store = useNotificationsStore.getState();
    if (!userId) {
      store.clear();
      return;
    }
    AsyncStorage.removeItem(LEGACY_STORAGE_KEY).catch(() => {});

    let stopped = false;
    let socket: WebSocket | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const refresh = () => useNotificationsStore.getState().refresh();

    const closeSocket = () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = null;
      const current = socket;
      socket = null;
      current?.close();
    };

    const scheduleReconnect = () => {
      if (stopped || reconnectTimer || AppState.currentState === 'background') return;
      const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1000 * 2 ** attempts);
      attempts += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    async function connect() {
      if (stopped || socket) return;
      // Refetch first: catches up on anything missed while disconnected and, if the access
      // token expired, request() renews it -- so the socket below opens with a valid one.
      await refresh();
      const token = useSessionStore.getState().accessToken;
      if (stopped || socket || !token || AppState.currentState === 'background') return;

      const ws = new WebSocket(`${LIVE_URL}?token=${encodeURIComponent(token)}`);
      socket = ws;
      ws.onopen = () => {
        attempts = 0;
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send('ping');
        }, PING_INTERVAL_MS);
      };
      ws.onmessage = (event) => {
        try {
          if (JSON.parse(String(event.data)).type === 'notifications.changed') refresh();
        } catch {
          // "pong", or anything else that isn't a hint.
        }
      };
      ws.onclose = () => {
        if (socket !== ws) return; // closed on purpose
        socket = null;
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = null;
        // Also covers a rejected token (close code 4401): the next connect() refetches
        // first, which renews it.
        scheduleReconnect();
      };
      ws.onerror = () => {
        // onclose follows and reconnects.
      };
    }

    connect();

    const appState = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        attempts = 0;
        if (socket) refresh();
        else connect();
      } else if (state === 'background') {
        closeSocket();
      }
    });
    const unsubscribePush = subscribeForegroundMessages(() => refresh());
    const fallback = setInterval(refresh, FALLBACK_REFRESH_MS);

    return () => {
      stopped = true;
      closeSocket();
      appState.remove();
      unsubscribePush();
      clearInterval(fallback);
    };
  }, [userId]);
}
