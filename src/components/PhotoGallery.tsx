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

interface PhotoGalleryProps {
  /** All photos for the spot, in order (photos[0] is the cover). */
  photos: string[];
  height: number;
  /** Shown when `photos` is empty (e.g. spot.photoUrl, which already falls back to a placeholder). */
  fallbackUri: string;
}

/**
 * Swipeable photo carousel with a "current/total" counter -- plain
 * horizontal + pagingEnabled ScrollView instead of a carousel library, no
 * extra dependency needed for something this simple.
 */
export function PhotoGallery({ photos, height, fallbackUri }: PhotoGalleryProps) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const uris = photos.length > 0 ? photos : [fallbackUri];
  const scrollRef = useRef<ScrollView>(null);

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
    container: { position: 'relative' },
    photo: { width, height },
    counter: {
      position: 'absolute', bottom: 12, right: 14,
      backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12,
      paddingHorizontal: 10, paddingVertical: 4,
    },
    counterText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  });

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
          <Image key={`${uri}-${i}`} source={{ uri }} style={styles.photo} />
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
