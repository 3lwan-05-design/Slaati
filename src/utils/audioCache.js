import * as FileSystem from 'expo-file-system/legacy';

const ROOT = () => `${FileSystem.documentDirectory}slati-audio/`;
const DIR = (reciter) => `${ROOT()}${reciter}/`;
const FILE = (reciter, global) => `${DIR(reciter)}${global}.mp3`;
export const REMOTE = (reciter, global) =>
  `https://cdn.islamic.network/quran/audio/128/${reciter}/${global}.mp3`;

let cached = null;

export async function initAudioCache() {
  if (cached || !FileSystem.documentDirectory) return;
  try {
    const root = ROOT();
    const info = await FileSystem.getInfoAsync(root);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(root, { intermediates: true });
      cached = new Set();
      return;
    }
    const set = new Set();
    const reciters = await FileSystem.readDirectoryAsync(root);
    for (const reciter of reciters) {
      const files = await FileSystem.readDirectoryAsync(DIR(reciter));
      files.forEach((name) => {
        if (name.endsWith('.mp3')) set.add(`${reciter}/${name.slice(0, -4)}`);
      });
    }
    cached = set;
  } catch (e) {
    cached = new Set();
  }
}

export function isCached(reciter, global) {
  return Boolean(cached && cached.has(`${reciter}/${global}`));
}

export function localUri(reciter, global) {
  return FILE(reciter, global);
}

export function sourceFor(reciter, global) {
  return isCached(reciter, global) ? { uri: localUri(reciter, global) } : { uri: REMOTE(reciter, global) };
}

export async function ensureCached(reciter, global) {
  await initAudioCache();
  if (isCached(reciter, global)) return localUri(reciter, global);
  if (!FileSystem.documentDirectory) return REMOTE(reciter, global);
  try {
    await FileSystem.makeDirectoryAsync(DIR(reciter), { intermediates: true });
    const result = await FileSystem.downloadAsync(REMOTE(reciter, global), FILE(reciter, global));
    if (result.status === 200) {
      if (!cached) cached = new Set();
      cached.add(`${reciter}/${global}`);
      return localUri(reciter, global);
    }
  } catch (e) {}
  return REMOTE(reciter, global);
}

export async function cacheSurah(reciter, number, versesCount, start, onProgress) {
  await initAudioCache();
  let done = 0;
  for (let i = 0; i < versesCount; i += 1) {
    await ensureCached(reciter, start + i);
    done += 1;
    if (onProgress) onProgress(done, versesCount);
  }
  return done;
}

export async function isSurahCached(reciter, versesCount, start) {
  await initAudioCache();
  for (let i = 0; i < versesCount; i += 1) {
    if (!isCached(reciter, start + i)) return false;
  }
  return true;
}

export async function cacheSizeMb() {
  await initAudioCache();
  if (!FileSystem.documentDirectory || !cached) return 0;
  let bytes = 0;
  for (const key of cached) {
    const [reciter, global] = key.split('/');
    try {
      const info = await FileSystem.getInfoAsync(FILE(reciter, global));
      if (info.exists) bytes += info.size || 0;
    } catch (e) {}
  }
  return Math.round((bytes / 1048576) * 10) / 10;
}

export async function clearAudioCache() {
  try {
    await FileSystem.deleteAsync(ROOT(), { idempotent: true });
  } catch (e) {}
  cached = new Set();
}
