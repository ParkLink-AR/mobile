import { ReactNode, useCallback, useRef, useState } from 'react';
import { Animated, GestureResponderEvent, StyleSheet, View } from 'react-native';

// Demo/presentation aid: draws a circle wherever the screen is touched, so an audience
// watching a mirrored phone can follow the taps (iOS has no built-in "show touches").
// Off unless EXPO_PUBLIC_SHOW_TOUCHES=true in .env.
const SHOW_TOUCHES = process.env.EXPO_PUBLIC_SHOW_TOUCHES === 'true';

const SIZE = 46;
const FADE_MS = 280;

interface Dot {
  key: string;
  x: number;
  y: number;
  opacity: Animated.Value;
}

/**
 * Wraps the app and draws the touches on top of it. It only listens (onTouch* events bubble
 * up without taking part in the responder system) and its overlay ignores touches, so every
 * button, scroll and map underneath behaves exactly as without it.
 */
export function TouchIndicator({ children }: { children: ReactNode }) {
  if (!SHOW_TOUCHES) return <>{children}</>;
  return <TouchOverlay>{children}</TouchOverlay>;
}

function TouchOverlay({ children }: { children: ReactNode }) {
  const [dots, setDots] = useState<Dot[]>([]);
  // Each finger's current dot (a lifted finger's dot keeps fading out after it leaves here).
  const active = useRef(new Map<string, Dot>());
  const nextKey = useRef(0);

  const place = useCallback((event: GestureResponderEvent) => {
    let changed = false;
    for (const touch of event.nativeEvent.touches) {
      const id = String(touch.identifier);
      const current = active.current.get(id);
      if (current && current.x === touch.pageX && current.y === touch.pageY) continue;
      const dot: Dot = current
        ? { ...current, x: touch.pageX, y: touch.pageY }
        : { key: `t${nextKey.current++}`, x: touch.pageX, y: touch.pageY, opacity: new Animated.Value(1) };
      active.current.set(id, dot);
      changed = true;
    }
    if (changed) {
      setDots((previous) => {
        const live = new Map([...active.current.values()].map((dot) => [dot.key, dot]));
        return [...previous.filter((dot) => !live.has(dot.key)), ...live.values()];
      });
    }
  }, []);

  const release = useCallback((event: GestureResponderEvent) => {
    for (const touch of event.nativeEvent.changedTouches) {
      const id = String(touch.identifier);
      const dot = active.current.get(id);
      if (!dot) continue;
      active.current.delete(id);
      Animated.timing(dot.opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => {
        setDots((previous) => previous.filter((other) => other.key !== dot.key));
      });
    }
  }, []);

  return (
    <View style={styles.root} onTouchStart={place} onTouchMove={place} onTouchEnd={release} onTouchCancel={release}>
      {children}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {dots.map((dot) => (
          <Animated.View
            key={dot.key}
            style={[styles.dot, { left: dot.x - SIZE / 2, top: dot.y - SIZE / 2, opacity: dot.opacity }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dot: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: 'rgba(22, 139, 141, 0.35)',
    borderWidth: 2,
    borderColor: 'rgba(22, 139, 141, 0.9)',
  },
});
