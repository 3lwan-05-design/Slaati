import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Magnetometer } from 'expo-sensors';
import * as Location from 'expo-location';
import { useSettings } from '../SettingsContext';
import { useTheme } from '../ThemeContext';
import { useI18n } from '../i18n';
import ScreenBackground from '../components/ScreenBackground';
import ThemeToggle from '../components/ThemeToggle';
import { RADIUS, SHADOWS } from '../theme';

const KAABA_LAT = 21.4225;
const KAABA_LNG = 39.8262;

function bearing(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLng = toRad(lng2 - lng1);
  const y = Math.sin(deltaLng) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function distanceToMakkah(lat1, lng1) {
  const toRad = (d) => (d * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRad(KAABA_LAT - lat1);
  const dLng = toRad(KAABA_LNG - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(KAABA_LAT)) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

export default function QiblaScreen() {
  const { settings } = useSettings();
  const { colors, gradients } = useTheme();
  const { t, isRTL } = useI18n();
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);
  const manualLocation = settings.manualLocation;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compassSize = Math.min(300, width - 56);

  const [heading, setHeading] = useState(0);
  const [qibla, setQibla] = useState(null);
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [sensorAvailable, setSensorAvailable] = useState(true);

  const turnDirection = (relative) => {
    if (relative > 4) return t('qibla.turnRight', { degrees: Math.round(relative) });
    if (relative < -4) return t('qibla.turnLeft', { degrees: Math.round(Math.abs(relative)) });
    return t('qibla.facing');
  };

  useEffect(() => {
    let subscription = null;
    let mounted = true;

    (async () => {
      try {
        const available = await Magnetometer.isAvailableAsync();
        if (!mounted) return;
        if (!available) {
          setSensorAvailable(false);
          return;
        }

        Magnetometer.setUpdateInterval(100);
        subscription = Magnetometer.addListener((data) => {
          const angle = (Math.atan2(data.y, data.x) * 180) / Math.PI;
          setHeading(normalizeDegrees(angle));
        });
      } catch (e) {
        if (mounted) setSensorAvailable(false);
      }
    })();

    return () => {
      mounted = false;
      if (subscription) subscription.remove();
    };
  }, []);

  const loadLocation = useCallback(async () => {
    setError(null);

    if (manualLocation) {
      const nextLocation = {
        latitude: manualLocation.latitude,
        longitude: manualLocation.longitude,
      };
      setLocation(nextLocation);
      setQibla(bearing(nextLocation.latitude, nextLocation.longitude, KAABA_LAT, KAABA_LNG));
      return;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError(t('qibla.permission'));
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const nextLocation = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      setLocation(nextLocation);
      setQibla(bearing(nextLocation.latitude, nextLocation.longitude, KAABA_LAT, KAABA_LNG));
    } catch (e) {
      setError(String(e.message || e));
    }
  }, [manualLocation, t]);

  useEffect(() => {
    loadLocation();
  }, [loadLocation]);

  const relative = useMemo(() => {
    if (qibla === null) return 0;
    return ((qibla - heading + 540) % 360) - 180;
  }, [qibla, heading]);

  const distance = location ? distanceToMakkah(location.latitude, location.longitude) : null;
  const dialRotation = -heading;
  const qiblaRotation = qibla === null ? 0 : qibla - heading;
  const ticks = Array.from({ length: 72 }, (_, index) => index * 5);

  const cardinalStyle = (position) => {
    const offset = compassSize / 2 - 25;
    if (position === 'N') return { top: offset, left: compassSize / 2 - 8 };
    if (position === 'S') return { bottom: offset, left: compassSize / 2 - 8 };
    if (position === 'E') return { top: compassSize / 2 - 8, right: offset };
    return { top: compassSize / 2 - 8, left: offset };
  };

  return (
    <ScreenBackground>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top, 18) + 6 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{t('qibla.eyebrow')}</Text>
            <Text style={styles.title}>{t('qibla.title')}</Text>
          </View>
          <View style={styles.headerActions}>
            <ThemeToggle />
            <View style={styles.headerIcon}>
              <MaterialCommunityIcons name="cube" size={22} color={colors.gold} />
            </View>
          </View>
        </View>

        <Text style={styles.subtitle}>{t('qibla.subtitle')}</Text>

        <View style={styles.compassCard}>
          <LinearGradient
            colors={gradients.compass}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.compassGradient}
          >
            <View
              style={[
                styles.compass,
                { width: compassSize, height: compassSize, borderRadius: compassSize / 2 },
              ]}
            >
              <View
                style={[
                  styles.dial,
                  {
                    width: compassSize,
                    height: compassSize,
                    borderRadius: compassSize / 2,
                    transform: [{ rotate: `${dialRotation}deg` }],
                  },
                ]}
              >
                {ticks.map((angle) => {
                  const major = angle % 30 === 0;
                  return (
                    <View
                      key={angle}
                      style={[
                        styles.tick,
                        {
                          height: major ? 12 : 6,
                          width: major ? 2 : 1,
                          backgroundColor: major ? colors.textMuted : colors.border,
                          top: compassSize / 2 - (major ? 12 : 6),
                          left: compassSize / 2 - (major ? 1 : 0.5),
                          transform: [
                            { rotate: `${angle}deg` },
                            { translateY: -(compassSize / 2 - 14) },
                          ],
                        },
                      ]}
                    />
                  );
                })}

                {['N', 'E', 'S', 'W'].map((letter) => (
                  <Text
                    key={letter}
                    style={[
                      styles.cardinal,
                      cardinalStyle(letter),
                      letter === 'N' && styles.cardinalNorth,
                    ]}
                  >
                    {letter}
                  </Text>
                ))}
              </View>

              {qibla !== null ? (
                <View
                  style={[
                    styles.qiblaLayer,
                    {
                      width: compassSize,
                      height: compassSize,
                      transform: [{ rotate: `${qiblaRotation}deg` }],
                    },
                  ]}
                >
                  <View style={[styles.qiblaIconWrap, { top: 8, left: compassSize / 2 - 22 }]}>
                    <MaterialCommunityIcons name="navigation" size={28} color={colors.gold} />
                  </View>
                  <View
                    style={[
                      styles.qiblaNeedle,
                      {
                        height: compassSize * 0.27,
                        top: 32,
                        left: compassSize / 2 - 1,
                      },
                    ]}
                  />
                </View>
              ) : null}

              <View style={styles.compassCenter}>
                <MaterialCommunityIcons name="cube" size={26} color={colors.gold} />
                <Text style={styles.centerLabel}>{t('qibla.kaaba')}</Text>
              </View>
            </View>

            <View style={styles.headingPill}>
              <MaterialCommunityIcons
                name="compass-outline"
                size={15}
                color={colors.primary}
              />
              <Text style={styles.headingPillText}>
                {sensorAvailable
                  ? t('qibla.heading', { degrees: Math.round(heading) })
                  : t('qibla.sensorUnavailable')}
              </Text>
            </View>
          </LinearGradient>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <MaterialCommunityIcons
              name="map-marker-off-outline"
              size={26}
              color={colors.gold}
            />
            <Text style={styles.errorTitle}>{t('common.locationNeeded')}</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              onPress={loadLocation}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>{t('common.allowLocation')}</Text>
            </Pressable>
          </View>
        ) : null}

        {!location && !error ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>{t('qibla.finding')}</Text>
          </View>
        ) : null}

        {location && qibla !== null ? (
          <>
            <View style={styles.statsCard}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>{t('qibla.bearing')}</Text>
                <Text style={styles.statValue}>{Math.round(qibla)}°</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statLabel}>{t('qibla.headingShort')}</Text>
                <Text style={styles.statValue}>{Math.round(heading)}°</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statLabel}>{t('qibla.distance')}</Text>
                <Text style={styles.statValue}>
                  {distance === null ? '—' : `${Math.round(distance)} km`}
                </Text>
              </View>
            </View>

            <View style={styles.turnCard}>
              <View style={styles.turnIcon}>
                <MaterialCommunityIcons
                  name={Math.abs(relative) <= 4 ? 'check-circle' : 'rotate-3d-variant'}
                  size={22}
                  color={colors.background}
                />
              </View>
              <View style={styles.turnCopy}>
                <Text style={styles.turnTitle}>{turnDirection(relative)}</Text>
                <Text style={styles.turnText}>
                  {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                </Text>
              </View>
            </View>

            <View style={styles.tipCard}>
              <MaterialCommunityIcons
                name="information-outline"
                size={18}
                color={colors.textMuted}
              />
              <Text style={styles.tipText}>{t('qibla.enableSensor')}</Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </ScreenBackground>
  );
}

