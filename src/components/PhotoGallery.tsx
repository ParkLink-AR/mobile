import { useEffect, useRef, useState } from 'react';
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';

interface PhotoGalleryProps {
  /** All photos for the spot, in order (photos[0] is the cover). */
  photos: string[];
  /** Fallback box height used only until a photo's real aspect ratio loads (or if it
   * fails to load) -- see aspectRatios below for what drives the height the rest of the
   * time. */
  height: number;
  /** Used when `photos` is empty (e.g. spot.photoUrl). Falsy ('') renders an icon placeholder instead of an image. */
  fallbackUri: string;
}

// A too-tall or too-wide photo (panorama, banner crop, etc.) would otherwise make the
// gallery box comically large or thin -- these keep it within a sane range on any screen.
const MIN_HEIGHT_FLOOR = 220;
const MAX_HEIGHT_RATIO = 0.62; // fraction of the window's height

/**
 * Swipeable photo carousel with a "current/total" counter -- plain
 * horizontal + pagingEnabled ScrollView instead of a carousel library, no
 * extra dependency needed for something this simple.
 *
 * The box height tracks the *currently visible* photo's own aspect ratio (fetched once
 * per uri via Image.getSize, clamped to a sane range) instead of a single fixed height
 * for every photo -- a fixed, landscape-shaped box combined with resizeMode="cover" used
 * to crop a portrait photo down to a thin horizontal strip through its middle. Swiping to
 * a different photo re-measures and resizes the box to fit it, so every photo -- portrait
 * or landscape -- is shown close to fully, not cropped away.
 */
export function PhotoGallery({ photos, height, fallbackUri }: PhotoGalleryProps) {
  const { width, height: windowHeight } = useWindowDimensions();
  const colors = useThemeColors();
  const [index, setIndex] = useState(0);
  const uris = photos.length > 0 ? photos : fallbackUri ? [fallbackUri] : [];
  const [aspectRatios, setAspectRatios] = useState<Record<string, number>>({});
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    uris.forEach((uri) => {
      if (aspectRatios[uri] !== undefined) return;
      Image.getSize(
        uri,
        (naturalWidth, naturalHeight) => {
          if (naturalHeight > 0) {
            setAspectRatios((prev) => ({ ...prev, [uri]: naturalWidth / naturalHeight }));
          }
        },
        () => {
          // Unreachable/broken image -- fall back to the default box height below
          // instead of retrying forever.
          setAspectRatios((prev) => ({ ...prev, [uri]: width / height }));
        },
      );
    });
    // Re-run when the actual photo list changes; `aspectRatios` itself is deliberately
    // excluded -- the per-uri guard above already makes repeat runs a no-op.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uris.join('|')]);

  const maxHeight = Math.round(windowHeight * MAX_HEIGHT_RATIO);
  const currentAspect = aspectRatios[uris[index]];
  const boxHeight = currentAspect
    ? Math.max(MIN_HEIGHT_FLOOR, Math.min(Math.round(width / currentAspect), maxHeight))
    : Math.max(MIN_HEIGHT_FLOOR, height);

  // Web only: RN's ScrollView handles touch-drag and trackpad/wheel scroll
  // out of the box, but a browser never turns a plain mouse click-drag into
  // scrolling on its own -- that has to be done by hand here.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node: HTMLElement | undefined = (scrollRef.current as any)?.getScrollableNode?.();
    if (!node) return;

    let dragStartX = 0;
    let dragStartScrollLeft = 0;
    let dragging = false;

    function onMouseDown(e: MouseEvent) {
      dragging = true;
      dragStartX = e.clientX;
      dragStartScrollLeft = node!.scrollLeft;
      node!.style.cursor = 'grabbing';
      // Stops the browser's native "drag this image" ghost/text-selection,
      // which otherwise hijacks the gesture instead of scrolling.
      e.preventDefault();
    }
    function onMouseMove(e: MouseEvent) {
      if (!dragging) return;
      node!.scrollLeft = dragStartScrollLeft - (e.clientX - dragStartX);
    }
    function onMouseUp() {
      if (!dragging) return;
      dragging = false;
      node!.style.cursor = 'grab';
      // Snap to the nearest page, same as pagingEnabled does for touch.
      const nearest = Math.round(node!.scrollLeft / width) * width;
      node!.scrollTo({ left: nearest, behavior: 'smooth' });
    }

    node.style.cursor = 'grab';
    node.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      node.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [width]);

  // onMomentumScrollEnd doesn't reliably fire on react-native-web (mouse-drag
  // scrolling often never triggers it), so the counter is driven by onScroll
  // instead -- it fires continuously and works the same on native and web.
  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    if (newIndex !== index && newIndex >= 0 && newIndex < uris.length) {
      setIndex(newIndex);
    }
  }

  const styles = StyleSheet.create({
    // Flush/square on purpose: some screens overlap a rounded+shadowed card
    // over the bottom of this image (see spots/[id].tsx's hero card), and a
    // second rounded+shadowed edge on the photo itself right behind it just
    // doubled up into a messy seam. That card already owns the transition.
    container: { position: 'relative', backgroundColor: colors.background },
    photo: { width, height: boxHeight },
    placeholder: {
      width, height: boxHeight,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.background,
    },
    counter: {
      position: 'absolute', bottom: 12, right: 14,
      backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12,
      paddingHorizontal: 10, paddingVertical: 4,
    },
    counterText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  });

  if (uris.length === 0) {
    return (
      <View style={styles.placeholder}>
        <Ionicons name="image-outline" size={40} color={colors.textSecondary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {uris.map((uri, i) => (
          <Image key={`${uri}-${i}`} source={{ uri }} style={styles.photo} resizeMode="cover" />
        ))}
      </ScrollView>
      {uris.length > 1 && (
        <View style={styles.counter}>
          <Text style={styles.counterText}>{index + 1}/{uris.length}</Text>
        </View>
      )}
    </View>
  );
}
