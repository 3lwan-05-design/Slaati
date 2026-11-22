const DEG = Math.PI / 180;

const sin = (deg) => Math.sin(deg * DEG);
const cos = (deg) => Math.cos(deg * DEG);
const tan = (deg) => Math.tan(deg * DEG);
const asin = (x) => Math.asin(clampUnit(x)) / DEG;
const acos = (x) => Math.acos(clampUnit(x)) / DEG;
const atan = (x) => Math.atan(x) / DEG;
const atan2 = (y, x) => Math.atan2(y, x) / DEG;

function clampUnit(x) {
  if (x > 1) return 1;
  if (x < -1) return -1;
  return x;
}

function fix(x, base) {
  return x - base * Math.floor(x / base);
}

function fixHour(h) {
  return fix(h, 24);
}

function fixAngle(a) {
  return fix(a, 360);
}

function wrap12(h) {
  return fix(h + 12, 24) - 12;
}

function hourDiff(a, b) {
  return fixHour(a - b);
}

export const METHODS = {
  Morocco: { name: 'Morocco — Ministry of Habous', fajrAngle: 19, ishaAngle: 17 },
  MWL: { name: 'Muslim World League', fajrAngle: 18, ishaAngle: 17 },
  ISNA: { name: 'Society of Islamic Centers of North America', fajrAngle: 15, ishaAngle: 15 },
  Egypt: { name: 'Egyptian General Authority of Survey', fajrAngle: 19.5, ishaAngle: 17.5 },
  Makkah: { name: 'Umm Al-Qura University, Makkah', fajrAngle: 18.5, ishaMinutes: 90 },
  Karachi: { name: 'University of Islamic Sciences, Karachi', fajrAngle: 18, ishaAngle: 18 },
  Tehran: { name: 'Institute of Geophysics, University of Tehran', fajrAngle: 17.7, ishaAngle: 14 },
  Custom: { name: 'Custom', fajrAngle: 18, ishaAngle: 17 },
};

export const ASR_METHODS = {
  standard: { name: "Shafi'i, Maliki, Ja'fari", factor: 1 },
  hanafi: { name: 'Hanafi', factor: 2 },
};

export const HIGH_LAT_RULES = ['middle-of-night', 'one-seventh', 'angle-based'];

export const PRAYER_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'sunset', 'maghrib', 'isha'];

export function julianDay(year, month, day) {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const a = Math.floor(year / 100);
  const b = 2 - a + Math.floor(a / 4);
  return (
    Math.floor(365.25 * (year + 4716)) +
    Math.floor(30.6001 * (month + 1)) +
    day +
    b -
    1524.5
  );
}

function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * sin(g) + 0.02 * sin(2 * g));
  const e = 23.439 - 0.00000036 * D;
  const RA = fixHour(atan2(cos(e) * sin(L), cos(L)) / 15);
  const eqt = wrap12(q / 15 - RA);
  const decl = asin(sin(e) * sin(L));
  return { decl, eqt };
}

function computeHourAngle(lat, decl, alt) {
  return acos(
    (sin(alt) - sin(lat) * sin(decl)) / (cos(lat) * cos(decl))
  );
}

function nightPortion(rule, angle) {
  if (rule === 'one-seventh') return 1 / 7;
  if (rule === 'angle-based') return angle / 60;
  return 0.5;
}

function resolveDate(date) {
  if (date instanceof Date) {
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
  }
  if (
    date &&
    typeof date === 'object' &&
    Number.isFinite(date.year) &&
    Number.isFinite(date.month) &&
    Number.isFinite(date.day)
  ) {
    return { year: date.year, month: date.month, day: date.day };
  }
  return null;
}

function validateNum(name, value) {
  if (!Number.isFinite(value)) {
    throw new Error(`computePrayerTimes: ${name} must be a finite number`);
  }
}

function solarNoon(jd, lng) {
  const { eqt } = sunPosition(jd);
  return 12 - eqt - lng / 15;
}

function computeSunEvent(jd0, lat, lng, alt, morning) {
  let t = morning ? 6 : 18;
  let result = t;

  for (let i = 0; i < 5; i += 1) {
    const jd = jd0 + t / 24;
    const { decl } = sunPosition(jd);
    const H = computeHourAngle(lat, decl, alt);
    if (Number.isNaN(H)) return null;
    result = solarNoon(jd, lng) + (morning ? -H / 15 : H / 15);
    t = result;
  }

  const jd = jd0 + result / 24;
  const { decl } = sunPosition(jd);
  const H = computeHourAngle(lat, decl, alt);
  if (Number.isNaN(H)) return null;
  return solarNoon(jd, lng) + (morning ? -H / 15 : H / 15);
}

function computeNoon(jd0, lng) {
  let t = 12;
  let result = 12;
  for (let i = 0; i < 5; i += 1) {
    result = solarNoon(jd0 + t / 24, lng);
    t = result;
  }
  return solarNoon(jd0 + result / 24, lng);
}

