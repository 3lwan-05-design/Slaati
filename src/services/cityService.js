import AsyncStorage from '@react-native-async-storage/async-storage';
import { CITIES } from '../data/cities';
import { computePrayerTimes } from '../prayerTimes';
import { getDatePartsInTimeZone, getTimeZoneOffset } from '../location';

export const SELECTED_CITY_KEY = 'slati.selectedCity.v1';

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function localizedValue(value, language = 'en') {
  if (typeof value === 'string') return value;
  if (!value) return '';
  return value[language] || value.en || value.fr || value.ar || '';
}

function getSearchText(city) {
  return normalizeText(
    [
      city.id,
      city.countryCode,
      ...Object.values(city.name || {}),
      ...Object.values(city.country || {}),
      ...(city.aliases || []),
    ].join(' ')
  );
}

const SEARCH_INDEX = CITIES.map((city) => ({
  city,
  text: getSearchText(city),
  names: normalizeText(
    [...Object.values(city.name || {}), ...(city.aliases || [])].join(' ')
  ),
}));

function isValidCity(city) {
  return Boolean(
    city &&
      city.id &&
      city.name &&
      city.country &&
      city.timezone &&
      Number.isFinite(city.latitude) &&
      Number.isFinite(city.longitude)
  );
}

export function getCityName(city, language = 'en') {
  return localizedValue(city?.name, language);
}

export function getCountryName(city, language = 'en') {
  return localizedValue(city?.country, language);
}

export function getCityLabel(city, language = 'en') {
  const name = getCityName(city, language);
  const country = getCountryName(city, language);
  if (!name) return '';
  return country && country !== name ? `${name}, ${country}` : name;
}

export function getCityById(cityId) {
  if (!cityId) return null;
  const normalizedId = String(cityId).trim().toLowerCase();
  return CITIES.find((city) => city.id.toLowerCase() === normalizedId) || null;
}

export function getCitiesByCountry(countryCode) {
  if (!countryCode) return CITIES.slice();
  const normalizedCode = String(countryCode).trim().toUpperCase();
  return CITIES.filter((city) => city.countryCode === normalizedCode);
}

export function searchCities(query, options = {}) {
  const { language = 'en', countryCode = null, limit = 50 } = options;
  const normalizedQuery = normalizeText(query);
  const tokens = normalizedQuery ? normalizedQuery.split(' ') : [];
  const countryFilter = countryCode ? String(countryCode).trim().toUpperCase() : null;

  const matches = SEARCH_INDEX.filter(({ city, text }) => {
    if (countryFilter && city.countryCode !== countryFilter) return false;
    if (!tokens.length) return true;
    return tokens.every((token) => text.includes(token));
  }).map(({ city, names }) => {
    let rank = 3;
    if (normalizedQuery && names === normalizedQuery) rank = 0;
    else if (normalizedQuery && names.startsWith(normalizedQuery)) rank = 1;
    else if (normalizedQuery && tokens.every((token) => names.includes(token))) rank = 2;
    return { city, rank };
  });

  matches.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return getCityName(a.city, language).localeCompare(getCityName(b.city, language));
  });

  return matches.slice(0, limit).map((entry) => entry.city);
}

export async function getSelectedCity() {
  try {
    const raw = await AsyncStorage.getItem(SELECTED_CITY_KEY);
    if (!raw) return null;

    if (raw.trim().startsWith('{')) {
      const stored = JSON.parse(raw);
      return getCityById(stored.id);
    }

    return getCityById(raw);
  } catch (e) {
    return null;
  }
}

export async function setSelectedCity(cityOrId) {
  const city = typeof cityOrId === 'string' ? getCityById(cityOrId) : getCityById(cityOrId?.id);
  if (!isValidCity(city)) {
    throw new Error('Unknown city. Choose a city from the Slati dataset.');
  }
  await AsyncStorage.setItem(SELECTED_CITY_KEY, city.id);
  return city;
}

export const saveSelectedCity = setSelectedCity;

export async function clearSelectedCity() {
  await AsyncStorage.removeItem(SELECTED_CITY_KEY);
}

export function cityToManualLocation(cityOrId, language = 'en') {
  const city = typeof cityOrId === 'string' ? getCityById(cityOrId) : cityOrId;
  if (!isValidCity(city)) {
    throw new Error('Invalid city data.');
  }

  const name = getCityName(city, language);
  const country = getCountryName(city, language);
  return {
    cityId: city.id,
    city: name,
    country,
    label: country ? `${name}, ${country}` : name,
    latitude: city.latitude,
    longitude: city.longitude,
    timeZone: city.timezone,
  };
}

export function calculatePrayerTimesForCity(cityOrId, settings = {}, date = new Date()) {
  const city = typeof cityOrId === 'string' ? getCityById(cityOrId) : getCityById(cityOrId?.id);
  if (!isValidCity(city)) {
    throw new Error('Invalid city data.');
  }

  const when = date instanceof Date ? date : new Date();
  const dateParts = getDatePartsInTimeZone(city.timezone, when);
  const utcOffset = getTimeZoneOffset(city.timezone, when);

  const times = computePrayerTimes({
    date: dateParts,
    lat: city.latitude,
    lng: city.longitude,
    utcOffset,
    method: settings.method || 'Morocco',
    asr: settings.asr || 'standard',
    highLatRule: settings.highLatRule || 'middle-of-night',
    adjustments: settings.adjustments || {},
  });

  return {
    cityId: city.id,
    timeZone: city.timezone,
    utcOffset,
    date: dateParts,
    times,
  };
}

export async function getSelectedCityPrayerTimes(settings = {}, date = new Date()) {
  const city = await getSelectedCity();
  if (!city) return null;
  return calculatePrayerTimesForCity(city, settings, date);
}
