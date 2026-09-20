import { ReactNode, useState } from 'react';
import { View, Text, Switch, StyleSheet, Pressable, Modal, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/src/components/Screen';
import { Card } from '@/src/components/Card';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { useTypography } from '@/src/theme/typography';
import { useSettingsStore, Language, FontSize } from '@/src/store/useSettingsStore';
import { useAccountTypeStore } from '@/src/store/useAccountTypeStore';
import { t } from '@/src/i18n';

export function SettingsContent() {
  const colors = useThemeColors();
  // Shared by driver/(driver)/settings.tsx and owner's re-export of it.
  const accent = useAccountTypeStore((s) => s.activeMode) === 'owner' ? colors.ownerAccent : colors.teal;
  const typography = useTypography();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 16 },
    sectionTitle: { marginTop: 12, marginBottom: 6 },
    card: { padding: 0 },
    divider: { height: 1, backgroundColor: colors.border },
  });

  return (
    <Screen style={styles.container} edges={['left', 'right', 'bottom']}>
      <Text style={[typography.caption, styles.sectionTitle]}>{t('settings.notifications.title')}</Text>
      <Card style={styles.card}>
        <Row label={t('settings.notifications.push')}>
          <Switch value={pushEnabled} onValueChange={setPushEnabled} trackColor={{ true: accent }} />
        </Row>
        <View style={styles.divider} />
        <Row label={t('settings.notifications.email')}>
          <Switch value={emailEnabled} onValueChange={setEmailEnabled} trackColor={{ true: accent }} />
        </Row>
      </Card>

      <Text style={[typography.caption, styles.sectionTitle]}>{t('settings.preferences.title')}</Text>
      <Card style={styles.card}>
        <LanguagePicker accent={accent} />
        <View style={styles.divider} />
        <ThemePicker accent={accent} />
        <View style={styles.divider} />
        <FontSizePicker accent={accent} />
      </Card>

      <Text style={[typography.caption, styles.sectionTitle]}>{t('settings.about.title')}</Text>
      <Card style={styles.card}>
        <Row label={t('settings.version')}>
          <Text style={typography.caption}>1.0.0</Text>
        </Row>
      </Card>
    </Screen>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  const typography = useTypography();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 }}>
      <Text style={typography.body}>{label}</Text>
      {children}
    </View>
  );
}

// ─── shared modal styles ────────────────────────────────────────────────────

function useModalStyles(accent: string) {
  const colors = useThemeColors();
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
    sheet: { width: '85%', borderRadius: 20, paddingVertical: 32, paddingHorizontal: 24, backgroundColor: colors.surface, alignItems: 'center', gap: 8 },
    title: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 16, textAlign: 'center' },
    option: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12 },
    optionActive: { backgroundColor: accent + '22' },
    optionLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
    optionLabelActive: { color: accent },
    optionLabelInactive: { color: colors.text },
  });
}

// ─── row value chip (label + chevron) ───────────────────────────────────────

function ValueChip({ label, onPress, accent }: { label: string; onPress: () => void; accent: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', color: accent }}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color={accent} />
    </Pressable>
  );
}

// ─── Language ───────────────────────────────────────────────────────────────

function LanguagePicker({ accent }: { accent: string }) {
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const [visible, setVisible] = useState(false);
  const modal = useModalStyles(accent);

  const opts: { key: Language; label: string }[] = [
    { key: 'es', label: 'Español' },
    { key: 'en', label: 'English' },
    { key: 'ja', label: '日本語' },
  ];
  const currentLabel = opts.find((o) => o.key === language)?.label ?? '';

  return (
    <>
      <Row label={t('settings.language')}>
        <ValueChip label={currentLabel} onPress={() => setVisible(true)} accent={accent} />
      </Row>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={modal.overlay}>
            <TouchableWithoutFeedback>
              <View style={modal.sheet}>
                <Text style={modal.title}>{t('language.select')}</Text>
                {opts.map((o) => {
                  const active = language === o.key;
                  return (
                    <Pressable
                      key={o.key}
                      style={({ pressed }) => [modal.option, active && modal.optionActive, { opacity: pressed ? 0.7 : 1 }]}
                      onPress={() => { setLanguage(o.key); setVisible(false); }}
                    >
                      <Text style={[modal.optionLabel, active ? modal.optionLabelActive : modal.optionLabelInactive]}>{o.label}</Text>
                      {active && <Ionicons name="checkmark-circle" size={20} color={accent} />}
                    </Pressable>
                  );
                })}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

// ─── Theme ──────────────────────────────────────────────────────────────────

function ThemePicker({ accent }: { accent: string }) {
  const mode = useSettingsStore((s) => s.mode);
  const toggleMode = useSettingsStore((s) => s.toggleMode);
  const [visible, setVisible] = useState(false);
  const modal = useModalStyles(accent);

  const opts = [
    { key: 'light' as const, label: t('profile.theme.light') },
    { key: 'dark'  as const, label: t('profile.theme.dark') },
  ];
  const currentLabel = opts.find((o) => o.key === mode)?.label ?? '';

  return (
    <>
      <Row label={t('settings.theme')}>
        <ValueChip label={currentLabel} onPress={() => setVisible(true)} accent={accent} />
      </Row>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={modal.overlay}>
            <TouchableWithoutFeedback>
              <View style={modal.sheet}>
                <Text style={modal.title}>{t('settings.theme')}</Text>
                {opts.map((o) => {
                  const active = mode === o.key;
                  return (
                    <Pressable
                      key={o.key}
                      style={({ pressed }) => [modal.option, active && modal.optionActive, { opacity: pressed ? 0.7 : 1 }]}
                      onPress={() => { if (!active) toggleMode(); setVisible(false); }}
                    >
                      <Text style={[modal.optionLabel, active ? modal.optionLabelActive : modal.optionLabelInactive]}>{o.label}</Text>
                      {active && <Ionicons name="checkmark-circle" size={20} color={accent} />}
                    </Pressable>
                  );
                })}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

// ─── Font size ───────────────────────────────────────────────────────────────

function FontSizePicker({ accent }: { accent: string }) {
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const [visible, setVisible] = useState(false);
  const modal = useModalStyles(accent);

  const opts: { key: FontSize; label: string }[] = [
    { key: 'small',  label: t('settings.fontSize.small') },
    { key: 'medium', label: t('settings.fontSize.medium') },
    { key: 'large',  label: t('settings.fontSize.large') },
  ];
  const currentLabel = opts.find((o) => o.key === fontSize)?.label ?? '';

  return (
    <>
      <Row label={t('settings.fontSize')}>
        <ValueChip label={currentLabel} onPress={() => setVisible(true)} accent={accent} />
      </Row>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={modal.overlay}>
            <TouchableWithoutFeedback>
              <View style={modal.sheet}>
                <Text style={modal.title}>{t('settings.fontSize')}</Text>
                {opts.map((o) => {
                  const active = fontSize === o.key;
                  return (
                    <Pressable
                      key={o.key}
                      style={({ pressed }) => [modal.option, active && modal.optionActive, { opacity: pressed ? 0.7 : 1 }]}
                      onPress={() => { setFontSize(o.key); setVisible(false); }}
                    >
                      <Text style={[modal.optionLabel, active ? modal.optionLabelActive : modal.optionLabelInactive]}>{o.label}</Text>
                      {active && <Ionicons name="checkmark-circle" size={20} color={accent} />}
                    </Pressable>
                  );
                })}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
