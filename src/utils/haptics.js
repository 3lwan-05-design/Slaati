import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Tiny haptics layer. On web the module exists but the native feedback
// calls are no-ops / rejected, so everything is guarded and swallowed.
const enabled = Platform.OS !== 'web';

export function tapHaptic() {
  if (!enabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function mediumHaptic() {
  if (!enabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function successHaptic() {
  if (!enabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
