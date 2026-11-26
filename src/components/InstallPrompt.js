import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';
import { useI18n } from '../i18n';
import { RADIUS, SHADOWS } from '../theme';

const COPY = {
  ar: {
    title: 'ثبّت Slati Pro على iPhone',
    body: 'اضغط زر المشاركة ↑ ثم «Add to Home Screen» باش تولي أيقونة كتطبيق.',
    ok: 'فهمت',
  },
  en: {
    title: 'Install Slati Pro on iPhone',
    body: 'Tap the Share button ↑ then “Add to Home Screen” to get a real app icon.',
    ok: 'Got it',
  },
  fr: {
    title: 'Installer Slati Pro sur iPhone',
    body: 'Appuyez sur Partager ↑ puis « Sur l’écran d’accueil » pour obtenir une vraie icône.',
    ok: 'Compris',
  },
};

export default function InstallPrompt() {
  const [show, setShow] = useState(false);
  const { colors } = useTheme();
  const { language } = useI18n();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const copy = COPY[language] || COPY.en;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const ua = window.navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
    const standalone =
      window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    if (!isIOS || standalone) return;
    let timer;
    AsyncStorage.getItem('slati.installPromptHidden')
      .then((value) => {
        if (value !== '1') timer = setTimeout(() => setShow(true), 2500);
      })
      .catch(() => {});
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setShow(false);
    AsyncStorage.setItem('slati.installPromptHidden', '1').catch(() => {});
  };

  if (!show) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.icon}>
          <MaterialCommunityIcons name="apple" size={20} color={colors.background} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>
        </View>
        <Pressable onPress={dismiss} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="close" size={17} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 96,
      zIndex: 50,
      ...SHADOWS.card,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: RADIUS.lg,
      padding: 12,
    },
    icon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: { flex: 1 },
    title: { color: colors.text, fontSize: 13, fontWeight: '800', marginBottom: 3 },
    body: { color: colors.textMuted, fontSize: 11, lineHeight: 16 },
    close: { padding: 4 },
    pressed: { opacity: 0.6 },
  });
