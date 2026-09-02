import { t } from '@/src/i18n';
import { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { PaymentMethod } from '@/src/types';

interface PaymentMethodPickerProps {
  methods: PaymentMethod[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function methodIcon(method: PaymentMethod) {
  return method.type === 'cash' ? '💵' : '💳';
}

export function PaymentMethodPicker({ methods, selectedId, onSelect }: PaymentMethodPickerProps) {
  const colors = useThemeColors();
  const [visible, setVisible] = useState(false);
  const selected = methods.find((m) => m.id === selectedId) ?? methods[0] ?? null;

  const styles = StyleSheet.create({
    selector: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.surface,
    },
    selectorIcon: { fontSize: 16 },
    selectorLabel: { flex: 1, fontSize: 14, color: colors.text },
    chevron: { color: colors.textSecondary, fontSize: 12 },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(4, 35, 71, 0.3)',
      justifyContent: 'center',
      padding: 32,
    },
    dropdown: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      overflow: 'hidden',
    },
    scrollArea: { maxHeight: 180 },
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
    optionIcon: { fontSize: 16 },
    optionLabel: { flex: 1, fontSize: 14, color: colors.text },
  });

  return (
    <>
      <Pressable style={styles.selector} onPress={() => setVisible(true)}>
        <Text style={styles.selectorIcon}>{selected ? methodIcon(selected) : '💳'}</Text>
        <Text style={styles.selectorLabel} numberOfLines={1}>
          {selected?.label ?? t('payment.selectPlaceholder')}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <View style={styles.dropdown}>
            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator>
              {methods.map((method) => (
                <Pressable
                  key={method.id}
                  style={[styles.option, method.id === selectedId && styles.optionSelected]}
                  onPress={() => {
                    onSelect(method.id);
                    setVisible(false);
                  }}
                >
                  <Text style={styles.optionIcon}>{methodIcon(method)}</Text>
                  <Text style={styles.optionLabel} numberOfLines={1}>
                    {method.label}
                  </Text>
                  {method.id === selectedId && (
                    <Ionicons name="checkmark" size={18} color={colors.teal} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
