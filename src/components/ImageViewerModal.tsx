import { useState } from 'react';
import {
  Animated, Dimensions, GestureResponderEvent, Modal, PanResponder, Pressable, StyleSheet, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/src/i18n';

const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
const DOUBLE_TAP_MS = 300;
/** A touch that moved less than this is a tap, not a drag. */
const TAP_SLOP = 10;

function distance(e: GestureResponderEvent) {
  const [a, b] = e.nativeEvent.touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

// Keeps the zoomed photo covering the screen -- it can't be dragged off past its edges.
function clamp(value: number, zoom: number, size: number) {
  const limit = (size * (zoom - 1)) / 2;
  return Math.min(limit, Math.max(-limit, value));
}

/** The photo's zoom/offset and the touch handling that drives them, made once per viewer. */
function createZoom() {
  const scale = new Animated.Value(1);
  const x = new Animated.Value(0);
  const y = new Animated.Value(0);
  // The values as last set, plus where the current gesture started from.
  const g = {
    scale: 1, x: 0, y: 0,
    pinchDistance: 0, pinchScale: 1,
    lastX: 0, lastY: 0, moved: false, lastTap: 0,
  };

  function apply(nextScale: number, nextX: number, nextY: number, animate = false) {
    const window = Dimensions.get('window');
    g.scale = nextScale;
    g.x = clamp(nextX, nextScale, window.width);
    g.y = clamp(nextY, nextScale, window.height);
    if (animate) {
      Animated.parallel([
        Animated.timing(scale, { toValue: g.scale, duration: 200, useNativeDriver: false }),
        Animated.timing(x, { toValue: g.x, duration: 200, useNativeDriver: false }),
        Animated.timing(y, { toValue: g.y, duration: 200, useNativeDriver: false }),
      ]).start();
    } else {
      scale.setValue(g.scale);
      x.setValue(g.x);
      y.setValue(g.y);
    }
  }

  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      g.moved = false;
      g.pinchDistance = 0;
      g.lastX = e.nativeEvent.pageX;
      g.lastY = e.nativeEvent.pageY;
    },
    onPanResponderMove: (e, state) => {
      const touches = e.nativeEvent.touches;
      if (Math.abs(state.dx) > TAP_SLOP || Math.abs(state.dy) > TAP_SLOP || touches.length > 1) g.moved = true;
      if (touches.length >= 2) {
        if (!g.pinchDistance) {
          g.pinchDistance = distance(e);
          g.pinchScale = g.scale;
          return;
        }
        apply(Math.min(MAX_ZOOM, Math.max(1, (g.pinchScale * distance(e)) / g.pinchDistance)), g.x, g.y);
        return;
      }
      // One finger (also the one left after a pinch): drags the photo around while zoomed.
      const [touch] = touches;
      if (!touch) return;
      if (g.pinchDistance) {
        g.pinchDistance = 0;
      } else if (g.scale > 1) {
        apply(g.scale, g.x + touch.pageX - g.lastX, g.y + touch.pageY - g.lastY);
      }
      g.lastX = touch.pageX;
      g.lastY = touch.pageY;
    },
    onPanResponderRelease: () => {
      if (g.moved) return;
      const now = Date.now();
      if (now - g.lastTap < DOUBLE_TAP_MS) {
        g.lastTap = 0;
        apply(g.scale > 1 ? 1 : DOUBLE_TAP_ZOOM, 0, 0, true);
      } else {
        g.lastTap = now;
      }
    },
  });

  return {
    panHandlers: responder.panHandlers,
    transform: [{ translateX: x }, { translateY: y }, { scale }],
    reset: () => apply(1, 0, 0),
  };
}

/**
 * A photo shown full screen over a black backdrop, to look at it in detail: pinch to zoom,
 * drag around once zoomed, double tap to zoom in/out. Closes with the X or the back button.
 * Plain PanResponder + Animated -- no gesture library, so it runs the same in Expo Go,
 * on device builds and on web.
 */
export function ImageViewerModal({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [zoom] = useState(createZoom);

  function close() {
    zoom.reset();
    onClose();
  }

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
    photo: { width, height },
    close: {
      position: 'absolute', top: insets.top + 12, right: 16,
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)',
    },
  });

  return (
    <Modal visible={!!uri} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <Animated.View style={styles.root} {...zoom.panHandlers}>
        {uri ? (
          <Animated.Image
            source={{ uri }}
            resizeMode="contain"
            style={[styles.photo, { transform: zoom.transform }]}
          />
        ) : null}
      </Animated.View>
      <Pressable style={styles.close} onPress={close} hitSlop={8} accessibilityLabel={t('common.close')}>
        <Ionicons name="close" size={24} color="#fff" />
      </Pressable>
    </Modal>
  );
}
