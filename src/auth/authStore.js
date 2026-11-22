import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

// Local (offline) accounts. Everything lives on this device only:
// accounts list + active session, both in AsyncStorage. No server.
const ACCOUNTS_KEY = 'slati.accounts.v1';
const SESSION_KEY = 'slati.session.v1';

const MIN_PASSWORD = 6;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const normalizeName = (name) => String(name || '').trim();

async function readJson(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJson(key, value) {
  return AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
}

async function hashPassword(password) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `slati::${password}`
  );
}

function publicUser(account) {
  return {
    name: account.name,
    email: account.email,
    provider: account.provider,
  };
}

export function validateEmail(email) {
  const value = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function loadSession() {
  return readJson(SESSION_KEY, null);
}

export async function signUp({ name, email, password }) {
  const mail = normalizeEmail(email);
  if (!validateEmail(mail)) return { ok: false, error: 'email' };
  if (String(password || '').length < MIN_PASSWORD) return { ok: false, error: 'password' };
  if (normalizeName(name).length < 2) return { ok: false, error: 'name' };

  const accounts = await readJson(ACCOUNTS_KEY, {});
  if (accounts[mail]) return { ok: false, error: 'exists' };

  const account = {
    name: normalizeName(name),
    email: mail,
    provider: 'local',
    passHash: await hashPassword(password),
    createdAt: Date.now(),
  };
  accounts[mail] = account;
  await writeJson(ACCOUNTS_KEY, accounts);

  const session = { guest: false, user: publicUser(account) };
  await writeJson(SESSION_KEY, session);
  return { ok: true, session };
}

export async function signIn({ email, password }) {
  const mail = normalizeEmail(email);
  if (!validateEmail(mail)) return { ok: false, error: 'email' };
  if (String(password || '').length < MIN_PASSWORD) return { ok: false, error: 'password' };

  const accounts = await readJson(ACCOUNTS_KEY, {});
  const account = accounts[mail];
  if (!account) return { ok: false, error: 'noAccount' };

  const passHash = await hashPassword(password);
  if (account.passHash && account.passHash !== passHash) {
    return { ok: false, error: 'wrongPassword' };
  }

  const session = { guest: false, user: publicUser(account) };
  await writeJson(SESSION_KEY, session);
  return { ok: true, session };
}

// Google / Facebook sign-in: the profile comes from the provider, there is
// no local password for it. The account is created (or matched) silently.
export async function socialSignIn({ provider, id, name, email }) {
  const mail = normalizeEmail(email);
  const accounts = await readJson(ACCOUNTS_KEY, {});

  const key = mail || `${provider}:${id}`;
  const existing = accounts[key];
  const account = existing || {
    name: normalizeName(name) || mail.split('@')[0] || provider,
    email: mail,
    provider,
    socialId: id,
    createdAt: Date.now(),
  };
  if (existing && normalizeName(name)) existing.name = normalizeName(name);

  accounts[key] = account;
  await writeJson(ACCOUNTS_KEY, accounts);

  const session = { guest: false, user: publicUser(account) };
  await writeJson(SESSION_KEY, session);
  return { ok: true, session };
}

export async function continueAsGuest() {
  const session = { guest: true, user: null };
  await writeJson(SESSION_KEY, session);
  return session;
}

export async function signOut() {
  await AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
}

export async function deleteCurrentAccount() {
  const session = await loadSession();
  const user = session && !session.guest ? session.user : null;
  const accounts = await readJson(ACCOUNTS_KEY, {});

  if (user) {
    const mail = normalizeEmail(user.email);
    if (mail && accounts[mail]) delete accounts[mail];
    for (const key of Object.keys(accounts)) {
      const acc = accounts[key];
      if (
        acc &&
        ((mail && normalizeEmail(acc.email) === mail) ||
          (acc.provider === (user.provider || 'local') && acc.name === user.name))
      ) {
        delete accounts[key];
      }
    }
  }

  await writeJson(ACCOUNTS_KEY, accounts);
  await AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
  return continueAsGuest();
}
