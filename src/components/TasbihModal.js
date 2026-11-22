import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';
import { useI18n } from '../i18n';
import { RADIUS, SHADOWS } from '../theme';
import NextPrayerRing from './NextPrayerRing';
import { mediumHaptic, successHaptic, tapHaptic } from '../utils/haptics';

const STORAGE_KEY = 'slati.tasbih.v1';
const TARGETS = [33, 99, 0]; // 0 = free / no target

function todayKey() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function TasbihModal({ visible, onClose }) {
  const { colors, gradients } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = React.useMemo(() => createStyles(colors, insets), [colors, insets]);

  const [count, setCount] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [target, setTarget] = useState(33);
  const [today, setToday] = useState(0);
  const [justDone, setJustDone] = useState(false);

  const scale = useRef(new Animated.Value(1)).current;
  const doneTimer = useRef(null);

  // Load today's total (resets automatically on a new day).
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active || !raw) return;
        const saved = JSON.parse(raw);
        if (saved && saved.date === todayKey()) {
          setToday(Number(saved.total) || 0);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (doneTimer.current) clearTimeout(doneTimer.current);
    },
    []
  );

  const persist = useCallback((total) => {
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ date: todayKey(), total })
    ).catch(() => {});
  }, []);

  const onTap = () => {
    tapHaptic();
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.94, duration: 70, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }),
    ]).start();

    const nextCount = count + 1;
    const nextTotal = today + 1;
    setToday(nextTotal);
    persist(nextTotal);

    if (target > 0 && nextCount >= target) {
      successHaptic();
      setCount(0);
      setRounds((r) => r + 1);
      setJustDone(true);
      if (doneTimer.current) clearTimeout(doneTimer.current);
      doneTimer.current = setTimeout(() => setJustDone(false), 1400);
    } else {
      setCount(nextCount);
    }
  };

  const reset = () => {
    mediumHaptic();
    setCount(0);
    setRounds(0);
  };

  const progress = target > 0 ? count / target : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <LinearGradient
        colors={gradients.screen}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.root}
      >
        <View style={styles.topBar}>
          <View>
            <Text style={styles.eyebrow}>{t('tasbih.subtitle')}</Text>
            <Text style={styles.title}>{t('tasbih.title')}</Text>
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            accessibilityLabel={t('tasbih.close')}
          >
            <MaterialCommunityIcons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.targetRow}>
          <Text style={styles.targetLabel}>{t('tasbih.target')}</Text>
          {TARGETS.map((value) => {
            const active = target === value;
            return (
              <Pressable
                key={value}
                onPress={() => {
                  mediumHaptic();
                  setTarget(value);
                  setCount(0);
                }}
                style={({ pressed }) => [
                  styles.targetChip,
                  active && styles.targetChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.targetChipText, active && styles.targetChipTextActive]}>
                  {value === 0 ? t('tasbih.infinite') : value}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.counterWrap}>
          <Pressable onPress={onTap} accessibilityRole="button">
            <Animated.View style={{ transform: [{ scale }] }}>
              <NextPrayerRing
                size={250}
                strokeWidth={10}
                progress={progress}
                color={colors.primary}
                trackColor={colors.surfaceSoft}
              >
                <View style={styles.counterInner}>
                  <Text style={styles.counterValue}>{count}</Text>
                  <Text style={styles.counterHint}>
                    {justDone ? t('tasbih.done') : t('tasbih.tap')}
                  </Text>
                </View>
              </NextPrayerRing>
            </Animated.View>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{rounds}</Text>
            <Text style={styles.statLabel}>{t('tasbih.rounds')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.gold }]}>{today}</Text>
            <Text style={styles.statLabel}>{t('tasbih.today')}</Text>
          </View>
        </View>

        <Pressable
          onPress={reset}
          style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="refresh" size={16} color={colors.textMuted} />
          <Text style={styles.resetText}>{t('tasbih.reset')}</Text>
        </Pressable>
      </LinearGradient>
    </Modal>
  );
}

const createStyles = (colors, insets) =>
  StyleSheet.create({
    root: {
      flex: 1,
      paddingHorizontal: 22,
      paddingTop: Math.max(insets.top, 18) + 8,
      paddingBottom: Math.max(insets.bottom, 18) + 8,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    eyebrow: {
      color: colors.gold,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 2,
      marginBottom: 4,
      textTransform: 'uppercase',
    },
    title: {
      color: colors.text,
      fontSize: 26,
      fontWeight: '700',
      letterSpacing: -0.4,
    },
    closeButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: {
      opacity: 0.7,
    },
    targetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 22,
      gap: 8,
    },
    targetLabel: {
      color: colors.textFaint,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginRight: 4,
    },
    targetChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: RADIUS.pill,
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    targetChipActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    targetChipText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    targetChipTextActive: {
      color: colors.primary,
    },
    counterWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    counterInner: {
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: 'rgba(0,0,0,0.18)',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    counterValue: {
      color: colors.text,
      fontSize: 64,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      letterSpacing: -2,
    },
    counterHint: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 4,
      letterSpacing: 0.6,
      textAlign: 'center',
      paddingHorizontal: 12,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surfaceSoft,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
      alignItems: 'center',
      ...SHADOWS.card,
    },
    statValue: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 2,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    resetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginTop: 16,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: RADIUS.pill,
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    resetText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      marginLeft: 6,
    },
  });
