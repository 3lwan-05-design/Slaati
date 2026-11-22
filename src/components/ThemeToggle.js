import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSettings } from '../SettingsContext';
import { useTheme } from '../ThemeContext';
import { useI18n } from '../i18n';

export default function ThemeToggle({ style }) {
  const { settings, updateSettings } = useSettings();
  const { colors } = useTheme();
  const { t } = useI18n();
  const isGold = settings.theme === 'gold';

  return (
    <Pressable
      onPress={() => updateSettings({ theme: isGold ? 'emerald' : 'gold' })}
      accessibilityRole="button"
      accessibilityLabel={`${t('settings.theme')}: ${isGold ? t('settings.themeEmerald') : t('settings.themeGold')}`}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.surfaceSoft,
          borderColor: colors.border,
        },
        pressed && styles.pressed,
        style,
      ]}
    >
      <MaterialCommunityIcons
        name={isGold ? 'weather-sunny' : 'weather-night'}
        size={19}
        color={colors.gold}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
