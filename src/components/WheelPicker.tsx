import { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleProp,
  ViewStyle,
  Platform,
  type ScrollViewInstance,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';

export interface WheelPickerItem<T = number> {
  value: T;
  label: string;
}

interface WheelPickerProps<T = number> {
  items: WheelPickerItem<T>[];
  selectedValue: T;
  onValueChange: (value: T) => void;
  itemHeight?: number;
  visibleCount?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A smooth rotating wheel/spinner for selecting values quickly.
 * Snaps to each item, supports flicking/spinning, tapping directly on an item,
 * and gives subtle haptic feedback as items spin by.
 */
export function WheelPicker<T extends number | string>({
  items,
  selectedValue,
  onValueChange,
  itemHeight = 44,
  visibleCount = 5,
  style,
}: WheelPickerProps<T>) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const actualItemHeight = Math.round(itemHeight * scale);

  const scrollRef = useRef<ScrollViewInstance>(null);
  const isScrollingRef = useRef(false);
  const lastHapticIndexRef = useRef<number>(-1);

  const halfCount = Math.floor(visibleCount / 2);
  const containerHeight = actualItemHeight * visibleCount;
  const paddingVertical = actualItemHeight * halfCount;

  const selectedIndex = Math.max(
    0,
    items.findIndex((item) => item.value === selectedValue),
  );

  const [activeIndex, setActiveIndex] = useState(selectedIndex >= 0 ? selectedIndex : 0);

  // Sync scroll position with selected value or items change
  const scrollToCurrentIndex = useCallback(
    (index: number, animated = false) => {
      if (index >= 0 && index < items.length) {
        scrollRef.current?.scrollTo({
          y: index * actualItemHeight,
          animated,
        });
      }
    },
    [actualItemHeight, items.length],
  );

  useEffect(() => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    lastHapticIndexRef.current = selectedIndex >= 0 ? selectedIndex : 0;
    // Slight timeout ensures layout/dimensions are ready when opening
    const timer = setTimeout(() => {
      scrollToCurrentIndex(selectedIndex >= 0 ? selectedIndex : 0, false);
    }, 10);
    return () => clearTimeout(timer);
  }, [selectedIndex, scrollToCurrentIndex]);

  function triggerHaptic(index: number) {
    if (lastHapticIndexRef.current !== index) {
      lastHapticIndexRef.current = index;
      if (Platform.OS !== 'web') {
        Haptics.selectionAsync().catch(() => {});
      }
    }
  }

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const offsetY = e.nativeEvent.contentOffset.y;
    const rawIndex = Math.round(offsetY / actualItemHeight);
    const clampedIndex = Math.max(0, Math.min(rawIndex, items.length - 1));

    if (clampedIndex !== activeIndex) {
      setActiveIndex(clampedIndex);
      triggerHaptic(clampedIndex);
    }
  }

  function handleScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    isScrollingRef.current = false;
    const offsetY = e.nativeEvent.contentOffset.y;
    const rawIndex = Math.round(offsetY / actualItemHeight);
    const clampedIndex = Math.max(0, Math.min(rawIndex, items.length - 1));

    setActiveIndex(clampedIndex);
    triggerHaptic(clampedIndex);

    const selected = items[clampedIndex];
    if (selected && selected.value !== selectedValue) {
      onValueChange(selected.value);
    }
  }

  function handleItemPress(index: number) {
    setActiveIndex(index);
    triggerHaptic(index);
    scrollToCurrentIndex(index, true);
    const selected = items[index];
    if (selected) {
      onValueChange(selected.value);
    }
  }

  const styles = StyleSheet.create({
    container: {
      height: containerHeight,
      position: 'relative',
      overflow: 'hidden',
    },
    highlightZone: {
      position: 'absolute',
      top: paddingVertical,
      left: 12,
      right: 12,
      height: actualItemHeight,
      backgroundColor: colors.teal + '14',
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.teal + '35',
    },
    scrollContent: {
      paddingVertical,
    },
    item: {
      height: actualItemHeight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    itemText: {
      fontSize: sc(17),
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    itemTextSelected: {
      fontWeight: '700',
      fontSize: sc(20),
      color: colors.teal,
    },
  });

  return (
    <View style={[styles.container, style]}>
      {/* Center highlight bar behind the scrolling text */}
      <View style={styles.highlightZone} pointerEvents="none" />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        snapToInterval={actualItemHeight}
        snapToAlignment="center"
        decelerationRate={Platform.OS === 'ios' ? 'normal' : 'fast'}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        nestedScrollEnabled
      >
        {items.map((item, index) => {
          const distance = Math.abs(index - activeIndex);
          const isSelected = distance === 0;
          const opacity = isSelected ? 1 : distance === 1 ? 0.5 : 0.22;
          const scaleMultiplier = isSelected ? 1.06 : distance === 1 ? 0.95 : 0.85;

          return (
            <Pressable
              key={`${item.value}-${index}`}
              style={styles.item}
              onPress={() => handleItemPress(index)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={item.label}
            >
              <Text
                style={[
                  styles.itemText,
                  isSelected && styles.itemTextSelected,
                  {
                    opacity,
                    transform: [{ scale: scaleMultiplier }],
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
