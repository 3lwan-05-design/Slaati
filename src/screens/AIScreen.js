import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenBackground from '../components/ScreenBackground';
import { useTheme } from '../ThemeContext';
import { useI18n } from '../i18n';
import { AIPanel, createStyles } from './LearnScreen';

export default function AIScreen() {
  const { colors } = useTheme();
  const { t, language } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <ScreenBackground>
      <View style={{ flex: 1, paddingTop: Math.max(insets.top, 12) }}>
        <AIPanel t={t} language={language} styles={styles} colors={colors} />
      </View>
    </ScreenBackground>
  );
}