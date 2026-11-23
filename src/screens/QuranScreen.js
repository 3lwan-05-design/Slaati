import React, { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ScreenBackground from '../components/ScreenBackground';
import ThemeToggle from '../components/ThemeToggle';
import QuranAudioPlayer from '../components/QuranAudioPlayer';
import quran from '../data/quran.json';
import quranEn from '../data/quran-en.json';
import quranFr from '../data/quran-fr.json';
import { useTheme } from '../ThemeContext';
import { useI18n } from '../i18n';
import { RADIUS, SHADOWS } from '../theme';

function SurahRow({ surah, onPress, styles, colors, t }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.surahRow, pressed && styles.pressed]}
    >
      <View style={styles.numberBadge}>
        <Text style={styles.numberText}>{surah.number}</Text>
      </View>
      <View style={styles.surahCopy}>
        <Text style={styles.surahEnglish}>{surah.nameSimple}</Text>
        <Text style={styles.surahMeta} numberOfLines={1}>
          {surah.translation} · {t('quran.ayahs', { count: surah.versesCount })} ·{' '}
          {t(`quran.${surah.revelationPlace}`)}
        </Text>
      </View>
      <Text style={styles.surahArabic}>{surah.nameArabic}</Text>
    </Pressable>
  );
}

function SurahReader({ surah, onBack }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, isRTL, language } = useI18n();
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);
  const [fontSize, setFontSize] = useState(27);
  const [transLang, setTransLang] = useState(
    language === 'fr' ? 'fr' : language === 'en' ? 'en' : 'ar'
  );
  const [audioOpen, setAudioOpen] = useState(false);
  const [audioIndex, setAudioIndex] = useState(0);

  const globalNumbers = useMemo(() => {
    const start = quran.chapters
      .slice(0, surah.number - 1)
      .reduce((sum, chapter) => sum + chapter.versesCount, 0) + 1;
    return surah.verses.map((_, i) => start + i);
  }, [surah]);

  const openAudio = (index = 0) => {
    setAudioIndex(index);
    setAudioOpen(true);
  };

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const header = (
    <View>
      <View style={styles.readerTop}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          accessibilityLabel={t('quran.backToList')}
        >
          <MaterialCommunityIcons name="chevron-left" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.readerTitleWrap}>
          <Text style={styles.readerEyebrow}>{t('quran.surah', { number: surah.number })}</Text>
          <Text style={styles.readerTitle}>{surah.nameSimple}</Text>
        </View>
        <View style={styles.readerActions}>
          <ThemeToggle />
          <View style={styles.fontControls}>
            <Pressable
              onPress={() => setFontSize((value) => Math.max(20, value - 2))}
              style={styles.fontButton}
            >
              <Text style={styles.fontButtonText}>A-</Text>
            </Pressable>
            <Pressable
              onPress={() => setFontSize((value) => Math.min(40, value + 2))}
              style={styles.fontButton}
            >
              <Text style={styles.fontButtonText}>A+</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.readerInfo}>
        <Text style={styles.readerArabicName}>{surah.nameArabic}</Text>
        <Text style={styles.readerMeta}>
          {surah.translation} · {t('quran.ayahs', { count: surah.versesCount })} ·{' '}
          {t(`quran.${surah.revelationPlace}`)}
        </Text>
      </View>

      <View style={styles.readerTools}>
        <View style={styles.langRow}>
          <Text style={styles.langLabel}>{t('quran.translation')}:</Text>
          {[
            { key: 'ar', label: t('quran.langAr') },
            { key: 'en', label: t('quran.langEn') },
            { key: 'fr', label: t('quran.langFr') },
          ].map((item) => (
            <Pressable
              key={item.key}
              onPress={() => setTransLang(item.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: transLang === item.key }}
              style={({ pressed }) => [
                styles.langChip,
                transLang === item.key && styles.langChipActive,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.langChipText,
                  transLang === item.key && styles.langChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => openAudio(0)}
          accessibilityRole="button"
          accessibilityLabel={t('quran.audioOpen')}
          style={({ pressed }) => [styles.audioButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="headphones" size={17} color={colors.background} />
          <Text style={styles.audioButtonText}>{t('quran.audio')}</Text>
        </Pressable>
      </View>

      {audioOpen ? (
        <QuranAudioPlayer
          globalNumbers={globalNumbers}
          startIndex={audioIndex}
          onClose={() => setAudioOpen(false)}
        />
      ) : null}

      {surah.bismillahPre ? (
        <Text
          style={[
            styles.bismillah,
            {
              fontSize: fontSize + 3,
              lineHeight: Math.round((fontSize + 3) * 2.45),
            },
          ]}
        >
          {quran.bismillah}
        </Text>
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={surah.verses}
      keyExtractor={(item) => item.key}
      ListHeaderComponent={header}
      contentContainerStyle={[
        styles.readerContent,
        { paddingTop: Math.max(insets.top, 18) + 4 },
      ]}
      showsVerticalScrollIndicator={false}
      initialNumToRender={12}
      windowSize={9}
      renderItem={({ item, index }) => {
        const translation =
          transLang === 'en'
            ? quranEn[surah.number - 1]?.[index]
            : transLang === 'fr'
            ? quranFr[surah.number - 1]?.[index]
            : null;
        return (
          <View style={[styles.ayahRow, index % 2 === 1 && styles.ayahRowAlt]}>
            <View style={styles.ayahMetaRow}>
              <Pressable
                onPress={() => openAudio(index)}
                accessibilityRole="button"
                accessibilityLabel={t('quran.audioOpen')}
                style={({ pressed }) => [styles.ayahPlay, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons name="play-circle-outline" size={19} color={colors.primary} />
              </Pressable>
              <View style={styles.ayahNumber}>
                <Text style={styles.ayahNumberText}>{index + 1}</Text>
              </View>
            </View>
            <Text
              selectable
              style={[styles.ayahText, { fontSize, lineHeight: Math.round(fontSize * 2.45) }]}
            >
              {item.text}
            </Text>
            {translation ? (
              <Text style={styles.ayahTranslation}>{translation}</Text>
            ) : null}
          </View>
        );
      }}
      ListFooterComponent={
        <View style={styles.readerFooter}>
          <MaterialCommunityIcons name="shield-check-outline" size={16} color={colors.primary} />
          <Text style={styles.readerFooterText}>
            {t('quran.verifiedFooter', {
              ayahs: quran.totalVerses,
              source: quran.source,
            })}
          </Text>
        </View>
      }
    />
  );
}

export default function QuranScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);
  const [query, setQuery] = useState('');
  const [selectedNumber, setSelectedNumber] = useState(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return quran.chapters;
    return quran.chapters.filter((surah) => {
      return (
        String(surah.number) === term ||
        surah.nameSimple.toLowerCase().includes(term) ||
        surah.nameComplex.toLowerCase().includes(term) ||
        surah.translation.toLowerCase().includes(term) ||
        surah.nameArabic.includes(query.trim())
      );
    });
  }, [query]);

  const selectedSurah = useMemo(
    () => quran.chapters.find((surah) => surah.number === selectedNumber) || null,
    [selectedNumber]
  );

  if (selectedSurah) {
    return (
      <ScreenBackground>
        <SurahReader surah={selectedSurah} onBack={() => setSelectedNumber(null)} />
      </ScreenBackground>
    );
  }

  const header = (
    <View>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>{t('quran.eyebrow')}</Text>
          <Text style={styles.title}>{t('quran.title')}</Text>
        </View>
        <View style={styles.headerActions}>
          <ThemeToggle />
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons name="book-open-page-variant" size={22} color={colors.gold} />
          </View>
        </View>
      </View>

      <Text style={styles.subtitle}>{t('quran.subtitle')}</Text>

      <View style={styles.verifyCard}>
        <MaterialCommunityIcons name="shield-check" size={19} color={colors.primary} />
        <View style={styles.verifyCopy}>
          <Text style={styles.verifyTitle}>{t('quran.authentic')}</Text>
          <Text style={styles.verifyText}>
            {t('quran.verified', { ayahs: quran.totalVerses, date: quran.verifiedOn })}
          </Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('quran.search')}
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoCorrect={false}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} style={styles.clearButton}>
            <MaterialCommunityIcons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.listHeading}>
        <Text style={styles.listTitle}>{t('quran.allSurahs')}</Text>
        <Text style={styles.listCount}>{t('quran.shown', { count: filtered.length })}</Text>
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="book-search-outline" size={30} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>{t('quran.noSurah')}</Text>
          <Text style={styles.emptyText}>{t('quran.noSurahBody')}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <ScreenBackground>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.number)}
        ListHeaderComponent={header}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 18) + 6 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={14}
        renderItem={({ item }) => (
          <SurahRow
            surah={item}
            onPress={() => setSelectedNumber(item.number)}
            styles={styles}
            colors={colors}
            t={t}
          />
        )}
      />
    </ScreenBackground>
  );
}

