import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { ViewStyle } from 'react-native';

interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: Edge[];
}

// Tab screens never need a 'bottom' edge here: the tab bar (DockTabBar/
// OwnerDockTabBar) is a real docked react-navigation tab bar, not a floating
// overlay, so the navigator already reserves space above it and handles its
// own bottom safe-area inset internally.
export function Screen({ children, style, edges }: ScreenProps) {
  const resolvedEdges: Edge[] = edges ?? ['top', 'left', 'right'];
  return (
    <SafeAreaView style={[{ flex: 1 }, style]} edges={resolvedEdges}>
      {children}
    </SafeAreaView>
  );
}
