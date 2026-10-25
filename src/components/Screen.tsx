import { useEffect, useRef, RefObject } from 'react';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { Keyboard, Platform, ScrollView, ScrollViewProps, StyleSheet, TextInput, View, ViewStyle, type ScrollViewInstance, type ViewInstance } from 'react-native';

/**
 * Keyboard behaviour for any scrollable screen with text inputs:
 * - tapping anywhere that isn't a control dismisses the keyboard (`handled` still lets
 *   buttons and inputs receive the tap);
 * - dragging the content down dismisses it too;
 * - on iOS the content is inset by the keyboard's height and scrolled so the focused input
 *   stays visible (Android already resizes the window for the keyboard).
 */
export const FORM_SCROLL_PROPS: ScrollViewProps = {
  keyboardShouldPersistTaps: 'handled',
  keyboardDismissMode: Platform.OS === 'ios' ? 'interactive' : 'on-drag',
  automaticallyAdjustKeyboardInsets: true,
  showsVerticalScrollIndicator: false,
};

// How far below the top of the visible area the focused input lands once the keyboard is
// up -- enough to keep whatever introduces it (a label, a heading) in view above it.
const FOCUSED_INPUT_TOP_MARGIN = 210;

/**
 * When the keyboard opens, scrolls `scrollRef` so the focused input sits near the top of
 * what's visible, leaving the fields and buttons after it in view above the keyboard --
 * instead of only nudging the screen when the input itself would be covered (the platform
 * default, which leaves e.g. the login button hidden under the keyboard). The scroll is
 * clamped by the content's own length, so a short form just slides up as far as it can.
 * `contentRef` is the view the inputs are positioned in (the scroll view's content).
 */
export function useScrollToFocusedInput(scrollRef: RefObject<ScrollViewInstance | null>, contentRef: RefObject<ViewInstance | null>) {
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      const input = TextInput.State.currentlyFocusedInput();
      const content = contentRef.current;
      if (!input || !content) return;
      input.measureLayout(
        content,
        (_x, y) => {
          scrollRef.current?.scrollTo({ y: Math.max(0, y - FOCUSED_INPUT_TOP_MARGIN), animated: true });
        },
        () => {},
      );
    });
    return () => subscription.remove();
  }, [scrollRef, contentRef]);
}

interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: Edge[];
  /** A form screen: its content scrolls, scrolls itself to the focused input when the
   * keyboard opens, and tapping outside an input dismisses the keyboard (see
   * FORM_SCROLL_PROPS and useScrollToFocusedInput). The screen's own padding/gap/alignment
   * apply to the scrolled content. */
  form?: boolean;
}

// Tab screens never need a 'bottom' edge here: the tab bar (DockTabBar/
// OwnerDockTabBar) is a real docked react-navigation tab bar, not a floating
// overlay, so the navigator already reserves space above it and handles its
// own bottom safe-area inset internally.
export function Screen({ children, style, edges, form }: ScreenProps) {
  const resolvedEdges: Edge[] = edges ?? ['top', 'left', 'right'];
  if (!form) {
    return (
      <SafeAreaView style={[{ flex: 1 }, style]} edges={resolvedEdges}>
        {children}
      </SafeAreaView>
    );
  }
  return (
    <FormScreen style={style} edges={resolvedEdges}>
      {children}
    </FormScreen>
  );
}

function FormScreen({ children, style, edges }: { children: React.ReactNode; style?: ViewStyle; edges: Edge[] }) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const contentRef = useRef<ViewInstance>(null);
  useScrollToFocusedInput(scrollRef, contentRef);

  // The background stays on the screen; everything that lays out the content (padding,
  // gap, alignment...) moves onto the scrolled content.
  const { backgroundColor, flex: _flex, ...contentStyle } = StyleSheet.flatten(style) ?? {};
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={edges}>
      <ScrollView ref={scrollRef} {...FORM_SCROLL_PROPS} contentContainerStyle={{ flexGrow: 1 }}>
        <View ref={contentRef} collapsable={false} style={[{ flexGrow: 1 }, contentStyle]}>
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
