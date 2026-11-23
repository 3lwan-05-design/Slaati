import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import quran from '../data/quran.json';
import { useTheme } from '../ThemeContext';
import { useI18n } from '../i18n';
import { RADIUS, SHADOWS } from '../theme';

const RECITERS = [
  { id: 'ar.alafasy', name: 'Mishary Alafasy' },
  { id: 'ar.husary', name: 'Mahmoud Al-Husary' },
  { id: 'ar.mahermuaiqly', name: 'Maher Al-Muaiqly' },
];

const globalStart = (number) =>
  quran.chapters.slice(0, number - 1).reduce((sum, c) => sum + c.versesCount, 0) + 1;

const audioUrl = (reciter, global) =>
  `https://cdn.islamic.network/quran/audio/128/${reciter}/${global}.mp3`;

export default function FullSurahAudio() {
  const { colors } = useTheme();
  const { t, isRTL, language } = useI18n();
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);

  const [reciter, setReciter] = useState('ar.alafasy');
  const [query, setQuery] = useState('');
  const [currentSurah, setCurrentSurah] = useState(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [progress, setProgress] = useState(0);

  const playerRef = useRef(null);
  const surahRef = useRef(null);
  const indexRef = useRef(0);
  const reciterRef = useRef(reciter);
  const playAtRef = useRef(null);

  useEffect(() => { reciterRef.current = reciter; }, [reciter]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return quran.chapters;
    return quran.chapters.filter(
      (s) =>
        String(s.number) === term ||
        s.nameSimple.toLowerCase().includes(term) ||
        s.nameComplex.toLowerCase().includes(term) ||
        s.translation.toLowerCase().includes(term) ||
        s.nameArabic.includes(query.trim())
    );
  }, [query]);

  useEffect(() => {
    const player = createAudioPlayer(null, { updateInterval: 250 });
    playerRef.current = player;
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});

    const playAt = (i, p) => {
      const number = surahRef.current;
      if (!number || !p) return;
      const global = globalStart(number) + i;
      indexRef.current = i;
      setIndex(i);
      setComplete(false);
      setProgress(0);
      try {
        p.replace({ uri: audioUrl(reciterRef.current, global) });
        p.play();
        setPlaying(true);
      } catch (e) {
        setPlaying(false);
      }
    };
    playAtRef.current = playAt;

    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      setLoading(Boolean(status.isBuffering));
      setProgress(
        status.duration && status.currentTime
          ? Math.min(1, status.currentTime / status.duration)
          : 0
      );
      if (status.didJustFinish) {
        const number = surahRef.current;
        if (!number) return;
        const total = quran.chapters[number - 1].versesCount;
        if (indexRef.current < total - 1) playAt(indexRef.current + 1, player);
        else {
          setPlaying(false);
          setComplete(true);
        }
      }
    });

    return () => {
      try { subscription.remove(); } catch (e) {}
      try { player.pause(); } catch (e) {}
      playerRef.current = null;
    };
  }, []);

  // Changing the reciter restarts the current ayah with the new voice.
  useEffect(() => {
    if (surahRef.current && playerRef.current) {
      playAtRef.current(indexRef.current, playerRef.current);
    }
  }, [reciter]);

  const startSurah = (number) => {
    surahRef.current = number;
    setCurrentSurah(number);
    if (playerRef.current) playAtRef.current(0, playerRef.current);
  };

  const toggle = () => {
    const player = playerRef.current;
    if (!player || !currentSurah) return;
    try {
      if (playing) {
        player.pause();
        setPlaying(false);
      } else if (complete) {
        playAtRef.current(0, player);
      } else {
        player.play();
        setPlaying(true);
      }
    } catch (e) {
      setPlaying(false);
    }
  };

  const stop = () => {
    const player = playerRef.current;
    if (player) {
      try { player.pause(); } catch (e) {}
    }
    surahRef.current = null;
    setCurrentSurah(null);
    setPlaying(false);
    setComplete(false);
    setProgress(0);
  };

  const surah = currentSurah ? quran.chapters[currentSurah - 1] : null;
  const surahName = surah
    ? language === 'ar' ? surah.nameArabic : surah.nameSimple
    : '';

  const header = (
    <View>
      <Text style={styles.eyebrow}>{t('quran.audioFull')}</Text>
      <Text style={styles.subtitle}>{t('quran.chooseSurah')}</Text>

      <View style={styles.reciterRow}>
        <Text style={styles.reciterLabel}>{t('quran.reciter')}:</Text>
        {RECITERS.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => setReciter(r.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: reciter === r.id }}
            style={({ pressed }) => [
              styles.reciterChip,
              reciter === r.id && styles.reciterChipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.reciterText,
                reciter === r.id && styles.reciterTextActive,
              ]}
            >
              {r.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {surah ? (
        <View style={styles.player}>
          <View style={styles.playerTop}>
            <MaterialCommunityIcons name="book-open-variant" size={17} color={colors.primary} />
            <Text style={styles.playerTitle} numberOfLines={1}>{surahName}</Text>
            <Text style={styles.playerCounter}>
              {complete ? t('quran.complete') : `${index + 1} / ${surah.versesCount}`}
            </Text>
          </View>
          <View style={styles.controls}>
            <Pressable
              onPress={toggle}
              accessibilityRole="button"
              style={({ pressed }) => [styles.play, pressed && styles.pressed]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <MaterialCommunityIcons
                  name={playing ? 'pause' : 'play'}
                  size={22}
                  color={colors.background}
                />
              )}
            </Pressable>
            <Pressable
              onPress={stop}
              accessibilityRole="button"
              accessibilityLabel={t('quran.stop')}
              style={({ pressed }) => [styles.stop, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="stop" size={20} color={colors.text} />
              <Text style={styles.stopText}>{t('quran.stop')}</Text>
            </Pressable>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </View>
      ) : null}

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
      </View>
      <View style={styles.listHeading}>
        <Text style={styles.listTitle}>{t('quran.allSurahs')}</Text>
        <Text style={styles.listCount}>{t('quran.shown', { count: filtered.length })}</Text>
      </View>
    </View>
  );

  return (
    <FlatList
      data={filtered}
      keyExtractor={(item) => String(item.number)}
      ListHeaderComponent={header}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={14}
      renderItem={({ item }) => {
        const active = currentSurah === item.number;
        return (
          <Pressable
            onPress={() => startSurah(item.number)}
            style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && styles.pressed]}
          >
            <View style={styles.numberBadge}>
              <Text style={styles.numberText}>{item.number}</Text>
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowName}>
                {language === 'ar' ? item.nameArabic : item.nameSimple}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {t('quran.ayahs', { count: item.versesCount })} · {item.translation}
              </Text>
            </View>
            {active && playing ? (
              <MaterialCommunityIcons name="volume-high" size={18} color={colors.primary} />
            ) : (
              <MaterialCommunityIcons name="play-circle-outline" size={20} color={colors.textMuted} />
            )}
          </Pressable>
        );
      }}
    />
  );
}

