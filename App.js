/*
From Uiverse.io by mymiamo - https://uiverse.io/mymiamo/yellow-rattlesnake-26
MIT License, Copyright (c) mymiamo (Eray Durupınar)
*/

import React, { Component, useEffect, useMemo, useRef } from 'react';
import { Alert, Animated, AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SettingsProvider, useSettings } from './src/SettingsContext';
import { AuthProvider, useAuth } from './src/AuthContext';
import { configureNotifications } from './src/notifications';
import { useTheme } from './src/ThemeContext';
import { useI18n } from './src/i18n';
import InstallPrompt from './src/components/InstallPrompt';
import PrayerTimesScreen from './src/screens/PrayerTimesScreen';
import QuranScreen from './src/screens/QuranScreen';
import LearnScreen from './src/screens/LearnScreen';
import AIScreen from './src/screens/AIScreen';
import QiblaScreen from './src/screens/QiblaScreen';
import GamesScreen from './src/screens/GamesScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AuthScreen from './src/screens/AuthScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import { tapHaptic } from './src/utils/haptics';

const Tab = createBottomTabNavigator();

const webPrefix =
  typeof window !== 'undefined' && window.location ? window.location.origin : null;

const linking = {
  prefixes: webPrefix ? ['slati://', webPrefix] : ['slati://'],
  config: {
    screens: {
      Quran: 'quran',
      Learn: 'learn',
      Qibla: 'qibla',
      Games: 'games',
      Settings: 'settings',
    },
  },
};

