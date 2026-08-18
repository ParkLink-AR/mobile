import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { ViewStyle } from 'react-native';

interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: Edge[];
  /** Screens under the floating dock tab bar: also respects the bottom safe area. */
  tabBarPadding?: boolean;
}

export function Screen({ children, style, edges, tabBarPadding }: ScreenProps) {
  const resolvedEdges: Edge[] =
    edges ?? (tabBarPadding ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']);
  return (
    <SafeAreaView style={[{ flex: 1 }, style]} edges={resolvedEdges}>
      {children}
    </SafeAreaView>
  );
}
