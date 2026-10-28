import { useRef, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet, useWindowDimensions, type ViewInstance } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useScale } from '@/src/theme/typography';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

interface DropdownSelectProps<T extends string> {
  icon: keyof typeof Ionicons.glyphMap;
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Tints the button, e.g. while a filter other than "all" is applied. */
  active?: boolean;
}

const MENU_MIN_WIDTH = 220;
const EDGE = 16;

/**
 * A compact button showing the current option; tapping it unfolds the options right below it
 * (measured in window coordinates, so it works wherever the button sits on screen).
 */
export function DropdownSelect<T extends string>({ icon, options, value, onChange, active }: DropdownSelectProps<T>) {
  const colors = useThemeColors();
  const scale = useScale();
  const sc = (n: number) => Math.round(n * scale);
  const window = useWindowDimensions();
  const anchor = useRef<ViewInstance>(null);
  const [menu, setMenu] = useState<{ top: number; left: number; width: number } | null>(null);

  const current = options.find((option) => option.value === value);

  function open() {
    anchor.current?.measureInWindow((x, y, width, height) => {
      const menuWidth = Math.min(Math.max(width, MENU_MIN_WIDTH), window.width - EDGE * 2);
      const left = Math.min(x, window.width - EDGE - menuWidth);
      setMenu({ top: y + height + 4, left: Math.max(EDGE, left), width: menuWidth });
    });
  }

  const styles = StyleSheet.create({
    // No flex here: the wrapping View takes the row's width; flex: 1 inside it would shrink
    // the button's height to zero (flex-basis 0 along the column).
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1.5,
      borderColor: active ? colors.teal : colors.border,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: colors.surface,
    },
    buttonText: { flex: 1, fontSize: sc(13), fontWeight: '600', color: active ? colors.teal : colors.text },
    backdrop: { flex: 1 },
    menu: {
      position: 'absolute',
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    scrollArea: { maxHeight: 360 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    optionSelected: { backgroundColor: colors.background },
    optionText: { flex: 1, fontSize: sc(14), color: colors.text },
    optionTextSelected: { fontWeight: '700', color: colors.teal },
  });

  return (
    <>
      <View ref={anchor} collapsable={false} style={{ flex: 1 }}>
        <Pressable style={styles.button} onPress={open}>
          <Ionicons name={icon} size={sc(15)} color={active ? colors.teal : colors.textSecondary} />
          <Text style={styles.buttonText} numberOfLines={1} ellipsizeMode="tail">
            {current?.label}
          </Text>
          <Ionicons name={menu ? 'chevron-up' : 'chevron-down'} size={sc(14)} color={colors.textSecondary} />
        </Pressable>
      </View>

      <Modal visible={!!menu} transparent statusBarTranslucent animationType="fade" onRequestClose={() => setMenu(null)}>
        <Pressable style={styles.backdrop} onPress={() => setMenu(null)}>
          {menu && (
            <View style={[styles.menu, { top: menu.top, left: menu.left, width: menu.width }]}>
              <ScrollView style={styles.scrollArea} bounces={false}>
                {options.map((option) => {
                  const selected = option.value === value;
                  return (
                    <Pressable
                      key={option.value}
                      style={[styles.option, selected && styles.optionSelected]}
                      onPress={() => {
                        setMenu(null);
                        if (!selected) onChange(option.value);
                      }}
                    >
                      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
                      {selected && <Ionicons name="checkmark" size={sc(18)} color={colors.teal} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}
