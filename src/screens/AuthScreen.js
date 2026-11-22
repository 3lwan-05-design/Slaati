import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import { IS_LITE } from '../config/lite';
import ScreenBackground from '../components/ScreenBackground';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../ThemeContext';
import { useI18n } from '../i18n';
import { useAuth } from '../AuthContext';
import { RADIUS, SHADOWS } from '../theme';
import {
  facebookAppId,
  googleClientId,
  isFacebookReady,
  isGoogleReady,
} from '../auth/socialConfig';

// Small base64 -> UTF-8 decoder (Hermes has no atob).
function decodeBase64Utf8(input) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = {};
  for (let i = 0; i < chars.length; i += 1) lookup[chars[i]] = i;

  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '=' || char === '\n' || char === '\r') break;
    const value = lookup[char];
    if (value === undefined) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }

  let escaped = '';
  for (let i = 0; i < bytes.length; i += 1) {
    escaped += `%${bytes[i].toString(16).padStart(2, '0')}`;
  }
  try {
    return decodeURIComponent(escaped);
  } catch (error) {
    return '';
  }
}

function decodeJwt(token) {
  try {
    const payload = String(token).split('.')[1] || '';
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(decodeBase64Utf8(padded));
  } catch (error) {
    return null;
  }
}

async function socialProfile(provider, response) {
  const auth = response.authentication || {};
  const params = response.params || {};
  const accessToken = auth.accessToken || params.access_token;
  const idToken = params.id_token || auth.idToken;

  if (provider === 'google') {
    if (accessToken) {
      const reply = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (reply.ok) {
        const info = await reply.json();
        return { id: info.sub, name: info.name, email: info.email };
      }
    }
    const decoded = idToken ? decodeJwt(idToken) : null;
    if (decoded) return { id: decoded.sub, name: decoded.name, email: decoded.email };
    return null;
  }

  if (accessToken) {
    const reply = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(
        accessToken
      )}`
    );
    if (reply.ok) {
      const info = await reply.json();
      return { id: info.id, name: info.name, email: info.email };
    }
  }
  return null;
}

export default function AuthScreen() {
  const { colors } = useTheme();
  const { t, isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);
  const { session, closeAuth, signIn, signUp, socialSignIn, continueAsGuest } = useAuth();

  const [mode, setMode] = useState('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const canClose = !!session; // opened from the app (already signed in / guest)

  const [googleRequest, googleResponse, promptGoogle] = Google.useAuthRequest({
    clientId: googleClientId(),
    androidClientId: googleClientId(),
    webClientId: googleClientId(),
    selectAccount: true,
  });
  const [facebookRequest, facebookResponse, promptFacebook] = Facebook.useAuthRequest({
    clientId: facebookAppId(),
    androidClientId: facebookAppId(),
    webClientId: facebookAppId(),
  });

  const finishSocial = async (provider, response) => {
    if (!response) return;
    if (response.type === 'dismiss' || response.type === 'cancel') return;
    if (response.type !== 'success') {
      setNotice(t('auth.err.social'));
      return;
    }
    setBusy(true);
    try {
      const profile = await socialProfile(provider, response);
      if (!profile || !profile.id) {
        setNotice(t('auth.err.social'));
        return;
      }
      const result = await socialSignIn({
        provider,
        id: String(profile.id),
        name: profile.name || '',
        email: profile.email || '',
      });
      if (!result.ok) setNotice(t('auth.err.unknown'));
    } catch (err) {
      setNotice(t('auth.err.social'));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    finishSocial('google', googleResponse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleResponse]);

  useEffect(() => {
    finishSocial('facebook', facebookResponse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facebookResponse]);

  const switchMode = (next) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const submit = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const result =
        mode === 'in'
          ? await signIn({ email, password })
          : await signUp({ name, email, password });
      if (!result.ok) setError(result.error || 'unknown');
    } finally {
      setBusy(false);
    }
  };

  const pressGoogle = async () => {
    setError(null);
    setNotice(null);
    if (!isGoogleReady()) {
      setNotice(t('auth.err.pendingGoogle'));
      return;
    }
    try {
      await promptGoogle();
    } catch (err) {
      setNotice(t('auth.err.social'));
    }
  };

  const pressFacebook = async () => {
    setError(null);
    setNotice(null);
    if (!isFacebookReady()) {
      setNotice(t('auth.err.pendingFacebook'));
      return;
    }
    try {
      await promptFacebook();
    } catch (err) {
      setNotice(t('auth.err.social'));
    }
  };

  const fieldIcon = (icon, focused) => (
    <View style={[styles.fieldIcon, focused && styles.fieldIconActive]}>
      <MaterialCommunityIcons name={icon} size={17} color={focused ? colors.primary : colors.textFaint} />
    </View>
  );

  return (
    <ScreenBackground>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: Math.max(insets.top, 18) + 6 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>{t('auth.eyebrow')}</Text>
              <Text style={styles.title}>
                {mode === 'in' ? t('auth.signInTitle') : t('auth.signUpTitle')}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <ThemeToggle />
              {canClose ? (
                <Pressable
                  onPress={closeAuth}
                  accessibilityLabel={t('common.close')}
                  style={({ pressed }) => [styles.headerIcon, pressed && styles.pressed]}
                >
                  <MaterialCommunityIcons name="close" size={20} color={colors.gold} />
                </Pressable>
              ) : (
                <View style={styles.headerIcon}>
                  <MaterialCommunityIcons name="account-circle-outline" size={22} color={colors.gold} />
                </View>
              )}
            </View>
          </View>

          <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>

          <View style={styles.segment}>
            <Pressable
              onPress={() => switchMode('in')}
              style={[styles.segmentBtn, mode === 'in' && styles.segmentBtnActive]}
            >
              <MaterialCommunityIcons
                name="login-variant"
                size={15}
                color={mode === 'in' ? colors.background : colors.textMuted}
              />
              <Text style={[styles.segmentText, mode === 'in' && styles.segmentTextActive]}>
                {t('auth.tabSignIn')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => switchMode('up')}
              style={[styles.segmentBtn, mode === 'up' && styles.segmentBtnActive]}
            >
              <MaterialCommunityIcons
                name="account-plus-outline"
                size={15}
                color={mode === 'up' ? colors.background : colors.textMuted}
              />
              <Text style={[styles.segmentText, mode === 'up' && styles.segmentTextActive]}>
                {t('auth.tabSignUp')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            {mode === 'up' ? (
              <>
                <Text style={styles.fieldLabel}>{t('auth.name')}</Text>
                <View style={styles.field}>
                  {fieldIcon('account-outline', name.length > 0)}
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder={t('auth.namePlaceholder')}
                    placeholderTextColor={colors.textFaint}
                    style={styles.input}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              </>
            ) : null}

            <Text style={styles.fieldLabel}>{t('auth.email')}</Text>
            <View style={styles.field}>
              {fieldIcon('email-outline', email.length > 0)}
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.emailPlaceholder')}
                placeholderTextColor={colors.textFaint}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="next"
              />
            </View>

            <Text style={styles.fieldLabel}>{t('auth.password')}</Text>
            <View style={styles.field}>
              {fieldIcon('lock-outline', password.length > 0)}
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={t('auth.passwordPlaceholder')}
                placeholderTextColor={colors.textFaint}
                style={styles.input}
                secureTextEntry={secure}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={submit}
              />
              <Pressable
                onPress={() => setSecure((value) => !value)}
                hitSlop={8}
                style={({ pressed }) => [styles.eye, pressed && styles.pressed]}
              >
                <MaterialCommunityIcons
                  name={secure ? 'eye-outline' : 'eye-off-outline'}
                  size={18}
                  color={colors.textFaint}
                />
              </Pressable>
            </View>

            {error ? <Text style={styles.error}>{t(`auth.err.${error}`)}</Text> : null}

            <Pressable
              onPress={submit}
              disabled={busy}
              style={({ pressed }) => [styles.primaryButton, (pressed || busy) && styles.pressed]}
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name={mode === 'in' ? 'arrow-right' : 'account-plus-outline'}
                    size={17}
                    color={colors.background}
                  />
                  <Text style={styles.primaryButtonText}>
                    {mode === 'in' ? t('auth.signIn') : t('auth.signUp')}
                  </Text>
                </>
              )}
            </Pressable>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>
                {mode === 'in' ? t('auth.noAccount') : t('auth.haveAccount')}
              </Text>
              <Pressable onPress={() => switchMode(mode === 'in' ? 'up' : 'in')} hitSlop={8}>
                <Text style={styles.switchLink}>
                  {mode === 'in' ? t('auth.tabSignUp') : t('auth.tabSignIn')}
                </Text>
              </Pressable>
            </View>
          </View>

          {!IS_LITE ? (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{t('auth.or')}</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable
                onPress={pressGoogle}
                disabled={busy || !googleRequest}
                style={({ pressed }) => [styles.socialButton, (pressed || !googleRequest) && styles.pressed]}
              >
                <MaterialCommunityIcons name="google" size={18} color={colors.text} />
                <Text style={styles.socialText}>{t('auth.google')}</Text>
              </Pressable>

              <Pressable
                onPress={pressFacebook}
                disabled={busy || !facebookRequest}
                style={({ pressed }) => [styles.socialButton, (pressed || !facebookRequest) && styles.pressed]}
              >
                <MaterialCommunityIcons name="facebook" size={18} color="#4c8ff7" />
                <Text style={styles.socialText}>{t('auth.facebook')}</Text>
              </Pressable>
            </>
          ) : null}

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          {!canClose ? (
            <>
              <Pressable
                onPress={continueAsGuest}
                style={({ pressed }) => [styles.guestButton, pressed && styles.pressed]}
              >
                <Text style={styles.guestText}>{t('auth.guest')}</Text>
                <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primary} />
              </Pressable>
              <Text style={styles.hint}>{t('auth.guestHint')}</Text>
            </>
          ) : null}

          <View style={styles.privacyRow}>
            <MaterialCommunityIcons name="shield-check-outline" size={14} color={colors.textFaint} />
            <Text style={styles.privacyText}>{t('auth.privacy')}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const createStyles = (colors, isRTL) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 18,
      paddingBottom: 36,
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
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 20,
      marginBottom: 16,
      textAlign: isRTL ? 'right' : 'left',
    },
    segment: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
    },
    segmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 11,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSoft,
    },
    segmentBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    segmentText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    segmentTextActive: {
      color: colors.background,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      ...SHADOWS.card,
    },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.backgroundAlt,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      marginBottom: 12,
    },
    fieldIcon: {
      width: 26,
      alignItems: 'center',
    },
    fieldIconActive: {},
    input: {
      flex: 1,
      color: colors.text,
      fontSize: 14.5,
      paddingVertical: 13,
      paddingHorizontal: 6,
      textAlign: 'left',
    },
    eye: {
      paddingLeft: 6,
    },
    fieldLabel: {
      color: colors.textFaint,
      fontSize: 10.5,
      fontWeight: '700',
      letterSpacing: 0.6,
      marginBottom: 6,
      textAlign: isRTL ? 'right' : 'left',
    },
    error: {
      color: colors.danger,
      fontSize: 12.5,
      lineHeight: 18,
      marginBottom: 8,
      textAlign: isRTL ? 'right' : 'left',
    },
    notice: {
      color: colors.gold,
      fontSize: 12.5,
      lineHeight: 18,
      marginTop: 10,
      textAlign: 'center',
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: RADIUS.md,
      paddingVertical: 14,
      marginTop: 2,
    },
    primaryButtonText: {
      color: colors.background,
      fontSize: 15,
      fontWeight: '700',
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      marginTop: 14,
      flexWrap: 'wrap',
    },
    switchText: {
      color: colors.textMuted,
      fontSize: 12.5,
    },
    switchLink: {
      color: colors.primary,
      fontSize: 12.5,
      fontWeight: '700',
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginVertical: 16,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.4,
    },
    socialButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: RADIUS.md,
      paddingVertical: 13,
      marginBottom: 10,
    },
    socialText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    guestButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
      paddingVertical: 13,
      marginTop: 6,
    },
    guestText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '700',
    },
    hint: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 10,
      textAlign: 'center',
    },
    privacyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 18,
    },
    privacyText: {
      color: colors.textFaint,
      fontSize: 11.5,
    },
    pressed: {
      opacity: 0.75,
    },
  });