const createStyles = (colors, isRTL) =>
  StyleSheet.create({
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 18,
      paddingBottom: 30,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.goldSoft,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 8,
      marginBottom: 18,
      maxWidth: 300,
      textAlign: isRTL ? 'right' : 'left',
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
    },
    compassCard: {
      borderRadius: RADIUS.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.borderStrong,
      marginBottom: 16,
      ...SHADOWS.card,
    },
    compassGradient: {
      alignItems: 'center',
      paddingVertical: 22,
      paddingHorizontal: 12,
    },
    compass: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceSoft,
    },
    dial: {
      position: 'absolute',
      top: 0,
      left: 0,
    },
    tick: {
      position: 'absolute',
      borderRadius: 1,
    },
    cardinal: {
      position: 'absolute',
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '700',
      width: 16,
      textAlign: 'center',
    },
    cardinalNorth: {
      color: colors.gold,
    },
    qiblaLayer: {
      position: 'absolute',
      top: 0,
      left: 0,
    },
    qiblaIconWrap: {
      position: 'absolute',
    },
    qiblaNeedle: {
      position: 'absolute',
      width: 2,
      backgroundColor: colors.gold,
      borderRadius: 1,
    },
    compassCenter: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.gold,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    centerLabel: {
      color: colors.gold,
      fontSize: 7,
      fontWeight: '800',
      letterSpacing: isRTL ? 0 : 1.2,
      marginTop: 1,
    },
    headingPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSoft,
      borderRadius: RADIUS.pill,
      paddingHorizontal: 12,
      paddingVertical: 7,
      marginTop: 18,
    },
    headingPillText: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '600',
      marginLeft: isRTL ? 0 : 6,
      marginRight: isRTL ? 6 : 0,
      fontVariant: ['tabular-nums'],
    },
    statsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
      marginBottom: 10,
    },
    stat: {
      flex: 1,
      alignItems: 'center',
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: 9,
      letterSpacing: 0.3,
      textAlign: 'center',
    },
    statValue: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      marginTop: 3,
      textAlign: 'center',
    },
    statDivider: {
      width: 1,
      height: 36,
      backgroundColor: colors.border,
    },
    turnCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.primary,
      padding: 13,
      marginBottom: 10,
    },
    turnIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: isRTL ? 0 : 12,
      marginLeft: isRTL ? 12 : 0,
    },
    turnCopy: {
      flex: 1,
    },
    turnTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
      textAlign: isRTL ? 'right' : 'left',
    },
    turnText: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
      textAlign: isRTL ? 'right' : 'left',
    },
    tipCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.surfaceSoft,
      borderRadius: RADIUS.md,
      padding: 13,
    },
    tipText: {
      flex: 1,
      color: colors.textFaint,
      fontSize: 10,
      lineHeight: 16,
      marginLeft: isRTL ? 0 : 8,
      marginRight: isRTL ? 8 : 0,
      textAlign: isRTL ? 'right' : 'left',
    },
    errorCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      alignItems: 'center',
      marginBottom: 12,
    },
    errorTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '700',
      marginTop: 10,
    },
    errorText: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 18,
      marginTop: 6,
      marginBottom: 14,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: RADIUS.pill,
      paddingHorizontal: 22,
      paddingVertical: 11,
    },
    primaryButtonText: {
      color: colors.background,
      fontSize: 13,
      fontWeight: '700',
    },
    pressed: {
      opacity: 0.72,
    },
    loadingCard: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 30,
    },
    loadingText: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 12,
    },
  });
