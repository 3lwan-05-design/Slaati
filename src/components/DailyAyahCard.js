import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';
import { useI18n } from '../i18n';
import { RADIUS } from '../theme';
import { getAyahOfTheDay } from '../data/ayat';

// Daily verse card. The verse is picked deterministically from the local
// date, so it is the same all day and changes at midnight.
export default function DailyAyahCard({ date }) {
  const { colors, gradients } = useTheme();
  const { t, language } = useI18n();
  const dayKey = date ? date.toDateString() : new Date().toDateString();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ayah = useMemo(() => getAyahOfTheDay(date || new Date()), [dayKey]);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const translation =
    language === 'ar' ? ayah.ar : language === 'fr' ? ayah.fr : ayah.en;

  return (
    <LinearGradient
      colors={gradients.card}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="book-open-variant" size={14} color={colors.gold} />
        </View>
        <Text style={styles.eyebrow}>{t('ayah.title')}</Text>
        <Text style={styles.ref}>{ayah.ref}</Text>
      </View>

      <Text style={styles.arabic}>{ayah.ar}</Text>

      {language === 'ar' ? null : <Text style={styles.translation}>{translation}</Text>}

      <Text style={styles.surah}>{ayah.surah}</Text>
    </LinearGradient>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    card: {
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    iconWrap: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.goldSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    eyebrow: {
      flex: 1,
      color: colors.gold,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
    },
    ref: {
      color: colors.textFaint,
      fontSize: 11,
      fontWeight: '600',
    },
    arabic: {
      fontFamily: 'AmiriQuran',
      color: colors.text,
      fontSize: 21,
      lineHeight: 52,
      textAlign: 'right',
      writingDirection: 'rtl',
      includeFontPadding: true,
    },
    translation: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 20,
      marginTop: 10,
    },
    surah: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
      marginTop: 10,
      textTransform: 'uppercase',
    },
  });
