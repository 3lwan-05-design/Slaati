import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useTheme } from '../ThemeContext';
import { useI18n } from '../i18n';
import { RADIUS, SHADOWS } from '../theme';

// One reciter for every ayah, so the voice never changes between surahs.
const AUDIO_BASE = 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/';
const audioUrl = (globalNumber) => `${AUDIO_BASE}${globalNumber}.mp3`;

export default function QuranAudioPlayer({ globalNumbers, startIndex, onClose }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const playerRef = useRef(null);
  const indexRef = useRef(startIndex || 0);
  const advanceRef = useRef(() => {});

  const [index, setIndex] = useState(startIndex || 0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let player;
    try {
      player = createAudioPlayer(null, { updateInterval: 250 });
      playerRef.current = player;
      setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    } catch (e) {
      setError(true);
      return undefined;
    }

    const goTo = (next) => {
      if (next < 0 || next >= globalNumbers.length) return;
      indexRef.current = next;
      setIndex(next);
      setProgress(0);
      setError(false);
      try {
        player.replace(audioUrl(globalNumbers[next]));
        player.play();
        setPlaying(true);
      } catch (e) {
        setError(true);
        setPlaying(false);
      }
    };
    advanceRef.current = goTo;
    goTo(indexRef.current);

    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      setLoading(Boolean(status.isBuffering));
      setProgress(
        status.duration && status.currentTime
          ? Math.min(1, status.currentTime / status.duration)
          : 0
      );
      if (status.didJustFinish) {
        if (indexRef.current < globalNumbers.length - 1) {
          goTo(indexRef.current + 1);
        } else {
          setPlaying(false);
        }
      }
    });

    return () => {
      try {
        subscription.remove();
      } catch (e) {}
      try {
        player.pause();
      } catch (e) {}
      playerRef.current = null;
    };
  }, [globalNumbers, startIndex]);

  const toggle = () => {
    const player = playerRef.current;
    if (!player) return;
    try {
      if (playing) {
        player.pause();
        setPlaying(false);
      } else {
        if (player.isLoaded === false) player.replace(audioUrl(globalNumbers[indexRef.current]));
        player.play();
        setPlaying(true);
        setError(false);
      }
    } catch (e) {
      setError(true);
    }
  };

  const step = (delta) => advanceRef.current(indexRef.current + delta);

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.titleWrap}>
          <MaterialCommunityIcons name="headphones" size={17} color={colors.primary} />
          <Text style={styles.title}>{t('quran.audio')} · Mishary Alafasy</Text>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="close" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.controls}>
        <Pressable
          onPress={() => step(-1)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.control, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="skip-previous" size={24} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={playing ? t('quran.audioPause') : t('quran.audio')}
          style={({ pressed }) => [styles.play, pressed && styles.pressed]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <MaterialCommunityIcons
              name={playing ? 'pause' : 'play'}
              size={24}
              color={colors.background}
            />
          )}
        </Pressable>
        <Pressable
          onPress={() => step(1)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.control, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="skip-next" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.ayahLabel}>
          {index + 1} / {globalNumbers.length}
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>

      {error ? <Text style={styles.error}>{t('quran.audioError')}</Text> : null}
      <Text style={styles.credit}>{t('quran.audioCredit')}</Text>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.lg,
      padding: 12,
      marginBottom: 14,
      ...SHADOWS.card,
    },
    top: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    titleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    title: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    close: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceSoft,
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
    },
    control: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceSoft,
    },
    play: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    pressed: { opacity: 0.7 },
    ayahLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      minWidth: 44,
    },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.surfaceSoft,
      marginTop: 12,
      overflow: 'hidden',
    },
    progressFill: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.primary,
    },
    error: {
      color: colors.danger,
      fontSize: 10,
      marginTop: 8,
      textAlign: 'center',
    },
    credit: {
      color: colors.textFaint,
      fontSize: 9,
      marginTop: 8,
      textAlign: 'center',
    },
  });