const createStyles = (colors, isRTL) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: 18,
      paddingBottom: 32,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    eyebrow: {
      color: colors.gold,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: isRTL ? 0 : 2,
      marginBottom: 4,
    },
    title: {
      color: colors.text,
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: -0.4,
      textAlign: isRTL ? 'right' : 'left',
    },
    headerIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.goldSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 20,
      marginBottom: 16,
      textAlign: isRTL ? 'right' : 'left',
    },
    verifyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      padding: 12,
      marginBottom: 16,
    },
    verifyCopy: {
      marginLeft: isRTL ? 0 : 10,
      marginRight: isRTL ? 10 : 0,
      flex: 1,
    },
    verifyTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      textAlign: isRTL ? 'right' : 'left',
    },
    verifyText: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 2,
      textAlign: isRTL ? 'right' : 'left',
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: 12,
      height: 48,
      marginBottom: 20,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      marginLeft: isRTL ? 0 : 8,
      marginRight: isRTL ? 8 : 0,
      paddingVertical: 0,
      textAlign: isRTL ? 'right' : 'left',
    },
    clearButton: {
      padding: 4,
    },
    listHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    listTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
    },
    listCount: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },
    surahRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: 12,
      paddingVertical: 11,
      marginBottom: 8,
    },
    numberBadge: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    numberText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '700',
    },
    surahCopy: {
      flex: 1,
      marginLeft: isRTL ? 8 : 11,
      marginRight: isRTL ? 11 : 8,
    },
    surahEnglish: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
      textAlign: isRTL ? 'right' : 'left',
    },
    surahMeta: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 2,
      textAlign: isRTL ? 'right' : 'left',
    },
    surahArabic: {
      color: colors.gold,
      fontFamily: 'AmiriQuran',
      fontSize: 22,
      textAlign: 'right',
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 34,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
      marginTop: 10,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 4,
    },
    pressed: {
      opacity: 0.72,
    },
    readerContent: {
      paddingHorizontal: 18,
      paddingBottom: 36,
    },
    readerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 18,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    readerTitleWrap: {
      flex: 1,
      marginLeft: isRTL ? 0 : 12,
      marginRight: isRTL ? 12 : 0,
    },
    readerEyebrow: {
      color: colors.gold,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: isRTL ? 0 : 1.6,
      marginBottom: 2,
      textAlign: isRTL ? 'right' : 'left',
    },
    readerTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '700',
      textAlign: isRTL ? 'right' : 'left',
    },
    readerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    fontControls: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    fontButton: {
      width: 36,
      height: 34,
      borderRadius: 10,
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 6,
    },
    fontButtonText: {
      color: colors.text,
      fontSize: 11,
      fontWeight: '700',
    },
    readerInfo: {
      alignItems: 'center',
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      paddingVertical: 16,
      paddingHorizontal: 14,
      marginBottom: 16,
      ...SHADOWS.card,
    },
    readerArabicName: {
      color: colors.gold,
      fontFamily: 'AmiriQuran',
      fontSize: 34,
      marginBottom: 4,
    },
    readerMeta: {
      color: colors.textMuted,
      fontSize: 11,
      textAlign: 'center',
    },
    readerTools: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 14,
      flexWrap: 'wrap',
    },
    langRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      flexWrap: 'wrap',
    },
    langLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '700',
      marginRight: 2,
    },
    langChip: {
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: RADIUS.pill,
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    langChipActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    langChipText: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '700',
    },
    langChipTextActive: {
      color: colors.primary,
    },
    audioButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: RADIUS.pill,
      backgroundColor: colors.primary,
    },
    audioButtonText: {
      color: colors.background,
      fontSize: 11,
      fontWeight: '800',
    },
    ayahMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    ayahPlay: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ayahTranslation: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 22,
      textAlign: isRTL ? 'right' : 'left',
      marginTop: 8,
      paddingHorizontal: 2,
    },
    bismillah: {
      color: colors.gold,
      fontFamily: 'AmiriQuran',
      textAlign: 'center',
      includeFontPadding: true,
      marginBottom: 16,
      paddingHorizontal: 8,
    },
    ayahRow: {
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: RADIUS.md,
      marginBottom: 4,
    },
    ayahRowAlt: {
      backgroundColor: colors.surfaceSoft,
    },
    ayahNumber: {
      alignSelf: 'flex-end',
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.goldSoft,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 0,
    },
    ayahNumberText: {
      color: colors.gold,
      fontSize: 10,
      fontWeight: '700',
    },
    ayahText: {
      color: colors.text,
      fontFamily: 'AmiriQuran',
      textAlign: 'right',
      writingDirection: 'rtl',
      includeFontPadding: true,
    },
    readerFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 22,
      paddingHorizontal: 10,
    },
    readerFooterText: {
      color: colors.textMuted,
      fontSize: 9,
      marginLeft: isRTL ? 0 : 6,
      marginRight: isRTL ? 6 : 0,
      flex: 1,
      textAlign: isRTL ? 'right' : 'left',
    },
  });
