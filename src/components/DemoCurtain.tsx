import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Presentation aid: a tiny dot just under the notch / Dynamic Island blacks the whole screen
// out, so a phone mirrored to the audience shows nothing while the other phone is being
// demoed; tapping the same spot again (anywhere along the top while it's black) brings the app
// back exactly as it was, and so does a double tap anywhere on the black. (It can't sit on the clock itself: iOS keeps status-bar taps for its
// own scroll-to-top.) The status bar stays: its dark text is invisible on the black anyway.
// Off unless EXPO_PUBLIC_DEMO_CURTAIN=true in .env.
const DEMO_CURTAIN = process.env.EXPO_PUBLIC_DEMO_CURTAIN === 'true';

const DOT = 6;
const TARGET_WIDTH = 44;
const TARGET_HEIGHT = 20;
// While black there is nothing to hit by mistake, so the whole top of the screen brings it back.
const RESTORE_HEIGHT = 140;
const DOUBLE_TAP_MS = 400;

export function DemoCurtain() {
  if (!DEMO_CURTAIN) return null;
  return <Curtain />;
}

function Curtain() {
  const [hidden, setHidden] = useState(false);
  const insets = useSafeAreaInsets();
  const lastTap = useRef(0);

  const tapOnBlack = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      setHidden(false);
    } else {
      lastTap.current = now;
    }
  };

  const content = (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {hidden && <Pressable accessibilityLabel="Pantalla oculta" onPress={tapOnBlack} style={styles.black} />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hidden ? 'Mostrar la pantalla' : 'Ocultar la pantalla'}
        onPress={() => setHidden((value) => !value)}
        hitSlop={4}
        style={hidden ? [styles.restore, { top: insets.top }] : [styles.target, { top: insets.top }]}
      >
        <View style={[styles.dot, hidden && styles.dotOnBlack]} />
      </Pressable>
    </View>
  );

  // On iOS the overlay lives in its own window above everything, modals and sheets included;
  // touches outside the dot fall through to the app untouched.
  if (Platform.OS === 'ios') return <FullWindowOverlay>{content}</FullWindowOverlay>;
  return content;
}

const styles = StyleSheet.create({
  black: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#000' },
  target: {
    position: 'absolute',
    left: '50%',
    marginLeft: -TARGET_WIDTH / 2,
    width: TARGET_WIDTH,
    height: TARGET_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restore: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: RESTORE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: (TARGET_HEIGHT - DOT) / 2,
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: 'rgba(120, 120, 120, 0.35)' },
  dotOnBlack: { backgroundColor: 'rgba(255, 255, 255, 0.18)' },
});
