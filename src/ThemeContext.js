import { useSettings } from './SettingsContext';
import { getTheme } from './theme';

export function useTheme() {
  const { settings } = useSettings();
  return getTheme(settings.theme);
}
