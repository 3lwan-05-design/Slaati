const emerald = {
  id: 'emerald',
  label: 'Emerald',
  colors: {
    background: '#06141d',
    backgroundAlt: '#0a2029',
    surface: '#0f2a35',
    surfaceAlt: '#143744',
    surfaceSoft: 'rgba(255,255,255,0.055)',
    primary: '#2ec4b6',
    primaryDark: '#0f8f86',
    primarySoft: 'rgba(46,196,182,0.14)',
    gold: '#d8b56b',
    goldSoft: 'rgba(216,181,107,0.15)',
    text: '#f4f7f6',
    textMuted: '#93a9b0',
    textFaint: '#617a82',
    border: 'rgba(255,255,255,0.09)',
    borderStrong: 'rgba(255,255,255,0.16)',
    danger: '#ff8d8d',
    white: '#ffffff',
    black: '#000000',
  },
  gradients: {
    screen: ['#06141d', '#0a2029', '#071820'],
    card: ['rgba(20,55,68,0.95)', 'rgba(15,42,53,0.95)'],
    hero: ['#123f4a', '#0d2d38'],
    gold: ['#e7c982', '#c49b4e'],
    compass: ['rgba(20,55,68,0.98)', 'rgba(8,26,35,0.98)'],
  },
};

const gold = {
  id: 'gold',
  label: 'Black & Gold',
  colors: {
    background: '#050505',
    backgroundAlt: '#0b0a08',
    surface: '#14110a',
    surfaceAlt: '#1d1810',
    surfaceSoft: 'rgba(255,255,255,0.05)',
    primary: '#d4af37',
    primaryDark: '#a88422',
    primarySoft: 'rgba(212,175,55,0.16)',
    gold: '#e7c982',
    goldSoft: 'rgba(231,201,130,0.15)',
    text: '#f7f1e3',
    textMuted: '#b9aa8a',
    textFaint: '#7d715b',
    border: 'rgba(231,201,130,0.14)',
    borderStrong: 'rgba(231,201,130,0.28)',
    danger: '#ff9a8d',
    white: '#ffffff',
    black: '#000000',
  },
  gradients: {
    screen: ['#050505', '#0b0a08', '#080705'],
    card: ['rgba(29,24,16,0.96)', 'rgba(20,17,10,0.96)'],
    hero: ['#2a2110', '#151108'],
    gold: ['#f0d78c', '#b8912f'],
    compass: ['rgba(29,24,16,0.98)', 'rgba(8,7,4,0.98)'],
  },
};

const light = {
  id: 'light',
  label: 'Light',
  colors: {
    background: '#f4f7f6',
    backgroundAlt: '#eaf1ef',
    surface: '#ffffff',
    surfaceAlt: '#f0f5f3',
    surfaceSoft: 'rgba(0,0,0,0.04)',
    primary: '#0f8f86',
    primaryDark: '#0a6b64',
    primarySoft: 'rgba(15,143,134,0.12)',
    gold: '#b8912f',
    goldSoft: 'rgba(184,145,47,0.12)',
    text: '#0b1a1e',
    textMuted: '#4a636a',
    textFaint: '#8aa3aa',
    border: 'rgba(0,0,0,0.08)',
    borderStrong: 'rgba(0,0,0,0.16)',
    danger: '#d32f2f',
    white: '#ffffff',
    black: '#000000',
  },
  gradients: {
    screen: ['#f4f7f6', '#eaf1ef', '#f4f7f6'],
    card: ['rgba(255,255,255,0.98)', 'rgba(240,245,243,0.98)'],
    hero: ['#e0f2f0', '#d0e8e5'],
    gold: ['#f0d78c', '#b8912f'],
    compass: ['rgba(255,255,255,0.98)', 'rgba(240,245,243,0.98)'],
  },
};

export const THEMES = { emerald, gold, light };

export function getTheme(mode) {
  return THEMES[mode] || THEMES.emerald;
}

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
};

export const RADIUS = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const SHADOWS = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
};