const createStyles = (colors, isRTL) =>
  StyleSheet.create({
    content: { paddingHorizontal: 18, paddingBottom: 32 },
    eyebrow: {
      color: colors.gold,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: isRTL ? 0 : 1.6,
      textAlign: isRTL ? 'right' : 'left',
      marginBottom: 5,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 12,
      marginBottom: 14,
      textAlign: isRTL ? 'right' : 'left',
    },
    reciterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 5,
      marginBottom: 14,
    },
    reciterLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
    reciterChip: {
      paddingHorizontal: 9,
      paddingVertical: 7,
      borderRadius: RADIUS.pill,
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    reciterChipActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    reciterText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
    reciterTextActive: { color: colors.primary },
    player: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      padding: 14,
      marginBottom: 16,
      ...SHADOWS.card,
    },
    playerTop: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
    playerTitle: { color: colors.text, fontSize: 14, fontWeight: '800', flex: 1 },
    playerCounter: { color: colors.gold, fontSize: 11, fontWeight: '700' },
    controls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    play: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: RADIUS.pill,
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stopText: { color: colors.text, fontSize: 11, fontWeight: '700' },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.surfaceSoft,
      marginTop: 12,
      overflow: 'hidden',
    },
    progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 16,
    },
    searchInput: { flex: 1, color: colors.text, fontSize: 13 },
    listHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    listTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
    listCount: { color: colors.textMuted, fontSize: 11 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      padding: 12,
      marginBottom: 8,
    },
    rowActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    numberBadge: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    numberText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
    rowCopy: { flex: 1 },
    rowName: { color: colors.text, fontSize: 14, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' },
    rowMeta: { color: colors.textMuted, fontSize: 10, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    pressed: { opacity: 0.7 },
  });
