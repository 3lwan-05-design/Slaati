import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { computePrayerTimes, formatTime } from './prayerTimes';
import { getDatePartsInTimeZone, getTimeZoneOffset } from './location';
import { translate } from './i18n';

// v2: Android freezes a channel's sound/importance/audio attributes the first
// time it is created. The v1 channels were created with USAGE_NOTIFICATION,
// which plays on the notification stream (quiet, muted in silent mode).
// A new id is the only way to get USAGE_ALARM on devices that already ran v1.
const CHANNEL_ID = 'prayer-adhan-v2';
const FAJR_CHANNEL_ID = 'prayer-adhan-fajr-v2';
const LEGACY_CHANNEL_IDS = ['prayer-adhan', 'prayer-adhan-fajr'];
const ADHAN_SOUND = 'adhan.mp3';
const FAJR_ADHAN_SOUND = 'adhan_fajr.mp3';
const PRAYER_KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const SCHEDULE_STORE_KEY = 'slati.adhanSchedule.v1';
// 30 days x 5 prayers = 150 exact alarms, well under the Android per-app limit.
const SCHEDULE_DAYS = 30;
const SCHEDULE_REFRESH_MS = 6 * 60 * 60 * 1000;

const ADHAN_FILES = {
  regular: require('../assets/sounds/adhan.mp3'),
  fajr: require('../assets/sounds/adhan_fajr.mp3'),
};

let lastScheduleKey = null;
const adhanPlayers = {};

export function configureNotifications() {
  if (Platform.OS === 'web') return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Prayer adhan',
      description: 'Adhan sound at each prayer time',
      importance: Notifications.AndroidImportance.MAX,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: ADHAN_SOUND,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        flags: {
          enforceAudibility: true,
          requestHardwareAudioVideoSynchronization: false,
        },
      },
      vibrationPattern: [0, 400, 300, 400],
      enableVibrate: true,
      enableLights: true,
      lightColor: '#2ec4b6',
      showBadge: false,
      bypassDnd: false,
    }).catch(() => {});

    Notifications.setNotificationChannelAsync(FAJR_CHANNEL_ID, {
      name: 'Fajr adhan',
      description: 'Fajr adhan sound at dawn',
      importance: Notifications.AndroidImportance.MAX,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: FAJR_ADHAN_SOUND,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        flags: {
          enforceAudibility: true,
          requestHardwareAudioVideoSynchronization: false,
        },
      },
      vibrationPattern: [0, 400, 300, 400],
      enableVibrate: true,
      enableLights: true,
      lightColor: '#d8b56b',
      showBadge: false,
      bypassDnd: false,
    }).catch(() => {});
  }
}

export async function getAdhanPermissions() {
  if (Platform.OS === 'web') {
    return { notifications: false, canAskAgain: false, exactAlarms: false };
  }

  const current = await Notifications.getPermissionsAsync();
  let exactAlarms = true;
  if (Platform.OS === 'android') {
    try {
      const exact = await Notifications.getExactAlarmPermissionsAsync();
      exactAlarms = Boolean(exact.granted);
    } catch (e) {
      exactAlarms = false;
    }
  }

  return {
    notifications: Boolean(current.granted),
    canAskAgain: current.canAskAgain !== false,
    exactAlarms,
  };
}

export async function requestNotificationPermission() {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  // Android stops showing the dialog after a permanent denial — retrying is pointless.
  if (current.canAskAgain === false) return false;
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return Boolean(requested.granted);
}

// Exact alarms (Android 12+) are what make the adhan fire on the minute even
// in Doze mode. The app declares USE_EXACT_ALARM so this is granted on install,
// but a user can still revoke it in the system settings.
export async function requestExactAlarmPermission() {
  if (Platform.OS !== 'android') return true;
  try {
    const current = await Notifications.getExactAlarmPermissionsAsync();
    if (current.granted) return true;
    if (current.canAskAgain === false) return false;
    const requested = await Notifications.requestExactAlarmPermissionsAsync();
    return Boolean(requested.granted);
  } catch (e) {
    return false;
  }
}

export async function openNotificationSettings() {
  try {
    await Linking.openSettings();
    return true;
  } catch (e) {
    return false;
  }
}

async function prepareAdhanPlayer(kind = 'regular') {
  const key = kind === 'fajr' ? 'fajr' : 'regular';
  if (!adhanPlayers[key]) {
    adhanPlayers[key] = createAudioPlayer(ADHAN_FILES[key]);
  }
  return adhanPlayers[key];
}

export async function previewAdhan(kind = 'regular') {
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
    const player = await prepareAdhanPlayer(kind);
    await player.seekTo(0);
    player.play();
    return true;
  } catch (e) {
    return false;
  }
}

function addDays(parts, days) {
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0));
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
  };
}