const TAB_META = {
  Times: { labelKey: 'tab.times', icon: 'clock-outline', activeIcon: 'clock' },
  Quran: {
    labelKey: 'tab.quran',
    icon: 'book-open-page-variant-outline',
    activeIcon: 'book-open-page-variant',
  },
  Qibla: { labelKey: 'tab.qibla', icon: 'compass-outline', activeIcon: 'compass' },
  Learn: {
    labelKey: 'tab.learn',
    icon: 'bookshelf',
    activeIcon: 'bookshelf',
  },
  Games: {
    labelKey: 'tab.games',
    icon: 'gamepad-variant-outline',
    activeIcon: 'gamepad-variant',
  },
  AI: {
    labelKey: 'tab.ai',
    icon: 'robot-happy-outline',
    activeIcon: 'robot-happy',
  },
  Settings: {
    labelKey: 'tab.more',
    icon: 'dots-horizontal-circle-outline',
    activeIcon: 'dots-horizontal-circle',
  },
};

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    try {
      AsyncStorage.setItem(
        'slati.lastCrash',
        JSON.stringify({ message: String(error && error.message), stack: String(error && error.stack), componentStack: String(info && info.componentStack), at: new Date().toISOString() })
      );
    } catch (e) {}
    try {
      Alert.alert('Slati crash', String(error && (error.stack || error.message || error)));
    } catch (e) {}
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, padding: 16, backgroundColor: '#1a1a2e' }}>
          <Text style={{ color: '#ff6b6b', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
            Slati crashed
          </Text>
          <Text selectable style={{ color: '#fff', fontSize: 12 }}>
            {String(this.state.error && (this.state.error.stack || this.state.error.message || this.state.error))}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function AppTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      Animated.timing(fade, {
        toValue: next === 'active' ? 1 : 0,
        duration: 220,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    });
    return () => sub.remove();
  }, [fade]);

  return (
    <Animated.View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 12), opacity: fade }]}>
      <View style={styles.tabBarInner}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const meta = TAB_META[route.name] || TAB_META.Times;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              tapHaptic();
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              style={({ pressed }) => [
                styles.tabItem,
                focused && styles.tabItemActive,
                pressed && styles.tabItemPressed,
              ]}
            >
              <MaterialCommunityIcons
                name={focused ? meta.activeIcon : meta.icon}
                size={22}
                color={focused ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  focused ? styles.tabLabelActive : styles.tabLabelInactive,
                ]}
              >
                {t(meta.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

function AppShell() {
  const { settings, ready: settingsReady } = useSettings();
  const { colors } = useTheme();
  const { loading: authLoading, session, authOpen } = useAuth();
  const [fontsLoaded, fontError] = useFonts({
    AmiriQuran: require('./assets/fonts/AmiriQuran-Regular.ttf'),
  });
  useEffect(() => {
    if (fontError) {
      try {
        AsyncStorage.setItem('slati.lastCrash', JSON.stringify({ message: String(fontError && fontError.message), stack: String(fontError && fontError.stack), where: 'useFonts', at: new Date().toISOString() }));
      } catch (e) {}
      try {
        Alert.alert('Slati crash (fonts)', String(fontError && (fontError.stack || fontError.message || fontError)));
      } catch (e) {}
    }
  }, [fontError]);

  const styles = useMemo(() => createStyles(colors), [colors]);
  const navTheme = useMemo(
    () => ({
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        background: colors.background,
        card: colors.backgroundAlt,
        text: colors.text,
        primary: colors.primary,
        border: colors.border,
      },
    }),
    [colors]
  );

  useEffect(() => {
    try {
      configureNotifications();
    } catch (e) {
      try {
        AsyncStorage.setItem('slati.lastCrash', JSON.stringify({ message: String(e && e.message), stack: String(e && e.stack), where: 'configureNotifications', at: new Date().toISOString() }));
      } catch (err) {}
      try {
        Alert.alert('Slati crash (notifications)', String(e && (e.stack || e.message || e)));
      } catch (err) {}
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.style.backgroundColor = colors.background;
    }
  }, [colors.background]);

  if (!fontsLoaded || authLoading || !settingsReady) return null;

  // Very first launch: short intro before anything else.
  if (!settings.onboardingDone) return <OnboardingScreen />;

  // No session yet (first launch / signed out): show sign-in screen.
  if (!session) return <AuthScreen />;

  return (
    <React.Suspense fallback={null}>
      <View style={styles.root}>
        <NavigationContainer theme={navTheme} linking={linking} key={settings.language}>
        <Tab.Navigator
          tabBar={(props) => <AppTabBar {...props} />}
          screenOptions={{
            headerShown: false,
            animation: 'shift',
            sceneStyle: { backgroundColor: colors.background },
            // No tabBarStyle height on purpose: the custom AppTabBar is laid
            // out in normal flow and sizes itself to its content —            // react-navigation only forwards tabBarStyle to its built-in bar.
          }}
        >
          <Tab.Screen name="Times" component={PrayerTimesScreen} />
          <Tab.Screen name="Quran" component={QuranScreen} />
          <Tab.Screen name="Learn" component={LearnScreen} />
          <Tab.Screen name="Qibla" component={QiblaScreen} />
          <Tab.Screen name="Games" component={GamesScreen} />
          <Tab.Screen name="AI" component={AIScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>

      {/* Sign-in requested from inside the app (Settings -> account). */}
      {authOpen ? (
        <View style={styles.authLayer}>
          <AuthScreen />
        </View>
      ) : null}
      <InstallPrompt />
      <StatusBar hidden />
    </View>
    </React.Suspense>
  );
}
// Capture uncaught JS errors so a weak device shows the cause instead of
// silently exiting. Stored for later inspection in Settings if reachable.
if (typeof global !== 'undefined' && global.ErrorUtils && typeof global.ErrorUtils.setGlobalHandler === 'function') {
  const previous = global.ErrorUtils.getGlobalHandler && global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    try {
      AsyncStorage.setItem(
        'slati.lastCrash',
        JSON.stringify({ message: String(error && error.message), stack: String(error && error.stack), fatal: !!isFatal, at: new Date().toISOString() })
      );
    } catch (e) {}
    try {
      Alert.alert('Slati crash', String(error && (error.stack || error.message || error)));
    } catch (e) {}
    if (typeof previous === 'function') previous(error, isFatal);
  });
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <AuthProvider>
          <ErrorBoundary>
            <AppShell />
          </ErrorBoundary>
        </AuthProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    authLayer: {
      // NOTE: StyleSheet.absoluteFillObject does NOT exist in native React
      // Native (only in react-native-web), so spreading it silently yields {}
      // and the layer collapses. Keep the four literals explicit.
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      backgroundColor: colors.background,
      zIndex: 20,
      elevation: 20,
    },
    tabBar: {
      // Glassmorphism mobile menu (Uiverse.io by mymiamo).
      width: '100%',
      maxWidth: 520,
      alignSelf: 'center',
      marginHorizontal: 6,
      marginBottom: 8,
      backgroundColor: `${colors.primary}4D`,
      borderRadius: 16,
      padding: 6,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      overflow: 'hidden',
    },
    tabBarInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      width: '100%',
    },
    tabItem: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderRadius: 12,
    },
    tabItemActive: {
      backgroundColor: colors.primarySoft,
    },
    tabItemPressed: {
      opacity: 0.85,
    },
    tabLabel: {
      fontSize: 13,
      fontWeight: '600',
      lineHeight: 13,
      marginTop: 4,
    },
    tabLabelActive: {
      color: colors.primary,
    },
    tabLabelInactive: {
      color: colors.textMuted,
    },
  });
