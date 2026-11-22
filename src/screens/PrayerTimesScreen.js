import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { computePrayerTimes, formatTime } from '../prayerTimes';
import { useSettings } from '../SettingsContext';
import { useTheme } from '../ThemeContext';
import { useI18n } from '../i18n';
import {
  getClockInTimeZone,
  getDatePartsInTimeZone,
  getDeviceTimeZone,
  getTimeZoneOffset,
  locationLabel as formatLocationLabel,
} from '../location';
import {
  cancelPrayerNotifications,
  schedulePrayerNotifications,
} from '../notifications';
import ScreenBackground from '../components/ScreenBackground';
import ThemeToggle from '../components/ThemeToggle';
import NextPrayerRing from '../components/NextPrayerRing';
import DailyAyahCard from '../components/DailyAyahCard';
import TasbihModal from '../components/TasbihModal';
import { successHaptic, tapHaptic } from '../utils/haptics';
import { RADIUS, SHADOWS } from '../theme';

const PRAYER_META = {
  fajr: { icon: 'weather-sunset-up' },
  sunrise: { icon: 'weather-sunset-up' },
  dhuhr: { icon: 'white-balance-sunny' },
  asr: { icon: 'weather-sunny' },
  sunset: { icon: 'weather-sunset-down' },
  maghrib: { icon: 'weather-sunset-down' },
  isha: { icon: 'weather-night' },
};

const PRAYER_ROWS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const NEXT_ORDER = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

function getNextPrayer(times, current) {
  if (!times) return null;

  for (const key of NEXT_ORDER) {
    const value = times[key];
    if (Number.isFinite(value) && value > current) {
      const remaining = value - current;
      return {
        key,
        time: value,
        seconds: Math.max(0, Math.round(remaining * 3600)),
        minutes: Math.max(1, Math.round(remaining * 60)),
        tomorrow: false,
      };
    }
  }

  const fajr = times.fajr;
  if (!Number.isFinite(fajr)) return null;

  const remaining = 24 - current + fajr;
  return {
    key: 'fajr',
    time: fajr,
    seconds: Math.max(0, Math.round(remaining * 3600)),
    minutes: Math.max(1, Math.round(remaining * 60)),
    tomorrow: true,
  };
}

// Share of the current "between two prayers" window that has already elapsed,
// used to fill the progress ring around the live countdown.
function getWindowProgress(times, next, current) {
  if (!times || !next) return 0;

  const index = NEXT_ORDER.indexOf(next.key);
  let previous;
  if (next.tomorrow) {
    // isha today -> fajr tomorrow
    previous = times.isha;
  } else if (index === 0) {
    // isha yesterday -> fajr today
    previous = times.isha - 24;
  } else {
    previous = times[NEXT_ORDER[index - 1]];
  }

  const total = next.time - previous;
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.min(1, Math.max(0, (current - previous) / total));
}