export async function schedulePrayerNotifications({
  location,
  settings,
  locationName,
  timeZone,
  days = SCHEDULE_DAYS,
}) {
  if (Platform.OS === 'web' || !settings.adhanEnabled) {
    return { scheduled: 0, reason: 'disabled' };
  }

  const granted = await requestNotificationPermission();
  if (!granted) return { scheduled: 0, reason: 'permission' };

  const now = new Date();
  const today = getDatePartsInTimeZone(timeZone, now);
  const key = JSON.stringify({
    today,
    lat: location.latitude,
    lng: location.longitude,
    timeZone,
    method: settings.method,
    asr: settings.asr,
    highLatRule: settings.highLatRule,
    adjustments: settings.adjustments,
    adhanPrayers: settings.adhanPrayers || null,
    adhanOffsets: settings.adhanOffsets || null,
    locationName,
    language: settings.language || 'en',
    days,
  });

  if (key === lastScheduleKey) return { scheduled: 0, reason: 'already-scheduled' };

  const pending = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  const pendingPrayerCount = (pending || []).filter(
    (item) => item && item.content && item.content.data
      && item.content.data.type === 'prayer-adhan'
  ).length;

  const storedRaw = await AsyncStorage.getItem(SCHEDULE_STORE_KEY).catch(() => null);
  if (storedRaw) {
    try {
      const stored = JSON.parse(storedRaw);
      const fresh =
        stored
        && stored.key === key
        && Number(stored.scheduledAt) > 0
        && now.getTime() - Number(stored.scheduledAt) < SCHEDULE_REFRESH_MS;
      // Trust the cache only if the OS still holds the alarms:
      // force-stop and some OEM cleaners wipe them.
      if (fresh && pendingPrayerCount >= 10) {
        lastScheduleKey = key;
        return { scheduled: pendingPrayerCount, reason: 'already-scheduled' };
      }
    } catch (e) {
      // corrupted cache — reschedule from scratch
    }
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  let scheduled = 0;
  for (let day = 0; day < days; day += 1) {
    const parts = addDays(today, day);
    const offset = getTimeZoneOffset(
      timeZone,
      new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0))
    );

    const times = computePrayerTimes({
      date: parts,
      lat: location.latitude,
      lng: location.longitude,
      utcOffset: offset,
      method: settings.method,
      asr: settings.asr,
      highLatRule: settings.highLatRule,
      adjustments: settings.adjustments,
    });

    for (const prayerKey of PRAYER_KEYS) {
      const hours = times[prayerKey];
      if (!Number.isFinite(hours)) continue;

      // Respect per-prayer adhan switches (null/missing = enabled)
      if (settings.adhanPrayers && settings.adhanPrayers[prayerKey] === false) {
        continue;
      }

      // Apply per-prayer time offset (minutes; negative = earlier, positive = later)
      const offsetMinutes =
        Number(settings.adhanOffsets && settings.adhanOffsets[prayerKey]) || 0;

      const triggerDate = new Date(
        Date.UTC(parts.year, parts.month - 1, parts.day) +
          (hours - offset) * 60 * 60 * 1000 +
          offsetMinutes * 60 * 1000
      );
      if (triggerDate.getTime() <= now.getTime() + 15000) continue;

      const language = settings.language || 'en';
      const label = translate(language, `prayer.name.${prayerKey}`);
      const body = translate(language, 'prayer.adhanBody', {
        prayer: label,
        location: locationName,
      });
      const isFajr = prayerKey === 'fajr';
      const sound = isFajr ? FAJR_ADHAN_SOUND : ADHAN_SOUND;
      const channelId = isFajr ? FAJR_CHANNEL_ID : CHANNEL_ID;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${label} · ${formatTime(hours)}`,
          body,
          sound,
          priority: Notifications.AndroidNotificationPriority.MAX,
          data: {
            type: 'prayer-adhan',
            prayer: prayerKey,
            location: locationName,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
          channelId,
          // setAlarmClock(): exact, never deferred by Doze / battery savers.
          delivery: 'alarmClock',
        },
      });
      scheduled += 1;
    }
  }

  lastScheduleKey = key;
  await AsyncStorage.setItem(
    SCHEDULE_STORE_KEY,
    JSON.stringify({ key, scheduledAt: Date.now(), count: scheduled })
  ).catch(() => {});
  // Everything is now on the v2 channels: the legacy ones can go, so the
  // system settings screen shows a single adhan channel per sound.
  LEGACY_CHANNEL_IDS.forEach((id) => {
    Notifications.deleteNotificationChannelAsync(id).catch(() => {});
  });
  return { scheduled, reason: 'ok' };
}

export async function cancelPrayerNotifications() {
  lastScheduleKey = null;
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(SCHEDULE_STORE_KEY).catch(() => {});
}

export async function scheduleAdhanTest() {
  if (Platform.OS === 'web') return { ok: false, reason: 'web' };
  const granted = await requestNotificationPermission();
  if (!granted) return { ok: false, reason: 'permission' };
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Slati adhan test',
        body: 'The adhan notification is working.',
        sound: ADHAN_SOUND,
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: { type: 'adhan-test' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 10,
        channelId: CHANNEL_ID,
      },
    });
    return { ok: true, reason: 'ok' };
  } catch (e) {
    return { ok: false, reason: 'error' };
  }
}
