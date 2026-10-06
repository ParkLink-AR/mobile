import { KeyboardAvoidingView, Platform } from 'react-native';

/** Wraps a modal's content so a centered sheet with a text input moves up with the keyboard
 * instead of being covered by it (Android already resizes the window on its own). */
export function ModalKeyboardAvoider({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      {children}
    </KeyboardAvoidingView>
  );
}
