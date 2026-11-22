import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { METHODS, ASR_METHODS, HIGH_LAT_RULES } from '../prayerTimes';
import { useSettings } from '../SettingsContext';
import { useAuth } from '../AuthContext';
import { findLocation } from '../location';
import {
  cancelPrayerNotifications,
  getAdhanPermissions,
  openNotificationSettings,
  previewAdhan,
  requestExactAlarmPermission,
  requestNotificationPermission,
  scheduleAdhanTest,
} from '../notifications';
import ScreenBackground from '../components/ScreenBackground';
import ThemeToggle from '../components/ThemeToggle';
import CityPickerModal from '../components/CityPickerModal';
import DeveloperSignature from '../components/DeveloperSignature';
import {
  cityToManualLocation,
  clearSelectedCity,
  saveSelectedCity,
} from '../services/cityService';
import { useTheme } from '../ThemeContext';
import { useI18n, translate, LANGUAGES } from '../i18n';
import { RADIUS, SHADOWS } from '../theme';

function OptionRow({ label, selected, onPress, styles, colors }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionRow,
        selected && styles.optionRowSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
      <MaterialCommunityIcons
        name={selected ? 'check-circle' : 'circle-outline'}
        size={20}
        color={selected ? colors.primary : colors.textFaint}
      />
    </Pressable>
  );
}

const ADHAN_PRAYER_ICONS = {
  fajr: 'weather-sunset-up',
  dhuhr: 'white-balance-sunny',
  asr: 'weather-sunny',
  maghrib: 'weather-sunset-down',
  isha: 'weather-night',
};