function computeAsr(jd0, lat, lng, declOf, factor) {
  let t = 15;
  let result = 15;

  for (let i = 0; i < 5; i += 1) {
    const jd = jd0 + t / 24;
    const { decl } = sunPosition(jd);
    const alt = atan(1 / (factor + tan(Math.abs(lat - decl))));
    const H = computeHourAngle(lat, decl, alt);
    if (Number.isNaN(H)) return null;
    result = solarNoon(jd, lng) + H / 15;
    t = result;
  }

  const jd = jd0 + result / 24;
  const { decl } = sunPosition(jd);
  const alt = atan(1 / (factor + tan(Math.abs(lat - decl))));
  const H = computeHourAngle(lat, decl, alt);
  if (Number.isNaN(H)) return null;
  return solarNoon(jd, lng) + H / 15;
}

export function computePrayerTimes(options) {
  const {
    date,
    lat,
    lng,
    utcOffset,
    method = 'MWL',
    asr = 'standard',
    highLatRule = 'middle-of-night',
    elevation = 0,
    adjustments = {},
  } = options || {};

  validateNum('lat', lat);
  validateNum('lng', lng);
  validateNum('utcOffset', utcOffset);
  if (lat < -90 || lat > 90) {
    throw new Error('computePrayerTimes: lat must be in [-90, 90]');
  }

  const d = resolveDate(date === undefined ? new Date() : date);
  if (!d) {
    throw new Error('computePrayerTimes: date must be a Date or {year, month, day}');
  }

  const cfg = METHODS[method] || METHODS.Custom;
  let fajrAngle = cfg.fajrAngle;
  let ishaAngle = cfg.ishaAngle;
  let ishaMinutes = cfg.ishaMinutes;
  if (Number.isFinite(options.fajrAngle)) fajrAngle = options.fajrAngle;
  if (Number.isFinite(options.ishaAngle)) ishaAngle = options.ishaAngle;
  if (Number.isFinite(options.ishaMinutes)) ishaMinutes = options.ishaMinutes;
  const maghribMinutes = Number.isFinite(options.maghribMinutes)
    ? options.maghribMinutes
    : 0;

  const factor = ASR_METHODS[asr]?.factor || 1;
  const jd0 = julianDay(d.year, d.month, d.day);

  const declOf = (jd) => ({ decl: sunPosition(jd).decl });

  const horizon = 0.833 + (elevation > 0 ? 0.0347 * Math.sqrt(elevation) : 0);

  const dhuhrUtc = computeNoon(jd0, lng);
  const sunriseUtc = computeSunEvent(jd0, lat, lng, -horizon, true);
  const sunsetUtc = computeSunEvent(jd0, lat, lng, -horizon, false);
  const fajrUtc = computeSunEvent(jd0, lat, lng, -fajrAngle, true);
  const asrUtc = computeAsr(jd0, lat, lng, declOf, factor);
  const ishaUtc =
    ishaMinutes !== undefined
      ? null
      : computeSunEvent(jd0, lat, lng, -ishaAngle, false);

  let sunriseEff = sunriseUtc;
  let sunsetEff = sunsetUtc;

  if (sunriseUtc === null || sunsetUtc === null) {
    sunriseEff = fixHour(dhuhrUtc - 6);
    sunsetEff = fixHour(dhuhrUtc + 6);
  }

  const night = 24 - fixHour((sunsetEff || 12) - (sunriseEff || 12));

  let fajrEff = fajrUtc;
  let ishaEff = ishaUtc;

  if (fajrEff === null || (sunriseEff !== null && hourDiff(sunriseEff, fajrEff) > night * nightPortion(highLatRule, fajrAngle))) {
    fajrEff = fixHour((sunriseEff !== null ? sunriseEff : dhuhrUtc - 6) - night * nightPortion(highLatRule, fajrAngle));
  }

  if (ishaUtc === null) {
    ishaEff = fixHour((sunsetEff !== null ? sunsetEff : dhuhrUtc + 6) + ishaMinutes);
  } else if (
    sunsetEff !== null &&
    hourDiff(ishaEff, sunsetEff) > night * nightPortion(highLatRule, ishaAngle)
  ) {
    ishaEff = fixHour(sunsetEff + night * nightPortion(highLatRule, ishaAngle));
  }

  const maghribUtc =
    sunsetEff === null ? null : sunsetEff + maghribMinutes / 60;

  const toLocal = (utc) =>
    utc === null || utc === undefined ? null : fixHour(utc + utcOffset);

  const adj = adjustments || {};
  const applyAdj = (key, local) =>
    local === null || local === undefined
      ? null
      : fixHour(local + (Number.isFinite(adj[key]) ? adj[key] : 0) / 60);

  const times = {
    fajr: applyAdj('fajr', toLocal(fajrEff)),
    sunrise: toLocal(sunriseEff),
    dhuhr: applyAdj('dhuhr', toLocal(dhuhrUtc)),
    asr: applyAdj('asr', toLocal(asrUtc)),
    sunset: toLocal(sunsetEff),
    maghrib: applyAdj('maghrib', toLocal(maghribUtc)),
    isha: applyAdj('isha', toLocal(ishaEff)),
  };

  return times;
}

export function formatTime(hours) {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) {
    return '—';
  }
  const totalMinutes = Math.round(fixHour(hours) * 60) % 1440;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
