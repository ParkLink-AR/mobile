import { useEffect, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';

interface PhotoGalleryProps {
  /** All photos for the spot, in order (photos[0] is the cover). */
  photos: string[];
  /** Used when `photos` is empty (e.g. spot.photoUrl). Falsy ('') renders an icon placeholder instead of an image. */
  fallbackUri: string;
}

/**
 * Swipeable photo carousel with a "current/total" counter -- plain
 * horizontal + pagingEnabled ScrollView instead of a carousel library, no
 * extra dependency needed for something this simple.
 *
 * The box is always a fixed square (width x width), same as Mercado Libre's product
 * photo area -- it never resizes per photo. Each photo uses resizeMode="contain" inside
 * it, so a portrait photo is letterboxed left/right and a landscape one top/bottom, but
 * the whole photo is always visible -- never cropped down to a strip the way a fixed
 * *landscape* box + resizeMode="cover" used to crop tall photos.
 */
export function PhotoGallery({ photos, fallbackUri }: PhotoGalleryProps) {
  const { width } = useWindowDimensions();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const colors = useThemeColors();
  const [index, setIndex] = useState(0);
  const uris = photos.length > 0 ? photos : fallbackUri ? [fallbackUri] : [];
  const scrollRef = useRef<ScrollView>(null);
  const boxSize = width;

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
    photo: { width: boxSize, height: boxSize },
    placeholder: {
      width: boxSize, height: boxSize,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.background,
    },
    counter: {
      position: 'absolute', bottom: 12, right: 14,
      backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12,
      paddingHorizontal: 10, paddingVertical: 4,
    },
    counterText: { color: '#fff', fontSize: sc(12), fontWeight: '700' },
  });

  if (uris.length === 0) {
    return (
      <View style={styles.placeholder}>
        <Ionicons name="image-outline" size={sc(40)} color={colors.textSecondary} />
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
          <Image key={`${uri}-${i}`} source={{ uri }} style={styles.photo} resizeMode="contain" />
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