function Section({ title, subtitle, icon, open, onToggle, children, styles, colors }) {  return (
    <View style={styles.sectionCard}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.sectionHeader, pressed && styles.pressed]}
      >
        <View style={styles.sectionIcon}>
          <MaterialCommunityIcons name={icon} size={21} color={colors.primary} />
        </View>
        <View style={styles.sectionCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={22}
          color={colors.textMuted}
        />
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

export default function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const { user, openAuth, signOut, deleteAccount } = useAuth();
  const { colors } = useTheme();
  const { t, isRTL, language, setLanguage } = useI18n();
  const styles = useMemo(() => createStyles(colors, isRTL), [colors, isRTL]);
  const insets = useSafeAreaInsets();
  const [openSection, setOpenSection] = useState('method');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [adhanLoading, setAdhanLoading] = useState(false);
  const [adhanStatus, setAdhanStatus] = useState(null);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  const toggle = (id) => setOpenSection((current) => (current === id ? null : id));

  const changeLanguage = (nextLanguage) => {
    if (nextLanguage === language) return;
    const needsRestart = (language === 'ar') !== (nextLanguage === 'ar');
    setLanguage(nextLanguage);
    if (needsRestart) {
      Alert.alert(
        translate(nextLanguage, 'settings.restartTitle'),
        translate(nextLanguage, 'settings.restartBody')
      );
    }
  };

  const resetSettings = () => {
    Alert.alert(t('settings.resetTitle'), t('settings.resetBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.reset'),
        style: 'destructive',
        onPress: async () => {
          const wasRTL = isRTL;
          setLanguage('en');
          updateSettings({
            method: 'Morocco',
            asr: 'standard',
            highLatRule: 'middle-of-night',
            adjustments: {},
            manualLocation: null,
            adhanEnabled: false,
            adhanPrayers: null,
            adhanOffsets: {},
            theme: 'emerald',
          });
          await clearSelectedCity().catch(() => {});
          await cancelPrayerNotifications().catch(() => {});
          if (wasRTL) {
            Alert.alert(
              translate('en', 'settings.restartTitle'),
              translate('en', 'settings.restartBody')
            );
          } else {
            Alert.alert(translate('en', 'settings.resetDone'));
          }
        },
      },
    ]);
  };

  const applyManualLocation = async () => {
    try {
      setLocationLoading(true);
      setLocationError(null);
      const location = await findLocation(city, country);
      updateSettings({ manualLocation: location });
      setCity(location.city);
      setCountry(location.country);
      clearSelectedCity().catch(() => {});
    } catch (e) {
      setLocationError(t('settings.locationError'));
    } finally {
      setLocationLoading(false);
    }
  };

  const selectDatasetCity = (selectedCity) => {
    setLocationError(null);
    const location = cityToManualLocation(selectedCity, language);
    updateSettings({ manualLocation: location });
    setCity(location.city);
    setCountry(location.country);
    saveSelectedCity(selectedCity.id).catch(() => {});
    setCityPickerOpen(false);
  };

  const useGpsLocation = () => {
    setLocationError(null);
    updateSettings({ manualLocation: null });
    clearSelectedCity().catch(() => {});
  };

  const toggleAdhan = async (value) => {
    if (!value) {
      updateSettings({ adhanEnabled: false });
      await cancelPrayerNotifications().catch(() => {});
      return;
    }

    try {
      setAdhanLoading(true);
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          t('settings.notificationsDisabledTitle'),
          t('settings.notificationsDisabledBody'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('settings.openSettings'),
              onPress: () => {
                openNotificationSettings();
              },
            },
          ]
        );
        return;
      }

      updateSettings({ adhanEnabled: true });

      // Exact alarms guarantee the adhan fires on the minute (Doze-proof).
      const exact = await requestExactAlarmPermission();
      if (!exact) {
        Alert.alert(
          t('settings.exactAlarmTitle'),
          t('settings.exactAlarmBody'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('settings.openSettings'),
              onPress: () => {
                openNotificationSettings();
              },
            },
          ]
        );
      }
    } catch (e) {
      Alert.alert(
        t('settings.notificationsUnavailable'),
        t('settings.notificationsUnavailableBody')
      );
    } finally {
      setAdhanLoading(false);
    }
  };

  const setAdhanOffset = (prayerKey, value) => {
    const clamped = Math.max(-60, Math.min(60, Math.round(value) || 0));
    const next = { ...(settings.adhanOffsets || {}) };
    if (clamped === 0) {
      delete next[prayerKey];
    } else {
      next[prayerKey] = clamped;
    }
    updateSettings({ adhanOffsets: next });
  };

  const playPreview = async (kind = 'regular') => {
    const ok = await previewAdhan(kind);
    if (!ok) {
      Alert.alert(t('settings.previewFailedTitle'), t('settings.previewFailedBody'));
    }
  };

  const refreshAdhanStatus = async () => {
    try {
      setAdhanStatus(await getAdhanPermissions());
    } catch (e) {
      setAdhanStatus(null);
    }
  };

  useEffect(() => {
    refreshAdhanStatus();
    // Refresh when coming back from the system settings / notification shade.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshAdhanStatus();
    });
    return () => subscription.remove();
  }, [settings.adhanEnabled]);

  const fixAdhanPermissions = async () => {
    try {
      setAdhanLoading(true);
      const granted = await requestNotificationPermission();
      if (granted) {
        await requestExactAlarmPermission();
      } else {
        await openNotificationSettings();
      }
    } catch (e) {
      // ignore — the status row simply stays visible
    } finally {
      setAdhanLoading(false);
      refreshAdhanStatus();
    }
  };

  const testNotification = async () => {
    const result = await scheduleAdhanTest();
    if (result.ok) {
      Alert.alert(t('settings.testScheduledTitle'), t('settings.testScheduledBody'));
      return;
    }
    if (result.reason === 'permission') {
      Alert.alert(
        t('settings.notificationsDisabledTitle'),
        t('settings.notificationsDisabledBody'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('settings.openSettings'),
            onPress: () => {
              openNotificationSettings();
            },
          },
        ]
      );
      return;
    }
    Alert.alert(t('settings.testFailedTitle'), t('settings.testFailedBody'));
  };

  const languageLabel =
    LANGUAGES.find((item) => item.id === language)?.label || language.toUpperCase();
  const themeLabel =
    settings.theme === 'gold'
      ? t('settings.themeGold')
      : settings.theme === 'light'
      ? t('settings.themeLight')
      : t('settings.themeEmerald');
  const locationLabel = settings.manualLocation
    ? `${settings.manualLocation.city}, ${settings.manualLocation.country}`
    : t('settings.currentGps');

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
            <Text style={styles.eyebrow}>{t('settings.eyebrow')}</Text>
            <Text style={styles.title}>{t('settings.title')}</Text>
          </View>
          <View style={styles.headerActions}>
            <ThemeToggle />
            <View style={styles.headerIcon}>
              <MaterialCommunityIcons name="cog-outline" size={22} color={colors.gold} />
            </View>
          </View>
        </View>

        <Text style={styles.subtitle}>{t('settings.subtitle')}</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <Text style={styles.summaryTitle}>{t('settings.currentSetup')}</Text>
            <View style={styles.summaryBadge}>
              <View style={styles.summaryBadgeDot} />
              <Text style={styles.summaryBadgeText}>{t('settings.active')}</Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('settings.summary.method')}</Text>
            <Text style={styles.summaryValue} numberOfLines={1}>
              {METHODS[settings.method]?.name || settings.method}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('settings.summary.asr')}</Text>
            <Text style={styles.summaryValue}>
              {ASR_METHODS[settings.asr]?.name || settings.asr}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('settings.summary.highLat')}</Text>
            <Text style={styles.summaryValue}>
              {t(`settings.highLat.${settings.highLatRule}`)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('settings.summary.location')}</Text>
            <Text style={styles.summaryValue} numberOfLines={1}>
              {locationLabel}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('settings.summary.language')}</Text>
            <Text style={styles.summaryValue}>{languageLabel}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('settings.summary.theme')}</Text>
            <Text style={styles.summaryValue}>{themeLabel}</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryRowLast]}>
            <Text style={styles.summaryLabel}>{t('settings.summary.adhan')}</Text>
            <Text style={[styles.summaryValue, settings.adhanEnabled && styles.summaryValueOn]}>
              {settings.adhanEnabled ? t('settings.adhanOn') : t('settings.adhanOff')}
            </Text>
          </View>
        </View>

        <Text style={styles.groupLabel}>{t('settings.group.account')}</Text>

        <View style={styles.accountCard}>
          <View style={styles.accountRow}>
            <View style={[styles.accountAvatar, user && styles.accountAvatarOn]}>
              <MaterialCommunityIcons
                name={user ? 'account-check-outline' : 'account-outline'}
                size={21}
                color={user ? colors.background : colors.primary}
              />
            </View>
            <View style={styles.accountCopy}>
              <Text style={styles.accountTitle} numberOfLines={1}>
                {user ? user.name || user.email : t('auth.accountGuestTitle')}
              </Text>
              <Text style={styles.accountText} numberOfLines={1}>
                {user
                  ? `${user.email || ''} · ${t(`auth.provider.${user.provider || 'local'}`)}`
                  : t('auth.accountGuestSubtitle')}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={user ? signOut : openAuth}
            style={({ pressed }) => [
              styles.accountButton,
              user && styles.accountButtonGhost,
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons
              name={user ? 'logout' : 'login-variant'}
              size={15}
              color={user ? colors.primary : colors.background}
            />
            <Text style={[styles.accountButtonText, user && styles.accountButtonTextGhost]}>
              {user ? t('auth.signOut') : t('auth.signIn')}
            </Text>
          </Pressable>
          {user ? (
            <Pressable
              onPress={() => {
                Alert.alert(
                  t('auth.deleteAccountTitle'),
                  t('auth.deleteAccountBody'),
                  [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                      text: t('auth.deleteAccountConfirm'),
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await deleteAccount();
                        } catch (e) {}
                      },
                    },
                  ]
                );
              }}
              style={({ pressed }) => [styles.accountDeleteButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="delete-outline" size={15} color="#ff6b6b" />
              <Text style={styles.accountDeleteText}>{t('auth.deleteAccount')}</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.groupLabel}>{t('settings.group.prayer')}</Text>

        <Section
          title={t('settings.method')}
          subtitle={t('settings.methodSubtitle')}
          icon="mosque"
          open={openSection === 'method'}
          onToggle={() => toggle('method')}
          styles={styles}
          colors={colors}
        >
          {Object.keys(METHODS).map((key) => (
            <OptionRow
              key={key}
              label={METHODS[key].name}
              selected={settings.method === key}
              onPress={() => updateSettings({ method: key })}
              styles={styles}
              colors={colors}
            />
          ))}
          <Text style={styles.sectionNote}>{t('settings.methodNote')}</Text>
        </Section>

        <Section
          title={t('settings.asr')}
          subtitle={t('settings.asrSubtitle')}
          icon="weather-sunset"
          open={openSection === 'asr'}
          onToggle={() => toggle('asr')}
          styles={styles}
          colors={colors}
        >
          {Object.keys(ASR_METHODS).map((key) => (
            <OptionRow
              key={key}
              label={ASR_METHODS[key].name}
              selected={settings.asr === key}
              onPress={() => updateSettings({ asr: key })}
              styles={styles}
              colors={colors}
            />
          ))}
        </Section>

        <Section
          title={t('settings.highLat')}
          subtitle={t('settings.highLatSubtitle')}
          icon="map-marker-radius-outline"
          open={openSection === 'highLat'}
          onToggle={() => toggle('highLat')}
          styles={styles}
          colors={colors}
        >
          {HIGH_LAT_RULES.map((rule) => (
            <OptionRow
              key={rule}
              label={t(`settings.highLat.${rule}`)}
              selected={settings.highLatRule === rule}
              onPress={() => updateSettings({ highLatRule: rule })}
              styles={styles}
              colors={colors}
            />
          ))}
        </Section>

        <Text style={styles.groupLabel}>{t('settings.group.personal')}</Text>

        <Section
          title={t('settings.location')}
          subtitle={t('settings.locationSubtitle')}
          icon="map-marker-outline"
          open={openSection === 'location'}
          onToggle={() => toggle('location')}
          styles={styles}
          colors={colors}
        >
          <View style={styles.locationCurrent}>
            <MaterialCommunityIcons
              name={settings.manualLocation ? 'map-marker-check' : 'crosshairs-gps'}
              size={18}
              color={colors.primary}
            />
            <View style={styles.locationCurrentCopy}>
              <Text style={styles.locationCurrentTitle}>{locationLabel}</Text>
              <Text style={styles.locationCurrentText}>
                {settings.manualLocation
                  ? `${settings.manualLocation.timeZone} · ${settings.manualLocation.latitude.toFixed(
                      3
                    )}, ${settings.manualLocation.longitude.toFixed(3)}`
                  : t('settings.gpsHelp')}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => setCityPickerOpen(true)}
            style={({ pressed }) => [styles.browseCitiesButton, pressed && styles.pressed]}
          >
            <View style={styles.browseCitiesIcon}>
              <MaterialCommunityIcons name="map-search-outline" size={19} color={colors.gold} />
            </View>
            <View style={styles.browseCitiesCopy}>
              <Text style={styles.browseCitiesTitle}>{t('settings.browseCities')}</Text>
              <Text style={styles.browseCitiesHint}>{t('settings.browseCitiesHint')}</Text>
            </View>
            <MaterialCommunityIcons
              name={isRTL ? 'chevron-left' : 'chevron-right'}
              size={20}
              color={colors.textFaint}
            />
          </Pressable>

          <Text style={styles.fieldLabel}>{t('settings.city')}</Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder={settings.manualLocation?.city || t('settings.cityPlaceholder')}
            placeholderTextColor={colors.textFaint}
            style={styles.fieldInput}
            autoCorrect={false}
          />
          <Text style={styles.fieldLabel}>{t('settings.country')}</Text>
          <TextInput
            value={country}
            onChangeText={setCountry}
            placeholder={settings.manualLocation?.country || t('settings.countryPlaceholder')}
            placeholderTextColor={colors.textFaint}
            style={styles.fieldInput}
            autoCorrect={false}
          />

          {locationError ? <Text style={styles.fieldError}>{locationError}</Text> : null}

          <View style={styles.locationActions}>
            <Pressable
              onPress={useGpsLocation}
              style={({ pressed }) => [styles.softButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="crosshairs-gps" size={17} color={colors.text} />
              <Text style={styles.softButtonText}>{t('settings.useGps')}</Text>
            </Pressable>
            <Pressable
              onPress={applyManualLocation}
              disabled={locationLoading}
              style={({ pressed }) => [
                styles.smallPrimaryButton,
                pressed && styles.pressed,
                locationLoading && styles.disabled,
              ]}
            >
              {locationLoading ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <>
                  <MaterialCommunityIcons name="magnify" size={17} color={colors.background} />
                  <Text style={styles.smallPrimaryButtonText}>{t('settings.findCity')}</Text>
                </>
              )}
            </Pressable>
          </View>
        </Section>

        <Section
          title={t('settings.adhan')}
          subtitle={t('settings.adhanSubtitle')}
          icon="bell-ring-outline"
          open={openSection === 'adhan'}
          onToggle={() => toggle('adhan')}
          styles={styles}
          colors={colors}
        >
          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={styles.switchTitle}>{t('settings.adhanToggle')}</Text>
              <Text style={styles.switchText}>{t('settings.adhanHelp')}</Text>
            </View>
            {adhanLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Switch
                value={settings.adhanEnabled}
                onValueChange={toggleAdhan}
                trackColor={{ false: colors.surfaceSoft, true: colors.primaryDark }}
                thumbColor={settings.adhanEnabled ? colors.primary : colors.textMuted}
              />
            )}
          </View>

          {settings.adhanEnabled ? (
            <View style={styles.adhanPerPrayer}>
              <Text style={styles.adhanPerPrayerTitle}>{t('settings.adhanEachTitle')}</Text>
              <Text style={styles.adhanPerPrayerHint}>{t('settings.adhanEachHint')}</Text>
              {['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map((prayerKey) => {
                const enabledForPrayer = !(settings.adhanPrayers?.[prayerKey] === false);
                const isFajr = prayerKey === 'fajr';
                const rawOffset = Number(settings.adhanOffsets?.[prayerKey]) || 0;
                const offsetLabel =
                  rawOffset === 0
                    ? t('settings.adhanOffsetExact')
                    : `${rawOffset > 0 ? '+' : '−'}${Math.abs(rawOffset)} min`;
                return (
                  <View key={prayerKey} style={styles.adhanPrayerGroup}>
                    <View style={styles.adhanPrayerRow}>
                      <View style={[styles.adhanPrayerIcon, isFajr && styles.adhanPrayerIconFajr]}>
                        <MaterialCommunityIcons
                          name={ADHAN_PRAYER_ICONS[prayerKey]}
                          size={17}
                          color={isFajr ? colors.gold : colors.primary}
                        />
                      </View>
                      <Text style={styles.adhanPrayerLabel}>{t(`prayer.name.${prayerKey}`)}</Text>
                      <Switch
                        value={enabledForPrayer}
                        onValueChange={(nextValue) => {
                          const next = { ...(settings.adhanPrayers || {}) };
                          next[prayerKey] = nextValue;
                          updateSettings({ adhanPrayers: next });
                        }}
                        trackColor={{ false: colors.surfaceSoft, true: colors.primaryDark }}
                        thumbColor={enabledForPrayer ? colors.primary : colors.textMuted}
                      />
                    </View>
                    <View style={styles.adhanOffsetRow}>
                      <Text style={styles.adhanOffsetLabel}>{t('settings.adhanOffsetTitle')}</Text>
                      <Pressable
                        onPress={() => setAdhanOffset(prayerKey, rawOffset - 1)}
                        style={({ pressed }) => [styles.adhanOffsetBtn, pressed && styles.pressed]}
                      >
                        <MaterialCommunityIcons name="minus" size={14} color={colors.text} />
                      </Pressable>
                      <Pressable
                        onPress={() => setAdhanOffset(prayerKey, 0)}
                        style={({ pressed }) => [styles.adhanOffsetReset, pressed && styles.pressed]}
                      >
                        <Text style={styles.adhanOffsetValue}>{offsetLabel}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setAdhanOffset(prayerKey, rawOffset + 1)}
                        style={({ pressed }) => [styles.adhanOffsetBtn, pressed && styles.pressed]}
                      >
                        <MaterialCommunityIcons name="plus" size={14} color={colors.text} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {settings.adhanEnabled
          && adhanStatus
          && (!adhanStatus.notifications || !adhanStatus.exactAlarms) ? (
            <Pressable
              onPress={fixAdhanPermissions}
              style={({ pressed }) => [styles.adhanWarning, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={15}
                color={colors.danger}
              />
              <Text style={styles.adhanWarningText}>{t('settings.adhanWarning')}</Text>
            </Pressable>
          ) : null}

          <View style={styles.adhanActions}>
            <Pressable
              onPress={() => playPreview('regular')}
              style={({ pressed }) => [styles.softButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="play-circle-outline" size={17} color={colors.text} />
              <Text style={styles.softButtonText}>{t('settings.preview')}</Text>
            </Pressable>
            <Pressable
              onPress={() => playPreview('fajr')}
              style={({ pressed }) => [styles.softButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="weather-sunset-up" size={17} color={colors.text} />
              <Text style={styles.softButtonText}>{t('settings.previewFajr')}</Text>
            </Pressable>
            <Pressable
              onPress={testNotification}
              style={({ pressed }) => [styles.softButton, pressed && styles.pressed]}
            >
              <MaterialCommunityIcons name="bell-check-outline" size={17} color={colors.text} />
              <Text style={styles.softButtonText}>{t('settings.testNotification')}</Text>
            </Pressable>
          </View>

          <Text style={styles.adhanNote}>{t('settings.adhanNote')}</Text>
        </Section>

        <Text style={styles.groupLabel}>{t('settings.group.appearance')}</Text>

        <Section
          title={t('settings.language')}
          subtitle={t('settings.languageSubtitle')}
          icon="translate"
          open={openSection === 'language'}
          onToggle={() => toggle('language')}
          styles={styles}
          colors={colors}
        >
          {LANGUAGES.map((item) => (
            <OptionRow
              key={item.id}
              label={item.label}
              selected={language === item.id}
              onPress={() => changeLanguage(item.id)}
              styles={styles}
              colors={colors}
            />
          ))}
        </Section>

        <Section
          title={t('settings.theme')}
          subtitle={t('settings.themeSubtitle')}
          icon="palette-outline"
          open={openSection === 'theme'}
          onToggle={() => toggle('theme')}
          styles={styles}
          colors={colors}
        >
          <OptionRow
            label={t('settings.themeEmerald')}
            selected={settings.theme === 'emerald'}
            onPress={() => updateSettings({ theme: 'emerald' })}
            styles={styles}
            colors={colors}
          />
          <OptionRow
            label={t('settings.themeGold')}
            selected={settings.theme === 'gold'}
            onPress={() => updateSettings({ theme: 'gold' })}
            styles={styles}
            colors={colors}
          />
          <OptionRow
            label={t('settings.themeLight')}
            selected={settings.theme === 'light'}
            onPress={() => updateSettings({ theme: 'light' })}
            styles={styles}
            colors={colors}
          />
        </Section>

        <Text style={styles.groupLabel}>{t('settings.group.about')}</Text>

        <View style={styles.aboutCard}>
          <View style={styles.aboutRow}>
            <View style={styles.aboutIcon}>
              <MaterialCommunityIcons name="information-outline" size={20} color={colors.gold} />
            </View>
            <View style={styles.aboutCopy}>
              <Text style={styles.aboutTitle}>Slati</Text>
              <Text style={styles.aboutText}>{t('settings.aboutText')}</Text>
            </View>
            <Text style={styles.version}>{t('settings.version', { version: '1.0.0' })}</Text>
          </View>
          <View style={styles.aboutDivider} />
          <View style={styles.aboutRow}>
            <View style={styles.aboutIcon}>
              <MaterialCommunityIcons
                name="shield-check-outline"
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={styles.aboutCopy}>
              <Text style={styles.aboutTitle}>{t('settings.privateTitle')}</Text>
              <Text style={styles.aboutText}>{t('settings.privateText')}</Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={resetSettings}
          style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="restore" size={18} color={colors.textMuted} />
          <Text style={styles.resetText}>{t('settings.reset')}</Text>
        </Pressable>

        <Text style={styles.footer}>{t('settings.footer')}</Text>
        <DeveloperSignature />
      </ScrollView>

      <CityPickerModal
        visible={cityPickerOpen}
        onClose={() => setCityPickerOpen(false)}
        onSelect={selectDatasetCity}
        selectedCityId={settings.manualLocation?.cityId || null}
      />
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
      maxWidth: 320,
      textAlign: isRTL ? 'right' : 'left',
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
    },
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 15,
      marginBottom: 16,
      ...SHADOWS.card,
    },
    summaryTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    summaryTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    summaryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: RADIUS.pill,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    summaryBadgeDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.primary,
      marginRight: isRTL ? 0 : 5,
      marginLeft: isRTL ? 5 : 0,
    },
    summaryBadgeText: {
      color: colors.primary,
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: isRTL ? 0 : 0.8,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    summaryRowLast: {
      borderBottomWidth: 0,
      paddingBottom: 2,
    },
    summaryLabel: {
      color: colors.textMuted,
      fontSize: 11,
    },
    summaryValue: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
      maxWidth: '65%',
      textAlign: isRTL ? 'left' : 'right',
    },
    summaryValueOn: {
      color: colors.primary,
    },
    groupLabel: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: isRTL ? 0 : 1.4,
      marginTop: 16,
      marginBottom: 8,
      marginLeft: isRTL ? 0 : 4,
      marginRight: isRTL ? 4 : 0,
      textAlign: isRTL ? 'right' : 'left',
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      marginBottom: 10,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 13,
    },
    sectionIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: isRTL ? 0 : 11,
      marginLeft: isRTL ? 11 : 0,
    },
    sectionCopy: {
      flex: 1,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      textAlign: isRTL ? 'right' : 'left',
    },
    sectionSubtitle: {
      color: colors.textFaint,
      fontSize: 10,
      marginTop: 2,
      textAlign: isRTL ? 'right' : 'left',
    },
    sectionBody: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    sectionNote: {
      color: colors.textFaint,
      fontSize: 9,
      lineHeight: 14,
      paddingHorizontal: 8,
      paddingTop: 4,
      paddingBottom: 6,
      textAlign: isRTL ? 'right' : 'left',
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingVertical: 11,
      borderRadius: RADIUS.sm,
    },
    optionRowSelected: {
      backgroundColor: colors.primarySoft,
    },
    optionLabel: {
      color: colors.textMuted,
      fontSize: 12,
      flex: 1,
      paddingRight: isRTL ? 0 : 10,
      paddingLeft: isRTL ? 10 : 0,
      textAlign: isRTL ? 'right' : 'left',
    },
    optionLabelSelected: {
      color: colors.text,
      fontWeight: '600',
    },
    locationCurrent: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: RADIUS.sm,
      padding: 10,
      marginBottom: 12,
    },
    locationCurrentCopy: {
      flex: 1,
      marginLeft: isRTL ? 0 : 8,
      marginRight: isRTL ? 8 : 0,
    },
    locationCurrentTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
      textAlign: isRTL ? 'right' : 'left',
    },
    locationCurrentText: {
      color: colors.textMuted,
      fontSize: 9,
      marginTop: 2,
      textAlign: isRTL ? 'right' : 'left',
    },
    browseCitiesButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.sm,
      padding: 10,
      marginBottom: 12,
    },
    browseCitiesIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.goldSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: isRTL ? 0 : 9,
      marginLeft: isRTL ? 9 : 0,
    },
    browseCitiesCopy: {
      flex: 1,
    },
    browseCitiesTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
      textAlign: isRTL ? 'right' : 'left',
    },
    browseCitiesHint: {
      color: colors.textFaint,
      fontSize: 9,
      lineHeight: 13,
      marginTop: 2,
      textAlign: isRTL ? 'right' : 'left',
    },
    fieldLabel: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: isRTL ? 0 : 0.8,
      marginBottom: 5,
      marginLeft: isRTL ? 0 : 2,
      marginRight: isRTL ? 2 : 0,
      textAlign: isRTL ? 'right' : 'left',
    },
    fieldInput: {
      height: 42,
      borderRadius: RADIUS.sm,
      backgroundColor: colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      fontSize: 13,
      paddingHorizontal: 11,
      marginBottom: 10,
      textAlign: isRTL ? 'right' : 'left',
    },
    fieldError: {
      color: colors.danger,
      fontSize: 10,
      lineHeight: 15,
      marginBottom: 8,
      textAlign: isRTL ? 'right' : 'left',
    },
    locationActions: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    softButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 40,
      borderRadius: RADIUS.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSoft,
      paddingHorizontal: 12,
      marginRight: isRTL ? 0 : 8,
      marginLeft: isRTL ? 8 : 0,
    },
    softButtonText: {
      color: colors.text,
      fontSize: 11,
      fontWeight: '700',
      marginLeft: isRTL ? 0 : 5,
      marginRight: isRTL ? 5 : 0,
    },
    smallPrimaryButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 40,
      borderRadius: RADIUS.sm,
      backgroundColor: colors.primary,
    },
    smallPrimaryButtonText: {
      color: colors.background,
      fontSize: 12,
      fontWeight: '800',
      marginLeft: isRTL ? 0 : 5,
      marginRight: isRTL ? 5 : 0,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      marginBottom: 10,
    },
    switchCopy: {
      flex: 1,
      paddingRight: isRTL ? 0 : 12,
      paddingLeft: isRTL ? 12 : 0,
    },
    switchTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
      textAlign: isRTL ? 'right' : 'left',
    },
    switchText: {
      color: colors.textMuted,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 3,
      textAlign: isRTL ? 'right' : 'left',
    },
    adhanActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 8,
    },
    adhanPerPrayer: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.sm,
      backgroundColor: colors.surfaceSoft,
      paddingHorizontal: 11,
      paddingTop: 9,
      paddingBottom: 4,
      marginBottom: 10,
    },
    adhanPerPrayerTitle: {
      color: colors.text,
      fontSize: 11,
      fontWeight: '700',
    },
    adhanPerPrayerHint: {
      color: colors.textFaint,
      fontSize: 9,
      lineHeight: 13,
      marginTop: 2,
      marginBottom: 6,
    },
    adhanPrayerGroup: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    adhanPrayerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 5,
    },
    adhanPrayerIcon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginRight: 9,
    },
    adhanPrayerIconFajr: {
      backgroundColor: colors.goldSoft,
    },
    adhanPrayerLabel: {
      flex: 1,
      color: colors.text,
      fontSize: 12,
      fontWeight: '600',
    },
    adhanOffsetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 1,
      marginBottom: 4,
      paddingLeft: 37,
    },
    adhanOffsetLabel: {
      flex: 1,
      color: colors.textFaint,
      fontSize: 9,
      fontWeight: '600',
    },
    adhanOffsetBtn: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 3,
    },
    adhanOffsetReset: {
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    adhanOffsetValue: {
      color: colors.text,
      fontSize: 10,
      fontWeight: '700',
      minWidth: 52,
      textAlign: 'center',
    },
    adhanWarning: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.danger,
      borderRadius: RADIUS.sm,
      paddingVertical: 8,
      paddingHorizontal: 10,
      marginBottom: 10,
    },
    adhanWarningText: {
      flex: 1,
      color: colors.danger,
      fontSize: 10,
      fontWeight: '700',
      lineHeight: 15,
      marginLeft: isRTL ? 0 : 6,
      marginRight: isRTL ? 6 : 0,
      textAlign: isRTL ? 'right' : 'left',
    },
    adhanNote: {
      color: colors.textFaint,
      fontSize: 9,
      lineHeight: 14,
      marginBottom: 4,
      textAlign: isRTL ? 'right' : 'left',
    },
    disabled: {
      opacity: 0.6,
    },
    aboutCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 13,
      marginBottom: 16,
    },
    aboutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
    },
    aboutIcon: {
      width: 36,
      height: 36,
      borderRadius: 11,
      backgroundColor: colors.surfaceSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: isRTL ? 0 : 11,
      marginLeft: isRTL ? 11 : 0,
    },
    aboutCopy: {
      flex: 1,
    },
    aboutTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
      textAlign: isRTL ? 'right' : 'left',
    },
    aboutText: {
      color: colors.textFaint,
      fontSize: 10,
      marginTop: 2,
      lineHeight: 15,
      textAlign: isRTL ? 'right' : 'left',
    },
    version: {
      color: colors.textMuted,
      fontSize: 10,
      fontVariant: ['tabular-nums'],
    },
    aboutDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
    },
    resetButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.pill,
      paddingVertical: 11,
      marginBottom: 14,
    },
    resetText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      marginLeft: isRTL ? 0 : 7,
      marginRight: isRTL ? 7 : 0,
    },
    footer: {
      color: colors.textFaint,
      fontSize: 10,
      textAlign: 'center',
      lineHeight: 15,
    },
    accountCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 13,
      paddingVertical: 13,
      marginBottom: 14,
    },
    accountRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    accountAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: isRTL ? 0 : 11,
      marginLeft: isRTL ? 11 : 0,
    },
    accountAvatarOn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    accountCopy: {
      flex: 1,
    },
    accountTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
      textAlign: isRTL ? 'right' : 'left',
    },
    accountText: {
      color: colors.textFaint,
      fontSize: 11,
      marginTop: 2,
      textAlign: isRTL ? 'right' : 'left',
    },
    accountButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      backgroundColor: colors.primary,
      borderRadius: RADIUS.pill,
      paddingVertical: 10,
      marginTop: 12,
    },
    accountButtonGhost: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    accountButtonText: {
      color: colors.background,
      fontSize: 12.5,
      fontWeight: '700',
    },
    accountButtonTextGhost: {
      color: colors.primary,
    },
    accountDeleteButton: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: 'rgba(255,107,107,0.35)',
      backgroundColor: 'rgba(255,107,107,0.08)',
    },
    accountDeleteText: {
      color: '#ff6b6b',
      fontSize: 13,
      fontWeight: '700',
    },
    pressed: {
      opacity: 0.72,
    },
  });
