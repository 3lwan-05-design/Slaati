import { Platform } from 'react-native';
import * as Location from 'expo-location';
import tzlookup from 'tz-lookup';

export function getTimeZone(lat, lng) {
  try {
    return tzlookup(lat, lng);
  } catch (e) {
    return null;
  }
}

export function getDeviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch (e) {
    return null;
  }
}

export function getClockInTimeZone(timeZone, date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(date);
    const values = {};
    for (const part of parts) {
      if (part.type !== 'literal') values[part.type] = Number(part.value);
    }
    const hour = values.hour === 24 ? 0 : values.hour;
    return hour + values.minute / 60 + values.second / 3600;
  } catch (e) {
    return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  }
}

export function getDatePartsInTimeZone(timeZone, date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = {};
    for (const part of parts) {
      if (part.type !== 'literal') values[part.type] = Number(part.value);
    }
    return { year: values.year, month: values.month, day: values.day };
  } catch (e) {
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
  }
}

export function getTimeZoneOffset(timeZone, date = new Date()) {
  if (!timeZone) return -date.getTimezoneOffset() / 60;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = {};
    for (const part of formatter.formatToParts(date)) {
      if (part.type !== 'literal') parts[part.type] = part.value;
    }
    const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour);
    const asUTC = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      hour,
      Number(parts.minute),
      Number(parts.second)
    );
    const hours = (asUTC - date.getTime()) / 3600000;
    return Math.round(hours * 4) / 4;
  } catch (e) {
    return -date.getTimezoneOffset() / 60;
  }
}

export function locationLabel(place, fallback = 'Current location') {
  if (!place) return fallback;
  const city = place.city || place.subregion || place.district;
  const country = place.country || place.region;
  if (city && country && city !== country) return `${city}, ${country}`;
  return city || country || fallback;
}

async function geocodeWithNominatim(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(
    query
  )}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Location search failed.');
  const results = await response.json();
  if (!results || !results.length) throw new Error('City not found. Try another spelling.');
  const first = results[0];
  return {
    latitude: Number(first.lat),
    longitude: Number(first.lon),
    displayName: first.display_name || query,
    country: first.address?.country || '',
    city: first.address?.city || first.address?.town || first.name || '',
  };
}

export async function findLocation(city, country) {
  const cleanCity = city.trim();
  const cleanCountry = country.trim();
  if (!cleanCity) throw new Error('Enter a city name.');

  const query = [cleanCity, cleanCountry].filter(Boolean).join(', ');
  let result = null;

  if (Platform.OS === 'web') {
    result = await geocodeWithNominatim(query);
  } else {
    const matches = await Location.geocodeAsync(query);
    if (!matches || !matches.length) {
      throw new Error('City not found. Check the spelling and try again.');
    }
    const first = matches[0];
    let place = null;
    try {
      const reverse = await Location.reverseGeocodeAsync({
        latitude: first.latitude,
        longitude: first.longitude,
      });
      place = reverse && reverse[0] ? reverse[0] : null;
    } catch (e) {
      place = null;
    }
    result = {
      latitude: first.latitude,
      longitude: first.longitude,
      city: place?.city || cleanCity,
      country: place?.country || cleanCountry,
      displayName: locationLabel(place, query),
    };
  }

  const timeZone = getTimeZone(result.latitude, result.longitude);
  if (!timeZone) throw new Error('Could not determine the time zone for this city.');

  return {
    city: result.city || cleanCity,
    country: result.country || cleanCountry,
    label: result.city && result.country ? `${result.city}, ${result.country}` : query,
    latitude: result.latitude,
    longitude: result.longitude,
    timeZone,
  };
}
