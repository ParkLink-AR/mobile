import { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const DANGER = '#C62828';
const DANGER_BG = '#FDECEA';
const DANGER_BORDER = '#F5C2C0';
const SUCCESS = '#16A34A';
const SUCCESS_BG = '#F0FDF4';

/**
 * Shared look of the account forms (login, password recovery, email/code verification,
 * changing email/phone/password): content starts at the top instead of floating in the
 * middle, every input has its label above it, and errors sit in a tinted box.
 */
export function useAccountFormStyles() {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const input = {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: sc(13),
    fontSize: sc(15),
    color: colors.text,
    backgroundColor: colors.background,
    // Explicit: iOS recycles native text inputs, and one that ever had letter spacing
    // would otherwise keep it (the placeholder came out as "1 1   2 3 4 5").
    letterSpacing: 0,
  };
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: 24, paddingTop: sc(28), paddingBottom: 24, gap: sc(16) },
    field: { gap: 6 },
    label: { fontSize: sc(13), fontWeight: '600', color: colors.textSecondary },
    input,
    helper: { fontSize: sc(13), color: colors.textSecondary, lineHeight: sc(19) },
    info: { fontSize: sc(13), color: colors.teal, fontWeight: '600', textAlign: 'center' },
    link: { fontSize: sc(14), color: colors.teal, fontWeight: '600', textAlign: 'center' },
    linkDisabled: { color: colors.textSecondary },
  });
}

/** Icon + short explanation at the top of a step (the screen's own title is already in
 * the header bar above, so this one doesn't repeat it unless it says something new). */
export function FormIntro({ icon, title, text }: { icon: IconName; title?: string; text: string }) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    iconWrap: {
      width: sc(46), height: sc(46), borderRadius: sc(23),
      backgroundColor: `${colors.teal}1F`, alignItems: 'center', justifyContent: 'center',
    },
    textBlock: { flex: 1, gap: 2 },
    title: { fontSize: sc(17), fontWeight: '700', color: colors.text },
    text: { fontSize: sc(14), color: colors.textSecondary, lineHeight: sc(20) },
  });
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={sc(22)} color={colors.teal} />
      </View>
      <View style={styles.textBlock}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

/** The value being changed (current email, current phone...), shown before the new one. */
export function CurrentValue({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const styles = StyleSheet.create({
    card: {
      flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12,
      backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    },
    textBlock: { flex: 1, gap: 2 },
    label: { fontSize: sc(12), fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
    value: { fontSize: sc(15), fontWeight: '600', color: colors.text },
  });
  return (
    <View style={styles.card}>
      <Ionicons name={icon} size={sc(20)} color={colors.textSecondary} />
      <View style={styles.textBlock}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

export function FormError({ message }: { message: string | null }) {
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  if (!message) return null;
  const styles = StyleSheet.create({
    box: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10,
      backgroundColor: DANGER_BG, borderWidth: 1, borderColor: DANGER_BORDER,
    },
    text: { flex: 1, fontSize: sc(13), color: DANGER, lineHeight: sc(18) },
  });
  return (
    <View style={styles.box}>
      <Ionicons name="alert-circle-outline" size={sc(17)} color={DANGER} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

/**
 * A verification code, one box per digit. The digits are drawn as plain text over a
 * single invisible input -- so no text input ever needs letter spacing (which iOS keeps
 * on recycled inputs), and the SMS code still autofills on iOS (oneTimeCode).
 */
export function CodeInput({
  value,
  onChange,
  length = 6,
  autoFocus = false,
  confirmed = false,
}: {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  autoFocus?: boolean;
  // The code was accepted: every box turns green for a moment before the flow moves on.
  confirmed?: boolean;
}) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(autoFocus);
  const activeIndex = Math.min(value.length, length - 1);

  const styles = StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'center', gap: sc(8) },
    box: {
      flex: 1, maxWidth: sc(52), aspectRatio: 0.82, borderRadius: 12, borderWidth: 1.5,
      borderColor: colors.border, backgroundColor: colors.background,
      alignItems: 'center', justifyContent: 'center',
    },
    boxFilled: { borderColor: `${colors.teal}80`, backgroundColor: colors.surface },
    boxActive: { borderColor: colors.teal, borderWidth: 2 },
    boxConfirmed: { borderColor: SUCCESS, backgroundColor: SUCCESS_BG, borderWidth: 2 },
    digit: { fontSize: sc(24), fontWeight: '700', color: colors.text },
    digitConfirmed: { color: SUCCESS },
    hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  });

  return (
    <Pressable style={styles.row} onPress={() => inputRef.current?.focus()} accessibilityRole="none">
      {Array.from({ length }, (_, index) => {
        const digit = value[index] ?? '';
        return (
          <View
            key={index}
            style={[
              styles.box,
              digit !== '' && styles.boxFilled,
              focused && index === activeIndex && styles.boxActive,
              confirmed && styles.boxConfirmed,
            ]}
          >
            <Text style={[styles.digit, confirmed && styles.digitConfirmed]}>{digit}</Text>
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^0-9]/g, '').slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        editable={!confirmed}
        caretHidden
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </Pressable>
  );
}


/** Shown in place of the confirm button once a code was accepted, right before the flow
 * moves on to the next step. */
export function ConfirmedRow({ text }: { text: string }) {
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: sc(14), borderRadius: 12, backgroundColor: SUCCESS_BG,
      borderWidth: 1, borderColor: '#BBF7D0',
    },
    text: { fontSize: sc(15), fontWeight: '700', color: SUCCESS },
  });
  return (
    <View style={styles.row}>
      <Ionicons name="checkmark-circle" size={sc(20)} color={SUCCESS} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}