// Live countdown: 07:12 when under an hour, 2:07:12 above.
function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatHijriDate(date, timeZone, locale) {
  try {
    return new Intl.DateTimeFormat(`${locale}-u-ca-islamic-umalqura`, {
      timeZone,
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch (e) {
    try {
      return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
        timeZone,
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(date);
    } catch (fallbackError) {
      return null;
    }
  }
}

function PrayerRow({
  timeKey,
  value,
  isNext,
  isLast,
  styles,
  colors,
  t,
  adhanOn,
  adhanOffset,
  onToggleAdhan,
  adjustOpen,
  onToggleAdjust,
}) {
  const meta = PRAYER_META[timeKey];
  const adhanTime =
    adhanOn && adhanOffset ? formatTime(value + adhanOffset / 60) : null;

  return (
    <View style={[styles.prayerRow, isNext && styles.prayerRowNext, isLast && !adjustOpen && styles.prayerRowLast]}>
      <View style={[styles.prayerIcon, isNext && styles.prayerIconNext]}>
        <MaterialCommunityIcons
          name={meta.icon}
          size={20}
          color={isNext ? colors.background : colors.primary}
        />
      </View>
      <View style={styles.prayerBody}>
        <View style={styles.prayerNameRow}>
          <Text style={[styles.prayerName, isNext && styles.prayerNameNext]}>
            {t(`prayer.name.${timeKey}`)}
          </Text>
          {isNext ? (
            <View style={styles.nextPill}>
              <Text style={styles.nextPillText}>{t('common.next').toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.prayerHint}>{t(`prayer.hint.${timeKey}`)}</Text>
      </View>
      <View style={styles.prayerEnd}>
        <View style={styles.prayerTimeRow}>
          <Pressable
            onPress={onToggleAdjust}
            hitSlop={6}
            style={({ pressed }) => [styles.timeTouch, pressed && styles.pressed]}
            accessibilityLabel={`${t('prayer.adjust')} ${t(`prayer.name.${timeKey}`)}`}
          >
            <MaterialCommunityIcons
              name="clock-edit-outline"
              size={13}
              color={adjustOpen ? colors.primary : colors.textFaint}
            />
            <Text
              style={[
                styles.prayerTime,
                isNext && styles.prayerTimeNext,
                adjustOpen && styles.prayerTimeOpen,
              ]}
            >
              {formatTime(value)}
            </Text>
          </Pressable>
          <Pressable
            onPress={onToggleAdhan}
            hitSlop={8}
            style={({ pressed }) => [styles.adhanBell, pressed && styles.pressed]}
            accessibilityLabel={`${t('settings.adhanToggle')} ${t(`prayer.name.${timeKey}`)}`}
          >
            <MaterialCommunityIcons
              name={adhanOn ? 'bell-ring-outline' : 'bell-off-outline'}
              size={16}
              color={adhanOn ? colors.gold : colors.textFaint}
            />
          </Pressable>
        </View>
        {adhanTime ? (
          <Text style={styles.adhanShifted}>{t('prayer.adhanAt', { time: adhanTime })}</Text>
        ) : null}
      </View>
    </View>
  );
}

function TimeAdjustPanel({ value, formatted, onChange, onReset, onDone, styles, colors, t }) {
  const label =
    value === 0 ? '0 min' : `${value > 0 ? '+' : '−'}${Math.abs(value)} min`;
  const steps = [-60, -5, -1, 1, 5, 60];

  return (
    <View style={styles.adjustPanel}>
      <View style={styles.adjustHeader}>
        <MaterialCommunityIcons name="clock-edit-outline" size={14} color={colors.primary} />
        <Text style={styles.adjustTitle}>{t('prayer.adjust')}</Text>
        <View style={styles.adjustValueChip}>
          <Text style={styles.adjustValueText}>{label}</Text>
        </View>
      </View>
      <Text style={styles.adjustTimeBig}>{formatted}</Text>
      <View style={styles.adjustRow}>
        {steps.map((step) => (
          <Pressable
            key={step}
            onPress={() => onChange(step)}
            style={({ pressed }) => [
              styles.adjustBtn,
              Math.abs(step) === 60 && styles.adjustBtnWide,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.adjustBtnText,
                Math.abs(step) === 60 && styles.adjustBtnTextWide,
              ]}
            >
              {step > 0 ? '+' : '−'}
              {Math.abs(step) === 60 ? '1h' : Math.abs(step)}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.adjustActions}>
        <Pressable
          onPress={onReset}
          style={({ pressed }) => [styles.adjustReset, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="restart" size={15} color={colors.text} />
          <Text style={styles.adjustResetText}>{t('common.reset')}</Text>
        </Pressable>
        <Pressable
          onPress={onDone}
          style={({ pressed }) => [styles.adjustDone, pressed && styles.pressed]}
        >
          <Text style={styles.adjustDoneText}>{t('prayer.adjustDone')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function PrayerTimesScreen({ navigation }) {
  const { settings, updateSettings } = useSettings();
  const { colors, gradients } = useTheme();
  const { t, locale, isRTL } = useI18n();
  const insets = useSafeAreaInsets();
  const [location, setLocation] = useState(null);
  const [place, setPlace] = useState(null);
  const [error, setError] = useState(null);
  // refreshing removed (no pull-to-refresh)
  const [now, setNow] = useState(new Date());
  const [adjustKey, setAdjustKey] = useState(null);
  const [tasbihOpen, setTasbihOpen] = useState(false);
  const arrivalRef = useRef(null);

  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);

  // 1s tick keeps the countdown and the ring genuinely live.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const manualLocation = settings.manualLocation;

  const load = useCallback(async () => {
    setError(null);

    // If manual location is set, use it
    if (manualLocation) {
      setLocation({
        latitude: manualLocation.latitude,
        longitude: manualLocation.longitude,
      });
      setPlace({ city: manualLocation.city, country: manualLocation.country });
      return;
    }

    // Check if we have a cached GPS location
    if (settings.gpsLocation) {
      setLocation({
        latitude: settings.gpsLocation.latitude,
        longitude: settings.gpsLocation.longitude,
      });
      setPlace(settings.gpsLocation.place || null);
      return;
    }

    try {
      // Check permission status first without prompting
      const { status: currentStatus } = await Location.getForegroundPermissionsAsync();
      let status = currentStatus;
      if (status !== 'granted') {
        const requested = await Location.requestForegroundPermissionsAsync();
        status = requested.status;
      }
      if (status !== 'granted') {
        setError(t('prayer.permission'));
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

      try {
        const results = await Location.reverseGeocodeAsync({
          latitude: nextLocation.latitude,
          longitude: nextLocation.longitude,
        });
        const nextPlace = results && results[0] ? results[0] : null;
        setPlace(nextPlace);

      // Cache the GPS location so it persists across app restarts
      updateSettings({
        gpsLocation: {
          latitude: nextLocation.latitude,
          longitude: nextLocation.longitude,
          place: nextPlace,
        },
      });
      } catch (e) {
        setPlace(null);
      }
    } catch (e) {
      setError(String(e.message || e));
    }
  }, [manualLocation, settings.gpsLocation, t, updateSettings]);

  useEffect(() => {
    load();
  }, [load]);

  // onRefresh removed (no pull-to-refresh)

  const timeZone = manualLocation?.timeZone || getDeviceTimeZone();

  // The astronomy is only recomputed when the calendar day changes,
  // not on every 1s tick of the countdown.
  const dayStamp = useMemo(() => {
    const parts = getDatePartsInTimeZone(timeZone, now);
    return `${parts.year}-${parts.month}-${parts.day}`;
  }, [timeZone, now]);

  const times = useMemo(() => {
    if (!location) return null;
    const dateParts = getDatePartsInTimeZone(timeZone, now);
    return computePrayerTimes({
      date: dateParts,
      lat: location.latitude,
      lng: location.longitude,
      utcOffset: getTimeZoneOffset(timeZone, now),
      method: settings.method,
      asr: settings.asr,
      highLatRule: settings.highLatRule,
      adjustments: settings.adjustments,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, dayStamp, settings, timeZone]);

  const currentHour = getClockInTimeZone(timeZone, now);
  const next = useMemo(() => getNextPrayer(times, currentHour), [times, currentHour]);
  const locationName = formatLocationLabel(place, t('common.currentLocation'));

  useEffect(() => {
    if (!settings.adhanEnabled) {
      cancelPrayerNotifications().catch(() => {});
    }
  }, [settings.adhanEnabled]);

  useEffect(() => {
    if (!settings.adhanEnabled || !times || !location) return;
    schedulePrayerNotifications({
      location,
      settings,
      locationName,
      timeZone,
    }).catch(() => {});
  }, [times, location, settings, locationName, timeZone]);

  // Quick per-prayer adhan switch right on the prayer list.
  const toggleAdhanFor = (key) => {
    const isOn = settings.adhanEnabled && !(settings.adhanPrayers?.[key] === false);
    if (isOn) {
      updateSettings({ adhanPrayers: { ...(settings.adhanPrayers || {}), [key]: false } });
      return;
    }
    const next = { ...(settings.adhanPrayers || {}), [key]: true };
    if (!settings.adhanEnabled) {
      // Master adhan was off: turn it on but keep only this prayer ringing,
      // so each bell behaves like an independent switch.
      for (const k of PRAYER_ROWS) {
        if (k !== key) next[k] = false;
      }
      updateSettings({ adhanEnabled: true, adhanPrayers: next });
    } else {
      updateSettings({ adhanPrayers: next });
    }
  };

  // Manual time correction: the user decides the final displayed time,
  // shifting any prayer by whole minutes (±1h buttons cover hours).
  const setAdjustment = (key, value) => {
    const next = Math.max(-180, Math.min(180, Math.round(value)));
    updateSettings({ adjustments: { ...(settings.adjustments || {}), [key]: next } });
  };

  const gregorianDate = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }).format(now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayStamp, timeZone, locale]
  );

  const hijriDate = useMemo(
    () => formatHijriDate(now, timeZone, locale),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayStamp, timeZone, locale]
  );
  const nextMeta = next ? PRAYER_META[next.key] : null;

  const ringProgress = useMemo(
    () => getWindowProgress(times, next, currentHour),
    [times, next, currentHour]
  );

  // A gentle success vibration in the last minute before the adhan,
  // once per prayer (not on every re-render).
  useEffect(() => {
    if (!next) return;
    const marker = `${next.key}:${next.tomorrow ? 'tomorrow' : 'today'}`;
    if (next.seconds <= 60) {
      if (arrivalRef.current !== marker) {
        arrivalRef.current = marker;
        successHaptic();
      }
    } else if (next.seconds > 90) {
      arrivalRef.current = null;
    }
  }, [next]);

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
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{t('prayer.greeting')}</Text>
            <Text style={styles.title}>{t('prayer.title')}</Text>
          </View>
          <View style={styles.headerActions}>
            <ThemeToggle style={styles.themeToggleVisible} />
          </View>
        </View>

        <View style={styles.locationCard}>
          <View style={styles.locationIcon}>
            <MaterialCommunityIcons name="map-marker" size={18} color={colors.gold} />
          </View>
          <View style={styles.locationCopy}>
            <Text style={styles.locationName} numberOfLines={1}>
              {locationName}
            </Text>
            <Text style={styles.locationDate}>
              {gregorianDate}
              {hijriDate ? `  ·  ${hijriDate}` : ''}
            </Text>
          </View>
          <View style={styles.liveDot} />
        </View>

        <View style={styles.quickActions}>
          <Pressable
            onPress={() => {
              tapHaptic();
              setTasbihOpen(true);
            }}
            style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="counter" size={18} color={colors.primary} />
            <Text style={styles.quickActionText}>{t('tasbih.title')}</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              tapHaptic();
              navigation.navigate('Quran');
            }}
            style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="book-open-page-variant-outline" size={18} color={colors.gold} />
            <Text style={styles.quickActionText}>{t('tab.quran')}</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              tapHaptic();
              navigation.navigate('Qibla');
            }}
            style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="compass-outline" size={18} color={colors.primary} />
            <Text style={styles.quickActionText}>{t('tab.qibla')}</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <MaterialCommunityIcons name="map-marker-off-outline" size={26} color={colors.gold} />
            <Text style={styles.errorTitle}>{t('common.locationNeeded')}</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              onPress={load}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>{t('common.allowLocation')}</Text>
            </Pressable>
          </View>
        ) : null}

        {!location && !error ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>{t('prayer.finding')}</Text>
          </View>
        ) : null}

        {times && next && nextMeta ? (
          <>
            <LinearGradient
              colors={gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <View style={styles.heroTop}>
                <View style={styles.heroBadge}>
                  <View style={styles.heroBadgeDot} />
                  <Text style={styles.heroBadgeText}>{t('prayer.nextPrayer')}</Text>
                </View>
                <Text style={styles.heroWhen}>
                  {next.tomorrow ? t('common.tomorrow') : t('common.today')}
                </Text>
              </View>

              <View style={styles.heroMain}>
                <View style={styles.heroCopy}>
                  <Text style={styles.heroName}>{t(`prayer.name.${next.key}`)}</Text>
                  <Text style={styles.heroTime}>{formatTime(next.time)}</Text>
                  <Text style={styles.heroHint}>{t('prayer.begin')}</Text>
                </View>
                <NextPrayerRing
                  size={104}
                  strokeWidth={5}
                  progress={ringProgress}
                  color={colors.primary}
                  trackColor={colors.borderStrong}
                >
                  <View style={styles.countdownInner}>
                    <Text style={styles.countdownValue}>{formatClock(next.seconds)}</Text>
                    <Text style={styles.countdownLabel}>{t('common.remaining')}</Text>
                  </View>
                </NextPrayerRing>
              </View>

              <View style={styles.heroFooter}>
                <MaterialCommunityIcons name="mosque" size={16} color={colors.gold} />
                <Text style={styles.heroFooterText}>
                  {settings.method} ·{' '}
                  {settings.asr === 'hanafi' ? t('prayer.asrHanafi') : t('prayer.asrStandard')}
                </Text>
              </View>
            </LinearGradient>

            <DailyAyahCard date={now} />

            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>{t('prayer.todayPrayers')}</Text>
              <Text style={styles.sectionMeta}>
                {formatTime(times.sunrise)} {t('prayer.name.sunrise')}
              </Text>
            </View>

            <View style={styles.card}>
              {PRAYER_ROWS.map((key, index) => {
                const adjustValue = Number(settings.adjustments?.[key]) || 0;
                const isOpen = adjustKey === key;
                return (
                  <React.Fragment key={key}>
                    <PrayerRow
                      timeKey={key}
                      value={times[key]}
                      isNext={next.key === key}
                      isLast={index === PRAYER_ROWS.length - 1}
                      styles={styles}
                      colors={colors}
                      t={t}
                      adhanOn={
                        settings.adhanEnabled && !(settings.adhanPrayers?.[key] === false)
                      }
                      adhanOffset={Number(settings.adhanOffsets?.[key]) || 0}
                      onToggleAdhan={() => toggleAdhanFor(key)}
                      adjustOpen={isOpen}
                      onToggleAdjust={() => setAdjustKey(isOpen ? null : key)}
                    />
                    {isOpen ? (
                      <TimeAdjustPanel
                        value={adjustValue}
                        formatted={formatTime(times[key])}
                        onChange={(delta) => setAdjustment(key, adjustValue + delta)}
                        onReset={() => setAdjustment(key, 0)}
                        onDone={() => setAdjustKey(null)}
                        styles={styles}
                        colors={colors}
                        t={t}
                      />
                    ) : null}
                  </React.Fragment>
                );
              })}
            </View>

            <View style={styles.sunCard}>
              <View style={styles.sunItem}>
                <View style={styles.sunIcon}>
                  <MaterialCommunityIcons name="weather-sunset-up" size={19} color={colors.gold} />
                </View>
                <View>
                  <Text style={styles.sunLabel}>{t('prayer.name.sunrise')}</Text>
                  <Text style={styles.sunTime}>{formatTime(times.sunrise)}</Text>
                </View>
              </View>
              <View style={styles.sunDivider} />
              <View style={styles.sunItem}>
                <View style={styles.sunIcon}>
                  <MaterialCommunityIcons name="weather-sunset-down" size={19} color={colors.gold} />
                </View>
                <View>
                  <Text style={styles.sunLabel}>{t('prayer.name.sunset')}</Text>
                  <Text style={styles.sunTime}>{formatTime(times.sunset)}</Text>
                </View>
              </View>
            </View>

            <Pressable
              onPress={() => navigation.navigate('Qibla')}
              style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
            >
              <View style={styles.quickIcon}>
                <MaterialCommunityIcons name="compass" size={24} color={colors.background} />
              </View>
              <View style={styles.quickCopy}>
                <Text style={styles.quickTitle}>{t('prayer.qiblaTitle')}</Text>
                <Text style={styles.quickText}>{t('prayer.qiblaText')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('Settings')}
              style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
            >
              <View style={[styles.quickIcon, styles.quickIconSoft]}>
                <MaterialCommunityIcons name="cog-outline" size={23} color={colors.primary} />
              </View>
              <View style={styles.quickCopy}>
                <Text style={styles.quickTitle}>{t('prayer.settingsTitle')}</Text>
                <Text style={styles.quickText}>{t('prayer.settingsText')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
            </Pressable>
          </>
        ) : null}

        <Text style={styles.footer}>{t('prayer.footer')}</Text>
      </ScrollView>

      <TasbihModal visible={tasbihOpen} onClose={() => setTasbihOpen(false)} />
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
      marginBottom: 18,
    },
    headerCopy: {
      flex: 1,
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
      textAlign: isRTL ? 'right' : 'left',
    },
    title: {
      color: colors.text,
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: -0.4,
      textAlign: isRTL ? 'right' : 'left',
    },
    iconButton: {
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
      opacity: 0.72,
    },
    themeToggleVisible: {
      transform: [{ scale: 1.15 }],
    },
    locationCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSoft,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 16,
    },
    locationIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.goldSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: isRTL ? 0 : 10,
      marginLeft: isRTL ? 10 : 0,
    },
    locationCopy: {
      flex: 1,
    },
    locationName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      textAlign: isRTL ? 'right' : 'left',
    },
    locationDate: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 2,
      textAlign: isRTL ? 'right' : 'left',
    },
    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    quickActions: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    quickAction: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 11,
      borderRadius: RADIUS.pill,
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickActionText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
    },
    hero: {
      borderRadius: RADIUS.lg,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      marginBottom: 22,
      ...SHADOWS.card,
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.goldSoft,
      borderRadius: RADIUS.pill,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    heroBadgeDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.gold,
      marginRight: 6,
    },
    heroBadgeText: {
      color: colors.gold,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: isRTL ? 0 : 1.4,
    },
    heroWhen: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },
    heroMain: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroCopy: {
      flex: 1,
      paddingRight: isRTL ? 0 : 10,
      paddingLeft: isRTL ? 10 : 0,
    },
    heroName: {
      color: colors.text,
      fontSize: 32,
      fontWeight: '700',
      letterSpacing: -0.5,
      textAlign: isRTL ? 'right' : 'left',
    },
    heroTime: {
      color: colors.gold,
      fontSize: 36,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.8,
      marginTop: 2,
      textAlign: isRTL ? 'right' : 'left',
    },
    heroHint: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 6,
      textAlign: isRTL ? 'right' : 'left',
    },
    countdownInner: {
      width: 86,
      height: 86,
      borderRadius: 43,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: 'rgba(0,0,0,0.16)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    countdownValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.4,
    },
    countdownLabel: {
      color: colors.textMuted,
      fontSize: 9,
      marginTop: 1,
      letterSpacing: 0.5,
    },
    heroFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: 16,
      paddingTop: 12,
    },
    heroFooterText: {
      color: colors.textMuted,
      fontSize: 11,
      marginLeft: isRTL ? 0 : 7,
      marginRight: isRTL ? 7 : 0,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
      paddingHorizontal: 2,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
    sectionMeta: {
      color: colors.textFaint,
      fontSize: 11,
    },
    card: {
      backgroundColor: colors.surfaceSoft,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      marginBottom: 14,
    },
    prayerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    prayerRowNext: {
      backgroundColor: colors.primarySoft,
    },
    prayerRowLast: {
      borderBottomWidth: 0,
    },
    prayerIcon: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: isRTL ? 0 : 12,
      marginLeft: isRTL ? 12 : 0,
      overflow: 'hidden',
    },
    prayerIconNext: {
      backgroundColor: colors.primary,
    },
    prayerBody: {
      flex: 1,
    },
    prayerNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    prayerName: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    prayerNameNext: {
      color: colors.text,
    },
    nextPill: {
      backgroundColor: colors.primary,
      borderRadius: RADIUS.pill,
      paddingHorizontal: 7,
      paddingVertical: 2,
      marginLeft: isRTL ? 0 : 7,
      marginRight: isRTL ? 7 : 0,
    },
    nextPillText: {
      color: colors.background,
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: isRTL ? 0 : 0.7,
    },
    prayerHint: {
      color: colors.textFaint,
      fontSize: 11,
      marginTop: 2,
      textAlign: isRTL ? 'right' : 'left',
    },
    prayerTime: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
    },
    prayerTimeNext: {
      color: colors.primary,
      fontWeight: '700',
    },
    prayerEnd: {
      alignItems: 'flex-end',
    },
    prayerTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    adhanBell: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    adhanShifted: {
      color: colors.gold,
      fontSize: 9.5,
      fontWeight: '700',
      marginTop: 3,
      fontVariant: ['tabular-nums'],
    },
    timeTouch: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 2,
      paddingHorizontal: 3,
      borderRadius: 6,
    },
    prayerTimeOpen: {
      color: colors.primary,
    },
    adjustPanel: {
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    adjustHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    adjustTitle: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
      flex: 1,
      textAlign: isRTL ? 'right' : 'left',
    },
    adjustValueChip: {
      backgroundColor: colors.goldSoft,
      borderRadius: RADIUS.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    adjustValueText: {
      color: colors.gold,
      fontSize: 10.5,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    adjustTimeBig: {
      color: colors.text,
      fontSize: 26,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      textAlign: 'center',
      marginBottom: 10,
    },
    adjustRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 5,
      marginBottom: 10,
    },
    adjustBtn: {
      flex: 1,
      height: 34,
      borderRadius: RADIUS.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    adjustBtnWide: {
      flex: 1.3,
    },
    adjustBtnText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    adjustBtnTextWide: {
      fontSize: 12,
    },
    adjustActions: {
      flexDirection: 'row',
      gap: 8,
    },
    adjustReset: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      height: 36,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    adjustResetText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
    },
    adjustDone: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      height: 36,
      borderRadius: RADIUS.md,
      backgroundColor: colors.primary,
    },
    adjustDoneText: {
      color: colors.background,
      fontSize: 12,
      fontWeight: '800',
    },
    sunCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSoft,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 13,
      paddingHorizontal: 14,
      marginBottom: 14,
    },
    sunItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    sunIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.goldSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: isRTL ? 0 : 9,
      marginLeft: isRTL ? 9 : 0,
      overflow: 'hidden',
    },
    sunLabel: {
      color: colors.textMuted,
      fontSize: 10,
    },
    sunTime: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
      marginTop: 1,
    },
    sunDivider: {
      width: 1,
      height: 34,
      backgroundColor: colors.border,
      marginHorizontal: 10,
    },
    quickCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSoft,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 13,
      marginBottom: 10,
    },
    quickIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: isRTL ? 0 : 12,
      marginLeft: isRTL ? 12 : 0,
    },
    quickIconSoft: {
      backgroundColor: colors.primarySoft,
    },
    quickCopy: {
      flex: 1,
    },
    quickTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      textAlign: isRTL ? 'right' : 'left',
    },
    quickText: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 2,
      textAlign: isRTL ? 'right' : 'left',
    },
    errorCard: {
      backgroundColor: colors.surfaceSoft,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      alignItems: 'center',
      marginBottom: 16,
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
    loadingCard: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    loadingText: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 12,
    },
    footer: {
      color: colors.textFaint,
      fontSize: 10,
      textAlign: 'center',
      marginTop: 10,
    },
  });
