import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { ViewStyle } from 'react-native';

interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: Edge[];
}

export function Screen({ children, style, edges = ['top', 'left', 'right'] }: ScreenProps) {
  return (
    <SafeAreaView style={[{ flex: 1 }, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}
