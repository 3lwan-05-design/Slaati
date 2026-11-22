import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'slati.settings.v1';

const DEFAULT_SETTINGS = {
  method: 'Morocco',
  asr: 'standard',
  highLatRule: 'middle-of-night',
  adjustments: {},
  manualLocation: null,
  gpsLocation: null,
  adhanEnabled: false,
  // Per-prayer adhan switches; when null/missing, all prayers are enabled
  adhanPrayers: null,
  // Per-prayer adhan time offset in minutes; negative = earlier, positive = later
  adhanOffsets: {},
  language: 'en',
  theme: 'emerald',
  // First-launch intro. Kept in settings so it is local and offline only.
  onboardingDone: false,
};

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  // `ready` flips once the stored settings have been read, so screens that
  // depend on a persisted flag (like onboarding) never flash the wrong state.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active || !raw) return;
        const saved = JSON.parse(raw);
        setSettings((prev) => ({ ...prev, ...saved }));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const updateSettings = (patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const value = useMemo(
    () => ({ settings, updateSettings, ready }),
    [settings, ready]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
}
