import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSettings } from '../SettingsContext';
import { useTheme } from '../ThemeContext';
import { LANGUAGES, useI18n } from '../i18n';
import { RADIUS, SHADOWS } from '../theme';
import { tapHaptic, mediumHaptic } from '../utils/haptics';

const STEPS = 3;

export default function OnboardingScreen() {
  const { settings, updateSettings } = useSettings();
  const { colors, gradients } = useTheme();
  const { t, language, setLanguage } = useI18n();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const styles = useMemo(() => createStyles(colors, insets), [colors, insets]);

  const finish = () => {
    mediumHaptic();
    updateSettings({ onboardingDone: true });
  };

  const next = () => {
    tapHaptic();
    if (step >= STEPS - 1) {
      finish();
      return;
    }
    setStep(step + 1);
  };

  const skip = () => {
    tapHaptic();
    finish();
  };

  const pickLanguage = (id) => {
    tapHaptic();
    setLanguage(id);
  };

  const pickTheme = (id) => {
    tapHaptic();
    updateSettings({ theme: id });
  };

  return (
    <LinearGradient
      colors={gradients.screen}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}
    >
      <View style={styles.topBar}>
        <View style={styles.brand}>
          <MaterialCommunityIcons name="mosque" size={18} color={colors.gold} />
          <Text style={styles.brandText}>SLATI PRO</Text>
        </View>
        <Pressable onPress={skip} hitSlop={10}>
          <Text style={styles.skip}>{t('onboarding.skip')}</Text>
        </Pressable>
      </View>

      <View style={styles.body}>
        {step === 0 ? (
          <View style={styles.slide}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="moon-waning-crescent" size={44} color={colors.gold} />
            </View>
            <Text style={styles.title}>{t('onboarding.welcomeTitle')}</Text>
            <Text style={styles.text}>{t('onboarding.welcomeBody')}</Text>

            <View style={styles.featureList}>
              {[
                { icon: 'clock-outline', key: 'onboarding.featureTimes' },
                { icon: 'book-open-page-variant-outline', key: 'onboarding.featureQuran' },
                { icon: 'counter', key: 'onboarding.featureTasbih' },
              ].map((item) => (
                <View key={item.key} style={styles.featureRow}>
                  <View style={styles.featureIcon}>
                    <MaterialCommunityIcons name={item.icon} size={17} color={colors.primary} />
                  </View>
                  <Text style={styles.featureText}>{t(item.key)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.slide}>
            <Text style={styles.stepLabel}>{t('onboarding.languageTitle')}</Text>
            <Text style={styles.text}>{t('onboarding.languageBody')}</Text>

            <View style={styles.optionList}>
              {LANGUAGES.map((item) => {
                const active = language === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => pickLanguage(item.id)}
                    style={({ pressed }) => [
                      styles.option,
                      active && styles.optionActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.optionBadge, active && styles.optionBadgeActive]}>
                      <Text
                        style={[styles.optionBadgeText, active && styles.optionBadgeTextActive]}
                      >
                        {item.short}
                      </Text>
                    </View>
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {item.label}
                    </Text>
                    {active ? (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={20}
                        color={colors.primary}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.slide}>
            <Text style={styles.stepLabel}>{t('onboarding.themeTitle')}</Text>
            <Text style={styles.text}>{t('onboarding.themeBody')}</Text>

            <View style={styles.optionList}>
              {[
                { id: 'emerald', label: t('settings.themeEmerald'), swatch: '#2ec4b6' },
                { id: 'gold', label: t('settings.themeGold'), swatch: '#d8b56b' },
              ].map((item) => {
                const active = settings.theme === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => pickTheme(item.id)}
                    style={({ pressed }) => [
                      styles.option,
                      active && styles.optionActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.swatch, { backgroundColor: item.swatch }]} />
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {item.label}
                    </Text>
                    {active ? (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={20}
                        color={colors.primary}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.note}>
              <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.gold} />
              <Text style={styles.noteText}>{t('onboarding.locationNote')}</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {Array.from({ length: STEPS }).map((_, index) => (
            <View
              key={index}
              style={[styles.dot, index === step && styles.dotActive]}
            />
          ))}
        </View>

        <Pressable
          onPress={next}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>
            {step >= STEPS - 1 ? t('onboarding.start') : t('onboarding.next')}
          </Text>
          <MaterialCommunityIcons
            name={step >= STEPS - 1 ? 'check' : 'arrow-right'}
            size={18}
            color={colors.background}
          />
        </Pressable>

        <Text style={styles.stepCount}>
          {t('onboarding.step', { current: step + 1, total: STEPS })}
        </Text>
      </View>
    </LinearGradient>
  );
}

const createStyles = (colors, insets) =>
  StyleSheet.create({
    root: {
      flex: 1,
      paddingTop: Math.max(insets.top, 20) + 8,
      paddingBottom: Math.max(insets.bottom, 20) + 8,
      paddingHorizontal: 22,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    brand: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    brandText: {
      color: colors.gold,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 2.4,
      marginLeft: 8,
    },
    skip: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    body: {
      flex: 1,
      justifyContent: 'center',
    },
    slide: {
      width: '100%',
    },
    heroIcon: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.goldSoft,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
      ...SHADOWS.card,
    },
    title: {
      color: colors.text,
      fontSize: 30,
      fontWeight: '700',
      letterSpacing: -0.6,
      marginBottom: 12,
    },
    stepLabel: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: -0.4,
      marginBottom: 8,
    },
    text: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 22,
      marginBottom: 26,
    },
    featureList: {
      gap: 12,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSoft,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    featureIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    featureText: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
    },
    optionList: {
      gap: 10,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSoft,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    optionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    optionBadge: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    optionBadgeActive: {
      backgroundColor: colors.primary,
    },
    optionBadgeText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.6,
    },
    optionBadgeTextActive: {
      color: colors.background,
    },
    optionText: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    optionTextActive: {
      color: colors.primary,
    },
    swatch: {
      width: 26,
      height: 26,
      borderRadius: 13,
      marginRight: 14,
      marginLeft: 6,
    },
    note: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 22,
      paddingHorizontal: 4,
    },
    noteText: {
      flex: 1,
      color: colors.textFaint,
      fontSize: 12,
      lineHeight: 18,
      marginLeft: 8,
    },
    footer: {
      alignItems: 'center',
    },
    dots: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 18,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.surfaceAlt,
    },
    dotActive: {
      width: 20,
      backgroundColor: colors.primary,
    },
    primaryButton: {
      width: '100%',
      height: 54,
      borderRadius: RADIUS.pill,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      ...SHADOWS.card,
    },
    primaryButtonText: {
      color: colors.background,
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    stepCount: {
      color: colors.textFaint,
      fontSize: 11,
      marginTop: 12,
    },
    pressed: {
      opacity: 0.75,
    },
  });
